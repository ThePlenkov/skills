# Triaging Dependency Audit Results

Package-manager audits report known advisories; they do not prove a
package is trustworthy or that vulnerable code is reachable. Use this
decision tree:

```
The native package-manager audit reports a vulnerability
├── Severity: critical or high
│   ├── Is the vulnerable code reachable in runtime, build, test, install, or deployment paths?
│   │   ├── YES --> Fix immediately (update, patch, or replace the dependency)
│   │   └── NO (confirmed unused across those paths) --> Fix soon, but not a blocker
│   └── Is a fix available?
│       ├── YES --> Update to the patched version
│       └── NO --> Check for workarounds, consider replacing the dependency, or add to allowlist with a review date
├── Severity: moderate
│   ├── Reachable in production? --> Fix in the next release cycle
│   └── Dev-only? --> Fix when convenient, track in backlog
└── Severity: low
    └── Track and fix during regular dependency updates
```

## Key Questions

- Is the vulnerable function actually called in your code path,
  including from install/lifecycle scripts (`preinstall`,
  `install`, `postinstall`) and CI steps that run those scripts?
- Is the dependency a runtime dependency or dev-only?
- Is the vulnerability exploitable given your deployment context
  (e.g., a server-side vulnerability in a client-only app)?

When you defer a fix, document the reason and set a review date.

## Supply-Chain Hygiene

Do not assume npm or treat the nearest manifest as the install root.
Apply this order:

1. **Find the installation boundary and manager.** Use the workspace
   root that owns the lockfile, or an independent nested project only
   when it is outside that workspace. There, corroborate `packageManager`
   (when present), the lockfile, and CI; stop on disagreement or
   competing lockfiles. Pin the manager version and use the matrix in
   `references/security-checklist.md`.
2. **Block dependency scripts before first execution.** Bootstrap with
   scripts disabled or a documented fail-closed policy, inspect the
   pending script source, approve only the minimum required packages,
   commit the policy, then verify with a clean frozen/immutable
   install. Never blanket-approve scripts.

Audits only find known advisories; they do not catch a newly malicious
or typosquatted package. Therefore:

- **Never apply forced audit remediation automatically**
  (`npm audit fix --force` or equivalent). Preview the remediation,
  read changelogs, and test each resulting upgrade; forced fixes may
  cross declared dependency ranges.
- **Verify registry signatures and provenance where supported**
  (`npm audit signatures`, `pnpm audit signatures`) and treat absence
  as a signal to investigate, not automatic proof of compromise.
- **Review new dependencies, lockfile diffs, and script-policy changes
  together** — ownership, maintenance, release age, provenance,
  transitive graph, and typosquats such as `cross-env` vs `crossenv`
  (OWASP **A06**, **LLM03**).
