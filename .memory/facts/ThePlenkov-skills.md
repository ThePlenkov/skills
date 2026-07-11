# Facts about ThePlenkov/skills repo

- **`.agents/skills/`** is the home of all skills in this repo.
  Layout: `<skill-name>/SKILL.md` (skill content) plus optional
  `scripts/`, `references/`, `assets/`.
- **`actions/skillspector/`** is a self-contained composite GitHub
  Action that brings its own Nx + a `createNodes` plugin
  (`actions/skillspector/nx-skillspector/`). It scans every skill
  via `skillspector scan` and emits GitHub workflow-command
  annotations + SARIF.
- **`workflows/` are gated by `fail-on-error: true`** on
  `skill-scan.yml`. Real HIGH/CRITICAL findings in skill content
  fail the check. This is informational, not a merge blocker
  (every merged PR #9-#12 had `scan: FAILURE`).
- **Skill-scan cache** keys on
  `actions/skillspector/package-lock.json` +
  `.agents/skills/**/SKILL.md` hashes. Restored into `.nx/cache`.
- **Reviewers used on this repo**: cubic-dev-ai, gemini-code-assist,
  amazon-q-developer, kilo-code-bot, coderabbitai (rate-limited),
  qodo-code-review (paused).