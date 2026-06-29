---
name: npm-publish
description: Publish npm packages using granular access tokens or trusted publishers (OIDC). Use when publishing packages, setting up CI/CD publishing, or managing npm authentication. Includes /npm-publish prepare-ci to bootstrap CI publishing for new packages.
---

# npm-publish

Guides the full npm publishing lifecycle: authentication, token management, CI/CD setup, and trusted publisher configuration.

## Requirements

- npm CLI v11.5.1+ for trusted publishing (`npm install -g npm@^11.10.0` for `npm trust` commands)
- Node.js v22.14.0+ for trusted publishing
- 2FA enabled on your npm account to use `npm trust`

## Authentication

As of November 2025, **only granular access tokens are supported**. Legacy (classic) tokens have been removed.

### Interactive login

```sh
npm login
```

If your org uses SSO, this will prompt with an SSO URL to complete in the browser.

### Create a granular token for automation

```sh
npm token create \
  --name "ci-publish-<repo>" \
  --packages <package-name> \
  --packages-and-scopes-permission read-write \
  --expires 30
```

Key flags:

- `--packages` / `--scopes` — limit token to specific packages or scopes (up to 50 each)
- `--packages-and-scopes-permission` — `read-only`, `read-write`, or `no-access`
- `--expires` — days until expiration (minimum 1 day); use the shortest viable duration
- `--bypass-2fa` — allow CI to skip 2FA; use only when required and account-level 2FA is enforced

Prefer short-lived, scoped tokens. Never share tokens or commit them to source control. Store as a CI/CD secret.

## Trusted Publishing (preferred for CI/CD)

Trusted publishing uses OIDC — no long-lived tokens needed. Supported providers: **GitHub Actions**, **GitLab CI/CD**, **CircleCI** (cloud only; self-hosted runners not yet supported).

### Constraint: package must exist on the registry first

`npm trust` requires the package to already exist on npmjs.com. For new packages not yet published, run `/npm-publish prepare-ci` (see below).

### Configure trust for an existing package

```sh
# GitHub Actions
npm trust github [package] --file publish.yml --repo owner/repo

# GitLab CI/CD
npm trust gitlab [package] --file .gitlab-ci.yml --namespace mygroup --project myproject

# CircleCI
npm trust circleci [package] --org-id <uuid> --project-id <uuid> --pipeline-id <uuid> --vcs-origin github.com/org/repo
```

Use `npm trust <provider> --help` to see all available flags for a provider.

### Revoke and replace a trust configuration

```sh
npm trust list [package]                    # get the trust ID
npm trust revoke --id <id> [package]        # remove it
npm trust github [package] --file ...       # re-add with new config
```

### CI workflow configuration

**GitHub Actions** — add `id-token: write` permission:

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build --if-present
      - run: npm test
      - run: npm publish
```

Provenance attestations are generated automatically when publishing from a public repo via GitHub Actions or GitLab CI/CD. No `--provenance` flag needed.

**GitLab CI/CD** — configure `id_tokens`:

```yaml
publish:
  id_tokens:
    NPM_ID_TOKEN:
      aud: "npm:registry.npmjs.org"
    SIGSTORE_ID_TOKEN:
      aud: sigstore
  script:
    - npm ci
    - npm publish
  only:
    - tags
```

## Security hardening (after trusted publishing is working)

1. Go to npmjs.com → your package → Settings → Publishing access
2. Select **"Require two-factor authentication and disallow tokens"**
3. Revoke any existing automation tokens that are no longer needed

---

## /npm-publish prepare-ci

> ⚠️ **This command does NOT publish your real package.** It only publishes an empty `0.0.0` placeholder on npm solely to satisfy the registry requirement that a package must exist before trusted publishing can be configured. Your actual code is never touched. The real release happens later from CI/CD.

Bootstraps CI/CD publishing for packages that don't yet exist on the registry. Use this when you have publishable packages in a monorepo or project that have never been published but need trusted publishing set up.

### When to use

- Monorepo or project with one or more `package.json` files marked as publishable (no `"private": true`)
- Packages don't exist on npmjs.com yet (can't set up `npm trust` without them)
- You want to publish from CI/CD using trusted publishing from day one

### Workflow

1. **Login**

   ```sh
   npm login
   ```

   Complete any SSO or 2FA prompts.

2. **Detect CI/CD provider from git remote**

   ```sh
   git remote -v
   ```

   - `github.com` → GitHub Actions
   - `gitlab.com` → GitLab CI/CD
   - Otherwise → ask user to confirm provider

3. **Find publishable packages**
   Search for all `package.json` files in the project. For each:
   - Skip if `"private": true`
   - Check if already published: `npm view <name> version` (non-zero exit = not published)

4. **Publish a minimal placeholder for each unpublished package**

   For each unpublished package name, create and publish a zero-version placeholder:

   ```sh
   # In a temp directory:
   mkdir -p /tmp/npm-placeholder/<package-name>
   cd /tmp/npm-placeholder/<package-name>

   cat > package.json <<EOF
   {
     "name": "<package-name>",
     "version": "0.0.0",
     "description": "Placeholder — real package published via CI/CD",
     "readme": "README.md"
   }
   EOF

   cat > README.md <<EOF
   # <package-name>

   This is a placeholder package. The real release is published via CI/CD.
   EOF

   npm publish
   ```

   > This dummy publish is required solely so `npm trust` can link the package. The real `0.1.0` / `1.0.0` release will come from CI.

5. **Set up trusted publisher for each package**

   For each package just published (and any existing publishable packages that lack trust):

   ```sh
   # GitHub Actions example
   npm trust github <package-name> \
     --file publish.yml \
     --repo <owner>/<repo>
   ```

   Parse `owner/repo` from `git remote get-url origin`.

   For bulk configuration, add `--yes` and insert a 2-second sleep between calls to stay within the 5-minute 2FA skip window:

   ```sh
   sleep 2 && npm trust github <package-name> --file publish.yml --repo owner/repo --yes
   ```

6. **Generate CI workflow** (if not present)

   Create `.github/workflows/publish.yml` (or equivalent for the detected provider) using the template from the **CI workflow configuration** section above. Trigger on pushed tags (`v*`).

7. **Report results**

   After all packages are configured, summarize:
   - Packages registered as **empty placeholders** on npm (0.0.0 only — no real code)
   - Trusted publisher links created
   - Workflow file created or updated
   - **Remind the user:** no real code has been published. The first real release happens when they push a tag to trigger CI.

### Script

Run the preparation automatically using the bundled script:

```sh
node .agents/skills/npm-publish/scripts/prepare-ci.mjs
```

The script detects the CI provider, finds unpublished packages, publishes placeholders, configures trust, and generates the workflow file.

### Notes

- The placeholder 0.0.0 publish will be the only version until CI runs. Users installing the package before a real release will get the empty placeholder.
- If a package already exists on the registry, skip step 4 for that package and proceed directly to `npm trust`.
- If trust is already configured for a package, skip it unless the user asks to reconfigure.
- Each package can have only one trusted publisher at a time. Use `npm trust list` to inspect existing config.
