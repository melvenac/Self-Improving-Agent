/** END-FIX r4 (QA 292): S1 session-scoped hash, S2 line endings + record updated, S3 no-proof OLD LAYOUT */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { handleEnd } from "../src/server.js";
import {
  computeRecordContentHash,
  hashNewLayoutSessionRecord,
  hashOldLayoutNextSessionText,
  readObEndStamp,
} from "../src/shared/end-record-guard.js";
import { applyStateOps } from "../src/shared/state-writer.js";
import { readState } from "../src/shared/state-writer.js";
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
const OTHER_UUID = "00000138-0000-4000-8000-00000000me02";

function runSessionEnd(dir: string, transcript: string): string {
  const r = spawnSync(process.execPath, [tsxCli, hookEntry], {
    cwd: dir,
    input: JSON.stringify({ session_id: SESSION_UUID, transcript_path: transcript, hook_event_name: "SessionEnd" }),
    encoding: "utf8",
    timeout: 90_000,
    env: { ...process.env, CLAUDE_PROJECT_DIR: resolve(dir) },
  });
  expect(r.status).toBe(0);
  return r.stdout + r.stderr;
}

function revision(dir: string): number {
  return JSON.parse(readFileSync(join(dir, ".agents", "state.json"), "utf8")).revision as number;
}

function setHandoff(dir: string, pick_up: string): void {
  applyStateOps(dir, {
    session: 99,
    expected_revision: revision(dir),
    session_uuid: SESSION_UUID,
    checkout: "sia-test",
    today: "2026-09-25",
    ops: [{ op: "set_handoff", seat: "developer", pick_up, watch_out: [], open_questions: [] }],
  });
}

describe("end-fix r4 pins (QA 292)", () => {
  let dir: string;
  let transcript: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-r4-"));
    initScratchDb();
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  describe("S1: new-layout hash ignores revision and other sessions", () => {
    beforeEach(() => {
      initNewLayoutRepo(dir);
      transcript = writeTranscript(dir);
      proveSessionWithTranscript(dir, transcript);
      commitAt(dir, DURING, "src/a.ts", "work");
      setHandoff(dir, "at end");
    });

    async function obEndThenCommitAndHook(afterEnd: () => void): Promise<string> {
      const abs = resolve(dir);
      await handleEnd({ project_root: abs, session_id: SESSION_UUID, dry_run: false, session_summary: "s" });
      const stampAt = readObEndStamp(abs)?.ob_end_at;
      expect(stampAt).toBeTruthy();
      afterEnd();
      const when = new Date(Date.parse(stampAt!) + 2000).toISOString();
      commitAt(dir, when, "src/after.ts", "after ob_end", undefined, { only: true });
      const out = runSessionEnd(dir, transcript);
      expect(out).not.toContain("no commits after ob_end");
      return out;
    }

    it("S1a: identical set_handoff re-save after ob_end keeps WORK AFTER (not record updated)", async () => {
      const out = await obEndThenCommitAndHook(() => setHandoff(dir, "at end"));
      expect(out).toContain("WORK AFTER /end NOT RECORDED");
      expect(out).not.toContain("and record updated");
    });

    it("S1b: add_decision after ob_end keeps WORK AFTER (not record updated)", async () => {
      const out = await obEndThenCommitAndHook(() => {
        applyStateOps(dir, {
          session: 99,
          expected_revision: revision(dir),
          session_uuid: SESSION_UUID,
          checkout: "sia-test",
          today: "2026-09-25",
          ops: [{ op: "add_decision", title: "unrelated", date: "2026-09-25", note: "" }],
        });
      });
      expect(out).toContain("WORK AFTER /end NOT RECORDED");
      expect(out).not.toContain("and record updated");
    });

    it("S1c: another session's state write after ob_end keeps WORK AFTER (not record updated)", async () => {
      const out = await obEndThenCommitAndHook(() => {
        applyStateOps(dir, {
          session: 100,
          expected_revision: revision(dir),
          session_uuid: OTHER_UUID,
          checkout: "other-seat",
          today: "2026-09-25",
          ops: [{ op: "set_handoff", seat: "developer", pick_up: "other session", watch_out: [], open_questions: [] }],
        });
      });
      expect(out).toContain("WORK AFTER /end NOT RECORDED");
      expect(out).not.toContain("and record updated");
    });

    it("S1d: real pick_up change after ob_end counts as record updated", async () => {
      const out = await obEndThenCommitAndHook(() => setHandoff(dir, "changed after end"));
      expect(out).toContain("work-after-end check: 1 commit(s) after ob_end and record updated");
      expect(out).not.toContain("WORK AFTER /end NOT RECORDED");
    });

    it("S2: stamp and check share hashNewLayoutSessionRecord", () => {
      const stateRead = readState(dir);
      if (!stateRead.ok) throw new Error(stateRead.error);
      const atStamp = computeRecordContentHash(dir, SESSION_UUID);
      if (!atStamp.ok) throw new Error(atStamp.error);
      expect(hashNewLayoutSessionRecord(stateRead.data, SESSION_UUID)).toBe(atStamp.hash);
    });
  });

  describe("S2: old layout line endings and record-updated line", () => {
    beforeEach(() => {
      initOldLayoutRepo(dir);
      transcript = writeTranscript(dir);
      proveSessionWithTranscript(dir, transcript);
      commitAt(dir, DURING, "src/a.ts", "work");
    });

    async function obEndCommitHook(afterEnd: () => void): Promise<string> {
      const abs = resolve(dir);
      await handleEnd({ project_root: abs, session_id: SESSION_UUID, dry_run: false, session_summary: "s" });
      const stampAt = readObEndStamp(abs)?.ob_end_at;
      expect(stampAt).toBeTruthy();
      afterEnd();
      const when = new Date(Date.parse(stampAt!) + 2000).toISOString();
      commitAt(dir, when, "src/after.ts", "after");
      const out = runSessionEnd(dir, transcript);
      expect(out).not.toContain("no commits after ob_end");
      return out;
    }

    it("S2: CRLF at ob_end, CRLF after — unchanged, WORK AFTER on commit only", async () => {
      const nextPath = join(dir, ".agents", "SESSIONS", "next-session.md");
      const body = "# Handoff\r\nsame text\r\n";
      writeFileSync(nextPath, body);
      const out = await obEndCommitHook(() => writeFileSync(nextPath, body));
      expect(out).toContain("WORK AFTER /end NOT RECORDED");
      expect(hashOldLayoutNextSessionText(body)).toBe(hashOldLayoutNextSessionText("# Handoff\nsame text\n"));
    });

    it("S2: CRLF at ob_end, LF-only after — unchanged, WORK AFTER not record updated", async () => {
      const nextPath = join(dir, ".agents", "SESSIONS", "next-session.md");
      const crlf = "# Handoff\r\nsame text\r\n";
      writeFileSync(nextPath, crlf);
      const out = await obEndCommitHook(() => writeFileSync(nextPath, "# Handoff\nsame text\n"));
      expect(out).toContain("WORK AFTER /end NOT RECORDED");
      expect(out).not.toContain("and record updated");
    });

    it("S2: real next-session change after ob_end prints record updated", async () => {
      touchNextSession(dir, DURING);
      const out = await obEndCommitHook(() => touchNextSession(dir, new Date().toISOString()));
      expect(out).toContain("work-after-end check: 1 commit(s) after ob_end and record updated");
    });
  });

  it("S3: no-proof RECORD NOT CHECKED on old layout also prints OLD LAYOUT", async () => {
    initOldLayoutRepo(dir);
    const body = text(await handleEnd({ project_root: dir, dry_run: true }));
    expect(body).toContain("OLD LAYOUT:");
    expect(body).toContain("RECORD NOT CHECKED:");
  });
});
