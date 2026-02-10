# Root Agent Optimization: Context Summarization

## Context
The root agent's chat history grows with each message, accelerating input token consumption and increasing costs. Solution: implement context summarization for subagent handoffs to keep only essential information in the active conversation thread.

## Goals
- Reduce chat history growth per delegation cycle
- Minimize context loss while handing off to subagents
- Create reusable summarization patterns for scout, coder, sage
- Maintain token efficiency across multi-turn conversations

## Problem Analysis

### Current Flow Issues
1. **Full history duplication**: Each subagent delegation includes entire root agent history
2. **Accumulated context**: Previous conversations stack without summarization
3. **Token growth**: Linear growth with conversation length, not subagent work
4. **Inefficient dependencies**: Subagent output often re-enters root agent history unsummarized

### Token Cost Breakdown
- Initial user query: X tokens
- After delegation 1: 2X (query + subagent output)
- After delegation 2: 3X (query + both outputs + new context)
- After delegation N: (N+1)X tokens for same final answer

## Strategy: Context Summarization on Handoff

### Phase 1: Handoff Summarization Template
When delegating to subagents, root agent will:
1. **Identify essential context** (user goal, constraints, decisions)
2. **Compress prior history** into concise bullet points
3. **Extract only actionable items** for the subagent
4. **Pass compact context** in transfer_task expected_output/task

### Phase 2: Context State Tracking
- Maintain "context digest" in shared-plan
- Update with each delegation
- Reference digest instead of full history in transfers

### Phase 3: Token Audit & Metrics
- Baseline: measure current tokens per delegation cycle
- After opt: measure tokens after summarization
- Target: 30-40% reduction in input tokens per cycle

## Parallel Tasks
- [ ] Task 1: Audit current root agent token usage — root-agent
- [ ] Task 2: Design summarization algorithm — root-agent
- [ ] Task 3: Implement context digest in shared-plan — root-agent
- [ ] Task 4: Create transfer_task wrapper with summarization — root-agent
- [ ] Task 5: Test with real delegation scenarios — root-agent

## Decisions (with sources)
- Use shared-plan for context state: enables other agents to resume work, git-compatible
- Summarization on handoff (not continuous): avoids mid-conversation complexity
- Keep raw output in shared-plan, summary in transfer_task: preserves audit trail

## Risks / Open Questions
- **Risk**: Summarization loses important context → mitigation: shared-plan preserves full history
- **Question**: Optimal summary length? — testing phase will determine (target: 2-5 lines per prior context block)
- **Question**: Should we summarize subagent output before re-entering root? → yes, append to plan, reference in next transfer

## Next Actions
- [ ] Implement Phase 1 (handoff template) — start now
- [ ] Measure baseline tokens before optimization
- [ ] Run test delegations with summarization enabled
- [ ] Document final savings and roll out to team

## Updates
- 2025-01-09 — root-agent — Initial planning; token optimization strategy designed
