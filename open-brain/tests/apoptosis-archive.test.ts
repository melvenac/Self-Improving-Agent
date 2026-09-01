import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  initSchemaV2,
  indexKnowledge,
  updateFeedbackV2,
  recordSession,
  recordFeedbackEvent,
  archiveKnowledgeEntry,
  getStalenessStats,
} from "../src/db-v2.js";
import {
  ARCHIVED_NO_SUCCESSOR,
  apoptosisGateExpr,
  lowSuccessExpr,
  LIFECYCLE_CONFIG,
} from "../src/lifecycle.js";

/**
 * Apoptosis retires an entry; it must not destroy one.
 *
 * The path used to hard-DELETE the row. Neither `feedback_log` nor `recall_log`
 * declares a foreign key, so the ratings that justified the prune survived as
 * rows pointing at an id that no longer resolved — the evidence became
 * unreadable at the moment it was acted on, and a pruned entry looked exactly
 * like one that had never been rated.
 *
 * These tests pin the property, not the mechanism: whatever retires an entry
 * must leave the row and both logs joinable.
 */
function makeDb(): Database.Database {
  const db = new Database(":memory:");
  initSchemaV2(db);
  return db;
}

function seed(db: Database.Database, vaultPath: string, source = "agent"): number {
  indexKnowledge(db, {
    vaultPath,
    key: vaultPath.replace(/\W+/g, "-"),
    content: "seed content for apoptosis archive tests",
    tags: "alpha,beta",
    source,
    projectDir: null,
  });
  return (db.prepare(`SELECT id FROM knowledge_index WHERE vault_path = ?`).get(vaultPath) as { id: number }).id;
}

describe("apoptosis archives rather than deletes", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = makeDb();
  });

  it("keeps the row so the entry can still be read after retirement", () => {
    const id = seed(db, "Experiences/retired.md");

    archiveKnowledgeEntry(db, id, { rating: "harmful", successRate: 0.2, maturity: "progenitor" });

    const row = db.prepare(`SELECT id, archived_into FROM knowledge_index WHERE id = ?`).get(id) as
      | { id: number; archived_into: number | null }
      | undefined;
    expect(row).toBeDefined();
    expect(row!.archived_into).toBe(ARCHIVED_NO_SUCCESSOR);
  });

  it("leaves rating history joinable — the regression the hard DELETE caused", () => {
    const id = seed(db, "Experiences/history-survives.md");
    recordSession(db, "session-uuid-1", null);
    recordFeedbackEvent(db, "session-uuid-1", id, "harmful", "direct");
    recordFeedbackEvent(db, "session-uuid-1", id, "harmful", "direct");

    archiveKnowledgeEntry(db, id, { rating: "harmful", successRate: 0.1, maturity: "progenitor" });

    // The join that a hard DELETE silently broke: every feedback_log row for
    // this entry must still resolve to a knowledge_index row.
    const orphans = db.prepare(`
      SELECT COUNT(*) AS c FROM feedback_log f
      LEFT JOIN knowledge_index k ON k.id = f.knowledge_id
      WHERE f.knowledge_id = ? AND k.id IS NULL
    `).get(id) as { c: number };
    expect(orphans.c).toBe(0);

    const kept = db.prepare(`SELECT COUNT(*) AS c FROM feedback_log WHERE knowledge_id = ?`).get(id) as { c: number };
    expect(kept.c).toBe(2);
  });

  it("records the verdict that retired it, not the state just before", () => {
    const id = seed(db, "Experiences/final-rating.md");
    updateFeedbackV2(db, "Experiences/final-rating.md", "harmful");

    archiveKnowledgeEntry(db, id, { rating: "harmful", successRate: 0.0, maturity: "progenitor" });

    const row = db.prepare(`SELECT harmful, success_rate FROM knowledge_index WHERE id = ?`).get(id) as
      { harmful: number; success_rate: number | null };
    // One from updateFeedbackV2, one applied by the archive itself.
    expect(row.harmful).toBe(2);
    expect(row.success_rate).toBe(0.0);
  });

  it("drops out of live views, which all filter archived_into IS NULL", () => {
    const live = seed(db, "Experiences/still-live.md");
    const retired = seed(db, "Experiences/gone-quiet.md");

    archiveKnowledgeEntry(db, retired, { rating: "harmful", successRate: 0.1, maturity: "progenitor" });

    const visible = db.prepare(
      `SELECT id FROM knowledge_index WHERE archived_into IS NULL`
    ).all() as { id: number }[];
    expect(visible.map((r) => r.id)).toEqual([live]);
  });

  it("is reversible by clearing one column", () => {
    const id = seed(db, "Experiences/restore-me.md");
    archiveKnowledgeEntry(db, id, { rating: "harmful", successRate: 0.1, maturity: "progenitor" });

    db.prepare(`UPDATE knowledge_index SET archived_into = NULL WHERE id = ?`).run(id);

    const visible = db.prepare(
      `SELECT COUNT(*) AS c FROM knowledge_index WHERE archived_into IS NULL AND id = ?`
    ).get(id) as { c: number };
    expect(visible.c).toBe(1);
  });

  it("uses a sentinel that cannot collide with a real merge target", () => {
    // knowledge_index.id is AUTOINCREMENT and starts at 1, so 0 is unusable as
    // a successor id — which is what makes it safe to mean "no successor".
    const id = seed(db, "Experiences/sentinel.md");
    expect(id).toBeGreaterThan(ARCHIVED_NO_SUCCESSOR);
  });
});

describe("apoptosis gate agreement between pruner and stats", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = makeDb();
  });

  it("excludes neutral from the gate, matching nonNeutral in evaluateLifecycle", () => {
    expect(apoptosisGateExpr("k")).toContain("k.helpful + k.harmful");
    expect(apoptosisGateExpr("k")).not.toContain("neutral");
  });

  it("builds the threshold from LIFECYCLE_CONFIG rather than a literal", () => {
    expect(lowSuccessExpr("k")).toContain(String(LIFECYCLE_CONFIG.apoptosisThreshold));
    expect(lowSuccessExpr("k")).toContain(String(LIFECYCLE_CONFIG.apoptosisMinActivations));
  });

  it("does not count a neutral-only entry as low-success", () => {
    // The exact shape the old stats query got wrong: five neutrals passed a
    // `helpful + harmful + neutral >= 5` gate, so ob_stats reported on entries
    // the pruner would never consider. success_rate stays NULL here, and NULL
    // must not read as "below threshold".
    const path = "Experiences/all-neutral.md";
    seed(db, path);
    for (let i = 0; i < 5; i++) updateFeedbackV2(db, path, "neutral");

    const stats = getStalenessStats(db);
    expect(stats.lowSuccessCount).toBe(0);
  });

  it("counts an entry the pruner would act on", () => {
    const path = "Experiences/genuinely-bad.md";
    seed(db, path);
    updateFeedbackV2(db, path, "helpful");
    for (let i = 0; i < 5; i++) updateFeedbackV2(db, path, "harmful");

    const stats = getStalenessStats(db);
    expect(stats.lowSuccessCount).toBe(1);
  });

  it("stops counting it once it is archived", () => {
    const path = "Experiences/bad-then-retired.md";
    const id = seed(db, path);
    updateFeedbackV2(db, path, "helpful");
    for (let i = 0; i < 5; i++) updateFeedbackV2(db, path, "harmful");
    expect(getStalenessStats(db).lowSuccessCount).toBe(1);

    archiveKnowledgeEntry(db, id, { rating: "harmful", successRate: 0.14, maturity: "progenitor" });

    expect(getStalenessStats(db).lowSuccessCount).toBe(0);
  });
});
