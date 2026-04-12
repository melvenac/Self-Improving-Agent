import Database from "better-sqlite3";
import type {
  ChunkStore,
  ChunkRow,
  KnowledgeStore,
  KnowledgeEntry,
  FeedbackRating,
  SessionRow,
} from "./pipelines/session-end/types.js";

export interface OpenBrainDb extends ChunkStore, KnowledgeStore {
  raw: Database.Database;
  close(): void;
  insertKnowledge(
    content: string,
    options?: {
      key?: string;
      tags?: string[];
      source?: string;
      projectDir?: string;
      sessionId?: string;
    }
  ): number;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  db_file TEXT NOT NULL,
  project_dir TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  event_count INTEGER DEFAULT 0,
  indexed_at TEXT,
  ttl_days INTEGER DEFAULT 90
);

CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT,
  content TEXT NOT NULL,
  tags TEXT,
  source TEXT DEFAULT 'manual',
  permanent INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  project_dir TEXT,
  created_by_session TEXT,
  updated_by_session TEXT,
  recall_count INTEGER DEFAULT 0,
  last_recalled TEXT,
  helpful_count INTEGER DEFAULT 0,
  harmful_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT NULL,
  maturity TEXT DEFAULT 'progenitor',
  reference_count INTEGER DEFAULT 0,
  archived_into INTEGER DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  project_dir TEXT
);

CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL,
  project_dir TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  key, content, tags,
  content=knowledge, content_rowid=id,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge BEGIN
  INSERT INTO knowledge_fts(rowid, key, content, tags) VALUES (new.id, new.key, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, key, content, tags) VALUES ('delete', old.id, old.key, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, key, content, tags) VALUES ('delete', old.id, old.key, old.content, old.tags);
  INSERT INTO knowledge_fts(rowid, key, content, tags) VALUES (new.id, new.key, new.content, new.tags);
END;
`;

export function createDb(dbPath: string): OpenBrainDb {
  const raw = new Database(dbPath);

  // Pragmas must run before DDL
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");

  // exec() handles multi-statement SQL including triggers
  raw.exec(SCHEMA.replace(/PRAGMA[^;]+;/g, ""));

  const insertSessionStmt = raw.prepare(`
    INSERT OR IGNORE INTO sessions (id, db_file, project_dir, started_at, ended_at, event_count, indexed_at)
    VALUES (@id, @db_file, @project_dir, @started_at, @ended_at, @event_count, @indexed_at)
  `);

  const insertChunkStmt = raw.prepare(`
    INSERT INTO chunks (session_id, source, category, content, metadata, created_at, indexed_at, project_dir)
    VALUES (@session_id, @source, @category, @content, @metadata, @created_at, @indexed_at, @project_dir)
  `);

  const getIndexedSessionFilesStmt = raw.prepare(
    "SELECT db_file FROM sessions"
  );

  const insertKnowledgeStmt = raw.prepare(`
    INSERT INTO knowledge (key, content, tags, source, created_at, updated_at, project_dir, created_by_session, updated_by_session)
    VALUES (@key, @content, @tags, @source, @created_at, @updated_at, @project_dir, @session_id, @session_id)
  `);

  const getEntryStmt = raw.prepare(
    "SELECT * FROM knowledge WHERE id = ?"
  );

  const getEntryCountersStmt = raw.prepare(
    "SELECT helpful_count, harmful_count, neutral_count, success_rate, maturity, recall_count FROM knowledge WHERE id = ?"
  );

  const updateHelpfulStmt = raw.prepare(`
    UPDATE knowledge
    SET helpful_count = helpful_count + 1,
        success_rate = CAST(helpful_count + 1 AS REAL) / (helpful_count + 1 + harmful_count)
    WHERE id = ?
  `);

  const updateHarmfulStmt = raw.prepare(`
    UPDATE knowledge
    SET harmful_count = harmful_count + 1,
        success_rate = CAST(helpful_count AS REAL) / (helpful_count + harmful_count + 1)
    WHERE id = ?
  `);

  const updateNeutralStmt = raw.prepare(`
    UPDATE knowledge
    SET neutral_count = neutral_count + 1
    WHERE id = ?
  `);

  function now(): string {
    return new Date().toISOString();
  }

  return {
    raw,

    close() {
      raw.close();
    },

    insertSession(session: SessionRow): void {
      insertSessionStmt.run({
        ...session,
        indexed_at: now(),
      });
    },

    insertChunk(chunk: ChunkRow): void {
      const ts = now();
      insertChunkStmt.run({
        ...chunk,
        created_at: ts,
        indexed_at: ts,
      });
    },

    getIndexedSessionFiles(): string[] {
      const rows = getIndexedSessionFilesStmt.all() as { db_file: string }[];
      return rows.map((r) => r.db_file);
    },

    insertKnowledge(
      content: string,
      options?: {
        key?: string;
        tags?: string[];
        source?: string;
        projectDir?: string;
        sessionId?: string;
      }
    ): number {
      const ts = now();
      const result = insertKnowledgeStmt.run({
        key: options?.key ?? null,
        content,
        tags: options?.tags?.join(",") ?? null,
        source: options?.source ?? "manual",
        created_at: ts,
        updated_at: ts,
        project_dir: options?.projectDir ?? null,
        session_id: options?.sessionId ?? null,
      });
      return Number(result.lastInsertRowid);
    },

    getEntry(id: number): KnowledgeEntry | null {
      const row = getEntryStmt.get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: row.id as number,
        key: row.key as string,
        content: row.content as string,
        tags: row.tags as string,
        helpful_count: row.helpful_count as number,
        harmful_count: row.harmful_count as number,
        neutral_count: row.neutral_count as number,
        success_rate: row.success_rate as number,
        maturity: row.maturity as string,
        recall_count: row.recall_count as number,
        source: row.source as string,
        created_at: row.created_at as string,
      };
    },

    updateFeedback(id: number, rating: FeedbackRating): void {
      if (rating === "helpful") {
        updateHelpfulStmt.run(id);
      } else if (rating === "harmful") {
        updateHarmfulStmt.run(id);
      } else {
        updateNeutralStmt.run(id);
      }
    },

    getEntryCounters(id: number) {
      const row = getEntryCountersStmt.get(id) as
        | {
            helpful_count: number;
            harmful_count: number;
            neutral_count: number;
            success_rate: number;
            maturity: string;
            recall_count: number;
          }
        | undefined;
      return row ?? null;
    },
  };
}
