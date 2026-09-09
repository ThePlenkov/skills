# Stop States — Final-Response Templates

The SKILL body lists when to reach for each stop state; this file
is the **native-loop** final-response template for each one. The
harness (`scripts/run_loop.py`) emits a single common `LoopResult`
schema for every state — see `references/harness-spec.md` for the
canonical fields. The YAML forms below are the **final reply the
native loop prints to the user**, not the harness output.

Use exactly one of these per native-loop run — mixing contracts
(e.g. `limit_reached` + `stagnated` in the same response) is a
bug.

## SUCCESS

Use only when every required success criterion passes.

```yaml
status: success
goal:
iterations_used:
changed_files:
validators:
summary:
remaining_risks:
```

## BLOCKED

Use when progress requires unavailable information, access,
credentials, dependencies, or tools.

```yaml
status: blocked
reason:
actions_attempted:
last_validator:
required_unblock:
resume_safe:
```

## STAGNATED

Use when repeated iterations produce no meaningful progress.

```yaml
status: stagnated
reason:
repeated_pattern:
actions_attempted:
last_validator:
next_best_strategy:
resume_safe:
```

## LIMIT_REACHED

Use when an iteration, timeout, or budget limit is exhausted.

```yaml
status: limit_reached
limit_type:
actions_attempted:
last_validator:
current_hypothesis:
next_best_action:
resume_safe:
```

## UNSAFE

Use when completing the task requires an action prohibited by
repository policy, runtime policy, or `references/safety-policy.md`.

```yaml
status: unsafe
prohibited_action:
reason:
safe_alternative:
```

## RUNTIME_ERROR

Use when the harness or execution environment fails independently of
the repository task.

```yaml
status: runtime_error
operation:
error:
partial_state:
resume_safe:
```

## Harness output — JSON records

When the loop is driven by `scripts/run_loop.py`, the harness emits
**two record kinds** with different shapes. Consumers MUST handle
them as separate records, not as one merged document. The dataclass
in `references/harness-spec.md` is the partial Python view; **always
read the JSON, not the dataclass** when writing a consumer — the
JSON is what your script should expect on stdout / over IPC.

The two record kinds are:

- **`LoopResult`** — the **terminal** record. Emitted exactly
  once, when the loop exits (success or failure). All of the
  consumer-grade bookkeeping lives here.
- **`Checkpoint`** — the **progress** record. Emitted after every
  iteration while the loop is still running, so a watcher can
  resume mid-loop or surface live state to a UI.

The native-loop YAML forms earlier in this file (under
`## SUCCESS`, `## BLOCKED`, etc.) are the human-readable expansion
of the **`LoopResult` terminal record** only — there is no
human-readable expansion of the checkpoint record. The
checkpoint record is harness-internal telemetry, emitted on stdout
or over IPC, and consumers read it as JSON.

`kind` and `status` MUST agree: a `checkpoint` record has
`status: "running"` and nothing else; a `result` record has a
terminal `status` (one of `"success"`, `"blocked"`, `"stagnated"`,
`"limit_reached"`, `"unsafe"`, `"runtime_error"`) and nothing else.
A record whose `kind` and `status` disagree is malformed and MUST
be rejected. Unknown `kind` or `status` values MUST also be
rejected — do NOT validate against a fallback schema.

### 1. `Checkpoint` (mid-run progress record)

```json
{
  "schema_version": "0.1",
  "kind": "checkpoint",
  "status": "running",
  "state": "initialize",
  "iteration": 3,
  "current_hypothesis": "additive move + centralisation is enough",
  "next_action": "observe the validator output on the second pass",
  "changed_files": ["src/api/widget.ts", "migrations/0007_add_foo.up.sql"],
  "actions_attempted": [
    "ran unit tests",
    "re-ran schema introspection"
  ],
  "validators": [
    {
      "validator_id": "lint",
      "passed": true,
      "summary": "0 errors, 2 warnings",
      "exit_code": 0,
      "output_excerpt": "src/api/widget.ts:42:1 — warning: unused import 'foo'\n",
      "duration_seconds": 1.42
    },
    {
      "validator_id": "typecheck",
      "passed": true,
      "summary": "ok",
      "exit_code": 0,
      "output_excerpt": "",
      "duration_seconds": 3.18
    }
  ]
}
```

`state` is one of `"initialize"`, `"inspect"`, `"plan"`, `"act"`,
`"observe"`, `"validate"`. `next_action` is the immediate step the
harness will take next. The checkpoint record does NOT carry
`stop_reason`, `iterations_used`, `elapsed_seconds`, `stagnation_count`,
`next_best_action`, or `resume_safe` — those are terminal-only and
belong on `LoopResult`.

### 2. `LoopResult` (terminal record)

```json
{
  "schema_version": "0.1",
  "kind": "result",
  "status": "success",
  "stop_reason": "validators all passed after 3 iterations",
  "goal": "add foo_bar column with ondelete cascade",
  "iteration": 3,
  "iterations_used": 3,
  "elapsed_seconds": 47.6,
  "stagnation_count": 0,
  "next_best_action": "tighten the validator on the migration log to catch the early absent-column case",
  "changed_files": [
    "src/api/widget.ts",
    "migrations/0007_add_foo.up.sql",
    "migrations/0007_add_foo.down.sql"
  ],
  "actions_attempted": [
    "ran unit tests",
    "re-ran schema introspection",
    "ran the down migration"
  ],
  "validators": [
    {
      "validator_id": "lint",
      "passed": true,
      "summary": "0 errors, 2 warnings",
      "exit_code": 0,
      "output_excerpt": "src/api/widget.ts:42:1 — warning: unused import 'foo'\n",
      "duration_seconds": 1.42
    },
    {
      "validator_id": "typecheck",
      "passed": true,
      "summary": "ok",
      "exit_code": 0,
      "output_excerpt": "",
      "duration_seconds": 3.18
    },
    {
      "validator_id": "migration-down-roundtrip",
      "passed": true,
      "summary": "down removed foo_bar; up restored it",
      "exit_code": 0,
      "output_excerpt": "DROP COLUMN done; ADD COLUMN done",
      "duration_seconds": 0.84
    }
  ],
  "resume_safe": true
}
```

`next_best_action` is the long-horizon plan the harness recommends
the next loop start with; it is emitted only on `LoopResult`. The
`LoopResult` record does NOT carry `state` (the loop has already
exited) or `next_action` (use `next_best_action` instead). The
`validators` array uses the same shape on both record kinds — see
the validator fields below.

### Validator fields (shared by both record kinds)

Every entry in `validators[]` is a `ValidatorResult`, serialized
via `dataclasses.asdict()` on the harness side. The full shape is:

| field | type | meaning |
|-------|------|---------|
| `validator_id` | string | The validator's stable id (e.g. `"lint"`, `"typecheck"`, `"migration-down-roundtrip"`). |
| `passed` | bool | `true` if the validator returned exit 0, `false` otherwise. |
| `summary` | string | One-line outcome (the same line the harness logs). |
| `exit_code` | integer | The validator process's exit code (0 on pass). Always present. |
| `output_excerpt` | string | The last N lines of validator stdout/stderr. May be empty. |
| `duration_seconds` | number | Wall-clock time the validator took. Always present. |

A consumer that expects only `validator_id` / `passed` / `summary`
will silently drop the `exit_code` / `output_excerpt` /
`duration_seconds` fields and miss diagnostics. Treat all six as
required.

Notes for consumers:

- `schema_version` lets you reject records from an incompatible
  harness version. Treat unknown versions as a hard error, not a
  silent pass.
- Distinguish checkpoint vs result by `kind`. Do NOT validate
  them against the same required-field set — a checkpoint
  legitimately has no `stop_reason`, a result legitimately has
  no `next_action`.
- Reject malformed records: unknown `kind`, unknown `status`, or
  `kind`/`status` mismatch (e.g. `kind: "result"` with
  `status: "running"`).
- Required for both kinds: `schema_version`, `kind`, `status`,
  `iteration`, `validators`. Other fields are conditional on
  the kind (see above). Each `validators[]` entry MUST have
  all six fields.
- The native-loop YAML forms earlier in this file describe the
  `LoopResult` terminal record only. The harness JSON is the
  canonical machine-readable form.
