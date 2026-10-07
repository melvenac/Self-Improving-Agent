/** Q9 — dedup-only recalls → 0 rateable; a real recall still rateable */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initSchemaV2, recordRecallEvent, getSessionRecalledIds, indexKnowledge } from "../src/db-v2.js";
import { resolveRecalledIds } from "../src/pipelines/session-end/recalled-ids.js";

const SID = "dedup-session-uuid";

describe("end-fix Q9", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(":memory:");
    initSchemaV2(db);
    indexKnowledge(db, { vaultPath: "a.md", key: "a", content: "a", tags: "t", source: "manual" });
    indexKnowledge(db, { vaultPath: "b.md", key: "b", content: "b", tags: "t", source: "manual" });
    recordRecallEvent(db, SID, "dedup q", [1], "explicit", "dedup");
    recordRecallEvent(db, SID, "real q", [2], "explicit");
  });
  afterEach(() => db.close());

  it("excludes dedup-only ids from getSessionRecalledIds and resolveRecalledIds", () => {
    expect(getSessionRecalledIds(db, SID)).toEqual([2]);
    const both = resolveRecalledIds({ db, sessionId: SID, filePaths: [], readFile: () => null });
    expect(both.ids).toEqual([2]);
    recordRecallEvent(db, SID, "dedup again", [2], "explicit", "dedup");
    expect(getSessionRecalledIds(db, SID)).toEqual([2]);
  });
});
