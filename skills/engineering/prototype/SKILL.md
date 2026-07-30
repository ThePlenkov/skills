---
name: prototype
description: "Build a throwaway prototype to answer a design question. Use when the user wants to sanity-check whether a state model or logic feels right, or to explore what a UI should look like. Two distinct branches: a runnable terminal app for state/logic questions, or several radically different UI variations toggleable from one route."
metadata:
  upstream: mattpocock/skills
  upstream_path: skills/engineering/prototype/
  note: Adapted from mattpocock/skills. Sub-files in references/ are the two branch guides.
  allowed-tools: read, grep, glob, edit, write, exec
  tier: 2
  triggers:
    - user
    - model
  source: theplenkov-ai/skills
---

<!--
Upstream: mattpocock/skills @ skills/engineering/prototype
Adapted for theplenkov-ai/skills conventions. No semantic changes; cross-references
swapped from `/setup-matt-pocock-skills` to repository-local equivalents.
-->

# Prototype

A prototype is **throwaway code that answers a question**. The question decides the shape.

## Pick a branch

Identify which question is being answered — from the user's prompt, the surrounding code, or by asking if the user is around:

- **"Does this logic / state model feel right?"** → [references/LOGIC.md](references/LOGIC.md). Build a tiny interactive terminal app that pushes the state machine through cases that are hard to reason about on paper.
- **"What should this look like?"** → [references/UI.md](references/UI.md). Generate several radically different UI variations on a single route, switchable via a URL search param and a floating bottom bar.

The two branches produce very different artifacts — getting this wrong wastes the whole prototype. If the question is genuinely ambiguous and the user isn't reachable, default to whichever branch better matches the surrounding code (a backend module → logic; a page or component → UI) and state the assumption at the top of the prototype.

## Rules that apply to both

1. **Throwaway from day one, and clearly marked as such.** Locate the prototype code close to where it will actually be used (next to the module or page it's prototyping for) so context is obvious — but name it so a casual reader can see it's a prototype, not production. For throwaway UI routes, obey whatever routing convention the project already uses; don't invent a new top-level structure.
2. **One command to run.** Whatever the project's existing task runner supports — `pnpm <name>`, `python <path>`, `bun <path>`, etc. The user must be able to start it without thinking.
3. **No persistence by default.** State lives in memory. Persistence is the thing the prototype is _checking_, not something it should depend on. If the question explicitly involves a database, hit a scratch DB or a local file with a clear "PROTOTYPE — wipe me" name.
4. **Skip the polish.** No tests, no error handling beyond what makes the prototype _runnable_, no abstractions. The point is to learn something fast.
5. **Surface the state.** After every action (logic) or on every variant switch (UI), print or render the full relevant state so the user can see what changed.
6. **Capture it when done.** Fold any validated decision into the real code, then capture the prototype itself as a **primary source**: commit it to a throwaway branch, out of main, and leave a context pointer to that branch on the implementation issue or in the local plan. Capture the answer too — the verdict and the question it settled — in the issue or a commit. The main branch keeps only the validated decision.

## Related skills

- $skill{subagent-capsule} — orchestration rules for any work this skill delegates (downward-only delegation, explicit user permission before launching sub-agents, read-only investigator profile, the `SUBAGENT_CONTEXT_CAPSULE` envelope). The role-prompt reference `$subagents-setup` (see `AGENTS.md § Role prompts`) is for the agent's runtime reference; the skill body uses the $skill{...} form to invoke a skill.
- $skill{shared-plan} — for capturing the validated decision into the durable plan record.
- $skill{save-session} — for durable cross-work preservation; the prototype's answer survives context-window handoff.
- $skill{evidence} — for proving the prototype actually ran before claiming "it works".
- $skill{sandboxed} — when the prototype touches infra and needs isolation from the user's working dir.
