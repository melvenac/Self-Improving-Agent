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
