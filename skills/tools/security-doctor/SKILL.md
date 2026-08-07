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
   - `auto` (default): try `gh act -W <template>`; if it fails or is unavailable, fall back to the scanner's local CLI or container.
   - `act`: force the `gh act` workflow run.
   - `local`: force the local scanner CLI/container run.
5. Collect SARIF results from `outputDir` (default `.doctor`).

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

## Extending

- Add new scanner templates to `tools/doctor/templates/<name>.yml`.
- Add a matching `ScannerDefinition` in `tools/doctor/src/scanners/<name>.ts` and export it from `tools/doctor/src/scanners/index.ts`.

## References

- `tools/doctor`
- `tools/doctor/templates/codeql.yml`
- `github/codeql-action`
