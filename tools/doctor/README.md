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

- `codeql` — uses `github/codeql-action` as the workflow template and falls back
to the `codeql` CLI or the `mcr.microsoft.com/cstsectools/codeql-container`
Docker image.

## Adding a scanner

1. Add a workflow template under `templates/<name>.yml`.
2. Add a `ScannerDefinition` in `src/scanners/<name>.ts`.
3. Export it from `src/scanners/index.ts`.
