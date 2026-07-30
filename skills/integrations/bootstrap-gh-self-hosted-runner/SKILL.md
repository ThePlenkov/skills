---
name: bootstrap-gh-self-hosted-runner
description: Spin up an ephemeral or persistent self-hosted GitHub Actions runner to work around GitHub-hosted runner billing limits, re-run PR checks, and tear it down safely when done.
metadata:
  tier: 2
  triggers:
    - user
  allowed-tools:
    - read
    - exec
    - edit
    - write
  source: theplenkov-ai/skills
---

> **Repository placement:** This skill is kept under `skills/integrations/` as a
> GitHub platform connector. It is not a single external CLI/service skill that
> belongs in an upstream tool repository, so it does not fall under the
> external-tool-only path policy.

# Bootstrap a GitHub Actions self-hosted runner

## Overview

Use this skill when a repo or org has hit its GitHub-hosted runner spending
limit and you need a self-hosted runner to unblock CI. The runner can be
ephemeral (one job, then removed) or persistent. See `$skill{github}` for
`gh` authentication and token handling.

## When to use

- GitHub Actions shows a spending-limit / payment-failed error for hosted runners.
- You need to re-run PR checks that failed only because the hosted runner queue is blocked.
- You can run a runner on a machine you control (Linux, macOS, or Windows).

## Before you start

1. Authenticate `gh` with a token that has `repo` scope for private repos or
   `public_repo` for public repos. Registration-token generation also requires
   **Admin** permission on the repo or the **Admin: org** role if the runner is
   org-level.
2. Decide if the runner will be **ephemeral** (recommended) or persistent.
3. Confirm the host OS and architecture (`x64` or `arm64`).

## Workflow

### 1. Confirm Actions are enabled

The snippets in Steps 1–3 use POSIX shell syntax. On Windows, use Git Bash,
WSL, or the equivalent PowerShell assignment (`$env:VAR = gh ... --jq '.field'`).

```bash
gh api repos/<owner>/<repo>/actions/permissions --jq '.enabled'
```

For an org-level runner, check the self-hosted runner policy:

```bash
gh api orgs/<org>/actions/permissions/self-hosted-runners --jq '.enabled_repositories'
```

A value of `all` or `selected` means runners can be registered. If `selected`,
also verify the target repo is on the allow-list. `none` blocks registration.

### 2. Create a runner registration token

```bash
RUNNER_TOKEN=$(gh api repos/<owner>/<repo>/actions/runners/registration-token -X POST --jq '.token')
```

For an org-level runner:

```bash
RUNNER_TOKEN=$(gh api orgs/<org>/actions/runners/registration-token -X POST --jq '.token')
```

Treat `$RUNNER_TOKEN` as a secret. Do not write it to files or logs.

### 3. Resolve the latest runner release

```bash
RUNNER_TAG=$(gh api repos/actions/runner/releases/latest --jq '.tag_name')
```

### 4. Download the runner for your host OS

Set `RUNNER_OS` and `RUNNER_ARCH` from the host. Release archive names use
`linux`/`osx`/`win` and `x64`/`arm64`, and `RUNNER_VERSION` is the tag without
its leading `v`.

#### Linux or macOS

```bash
case "$(uname -s)" in
  Linux) RUNNER_OS=linux ;;
  Darwin) RUNNER_OS=osx ;;
esac
RUNNER_ARCH=$(uname -m)
case "$RUNNER_ARCH" in
  x86_64) RUNNER_ARCH=x64 ;;
  arm64|aarch64) RUNNER_ARCH=arm64 ;;
esac
RUNNER_VERSION=${RUNNER_TAG#v}

mkdir runner
cd runner
gh release download -R actions/runner "$RUNNER_TAG" --pattern "actions-runner-${RUNNER_OS}-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
gh release download -R actions/runner "$RUNNER_TAG" --pattern "actions-runner-${RUNNER_OS}-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz.sha256"
sha256sum -c "actions-runner-${RUNNER_OS}-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz.sha256"
tar xzf "actions-runner-${RUNNER_OS}-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
```

On macOS, if `sha256sum` is not available, use `shasum -a 256 -c`.

#### Windows

```powershell
$env:RUNNER_OS = "win"
$env:RUNNER_ARCH = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
$env:RUNNER_VERSION = $env:RUNNER_TAG.TrimStart("v")

New-Item -ItemType Directory -Path runner -Force
Set-Location runner
gh release download -R actions/runner $env:RUNNER_TAG --pattern "actions-runner-$env:RUNNER_OS-$env:RUNNER_ARCH-$env:RUNNER_VERSION.zip"
gh release download -R actions/runner $env:RUNNER_TAG --pattern "actions-runner-$env:RUNNER_OS-$env:RUNNER_ARCH-$env:RUNNER_VERSION.zip.sha256"

$archive = "actions-runner-$env:RUNNER_OS-$env:RUNNER_ARCH-$env:RUNNER_VERSION.zip"
$checksumFile = "$archive.sha256"
$expected = ((Get-Content $checksumFile -TotalCount 1).Split()[0]).ToLower()
$actual = (Get-FileHash -Algorithm SHA256 -Path $archive).Hash.ToLower()
if ($expected -ne $actual) { throw "SHA-256 mismatch for $archive" }

Expand-Archive -Path $archive -DestinationPath .
```

### 5. Configure the runner

The `--ephemeral` flag makes the runner pick one job, then unregister itself.
Use platform labels (`self-hosted,linux`, `self-hosted,macos`, or
`self-hosted,windows`) so workflows can target the runner explicitly. Adding
`ubuntu-latest` as a label is not officially supported and usually does not
route jobs to a self-hosted runner; the reliable fix is to edit the workflow
file (see Step 6). Do not use this trick in public repos with untrusted PRs.

#### Linux

```bash
./config.sh --url https://github.com/<owner>/<repo> --token "$RUNNER_TOKEN" --labels self-hosted,linux --ephemeral
```

#### macOS

```bash
./config.sh --url https://github.com/<owner>/<repo> --token "$RUNNER_TOKEN" --labels self-hosted,macos --ephemeral
```

#### Windows

```powershell
.\config.cmd --url https://github.com/<owner>/<repo> --token $env:RUNNER_TOKEN --labels self-hosted,windows --ephemeral
```

To leave the runner registered for many jobs, remove `--ephemeral`. If a runner
with the same name already exists, add `--replace` to the `config.sh` or
`config.cmd` command.

### 6. Update the workflow to target the self-hosted runner

If your runner was registered with `self-hosted,linux` (or another platform
label), change the job's `runs-on` value:

```yaml
jobs:
  build:
    runs-on: [self-hosted, linux, x64]
```

You can also use the default `self-hosted` label:

```yaml
jobs:
  build:
    runs-on: self-hosted
```

### 7. Start the runner

#### Foreground (best for quick one-off runs)

Linux / macOS:

```bash
./run.sh
```

Windows:

```powershell
.\run.cmd
```

The runner connects to GitHub and waits for a job. In ephemeral mode it exits
after one job.

#### Background / service mode (best for persistent runners)

Linux (systemd requires `sudo`):

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

macOS:

```bash
./svc.sh install
./svc.sh start
```

Windows:

```powershell
.\svc.cmd install
.\svc.cmd start
```

### 8. Re-run the PR checks

List recent runs for the branch:

```bash
gh run list --repo <owner>/<repo> --branch <branch> --limit 10
```

Re-run the most recent failed run:

```bash
gh run rerun <run-id> --repo <owner>/<repo> --failed
```

Watch it:

```bash
gh run watch <run-id> --repo <owner>/<repo>
```

### 9. Clean up

For an **ephemeral** runner, the GitHub registration is removed automatically
when the runner exits after one job. `--ephemeral` does **not** delete local
files, logs, or the `_work` directory. If you reuse the host, delete the
runner directory and any `_work`/`_diag` folders, or tear down the whole
machine/container. For a **persistent** runner, stop and remove it.

#### Linux / macOS

Generate a fresh **remove token** first — the original registration token
cannot be reused to unregister a persistent runner:

```bash
REMOVE_TOKEN=$(gh api repos/<owner>/<repo>/actions/runners/remove-token -X POST --jq '.token')
```

For an org-level runner:

```bash
REMOVE_TOKEN=$(gh api orgs/<org>/actions/runners/remove-token -X POST --jq '.token')
```

Then stop, uninstall, and remove the runner registration:

```bash
sudo ./svc.sh stop
sudo ./svc.sh uninstall
./config.sh remove --token "$REMOVE_TOKEN"
```

Delete the runner directory with your file tool or the host's file manager.

#### Windows

```powershell
$env:REMOVE_TOKEN = gh api repos/<owner>/<repo>/actions/runners/remove-token -X POST --jq '.token'
# For an org-level runner:
# $env:REMOVE_TOKEN = gh api orgs/<org>/actions/runners/remove-token -X POST --jq '.token'
.\svc.cmd stop
.\svc.cmd uninstall
.\config.cmd remove --token $env:REMOVE_TOKEN
```

Then remove the `runner` directory.

To remove the registration via the API instead, find the runner ID:

```bash
gh api repos/<owner>/<repo>/actions/runners --jq '.runners[] | select(.name == "<runner-name>") | .id'
```

Then delete it:

```bash
gh api repos/<owner>/<repo>/actions/runners/<runner-id> -X DELETE
```

## Security notes

- **Public repos:** Do not leave a self-hosted runner running in a public repo.
  Malicious PRs can run arbitrary code on your machine. `--ephemeral` only
  unregisters the runner after one job; it does not make untrusted public PRs
  safe. Use an isolated disposable environment or restrict self-hosted runners
  to trusted workflows.
- **Registration token:** This token is short-lived but sensitive. Never commit
  it, echo it, or pass it on a command line where it could be logged.
- **Untrusted workflows:** Do not use a self-hosted runner for workflows that
  run untrusted code without a sandbox.
- **Labels:** Adding `ubuntu-latest` to a self-hosted runner is a convenience
  workaround, not a security control. It can cause unexpected jobs to run on
  your machine.
- **Network:** The runner needs outbound HTTPS to `github.com` and
  `api.github.com` and whatever package registries or services your workflows
  require.
