import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseState, type State } from "../src/shared/state-schema.js";
import { renderBriefing, type BriefingInput } from "../src/pipelines/session-start/briefing.js";

/**
 * S173H (T-305, D-160): the greeting's date is UTC, so it reads 2026-10-19Z. Only the printed session line carries the Z;
 * the date handed to renderBriefing stays plain, because watch-out expiry compares it with an ISO date as a string.
 */
const FIXTURE = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures-state/state.json"), "utf8"));

function stateWith(watch_out: unknown[]): State {
  const raw = structuredClone(FIXTURE);
  raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", session_uuid: "u-1", checkout: "sia-forge", watch_out }];
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

const input = (state: State, over: Partial<BriefingInput> = {}): BriefingInput => ({
  state,
  version: "9.9.9",
  seat: "developer",
  sessionNumber: 12,
  sessionNote: null,
  date: "2026-10-19",
  drift: [],
  serving: "Build abc1234 · current",
  usage: "Usage: GREEN → dispatches open",
  latestBrief: "Latest brief: docs/loops/x-brief.md (2026-10-18)",
  workingTree: "Working tree: clean",
  skills: "Skills: none",
  ...over,
});

const sessionLine = (lines: string[]): string => lines.find((l) => l.startsWith("Session 12 — "))!;

describe("S173H: the greeting's UTC date carries a Z", () => {
  it("R1: the original layout's session line reads 2026-10-19Z", () => {
    const line = sessionLine(renderBriefing(input(stateWith([]))));
    expect(line.startsWith("Session 12 — 2026-10-19Z · ")).toBe(true);
  });

  it("R2: the budgeted layout's session line reads 2026-10-19Z", () => {
    const line = sessionLine(renderBriefing(input(stateWith([]), { budget: true })));
    expect(line.startsWith("Session 12 — 2026-10-19Z · ")).toBe(true);
  });

  it("R3: a watch-out that expires on the UTC date still prints that day, and is dropped the day after", () => {
    const state = stateWith([{ text: "until the 19th", expires: "2026-10-19" }]);
    expect(renderBriefing(input(state, { budget: true }))).toContain("- until the 19th");
    expect(renderBriefing(input(state, { budget: true, date: "2026-10-20" }))).toContain("1 expired, not shown");
  });
});
