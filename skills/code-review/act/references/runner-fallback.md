# Runner fallback

Use when GitHub-hosted runners are unavailable because the account/org has hit its
spending limit (`The job was not started because recent account payments have failed
or your spending limit needs to be increased`) or when the user explicitly requests a
local runner with `/act --runner`.

`/act` should own CI to completion: start a runner, trigger the blocked checks,
and watch them with `gh` until they finish. After the checks finish, clean up the
runner and restore workflow labels.

## When to use

- `pr-state.ts` reports `CI_REQUIRED_PENDING > 0` and one of the failing/pending
  check annotations says the job could not start due to payment/spending limits.
- The user typed `/act --runner` or `/act pr <number> --runner`.
- You are otherwise blocked from running the required checks and the user has
  approved executing workflows on their own hardware.

## Before you start

1. Confirm `gh auth status` works and the token can create a registration token:
   ```bash
   gh api repos/<owner>/<repo>/actions/runners --jq '.total_count'
   ```
   A `403` here means the token lacks the required scope.

2. Get explicit user approval via `message_user` before registering a runner and
   running arbitrary workflow code on the host. This is a destructive/security
   operation.

3. The host must have `node` and `gh` installed and network access to
   `github.com`.

## 1. Get a registration token

```bash
RUNNER_TOKEN=$(gh api --method POST repos/<owner>/<repo>/actions/runners/registration-token --jq '.token')
```

This token is valid for one hour. Do not print it or commit it.

## 2. Route workflows to self-hosted labels

Find every `runs-on` in `.github/workflows/*.yml` and `.github/workflows/*.yaml`
and replace it with labels that match the local host:

```yaml
runs-on: [self-hosted, linux, x64]
```

For the correct labels, run `node scripts/runner.cjs --help` on the host to see the
default label set. Usually it is `self-hosted,linux,x64`, `self-hosted,macos,x64`,
`self-hosted,windows,x64`, or the `arm64`/`arm` variants.

Make the routing change now, but do **not** stage or commit it yet; it will be
staged and committed after the runner is online so the new workflow run uses the
self-hosted labels.

After the runner is cleaned up, restore the original labels:

```bash
git revert "$ROUTING_SHA"
git push
```

## 3. Start the local runner

Persistent, detached (stays online for multiple jobs while `act` watches with `gh`):

```bash
node scripts/runner.cjs --owner <owner> --repo <repo> --token "$RUNNER_TOKEN" --work-dir tmp/act-runner --persistent --detach --pid-file tmp/act-runner.pid
```

Ephemeral (removes itself after one job, run in the foreground):

```bash
node scripts/runner.cjs --owner <owner> --repo <repo> --token "$RUNNER_TOKEN" --work-dir tmp/act-runner
```

The script prints the runner name and directory. With `--detach` it also writes
the runner process PID to the `--pid-file` so it can be stopped later.

## 4. Trigger the checks

After the runner is online, commit and push the routing change from step 2.
This creates a new workflow run that uses `runs-on: [self-hosted, ...]` and will
execute on the local runner. A failed run created before the runner was online is
pinned to the original `ubuntu-latest` workflow and cannot be retried reliably.

```bash
git add .github/workflows
git commit -m "wip: route workflows to self-hosted for /act runner"
# Save the printed commit SHA as ROUTING_SHA
git push
```

If the routing commit is already on the branch and the runner was offline during
the last push, an empty commit can be used (only with user approval):

```bash
git commit --allow-empty -m "chore: re-run checks on self-hosted runner"
git push
```

## 5. Watch the checks

```bash
# Block until all required checks on the PR complete
gh pr checks <pr> --repo <owner>/<repo> --watch --required --fail-fast
```

`gh pr checks --watch` blocks until every check on the PR's head SHA
finishes — across all workflow runs, not just one. After it exits,
re-run `pr-state.ts` to verify `SAST_FINDINGS_PENDING=0` as well.

If checks fail, fix the code and repeat from step 4. Do not stop the runner
while there are still jobs to run.

## 6. Clean up

For an ephemeral runner, `runner.cjs` removes the extracted directory when the
runner exits. For a detached runner, stop it with:

```bash
node scripts/cleanup-runner.cjs --owner <owner> --repo <repo> --work-dir tmp/act-runner --pid-file tmp/act-runner.pid
```

For a foreground runner, stop it with `Ctrl-C` and then run the same command
without `--pid-file`.

`cleanup-runner.cjs` deletes the runner registration on GitHub before deleting the
local directory, so the repo is not left with offline runners.

Finally, restore workflow labels by reverting the routing commit (step 2).

## Security notes

- Do not leave a runner registered in a public repo after the `/act` session ends.
- Do not run self-hosted runners on untrusted repositories; workflows can execute
  arbitrary code on the host.
- Never commit `RUNNER_TOKEN` or the runner configuration files.
