import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { byPidDir, processStartTime, writeProcessSession, proveSession } from "../src/shared/process-session.js";
import { deriveProjectKey } from "../src/pipelines/session-start/session-discovery.js";

/**
 * QA 142 (record session 142) on T-003 candidate 706c029: rows for what QA found, run on tcm.
 * D-rows are EXPECTED RED on 706c029: each pins a defect in the QA report. G-rows are guards that held locally
 * on Windows and are here to be seen holding on Linux (/proc) as well.
 */
const SELF = "5e1f5e1f-aaaa-4bbb-8ccc-000000005e1f";
const OTHER = "0be70be7-dddd-4eee-8fff-000000000be7";
const stateFixture = join(import.meta.dirname, "fixtures-state/state.json");
type Server = typeof import("../src/server.js");
const dir = () => byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!);
let parentStart: string | null;
const prove = (id: string, over: Record<string, unknown> = {}) =>
  writeProcessSession(dir(), { session_id: id, claude_pid: process.ppid, proc_start: parentStart!, ide: "claude", written_at: new Date().toISOString(), ...over } as never);
async function freshServer(): Promise<Server> { vi.resetModules(); return await import("../src/server.js"); }

beforeAll(() => { parentStart = processStartTime(process.ppid); });

describe("QA 142: T-003 findings", { timeout: 60_000 }, () => {
  let tmp: string; let home: string;
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "qa142-t003-"));
    home = mkdtempSync(join(tmpdir(), "qa142-home-"));
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ version: "0.29.0" }));
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(tmp, ".agents", d), { recursive: true });
    cpSync(stateFixture, join(tmp, ".agents", "state.json"));
    rmSync(dir(), { recursive: true, force: true });
    for (const k of ["HOME", "USERPROFILE"]) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of ["HOME", "USERPROFILE"]) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    rmSync(dir(), { recursive: true, force: true });
    rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("D1 ob_start with NO proof does not stamp another session's id (the newest transcript in the project)", async () => {
    process.env.HOME = home; process.env.USERPROFILE = home;
    const pdir = join(home, ".claude", "projects", deriveProjectKey(tmp));
    mkdirSync(pdir, { recursive: true });
    writeFileSync(join(pdir, `${OTHER}.jsonl`), "{}\n");
    const s = await freshServer();
    const r = await s.handleStart({ project_root: tmp });
    const logs = readdirSync(join(tmp, ".agents", "SESSIONS")).map((f) => readFileSync(join(tmp, ".agents", "SESSIONS", f), "utf-8")).join("\n");
    expect(r.content[0].text).not.toContain(OTHER);
    expect(logs).not.toContain(OTHER);
  });

  it("D2 a proof file holding JSON null is a named refusal, not a TypeError (proveSession)", () => {
    mkdirSync(dir(), { recursive: true });
    writeFileSync(join(dir(), `${process.ppid}.json`), "null");
    let r: ReturnType<typeof proveSession> | undefined; let threw: unknown = null;
    try { r = proveSession(dir(), process.ppid, parentStart); } catch (e) { threw = e; }
    expect(threw).toBeNull();
    expect(r?.id).toBeNull();
  });

  it("G1 a proof forged under ANOTHER live pid is never read: the server proves its own parent's", async () => {
    const other = spawn(process.execPath, ["-e", "setTimeout(()=>{},30000)"], { stdio: "ignore" });
    try {
      await new Promise((res) => setTimeout(res, 300));
      writeProcessSession(dir(), { session_id: OTHER, claude_pid: other.pid!, proc_start: processStartTime(other.pid!)!, ide: "claude", written_at: new Date().toISOString() });
      prove(SELF);
      const s = await freshServer();
      const r = await s.handleSetSession({ project_dir: tmp });
      expect(r.content[0].text).toContain(`Session registered: ${SELF}`);
      const x = await s.handleSetSession({ session_id: OTHER, project_dir: tmp });
      expect(x.isError).toBe(true);
    } finally { other.kill(); }
  });

  it("G2 a claim differing from the proof only in letter case is refused (ids compare exactly)", async () => {
    prove(SELF);
    const s = await freshServer();
    expect((await s.handleSetSession({ session_id: SELF.toUpperCase(), project_dir: tmp })).isError).toBe(true);
  });

  it("G3 non-record proof bodies other than null (array, string, number id, string pid) are refused without throwing", () => {
    mkdirSync(dir(), { recursive: true });
    for (const body of ["[]", '"x"', JSON.stringify({ session_id: 5, claude_pid: process.ppid, proc_start: parentStart }), JSON.stringify({ session_id: SELF, claude_pid: String(process.ppid), proc_start: parentStart })]) {
      writeFileSync(join(dir(), `${process.ppid}.json`), body);
      expect(proveSession(dir(), process.ppid, parentStart).id).toBeNull();
    }
  });

  it("G4 a reused pid (same pid, a start time one tick off) is refused on this platform's processStartTime", () => {
    expect(parentStart).not.toBeNull();
    prove(SELF, { proc_start: parentStart!.replace(/\d$/, (d) => String((Number(d) + 1) % 10)) });
    const r = proveSession(dir(), process.ppid, parentStart);
    expect(r.id).toBeNull();
    expect((r as { reason: string }).reason).toContain("a reused pid");
  });
});
