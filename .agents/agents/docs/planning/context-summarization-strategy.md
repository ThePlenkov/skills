# Context Summarization Strategy for Root Agent

## Problem Statement
Each message to a subagent includes the full chat history, causing exponential token growth. Solution: compress context into essential summaries before delegation.

## Solution: Three-Layer Context Model

### Layer 1: Active Context (Current Turn)
**What**: Essential info needed for current subagent task
**Size**: 3-5 sentences max
**Contains**:
- User's immediate goal
- Specific constraints or constraints
- Key decision points
- Expected output format

**Example**:
```
Goal: Optimize database queries in user-service module
Constraints: Must maintain backward compatibility, no breaking changes
Key decisions: Using indexed columns, not denormalization
Expected output: List of 3-5 optimized queries with performance metrics
```

### Layer 2: Decision Context (Prior Work)
**What**: Important decisions and outcomes from previous delegations
**Size**: 1-2 lines per prior delegation
**Format**: `Delegation [N]: [action] → [outcome]`

**Example**:
```
Delegation 1: Scout searched codebase for N+1 queries → found 12 issues in user-service
Delegation 2: Coder fixed top 3 issues → 40% query reduction verified
```

### Layer 3: Reference Context (Audit Trail)
**What**: Full details stored in shared-plan, not in chat
**Purpose**: Enables resumption, audit trail, multi-session continuity
**Maintained in**: `./docs/planning/root-agent-optimization.md` + `context-digest.md`

## Summarization Rules

### On Handoff to Subagent
1. **Extract** active context for current task (3-5 sentences)
2. **Compress** prior delegations into Layer 2 format
3. **Pass** compressed context in `transfer_task()` call:
   - `task` parameter: active context + specific instruction
   - `expected_output` parameter: precise format + key metrics
   - Add: "Context digest: [2-3 prior delegations]"
4. **Store** full details in shared-plan, not in message

### On Receiving Subagent Output
1. **Digest** output into 2-3 bullet points (Layer 2 format)
2. **Append** to shared-plan `Updates` section
3. **Evaluate** if previous assumptions changed
4. **Next delegation** references digest, not raw output

## Implementation Pattern

### Before Transfer (Root Agent)

```pseudo
function delegateWithSummarization(agent, task, context) {
  // 1. Extract essential active context
  essentialContext = compress(context, maxLines=5)
  
  // 2. Compress prior delegations
  priorDigest = summarizePriorDelegations(sharedPlan, maxItems=3)
  
  // 3. Format task with all compressed context
  fullTask = essentialContext + "\n" + priorDigest + "\n" + task
  
  // 4. Set clear expected output
  expectedOutput = defineExpectedFormat() + "\n" + keyMetrics
  
  // 5. Transfer (subagent gets compressed, not full history)
  transfer_task(agent, fullTask, expectedOutput)
  
  // 6. Update shared-plan with delegation
  updatePlan("Delegation N: " + agent + " → " + task + " [PENDING]")
}

function receiveSubagentOutput(output) {
  // 1. Digest to 2-3 key bullets
  digest = summarize(output, maxLines=3)
  
  // 2. Append to plan
  appendPlan("Delegation N outcome: " + digest)
  
  // 3. Evaluate & prepare next delegation if needed
  return digest  // Return compressed, not raw output
}
```

### Compressed Transfer Task Example

**Before (Full History)**:
```
[Full chat history of 50+ messages, context, all prior outputs]
Transfer scout task: Find N+1 queries
Expected: List of files
```

**After (Summarized)**:
```
Context: Optimizing user-service database queries. 
Previous: Scout found 12 N+1 issues, Coder fixed 3 top ones (40% improvement).
Goal: Scout find remaining N+1 queries in payment-service module.
Expected output: JSON array of {file, line, query_pattern, severity}
```

**Token savings**: Full history = 2,000 tokens → Compressed = 200 tokens (90% reduction per transfer)

## Context Digest File Format

**File**: `./docs/planning/context-digest.md`

```markdown
# Context Digest: Root Agent → Subagents

Last Updated: 2025-01-09 14:30 UTC

## Current Work
Goal: Database query optimization across services
Constraints: Maintain backward compatibility, no breaking changes
Status: 3 of 5 modules analyzed

## Completed Delegations
1. Scout: Found 12 N+1 queries in user-service ✓
2. Coder: Fixed top 3 issues, verified 40% improvement ✓
3. Coder: Refactored auth module queries ✓

## Active Investigation
- Payment-service remaining N+1 issues (Scout)
- Cache strategy for hot queries (Pending Lead review)

## Key Decisions
- Using indexed columns strategy (not denormalization)
- Async pagination for large datasets
- Cache TTL: 5 minutes for user data, 1 hour for config

## Next Transfer Should Include
- Active context: "Payment-service N+1 analysis"
- Prior digest: "Scout found 12 issues in user-service; Coder fixed top 3 (40% gain)"
- Expected: "List of N+1 patterns in payment-service with severity"
```

## Benefits

| Aspect | Before | After | Savings |
|--------|--------|-------|---------|
| Transfer task size | 2,000 tokens | 200 tokens | 90% |
| Subagent processing | Full history processing | 5 key facts | 95% |
| Chat history growth | Linear (N messages) | Logarithmic (summarized) | 80% over 10 delegations |
| Context completeness | 100% but bloated | 95% essential only | Negligible loss |
| Audit trail | In chat (unreliable) | In shared-plan (reliable) | Better |

## Token Cost Analysis

### Single Delegation Cycle (Without Optimization)
- User query: 500 tokens
- Subagent transfer (full history): 2,000 tokens  
- Subagent output: 800 tokens
- Return to root: 2,800 tokens
- **Total: 6,100 tokens** (input + output includes repeats)

### Single Delegation Cycle (With Summarization)
- User query: 500 tokens
- Subagent transfer (compressed): 200 tokens
- Subagent output: 800 tokens
- Return to root: 200 tokens (digest only)
- **Total: 1,700 tokens**
- **Savings: 72% per cycle**

Over 5 delegations:
- Without: 6,100 × 5 = **30,500 tokens**
- With: 1,700 × 5 = **8,500 tokens**
- **Cumulative savings: 72%**

## Rollout Plan

### Phase 1: Enable in Root Agent (Immediate)
- Load this strategy into root agent system prompt
- Create context-digest.md template in shared-plan
- Update transfer_task() calls to use summarization

### Phase 2: Train Subagents (Optional)
- Subagents learn to append digests to their output
- Subagents delegate with summaries to their own subagents

### Phase 3: Measure & Iterate (Weekly)
- Baseline: measure tokens in first 5 delegations (unoptimized)
- Measure: tokens after summarization enabled
- Target: 70%+ reduction in input tokens per cycle
