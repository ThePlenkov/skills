# Secrets Management

```
.env files:
  ├── .env.example    → Committed (template with placeholder values)
  ├── .env            → NOT committed (contains real secrets)
  ├── .env.local      → NOT committed (local overrides)
  ├── .env.*          → NOT committed (covers .env.production,
  │                     .env.staging, .env.development, ...)
  └── .env.*.local    → NOT committed (local overrides per env)

.gitignore must include:
  .env
  .env.*
  !.env.example
  .env.*.local
  *.pem
  *.key
```

The `.env.*` rule with an explicit `!.env.example` exception keeps
the template committable while protecting every other environment
file (`.env.production`, `.env.staging`, etc.) — those used to slip
through because the legacy rule only covered the exact `.env` and
`*.local` variants.

## Always Check Before Committing

The `git diff --cached -G "<keywords>"` one-liner is a *first-pass
heuristic*, not a real secret scanner. It is case-sensitive, only
catches the four keywords in the pattern, and only sees lines
GitHub will add to the diff (not all of them). For anything
beyond a casual sanity check, run a purpose-built scanner
(`gitleaks`, `trufflehog`, `detect-secrets`) — these check for the
hundreds of well-known secret formats and look at the full
content, not just the diff.

```bash
# First-pass heuristic: catch the obvious keywords. False-negative
# rate is high; this only exists to catch the "I pasted a token
# into a comment" mistake, not as a primary defence.
git diff --cached -Gi "password|secret|api_key|api-key|apikey|token|private[_-]?key|aws[_-]?access"
```

**If a secret is ever committed, rotate it.** Deleting the line or
rewriting history is not enough — assume it's compromised the moment it
reaches a remote. Revoke and reissue the key first, then purge it from
history.
