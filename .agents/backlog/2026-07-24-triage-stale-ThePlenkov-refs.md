---
date: 2026-07-24
tags: [follow-up, theplenkov-ai, README, SECURITY, install-commands]
source: .memory/experience/2026-07-24-act-p5-p6-skip-cycle-misread.md
related: "PR #149, PR #148"
---

## Problem

The follow-up PR (`chore/standardize-source-on-theplenkov-ai`)
standardized the 80 SKILL.md `source:` fields + AGENTS.md
convention + `.agents/plugins/marketplace.json` git URL to
`theplenkov-ai/skills`. It did **not** touch user-facing references
that still say `ThePlenkov/skills`:

1. **`README.md`** — install commands for external users:
   - line 76: `npx skills add ThePlenkov/skills --all`
   - line 82: `npx skills add ThePlenkov/skills -a claude-code`
   - line 83: `npx skills add ThePlenkov/skills -a windsurf`
   - line 91: `npx skills add ThePlenkov/skills --skill behavior`
   - line 92: `npx skills add ThePlenkov/skills --skill methodology --skill orchestration`
   - line ~110 (also has Claude Code plugin install):
     `/plugin marketplace add ThePlenkov/skills`
   - line 92 also has a stale typo: `npx github:theplenkov/skills`
     (no `-ai` suffix; neither current repo matches — likely a
     typo from when the maintainer was iterating on the repo name).

2. **`CLAUDE.md`** line 34 — same `npx skills add ThePlenkov/skills
   --all` reference in the consumer-facing warning ("Use this only
   when consuming from outside").

3. **`SECURITY.md`** line 17 — security advisory URL:
   `https://github.com/ThePlenkov/skills/security/advisories/new`.

4. **`AGENTS.md`** line 91 — maintainer command:
   `gh run download -R ThePlenkov/skills -n skills-index`.

5. **Skill-body `npx skills add ThePlenkov/skills` install examples** —
   user-facing install commands embedded in skill docs (same
   category as the README commands, same deferral rationale):
   - `skills/tools/skills-cli/SKILL.md` (lines 17, 20, 23, 26, 29, 79, 82)
   - `skills/agents/claude-skills/SKILL.md` (lines 17, 20, 26, 32)
   - `skills/agents/dotagents/SKILL.md` (line 39) and
     `skills/agents/dotagents/workflows/{install,sync}.md`

**Already fixed in PR #149** (routing correctness, not deferred):
the `source:` frontmatter generator in
`skills/tools/skillmaker/scripts/skill-scaffold.sh`, the
`$skill{skill-feedback}` body defaults / `--pr` target, and the
`$skill{act}` upstream-feedback pointer were all repointed to
`theplenkov-ai/skills` in that PR, so the scaffold no longer emits
non-canonical `source:` frontmatter.

## Why deferred from PR #149

Each of these is a different decision (public install command vs
security routing vs maintainer-only artifact retrieval) and has
different blast radius. The PR scope was "the `source:` field used
by `$skill{skill-feedback}`" — narrow and unambiguous. Changing the
public install command is a user-visible change (existing users
have cached npx runs pointed at the old path); changing the
security URL changes where security findings land; changing the
maintainer-only `gh run download` command has no external impact
but is the easiest follow-up.

## Proposed action

Triage each item in its own commit / PR. Suggested order:

1. **AGENTS.md line 91** (`gh run download` command) — safe, no
   external impact, do in a 1-line PR.
2. **CLAUDE.md line 34** (consumer-facing warning) — also safe,
   internal doc, no external impact. Same PR as #1.
3. **SECURITY.md line 17** (advisory URL) — affects where
   maintainer receives security reports. Confirm with maintainer
   first; if the canonical repo is where they want to triage, just
   point it there.
4. **README.md install commands + Claude Code plugin marketplace
   name** — most user-visible. Consider a deprecation path
   (keep `ThePlenkov/skills` as an alias that prints a notice
   pointing at the canonical) or just swap and accept the
   disruption.

## Acceptance criteria

- [ ] Each item either gets a follow-up commit, or is explicitly
      marked "leave as-is" with a reason.
- [ ] By end of 2026-Q3, no `ThePlenkov/skills` references remain in
      user-facing files (`README.md`, `CLAUDE.md`, `SECURITY.md`, and
      the skill-body install examples above) unless explicitly marked
      "leave as-is" with a reason.
- [ ] `AGENTS.md` line 91 maintainer command updated to
      `theplenkov-ai/skills` (or the dual-repo setup is documented
      so the maintainer knows both URLs work).
