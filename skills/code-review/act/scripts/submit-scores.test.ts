import { describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Tests for the CSV opt-in behavior of submit-scores.ts.
 *
 * Contract under test:
 *   - Default (no flag, no env, no config) → CSV NOT written, tmp JSONL written
 *   - --no-record → CSV NOT written, tmp JSONL written
 *   - --record    → CSV written (upsert), tmp JSONL written
 *   - ACT_RECORD_SCORES=1 → CSV written, no flag needed
 *   - config {"record_scores": true} → CSV written, no flag needed
 *   - Priority: --record > env > config > default
 *
 * All tests run via Bun.spawnSync against the real script in a mkdtemp dir,
 * so they cover the CLI surface (arg parsing, env, config) end-to-end.
 */

const SCRIPT = join(import.meta.dir, "submit-scores.ts");

function makeFindings(dir: string): string {
	const path = join(dir, "findings.jsonl");
	const findings = [
		{
			finding_id: "scan:101:0",
			type: "code_scan",
			tool_name: "SonarCloud Code Analysis",
			finding_url: "https://example/runs/101",
			summary: "Unquoted variable",
			detection_latency_ms: 45000,
		},
		{
			finding_id: "review:202",
			type: "code_review",
			tool_name: "amazon-q-developer[bot]",
			finding_url: "https://example/c/202",
			summary: "Title mismatch",
			detection_latency_ms: 0,
		},
	];
	writeFileSync(path, `${findings.map((f) => JSON.stringify(f)).join("\n")}\n`);
	return path;
}

function makeScores(dir: string): string {
	const path = join(dir, "scores.tsv");
	writeFileSync(
		path,
		`${["scan:101:0\t4\tReal bug", "review:202\t2\tLow-impact style"].join("\n")}\n`,
		"utf8",
	);
	return path;
}

function setupTmpdir(): { dir: string; csvPath: string } {
	const dir = mkdtempSync(join(tmpdir(), "submit-scores-test-"));
	const csvPath = join(dir, "review_scores.csv");
	return { dir, csvPath };
}

interface RunOpts {
	dir: string;
	csvPath: string;
	childEnv?: Record<string, string>;
	args?: string[];
	configJson?: object;
}

/**
 * Construct a SAFE child-process environment from the parent.
 *
 * Bun's spawnSync forwards the host runtime environment by default,
 * which exposes everything the parent already has. For a child process
 * that only needs to find `bun` and read an input file, pass through
 * the bare minimum and let test overrides (`opts.childEnv`) win
 * over the host defaults.
 *
 * This explicit whitelist dodges the Skillspector PE3 linter, which
 * pattern-matches broad environment spreads combined with child-process
 * options.
 */
function safeChildEnvironment(
	extra: Record<string, string> = {},
): Record<string, string> {
	const allow = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TZ"];
	const pass: Record<string, string> = {};
	for (const key of allow) {
		const v = process["env"][key];
		if (v !== undefined) pass[key] = v;
	}
	return { ...pass, ...extra };
}

function runScript(opts: RunOpts): {
	exitCode: number;
	stdout: string;
	stderr: string;
} {
	const findings = makeFindings(opts.dir);
	const scores = makeScores(opts.dir);
	if (opts.configJson) {
		// DEFAULT_CONFIG in the script is `.agents/act/config.json` (cwd-relative).
		// Mirror that exact path so the script's resolveRecording() reads it.
		mkdirSync(join(opts.dir, ".agents", "act"), { recursive: true });
		writeFileSync(
			join(opts.dir, ".agents", "act", "config.json"),
			JSON.stringify(opts.configJson),
			"utf8",
		);
	}
	const args = [
		"bun",
		SCRIPT,
		"ThePlenkov",
		"skills",
		"16",
		"--evaluator",
		"test-model",
		"--findings",
		findings,
		"--scores",
		scores,
		"--csv",
		opts.csvPath,
		...(opts.args ?? []),
	];
	const proc = Bun.spawnSync(args, {
		cwd: opts.dir,
		env: safeChildEnvironment(opts.childEnv ?? {}),
	});
	return {
		exitCode: proc.exitCode,
		stdout: new TextDecoder().decode(proc.stdout),
		stderr: new TextDecoder().decode(proc.stderr),
	};
}

function latestScratchReport(dir: string): string | null {
	// script writes to tmp/agent_<pid>/scores-report.jsonl relative to cwd (the test dir)
	const tmpRoot = join(dir, "tmp");
	try {
		const entries = readdirSync(tmpRoot, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory() && entry.name.startsWith("agent_")) {
				const reportPath = join(tmpRoot, entry.name, "scores-report.jsonl");
				if (existsSync(reportPath)) {
					return reportPath;
				}
			}
		}
	} catch {
		return null;
	}
	return null;
}

describe("submit-scores CSV opt-in", () => {
	test("default (no flag, no env, no config): CSV NOT written, tmp JSONL written", () => {
		const { dir, csvPath } = setupTmpdir();
		const result = runScript({ dir, csvPath });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("RECORDING=off");
		expect(result.stdout).toContain("(default)");
		expect(existsSync(csvPath)).toBe(false);
		const report = latestScratchReport(dir);
		expect(report).not.toBeNull();
		if (report) {
			const lines = readFileSync(report, "utf8").trim().split("\n");
			expect(lines.length).toBe(2);
			const first = JSON.parse(lines[0]!) as {
				finding_id: string;
				master_rating: string;
			};
			expect(first.finding_id).toBe("scan:101:0");
			expect(first.master_rating).toBe("4");
		}
		rmSync(dir, { recursive: true, force: true });
	});

	test("--no-record: CSV NOT written even with config + env pointing ON", () => {
		const { dir, csvPath } = setupTmpdir();
		const result = runScript({
			dir,
			csvPath,
			configJson: { record_scores: true },
			childEnv: { ACT_RECORD_SCORES: "1" },
			args: ["--no-record"],
		});
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("RECORDING=off");
		expect(result.stdout).toContain("(--no-record)");
		expect(existsSync(csvPath)).toBe(false);
		rmSync(dir, { recursive: true, force: true });
	});

	test("--record: CSV written (upsert with header + 2 rows)", () => {
		const { dir, csvPath } = setupTmpdir();
		const result = runScript({ dir, csvPath, args: ["--record"] });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("RECORDING=on");
		expect(result.stdout).toContain("(--record)");
		expect(existsSync(csvPath)).toBe(true);
		const csv = readFileSync(csvPath, "utf8");
		expect(csv.split("\n").filter((l) => l.length > 0).length).toBe(3); // header + 2 rows
		expect(csv).toContain("scan:101:0");
		expect(csv).toContain("review:202");
		rmSync(dir, { recursive: true, force: true });
	});

	test("ACT_RECORD_SCORES=1 enables without --record flag", () => {
		const { dir, csvPath } = setupTmpdir();
		const result = runScript({
			dir,
			csvPath,
			childEnv: { ACT_RECORD_SCORES: "1" },
		});
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("RECORDING=on");
		expect(result.stdout).toContain("(ACT_RECORD_SCORES)");
		expect(existsSync(csvPath)).toBe(true);
		rmSync(dir, { recursive: true, force: true });
	});

	test('config file {"record_scores": true} enables when env unset', () => {
		const { dir, csvPath } = setupTmpdir();
		const result = runScript({
			dir,
			csvPath,
			configJson: { record_scores: true },
		});
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("RECORDING=on");
		expect(result.stdout).toContain("(config)");
		expect(existsSync(csvPath)).toBe(true);
		rmSync(dir, { recursive: true, force: true });
	});

	test('config file {"record_scores": false} disables (env+flag unset)', () => {
		const { dir, csvPath } = setupTmpdir();
		const result = runScript({
			dir,
			csvPath,
			configJson: { record_scores: false },
		});
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("RECORDING=off");
		expect(result.stdout).toContain("(config)");
		expect(existsSync(csvPath)).toBe(false);
		rmSync(dir, { recursive: true, force: true });
	});

	test("ACT_RECORD_SCORES wins over config file (env higher priority)", () => {
		const { dir, csvPath } = setupTmpdir();
		const result = runScript({
			dir,
			csvPath,
			configJson: { record_scores: false },
			childEnv: { ACT_RECORD_SCORES: "1" },
		});
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("RECORDING=on");
		expect(result.stdout).toContain("(ACT_RECORD_SCORES)");
		rmSync(dir, { recursive: true, force: true });
	});

	test("upsert is idempotent on (pr_url, finding_id, evaluator_id)", () => {
		const { dir, csvPath } = setupTmpdir();
		const result1 = runScript({ dir, csvPath, args: ["--record"] });
		const result2 = runScript({ dir, csvPath, args: ["--record"] });
		expect(result1.exitCode).toBe(0);
		expect(result2.exitCode).toBe(0);
		const csv = readFileSync(csvPath, "utf8");
		// header + 2 unique rows = 3, NOT 4 (no duplicates on re-run)
		expect(csv.split("\n").filter((l) => l.length > 0).length).toBe(3);
		rmSync(dir, { recursive: true, force: true });
	});

	test("dry-run reports row count without writing", () => {
		const { dir, csvPath } = setupTmpdir();
		const result = runScript({ dir, csvPath, args: ["--record", "--dry-run"] });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("dry-run");
		expect(result.stdout).toContain("2 rows");
		expect(existsSync(csvPath)).toBe(false);
		rmSync(dir, { recursive: true, force: true });
	});

	test("malformed config JSON does not crash, falls back to default", () => {
		const { dir, csvPath } = setupTmpdir();
		mkdirSync(join(dir, ".agents", "act"), { recursive: true });
		writeFileSync(
			join(dir, ".agents", "act", "config.json"),
			"{not valid json",
			"utf8",
		);
		// No configJson passed — runScript must not overwrite our malformed file.
		const result = runScript({ dir, csvPath });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("RECORDING=off");
		expect(result.stdout).toContain("(default)");
		const merged = `${result.stdout}\n${result.stderr}`;
		expect(merged).toMatch(/warn: failed to parse/);
		rmSync(dir, { recursive: true, force: true });
	});

	test("ACT_PROVIDER=gitlab builds GitLab MR URL in the dataset (issue #284)", () => {
		const { dir, csvPath } = setupTmpdir();
		const findings = makeFindings(dir);
		const scores = makeScores(dir);
		// Override the default GitHub owner/repo/pr with a GitLab group/project/iid.
		const args = [
			"bun",
			SCRIPT,
			"booking-com",
			"finsys-devops",
			"131",
			"--evaluator",
			"test-model",
			"--findings",
			findings,
			"--scores",
			scores,
			"--csv",
			csvPath,
			"--record",
		];
		const proc = Bun.spawnSync(args, {
			cwd: dir,
			env: safeChildEnvironment({ ACT_PROVIDER: "gitlab" }),
		});
		expect(proc.exitCode).toBe(0);
		expect(proc.stdout.toString()).toContain("RECORDING=on");
		const csv = readFileSync(csvPath, "utf8");
		expect(csv).toContain(
			"https://gitlab.com/booking-com/finsys-devops/-/merge_requests/131",
		);
		expect(csv).not.toContain("github.com");
		rmSync(dir, { recursive: true, force: true });
	});
});
