import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  initSchemaV2,
  indexKnowledge,
  updateFeedbackV2,
  getKnowledgeQualityStats,
  getStalenessStats,
  getCoverageStats,
} from "../../../src/db-v2.js";
import {
  scoreKnowledgeQuality,
  scoreStaleness,
  scoreCoverage,
} from "../../../src/pipelines/sync/scorer.js";

/**
 * Loop 10 C2 (E29): this fed the scorer statistics from `db.ts`, the v1 layer,
 * while production reads `db-v2`. The describe block said "real DB inputs" and
 * the DB was not the one production uses — a stand-in checked instead of the
 * thing. Repointed at `db-v2` so the title is true.
 */
describe("scorer with real DB inputs (db-v2, as production reads it)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initSchemaV2(db);
  });

  afterEach(() => {
    db.close();
  });

  const add = (vaultPath: string, key: string, content: string, tags: string) =>
    indexKnowledge(db, { vaultPath, key, content, tags, source: "manual" });

  it("scores knowledge quality from DB stats", () => {
    add("/v/k1.md", "k1", "good entry about auth", "auth");
    updateFeedbackV2(db, "/v/k1.md", "helpful");
    updateFeedbackV2(db, "/v/k1.md", "helpful");
    add("/v/k2.md", "k2", "bad entry", "db");
    updateFeedbackV2(db, "/v/k2.md", "harmful");

    const score = scoreKnowledgeQuality(getKnowledgeQualityStats(db));
    expect(score.score).toBeGreaterThan(0);
    expect(score.max).toBe(25);
    expect(score.name).toBe("Knowledge Quality");
  });

  it("scores staleness from DB stats", () => {
    add("/v/k1.md", "k1", "entry", "auth");

    const score = scoreStaleness(getStalenessStats(db));
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.max).toBe(20);
  });

  it("scores coverage from DB stats", () => {
    add("/v/k1.md", "k1", "proven entry", "auth, security");

    const score = scoreCoverage(getCoverageStats(db, ["auth", "security", "db", "ci", "docs"]));
    expect(score.score).toBeGreaterThan(0);
    expect(score.max).toBe(20);
  });

  it("handles empty DB gracefully (all zeros)", () => {
    const quality = scoreKnowledgeQuality(getKnowledgeQualityStats(db));
    const staleness = scoreStaleness(getStalenessStats(db));
    const coverage = scoreCoverage(getCoverageStats(db, ["a", "b"]));

    // Should not crash — scores may be 0 or have defaults
    expect(quality.score).toBeGreaterThanOrEqual(0);
    expect(staleness.score).toBeGreaterThanOrEqual(0);
    expect(coverage.score).toBeGreaterThanOrEqual(0);
  });

  it("reports lowSuccessCount as 0 — the signal behind it was cut (E4b)", () => {
    add("/v/k1.md", "k1", "entry", "auth");
    updateFeedbackV2(db, "/v/k1.md", "harmful");

    // `success_rate` no longer exists to be below a threshold. Asserted so a
    // reinstatement has to argue with a failing test rather than slip back in.
    expect(getStalenessStats(db).lowSuccessCount).toBe(0);
  });
});
