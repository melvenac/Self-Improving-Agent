import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleStart } from "../src/server.js";
import { readRepoRecord, REPO_ROOT } from "./helpers/repo-record.js";

/**
 * QA 269 probe for #402 (not for merge). End to end, in a checkout NAMED sia-infra with the real seat map and an
 * AGENT.local.md that lies (Builder): the notice must say "infra", in the budgeted pick-up line (<= 160, no new line)
 * and as its own line in the legacy layout. And with no state.json at all, the not-checked reason must print.
 */
const parents: string[] = [];
const saved = { A2A_KEY_DIR: process.env.A2A_KEY_DIR };
let keyDir: string;
beforeEach(() => {
  keyDir = mkdtempSync(join(tmpdir(), "qa269-keys-"));
  process.env.A2A_KEY_DIR = keyDir;
  vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("no network"); });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (saved.A2A_KEY_DIR === undefined) delete process.env.A2A_KEY_DIR; else process.env.A2A_KEY_DIR = saved.A2A_KEY_DIR;
  rmSync(keyDir, { recursive: true, force: true });
  for (const p of parents.splice(0)) rmSync(p, { recursive: true, force: true });
});

function checkout(flags: Record<string, boolean>, withState: boolean): string {
  const parent = mkdtempSync(join(tmpdir(), "qa269-402-"));
  parents.push(parent);
  const root = join(parent, "sia-infra");
  for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
  writeFileSync(join(root, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N\n");
  cpSync(join(REPO_ROOT, ".agents", "SYSTEM", "hub-partner-seats.json"), join(root, ".agents", "SYSTEM", "hub-partner-seats.json"));
  writeFileSync(join(root, ".agents", "AGENT.local.md"), "---\nname: Builder\nrole: developer\npartner: Atlas\n---\n");
  writeFileSync(join(root, ".agents", "SYSTEM", "greeting.json"), JSON.stringify(flags));
  if (withState) {
    const s = structuredClone(readRepoRecord().state);
    s.sessions = [...s.sessions, { n: 9001, date: "2026-10-03", uuid: "11111111-2222-3333-4444-555555555555", seat: null, checkout: "sia-infra", first_rev: 123456 }];
    writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(s, null, 2));
  }
  return root;
}
const briefing = (t: string) => t.slice(t.indexOf("## Briefing"), t.indexOf("## End Briefing"));

describe("QA 269 #402 probe", () => {
  it("budgeted: the notice rides the pick-up body line, labelled by the map (infra), <= 160", async () => {
    const b = briefing((await handleStart({ project_root: checkout({ briefing_budget: true, missing_handoff: true }, true) })).content[0].text);
    const lines = b.split("\n");
    const i = lines.findIndex((l) => l.startsWith("PICK UP HERE"));
    const body = lines[i + 1]!;
    const notice = body.slice(body.indexOf("Handoff MISSING"));
    console.log(`QA269-402 BUDGETED header=${JSON.stringify(lines[i])} body=${JSON.stringify(body)} notice=${notice.length} lines=${lines.length - 1}`);
    expect(notice).toMatch(/^Handoff MISSING: last infra session #9001 /);
    expect(notice.length).toBeLessThanOrEqual(160);
    expect(b.split("Handoff MISSING").length).toBe(2);
    expect(b).not.toMatch(/last (builder|developer|Builder) session/);
  });
  it("legacy: its own line after the pick-up", async () => {
    const b = briefing((await handleStart({ project_root: checkout({ missing_handoff: true }, true) })).content[0].text);
    const lines = b.split("\n");
    const i = lines.findIndex((l) => l.startsWith("Handoff MISSING"));
    console.log(`QA269-402 LEGACY prev=${JSON.stringify(lines[i - 1])} line=${JSON.stringify(lines[i])}`);
    expect(lines[i]).toMatch(/^Handoff MISSING: last infra session #9001 /);
  });
  it("no state.json: the not-checked reason prints", async () => {
    const t = (await handleStart({ project_root: checkout({ missing_handoff: true }, false) })).content[0].text;
    const l = t.split("\n").find((x) => x.startsWith("Handoff check"));
    console.log(`QA269-402 NORECORD ${JSON.stringify(l)}`);
    expect(l).toBe("Handoff check: not checked (no .agents/state.json, so there is no record to read)");
  });
});
