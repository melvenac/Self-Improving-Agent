import { describe, it, expect } from "vitest";
import {
  matchTagsInSummary,
  evaluateLifecycle,
  autoFeedback,
} from "../../../src/pipelines/session-end/auto-feedback.js";
import type {
  KnowledgeEntry,
  KnowledgeStore,
  FeedbackRating,
} from "../../../src/pipelines/session-end/types.js";

// ---------------------------------------------------------------------------
// Mock KnowledgeStore
// ---------------------------------------------------------------------------
function mockKnowledgeStore(
  entries: KnowledgeEntry[]
): KnowledgeStore & { feedbackLog: { id: number; rating: FeedbackRating }[] } {
  const map = new Map(entries.map((e) => [e.id, { ...e }]));
  const feedbackLog: { id: number; rating: FeedbackRating }[] = [];
  return {
    feedbackLog,
    getEntry: (id) => map.get(id) ?? null,
    updateFeedback: (id, rating) => {
      feedbackLog.push({ id, rating });
      const entry = map.get(id);
      if (entry) {
        if (rating === "helpful") entry.helpful_count++;
        else if (rating === "harmful") entry.harmful_count++;
        else entry.neutral_count++;
        const total =
          entry.helpful_count + entry.harmful_count + entry.neutral_count;
        entry.success_rate = total > 0 ? entry.helpful_count / total : 0;
      }
    },
    getEntryCounters: (id) => {
      const e = map.get(id);
      if (!e) return null;
      return {
        helpful_count: e.helpful_count,
        harmful_count: e.harmful_count,
        neutral_count: e.neutral_count,
        success_rate: e.success_rate,
        maturity: e.maturity,
        recall_count: e.recall_count,
      };
    },
  };
}

function makeEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: 1,
    key: "test-key",
    content: "test content",
    tags: "auth,validation",
    helpful_count: 0,
    harmful_count: 0,
    neutral_count: 0,
    success_rate: 0,
    maturity: "Progenitor",
    recall_count: 1,
    source: "agent",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// matchTagsInSummary
// ---------------------------------------------------------------------------
describe("matchTagsInSummary", () => {
  it("returns true when a tag is found in the summary", () => {
    expect(matchTagsInSummary("auth,validation", "User auth was discussed")).toBe(true);
  });

  it("returns false when no tags match the summary", () => {
    expect(matchTagsInSummary("auth,validation", "We talked about caching")).toBe(false);
  });

  it("returns false for empty tags", () => {
    expect(matchTagsInSummary("", "auth validation summary")).toBe(false);
  });

  it("returns false for empty summary", () => {
    expect(matchTagsInSummary("auth,validation", "")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(matchTagsInSummary("AUTH", "auth was used")).toBe(true);
    expect(matchTagsInSummary("auth", "AUTH validation done")).toBe(true);
  });

  it("matches on any tag in the list", () => {
    expect(matchTagsInSummary("foo,bar,baz", "the session used baz logic")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateLifecycle
// ---------------------------------------------------------------------------
describe("evaluateLifecycle", () => {
  it("promotes Progenitor → Proven at 3 helpful and ≥0.5 rate", () => {
    const result = evaluateLifecycle("Progenitor", 3, 0, 1.0);
    expect(result.maturity).toBe("Proven");
    expect(result.apoptosis).toBe(false);
  });

  it("does not promote Progenitor with insufficient count", () => {
    const result = evaluateLifecycle("Progenitor", 2, 0, 1.0);
    expect(result.maturity).toBe("Progenitor");
  });

  it("does not promote Progenitor with low success rate", () => {
    const result = evaluateLifecycle("Progenitor", 3, 5, 0.3);
    expect(result.maturity).toBe("Progenitor");
  });

  it("promotes Proven → Mature at 7 helpful", () => {
    const result = evaluateLifecycle("Proven", 7, 0, 1.0);
    expect(result.maturity).toBe("Mature");
    expect(result.apoptosis).toBe(false);
  });

  it("does not promote Proven with fewer than 7 helpful", () => {
    const result = evaluateLifecycle("Proven", 6, 0, 1.0);
    expect(result.maturity).toBe("Proven");
  });

  it("Mature stays Mature", () => {
    const result = evaluateLifecycle("Mature", 10, 0, 1.0);
    expect(result.maturity).toBe("Mature");
  });

  it("flags apoptosis for agent entries at <0.3 rate after 5 total ratings", () => {
    // 1 helpful, 4 harmful = 5 total, rate = 0.2
    const result = evaluateLifecycle("Progenitor", 1, 4, 0.2, "agent");
    expect(result.apoptosis).toBe(true);
  });

  it("does not flag apoptosis for manual entries", () => {
    const result = evaluateLifecycle("Progenitor", 1, 4, 0.2, "manual");
    expect(result.apoptosis).toBe(false);
  });

  it("does not flag apoptosis before 5 total ratings", () => {
    // 1 helpful, 3 harmful = 4 total, rate = 0.25
    const result = evaluateLifecycle("Progenitor", 1, 3, 0.25, "agent");
    expect(result.apoptosis).toBe(false);
  });

  it("uses default source=agent when source is omitted", () => {
    const result = evaluateLifecycle("Progenitor", 1, 4, 0.2);
    expect(result.apoptosis).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// autoFeedback
// ---------------------------------------------------------------------------
describe("autoFeedback", () => {
  it("rates helpful when tags match summary", () => {
    const store = mockKnowledgeStore([makeEntry({ id: 1, tags: "auth" })]);
    const result = autoFeedback([1], "auth was discussed in this session", store);
    expect(result.processed).toBe(1);
    expect(result.ratings[0].rating).toBe("helpful");
    expect(store.feedbackLog).toEqual([{ id: 1, rating: "helpful" }]);
  });

  it("rates neutral when tags don't match summary", () => {
    const store = mockKnowledgeStore([makeEntry({ id: 1, tags: "auth" })]);
    const result = autoFeedback([1], "caching and performance tuning", store);
    expect(result.ratings[0].rating).toBe("neutral");
    expect(store.feedbackLog).toEqual([{ id: 1, rating: "neutral" }]);
  });

  it("skips missing entries and logs error", () => {
    const store = mockKnowledgeStore([]);
    const result = autoFeedback([99], "some summary", store);
    expect(result.processed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("99");
  });

  it("handles empty recalled IDs", () => {
    const store = mockKnowledgeStore([]);
    const result = autoFeedback([], "some summary", store);
    expect(result.processed).toBe(0);
    expect(result.ratings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("evaluates lifecycle after rating — progenitor with 2 existing helpful + 1 more = 3 → Proven", () => {
    // Entry already has 2 helpful. After one more "helpful" rating → 3 helpful, rate=1.0 → Proven
    const entry = makeEntry({
      id: 1,
      tags: "auth",
      helpful_count: 2,
      harmful_count: 0,
      neutral_count: 0,
      success_rate: 1.0,
      maturity: "Progenitor",
    });
    const store = mockKnowledgeStore([entry]);
    const result = autoFeedback([1], "auth was used here", store);
    expect(result.ratings[0].maturityBefore).toBe("Progenitor");
    expect(result.ratings[0].maturityAfter).toBe("Proven");
    expect(result.ratings[0].apoptosis).toBe(false);
  });

  it("reports maturityBefore and maturityAfter correctly", () => {
    const store = mockKnowledgeStore([makeEntry({ id: 1, tags: "caching" })]);
    const result = autoFeedback([1], "no relevant content", store);
    expect(result.ratings[0].maturityBefore).toBe("Progenitor");
    expect(result.ratings[0].maturityAfter).toBe("Progenitor");
  });

  it("processes multiple entries in a single call", () => {
    const store = mockKnowledgeStore([
      makeEntry({ id: 1, tags: "auth" }),
      makeEntry({ id: 2, tags: "caching", key: "cache-key" }),
    ]);
    const result = autoFeedback([1, 2], "auth was the focus", store);
    expect(result.processed).toBe(2);
    expect(result.ratings.find((r) => r.entryId === 1)?.rating).toBe("helpful");
    expect(result.ratings.find((r) => r.entryId === 2)?.rating).toBe("neutral");
  });
});
