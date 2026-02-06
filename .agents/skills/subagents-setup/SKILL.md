---
name: subagents-setup
description: Describes the multi-agent hierarchy, delegation rules, and task boundaries. Use when coordinating subagents, assigning work, clarifying ownership, or deciding who should handle a task.
---

# Subagents Setup

## Overview
This skill documents the role hierarchy, delegation paths, and task boundaries for the subagents setup.

## Roles and Responsibilities

- **Manager**: coordination, prioritization, and parallelization.
- **Lead**: plan review, task breakdown, delegation.
- **Senior**: hardest tasks, deep reasoning, can delegate.
- **Coder**: main implementation work.
- **Scout**: read-only research across sources.
- **Junior**: clearly defined, small tasks.

## Delegation Rules

- **Manager** delegates to Lead, Senior, Coder, Scout, Junior.
- **Lead** delegates research to Scout and implementation to Coder/Junior.
- **Senior** can delegate implementation to Coder/Junior and research to Scout.
- **Coder** can delegate research to Scout and small tasks to Junior if needed.
- **Scout** does not delegate; reports findings only.
- **Junior** does not delegate; completes assigned tasks only.

## Task Boundaries

- **Research**: Scout only (read-only).
- **Planning**: Manager/Lead; Senior contributes when needed.
- **Complex changes**: Senior or Lead.
- **Routine implementation**: Coder.
- **Small scoped changes**: Junior (if clearly defined).

## Coordination

- Use $shared-plan for shared planning and handoffs (default planning folder: `./docs/planning`).
- Keep ownership explicit and avoid duplicate work.
