---
name: spec-kit
description: Use Spec-Driven Development with GitHub Spec Kit. Create specifications, generate implementations, and build high-quality software faster using the `specify` CLI.
metadata:
  tier: 2
  triggers:
    - user
    - model
  source: theplenkov-ai/skills
---

# Spec Kit (Spec-Driven Development)

## Overview

GitHub's Spec Kit enables **Spec-Driven Development (SDD)**: write executable specifications that directly generate working implementations, rather than generating specs from code.

**Official**: <https://github.com/github/spec-kit>  
**Docs**: <https://github.github.io/spec-kit/>

## When to Use

- Creating new projects with clear requirements
- Establishing consistent development patterns across a codebase
- Generating implementations that match specifications
- Building with AI assistance (Claude, etc.)
- Enforcing code quality and testing standards

## Installation

### Persistent Installation (Recommended)

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

### One-Time Usage

```bash
uvx --from git+https://github.com/github/spec-kit.git specify init <PROJECT_NAME>
```

### Upgrade

```bash
# Use --force to reinstall if already installed
uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git
```

## Core Workflow

### 1. Initialize Project

```bash
# In new directory
specify init <PROJECT_NAME> --ai claude

# In existing directory
specify init . --ai claude
```

This creates:

- `.speckit/` folder with project configuration
- `.speckit/constitution.md` — Project principles and guidelines
- `.speckit/implementation_hints.md` — Implementation guidance
- Templates for specifications

### 2. Create Constitution (Project Principles)

```bash
/speckit.constitution Create principles for code quality, testing, UX, and performance
```

This establishes:

- Development standards
- Code quality requirements
- Testing expectations
- Performance goals
- Architecture guidelines

### 3. Write Specifications

Create `.speckit/*.spec.md` files:

```markdown
# Feature Specification: User Authentication

## Requirements
- [ ] User can log in with email/password
- [ ] Session persists for 24 hours
- [ ] Invalid credentials show error message
- [ ] Rate limiting on failed attempts (max 5 per hour)

## Acceptance Criteria
- Login form validates email format
- Password stored securely (bcrypt)
- Session token httpOnly cookie
- API returns 401 on auth failure

## Implementation Notes
- Use standard auth library (not custom)
- Add integration tests
- Performance: Login < 500ms
```

### 4. Generate Implementation

Once specification is written, ask your AI assistant to implement it. The AI will:

- Read the specification
- Reference constitution principles
- Generate code matching spec
- Ensure tests are included
- Follow established patterns

```bash
/speckit.implement Generate code for feature-auth.spec.md
```

Or use `transfer_task()` to delegate to coder:

```python
transfer_task(
  agent="coder",
  task="""
  Specification: .speckit/feature-auth.spec.md
  
  Constitution: .speckit/constitution.md
  
  Generate implementation matching spec.
  """,
  expected_output="PR/commit with implementation + tests matching spec"
)
```

## Key Commands

In AI assistants (Claude, etc.) with `/speckit.*` support:

- **`/speckit.constitution`** — Create/update project principles
- **`/speckit.specify`** — Generate specification from requirements
- **`/speckit.implement`** — Generate implementation from specification
- **`/speckit.check`** — Verify implementation matches specification
- **`/speckit.review`** — Review code against constitution

## Integration with Agents

### For Coder Agent

Add to coder prompt:

```markdown
## Spec-Driven Development

When working on features:
1. Check if `.speckit/` exists (means project uses SDD)
2. Look for `.speckit/*.spec.md` files (your spec)
3. Read `.speckit/constitution.md` (project principles)
4. Implement matching spec + constitution
5. Ensure implementation is testable (spec-driven)
```

### For Scout Agent

Add to scout prompt:

```markdown
## Spec Kit Research

When analyzing codebase:
1. Look for `.speckit/` folder
2. Document constitution principles
3. List existing specifications (.spec.md files)
4. Identify gaps between spec and implementation
```

### For Manager/Lead Agent

Add to manager prompt:

```markdown
## Spec-Driven Project Planning

When planning features:
1. Use `specify init` to set up SDD project (if new)
2. Create `.speckit/constitution.md` with team principles
3. Write `.speckit/*.spec.md` for each feature
4. Delegate implementation to coder with spec reference
5. Use `/speckit.check` to verify implementation matches spec
```

## File Structure

After `specify init`:

```
project/
├── .speckit/
│   ├── constitution.md          # Project principles
│   ├── implementation_hints.md   # Development guidance
│   ├── feature-*.spec.md         # Feature specifications
│   └── .speckit.config.toml      # Config
├── src/
├── tests/
└── README.md
```

## Example: Auth Feature

### 1. Constitution (established first)

```markdown
# Project Constitution

## Code Quality
- All code peer-reviewed
- Test coverage >= 80%
- No console.log in production

## Security
- Passwords bcrypt (min 10 rounds)
- HTTPS only
- CSRF protection on all forms

## Performance
- API response < 500ms
- No N+1 queries
- Gzip compression enabled
```

### 2. Specification

```markdown
# Feature: User Authentication

## User Stories
- As a user, I want to log in so I can access my account
- As an admin, I want to see login attempts so I can monitor security
- As a user, I want to stay logged in so I don't re-enter credentials

## Requirements
- Email/password login
- Session persists 24 hours (user can extend)
- Max 5 failed attempts per hour
- Rate limit: 1 request per second per IP
- Logout clears session

## Acceptance Criteria
- [ ] POST /auth/login accepts {email, password}
- [ ] Returns {sessionToken, expiresAt} on success
- [ ] Returns 401 + error message on failure
- [ ] Implements exponential backoff after 5 failures
- [ ] Session token httpOnly, secure cookie

## Tests Required
- Login success with valid credentials
- Login fails with invalid password
- Login fails with non-existent email
- Rate limiting enforced
- Session expires after 24 hours
- Logout clears session
```

### 3. Delegate to Coder

```python
transfer_task(
  agent="coder",
  task="""
  Specification: .speckit/feature-auth.spec.md
  Constitution: .speckit/constitution.md
  
  Implement user authentication feature matching spec + constitution.
  """,
  expected_output="Implemented feature with tests passing all acceptance criteria"
)
```

## Best Practices

1. **Constitution First** — Establish principles before writing specs
2. **Spec Before Code** — Write spec, then implement
3. **Executable Specs** — Specs include testable requirements
4. **Reference Specs** — Coder reads spec before implementing
5. **Verify Match** — Use `/speckit.check` to verify implementation matches spec

## Token Efficiency

Spec-Driven Development reduces token bloat:

- **Traditional**: Chat history → vague requirements → iterations → messy code
- **SDD**: Constitution → Clear spec → Single focused implementation

**Result**: Fewer delegations, better outputs, 40%+ fewer tokens per feature.

## Troubleshooting

### specify CLI not found

```bash
# Install it
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Or use temporary
uvx --from git+https://github.com/github/spec-kit.git specify check
```

### No .speckit found

```bash
# Initialize project for SDD
specify init . --ai claude
```

### Constitution too vague

Constitution should be:

- Specific (measurable, enforceable)
- Not too long (1-2 pages max)
- Focused on standards, not implementation details

Rewrite as needed; it evolves with project.

## References

- **GitHub Spec Kit Repo**: <https://github.com/github/spec-kit>
- **Spec-Driven Development Manifesto**: <https://github.com/github/spec-kit/blob/main/spec-driven.md>
- **Documentation**: <https://github.github.io/spec-kit/>
- **AGENTS.md**: <https://github.com/github/spec-kit/blob/main/AGENTS.md> (AI agent integration)

## Notes

- Spec Kit is open source (MIT license)
- Works with Claude, ChatGPT, and other AI assistants
- Can be integrated into any Python-based project
- Actively maintained by GitHub
