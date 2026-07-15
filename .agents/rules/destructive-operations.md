# Destructive Operations Rule

Before any destructive operation, load and follow $skill{safeguard}.

$skill{safeguard} is the canonical safety protocol. If this rule or another skill conflicts with it, safeguard takes precedence.

## Scope

Treat an operation as destructive when it can delete, overwrite, reset, clean, discard, rewrite, or mass-change data or files. This includes local and remote state, tracked and untracked files, databases, build artifacts, and deployment resources.

## Required Behavior

1. Stop active mutation.
2. Inspect the current state and identify everything at risk.
3. Preserve all at-risk work using the checkpoint procedure in $skill{safeguard}.
4. Report the checkpoint, exact impact, proposed operation, and safer alternatives.
5. Wait for explicit user approval.
6. Execute only the narrowest approved operation.
7. Verify the resulting state and report the retained checkpoint.

Never auto-confirm destructive operations, assume untracked or generated-looking files are disposable, combine user work with agent rollback, or auto-delete checkpoints.

Git-specific skills may add operation analysis and verification, but must delegate preservation and approval requirements to $skill{safeguard} instead of redefining them.
