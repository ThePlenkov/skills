---
name: security-and-hardening
description: Hardens code against vulnerabilities. Use when handling user input, authentication, data storage, or external integrations. Use when building any feature that accepts untrusted data, manages user sessions, or interacts with third-party services.
metadata:
  tier: 2
  triggers:
    - user
    - model
  source: theplenkov-ai/skills
---

# Security and Hardening

## Overview

Security-first development practices for web applications. Treat every
external input as hostile, every secret as sacred, and every
authorization check as mandatory. Security isn't a phase — it's a
constraint on every line of code that touches user data,
authentication, or external systems.

## When to Use

- Building anything that accepts user input
- Implementing authentication or authorization
- Storing or transmitting sensitive data
- Integrating with external APIs or services
- Adding file uploads, webhooks, or callbacks
- Handling payment or PII data

## Process: Threat Model First

Controls bolted on without a threat model are guesses. Before hardening,
spend five minutes thinking like an attacker:

1. **Map the trust boundaries.** Where does untrusted data cross into
   your system? HTTP requests, form fields, file uploads, webhooks,
   third-party APIs, message queues, and **LLM output**. Every
   boundary is attack surface.
2. **Name the assets.** What's worth stealing or breaking?
   Credentials, PII, payment data, admin actions, money movement.
3. **Run STRIDE over each boundary** — a quick lens, not a ceremony:

| Threat | Ask | Typical mitigation |
|---|---|---|
| **S**poofing | Can someone impersonate a user/service? | Authentication, signature verification |
| **T**ampering | Can data be altered in transit or at rest? | Integrity checks, parameterized queries, HTTPS |
| **R**epudiation | Can an action be denied later? | Audit logging of security events |
| **I**nformation disclosure | Can data leak? | Encryption, field allowlists, generic errors |
| **D**enial of service | Can it be overwhelmed? | Rate limiting, input size caps, timeouts |
| **E**levation of privilege | Can a user gain rights they shouldn't? | Authorization checks, least privilege |

4. **Write abuse cases next to use cases.** For each feature, ask "how
   would I misuse this?" — then make that your first test.

If you can't name the trust boundaries for a feature, you're not ready
to secure it. This is OWASP **A04: Insecure Design** — most breaches
begin in design, not code.

## The Three-Tier Boundary System

### Always Do (No Exceptions)

- **Validate all external input** at the system boundary (API routes,
  form handlers)
- **Parameterize all database queries** — never concatenate user input
  into SQL
- **Encode output** to prevent XSS (use framework auto-escaping, don't
  bypass it)
- **Use HTTPS** for all external communication
- **Hash passwords** with bcrypt/scrypt/argon2 (never store plaintext)
- **Set security headers** (CSP, HSTS, X-Frame-Options,
  X-Content-Type-Options)
- **Use httpOnly, secure, sameSite cookies** for sessions
- **Run the detected package manager's native audit** against the
  committed lockfile before every release

### Ask First (Requires Human Approval)

- Adding new authentication flows or changing auth logic
- Storing new categories of sensitive data (PII, payment info)
- Adding new external service integrations
- Changing CORS configuration
- Adding file upload handlers
- Modifying rate limiting or throttling
- Granting elevated permissions or roles

### Never Do

- **Never commit secrets** to version control (API keys, passwords,
  tokens)
- **Never log sensitive data** (passwords, tokens, full credit card
  numbers)
- **Never trust client-side validation** as a security boundary
- **Never disable security headers** for convenience
- **Never use `eval()` or `innerHTML`** with user-provided data
- **Never store sessions in client-accessible storage** (localStorage
  for auth tokens)
- **Never expose stack traces** or internal error details to users

## Detailed Patterns

The body above is the procedure; the copy-paste-ready recipes live in
the references/ directory:

- OWASP Top 10 prevention patterns (SQL/NoSQL/command injection,
  broken auth, XSS, broken access control, misconfig, sensitive data
  exposure, SSRF) — [`references/owasp-patterns.md`](references/owasp-patterns.md)
- Input validation (schema at boundaries, file upload safety) —
  [`references/input-validation.md`](references/input-validation.md)
- Triaging dependency-audit results (reachability decision tree,
  supply-chain hygiene) —
  [`references/dependency-audit.md`](references/dependency-audit.md)
- Rate limiting (per-surface budgets) —
  [`references/rate-limiting.md`](references/rate-limiting.md)
- Secrets management (env file layout, pre-commit grep, rotation) —
  [`references/secrets-management.md`](references/secrets-management.md)
- Securing AI / LLM features (OWASP LLM Top 10 mapping, model-output
  as untrusted input) —
  [`references/llm-security.md`](references/llm-security.md)
- The full security review checklist (auth, authz, input, data,
  infra, supply chain, AI/LLM) —
  `references/security-checklist.md`

## See Also

For detailed security checklists and pre-commit verification steps,
see `references/security-checklist.md`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is an internal tool, security doesn't matter" | Internal tools get compromised. Attackers target the weakest link. |
| "We'll add security later" | Security retrofitting is 10x harder than building it in. Add it now. |
| "No one would try to exploit this" | Automated scanners will find it. Security by obscurity is not security. |
| "The framework handles security" | Frameworks provide tools, not guarantees. You still need to use them correctly. |
| "It's just a prototype" | Prototypes become production. Security habits from day one. |
| "Threat modeling is overkill here" | Five minutes of "how would I attack this?" prevents the design flaws no control can patch later. |
| "It's just LLM output, it's only text" | That "text" can be a SQL statement, a script tag, or a shell command. Treat it like any untrusted input. |
| "The audit passed, so the dependency is safe" | Audits match known advisories. They do not detect a newly malicious package or make unreviewed install scripts safe to execute. |

## Red Flags

- User input passed directly to database queries, shell commands, or
  HTML rendering
- Secrets in source code or commit history
- API endpoints without authentication or authorization checks
- Missing CORS configuration or wildcard (`*`) origins
- No rate limiting on authentication endpoints
- Stack traces or internal errors exposed to users
- Dependencies with known critical vulnerabilities, competing
  lockfiles at one installation boundary, non-reproducible installs,
  or blanket-approved scripts
- Server fetches user-supplied URLs without an allowlist (SSRF)
- LLM/model output passed into a query, the DOM, a shell, or `eval`
- Secrets, PII, or the full system prompt placed inside an LLM
  context window

## Verification

After implementing security-relevant code:

- [ ] The native audit has no unmitigated reachable critical/high
      findings; CI preserves the authoritative lockfile and blocks
      unreviewed dependency scripts
- [ ] No secrets in source code or git history
- [ ] All user input validated at system boundaries
- [ ] Authentication and authorization checked on every protected
      endpoint
- [ ] Security headers present in response (check with browser
      DevTools)
- [ ] Error responses don't expose internal details
- [ ] Rate limiting active on auth endpoints
- [ ] Server-side URL fetches validated against an allowlist (SSRF
      mitigated, with the TOCTOU caveat noted in
      [`references/owasp-patterns.md`](references/owasp-patterns.md))
- [ ] LLM/model output validated and encoded before use (if AI features
      present)
