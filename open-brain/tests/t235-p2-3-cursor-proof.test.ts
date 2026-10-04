import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  byPidDir,
  findCursorAgentHostPid,
  isCursorAgentHostCommandLine,
  loadWin32ProcessTable,
  parseWin32ProcessTable,
  processStartTime,
  proveSession,
  writeProcessSession,
  type ProcessParentInfo,
} from "../src/shared/process-session.js";
import { handleSetSession } from "../src/server.js";

const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
const HOST_ENTRY = resolve(import.meta.dirname, "fixtures-t003/cursor-agent/versions/e2e-fixture/index.js");
const BOOT = resolve(import.meta.dirname, "../src/cli-bootstrap.ts");

const SELF = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER = "11111111-2222-3333-4444-555555555555";
const HOST_CMD = String.raw`C:\AppData\Local\cursor-agent\versions\2026.10.01-e373342\node.exe C:\AppData\Local\cursor-agent\versions\2026.10.01-e373342\index.js`;

describe("T-235 P2-3 cursor session proof", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t235-p23-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("isCursorAgentHostCommandLine matches live cursor-agent index.js entry, not repo paths", () => {
    expect(isCursorAgentHostCommandLine(HOST_CMD)).toBe(true);
    expect(
      isCursorAgentHostCommandLine(
        String.raw`node.exe C:\Users\Aaron Melven\Worktrees\sia-builder\open-brain\build\cli-bootstrap.js`,
      ),
    ).toBe(false);
    expect(isCursorAgentHostCommandLine(String.raw`node.exe fixtures-t003\cursor-agent-host.cjs`)).toBe(false);
  });

  it("e2e: cursor-agent fixture host spawns bootstrap and writes by-pid/<hostPid>.json", () => {
    const home = mkdtempSync(join(tmpdir(), "t235-p23-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "t235-p23-cwd-"));
    const slot = join(home, "active-session.json");
    try {
      const r = spawnSync(
        process.execPath,
        [HOST_ENTRY, "--", TSX_CLI, BOOT, "--ide", "cursor"],
        {
          input: JSON.stringify({
            cwd,
            session_id: SELF,
            cursor_version: "2026.10.01-e373342",
            workspace_roots: [cwd],
          }),
          encoding: "utf-8",
          env: {
            ...process.env,
            HOME: home,
            USERPROFILE: home,
            OPEN_BRAIN_ACTIVE_SESSION: slot,
          },
        },
      );
      expect(r.status).toBe(0);
      const m = (r.stdout ?? "").match(/CURSOR_AGENT_HOST_PID=(\d+)/);
      expect(m).not.toBeNull();
      const hostPid = Number(m![1]);
      expect(r.stdout).toContain(`Session proof written: session ${SELF} for cursor-agent host process ${hostPid}.`);
      const proofPath = join(byPidDir(slot), `${hostPid}.json`);
      expect(existsSync(proofPath)).toBe(true);
      const proof = JSON.parse(readFileSync(proofPath, "utf-8"));
      expect(proof.claude_pid).toBe(hostPid);
      const hookOut = (r.stdout ?? "").split("\n").find((l) => l.includes("Session proof written"));
      expect(hookOut).toBeDefined();
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("ancestor cmdlines may mention cursor-agent paths but only versioned index.js is a host", () => {
    const hook = 10;
    const chain: Record<number, ProcessParentInfo> = {
      [hook]: {
        pid: hook,
        ppid: 1,
        commandLine: String.raw`node.exe C:\repos\cursor-agent\workspace\open-brain\build\cli-bootstrap.js`,
      },
    };
    expect(findCursorAgentHostPid(hook, (p) => chain[p] ?? null)).toBeNull();
  });

  it("mutant: proof keyed to hook pid (not host) is rejected on cursor walk", () => {
    const host = process.ppid;
    const hook = process.pid;
    const wrapper = hook + 1000;
    const hostStart = processStartTime(host);
    expect(hostStart).not.toBeNull();
    const chain: Record<number, ProcessParentInfo> = {
      [wrapper]: { pid: wrapper, ppid: hook, commandLine: "powershell wrapper" },
      [hook]: { pid: hook, ppid: host, commandLine: "node.exe cli-bootstrap.js" },
      [host]: { pid: host, ppid: 1, commandLine: HOST_CMD },
    };
    writeProcessSession(dir, {
      session_id: SELF,
      claude_pid: hook,
      proc_start: hostStart!,
      ide: "cursor",
      written_at: "",
    });
    expect(
      proveSession(dir, wrapper, processStartTime(hook), {
        cursorWalk: true,
        readParent: (p) => chain[p] ?? null,
      }),
    ).toMatchObject({ id: null });
    writeProcessSession(dir, {
      session_id: SELF,
      claude_pid: host,
      proc_start: hostStart!,
      ide: "cursor",
      written_at: "",
    });
    expect(
      proveSession(dir, wrapper, processStartTime(hook), {
        cursorWalk: true,
        readParent: (p) => chain[p] ?? null,
      }),
    ).toEqual({ id: SELF, pid: host });
  });

  it("cursorWalk finds proof on the cursor-agent host when the MCP parent is a wrapper", () => {
    const host = process.ppid;
    const wrapper = process.pid;
    const hostStart = processStartTime(host);
    expect(hostStart).not.toBeNull();
    const chain: Record<number, ProcessParentInfo> = {
      [wrapper]: { pid: wrapper, ppid: host, commandLine: "powershell.exe wrapper" },
      [host]: { pid: host, ppid: 1, commandLine: HOST_CMD },
    };
    writeProcessSession(dir, {
      session_id: SELF,
      claude_pid: host,
      proc_start: hostStart!,
      ide: "cursor",
      written_at: "",
    });
    const r = proveSession(dir, wrapper, processStartTime(wrapper), {
      cursorWalk: true,
      readParent: (p) => chain[p] ?? null,
    });
    expect(r).toEqual({ id: SELF, pid: host });
  });

  it("mutant: cursorWalk disabled refuses when proof is only on the host, not the direct parent", () => {
    const host = process.ppid;
    const wrapper = process.pid;
    const hostStart = processStartTime(host)!;
    writeProcessSession(dir, {
      session_id: SELF,
      claude_pid: host,
      proc_start: hostStart,
      ide: "cursor",
      written_at: "",
    });
    expect(proveSession(dir, wrapper, processStartTime(wrapper))).toMatchObject({ id: null, reason: expect.stringContaining("absent") });
    expect(
      proveSession(dir, wrapper, processStartTime(wrapper), {
        cursorWalk: true,
        readParent: (p) =>
          p === wrapper
            ? { pid: wrapper, ppid: host, commandLine: "pwsh" }
            : p === host
              ? { pid: host, ppid: 1, commandLine: HOST_CMD }
              : null,
      }),
    ).toEqual({ id: SELF, pid: host });
  });

  it("last SessionStart wins: ob_set_session refuses a claim for the overwritten session id", async () => {
    const parent = process.ppid;
    const start = processStartTime(parent);
    expect(start).not.toBeNull();
    const slot = join(dir, "active-session.json");
    const proofDir = byPidDir(slot);
    writeProcessSession(proofDir, { session_id: OTHER, claude_pid: parent, proc_start: start!, ide: "cursor", written_at: "" });
    const prevEnv = process.env.OPEN_BRAIN_IDE;
    const prevActive = process.env.OPEN_BRAIN_ACTIVE_SESSION;
    process.env.OPEN_BRAIN_IDE = "cursor";
    process.env.OPEN_BRAIN_ACTIVE_SESSION = slot;
    try {
      const stale = await handleSetSession({ session_id: SELF, project_dir: process.cwd() });
      expect(stale.isError).toBe(true);
      expect(String((stale.content[0] as { text: string }).text)).toContain(SELF);
      expect(String((stale.content[0] as { text: string }).text)).toContain(OTHER);
      writeProcessSession(proofDir, { session_id: SELF, claude_pid: parent, proc_start: start!, ide: "cursor", written_at: "" });
      const ok = await handleSetSession({ session_id: SELF, project_dir: process.cwd() });
      expect(ok.isError).toBeUndefined();
    } finally {
      if (prevEnv === undefined) delete process.env.OPEN_BRAIN_IDE;
      else process.env.OPEN_BRAIN_IDE = prevEnv;
      if (prevActive === undefined) delete process.env.OPEN_BRAIN_ACTIVE_SESSION;
      else process.env.OPEN_BRAIN_ACTIVE_SESSION = prevActive;
    }
  });

  it("findCursorAgentHostPid walks from hook ppid to versioned index.js host", () => {
    const host = 20;
    const hook = 10;
    const chain: Record<number, ProcessParentInfo> = {
      [hook]: { pid: hook, ppid: host, commandLine: "node.exe cli-bootstrap.js" },
      [host]: { pid: host, ppid: 1, commandLine: HOST_CMD },
    };
    expect(findCursorAgentHostPid(hook, (p) => chain[p] ?? null)).toBe(host);
    expect(findCursorAgentHostPid(hook, (p) => chain[p] ?? null)).not.toBe(hook);
  });

  it("r3 Win32 table loader returns a reason and does not throw", () => {
    const failures: Array<() => string> = [
      () => { throw new Error("spawn powershell.exe ENOENT"); },
      () => { throw new Error("spawn powershell.exe ETIMEDOUT"); },
      () => {
        const err = new Error("Command failed: powershell.exe");
        (err as { status?: number }).status = 1;
        throw err;
      },
      () => " ",
      () => "{",
    ];
    for (const run of failures) {
      const loaded = loadWin32ProcessTable(run);
      expect(loaded.ok).toBe(false);
      if (!loaded.ok) expect(loaded.reason).toMatch(/Win32 process table/);
    }
    const one = parseWin32ProcessTable(JSON.stringify({ ProcessId: 9, ParentProcessId: 1, CommandLine: "node.exe index.js" }));
    expect(one.ok).toBe(true);
    if (one.ok) expect(one.table.get(9)?.ppid).toBe(1);
  });

  it("r3 proveSession returns id null when the process table cannot be loaded", () => {
    const prev = process.env.OPEN_BRAIN_PROCESS_TABLE;
    process.env.OPEN_BRAIN_PROCESS_TABLE = "throw:spawn";
    try {
      const r = proveSession(dir, process.pid, "win:1", { cursorWalk: true });
      expect(r.id).toBeNull();
      if (r.id === null) expect(r.reason).toMatch(/Win32 process table/);
    } finally {
      if (prev === undefined) delete process.env.OPEN_BRAIN_PROCESS_TABLE;
      else process.env.OPEN_BRAIN_PROCESS_TABLE = prev;
    }
  });

  it("r3 the hook prints Session proof NOT written when powershell cannot spawn", () => {
    const home = mkdtempSync(join(tmpdir(), "t235-r3-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "t235-r3-cwd-"));
    const slot = join(home, "active-session.json");
    const r = spawnSync(process.execPath, [TSX_CLI, BOOT, "--ide", "cursor"], {
      input: JSON.stringify({ cwd, session_id: SELF, cursor_version: "1", workspace_roots: [cwd] }),
      encoding: "utf-8",
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        OPEN_BRAIN_ACTIVE_SESSION: slot,
        OPEN_BRAIN_PROCESS_TABLE: "throw:spawn",
      },
    });
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Session proof NOT written:");
    expect(r.stdout).toContain("Win32 process table");
    expect(r.stdout).not.toContain("Session proof written:");
  });
});
