"""Compare two Harbor job directories for A/B skill evaluation.

Extracts:
- accuracy (mean reward)
- total wall-clock time (agent_execution + verifier + environment setup)
- total token usage (n_input_tokens + n_output_tokens from agent_result)

Usage:
    python compare.py jobs/job-without-skills jobs/job-with-skills
"""
import json
import sys
from datetime import datetime
from pathlib import Path


def parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(ts)
    except ValueError:
        return None


def duration_sec(start: str | None, end: str | None) -> float:
    s = parse_iso(start)
    e = parse_iso(end)
    if s and e:
        return (e - s).total_seconds()
    return 0.0


def _safe_int(value, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def collect_trial_results(job_dir: Path):
    """Yield (task_name, reward, duration_sec, tokens) for each trial.

    Trials may be nested under ``job_dir`` (e.g. ``trials/<name>/result.json``),
    so ``rglob`` is used. Missing or malformed ``result.json`` files are skipped
    with a warning instead of aborting the whole comparison.
    """
    if not job_dir.exists():
        return

    for result_file in sorted(job_dir.rglob("result.json")):
        trial_dir = result_file.parent
        try:
            data = json.loads(result_file.read_text())
        except (json.JSONDecodeError, OSError) as exc:
            print(f"warn: could not read {result_file}: {exc}", file=sys.stderr)
            continue

        if not isinstance(data, dict):
            print(f"warn: expected object in {result_file}, got {type(data).__name__}", file=sys.stderr)
            continue

        task_name = data.get("task_name") or trial_dir.name

        verifier_result = data.get("verifier_result") or {}
        if not isinstance(verifier_result, dict):
            verifier_result = {}
        rewards = verifier_result.get("rewards")
        if not isinstance(rewards, dict):
            rewards = {}
        reward = float(rewards.get("reward") or 0.0)

        # Total wall-clock time for the trial
        dur = duration_sec(data.get("started_at"), data.get("finished_at"))

        agent_result = data.get("agent_result") or {}
        if not isinstance(agent_result, dict):
            agent_result = {}
        tokens = 0
        tokens += _safe_int(agent_result.get("n_input_tokens"))
        tokens += _safe_int(agent_result.get("n_output_tokens"))

        yield task_name, reward, dur, tokens


def summarize(job_dir: Path):
    results = list(collect_trial_results(job_dir))
    if not results:
        print(f"No trials found in {job_dir}", file=sys.stderr)
        return None

    rewards = [r for _, r, _, _ in results]
    if not rewards:
        print(f"No rewards collected from {job_dir}", file=sys.stderr)
        return None
    durations = [d for _, _, d, _ in results]
    tokens = [t for _, _, _, t in results]

    return {
        "tasks": results,
        "accuracy": sum(rewards) / len(rewards),
        "total_time_sec": sum(durations),
        "total_tokens": sum(tokens),
    }


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <job-without-skills> <job-with-skills>")
        sys.exit(1)

    without_dir = Path(sys.argv[1])
    with_dir = Path(sys.argv[2])

    without_summary = summarize(without_dir)
    with_summary = summarize(with_dir)

    if with_summary is None or without_summary is None:
        sys.exit(1)

    print("=== WITHOUT skills ===")
    print(f"Accuracy: {without_summary['accuracy']:.2%}")
    print(f"Total time: {without_summary['total_time_sec']:.1f}s")
    print(f"Total tokens: {without_summary['total_tokens']}")

    print("\n=== WITH skills ===")
    print(f"Accuracy: {with_summary['accuracy']:.2%}")
    print(f"Total time: {with_summary['total_time_sec']:.1f}s")
    print(f"Total tokens: {with_summary['total_tokens']}")

    print("\n=== DELTA (with - without) ===")
    print(f"Accuracy: {with_summary['accuracy'] - without_summary['accuracy']:.2%}")
    print(f"Time: {with_summary['total_time_sec'] - without_summary['total_time_sec']:.1f}s")
    print(f"Tokens: {with_summary['total_tokens'] - without_summary['total_tokens']}")


if __name__ == "__main__":
    main()
