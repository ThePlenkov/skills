# Structural Remedies

When you flag a structural problem, propose the move — not just the
problem. A review that only says "this is complex" leaves the author
guessing. Reach for a named restructuring:

- **Replace a chain of conditionals** with a typed model or dispatcher.
- **Collapse duplicate branches** into a single clearer flow.
- **Separate orchestration from business logic** so each reads alone.
- **Move feature-specific logic** out of a shared module into the
  package that owns the concept.
- **Reuse the canonical helper** instead of a bespoke near-duplicate.
- **Make a type boundary explicit** so downstream branching disappears.
- **Delete a pass-through wrapper** that adds indirection without
  clarifying the API.
- **Extract a helper, or split a large file** into focused modules.

Prefer the remedy that removes moving pieces over one that spreads the
same complexity around.
