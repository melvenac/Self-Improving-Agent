import { describe, it, expect } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps } from "../../../src/shared/state-writer.js";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import { handoffLagNote } from "../../../src/pipelines/session-start/briefing.js";
import { buildGreetingMetricsRow, type GreetingMetricsInput } from "../../../src/pipelines/session-start/greeting-metrics.js";

const fixturesDir = join(import.meta.dirname, "../../fixtures");
const stateFixture = join(import.meta.dirname, "../../fixtures-state/state.json");
const STATE = ".agents/state.json";

function readState(root: string): State {
  const r = parseState(readFileSync(join(root, STATE), "utf-8"));
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

function withRoot(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "ob-t298s2-"));
  try {
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
}

const SET_HANDOFF = { op: "set_handoff", seat: "qa", pick_up: "p", watch_out: [], open_questions: [] };
const u1 = (root: string) => readState(root).handoffs.find((h) => h.session_uuid === "u-1")!;

describe("T-298 step 2: set_handoff stamps written_rev", () => {
  it("H1: the stamp is the revision the write produced, and the lag note counts later writes", () => {
    withRoot((root) => {
      const a = applyStateOps(root, { session: 55, expected_revision: 7, session_uuid: "u-1", checkout: "c", ops: [SET_HANDOFF] });
      expect(a.ok).toBe(true);
      expect(u1(root).written_rev).toBe(8);
      expect(readState(root).revision).toBe(8);

      const b = applyStateOps(root, { session: 55, expected_revision: 8, session_uuid: "u-1", checkout: "c", ops: [{ op: "open_task", title: "t", priority: "P2" }] });
      expect(b.ok).toBe(true);
      expect(u1(root).written_rev).toBe(8);
      expect(readState(root).revision).toBe(9);
      expect(handoffLagNote(u1(root), 9)).toBe("handoff +1");
    });
  });

  it("H2: a second set_handoff for the same session re-stamps", () => {
    withRoot((root) => {
      applyStateOps(root, { session: 55, expected_revision: 7, session_uuid: "u-1", checkout: "c", ops: [SET_HANDOFF] });
      applyStateOps(root, { session: 55, expected_revision: 8, session_uuid: "u-1", checkout: "c", ops: [{ op: "open_task", title: "t", priority: "P2" }] });
      const c = applyStateOps(root, { session: 55, expected_revision: 9, session_uuid: "u-1", checkout: "c", ops: [SET_HANDOFF] });
      expect(c.ok).toBe(true);
      expect(u1(root).written_rev).toBe(10);
    });
  });
});

describe("T-298 step 2: metrics alarms match only real alarm lines", () => {
  const input = (serving: string, report: string): GreetingMetricsInput => ({
    projectRoot: tmpdir(),
    callerLabel: "open-brain MCP server",
    report,
    serving,
    state: null,
    seatName: null,
    role: null,
    ownCheckout: undefined,
    sessionNumber: null,
    startedAt: Date.now(),
    budget: false,
  });
  const NOW = new Date("2026-10-16T12:00:00Z");

  it("H3: alarm text quoted in free text does not fire", () => {
    const report = [
      "Build 1234567",
      "- watch: Handoff MISSING: quoted in a watch-out",
      "- a note saying Drift detected (1): x (not fixed)",
      "- a quote of Build abc1234 · STALE PROCESS: from a handoff",
      "pick-up text that mentions Latest brief: not determined (x) mid-line",
    ].join("\n");
    const row = buildGreetingMetricsRow(input("Build 1234567", report), null, NOW);
    for (const id of ["stale_process", "drift_not_fixed", "handoff_missing", "latest_brief_undetermined"]) {
      expect(row.alarm_streaks).not.toHaveProperty(id);
    }
  });

  it("H4: the real alarm lines still fire", () => {
    const serving = "Build a346e5b · STALE PROCESS: disk has 0dcf8f4 (built x) → /mcp reconnect open-brain";
    const report = [
      serving,
      "Session 1 — 2026-10-16 · p v1 · state rev 5 · Drift detected (1): x: expected a, got b (not fixed)",
      "pick-up text · Handoff MISSING: last planner session #3 (u, rev 4) wrote the record, left no handoff; fix: ob_state set_handoff",
      "Latest brief: not determined (git: boom)",
    ].join("\n");
    const row = buildGreetingMetricsRow(input(serving, report), null, NOW);
    expect(row.alarm_streaks).toEqual({ stale_process: 1, drift_not_fixed: 1, handoff_missing: 1, latest_brief_undetermined: 1 });
  });

  it("H5: the legacy drift line at the start of a line fires", () => {
    const report = ["Build 1234567", "Drift detected (2): a: expected 1, got 2 (not fixed); b: expected 3, got 4 (fixed)"].join("\n");
    const row = buildGreetingMetricsRow(input("Build 1234567", report), null, NOW);
    expect(row.alarm_streaks.drift_not_fixed).toBe(1);
  });
});
