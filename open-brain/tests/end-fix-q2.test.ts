/** Q2 — after Q1 fixture, next-session.md edited → ob_end closes */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

describe("end-fix Q2", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-q2-"));
    initOldLayoutRepo(dir);
    const tr = writeTranscript(dir);
    proveSessionWithTranscript(dir, tr);
    commitAt(dir, DURING, "src/a.ts", "work");
    touchNextSession(dir, DURING);
    initScratchDb();
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("ob_end closes when next-session.md was updated in the session window", async () => {
    const res = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true, session_summary: "done" });
    expect(res.isError).not.toBe(true);
    expect(text(res)).toContain("Session End:");
  });
});
