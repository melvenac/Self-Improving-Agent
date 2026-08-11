import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { initSchemaV2, indexKnowledge, updateFeedbackV2 } from "../../../src/db-v2.js";
import { apoptosisFlaggedExpr, LIFECYCLE_CONFIG } from "../../../src/lifecycle.js";
import { sessionEndV2 } from "../../../src/pipelines/session-end/index-v2.js";

/**
 * Characterization tests for the dead apoptosis signal.
 *
 * Session 49 observed 0 harmful ratings across ~760 and read the zero as health.
 * It is not health: on the production write path the flag condition is
 * unsatisfiable, so the zero measures nothing. These tests pin the three
 * defects that make it so. They are expected to FAIL until the rating pipeline
 * is repaired — that is the point.
 *
 * Deliberately mechanism-neutral: they assert properties of the stored counters
 * and the apoptosis predicate, not any particular design for how a negative
 * signal gets produced.
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
    content: "seed content for apoptosis reachability tests",
    tags: "alpha,beta",
    source,
    projectDir: null,
  });
  return db.prepare(`SELECT id FROM knowledge_index WHERE vault_path = ?`).get(vaultPath).id as number;
}

function read(db: Database.Database, id: number) {
  return db
    .prepare(`SELECT helpful, harmful, neutral, success_rate FROM knowledge_index WHERE id = ?`)
    .get(id) as { helpful: number; harmful: number; neutral: number; success_rate: number | null };
}

describe("apoptosis signal reachability", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = makeDb();
  });

  it("recomputes success_rate when feedback is recorded", () => {
    const id = seed(db, "Experiences/rate-is-written.md");

    updateFeedbackV2(db, "Experiences/rate-is-written.md", "helpful");
    updateFeedbackV2(db, "Experiences/rate-is-written.md", "harmful");

    const row = read(db, id);
    expect(row.helpful).toBe(1);
    expect(row.harmful).toBe(1);
    // Currently NULL: updateFeedbackV2 increments the counter column and nothing
    // else, so success_rate keeps its insert-time value forever. 304 of 364 live
    // entries are NULL for this reason, and `success_rate < 0.3` is never true
    // of NULL — which alone is enough to make apoptosis unreachable.
    expect(row.success_rate).toBeCloseTo(0.5, 5);
  });

  it("excludes neutral ratings from the success_rate denominator", () => {
    const id = seed(db, "Experiences/neutral-does-not-count.md");

    updateFeedbackV2(db, "Experiences/neutral-does-not-count.md", "helpful");
    for (let i = 0; i < 9; i++) {
      updateFeedbackV2(db, "Experiences/neutral-does-not-count.md", "neutral");
    }

    const row = read(db, id);
    expect(row.neutral).toBe(9);
    // Guard against the obvious wrong fix. lifecycle.ts:59 divides by
    // helpful + harmful; the mock in auto-feedback.test.ts divides by
    // helpful + harmful + neutral. Adopting the mock's formula would score this
    // entry at 0.1 and, with 473 neutrals against 347 helpfuls live, would prune
    // a large share of the vault for never having matched a substring tag test.
    // "Not mentioned in the summary" is not evidence of harm.
    expect(row.success_rate).toBeCloseTo(1.0, 5);
  });

  it("surfaces a manual entry in the apoptosis review queue once it earns harm", () => {
    const path = "Experiences/manual-entry-goes-bad.md";
    const id = seed(db, path, "manual");

    updateFeedbackV2(db, path, "helpful");
    for (let i = 0; i < 4; i++) updateFeedbackV2(db, path, "harmful");

    const row = read(db, id);
    expect(row.helpful + row.harmful).toBeGreaterThanOrEqual(LIFECYCLE_CONFIG.apoptosisMinActivations);

    const flagged = db
      .prepare(`SELECT k.id FROM knowledge_index k WHERE ${apoptosisFlaggedExpr("k")}`)
      .all() as Array<{ id: number }>;

    // 1 helpful / 4 harmful = 0.2, below the 0.3 threshold, at exactly the
    // 5-activation floor. This is the canonical case the queue exists to hold.
    expect(flagged.map((r) => r.id)).toContain(id);
  });

  it("cannot be satisfied by helpful and neutral alone", () => {
    const path = "Experiences/binary-vocabulary.md";
    seed(db, path, "manual");

    // The production auto-feedback path (index-v2.ts:84) types its rating as
    // `"helpful" | "neutral"`, so this is every history it can produce at the
    // activation floor. None of them can ever trip apoptosis: with harmful
    // pinned at 0, reaching helpful + harmful >= 5 forces the rate to 1.0.
    for (let i = 0; i < 5; i++) updateFeedbackV2(db, path, "helpful");
    for (let i = 0; i < 20; i++) updateFeedbackV2(db, path, "neutral");

    const flagged = db
      .prepare(`SELECT k.id FROM knowledge_index k WHERE ${apoptosisFlaggedExpr("k")}`)
      .all();
    expect(flagged).toHaveLength(0);
  });
});

describe("sessionEndV2 explicit ratings", () => {
  let db: Database.Database;
  let vaultDir: string;
  let agentsDir: string;

  beforeEach(() => {
    db = makeDb();
    vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "apoptosis-v2-"));
    agentsDir = fs.mkdtempSync(path.join(os.tmpdir(), "apoptosis-agents-"));
    process.env.OPEN_BRAIN_VAULT_DIR = vaultDir;
  });

  afterEach(() => {
    delete process.env.OPEN_BRAIN_VAULT_DIR;
  });

  function run(entryRatings?: Record<number, "helpful" | "harmful" | "neutral">) {
    return sessionEndV2({
      db,
      vaultDir,
      agentsDir,
      sessionId: "apoptosis-test-session",
      // Contains the entry's tag, so the heuristic alone would say "helpful".
      sessionSummary: "Session covering alpha and beta work",
      project: "test-project",
      recalledEntryIds: [1],
      entryRatings,
      dryRun: true,
    });
  }

  it("records a harmful rating supplied by the agent", () => {
    const id = seed(db, "Experiences/agent-says-harmful.md");
    expect(id).toBe(1);

    const result = run({ 1: "harmful" });

    expect(result.feedback.ratings).toEqual([{ id: 1, rating: "harmful" }]);
    const row = read(db, id);
    expect(row.harmful).toBe(1);
    expect(row.helpful).toBe(0);
    // 0 helpful of 1 non-neutral rating.
    expect(row.success_rate).toBeCloseTo(0, 5);
  });

  it("overrides the tag heuristic rather than being averaged with it", () => {
    seed(db, "Experiences/heuristic-would-disagree.md");

    // The summary matches this entry's tags, so without an explicit rating the
    // pipeline would call it helpful. The agent's judgment has to win outright
    // — a signal that can be diluted by the heuristic is not a signal.
    const result = run({ 1: "harmful" });

    expect(result.feedback.ratings[0].rating).toBe("harmful");
    expect(read(db, 1).helpful).toBe(0);
  });

  it("falls back to the tag heuristic for entries left unrated", () => {
    seed(db, "Experiences/no-explicit-rating.md");

    const result = run(undefined);

    expect(result.feedback.ratings[0].rating).toBe("helpful");
    expect(read(db, 1).helpful).toBe(1);
  });
});
