# Related skills

Skills this prototype may delegate to or be used alongside:

- $skill{subagent-capsule} — orchestration rules for any work this skill delegates (downward-only delegation, explicit user permission before launching sub-agents, read-only investigator profile, the `SUBAGENT_CONTEXT_CAPSULE` envelope). The role-prompt reference `$subagents-setup` (see `AGENTS.md` "Role prompts" section) is for the agent's runtime reference; the skill body uses `$skill{subagent-capsule}` to invoke it.
- $skill{shared-plan} — for capturing the validated decision into the durable plan record.
- $skill{save-session} — for durable cross-work preservation; the prototype's answer survives context-window handoff.
- $skill{evidence} — for proving the prototype actually ran before claiming "it works".
- $skill{sandboxed} — when the prototype touches infra and needs isolation from the user's working dir.
