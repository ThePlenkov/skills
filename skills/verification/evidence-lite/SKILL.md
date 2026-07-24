---
name: evidence-lite
description: >-
  Lightweight proof discipline for trivial changes. Single command + quoted output is enough.
  No claim.json, no validate.py, no structured proof block. Use when files_changed ≤ 2 AND
  lines_changed ≤ 20 AND no test/config/build files are touched. For non-trivial changes use
  $skill{evidence} instead.
allowed-tools: read, grep, glob, write, exec
permissions:
  bash: ask
  edit: ask
  write: ask
argument-hint: "<trivial change to verify>"
tier: 2
triggers: ["user", "model"]
source: theplenkov-ai/skills
---

# /evidence-lite — proof for trivial changes

## When to use this

Use `evidence-lite` (this skill) when **all** are true:

- files changed ≤ 2
- lines changed ≤ 20
- no test, config, or build files touched (`*.test.*`, `*.config.*`, `package.json`, `Makefile`, CI files, etc.)
- the change is documentation, comment, typo, rename, or trivial refactor

Otherwise use $skill{evidence} (full protocol with `claim.json` + `validate.py`).

## Auto-detection

```
files_changed ≤ 2 AND lines_changed ≤ 20 AND no test/config/build files AND change is doc/comment/typo/rename/trivial refactor
  → evidence-lite
else
  → evidence
```

Override: explicit `/evidence lite` or `/evidence full` wins.

## The rule

> **No run → no claim.** For trivial changes the proof is one real command and its real output.

## Recipe

1. Run the smallest command that proves the change.
2. Capture stdout (and stderr if relevant) in the chat reply.
3. Quote the line that proves the claim (e.g. "0 errors", "PASS", exit code 0).
4. State the claim with that quote attached.

That's it. No `claim.json`. No `.evidence/` directory. No `validate.py`. No four-line proof block.

## Examples

### Typo fix in README

```bash
# Before: "Recieve"  After: "Receive"
git grep -n "Receive" README.md   # shows the corrected line (works on Windows with Git)
```

Quote: `README.md:42: To receive...`

### One-line config rename

```bash
git diff --stat path/to/config.yaml   # shows 1 file changed, 1 insertion(+), 1 deletion(-)
```

Quote the diff line.

### Comment-only change

```bash
git diff -- path/to/file.go   # shows only added/removed lines starting with //
```

Quote one changed comment line.

### Doc build sanity

```bash
pnpm docs:build   # inspect the last few lines for the "successfully built" message
```

## What lite is NOT for

- Production code, feature implementation, bug fix → use $skill{evidence}
- Browser/UI/runtime claims → use $skill{evidence} (headless browser required)
- API/database migration → use $skill{evidence}
- Any claim involving "works", "passes", "verified", "no regression" against non-trivial code → use $skill{evidence}

When in doubt: upgrade to $skill{evidence}.