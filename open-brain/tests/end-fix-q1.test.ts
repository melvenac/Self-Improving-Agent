/** Q1 — old layout, master commits + tag, next-session untouched → RECORD NOT UPDATED */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { handleEnd } from "../src/server.js";
import {
  cleanupProof,
  commitAt,
  DURING,
  initOldLayoutRepo,
  proveSessionWithTranscript,
  SESSION_UUID,
  text,
  writeTranscript,
} from "./end-fix.harness.js";

describe("end-fix Q1", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-q1-"));
    initOldLayoutRepo(dir);
    const tr = writeTranscript(dir);
    proveSessionWithTranscript(dir, tr);
    commitAt(dir, DURING, "src/a.ts", "one");
    commitAt(dir, DURING, "src/b.ts", "two");
    execFileSync("git", ["tag", "v0.1.1"], { cwd: dir, stdio: "ignore" });
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("ob_end refuses with RECORD NOT UPDATED naming 2 commits and the tag", async () => {
    const res = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true });
    const body = text(res);
    expect(res.isError).toBe(true);
    expect(body).toContain("OLD LAYOUT:");
    expect(body).toContain("RECORD NOT UPDATED:");
    expect(body).toContain("2 commit(s)");
    expect(body).toContain("v0.1.1");
  });
});
