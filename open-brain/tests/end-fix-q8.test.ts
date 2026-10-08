/** Q8 — untrailered commits counted apart (T-212) */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleEnd } from "../src/server.js";
import { scanSessionWork } from "../src/shared/end-record-guard.js";
import {
  cleanupProof,
  commitAt,
  DURING,
  initOldLayoutRepo,
  ME,
  proveSessionWithTranscript,
  SESSION_UUID,
  START,
  text,
  writeTranscript,
} from "./end-fix.harness.js";

describe("end-fix Q8", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-q8-"));
    initOldLayoutRepo(dir);
    proveSessionWithTranscript(dir, writeTranscript(dir));
    commitAt(dir, DURING, "src/mine.ts", "mine");
    commitAt(dir, DURING, "src/no-trailer.ts", "other", null);
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports UNATTRIBUTED commits separately and refuses without counting them as work", async () => {
    const work = scanSessionWork(dir, START, [ME]);
    expect(work.commits).toBe(1);
    expect(work.unattributed).toBe(1);
    const res = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true });
    expect(text(res)).toMatch(/UNATTRIBUTED/);
  });
});
