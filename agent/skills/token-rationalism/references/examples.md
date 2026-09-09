# Token Rationalism — Extended Examples

Reference material for `$skill{token-rationalism}`. Load only when examples are needed; the parent skill already covers the rules.

---

## Parallel vs sequential tool calls

**Sequential (wasteful)**:
```
read("a.md")
read("b.md")
read("c.md")
```
Three round-trips for three independent reads.

**Parallel (correct)**:
```
read("a.md"), read("b.md"), read("c.md")
```
One round-trip. Always batch independent reads, greps, globs.

---

## Targeted edits vs full rewrites

**Wrong**: paste the entire 200-line file when only one function changed. Burns tokens on unchanged lines the user already has.

**Right**: edit the specific lines. The diff is the proof.

When you must show context, show the minimum needed to understand the change — typically 3–10 lines around the edit, not the whole file.

---

## Documentation rejection cases

| Trigger | Doc to NOT write | Why |
|---|---|---|
| Single bug fix | "How to fix bug X" README | Ephemeral — comment in code is enough |
| One-line config | "Configuration guide" | Self-evident from the config file |
| Obvious from naming | "Architecture overview" of 3 files | Code IS the architecture |
| Already in AGENTS.md | Parallel "setup.md" | Duplicate → update AGENTS.md |

**Documentation that earns its tokens**:
- Why a non-obvious architectural choice was made (trade-offs considered)
- External API contracts that consumers need
- Onboarding steps that cannot be scripted (e.g., manual account creation)
- Postmortems where the failure mode is subtle

---

## Format selection in practice

**Decision with reasoning** (3-line format):
> Use `pnpm` over `npm`. Reason: project lockfile is pnpm-lock.yaml and CI uses pnpm. Caveat: contributors on Windows may need corepack enabled.

**Status update** (one line):
> Done. Moving to type-check.

**Comparative options** (table):

| Option | Speed | Memory | Complexity |
|---|---|---|---|
| In-memory dict | O(1) | High | Low |
| SQLite | O(log n) | Low | Medium |
| File scan | O(n) | None | Low |

**Architecture explanation** (sections, not paragraphs):
```
## Component A
role: ...
inputs: ...
outputs: ...

## Component B
...
```

---

## Anti-patterns catalogue

| Anti-pattern | Cost | Replacement |
|---|---|---|
| "I'll start by explaining my plan before coding" | Full paragraph of preamble | One-line intent, then code |
| Restating the user's request | Wastes the round-trip | Jump to the work |
| "Let me know if you need anything else!" | Empty closing | Stop after the work |
| Multiple paragraphs when bullets work | Linear vs scannable | Bullets |
| Asking 3 questions when 1 would suffice | Round-trip tax | Combine into one question |
| Producing 50 lines when a 10-line abstraction serves | Token bloat + maintenance debt | Extract |

---

## When deeper reasoning IS warranted

- Security: auth flows, data exposure, irreversible deletes
- Architecture: choosing a database, framework, or deployment topology
- Disagreement: pushing back on a user instruction requires showing the work
- Ambiguous bugs: when 3+ plausible root causes exist, enumerate rather than guess

In all of these, **the cost of being wrong dwarfs the cost of extra reasoning tokens**. Do not shortcut.
