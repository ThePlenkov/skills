# Context Digest Template & Quick Reference

## Quick Start: 3-Step Summarization

### Step 1: Extract Active Context (3-5 Sentences)
**Goal**: What does this subagent need to accomplish RIGHT NOW?

```markdown
## Immediately Actionable

Goal: [What we're solving right now - 1 sentence]
Constraints: [Limits/guardrails - 1 sentence]
Context: [Why this matters - 1 sentence]
Expected format: [JSON/list/markdown - 1 sentence]
Success metric: [How to know it worked - 1 sentence]
```

### Step 2: Compress Prior Delegations (Reuse Format)
**Goal**: What have we already accomplished this "project session"?

```markdown
## Context from Prior Delegations

Delegation 1: [Agent] → [Task] → [1-line outcome]
Delegation 2: [Agent] → [Task] → [1-line outcome]
Delegation 3: [Agent] → [Task] → [1-line outcome]
```

### Step 3: Create Compact Transfer Block
**Goal**: Combine into a single, tight transfer_task() call

```pseudo
transfer_task(
  agent="scout",
  task="""
Goal: Find N+1 queries in payment-service module.
Prior work: Scout found 12 in user-service; Coder fixed top 3 (40% improvement).
Constraints: Async queries only; exclude legacy endpoints.
  """,
  expected_output="""
JSON array of queries: [{"file", "line", "pattern", "severity"}]
Include: total count, severity breakdown.
  """
)
```

---

## Context Digest File: Minimal Template

**File location**: `./docs/planning/context-digest.md`

```markdown
# Context Digest

**Last Updated**: 2025-01-09 14:35 UTC

## Current Work
- Goal: [What are we solving?]
- Status: [Progress summary - 1 line]

## Delegations
- [ ] Delegation 1: scout → [task] → [1-line outcome]
- [ ] Delegation 2: coder → [task] → [1-line outcome]

## Key Decisions
- Decision: [What we decided]
  Rationale: [Why]

## Next Transfer Template
Goal: [specific task]
Prior: "[Delegation 1 outcome]; [Delegation 2 outcome]"
Output: [format]
```

---

## Real Example: Database Optimization Project

### Session Start

**File**: `./docs/planning/context-digest.md`

```markdown
# Context Digest: Database Optimization

**Last Updated**: 2025-01-09 14:00 UTC  
**Owner**: root-agent  

## Current Work
- Goal: Fix N+1 queries in payment processing service
- Status: Initial discovery phase

## Delegations
- [ ] Delegation 1: scout → find N+1 in user-service

## Key Decisions
- Use index-first strategy (not denormalization)

## Next Transfer
```

### After Delegation 1 (Scout Returns Results)

**Scout output**: 
```
Found 12 N+1 query patterns in user-service:
- User profile loading (8 instances)
- Permission checks (3 instances)
- Activity log fetching (1 instance)
Severity: 7 high, 4 medium, 1 low
Files affected: user.service.ts, profile.controller.ts, auth.middleware.ts
```

**Root agent action**:
1. Digest: "Scout found 12 N+1 in user-service (7 high, 4 med, 1 low)"
2. Update shared-plan
3. Prepare next delegation

**Updated digest**:

```markdown
# Context Digest: Database Optimization

**Last Updated**: 2025-01-09 14:15 UTC  
**Owner**: root-agent  

## Current Work
- Goal: Fix N+1 queries in payment processing service
- Status: 1/3 modules analyzed (user-service complete)

## Delegations
- [x] Delegation 1: scout → find N+1 in user-service → found 12 (7 high, 4 med)
- [ ] Delegation 2: coder → fix top 3 high-severity in user-service

## Key Decisions
- Use index-first strategy (not denormalization)
- Prioritize high-severity fixes first

## Next Transfer
Goal: Fix top 3 high-severity N+1 issues in user-service
Prior: "Scout found 12 N+1 patterns (7 high, 4 med, 1 low)"
Output: List of fixes with before/after query plans and performance metrics
```

### After Delegation 2 (Coder Fixes Issues)

**Coder output**:
```
Fixed 3 high-severity N+1 queries:
1. User profile loading → added eager loading join (batch fetch)
   Performance: 1200ms → 120ms (10x improvement)
2. Permission checks → indexed role lookups
   Performance: 850ms → 85ms (10x improvement)
3. Activity log fetch → cursor-based pagination + lazy loading
   Performance: 2100ms → 210ms (10x improvement)

Verified with 1000-user test load. No breaking changes.
All tests passing.
```

**Root agent action**:
1. Digest: "Coder fixed 3 high-severity N+1 (10x perf gain each); verified in load tests"
2. Update shared-plan
3. Prepare for Payment Service analysis

**Updated digest**:

```markdown
# Context Digest: Database Optimization

**Last Updated**: 2025-01-09 14:30 UTC  
**Owner**: root-agent  

## Current Work
- Goal: Fix N+1 queries across 3 services (user, payment, auth)
- Status: 2/3 modules completed; 40% overall query time reduction verified

## Delegations
- [x] Delegation 1: scout → find N+1 in user-service → 12 found (7 high)
- [x] Delegation 2: coder → fix top 3 high-severity → 10x perf each; verified
- [ ] Delegation 3: scout → find N+1 in payment-service

## Key Decisions
- Index-first strategy (not denormalization)
- Prioritize high-severity fixes (40% perf gain from just 3 queries!)
- Verify with load tests before merge

## Next Transfer
Goal: Find N+1 queries in payment-service (using same criteria as Delegation 1)
Prior: "Scout found 12 in user-service; Coder fixed 3 (10x perf each, verified)"
Output: List of N+1 patterns with severity; comparison with user-service numbers
```

---

## Advanced: Multi-Agent Coordination

### Example: Parallel Delegations

**Scenario**: You need to delegate to Scout AND Lead simultaneously

**Before (No Summarization)**:
```pseudo
// Both agents receive full history + active context
transfer_task(scout, "Search for X [full history]", "return list")
transfer_task(lead, "Plan X [full history]", "return plan")
// Result: 2 × 2,000 tokens = 4,000 tokens in transfers
```

**After (Summarization)**:
```pseudo
// Both agents receive compressed context
transfer_task(scout, "Search for X [compressed: 3 prior delegations]", "return list")
transfer_task(lead, "Plan X [compressed: 3 prior delegations]", "return plan")
// Result: 2 × 200 tokens = 400 tokens in transfers
// Savings: 90%
```

### Coordination Pattern

```markdown
## Parallel Tasks (Delegations 4-5)

Task A: scout → Find performance issues in payment-service
- Context: User-service analysis complete (12 N+1s fixed); now analyzing payment-service
- Expected: List of issues ranked by impact

Task B: lead → Design caching strategy for hot endpoints
- Context: Performance improvements identified (40% gain so far); need cache architecture
- Expected: Strategy document with TTL recommendations

Both receive same compressed prior context, but different active tasks.
After both complete, root agent digests both outputs before next wave.
```

---

## Token Savings Calculator

Use this to estimate savings for your project:

```markdown
## Token Savings Estimate

### Without Summarization (Current Inefficient State)
- Initial context: 500 tokens
- Delegation 1 transfer: 2,000 tokens
- Delegation 1 output: 800 tokens
- Delegation 2 transfer: 2,100 tokens (history grows)
- Delegation 2 output: 950 tokens
- Total for 2 delegations: 6,350 tokens

### With Summarization (Optimized)
- Initial context: 500 tokens
- Delegation 1 transfer: 200 tokens (compressed)
- Delegation 1 output: 800 tokens
- Delegation 1 digest stored: (not in chat)
- Delegation 2 transfer: 200 tokens (compressed + digest)
- Delegation 2 output: 950 tokens
- Total for 2 delegations: 2,650 tokens

### Savings: 58% (Target: 70%+)

---

For 10 delegations without summarization: ~30,000 tokens
For 10 delegations with summarization: ~8,500 tokens
**Cumulative savings: 72% (aligned with strategy target)**
```

---

## Checklist: Before Every Delegation

- [ ] What is the immediate goal (1 sentence)?
- [ ] What constraints apply (1 sentence)?
- [ ] What prior delegations are relevant (2-3 max)?
- [ ] What exact output format is expected?
- [ ] Is the task in the `transfer_task()` call under 300 tokens?
- [ ] Is prior context compressed into single-line bullets?
- [ ] Have I updated `context-digest.md`?
- [ ] Does the subagent have everything needed without full history?

---

## Common Mistakes to Avoid

### ❌ Don't: Include Full Chat History
```
transfer_task(scout, "Here's our entire 50-message conversation: [thousands of tokens]", ...)
```

### ✅ Do: Compress to Essential Context
```
transfer_task(scout, 
  "Prior: Scout found 12 N+1 in user-service; Coder fixed 3 (40% gain).\n"
  "Goal: Find N+1 in payment-service",
  ...)
```

### ❌ Don't: Vague Expected Output
```
expected_output: "Results"
```

### ✅ Do: Precise Format with Metrics
```
expected_output: "JSON array [{file, line, pattern, severity}] with total count and breakdown"
```

### ❌ Don't: Lose Context Between Delegations
```
// Receive output, forget about it
receive_output(scout_result)  // Not stored
next_delegation()  // Has no reference to scout result
```

### ✅ Do: Digest and Store
```
digest = summarize(scout_result, maxLines=3)
update_context_digest(digest)
next_delegation()  // References digest from shared-plan
```

---

## FAQ

**Q: Won't summarization lose important details?**
A: No. Full details stay in shared-plan (audit trail). Subagent transfer gets essential context only (faster processing). Both preserved.

**Q: How do I know what to compress?**
A: Ask: "Does this subagent need to know this fact to complete their task?" If no → don't include.

**Q: What if a subagent needs more context?**
A: They can ask. Root agent provides additional context on demand. But 95% of time, they won't need it.

**Q: How often should I update context-digest.md?**
A: After each delegation completes. Takes 30 seconds. Keeps coordination clean.

**Q: Can I share context-digest.md across projects?**
A: No. Create a new one per project session. Keep it project-scoped.

**Q: What if I'm doing 1 quick delegation?**
A: Still summarize. It's a habit. Even saves 10-20% on single transfers.
