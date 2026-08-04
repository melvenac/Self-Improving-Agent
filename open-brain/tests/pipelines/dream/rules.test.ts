import { describe, it, expect } from "vitest";
import type { KnowledgeIndexRow } from "../../../src/db-v2.js";
import {
  findDuplicates,
  findStale,
  normaliseKey,
  similarity,
  tokenise,
} from "../../../src/pipelines/dream/rules.js";

const NOW = new Date("2026-08-03T00:00:00Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

function entry(over: Partial<KnowledgeIndexRow> & { id: number }): KnowledgeIndexRow {
  return {
    vault_path: `Experiences/General/entry-${over.id}.md`,
    key: `entry-${over.id}`,
    content: "some content",
    tags: "",
    source: "manual",
    project_dir: null,
    maturity: "progenitor",
    helpful: 0,
    harmful: 0,
    neutral: 0,
    success_rate: null,
    recall_count: 0,
    last_recalled_at: null,
    archived_into: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    ...over,
  };
}

describe("normaliseKey", () => {
  it("treats separator and case variants as the same key", () => {
    expect(normaliseKey("Convex_Deploy Notes")).toBe(normaliseKey("convex-deploy-notes"));
  });

  it("returns empty for a missing key rather than matching other empties", () => {
    expect(normaliseKey(null)).toBe("");
  });
});

describe("tokenise / similarity", () => {
  it("drops filler words that make unrelated notes look alike", () => {
    expect(tokenise("the and of it is")).toEqual(new Set());
  });

  it("scores identical vocabulary as 1 and disjoint as 0", () => {
    expect(similarity(tokenise("convex deploy"), tokenise("deploy convex"))).toBe(1);
    expect(similarity(tokenise("convex deploy"), tokenise("remotion render"))).toBe(0);
  });

  it("scores an empty side as 0 rather than dividing by zero", () => {
    expect(similarity(new Set(), tokenise("anything"))).toBe(0);
  });
});

describe("findDuplicates", () => {
  it("pairs entries that share a normalised key", () => {
    const found = findDuplicates([
      entry({ id: 1, key: "convex-deploy", content: "totally different words here" }),
      entry({ id: 2, key: "Convex Deploy", content: "nothing alike whatsoever friend" }),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0].targetIds).toEqual([1, 2]);
    expect(found[0].confidence).toBeGreaterThan(0.85);
  });

  it("pairs entries whose keys overlap heavily", () => {
    // The shape that motivated keying off the key: a real near-duplicate whose
    // content overlap (0.386 in the live corpus) is indistinguishable from that
    // of unrelated notes about the same stack.
    const found = findDuplicates([
      entry({ id: 1, key: "traefik-docker-api-version", content: "traefik needs the docker api version pinned" }),
      entry({ id: 2, key: "traefik-docker-29-api-version", content: "pin api version for docker 29 under traefik" }),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0].summary).toContain("key overlap");
  });

  it("pairs entries with very high content overlap despite unrelated keys", () => {
    const shared = "convex mutations require argument validators otherwise deployment fails entirely";
    const found = findDuplicates([
      entry({ id: 1, key: "alpha", content: shared }),
      entry({ id: 2, key: "beta", content: shared }),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0].summary).toContain("despite unrelated keys");
  });

  it("leaves same-topic neighbours alone when only vocabulary is shared", () => {
    // Both are about Convex and share words, but neither key nor content
    // overlap is high enough to call them the same note.
    const found = findDuplicates([
      entry({ id: 1, key: "convex-admin-key", content: "the convex self hosted deployment needs an admin key generated first" }),
      entry({ id: 2, key: "hub-start-order", content: "start the convex deployment before the hub or startup fails" }),
    ]);

    expect(found).toEqual([]);
  });

  it("leaves entirely unrelated entries alone", () => {
    const found = findDuplicates([
      entry({ id: 1, key: "convex", content: "convex mutations require argument validators" }),
      entry({ id: 2, key: "remotion", content: "remotion compositions render react video frames" }),
    ]);

    expect(found).toEqual([]);
  });

  it("ranks the most confident candidates first", () => {
    const found = findDuplicates([
      entry({ id: 1, key: "nano-banana-windows-fix", content: "alpha beta" }),
      entry({ id: 2, key: "nano-banana-windows-mcp", content: "gamma delta" }),
      entry({ id: 3, key: "exact-key", content: "one" }),
      entry({ id: 4, key: "exact-key", content: "two" }),
    ]);

    expect(found[0].targetIds).toEqual([3, 4]); // exact key match outranks partial
    expect(found[0].confidence).toBeGreaterThan(found[found.length - 1].confidence);
  });

  it("ignores entries already archived into another", () => {
    const found = findDuplicates([
      entry({ id: 1, key: "same-key", content: "x" }),
      entry({ id: 2, key: "same-key", content: "x", archived_into: 1 }),
    ]);

    expect(found).toEqual([]);
  });

  it("reports each pair once, not twice", () => {
    const found = findDuplicates([
      entry({ id: 1, key: "dup" }),
      entry({ id: 2, key: "dup" }),
      entry({ id: 3, key: "dup" }),
    ]);

    expect(found).toHaveLength(3); // 1-2, 1-3, 2-3
    expect(found.map((c) => c.targetIds).sort()).toEqual([[1, 2], [1, 3], [2, 3]]);
  });

  it("does not match two entries that both have no key", () => {
    const found = findDuplicates([
      entry({ id: 1, key: "", content: "alpha beta gamma delta" }),
      entry({ id: 2, key: "", content: "epsilon zeta eta theta" }),
    ]);

    expect(found).toEqual([]);
  });

  it("attaches checkable evidence to every candidate", () => {
    const [candidate] = findDuplicates([
      entry({ id: 1, key: "dup", content: "the content of one" }),
      entry({ id: 2, key: "dup", content: "the content of two" }),
    ]);

    expect(candidate.evidence).toHaveLength(2);
    for (const e of candidate.evidence) {
      expect(e.source).toBe("entry");
      expect(e.quote.length).toBeGreaterThan(0);
    }
  });
});

describe("findStale", () => {
  it("flags an entry never recalled since it was written long ago", () => {
    const found = findStale([entry({ id: 1, created_at: daysAgo(200) })], { now: NOW });

    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("stale");
    expect(found[0].summary).toContain("never been recalled");
  });

  it("leaves a recently written entry alone", () => {
    const found = findStale([entry({ id: 1, created_at: daysAgo(3) })], { now: NOW });

    expect(found).toEqual([]);
  });

  it("defaults to 120 days, not 90 — 90 flags half the live corpus", () => {
    const rows = [entry({ id: 1, created_at: daysAgo(100) })];

    expect(findStale(rows, { now: NOW })).toEqual([]);
    expect(findStale(rows, { now: NOW, unusedDays: 90 })).toHaveLength(1);
  });

  it("leaves a frequently recalled entry alone however old", () => {
    const found = findStale(
      [entry({ id: 1, created_at: daysAgo(500), last_recalled_at: daysAgo(400), recall_count: 40 })],
      { now: NOW },
    );

    expect(found).toEqual([]);
  });

  it("flags a long-unused entry that was recalled once", () => {
    const found = findStale(
      [entry({ id: 1, created_at: daysAgo(300), last_recalled_at: daysAgo(200), recall_count: 1 })],
      { now: NOW },
    );

    expect(found).toHaveLength(1);
    expect(found[0].summary).toContain("last recalled 200 days ago");
  });

  it("is gentler on mature entries, which earned their standing", () => {
    const base = { id: 1, created_at: daysAgo(200) };
    const [young] = findStale([entry(base)], { now: NOW });
    const [mature] = findStale([entry({ ...base, maturity: "mature" })], { now: NOW });

    expect(mature.confidence).toBeLessThan(young.confidence);
  });

  it("ignores entries already archived into another", () => {
    const found = findStale(
      [entry({ id: 1, created_at: daysAgo(300), archived_into: 7 })],
      { now: NOW },
    );

    expect(found).toEqual([]);
  });

  it("tolerates an unparseable timestamp rather than throwing", () => {
    const found = findStale([entry({ id: 1, created_at: "not-a-date" })], { now: NOW });

    expect(found).toEqual([]);
  });

  it("takes its clock from the caller, so runs are reproducible", () => {
    const rows = [entry({ id: 1, created_at: daysAgo(200) })];

    expect(findStale(rows, { now: NOW })).toHaveLength(1);
    // Rewind past the point where the entry is old enough to qualify.
    expect(findStale(rows, { now: new Date(NOW.getTime() - 100 * 24 * 3600 * 1000) })).toEqual([]);
  });
});
