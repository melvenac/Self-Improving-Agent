import { describe, it, expect } from "vitest";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCursorRulesCurrent } from "../../src/pipelines/sync/developer-building-checks.js";
import { renderBriefing, type BriefingInput } from "../../src/pipelines/session-start/briefing.js";
import { parseState } from "../../src/shared/state-schema.js";
import { applyStateOps } from "../../src/shared/state-writer.js";

const ROOT = join(import.meta.dirname, "../../..");
const FIXTURE = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures-state/state.json"), "utf8"));

/**
 * F8 documents the three red-first mutants on loop/fleet-ae-mut-1..3.
 * This file stays green on the candidate; each mutant branch should fail its row.
 */
describe("F8: mutant targets (green on candidate)", () => {
  it("cursor-rules-current fails when the .mdc drifts (mut-1 breaks by downgrading to warn)", () => {
    const mdc = join(ROOT, ".cursor/rules/developer-building-checks.mdc");
    const saved = readFileSync(mdc, "utf8");
    writeFileSync(mdc, saved + "\n", "utf8");
    const r = checkCursorRulesCurrent(ROOT);
    expect(r.severity).toBe("issue");
    writeFileSync(mdc, saved, "utf8");
  });

  it("STANDING RULES lists every standing decision (mut-2 caps the section)", () => {
    const raw = structuredClone(FIXTURE);
    raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", session_uuid: "u-1", checkout: "sia-forge", pick_up: "x", watch_out: [], open_questions: [] }];
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
    const bullets = renderBriefing(input).filter((l) => l.startsWith("- D-"));
    expect(bullets.length).toBe(15);
  });

  it("set_standing refuses unknown decision ids (mut-3 writes anyway)", () => {
    const root = mkdtempSync(join(tmpdir(), "fleet-ae-f8-"));
    try {
      mkdirSync(join(root, ".agents"), { recursive: true });
      cpSync(join(import.meta.dirname, "../fixtures-state/state.json"), join(root, ".agents/state.json"));
      const r = applyStateOps(root, {
        session: 55,
        expected_revision: 7,
        ops: [{ op: "set_standing", id: "D-404", standing: true }],
      });
      expect(r.ok).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
