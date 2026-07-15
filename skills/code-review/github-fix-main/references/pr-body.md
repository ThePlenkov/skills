# PR Body Template

Structure for `tmp/fix-main/pr-body.md` opened with `gh pr create --body-file`.

```markdown
## Summary

Restores main to green and clears outstanding security/quality findings.

### CI
- Fixed: <workflow> / <job> (run <link>)  — or "main is already green, no CI fix needed"

### Security (code-scanning)
- <rule-id>: <short what> — alert #<n>
- …

### Quality / AI findings
- <source>: <rule-id>/<key> — <short what>
- …

### Dismissals (if any)
- <rule-id>, alert #<n> — dismissed as false positive. Rationale: <why>.

## Test plan
- [x] `bunx nx affected -t build test lint typecheck` locally
- [x] Reproduced and fixed the red run locally
- [ ] CI on this PR is green
- [ ] CodeQL re-scan confirms fixed alerts are resolved
```

## Open-the-PR command

```bash
git push -u origin fix/main-health
gh pr create --base "$MAIN" --head fix/main-health \
  --title "fix(main): restore health of main (CI + security + quality)" \
  --body-file tmp/fix-main/pr-body.md
```

Capture the returned PR URL as `PR_URL` and its number as `PR`.
