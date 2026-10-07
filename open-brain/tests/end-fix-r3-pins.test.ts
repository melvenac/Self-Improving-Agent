/** END-FIX r3 (QA 291): R2, R5, R7 pins */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { handleEnd } from "../src/server.js";
import {
  cleanupProof,
  commitAt,
  DURING,
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

describe("end-fix r3 pins (QA 291)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-r3-"));
    initScratchDb();
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("R5: RECORD NOT CHECKED on old layout also prints OLD LAYOUT", async () => {
    initOldLayoutRepo(dir);
    const badTr = join(dir, "no-start.jsonl");
    writeFileSync(badTr, '{"type":"bridge-session","bridgeSessionId":"cse_01MeMeMeMeMeMeMeMeMeMeMe"}\n');
    proveSessionWithTranscript(dir, badTr);
    const body = text(await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true }));
    expect(body).toContain("OLD LAYOUT:");
    expect(body).toContain("RECORD NOT CHECKED:");
  });

  it("R7: SessionEnd with no session id prints handoff NOT RUN, not HANDOFF MISSING", () => {
    initOldLayoutRepo(dir);
    const transcript = writeTranscript(dir);
    commitAt(dir, DURING, "src/a.ts", "work");
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: dir,
      input: JSON.stringify({ transcript_path: transcript, hook_event_name: "SessionEnd" }),
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: resolve(dir) },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("handoff check NOT RUN: the payload carried no session id");
    expect(r.stdout).not.toContain("HANDOFF MISSING");
  });

  it("R2: work-after NOT RUN when transcript has no bridge session id", async () => {
    initOldLayoutRepo(dir);
    const tr = join(dir, "only-ts.jsonl");
    writeFileSync(tr, `{"timestamp":"2026-09-25T12:00:00.000Z"}\n`);
    proveSessionWithTranscript(dir, tr);
    touchNextSession(dir, DURING);
    await handleEnd({ project_root: resolve(dir), session_id: SESSION_UUID, dry_run: false, session_summary: "s" });
    commitAt(dir, new Date().toISOString(), "src/after.ts", "after");
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: dir,
      input: JSON.stringify({ session_id: SESSION_UUID, transcript_path: tr, hook_event_name: "SessionEnd" }),
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: resolve(dir) },
    });
    expect(r.stdout).toMatch(/work-after-end check NOT RUN:.*transcript/);
    expect(r.stdout).not.toMatch(/work-after-end check: no commits after ob_end/);
  });

  it("R2: unreadable state.json — hook NOT RUN for handoff and work-after", async () => {
    initOldLayoutRepo(dir);
    mkdirSync(join(dir, ".agents"), { recursive: true });
    writeFileSync(join(dir, ".agents", "state.json"), "{ not json");
    const tr = writeTranscript(dir);
    proveSessionWithTranscript(dir, tr);
    await handleEnd({ project_root: resolve(dir), session_id: SESSION_UUID, dry_run: false, session_summary: "s" });
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: dir,
      input: JSON.stringify({ session_id: SESSION_UUID, transcript_path: tr, hook_event_name: "SessionEnd" }),
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: resolve(dir) },
    });
    expect(r.stdout).toMatch(/handoff check NOT RUN: state\.json unreadable:/);
    expect(r.stdout).toMatch(/work-after-end check NOT RUN: state\.json unreadable:/);
    expect(r.stdout).not.toContain("HANDOFF MISSING");
  });

});
