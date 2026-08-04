import { describe, it, expect } from "vitest";
import { buildReport, formatReport } from "../../../src/pipelines/dream/report.js";
import type { Candidate, CandidateKind } from "../../../src/pipelines/dream/types.js";

function candidate(
  kind: CandidateKind,
  confidence: number,
  id = 1,
  summary = `${kind} candidate ${id}`,
): Candidate {
  return {
    kind,
    targetIds: [id],
    summary,
    evidence: [{ source: "entry", entryId: id, key: `key-${id}`, quote: "quoted content" }],
    confidence,
  };
}

const base = {
  generatedAt: "2026-08-03T12:00:00.000Z",
  since: "2026-07-27T12:00:00.000Z",
  sessionsExamined: ["s1", "s2"],
  entriesExamined: 332,
};

describe("buildReport", () => {
  it("keeps everything when no cap is given", () => {
    const report = buildReport({
      ...base,
      candidates: [candidate("stale", 0.6, 1), candidate("stale", 0.5, 2)],
    });

    expect(report.candidates).toHaveLength(2);
    expect(report.omissions).toEqual([]);
  });

  it("caps per kind and records exactly what it dropped", () => {
    const report = buildReport({
      ...base,
      maxPerKind: 2,
      candidates: [
        candidate("stale", 0.9, 1),
        candidate("stale", 0.8, 2),
        candidate("stale", 0.7, 3),
        candidate("stale", 0.6, 4),
      ],
    });

    expect(report.candidates.map((c) => c.targetIds[0])).toEqual([1, 2]);
    expect(report.omissions).toEqual([
      { kind: "stale", shown: 2, omitted: 2, highestOmittedConfidence: 0.7 },
    ]);
  });

  it("caps each kind independently", () => {
    const report = buildReport({
      ...base,
      maxPerKind: 1,
      candidates: [
        candidate("stale", 0.9, 1),
        candidate("stale", 0.8, 2),
        candidate("duplicate", 0.7, 3),
      ],
    });

    expect(report.candidates).toHaveLength(2);
    expect(report.omissions).toHaveLength(1);
    expect(report.omissions[0].kind).toBe("stale");
  });

  it("drops sub-threshold candidates before capping, so the cap is spent on the best", () => {
    const report = buildReport({
      ...base,
      minConfidence: 0.5,
      maxPerKind: 2,
      candidates: [
        candidate("duplicate", 0.9, 1),
        candidate("duplicate", 0.2, 2),
        candidate("duplicate", 0.6, 3),
      ],
    });

    expect(report.candidates.map((c) => c.targetIds[0])).toEqual([1, 3]);
    expect(report.omissions).toEqual([]); // 0.2 was filtered, not omitted
  });

  it("orders by confidence, highest first", () => {
    const report = buildReport({
      ...base,
      candidates: [candidate("stale", 0.3, 1), candidate("duplicate", 0.9, 2), candidate("stale", 0.6, 3)],
    });

    expect(report.candidates.map((c) => c.confidence)).toEqual([0.9, 0.6, 0.3]);
  });

  it("produces identical output for identical input, so a no-op run looks like one", () => {
    const candidates = [
      candidate("duplicate", 0.5, 9),
      candidate("duplicate", 0.5, 2),
      candidate("duplicate", 0.5, 5),
    ];

    const a = buildReport({ ...base, candidates });
    const b = buildReport({ ...base, candidates: [...candidates].reverse() });

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("carries the corpus size through, so an empty result can be distinguished from an empty corpus", () => {
    const report = buildReport({ ...base, candidates: [] });

    expect(report.candidates).toEqual([]);
    expect(report.entriesExamined).toBe(332);
  });
});

describe("formatReport", () => {
  it("says plainly when there is nothing to reconcile", () => {
    const text = formatReport(buildReport({ ...base, candidates: [] }));

    expect(text).toContain("No candidates");
  });

  it("states the omission in the section and again at the end", () => {
    const report = buildReport({
      ...base,
      maxPerKind: 1,
      candidates: [candidate("stale", 0.9, 1), candidate("stale", 0.8, 2), candidate("stale", 0.7, 3)],
    });

    const text = formatReport(report);

    expect(text).toContain("2 more stale candidate(s) not shown");
    expect(text).toContain("highest omitted confidence 0.80");
    expect(text).toContain("2 candidate(s) omitted across 1 section(s)");
  });

  it("never claims completeness when something was dropped", () => {
    const text = formatReport(
      buildReport({ ...base, maxPerKind: 1, candidates: [candidate("stale", 0.9, 1), candidate("stale", 0.8, 2)] }),
    );

    expect(text).toContain("omitted");
  });

  it("renders evidence so a proposal can be checked without opening the entry", () => {
    const text = formatReport(buildReport({ ...base, candidates: [candidate("duplicate", 0.8, 42)] }));

    expect(text).toContain("entry 42");
    expect(text).toContain("quoted content");
  });

  it("abbreviates transcript evidence to session and line", () => {
    const withTranscript: Candidate = {
      kind: "correction",
      targetIds: [],
      summary: "user corrected a stored preference",
      evidence: [
        { source: "transcript", sessionId: "17a86611-c78c-4eee-ae39-1bf359675c10", line: 42, quote: "actually, use v2" },
      ],
      confidence: 0.7,
    };

    const text = formatReport(buildReport({ ...base, candidates: [withTranscript] }));

    expect(text).toContain("17a86611:42");
    expect(text).toContain("actually, use v2");
  });
});
