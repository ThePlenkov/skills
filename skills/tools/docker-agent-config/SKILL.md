---
name: docker-agent-config
description: "Design, configure, and run multi-agent AI teams using the Docker Agent CLI plugin. Use when creating docker agent YAML/HCL configs, building sub-agent teams, or needing the schema for agents, models, toolsets, distribution, and CLI. NOT for general Docker, docker-compose, or non-Docker frameworks."
---

# Docker Agent — Configuration & Runtime

Docker Agent is a multi-agent runtime and Docker CLI plugin (`docker agent`) that
lets you define teams of AI agents declaratively in YAML or HCL, rather than
wiring LLMs and tools together in code. You interact with a root agent, which
can delegate work to specialized sub-agents that have different models, tools,
and instructions.

This skill is the **conceptual and structural backbone for generating real
Docker Agent configs**: given a set of roles, models, tools, and constraints, it
guides how to map them into valid YAML/HCL that Docker Agent can run, share, and
orchestrate.

## Core concepts

- **Agent** — AI entity with a model, description, instructions, tools, and optional sub-agents.
- **Root agent** — the default entry point for user messages; coordinates other agents.
- **Team** — the collection of agents defined in the config and loaded into a runtime.
- **Runtime** — execution engine (local or remote) that streams events, runs tools, and manages sessions.
- **Session** — conversation state (messages, token usage, cost, working directory), usually persisted in SQLite.

## Configuration file structure

Docker Agent uses a single configuration file (YAML or HCL) to define agents,
models, tools, and relationships. Top-level sections: `agents` (required), plus
optional `models`, `providers`, permissions, and runtime settings. YAML is the
default; HCL configs are supported and normalized into the same internal
schema.

Minimal example (conceptual):

```yaml
agents:
  root:
    model: anthropic/claude-sonnet-4-5
    description: A helpful coding assistant
    instruction: |
      You are an expert software developer.
      Help users write clean, efficient code
      and explain your reasoning.
    toolsets:
      - type: think
      - type: filesystem
      - type: shell
```

Running `docker agent run agent.yaml` starts the interactive TUI for this agent.

## Agent definition schema

Each agent is defined by a structured set of fields that describe its model,
role, behavior, tools, and relationships.

### Required fields

- `model` — the model powering the agent (e.g. `anthropic/claude-sonnet-4-5`, `openai/gpt-4o`, `google/gemini-3.5-flash`).
- `description` — short text used by other agents to understand and select this agent for delegation.
- `instruction` — system prompt defining behavior, persona, and constraints.

### Common optional fields

- `toolsets` — list of toolset configurations granting capabilities (filesystem, shell, MCP, etc.).
- `sub_agents` — list of agent names or external agent references this agent can delegate to.
- `fallback` (or model fallback fields) — configuration for alternative models and retry behavior.
- `commands` — named prompts that can be invoked via commands (like `/df` or `/greet`) in the TUI.
- `skills` — enables skill discovery and loading, combining local skills and remote skill servers.
- `max_iterations` — limits how many tool-use iterations the runtime will perform per request.
- Flags to add contextual metadata (current date, environment info) into the agent's prompt.

The first agent in the file, or the agent named `root`, is treated as the root
agent by default, though you can override it on the CLI.

## Models and provider configuration

An agent's `model` field controls how Docker Agent resolves and instantiates
the underlying provider. Supported providers include OpenAI, Anthropic (Claude),
Google Gemini, AWS Bedrock, Docker Model Runner (local models), and others,
with reusable provider definitions and shared defaults.

Patterns:

- **Direct model name** — `model: openai/gpt-4o` or `model: anthropic/claude-sonnet-4-5` uses a specific provider/model pair.
- **Named model** — define models in a separate `models:` section and reference them by name to reuse options and routing rules.
- **Auto-selection** — `model: auto` triggers an automatic provider selection based on available API keys, with a fixed priority order (Anthropic → OpenAI → Google → Mistral → Amazon Bedrock → Docker Model Runner).

The configuration reference documents additional model parameters such as
temperature, max tokens, and thinking/effort budgets for reasoning models. Model
fallback behavior is configured either per agent or via shared model
settings, allowing the runtime to switch to backup models on errors or rate
limits, with cooldowns to avoid thrashing.

## Toolsets: granting capabilities

Tools are how agents interact with their environment. Toolsets are declarative
blocks that attach groups of tools to an agent, described in YAML under
`toolsets`.

Common built-in toolsets:

- `filesystem` — read/write/edit files, list directories, show directory tree, search file contents, with sandboxed path control.
- `shell` — execute shell commands, optionally with background job management and streaming output.
- `think` — internal reasoning scratchpad to keep structured thoughts separate from user-visible answers.
- `todo` / tasks — track and manage tasks within the agent.
- `memory` — persistent user memory storage backed by SQLite: add, search, update, delete memories.
- `fetch` — retrieve web content via HTTP(S), obeying robots.txt and SSRF protection by default.
- `api` — call simple JSON HTTP endpoints, with schema-validated parameters and interpolation in URLs and headers.
- `openapi` — import an entire OpenAPI spec, exposing each operation as a separate tool for the agent.
- `lsp` — Language Server Protocol tools for code navigation, diagnostics, and editor-like intelligence.
- `a2a` — Agent-to-Agent protocol tools for delegating tasks to remote agents.
- `mcp` — Model Context Protocol toolsets for integrating external MCP servers (local processes, Docker containers, remote HTTP).

Each toolset type has its own configuration schema (e.g. `command` and
`file_types` for LSP, `endpoint` and `method` for API, `ref` for MCP), described
in the Tool Configuration reference.

## MCP and external tools

MCP (Model Context Protocol) tools connect agents to external servers that
provide domain-specific functionality (search, GitHub, databases, custom
services).

Key points:

- MCP toolsets are declared with `type: mcp` and a reference, e.g. `ref: docker:duckduckgo` or `ref: docker:github-official`.
- Docker Agent can run MCP servers locally (via stdio), inside Docker, or connect to remote MCP servers over HTTP/SSE, often with OAuth2.
- MCP toolsets use lifecycle supervision with automatic restart and state reporting, and they expose tools discovered from the MCP server as agent tools.
- Agents can also use a built-in `mcp_catalog` toolset (the "MCP Catalog" in the docs) to search and enable remote MCP servers dynamically from a curated catalog.

## Sessions, memory, and RAG

Docker Agent treats each run of an agent as a session, capturing messages, tool
calls, and usage in a structured session object.

Session behavior:

- Sessions store message history as a mix of messages, sub-sessions (nested conversations from task transfers), and summaries.
- Token usage and cost are tracked per session and per message, with lazy persistence to SQLite.
- When history approaches model context limits, the runtime can compact sessions by summarizing older messages and keeping a "recent window".

For retrieval-augmented generation (RAG), Docker Agent can connect to embedding
and reranking providers and RAG databases through tools and model extensions;
this is leveraged in example agents that analyze code, logs, or financial data.

## Multi-agent patterns

Beyond single-agent configurations, Docker Agent encourages multi-agent teams
where each agent has a focused role.

Typical patterns from documentation and examples:

- **Investigator + fixer** — a bug analyzer team where the investigator diagnoses issues and then hands off implementation to a fixer agent with coding tools.
- **Planner / executor / librarian** — a coding team where a planner gathers requirements and creates a plan, an executor edits code and runs tests, and a librarian fetches documentation or external context.
- **Coordinator with external sub-agents** — a root agent that delegates tasks to agents defined locally and to pre-built agents from the catalog (e.g. `agentcatalog/coder`).

Sub-agents are configured by listing agent names or external references under
`sub_agents`, and the runtime uses dedicated tools to transfer tasks and
conversation context to those agents.

## Distribution and sharing

Agent configurations can be packaged and distributed as OCI artifacts, just
like container images.

- **Push agents** — `docker agent share push ./debugger.yaml myusername/debugger` uploads a config as an OCI artifact.
- **Pull agents** — `docker agent share pull myusername/debugger` or `docker agent run agentcatalog/coder` runs agents from a registry or catalog.
- **Run by HTTP** — configs can also be fetched over HTTP (e.g. `docker agent run https://example.com/agent.yaml`) for local development.

Aliases can override defaults: you can alias a config to `default`, so
`docker agent run` uses your own agent instead of the built-in one.

## CLI and execution modes

Docker Agent's CLI provides several execution modes, all using the same
underlying runtime.

Main commands:

- `docker agent run [config]` — run an agent; by default starts an interactive TUI, or non-interactive exec when `--exec` or stdout is not a terminal.
- `docker agent new` — interactive wizard to scaffold a config file (`agent.yaml`), optionally with preselected model and max iterations.
- `docker agent serve api` — start an HTTP API server with endpoints to manage agents and sessions.
- `docker agent serve chat` — OpenAI-compatible chat server exposing `/v1/chat/completions`.
- `docker agent serve mcp` / `serve a2a` — start MCP or A2A servers for external clients.
- `docker agent share push/pull` — push/pull agent configs as OCI artifacts.
- `docker agent alias` — manage human-friendly aliases for configs, including overriding the default agent.
- `docker agent eval` — run automated evaluations of agents, logging results for analysis.

Flags such as `--exec`, `--yolo`, `--json`, `--session`, `--sandbox`, and
`--model` shape runtime behavior: non-interactive runs, auto-approving tools,
JSON event output, resuming sessions, sandboxing execution, and overriding
models per run.

## Terminal UI and API interfaces

Docker Agent exposes several interfaces built on the same runtime core.

- **Terminal UI (TUI)** — interactive terminal interface showing streaming agent responses, tool calls, reasoning blocks, and sidebars for session metadata and tools.
- **CLI exec** — headless execution via `run --exec`, ideal for scripts and one-shot tasks, with optional JSON output.
- **HTTP API server** — REST + SSE interface for programmatic control of agents and sessions.
- **OpenAI-compatible chat server** — for existing clients that speak the OpenAI Chat Completions API.
- **MCP and A2A servers** — agent-aware servers that expose tools and agent capabilities to external orchestrators, including MCP clients.

All of these interfaces share the same event-driven runtime: events represent
user messages, agent choices, tool calls, tool results, token usage, and errors.

## Design guidelines

When using this skill to generate configurations, follow these principles:

- **Single responsibility per agent** — give each agent a clear, narrow role expressed in `description` and `instruction`; use multiple agents instead of one overly general agent.
- **Explicit tools** — attach only the tools each agent genuinely needs (`filesystem` for coding, `fetch` or MCP for web/RAG, `shell` for scripts), and consider security: sandbox filesystem and gate shell with confirmations.
- **Model choice and fallback** — prefer high-capability models for planners and complex coding, cheaper or faster models for simple queries or code review; configure fallback models to handle transient provider issues.
- **Sub-agent delegation** — use `sub_agents` and delegation tools to offload specialist work: planners delegate coding, coders delegate documentation search, coordinators delegate analysis.
- **Session and memory** — enable persistent memory when user preferences and long-term state matter; use compaction and RAG tools when conversations are long and context-heavy.
- **Distribution and reuse** — package useful agents in OCI registries and reuse them as sub-agents or catalog references; design configs to be portable and self-contained.

## References

- Docker Agent landing — https://docs.docker.com/ai/docker-agent/
- Introduction — https://docs.docker.com/ai/docker-agent/getting-started/introduction/
- Agent concepts — https://docs.docker.com/ai/docker-agent/concepts/agents/
- Agent configuration — https://docs.docker.com/ai/docker-agent/configuration/agents/
- Tool configuration — https://docs.docker.com/ai/docker-agent/configuration/tools/
- Configuration reference — https://docs.docker.com/ai/docker-agent/reference/config/
- CLI reference — https://docs.docker.com/ai/docker-agent/reference/cli/
- Sharing agents (OCI distribution) — https://docs.docker.com/ai/docker-agent/sharing-agents/
- Tutorial (bug-analyzer team) — https://docs.docker.com/ai/docker-agent/tutorial/
