# Feeding CI Failures Back to Agents

The power of CI with AI agents is the feedback loop. When CI fails, copy the
failure output back to the agent with the exact command and the failing
context, so it can reproduce and fix locally before pushing again.

## Loop

```
CI fails
    │
    ▼
Copy the failure output
    │
    ▼
Feed it to the agent:
"The CI pipeline failed with this error:
[paste specific error]
Fix the issue and verify locally before pushing again."
    │
    ▼
Agent fixes → pushes → CI runs again
```

## Patterns by Failure Type

| Failure | Agent action |
| --- | --- |
| Lint failure | `npm run lint --fix` and commit the auto-fix |
| Type error | Read the error location and fix the type |
| Test failure | Follow the $skill{debugging} skill, reproduce locally, fix |
| Build error | Check config and dependencies, look for the missing piece |
| E2E failure | Reproduce locally (Playwright run on the same spec), check for flakiness vs regression |
| Security audit | Triage with the $skill{security-and-hardening} skill — confirm reachability, then fix or document |

Always quote the **exact** error message back, **redacting any
secrets, tokens, connection strings, or PII first**; "CI is red" is
not actionable, but pasting the raw log can leak credentials to the
agent's provider, the PR comment thread, or both. A useful feedback
message is a one-liner with the file, the line, the failure, and the
remediation, with secrets replaced by placeholders like
`<REDACTED-TOKEN>` or stripped entirely.
