import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendScore, readHistory, calculateTrend } from "../../../src/pipelines/sync/history.js";
import type { ScoreResult } from "../../../src/pipelines/sync/types.js";

describe("history", () => {
  let tempDir: string;
  let historyPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-history-"));
    historyPath = join(tempDir, "score-history.jsonl");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("appends a score entry to JSONL file", () => {
    const score: ScoreResult = {
      total: 72,
      categories: [{ name: "Config & Structure", score: 20, max: 25, details: {} }],
      date: "2026-04-12",
    };
    appendScore(historyPath, score);
    const content = readFileSync(historyPath, "utf-8").trim();
    const entry = JSON.parse(content);
    expect(entry.total).toBe(72);
    expect(entry.date).toBe("2026-04-12");
  });

  it("reads history from JSONL file", () => {
    writeFileSync(historyPath, '{"total":70,"date":"2026-04-10"}\n{"total":72,"date":"2026-04-11"}\n');
    const entries = readHistory(historyPath);
    expect(entries).toHaveLength(2);
    expect(entries[0].total).toBe(70);
    expect(entries[1].total).toBe(72);
  });

  it("returns empty array when file missing", () => {
    const entries = readHistory(join(tempDir, "nonexistent.jsonl"));
    expect(entries).toEqual([]);
  });

  describe("calculateTrend", () => {
    it("returns improving when score increases", () => {
      const entries = [
        { total: 60, categories: {}, date: "2026-04-08" },
        { total: 65, categories: {}, date: "2026-04-09" },
        { total: 70, categories: {}, date: "2026-04-10" },
        { total: 72, categories: {}, date: "2026-04-11" },
        { total: 75, categories: {}, date: "2026-04-12" },
      ];
      expect(calculateTrend(entries)).toBe("improving");
    });

    it("returns declining when score decreases", () => {
      const entries = [
        { total: 80, categories: {}, date: "2026-04-08" },
        { total: 75, categories: {}, date: "2026-04-09" },
        { total: 70, categories: {}, date: "2026-04-10" },
        { total: 65, categories: {}, date: "2026-04-11" },
        { total: 60, categories: {}, date: "2026-04-12" },
      ];
      expect(calculateTrend(entries)).toBe("declining");
    });

    it("returns stable when score stays flat", () => {
      const entries = [
        { total: 72, categories: {}, date: "2026-04-08" },
        { total: 73, categories: {}, date: "2026-04-09" },
        { total: 72, categories: {}, date: "2026-04-10" },
      ];
      expect(calculateTrend(entries)).toBe("stable");
    });

    it("returns unknown with fewer than 2 entries", () => {
      expect(calculateTrend([])).toBe("unknown");
      expect(calculateTrend([{ total: 72, categories: {}, date: "2026-04-12" }])).toBe("unknown");
    });
  });
});
