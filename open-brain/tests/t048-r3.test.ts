/**
 * T-048 round 3 (record 180). server.ts: SILENT 4, SILENT 9, and the two
 * score renderers that still omit the invocation-log state r2b prints.
 *
 * These rows fail on origin/master e201baa (merged here before the fix).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { openV2Database, indexKnowledge } from "../src/db-v2.js";
import { byPidDir, processStartTime, writeProcessSession } from "../src/shared/process-session.js";
import { handleEnd, handleScore, handleSync } from "../src/server.js";
import * as serverMod from "../src/server.js";

const { logState } = vi.hoisted(() => ({ logState: { value: "corrupt" as string | null } }));

vi.mock("../src/pipelines/session-end/invocation-logger.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/pipelines/session-end/invocation-logger.js")>();
  return { ...actual, readLastInvocationTs: () => logState.value };
});

const SESSION = "00000180-0000-4000-8000-000000000003";
const dirs: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "t048-r3-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.0.0" }));
  dirs.push(dir);
  return dir;
}

function text(res: { content: { text: string }[] }): string {
  return res.content.map((c) => c.text).join("\n");
}

function prove(id: string): void {
  const start = processStartTime(process.ppid);
  if (!start) throw new Error("parent start time unreadable; cannot prove a session");
  writeProcessSession(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), {
    session_id: id,
    claude_pid: process.ppid,
    proc_start: start,
    ide: "claude",
    written_at: new Date().toISOString(),
  });
}

function unprove(): void {
  rmSync(join(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), `${process.ppid}.json`), { force: true });
}

afterEach(() => {
  unprove();
  logState.value = "corrupt";
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

describe("T-048 round 3", () => {
  it("T048-D1: ob_sync --score and ob_score name the invocation-log state, and say nothing extra when it ran", async () => {
    const tmp = scratch();
    logState.value = "corrupt";
    const sync = text(await handleSync({ project_root: tmp, check_only: true, score: true }));
    const score = text(await handleScore({ project_root: tmp }));
    expect(sync).toMatch(/Pipeline Health: \d+\/10 \(\d+%\) \(invocation log: corrupt\)/);
    expect(score).toMatch(/Pipeline Health: \d+\/10 \(\d+%\) \(invocation log: corrupt\)/);

    logState.value = new Date().toISOString();
    const syncRan = text(await handleSync({ project_root: tmp, check_only: true, score: true }));
    const scoreRan = text(await handleScore({ project_root: tmp }));
    expect(syncRan).toMatch(/Pipeline Health: \d+\/10 \(\d+%\)/);
    expect(scoreRan).toMatch(/Pipeline Health: \d+\/10 \(\d+%\)/);
    expect(syncRan).not.toMatch(/invocation log:/);
    expect(scoreRan).not.toMatch(/invocation log:/);
  });

  it("SILENT 9: no session id and no recall_log rows print different reasons, and a refused file is still named", async () => {
    const tmp = scratch();
    const noId = text(await handleEnd({ project_root: tmp, dry_run: true, session_summary: "s" }));
    expect(noId).toContain("Nothing rated: no session id");
    expect(noId).not.toContain("no recall_log rows");

    writeFileSync(join(tmp, ".recalled-entries.json"), "{");
    const rejected = text(await handleEnd({ project_root: tmp, dry_run: true, session_summary: "s" }));
    expect(rejected).toContain("Ignored");
    expect(rejected).toContain("unparseable");

    rmSync(join(tmp, ".recalled-entries.json"));
    prove(SESSION);
    const noRows = text(await handleEnd({ project_root: tmp, dry_run: true, session_summary: "s" }));
    expect(noRows).toContain(`Nothing rated: no recall_log rows for session ${SESSION}`);
    expect(noRows).not.toContain("no session id (ob_set_session");
  });

  it("SILENT 4: a failed recall-log write with a live session names the error and still returns the hit", async () => {
    const recall = (serverMod as { handleRecall?: (args: { queries: string[] }) => Promise<{ content: { text: string }[] }> }).handleRecall;
    if (typeof recall !== "function") {
      const src = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
      const at = src.indexOf("recordRecallEvent(v2db");
      expect(src.slice(at, at + 500), "a failed write with a live session is an empty catch").not.toContain("/* non-critical */");
      return;
    }

    const db = openV2Database(process.env.KNOWLEDGE_V2_DB!);
    indexKnowledge(db, {
      vaultPath: "t048-r3/hit.md",
      key: "t048-r3-hit",
      tags: "test",
      content: "xylophonequartz recall token",
    });
    db.exec(`CREATE TRIGGER IF NOT EXISTS t048_r3_refuse_recall BEFORE INSERT ON recall_log BEGIN SELECT RAISE(ABORT, 'recall-log-refused'); END;`);
    db.close();

    try {
      prove(SESSION);
      const out = text(await recall({ queries: ["xylophonequartz"] }));
      expect(out).toContain("t048-r3-hit");
      expect(out).toContain("NOT LOGGED");
      expect(out).toContain("recall-log-refused");
      expect(out).not.toContain("cannot prove its session");
    } finally {
      const cleanup = openV2Database(process.env.KNOWLEDGE_V2_DB!);
      cleanup.exec(`DROP TRIGGER IF EXISTS t048_r3_refuse_recall`);
      cleanup.prepare(`DELETE FROM knowledge_index WHERE key = ?`).run("t048-r3-hit");
      cleanup.close();
    }
  });
});
