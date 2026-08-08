---
name: security-doctor
description: Orchestrate security scanners from reusable GitHub Actions templates. Run the same scanner workflows locally via act or fall back to the scanner CLI/container.
---

# security-doctor

Run SAST/SCA/security scanners against any repository without modifying the target project. `security-doctor` ships scanner definitions as GitHub Actions workflow templates so the same template works in local `act` runs and in CI.

## When to use

- A repository needs a quick CodeQL (or future SAST/SCA) scan without committing a workflow.
- You want a reusable, agent-agnostic scanner runner that works with or without GitHub Actions.
- You want the agent to pick the best execution backend (`act` vs local CLI vs Docker) automatically.

## Workflow

1. Locate or create `doctor.config.{ts,js,yaml,yml,json}` in the target repository.
2. Default to the `codeql` scanner with `languages: [javascript, typescript]` and `queries: security-extended`.
3. Run `doctor` from `tools/doctor/bin/doctor.js` (or `npx @theplenkov/doctor` when published).
4. `doctor` chooses the backend:
   - `auto` (default): try `gh act -W <template>`; if it fails or is unavailable, fall back to the scanner's local CLI.
   - `act`: force the `gh act` workflow run.
   - `local`: force the local scanner CLI.
5. After the scan, read `.doctor/doctor-report.md` for the execution checklist and findings summary.
6. Present the report to the user: scanner(s) used, backend, status, duration, generated SARIF files, and counts by rule/severity. Do not dump raw SARIF contents unless asked.

## Configuration example

```yaml
outputDir: .doctor
mode: auto
scanners:
  - name: codeql
    languages:
      - javascript
      - typescript
    queries: security-extended
    upload: never
```

## CodeQL runner

- `auto` mode first tries `gh act -W tools/doctor/templates/codeql.yml`.
  - The repo is bind-mounted (`--bind`) so SARIF files are written back to the host.
  - `CODEQL_ACTION_ANALYSIS_KEY` is set so `codeql-action` does not call the GitHub REST API for a workflow run ID.
  - `GITHUB_TOKEN` is passed as a secret when available.
- If `gh act` fails or is unavailable, `doctor` falls back to the local `codeql` CLI.
- If neither is available, it reports the exact install command needed.

## Report output

`doctor` writes `.doctor/doctor-report.md` after every scan. The report contains:

- **Scan checklist**: each configured scanner, backend (`act` or `local`), pass/fail status, duration, exact command summary, and generated `.sarif` files.
- **Findings summary**: total count, counts per rule, and counts per severity level.
- **Raw SARIF files list**: file names and sizes.

Use the report as the primary user-facing artifact. Keep the raw SARIF files for downstream tooling (`sarif-to-annotations`, GitHub Security tab, etc.).

## Extending

- Add new scanner templates to `tools/doctor/templates/<name>.yml`.
- Add a matching `ScannerDefinition` in `tools/doctor/src/scanners/<name>.ts` and export it from `tools/doctor/src/scanners/index.ts`.

## References

- `tools/doctor`
- `tools/doctor/templates/codeql.yml`
- `github/codeql-action`
