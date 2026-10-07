/** Q12 — Windows paths and CRLF next-session.md (same gates as Q1/Q3/Q6) */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, utimesSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleEnd } from "../src/server.js";
import { applyStateOps } from "../src/shared/state-writer.js";
import { writeObEndStamp, takeWorkAfterEndNotices } from "../src/shared/end-record-guard.js";
import { spawnSync } from "node:child_process";
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
  writeTranscript,
} from "./end-fix.harness.js";

const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const hookEntry = join(import.meta.dirname, "../src/cli-session-end.ts");

describe("end-fix Q12 windows-style paths and CRLF", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-q12-"));
    initScratchDb();
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("Q1 on master: RECORD NOT UPDATED with CRLF next-session and backslash project_root", async () => {
    initOldLayoutRepo(dir);
    const tr = writeTranscript(dir);
    proveSessionWithTranscript(dir, tr);
    const next = join(dir, ".agents", "SESSIONS", "next-session.md");
    writeFileSync(next, "# Handoff\r\nstale\r\n", "utf8");
    commitAt(dir, DURING, "src/a.ts", "one");
    commitAt(dir, DURING, "src/b.ts", "two");
    const root = process.platform === "win32" ? dir.replace(/\//g, "\\") : dir;
    const res = await handleEnd({ project_root: root, session_id: SESSION_UUID, dry_run: true });
    expect(res.isError).toBe(true);
    expect(text(res)).toMatch(/^RECORD NOT UPDATED:.*2 commit/);
  });

  it("Q3: new layout refuses then closes after set_handoff", async () => {
    initNewLayoutRepo(dir);
    proveSessionWithTranscript(dir, writeTranscript(dir));
    commitAt(dir, DURING, "src/a.ts", "work");
    expect((await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true })).isError).toBe(true);
    const rev = JSON.parse(readFileSync(join(dir, ".agents", "state.json"), "utf8")).revision as number;
    applyStateOps(dir, {
      session: 1,
      expected_revision: rev,
      session_uuid: SESSION_UUID,
      checkout: "sia-test",
      ops: [{ op: "set_handoff", seat: "developer", pick_up: "x", watch_out: [], open_questions: [] }],
    });
    expect((await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true })).isError).not.toBe(true);
  });

  it("Q6: work after ob_end marker with CRLF files", () => {
    initOldLayoutRepo(dir);
    const transcript = writeTranscript(dir);
    proveSessionWithTranscript(dir, transcript);
    writeObEndStamp(dir, { session: SESSION_UUID, ob_end_at: "2026-09-25T14:30:00Z" });
    commitAt(dir, "2026-09-25T15:00:00Z", "src/after.ts", "after");
    const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
      cwd: dir,
      input: JSON.stringify({ session_id: SESSION_UUID, transcript_path: transcript }),
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, KNOWLEDGE_V2_DB: join(dir, "no.db") },
    });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain("WORK AFTER /end NOT RECORDED");
    const notices = takeWorkAfterEndNotices(dir);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain("1 commit(s)");
  });
});
