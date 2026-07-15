# Terminal States

Stop and report when any of these becomes true:

| State | Condition | Report |
|---|---|---|
| **Clean exit** | Nothing to fix after §2 | "main is already clean" + evidence |
| **Merged-ready** | PR green + APPROVED or all bots satisfied + 24h wait elapsed with no human verdict | "ready to merge" / "awaiting human" |
| **CI cap** | 3 push cycles in §7b without going green | "CI keeps failing, §6 CI-parity step is broken, handing back" + last log |
| **Combined cap** | 10 total push cycles across §7b + §7c | "too many iterations, handing back" |
| **Conflict** | PR cannot fast-forward onto `$MAIN` and rebase introduces non-trivial conflicts | Stop, do not force-push, hand back |
| **Explicit stop** | User sends any message during autopilot | Treat as interrupt: stop the current action, report state |

## Follow-up message template

At every terminal state, post a single summary message with:

- Final PR URL + `reviewDecision`.
- Final CI conclusion + link to last run.
- Counts: commits pushed, alerts resolved, threads replied / resolved, dismissals recorded.
- Outstanding items the user still owns (human approval, merge button, follow-up Sonar PR).

Reminders:

- CodeQL / AI alerts on the PR close only after the re-scan on the PR head completes; the alert list on the security tab may lag.
- Dismissed alerts (if any) remain dismissed on the repo even if the PR is closed — tracked in the PR body.
