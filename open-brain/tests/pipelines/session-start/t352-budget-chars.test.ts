import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import { handleStart } from "../../../src/server.js";
import { BRIEFING_BUDGET, BRIEFING_END, BRIEFING_START, renderBriefing, type BriefingInput } from "../../../src/pipelines/session-start/briefing.js";
import { buildGreetingMetricsRow, type GreetingMetricsInput, type GreetingMetricsRow } from "../../../src/pipelines/session-start/greeting-metrics.js";

/**
 * T-352: the greeting-metrics row's `budget_chars`. Since T-344 the budgeted briefing prints the reader's pick-up whole and
 * BRIEFING_BUDGET.chars (4400) is measured without it, so the row's limit is 4400 plus the pick-up text as printed.
 * `greeting_chars` stays the size of the whole block. The dashboard marks a greeting red when greeting_chars > budget_chars.
 * Rows T352-1 to T352-5 render and build the row in memory; T352-6 goes through ob_start and reads the written row.
 */
const FIXTURE = JSON.parse(readFileSync(join(import.meta.dirname, "../../fixtures-state/state.json"), "utf8"));
const NOW = new Date("2026-11-17T12:00:00Z");
const DOT = " \u00b7 ";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const tmp = (prefix: string): string => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  made.push(d);
  return d;
};

function stateWith(pick_up: string): State {
  const raw = structuredClone(FIXTURE);
  raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", session_uuid: "u-0", checkout: "sia-forge", first_rev: 100, pick_up }];
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

const input = (state: State, over: Partial<BriefingInput> = {}): BriefingInput => ({
  state,
  version: "9.9.9",
  seat: "developer",
  sessionNumber: 160,
  sessionNote: null,
  date: "2026-11-17",
  drift: [],
  serving: "Build abc1234 current",
  usage: "Usage: GREEN",
  latestBrief: "Latest brief: docs/loops/t352-brief.md (2026-11-17)",
  workingTree: "Working tree: clean",
  skills: "Skills: none",
  budget: true,
  ...over,
});

const metricsInput = (report: string, state: State, over: Partial<GreetingMetricsInput> = {}): GreetingMetricsInput => ({
  projectRoot: tmpdir(),
  callerLabel: "open-brain MCP server",
  report,
  serving: "Build abc1234 current",
  state,
  seatName: "Forge",
  role: "developer",
  ownCheckout: undefined,
  sessionNumber: 160,
  startedAt: NOW.getTime(),
  budget: true,
  ...over,
});

interface Measured {
  lines: string[];
  report: string;
  printed: { pickUpPrintedChars: number };
  row: GreetingMetricsRow;
}

/** What start-report does: render with a `printed` object, then hand its number to the metrics row. */
function measure(state: State, over: Partial<BriefingInput> = {}): Measured {
  const printed = { pickUpPrintedChars: 0 };
  const i = input(state, over);
  const lines = renderBriefing(i, printed);
  const report = lines.join("\n");
  const row = buildGreetingMetricsRow(metricsInput(report, state, { budget: i.budget === true, pickUpPrintedChars: printed.pickUpPrintedChars }), null, NOW);
  return { lines, report, printed, row };
}

const pickUpLine = (lines: string[]): string => lines[lines.indexOf("PICK UP HERE") + 1]!;
const words = (n: number): string => "word ".repeat(n);
/** 1500 characters, single spaces, no leading or trailing space: printed exactly as stored. */
const PICK_1500 = `${words(299)}done.`;
/** 3000 characters, same shape. */
const PICK_3000 = `${words(599)}done.`;

describe("T-352: budget_chars is the 4400 budget plus the printed pick-up, so the row compares like with like", () => {
  it("T352-1 budgeted, a 1500-character pick-up: budget_chars is 5900, greeting_chars is the whole block, and notes riding the line are not excluded", () => {
    expect(PICK_1500.length).toBe(1500);
    expect(BRIEFING_BUDGET.chars).toBe(4400);
    const m = measure(stateWith(PICK_1500));
    expect(pickUpLine(m.lines)).toBe(PICK_1500);
    expect(m.printed.pickUpPrintedChars).toBe(1500);
    expect(m.row.budget_chars).toBe(5900);
    expect(m.row.greeting_chars).toBe(m.report.length);
    expect(m.row.greeting_chars - 1500, "this fixture's briefing without its pick-up is inside the budget").toBeLessThanOrEqual(4400);
    expect(m.row.greeting_chars <= (m.row.budget_chars ?? -1), "so the row fits").toBe(true);

    // The T-302 and T-316 notes ride the pick-up line. The budget counts them, so they are not part of the excluded text.
    const note = "Already in origin/master: abc1234";
    const shipped = "MAYBE SHIPPED: T-1 (abc1234)";
    const n = measure(stateWith(PICK_1500), { mergedCitations: note, maybeShipped: shipped });
    expect(pickUpLine(n.lines)).toBe([PICK_1500, note, shipped].join(DOT));
    expect(n.printed.pickUpPrintedChars).toBe(1500);
    expect(n.row.budget_chars).toBe(5900);
    expect(n.row.greeting_chars).toBe(m.row.greeting_chars + 3 + note.length + 3 + shipped.length);
  });

  it("T352-2 budgeted with nothing to exclude: an empty pick-up, a reader with no handoff, an unresolved seat and an absent count all give exactly 4400", () => {
    const empty = measure(stateWith("   "));
    expect(pickUpLine(empty.lines)).toBe("(nothing recorded)");
    expect(empty.printed.pickUpPrintedChars).toBe(0);
    expect(empty.row.budget_chars).toBe(4400);

    const noHandoff = measure(stateWith(PICK_1500), { seat: "qa" });
    expect(pickUpLine(noHandoff.lines)).toBe("none recorded for this seat (qa)");
    expect(noHandoff.printed.pickUpPrintedChars).toBe(0);
    expect(noHandoff.row.budget_chars).toBe(4400);

    const noSeat = measure(stateWith(PICK_1500), { seat: null });
    expect(pickUpLine(noSeat.lines)).toBe("none: this reader's seat is unresolved, so no handoff is named as yours");
    expect(noSeat.printed.pickUpPrintedChars).toBe(0);
    expect(noSeat.row.budget_chars).toBe(4400);

    const state = stateWith(PICK_1500);
    const absent = buildGreetingMetricsRow(metricsInput(renderBriefing(input(state)).join("\n"), state), null, NOW);
    expect(absent.budget_chars).toBe(4400);
  });

  it("T352-3 budget off: budget_chars is null, the legacy layout reports nothing, and a count handed in is not used", () => {
    const off = measure(stateWith(PICK_1500), { budget: false });
    expect(off.printed.pickUpPrintedChars).toBe(0);
    expect(off.row.budget_chars).toBeNull();
    expect(off.row.greeting_chars).toBe(off.report.length);

    const state = stateWith(PICK_1500);
    const handed = buildGreetingMetricsRow(metricsInput(off.report, state, { budget: false, pickUpPrintedChars: 1500 }), null, NOW);
    expect(handed.budget_chars).toBeNull();
  });

  it("T352-4 the red stays real: with a 3000-character pick-up, 4400 characters of everything else fits and 4401 does not", () => {
    expect(PICK_3000.length).toBe(3000);
    const state = stateWith(PICK_3000);
    // The skills line is printed as given, so its length sets the size of the briefing without the pick-up exactly.
    const rest = measure(state, { skills: "Skills: " }).row.greeting_chars - 3000;
    expect(rest).toBeGreaterThan(0);
    expect(rest).toBeLessThan(4400);

    const fits = measure(state, { skills: `Skills: ${"s".repeat(4400 - rest)}` });
    expect(pickUpLine(fits.lines)).toBe(PICK_3000);
    expect(fits.row.greeting_chars).toBe(7400);
    expect(fits.row.budget_chars).toBe(7400);
    expect(fits.row.greeting_chars > (fits.row.budget_chars ?? -1), "4400 without the pick-up is not over").toBe(false);

    const over = measure(state, { skills: `Skills: ${"s".repeat(4401 - rest)}` });
    expect(over.row.greeting_chars).toBe(7401);
    expect(over.row.budget_chars).toBe(7400);
    expect(over.row.greeting_chars > (over.row.budget_chars ?? -1), "4401 without the pick-up is over, however long the pick-up").toBe(true);
  });

  it("T352-5 the excluded count is the pick-up as PRINTED: a 5000-character one cut at the cap counts 4014, a flattened one counts its flat length", () => {
    // briefing-budget T344-4's text: the only sentence end is in the first half, so the cut is at 4000 plus the 14-character suffix.
    const runaway = `Done. ${words(998)}word`;
    expect(runaway.length).toBe(5000);
    const cut = measure(stateWith(runaway));
    expect(pickUpLine(cut.lines)).toBe(`Done. ${words(798)}word\u2026 (5000 chars)`);
    expect(pickUpLine(cut.lines).length).toBe(4014);
    expect(cut.printed.pickUpPrintedChars).toBe(4014);
    expect(cut.row.budget_chars).toBe(8414);
    expect(cut.row.greeting_chars).toBe(cut.report.length);

    const stored = "Step one.\n\nStep two.   Step three.\n";
    expect(stored.length).toBe(35);
    const flat = measure(stateWith(stored));
    expect(pickUpLine(flat.lines)).toBe("Step one. Step two. Step three.");
    expect(flat.printed.pickUpPrintedChars).toBe(31);
    expect(flat.row.budget_chars).toBe(4431);
  });
});

describe("T-352: ob_start hands the printed pick-up's length to the row it writes", () => {
  function git(root: string, args: string[]): void {
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "-c", "maintenance.auto=false", "-c", "gc.auto=0", ...args], { cwd: root, stdio: "ignore" });
  }

  /** t298-greeting-truth G12's project, with a 1500-character pick-up and the given greeting.json. */
  function project(greeting: Record<string, unknown>): string {
    const root = tmp("t352-");
    git(root, ["init", "-q"]);
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
    for (const [rel, body] of [["SYSTEM/SUMMARY.md", "# S\n"], ["TASKS/INBOX.md", "# I\n"], ["TASKS/task.md", "# T\n"], ["SESSIONS/next-session.md", "# N\n"]] as const) {
      writeFileSync(join(root, ".agents", rel), body);
    }
    const r = structuredClone(FIXTURE);
    r.handoffs = [{ ...r.handoffs[0], seat: "developer", session_uuid: "u-1", checkout: "x", pick_up: PICK_1500 }];
    writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(r, null, 2) + "\n");
    writeFileSync(join(root, ".agents", "AGENT.local.md"), ["---", "name: Fixture", "role: developer", "partner: Other", "---", ""].join("\n"));
    git(root, ["add", "-A"]);
    git(root, ["commit", "-q", "-m", "seed"]);
    writeFileSync(join(root, ".agents", "SYSTEM", "greeting.json"), JSON.stringify(greeting));
    return root;
  }

  const blockOf = (text: string): string[] => {
    const all = text.split("\n");
    const a = all.indexOf(BRIEFING_START);
    const b = all.indexOf(BRIEFING_END, a);
    return a < 0 || b < 0 ? [] : all.slice(a, b + 1);
  };

  it("T352-6 a budgeted start writes budget_chars 5900 beside the whole block's size; a start with the budget off writes null", async () => {
    const dir = tmp("t352-db-");
    const prior = process.env.KNOWLEDGE_V2_DB;
    process.env.KNOWLEDGE_V2_DB = join(dir, "knowledge-v2.db");
    try {
      const on = (await handleStart({ project_root: project({ greeting_metrics: true, briefing_budget: true }) })).content[0]!.text;
      expect(on).not.toContain("Greeting metrics: not written");
      const block = blockOf(on);
      expect(pickUpLine(block)).toBe(PICK_1500);

      const off = (await handleStart({ project_root: project({ greeting_metrics: true }) })).content[0]!.text;
      expect(off).not.toContain("Greeting metrics: not written");

      const rows = readFileSync(join(dir, "greeting-metrics.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as GreetingMetricsRow);
      expect(rows).toHaveLength(2);
      expect(rows[0]!.greeting_chars).toBe(block.join("\n").length);
      expect(rows[0]!.budget_chars).toBe(5900);
      expect(rows[0]!.greeting_chars - 1500, "the fixture's briefing without its pick-up is inside the budget").toBeLessThanOrEqual(4400);
      expect(rows[0]!.greeting_chars <= (rows[0]!.budget_chars ?? -1)).toBe(true);
      expect(rows[1]!.budget_chars).toBeNull();
    } finally {
      if (prior === undefined) delete process.env.KNOWLEDGE_V2_DB;
      else process.env.KNOWLEDGE_V2_DB = prior;
    }
  }, 120000);
});
