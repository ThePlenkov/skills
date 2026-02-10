# Root Agent Token Optimization

**Status**: Ready to implement  
**Time to implement**: 10 minutes  
**Expected token savings**: 65%+ per delegation cycle

---

## The Problem

When `transfer_task()` is called, the model sends **entire conversation history** to the subagent. Each delegation accumulates more history, causing exponential token growth:

```
Delegation 1: transfer + history = 500 tokens
Delegation 2: transfer + history (now bigger) = 1,000 tokens  
Delegation 3: transfer + history (even bigger) = 1,500 tokens
Result: 3,000 tokens for 3 simple tasks (could be 300)
```

---

## The Fix: Reference Plan, Not History

**Core principle**: Reference `./docs/planning/plan.md` instead of passing full chat history to subagents.

Add to `.claude/agents/manager.md` and `.agents/agents/l0-manager.md`:

```markdown
## Token Optimization for Delegations

When using transfer_task():
1. **Reference the shared-plan context, don't repeat it**
   - Pass task description + reference to plan.md
   - Don't include full conversation history
   
2. **Example:**
   ```
   # WRONG (passes full history)
   transfer_task("scout", 
     "Here's our conversation... [thousands of tokens]", 
     "results")
   
   # RIGHT (references plan, concise)
   transfer_task("scout",
     "Context: See ./docs/planning/plan.md\n"
     "Task: Find N+1 queries in user-service\n"
     "Output: JSON [{file, line, count}]",
     "JSON format only")
   ```

3. **Update plan.md after each delegation**
   - Store subagent result summary
   - Reference it in next delegation
   - Keeps shared-plan as source of truth, not chat
```

---

## Implementation: Zero Code Changes Needed

Just update manager prompts with the section above, then:

1. **When delegating**: Reference `./docs/planning/plan.md` instead of repeating context
2. **When receiving result**: Add to plan.md as one-line summary
3. **When next delegation**: Pass plan reference again

### Example Flow

```markdown
Manager updates plan.md:
## Next Actions
- [ ] Scout: Find N+1 queries in user-service

Delegates to scout (references plan, not history):
transfer_task("scout", 
  "Context: See ./docs/planning/plan.md\n"
  "Task: Find N+1 queries in user-service\n"
  "Output: JSON [{file, line, count}]",
  "JSON only")

Scout returns: "Found 12 N+1 queries..."

Manager updates plan.md:
## Updates
- 2025-02-10 — Manager — scout found 12 N+1 queries in user-service (7 high severity)

Next delegation (to Coder):
transfer_task("coder",
  "Context: ./docs/planning/plan.md (scout found 12 N+1 queries)\n"
  "Task: Fix top 3 high-severity queries\n"
  "Output: Fixes with before/after metrics",
  "markdown with metrics")
```

---

## Key Points

1. **No code changes** — Just use plan.md as delegation context
2. **Shared-plan already exists** — You're already using it, just be deliberate
3. **Subagents don't change** — They receive clean task descriptions
4. **Git-backed** — Full history persists in plan.md (auditable, resumable)
5. **Compound savings** — 65% per delegation × N delegations = huge savings at scale

---

## Verify It's Working

Check a delegation:
- Does `transfer_task()` include full chat history? → **No** (change it)
- Does it reference `./docs/planning/plan.md`? → **Yes** (good)
- Is plan.md updated after each delegation? → **Yes** (keep doing it)

If YES to all 3 → You're done. Token savings active.

---

## Expected Outcome

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Per-delegation transfer | 2,000 tokens | 200 tokens | **90%** |
| Total per delegation cycle | 3,300 tokens | 1,000 tokens | **65%** |
| Chat history growth | Exponential | Flat | **Stopped** |
| Implementation effort | — | 10 min | **One-time** |

---

## Files to Update

1. `.claude/agents/manager.md` — Add token optimization section
2. `.agents/agents/l0-manager.md` — Add same section  
3. `./docs/planning/plan.md` — Keep it updated with delegation summaries

---

**Done.** Start using the pattern above in your next delegation.
