# Root Agent Prompt Optimization: Context Summarization Module

## Updated Root Agent System Prompt Addition

### Section: Context & Subagent Coordination (ADD THIS SECTION)

```
## Context Summarization Protocol

To minimize chat history bloat and reduce input token growth, always use context 
summarization when delegating to subagents.

### Pre-Delegation Checklist

Before calling transfer_task():

1. **Extract Active Context** (3-5 sentences)
   - What is the immediate goal for this subagent?
   - What are the key constraints?
   - What specific output format is expected?
   
   ✓ Do: "Analyze performance bottleneck in user-service queries"
   ✗ Don't: [Entire 50-message conversation history]

2. **Compress Prior Work** (reference shared-plan, not chat)
   - Summarize previous delegations into 2-3 bullet points
   - Format: "Delegation N: [agent] → [task] → [key outcome]"
   - Example: "Scout found 12 N+1 queries in user-service; Coder fixed 3 (40% improvement)"
   
3. **Build Compact Task Description**
   ```
   task = """
   Context: [1 sentence user goal]
   Prior work: [2-3 prior delegations compressed]
   Current task: [specific instruction for this subagent]
   """
   ```

4. **Set Precise Expected Output**
   ```
   expected_output = """
   Format: [JSON/list/markdown]
   Must include: [specific fields]
   Key metrics: [what to measure]
   """
   ```

### Subagent Output Handling

1. **Digest before storing**: Compress subagent output into 3-5 key bullets
2. **Append to shared-plan**: Store full output in `./docs/planning/context-digest.md`
3. **Pass digest forward**: Next delegation references digest, not raw output
4. **Keep chat clean**: Only summary lines enter the active conversation thread

### Token Accounting

- Full history in transfer ≈ 2,000 tokens per delegation
- Summarized transfer ≈ 200 tokens per delegation
- **Target per-cycle savings: 70-80%**

### Shared-Plan References

Maintain `./docs/planning/context-digest.md` with:
- Current work goal
- Completed delegations (1-line each)
- Active investigations
- Key decisions
- Next transfer template

Use shared-plan as the "source of truth" for context, not chat history.
```

## Implementation: Update transfer_task() Usage

### Current Pattern (Inefficient)
```pseudo
transfer_task(
  agent="scout",
  task="Search for N+1 queries. Here's our conversation history...",
  expected_output="File list"
)
```

### Optimized Pattern
```pseudo
# 1. Prepare compressed context
active_context = "Goal: Find remaining N+1 queries in payment-service (top 5 by severity)"
prior_summary = "Delegation 1: Scout → user-service → found 12 issues\nDelegation 2: Coder → fixed top 3 → 40% improvement"
constraints = "Only async/indexed queries; exclude legacy endpoints"

# 2. Build compact task
task = f"""
Context: Database query optimization project.
{prior_summary}
Current task: Identify N+1 queries in payment-service module using same criteria as Delegation 1.
{constraints}
"""

# 3. Clear expected output
expected_output = """
JSON array of discovered queries:
[
  {
    "file": "path/to/file",
    "line": 123,
    "pattern": "N+1 description",
    "severity": "high/medium/low"
  }
]
Include summary metrics: total count, severity breakdown.
"""

# 4. Delegate with compressed context (90% token savings)
transfer_task(
  agent="scout",
  task=task,
  expected_output=expected_output
)

# 5. Append full result to shared-plan, digest to active context
```

## Shared-Plan Context Digest Template

Create `./docs/planning/context-digest.md`:

```markdown
# Context Digest: Root Agent Delegations

**Last Updated**: 2025-01-09 14:35 UTC  
**Project**: Database query optimization  
**Owner**: root-agent  

## Current Work Summary
- **Goal**: Optimize N+1 queries across payment, user, and auth modules
- **Status**: 2/3 modules analyzed; 8 queries fixed; 40% improvement verified
- **Next**: Analyze payment-service module, then strategize caching

## Delegation Log
| # | Agent | Task | Outcome | Status |
|---|-------|------|---------|--------|
| 1 | scout | Find N+1 in user-service | 12 queries identified | ✓ Complete |
| 2 | coder | Fix top 3 issues in user-service | 40% perf improvement | ✓ Complete |
| 3 | coder | Refactor auth-service queries | 5 queries optimized | ✓ Complete |
| 4 | scout | Find N+1 in payment-service | [PENDING] | 🔄 Active |

## Key Decisions
- Strategy: Index-first (not denormalization)
- Pagination: Async/await for large datasets
- Cache: 5min TTL for user data, 1hr for config
- Source: Schema analysis + query logs review

## Open Questions
- Caching strategy for payment-service?
- Need Lead review before next optimization phase?

## Next Transfer Template
```
**Recipient**: [agent]  
**Prior**: "Scout found 12 N+1 in user-service; Coder fixed 3 (40% gain)"  
**Goal**: [specific task]  
**Constraints**: [limits]  
**Output**: [format + metrics]  
```

## Risks
- Risk: Cache coherency across services → Mitigation: Use cache versioning
- Risk: Backward compatibility → Mitigation: Blue-green deployment
```

## Integration Checklist

- [ ] Add "Context Summarization Protocol" section to root agent system prompt
- [ ] Create `./docs/planning/context-digest.md` template
- [ ] Update all `transfer_task()` calls to use summarized context
- [ ] Add digestion step after receiving subagent output
- [ ] Document context summarization rules in team wiki/docs
- [ ] Run 5 test delegations and measure token savings
- [ ] Monitor per-delegation token usage (target: 70%+ reduction)

## Training Example: Scout Delegation

### Before (Inefficient)
```
I need you to search for N+1 queries. Here's our entire conversation:
[500+ tokens of chat history, context, previous searches, etc.]
Expected output: Just list the files
```

### After (Optimized)
```
Project: Database query optimization. Prior: Scout found 12 N+1 in user-service; Coder fixed 3 (40% improvement).
Current goal: Find N+1 queries in payment-service module.
Constraints: Only async/indexed queries; exclude legacy endpoints.

Expected output:
JSON array: [{"file": "path", "line": 123, "pattern": "N+1 type", "severity": "high/med/low"}]
Include: total count, severity breakdown.
```

**Token difference**: 500+ tokens (full history) → 150 tokens (summarized) = **70% savings per transfer**

## Measuring Success

### Baseline Measurement (First 5 Delegations Without Optimization)
```bash
# Log tokens in each delegation
Delegation 1: Transfer tokens: 2,100, Output: 800, Total: 2,900
Delegation 2: Transfer tokens: 2,150, Output: 950, Total: 3,100
Delegation 3: Transfer tokens: 2,200, Output: 1,100, Total: 3,300
Delegation 4: Transfer tokens: 2,300, Output: 950, Total: 3,250
Delegation 5: Transfer tokens: 2,400, Output: 1,050, Total: 3,450
Average: 3,220 tokens per cycle
Total: 16,100 tokens
```

### Optimized Measurement (Next 5 Delegations With Summarization)
```bash
Delegation 6: Transfer tokens: 200, Output: 800, Total: 1,000
Delegation 7: Transfer tokens: 180, Output: 950, Total: 1,130
Delegation 8: Transfer tokens: 190, Output: 1,100, Total: 1,290
Delegation 9: Transfer tokens: 210, Output: 950, Total: 1,160
Delegation 10: Transfer tokens: 200, Output: 1,050, Total: 1,250
Average: 1,166 tokens per cycle
Total: 5,830 tokens
Savings: 63.8% (Target: 70%+)
```

## Files to Create/Update

1. `./docs/planning/context-digest.md` — Shared context state
2. Root agent system prompt — Add "Context Summarization Protocol" section
3. Team wiki — Document context summarization rules

## Next Steps

1. **Now**: Implement context summarization in root agent
2. **Today**: Run 5 test delegations with summarization
3. **This week**: Measure baseline vs. optimized tokens
4. **Next week**: Roll out to team, monitor for edge cases
