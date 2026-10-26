import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readSync, renameSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { newestHandoffPerInstance, ownHandoff, questionOwner, questionResolvedBy, type Seat, type State } from "../../shared/state-schema.js";
import { BRIEFING_BUDGET, BRIEFING_END, BRIEFING_START } from "./briefing.js";

/**
 * T-299 step 1: one JSON line per greeting, beside the knowledge store, so the measurable half of the /start scorecard
 * exists as data. OPT-IN (greeting.json `greeting_metrics`), default off. SIA has no network code: a clark-ops transport
 * posts these rows and Prism builds the panel; neither is in this repo.
 *
 * Core side: it must not import any MEMORY_SIDE file (`/sync`'s module-boundary check), and it must not import
 * start-report.ts (a cycle; start-report passes the narrowed seat role in).
 */
export const GREETING_METRICS_FILE = "greeting-metrics.jsonl";
export const GREETING_METRICS_SCHEMA = 1;
/** Rotate (rename to `.1`, replacing any old `.1`) before an append that finds the file at or above this size. */
export const GREETING_METRICS_ROTATE_BYTES = 2 * 1024 * 1024;
export const ALARM_IDS = ["tree_diverged", "tree_stale", "record_behind", "stale_process", "build_behind", "old_start_command", "usage_not_checked", "drift_not_fixed", "handoff_missing", "latest_brief_undetermined"] as const;
export const MISSING_POINTER_IDS = ["handoff", "pick_up", "objective", "latest_brief"] as const;
export const UNCHECKED_IDS = ["latest_brief"] as const;
/** T-324: at most this many ids in a row's `pick_up_ids`. */
export const PICK_UP_IDS_CAP = 10;
const PICK_UP_ID = /\b[TV]-\d+\b|#\d+\b/g;

type AlarmId = (typeof ALARM_IDS)[number];

const ALARM_PATTERNS: Record<AlarmId, RegExp> = {
  tree_diverged: /^THIS TREE HAS DIVERGED/m,
  tree_stale: /^THIS TREE IS STALE/m,
  record_behind: /^THE RECORD HERE IS BEHIND/m,
  stale_process: /^Build \S+ · STALE PROCESS:/m,
  build_behind: /^Build \S+ · STALE:/m,
  old_start_command: /^OLD \/start/m,
  usage_not_checked: /^Usage: not checked/m,
  drift_not_fixed: /(?:^|· )Drift detected \(\d+\):[^\n]*\(not fixed\)/m,
  handoff_missing: /(?:^|· )Handoff MISSING: /m,
  latest_brief_undetermined: /^Latest brief: not determined/m,
};

export function greetingMetricsPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(dirname(env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db")), GREETING_METRICS_FILE);
}

export interface GreetingMetricsInput {
  projectRoot: string;
  callerLabel: string;
  /** The report text so far (header and briefing), before the Total line. */
  report: string;
  /** describeServingBuild()'s line. */
  serving: string;
  /** The record rendered, or null when there is no valid one. */
  state: State | null;
  seatName: string | null;
  /** The seat role start-report already narrowed with `isSeat`; null when the seat is unresolved. */
  role: Seat | null;
  ownCheckout: string | undefined;
  /** The session number when a log was created, else null. */
  sessionNumber: number | null;
  /** `Date.now()` taken at renderStartReport's entry. */
  startedAt: number;
  /** greeting.json `briefing_budget` is on. */
  budget: boolean;
}

export interface GreetingMetricsRow {
  schema: number;
  id: string;
  ts: string;
  caller: "mcp" | "cli" | "other";
  record_name: string | null;
  repo: string | null;
  checkout: string;
  agent: string | null;
  role: Seat | null;
  session: number | null;
  record_rev: number | null;
  handoff_rev: number | null;
  handoff_lag_revs: number | null;
  lag_reason: "no_record" | "seat_unresolved" | "no_own_handoff" | "no_stamp" | null;
  greeting_chars: number;
  greeting_bytes: number;
  budget_chars: number | null;
  report_bytes: number;
  start_ms: number;
  serving_build: string | null;
  stale_process: boolean;
  missing_pointers: string[];
  unchecked: string[];
  alarm_streaks: Record<string, number>;
  /** T-324: T-, V- and #ids from the reader's own pick-up, then the objective; de-duplicated, at most PICK_UP_IDS_CAP. */
  pick_up_ids: string[];
  /** T-324: unresolved questions owned by aaron across the newest handoff per seat instance; null without a record. */
  open_questions: number | null;
}

/** The fields of an earlier row that chain the next one. */
export type PreviousMetricsRow = { checkout?: unknown; caller?: unknown; alarm_streaks?: Record<string, number> };

function repoName(projectRoot: string): string | null {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
    return common === "" ? null : basename(dirname(common));
  } catch {
    return null;
  }
}

function briefingBlock(report: string): string {
  const lines = report.split("\n");
  const a = lines.indexOf(BRIEFING_START);
  if (a < 0) return "";
  const b = lines.indexOf(BRIEFING_END, a);
  return b < 0 ? "" : lines.slice(a, b + 1).join("\n");
}

const callerOf = (label: string): GreetingMetricsRow["caller"] => (label.includes("MCP") ? "mcp" : label.includes("CLI") ? "cli" : "other");

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);

export function buildGreetingMetricsRow(input: GreetingMetricsInput, previous: PreviousMetricsRow | null, now: Date): GreetingMetricsRow {
  const { state, role, report } = input;
  const own = state !== null && role !== null ? ownHandoff(state.handoffs, role, input.ownCheckout) : null;
  const recordRev = state?.revision ?? null;
  const handoffRev = own?.written_rev ?? null;
  const lag = recordRev !== null && handoffRev !== null ? recordRev - handoffRev : null;
  const lagReason: GreetingMetricsRow["lag_reason"] =
    lag !== null ? null : state === null ? "no_record" : role === null ? "seat_unresolved" : own === null ? "no_own_handoff" : "no_stamp";

  const block = briefingBlock(report);
  const missing = new Set<string>();
  if (state !== null && role !== null && own === null) missing.add("handoff");
  if (own !== null && own.pick_up.trim() === "") missing.add("pick_up");
  if (state !== null && state.objective === null) missing.add("objective");
  if (/^Latest brief: none/m.test(report)) missing.add("latest_brief");

  const streaks: Record<string, number> = {};
  for (const id of ALARM_IDS) if (ALARM_PATTERNS[id].test(report)) streaks[id] = (previous?.alarm_streaks?.[id] ?? 0) + 1;

  // T-324: what the greeting pointed at, and what it showed as waiting on Aaron (dashboard T-054 scores them).
  const named = [...(own?.pick_up.match(PICK_UP_ID) ?? []), ...(state?.objective?.text.match(PICK_UP_ID) ?? [])];
  const pickUpIds = [...new Set(named)].slice(0, PICK_UP_IDS_CAP);
  const openQuestions =
    state === null
      ? null
      : newestHandoffPerInstance(state.handoffs).reduce(
          (n, h) => n + h.open_questions.filter((q) => questionResolvedBy(q) === null && questionOwner(q)?.toLowerCase() === "aaron").length,
          0,
        );

  return {
    schema: GREETING_METRICS_SCHEMA,
    id: randomUUID(),
    ts: now.toISOString(),
    caller: callerOf(input.callerLabel),
    record_name: state ? clip(state.project.name, 80) : null,
    repo: repoName(input.projectRoot),
    checkout: basename(input.projectRoot),
    agent: input.seatName === null ? null : clip(input.seatName, 40),
    role,
    session: input.sessionNumber,
    record_rev: recordRev,
    handoff_rev: handoffRev,
    handoff_lag_revs: lag,
    lag_reason: lagReason,
    greeting_chars: block.length,
    greeting_bytes: Buffer.byteLength(block, "utf8"),
    budget_chars: input.budget ? BRIEFING_BUDGET.chars : null,
    report_bytes: Buffer.byteLength(report, "utf8"),
    start_ms: Math.max(0, Math.round(now.getTime() - input.startedAt)),
    serving_build: input.serving.match(/^Build ([0-9a-f]{7,})/)?.[1] ?? null,
    stale_process: /· STALE PROCESS:/.test(input.serving),
    missing_pointers: MISSING_POINTER_IDS.filter((id) => missing.has(id)),
    unchecked: /^Latest brief:/m.test(report) ? [] : [...UNCHECKED_IDS],
    alarm_streaks: streaks,
    pick_up_ids: pickUpIds,
    open_questions: openQuestions,
  };
}

const TAIL_BYTES = 64 * 1024;

/** The newest parseable row of the file's last 64 KB with this checkout AND caller, or null. */
function readPrevious(path: string, checkout: string, caller: string): PreviousMetricsRow | null {
  if (!existsSync(path)) return null;
  let text: string;
  try {
    const size = statSync(path).size;
    const start = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    const fd = openSync(path, "r");
    try {
      readSync(fd, buf, 0, buf.length, start);
    } finally {
      closeSync(fd);
    }
    text = buf.toString("utf8");
  } catch {
    return null;
  }
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim();
    if (line === "") continue;
    try {
      const row = JSON.parse(line) as PreviousMetricsRow;
      if (typeof row === "object" && row !== null && row.checkout === checkout && row.caller === caller) return row;
    } catch {
      // a partial first line of the window, or a damaged row: skip it
    }
  }
  return null;
}

/** Read previous, build, rotate, append. Never throws. */
export function recordGreetingMetrics(input: GreetingMetricsInput): { ok: true } | { ok: false; why: string } {
  try {
    const path = greetingMetricsPath();
    const now = new Date();
    const previous = readPrevious(path, basename(input.projectRoot), callerOf(input.callerLabel));
    const row = buildGreetingMetricsRow(input, previous, now);
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path) && statSync(path).size >= GREETING_METRICS_ROTATE_BYTES) {
      if (existsSync(`${path}.1`)) unlinkSync(`${path}.1`);
      renameSync(path, `${path}.1`);
    }
    appendFileSync(path, JSON.stringify(row) + "\n");
    return { ok: true };
  } catch (err) {
    return { ok: false, why: ((err as Error).message ?? String(err)).split("\n")[0] || "unknown error" };
  }
}
