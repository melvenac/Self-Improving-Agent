import { describe, it, expect } from "vitest";
import type { KnowledgeIndexRow } from "../../../src/db-v2.js";
import { findObsoleteReferences, RETIRED_REFERENCES } from "../../../src/pipelines/dream/rules.js";

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
    fact_kind: null,
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    ...over,
  };
}

describe("findObsoleteReferences", () => {
  it("flags an entry citing a retired path", () => {
    const found = findObsoleteReferences([
      entry({ id: 1, content: "Config lives in knowledge-mcp/scripts/session-start.mjs." }),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("obsolete-reference");
    expect(found[0].summary).toContain("knowledge-mcp");
    expect(found[0].summary).toContain("open-brain");
  });

  describe("mentions versus instructions", () => {
    // The first version matched bare names and flagged correct entries: notes
    // naming the vault as one of three stores, and one describing a historical
    // bug in which a build pointed at the old directory. Both cite retired
    // infrastructure deliberately.
    it("does not flag a retired name used descriptively", () => {
      const found = findObsoleteReferences([
        entry({ id: 1, content: "Three stores (CC Memory, Open Brain SQLite, Obsidian Vault) overlapped." }),
      ]);

      expect(found).toEqual([]);
    });

    it("does not flag a retired name recounting a past bug", () => {
      const found = findObsoleteReferences([
        entry({ id: 1, content: "build/db.js still pointed to the old path (knowledge-mcp)." }),
      ]);

      expect(found).toEqual([]);
    });

    it("ranks an entry narrating a retirement below one relying on it", () => {
      // Entries recording a removal cite the old path on purpose; rewriting
      // them would destroy the history they exist to preserve. Deterministic
      // rules cannot settle this, so it is ranked down, not filtered out.
      const [narrating] = findObsoleteReferences([
        entry({ id: 1, content: "Deleted knowledge-mcp/ directory and moved everything to open-brain." }),
      ]);
      const [relying] = findObsoleteReferences([
        entry({ id: 2, content: "The scan lives at ~/.claude/knowledge-mcp/scripts/skill-scan.mjs." }),
      ]);

      expect(narrating.confidence).toBeLessThan(relying.confidence);
      expect(narrating).toBeDefined(); // still surfaced for review
    });

    it("still flags the same name written as a path", () => {
      const found = findObsoleteReferences([
        entry({ id: 1, content: "Notes are archived to ~/Obsidian Vault/Experiences." }),
      ]);

      expect(found).toHaveLength(1);
    });

    it("flags a Windows-style absolute path to the old vault", () => {
      const found = findObsoleteReferences([
        entry({ id: 1, content: "Path: C:\\Users\\melve\\Obsidian Vault\\Summaries" }),
      ]);

      expect(found).toHaveLength(1);
    });
  });

  it("names the replacement, since the fix is a rewrite not a deletion", () => {
    const found = findObsoleteReferences([
      entry({ id: 1, content: "Helpers live in vault-utils.mjs." }),
    ]);

    expect(found[0].summary).toContain("v0.5.3");
  });

  it("quotes the sentence the reference sits in", () => {
    const found = findObsoleteReferences([
      entry({
        id: 1,
        content: "First an unrelated sentence. The path is ~/Obsidian Vault/Experiences. And a third.",
      }),
    ]);

    expect(found[0].evidence[0].quote).toContain("The path is");
    expect(found[0].evidence[0].quote).not.toContain("a third");
  });

  it("does not flag the current v2 vault path", () => {
    const found = findObsoleteReferences([
      entry({ id: 1, content: "Notes are written to ~/Obsidian Vault v2/Experiences." }),
    ]);

    expect(found).toEqual([]);
  });

  it("reports every retired reference an entry contains, not just the first", () => {
    const found = findObsoleteReferences([
      entry({ id: 1, content: "knowledge-mcp/scripts wrote to vault-utils.mjs helpers." }),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0].evidence.length).toBeGreaterThanOrEqual(2);
  });

  it("leaves current entries alone", () => {
    const found = findObsoleteReferences([
      entry({ id: 1, content: "Use ob_recall against knowledge-v2.db via the open-brain server." }),
    ]);

    expect(found).toEqual([]);
  });

  it("ignores entries already archived into another", () => {
    const found = findObsoleteReferences([
      entry({ id: 1, content: "knowledge-mcp/scripts is the old path", archived_into: 5 }),
    ]);

    expect(found).toEqual([]);
  });

  it("accepts a caller-supplied retirement list", () => {
    const found = findObsoleteReferences(
      [entry({ id: 1, content: "We still call widget-service directly." })],
      { retired: [{ label: "widget-service", pattern: /widget-service/, replacement: "widget-api" }] },
    );

    expect(found).toHaveLength(1);
    expect(found[0].summary).toContain("widget-api");
  });

  it("ships a non-empty default retirement list", () => {
    expect(RETIRED_REFERENCES.length).toBeGreaterThan(0);
    for (const r of RETIRED_REFERENCES) {
      expect(r.label).toBeTruthy();
      expect(r.replacement).toBeTruthy();
    }
  });
});
