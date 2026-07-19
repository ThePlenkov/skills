---
description: Send skill feedback to the skill's upstream source repository
argument-hint: <skill-name>
skill: skill-feedback
---

Send feedback about a skill's instructions to its declared source repository using `/skill-feedback`.

**Required:** `<skill-name>` — which skill to file feedback about. The command resolves its target repo from that skill's `source:` frontmatter (fail-closed if missing; `--repo <owner>/<repo>` overrides; see skill body for full resolution rules).

**Optional flags** (documented in the skill body):
- `--repo <owner>/<repo>` — explicit target override when `source:` is missing
- `--pr` — file as a draft PR instead of an issue
- `--title <text>` — short title for the issue/PR

**Use for:** skill instructions that are wrong, ambiguous, missing, or dangerous · universal findings from `/retrospect` tied to a specific skill · recurring friction `/act` hits because a skill's instructions are incomplete.

**Do NOT use for:** product-code bugs (`/act`) · project-specific findings · vague complaints without evidence.

Apply the full `/skill-feedback` protocol from `.agents/skills/skill-feedback/SKILL.md`.