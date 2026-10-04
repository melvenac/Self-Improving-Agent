import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleStart } from "../../../src/server.js";

/**
 * T-236 (c) O1: with `briefing_focus` OFF (absent or false), or ON without `briefing_budget`, the Briefing carries no
 * FOCUS or SEATS, and absent and false render byte-identically, on SIA's fixture and on A2A's record (1c200b41). It
 * imports nothing new, so it runs unchanged against the pre-(c) product: there it must pass too. That is the proof
 * that OFF is today's render.
 */
const REPO = join(import.meta.dirname, "../../../..");
const FIXTURES = join(import.meta.dirname, "../../fixtures-state");
const saved = { A2A_KEY_DIR: process.env.A2A_KEY_DIR };
let keyDir: string;
const parents: string[] = [];

beforeEach(() => {
  // No key anywhere: presence prints UNKNOWN and never calls a hub (and a stray call would throw).
  keyDir = mkdtempSync(join(tmpdir(), "t236c-off-keys-"));
  process.env.A2A_KEY_DIR = keyDir;
  vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    throw new Error("no network in focus-off tests");
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (saved.A2A_KEY_DIR === undefined) delete process.env.A2A_KEY_DIR;
  else process.env.A2A_KEY_DIR = saved.A2A_KEY_DIR;
  rmSync(keyDir, { recursive: true, force: true });
  for (const p of parents.splice(0)) rmSync(p, { recursive: true, force: true });
});

async function briefing(state: string, flags: Record<string, boolean> | null): Promise<string> {
  const parent = mkdtempSync(join(tmpdir(), "t236c-off-"));
  parents.push(parent);
  const root = join(parent, "sia-infra");
  for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
  writeFileSync(join(root, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N\n");
  cpSync(join(REPO, ".agents", "SYSTEM", "hub-partner-seats.json"), join(root, ".agents", "SYSTEM", "hub-partner-seats.json"));
  cpSync(state, join(root, ".agents", "state.json"));
  if (flags) writeFileSync(join(root, ".agents", "SYSTEM", "greeting.json"), JSON.stringify(flags));
  const text = (await handleStart({ project_root: root })).content[0].text;
  const from = text.indexOf("## Briefing");
  const to = text.indexOf("## End Briefing");
  expect(from, "a Briefing block is rendered").toBeGreaterThanOrEqual(0);
  return text.slice(from, to);
}

describe.each([
  ["SIA", join(FIXTURES, "state.json")],
  ["A2A @ 1c200b41", join(FIXTURES, "a2a-state-1c200b41.json")],
])("T-236 (c) O1 on %s's record", (_name, state) => {
  it.each([
    ["budget on, focus key absent vs false", { briefing_budget: true }, { briefing_budget: true, briefing_focus: false }],
    ["budget off, no file vs focus false", null, { briefing_focus: false }],
    ["focus ON without budget is inert", { briefing_budget: false }, { briefing_budget: false, briefing_focus: true }],
  ])("%s: no FOCUS, no SEATS, byte-identical", async (_label, a, b) => {
    const one = await briefing(state, a);
    const two = await briefing(state, b);
    for (const text of [one, two]) {
      expect(text).not.toContain("FOCUS:");
      expect(text).not.toContain("SEATS:");
    }
    expect(two).toBe(one);
  });
});
