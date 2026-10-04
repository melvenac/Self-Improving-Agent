import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseState } from "../../../src/shared/state-schema.js";
import { renderBriefing } from "../../../src/pipelines/session-start/briefing.js";
import { renderState } from "../../../src/pipelines/session-start/state-render.js";

/**
 * T-236 slice 2, the hard constraint: A2A shares this renderer, so with every new behaviour OFF (the default) the output on
 * A2A's record is BYTE-IDENTICAL to what master rendered before slice 2.
 *
 * The fixture is A2A-Hub's `.agents/state.json` at master 1c200b41f3f22ba8f62f6dfcf77339e0754ec334, fetched read-only with
 * `gh api` (rev 179, schema 3, 7 handoffs). Its provenance is asserted by hash, not by a size: 260,229 BYTES, 259,959
 * CHARACTERS (UTF-8 multibyte), so a character count is not a byte count.
 *
 * The golden was generated from UNCHANGED master code, before any slice-2 edit, and committed first. It holds renderBriefing
 * and renderState for the planner, developer and qa seats and for an unresolved seat.
 */
const FIXTURES = join(import.meta.dirname, "../../fixtures-state");
const FIXTURE_FILE = "a2a-state-1c200b41.json";
const GOLDEN_FILE = "a2a-1c200b41-render.golden.txt";
const FIXTURE_SHA256 = "8892464b6608a82c38fa63e878b2458412fbbd12a15471c0d6aea94f21004549";
const FIXTURE_BLOB_SHA = "3cc195a5e372ccc6c4b143c361c6f4337886e063";

const fixtureBytes = readFileSync(join(FIXTURES, FIXTURE_FILE));

/** The same deterministic inputs the golden was generated with. */
function renderAll(): string {
  const parsed = parseState(fixtureBytes.toString("utf8"));
  if (!parsed.ok) throw new Error(parsed.error);
  const state = parsed.data;
  const base = {
    state,
    version: "9.9.9",
    sessionNumber: 160,
    sessionNote: null,
    date: "2026-10-03",
    drift: [],
    serving: "Build abc1234 · current",
    usage: "Usage: GREEN → dispatches open",
    latestBrief: "Latest brief: docs/loops/x-brief.md (2026-10-02)",
    workingTree: "Working tree: clean",
    skills: "Skills: none",
  };
  const parts: string[] = [];
  for (const seat of ["planner", "developer", "qa", null] as const) {
    parts.push(`=== renderBriefing seat=${seat} ===`, ...renderBriefing({ ...base, seat }));
    parts.push(`=== renderState seat=${seat} ===`, ...renderState(state, "9.9.9", { seat }));
  }
  return parts.join("\n") + "\n";
}

describe("T-236 slice 2: A2A's record renders byte-identical with every new behaviour off", () => {
  it("the fixture is A2A-Hub's state.json at 1c200b41, byte for byte (sha256 and git blob sha)", () => {
    expect(createHash("sha256").update(fixtureBytes).digest("hex")).toBe(FIXTURE_SHA256);
    const blob = createHash("sha1").update(`blob ${fixtureBytes.length}\0`).update(fixtureBytes).digest("hex");
    expect(blob).toBe(FIXTURE_BLOB_SHA);
    expect(fixtureBytes.length).toBe(260229);
    expect(fixtureBytes.toString("utf8").length).toBe(259959);
  });

  it("the fixture is the real record: rev 179, schema 3, 7 handoffs, long watch-outs that a default cap would change", () => {
    const parsed = parseState(fixtureBytes.toString("utf8"));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.data.revision).toBe(179);
    expect(parsed.data.handoffs).toHaveLength(7);
    const widest = Math.max(...parsed.data.handoffs.map((h) => h.watch_out.length));
    expect(widest, "the planner handoff's watch-outs are what a default cap would have truncated").toBeGreaterThanOrEqual(10);
  });

  it("renderBriefing and renderState match the golden generated from master BEFORE slice 2, for four seats", () => {
    const golden = readFileSync(join(FIXTURES, GOLDEN_FILE), "utf8");
    expect(golden.split("\n").filter((l) => l.startsWith("=== ")).length).toBe(8);
    expect(renderAll()).toBe(golden);
  });
});
