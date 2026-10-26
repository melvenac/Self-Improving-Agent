import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import { buildGreetingMetricsRow, type GreetingMetricsInput } from "../../../src/pipelines/session-start/greeting-metrics.js";

/**
 * T-324 S1 (dashboard T-054): a greeting row names the work it pointed at and the questions it showed as waiting on
 * Aaron, so the scorecard can check the session's first action and whether "waiting on Aaron" is still true.
 * - `pick_up_ids`: T-, V- and #ids from the reader's own handoff pick-up, then the objective, de-duplicated in that
 *   order, at most 10; [] without a record.
 * - `open_questions`: unresolved questions owned by aaron across the newest handoff per seat instance (the WAITING ON
 *   AARON set); null without a record.
 * The row stays schema 1 (the live dashboard drops other schemas); both keys are additive.
 */
const FIXTURE = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../fixtures-state/state.json"), "utf8"));
const PLANNER_LOOP = { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] };
const NOW = new Date("2026-10-27T12:00:00Z");

type Row = Record<string, unknown> & { pick_up_ids?: unknown; open_questions?: unknown };

function stateWith(objective: string | null, handoffs: Array<Record<string, unknown>>): State {
  const r = structuredClone(FIXTURE);
  r.revision = 20;
  r.objective = objective === null ? null : { text: objective, since_session: 1 };
  r.handoffs = handoffs.map((h) => ({ ...FIXTURE.handoffs[0], watch_out: [], open_questions: [], ...h }));
  const parsed = parseState(JSON.stringify(r));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

const input = (state: State | null, role: GreetingMetricsInput["role"] = "developer"): GreetingMetricsInput => ({
  projectRoot: tmpdir(),
  callerLabel: "open-brain MCP server",
  report: "Build 1234567\n## Briefing\n## End Briefing",
  serving: "Build 1234567",
  state,
  seatName: role === null ? null : "Forge",
  role,
  ownCheckout: undefined,
  sessionNumber: 3,
  startedAt: NOW.getTime(),
  budget: false,
});

const row = (state: State | null, role: GreetingMetricsInput["role"] = "developer"): Row =>
  buildGreetingMetricsRow(input(state, role), null, NOW) as unknown as Row;

describe("T-324 S1: pick_up_ids and open_questions on the greeting row", () => {
  it("F1 pick_up_ids: the own pick-up's ids, then the objective's, de-duplicated in order", () => {
    const s = stateWith("Ship T-324 and T-170", [
      { seat: "developer", pick_up: "Finish T-170, land #983, then check V-095 and T-170 again", session: 2, first_rev: 5 },
    ]);
    const r = row(s);
    expect(r.pick_up_ids).toEqual(["T-170", "#983", "V-095", "T-324"]);
    expect(r.schema).toBe(1);
  });

  it("F2 pick_up_ids: at most 10", () => {
    const many = Array.from({ length: 12 }, (_, i) => `T-${100 + i}`).join(" ");
    const r = row(stateWith(null, [{ seat: "developer", pick_up: many, session: 2, first_rev: 5 }]));
    expect(r.pick_up_ids).toEqual(Array.from({ length: 10 }, (_, i) => `T-${100 + i}`));
  });

  it("F3 open_questions: unresolved aaron-owned questions across the newest handoff per seat instance", () => {
    const s = stateWith(null, [
      { seat: "planner", loop_state: PLANNER_LOOP, checkout: "p", session: 1, first_rev: 3, open_questions: [{ text: "old", owner: "aaron" }] },
      {
        seat: "planner", loop_state: PLANNER_LOOP, checkout: "p", session: 2, first_rev: 9,
        open_questions: [
          { text: "a", owner: "aaron" },
          { text: "b", owner: "Aaron" },
          { text: "c", owner: "aaron", resolved_by: "D-1" },
          "plain string",
          { text: "d", owner: "clark" },
        ],
      },
      { seat: "developer", checkout: "d", session: 2, first_rev: 8, pick_up: "x", open_questions: [{ text: "e", owner: "aaron" }] },
    ]);
    expect(row(s).open_questions).toBe(3);
  });

  it("F4 without a record: pick_up_ids [] and open_questions null", () => {
    const r = row(null, null);
    expect(r.pick_up_ids).toEqual([]);
    expect(r.open_questions).toBeNull();
  });

  it("F5 an unresolved seat still gets the objective's ids", () => {
    const s = stateWith("Next: T-324", [{ seat: "developer", pick_up: "T-1", session: 2, first_rev: 5 }]);
    expect(row(s, null).pick_up_ids).toEqual(["T-324"]);
  });
});
