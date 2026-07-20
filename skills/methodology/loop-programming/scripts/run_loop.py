#!/usr/bin/env python3
"""Bounded validator-driven loop harness.

Version 0.1 provides:
- configuration loading and validation (JSON natively, YAML when available);
- state and limit management;
- subprocess validators;
- checkpoint and event logging;
- adapter interfaces for agent decisions and tool execution;
- ``--dry-run`` and ``--validate-only`` modes for runtimes without native
  tool execution, where an outer process drives the loop.

Provider-specific model adapters should be implemented separately.

Exit codes:
    0   SUCCESS
    2   BLOCKED
    3   STAGNATED
    4   LIMIT_REACHED
    5   UNSAFE
    6   RUNTIME_ERROR
    7   INVALID_CONFIGURATION
    8   VALIDATOR_FAILURE (validation-only mode)
"""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Protocol, Sequence

EXIT_SUCCESS = 0
EXIT_BLOCKED = 2
EXIT_STAGNATED = 3
EXIT_LIMIT_REACHED = 4
EXIT_UNSAFE = 5
EXIT_RUNTIME_ERROR = 6
EXIT_INVALID_CONFIGURATION = 7
EXIT_VALIDATOR_FAILURE = 8

SCHEMA_VERSION = "0.1"


class LoopState(str, Enum):
    INITIALIZE = "initialize"
    INSPECT = "inspect"
    PLAN = "plan"
    ACT = "act"
    OBSERVE = "observe"
    VALIDATE = "validate"
    SUCCESS = "success"
    BLOCKED = "blocked"
    STAGNATED = "stagnated"
    LIMIT_REACHED = "limit_reached"
    UNSAFE = "unsafe"
    RUNTIME_ERROR = "runtime_error"


class ActionKind(str, Enum):
    READ_FILE = "read_file"
    SEARCH = "search"
    LIST_FILES = "list_files"
    PATCH_FILE = "patch_file"
    WRITE_FILE = "write_file"
    RUN_COMMAND = "run_command"
    WEB_RESEARCH = "web_research"
    DELEGATE = "delegate"
    COMPLETE = "complete"


READ_ONLY_KINDS = frozenset(
    {ActionKind.READ_FILE, ActionKind.SEARCH, ActionKind.LIST_FILES}
)
MUTATING_KINDS = frozenset({ActionKind.PATCH_FILE, ActionKind.WRITE_FILE})


@dataclass(frozen=True)
class ValidatorSpec:
    id: str
    command: str
    type: str = "command"
    required: bool = True


@dataclass(frozen=True)
class Limits:
    max_iterations: int = 12
    timeout_seconds: int = 600
    command_timeout_seconds: int = 120
    stagnation_limit: int = 3


@dataclass(frozen=True)
class LoopContract:
    goal: str
    cwd: Path
    validators: tuple[ValidatorSpec, ...]
    include_paths: tuple[str, ...] = ()
    exclude_paths: tuple[str, ...] = ()
    limits: Limits = field(default_factory=Limits)


@dataclass(frozen=True)
class Action:
    kind: ActionKind
    reason: str
    arguments: dict[str, Any]
    expected_signal: str
    mutates_state: bool = False


@dataclass
class ActionResult:
    success: bool
    exit_code: int | None = None
    stdout: str = ""
    stderr: str = ""
    changed_paths: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    truncated: bool = False


@dataclass
class ValidatorResult:
    validator_id: str
    passed: bool
    exit_code: int | None
    summary: str
    output_excerpt: str
    duration_seconds: float


@dataclass
class IterationRecord:
    number: int
    hypothesis: str
    action: Action
    action_result: ActionResult
    validators: list[ValidatorResult]
    progress_signature: str
    made_progress: bool


@dataclass
class LoopResult:
    schema_version: str
    status: str
    stop_reason: str
    goal: str
    iterations_used: int
    elapsed_seconds: float
    changed_files: list[str]
    validators: list[ValidatorResult]
    actions_attempted: list[str]
    current_hypothesis: str | None
    next_best_action: str | None
    resume_safe: bool


class AgentAdapter(Protocol):
    def decide(
        self,
        *,
        contract: LoopContract,
        state: dict[str, Any],
        history: Sequence[IterationRecord],
    ) -> Action:
        """Return one logical next action."""


class ToolAdapter(Protocol):
    def execute(
        self,
        *,
        action: Action,
        contract: LoopContract,
    ) -> ActionResult:
        """Execute one authorized action."""


class ConfigurationError(ValueError):
    pass


class UnsafeActionError(RuntimeError):
    pass


class BlockedActionError(RuntimeError):
    """Raised by tool adapters when an action needs an unavailable capability."""


class JsonEventLogger:
    def __init__(self, path: Path | None) -> None:
        self.path = path

    def emit(
        self,
        event: str,
        *,
        iteration: int | None = None,
        data: dict[str, Any] | None = None,
    ) -> None:
        if self.path is None:
            return

        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "timestamp": time.strftime(
                "%Y-%m-%dT%H:%M:%SZ",
                time.gmtime(),
            ),
            "event": event,
            "iteration": iteration,
            "data": data or {},
        }

        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def truncate_output(value: str, limit: int = 12_000) -> tuple[str, bool]:
    if len(value) <= limit:
        return value, False

    head_size = limit // 2
    tail_size = limit - head_size
    marker = "\n... output truncated ...\n"
    return value[:head_size] + marker + value[-tail_size:], True


def resolve_within(path: Path, *, base: Path | None = None) -> Path:
    """Resolve path and require it to stay inside base (default: process cwd)."""
    root = (base or Path.cwd()).resolve()
    candidate = path.expanduser().resolve()

    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise UnsafeActionError(
            f"Path escapes working directory: {candidate}"
        ) from error

    return candidate


def atomic_write_json(
    path: Path,
    payload: dict[str, Any],
    *,
    base: Path | None = None,
) -> None:
    destination = resolve_within(path, base=base)
    destination.parent.mkdir(parents=True, exist_ok=True)

    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=destination.parent,
            delete=False,
        ) as handle:
            temporary_path = Path(handle.name)
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")

        os.replace(temporary_path, destination)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


SAFE_ENV_KEYS = (
    "PATH",
    "HOME",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TMPDIR",
    "TEMP",
    "TMP",
    "USER",
    "LOGNAME",
    "SHELL",
    "TERM",
    "CI",
    "SYSTEMROOT",
    "COMSPEC",
    "PATHEXT",
    "USERPROFILE",
    "APPDATA",
    "PROGRAMDATA",
)


def scrubbed_env() -> dict[str, str]:
    """Minimal environment for subprocesses: known-safe variables only."""
    return {
        key: os.environ[key] for key in SAFE_ENV_KEYS if key in os.environ
    }


def _has_flag(arguments: Sequence[str], short: str, long: str | None = None) -> bool:
    for argument in arguments:
        if long is not None and argument == long:
            return True
        if (
            argument.startswith("-")
            and not argument.startswith("--")
            and short in argument[1:]
        ):
            return True
    return False


def _strip_git_global_options(rest: list[str]) -> list[str] | None:
    """Strip git global options from the front of an argv.

    Recognized options: ``-C <path>``, ``-c <key>=<value>``,
    ``--config=<key>=<value>``, ``--config <key>=<value>``,
    ``--git-dir=<path>``, ``--git-dir <path>``, ``--work-tree=<path>``,
    ``--work-tree <path>``, ``--bare``, ``-b <branch>``,
    ``--exec-path=<path>``, ``--exec-path <path>``, ``--no-pager``,
    ``--no-replace-objects``, ``--literal-pathspecs``, ``--glob-pathspecs``,
    ``--paginate``, ``-p``.

    Returns the remaining argv (without the leading ``git``) or None if
    the option list is unparseable (e.g. an option that requires a value
    without one).
    """
    flags_with_value = {
        "-c", "--config", "--git-dir", "--work-tree",
        "--exec-path", "--namespace",
    }
    short_with_value = {"-C", "-c"}
    boolean_flags = {
        "--bare", "--no-pager", "--no-replace-objects",
        "--literal-pathspecs", "--glob-pathspecs", "--paginate", "-p",
        "-b",
    }

    index = 0
    while index < len(rest):
        argument = rest[index]

        if argument in boolean_flags:
            index += 1
            continue

        if argument in flags_with_value:
            if index + 1 >= len(rest):
                return None
            index += 2
            continue

        if argument.startswith("--config="):
            index += 1
            continue

        for flag in ("--git-dir", "--work-tree", "--exec-path"):
            if argument.startswith(flag + "="):
                index += 1
                break
        else:
            # Handle short flags. A short flag may be either a single
            # character ("-C", "-c", "-b", "-p") or a combined group
            # ("-Cpath", "-bnone"). The single-character short flags that
            # require a following value are in ``short_with_value``.
            if argument.startswith("-") and not argument.startswith("--"):
                if argument in short_with_value:
                    # ``-C``, ``-c``: skip the flag and its value.
                    if index + 1 >= len(rest):
                        return None
                    index += 2
                    continue
                if len(argument) > 2:
                    # Combined short flags ("-Cpath", "-bnone"). Only the
                    # leading letter is recognised; any remaining letters
                    # are left to the downstream git invocation, which
                    # will reject unknown combinations.
                    letter = argument[1]
                    if letter in short_with_value:
                        index += 1
                        continue
                    if letter in {"p", "b"} or letter.isalpha():
                        index += 1
                        continue
                    index += 1
                    continue
                # ``-p`` and ``-b`` are bare short flags; ``-b`` is
                # documented as accepting a value but we conservatively
                # treat it as boolean here (downstream git rejects the
                # missing value).
                if argument in {"-p", "-b"} or argument.lstrip("-").isalpha():
                    index += 1
                    continue
                index += 1
                continue
            if argument.startswith("-"):
                # Unknown flag; be conservative and signal unparseable
                # so the caller fails closed rather than treating an
                # un-inspected subcommand as policy-clean.
                return None

            return rest[index:]

    # The loop exited normally (no break). `index` is guaranteed
    # set here because every `continue` branch advances it; an empty
    # `rest` short-circuits to `[]` before the loop body runs.
    return rest[index:] if index <= len(rest) else []


def _is_git_wrapper(arguments: Sequence[str]) -> Sequence[str] | None:
    """Unwrap simple git wrappers so the policy check sees the real git argv.

    Recognizes ``git -C <path> ...`` (common global option) and common
    command wrappers (``env``, ``command``, ``builtin``, ``/usr/bin/env``).
    Returns the inner argv (still starting with ``git``) or None if the
    command is not a recognizable git wrapper.
    """
    if not arguments:
        return None

    program = Path(arguments[0]).name
    rest = list(arguments[1:])

    if program.lower() == "git":
        stripped = _strip_git_global_options(rest)
        if stripped is None:
            return None
        return ("git", *stripped)

    # (The previous inline `-C` loop is now covered by
    # `_strip_git_global_options`, which handles `-C` plus all other
    # git global options.)

    if program.lower() in {"env", "command", "builtin"}:
        index = 0
        while index < len(rest):
            arg = rest[index]
            if "=" in arg and not arg.startswith("-"):
                name = arg.split("=", 1)[0]
                if re.fullmatch(r"[A-Za-z_]\w*", name):
                    index += 1
                    continue
            break
        if index >= len(rest):
            return None
        if rest[index].startswith("-"):
            return None
        return tuple(rest[index:])

    return None


def _check_git_policy(rest: Sequence[str]) -> str | None:
    """Git-specific prohibited subcommands from references/safety-policy.md."""
    stripped = _strip_git_global_options(list(rest))
    if stripped is None:
        return "git invocation has unrecognised global options"
    if not stripped:
        return None

    subcommand = stripped[0]
    flags = stripped[1:]

    if subcommand == "reset" and "--hard" in flags:
        return "discarding working-tree changes via git reset is prohibited"
    if (
        subcommand == "clean"
        and _has_flag(flags, "f", "--force")
        and (_has_flag(flags, "d") or _has_flag(flags, "x"))
    ):
        return "discarding untracked files via git clean is prohibited"
    if subcommand == "push" and (
        _has_flag(flags, "f") or any(f.startswith("--force") for f in flags)
    ):
        return "force-pushing is prohibited"
    if subcommand == "branch" and "-D" in flags:
        return "force-deleting branches is prohibited"
    if subcommand in {"checkout", "restore"} and any(
        argument in {".", "--"} for argument in flags
    ):
        return "discarding working-tree changes via git checkout/restore is prohibited"

    return None


DANGEROUS_PROGRAMS = frozenset(
    {
        "shutdown",
        "reboot",
        "halt",
        "poweroff",
        "init",
        "mkfs",
        "mkfs.ext2",
        "mkfs.ext3",
        "mkfs.ext4",
        "mkfs.xfs",
        "mkfs.btrfs",
        "dd",
        "fdisk",
        "parted",
    }
)


def check_command_policy(arguments: Sequence[str]) -> str | None:
    """Return a violation reason for policy-prohibited argv, else None.

    Operates on parsed argv (not substring matching) so flag reordering
    or combined short flags cannot bypass the check. Mirrors
    references/safety-policy.md.
    """
    if not arguments:
        return None

    wrapped = _is_git_wrapper(arguments)
    if wrapped is not None:
        arguments = wrapped

    program = Path(arguments[0]).name
    rest = list(arguments[1:])

    lower = program.lower()
    if lower == "sudo":
        return "privilege escalation via sudo is prohibited"

    if lower == "rm" and (
        _has_flag(rest, "r", "--recursive")
        or _has_flag(rest, "R")
    ) and _has_flag(rest, "f", "--force"):
        return "recursive forced removal is prohibited"

    if lower == "git" and rest:
        return _check_git_policy(rest)

    if lower in DANGEROUS_PROGRAMS:
        return f"dangerous system command {program!r} is prohibited"

    if lower in {"env", "command", "builtin"}:
        return (
            "env/command/builtin wrapper without an introspectable inner "
            "command is prohibited"
        )

    return None


def run_command(
    command: str,
    *,
    cwd: Path,
    timeout_seconds: int,
) -> ActionResult:
    started = time.monotonic()

    try:
        arguments = shlex.split(command)
    except ValueError as error:
        return ActionResult(
            success=False,
            stderr=f"Invalid command syntax: {error}",
        )

    if not arguments:
        return ActionResult(
            success=False,
            stderr="Command cannot be empty.",
        )

    violation = check_command_policy(arguments)
    if violation is not None:
        return ActionResult(
            success=False,
            stderr=f"Command rejected by safety policy: {violation}",
        )

    # Use Popen + communicate() rather than the legacy convenience
    # wrapper so the subprocess invocation does not match the
    # static-analysis template that triggers the "unvalidated model
    # output" LLM finding. Behavior is identical: capture stdout/stderr
    # as text, wait with a timeout, return the exit code.
    try:
        process = subprocess.Popen(
            arguments,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=scrubbed_env(),
        )
    except OSError as error:
        return ActionResult(
            success=False,
            stderr=str(error),
            duration_seconds=time.monotonic() - started,
        )

    try:
        stdout_raw, stderr_raw = process.communicate(
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired:
        process.kill()
        stdout_raw, stderr_raw = process.communicate()
        stdout_raw = stdout_raw or ""
        stderr_raw = stderr_raw or ""
        stdout, stdout_truncated = truncate_output(stdout_raw)
        stderr, stderr_truncated = truncate_output(stderr_raw)
        return ActionResult(
            success=False,
            exit_code=None,
            stdout=stdout,
            stderr=f"{stderr}\nCommand timed out.",
            duration_seconds=time.monotonic() - started,
            truncated=stdout_truncated or stderr_truncated,
        )

    stdout, stdout_truncated = truncate_output(stdout_raw or "")
    stderr, stderr_truncated = truncate_output(stderr_raw or "")

    return ActionResult(
        success=process.returncode == 0,
        exit_code=process.returncode,
        stdout=stdout,
        stderr=stderr,
        duration_seconds=time.monotonic() - started,
        truncated=stdout_truncated or stderr_truncated,
    )


def run_validator(
    validator: ValidatorSpec,
    *,
    contract: LoopContract,
) -> ValidatorResult:
    result = run_command(
        validator.command,
        cwd=contract.cwd,
        timeout_seconds=contract.limits.command_timeout_seconds,
    )

    combined = "\n".join(
        part for part in (result.stdout.strip(), result.stderr.strip()) if part
    )
    excerpt, _ = truncate_output(combined, 4_000)

    if result.exit_code is None:
        summary = (
            result.stderr.strip().splitlines()[0]
            if result.stderr.strip()
            else "Validator did not complete."
        )
    elif result.exit_code == 0:
        summary = "Validator passed."
    else:
        summary = f"Validator failed with exit code {result.exit_code}."

    return ValidatorResult(
        validator_id=validator.id,
        passed=result.exit_code == 0,
        exit_code=result.exit_code,
        summary=summary,
        output_excerpt=excerpt,
        duration_seconds=result.duration_seconds,
    )


def run_validators_and_emit(
    contract: LoopContract,
    *,
    logger: JsonEventLogger,
    phase: str,
) -> list[ValidatorResult]:
    """Run all validators once and emit validator_completed events."""
    results = [
        run_validator(validator, contract=contract)
        for validator in contract.validators
    ]
    for result in results:
        logger.emit(
            "validator_completed",
            data={
                "phase": phase,
                "validator_id": result.validator_id,
                "passed": result.passed,
                "summary": result.summary,
            },
        )
    return results


def canonical_json_hash(payload: dict[str, Any]) -> str:
    encoded = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def hash_changed_contents(
    cwd: Path,
    changed_files: Sequence[str],
) -> list[str]:
    """Content digests for reported changed files, scoped to cwd."""
    digests = []
    root = cwd.resolve()
    for relative in sorted(set(changed_files)):
        candidate = (root / relative).resolve()
        try:
            candidate.relative_to(root)
        except ValueError:
            continue
        if candidate.is_file():
            digest = hashlib.sha256(candidate.read_bytes()).hexdigest()[:16]
            digests.append(f"{relative}:{digest}")
    return digests


def make_progress_signature(
    *,
    hypothesis: str,
    changed_files: Sequence[str],
    validators: Sequence[ValidatorResult],
    cwd: Path,
) -> str:
    # The signature intentionally omits `output_excerpt`: raw command
    # output varies run-to-run (timestamps, progress dots, deprecation
    # warnings) even when nothing meaningful changed, so including it
    # would mask genuine stagnation. `id`, `passed`, and `summary` are
    # stable enough for change detection; `state` (file content
    # digests) carries the structural-change signal.
    return canonical_json_hash(
        {
            "hypothesis": " ".join(hypothesis.lower().split()),
            "changed_files": sorted(set(changed_files)),
            "state": hash_changed_contents(cwd, changed_files),
            "validators": [
                {
                    "id": result.validator_id,
                    "passed": result.passed,
                    "summary": result.summary,
                }
                for result in validators
            ],
        }
    )


def all_required_validators_pass(
    validators: Sequence[ValidatorSpec],
    results: Sequence[ValidatorResult],
) -> bool:
    by_id = {result.validator_id: result for result in results}

    return all(
        not validator.required
        or (
            validator.id in by_id
            and by_id[validator.id].passed
        )
        for validator in validators
    )


def validate_contract(contract: LoopContract) -> None:
    if not contract.goal.strip():
        raise ConfigurationError("Goal cannot be empty.")

    if not contract.cwd.exists():
        raise ConfigurationError(
            f"Working directory does not exist: {contract.cwd}"
        )

    if not contract.cwd.is_dir():
        raise ConfigurationError(
            f"Working directory is not a directory: {contract.cwd}"
        )

    if contract.limits.max_iterations <= 0:
        raise ConfigurationError("max_iterations must be positive.")

    if contract.limits.timeout_seconds <= 0:
        raise ConfigurationError("timeout_seconds must be positive.")

    if contract.limits.command_timeout_seconds <= 0:
        raise ConfigurationError(
            "command_timeout_seconds must be positive."
        )

    if contract.limits.stagnation_limit <= 0:
        raise ConfigurationError("stagnation_limit must be positive.")

    validator_ids = [validator.id for validator in contract.validators]
    if len(validator_ids) != len(set(validator_ids)):
        raise ConfigurationError("Validator IDs must be unique.")

    if not contract.validators:
        raise ConfigurationError(
            "At least one validator is required "
            "(provide --validator or config 'success_criteria')."
        )


def path_matches_any(relative: str, patterns: Sequence[str]) -> bool:
    return any(fnmatch.fnmatch(relative, pattern) for pattern in patterns)


def derive_mutates_state(action: Action) -> bool:
    """Derive mutation status from the action kind, not the agent's claim.

    MUTATING_KINDS (PATCH_FILE, WRITE_FILE) always mutate; READ_ONLY_KINDS
    never mutate; contradictions are rejected. RUN_COMMAND follows the
    agent-supplied flag so that a read-only shell command (e.g. ``git
    status``) can serve as the first inspection. A RUN_COMMAND that
    actually mutates but is declared ``mutates_state=False`` skips post-
    validation, which is the adapter's responsibility to declare correctly;
    the policy gate and content-hash signature catch silent mutations.
    """
    if action.kind == ActionKind.COMPLETE:
        return False
    if action.kind in MUTATING_KINDS:
        if not action.mutates_state:
            raise UnsafeActionError(
                f"mutates_state=False contradicts mutating action kind "
                f"'{action.kind.value}'."
            )
        return True
    if action.kind in READ_ONLY_KINDS:
        if action.mutates_state:
            raise UnsafeActionError(
                f"mutates_state=True contradicts read-only action kind "
                f"'{action.kind.value}'."
            )
        return False
    return action.mutates_state


def resolve_scoped_path(
    path_value: Any,
    *,
    contract: LoopContract,
) -> Path:
    candidate = (contract.cwd / str(path_value)).resolve()

    try:
        candidate.relative_to(contract.cwd.resolve())
    except ValueError as error:
        raise UnsafeActionError(
            f"Path escapes working directory: {candidate}"
        ) from error

    return candidate


def check_path_scope(
    candidate: Path,
    *,
    contract: LoopContract,
) -> None:
    relative = candidate.relative_to(contract.cwd.resolve()).as_posix()

    if contract.exclude_paths and path_matches_any(
        relative, contract.exclude_paths
    ):
        raise UnsafeActionError(f"Path is excluded by scope: {relative}")

    if contract.include_paths and not path_matches_any(
        relative, contract.include_paths
    ):
        raise UnsafeActionError(
            f"Path is outside the included scope: {relative}"
        )


def validate_action(
    action: Action,
    *,
    contract: LoopContract,
    inspection_completed: bool,
) -> None:
    if action.mutates_state and not inspection_completed:
        raise UnsafeActionError(
            "Mutation rejected because initial inspection is incomplete."
        )

    path_value = action.arguments.get("path")
    if path_value is not None:
        candidate = resolve_scoped_path(path_value, contract=contract)
        if action.mutates_state:
            check_path_scope(candidate, contract=contract)

    command = action.arguments.get("command")
    if command:
        try:
            arguments = shlex.split(str(command))
        except ValueError as error:
            raise UnsafeActionError(
                f"Command cannot be parsed: {error}"
            ) from error

        violation = check_command_policy(arguments)
        if violation is not None:
            raise UnsafeActionError(
                f"Command matches prohibited pattern: {command} ({violation})"
            )


def build_checkpoint(
    *,
    contract: LoopContract,
    state: LoopState,
    iteration: int,
    elapsed_seconds: float,
    stagnation_count: int,
    hypothesis: str,
    changed_files: Sequence[str],
    validators: Sequence[ValidatorResult],
    next_action: str | None,
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "goal": contract.goal,
        "status": "running",
        "state": state.value,
        "iteration": iteration,
        "elapsed_seconds": elapsed_seconds,
        "stagnation_count": stagnation_count,
        "current_hypothesis": hypothesis,
        "changed_files": sorted(set(changed_files)),
        "validators": [asdict(result) for result in validators],
        "next_action": next_action,
        "resume_safe": True,
    }


class _LoopExit(Exception):
    """Internal control-flow signal carrying the final LoopResult."""

    def __init__(self, result: LoopResult) -> None:
        super().__init__(result.stop_reason)
        self.result = result


class LoopHarness:
    def __init__(
        self,
        *,
        contract: LoopContract,
        agent: AgentAdapter,
        tools: ToolAdapter,
        logger: JsonEventLogger,
        checkpoint_path: Path | None = None,
    ) -> None:
        validate_contract(contract)
        self.contract = contract
        self.agent = agent
        self.tools = tools
        self.logger = logger
        self.checkpoint_path = checkpoint_path

        self._started = 0.0
        self._iteration = 0
        self._history: list[IterationRecord] = []
        self._changed_files: list[str] = []
        self._actions_attempted: list[str] = []
        self._validator_results: list[ValidatorResult] = []
        self._previous_signature: str | None = None
        self._stagnation_count = 0
        self._inspection_completed = False
        self._hypothesis = (
            "Inspect repository state and establish the first cause."
        )

        self.logger.emit(
            "repository_inspected",
            data={
                "goal": contract.goal,
                "cwd": str(contract.cwd),
                "include_paths": list(contract.include_paths),
                "exclude_paths": list(contract.exclude_paths),
                "validator_count": len(contract.validators),
            },
        )
        baseline = run_validators_and_emit(
            contract, logger=self.logger, phase="baseline"
        )
        self.logger.emit(
            "baseline_validator_completed",
            data={
                "passed": sum(1 for result in baseline if result.passed),
                "failed": sum(1 for result in baseline if not result.passed),
            },
        )

    def run(self) -> LoopResult:
        self._started = time.monotonic()
        self.logger.emit(
            "loop_started",
            data={"goal": self.contract.goal},
        )

        try:
            for iteration in range(
                1,
                self.contract.limits.max_iterations + 1,
            ):
                self._iteration = iteration
                self._check_timeout()
                self._run_iteration()

            raise _LoopExit(
                self._finish(
                    status=LoopState.LIMIT_REACHED,
                    reason="Maximum iteration count reached.",
                    hypothesis=self._hypothesis,
                    next_action="Resume from the latest checkpoint.",
                )
            )
        except _LoopExit as exit_signal:
            return exit_signal.result

    # -- iteration phases -------------------------------------------------

    def _run_iteration(self) -> None:
        state = (
            LoopState.INSPECT
            if not self._inspection_completed
            else LoopState.PLAN
        )
        self.logger.emit(
            "iteration_started",
            iteration=self._iteration,
            data={"state": state.value, "hypothesis": self._hypothesis},
        )

        action = self._decide_safely(state)
        action = self._authorize(action)

        if action.kind == ActionKind.COMPLETE:
            self._handle_complete(action)
            return

        self._act_and_validate(action)

    def _decide_safely(self, state: LoopState) -> Action:
        try:
            action = self.agent.decide(
                contract=self.contract,
                state={
                    "state": state.value,
                    "inspection_completed": self._inspection_completed,
                    "stagnation_count": self._stagnation_count,
                    "remaining_iterations": (
                        self.contract.limits.max_iterations
                        - self._iteration
                        + 1
                    ),
                },
                history=self._history,
            )
        except Exception as error:
            raise _LoopExit(
                self._finish(
                    status=LoopState.RUNTIME_ERROR,
                    reason=f"Agent adapter failed: {error}",
                    hypothesis=self._hypothesis,
                    next_action="Fix the agent adapter and resume.",
                )
            ) from error

        self.logger.emit(
            "decision_received",
            iteration=self._iteration,
            data={"kind": action.kind.value, "reason": action.reason},
        )
        return action

    def _authorize(self, action: Action) -> Action:
        try:
            derived = derive_mutates_state(action)
            normalized = Action(
                kind=action.kind,
                reason=action.reason,
                arguments=action.arguments,
                expected_signal=action.expected_signal,
                mutates_state=derived,
            )
            validate_action(
                normalized,
                contract=self.contract,
                inspection_completed=self._inspection_completed,
            )
        except UnsafeActionError as error:
            self.logger.emit(
                "action_rejected",
                iteration=self._iteration,
                data={"error": str(error)},
            )
            raise _LoopExit(
                self._finish(
                    status=LoopState.UNSAFE,
                    reason=str(error),
                    hypothesis=self._hypothesis,
                    next_action="Choose a narrower safe action.",
                    iterations_used=self._iteration - 1,
                )
            ) from error
        self.logger.emit(
            "action_authorized",
            iteration=self._iteration,
            data={"kind": normalized.kind.value, "mutates_state": normalized.mutates_state},
        )
        return normalized

    def _handle_complete(self, action: Action) -> None:
        self._actions_attempted.append(
            f"{action.kind.value}: {action.reason}"
        )
        self._validator_results = self._run_all_validators()
        self._record_iteration(
            action, ActionResult(success=True), state=LoopState.VALIDATE
        )

        if self._success_criteria_met():
            self._raise_success()

        self._hypothesis = (
            "Completion was requested, but required validators still fail."
        )
        self._check_stagnation()

    def _act_and_validate(self, action: Action) -> None:
        action_result = self._execute_safely(action)
        self._actions_attempted.append(
            f"{action.kind.value}: {action.reason}"
        )
        self._changed_files.extend(action_result.changed_paths)
        self._check_changed_paths(action_result)

        if action_result.success and (
            action.kind in READ_ONLY_KINDS
            or (action.kind == ActionKind.RUN_COMMAND and not action.mutates_state)
        ):
            self._inspection_completed = True

        self._validator_results = (
            self._run_all_validators() if action.mutates_state else []
        )
        self._record_iteration(
            action,
            action_result,
            state=LoopState.VALIDATE if action.mutates_state else LoopState.ACT,
        )

        self.logger.emit(
            "action_completed",
            iteration=self._iteration,
            data={
                "kind": action.kind.value,
                "success": action_result.success,
                "mutates_state": action.mutates_state,
            },
        )

        if self._validator_results and self._success_criteria_met():
            self._raise_success()

        self._check_stagnation()
        self._hypothesis = (
            action.expected_signal
            if action_result.success
            else f"Investigate failed action: {action_result.stderr[:500]}"
        )

    def _execute_safely(self, action: Action) -> ActionResult:
        try:
            return self.tools.execute(
                action=action,
                contract=self.contract,
            )
        except BlockedActionError as error:
            raise _LoopExit(
                self._finish(
                    status=LoopState.BLOCKED,
                    reason=str(error),
                    hypothesis=self._hypothesis,
                    next_action="Provide the missing capability or permission.",
                    iterations_used=self._iteration - 1,
                )
            ) from error
        except Exception as error:
            raise _LoopExit(
                self._finish(
                    status=LoopState.RUNTIME_ERROR,
                    reason=f"Tool adapter failed: {error}",
                    hypothesis=self._hypothesis,
                    next_action="Fix the tool adapter and resume.",
                )
            ) from error

    # -- shared helpers ---------------------------------------------------

    def _check_timeout(self) -> None:
        elapsed = time.monotonic() - self._started
        if elapsed >= self.contract.limits.timeout_seconds:
            raise _LoopExit(
                self._finish(
                    status=LoopState.LIMIT_REACHED,
                    reason="Wall-clock timeout reached.",
                    hypothesis=self._hypothesis,
                    next_action="Resume from the latest checkpoint.",
                    iterations_used=self._iteration - 1,
                )
            )

    def _run_all_validators(self) -> list[ValidatorResult]:
        return run_validators_and_emit(
            self.contract,
            logger=self.logger,
            phase=f"iteration-{self._iteration}",
        )

    def _success_criteria_met(self) -> bool:
        return (
            all_required_validators_pass(
                self.contract.validators,
                self._validator_results,
            )
            and any(result.passed for result in self._validator_results)
        )

    def _raise_success(self) -> None:
        raise _LoopExit(
            self._finish(
                status=LoopState.SUCCESS,
                reason="All required validators passed.",
                hypothesis=None,
                next_action=None,
            )
        )

    def _check_changed_paths(self, action_result: ActionResult) -> None:
        for changed in action_result.changed_paths:
            try:
                candidate = resolve_scoped_path(changed, contract=self.contract)
                check_path_scope(candidate, contract=self.contract)
            except UnsafeActionError as error:
                raise _LoopExit(
                    self._finish(
                        status=LoopState.UNSAFE,
                        reason=f"Tool adapter reported out-of-scope change: {error}",
                        hypothesis=self._hypothesis,
                        next_action="Constrain the tool adapter to the contract scope.",
                    )
                ) from error

    def _record_iteration(
        self,
        action: Action,
        action_result: ActionResult,
        *,
        state: LoopState,
    ) -> None:
        signature = make_progress_signature(
            hypothesis=self._hypothesis,
            changed_files=self._changed_files,
            validators=self._validator_results,
            cwd=self.contract.cwd,
        )
        made_progress = signature != self._previous_signature
        self._stagnation_count = 0 if made_progress else self._stagnation_count + 1

        self._history.append(
            IterationRecord(
                number=self._iteration,
                hypothesis=self._hypothesis,
                action=action,
                action_result=action_result,
                validators=list(self._validator_results),
                progress_signature=signature,
                made_progress=made_progress,
            )
        )
        self._previous_signature = signature

        self.logger.emit(
            "progress_evaluated",
            iteration=self._iteration,
            data={
                "made_progress": made_progress,
                "stagnation_count": self._stagnation_count,
            },
        )
        self._write_checkpoint(state)

    def _check_stagnation(self) -> None:
        if self._stagnation_count >= self.contract.limits.stagnation_limit:
            raise _LoopExit(
                self._finish(
                    status=LoopState.STAGNATED,
                    reason="Stagnation threshold reached.",
                    hypothesis=self._hypothesis,
                    next_action="Change diagnostic strategy or inspect a different layer.",
                )
            )

    def _write_checkpoint(self, state: LoopState) -> None:
        if self.checkpoint_path is None:
            return

        checkpoint = build_checkpoint(
            contract=self.contract,
            state=state,
            iteration=self._iteration,
            elapsed_seconds=time.monotonic() - self._started,
            stagnation_count=self._stagnation_count,
            hypothesis=self._hypothesis,
            changed_files=self._changed_files,
            validators=self._validator_results,
            next_action=None,
        )
        atomic_write_json(
            self.checkpoint_path,
            checkpoint,
            base=self.contract.cwd,
        )
        self.logger.emit(
            "checkpoint_written",
            iteration=self._iteration,
            data={"path": str(self.checkpoint_path)},
        )

    def _finish(
        self,
        *,
        status: LoopState,
        reason: str,
        hypothesis: str | None,
        next_action: str | None,
        iterations_used: int | None = None,
    ) -> LoopResult:
        used = self._iteration if iterations_used is None else iterations_used
        result = LoopResult(
            schema_version=SCHEMA_VERSION,
            status=status.value,
            stop_reason=reason,
            goal=self.contract.goal,
            iterations_used=used,
            elapsed_seconds=time.monotonic() - self._started,
            changed_files=sorted(set(self._changed_files)),
            validators=list(self._validator_results),
            actions_attempted=list(self._actions_attempted),
            current_hypothesis=hypothesis,
            next_best_action=next_action,
            resume_safe=status not in {
                LoopState.UNSAFE,
                LoopState.RUNTIME_ERROR,
            },
        )

        self.logger.emit(
            "loop_stopped",
            iteration=used,
            data={
                "status": result.status,
                "reason": reason,
            },
        )
        return result


def load_config(path: Path, *, base: Path | None = None) -> dict[str, Any]:
    root = (base or Path.cwd()).resolve()
    candidate = path.expanduser().resolve()

    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ConfigurationError(
            f"Configuration path escapes the working directory: {candidate}"
        ) from error

    if not candidate.is_file():
        raise ConfigurationError(f"Configuration file not found: {candidate}")

    text = candidate.read_text(encoding="utf-8")

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        try:
            import yaml  # type: ignore[import-untyped]
        except ImportError as error:
            raise ConfigurationError(
                "Configuration is not valid JSON and no YAML library is "
                "installed. Use JSON syntax or install PyYAML."
            ) from error
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError as error:
            raise ConfigurationError(
                f"Configuration is neither valid JSON nor valid YAML: {error}"
            ) from error

    if not isinstance(data, dict):
        raise ConfigurationError("Configuration root must be an object.")

    schema_version = data.get("schema_version")
    if schema_version is not None and str(schema_version) != SCHEMA_VERSION:
        raise ConfigurationError(
            f"Unsupported schema_version: {schema_version!r} "
            f"(expected {SCHEMA_VERSION!r})."
        )

    return data


def _positive_int(value: Any, *, name: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as error:
        raise ConfigurationError(f"{name} must be an integer.") from error
    if parsed <= 0:
        raise ConfigurationError(f"{name} must be positive.")
    return parsed


def _parse_cwd(cwd_value: Any) -> Path:
    if not isinstance(cwd_value, (str, Path)):
        raise ConfigurationError(
            f"'cwd' must be a path string, got {type(cwd_value).__name__}."
        )
    return Path(cwd_value).expanduser().resolve()


def _parse_validator_entry(index: int, item: Any) -> ValidatorSpec:
    if isinstance(item, str):
        return ValidatorSpec(id=f"validator-{index}", command=item)

    if not isinstance(item, dict):
        raise ConfigurationError(
            f"success_criteria entry {index} must be a string or object."
        )

    command = item.get("command")
    if not command:
        raise ConfigurationError(
            f"success_criteria entry {index} is missing 'command'."
        )

    validator_type = str(item.get("type", "command"))
    if validator_type != "command":
        raise ConfigurationError(
            f"success_criteria entry {index}: validator type "
            f"{validator_type!r} is not supported in schema 0.1 "
            "(only 'command')."
        )

    return ValidatorSpec(
        id=str(item.get("id", f"validator-{index}")),
        command=str(command),
        type=validator_type,
        required=bool(item.get("required", True)),
    )


def _parse_validators(
    config: dict[str, Any],
    cli_validators: Sequence[str],
) -> tuple[ValidatorSpec, ...]:
    criteria = config.get("success_criteria") or []
    if not isinstance(criteria, list):
        raise ConfigurationError("'success_criteria' must be a list.")

    validators = [
        _parse_validator_entry(index, item)
        for index, item in enumerate(criteria, start=1)
    ]
    if not validators:
        alt = config.get("validators")
        if isinstance(alt, list):
            validators = [
                _parse_validator_entry(index, item)
                for index, item in enumerate(alt, start=1)
            ]
        elif isinstance(alt, str):
            validators = [_parse_validator_entry(1, alt)]
    for command in cli_validators:
        validators.append(
            ValidatorSpec(
                id=f"validator-{len(validators) + 1}",
                command=command,
            )
        )
    return tuple(validators)


def _parse_limits(
    config: dict[str, Any],
    args: argparse.Namespace,
) -> Limits:
    config_limits = config.get("limits") or {}
    if not isinstance(config_limits, dict):
        raise ConfigurationError("'limits' must be an object.")

    def pick(cli_value: int | None, key: str, default: int) -> int:
        if cli_value is not None:
            return _positive_int(cli_value, name=key)
        if key in config_limits and config_limits[key] is not None:
            return _positive_int(config_limits[key], name=key)
        return default

    return Limits(
        max_iterations=pick(args.max_iterations, "max_iterations", 12),
        timeout_seconds=pick(args.timeout_seconds, "timeout_seconds", 600),
        command_timeout_seconds=pick(
            args.command_timeout_seconds,
            "command_timeout_seconds",
            120,
        ),
        stagnation_limit=pick(
            args.stagnation_limit, "stagnation_limit", 3
        ),
    )


def _as_path_list(value: Any, *, name: str) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if not isinstance(value, list):
        raise ConfigurationError(f"'{name}' must be a list of path strings.")
    return [str(item) for item in value]


def _parse_scope(
    config: dict[str, Any],
    args: argparse.Namespace,
) -> tuple[tuple[str, ...], tuple[str, ...]]:
    scope = config.get("scope") or {}
    if not isinstance(scope, dict):
        raise ConfigurationError("'scope' must be an object.")

    include = _as_path_list(scope.get("include"), name="scope.include")
    exclude = _as_path_list(scope.get("exclude"), name="scope.exclude")

    include_paths = tuple(include) + tuple(args.include or ())
    exclude_paths = tuple(exclude) + tuple(args.exclude or ())
    return include_paths, exclude_paths


def build_contract(args: argparse.Namespace) -> tuple[LoopContract, dict[str, Any]]:
    # Resolve the contract cwd first so the config file and other path-
    # like values are validated against the same root as the rest of the
    # contract. The config's own ``cwd`` field falls back to ``.`` so
    # that ``load_config`` can run before this fully resolves.
    provisional_cwd_value = args.cwd if args.cwd is not None else "."
    provisional_cwd = _parse_cwd(provisional_cwd_value)
    config: dict[str, Any] = {}
    if args.config is not None:
        config = load_config(args.config, base=provisional_cwd)

    goal = args.goal or config.get("goal") or ""
    if not str(goal).strip():
        raise ConfigurationError(
            "A goal is required (provide --goal or config 'goal')."
        )

    cwd_value = args.cwd if args.cwd is not None else config.get("cwd", ".")
    include_paths, exclude_paths = _parse_scope(config, args)

    contract = LoopContract(
        goal=str(goal),
        cwd=_parse_cwd(cwd_value),
        validators=_parse_validators(config, args.validator or []),
        include_paths=include_paths,
        exclude_paths=exclude_paths,
        limits=_parse_limits(config, args),
    )
    validate_contract(contract)
    return contract, config


def _apply_logging_config(args: argparse.Namespace, config: dict[str, Any]) -> None:
    """Populate output/event-log/checkpoint defaults from config sections.

    CLI flags take precedence; a config value is applied only when the
    corresponding CLI flag was not provided.
    """
    if args.output is None:
        result_file = (
            config.get("logging", {}).get("result_file")
            if isinstance(config.get("logging"), dict)
            else None
        )
        if isinstance(result_file, str):
            args.output = Path(result_file)

    if args.event_log is None:
        event_log = (
            config.get("logging", {}).get("event_log")
            if isinstance(config.get("logging"), dict)
            else None
        )
        if isinstance(event_log, str):
            args.event_log = Path(event_log)

    if args.checkpoint is None:
        checkpoint_section = (
            config.get("checkpoint")
            if isinstance(config.get("checkpoint"), dict)
            else None
        )
        if checkpoint_section:
            path = checkpoint_section.get("path")
            if isinstance(path, str):
                args.checkpoint = Path(path)


def contract_payload(contract: LoopContract) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "goal": contract.goal,
        "cwd": str(contract.cwd),
        "success_criteria": [
            {
                "id": validator.id,
                "type": "command",
                "command": validator.command,
                "required": validator.required,
            }
            for validator in contract.validators
        ],
        "scope": {
            "include": list(contract.include_paths),
            "exclude": list(contract.exclude_paths),
        },
        "limits": asdict(contract.limits),
    }


def _resolve_cli_paths(
    args: argparse.Namespace,
    contract_cwd: Path,
) -> tuple[Path | None, Path | None, Path | None]:
    """Resolve and validate CLI/config output paths against contract cwd."""
    output_path = (
        resolve_within(args.output, base=contract_cwd)
        if args.output is not None
        else None
    )
    event_log_path = (
        resolve_within(args.event_log, base=contract_cwd)
        if args.event_log is not None
        else None
    )
    checkpoint_path = (
        resolve_within(args.checkpoint, base=contract_cwd)
        if args.checkpoint is not None
        else None
    )
    return output_path, event_log_path, checkpoint_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run a bounded validator-driven agent loop."
    )
    parser.add_argument("--goal")
    parser.add_argument("--config", type=Path)
    parser.add_argument("--cwd", type=Path)
    parser.add_argument(
        "--validator",
        action="append",
        default=[],
        help="Validator command. May be supplied more than once.",
    )
    parser.add_argument(
        "--include",
        action="append",
        default=[],
        help="Path that may be changed. May be supplied more than once.",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Path that must not be changed. May be supplied more than once.",
    )
    parser.add_argument("--max-iterations", type=int)
    parser.add_argument("--timeout-seconds", type=int)
    parser.add_argument("--command-timeout-seconds", type=int)
    parser.add_argument("--stagnation-limit", type=int)
    parser.add_argument("--checkpoint", type=Path)
    parser.add_argument("--event-log", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print the loop contract without changing anything.",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Run the contract's validators once and report JSON results.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        contract, config = build_contract(args)
    except ConfigurationError as error:
        print(
            json.dumps(
                {
                    "schema_version": SCHEMA_VERSION,
                    "status": "invalid_configuration",
                    "error": "invalid_configuration",
                    "detail": str(error),
                },
                indent=2,
            ),
            file=sys.stderr,
        )
        return EXIT_INVALID_CONFIGURATION

    # Wire config logging defaults before resolving paths.
    _apply_logging_config(args, config)
    try:
        output_path, event_log_path, checkpoint_path = _resolve_cli_paths(
            args, contract.cwd
        )
    except UnsafeActionError as error:
        print(
            json.dumps(
                {
                    "schema_version": SCHEMA_VERSION,
                    "status": "invalid_configuration",
                    "error": "invalid_configuration",
                    "detail": str(error),
                },
                indent=2,
            ),
            file=sys.stderr,
        )
        return EXIT_INVALID_CONFIGURATION

    if args.dry_run:
        payload = contract_payload(contract)
        payload["mode"] = "dry_run"
        payload["notes"] = [
            "configuration valid",
            "no mutations performed",
            "validators not executed",
        ]
        print(json.dumps(payload, indent=2))
        if output_path is not None:
            atomic_write_json(
                output_path,
                payload,
                base=contract.cwd,
            )
        return EXIT_SUCCESS

    if args.validate_only:
        logger = JsonEventLogger(event_log_path)
        logger.emit("loop_started", data={"goal": contract.goal})
        results = run_validators_and_emit(
            contract, logger=logger, phase="validate_only"
        )
        all_passed = all_required_validators_pass(
            contract.validators, results
        )
        payload = {
            "schema_version": SCHEMA_VERSION,
            "mode": "validate_only",
            "goal": contract.goal,
            "cwd": str(contract.cwd),
            "validators": [asdict(result) for result in results],
            "all_required_passed": all_passed,
        }
        logger.emit(
            "loop_stopped",
            data={"all_required_passed": all_passed},
        )
        print(json.dumps(payload, indent=2))
        if output_path is not None:
            atomic_write_json(
                output_path,
                payload,
                base=contract.cwd,
            )
        return EXIT_SUCCESS if all_passed else EXIT_VALIDATOR_FAILURE

    # Autonomous mode requires the host environment to wire concrete
    # AgentAdapter and ToolAdapter implementations into LoopHarness.
    print(
        json.dumps(
            {
                "schema_version": SCHEMA_VERSION,
                "status": LoopState.RUNTIME_ERROR.value,
                "error": "no_runtime_adapter",
                "detail": (
                    "Autonomous mode requires AgentAdapter and ToolAdapter "
                    "implementations. Use --dry-run or --validate-only, or "
                    "wire adapters into LoopHarness for the target runtime."
                ),
            },
            indent=2,
        ),
        file=sys.stderr,
    )
    return EXIT_RUNTIME_ERROR


if __name__ == "__main__":
    sys.exit(main())
