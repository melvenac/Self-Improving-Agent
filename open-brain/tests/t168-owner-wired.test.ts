import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
// Namespace imports: a missing export fails its rows, not the file.
import * as owner from "../src/suite-owner.js";
import * as ps from "../src/shared/process-session.js";

const TSX = createRequire(import.meta.url).resolve("tsx/cli");
const CLI = join(import.meta.dirname, "../src/cli-suite-run.ts");
const FIXTURE_HOST = join(import.meta.dirname, "fixtures-t003/cursor-agent/versions/e2e-fixture/index.js");
const HOST_CMD = String.raw`C:\AppData\Local\cursor-agent\versions\2026.10.01-e373342\index.js`;
const CLAUDE_EXE = String.raw`C:\Users\me\.local\bin\claude.exe --print`;

type Row = { pid: number; ppid: number; commandLine: string };

function reader(rows: Row[]): (pid: number) => Row | null {
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  return (pid) => byPid.get(pid) ?? null;
}

function tableOf(rows: Row[]) {
  return () => ({ ok: true as const, table: new Map(rows.map((r) => [r.pid, r])) });
}

function presence(name: string) {
  return { agents: [{ name, seat: { seatState: "idle" } }] };
}

function fixtures(dir: string) {
  const census = join(dir, "presence.json");
  const vitestJson = join(dir, "vitest.json");
  writeFileSync(census, JSON.stringify({ samples: [presence("forge"), presence("forge")] }));
  writeFileSync(vitestJson, JSON.stringify({ numPassedTests: 1, numFailedTests: 0 }));
  return { census, vitestJson };
}

/** process.env without the owner seams, so a row cannot inherit them. */
function baseEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.startsWith("SUITE_") || k === "MACHINE_LEASE_PS1" || k === "OPEN_BRAIN_CONTROLLED_RERUN") delete env[k];
  }
  return env;
}

function heldByOther(statusOut: string) {
  const dir = mkdtempSync(join(tmpdir(), "t168-other-"));
  const { census, vitestJson } = fixtures(dir);
  const meta = join(dir, "meta.json");
  const r = spawnSync(process.execPath, [TSX, CLI, "--owner-pid", "100", "--meta", meta], {
    encoding: "utf8",
    cwd: dir,
    env: {
      ...baseEnv(),
      SUITE_CENSUS_FIXTURE: census,
      SUITE_VITEST_JSON: vitestJson,
      SUITE_VITEST_EXIT: "0",
      SUITE_LEASE_STATUS_EXIT: "10",
      SUITE_LEASE_STATUS_OUT: statusOut,
      SUITE_LEASE_EXIT: "10",
    },
  });
  const written = JSON.parse(readFileSync(meta, "utf8"));
  rmSync(dir, { recursive: true, force: true });
  return { r, written };
}

describe("T-168 owner wired to #427's walker", () => {
  it("N1 (QA 279 F-A): a lease held by another owner refuses", () => {
    const { r, written } = heldByOther("lease=held owner=forge session= pid=200 started=t expires=t");
    expect(r.status, r.stderr).toBe(2);
    expect(r.stderr).toContain("lease held (exit 10)");
    expect(written.owner_pid).toBe(100);
    expect(written.lease_status).toBe("held");
    expect(written.lease_take_exit).toBe(10);
    expect(written.lease_release_exit).toBeNull();
    expect(written.vitest.exit_code).toBeNull();
  }, 60_000);

  it("N2: a holder pid that only starts with the owner's pid is another owner", () => {
    const { r, written } = heldByOther("lease=held owner=forge session= pid=1000 started=t expires=t");
    expect(r.status, r.stderr).toBe(2);
    expect(r.stderr).toContain("lease held (exit 10)");
    expect(written.lease_status).toBe("held");
    expect(written.lease_take_exit).toBe(10);
    expect(written.lease_release_exit).toBeNull();
    expect(written.vitest.exit_code).toBeNull();
  }, 60_000);

  it("N3: with no flag and no SUITE_ANCESTRY the CLI walks the live process table to the cursor-agent host", () => {
    const dir = mkdtempSync(join(tmpdir(), "t168-wired-"));
    const { census } = fixtures(dir);
    const meta = join(dir, "meta.json");
    const r = spawnSync(process.execPath, [FIXTURE_HOST, "--", TSX, CLI, "--meta", meta], {
      encoding: "utf8",
      cwd: dir,
      input: "",
      env: {
        ...baseEnv(),
        SUITE_CENSUS_FIXTURE: census,
        SUITE_DRY_RUN: "1",
        SUITE_LEASE_EXIT: "0",
        SUITE_LEASE_STATUS_EXIT: "0",
        SUITE_LEASE_RELEASE_EXIT: "0",
      },
    });
    const host = Number(/CURSOR_AGENT_HOST_PID=(\d+)/.exec(r.stdout ?? "")?.[1]);
    const written = JSON.parse(readFileSync(meta, "utf8"));
    rmSync(dir, { recursive: true, force: true });
    expect(r.status, r.stderr).toBe(0);
    expect(Number.isInteger(host) && host > 0).toBe(true);
    expect(written.owner_pid).toBe(host);
    expect(written.owner_source).toBe("cursor-agent");
  }, 60_000);

  it("N4a: the nearest claude.exe is the owner when there is no cursor-agent host", () => {
    const rows: Row[] = [
      { pid: 10, ppid: 20, commandLine: "node.exe tsx cli-suite-run.ts" },
      { pid: 20, ppid: 30, commandLine: "C:\\Windows\\system32\\cmd.exe /d /s /c npm run test:heavy" },
      { pid: 30, ppid: 40, commandLine: CLAUDE_EXE },
      { pid: 40, ppid: 1, commandLine: "sh /usr/lib/node_modules/npm/claude" },
    ];
    expect(owner.resolveOwnerWalk(10, reader(rows))).toMatchObject({ pid: 30, source: "claude.exe" });
  });

  it("N4a': the same chain through resolveOwnerFromAncestry", () => {
    const rows: Row[] = [
      { pid: 10, ppid: 20, commandLine: "node.exe tsx cli-suite-run.ts" },
      { pid: 20, ppid: 30, commandLine: "C:\\Windows\\system32\\cmd.exe /d /s /c npm run test:heavy" },
      { pid: 30, ppid: 40, commandLine: CLAUDE_EXE },
      { pid: 40, ppid: 1, commandLine: "sh /usr/lib/node_modules/npm/claude" },
    ];
    expect(owner.resolveOwnerFromAncestry(10, rows)).toMatchObject({ pid: 30, source: "claude.exe" });
  });

  it("N4b: a cursor-agent host wins over a nearer claude.exe", () => {
    const rows: Row[] = [
      { pid: 10, ppid: 30, commandLine: "node.exe tsx cli-suite-run.ts" },
      { pid: 30, ppid: 50, commandLine: CLAUDE_EXE },
      { pid: 50, ppid: 1, commandLine: HOST_CMD },
    ];
    expect(owner.resolveOwnerWalk(10, reader(rows))).toMatchObject({ pid: 50, source: "cursor-agent" });
    expect(owner.liveOwnerProbe(10, tableOf(rows))).toMatchObject({ pid: 50, source: "cursor-agent" });
  });

  it("N5a: a chain with neither has no owner, and never the start pid", () => {
    const rows: Row[] = [
      { pid: 10, ppid: 20, commandLine: "node.exe tsx cli-suite-run.ts" },
      { pid: 20, ppid: 1, commandLine: "bash" },
    ];
    const walked = owner.resolveOwnerWalk(10, reader(rows));
    expect(walked).toEqual({ pid: null, source: "none", reason: owner.NO_OWNER_REASON });
    const live = owner.liveOwnerProbe(10, tableOf(rows));
    expect(live).toEqual({ pid: null, source: "none", reason: owner.NO_OWNER_REASON });
    expect(live.pid).not.toBe(10);
  });

  it("N5b: a process table that fails to load has no owner and names the table", () => {
    const failing = () => ps.loadWin32ProcessTable(() => {
      throw new Error("boom");
    });
    const live = owner.liveOwnerProbe(10, failing);
    expect(live.pid).toBeNull();
    expect(live.source).toBe("none");
    expect(live.reason).toMatch(/^Win32 process table:/);
  });
});
