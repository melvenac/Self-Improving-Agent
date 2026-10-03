import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { initSchemaV2, recordRecallEvent, getSessionRecalledIds } from "../../../src/db-v2.js";
import { resolveRecalledIds, formatRecalledResolution, detectForeignWriter, formatForeignWriter, resolveRecalledIdsObserved, readRecalledFile } from "../../../src/pipelines/session-end/recalled-ids.js";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * QA 265 G1 (#377): a fake read seam for `readRecalledFile` itself. A real directory only produces EISDIR, and a real EACCES, EBUSY or
 * ENOTDIR cannot be made portably (Windows reports ENOENT for a path through a file, and a chmod does not stop the owner), so the
 * rows below make `readFileSync` throw the named code while `fsFault.code` is set, and read the real file system otherwise.
 */
const fsFault = vi.hoisted(() => ({ code: null as string | null }));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: ((...args: Parameters<typeof actual.readFileSync>) => {
      if (fsFault.code !== null) throw Object.assign(new Error(`${fsFault.code}: simulated`), { code: fsFault.code });
      return actual.readFileSync(...args);
    }) as typeof actual.readFileSync,
  };
});

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

  it("returns nothing when no file exists and nothing was recalled — and says why (R3)", () => {
    const result = resolve(db, THIS_SESSION, {});
    expect(result.ids).toEqual([]);
    expect(result.origin).toBe("none");
    // R3: this used to be a bare {ids, origin} that explained nothing.
    expect(result.reason).toContain("no recall_log rows for session");
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

describe("R3: a session that rates nothing says why", () => {
  let db: Database.Database;
  beforeEach(() => { db = makeDb(); });

  /** The formatter's lines, joined, without embedding an escape in this file. */
  const text = (lines: string[]) => lines.join(String.fromCharCode(10));

  it("names the missing session id when ob_set_session never ran and no file exists", () => {
    const r = resolve(db, null, {});
    expect(r.origin).toBe("none");
    expect(r.ids).toEqual([]);
    expect(r.reason).toMatch(/no session id/);

    const out = text(formatRecalledResolution(r));
    expect(out).toContain("Recalled ids: 0 from none");
    expect(out).toMatch(/Nothing rated: no session id/);
  });

  it("names the empty recall_log when the session IS known but nothing was recalled", () => {
    const r = resolve(db, THIS_SESSION, {});
    expect(r.origin).toBe("none");
    expect(r.reason).toContain(THIS_SESSION);
    expect(text(formatRecalledResolution(r))).toMatch(/Nothing rated: no recall_log rows for session/);
  });

  it("explains a refused foreign file, not just that it was ignored", () => {
    const r = resolve(db, THIS_SESSION, { "/p/.recalled-entries.json": fileFor(OTHER_SESSION, [1, 2, 3]) });
    expect(r.origin).toBe("none");
    const out = text(formatRecalledResolution(r));
    expect(out).toContain("Recalled ids: 0 from none");
    expect(out).toContain("Ignored /p/.recalled-entries.json");
    expect(out).toMatch(/Nothing rated: the only candidate file was refused/);
  });

  it("prints the count line even on the boring success path — absence must not look like success", () => {
    recordRecallEvent(db, THIS_SESSION, "q", [7], "start");
    const r = resolve(db, THIS_SESSION, {});
    expect(r.origin).toBe("recall-log");
    const lines = formatRecalledResolution(r);
    expect(lines[0]).toBe("  Recalled ids: 1 from recall-log");
    expect(text(lines)).not.toContain("Nothing rated");
  });

  it("honours the indent argument so the hook and the MCP tool share one formatter", () => {
    const r = resolve(db, null, {});
    expect(formatRecalledResolution(r, "")[0]).toBe("Recalled ids: 0 from none");
    expect(formatRecalledResolution(r, "  ")[0]).toBe("  Recalled ids: 0 from none");
  });
});

/**
 * T-050: v0.15.1 made a foreign `.recalled-entries.json` writer unreachable AND uncountable: on the normal path the
 * file is never read, so "no foreign writer" and "a foreign writer never looked at" printed the same nothing.
 * The detector reads the file only to REPORT. It never resolves ids, and the resolver's precedence is untouched.
 */
describe("detectForeignWriter — T-050", () => {
  const OURS = THIS_SESSION;
  const run = (sessionId: string | null, files: Record<string, string>) =>
    detectForeignWriter({ sessionId, filePaths: Object.keys(files), readFile: (p) => files[p] ?? null });

  it("FW-1: a file written by another session is reported, with the path and the session it names", () => {
    const r = run(OURS, { "/p/.recalled-entries.json": fileFor(OTHER_SESSION, [1, 2]) });
    expect(r.checked).toBe(true);
    expect(r.findings).toEqual([{ path: "/p/.recalled-entries.json", kind: "foreign", fileSessionId: OTHER_SESSION }]);
    expect(formatForeignWriter(r)).toEqual([
      `  Foreign writer: FOUND /p/.recalled-entries.json names session ${OTHER_SESSION}, not ${OURS} (reported, not refused; it played no part in which entries were rated)`,
    ]);
  });

  it("FW-2: our own file is not a finding, and says it was read", () => {
    const r = run(OURS, { "/p/.recalled-entries.json": fileFor(OURS, [1]) });
    expect(r.findings).toEqual([]);
    expect(formatForeignWriter(r)).toEqual(["  Foreign writer: none (1 file read, all name this session)"]);
  });

  it("FW-3: no file anywhere says 'none present', which is not 'not checked'", () => {
    const r = detectForeignWriter({ sessionId: OURS, filePaths: ["/a/.recalled-entries.json", "/b/.recalled-entries.json"], readFile: () => null });
    expect(formatForeignWriter(r)).toEqual(["  Foreign writer: none present (no .recalled-entries.json in 2 location(s))"]);
    const unchecked = detectForeignWriter({ sessionId: null, filePaths: ["/a/.recalled-entries.json"], readFile: () => null });
    expect(unchecked.checked).toBe(false);
    expect(formatForeignWriter(unchecked)).toEqual(["  Foreign writer: not checked (no session id, so no file can be called foreign)"]);
    expect(formatForeignWriter(r)).not.toEqual(formatForeignWriter(unchecked));
  });

  it("FW-4: an unparseable file and a file naming no session are reported by kind, not ignored", () => {
    const r = run(OURS, { "/a/.recalled-entries.json": "{not json", "/b/.recalled-entries.json": fileFor(null, [5]) });
    expect(r.findings.map((f) => [f.path, f.kind])).toEqual([
      ["/a/.recalled-entries.json", "unparseable"],
      ["/b/.recalled-entries.json", "unattributed"],
    ]);
  });

  it("FW-5: the detector's read cannot feed the resolver — ids, origin and rejection are identical with and without it", () => {
    const db = makeDb();
    recordRecallEvent(db, OURS, "q", [351, 365]);
    const files: Record<string, string> = { "/p/.recalled-entries.json": fileFor(OTHER_SESSION, [999, 998]) };
    const input = { db, sessionId: OURS, filePaths: Object.keys(files), readFile: (p: string) => files[p] ?? null };
    const alone = resolveRecalledIds(input);
    const observed = resolveRecalledIdsObserved(input);
    expect(observed.resolved).toEqual(alone);
    expect(observed.resolved.ids).toEqual([351, 365]);
    expect(observed.resolved.origin).toBe("recall-log");
    expect(observed.foreign.findings).toHaveLength(1);
    // and with nothing in recall_log the foreign file is still refused by the resolver, not adopted
    const empty = resolveRecalledIdsObserved({ ...input, db: makeDb() });
    expect(empty.resolved.ids).toEqual([]);
    expect(empty.resolved.origin).toBe("none");
    expect(empty.foreign.findings).toHaveLength(1);
  });

  it("FW-6: the report carries no ids at all, so it cannot be mistaken for evidence of what was recalled", () => {
    const r = run(OURS, { "/p/.recalled-entries.json": fileFor(OTHER_SESSION, [1, 2]) });
    expect(JSON.stringify(r)).not.toMatch(/"ids"|"entries"/);
  });
});

/**
 * T-229 (QA 258, #299 row 8): the callers' readFile turned ANY error into "no file", so a path that could not be read
 * (a directory, EACCES, EBUSY) printed "none present". Only ENOENT means absent; anything else is unreadable and the
 * foreign-writer line says "not checked (<code>)". The resolver's own behaviour is unchanged: an unreadable file rates nothing.
 */
describe("T-229: an unreadable .recalled-entries.json is not an absent one", () => {
  const throwing = (code: string) => (): string | null => {
    throw Object.assign(new Error(`${code}: cannot read`), { code });
  };

  it.each(["EISDIR", "EACCES", "EBUSY"])("FW-7: %s is reported as not checked, with the path and the code, never 'none present'", (code) => {
    const r = detectForeignWriter({ sessionId: THIS_SESSION, filePaths: ["/p/.recalled-entries.json"], readFile: throwing(code) });
    expect(r.checked).toBe(true);
    expect(r.unreadable).toEqual([{ path: "/p/.recalled-entries.json", code }]);
    expect(formatForeignWriter(r)).toEqual([`  Foreign writer: not checked (/p/.recalled-entries.json: ${code})`]);
  });

  it("FW-8: an unreadable path beside a readable one reports both; neither hides the other", () => {
    const own = "/b/.recalled-entries.json";
    const r = detectForeignWriter({
      sessionId: THIS_SESSION,
      filePaths: ["/a/.recalled-entries.json", own],
      readFile: (p) => (p === own ? fileFor(THIS_SESSION, [1]) : throwing("EBUSY")()),
    });
    expect(formatForeignWriter(r)).toEqual([
      "  Foreign writer: not checked (/a/.recalled-entries.json: EBUSY)",
      "  Foreign writer: none (1 file read, all name this session)",
    ]);
  });

  it("FW-9: the resolver treats an unreadable file as nothing to rate and falls through to the next path, as before", () => {
    const next = "/n/.recalled-entries.json";
    const r = resolveRecalledIds({
      db: makeDb(),
      sessionId: THIS_SESSION,
      filePaths: ["/a/.recalled-entries.json", next],
      readFile: (p) => (p === next ? fileFor(THIS_SESSION, [42]) : throwing("EISDIR")()),
    });
    expect(r.ids).toEqual([42]);
    expect(r.origin).toBe("file");
    const none = resolveRecalledIds({ db: makeDb(), sessionId: THIS_SESSION, filePaths: ["/a/.recalled-entries.json"], readFile: throwing("EACCES") });
    expect(none.ids).toEqual([]);
    expect(none.origin).toBe("none");
  });

  it("readRecalledFile: ENOENT is absent (null); a directory throws EISDIR; a file is its text", () => {
    const dir = mkdtempSync(join(tmpdir(), "t229-"));
    try {
      expect(readRecalledFile(join(dir, "missing.json"))).toBeNull();
      mkdirSync(join(dir, "adir.json"));
      expect(() => readRecalledFile(join(dir, "adir.json"))).toThrow(expect.objectContaining({ code: "EISDIR" }));
      writeFileSync(join(dir, "real.json"), "{\"x\":1}");
      expect(readRecalledFile(join(dir, "real.json"))).toBe("{\"x\":1}");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("readRecalledFile: ONLY ENOENT is absent (QA 265 G1)", () => {
  afterEach(() => {
    fsFault.code = null;
  });

  it.each(["EACCES", "EPERM", "EBUSY", "ENOTDIR", "EMFILE"])("%s is rethrown with its code, never read as an absent file", (code) => {
    fsFault.code = code;
    expect(() => readRecalledFile("/p/.recalled-entries.json")).toThrow(expect.objectContaining({ code }));
  });

  it("ENOENT through the same seam is the one absent case: null", () => {
    fsFault.code = "ENOENT";
    expect(readRecalledFile("/p/.recalled-entries.json")).toBeNull();
  });

  it.each(["EACCES", "EPERM"])("%s end to end: the foreign-writer line is 'not checked (<path>: <code>)', never 'none present', and nothing is rated", (code) => {
    const path = "/p/.recalled-entries.json";
    fsFault.code = code;
    const report = detectForeignWriter({ sessionId: THIS_SESSION, filePaths: [path], readFile: readRecalledFile });
    expect(report.unreadable).toEqual([{ path, code }]);
    expect(formatForeignWriter(report)).toEqual([`  Foreign writer: not checked (${path}: ${code})`]);
    expect(formatForeignWriter(report).join("\n")).not.toContain("none present");
    const resolved = resolveRecalledIds({ db: makeDb(), sessionId: THIS_SESSION, filePaths: [path], readFile: readRecalledFile });
    expect(resolved.ids).toEqual([]);
    expect(resolved.origin).toBe("none");
  });
});
