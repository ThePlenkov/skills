# Runtime Capability Mappings

Use capability categories in skill logic. Map them to concrete tools only at
execution time. Tool names differ between runtimes; capabilities do not.

## Canonical capabilities

| Capability | Purpose |
|---|---|
| `filesystem.list` | Enumerate repository files |
| `filesystem.read` | Read file content |
| `filesystem.search` | Search names or content |
| `filesystem.patch` | Apply a targeted patch |
| `filesystem.write` | Create or replace a file |
| `process.execute` | Run tests, lint, builds, and local commands |
| `web.search` | Search external documentation |
| `web.fetch` | Retrieve a specific external document |
| `agent.delegate` | Delegate an isolated read-only subtask |
| `task.track` | Track multi-workstream progress |
| `goal.anchor` | Persist the active objective across context switches |
| `skill.invoke` | Invoke a narrower specialized skill |

## Mapping procedure

A runtime maps each capability to whatever native tool provides it. For
example, `filesystem.search` may be provided by a file-pattern matcher, a
content search tool, or a repository index query; `process.execute` may be
provided by a shell tool, a subprocess runner, or a task runner integration.
The mapping is discovered, never assumed:

1. enumerate the tools the runtime actually exposes;
2. assign each exposed tool to at most one canonical capability;
3. record unmapped capabilities as unavailable;
4. continue with the capability subset the loop contract requires.

## Availability rules

At startup:

1. identify available capabilities;
2. compare them with the loop contract;
3. disable optional behavior without a mapping;
4. stop with `BLOCKED` when a required capability is unavailable;
5. fall back to the bundled harness script (`scripts/run_loop.py`) when the
   runtime exposes no native execution tools at all.

Minimum capabilities for a repository mutation loop:

```text
filesystem.read
filesystem.search
filesystem.patch or filesystem.write
process.execute
```

A read-only diagnostic loop requires only:

```text
filesystem.read
filesystem.search
process.execute
```

## Goal anchoring

When the runtime provides native goal or objective tracking, register the
loop contract there at `INITIALIZE`:

- goal statement;
- success criteria;
- scope boundaries;
- limits.

Re-read the anchored goal after any context compaction, summarization, or
delegation, and reconcile it with the current loop checkpoint before
continuing. When no native anchoring exists, keep the checkpoint block from
the skill's context-management section at the top of the working context.

## External research

Use external research only when:

- official dependency behavior is unclear;
- an error references an undocumented external system;
- local source and tests are insufficient;
- the user explicitly requests research.

Prefer primary sources:

- official documentation;
- official source repositories;
- language or framework specifications;
- release notes.

Do not send proprietary source code, credentials, internal URLs, or
sensitive logs to external services.

## Subagent mapping

A subagent request must define:

```yaml
goal:
input_scope:
allowed_capabilities:
expected_output:
mutation_allowed: false
```

Default `mutation_allowed` to `false`.

Never delegate final success determination.
