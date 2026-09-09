# Reimplementation Cost Guide

How to honestly estimate the cost of reimplementing a dependency. The hardest part of `dep-cost` is not measuring the dep — it's being honest about what reimplementation actually costs in hours, bugs, and risk.

## The three buckets

### Trivial (≤30 LOC, no edge cases)

Examples: `_.get(obj, path)`, `format(date, 'YYYY-MM-DD')`, simple deep clone, basic CSV → array.

**Reimplement: usually yes.** 30 minutes, no tests beyond the obvious, and the result is a small focused function you own.

**Exceptions (when to keep the dep even if trivial):**
- The function has locale or i18n implications (date formatting, number formatting)
- The function has subtle correctness for edge cases (Feb 29, NaN, empty string)
- The function needs to be very fast (hot path, called millions of times)

### Tricky (50-200 LOC, edge cases, formatting/parsing)

Examples: markdown parser, CSV writer, color conversion, debounce with cancellation + maxWait + leading/trailing, JWT sign/verify (no, this is Critical), URL parser, query string parser.

**Reimplement: borderline.** Measure both sides. Reimplementation is right when:
- The dep has many features you'll never use
- The dep is poorly documented and you're fighting it
- The dep's API doesn't match your use case well

**Reimplementation is wrong when:**
- The spec is formal and fiddly (RFC 4180 CSV, RFC 3986 URI, RFC 8259 JSON)
- The function has dozens of edge cases you don't fully understand
- The dep is well-tested and you'd just be reimplementing their tests

### Critical (security, crypto, standards compliance, battle-tested)

Examples: TLS, JWT, bcrypt, AES, parsing JPEG, ICU, OAuth, password hashing, ASN.1, OpenPGP, XML canonicalization.

**Reimplement: almost never.** The dep exists because the problem is hard and getting it wrong is a CVE. The "cost saving" is illusory — the reimplementation either matches the dep (zero saving) or differs subtly (CVE incoming).

**Exceptions:**
- You are the domain expert and the dep doesn't do what you need
- The dep has known vulnerabilities and there is no patched version
- You are building a research prototype where correctness is best-effort

## The "test it" rule

Reimplementation is not done until:

1. The new code passes unit tests covering your use case
2. The new code passes property-based tests if applicable (e.g., `round-trip(decode(encode(x))) == x`)
3. The new code is exercised by an existing integration test that previously used the dep
4. The dep is removed from the manifest and the build still works

If you can't check all four, the reimplementation isn't real yet.

## Cost in hours, not LOC

LOC is a hint, not a budget. Honest hour estimates:

| Bucket | LOC | Hours (calm) | Hours (with edge cases) | Hours (with tests) |
|---|---|---|---|---|
| Trivial | 30 | 0.5 | 2 | 3 |
| Tricky | 100 | 4 | 8 | 12 |
| Tricky with spec | 150 | 8 | 16 | 24 |
| Critical | 200+ | 24 | — | — (don't reimplement) |

The "calm" column is when you've done this before. The "with edge cases" column is the first time. The "with tests" column is the right number to use in the decision.

A "30 LOC debounce" sounds cheap. In reality:
- Implement: 1 hour
- Add cancellation: 30 min
- Add leading/trailing: 30 min
- Write tests for cancellation, leading, trailing, maxWait, double-call: 2 hours
- Handle the "this" binding issue: 30 min
- Test in React StrictMode (double-effect): 1 hour

Total: 5-6 hours. That's the real number, and it's the number to compare to "use the dep and move on".

## When reimplementation is the right call even for "tricky" things

Sometimes reimplementing is correct even when the code is non-trivial. The triggers:

1. **You would have written it differently anyway.** The dep's API doesn't match your domain. Reimplementing gives you a better fit.
2. **The dep is unmaintained.** Security risk > maintenance savings.
3. **The dep has subtle bugs that affect you.** Reimplementation with focused tests is more reliable than depending on the dep's tests.
4. **You need to control the binary closely.** Embedded systems, WebAssembly with size budgets, single-binary deploys.
5. **The dep is over-abstracted.** You need 2 functions; the dep has 200. Reimplementing gives you a focused tool you can read in 30 seconds.

## When reimplementation is the wrong call even for "trivial" things

Sometimes reimplementing is wrong even when the code is short. The triggers:

1. **The dep is faster than you can write.** Hot path, called millions of times. The dep has hand-tuned SIMD or careful allocation; your reimplementation will be 5x slower.
2. **The function has security implications even if it looks innocent.** HTML escaping, URL encoding, SQL escaping — reimplementing is how you get XSS/SQLi.
3. **The function relies on OS or hardware features.** `bcrypt` relies on careful memory handling. Don't reimplement.
4. **The dep is so widespread that "everyone knows it".** `moment` is heavy but every dev knows the API. Switching to a hand-rolled formatter costs onboarding time.

## Worked example: reimplementing date-fns `format`

**Use case:** format a date as `YYYY-MM-DD HH:mm:ss` in 50 places across the app.

**Measurement:**
- date-fns is 78MB unpacked, but tree-shakes to ~5KB for this one function
- Bundle impact: 5KB

**Reimplementation cost (honest):**
- 30 LOC of code: 1 hour
- Tests for leap year, end-of-month, timezone, 12 vs 24 hour: 3 hours
- Edge case: DST transitions: 1 hour
- Code review: 1 hour
- Total: 6 hours

**Decision: keep date-fns.** 5KB bundle vs 6 hours of work + ongoing maintenance of the local impl. The 5KB is not worth 6 hours.

**But** — if the use case were "format a date as `YYYY-MM-DD` only, no time, no timezone", the reimplementation is 5 LOC, 30 minutes, and the dep is overkill. Different decision.

The cost changes with the use case. Always re-estimate for the specific shape you need.

## Working with the dep's source as reference

Sometimes the right move is "read the dep's source, understand what it does, then write our own version". This is not plagiarism — it's reading the reference implementation. The result is your code, not theirs, and you can:
- Strip the features you don't need
- Adapt the API to your domain
- Add focused tests for your use case
- Remove the dep

Examples where this works well:
- A small focused library with a clear reference impl
- A well-tested algorithm where the test suite is the spec
- A de facto standard (e.g., lodash, request, chalk) where the implementation is small

Examples where this is misleading:
- A large library where the surface you see is the tip of the iceberg
- A library with platform-specific code (e.g., a Markdown parser with DOM/Node shims)
- A library with subtle spec compliance (DO NOT reimplement crypto, parsers)
