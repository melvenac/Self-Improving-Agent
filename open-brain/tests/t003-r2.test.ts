import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { applyStateOps } from "../src/shared/state-writer.js";
import { byPidDir, processStartTime, writeProcessSession } from "../src/shared/process-session.js";
import { initSchemaV2, indexKnowledge, recordRecallEvent } from "../src/db-v2.js";

/**
 * T-003 round 2 (record 152). Rows that are red on 9f4fc1e pin a defect.
 * R2-D5 and the same-checkout / null-checkout rows already hold; they are here
 * so the mutant that drops the protection goes red.
 */
const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
const stateFixture = join(import.meta.dirname, "fixtures-state/state.json");
const VICTIM = "00000152-0000-4000-8000-000000000800";
const SELF = "00000152-0000-4000-8000-000000000152";
const OTHER = "0be70be7-dddd-4eee-8fff-000000000be7";

type Server = typeof import("../src/server.js");
type Rec = {
  revision: number;
  sessions: Array<{ uuid: string; checkout: string | null; first_rev: number | null; n: number }>;
  handoffs: Array<{ session_uuid: string | null; pick_up: string; checkout: string | null }>;
};

const dir = () => byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!);
const text = (r: { content: { text: string }[] }) => r.content[0].text;
let parentStart: string | null;

function prove(id: string): void {
  writeProcessSession(dir(), {
    session_id: id, claude_pid: process.ppid, proc_start: parentStart!, ide: "claude", written_at: new Date().toISOString(),
  });
}
async function freshServer(): Promise<Server> {
  vi.resetModules();
  return await import("../src/server.js");
}

beforeAll(() => { parentStart = processStartTime(process.ppid); });

describe("T-003 round 2", { timeout: 60_000 }, () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "t003r2-"));
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
  const handoffOf = (id: string) => state().handoffs.find((h) => h.session_uuid === id);

  function seedVictim(): void {
    const seeded = applyStateOps(tmp, {
      session: 800, expected_revision: state().revision, session_uuid: VICTIM, checkout: "sia-builder", render: false,
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "victim in sia-builder", watch_out: [], open_questions: [] }],
    });
    expect(seeded.ok).toBe(true);
  }

  async function attack(projectDir: string | undefined, cwd: string): Promise<void> {
    prove(VICTIM);
    const s = await freshServer();
    const prev = process.cwd();
    try {
      process.chdir(cwd);
      const reg = await s.handleSetSession(projectDir === undefined ? {} : { project_dir: projectDir });
      expect(reg.isError).toBeUndefined();
      const w = await s.handleState({
        project_root: tmp, session: 801, expected_revision: state().revision,
        ops: [{ op: "set_handoff", seat: "developer", pick_up: "replaced", watch_out: [], open_questions: [] }],
      });
      expect(w.isError).toBe(true);
      expect(text(w)).toContain("sia-builder");
      expect(handoffOf(VICTIM)?.pick_up).toBe("victim in sia-builder");
      expect(handoffOf(VICTIM)?.checkout).toBe("sia-builder");
    } finally {
      process.chdir(prev);
    }
  }

  it("D1 ob_start with no proof prints Session ID: none and does not stamp the newest transcript", async () => {
    const home = mkdtempSync(join(tmpdir(), "t003r2-home-"));
    const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
    try {
      process.env.HOME = home;
      process.env.USERPROFILE = home;
      const { deriveProjectKey } = await import("../src/pipelines/session-start/session-discovery.js");
      const pdir = join(home, ".claude", "projects", deriveProjectKey(tmp));
      mkdirSync(pdir, { recursive: true });
      writeFileSync(join(pdir, `${OTHER}.jsonl`), "{}\n");
      const s = await freshServer();
      const r = await s.handleStart({ project_root: tmp });
      expect(text(r)).toContain("Session ID: none —");
      expect(text(r)).not.toContain(OTHER);
    } finally {
      if (saved.HOME === undefined) delete process.env.HOME; else process.env.HOME = saved.HOME;
      if (saved.USERPROFILE === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = saved.USERPROFILE;
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("D3 ob_end with no session_id rates what recall_log holds for the proven id", async () => {
    const dbPath = process.env.KNOWLEDGE_V2_DB!;
    const db = new Database(dbPath);
    initSchemaV2(db);
    const key = `t003-r2-d3-${process.pid}`;
    indexKnowledge(db, { vaultPath: join(tmp, "d3.md"), key, content: "a recalled fact", tags: "t003", source: "manual" });
    const row = db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(key) as { id: number };
    recordRecallEvent(db, SELF, "t003 r2", [row.id], "explicit");
    db.close();
    prove(SELF);
    const s = await freshServer();
    const res = await s.handleEnd({
      project_root: tmp, dry_run: true, session_summary: "rated the recall",
      entry_ratings: { [String(row.id)]: "helpful" },
    });
    expect(text(res)).toContain("Recalled ids: 1 from recall-log");
    const check = new Database(dbPath, { readonly: true });
    const n = check.prepare("SELECT COUNT(*) AS c FROM feedback_log WHERE session_uuid = ? AND knowledge_id = ?").get(SELF, row.id) as { c: number };
    check.close();
    expect(n.c).toBe(1);
  });

  it("D4 ob_feedback with no proof prints NOT LOGGED and the reason", async () => {
    const dbPath = process.env.KNOWLEDGE_V2_DB!;
    const db = new Database(dbPath);
    initSchemaV2(db);
    const key = `t003-r2-d4-${process.pid}`;
    indexKnowledge(db, { vaultPath: join(tmp, "d4.md"), key, content: "feedback target", tags: "t003", source: "manual" });
    const row = db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(key) as { id: number };
    db.close();
    const s = await freshServer();
    const r = await s.handleFeedback({ id: row.id, rating: "helpful" });
    expect(text(r)).toContain("NOT LOGGED:");
    expect(text(r)).toContain("cannot prove its session");
  });

  it("D5 the proof block honours --ide cursor when the payload has no cursor_version", () => {
    const home = mkdtempSync(join(tmpdir(), "t003r2-ide-"));
    const cwd = mkdtempSync(join(tmpdir(), "t003r2-ide-cwd-"));
    mkdirSync(join(cwd, ".agents"), { recursive: true });
    const script = resolve(import.meta.dirname, "../src/cli-bootstrap.ts");
    const slot = join(home, "active-session.json");
    const r = spawnSync(process.execPath, [TSX_CLI, script, "--ide", "cursor"], {
      input: JSON.stringify({ cwd, session_id: SELF }),
      encoding: "utf-8",
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        OPEN_BRAIN_ACTIVE_SESSION: slot,
        CLAUDE_PID: String(process.pid),
      },
    });
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
    expect(r.stdout ?? "").toContain("Session proof NOT written: this host is not Claude Code");
    expect(r.stdout ?? "").not.toContain("Session proof written:");
  });

  it("P2 a subdirectory registration cannot write the other checkout's session", async () => {
    seedVictim();
    const sub = join(tmp, "open-brain");
    mkdirSync(sub, { recursive: true });
    await attack(sub, tmp);
  });

  it("P3 registering against the victim checkout's basename cannot write this root", async () => {
    seedVictim();
    const other = join(tmp, "p3", "sia-builder");
    mkdirSync(join(other, ".agents"), { recursive: true });
    cpSync(join(tmp, ".agents", "state.json"), join(other, ".agents", "state.json"));
    await attack(other, tmp);
  });

  it("P4 no project_dir, cwd a subdirectory, cannot write the other checkout's session", async () => {
    seedVictim();
    const sub = join(tmp, "open-brain");
    mkdirSync(sub, { recursive: true });
    await attack(undefined, sub);
  });

  it("a session recorded under THIS checkout still writes, and a null checkout is not refused", async () => {
    const here = basename(tmp);
    const seeded = applyStateOps(tmp, {
      session: 810, expected_revision: state().revision, session_uuid: SELF, checkout: here, render: false,
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "local", watch_out: [], open_questions: [] }],
    });
    expect(seeded.ok).toBe(true);
    prove(SELF);
    const s = await freshServer();
    const ok = await s.handleState({
      project_root: tmp, session: 811, expected_revision: state().revision,
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "still local", watch_out: [], open_questions: [] }],
    });
    expect(ok.isError).toBeUndefined();
    expect(handoffOf(SELF)?.pick_up).toBe("still local");

    const legacy = state().sessions.find((x) => x.checkout === null && x.first_rev === null);
    expect(legacy).toBeTruthy();
    prove(legacy!.uuid);
    const s2 = await freshServer();
    const leg = await s2.handleState({
      project_root: tmp, session: 812, expected_revision: state().revision,
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "under the legacy uuid", watch_out: [], open_questions: [] }],
    });
    expect(leg.isError).toBeUndefined();
  });

  it("end.md says what a write records and which checkout is refused", () => {
    const root = resolve(import.meta.dirname, "../..");
    const files = [
      ".claude/commands/end.md",
      "project-template/.claude/commands/end.md",
      "project-template/.cursor/commands/end.md",
    ];
    for (const rel of files) {
      const body = readFileSync(join(root, rel), "utf-8");
      const flat = body.replace(/\s+/g, " ");
      expect(flat, rel).toContain("A write with no session records nothing there, and says so.");
      expect(flat, rel).toContain("A write is refused when its session is already recorded under a different checkout");
      expect(body, rel).not.toContain("Every write records its session in `sessions[]`");
      expect(body, rel).not.toContain("Only a different checkout's recorded session is refused.");
    }
  });
});
