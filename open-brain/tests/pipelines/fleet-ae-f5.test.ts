import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseState } from "../../src/shared/state-schema.js";
import { renderBriefing, type BriefingInput } from "../../src/pipelines/session-start/briefing.js";

const FIXTURE = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures-state/state.json"), "utf8"));

function input(state: typeof FIXTURE): BriefingInput {
  const parsed = parseState(JSON.stringify(state));
  if (!parsed.ok) throw new Error(parsed.error);
  return {
    state: parsed.data,
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

describe("F5: no standing field renders as before", () => {
  it("a record with no standing anywhere omits STANDING RULES (master snapshot)", () => {
    for (const d of FIXTURE.decisions) {
      expect(d.standing).toBeUndefined();
    }
    const out = renderBriefing(input(FIXTURE)).join("\n");
    expect(out).not.toContain("STANDING RULES");
    expect(out).toMatchSnapshot();
  });
});
