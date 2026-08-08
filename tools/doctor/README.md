# @theplenkov/doctor

A reusable, agent-agnostic security scanner orchestrator.

`doctor` treats every scanner as a GitHub Actions workflow template. It first tries
to run the template locally with [`act`](https://github.com/nektos/act) via the
`gh act` extension. If `act` is unavailable or the workflow cannot run locally, it
falls back to the scanner's native CLI or container.

## Usage

```bash
# Run all configured scanners
tools/doctor/bin/doctor.js

# Run a specific scanner
tools/doctor/bin/doctor.js run codeql /path/to/repo

# Run a GitHub URL (auto-cloned to .doctor/repos/owner-repo)
tools/doctor/bin/doctor.js https://github.com/owner/repo

# Run only the GitHub API scanner group
tools/doctor/bin/doctor.js run github /path/to/repo

# List available scanners
tools/doctor/bin/doctor.js list

# Force local CLI mode
tools/doctor/bin/doctor.js --mode local
```

## Configuration

Create `doctor.config.ts`, `doctor.config.yaml`, `doctor.config.yml`, or `doctor.config.json`:

```yaml
outputDir: .doctor
mode: auto
scanners:
  - name: codeql
    enabled: true
    languages:
      - javascript
      - typescript
    queries: security-extended
    upload: never
```

## Scanners

- `codeql` — uses `github/codeql-action` as a reusable workflow template. `auto`
mode first runs the template locally via `gh act --bind`; if `act` is unavailable,
it falls back to the `codeql` CLI.
- `github` — a scanner group that is auto-expanded when the target repository is
hosted on GitHub. It runs GitHub API checks for branch CI status, code scanning
alerts, Dependabot alerts, secret scanning alerts, repository security advisories,
code quality findings (main/master only), and branch protection.

After the scan, `doctor` writes a Markdown report to `<outputDir>/doctor-report.md`
with a checklist of what ran and a findings summary. Raw SARIF and JSON output files
are kept in `<outputDir>` for downstream tools.

## Adding a scanner

1. Add a workflow template under `templates/<name>.yml`.
2. Add a `ScannerDefinition` in `src/scanners/<name>.ts`.
3. Export it from `src/scanners/index.ts`.
