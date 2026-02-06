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
- **Scout**: read-only research across sources.
- **Junior**: clearly defined, small tasks.

## Delegation Rules

- **Manager** delegates to Lead, Coder, Scout, Junior. Expert only with explicit user approval.
- **Lead** delegates research to Scout and implementation to Coder/Junior.
- **Coder** can delegate research to Scout and small tasks to Junior if needed.
- **Scout** does not delegate; reports findings only.
- **Junior** does not delegate; completes assigned tasks only.
- **Expert** does not delegate; provides diagnosis and resolution guidance only when explicitly approved.

## Task Boundaries

- **Research**: Scout only (read-only).
- **Planning**: Manager/Lead.
- **Complex changes**: Lead (with delegation to Coder/Junior).
- **Routine implementation**: Coder.
- **Small scoped changes**: Junior (if clearly defined).
- **Expert**: deep review/diagnosis only when user explicitly approves.

## Coordination

- Use $shared-plan for shared planning and handoffs (default planning folder: `./docs/planning`).
- Keep ownership explicit and avoid duplicate work.
