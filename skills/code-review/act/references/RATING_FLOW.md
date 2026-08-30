# Master-Model Rating Flow (P5)

**Goal:** measure which PR review tools are worth keeping. The master model
running `/act` rates every finding 0–5. Per-run ratings are always captured in
`tmp/agent_<pid>/scores-report.jsonl` (scratch, gitignored). The persistent
research dataset at `.agents/act/review_scores.csv` is **OFF by default** and
updated only when the run explicitly opts in (`--record`, `ACT_RECORD_SCORES=1`,
or `.agents/act/config.json` `{"record_scores": true}`).

**Why opt-in:** each row is a research artefact, not a project artefact.
Growing the file on every `/act` runs adds a commit per PR and pollutes
history for users who are not actively analysing the dataset. The scratch
JSONL preserves every rating the master model produces; only the persistent
CSV is gated.

## Design principle (read first)

A script call is **one tool call** at fixed context cost. An agent step costs a
tool call _plus_ output _plus_ reasoning, and compounds. So the agent is invoked
only for the **irreducible judgment** (the 0–5 and a one-line why). All
mechanics — fetch, parse, join, latency, CSV quoting, dedupe — live in the
scripts. The agent never re-echoes data a script already holds. See
[AGENTS.md → Orchestrator self-instructions](../../../AGENTS.md).

## Three steps

### 1. Extract — 1 tool call (max context, zero reasoning)

```bash
# GitHub
bun scripts/extract-findings.ts OWNER REPO PR > tmp/agent_xyz/findings.jsonl
# GitLab (subgroups: GROUP/SUBGROUP PROJECT MR_IID)
bun scripts/extract-findings.ts GROUP PROJECT MR_IID > tmp/agent_xyz/findings.jsonl
```

Emits one finding per line — check-run annotations / MR vulnerability findings
(`code_scan`) and top-level inline review comments / diff-note discussions
(`code_review`) — each already carrying everything:

```json
{
  "finding_id": "scan:101:0",
  "type": "code_scan",
  "tool_name": "Codacy Static Code Analysis",
  "finding_url": "https://…/runs/101",
  "summary": "Unquoted variable, may glob",
  "file": "scripts/x.sh",
  "line": 12,
  "commit_timestamp": "…",
  "detected_timestamp": "…",
  "detection_latency_ms": 45000
}
```

`finding_id` is the stable join key (`scan:<run>:<idx>` or `review:<commentId>`).
`detection_latency_ms` = detected − committed; for `code_review` it includes
reviewer availability, so split by `type` when analysing.

### 2. Rate — 0 tool calls (pure cognition)

The agent reads `findings.jsonl` (already in context) and writes a **3-column
TSV** — only what it alone can produce:

```tsv
finding_id    rating    reasoning
scan:101:0    4    Real bug: $VAR unquoted, breaks on spaces
review:202    2    Valid but low-impact style nit
```

Rating scale: **0** noise/false-positive · **1** marginal · **2** obvious/low
impact · **3** correct, real · **4** subtle catch · **5** would prevent an
incident. No URLs, summaries, tool names, latency, or evaluator-per-row — the
submit step joins all of that. Write to `tmp/agent_xyz/scores.tsv`.

### 3. Submit — 1 tool call (join + scratch always, upsert only when opted in)

```bash
# Default (OFF): scratch JSONL written, CSV untouched.
bun scripts/submit-scores.ts OWNER REPO PR \
  --evaluator claude-opus-4.8 \
  --findings tmp/agent_xyz/findings.jsonl \
  --scores  tmp/agent_xyz/scores.tsv

# Opted in (CSV is updated this run):
bun scripts/submit-scores.ts OWNER REPO PR --record \
  --evaluator claude-opus-4.8 \
  --findings tmp/agent_xyz/findings.jsonl \
  --scores  tmp/agent_xyz/scores.tsv
```

Joins each score onto its finding by `finding_id`, names the evaluator **once**
via `--evaluator`, and always writes the scratch JSONL report
(`tmp/agent_<pid>/scores-report.jsonl`). When CSV recording is opted in, the
script also upserts `.agents/act/review_scores.csv`. The upsert key is
`(pr_url, finding_id, evaluator_id)` — re-running `/act` replaces prior rows
instead of duplicating them. CSV fields are RFC-4180 quoted, so commas and
quotes in reasoning are safe. Scoring posts **nothing** to GitHub; reactions and
replies remain the existing P1–P4 flow.

`--dry-run` validates the join and reports the row count without writing.

### Recording switches (priority high → low, first hit wins)

| Switch | Syntax | Lifetime |
|--------|--------|----------|
| **CLI flag** | `bun scripts/submit-scores.ts … --record` (positive) or `--no-record` (negative override) | one run |
| **Env var** | `ACT_RECORD_SCORES=1 bun scripts/submit-scores.ts …` | one shell session |
| **Config file** | `.agents/act/config.json` with `{"record_scores": true}` | until removed |
| **Default** | — | — (OFF) |

Truthy values for `ACT_RECORD_SCORES`: `1`, `true`, `yes` (case-insensitive).
The script prints `RECORDING=on|off (source)` on every run so the resolved
choice is auditable at a glance.

## CSV schema

```csv
timestamp,pr_url,finding_id,tool_name,finding_type,finding_url,evaluator_id,master_rating,master_reasoning,finding_summary,detection_latency_ms,false_positive_link
```

`false_positive_link` is left empty; backfill it post-merge if a finding is later
disproven.

## Notebook analysis

The persistent dataset lives in `.agents/act/review_scores.csv` — only populated
on opted-in runs. Per-run data (one row per finding, JSONL) is always
available under `tmp/agent_<pid>/scores-report.jsonl` from earlier runs; aggregate
them with `cat tmp/agent_*/scores-report.jsonl > all-ratings.jsonl` if you want
analysis without enabling CSV recording.

```python
import pandas as pd
df = pd.read_csv('.agents/act/review_scores.csv')

# Which tools are most useful?
df.groupby('tool_name')['master_rating'].agg(['mean', 'count'])

# Speed vs value — fast tools that earn their slot
df['latency_s'] = df['detection_latency_ms'] / 1000
df[df.finding_type == 'code_scan'].groupby('tool_name')[['master_rating', 'latency_s']].median()

# Evaluating the evaluators — is one model harsher / more consistent?
df.groupby('evaluator_id')['master_rating'].agg(['mean', 'std', 'count'])

# Click through to the source finding (clickable in a notebook)
df[df.master_rating <= 1][['finding_url', 'finding_summary', 'tool_name']]
```

`evaluator_id` lets you compare evaluators: detect a harsh/lenient model,
correlate model tier with agreement, and weight findings by evaluator
confidence over time.

## Wiring

This is **P5** in [SKILL.md](SKILL.md) — after P4 resolve, before P6 evaluation.
Scratch (`findings.jsonl`, `scores.tsv`, `scores-report.jsonl`) lives under repo
**`./tmp/`** (never system `/tmp`, never `scripts/` or repo root). The
persistent `review_scores.csv` is committed only when the `/act` run was
explicitly opted in.
