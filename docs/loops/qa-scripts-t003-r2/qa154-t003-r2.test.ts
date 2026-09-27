import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { applyStateOps } from "../src/shared/state-writer.js";
import { byPidDir, processStartTime, writeProcessSession } from "../src/shared/process-session.js";
import { initSchemaV2, indexKnowledge, recordRecallEvent } from "../src/db-v2.js";

/**
 * QA 154 (T-003 round 2, d781b59): rows in shapes the round-2 rows do not cover.
 * - R2-D1: a write that carries NO handoff is refused too, so a session recorded under another checkout cannot move
 *   its session record's checkout first and then replace its handoff (the mutant M6 "handoff batches only").
 * - D3: after /clear, the same server's ob_end rates the NEW session's recall_log only.
 * - D1: the other session's own log, which carries its id, is not reused.
 */
const stateFixture = join(import.meta.dirname, "fixtures-state/state.json");
const VICTIM = "00000154-0000-4000-8000-000000000800";
const OTHER = "0be70be7-dddd-4eee-8fff-000000000be7";
const A = "a1540000-0000-4000-8000-0000000000a1";
const B = "b1540000-0000-4000-8000-0000000000b1";

type Server = typeof import("../src/server.js");
type Rec = {
  revision: number;
  sessions: Array<{ uuid: string; checkout: string | null }>;
  handoffs: Array<{ session_uuid: string | null; pick_up: string; checkout: string | null }>;
};

const dir = () => byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!);
const text = (r: { content: { text: string }[] }) => r.content[0].text;
let parentStart: string | null;
function prove(id: string): void {
  writeProcessSession(dir(), { session_id: id, claude_pid: process.ppid, proc_start: parentStart!, ide: "claude", written_at: new Date().toISOString() });
}
async function freshServer(): Promise<Server> {
  vi.resetModules();
  return await import("../src/server.js");
}
beforeAll(() => { parentStart = processStartTime(process.ppid); });

describe("QA 154: T-003 round 2", { timeout: 60_000 }, () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "qa154-"));
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "0.29.0" }));
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(tmp, ".agents", d), { recursive: true });
    cpSync(stateFixture, join(tmp, ".agents", "state.json"));
    rmSync(join(dir(), `${process.ppid}.json`), { force: true });
  });
  afterEach(() => {
    rmSync(join(dir(), `${process.ppid}.json`), { force: true });
    rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });
  const state = (): Rec => JSON.parse(readFileSync(join(tmp, ".agents", "state.json"), "utf-8"));
  const victim = () => ({ h: state().handoffs.find((h) => h.session_uuid === VICTIM), s: state().sessions.find((x) => x.uuid === VICTIM) });
  const seedVictim = () => {
    const r = applyStateOps(tmp, {
      session: 800, expected_revision: state().revision, session_uuid: VICTIM, checkout: "sia-builder", render: false,
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "victim in sia-builder", watch_out: [], open_questions: [] }],
    });
    expect(r.ok).toBe(true);
  };
  const decision = { op: "add_decision", title: "qa154", date: "2026-09-27", note: "n" };

  it("R2-D1: a write with no handoff (add_decision) is refused, and the session record keeps its checkout", async () => {
    seedVictim();
    prove(VICTIM);
    const s = await freshServer();
    const rev = state().revision;
    const w = await s.handleState({ project_root: tmp, session: 801, expected_revision: rev, ops: [decision] });
    expect(w.isError).toBe(true);
    expect(text(w)).toContain("sia-builder");
    expect(state().revision).toBe(rev);
    expect(victim().s?.checkout).toBe("sia-builder");
  });

  it("R2-D1: two steps (a decision, then a handoff) cannot replace the other checkout's session's handoff", async () => {
    seedVictim();
    prove(VICTIM);
    const s = await freshServer();
    await s.handleState({ project_root: tmp, session: 801, expected_revision: state().revision, ops: [decision] });
    await s.handleState({
      project_root: tmp, session: 801, expected_revision: state().revision,
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "replaced", watch_out: [], open_questions: [] }],
    });
    expect(victim().h?.pick_up).toBe("victim in sia-builder");
    expect(victim().h?.checkout).toBe("sia-builder");
  });

  it("R2-D1: a dry run is refused the same way", async () => {
    seedVictim();
    prove(VICTIM);
    const s = await freshServer();
    const w = await s.handleState({
      project_root: tmp, session: 801, expected_revision: state().revision, dry_run: true,
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "dry", watch_out: [], open_questions: [] }],
    });
    expect(w.isError).toBe(true);
    expect(text(w)).toContain("sia-builder");
  });

  it("D3: after /clear, ob_end (end.md's call) rates the NEW session's recalls only", async () => {
    const dbPath = process.env.KNOWLEDGE_V2_DB!;
    const db = new Database(dbPath);
    initSchemaV2(db);
    const k1 = `qa154-d3-a-${process.pid}`, k2 = `qa154-d3-b-${process.pid}`;
    indexKnowledge(db, { vaultPath: join(tmp, "a.md"), key: k1, content: "recalled by A", tags: "qa154", source: "manual" });
    indexKnowledge(db, { vaultPath: join(tmp, "b.md"), key: k2, content: "recalled by B", tags: "qa154", source: "manual" });
    const id1 = (db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(k1) as { id: number }).id;
    const id2 = (db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(k2) as { id: number }).id;
    recordRecallEvent(db, A, "qa154 a", [id1], "explicit");
    recordRecallEvent(db, B, "qa154 b", [id2], "explicit");
    db.close();
    prove(A);
    const s = await freshServer();
    prove(B); // /clear: the same server, the proof now names B
    const res = await s.handleEnd({ project_root: tmp, dry_run: true, session_summary: "qa154", entry_ratings: { [String(id1)]: "harmful", [String(id2)]: "neutral" } });
    expect(text(res)).toContain("Recalled ids: 1 from recall-log");
    const check = new Database(dbPath, { readonly: true });
    const rows = check.prepare("SELECT session_uuid AS s, knowledge_id AS k FROM feedback_log WHERE knowledge_id IN (?, ?)").all(id1, id2) as Array<{ s: string; k: number }>;
    check.close();
    expect(rows).toEqual([{ s: B, k: id2 }]);
  });

  it("D1: no proof, and the OTHER session's log carries its id: that log is not reused and no id is stamped", async () => {
    const home = mkdtempSync(join(tmpdir(), "qa154-home-"));
    const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
    try {
      process.env.HOME = home;
      process.env.USERPROFILE = home;
      const { deriveProjectKey } = await import("../src/pipelines/session-start/session-discovery.js");
      const pdir = join(home, ".claude", "projects", deriveProjectKey(tmp));
      mkdirSync(pdir, { recursive: true });
      writeFileSync(join(pdir, `${OTHER}.jsonl`), "{}\n");
      prove(OTHER);
      const other = await (await freshServer()).handleStart({ project_root: tmp });
      expect(text(other)).toContain(`Session ID: ${OTHER}`);
      rmSync(join(dir(), `${process.ppid}.json`), { force: true });
      const r = await (await freshServer()).handleStart({ project_root: tmp });
      expect(text(r)).toContain("Session ID: none —");
      expect(text(r)).not.toContain("reused");
      expect(text(r)).not.toContain(OTHER);
      const sess = join(tmp, ".agents", "SESSIONS");
      const logs = readdirSync(sess).filter((f) => /^Session_\d+\.md$/.test(f)).sort();
      expect(logs.length).toBe(2);
      const mine = logs.map((f) => readFileSync(join(sess, f), "utf-8")).filter((c) => !c.includes(OTHER));
      expect(mine.length).toBe(1);
      expect(mine[0]).not.toContain("Session ID:");
      expect(existsSync(join(sess, logs[0]))).toBe(true);
    } finally {
      if (saved.HOME === undefined) delete process.env.HOME; else process.env.HOME = saved.HOME;
      if (saved.USERPROFILE === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = saved.USERPROFILE;
      rmSync(home, { recursive: true, force: true });
    }
  });
});
