import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import { handleStart } from "../../../src/server.js";
import { renderBriefing, type BriefingInput } from "../../../src/pipelines/session-start/briefing.js";
import { describeLatestBrief, describeNoBrief } from "../../../src/pipelines/session-start/latest-brief.js";
import type { GreetingMetricsInput } from "../../../src/pipelines/session-start/greeting-metrics.js";

// Loaded per row, so a missing module turns each metrics row red on its own instead of failing the whole file.
const metrics = () => import("../../../src/pipelines/session-start/greeting-metrics.js");
const GREETING_METRICS_FILE = "greeting-metrics.jsonl";

/**
 * T-298 / T-299 step 1: the handoff lag note (read side), brief_dir + the no-brief line, and opt-in greeting metrics.
 * Real git repositories with explicit commit dates; temp KNOWLEDGE_V2_DB for every metrics row.
 */
const FIXTURE = JSON.parse(readFileSync(resolve(__dirname, "../../fixtures-state/state.json"), "utf8"));
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const tmp = (prefix: string): string => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  made.push(d);
  return d;
};

const PLANNER_LOOP = { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] };

function raw(revision: number, handoff: Record<string, unknown> = {}): Record<string, unknown> {
  const r = structuredClone(FIXTURE);
  r.revision = revision;
  r.handoffs = [{ ...r.handoffs[0], seat: "planner", loop_state: PLANNER_LOOP, session_uuid: "u-1", checkout: "sia-atlas", ...handoff }];
  return r;
}

function stateOf(r: Record<string, unknown>): State {
  const parsed = parseState(JSON.stringify(r));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

const input = (state: State, over: Partial<BriefingInput> = {}): BriefingInput => ({
  state,
  version: "9.9.9",
  seat: "planner",
  sessionNumber: 12,
  sessionNote: null,
  date: "2026-10-16",
  drift: [],
  serving: "Serving build: synthetic",
  usage: "Usage: GREEN → dispatches open",
  latestBrief: null,
  workingTree: "Working tree: clean",
  skills: "Skills: none",
  ...over,
});

function git(root: string, args: string[], date?: string): void {
  const env = { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) };
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "-c", "maintenance.auto=false", "-c", "gc.auto=0", ...args], { cwd: root, env, stdio: "ignore" });
}

function repo(): string {
  const root = tmp("t298-");
  git(root, ["init", "-q"]);
  return root;
}

function commitAt(root: string, rel: string, date: string, body = "x"): void {
  const parts = rel.split("/");
  mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
  writeFileSync(join(root, ...parts), `${body}\n${date}\n`);
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", `add ${rel}`], date);
}

function writeGreeting(root: string, body: Record<string, unknown>): void {
  mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
  writeFileSync(join(root, ".agents", "SYSTEM", "greeting.json"), JSON.stringify(body));
}

describe("T-298 G1: HandoffSchema accepts an optional written_rev", () => {
  it("G1: parses with written_rev 506, fails with -1, parses without the key", () => {
    expect(parseState(JSON.stringify(raw(508, { written_rev: 506 }))).ok).toBe(true);
    expect(parseState(JSON.stringify(raw(508, { written_rev: -1 }))).ok).toBe(false);
    expect(parseState(JSON.stringify(raw(508))).ok).toBe(true);
  });
});

describe("T-298 G2-G4: the handoff lag note", () => {
  it("G2 (legacy): state rev 508 · handoff rev 506 (+2)", () => {
    const out = renderBriefing(input(stateOf(raw(508, { written_rev: 506 }))));
    expect(out.some((l) => l.includes("state rev 508 · handoff rev 506 (+2)"))).toBe(true);
  });

  it("G3 (budgeted): the note sits between the revision and the drift", () => {
    const out = renderBriefing(input(stateOf(raw(508, { written_rev: 506 })), { budget: true }));
    expect(out.some((l) => l.includes("state rev 508 · handoff rev 506 (+2) · Drift"))).toBe(true);
  });

  it("G4: no note at lag 0 or when unstamped, and the legacy render equals the unstamped one line for line", () => {
    for (const budget of [false, true]) {
      const stamped = renderBriefing(input(stateOf(raw(508, { written_rev: 508 })), { budget }));
      const unstamped = renderBriefing(input(stateOf(raw(508)), { budget }));
      expect(stamped.join("\n")).not.toContain("handoff rev");
      expect(unstamped.join("\n")).not.toContain("handoff rev");
      expect(stamped).toEqual(unstamped);
    }
  });
});

describe("T-298 G5-G7: brief_dir and the no-brief line", () => {
  it("G5: brief_dir names the directory, and the newest commit date in it wins", () => {
    const root = repo();
    commitAt(root, "docs/loops/loop-9-brief.md", "2026-09-30T12:00:00+00:00");
    commitAt(root, ".agents/plans/t173-wp-redirects.md", "2026-10-10T12:00:00+00:00");
    commitAt(root, ".agents/plans/prod-release-1016b.md", "2026-10-16T12:00:00+00:00");
    writeGreeting(root, { brief_dir: ".agents/plans" });
    expect(describeLatestBrief(root)).toBe("Latest brief: .agents/plans/prod-release-1016b.md (2026-10-16)");
  });

  it("G6: the none line names where it looked", () => {
    const bare = repo();
    commitAt(bare, "README.md", "2026-10-01T12:00:00+00:00");
    expect(describeNoBrief(bare)).toBe("Latest brief: none (looked in docs/loops/ and docs/loop-*-brief.md)");
    const root = repo();
    commitAt(root, ".agents/plans/notes.txt", "2026-10-01T12:00:00+00:00");
    writeGreeting(root, { brief_dir: ".agents/plans" });
    expect(describeLatestBrief(root)).toBeNull();
    expect(describeNoBrief(root)).toBe("Latest brief: none (looked in .agents/plans/, from greeting.json brief_dir)");
  });

  it("G7: an invalid brief_dir is reported, not guessed", () => {
    const root = repo();
    commitAt(root, "docs/loops/loop-9-brief.md", "2026-09-30T12:00:00+00:00");
    writeGreeting(root, { brief_dir: "../elsewhere" });
    expect(describeLatestBrief(root)).toMatch(/^Latest brief: not determined \(greeting.json brief_dir is not a repo-relative directory: "\.\.\/elsewhere"\)$/);
  });
});

describe("T-298 G8-G11: the greeting metrics row", () => {
  const SERVING = "Build a346e5b · STALE PROCESS: disk has 0dcf8f4 (built x) → /mcp reconnect open-brain";
  const REPORT = [
    SERVING,
    "THIS TREE HAS DIVERGED from origin/main: 3 ahead, 4 behind",
    "",
    "## Briefing",
    SERVING,
    "Usage: not checked (x)",
    "Latest brief: none (looked in docs/loops/ and docs/loop-*-brief.md)",
    "## End Briefing",
  ].join("\n");

  function metricsInput(root: string, over: Partial<GreetingMetricsInput> = {}): GreetingMetricsInput {
    return {
      projectRoot: root,
      callerLabel: "open-brain MCP server",
      report: REPORT,
      serving: SERVING,
      state: stateOf(raw(508, { seat: "developer", loop_state: null })),
      seatName: "Forge",
      role: "developer",
      ownCheckout: undefined,
      sessionNumber: 12,
      startedAt: Date.now(),
      budget: false,
      ...over,
    };
  }

  const ORDER = [
    "schema", "id", "ts", "caller", "record_name", "repo", "checkout", "agent", "role", "session", "record_rev", "handoff_rev",
    "handoff_lag_revs", "lag_reason", "greeting_chars", "greeting_bytes", "budget_chars", "report_bytes", "start_ms", "serving_build",
    "stale_process", "missing_pointers", "unchecked", "alarm_streaks",
  ];

  it("G8: the row has the pinned keys in order and the measured values", async () => {
    const { buildGreetingMetricsRow } = await metrics();
    const root = repo();
    const row = buildGreetingMetricsRow(metricsInput(root), null, new Date("2026-10-16T12:00:00Z"));
    expect(Object.keys(row)).toEqual(ORDER);
    expect(row.schema).toBe(1);
    expect(row.stale_process).toBe(true);
    expect(row.serving_build).toBe("a346e5b");
    expect(row.handoff_lag_revs).toBeNull();
    expect(row.lag_reason).toBe("no_stamp");
    expect(row.missing_pointers).toContain("latest_brief");
    expect(row.unchecked).toEqual([]);
    expect(row.alarm_streaks).toEqual({ tree_diverged: 1, stale_process: 1, usage_not_checked: 1 });
    expect(Buffer.byteLength(JSON.stringify(row))).toBeLessThan(2048);
  });

  function withDb<T>(fn: (dir: string) => T): T {
    const dir = tmp("t298-db-");
    const prior = process.env.KNOWLEDGE_V2_DB;
    process.env.KNOWLEDGE_V2_DB = join(dir, "knowledge-v2.db");
    try {
      return fn(dir);
    } finally {
      if (prior === undefined) delete process.env.KNOWLEDGE_V2_DB;
      else process.env.KNOWLEDGE_V2_DB = prior;
    }
  }

  const rowsOf = (file: string): Array<Record<string, unknown>> =>
    readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

  it("G9: streaks chain only on the same checkout and caller", async () => {
    const { recordGreetingMetrics } = await metrics();
    withDb((dir) => {
      const file = join(dir, GREETING_METRICS_FILE);
      const a = repo();
      const b = repo();
      const clean = REPORT.replace("THIS TREE HAS DIVERGED", "this tree is level");
      expect(recordGreetingMetrics(metricsInput(a))).toEqual({ ok: true });
      expect(recordGreetingMetrics(metricsInput(a))).toEqual({ ok: true });
      expect(recordGreetingMetrics(metricsInput(b))).toEqual({ ok: true });
      expect(recordGreetingMetrics(metricsInput(a, { callerLabel: "open-brain CLI" }))).toEqual({ ok: true });
      expect(recordGreetingMetrics(metricsInput(a, { report: clean }))).toEqual({ ok: true });
      const rows = rowsOf(file);
      expect(rows).toHaveLength(5);
      expect((rows[1]!.alarm_streaks as Record<string, number>).tree_diverged).toBe(2);
      expect((rows[2]!.alarm_streaks as Record<string, number>).tree_diverged).toBe(1);
      expect((rows[3]!.alarm_streaks as Record<string, number>).tree_diverged).toBe(1);
      expect(rows[3]!.caller).toBe("cli");
      expect(rows[4]!.alarm_streaks as Record<string, number>).not.toHaveProperty("tree_diverged");
    });
  });

  it("G10: a file at the rotate size moves to .1 and the live file holds one line", async () => {
    const { recordGreetingMetrics, GREETING_METRICS_ROTATE_BYTES } = await metrics();
    withDb((dir) => {
      const file = join(dir, GREETING_METRICS_FILE);
      writeFileSync(file, "x\n".repeat(GREETING_METRICS_ROTATE_BYTES / 2));
      const oldSize = statSync(file).size;
      expect(recordGreetingMetrics(metricsInput(repo()))).toEqual({ ok: true });
      expect(statSync(`${file}.1`).size).toBe(oldSize);
      expect(readFileSync(file, "utf8").split("\n").filter(Boolean)).toHaveLength(1);
    });
  });

  it("G11: a failure to write returns ok:false with a reason and never throws", async () => {
    const { recordGreetingMetrics } = await metrics();
    withDb((dir) => {
      mkdirSync(join(dir, GREETING_METRICS_FILE));
      const r = recordGreetingMetrics(metricsInput(repo()));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.why.length).toBeGreaterThan(0);
    });
  });
});

describe("T-298 G12: ob_start, metrics opt-in and the no-brief line default on", () => {
  function project(): string {
    const root = repo();
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
    for (const [rel, body] of [["SYSTEM/SUMMARY.md", "# S\n"], ["TASKS/INBOX.md", "# I\n"], ["TASKS/task.md", "# T\n"], ["SESSIONS/next-session.md", "# N\n"]] as const) {
      writeFileSync(join(root, ".agents", rel), body);
    }
    const r = structuredClone(FIXTURE);
    r.handoffs = [{ ...r.handoffs[0], seat: "developer", session_uuid: "u-1", checkout: "x", pick_up: "Pick this up." }];
    writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(r, null, 2) + "\n");
    writeFileSync(join(root, ".agents", "AGENT.local.md"), ["---", "name: Fixture", "role: developer", "partner: Other", "---", ""].join("\n"));
    git(root, ["add", "-A"]);
    git(root, ["commit", "-q", "-m", "seed"]);
    return root;
  }

  it("G12: default off writes no file and prints the none line; greeting_metrics writes exactly one valid row", async () => {
    const dir = tmp("t298-db-");
    const prior = process.env.KNOWLEDGE_V2_DB;
    process.env.KNOWLEDGE_V2_DB = join(dir, "knowledge-v2.db");
    const file = join(dir, GREETING_METRICS_FILE);
    try {
      const off = (await handleStart({ project_root: project() })).content[0]!.text;
      expect(off).toContain("Latest brief: none (looked in docs/loops/");
      expect(existsSync(file)).toBe(false);

      const root = project();
      writeGreeting(root, { greeting_metrics: true });
      const on = (await handleStart({ project_root: root })).content[0]!.text;
      expect(existsSync(file)).toBe(true);
      const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0]!).schema).toBe(1);
      expect(on).not.toContain("Greeting metrics: not written");
    } finally {
      if (prior === undefined) delete process.env.KNOWLEDGE_V2_DB;
      else process.env.KNOWLEDGE_V2_DB = prior;
    }
  }, 120000);
});
