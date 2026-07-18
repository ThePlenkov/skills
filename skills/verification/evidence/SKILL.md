---
name: evidence
description: >-
  Producer-side "say-nothing-without-a-run" discipline combined with runtime proof enforcement.
  ANY claim of done/fixed/passing/verified/green by a coder agent MUST be backed by a real
  executed command + `.evidence/.../claim.json` on disk. Also enforces proving actual behavior
  in the target runtime (backend/API tests, CLI checks, frontend browser automation).
  Required for HTML, UI, browser JavaScript, hydration, routing, and client-side behavior
  where curl is not enough.
allowed-tools: read, grep, glob, write, exec
permissions:
  bash: ask
  edit: ask
  write: ask
argument-hint: "<task or claim to evidence>"
triggers: ["user", "model"]
tier: 2
# Tier 2 — on-demand. Load only when a task may produce a completion claim.
---

# /evidence — file-first, run-first producer discipline

## The only rule (restated, sharper)

> **No run → no claim → no report.**
> A claim not anchored to a real executed command (real exit code, real captured output) and a
> matching evidence file on disk is a **fabrication**, even if it happens to be true.

The discipline has two halves and both are mandatory:

1. **Run something real** — not "I think it works", not "I read the code and it looks right".
   You must have a command in your shell history that you actually executed, with a real
   exit code, with output you can quote.
2. **Record it on disk** — the evidence file lives in the repo, not in your chat reply.
   Chat pastes of "here's the log" are lossy and unverifiable; the file is the proof.

If a peer (verifier agent, parent, human) can `cat .evidence/<date>/<task>/<slug>.json` and
re-derive your claim from the file alone, you have evidence. Otherwise you have a story.

---

## What counts as a claim

If any of these words (or close paraphrases) appear in your reply, that sentence is a claim
and must be backed by an evidence file:

| Trigger | Examples (non-exhaustive) |
| --- | --- |
| completion | "done", "implemented", "fixed", "applied", "shipped" |
| verification | "tested", "verified", "passing", "covers X", "matches spec" |
| correctness | "works", "behaves like Y", "produces the right output" |
| absence | "no regression", "lint clean", "no flaky tests", "no TS errors" |
| state | "all green", "build passes", "CI happy", "merged" |
| conformance | "follows the contract", "matches the API", "respects the schema" |

When in doubt: it is a claim. Back it.

---

## Per-environment minimum viable run

The single most important part of this skill. **For each target environment, this is the
minimum run that produces real evidence.** Anything less is `produced`, not `proved`.

### Web (browser-rendered app, SPA, anything with JS hydration)

**Minimum viable run: headless browser, real URL, console + network + screenshot + DOM.**

```bash
# Install once (agent's job to do this if missing)
npm i -D @playwright/test@1.49.0
npx --yes playwright@1.49.0 install chromium

# Write a focused spec
mkdir -p .evidence/<date>/<task>/<slug>
cat > .evidence/<date>/<task>/<slug>/spec.ts <<'EOF'
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('claim: <paste the claim here>', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

  const resp = await page.goto('http://localhost:3000/path', { waitUntil: 'networkidle' });
  expect(resp?.status(), 'http status').toBe(200);

  // DOM assertion that maps to the claim
  await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();

  await page.screenshot({ path: '.evidence/<date>/<task>/<slug>/screenshot.png', fullPage: true });

  // Persist the captured console to disk so the evidence skill can verify it.
  // An empty file IS the proof of zero errors.
  writeFileSync('.evidence/<date>/<task>/<slug>/console.log', errors.join('\n'));

  expect(errors, 'no console / page errors').toEqual([]);
});
EOF

# Run it
npx --yes playwright@1.49.0 test .evidence/<date>/<task>/<slug>/spec.ts --reporter=line
```

**Forbidden as evidence for browser claims:**
+ `curl http://localhost:3000` and seeing `<html>` in the body (HTML presence ≠ JS executed)
+ `node -e "require('./build')"` (node ≠ browser — no DOM, no WebSocket, no layout)
+ Lint passing on the new component (lint ≠ runtime behaviour)
+ "Manually checked in Chrome" (not reproducible, not in evidence file)

The evidence file MUST list under `artifacts`:
+ `screenshot.png` (or full-page trace)
+ `console.log` (zero errors)
+ For WebSocket / SSE / long-poll: a `network.har` or explicit connection log

### Backend / API (HTTP service, RPC, queue consumer)

**Minimum viable run: real HTTP call with seeded data, response shape + side-effect asserted.**

```bash
# Seed
psql $DATABASE_URL -c "INSERT INTO widgets (id, name) VALUES ('w-1', 'evidence-widget') ON CONFLICT DO NOTHING;"

# Hit
RESP=$(curl -sS -X POST http://localhost:8080/widgets/w-1/rotate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"direction":"cw"}' \
  -w "\nHTTP_STATUS:%{http_code}\nTIME_TOTAL:%{time_total}\n")

# Assert in shell
echo "$RESP" | grep -q '"status":"rotated"' || { echo "FAIL: missing status"; exit 1; }
echo "$RESP" | grep -q "HTTP_STATUS:200" || { echo "FAIL: non-200"; exit 1; }

# Side-effect check
psql $DATABASE_URL -tAc "SELECT direction FROM widgets WHERE id='w-1';" | grep -q "cw" \
  || { echo "FAIL: side-effect not persisted"; exit 1; }
```

The evidence file MUST list:
+ The seed step
+ The exact request (method, URL, headers, body)
+ The status code, response excerpt
+ The side-effect assertion (DB row, queue message, log line)
+ One assertion that, if false, falsifies the claim

### CLI / script

```bash
# Run the actual binary, capture both streams into the evidence dir, check exit code.
# mkdir -p is mandatory — the evidence dir is the canonical home for these artifacts.
mkdir -p .evidence/<date>/<task>/<slug>
./dist/cli.js do-thing --input fixtures/x.json \
  > .evidence/<date>/<task>/<slug>/out.stdout \
  2> .evidence/<date>/<task>/<slug>/out.stderr
EC=$?
test "$EC" -eq 0 || { echo "FAIL exit=$EC"; exit 1; }
grep -q "expected marker" .evidence/<date>/<task>/<slug>/out.stdout \
  || { echo "FAIL: marker missing"; exit 1; }
```

The evidence file MUST list: command, cwd, `exit_code`, both stdout AND stderr excerpt.

### Library / pure function

**Minimum viable run: a unit test that fails without the fix.**

```bash
# If no test exists, write one. The fix is not done if the test did not exist before the fix.
npx --yes vitest@2.1.5 run packages/foo/test/bar.test.ts --reporter=verbose
```

**Forbidden as evidence for library claims:**
+ "I read the code and it looks right"
+ The test exists but was not run this turn (commit `.test.ts` separately, link to test run that
  covered it)
+ TypeScript compiles but no test was executed

### Static analysis (typecheck, lint, format)

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

The evidence file MUST list **each** tool's output under `commands[*].stdout_excerpt`, with the
"0 errors / 0 warnings" line quoted.

**Forbidden as evidence for "lint clean" claims:**
+ Only quoting typecheck but claiming "lint clean"
+ Quoting a summary line without the tool name in the same output

### Docs / config change

```bash
# Build the docs and diff the produced HTML / md against the expected output
pnpm docs:build
git diff --stat docs/
```

The evidence file MUST list the build command and a diff summary that touches the files
you claim to have changed.

### Database migration

```bash
# Run migration against a throwaway DB and capture log into the evidence dir.
# The schema requires this log to have a content_excerpt with a real schema dump
# (e.g. the `Column | --- | Table` markers psql emits from `\d widgets`).
mkdir -p .evidence/<date>/<task>/<slug>
psql $TEST_DATABASE_URL -f migrations/0007_add_foo.sql \
  > .evidence/<date>/<task>/<slug>/migration.log 2>&1
# Assert the column exists, the data shape matches
psql $TEST_DATABASE_URL -c "\d widgets" | tee -a .evidence/<date>/<task>/<slug>/migration.log | grep -q "foo_bar"
psql $TEST_DATABASE_URL -c "SELECT 1 FROM widgets LIMIT 1;"  # queryable
# Down
psql $TEST_DATABASE_URL -f migrations/0007_add_foo.down.sql \
  >> .evidence/<date>/<task>/<slug>/migration.log 2>&1
psql $TEST_DATABASE_URL -c "\d widgets" | tee -a .evidence/<date>/<task>/<slug>/migration.log | grep -vq "foo_bar" \
  || { echo "FAIL: down did not remove"; exit 1; }
```

---

## Anti-evidence (the things that LOOK like proof but are not)

| Looks like evidence | Why it isn't | Replace with |
| --- | --- | --- |
| `curl http://localhost:3000` returns `<html>` | HTML presence ≠ JS executed ≠ layout works ≠ WebSocket connected | headless browser with console + screenshot + DOM assertion |
| `node -e "require('./build')"` succeeds | Node has no DOM, no layout, no WebSocket, no fetch | headless browser |
| Lint passes | Lint ≠ runtime behaviour | run the actual test that exercises the changed code path |
| "I read the code, looks right" | Not reproducible, not in file | run a command that, if it failed, would falsify the claim |
| Test exists in the repo | Existed ≠ ran this turn | `vitest run <file>` this turn, quote the PASS line |
| `tsc --noEmit` passes | Only the type checker; the code may still throw at runtime | run the actual code path |
| Screenshot of an old build | Stale | re-take screenshot AFTER the change, this turn |
| Network log without status assertions | "Connection attempted" ≠ "connection succeeded" | assert status 200 / WS OPEN / 2xx in evidence file |
| `git status` shows the file changed | Tracked ≠ correct | run the test that exercises the file |
| Pasted log into chat | Lossy, can't re-derive | `.evidence/.../commands.json` with `stdout_excerpt` |
| `expected: X, received: Y` quoted as success | That quote is a FAILURE, not proof | fix until the quote is a PASS, then quote the PASS line |
| `coverage: 100%` | Coverage ≠ correctness — tests can pass without asserting the right thing | quote an assertion that, if false, would fail the test |

---

## Evidence file

### Location

```
.evidence/<YYYY-MM-DD>/<task-id>/<claim-slug>/
├── claim.json          # the structured proof (mandatory)
├── spec.ts             # the test that was run (for browser/library)
├── screenshot.png      # or trace.har (for browser)
├── console.log         # for browser
├── out.stdout          # for CLI
└── out.stderr          # for CLI
```

`<claim-slug>` is a kebab-case label for the claim
(e.g. `private-section-handled`, `e2e-suite-green`, `login-form-renders`).

### Schema (v1)

See [`templates/claim.json`](./templates/claim.json). Mandatory keys + rules:

+ `claim` — exact sentence you intend to send
+ `slug` — kebab-case, matches the dir name
+ `agent`, `session_id`, `produced_at`
+ `target_environment` — `backend | cli | frontend | browser | integration | static-analysis | test-suite | db-migration | docs | other`
+ `verification_method` — `command | test-suite | browser-automation | static-analysis | manual | e2e-scenario`
+ `preconditions` — non-empty list of what was true before the claim
+ `commands` — **≥ 1 entry, each with `cmd`, `cwd`, `exit_code`, `duration_ms`, `stdout_excerpt`, `stderr_excerpt`**. Empty `commands` is structurally invalid.
+ `assertions` — **≥ 1 entry, each with `name`, `passed`, `evidence_quote`**. `evidence_quote` MUST be an exact line from one of the `commands[*].stdout_excerpt` or from a sibling artifact. A name without a quote is structurally invalid.
+ `files_changed` — absolute paths
+ `artifacts` — log / screenshot / trace / report / bundle with `path` + `sha256`. **For `target_environment=browser`, `artifacts` MUST include ≥ 1 entry with `kind` in {`screenshot`, `trace`}. For `target_environment=db-migration`, ≥ 1 entry with `kind=log` showing the post-migration schema.**
+ `remaining_gaps` — honest, non-decorative list (can be empty)
+ `self_recheck.performed` — MUST be `true`
+ `self_recheck.result` — `still-holds | drifted | invalid`

### The three-state rule

```
produced  →  file written, claim under test
checked   →  re-read commands + assertions against captured output, still holds
proved    →  matched to its evidence file end-to-end → safe to report
```

A claim is `proved` only when you can point to, in one breath:

1. the evidence file path,
2. one assertion inside that file that, **if false, would falsify the claim** (the "killing assertion").

If you cannot name such an assertion, the claim is **not proved** — even if the file exists.
Downgrade to `produced` and either add the assertion or run more checks.

### Required report

Every turn with a claim ends with **one four-line block per claim**:

```
claim:        <one line, identical to file.claim>
slug:         <slug>
file:         <absolute path to .evidence/.../claim.json>
killing ass.: <one assertion name that falsifies the claim>
gaps:         <[] or honest list>
```

That four-line block is the proof. Without it, the report is rejected by this skill.
The user (or a downstream verifier) can `cat` the file and check.

---

## Security note — `validate.py` path-traversal guard

`scripts/validate.py` reads `artifacts[].path` from disk when cross-checking
`assertions[].evidence_quote`. A malicious `claim.json` could otherwise point
`path` at a file outside the project tree (system files, credential stores,
other users' homes) and have the file contents surface in this script's
stdout (which is shared in CI logs / PR comments).

The script enforces: a path is **only** read if it resolves to a descendant
of the claim directory or the current working directory. Absolute paths to
system files, other users' homes, or anywhere outside the project tree are
rejected with a clear `path-traversal guard` error and the claim is marked
invalid. To point at a file outside `claim_dir` / `cwd`, use a relative
path that resolves into the project tree.

The guard is tested by the included malicious-claim fixture: a claim whose
sole artifact references an absolute path outside the project is rejected
before any read.

## How to use this skill (the loop)

1. **Plan** the claims you intend to make at the end of this turn.
2. **Pick the per-env recipe** from this file that matches `target_environment`.
3. **Run the recipe** — do not paraphrase, do not skip steps. Capture full stdout/stderr OR
   copy to `.evidence/.../out.stdout` etc. Use pinned versions for any `npx` invocation
   (e.g. `npx --yes vitest@2.1.5`) — unpinned `npx` is a known rug-pull vector.
4. **Write the evidence dir** — `mkdir -p .evidence/<date>/<task>/<slug>` then `claim.json`
   plus any per-env artifacts.
5. **Validate structurally** — run `validate.py` (included with this skill) against the claim.json file. It exits non-zero on (a) JSON-schema violations, (b) any `assertions[].evidence_quote` that
   does not appear verbatim in `commands[*].stdout_excerpt` / `stderr_excerpt` / a referenced
   artifact file, (c) any `db-migration` log artifact that is empty or has a stub
   `content_excerpt`. The script is the only thing that can promote `produced` to `checked`.
6. **Self-recheck** — re-read the file. For each assertion, locate the `evidence_quote` inside
   the captured output. Set `self_recheck.result`.
7. **Report** — only now state the claim, with the four-line proof block.
8. **Carry over** between turns with `@see <previous-claim-slug>` references; do not re-evidence
   the same fact twice.

---

## Integration with other skills

+ **/e2e** — when the verification is a scenario, `e2e-agent run …` writes
  `E2E_EVIDENCE_FILE=...`. Reference that path as `artifacts[].path` inside your evidence file.
  /evidence wraps /e2e; it does not replace it.
+ **verifier agent** — independent second pair of eyes. Producers SHOULD NOT delegate
  verification to themselves and call it done; if only the producer ran the check, the claim is
  `produced`/`checked`, not `proved`-in-the-PR-sense.
+ **/act, $save-session, $mr-address-review, $github-pr-review, $triage-issue** — every
  "fixed" / "resolved" / "verified" / "green" sentence in a reply must reference its evidence
  file path.

---

## Runtime proof (merged from runtime-proof)

Goal: prove the true objective with runtime-level evidence.

### Choose target environment

Classify the proof target:

+ backend/API
+ CLI/script
+ frontend/browser
+ integration/service
+ test suite

### Backend/API proof

A 200 response is not enough if the objective involves correctness, auth, persistence, side effects, or data shape.

Show:

+ command executed
+ response or test output
+ assertion that matches the true objective

### Frontend/browser proof

For frontend, HTML, UI, client-side JavaScript, browser routing, hydration, or page behavior, curl is forbidden as final proof.

Use an existing browser test if it proves the objective.

If no browser test exists, create a temporary verification script when allowed. The script must:

+ navigate to the real local URL
+ capture console errors
+ capture uncaught page errors
+ wait for app initialization
+ assert the relevant UI behavior
+ exit non-zero on failure

### Required output

Target environment: ...
Verification method: ...
Command executed: ...
Important output: ...
What the output proves: ...
Remaining gaps: ...

---

## Self-check before sending (copy-paste this)

```text
Before I report "done/fixed/passing/verified":

  [ ] I have one .evidence/<date>/<task>/<slug>/ per claim.
  [ ] Each claim.json has ≥ 1 command with a REAL exit_code I captured this turn.
  [ ] Each assertion has an evidence_quote that is a literal line from the captured output.
  [ ] For browser claims: screenshot.png and console.log are inside the slug dir, console is empty.
  [ ] For API claims: I seeded data, I hit the endpoint, I asserted response + side effect.
  [ ] For static-analysis claims: I quoted the actual "0 errors" line from each tool.
  [ ] I can name the killing assertion out loud.
  [ ] My report ends with one four-line block per claim.

If any box is unchecked: I am about to lie. Downgrade to "produced" or run more.
```
