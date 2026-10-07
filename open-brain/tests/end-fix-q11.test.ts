/**
 * Q11 — mutants (documented; each would turn a named assertion red):
 *  M1: E1 `scanSessionWork` scoped to `refs/heads/loop/` only → Q1/Q7 master-work tests fail.
 *  M2: E3 `handleEnd` returns isError:false with only a warning instead of refusing → Q1 fails (expects isError).
 *  M3: E5 `getSessionRecalledIds` includes dedup-only rows → Q9 fails.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleEnd } from "../src/server.js";
import Database from "better-sqlite3";
import { initSchemaV2, recordRecallEvent, getSessionRecalledIds, indexKnowledge } from "../src/db-v2.js";
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

describe("end-fix Q11 anti-mutant pins", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "endfix-q11-"));
    initOldLayoutRepo(dir);
    proveSessionWithTranscript(dir, writeTranscript(dir));
    commitAt(dir, DURING, "src/on-master.ts", "master");
  });
  afterEach(() => {
    cleanupProof();
    rmSync(dir, { recursive: true, force: true });
  });

  it("M1: E1 counts master commits (not loop/*-only)", () => {
    const work = scanSessionWork(dir, START, [ME]);
    expect(work.commits).toBe(1);
    expect(work.branches).toContain("master");
  });

  it("M2: E3 refuses ob_end when record missing (not warn-only)", async () => {
    const res = await handleEnd({ project_root: dir, session_id: SESSION_UUID, dry_run: true });
    expect(res.isError).toBe(true);
    expect(text(res)).toMatch(/^RECORD NOT UPDATED:/);
  });

  it("M3: E5 excludes dedup-only recalls from rateable set", () => {
    const db = new Database(":memory:");
    initSchemaV2(db);
    indexKnowledge(db, { vaultPath: "x.md", key: "x", content: "x", tags: "t", source: "manual" });
    recordRecallEvent(db, "s", "q", [1], "explicit", "dedup");
    expect(getSessionRecalledIds(db, "s")).toEqual([]);
    db.close();
  });
});
