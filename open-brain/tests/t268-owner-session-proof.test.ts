import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
// Namespace imports: a missing export fails its rows, not the file.
import * as owner from "../src/suite-owner.js";
import * as ps from "../src/shared/process-session.js";

const CLAUDE_EXE = String.raw`C:\Users\me\.local\bin\claude.exe --print`;
const U = "f21ca920-0000-4000-8000-000000000268";
const P = process.pid;
const Q = process.ppid;

type Row = { pid: number; ppid: number; commandLine: string };

function tableOf(rows: Row[]) {
  return () => ({ ok: true as const, table: new Map(rows.map((r) => [r.pid, r])) });
}

/** The Git Bash chain: bash's parent (the MSYS launcher) has already exited. */
const BROKEN: Row[] = [
  { pid: 10, ppid: 20, commandLine: "node.exe tsx cli-suite-run.ts" },
  { pid: 20, ppid: 29956, commandLine: String.raw`C:\Program Files\Git\usr\bin\bash.exe` },
];

let start: string;
let qStart: string;
let dirs: string[] = [];

function proofDir(proofs: Array<{ pid: number; session_id: string; proc_start: string; ide?: string }>): string {
  const dir = mkdtempSync(join(tmpdir(), "t268-proofs-"));
  dirs.push(dir);
  for (const p of proofs) {
    writeFileSync(join(dir, `${p.pid}.json`), JSON.stringify({
      session_id: p.session_id,
      claude_pid: p.pid,
      proc_start: p.proc_start,
      ide: p.ide ?? "claude",
      written_at: "2026-10-13T00:00:00.000Z",
    }));
  }
  return dir;
}

beforeAll(() => {
  const s = ps.processStartTime(P);
  if (s === null) throw new Error("processStartTime(process.pid) is null");
  start = s;
  const q = ps.processStartTime(Q);
  if (q === null) throw new Error("processStartTime(process.ppid) is null");
  qStart = q;
});

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("T-268 owner from the session proof named by CLAUDE_CODE_SESSION_ID", () => {
  it("S1: a broken chain falls back to the one live claude.exe proof for the session", () => {
    const dir = proofDir([{ pid: P, session_id: U, proc_start: start }]);
    const rows = [...BROKEN, { pid: P, ppid: 1, commandLine: CLAUDE_EXE }];
    const live = owner.liveOwnerProbe(10, tableOf(rows), { CLAUDE_CODE_SESSION_ID: U }, dir);
    expect(live).toEqual({ pid: P, source: "claude-session", reason: null });
  });

  it("S2: no CLAUDE_CODE_SESSION_ID has no owner and says so", () => {
    const dir = proofDir([{ pid: P, session_id: U, proc_start: start }]);
    const rows = [...BROKEN, { pid: P, ppid: 1, commandLine: CLAUDE_EXE }];
    const live = owner.liveOwnerProbe(10, tableOf(rows), {}, dir);
    expect(live.pid).toBeNull();
    expect(live.source).toBe("none");
    expect(live.reason?.startsWith(owner.NO_OWNER_REASON)).toBe(true);
    expect(live.reason).toMatch(/; no CLAUDE_CODE_SESSION_ID$/);
  });

  it("S3: a proof whose proc_start differs names a pid that is not running (or was reused)", () => {
    const dir = proofDir([{ pid: P, session_id: U, proc_start: "win:1" }]);
    const rows = [...BROKEN, { pid: P, ppid: 1, commandLine: CLAUDE_EXE }];
    const live = owner.liveOwnerProbe(10, tableOf(rows), { CLAUDE_CODE_SESSION_ID: U }, dir);
    expect(live.pid).toBeNull();
    expect(live.source).toBe("none");
    expect(live.reason).toContain(`the proof for ${U.slice(0, 8)} names pid ${P}, which is not running (or was reused)`);
  });

  it("S4: a proof whose pid is not claude.exe has no owner", () => {
    const dir = proofDir([{ pid: P, session_id: U, proc_start: start }]);
    const rows = [...BROKEN, { pid: P, ppid: 1, commandLine: "node.exe vitest" }];
    const live = owner.liveOwnerProbe(10, tableOf(rows), { CLAUDE_CODE_SESSION_ID: U }, dir);
    expect(live.pid).toBeNull();
    expect(live.source).toBe("none");
    expect(live.reason).toContain(`the proof for ${U.slice(0, 8)} names pid ${P}, which is not claude.exe`);
  });

  it("S5: two live claude.exe proofs naming the session have no owner", () => {
    const dir = proofDir([
      { pid: P, session_id: U, proc_start: start },
      { pid: Q, session_id: U, proc_start: qStart },
    ]);
    const rows = [...BROKEN, { pid: P, ppid: 1, commandLine: CLAUDE_EXE }, { pid: Q, ppid: 1, commandLine: CLAUDE_EXE }];
    const live = owner.liveOwnerProbe(10, tableOf(rows), { CLAUDE_CODE_SESSION_ID: U }, dir);
    expect(live.pid).toBeNull();
    expect(live.source).toBe("none");
    expect(live.reason).toContain(`2 live proofs name session ${U.slice(0, 8)}`);
  });

  it("S6: a chain that reaches claude.exe wins over a matching proof", () => {
    const dir = proofDir([{ pid: P, session_id: U, proc_start: start }]);
    const rows: Row[] = [
      { pid: 10, ppid: 20, commandLine: "node.exe tsx cli-suite-run.ts" },
      { pid: 20, ppid: 30, commandLine: "cmd.exe /c npx" },
      { pid: 30, ppid: 1, commandLine: CLAUDE_EXE },
      { pid: P, ppid: 1, commandLine: CLAUDE_EXE },
    ];
    const live = owner.liveOwnerProbe(10, tableOf(rows), { CLAUDE_CODE_SESSION_ID: U }, dir);
    expect(live).toEqual({ pid: 30, source: "claude.exe", reason: null });
  });

  it("S7: CLAUDE_PID is never read", () => {
    const dir = proofDir([{ pid: P, session_id: U, proc_start: start }]);
    const rows = [...BROKEN, { pid: P, ppid: 1, commandLine: CLAUDE_EXE }];
    const live = owner.liveOwnerProbe(10, tableOf(rows), { CLAUDE_PID: String(P) }, dir);
    expect(live.pid).toBeNull();
    expect(live.source).toBe("none");
  });

  it("S8: a dead proof beside the live one leaves the live one as the owner", () => {
    const dir = proofDir([
      { pid: P, session_id: U, proc_start: start },
      { pid: 4_000_000, session_id: U, proc_start: "win:2" },
    ]);
    const rows = [...BROKEN, { pid: P, ppid: 1, commandLine: CLAUDE_EXE }];
    const live = owner.liveOwnerProbe(10, tableOf(rows), { CLAUDE_CODE_SESSION_ID: U }, dir);
    expect(live).toEqual({ pid: P, source: "claude-session", reason: null });
  });

  it("S9: two dead proofs have no owner", () => {
    const dir = proofDir([
      { pid: 4_000_000, session_id: U, proc_start: "win:2" },
      { pid: 4_000_001, session_id: U, proc_start: "win:3" },
    ]);
    const live = owner.liveOwnerProbe(10, tableOf(BROKEN), { CLAUDE_CODE_SESSION_ID: U }, dir);
    expect(live.pid).toBeNull();
    expect(live.source).toBe("none");
    expect(live.reason?.endsWith(`2 proofs name session ${U.slice(0, 8)}, and none names a running claude.exe`)).toBe(true);
  });

  it("S10: a live proof that is not claude.exe beside a live claude.exe leaves the claude.exe as the owner", () => {
    const dir = proofDir([
      { pid: P, session_id: U, proc_start: start },
      { pid: Q, session_id: U, proc_start: qStart },
    ]);
    const rows = [...BROKEN, { pid: P, ppid: 1, commandLine: CLAUDE_EXE }, { pid: Q, ppid: 1, commandLine: "node.exe vitest" }];
    const live = owner.liveOwnerProbe(10, tableOf(rows), { CLAUDE_CODE_SESSION_ID: U }, dir);
    expect(live).toEqual({ pid: P, source: "claude-session", reason: null });
  });
});
