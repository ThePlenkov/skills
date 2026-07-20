# Harbor A/B benchmark for repository skills

This directory uses [Harbor](https://github.com/harbor-framework/harbor) to run the same prompts with and without skills, on the same agent, and to measure **speed**, **token cost**, and **accuracy**.

## What's inside

```text
harbor/
├── tasks/                         # local dataset (tasks as subdirectories)
│   ├── skillmaker-create-skill/
│   └── investigate-before-edit/
├── agents/
│   └── devin/                     # Devin ACP registry entry
│       ├── agent.json             # ACP distribution manifest for Devin CLI
│       ├── agent.toml             # Harbor agent metadata
│       ├── devin_agent.py         # optional installed-agent skeleton
│       └── README.md
├── run-smoke.sh                   # quick oracle smoke test (no LLM)
├── run-overview.sh                # full oracle A/B smoke test + comparison
├── run-without-skills.sh          # baseline, no skills
├── run-with-skills.sh             # run with skills injected
├── compare.py                     # extract accuracy/time/tokens from two job dirs
├── results/
│   └── oracle-smoke.md            # latest oracle A/B report
└── README.md
```

## Prerequisites

- Docker Desktop (or another Harbor backend)
- [uv](https://docs.astral.sh/uv/) or `pip`
- `harbor` CLI:

```bash
uv tool install harbor
# or
pip install harbor
```

- For running with a real agent: API keys for the chosen model (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.)
- For running with Devin: a Devin API key / token (`DEVIN_API_KEY` or whatever `devin` CLI expects)

## Smoke test (oracle)

The oracle agent is deterministic and needs no LLM. It verifies that tasks and verifiers work end-to-end.

```bash
cd harbor
./run-smoke.sh
# or the full A/B comparison
./run-overview.sh
```

`./run-overview.sh` writes a report to `results/oracle-smoke.md`.

## A/B run: with vs without skills

Harbor injects skills via `--skill <path>`. The same tasks and prompts are used in both runs.

```bash
cd harbor

# Baseline: no skills
./run-without-skills.sh <agent> <model>

# With skills: inject the real skills from the repository
./run-with-skills.sh <agent> <model>
```

Example with Claude Code:

```bash
./run-without-skills.sh claude-code anthropic/claude-sonnet-4.5
./run-with-skills.sh claude-code anthropic/claude-sonnet-4.5
```

## Devin ACP agent

`agents/devin/agent.json` is a complete ACP registry entry for the Devin CLI. It declares binary distributions for Linux, macOS, and Windows with SHA-256 checksums. `install-devin.sh` pins the Devin CLI version to the one declared in `agent.json` and fetches the matching manifest from `https://static.devin.ai/cli/<version>/manifest.json`.

Run Devin through Harbor's ACP runner with:

```bash
./run-devin.sh <model>
```

`run-devin.sh` passes the Devin ACP entry to the generic A/B scripts:

```bash
./run-without-skills.sh acp \
  --agent-kwarg registry_entry_path=./agents/devin/agent.json \
  -m <model>

./run-with-skills.sh acp \
  --agent-kwarg registry_entry_path=./agents/devin/agent.json \
  -m <model>
```

Make sure the environment has a valid Devin token (`DEVIN_API_KEY`). `run-devin.sh` forwards it to Harbor via `--agent-env`, which is the mechanism Harbor exposes for passing secrets to the agent sandbox. Keep the token out of logs and shell history.

For example:

```bash
DEVIN_API_KEY=... ./run-devin.sh openai/gpt-4.1
```

## Compare results

```bash
python3 compare.py results/oracle-jobs/without-<ts> results/oracle-jobs/with-<ts>
```

This prints:
- accuracy (mean reward)
- total wall-clock time
- total token usage

## Notes

- The `instruction.md` in each task is identical for the with-skill and without-skill runs. Only the injected skills differ.
- Skills are injected by path, e.g. `--skill ../skills/tools/skillmaker`. Harbor copies the skill directory into the sandbox.
- The `bench/` directory at the repository root is an earlier BenchFlow/SkillsBench draft and can be removed once Harbor setup is verified.
