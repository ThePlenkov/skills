export interface SkillMetadata {
  frontmatter?: {
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export const defaultSkillMetadata: SkillMetadata = {
  frontmatter: {
    metadata: {
      source: "theplenkov-ai/skills",
    },
  },
};

export const skillMetadata: Record<string, SkillMetadata> = {
  "act": {
    frontmatter: {
      metadata: {
        "disable-model-invocation": false,
        "compatibility": "Requires gh, jq, git, bun, node.",
        "tier": 2,
        "triggers": ["user", "model"],
        "allowed-tools": ["read", "exec", "write", "edit", "web_search", "web_get_contents", "grep", "message_user"],
        "conflicts_with": ["github-pr-review", "code-review-and-quality"],
      },
    },
  },
  "adhd": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "api-and-interface-design": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "architecture-review": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob, exec",
        "argument-hint": "<repository path or focus area, optional review scope>",
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "backlog": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "bootstrap-gh-self-hosted-runner": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user"],
        "allowed-tools": ["read", "exec", "edit", "write"],
      },
    },
  },
  "bootstrap-ts-repo": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "allowed-tools": ["read", "exec", "web_search", "web_get_contents", "edit", "write", "grep"],
      },
    },
  },
  "ci-cd-and-automation": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "ci-local": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "claude-skills": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "codacy": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "code-review-and-quality": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "conflicts_with": ["github-pr-review"],
      },
    },
  },
  "code-simplification": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "codehome": {
    frontmatter: {
      metadata: {
        "argument-hint": "[optional file, feature, or concern]",
        "tier": 2,
        "triggers": ["user"],
        "allowed-tools": ["read", "grep", "glob", "exec", "edit", "write"],
        "permissions": {
          "allow": ["Read(*)", "Grep(*)", "Glob(*)", "Exec(git status --short)", "Exec(git diff --stat)", "Exec(git diff)", "Exec(*test*)", "Exec(*lint*)", "Exec(*typecheck*)"],
          "deny": []
        },
      },
    },
  },
  "codescene": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "context-engineering": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "critical-thinking": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "debugging": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob, exec",
        "argument-hint": "<symptom, error message, failing command, or reproduction steps>",
        "tier": 2,
        "triggers": ["user", "model"],
        "conflicts_with": ["investigate-first", "one-shot-patch"],
      },
    },
  },
  "deepwiki": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "dep-cost": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "docker-agent-config": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "dotagents": {
    frontmatter: {
      metadata: {
        "permissions": {
          "modify-skill-files": true,
          "modify-agent-config": true,
          "scope": "opt-in per user invocation; never runs automatically"
        },
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "doubt-driven-development": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "conflicts_with": ["investigate-first", "critical-thinking"],
      },
    },
  },
  "drill": {
    frontmatter: {
      metadata: {
        "tags": ["context-isolation", "scope-management", "filesystem-materialization", "session-tracking", "delegation"],
        "author": "petr-plenkov",
        "version": "1.1.0",
        "tier": 2,
        "triggers": ["user"],
        "disable-model-invocation": true,
      },
    },
  },
  "e2e": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "disable-model-invocation": false,
      },
    },
  },
  "evidence": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob, write, exec",
        "permissions": {
          "bash": "ask",
          "edit": "ask",
          "write": "ask"
        },
        "argument-hint": "<task or claim to evidence> [lite|full]",
        "disable-model-invocation": true,
        "triggers": ["user", "model"],
        "tier": 2,
      },
    },
  },
  "evidence-lite": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob, write, exec",
        "permissions": {
          "bash": "ask",
          "edit": "ask",
          "write": "ask"
        },
        "argument-hint": "<trivial change to verify>",
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "external-tools": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "external-research": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "frontend-ui-engineering": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "git-commit": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "git-push": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "git-reset": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "disable-model-invocation": false,
      },
    },
  },
  "git-workflow-and-versioning": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "github-fix-main": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "github-pr-review": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "conflicts_with": ["code-review-and-quality"],
      },
    },
  },
  "gitlab-ci-local": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "glean": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "handoff": {
    frontmatter: {
      metadata: {
        "upstream": "mattpocock/skills",
        "upstream_path": "skills/productivity/handoff/",
        "note": "Adapted from mattpocock/skills. Path resolution swapped from a single OS temp directory to \"OS temp handoff body + per-worktree `.agents/handoffs/latest.md` pointer\" so `/clear` sessions on the same machine can find handoffs across git worktrees.",
        "disable-model-invocation": false,
        "tier": 2,
        "triggers": ["user", "model"],
        "argument-hint": "what the next session will focus on | resume",
      },
    },
  },
  "harvest": {
    frontmatter: {
      metadata: {
        "disable-model-invocation": true,
        "compatibility": "Requires gh, jq, bun; writes to .agents/review-debt/harvests/ and main.",
        "tier": 2,
        "triggers": ["user"],
      },
    },
  },
  "idea-refine": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "incremental-implementation": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "conflicts_with": ["loop-programming"],
      },
    },
  },
  "interview-me": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "investigate-first": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob, exec",
        "argument-hint": "<bug, file, feature, failing command, or investigation target>",
        "tier": 2,
        "triggers": ["user", "model"],
        "conflicts_with": ["debugging", "one-shot-patch"],
        "depends_on": ["minimal-root-cause"],
      },
    },
  },
  "loop-programming": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob, edit, write, exec",
        "argument-hint": "<goal plus validators, e.g. \"fix auth tests; npm test -- auth\">",
        "tier": 2,
        "triggers": ["user", "model"],
        "conflicts_with": ["incremental-implementation"]
      },
    },
  },
  "minimal-root-cause": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob, exec",
        "argument-hint": "<planned change or bug fix>",
        "tier": 2,
        "triggers": ["user", "model"],
        "conflicts_with": ["investigate-first", "debugging", "one-shot-patch"],
      },
    },
  },
  "minimalist": {
    frontmatter: {
      metadata: {
        "argument-hint": "[lite|full|ultra|off|review|audit|debt|gain|help]",
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "modern-stack": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "allowed-tools": ["read", "exec", "web_search", "web_get_contents", "grep"],
      },
    },
  },
  "nodejs": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "allowed-tools": ["read", "exec", "web_search", "web_get_contents", "grep"],
      },
    },
  },
  "npm-publish": {
    frontmatter: {
      metadata: {
        "permissions": {
          "network": "registry.npmjs.org",
          "scope": "packages explicitly opted in via `npm publish` from a clean checkout"
        },
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "observability-and-instrumentation": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "one-shot-patch": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob, edit, write, exec",
        "argument-hint": "<exact files plus one fix hypothesis>",
        "tier": 2,
        "triggers": ["user", "model"],
        "conflicts_with": ["investigate-first", "debugging"],
      },
    },
  },
  "performance-investigation": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob, exec",
        "argument-hint": "<symptom, target workload, expected vs actual numbers>",
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "performance-optimization": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "persistent-memory": {
    frontmatter: {
      metadata: {
        "tier": 1,
        "triggers": ["user"],
      },
    },
  },
  "prototype": {
    frontmatter: {
      metadata: {
        "upstream": "mattpocock/skills",
        "upstream_path": "skills/engineering/prototype/",
        "note": "Adapted from mattpocock/skills. Sub-files in references/ are the two branch guides.",
        "allowed-tools": "read, grep, glob, edit, write, exec",
        "disable-model-invocation": true,
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "refactoring": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob, exec, edit, write",
        "argument-hint": "<target area, refactor type, scope limits>",
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "repository-onboarding": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob, exec",
        "argument-hint": "<repository path or URL, optional focus area>",
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "resolving-merge-conflicts": {
    frontmatter: {
      metadata: {
        "upstream": "mattpocock/skills",
        "upstream_path": "skills/engineering/resolving-merge-conflicts/",
        "note": "Adapted from mattpocock/skills.",
        "allowed-tools": "read, grep, glob, exec",
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "retrospect": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "reuse-first": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "review-methodology": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "safeguard": {
    frontmatter: {
      metadata: {
        "argument-hint": "[optional reason for destructive action]",
        "tier": 2,
        "triggers": ["user", "model"],
        "allowed-tools": ["read", "grep", "glob", "exec", "write"],
        "permissions": {
          "allow": ["Read(*)", "Grep(*)", "Glob(*)", "Exec(git status --short)", "Exec(git status --porcelain=v1)", "Exec(git diff --binary)", "Exec(git diff --cached --binary)", "Exec(git diff --stat)", "Exec(git ls-files --others --exclude-standard)", "Exec(mkdir -p *)", "Exec(cp *)", "Exec(tar *)", "Exec(git branch checkpoint/*)"],
          "deny": ["Exec(*reset*hard*)", "Exec(*checkout*all*)", "Exec(*restore*working*)", "Exec(*git*restore*)", "Exec(*clean*untracked*)", "Exec(*git*clean*)", "Exec(*recursively*force*)", "Exec(*find*delete*)", "Exec(*find*-exec*)", "Exec(*find*-execdir*)", "Exec(*find*exec*)", "Exec(*xargs*rm*)", "Exec(*truncate*)"]
        },
      },
    },
  },
  "salvage": {
    frontmatter: {
      metadata: {
        "argument-hint": "[optional lost file or directory]",
        "tier": 2,
        "triggers": ["user"],
        "allowed-tools": ["read", "grep", "glob", "exec", "write"],
        "permissions": {
          "allow": ["Read(*)", "Grep(*)", "Glob(*)", "Exec(git status --short)", "Exec(git reflog *)", "Exec(git fsck *)", "Exec(git stash list)", "Exec(git log *)", "Exec(git show *)", "Exec(git diff *)", "Exec(find *)", "Exec(mkdir -p *)", "Exec(cp *)", "Exec(tar *)"],
          "deny": ["Exec(*clean*untracked*)", "Exec(*git*clean*)", "Exec(*reset*hard*)", "Exec(*restore*working*)", "Exec(*git*restore*)", "Exec(*recursively*force*)", "Exec(*find*delete*)", "Exec(*find*-exec*)", "Exec(*find*-execdir*)", "Exec(*find*exec*)"]
        },
      },
    },
  },
  "sandboxed": {
    frontmatter: {
      metadata: {
        "argument-hint": "[optional experiment name or root objective]",
        "tier": 2,
        "triggers": ["user", "model"],
        "disable-model-invocation": false,
        "allowed-tools": ["read", "grep", "glob", "exec", "edit", "write"],
        "permissions": {
          "allow": ["Read(*)", "Grep(*)", "Glob(*)", "Exec(git rev-parse --show-toplevel)", "Exec(git status --short)", "Exec(git status --porcelain=v1)", "Exec(git branch --show-current)", "Exec(git worktree list)", "Exec(git worktree add *)", "Exec(git switch -c agent/*)", "Exec(git add *)", "Exec(git commit *)", "Exec(git diff)", "Exec(git diff --stat)", "Exec(git diff --binary)", "Exec(git diff --cached --binary)", "Exec(git ls-files --others --exclude-standard)", "Exec(mkdir -p *)", "Exec(tar *)", "Exec(cp *)", "Exec(*test*)", "Exec(*lint*)", "Exec(*typecheck*)"],
          "deny": ["Exec(*reset*hard*)", "Exec(*clean*untracked*)", "Exec(*restore*working*)", "Exec(*recursively*force*)"]
        },
      },
    },
  },
  "sarif-to-annotations": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "save-session": {
    frontmatter: {
      metadata: {
        "tags": ["productivity", "workflow", "persistence", "handoff"],
        "author": "codex",
        "version": "1.0.0",
        "tier": 2,
        "triggers": ["user", "model"],
        "disable-model-invocation": false,
      },
    },
  },
  "security-and-hardening": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "shadow-fork": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "shared-plan": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "skill-feedback": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "compatibility": "Requires gh (authenticated), jq. Network access to api.github.com.",
        "argument-hint": "<skill-name>"
      },
    },
  },
  "skill-tiers": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "skillmaker": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "allowed-tools": ["read", "write", "edit", "bash", "grep", "glob"],
      },
    },
  },
  "skills-cli": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "source-driven-development": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "sourcegraph": {
    frontmatter: {
      metadata: {
        "upstream": "sourcegraph/docs",
        "upstream_path": "docs/cli/, docs/deep-search/, docs/code-search/",
        "refresh_via": "DeepWiki MCP at https://mcp.deepwiki.com/mcp (see references/refresh.md)",
        "refresh_via_alt": "https://docs.devin.ai/work-with-devin/deepwiki-mcp",
        "tier": 2,
        "triggers": ["user", "model"],
        "depends_on": ["external-research"]
      },
    },
  },
  "spec-driven-development": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "subagent-capsule": {
    frontmatter: {
      metadata: {
        "allowed-tools": "read, grep, glob",
        "argument-hint": "<subagent profile and isolated subtask>",
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "test-driven-development": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "token-rationalism": {
    frontmatter: {
      metadata: {
        "tier": 0,
        "triggers": ["always"],
      },
    },
  },
  "triage-issue": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "tsdown": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "allowed-tools": ["read", "exec", "web_search", "web_get_contents", "grep"],
      },
    },
  },
  "two-axis-review": {
    frontmatter: {
      metadata: {
        "upstream": "mattpocock/skills",
        "upstream_path": "skills/engineering/code-review/",
        "note": "Adapted from mattpocock/skills. Renamed from `code-review` to `two-axis-review` to avoid collision with the existing `code-review/` category; the discipline (Standards + Spec) is the contribution.",
        "allowed-tools": "read, grep, glob, exec, run_subagent",
        "argument-hint": "<fixed-point ref, e.g. \"main\", \"HEAD~5\", \"abc1234\">",
        "tier": 2,
        "triggers": ["user", "model"],
        "conflicts_with": ["github-pr-review", "code-review-and-quality"],
      },
    },
  },
  "typescript": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
        "allowed-tools": ["read", "exec", "web_search", "web_get_contents", "grep"],
      },
    },
  },
  "unwind": {
    frontmatter: {
      metadata: {
        "argument-hint": "[optional root objective or direction]",
        "tier": 2,
        "triggers": ["user", "model"],
        "disable-model-invocation": false,
        "allowed-tools": ["read", "grep", "glob", "exec", "edit", "write", "run_subagent"],
        "permissions": {
          "allow": ["Read(*)", "Grep(*)", "Glob(*)", "Exec(git status --short)", "Exec(git diff --stat)", "Exec(git diff)", "Exec(*test*)", "Exec(*lint*)", "Exec(*typecheck*)", "run_subagent"],
          "deny": []
        },
      },
    },
  },
  "using-agent-skills": {
    frontmatter: {
      metadata: {
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
  "writing-great-skills": {
    frontmatter: {
      metadata: {
        "upstream": "mattpocock/skills",
        "upstream_path": "skills/productivity/writing-great-skills/",
        "note": "Adapted from mattpocock/skills. GLOSSARY.md is the canonical source of vocabulary.",
        "disable-model-invocation": false,
        "tier": 2,
        "triggers": ["user", "model"],
      },
    },
  },
};

