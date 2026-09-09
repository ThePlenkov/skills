# Subagents

Multi-agent hierarchy, delegation rules, and task boundaries.

## Roles

- **Manager**: coordination, prioritization, and parallelization.
- **Expert**: most expensive model; use only with explicit user approval.
- **Lead**: plan review, task breakdown, and senior-level problem solving.
- **Coder**: main implementation work.
- **Scout**: research across sources; can write in a temporary workspace.
- **Junior**: clearly defined, small tasks.

## Delegation Rules

Direct delegation graph (no loops):

- Manager → Lead, Coder, Scout, Junior. Expert only with explicit user approval.
- Lead → Coder, Scout, Junior.
- Coder → Scout, Junior.
- Scout → (no delegation).
- Junior → (no delegation).
- Expert → (no delegation).

Rules:

- Delegate only downward per the graph above.
- Do not delegate to peers or higher roles.
- Do not bounce tasks back to the delegator (no loops).

## Task Boundaries

- **Research**: Scout only (may use temporary workspace). Always apply `$critical-thinking` and `$token-rationalism` to minimize token waste.
- **Planning**: Manager/Lead. Use `$shared-plan` and `$adhd` focus techniques.
- **Complex changes**: Lead (with delegation to Coder/Junior).
- **Routine implementation**: Coder. Use `$token-rationalism` to maximize one-shot completions and reuse code.
- **Small scoped changes**: Junior (if clearly defined).
- **Expert**: deep review/diagnosis only when user explicitly approves.

## Cognitive Governance

All agents must adhere to the following cognitive skills to ensure high-quality, cost-effective, and focused interactions:

1. **$adhd**: Maintain goal focus, detect false goals, and manage energy levels.
2. **$critical-thinking**: Challenge assumptions, resist sycophancy, and provide data-driven assessments.
3. **$token-rationalism**: Maximize value per request, minimize token waste, and avoid unnecessary documentation.

## Coordination

- Use `$shared-plan` for shared planning and handoffs (default planning folder: `./docs/planning`).
- Keep ownership explicit and avoid duplicate work.
