import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BRIEFING_BUDGET,
  renderBriefing,
  STANDING_RULES_LINE_CHARS,
  standingRulesBudgetLine,
  type BriefingInput,
} from "../../../src/pipelines/session-start/briefing.js";
import { parseState, type State } from "../../../src/shared/state-schema.js";

const FIXTURES = join(import.meta.dirname, "../../fixtures-state");
const SIA = JSON.parse(readFileSync(join(FIXTURES, "state.json"), "utf8"));

function stateWithStanding(count: number, startId = 1): State {
  const raw = structuredClone(SIA);
  raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", session_uuid: "u-1", checkout: "sia-forge", pick_up: "pick up", watch_out: [], open_questions: [] }];
  raw.decisions = Array.from({ length: count }, (_, i) => ({
    id: `D-${String(startId + i).padStart(3, "0")}`,
    title: `standing ${startId + i}`,
    date: "2026-10-08",
    note: "",
    standing: true,
  }));
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

const input = (state: State, over: Partial<BriefingInput> = {}): BriefingInput => ({
  state,
  version: "9.9.9",
  seat: "developer",
  sessionNumber: 160,
  sessionNote: null,
  date: "2026-10-03",
  drift: [],
  serving: "Build abc1234 · current",
  usage: "Usage: GREEN → dispatches open",
  latestBrief: null,
  workingTree: "Working tree: clean",
  skills: "Skills: none",
  budget: true,
  ...over,
});

const size = (lines: string[]) => ({ lines: lines.length, chars: lines.join("\n").length });

describe("STANDING-BUDGET: standing rules in the budgeted briefing", () => {
  it("zero standing rules: no STANDING RULES line", () => {
    const parsed = parseState(JSON.stringify(structuredClone(SIA)));
    if (!parsed.ok) throw new Error(parsed.error);
    const lines = renderBriefing(input(parsed.data));
    expect(lines.some((l) => l.includes("STANDING RULES"))).toBe(false);
    expect(standingRulesBudgetLine(parsed.data)).toBeNull();
  });

  it("every id fits: one line, newest first, no +K more", () => {
    const state = stateWithStanding(5, 130);
    const line = standingRulesBudgetLine(state)!;
    expect(line).toMatch(/^STANDING RULES \(5\): /);
    expect(line).not.toContain("+");
    expect(line).toContain("D-134 D-133 D-132 D-131 D-130");
    const rendered = renderBriefing(input(state));
    expect(rendered.filter((l) => l.startsWith("STANDING RULES"))).toHaveLength(1);
    expect(rendered).toContain(line);
  });

  it("60 standing rules: one capped line with +K more and the whole briefing inside budget", () => {
    const state = stateWithStanding(60, 1);
    const lines = renderBriefing(input(state));
    const standing = lines.filter((l) => l.startsWith("STANDING RULES"));
    expect(standing).toHaveLength(1);
    const line = standing[0]!;
    expect(line).toMatch(/^STANDING RULES \(60\): /);
    expect(line).toMatch(/ \+\d+ more$/);
    const k = Number(line.match(/\+(\d+) more$/)![1]);
    const idsOnLine = line.slice(line.indexOf(": ") + 2).replace(/ \+\d+ more$/, "").split(" ").filter(Boolean);
    expect(k).toBe(60 - idsOnLine.length);
    expect(idsOnLine[0]).toBe("D-060");
    expect(line.length).toBeLessThanOrEqual(STANDING_RULES_LINE_CHARS);
    const { lines: n, chars } = size(lines);
    expect(n).toBeLessThanOrEqual(BRIEFING_BUDGET.lines);
    expect(chars).toBeLessThanOrEqual(BRIEFING_BUDGET.chars);
  });

  it("legacy layout still uses the full standingRulesLines list", () => {
    const state = stateWithStanding(3, 10);
    const lines = renderBriefing(input(state, { budget: false }));
    expect(lines).toContain("STANDING RULES");
    expect(lines.filter((l) => l.startsWith("- D-"))).toHaveLength(3);
  });
});
