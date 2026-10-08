/** Q4 — record_ok closes; reason appears in next greeting */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleEnd } from "../src/server.js";
import { takeRecordOkNotices } from "../src/shared/end-record-guard.js";
import {
  cleanupProof,
  commitAt,
  DURING,
  initOldLayoutRepo,
  initScratchDb,
  proveSessionWithTranscript,
  SESSION_UUID,
  text,
  writeTranscript,
} from "./end-fix.harness.js";

describe("end-fix Q4", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-q4-"));
    initOldLayoutRepo(dir);
    const tr = writeTranscript(dir);
    proveSessionWithTranscript(dir, tr);
    commitAt(dir, DURING, "src/a.ts", "work");
    initScratchDb();
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("record_ok closes and the reason is shown once in the greeting", async () => {
    const res = await handleEnd({
      project_root: dir,
      session_id: SESSION_UUID,
      dry_run: false,
      record_ok: "Aaron approved",
      session_summary: "s",
    });
    expect(res.isError).not.toBe(true);
    expect(text(res)).toContain("RECORD OK:");
    const notices = takeRecordOkNotices(dir);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain("Aaron approved");
    expect(takeRecordOkNotices(dir)).toEqual([]);
  });
});
