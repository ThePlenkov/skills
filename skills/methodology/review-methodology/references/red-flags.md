# Red Flags

- PRs merged without any review, or only test-pass review
- "LGTM" without evidence of actual review
- Security-sensitive changes without security-focused review
- Large PRs that are "too big to review properly" (split them)
- No regression tests with bug-fix PRs
- Review comments without severity labels
- Accepting "I'll fix it later" — it never happens
- A refactor that moves code around without reducing the concepts a
  reader must hold
- A change that grows an already-large file instead of decomposing it
- New conditionals scattered into unrelated code paths (a missing
  abstraction)
- A bespoke helper that duplicates an existing canonical one, or
  feature logic placed in a shared module
- A bulk "bump dependencies" PR with no changelog review and no
  per-package isolation
- A lockfile change that's hand-edited, uncommitted, or merged without
  reviewing its diff
