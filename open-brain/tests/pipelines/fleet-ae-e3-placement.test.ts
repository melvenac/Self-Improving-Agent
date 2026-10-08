import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderBriefing, type BriefingInput } from "../../src/pipelines/session-start/briefing.js";
import { parseState } from "../../src/shared/state-schema.js";

const FIXTURE = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures-state/state.json"), "utf8"));

describe("E3: STANDING RULES placement in briefing", () => {
  it("index(WATCH OUT) < index(STANDING RULES) < index(OPEN QUESTIONS)", () => {
    const raw = structuredClone(FIXTURE);
    raw.handoffs = [
      {
        ...raw.handoffs[0],
        seat: "developer",
        session_uuid: "u-1",
        checkout: "sia-forge",
        pick_up: "pick up",
        watch_out: ["watch line"],
        open_questions: ["question?"],
      },
    ];
    raw.decisions = [
      ...raw.decisions,
      { id: "D-099", title: "Standing for placement", date: "2026-10-08", note: "", standing: true },
    ];
    const parsed = parseState(JSON.stringify(raw));
    if (!parsed.ok) throw new Error(parsed.error);
    const input: BriefingInput = {
      state: parsed.data,
      version: "1.0.0",
      seat: "developer",
      sessionNumber: 1,
      sessionNote: null,
      date: "2026-10-08",
      drift: [],
      serving: "Serving build: x",
      usage: "Usage: GREEN → dispatches open",
      latestBrief: null,
      workingTree: "Working tree: clean",
      skills: "Skills: none",
    };
    const lines = renderBriefing(input);
    const w = lines.indexOf("WATCH OUT");
    const s = lines.indexOf("STANDING RULES");
    const o = lines.indexOf("OPEN QUESTIONS");
    expect(w).toBeGreaterThan(-1);
    expect(s).toBeGreaterThan(-1);
    expect(o).toBeGreaterThan(-1);
    expect(w).toBeLessThan(s);
    expect(s).toBeLessThan(o);
  });
});
