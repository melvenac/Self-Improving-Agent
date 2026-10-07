/** Q6 — commits after ob_end → SessionEnd marker; greeting prints WORK AFTER once */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { writeObEndStamp, takeWorkAfterEndNotices } from "../src/shared/end-record-guard.js";
import {
  AFTER_END,
  cleanupProof,
  commitAt,
  initOldLayoutRepo,
  proveSessionWithTranscript,
  SESSION_UUID,
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
    writeObEndStamp(dir, { session: SESSION_UUID, ob_end_at: AFTER_END });
    commitAt(dir, "2026-09-25T15:00:00Z", "src/after.ts", "after end");
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("SessionEnd records WORK AFTER /end; the greeting shows it once", () => {
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: dir,
      input: JSON.stringify({
        session_id: SESSION_UUID,
        transcript_path: transcript,
        hook_event_name: "SessionEnd",
      }),
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, KNOWLEDGE_V2_DB: join(dir, "no.db") },
    });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain("WORK AFTER /end NOT RECORDED");
    const notices = takeWorkAfterEndNotices(dir);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain("1 commit(s)");
    expect(takeWorkAfterEndNotices(dir)).toEqual([]);
  });
});
