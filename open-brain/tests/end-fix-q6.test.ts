/** Q6 — commits after ob_end → SessionEnd marker; greeting prints WORK AFTER once */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, utimesSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { handleEnd } from "../src/server.js";
import { readObEndStamp, takeWorkAfterEndNotices } from "../src/shared/end-record-guard.js";
import { applyStateOps } from "../src/shared/state-writer.js";
import {
  cleanupProof,
  commitAt,
  DURING,
  initNewLayoutRepo,
  initOldLayoutRepo,
  initScratchDb,
  proveSessionWithTranscript,
  SESSION_UUID,
  text,
  touchNextSession,
  writeTranscript,
} from "./end-fix.harness.js";

const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const hookEntry = join(import.meta.dirname, "../src/cli-session-end.ts");

describe("end-fix Q6", () => {
  let dir: string;
  let transcript: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-q6-"));
    initOldLayoutRepo(dir);
    transcript = writeTranscript(dir);
    proveSessionWithTranscript(dir, transcript);
    initScratchDb();
    commitAt(dir, DURING, "src/before.ts", "before end");
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("SessionEnd records WORK AFTER /end after real ob_end (B1 Q6); greeting shows it once", async () => {
    touchNextSession(dir, DURING);
    const res = await handleEnd({
      project_root: dir,
      session_id: SESSION_UUID,
      dry_run: false,
      session_summary: "closed",
    });
    expect(res.isError).not.toBe(true);
    expect(text(res)).toContain("Session End:");
    const stamp = readObEndStamp(resolve(dir));
    expect(stamp?.ob_end_at).toBeTruthy();
    commitAt(dir, new Date().toISOString(), "src/after.ts", "after end", undefined, { only: true });
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: dir,
      input: JSON.stringify({
        session_id: SESSION_UUID,
        transcript_path: transcript,
        hook_event_name: "SessionEnd",
      }),
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: resolve(dir) },
    });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain("WORK AFTER /end NOT RECORDED");
    const notices = takeWorkAfterEndNotices(resolve(dir));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain("1 commit(s)");
    expect(takeWorkAfterEndNotices(dir)).toEqual([]);
  });

  it("new layout: set_handoff then ob_end then commit still gets WORK AFTER marker (B1)", async () => {
    const nd = mkdtempSync(join(tmpdir(), "endfix-q6-new-"));
    initNewLayoutRepo(nd);
    initScratchDb();
    const tr = writeTranscript(nd);
    proveSessionWithTranscript(nd, tr);
    commitAt(nd, DURING, "src/a.ts", "work");
    const rev = JSON.parse(readFileSync(join(nd, ".agents", "state.json"), "utf8")).revision as number;
    applyStateOps(nd, {
      session: 99,
      expected_revision: rev,
      session_uuid: SESSION_UUID,
      checkout: "sia-test",
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "x", watch_out: [], open_questions: [] }],
    });
    const t = Date.parse(DURING) / 1000;
    utimesSync(join(nd, ".agents", "state.json"), t, t);
    const ndAbs = resolve(nd);
    await handleEnd({ project_root: ndAbs, session_id: SESSION_UUID, dry_run: false, session_summary: "s" });
    expect(readObEndStamp(ndAbs)?.ob_end_at).toBeTruthy();
    commitAt(nd, new Date().toISOString(), "src/after.ts", "after", undefined, { only: true });
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: nd,
      input: JSON.stringify({ session_id: SESSION_UUID, transcript_path: tr, hook_event_name: "SessionEnd" }),
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: ndAbs },
    });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain("WORK AFTER /end NOT RECORDED");
    rmSync(nd, { recursive: true, force: true });
  });

  it("old layout: git add -A after ob_end still gets WORK AFTER marker (R1 sweep)", async () => {
    touchNextSession(dir, DURING);
    await handleEnd({ project_root: resolve(dir), session_id: SESSION_UUID, dry_run: false, session_summary: "s" });
    commitAt(dir, new Date().toISOString(), "src/after.ts", "after sweep");
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: dir,
      input: JSON.stringify({ session_id: SESSION_UUID, transcript_path: transcript, hook_event_name: "SessionEnd" }),
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: resolve(dir) },
    });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain("WORK AFTER /end NOT RECORDED");
  });

  it("new layout: set_handoff, ob_end with dirty views, git add -A commit gets WORK AFTER (R1 sweep)", async () => {
    const nd = mkdtempSync(join(tmpdir(), "endfix-q6-sweep-"));
    initNewLayoutRepo(nd);
    initScratchDb();
    const tr = writeTranscript(nd);
    proveSessionWithTranscript(nd, tr);
    commitAt(nd, DURING, "src/a.ts", "work");
    const rev = JSON.parse(readFileSync(join(nd, ".agents", "state.json"), "utf8")).revision as number;
    applyStateOps(nd, {
      session: 99,
      expected_revision: rev,
      session_uuid: SESSION_UUID,
      checkout: "sia-test",
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "x", watch_out: [], open_questions: [] }],
    });
    const ndAbs = resolve(nd);
    await handleEnd({ project_root: ndAbs, session_id: SESSION_UUID, dry_run: false, session_summary: "s" });
    commitAt(nd, new Date().toISOString(), "src/after.ts", "sweep");
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: nd,
      input: JSON.stringify({ session_id: SESSION_UUID, transcript_path: tr, hook_event_name: "SessionEnd" }),
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: ndAbs },
    });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain("WORK AFTER /end NOT RECORDED");
    rmSync(nd, { recursive: true, force: true });
  });
});
