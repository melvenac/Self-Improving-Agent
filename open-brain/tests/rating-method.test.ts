import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initSchemaV2, indexKnowledge, recordSession, recordFeedbackEvent, migrateAddedColumns, SCHEMA_VERSION } from "../src/db-v2.js";
import { sessionEndV2 } from "../src/pipelines/session-end/index-v2.js";

/**
 * `rating_method` records WHICH ARM produced a rating; `rating_origin` records
 * where the rated ids came from. Conflating them is why the corpus cannot answer
 * the question the lifecycle work is blocked on.
 *
 * A row reading `origin='explicit', rating='neutral'` is equally consistent with
 * "the agent judged this neutral" and "the tag-substring fallback defaulted to
 * neutral on ids that came from an explicit recall" — and those two readings
 * demand opposite fixes. 33 of the 57 post-`rating_origin` rows are exactly that
 * shape, which is the whole reason for this column.
 */
function makeDb(): Database.Database {
  const db = new Database(":memory:");
  initSchemaV2(db);
  return db;
}

describe("rating_method", () => {
  let db: Database.Database;
  let vault: string;
  let agents: string;

  beforeEach(() => {
    db = makeDb();
    vault = mkdtempSync(join(tmpdir(), "ob-rm-vault-"));
    agents = mkdtempSync(join(tmpdir(), "ob-rm-agents-"));
  });

  afterEach(() => {
    for (const d of [vault, agents]) {
      try { rmSync(d, { recursive: true }); } catch { /* Windows race */ }
    }
  });

  function seed(name: string, tags: string): number {
    const path = join(vault, "Experiences", "General", `${name}.md`);
    indexKnowledge(db, {
      vaultPath: path, key: name, content: "c", tags, source: "agent", projectDir: undefined,
    });
    return (db.prepare(`SELECT id FROM knowledge_index WHERE key = ?`).get(name) as { id: number }).id;
  }

  const methods = () =>
    db.prepare(`SELECT knowledge_id, rating, rating_method FROM feedback_log ORDER BY knowledge_id`)
      .all() as Array<{ knowledge_id: number; rating: string; rating_method: string | null }>;

  it("is part of the schema and bumps the version by construction", () => {
    const cols = (db.pragma("table_info(feedback_log)") as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain("rating_method");
    // 1 base + 5 added columns (fact_kind, recall_trigger, rating_origin, rating_method, recall_purpose)
    expect(SCHEMA_VERSION).toBe(6);
  });

  it("labels a supplied judgment 'supplied'", () => {
    const id = seed("supplied-entry", "alpha");
    recordSession(db, "s1", null);

    sessionEndV2({
      db, vaultDir: vault, agentsDir: agents, sessionId: "s1",
      sessionSummary: "nothing matching here", project: "General",
      recalledEntryIds: [id], entryRatings: { [id]: "harmful" }, dryRun: false,
    });

    expect(methods()).toEqual([{ knowledge_id: id, rating: "harmful", rating_method: "supplied" }]);
  });

  // R-010: the tag-substring fallback is CUT. These two tests used to pin what
  // it LABELLED; they now pin that it cannot produce a row at all. A summary
  // that would once have matched is the point — the silence is the cut, not a
  // failed substring test.
  it("writes nothing for an entry the agent did not judge", () => {
    const id = seed("unjudged-entry", "alpha");
    recordSession(db, "s1", null);

    sessionEndV2({
      db, vaultDir: vault, agentsDir: agents, sessionId: "s1",
      sessionSummary: "this summary mentions alpha", project: "General",
      recalledEntryIds: [id], dryRun: false,
    });

    expect(methods()).toEqual([]);
  });

  it("the supplied/heuristic neutral ambiguity is gone by construction, not by labelling", () => {
    const supplied = seed("judged-neutral", "alpha");
    const unjudged = seed("defaulted-neutral", "beta");
    recordSession(db, "s1", null);

    sessionEndV2({
      db, vaultDir: vault, agentsDir: agents, sessionId: "s1",
      sessionSummary: "mentions alpha and beta", project: "General",
      recalledEntryIds: [supplied, unjudged],
      entryRatings: { [supplied]: "neutral" },
      dryRun: false,
    });

    // The column was added to tell two neutrals apart. Only one arm can write
    // now, so the ambiguity is removed at the source rather than annotated:
    // every neutral in the log is a rater's considered neutral.
    expect(methods()).toEqual([
      { knowledge_id: supplied, rating: "neutral", rating_method: "supplied" },
    ]);
  });

  it("defaults an unlabelled caller to 'unspecified', never to a judgment", () => {
    // Same rule as recall_trigger: a caller that did not say is a countable
    // labeling gap, not evidence that anyone judged anything.
    recordSession(db, "s1", null);
    recordFeedbackEvent(db, "s1", 1, "helpful");

    const row = db.prepare(`SELECT rating_method FROM feedback_log`).get() as { rating_method: string };
    expect(row.rating_method).toBe("unspecified");
  });

  it("coerces an unrecognized method rather than storing it", () => {
    recordSession(db, "s1", null);
    recordFeedbackEvent(db, "s1", 1, "helpful", "direct", "nonsense" as never);

    const row = db.prepare(`SELECT rating_method FROM feedback_log`).get() as { rating_method: string };
    expect(row.rating_method).toBe("unspecified");
  });

  it("leaves pre-column rows NULL — unknowable, not 'unspecified'", () => {
    recordSession(db, "s1", null);
    db.prepare(
      `INSERT INTO feedback_log (session_uuid, knowledge_id, rating, created_at) VALUES (?, ?, ?, ?)`
    ).run("s1", 1, "helpful", new Date().toISOString());

    const row = db.prepare(`SELECT rating_method FROM feedback_log`).get() as { rating_method: string | null };
    expect(row.rating_method).toBeNull();
  });

  it("migrates an existing database that predates the column", () => {
    const old = new Database(":memory:");
    old.exec(`
      CREATE TABLE feedback_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_uuid TEXT NOT NULL,
        knowledge_id INTEGER NOT NULL,
        rating TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    // The DDL no-ops on an existing table (CREATE TABLE IF NOT EXISTS), so the
    // append is migrateAddedColumns' job — the same split openV2Database uses.
    initSchemaV2(old);
    expect((old.pragma("table_info(feedback_log)") as Array<{ name: string }>).map((c) => c.name))
      .not.toContain("rating_method");

    const added = migrateAddedColumns(old);

    expect(added).toContain("feedback_log.rating_method");
    expect((old.pragma("table_info(feedback_log)") as Array<{ name: string }>).map((c) => c.name))
      .toContain("rating_method");
    old.close();
  });
});
