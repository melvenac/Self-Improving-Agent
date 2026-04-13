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

export interface KnowledgeIndexInput {
  vaultPath: string;
  key: string;
  tags: string;
  content: string;
  maturity?: string;
  helpful?: number;
  harmful?: number;
  neutral?: number;
}

export interface KnowledgeIndexRow {
  id: number;
  vault_path: string;
  key: string;
  tags: string;
  maturity: string;
  helpful: number;
  harmful: number;
  neutral: number;
  recall_count: number;
  last_recalled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FtsResult {
  key: string;
  vault_path: string;
  rank: number;
}

export interface ClusterCandidate {
  tag: string;
  count: number;
}

export function indexKnowledge(db: Database.Database, input: KnowledgeIndexInput): void {
  const now = new Date().toISOString();
  const maturity = input.maturity ?? 'progenitor';
  const helpful = input.helpful ?? 0;
  const harmful = input.harmful ?? 0;
  const neutral = input.neutral ?? 0;

  const result = db.prepare(`
    INSERT OR REPLACE INTO knowledge_index
      (vault_path, key, tags, maturity, helpful, harmful, neutral, recall_count, last_recalled_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
  `).run(input.vaultPath, input.key, input.tags, maturity, helpful, harmful, neutral, now, now);

  const rowId = result.lastInsertRowid as number;

  // Upsert into FTS using knowledge_index rowid so JOIN works reliably
  db.prepare(`INSERT OR REPLACE INTO knowledge_fts (rowid, key, content, tags) VALUES (?, ?, ?, ?)`).run(
    rowId,
    input.key,
    input.content,
    input.tags
  );
}

export function searchFts(db: Database.Database, query: string): FtsResult[] {
  // knowledge_fts is contentless — column values are null on SELECT.
  // Use rowid stored in knowledge_fts_data shadow table via the rowid column,
  // which maps to knowledge_index.id (inserted in the same order).
  // We store key in position 0; retrieve via rowid JOIN to knowledge_index.
  const rows = db.prepare(`
    SELECT ki.key, ki.vault_path, f.rank
    FROM knowledge_fts f
    JOIN knowledge_index ki ON ki.id = f.rowid
    WHERE knowledge_fts MATCH ?
    ORDER BY f.rank
  `).all(query) as FtsResult[];
  return rows;
}

export function getMetadata(db: Database.Database, vaultPath: string): KnowledgeIndexRow | undefined {
  return db.prepare(`SELECT * FROM knowledge_index WHERE vault_path = ?`).get(vaultPath) as KnowledgeIndexRow | undefined;
}

export function recordRecall(db: Database.Database, vaultPath: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE knowledge_index
    SET recall_count = recall_count + 1, last_recalled_at = ?, updated_at = ?
    WHERE vault_path = ?
  `).run(now, now, vaultPath);
}

export function updateFeedbackV2(db: Database.Database, vaultPath: string, rating: 'helpful' | 'harmful' | 'neutral'): void {
  const now = new Date().toISOString();
  const col = rating === 'helpful' ? 'helpful' : rating === 'harmful' ? 'harmful' : 'neutral';
  db.prepare(`
    UPDATE knowledge_index
    SET ${col} = ${col} + 1, updated_at = ?
    WHERE vault_path = ?
  `).run(now, vaultPath);
}

export function getClusterCandidates(db: Database.Database): ClusterCandidate[] {
  const rows = db.prepare(`SELECT tags FROM knowledge_index WHERE tags IS NOT NULL AND tags != ''`).all() as { tags: string }[];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const tags = row.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 3)
    .map(([tag, count]) => ({ tag, count }));
}
