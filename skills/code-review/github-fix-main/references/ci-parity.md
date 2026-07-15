# CI Parity Step

§6 in the main workflow is mandatory before every push. The goal: **PR's CI is green on first push.** Reproduce the same checks CI will run, locally, before pushing.

`nx affected` alone is not sufficient — it skips jobs CI actually runs.

## Enumerate what CI will run

```bash
# Workflows that trigger on PRs to the default branch
ls .github/workflows/

# Which jobs + step commands each workflow defines
yq '.jobs | to_entries | .[] | {job: .key, steps: [.value.steps[].run // empty]}' \
  .github/workflows/*.yml

# External required checks (GitHub Apps, third-party scanners)
gh api "repos/$REPO/branches/$MAIN/protection/required_status_checks" 2>/dev/null
```

## Build the local command set

1. Collect every distinct shell command from workflow jobs that runs project code (build / test / lint / typecheck / format-check / codegen-verify / spec-validate / …). Normalise matrix variables against the PR's actual combination.
2. Skip pure infra steps (checkout, setup-node, cache restore, artifact upload).
3. Run the full set **sequentially**, not via `nx affected`. Use `--skip-nx-cache` for the first pass if Nx caching can mask a regression.

```bash
bunx nx format:check
bunx nx run-many -t typecheck lint build test --skip-nx-cache
```

## Failure handling

- Any step red → fix, re-run that step, then re-run the full set. Do not cherry-pick only the failed step on subsequent passes.
- Record gaps where CI runs something locally unreproducible (runner-only secrets, platform-specific matrix, GitHub-hosted scanner) in `tmp/fix-main/ci-parity-gaps.md` with the exact check name. §7b treats only those gap-checks as legitimate-first-fail on CI; everything else failing on CI is a skill bug.

## Format normalization

Run `bunx nx format:write` last. If it produces changes, amend into the previous commit (`git commit --amend --no-edit`). Never ship a commit whose only effect is trailing-whitespace fixes on top of another commit.
