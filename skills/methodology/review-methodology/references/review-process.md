# Review Process — Step-by-Step

The body of the skill lists the five steps; this file is the per-step
playbook. Work through the steps in order; do not skip the test or
verification reads even when the diff is small.

## Step 1: Understand the Context

Before looking at code, understand the intent:

```
- What is this change trying to accomplish?
- What spec or task does it implement?
- What is the expected behavior change?
```

## Step 2: Review the Tests First

Tests reveal intent and coverage:

```
- Do tests exist for the change?
- Do they test behavior (not implementation details)?
- Are edge cases covered?
- Do tests have descriptive names?
- Would the tests catch a regression if the code changed?
```

## Step 3: Review the Implementation

Walk through the code with the five axes in mind:

```
For each file changed:
1. Correctness: Does this code do what the test says it should?
2. Readability: Can I understand this without help?
3. Architecture: Does this fit the system?
4. Security: Any vulnerabilities?
5. Performance: Any bottlenecks?
```

Reach for [`axes-checklist.md`](axes-checklist.md) for the per-axis
questions.

## Step 4: Categorize Findings

Label every comment with its severity so the author knows what's required
vs optional:

| Prefix | Meaning | Author Action |
|--------|---------|---------------|
| *(no prefix)* | Required change | Must address before merge |
| **Critical:** | Blocks merge | Security vulnerability, data loss, broken functionality |
| **Nit:** | Minor, optional | Author may ignore — formatting, style preferences |
| **Optional:** / **Consider:** | Suggestion | Worth considering but not required |
| **FYI** | Informational only | No action needed — context for future reference |

This prevents authors from treating all feedback as mandatory and wasting
time on optional suggestions.

**Lead with what matters.** Order findings by leverage: correctness and
security first, then structural regressions and missed simplifications,
then everything else. Don't bury a real issue under cosmetic nits — a few
high-conviction comments beat a long list. If you have one structural
problem and ten nits, the structural problem *is* the review.

## Step 5: Verify the Verification

Check the author's verification story:

```
- What tests were run?
- Did the build pass?
- Was the change tested manually?
- Are there screenshots for UI changes?
- Is there a before/after comparison?
```

For claims of "fixed/verified/passing" the author must point to evidence
per the $skill{evidence} skill — a passing test alone is not the
verification story.
