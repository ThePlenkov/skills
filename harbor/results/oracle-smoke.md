# SkillsBench local smoke test — oracle baseline

Two Harbor tasks were run with the `oracle` agent to verify the harness and task definitions:

- `investigate-before-edit`
- `skillmaker-create-skill`

| run | accuracy | total wall time | tokens |
|-----|----------|-----------------|--------|
| without skills | 100.00% | 40.0s | 0 |
| with skills | 100.00% | 41.7s | 0 |
| delta (with - without) | 0.00% | +1.7s | 0 |

## Notes

- The oracle agent is deterministic and uses no LLM, so token usage is 0 for both runs.
- Both tasks pass end-to-end, confirming that the Harbor tasks, verifier, and skill injection pipeline are wired correctly.
- Injecting skills adds a small amount of runtime overhead for the oracle agent because the skill files are copied into the sandbox and the agent environment has a slightly larger setup cost.
- The real skill-impact measurement will come from the `devin` agent runs, where skills are expected to affect accuracy, time-to-correct-solution, and token usage.

## Next step

Run `./run-devin.sh <model>` (or `./run-smoke.sh` / `./run-overview.sh`) against the `devin` ACP agent with a live Devin API key/model to measure with/without-skill performance.
