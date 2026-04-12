import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDb } from "../../../src/db.js";
import type { OpenBrainDb } from "../../../src/db.js";
import {
  scoreKnowledgeQuality,
  scoreStaleness,
  scoreCoverage,
} from "../../../src/pipelines/sync/scorer.js";

describe("scorer with real DB inputs", () => {
  let db: OpenBrainDb;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("scores knowledge quality from DB stats", () => {
    const id1 = db.insertKnowledge("good entry about auth", { key: "k1", tags: ["auth"] });
    db.updateFeedback(id1, "helpful");
    db.updateFeedback(id1, "helpful");
    const id2 = db.insertKnowledge("bad entry", { key: "k2", tags: ["db"] });
    db.updateFeedback(id2, "harmful");

    const stats = db.getKnowledgeStats();
    const score = scoreKnowledgeQuality(stats);
    expect(score.score).toBeGreaterThan(0);
    expect(score.max).toBe(25);
    expect(score.name).toBe("Knowledge Quality");
  });

  it("scores staleness from DB stats", () => {
    db.insertKnowledge("entry", { key: "k1" });
    db.insertSession({
      id: "s1", db_file: "s1.jsonl", project_dir: "/p",
      started_at: "2026-01-01", ended_at: "2026-01-01", event_count: 5,
    });
    db.insertSummary("s1", "summary of session 1");

    const stats = db.getStalenessStats();
    const score = scoreStaleness(stats);
    expect(score.score).toBeGreaterThan(0);
    expect(score.max).toBe(20);
  });

  it("scores coverage from DB stats", () => {
    db.insertKnowledge("proven entry", { key: "k1", tags: ["auth", "security"] });
    db.raw.prepare("UPDATE knowledge SET maturity = 'proven' WHERE key = 'k1'").run();

    const stats = db.getCoverageStats(5);
    const score = scoreCoverage(stats);
    expect(score.score).toBeGreaterThan(0);
    expect(score.max).toBe(20);
  });

  it("handles empty DB gracefully (all zeros)", () => {
    const quality = scoreKnowledgeQuality(db.getKnowledgeStats());
    const staleness = scoreStaleness(db.getStalenessStats());
    const coverage = scoreCoverage(db.getCoverageStats(10));

    // Should not crash — scores may be 0 or have defaults
    expect(quality.score).toBeGreaterThanOrEqual(0);
    expect(staleness.score).toBeGreaterThanOrEqual(0);
    expect(coverage.score).toBeGreaterThanOrEqual(0);
  });
});
