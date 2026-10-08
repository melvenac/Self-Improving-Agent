import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseState, type State } from "../../src/shared/state-schema.js";
import { renderBriefing, type BriefingInput } from "../../src/pipelines/session-start/briefing.js";

const FIXTURE = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures-state/state.json"), "utf8"));

function input(state: State): BriefingInput {
  return {
    state,
    version: "9.9.9",
    seat: "developer",
    sessionNumber: 12,
    sessionNote: null,
    date: "2026-10-03",
    drift: [],
    serving: "Serving build: synthetic",
    usage: "Usage: GREEN → dispatches open",
    latestBrief: null,
    workingTree: "Working tree: clean",
    skills: "Skills: none",
  };
}

describe("F6: STANDING RULES is never trimmed", () => {
  it("40 standing decisions all render in STANDING RULES", () => {
    const raw = structuredClone(FIXTURE);
    raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", session_uuid: "u-1", checkout: "sia-forge", pick_up: "x", watch_out: [], open_questions: [] }];
    raw.decisions = Array.from({ length: 40 }, (_, i) => ({
      id: `D-${String(100 + i)}`,
      title: `Standing rule ${i}`,
      date: "2026-10-08",
      note: "",
      standing: true,
    }));
    const parsed = parseState(JSON.stringify(raw));
    if (!parsed.ok) throw new Error(parsed.error);
    const lines = renderBriefing(input(parsed.data));
    const start = lines.indexOf("STANDING RULES");
    expect(start).toBeGreaterThan(0);
    const bullets = lines.slice(start + 1).filter((l) => l.startsWith("- D-"));
    expect(bullets).toHaveLength(40);
    expect(bullets[0]).toContain("D-139");
    expect(bullets[39]).toContain("D-100");
  });
});
