import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import { renderBriefing, STALE_OBJECTIVE, type BriefingInput } from "../../../src/pipelines/session-start/briefing.js";
import { ALARM_IDS, buildGreetingMetricsRow, type GreetingMetricsInput } from "../../../src/pipelines/session-start/greeting-metrics.js";

/**
 * T-327: a greeting whose NEXT marks the objective as naming a done task (T-309's STALE_OBJECTIVE on a `- [done]` row)
 * raises the `objective_stale` alarm on its greeting-metrics row, so the dashboard scorecard shows a stale objective
 * and how many greetings in a row carried it. The pattern is anchored on the render's row shape, so the note quoted in
 * prose does not raise it.
 */
const SIA = JSON.parse(readFileSync(join(import.meta.dirname, "../../fixtures-state/state.json"), "utf8"));
const NOW = new Date("2026-10-27T12:00:00Z");

type RawTask = { id: string; status: string; title: string };
const done = (SIA.tasks as RawTask[]).find((t) => t.status === "done")!;
const open = (SIA.tasks as RawTask[]).find((t) => t.status === "open")!;

function stateWith(objective: string): State {
  const raw = structuredClone(SIA);
  raw.objective = { text: objective, since_session: 5 };
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

const briefingInput = (state: State): BriefingInput => ({
  state,
  version: "9.9.9",
  seat: "developer",
  sessionNumber: 160,
  sessionNote: null,
  date: "2026-10-03",
  drift: [],
  serving: "Build abc1234 - current",
  usage: "Usage: GREEN -> dispatches open",
  latestBrief: "Latest brief: docs/loops/t236-brief.md (2026-10-03)",
  workingTree: "Working tree: clean",
  skills: "Skills: self-improving-agent-gotchas, self-improving-agent-guide",
  budget: true,
});

/** The report a real /start would carry: the briefing block rendered from the record. */
const reportFor = (state: State): string =>
  ["Build abc1234 - current", "## Briefing", ...renderBriefing(briefingInput(state)), "## End Briefing"].join("\n");

const metricsInput = (report: string, state: State | null): GreetingMetricsInput => ({
  projectRoot: tmpdir(),
  callerLabel: "open-brain MCP server",
  report,
  serving: "Build abc1234",
  state,
  seatName: "Forge",
  role: "developer",
  ownCheckout: undefined,
  sessionNumber: 3,
  startedAt: NOW.getTime(),
  budget: true,
});

type Streaks = Record<string, number>;
const streaks = (report: string, state: State | null, previous: { alarm_streaks?: Streaks } | null = null): Streaks =>
  (buildGreetingMetricsRow(metricsInput(report, state), previous, NOW) as unknown as { alarm_streaks: Streaks }).alarm_streaks;

describe("T-327: objective_stale alarm on the greeting-metrics row", () => {
  it("fixture: a done task and an open task exist", () => {
    expect(done, "fixture has a done task").toBeTruthy();
    expect(open, "fixture has an open task").toBeTruthy();
  });

  it("A1 a rendered briefing whose objective names a done task raises objective_stale (streak 1)", () => {
    const s = stateWith(`Verify ${done.id}, then ${open.id}.`);
    const report = reportFor(s);
    expect(report, "the render carries T-309's note").toContain(STALE_OBJECTIVE);
    expect(streaks(report, s).objective_stale).toBe(1);
  });

  it("A2 an objective naming only an open task raises nothing", () => {
    const s = stateWith(`Do ${open.id}.`);
    const report = reportFor(s);
    expect(report).not.toContain(STALE_OBJECTIVE);
    expect(streaks(report, s)).not.toHaveProperty("objective_stale");
  });

  it("A3 the note quoted in prose, not on a `- [done]` NEXT row, raises nothing", () => {
    const report = [
      "Build abc1234 - current",
      "## Briefing",
      "WATCH OUT",
      `- an earlier greeting printed ${STALE_OBJECTIVE}`,
      `The objective was fixed; the old note read ${STALE_OBJECTIVE}`,
      "## End Briefing",
    ].join("\n");
    expect(streaks(report, null)).not.toHaveProperty("objective_stale");
  });

  it("A4 the streak counts consecutive greetings: a previous streak of 2 becomes 3", () => {
    const s = stateWith(`Verify ${done.id}.`);
    expect(streaks(reportFor(s), s, { alarm_streaks: { objective_stale: 2 } }).objective_stale).toBe(3);
  });

  it("A5 the id is appended last: the ten existing ids keep their order", () => {
    expect(ALARM_IDS).toHaveLength(11);
    expect(ALARM_IDS[10]).toBe("objective_stale");
    expect(ALARM_IDS.slice(0, 10)).toEqual([
      "tree_diverged", "tree_stale", "record_behind", "stale_process", "build_behind", "old_start_command",
      "usage_not_checked", "drift_not_fixed", "handoff_missing", "latest_brief_undetermined",
    ]);
  });
});
