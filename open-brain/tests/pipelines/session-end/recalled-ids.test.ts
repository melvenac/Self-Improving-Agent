import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initSchemaV2, recordRecallEvent, getSessionRecalledIds } from "../../../src/db-v2.js";
import { resolveRecalledIds } from "../../../src/pipelines/session-end/recalled-ids.js";

const THIS_SESSION = "efcaeb75-f5d5-421f-a1e5-645f155c59e4";
const OTHER_SESSION = "2fb67133-f85a-4c1d-9e30-000000000000";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  initSchemaV2(db);
  return db;
}

/** A `.recalled-entries.json` payload as the startup subagent writes it. */
function fileFor(sessionId: string | null, ids: number[]): string {
  return JSON.stringify({
    session_id: sessionId,
    session_start: "2026-08-11T00:00:00.000Z",
    queries: ["q"],
    entries: ids.map((id) => ({ id, key: `entry-${id}`, source: "knowledge" })),
  });
}

function resolve(
  db: Database.Database,
  sessionId: string | null,
  files: Record<string, string>,
  explicitIds?: number[]
) {
  return resolveRecalledIds({
    db,
    sessionId,
    explicitIds,
    filePaths: Object.keys(files),
    readFile: (p) => files[p] ?? null,
  });
}

describe("resolveRecalledIds", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = makeDb();
  });

  it("reads this session's recalls from recall_log", () => {
    recordRecallEvent(db, THIS_SESSION, "some query", [351, 365, 316]);
    expect(getSessionRecalledIds(db, THIS_SESSION)).toEqual([351, 365, 316]);
  });

  it("scopes recall_log to the session asked for", () => {
    recordRecallEvent(db, OTHER_SESSION, "q", [11, 12]);
    recordRecallEvent(db, THIS_SESSION, "q", [21]);
    expect(getSessionRecalledIds(db, THIS_SESSION)).toEqual([21]);
    expect(getSessionRecalledIds(db, "")).toEqual([]);
  });

  it("deduplicates an entry recalled by more than one query", () => {
    recordRecallEvent(db, THIS_SESSION, "query one", [7, 8]);
    recordRecallEvent(db, THIS_SESSION, "query two", [8, 9]);
    expect(getSessionRecalledIds(db, THIS_SESSION)).toEqual([7, 8, 9]);
  });

  it("prefers recall_log over a file, without reading it", () => {
    recordRecallEvent(db, THIS_SESSION, "q", [1, 2]);
    let read = false;
    const result = resolveRecalledIds({
      db,
      sessionId: THIS_SESSION,
      filePaths: ["/proj/.recalled-entries.json"],
      readFile: () => { read = true; return fileFor(THIS_SESSION, [99]); },
    });
    expect(result.origin).toBe("recall-log");
    expect(result.ids).toEqual([1, 2]);
    // Structural, not merely a validity check: when the session is known the
    // file is never consulted, so a stale one cannot contribute.
    expect(read).toBe(false);
  });

  it("refuses a file belonging to a different session", () => {
    // The live failure on 2026-08-11: the file on disk still described session
    // 2fb67133 from two sessions earlier, and /end rated its entries.
    const path = "/proj/.recalled-entries.json";
    const result = resolve(db, THIS_SESSION, { [path]: fileFor(OTHER_SESSION, [138, 184]) });

    expect(result.ids).toEqual([]);
    expect(result.origin).toBe("none");
    expect(result.rejected?.fileSessionId).toBe(OTHER_SESSION);
    expect(result.rejected?.reason).toContain(OTHER_SESSION);
  });

  it("accepts a file that names this session when recall_log is empty", () => {
    // Covers recalls made before ob_set_session, which never reach recall_log.
    const path = "/proj/.recalled-entries.json";
    const result = resolve(db, THIS_SESSION, { [path]: fileFor(THIS_SESSION, [138, 184]) });

    expect(result.origin).toBe("file");
    expect(result.ids).toEqual([138, 184]);
  });

  it("refuses an id-bearing file when the session is unknown", () => {
    const path = "/proj/.recalled-entries.json";
    const result = resolve(db, null, { [path]: fileFor(OTHER_SESSION, [1, 2]) });

    expect(result.ids).toEqual([]);
    expect(result.rejected?.reason).toContain("session unknown");
  });

  it("accepts an unattributed file when the session is unknown", () => {
    const path = "/proj/.recalled-entries.json";
    const result = resolve(db, null, { [path]: fileFor(null, [5, 6]) });

    expect(result.origin).toBe("file");
    expect(result.ids).toEqual([5, 6]);
  });

  it("lets explicitly passed ids override everything", () => {
    recordRecallEvent(db, THIS_SESSION, "q", [1, 2]);
    const result = resolve(db, THIS_SESSION, {}, [77]);
    expect(result.origin).toBe("explicit");
    expect(result.ids).toEqual([77]);
  });

  it("rates nothing rather than throwing on an unparseable file", () => {
    const path = "/proj/.recalled-entries.json";
    const result = resolve(db, THIS_SESSION, { [path]: "{ not json" });
    expect(result.ids).toEqual([]);
    expect(result.rejected?.reason).toBe("unparseable");
  });

  it("returns nothing when no file exists and nothing was recalled", () => {
    const result = resolve(db, THIS_SESSION, {});
    expect(result).toEqual({ ids: [], origin: "none" });
  });

  it("skips a missing candidate path and falls through to the next", () => {
    const present = "/home/.claude/context-mode/.recalled-entries.json";
    const result = resolveRecalledIds({
      db,
      sessionId: THIS_SESSION,
      filePaths: ["/proj/.recalled-entries.json", present],
      readFile: (p) => (p === present ? fileFor(THIS_SESSION, [42]) : null),
    });
    expect(result.origin).toBe("file");
    expect(result.ids).toEqual([42]);
  });
});
