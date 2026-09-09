# Evidence Template — Dep Cost Audit Trail

Every `dep-cost` run produces an evidence file. The format below is the contract between you (the agent) and the next reviewer.

## Why this format

- Forces honest measurement (you can't say "small" without showing the bytes)
- Makes the decision auditable in 30 seconds
- Catches "I never actually measured" before it becomes a code review argument
- Becomes the input to a future dep audit

## Template

```markdown
# dep-cost evidence — <YYYY-MM-DD>

## Dep being evaluated
- Name: <package@version>
- Ecosystem: <npm | pypi | cargo | go modules | ...>
- Proposed by: <PR/issue/commit>
- Purpose: <one-line: what we want this dep to do>

## Step 1: Used surface

### What we import
- <file>:<line> — `import <pkg>` / `from <pkg> import <symbol>`
- <file>:<line> — `import <pkg>`
- ...

### Surface ratio
- Distinct symbols used: <N>
- Total public symbols in <pkg>: <M>
- Used surface: <N>/<M> = <percentage>

## Step 2: Dep cost

### Install / download size
- Source: <npm view | pip show | cargo metadata | ...>
- Unpacked: <N> KB
- Tarball: <N> KB

### Bundle / runtime size
- Source: <bundlephobia | cost-of-modules | cargo bloat | ...>
- Before this dep: <N> KB
- After this dep: <N> KB
- Delta: <N> KB

### Transitive deps
- Count: <N>
- Names: <list>
- Combined size: <N> KB

### Maintenance signal
- Last release: <YYYY-MM-DD>
- Weekly downloads: <N>
- Bus factor: <N> maintainers (from `git log --format='%ae' | sort -u | wc -l`)

### Vulnerabilities
- Source: <npm audit | pip-audit | cargo audit | govulncheck>
- Open CVEs: <list, or "none">

## Step 3: Reimplementation cost

### Bucket
<trivial | tricky | critical>

### Honest hour estimate
- Code: <hours>
- Edge cases: <hours>
- Tests: <hours>
- Review: <hours>
- Total: <hours>

### Reused logic
- Reading the dep's source as reference: <yes | no>
- If yes: <which parts, what we learned>

## Step 4: Cross-checks

### License
- SPDX: <MIT | Apache-2.0 | ...>
- Compatible with project: <yes | no | needs review>

### Maintenance health
- Last release > 18 months: <yes | no>
- Bus factor < 2: <yes | no>
- Open critical issues: <yes | no>

## Step 5: Decision

### Verdict
<keep | reimplement | replace with X | reject>

### Reasoning
<3-5 sentences>

### If reimplement: where will the new code live?
- <file:line> — function for X
- <file:line> — function for Y

### If keep: what is the bundle / install cost we're accepting?
- <N> KB bundle
- <N> KB install
- <N> transitive deps

## Step 6: Follow-up

### Audit cadence
- Re-evaluate: <quarterly | on version bump | on next major refactor>

### Exit criteria
- What would make us reimplement? <list of triggers>
- What would make us keep despite concerns? <list of triggers>
```

## Worked example (filled in)

```markdown
# dep-cost evidence — 2026-07-27

## Dep being evaluated
- Name: lodash@4.17.21
- Ecosystem: npm
- Proposed by: PR #234 (adds debounce to SearchBox)
- Purpose: lodash.get and lodash.debounce for the new SearchBox component

## Step 1: Used surface

### What we import
- src/utils/path.ts:3 — `import get from 'lodash/get'`
- src/hooks/useDebouncedValue.ts:2 — `import debounce from 'lodash/debounce'`

### Surface ratio
- Distinct symbols used: 2
- Total public symbols in lodash: ~300
- Used surface: 2/300 = 0.7%

## Step 2: Dep cost

### Install / download size
- Source: npm view
- Unpacked: 5.4 MB
- Tarball: 1.4 MB

### Bundle / runtime size
- Source: cost-of-modules on production build
- Before this dep: 218 KB
- After this dep: 298 KB
- Delta: 80 KB

### Transitive deps
- Count: 0
- Names: (none)
- Combined size: 0 KB

### Maintenance signal
- Last release: 2024-09-12 (> 18 months ago)
- Weekly downloads: 49,000,000
- Bus factor: 4 maintainers

### Vulnerabilities
- Source: npm audit
- Open CVEs: none

## Step 3: Reimplementation cost

### Bucket
Trivial

### Honest hour estimate
- Code (get + debounce): 1 hour
- Edge cases (cancellation for debounce, default for get): 0.5 hours
- Tests: 1.5 hours
- Review: 0.5 hours
- Total: 3.5 hours

### Reused logic
- Reading lodash source: yes, briefly
- Insight: lodash.debounce uses setTimeout; cancellation is a clear method on the returned function

## Step 4: Cross-checks

### License
- SPDX: MIT
- Compatible: yes

### Maintenance health
- Last release > 18 months: yes (concern)
- Bus factor < 2: no
- Open critical issues: no

## Step 5: Decision

### Verdict
reimplement

### Reasoning
Lodash is 5.4MB installed and adds 80KB to the bundle for 2 functions out of
~300 (0.7% surface). Reimplementation is trivial (3.5 hours) and we already
have the pattern in src/utils/timing.ts for debounce. The license and license
compatibility are fine, but the bundle cost is unjustified for the surface
used. The fact that the last release is > 18 months old is a soft signal that
maintenance may slow further.

### If reimplement: where will the new code live?
- src/utils/path.ts — get(obj, path, default) function
- src/utils/timing.ts — extend existing debounce with cancellation

### If keep: N/A

## Step 6: Follow-up

### Audit cadence
- Re-evaluate: on next quarterly dep audit

### Exit criteria
- What would make us re-add lodash: if we need 5+ lodash functions and they
  are non-trivial to reimplement
- What would make us keep despite concerns: if a future lodash release
  halves the bundle size via better tree-shaking
```

## Where to store evidence files

Options, in order of preference:

1. **In the PR description** as a section, if the work is part of a PR
2. **In a comment on the issue** if the work is part of an issue
3. **In a `docs/decisions/YYYY-MM-DD-dep-cost-<dep>.md`** in the repo, if the decision is significant
4. **In the commit message body** if the work is part of a commit

Pick the lightest option that the team will actually read.
