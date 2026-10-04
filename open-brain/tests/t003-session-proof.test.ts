import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { applyStateOps } from "../src/shared/state-writer.js";
import {
  byPidDir, processStartTime, writeProcessSession, removeProcessSession, proveSession,
} from "../src/shared/process-session.js";
import { writeActiveSession, activeSessionKey } from "../src/shared/active-session.js";
import { canonicalizeProjectDir } from "../src/shared/paths.js";

/**
 * T-003: a server writes under a session id only when it can PROVE the id is
 * its own. QA 125's A7, A8 and A9 as rows, in one checkout, plus two sessions,
 * a reconnect, /clear, the nested launch and a reused pid.
 *
 * The proof is REAL, not simulated: each row writes by-pid/<pid>.json for this
 * worker's actual parent process with that process's actual start time, read by
 * the same function the hook uses. The directory sits beside the scratch
 * active-session.json that tests/setup-env.ts pins, so nothing here reaches
 * ~/.claude/open-brain.
 *
 * Each row imports a FRESH server module: a new instance is exactly what a
 * reconnect produces, and it keeps one row's registration out of the next.
 */

const stateFixture = join(import.meta.dirname, "fixtures-state/state.json");
// The tsx LOADER in-process (node --import), not tsx's cli: the cli runs the
// script in a second node process, which makes the writer's parent tsx rather
// than the stand-in claude. The two-sessions row asserts ppid === parent, which
// is how that was caught.
const TSX_ESM = pathToFileURL(createRequire(import.meta.url).resolve("tsx/esm")).href;
const FAKE_CLAUDE = resolve(import.meta.dirname, "fixtures-t003/fake-claude.cjs");
const WRITER = resolve(import.meta.dirname, "fixtures-t003/writer.ts");

const SELF = "00000137-0000-4000-8000-000000000001";
const OTHER = "00000137-0000-4000-8000-000000000002";
const NEXT = "00000137-0000-4000-8000-000000000003";
const ATTACKER = "00000137-0000-4000-8000-000000000666";

type Server = typeof import("../src/server.js");
type State = { revision: number; handoffs: Array<{ session_uuid: string | null; pick_up: string }> };

const dir = () => byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!);
const text = (r: { content: { text: string }[] }) => r.content[0].text;
let parentStart: string | null;

function prove(id: string, pid = process.ppid, start = parentStart): void {
  writeProcessSession(dir(), { session_id: id, claude_pid: pid, proc_start: start!, ide: "claude", written_at: new Date().toISOString() });
}
function unprove(pid = process.ppid): void {
  rmSync(join(dir(), `${pid}.json`), { force: true });
}
/** The per-project slot, holding another session: what T-003's adoption read. */
function slotHolds(id: string): void {
  const cwd = process.cwd();
  writeActiveSession(process.env.OPEN_BRAIN_ACTIVE_SESSION!, activeSessionKey(canonicalizeProjectDir(cwd) || cwd, "claude"), {
    uuid: id, project_dir: cwd, source: "session_id", started_at: new Date().toISOString(), ide: "claude",
  });
}
async function freshServer(): Promise<Server> {
  vi.resetModules();
  return await import("../src/server.js");
}

beforeAll(() => {
  parentStart = processStartTime(process.ppid);
});

describe("processStartTime: the instrument, checked before anything relies on it", () => {
  it("reads a live process (known positive) and is stable across two reads", () => {
    const a = processStartTime(process.pid);
    expect(a).not.toBeNull();
    expect(processStartTime(process.pid)).toBe(a);
    expect(parentStart).not.toBeNull();
  });

  it("tells two different live processes apart, and reads no time for a process that does not exist", () => {
    expect(processStartTime(process.pid)).not.toBe(processStartTime(process.ppid));
    const gone = spawnSync(process.execPath, ["-e", "console.log(process.pid)"], { encoding: "utf-8" });
    expect(processStartTime(Number(gone.stdout.trim()))).toBeNull();
    expect(processStartTime(0)).toBeNull();
    expect(processStartTime(-1)).toBeNull();
  });
});

describe("T-003: the server proves its own session", { timeout: 60_000 }, () => {
  let tmp: string;
  let savedClaudePid: string | undefined;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ob-t003-"));
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "0.29.0" }));
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(tmp, ".agents", d), { recursive: true });
    writeFileSync(join(tmp, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N — [Date]\n> **Status:** In Progress\n");
    cpSync(stateFixture, join(tmp, ".agents", "state.json"));
    rmSync(dir(), { recursive: true, force: true });
    rmSync(process.env.OPEN_BRAIN_ACTIVE_SESSION!, { force: true });
    savedClaudePid = process.env.CLAUDE_PID;
  });
  afterEach(() => {
    if (savedClaudePid === undefined) delete process.env.CLAUDE_PID; else process.env.CLAUDE_PID = savedClaudePid;
    rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  const state = (): State => JSON.parse(readFileSync(join(tmp, ".agents", "state.json"), "utf-8"));
  const handoffOf = (id: string) => state().handoffs.find((h) => h.session_uuid === id)?.pick_up;
  const write = (s: Server, pick_up: string, session = 800) =>
    s.handleState({ project_root: tmp, session, expected_revision: state().revision, ops: [{ op: "set_handoff", seat: "developer", pick_up, watch_out: [], open_questions: [] }] });

  it("A7 in ONE checkout: registering as another session is refused, naming both ids, and the write lands under the proven id", async () => {
    // Seeded through the writer directly, so this row does not depend on how the
    // server under test obtains a session.
    const seeded = applyStateOps(tmp, {
      session: 801, expected_revision: state().revision, session_uuid: OTHER, render: false,
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "victim's handoff", watch_out: [], open_questions: [] }],
    });
    expect(seeded.ok).toBe(true);

    prove(SELF);
    const s = await freshServer();
    const res = await s.handleSetSession({ session_id: OTHER, project_dir: tmp });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain(`ob_set_session refused: ${OTHER} is not this server's session`);
    expect(text(res)).toContain(`this server's parent process ${process.ppid} is session ${SELF}`);

    expect((await write(s, "attacker overwrote it")).isError).toBeUndefined();
    expect(handoffOf(OTHER)).toBe("victim's handoff");
    expect(handoffOf(SELF)).toBe("attacker overwrote it");
  });

  it("ob_set_session with the proven id is accepted and says where the proof came from; with no argument it registers the proven id, not the slot's", async () => {
    prove(SELF);
    slotHolds(OTHER);
    const s = await freshServer();
    const named = await s.handleSetSession({ session_id: SELF, project_dir: tmp });
    expect(named.isError).toBeUndefined();
    expect(text(named)).toContain(`Session registered: ${SELF}`);
    expect(text(named)).toContain(`[via process proof: parent ${process.ppid}]`);

    const bare = await (await freshServer()).handleSetSession({ project_dir: tmp });
    expect(bare.isError).toBeUndefined();
    expect(text(bare)).toContain(`Session registered: ${SELF}`);
    expect(text(bare)).not.toContain(OTHER);
  });

  it("A8 reconnect: a fresh server never adopts the slot's other session; its first write lands under its own", async () => {
    prove(SELF);
    slotHolds(OTHER); // session OTHER started second in this checkout
    const reconnected = await freshServer(); // no ob_set_session, as after /mcp reconnect
    expect((await write(reconnected, "written after a reconnect")).isError).toBeUndefined();
    expect(handoffOf(SELF)).toBe("written after a reconnect");
    expect(handoffOf(OTHER)).toBeUndefined();
  });

  it("no proof: a fresh slot is NOT adopted, the attributed write refuses, and the reason is named", async () => {
    slotHolds(OTHER);
    const s = await freshServer();
    const res = await write(s, "must not land");
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("no session proof for this server's parent process");
    expect(handoffOf(OTHER)).toBeUndefined();
    const reg = await s.handleSetSession({ project_dir: tmp });
    expect(reg.isError).toBe(true);
    expect(text(reg)).toContain("cannot prove its session");
  });

  it("A9 /clear: the surviving server writes under the NEW session with no re-registration, and ob_start stamps the new id", async () => {
    prove(SELF);
    const s = await freshServer();
    await s.handleSetSession({ session_id: SELF, project_dir: tmp });
    expect((await write(s, "before /clear", 800)).isError).toBeUndefined();

    prove(NEXT); // the new session's SessionStart hook
    expect((await write(s, "after /clear", 802)).isError).toBeUndefined();
    expect(handoffOf(SELF)).toBe("before /clear");
    expect(handoffOf(NEXT)).toBe("after /clear");
    expect(text(await s.handleStart({ project_root: tmp }))).toContain(`Session ID: ${NEXT}`);
  });

  it("/clear with a FAILED SessionStart: SessionEnd removed the proof, so the surviving server refuses instead of writing as the old session", async () => {
    prove(SELF);
    const s = await freshServer();
    await s.handleSetSession({ session_id: SELF, project_dir: tmp });
    expect(removeProcessSession(dir(), process.ppid, SELF)).toBe("removed");
    const res = await write(s, "must not land as the old session");
    expect(res.isError).toBe(true);
    expect(handoffOf(SELF)).toBeUndefined();
  });

  it("nested launch: CLAUDE_PID names ANOTHER claude with a valid proof, and the server still attributes to its own parent", async () => {
    prove(SELF);
    // A real live process with a real start time, holding the attacker's id:
    // what an inherited CLAUDE_PID points at when claude runs inside another session.
    prove(ATTACKER, process.pid, processStartTime(process.pid));
    process.env.CLAUDE_PID = String(process.pid);
    const s = await freshServer();
    expect((await write(s, "nested server's write")).isError).toBeUndefined();
    expect(handoffOf(SELF)).toBe("nested server's write");
    expect(handoffOf(ATTACKER)).toBeUndefined();
  });

  it("a reused pid: a proof written for an earlier process with this pid is refused", async () => {
    prove(OTHER, process.ppid, "win:1");
    const s = await freshServer();
    const res = await write(s, "must not land");
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("a reused pid");
    expect(handoffOf(OTHER)).toBeUndefined();
  });

  it("ob_end refuses a session_id that is not the proven one", async () => {
    prove(SELF);
    const s = await freshServer();
    const res = await s.handleEnd({ project_root: tmp, session_id: OTHER, dry_run: true });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain(`${OTHER} is not this server's session`);
  });

  it("ob_store_chunk refuses a session_id that is not the proven one, and links a chunk to the proven one when none is named", async () => {
    prove(SELF);
    const s = await freshServer();
    const bad = await s.handleStoreChunk({ content: "c", key: "t003-bad", category: "note", project_dir: tmp, session_id: OTHER });
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain(`${OTHER} is not this server's session`);
    const good = await s.handleStoreChunk({ content: "c", key: "t003-good", category: "note", project_dir: tmp });
    expect(good.isError).toBeUndefined();
    expect(text(good)).toContain(`Session: ${SELF}`);
  });

  /** Runs WRITER as the direct child of a stand-in claude whose proof holds `id`. */
  async function sessionWrites(id: string, label: string, session: number): Promise<{ isError: boolean; text: string; ppid: number; parent: number }> {
    const child = spawn(process.execPath, [FAKE_CLAUDE, process.execPath, "--import", TSX_ESM, WRITER, tmp, label, String(session)], { env: process.env });
    let out = "";
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    const parent = await new Promise<number>((res, rej) => {
      child.stdout.on("data", (d) => {
        out += d;
        const m = /^PID (\d+)\n/.exec(out);
        if (m) res(Number(m[1]));
      });
      child.on("error", rej);
    });
    prove(id, parent, processStartTime(parent));
    child.stdin.write("go\n");
    const status = await new Promise<number | null>((res) => child.on("close", res));
    const last = out.trim().split("\n").pop()!;
    if (status !== 0) throw new Error(`writer exited ${status}: ${err || last}`);
    return { ...JSON.parse(last), parent };
  }

  it("two sessions in ONE checkout, each a real process: each write lands under its own uuid and neither replaces the other", async () => {
    slotHolds(OTHER); // OTHER started last: the slot every T-003 adoption read
    const a = await sessionWrites(SELF, "session A's handoff", 810);
    const b = await sessionWrites(OTHER, "session B's handoff", 811);
    expect(a.ppid).toBe(a.parent);
    expect(b.ppid).toBe(b.parent);
    expect(a.isError).toBe(false);
    expect(b.isError).toBe(false);
    expect(handoffOf(SELF)).toBe("session A's handoff");
    expect(handoffOf(OTHER)).toBe("session B's handoff");
  });
});

describe("proveSession: every refusal is named, and nothing falls back", () => {
  let d: string;
  beforeEach(() => { d = mkdtempSync(join(tmpdir(), "ob-t003-proof-")); });
  afterEach(() => rmSync(d, { recursive: true, force: true }));

  it("absent, unreadable, no id, wrong pid, unreadable parent start, and start mismatch each refuse with their own reason", () => {
    expect(proveSession(d, 4242, "s")).toMatchObject({ id: null, reason: expect.stringContaining("absent") });
    writeFileSync(join(d, "4242.json"), "{not json");
    expect(proveSession(d, 4242, "s")).toMatchObject({ id: null, reason: expect.stringContaining("unreadable") });
    writeFileSync(join(d, "4242.json"), JSON.stringify({ claude_pid: 4242, proc_start: "s" }));
    expect(proveSession(d, 4242, "s")).toMatchObject({ id: null, reason: expect.stringContaining("no session_id") });
    writeFileSync(join(d, "4242.json"), JSON.stringify({ session_id: SELF, claude_pid: 1, proc_start: "s" }));
    expect(proveSession(d, 4242, "s")).toMatchObject({ id: null, reason: expect.stringContaining("names pid 1") });
    writeFileSync(join(d, "4242.json"), JSON.stringify({ session_id: SELF, claude_pid: 4242, proc_start: "s" }));
    expect(proveSession(d, 4242, null)).toMatchObject({ id: null, reason: expect.stringContaining("could not be read") });
    expect(proveSession(d, 4242, "t")).toMatchObject({ id: null, reason: expect.stringContaining("a reused pid") });
    expect(proveSession(d, 4242, "s")).toEqual({ id: SELF, pid: 4242 });
  });

  it("removeProcessSession removes only its own session's proof", () => {
    writeProcessSession(d, { session_id: NEXT, claude_pid: 7, proc_start: "s", ide: "claude", written_at: "" });
    expect(removeProcessSession(d, 7, SELF)).toBe("kept: holds another session");
    expect(existsSync(join(d, "7.json"))).toBe(true);
    expect(removeProcessSession(d, 7, NEXT)).toBe("removed");
    expect(existsSync(join(d, "7.json"))).toBe(false);
    expect(removeProcessSession(d, 7, NEXT)).toBe("absent");
  });
});

/**
 * The two hooks, run as the real entry points with a real payload on stdin and
 * a real CLAUDE_PID (this worker: a live process with a real start time). HOME
 * and the slot are per-test scratch; the v2 DB is pointed at a path that does
 * not exist so SessionEnd stops after the proof step instead of running its
 * pipeline.
 */
describe("T-003 hooks: SessionStart writes the proof, SessionEnd removes its own", { timeout: 60_000 }, () => {
  const BOOT = resolve(import.meta.dirname, "../src/cli-bootstrap.ts");
  const END = resolve(import.meta.dirname, "../src/cli-session-end.ts");
  let home: string;
  let cwd: string;
  let slot: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "ob-t003-home-"));
    cwd = mkdtempSync(join(tmpdir(), "ob-t003-cwd-"));
    slot = join(home, "slot", "active-session.json");
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    rmSync(cwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });
  // CLAUDE_PID is a live process that is NOT the hook's parent (the hook's parent is
  // this worker), so a hook that used its ppid instead would write the wrong file.
  const CLAUDE = process.ppid;
  const proofFile = (pid = CLAUDE) => join(byPidDir(slot), `${pid}.json`);

  function hook(script: string, payload: unknown, claudePid: string | undefined): { status: number | null; stdout: string; stderr: string } {
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, OPEN_BRAIN_ACTIVE_SESSION: slot, KNOWLEDGE_V2_DB: join(home, "absent", "k.db"), CLAUDE_PROJECT_DIR: cwd };
    // Explicitly set or DELETED: an inherited CLAUDE_PID (this suite may run
    // under a claude) must never stand in for the row's value.
    if (claudePid === undefined) delete env.CLAUDE_PID; else env.CLAUDE_PID = claudePid;
    const r = spawnSync(process.execPath, ["--import", TSX_ESM, script], { input: JSON.stringify(payload), encoding: "utf-8", env, cwd });
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  }

  it("SessionStart writes by-pid/<CLAUDE_PID>.json with the payload's id and that process's real start time, and says so", () => {
    const r = hook(BOOT, { session_id: SELF, cwd, transcript_path: "C:/t/x.jsonl" }, String(CLAUDE));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`Session proof written: session ${SELF} for claude process ${CLAUDE}.`);
    const p = JSON.parse(readFileSync(proofFile(), "utf-8"));
    expect(p).toMatchObject({ session_id: SELF, claude_pid: CLAUDE, ide: "claude", transcript_path: "C:/t/x.jsonl" });
    expect(p.proc_start).toBe(processStartTime(CLAUDE));
    // End to end: a server whose parent is this process would prove SELF.
    expect(proveSession(byPidDir(slot), CLAUDE, processStartTime(CLAUDE))).toEqual({ id: SELF, pid: CLAUDE });
  });

  it("no CLAUDE_PID, a Cursor payload, a subagent, or no payload id: NO proof is written, and the first two say why", () => {
    const noPid = hook(BOOT, { session_id: SELF, cwd }, undefined);
    expect(noPid.stdout).toContain("Session proof NOT written: CLAUDE_PID is unset");
    const sub = hook(BOOT, { session_id: SELF, cwd, agent_id: "a1" }, String(CLAUDE));
    expect(sub.status).toBe(0);
    const none = hook(BOOT, { cwd }, String(CLAUDE));
    expect(none.stdout).toContain("Session proof NOT written: the payload carried no session id.");
    expect(existsSync(proofFile())).toBe(false);
  });

  it("SessionEnd removes the proof when it holds the ending session, and keeps the NEXT session's", () => {
    writeProcessSession(byPidDir(slot), { session_id: NEXT, claude_pid: CLAUDE, proc_start: "x", ide: "claude", written_at: "" });
    const other = hook(END, { session_id: SELF, reason: "clear" }, String(CLAUDE));
    expect(other.stdout).toContain(`session proof for claude process ${CLAUDE}: kept: holds another session`);
    expect(existsSync(proofFile())).toBe(true);

    const own = hook(END, { session_id: NEXT, reason: "clear" }, String(CLAUDE));
    expect(own.stdout).toContain(`session proof for claude process ${CLAUDE}: removed`);
    expect(existsSync(proofFile())).toBe(false);
  });
});
