import Database from 'better-sqlite3';

export function initSchemaV2(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      project_dir TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      event_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id),
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_path TEXT NOT NULL UNIQUE,
      key TEXT NOT NULL UNIQUE,
      tags TEXT DEFAULT '',
      maturity TEXT DEFAULT 'progenitor' CHECK(maturity IN ('progenitor', 'proven', 'mature')),
      helpful INTEGER DEFAULT 0,
      harmful INTEGER DEFAULT 0,
      neutral INTEGER DEFAULT 0,
      recall_count INTEGER DEFAULT 0,
      last_recalled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reflection_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_tag TEXT NOT NULL,
      source_ids TEXT NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('approved', 'rejected', 'pending')),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_session ON chunks(session_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_category ON chunks(category);
    CREATE INDEX IF NOT EXISTS idx_knowledge_index_maturity ON knowledge_index(maturity);
    CREATE INDEX IF NOT EXISTS idx_knowledge_index_key ON knowledge_index(key);

    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      key, content, tags, content='', contentless_delete=1
    );
  `);
}

export function openV2Database(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchemaV2(db);
  return db;
}
