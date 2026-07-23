---
name: handoff
description: >-
  Compact the current conversation into a handoff document so a fresh agent
  session can continue the work. Use when a thread is full, when the work
  needs to span a context-window boundary, or when branching into a parallel
  session (e.g. a prototype session). Distinct from $skill{save-session}
  (durable cross-work preservation) and the built-in /compact (same
  conversation).
disable-model-invocation: true
tier: 2
triggers: [user]
argument-hint: <what the next session will be used for>
source: theplenkov-ai/skills
metadata:
  upstream: mattpocock/skills
  upstream_path: skills/productivity/handoff/
  note: Adapted from mattpocock/skills.
---

<!--
Upstream: mattpocock/skills @ skills/productivity/handoff
Adapted for theplenkov-ai/skills conventions. Path resolution swapped from
"$TMPDIR / /tmp / %TEMP%" to a portable "OS temp directory" instruction so
the rule works on Linux, macOS, and Windows.
-->

# Handoff

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS — not the current workspace.

On Linux/macOS resolve via `$TMPDIR` (falling back to `/tmp`). On Windows use `%TEMP%`. The handoff file is **not** committed to the repo; it lives outside the working tree on purpose so a fresh session in a new checkout can still find it.

**Scope.** The handoff targets a fresh session on the **same machine and user account** as the writing session. A handoff written to `/tmp/abc/...` is not available to a session on a different machine or a different user; if cross-machine continuation is required, copy the file to a shared artifact store (S3, an internal file share, etc.) and pass a reference, not an absolute temp path, to the next session.

**Naming rule.** Use a unique, sortable filename so the next session can list and pick a handoff without ambiguity. The recommended pattern is `handoff-<YYYY-MM-DD-HHMMSS>-<short-topic-slug>-<collision-suffix>.md` (e.g. `handoff-2026-07-23-143012-import-mattpocock-skills-7f3a.md`); substitute `<short-topic-slug>` with a **kebab-case, length-limited, allowlisted** topic phrase (see Sanitisation below), use the current local timestamp with **second precision** (do not infer from memory), and append a short collision-resistant suffix (a 4-hex-char digest of the timestamp + topic plus a 4-hex-char random nonce is enough — see the retry note below) so two sessions writing in the same second do not collide. Create the file with **exclusive-create** semantics (`O_CREAT|O_EXCL`, or `open(path, 'x')` in Python) and on collision **retry with a freshly drawn random nonce** in the suffix (not the same digest) before reporting failure — a fixed digest would deterministically collide again, so each retry must pull from a fresh source of entropy (e.g. `os.urandom(2).hex()` in Python, `crypto.randomBytes(2).toString('hex')` in Node). Bound the retry to a small number (3 attempts) so a pathological collision does not loop. After creating the file, set its permissions to **`0600` (owner read/write only)** — `O_EXCL` prevents overwrite races but does not enforce confidentiality, and the caller's umask is not under the writer's control on shared hosts. The session that **writes** the handoff must **report its absolute path** back to the user (in the same response) so the user can pass it to the next session by reference rather than searching the temp directory.

**Sanitisation.** The topic slug becomes part of a path the user sees in chat, in logs, and in shell history. Build it from an **allowlist** of `[a-z0-9-]`, length-limit it (32 chars is plenty), and **never** substitute raw user input, URL components, or branch names into the slug without scrubbing. A reasonable default is to derive the slug from a short summary the user already typed, then fall back to `untitled` if the sanitised form is empty. **Do not** rely solely on the document-content redaction step below — the filename can leak secrets even when the body is redacted.

Include a "suggested skills" section in the document, which suggests skills the next agent should reach for given the work's shape.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information — API keys, passwords, personally identifiable information, internal hostnames.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

## Why a separate file (not in-repo)

- A fresh session may run in a different checkout (or on a different machine) than the current one. A path inside the workspace is brittle; a path in the OS temp dir is portable.
- The handoff is **throwaway by nature** — once the next session is up to speed, the file has done its job. Keeping it out of the repo prevents accidental commits of working notes.
- This is the inverse of $skill{save-session}, which is durable cross-work preservation and lives inside the workspace.

## Anatomy of a good handoff

A handoff that the next agent can pick up cold usually has:

1. **One-paragraph summary** — what we were doing, where we stopped, what the open question is.
2. **State of the world** — files changed, branches in flight, worktrees open, CI status, open PRs.
3. **Decisions made** — with a one-line rationale each. Link to ADRs / specs / issues when they exist; never restate their content.
4. **Open questions / next actions** — what the next session should do first.
5. **Suggested skills** — short list of skills the next session should consult (e.g. `$shared-plan` if work spans agents, `$evidence` if a claim must be proven, `$skill{code-review-and-quality}` before a merge).
6. **Constraints** — secrets locations (redacted), tool versions, environment quirks the next session will trip over otherwise.

## Related skills

- $skill{save-session} — durable cross-work preservation; lives inside the workspace, not in OS temp.
- $skill{shared-plan} — when the next session is one of many agents continuing a long plan.
- $skill{unwind} — collapse a solved subtask into the parent plan instead of forking a new session.
