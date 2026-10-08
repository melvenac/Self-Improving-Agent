import { describe, it, expect, afterEach } from "vitest";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkCursorRulesCurrent, writeDeveloperBuildingChecksMdc } from "../../src/pipelines/sync/developer-building-checks.js";
import { renderBriefing, type BriefingInput } from "../../src/pipelines/session-start/briefing.js";
import { parseState } from "../../src/shared/state-schema.js";
import { applyStateOps } from "../../src/shared/state-writer.js";
import { expectRepoClean, mkFleetAeTemp, REPO_ROOT, seedFleetAeCursorProject } from "./fleet-ae-harness.js";

const FIXTURE = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures-state/state.json"), "utf8"));

describe("F8: mutant targets (green on candidate)", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    expectRepoClean(REPO_ROOT);
  });

  it("cursor-rules-current fails when the .mdc drifts (mut-1 hashes whole file)", () => {
    dir = mkFleetAeTemp("fleet-ae-f8-");
    seedFleetAeCursorProject(dir);
    writeDeveloperBuildingChecksMdc(dir);
    const mdc = join(dir, ".cursor/rules/developer-building-checks.mdc");
    writeFileSync(mdc, readFileSync(mdc, "utf8") + "\n", "utf8");
    const r = checkCursorRulesCurrent(dir);
    expect(r.severity).toBe("issue");
  });

  it("STANDING RULES lists every standing decision (mut-2 places section above WATCH OUT)", () => {
    const raw = structuredClone(FIXTURE);
    raw.handoffs = [
      {
        ...raw.handoffs[0],
        seat: "developer",
        session_uuid: "u-1",
        checkout: "sia-forge",
        pick_up: "x",
        watch_out: ["watch this"],
        open_questions: ["open?"],
      },
    ];
    raw.decisions = Array.from({ length: 15 }, (_, i) => ({
      id: `D-${200 + i}`,
      title: `Rule ${i}`,
      date: "2026-10-08",
      note: "",
      standing: true,
    }));
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
    expect(s).toBeGreaterThan(w);
    expect(o).toBeGreaterThan(s);
    expect(lines.filter((l) => l.startsWith("- D-")).length).toBe(15);
  });

  it("set_standing refuses unknown decision ids (mut-3 reads hub-partner-seats requiredBlock)", () => {
    dir = mkFleetAeTemp("fleet-ae-f8-");
    mkdirSync(join(dir, ".agents"), { recursive: true });
    cpSync(join(import.meta.dirname, "../fixtures-state/state.json"), join(dir, ".agents/state.json"));
    const r = applyStateOps(dir, {
      session: 55,
      expected_revision: 7,
      ops: [{ op: "set_standing", id: "D-404", standing: true }],
    });
    expect(r.ok).toBe(false);
  });
});
