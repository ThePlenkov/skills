# Devin agent for Harbor

## 1. ACP (recommended)

Devin CLI supports `devin acp`, which runs Devin as an ACP server over stdio.

```bash
harbor run -p tasks \
  -a acp \
  --agent-kwarg registry_entry_path=./agents/devin/agent.json \
  -m <model>
```

For an A/B comparison, use the helpers in the repository root:

```bash
./run-devin.sh <model>
```

Requirements:
- Network access to `https://static.devin.ai/cli/...` so Harbor can download the Devin CLI binary for the ACP agent.
- A valid Devin API token exported as `DEVIN_API_KEY` (or `DEVIN_API_SECRET`).

`agents/devin/agent.json` is a complete ACP registry entry. It lists binary distributions for Linux, macOS, and Windows with SHA-256 checksums from the official Devin CLI manifest.

## 2. Installed agent

`devin_agent.py` is a skeleton `BaseInstalledAgent` subclass that runs `devin -p <instruction>` inside the sandbox. It is mainly useful for a custom base image where `devin` is already installed and authenticated.

```bash
harbor run -p tasks \
  -a harbor.agents.devin.devin_agent:DevinAgent \
  -m <model>
```
