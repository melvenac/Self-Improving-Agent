import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { handleStart, handleState } from "../src/server.js";

/**
 * QA 269 probe (not for merge). O1-DUMP: the Briefing and the whole ob_start text (temp root masked) for each
 * flag config on SIA's and A2A's fixtures, written to ~/qa-tmp so the head's and master's dumps can be diffed.
 * W-OBSTATE: tasks[].assignee set and cleared through ob_state (handleState) in a scratch record, re-read from disk.
 */
const TREE = basename(join(import.meta.dirname, "../.."));
const OUT = join(process.env.HOME ?? tmpdir(), "qa-tmp");
const REPO = join(import.meta.dirname, "../..");
const FIXTURES = join(import.meta.dirname, "fixtures-state");
const saved = { A2A_KEY_DIR: process.env.A2A_KEY_DIR };
let keyDir: string;
const parents: string[] = [];

beforeEach(() => {
  keyDir = mkdtempSync(join(tmpdir(), "qa269-keys-"));
  process.env.A2A_KEY_DIR = keyDir;
  vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    throw new Error("no network in the QA probe");
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (saved.A2A_KEY_DIR === undefined) delete process.env.A2A_KEY_DIR;
  else process.env.A2A_KEY_DIR = saved.A2A_KEY_DIR;
  rmSync(keyDir, { recursive: true, force: true });
  for (const p of parents.splice(0)) rmSync(p, { recursive: true, force: true });
});

function scratch(state: string, flags: Record<string, boolean> | null): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "qa269-"));
  parents.push(parent);
  const root = join(parent, "sia-infra");
  for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
  writeFileSync(join(root, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N\n");
  cpSync(join(REPO, ".agents", "SYSTEM", "hub-partner-seats.json"), join(root, ".agents", "SYSTEM", "hub-partner-seats.json"));
  cpSync(state, join(root, ".agents", "state.json"));
  if (flags) writeFileSync(join(root, ".agents", "SYSTEM", "greeting.json"), JSON.stringify(flags));
  return { parent, root };
}

const CONFIGS: Array<[string, Record<string, boolean> | null]> = [
  ["no-file", null],
  ["focus-false", { briefing_focus: false }],
  ["budget-on", { briefing_budget: true }],
  ["budget-on-focus-false", { briefing_budget: true, briefing_focus: false }],
  ["budget-off-focus-on", { briefing_budget: false, briefing_focus: true }],
];

describe("QA 269 O1 dump", () => {
  it("dumps every config on both fixtures", async () => {
    const dump: Record<string, string> = {};
    for (const [fx, file] of [["SIA", "state.json"], ["A2A", "a2a-state-1c200b41.json"]] as const) {
      for (const [label, flags] of CONFIGS) {
        const { parent, root } = scratch(join(FIXTURES, file), flags);
        const text = (await handleStart({ project_root: root })).content[0].text.split(parent).join("<ROOT>");
        dump[`${fx}/${label}`] = text;
      }
    }
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `qa269-o1-${TREE}.json`), JSON.stringify(dump, null, 1));
    expect(Object.keys(dump)).toHaveLength(10);
  });
});

describe("QA 269 row 8: assignee through ob_state", () => {
  it("sets and clears tasks[].assignee via handleState and the file carries it", async () => {
    const { root } = scratch(join(FIXTURES, "state.json"), null);
    const path = join(root, ".agents", "state.json");
    const rev = JSON.parse(readFileSync(path, "utf8")).revision as number;
    const id = JSON.parse(readFileSync(path, "utf8")).tasks.find((t: { status: string }) => t.status !== "done").id as string;
    const r = await handleState({ project_root: root, session: 999, expected_revision: rev, ops: [{ op: "update_task", id, assignee: "infra" }] });
    console.log(`QA269-W SET ${r.content[0].text.split("\n").slice(0, 2).join(" | ")}`);
    const after = JSON.parse(readFileSync(path, "utf8"));
    const t = after.tasks.find((x: { id: string }) => x.id === id);
    console.log(`QA269-W REREAD ${id} assignee=${JSON.stringify(t.assignee)} rev=${after.revision} withKey=${after.tasks.filter((x: object) => "assignee" in x).length}`);
    expect(t.assignee).toBe("infra");
    const r2 = await handleState({ project_root: root, session: 999, expected_revision: rev + 1, ops: [{ op: "update_task", id, assignee: null }] });
    console.log(`QA269-W CLEAR ${r2.content[0].text.split("\n").slice(0, 2).join(" | ")}`);
    const after2 = JSON.parse(readFileSync(path, "utf8"));
    expect(after2.tasks.filter((x: object) => "assignee" in x)).toHaveLength(0);
    expect(existsSync(path)).toBe(true);
  });
});
