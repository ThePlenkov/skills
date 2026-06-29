---
name: deepwiki
description: >-
  Analyze public GitHub repositories using DeepWiki's AI-generated documentation.
  Use when code from a GitHub repo must be analyzed, scanned, or understood.
  Spawns a background subagent so analysis never blocks the current thread.
---

# DeepWiki — GitHub Repository Analysis

Use DeepWiki to analyze, scan, or understand any **public** GitHub repository.
DeepWiki generates AI-powered documentation wikis and can answer questions
grounded in a repo's actual code.

## When to use

- Understanding architecture or internals of a GitHub dependency
- Researching how an open-source library works before adopting it
- Answering "how does X work in repo Y?" questions
- Comparing two GitHub projects' approaches
- Scanning a repo's structure before diving into source code

## MCP connection

DeepWiki is a **remote** MCP server — no secrets required.

### If `docker-mcp` gateway is available

```
mcp-find({"query": "deepwiki"})
mcp-add({"name": "deepwiki", "activate": false})
mcp-exec({"name": "deepwiki__ask_question", "arguments": {"repoName": "owner/repo", "question": "..."}})
```

### If DeepWiki is a pre-configured MCP server

The agent runtime already has the DeepWiki MCP server registered (via
the host's MCP config). Use the standard `mcp_call_tool` runtime API
to invoke its tools — do **not** read or parse the MCP config file.

Use `mcp_call_tool` directly:

```
mcp_call_tool(server_name="deepwiki", tool_name="ask_question", arguments={"repoName": "owner/repo", "question": "..."})
```

## Tools

| Tool | Key args | Description |
|------|----------|-------------|
| `read_wiki_structure` | `repoName` (`owner/repo`) | List documentation topics for a repo |
| `read_wiki_contents` | `repoName`, `topic` | Read documentation for a specific topic |
| `ask_question` | `repoName`, `question` | AI-powered Q&A grounded in the repo's code |

## Workflow — always non-blocking

When DeepWiki analysis is needed, **spawn a background subagent** so the
current thread continues working. Never call DeepWiki tools directly from
the main thread if other work is pending.

### Step 1: Launch background subagent

```
run_subagent(
  title="DeepWiki: <short description>",
  is_background=true,
  profile="subagent_explore",
  task="""
Analyze the GitHub repository <owner/repo> using DeepWiki MCP tools.

## Setup
1. List available MCP servers with mcp_list_tools to check if "deepwiki" is available.
2. If deepwiki MCP is available, use mcp_call_tool(server_name="deepwiki", ...).
3. If deepwiki MCP is NOT available but docker-mcp gateway is available:
   - mcp_call_tool(server_name="docker-mcp", tool_name="mcp-find", arguments={"query": "deepwiki"})
   - mcp_call_tool(server_name="docker-mcp", tool_name="mcp-add", arguments={"name": "deepwiki", "activate": false})
   - Then use mcp_call_tool(server_name="docker-mcp", tool_name="mcp-exec", arguments={"name": "deepwiki__<tool>", ...})
4. If neither is available, report that DeepWiki MCP is not configured.

## Task
<detailed analysis instructions — what to look for, what questions to ask>

## Output
Return a structured summary of findings.
"""
)
```

### Step 2: Continue working

Do other work. The subagent notification arrives automatically when done.

### Step 3: Read results

```
read_subagent(agent_id=<id>, block=false)
```

Incorporate the findings into your response.

## Examples

### Understand a dependency's architecture

```
run_subagent(
  title="DeepWiki: analyze fastify internals",
  is_background=true,
  profile="subagent_explore",
  task="""
Analyze the GitHub repository fastify/fastify using DeepWiki MCP.

Setup: check mcp_list_tools for "deepwiki" server availability, then use
mcp_call_tool accordingly (see deepwiki skill for connection details).

Steps:
1. read_wiki_structure for fastify/fastify to see available topics
2. read_wiki_contents for the plugin system and routing topics
3. ask_question: "How does Fastify's plugin encapsulation work?"

Return: summary of plugin architecture and routing internals.
"""
)
```

### Compare two libraries

```
run_subagent(
  title="DeepWiki: compare express vs fastify",
  is_background=true,
  profile="subagent_explore",
  task="""
Compare expressjs/express and fastify/fastify using DeepWiki MCP.

Setup: check mcp_list_tools for "deepwiki" server availability, then use
mcp_call_tool accordingly (see deepwiki skill for connection details).

Steps:
1. read_wiki_structure for both repos
2. ask_question on each: "What is the request lifecycle and middleware model?"
3. Summarize key architectural differences

Return: comparison table of architecture, performance model, and plugin systems.
"""
)
```

## Limitations

- Only works with **public** GitHub repositories
- DeepWiki generates docs on first request — initial calls may be slower
- Repo name format must be `owner/repo` (e.g., `vercel/next.js`)
