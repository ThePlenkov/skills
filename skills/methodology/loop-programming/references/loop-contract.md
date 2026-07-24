# Loop Contract — Full Schema and Defaults

The body of the skill summarises when to use a loop and how to drive
it. This file is the canonical loop contract: the YAML schema, the
defaults, and the rules for inferring missing values.

## Loop Contract Schema

```yaml
goal: Concrete outcome to achieve.
success_criteria:
  - Machine-checkable validator or required artifact.
scope:
  include:
    - Files or directories that may be changed.
  exclude:
    - Files or directories that must not be changed.
validators:
  - command: Command used to validate the work.
    required: true
limits:
  max_iterations: Positive integer.
  timeout_seconds: Positive integer when runtime enforcement exists.
  stagnation_limit: Positive integer.
  budget: Optional runtime-specific limit.
```

## Defaults

When the user does not specify limits, use:

```yaml
limits:
  max_iterations: 12
  timeout_seconds: 600
  stagnation_limit: 3
```

For broad repository refactors, increase `max_iterations` to no more
than 30 unless the user explicitly requests another limit.

## Inference Rules

- **Infer minor missing values conservatively.** If the user says
  "fix the failing tests" you do not need to ask which package
  manager to use if `package.json` is present; pick the one the
  repo already uses.
- **Do not block on missing optional fields.** Only `goal`,
  `success_criteria`, `validators`, and `limits.max_iterations` are
  non-negotiable; everything else can be inferred or defaulted.
- **Ask only for material ambiguity.** The goal, the required
  output, or the permission boundary must be ambiguous in a way
  that changes the answer. Anything else is over-asking.
