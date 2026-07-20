#!/usr/bin/env bun
/**
 * Join master-model ratings back onto extracted findings and emit the
 * research dataset. Pure local work — no network, no GitHub mutations.
 *
 * Output behavior (default OFF for the persistent CSV):
 *
 *   ALWAYS — write a per-run report to tmp/agent_$$/scores-report.jsonl
 *   (JSONL; gitignored; never touches the working tree). This is the
 *   "what the agent just rated" record, kept one file per /act run.
 *
 *   ONLY WITH OPT-IN — also upsert the persistent
 *   `.agents/act/review_scores.csv` research dataset. Off by default per
 *   /act skill policy: tracking CSVs in the repo costs a commit per run
 *   and pollutes history unless someone is actively using the dataset
 *   for notebook analysis.
 *
 * Opt-in switches (priority high → low; explicit --record wins over env,
 * env wins over config file, otherwise default is OFF):
 *
 *   bun scripts/submit-scores.ts …  --record         (CLI flag, positive)
 *   bun scripts/submit-scores.ts …  --no-record      (CLI flag, negative)
 *   ACT_RECORD_SCORES=1 bun scripts/submit-scores.ts …   (env var)
 *   .agents/act/config.json   {"record_scores": true}    (config file)
 *
 * In the script output lines below, look for `RECORDING=on|off (source)`
 * to confirm which switch the current run resolved to.
 *
 * The agent supplies only what it alone can produce — a 3-column TSV:
 *   finding_id <TAB> rating(0-5) <TAB> reasoning
 * Everything else (tool_name, type, url, summary, latency) is joined from the
 * findings.jsonl sidecar by finding_id, so the agent never re-echoes data a
 * script already holds. The evaluator is named once via --evaluator.
 *
 * Upsert key: (pr_url, finding_id, evaluator_id) — re-running /act replaces
 * prior rows for the same evaluator instead of duplicating them.
 *
 * Usage:
 *   submit-scores.ts OWNER REPO PR --evaluator ID --findings F.jsonl \
 *       [--scores S.tsv] [--csv PATH] [--record|--no-record] [--dry-run]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_CSV = ".agents/act/review_scores.csv";
const DEFAULT_CONFIG = ".agents/act/config.json";
const SCRATCH_DIR_PREFIX = "tmp/agent_";
const HEADER_FIELDS = [
	"timestamp",
	"pr_url",
	"finding_id",
	"tool_name",
	"finding_type",
	"finding_url",
	"evaluator_id",
	"master_rating",
	"master_reasoning",
	"finding_summary",
	"detection_latency_ms",
	"false_positive_link",
] as const;
const HEADER = HEADER_FIELDS.join(",");
const KEY = { prUrl: 1, findingId: 2, evaluator: 6 } as const;

interface Cli {
	owner: string;
	repo: string;
	pr: string;
	evaluator: string;
	findingsPath: string;
	scoresPath: string;
	csvPath: string;
	recordCli: boolean | null;
	dryRun: boolean;
}

interface Finding {
	finding_id: string;
	type: string;
	tool_name: string;
	finding_url: string;
	summary: string;
	detection_latency_ms?: number;
}

interface Score {
	finding_id: string;
	rating: string;
	reasoning: string;
}

type RecordSource =
	| "--record"
	| "--no-record"
	| "ACT_RECORD_SCORES"
	| "config"
	| "default";

function usage(): never {
	console.error(
		"Usage: submit-scores.ts OWNER REPO PR --evaluator ID --findings F.jsonl [--scores S.tsv] [--csv PATH] [--record|--no-record] [--dry-run]\n" +
			"\n" +
			"CSV recording is OFF by default. Opt-in: --record, ACT_RECORD_SCORES=1, or\n" +
			'.agents/act/config.json with `{"record_scores": true}`. Per-run JSONL report\n' +
			"is always written to tmp/agent_<pid>/scores-report.jsonl (gitignored).",
	);
	process.exit(2);
}

function flagValue(argv: string[], name: string): string | undefined {
	const i = argv.indexOf(name);
	return i >= 0 ? argv[i + 1] : undefined;
}

function requireFlag(value: string | undefined, name: string): string {
	if (!value) {
		console.error(`error: ${name} is required`);
		usage();
	}
	return value;
}

function parseCli(argv: string[]): Cli {
	const [owner, repo, pr] = argv;
	if (!owner || !repo || !pr) {
		usage();
	}
	let recordCli: boolean | null = null;
	if (argv.includes("--record")) {
		recordCli = true;
	} else if (argv.includes("--no-record")) {
		recordCli = false;
	}
	return {
		owner,
		repo,
		pr,
		evaluator: flagValue(argv, "--evaluator") ?? "unknown",
		findingsPath: requireFlag(flagValue(argv, "--findings"), "--findings"),
		scoresPath: flagValue(argv, "--scores") ?? "./scores.tsv",
		csvPath: flagValue(argv, "--csv") ?? DEFAULT_CSV,
		recordCli,
		dryRun: argv.includes("--dry-run"),
	};
}

function readFindings(path: string): Map<string, Finding> {
	const map = new Map<string, Finding>();
	for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
		if (line.trim() === "") {
			continue;
		}
		const finding = JSON.parse(line) as Finding;
		map.set(finding.finding_id, finding);
	}
	return map;
}

function parseScoreLine(line: string): Score | null {
	if (line.trim() === "") {
		return null;
	}
	const parts = line.split("\t");
	if (parts.length < 2 || !/^[0-5]$/.test(parts[1]!.trim())) {
		console.error(`warn: bad score line (need id<TAB>0-5<TAB>reason): ${line}`);
		return null;
	}
	return {
		finding_id: parts[0]!,
		rating: parts[1]!.trim(),
		reasoning: parts[2] ?? "",
	};
}

function readScores(path: string): Score[] {
	const out: Score[] = [];
	for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
		const score = parseScoreLine(line);
		if (score) {
			out.push(score);
		}
	}
	return out;
}

function csvField(value: string): string {
	return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function recordAsObject(opts: {
	score: Score;
	finding: Finding;
	evaluator: string;
	prUrl: string;
	timestamp: string;
}): Record<string, string> {
	const f = opts.finding;
	return {
		timestamp: opts.timestamp,
		pr_url: opts.prUrl,
		finding_id: f.finding_id,
		tool_name: f.tool_name,
		finding_type: f.type,
		finding_url: f.finding_url,
		evaluator_id: opts.evaluator,
		master_rating: opts.score.rating,
		master_reasoning: opts.score.reasoning,
		finding_summary: f.summary,
		detection_latency_ms: String(f.detection_latency_ms ?? ""),
		false_positive_link: "",
	};
}

function buildRow(obj: Record<string, string>): string {
	return HEADER_FIELDS.map((field) => csvField(obj[field] ?? "")).join(",");
}

function buildRows(opts: {
	scores: Score[];
	findings: Map<string, Finding>;
	cli: Cli;
	timestamp: string;
}): Record<string, string>[] {
	const prUrl = `https://github.com/${opts.cli.owner}/${opts.cli.repo}/pull/${opts.cli.pr}`;
	const rows: Record<string, string>[] = [];
	for (const score of opts.scores) {
		const finding = opts.findings.get(score.finding_id);
		if (!finding) {
			console.error(`warn: no finding for id "${score.finding_id}", skipping`);
			continue;
		}
		rows.push(
			recordAsObject({
				score,
				finding,
				evaluator: opts.cli.evaluator,
				prUrl,
				timestamp: opts.timestamp,
			}),
		);
	}
	return rows;
}

function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let cur = "";
	let quoted = false;
	let i = 0;
	while (i < line.length) {
		const ch = line[i];
		if (quoted && ch === '"' && line[i + 1] === '"') {
			cur += '"';
			i += 2;
		} else if (ch === '"') {
			quoted = !quoted;
			i += 1;
		} else if (ch === "," && !quoted) {
			fields.push(cur);
			cur = "";
			i += 1;
		} else {
			cur += ch;
			i += 1;
		}
	}
	fields.push(cur);
	return fields;
}

function keyOf(line: string): string {
	const f = parseCsvLine(line);
	return `${f[KEY.prUrl] ?? ""} ${f[KEY.findingId] ?? ""} ${f[KEY.evaluator] ?? ""}`;
}

function existingDataLines(csvPath: string): string[] {
	if (!existsSync(csvPath)) {
		return [];
	}
	return readFileSync(csvPath, "utf8")
		.split(/\r?\n/)
		.filter((line) => line.length > 0 && line !== HEADER);
}

function upsert(opts: {
	csvPath: string;
	newRows: Record<string, string>[];
}): void {
	const csvLines = opts.newRows.map(buildRow);
	const newKeys = new Set(csvLines.map(keyOf));
	const kept = existingDataLines(opts.csvPath).filter(
		(line) => !newKeys.has(keyOf(line)),
	);
	mkdirSync(dirname(opts.csvPath), { recursive: true });
	writeFileSync(opts.csvPath, `${[HEADER, ...kept, ...csvLines].join("\n")}\n`);
}

/**
 * Resolve whether the persistent CSV should be written this run.
 *
 * Priority order (high → low), first hit wins:
 *   1. --record / --no-record CLI flag
 *   2. ACT_RECORD_SCORES env var (truthy = "1" | "true" | "yes")
 *   3. .agents/act/config.json `record_scores` boolean
 *   4. Default: OFF (default source = 'default')
 *
 * Returns { record, source } where source labels which switch fired so the
 * operator can audit which gate decided.
 */
function resolveRecording(opts: { cli: Cli; configPath: string }): {
	record: boolean;
	source: RecordSource;
} {
	if (opts.cli.recordCli === true) {
		return { record: true, source: "--record" };
	}
	if (opts.cli.recordCli === false) {
		return { record: false, source: "--no-record" };
	}
	const env = process["env"].ACT_RECORD_SCORES;
	if (env !== undefined) {
		const truthy =
			env === "1" ||
			env.toLowerCase() === "true" ||
			env.toLowerCase() === "yes";
		return { record: truthy, source: "ACT_RECORD_SCORES" };
	}
	if (existsSync(opts.configPath)) {
		try {
			const raw = readFileSync(opts.configPath, "utf8");
			const obj = JSON.parse(raw) as { record_scores?: unknown };
			if (typeof obj.record_scores === "boolean") {
				return { record: obj.record_scores, source: "config" };
			}
		} catch (err) {
			console.error(
				`warn: failed to parse ${opts.configPath}: ${(err as Error).message}`,
			);
		}
	}
	return { record: false, source: "default" };
}

function writeScratchReport(opts: {
	rows: Record<string, string>[];
	rootDir: string;
}): string {
	const {pid} = process;
	const scratchDir = `${SCRATCH_DIR_PREFIX}${pid}`;
	mkdirSync(scratchDir, { recursive: true });
	const reportPath = `${scratchDir}/scores-report.jsonl`;
	const body =
		opts.rows.map((row) => JSON.stringify(row)).join("\n") +
		(opts.rows.length ? "\n" : "");
	writeFileSync(reportPath, body, "utf8");
	return reportPath;
}

function main(): void {
	const cli = parseCli(process.argv.slice(2));
	const findings = readFindings(cli.findingsPath);
	const scores = readScores(cli.scoresPath);
	const timestamp = new Date().toISOString();
	const rows = buildRows({
		scores,
		findings,
		cli,
		timestamp,
	});
	const recording = resolveRecording({ cli, configPath: DEFAULT_CONFIG });
	if (cli.dryRun) {
		console.log(
			`dry-run: ${rows.length} rows; would record=${recording.record} (${recording.source})`,
		);
		return;
	}
	// Always write a per-run JSONL report so per-/act data survives even with
	// CSV recording off.
	const scratchPath = writeScratchReport({ rows, rootDir: process.cwd() });
	if (!recording.record) {
		console.log(
			`RECORDING=off (${recording.source}) — ${rows.length} rows → ${scratchPath} (skipped ${cli.csvPath})`,
		);
		return;
	}
	upsert({ csvPath: cli.csvPath, newRows: rows });
	console.log(
		`RECORDING=on (${recording.source}) — upserted ${rows.length} rows into ${cli.csvPath}; scratch=${scratchPath}`,
	);
}

main();
