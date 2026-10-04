import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  byPidDir,
  findCursorAgentHostPid,
  processStartTime,
  proveSession,
  writeProcessSession,
  type ProcessParentInfo,
} from "../src/shared/process-session.js";
import { handleSetSession } from "../src/server.js";

const SELF = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER = "11111111-2222-3333-4444-555555555555";

describe("T-235 P2-3 cursor session proof", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t235-p23-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("cursorWalk finds proof on the cursor-agent host when the MCP parent is a wrapper", () => {
    const host = process.ppid;
    const wrapper = process.pid;
    const hostStart = processStartTime(host);
    expect(hostStart).not.toBeNull();
    const chain: Record<number, ProcessParentInfo> = {
      [wrapper]: { pid: wrapper, ppid: host, commandLine: "powershell.exe wrapper" },
      [host]: { pid: host, ppid: 1, commandLine: "node.exe C:\\cursor-agent\\node.exe run" },
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
              ? { pid: host, ppid: 1, commandLine: "cursor-agent host" }
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

  it("findCursorAgentHostPid walks ancestors until command line matches cursor-agent", () => {
    const host = 20;
    const hook = 10;
    const chain: Record<number, ProcessParentInfo> = {
      [hook]: { pid: hook, ppid: host, commandLine: "node.exe cli-bootstrap.js" },
      [host]: { pid: host, ppid: 1, commandLine: "node.exe fixtures-t003/cursor-agent-host.cjs" },
    };
    expect(findCursorAgentHostPid(hook, (p) => chain[p] ?? null)).toBe(host);
  });
});
