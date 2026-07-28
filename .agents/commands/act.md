---
description: Fix PR review threads and CI issues - iterative loop until merge-ready
argument-hint: pr|plan|backlog|harvest <pr-number> --no-merge|--merge --runner
---

Use the `/act` skill to resolve review threads and CI issues on a pull request.

**Context modes:**
- `/act` or `/act pr` - Fix open threads on current PR
- `/act <pr-number>` - Fix specific PR by number
- `/act ... --runner` - Explicitly request a local self-hosted runner if CI is blocked by runner limits
- `/act ... --merge` - Merge the PR after the loop converges (requires explicit opt-in)
- `/act ... --no-merge` - Default behavior: fix and validate, but never merge
- `/act plan` - Process threads from `.agents/plans/*.md`
- `/act backlog` - Process threads from `.agents/backlog/*.md`
- `/act harvest` - Process threads from `.agents/review-debt/harvests/*.jsonl`

**The Loop (runs until PR is clean):**
1. FETCH - Get current PR state (HEAD SHA, check-runs, threads, SAST annotations)
2. ANALYSE - Investigate each finding
3. CONFIRM/REJECT - Validate if issue is real
4. FIX - Change product code
5. REPLY & RESOLVE - Per-thread response + resolve
6. VERIFY CLEAN - Ensure no errors remain
7. PUSH - Atomic push with clear commits
8. LOOP - Re-fetch state, repeat until clean

**Priority order (mandatory sequence):**
- P0a: CI required checks green on HEAD
- P0b: All SAST error annotations fixed or triaged
- P1: Blocking review feedback (code fixed + reply in thread)
- P2: Nits, questions, style (fix or answer in thread)
- P3: Inline suggestions (applied or declined with reason)
- P4: Resolve pass (only after P0-P3 complete)
- P5: Rate findings (research, opt-in with --record)
- P6: Evaluation (retrospect, cycle check)

**SAST Priority (for P0b):**
1. Read GitHub CI annotations via `gh api`
2. Download SARIF if annotations insufficient
3. Check for CLI + env vars
4. Install and run locally (last resort)

**Never:**
- Run resolve script without fixing code first
- Skip reading SAST annotations on failing checks
- Dismiss SAST findings as "not my responsibility"
- Stop after one pass (loop until clean or context full)
- Merge the PR unless `--merge` was explicitly passed

**Merge-ready only when:**
- Review feedback implemented in code
- CI_REQUIRED_PENDING=0
- SAST_FINDINGS_PENDING=0
- open_threads=0
- P5 and P6 complete

`/act` stops at **merge-ready** unless `--merge` was given. Do not call `gh pr merge` or `gh api .../merge` by default.

Apply the full `/act` skill protocol from `skills/code-review/act/SKILL.md`.
