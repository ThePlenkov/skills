# Loop Harness Specification

## 1. Purpose

Define the normative behavior of `scripts/run_loop.py`.

The harness coordinates:

- loop contract loading;
- model or agent invocation;
- tool execution;
- observation capture;
- validation;
- limit enforcement;
- stagnation detection;
- checkpointing;
- final result serialization.

The harness must not assume that a normal assistant completion means the
repository task succeeded.

## 2. Scope

Version 0.1 supports local repository workflows with:

- filesystem inspection;
- text search;
- file modification;
- subprocess execution;
- deterministic validators;
- optional model-driven decision steps.

Version 0.1 does not require:

- distributed execution;
- multi-host coordination;
- persistent remote workers;
- automatic pull-request creation;
- cost accounting when the runtime does not expose usage;
- concurrent writes.

### Implementation status

The bundled `run_loop.py` implements the deterministic core: CLI, contract
loading and validation, command validators, state and limit types, event
logging, checkpoints, progress signatures, stagnation rules, safety checks,
`--dry-run`, and `--validate-only`. Autonomous model-driven runs require
runtime-provided `AgentAdapter` and `ToolAdapter` implementations wired in by
the host environment; without adapters the entrypoint exits with
`RUNTIME_ERROR`.

## 3. Entrypoint

Canonical command:

```bash
python scripts/run_loop.py --config loop.yaml
```

Supported direct flags:

```bash
python scripts/run_loop.py \
  --goal "Fix failing authentication tests" \
  --cwd /path/to/repository \
  --validator "npm test -- auth" \
  --validator "npm run lint" \
  --max-iterations 20 \
  --timeout-seconds 600 \
  --stagnation-limit 3 \
  --output loop-result.json
```

Configuration-file values take precedence over defaults.

Explicit CLI flags take precedence over configuration-file values.

## 4. CLI contract

Required input, provided either by CLI or configuration:

```text
--goal TEXT        (or config "goal")
--cwd PATH         (or config "cwd"; defaults to the current directory)
```

Optional arguments implemented in v0.1:

```text
--config PATH
--validator COMMAND
--include PATH
--exclude PATH
--max-iterations INTEGER
--timeout-seconds INTEGER
--command-timeout-seconds INTEGER
--stagnation-limit INTEGER
--checkpoint PATH
--output PATH
--event-log PATH
--dry-run
--validate-only
```

Reserved for later phases (parsed by no v0.1 mode; do not rely on them):

```text
--success-criterion TEXT   (use repeated --validator or config success_criteria)
--budget FLOAT
--resume PATH
--no-network
--verbose
```

Modes:

- Default (autonomous): run the full loop. Requires agent/tool adapters.
- `--dry-run`: parse and validate the contract, print it, change nothing.
- `--validate-only`: run the contract's validators once, print normalized
  JSON results, exit `0` when all required validators pass and
  `VALIDATOR_FAILURE` otherwise.

Configuration files are parsed as JSON first. When JSON parsing fails, YAML
is attempted if a YAML library is available; otherwise the harness reports
`INVALID_CONFIGURATION` and asks for JSON.

### Exit codes

```text
0   SUCCESS
2   BLOCKED
3   STAGNATED
4   LIMIT_REACHED
5   UNSAFE
6   RUNTIME_ERROR
7   INVALID_CONFIGURATION
8   VALIDATOR_FAILURE
```

`VALIDATOR_FAILURE` is used only when the harness is invoked in
validation-only mode. A normal loop ending with failing validators returns
the relevant stop-state code.

## 5. Configuration schema

Example:

```yaml
schema_version: "0.1"

goal: Fix the failing authentication tests.

cwd: .

success_criteria:
  - id: auth-tests
    type: command
    command: npm test -- auth
    required: true

  - id: lint
    type: command
    command: npm run lint
    required: true

scope:
  include:
    - src/auth/**
    - test/auth/**
  exclude:
    - .env
    - node_modules/**
    - dist/**

limits:
  max_iterations: 20
  timeout_seconds: 600
  command_timeout_seconds: 120
  stagnation_limit: 3
  budget: null

execution:
  network: false
  allow_dependency_install: false
  allow_untracked_files: true
  parallel_reads: true
  max_parallel_reads: 4

checkpoint:
  enabled: true
  path: .loop/checkpoint.json
  every_iterations: 1

logging:
  event_log: .loop/events.jsonl
  result_file: .loop/result.json
  retain_command_output_chars: 12000
```

Unknown top-level keys must cause a configuration warning.

Unknown security-related keys must cause `INVALID_CONFIGURATION`.

## 6. Core data structures

The implementation should use typed data structures equivalent to:

```python
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Literal


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


@dataclass
class ValidatorSpec:
    id: str
    type: Literal["command", "file", "metric", "evaluator"]
    required: bool = True
    command: str | None = None
    path: str | None = None
    threshold: float | None = None


@dataclass
class Limits:
    max_iterations: int = 12
    timeout_seconds: int = 600
    command_timeout_seconds: int = 120
    stagnation_limit: int = 3
    budget: float | None = None


@dataclass
class LoopContract:
    goal: str
    cwd: Path
    success_criteria: list[ValidatorSpec]
    include_paths: list[str] = field(default_factory=list)
    exclude_paths: list[str] = field(default_factory=list)
    limits: Limits = field(default_factory=Limits)


@dataclass
class Action:
    kind: ActionKind
    reason: str
    arguments: dict[str, Any]
    expected_signal: str
    mutates_state: bool


@dataclass
class ActionResult:
    success: bool
    exit_code: int | None
    stdout: str
    stderr: str
    changed_paths: list[str]
    duration_seconds: float
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
    status: str
    stop_reason: str
    goal: str
    iterations_used: int
    changed_files: list[str]
    validators: list[ValidatorResult]
    actions_attempted: list[str]
    current_hypothesis: str | None
    next_best_action: str | None
    resume_safe: bool
```

## 7. Adapter boundary

The harness must separate loop policy from runtime execution.

Define an adapter protocol:

```python
from typing import Protocol


class AgentAdapter(Protocol):
    def decide(
        self,
        *,
        contract: LoopContract,
        state: dict,
        history: list[IterationRecord],
    ) -> Action:
        """Return exactly one logical next action."""


class ToolAdapter(Protocol):
    def execute(
        self,
        *,
        action: Action,
        contract: LoopContract,
    ) -> ActionResult:
        """Execute a validated action in the configured runtime."""


class ValidatorAdapter(Protocol):
    def run(
        self,
        *,
        validator: ValidatorSpec,
        contract: LoopContract,
    ) -> ValidatorResult:
        """Run one validator and return normalized evidence."""
```

The policy layer must not directly call vendor-specific APIs.

Provider-specific behavior belongs in an adapter module or downstream wrapper.

Adapter failure contract:

- A tool adapter raises `BlockedActionError` when the action needs an
  unavailable capability, permission, or credential; the harness terminates
  with `BLOCKED`.
- Any other unexpected adapter exception terminates the loop with
  `RUNTIME_ERROR` and the partial state recorded.
- Mutation status is derived from `ActionKind`, never trusted from the
  agent-supplied `mutates_state` flag. `patch_file` and `write_file` are
  always mutating; read-only kinds never are; a contradicting flag is
  rejected as `UNSAFE`.
- Paths reported in `ActionResult.changed_paths` are re-validated against
  the contract scope; an out-of-scope report terminates with `UNSAFE`.

A local tool adapter dispatches on `ActionKind`:

```python
class LocalToolAdapter:
    def execute(self, *, action, contract):
        if action.kind == ActionKind.READ_FILE:
            return self._read_file(action, contract)
        if action.kind == ActionKind.SEARCH:
            return self._search(action, contract)
        if action.kind == ActionKind.LIST_FILES:
            return self._list_files(action, contract)
        if action.kind == ActionKind.PATCH_FILE:
            return self._patch_file(action, contract)
        if action.kind == ActionKind.WRITE_FILE:
            return self._write_file(action, contract)
        if action.kind == ActionKind.RUN_COMMAND:
            return run_command(
                str(action.arguments["command"]),
                cwd=contract.cwd,
                timeout_seconds=contract.limits.command_timeout_seconds,
            )
        raise ValueError(f"Unsupported action: {action.kind}")
```

A model adapter converts loop state into one strictly structured request and
returns exactly one `Action`. Recommended system prompt for a model adapter:

```text
You are the decision component of a bounded software-engineering loop.

Return exactly one structured action.

You do not determine final success. The harness determines success from required
validator results.

Rules:
- Inspect before mutation.
- Choose the smallest action likely to produce new evidence or progress.
- Do not repeat an action that produced an equivalent outcome twice.
- Do not weaken, skip, delete, or reconfigure validators merely to make them pass.
- Do not modify files outside the allowed scope.
- Do not perform destructive repository or shell operations.
- Prefer targeted validation after each mutation.
- Use COMPLETE only when existing evidence suggests all required validators pass.

Required response schema:
{
  "kind": "read_file | search | list_files | patch_file | write_file | run_command | complete",
  "reason": "Why this is the best next action",
  "arguments": {},
  "expected_signal": "What observation would confirm or reject the hypothesis",
  "mutates_state": false
}
```

## 8. Initialization algorithm

The harness must:

1. Parse CLI arguments.
2. Load configuration when supplied.
3. Resolve the working directory.
4. Reject a missing or non-directory working directory.
5. Normalize include and exclude patterns.
6. Validate positive numeric limits.
7. Load the safety policy.
8. Inspect repository instructions.
9. Capture initial repository status.
10. Create the event-log and checkpoint directories.
11. Run optional baseline validators.
12. Enter `INSPECT`.

A dirty repository must not be treated as an error.

Existing modified or untracked files must be recorded so the harness can
distinguish pre-existing work from its own changes.

## 9. Baseline validation

Run baseline validators before the first mutation when practical.

The baseline establishes:

- which validators already fail;
- failure counts;
- relevant error signatures;
- approximate duration.

The harness must not require a full expensive suite before beginning when a
targeted validator is available.

Baseline failure is expected and must not terminate the loop.

## 10. Action authorization

Before executing an action, the harness must verify:

- the action kind is supported;
- the target path resolves inside `cwd`;
- the target is not excluded;
- the action does not modify a path outside allowed scope;
- the command does not match a prohibited pattern;
- network use is permitted when required;
- dependency installation is permitted when required;
- a mutation was preceded by inspection;
- no overlapping write is in progress.

Rejected actions return `UNSAFE` or a recoverable action error depending on
severity.

## 11. Command execution

Commands must execute:

- without an interactive shell when possible;
- with a configurable timeout;
- with `cwd` set to the contract working directory;
- with captured stdout and stderr;
- with output-size limits;
- without inheriting secrets unnecessarily.

The initial implementation may use:

```python
subprocess.run(
    args,
    cwd=contract.cwd,
    capture_output=True,
    text=True,
    timeout=command_timeout,
    check=False,
    env=scrubbed_env(),
)
```

When commands are accepted as strings, parse them with `shlex.split`.

Do not invoke `shell=True` by default.

Every command — validator or action — passes through an argv-level policy
check (`check_command_policy`) immediately before execution. The check
operates on parsed argv, never on substring matching, so flag reordering
(`rm -r -f`) or combined short flags (`rm -fr`) cannot bypass it.

Subprocesses receive a minimal allowlisted environment (`scrubbed_env`):
only known-safe variables (`PATH`, `HOME`, `LANG`, `TMPDIR`, `CI`, and
platform equivalents) are passed through, so validators cannot inherit
credentials or other secrets. Harness output paths (`--output`,
`--event-log`, `--checkpoint`, checkpoint files) must resolve inside the
process working directory; escapes are rejected before any filesystem
access.

Commands requiring pipes, redirects, variable expansion, or compound shell
syntax must be explicitly marked as shell commands and subjected to stricter
policy checks.

## 12. File mutations

Preferred mutation order:

1. structured patch;
2. targeted text edit;
3. complete file rewrite only when necessary.

Before mutation, record:

- target path;
- file hash;
- file size;
- whether the file was already modified;
- expected effect.

After mutation:

- confirm the file exists when expected;
- calculate the new hash;
- capture the diff;
- check scope;
- record changed lines;
- run a targeted validator.

Write files atomically:

1. write to a temporary sibling file;
2. flush;
3. replace the destination.

Preserve file permissions when replacing an existing file.

## 13. Decision contract

The agent adapter must return one structured action.

Example:

```json
{
  "kind": "patch_file",
  "reason": "The failing test shows expired tokens are accepted because the comparison is reversed.",
  "arguments": {
    "path": "src/auth/token.ts",
    "patch": "*** Begin Patch\n..."
  },
  "expected_signal": "The token-expiry test changes from failing to passing.",
  "mutates_state": true
}
```

Reject responses that:

- contain multiple unrelated actions;
- omit the reason;
- omit the expected signal;
- attempt unsupported tools;
- claim completion without validator evidence.

The adapter may retry malformed structured output once.

A second malformed result stops with `RUNTIME_ERROR`.

## 14. Validation algorithm

After every mutation:

1. select the cheapest relevant validator;
2. execute it;
3. normalize output;
4. compare it with the previous validator result;
5. determine whether progress occurred.

Before success:

1. run all required validators;
2. confirm all pass;
3. inspect the final diff;
4. confirm no excluded or unrelated files changed;
5. write the final checkpoint and result.

A validator passes only when its configured condition is satisfied.

For command validators, exit code `0` means pass unless the configuration
defines another condition.

## 15. Progress detection

Compute a progress signature from:

```text
content digests of reported changed files (diff-hash substitute)
validator pass/fail states
normalized failure signatures
current hypothesis
changed-file set
```

Potential implementation:

```python
signature_payload = {
    "state": hash_changed_contents(cwd, changed_files),
    "validators": [
        {
            "id": result.validator_id,
            "passed": result.passed,
            "summary": result.summary,
        }
        for result in validator_results
    ],
    "hypothesis": normalized_hypothesis,
    "changed_files": sorted(changed_files),
}
```

Hash canonical JSON with SHA-256.

An iteration makes progress when at least one condition is true:

- repository state changed meaningfully;
- a validator newly passed;
- failure count decreased;
- error signature changed in a diagnostically useful way;
- hypothesis became materially narrower;
- a blocker was conclusively identified.

Formatting-only churn does not count unless formatting is part of the goal.

## 16. Stagnation rules

Increment `stagnation_count` when:

- the progress signature is unchanged;
- the same validator failure repeats without new evidence;
- equivalent edits are repeatedly applied and reverted;
- the action produces no new observation.

Reset the counter after meaningful progress.

At `stagnation_limit - 1`, allow one strategy-shift action.

If the strategy shift produces no progress, stop with `STAGNATED`.

## 17. Limit enforcement

Check limits:

- before requesting the next decision;
- before executing a tool;
- after each tool result;
- before running expensive final validators.

### Iteration limit

Stop before beginning iteration `max_iterations + 1`.

### Wall-clock timeout

Use a monotonic clock.

Stop when elapsed time reaches the configured timeout.

Do not begin a command that cannot reasonably finish within the remaining
time unless the command timeout is reduced accordingly.

### Budget

Enforce only when the runtime exposes reliable usage or cost.

When unsupported:

- record `budget_enforcement: unavailable`;
- do not pretend the budget is enforced;
- continue using iteration and timeout limits.

## 18. Checkpointing

Checkpoint format:

```json
{
  "schema_version": "0.1",
  "goal": "Fix the failing authentication tests.",
  "status": "running",
  "state": "validate",
  "iteration": 4,
  "elapsed_seconds": 182.4,
  "stagnation_count": 0,
  "current_hypothesis": "Refresh tokens use milliseconds where seconds are expected.",
  "changed_files": [
    "src/auth/token.ts"
  ],
  "validators": [
    {
      "validator_id": "auth-tests",
      "passed": false,
      "summary": "1 test failing"
    }
  ],
  "next_action": "Inspect refresh-token fixtures.",
  "resume_safe": true
}
```

Write checkpoints atomically.

A checkpoint must never contain secret values or full environment dumps.

## 19. Resume behavior

**Status: planned (not implemented in v0.1 — see Phase 4).**

`--resume` loads a prior checkpoint.

On resume, the harness must:

1. verify schema compatibility;
2. verify the working directory;
3. capture the current repository status;
4. compare current files with checkpoint hashes;
5. identify external changes since the checkpoint;
6. rerun the latest relevant validator;
7. continue only when resuming is safe.

Stop with `BLOCKED` when external changes create ambiguity that could
overwrite work.

Iteration counts continue from the checkpoint.

## 20. Event log

Write newline-delimited JSON events.

Required event types:

```text
loop_started
repository_inspected
baseline_validator_completed
iteration_started
decision_received
action_authorized
action_rejected
action_completed
validator_completed
progress_evaluated
checkpoint_written
loop_stopped
```

Common envelope:

```json
{
  "timestamp": "2026-07-18T12:00:00Z",
  "event": "validator_completed",
  "iteration": 3,
  "data": {}
}
```

Do not log secrets, complete environment variables, credentials, or
unnecessarily large command output.

## 21. Result format

Example success result:

```json
{
  "schema_version": "0.1",
  "status": "success",
  "stop_reason": "All required validators passed.",
  "goal": "Fix the failing authentication tests.",
  "iterations_used": 5,
  "elapsed_seconds": 241.8,
  "changed_files": [
    "src/auth/token.ts",
    "test/auth/token.test.ts"
  ],
  "validators": [
    {
      "validator_id": "auth-tests",
      "passed": true,
      "exit_code": 0,
      "summary": "24 tests passed",
      "duration_seconds": 8.2
    },
    {
      "validator_id": "lint",
      "passed": true,
      "exit_code": 0,
      "summary": "No lint errors",
      "duration_seconds": 4.5
    }
  ],
  "actions_attempted": [
    "Inspected token expiry implementation",
    "Patched timestamp normalization",
    "Added regression assertion"
  ],
  "current_hypothesis": null,
  "next_best_action": null,
  "resume_safe": true
}
```

## 22. Dry-run mode

`--dry-run` must:

- parse and validate configuration;
- inspect repository instructions;
- resolve validators;
- evaluate scope and safety settings;
- print the planned loop contract;
- avoid file changes;
- avoid executing mutating commands.

Read-only repository inspection is allowed.

Validators should not run unless explicitly enabled for dry-run.

## 23. Testing requirements

The harness implementation must include tests for:

### Configuration

- missing goal;
- invalid working directory;
- negative limits;
- CLI precedence;
- unknown security fields.

### Safety

- path traversal;
- excluded-path writes;
- destructive commands;
- shell injection;
- symlink escaping outside `cwd`;
- attempted mutation before inspection.

### State machine

- successful transition sequence;
- blocked transition;
- stagnation transition;
- iteration-limit transition;
- runtime-error transition.

### Validators

- passing command;
- failing command;
- timeout;
- output truncation;
- required versus optional validators.

### Progress

- newly passing validator;
- decreased failure count;
- identical repeated output;
- meaningless formatting churn;
- strategy-shift allowance.

### Checkpoints

- atomic write;
- resume;
- incompatible schema;
- external repository changes;
- corrupted checkpoint.

### Integration

Provide fixture repositories for:

1. one failing test fixed by a one-line patch;
2. an unsatisfiable validator;
3. repeated no-op actions triggering stagnation;
4. an unsafe requested command;
5. timeout during a validator.

## 24. Acceptance criteria

The initial script is acceptable when:

- `python scripts/run_loop.py --help` exits successfully;
- configuration validation is deterministic;
- all state transitions are covered by tests;
- mutations outside `cwd` are rejected;
- command timeouts are enforced;
- checkpoints are atomic;
- stagnation terminates the loop;
- all required validators must pass before `SUCCESS`;
- result JSON follows the documented schema;
- the test suite passes without network access.

## 25. Roadmap

### Phase 1 — deterministic core

Implemented in the bundled script:

- CLI;
- typed config;
- command validators;
- state transitions;
- limits;
- event log;
- checkpoints;
- stagnation;
- result JSON;
- safety checks;
- dry-run and validation-only modes.

### Phase 2 — local repository adapter

- read;
- glob;
- grep;
- patch;
- atomic write;
- diff inspection;
- scope enforcement;
- repository instruction discovery.

### Phase 3 — model adapter

- structured model output;
- one retry for invalid output;
- stable prompt prefix;
- concise observation summaries;
- usage collection when supported.

### Phase 4 — advanced orchestration

- targeted-validator selection;
- read-only parallelism;
- isolated subagents;
- strategy-shift logic;
- safe resume;
- cost budgets;
- subjective evaluators.
