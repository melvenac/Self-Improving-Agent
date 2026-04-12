import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDb, OpenBrainDb } from "../src/db.js";

let db: OpenBrainDb;

beforeEach(() => {
  db = createDb(":memory:");
});

afterEach(() => {
  db.close();
});

// D1 — Schema
describe("schema", () => {
  it("sessions table exists", () => {
    const row = db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
    expect(row).toBeTruthy();
  });

  it("knowledge table exists", () => {
    const row = db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge'").get();
    expect(row).toBeTruthy();
  });

  it("chunks table exists", () => {
    const row = db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chunks'").get();
    expect(row).toBeTruthy();
  });

  it("summaries table exists", () => {
    const row = db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='summaries'").get();
    expect(row).toBeTruthy();
  });

  it("knowledge_fts virtual table exists", () => {
    const row = db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_fts'").get();
    expect(row).toBeTruthy();
  });

  it("WAL journal mode (file-backed db)", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const tmpFile = path.join(os.tmpdir(), `ob-test-${Date.now()}.db`);
    try {
      const fileDb = createDb(tmpFile);
      const row = fileDb.raw.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
      expect(row.journal_mode).toBe("wal");
      fileDb.close();
    } finally {
      for (const suffix of ["", "-wal", "-shm"]) {
        try { fs.unlinkSync(tmpFile + suffix); } catch { /* ignore */ }
      }
    }
  });

  it("foreign keys enabled", () => {
    const row = db.raw.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(row.foreign_keys).toBe(1);
  });
});

// D2 — ChunkStore
describe("ChunkStore", () => {
  const session = {
    id: "sess-001",
    db_file: "/path/to/db.sqlite",
    project_dir: "/project",
    started_at: "2026-01-01T00:00:00Z",
    ended_at: "2026-01-01T01:00:00Z",
    event_count: 5,
  };

  it("insertSession creates row", () => {
    db.insertSession(session);
    const row = db.raw.prepare("SELECT * FROM sessions WHERE id = ?").get(session.id) as { id: string } | undefined;
    expect(row?.id).toBe("sess-001");
  });

  it("insertChunk creates chunk linked to session", () => {
    db.insertSession(session);
    db.insertChunk({
      session_id: "sess-001",
      source: "test.md",
      category: "note",
      content: "Hello world",
      metadata: "{}",
      project_dir: "/project",
    });
    const row = db.raw.prepare("SELECT * FROM chunks WHERE session_id = ?").get("sess-001") as { content: string } | undefined;
    expect(row?.content).toBe("Hello world");
  });

  it("getIndexedSessionFiles returns db_file values", () => {
    db.insertSession(session);
    db.insertSession({ ...session, id: "sess-002", db_file: "/other/db.sqlite" });
    const files = db.getIndexedSessionFiles();
    expect(files).toContain("/path/to/db.sqlite");
    expect(files).toContain("/other/db.sqlite");
  });

  it("getIndexedSessionFiles is empty when no sessions", () => {
    const files = db.getIndexedSessionFiles();
    expect(files).toEqual([]);
  });
});

// D3 — KnowledgeStore
describe("KnowledgeStore", () => {
  it("insertKnowledge creates entry and returns id", () => {
    const id = db.insertKnowledge("Some knowledge content", { key: "my-key", tags: ["tag1", "tag2"] });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("getEntry returns full entry with correct fields", () => {
    const id = db.insertKnowledge("Test content", { key: "test-key", tags: ["a", "b"], source: "manual" });
    const entry = db.getEntry(id);
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe(id);
    expect(entry!.key).toBe("test-key");
    expect(entry!.content).toBe("Test content");
    expect(entry!.tags).toBe("a,b");
    expect(entry!.source).toBe("manual");
    expect(entry!.helpful_count).toBe(0);
    expect(entry!.harmful_count).toBe(0);
    expect(entry!.neutral_count).toBe(0);
    expect(entry!.maturity).toBe("progenitor");
    expect(entry!.recall_count).toBe(0);
    expect(entry!.created_at).toBeTruthy();
  });

  it("getEntry returns null for missing id", () => {
    const entry = db.getEntry(99999);
    expect(entry).toBeNull();
  });

  it("updateFeedback increments helpful", () => {
    const id = db.insertKnowledge("content");
    db.updateFeedback(id, "helpful");
    const entry = db.getEntry(id);
    expect(entry!.helpful_count).toBe(1);
    expect(entry!.harmful_count).toBe(0);
  });

  it("updateFeedback increments harmful", () => {
    const id = db.insertKnowledge("content");
    db.updateFeedback(id, "harmful");
    const entry = db.getEntry(id);
    expect(entry!.harmful_count).toBe(1);
    expect(entry!.helpful_count).toBe(0);
  });

  it("updateFeedback increments neutral and success_rate stays null", () => {
    const id = db.insertKnowledge("content");
    db.updateFeedback(id, "neutral");
    const entry = db.getEntry(id);
    expect(entry!.neutral_count).toBe(1);
    expect(entry!.success_rate).toBeNull();
  });

  it("updateFeedback calculates success_rate correctly", () => {
    const id = db.insertKnowledge("content");
    db.updateFeedback(id, "helpful");
    db.updateFeedback(id, "helpful");
    db.updateFeedback(id, "harmful");
    const entry = db.getEntry(id);
    // 2 helpful, 1 harmful → 2/3
    expect(entry!.helpful_count).toBe(2);
    expect(entry!.harmful_count).toBe(1);
    expect(entry!.success_rate).toBeCloseTo(2 / 3);
  });

  it("getEntryCounters returns null for missing id", () => {
    const counters = db.getEntryCounters(99999);
    expect(counters).toBeNull();
  });

  it("getEntryCounters returns counters for existing entry", () => {
    const id = db.insertKnowledge("content");
    db.updateFeedback(id, "helpful");
    const counters = db.getEntryCounters(id);
    expect(counters).not.toBeNull();
    expect(counters!.helpful_count).toBe(1);
    expect(counters!.harmful_count).toBe(0);
    expect(counters!.neutral_count).toBe(0);
    expect(counters!.recall_count).toBe(0);
    expect(counters!.maturity).toBe("progenitor");
  });
});

// D4 — Knowledge CRUD
describe("Knowledge CRUD", () => {
  it("listKnowledge returns all entries", () => {
    db.insertKnowledge("Entry one");
    db.insertKnowledge("Entry two");
    const entries = db.listKnowledge();
    expect(entries.length).toBe(2);
  });

  it("listKnowledge respects limit", () => {
    db.insertKnowledge("Entry one");
    db.insertKnowledge("Entry two");
    db.insertKnowledge("Entry three");
    const entries = db.listKnowledge(2);
    expect(entries.length).toBe(2);
  });

  it("deleteKnowledge removes entry and returns true", () => {
    const id = db.insertKnowledge("To be deleted");
    const result = db.deleteKnowledge(id);
    expect(result).toBe(true);
    const entries = db.listKnowledge();
    expect(entries.find((e) => e.id === id)).toBeUndefined();
  });

  it("deleteKnowledge returns false for missing id", () => {
    const result = db.deleteKnowledge(99999);
    expect(result).toBe(false);
  });

  it("deleted entry not returned by getEntry", () => {
    const id = db.insertKnowledge("Gone");
    db.deleteKnowledge(id);
    const entry = db.getEntry(id);
    expect(entry).toBeNull();
  });
});

// D4 — FTS5 Search
describe("FTS5 Search", () => {
  it("finds entry by content keyword", () => {
    db.insertKnowledge("The quick brown fox");
    const results = db.search("quick");
    expect(results.length).toBe(1);
    expect(results[0].content).toBe("The quick brown fox");
  });

  it("finds entry by tag", () => {
    db.insertKnowledge("Some content", { tags: ["typescript", "node"] });
    const results = db.search("typescript");
    expect(results.length).toBe(1);
  });

  it("finds entry by key", () => {
    db.insertKnowledge("Some content", { key: "my-special-key" });
    const results = db.search("special");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((e) => e.key === "my-special-key")).toBe(true);
  });

  it("returns empty for no match", () => {
    db.insertKnowledge("Hello world");
    const results = db.search("zzznomatch");
    expect(results).toEqual([]);
  });

  it("respects limit", () => {
    db.insertKnowledge("alpha beta gamma one");
    db.insertKnowledge("alpha beta gamma two");
    db.insertKnowledge("alpha beta gamma three");
    const results = db.search("alpha", { limit: 2 });
    expect(results.length).toBe(2);
  });

  it("filters by projectDir — excludes other project, includes global", () => {
    db.insertKnowledge("project A entry", { projectDir: "/project-a" });
    db.insertKnowledge("global entry");  // null project_dir
    const results = db.search("entry", { projectDir: "/project-b" });
    // project-a entry should NOT appear; global entry SHOULD appear
    expect(results.find((e) => e.content === "project A entry")).toBeUndefined();
    expect(results.find((e) => e.content === "global entry")).toBeDefined();
  });

  it("handles FTS5 syntax errors gracefully", () => {
    db.insertKnowledge("some content");
    // Unbalanced quote is an FTS5 syntax error
    const results = db.search('"unbalanced');
    expect(results).toEqual([]);
  });
});

// D4 — Summaries
describe("Summaries", () => {
  const session = {
    id: "sum-sess-001",
    db_file: "/path/to/db.sqlite",
    project_dir: "/project",
    started_at: "2026-01-01T00:00:00Z",
    ended_at: "2026-01-01T01:00:00Z",
    event_count: 3,
  };

  it("insertSummary stores summary", () => {
    db.insertSession(session);
    db.insertSummary(session.id, "This is a summary", "claude-3", "/project");
    const row = db.raw.prepare("SELECT * FROM summaries WHERE session_id = ?").get(session.id) as { summary: string; model: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.summary).toBe("This is a summary");
    expect(row!.model).toBe("claude-3");
  });

  it("getUnsummarizedSessionIds returns sessions without summaries", () => {
    db.insertSession(session);
    db.insertSession({ ...session, id: "sum-sess-002", db_file: "/other.sqlite" });
    db.insertSummary("sum-sess-001", "Summarized");
    const ids = db.getUnsummarizedSessionIds();
    expect(ids).toContain("sum-sess-002");
    expect(ids).not.toContain("sum-sess-001");
  });

  it("getUnsummarizedSessionIds returns empty when all summarized", () => {
    db.insertSession(session);
    db.insertSummary(session.id, "Done");
    const ids = db.getUnsummarizedSessionIds();
    expect(ids).toEqual([]);
  });
});
