# Change Sizing

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if it's a single logical change.
~1000 lines changed  → Too large. Split it.
```

A small diff can still push a file past a healthy boundary — around
1000 *total* lines in a single file is a common inspection signal, not
a hard cap. When a change materially grows an already-large file, ask
whether to extract helpers, subcomponents, or modules *first*, before
piling more on. Decompose, then add.

**Separate refactoring from feature work.** A change that refactors
existing code and adds new behavior is two changes — submit them
separately. Small cleanups (variable renaming) can be included at
reviewer discretion.

## Splitting strategies when a change is too large

| Strategy | How | When |
|----------|-----|------|
| **Stack** | Submit a small change, start the next one based on it | Sequential dependencies |
| **By file group** | Separate changes for groups needing different reviewers | Cross-cutting concerns |
| **Horizontal** | Create shared code/stubs first, then consumers | Layered architecture |
| **Vertical** | Break into smaller full-stack slices of the feature | Feature work |

**When large changes are acceptable:** Complete file deletions and
automated refactoring where the reviewer only needs to verify intent,
not every line.
