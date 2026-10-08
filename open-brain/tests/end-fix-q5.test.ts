/** Q5 — reading session: no work, closes; old layout still prints OLD LAYOUT line */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleEnd } from "../src/server.js";
import { OLD_LAYOUT_LINE } from "../src/shared/end-record-guard.js";
import {
  cleanupProof,
  initOldLayoutRepo,
  initScratchDb,
  proveSessionWithTranscript,
  SESSION_UUID,
  text,
  writeTranscript,
} from "./end-fix.harness.js";

describe("end-fix Q5", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-q5-"));
    initOldLayoutRepo(dir);
    proveSessionWithTranscript(dir, writeTranscript(dir));
    initScratchDb();
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("closes with no RECORD NOT UPDATED and prints OLD LAYOUT every time", async () => {
    const res = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true, session_summary: "" });
    expect(res.isError).not.toBe(true);
    const body = text(res);
    expect(body).not.toContain("RECORD NOT UPDATED:");
    expect(body).toContain(OLD_LAYOUT_LINE);
  });
});
