import { describe, it, expect, vi } from "vitest";
import {
  parseFrontmatter,
  updateFrontmatter,
  syncFrontmatter,
} from "../../../src/pipelines/session-end/frontmatter-sync.js";
import type { FeedbackResult, FrontmatterField } from "../../../src/pipelines/session-end/types.js";

// --- parseFrontmatter ---

describe("parseFrontmatter", () => {
  it("parses standard YAML frontmatter", () => {
    const md = `---
id: 42
key: test-entry
maturity: progenitor
helpful_count: 2
harmful_count: 0
success_rate: 0.67
recall_count: 4
---

Content here.`;
    const result = parseFrontmatter(md);
    expect(result).not.toBeNull();
    expect(result!.frontmatter).toContain("id: 42");
    expect(result!.frontmatter).toContain("maturity: progenitor");
    expect(result!.body).toContain("Content here.");
  });

  it("returns null when no frontmatter found", () => {
    const md = "Just plain content\nNo frontmatter here.";
    expect(parseFrontmatter(md)).toBeNull();
  });

  it("handles empty frontmatter block", () => {
    const md = "---\n---\nBody content";
    const result = parseFrontmatter(md);
    expect(result).not.toBeNull();
    expect(result!.frontmatter).toBe("");
    expect(result!.body).toContain("Body content");
  });
});

// --- updateFrontmatter ---

describe("updateFrontmatter", () => {
  const fields: FrontmatterField = {
    helpful_count: 5,
    harmful_count: 1,
    success_rate: 0.83,
    maturity: "proven",
    recall_count: 7,
  };

  it("updates existing fields", () => {
    const fm = `id: 42
key: test-entry
maturity: progenitor
helpful_count: 2
harmful_count: 0
success_rate: 0.67
recall_count: 4`;

    const updated = updateFrontmatter(fm, fields);
    expect(updated).toContain("helpful_count: 5");
    expect(updated).toContain("harmful_count: 1");
    expect(updated).toContain("success_rate: 0.83");
    expect(updated).toContain("maturity: proven");
    expect(updated).toContain("recall_count: 7");
  });

  it("adds missing fields at the end", () => {
    const fm = `id: 42
key: test-entry
maturity: progenitor`;

    const updated = updateFrontmatter(fm, fields);
    expect(updated).toContain("helpful_count: 5");
    expect(updated).toContain("harmful_count: 1");
    expect(updated).toContain("success_rate: 0.83");
    expect(updated).toContain("recall_count: 7");
  });

  it("preserves unrelated fields (id, key, domain, etc.)", () => {
    const fm = `id: 42
key: test-entry
domain:
  - memory-systems
maturity: progenitor
helpful_count: 2`;

    const updated = updateFrontmatter(fm, fields);
    expect(updated).toContain("id: 42");
    expect(updated).toContain("key: test-entry");
    expect(updated).toContain("domain:");
    expect(updated).toContain("  - memory-systems");
  });
});

// --- syncFrontmatter ---

describe("syncFrontmatter", () => {
  const vaultPath = "/vault/experiences";

  const makeCounters = (overrides: Partial<FrontmatterField> = {}): FrontmatterField => ({
    helpful_count: 3,
    harmful_count: 0,
    success_rate: 1.0,
    maturity: "proven",
    recall_count: 5,
    ...overrides,
  });

  const makeMarkdown = (id: number, key: string) => `---
id: ${id}
key: ${key}
maturity: progenitor
helpful_count: 1
harmful_count: 0
success_rate: 0.5
recall_count: 3
---

Entry content.`;

  it("updates vault files for affected entries", () => {
    const feedbackResults: FeedbackResult[] = [
      { entryId: 42, key: "test-entry", rating: "helpful", maturityBefore: "progenitor", maturityAfter: "proven", apoptosis: false },
    ];

    const readFile = vi.fn().mockReturnValue(makeMarkdown(42, "test-entry"));
    const writeFile = vi.fn();
    const getCounters = vi.fn().mockReturnValue(makeCounters());

    const result = syncFrontmatter(feedbackResults, vaultPath, readFile, writeFile, getCounters);

    expect(result.filesUpdated).toBe(1);
    expect(result.filesSkipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(readFile).toHaveBeenCalledWith(`${vaultPath}/42-test-entry.md`);
    expect(writeFile).toHaveBeenCalledTimes(1);

    const written = writeFile.mock.calls[0][1] as string;
    expect(written).toContain("helpful_count: 3");
    expect(written).toContain("maturity: proven");
  });

  it("skips entries whose vault file is missing", () => {
    const feedbackResults: FeedbackResult[] = [
      { entryId: 99, key: "missing-entry", rating: "helpful", maturityBefore: "progenitor", maturityAfter: "progenitor", apoptosis: false },
    ];

    const readFile = vi.fn().mockReturnValue(null);
    const writeFile = vi.fn();
    const getCounters = vi.fn().mockReturnValue(makeCounters());

    const result = syncFrontmatter(feedbackResults, vaultPath, readFile, writeFile, getCounters);

    expect(result.filesUpdated).toBe(0);
    expect(result.filesSkipped).toBe(1);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("handles empty feedback results", () => {
    const readFile = vi.fn();
    const writeFile = vi.fn();
    const getCounters = vi.fn();

    const result = syncFrontmatter([], vaultPath, readFile, writeFile, getCounters);

    expect(result.filesUpdated).toBe(0);
    expect(result.filesSkipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(readFile).not.toHaveBeenCalled();
  });

  it("deduplicates entries by ID (two FeedbackResults for same entryId → one file write)", () => {
    const feedbackResults: FeedbackResult[] = [
      { entryId: 42, key: "test-entry", rating: "helpful", maturityBefore: "progenitor", maturityAfter: "proven", apoptosis: false },
      { entryId: 42, key: "test-entry", rating: "helpful", maturityBefore: "proven", maturityAfter: "proven", apoptosis: false },
    ];

    const readFile = vi.fn().mockReturnValue(makeMarkdown(42, "test-entry"));
    const writeFile = vi.fn();
    const getCounters = vi.fn().mockReturnValue(makeCounters());

    const result = syncFrontmatter(feedbackResults, vaultPath, readFile, writeFile, getCounters);

    expect(result.filesUpdated).toBe(1);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it("skips entries when getCounters returns null", () => {
    const feedbackResults: FeedbackResult[] = [
      { entryId: 42, key: "test-entry", rating: "helpful", maturityBefore: "progenitor", maturityAfter: "proven", apoptosis: false },
    ];

    const readFile = vi.fn().mockReturnValue(makeMarkdown(42, "test-entry"));
    const writeFile = vi.fn();
    const getCounters = vi.fn().mockReturnValue(null);

    const result = syncFrontmatter(feedbackResults, vaultPath, readFile, writeFile, getCounters);

    expect(result.filesUpdated).toBe(0);
    expect(result.filesSkipped).toBe(1);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
