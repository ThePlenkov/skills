---
name: skill-feedback
description: >-
  Use when the user invokes /skill-feedback on a skill, or after /retrospect
  identifies a universal finding tied to a specific skill's instructions.
  Reads the `source:` field from that skill's SKILL.md frontmatter and files
  a structured GitHub issue (or draft PR with --pr) at the source repo it
  declares (fail-closed if `source:` is missing; `--repo` overrides).
  Idempotent (checks for open skill-feedback issues first), severity-labelled,
  pairs with /retrospect and /act.
tier: 2
triggers: [user]
source: theplenkov-ai/skills
compatibility: Requires gh (authenticated), jq. Network access to api.github.com.
disable-model-invocation: true
argument-hint: "<skill-name>"
---

# /skill-feedback

`/skill-feedback` delivers a finding to the **source repository** of a skill so the skill itself can be improved upstream — not the project that triggered it.

A finding that belongs upstream is one where the **skill instructions** are wrong, ambiguous, missing, or dangerous. Findings about product code belong in `/act`, not `/skill-feedback`. When in doubt, run `/retrospect` first; it decides scope.

The name `/feedback` is reserved by agent runtimes for end-user conversational feedback, so this skill is exposed as `/skill-feedback`. Plain `/feedback` would shadow that built-in.

## When to use

- The user explicitly invokes `/skill-feedback` after a session.
- `/retrospect` identified a finding whose fix would help every user of the skill, not just the current project.
- `/act` repeatedly hits the same friction that stems from a skill instruction gap.
- The agent notices that a skill's behaviour contradicts its own description or `AGENTS.md`.

Do **not** use for:
- Product-code bugs (use `/act` or normal issue trackers of the current repo).
- Findings specific to one project (capture them in `.memory/facts/` or project docs).
- Vague complaints without evidence.

## How to find the source

Each skill declares its source in its SKILL.md frontmatter:

```yaml
source: theplenkov-ai/skills
```

Resolution order:

1. **Argument**: `/skill-feedback <skill-name>` — look up `skills/**/<skill-name>/SKILL.md`, read its `source:` field.
2. **Skill in context**: if invoked from inside another skill's workflow (e.g. `/act` reaches a meta-finding), use the skill that owns the current loop.
3. **Override**: `--repo <owner>/<repo>` (forces a specific target repo regardless of `source:` — useful for testing against a fork before upstreaming).

**Fail-closed if `source:` is missing.** A missing `source:` field is a misconfiguration of the affected skill, not an excuse to misfile. When `source:` is absent and `--repo` is not supplied, `/skill-feedback` MUST stop and emit:

```
ERROR: skill '<name>' has no `source:` field in its SKILL.md frontmatter
(see AGENTS.md § Skill source metadata).
Either:
  - add `source: <owner>/<repo>` to the skill's SKILL.md (preferred), or
  - re-run with `--repo <owner>/<repo>` to file against a specific repo.
```

Defaulting to a hard-coded repo on missing `source:` is **not** acceptable — feedback for a misconfigured skill would silently land on the wrong repo and miss its maintainer. `theplenkov-ai/skills` (the canonical host for skills that live in this repo) is targeted only when a skill explicitly declares `source: theplenkov-ai/skills`.

Path inside the source repo is derived from the on-disk location (`skills/<category>/<skill-name>/`) — do not encode it in `source:`.

## Issue body — minimal contract

`/skill-feedback` posts a GitHub issue on `source:` with this structure:

```markdown
## Skill
- **name**: <skill-name>
- **path**: skills/<category>/<skill-name>/SKILL.md
- **source**: <owner/repo>

## Finding
<one paragraph: what is wrong / missing / dangerous in the skill instructions>

## Evidence
- **Repro**: <command or step that triggered the finding>
- **Expected** (per current SKILL.md): <what the skill promises>
- **Actual**: <what happened>
- **Agent context**: <model id, session id, project where observed — best-effort>

## Suggested fix
<concrete edit, or "open to maintainer" if unsure>

## Severity
<`blocks-workflow` | `friction` | `nit`>

---
Filed by `/skill-feedback` from <agent-id> on <iso-date>.
```

## Commands

```bash
# Resolve the target repo for a skill: read the `source:` field from the
# skill's SKILL.md frontmatter (use your file/read tools), then verify it:
gh repo view "<source-from-frontmatter>" --json nameWithOwner --jq .nameWithOwner

# Post the issue
gh issue create \
  --repo "$REPO" \
  --label "skill-feedback" \
  --label "<severity>" \
  --title "<short title>" \
  --body-file tmp/agent_<pid>/feedback-body.md

# Or, when --pr is passed, open a draft PR against the skill's own `source:`
# repo (`$REPO`, resolved above) instead.
# Requires the agent to be on a branch with the fix already applied locally
# and the remote to allow pushes (fork-first — see $skill{shadow-fork}).
```

Pre-create the scratch dir under the repo (`tmp/agent_<pid>/`, gitignored) — not system `/tmp` in cloud agents. `body-file` resolves paths relative to the current working directory, so repo-relative is the portable choice across local and cloud runtimes.

## Severity labels

| Label | Meaning |
|-------|---------|
| `blocks-workflow` | The skill fails its primary job or causes the agent to do the wrong thing. Fix soon. |
| `friction` | The skill works but its instructions cause extra rounds / confusion. |
| `nit` | Typos, wording, examples. Non-urgent. |

Maintainers may merge labels with existing ones in the target repo (`bug`, `documentation`, etc.). Add labels; do not replace.

## What this skill does NOT do

- Does **not** modify the skill in-place — it files the finding and stops. Edits belong to the maintainer of the source repo.
- Does **not** post to the current project's repo. `/skill-feedback` always targets the skill's source.
- Does **not** dedupe across sessions — that is the maintainer's job. Use `gh issue list --label skill-feedback --state open` to check before posting.

## Pairing with /retrospect

`/retrospect` decides *scope* (universal vs project vs agent vs session). For findings it classifies as **universal** AND that point at a specific skill's instructions, it should hand off to `/skill-feedback` rather than edit the skill file directly in the consuming repo. This keeps skill improvements flowing back to the canonical source instead of forking.

## Pairing with /act

`/act` may surface findings like "the loop ran 5 times because the SAST skill was missing the codacy-cli installation step". That is a feedback item for the SAST skill, not a /act thread. Capture it and call `/skill-feedback codacy` (or the relevant skill name) before closing the /act session.

## Idempotency

Before posting, search for an open issue with the same finding on the source repo:

```bash
gh issue list --repo "$REPO" --label skill-feedback --state open \
  --search "<short finding keyword>" --json number,title,url
```

If a matching open issue exists, link it from the agent's report instead of creating a duplicate.