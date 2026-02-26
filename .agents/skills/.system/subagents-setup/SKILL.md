---
name: subagents-setup
description: Describes the multi-agent hierarchy, delegation rules, and task boundaries. Use when coordinating subagents, assigning work, clarifying ownership, or deciding who should handle a task.
---

# Subagents Setup

## Overview
This skill documents the role hierarchy, delegation paths, and task boundaries for the subagents setup.

## Roles and Responsibilities

- **Manager**: coordination, prioritization, and parallelization.
- **Expert**: most expensive model; use only with explicit user approval.
- **Lead**: plan review, task breakdown, and senior-level problem solving.
- **Coder**: main implementation work.
- **Scout**: research across sources; can write in a temporary workspace.
- **Junior**: clearly defined, small tasks.

## Delegation Rules

Direct delegation graph (no loops):
- Manager -> Lead, Coder, Scout, Junior. Expert only with explicit user approval.
- Lead -> Coder, Scout, Junior.
- Coder -> Scout, Junior.
- Scout -> (no delegation).
- Junior -> (no delegation).
- Expert -> (no delegation).

Rules:
- Delegate only downward per the graph above.
- Do not delegate to peers or higher roles.
- Do not bounce tasks back to the delegator (no loops).

## Task Boundaries

- **Research**: Scout only (may use temporary workspace).
- **Planning**: Manager/Lead.
- **Complex changes**: Lead (with delegation to Coder/Junior).
- **Routine implementation**: Coder.
- **Small scoped changes**: Junior (if clearly defined).
- **Expert**: deep review/diagnosis only when user explicitly approves.

## Coordination

- Use $shared-plan for shared planning and handoffs (default planning folder: `./docs/planning`).
- Keep ownership explicit and avoid duplicate work.
