import Database from "better-sqlite3";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const KB_DIR = join(homedir(), ".claude", "context-mode");
const KB_PATH = join(KB_DIR, "knowledge.db");

let _db: Database.Database | null = null;

export function getKnowledgeDb(): Database.Database {
  if (_db) return _db;

  if (!existsSync(KB_DIR)) {
    mkdirSync(KB_DIR, { recursive: true });
  }

  _db = new Database(KB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  initSchema(_db);
  runMigrations(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      db_file       TEXT NOT NULL,
      project_dir   TEXT,
      started_at    TEXT NOT NULL,
      ended_at      TEXT,
      event_count   INTEGER DEFAULT 0,
      indexed_at    TEXT,
      ttl_days      INTEGER DEFAULT 90
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      source        TEXT NOT NULL,
      category      TEXT NOT NULL,
      content       TEXT NOT NULL,
      metadata      TEXT,
      created_at    TEXT NOT NULL,
      indexed_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_session ON chunks(session_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_category ON chunks(category);

    CREATE TABLE IF NOT EXISTS tags (
      chunk_id      INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
      tag           TEXT NOT NULL,
      PRIMARY KEY (chunk_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
  `);

  // Create FTS5 table if it doesn't exist
  const ftsExists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='chunks_fts'"
    )
    .get();

  if (!ftsExists) {
    db.exec(`
      CREATE VIRTUAL TABLE chunks_fts USING fts5(
        source,
        category,
        content,
        content=chunks,
        content_rowid=id,
        tokenize='porter unicode61'
      );

      CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, source, category, content)
        VALUES (new.id, new.source, new.category, new.content);
      END;

      CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, source, category, content)
        VALUES ('delete', old.id, old.source, old.category, old.content);
      END;
    `);
  }

  // --- Knowledge table (manual knowledge storage) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key         TEXT,
      content     TEXT NOT NULL,
      tags        TEXT,
      source      TEXT DEFAULT 'manual',
      permanent   INTEGER DEFAULT 1,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_key ON knowledge(key);
  `);

  const knowledgeFtsExists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_fts'"
    )
    .get();

  if (!knowledgeFtsExists) {
    db.exec(`
      CREATE VIRTUAL TABLE knowledge_fts USING fts5(
        key,
        content,
        tags,
        content=knowledge,
        content_rowid=id,
        tokenize='porter unicode61'
      );

      CREATE TRIGGER knowledge_ai AFTER INSERT ON knowledge BEGIN
        INSERT INTO knowledge_fts(rowid, key, content, tags)
        VALUES (new.id, new.key, new.content, new.tags);
      END;

      CREATE TRIGGER knowledge_ad AFTER DELETE ON knowledge BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, key, content, tags)
        VALUES ('delete', old.id, old.key, old.content, old.tags);
      END;

      CREATE TRIGGER knowledge_au AFTER UPDATE ON knowledge BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, key, content, tags)
        VALUES ('delete', old.id, old.key, old.content, old.tags);
        INSERT INTO knowledge_fts(rowid, key, content, tags)
        VALUES (new.id, new.key, new.content, new.tags);
      END;
    `);
  }

  // --- Summaries table (cross-session AI summaries) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS summaries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      summary     TEXT NOT NULL,
      model       TEXT,
      created_at  TEXT NOT NULL,
      UNIQUE(session_id)
    );
  `);

  const summariesFtsExists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='summaries_fts'"
    )
    .get();

  if (!summariesFtsExists) {
    db.exec(`
      CREATE VIRTUAL TABLE summaries_fts USING fts5(
        summary,
        content=summaries,
        content_rowid=id,
        tokenize='porter unicode61'
      );

      CREATE TRIGGER summaries_ai AFTER INSERT ON summaries BEGIN
        INSERT INTO summaries_fts(rowid, summary)
        VALUES (new.id, new.summary);
      END;

      CREATE TRIGGER summaries_ad AFTER DELETE ON summaries BEGIN
        INSERT INTO summaries_fts(summaries_fts, rowid, summary)
        VALUES ('delete', old.id, old.summary);
      END;
    `);
  }
}

function runMigrations(db: Database.Database): void {
  // Migration: add event_count_at_index column to sessions
  try {
    db.exec("ALTER TABLE sessions ADD COLUMN event_count_at_index INTEGER");
  } catch {
    // Column already exists — ignore
  }

  // Migration: add project_dir column to knowledge for project-scoped storage
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN project_dir TEXT");
  } catch {
    // Column already exists — ignore
  }

  // Migration: add recall tracking to knowledge
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN recall_count INTEGER DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN last_recalled TEXT");
  } catch {
    // Column already exists — ignore
  }

  // Migration: add outcome tracking columns to knowledge
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN helpful_count INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN harmful_count INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN neutral_count INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN success_rate REAL DEFAULT NULL");
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec("ALTER TABLE knowledge ADD COLUMN maturity TEXT NOT NULL DEFAULT 'progenitor'");
  } catch {
    // Column already exists — ignore
  }
}

// Session-scoped set of knowledge IDs recalled this session.
// Reset when MCP server restarts (acceptable — feedback is best-effort).
const _recalledKnowledgeIds = new Set<number>();

export function getRecalledKnowledgeIds(): number[] {
  return [..._recalledKnowledgeIds];
}

export function clearRecalledKnowledgeIds(): void {
  _recalledKnowledgeIds.clear();
}

// ============================================================
// Recall (search)
// ============================================================

export interface RecallResult {
  source: string;
  category: string;
  snippet: string;
  content: string;
  session_started: string;
  project_dir: string | null;
  created_at: string;
  tags: string[];
  result_type: "chunk" | "knowledge" | "summary";
  weighted_rank: number;
}

function normalizePath(p: string | null | undefined): string | null {
  return p ? p.replace(/\\/g, "/") : null;
}

function sanitizeFtsQuery(query: string): string {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word.replace(/"/g, '""')}"`)
    .join(" ");
}

export function recall(
  query: string,
  options?: {
    sessions?: number;
    since?: string;
    category?: string;
    project?: string;
    tags?: string[];
    limit?: number;
    verbose?: boolean;
    global?: boolean;
  }
): RecallResult[] {
  const db = getKnowledgeDb();
  const limit = options?.limit ?? 5;
  const safeQuery = sanitizeFtsQuery(query);
  if (options?.project) options.project = normalizePath(options.project)!;
  const results: RecallResult[] = [];

  // --- Search chunks ---
  {
    let sql = `
      SELECT
        c.id as chunk_id,
        c.source,
        c.category,
        snippet(chunks_fts, 2, '>>', '<<', '...', 128) as snippet,
        c.content,
        s.started_at as session_started,
        s.project_dir,
        c.created_at,
        (bm25(chunks_fts) * (1.0 + MAX(0, julianday('now') - julianday(c.created_at)) * 0.02)) as weighted_rank
      FROM chunks_fts
      JOIN chunks c ON c.id = chunks_fts.rowid
      JOIN sessions s ON s.id = c.session_id
      WHERE chunks_fts MATCH ?
    `;

    const params: unknown[] = [safeQuery];

    if (options?.since) {
      sql += ` AND s.started_at > datetime('now', ?)`;
      params.push(`-${options.since}`);
    }

    if (options?.category) {
      sql += ` AND c.category = ?`;
      params.push(options.category);
    }

    if (options?.project) {
      sql += ` AND s.project_dir LIKE ?`;
      params.push(`%${options.project}%`);
    }

    if (options?.tags && options.tags.length > 0) {
      const placeholders = options.tags.map(() => "?").join(", ");
      sql += ` AND c.id IN (SELECT chunk_id FROM tags WHERE tag IN (${placeholders}))`;
      params.push(...options.tags);
    }

    sql += ` ORDER BY weighted_rank LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as Array<{
      chunk_id: number;
      source: string;
      category: string;
      snippet: string;
      content: string;
      session_started: string;
      project_dir: string | null;
      created_at: string;
      weighted_rank: number;
    }>;

    // Fetch tags for each result
    const tagStmt = db.prepare(
      "SELECT tag FROM tags WHERE chunk_id = ?"
    );

    for (const row of rows) {
      const chunkTags = (
        tagStmt.all(row.chunk_id) as Array<{ tag: string }>
      ).map((t) => t.tag);

      results.push({
        source: row.source,
        category: row.category,
        snippet: row.snippet,
        content: row.content,
        session_started: row.session_started,
        project_dir: row.project_dir,
        created_at: row.created_at,
        tags: chunkTags,
        result_type: "chunk",
        weighted_rank: row.weighted_rank,
      });
    }
  }

  // --- Search knowledge ---
  // Knowledge with project_dir IS NULL is global (always returned).
  // Knowledge with a project_dir is only returned when searching that project or globally.
  {
    // Knowledge entries use slower decay (0.005 vs 0.02) — curated content ages better than raw session chunks
    let knowledgeSql = `
      SELECT
        k.id,
        k.key,
        k.content,
        k.tags,
        k.source,
        k.project_dir,
        snippet(knowledge_fts, 1, '>>', '<<', '...', 128) as snippet,
        k.created_at,
        (bm25(knowledge_fts) * (1.0 + MAX(0, julianday('now') - julianday(k.created_at)) * 0.005)) as weighted_rank
      FROM knowledge_fts
      JOIN knowledge k ON k.id = knowledge_fts.rowid
      WHERE knowledge_fts MATCH ?
    `;
    const kParams: unknown[] = [safeQuery];

    // When project-scoped, return global knowledge + knowledge for this project
    if (!options?.global && options?.project) {
      knowledgeSql += ` AND (k.project_dir IS NULL OR k.project_dir LIKE ?)`;
      kParams.push(`%${options.project}%`);
    }

    knowledgeSql += ` ORDER BY weighted_rank LIMIT ?`;
    kParams.push(limit);

    try {
      const kRows = db.prepare(knowledgeSql).all(...kParams) as Array<{
        id: number;
        key: string | null;
        content: string;
        tags: string | null;
        source: string;
        project_dir: string | null;
        snippet: string;
        created_at: string;
        weighted_rank: number;
      }>;

      for (const row of kRows) {
        results.push({
          source: row.key || row.source || "stored knowledge",
          category: "knowledge",
          snippet: row.snippet,
          content: row.content,
          session_started: row.created_at,
          project_dir: row.project_dir,
          created_at: row.created_at,
          tags: row.tags ? row.tags.split(",").map((t) => t.trim()) : [],
          result_type: "knowledge",
          weighted_rank: row.weighted_rank,
        });
      }
      // Track recall hits for knowledge entries
      if (kRows.length > 0) {
        const updateRecall = db.prepare(
          "UPDATE knowledge SET recall_count = COALESCE(recall_count, 0) + 1, last_recalled = datetime('now') WHERE id = ?"
        );
        for (const row of kRows) {
          updateRecall.run(row.id);
          _recalledKnowledgeIds.add(row.id);
        }
      }
    } catch {
      // knowledge_fts may not have data yet — ignore
    }
  }

  // --- Search summaries ---
  {
    try {
      const sumRows = db
        .prepare(
          `
          SELECT
            sm.summary,
            snippet(summaries_fts, 0, '>>', '<<', '...', 128) as snippet,
            s.started_at as session_started,
            s.project_dir,
            sm.created_at,
            sm.model,
            (bm25(summaries_fts) * (1.0 + MAX(0, julianday('now') - julianday(sm.created_at)) * 0.02)) as weighted_rank
          FROM summaries_fts
          JOIN summaries sm ON sm.id = summaries_fts.rowid
          JOIN sessions s ON s.id = sm.session_id
          WHERE summaries_fts MATCH ?
          ORDER BY weighted_rank
          LIMIT ?
        `
        )
        .all(safeQuery, limit) as Array<{
        summary: string;
        snippet: string;
        session_started: string;
        project_dir: string | null;
        created_at: string;
        model: string | null;
        weighted_rank: number;
      }>;

      for (const row of sumRows) {
        results.push({
          source: "session summary",
          category: "summary",
          snippet: row.snippet,
          content: row.summary,
          session_started: row.session_started,
          project_dir: row.project_dir,
          created_at: row.created_at,
          tags: [],
          result_type: "summary",
          weighted_rank: row.weighted_rank,
        });
      }
    } catch {
      // summaries_fts may not have data yet — ignore
    }
  }

  // Sort all results by weighted rank (more negative = better match)
  results.sort((a, b) => a.weighted_rank - b.weighted_rank);

  return results.slice(0, limit);
}

// ============================================================
// Stats
// ============================================================

export interface KbStats {
  total_sessions: number;
  total_chunks: number;
  total_tags: number;
  total_knowledge: number;
  total_summaries: number;
  oldest_session: string | null;
  newest_session: string | null;
  db_size_bytes: number;
  sessions_by_project: Array<{ project_dir: string; count: number }>;
  chunks_by_category: Array<{ category: string; count: number }>;
  top_tags: Array<{ tag: string; count: number }>;
}

export function getStats(): KbStats {
  const db = getKnowledgeDb();

  const sessions = db
    .prepare("SELECT COUNT(*) as c FROM sessions")
    .get() as { c: number };
  const chunks = db
    .prepare("SELECT COUNT(*) as c FROM chunks")
    .get() as { c: number };
  const tags = db
    .prepare("SELECT COUNT(DISTINCT tag) as c FROM tags")
    .get() as { c: number };
  const knowledge = db
    .prepare("SELECT COUNT(*) as c FROM knowledge")
    .get() as { c: number };
  const summaries = db
    .prepare("SELECT COUNT(*) as c FROM summaries")
    .get() as { c: number };

  const oldest = db
    .prepare("SELECT MIN(started_at) as d FROM sessions")
    .get() as { d: string | null };
  const newest = db
    .prepare("SELECT MAX(started_at) as d FROM sessions")
    .get() as { d: string | null };

  const byProject = db
    .prepare(
      "SELECT COALESCE(project_dir, 'unknown') as project_dir, COUNT(*) as count FROM sessions GROUP BY project_dir ORDER BY count DESC"
    )
    .all() as Array<{ project_dir: string; count: number }>;

  const byCategory = db
    .prepare(
      "SELECT category, COUNT(*) as count FROM chunks GROUP BY category ORDER BY count DESC"
    )
    .all() as Array<{ category: string; count: number }>;

  const topTags = db
    .prepare(
      "SELECT tag, COUNT(*) as count FROM tags GROUP BY tag ORDER BY count DESC LIMIT 20"
    )
    .all() as Array<{ tag: string; count: number }>;

  let dbSize = 0;
  try {
    dbSize = statSync(KB_PATH).size;
  } catch {
    /* ignore */
  }

  return {
    total_sessions: sessions.c,
    total_chunks: chunks.c,
    total_tags: tags.c,
    total_knowledge: knowledge.c,
    total_summaries: summaries.c,
    oldest_session: oldest.d,
    newest_session: newest.d,
    db_size_bytes: dbSize,
    sessions_by_project: byProject,
    chunks_by_category: byCategory,
    top_tags: topTags,
  };
}

// ============================================================
// Sessions
// ============================================================

export function getSessionsDir(): string {
  return join(KB_DIR, "sessions");
}

export function getIndexedSessionIds(): Set<string> {
  const db = getKnowledgeDb();
  const rows = db
    .prepare("SELECT id FROM sessions")
    .all() as Array<{ id: string }>;
  return new Set(rows.map((r) => r.id));
}

export function getSession(id: string): {
  id: string;
  event_count: number;
  event_count_at_index: number | null;
} | undefined {
  const db = getKnowledgeDb();
  return db
    .prepare("SELECT id, event_count, event_count_at_index FROM sessions WHERE id = ?")
    .get(id) as { id: string; event_count: number; event_count_at_index: number | null } | undefined;
}

export function insertSession(
  id: string,
  dbFile: string,
  projectDir: string | null,
  startedAt: string,
  endedAt: string | null,
  eventCount: number
): void {
  const db = getKnowledgeDb();
  db.prepare(
    `INSERT OR IGNORE INTO sessions (id, db_file, project_dir, started_at, ended_at, event_count, indexed_at, event_count_at_index)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
  ).run(id, dbFile, normalizePath(projectDir), startedAt, endedAt, eventCount, eventCount);
}

export function updateSessionEventCount(
  id: string,
  eventCount: number
): void {
  const db = getKnowledgeDb();
  db.prepare(
    `UPDATE sessions SET event_count = ?, event_count_at_index = ?, indexed_at = datetime('now') WHERE id = ?`
  ).run(eventCount, eventCount, id);
}

export function deleteChunksForSession(sessionId: string): void {
  const db = getKnowledgeDb();
  db.prepare("DELETE FROM chunks WHERE session_id = ?").run(sessionId);
}

export function deleteSummaryForSession(sessionId: string): void {
  const db = getKnowledgeDb();
  db.prepare("DELETE FROM summaries WHERE session_id = ?").run(sessionId);
}

// ============================================================
// Chunks & Tags
// ============================================================

export function insertChunk(
  sessionId: string,
  source: string,
  category: string,
  content: string,
  metadata: string | null,
  createdAt: string
): number {
  const db = getKnowledgeDb();
  const result = db
    .prepare(
      `INSERT INTO chunks (session_id, source, category, content, metadata, created_at, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(sessionId, source, category, content, metadata, createdAt);
  return Number(result.lastInsertRowid);
}

export function insertTags(chunkId: number, tags: string[]): void {
  const db = getKnowledgeDb();
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO tags (chunk_id, tag) VALUES (?, ?)"
  );
  for (const tag of tags) {
    stmt.run(chunkId, tag.toLowerCase());
  }
}

// ============================================================
// Knowledge (manual storage)
// ============================================================

export function insertKnowledge(
  content: string,
  key?: string,
  tags?: string[],
  source?: string,
  projectDir?: string
): number {
  const db = getKnowledgeDb();
  const now = new Date().toISOString();
  const tagsStr = tags ? tags.join(", ") : null;
  const result = db
    .prepare(
      `INSERT INTO knowledge (key, content, tags, source, permanent, created_at, updated_at, project_dir)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
    )
    .run(key || null, content, tagsStr, source || "manual", now, now, normalizePath(projectDir));
  return Number(result.lastInsertRowid);
}

export function deleteKnowledge(options: {
  id?: number;
  key?: string;
}): number {
  const db = getKnowledgeDb();
  if (options.id) {
    return db.prepare("DELETE FROM knowledge WHERE id = ?").run(options.id)
      .changes;
  }
  if (options.key) {
    return db.prepare("DELETE FROM knowledge WHERE key = ?").run(options.key)
      .changes;
  }
  return 0;
}

export function getKnowledgeById(id: number): {
  id: number;
  key: string | null;
  content: string;
  tags: string | null;
  source: string;
  helpful_count: number;
  harmful_count: number;
  neutral_count: number;
  success_rate: number | null;
  maturity: string;
} | undefined {
  const db = getKnowledgeDb();
  return db
    .prepare(
      "SELECT id, key, content, tags, source, helpful_count, harmful_count, neutral_count, success_rate, maturity FROM knowledge WHERE id = ?"
    )
    .get(id) as {
    id: number;
    key: string | null;
    content: string;
    tags: string | null;
    source: string;
    helpful_count: number;
    harmful_count: number;
    neutral_count: number;
    success_rate: number | null;
    maturity: string;
  } | undefined;
}

export function recordFeedback(
  id: number,
  rating: "helpful" | "harmful" | "neutral",
  newSuccessRate: number | null,
  newMaturity: string,
): void {
  const db = getKnowledgeDb();
  const col =
    rating === "helpful" ? "helpful_count"
    : rating === "harmful" ? "harmful_count"
    : "neutral_count";

  db.prepare(
    `UPDATE knowledge
     SET ${col} = ${col} + 1,
         success_rate = ?,
         maturity = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(newSuccessRate, newMaturity, id);
}

export function deleteKnowledgeById(id: number): boolean {
  const db = getKnowledgeDb();
  const result = db.prepare("DELETE FROM knowledge WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listKnowledge(limit: number = 20, project?: string): Array<{
  id: number;
  key: string | null;
  content: string;
  tags: string | null;
  source: string;
  project_dir: string | null;
  created_at: string;
}> {
  const db = getKnowledgeDb();

  if (project) {
    return db
      .prepare(
        "SELECT id, key, content, tags, source, project_dir, created_at FROM knowledge WHERE project_dir IS NULL OR project_dir LIKE ? ORDER BY created_at DESC LIMIT ?"
      )
      .all(`%${project}%`, limit) as Array<{
      id: number;
      key: string | null;
      content: string;
      tags: string | null;
      source: string;
      project_dir: string | null;
      created_at: string;
    }>;
  }

  return db
    .prepare(
      "SELECT id, key, content, tags, source, project_dir, created_at FROM knowledge ORDER BY created_at DESC LIMIT ?"
    )
    .all(limit) as Array<{
    id: number;
    key: string | null;
    content: string;
    tags: string | null;
    source: string;
    project_dir: string | null;
    created_at: string;
  }>;
}

// ============================================================
// Summaries
// ============================================================

export function insertSummary(
  sessionId: string,
  summary: string,
  model: string
): void {
  const db = getKnowledgeDb();
  // Ensure session exists to satisfy FOREIGN KEY constraint.
  // When called from /end, the session may not have been indexed yet.
  const exists = db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(sessionId);
  if (!exists) {
    db.prepare(
      `INSERT OR IGNORE INTO sessions (id, db_file, project_dir, started_at, ended_at, event_count, indexed_at, event_count_at_index)
       VALUES (?, '', NULL, datetime('now'), NULL, 0, datetime('now'), 0)`
    ).run(sessionId);
  }
  db.prepare(
    `INSERT OR REPLACE INTO summaries (session_id, summary, model, created_at)
     VALUES (?, ?, ?, datetime('now'))`
  ).run(sessionId, summary, model);
}

export function getUnsummarizedSessionIds(): string[] {
  const db = getKnowledgeDb();
  const rows = db
    .prepare(
      `SELECT s.id FROM sessions s
       LEFT JOIN summaries sm ON sm.session_id = s.id
       WHERE sm.id IS NULL
       AND s.event_count >= 3
       ORDER BY s.started_at DESC`
    )
    .all() as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

export function getSessionChunks(sessionId: string): Array<{
  source: string;
  category: string;
  content: string;
}> {
  const db = getKnowledgeDb();
  return db
    .prepare(
      "SELECT source, category, content FROM chunks WHERE session_id = ? ORDER BY id"
    )
    .all(sessionId) as Array<{
    source: string;
    category: string;
    content: string;
  }>;
}

export function getAgingSessions(olderThanDays: number = 7): Array<{
  id: string;
  project_dir: string | null;
  started_at: string;
  chunk_count: number;
}> {
  const db = getKnowledgeDb();
  return db.prepare(`
    SELECT s.id, s.project_dir, s.started_at,
           (SELECT COUNT(*) FROM chunks WHERE session_id = s.id) as chunk_count
    FROM sessions s
    LEFT JOIN summaries sm ON sm.session_id = s.id
    WHERE sm.id IS NULL
    AND julianday('now') - julianday(s.started_at) > ?
    AND s.event_count >= 3
    ORDER BY s.started_at ASC
    LIMIT 10
  `).all(olderThanDays) as Array<{
    id: string;
    project_dir: string | null;
    started_at: string;
    chunk_count: number;
  }>;
}

export function pruneChunksForSummarizedSessions(olderThanDays: number = 30): number {
  const db = getKnowledgeDb();
  const result = db.prepare(`
    DELETE FROM chunks
    WHERE session_id IN (
      SELECT s.id FROM sessions s
      JOIN summaries sm ON sm.session_id = s.id
      WHERE julianday('now') - julianday(s.started_at) > ?
    )
  `).run(olderThanDays);
  return result.changes;
}

// ============================================================
// Pruning
// ============================================================

export function pruneExpired(): number {
  const db = getKnowledgeDb();
  const result = db
    .prepare(
      "DELETE FROM sessions WHERE datetime(started_at, '+' || ttl_days || ' days') < datetime('now')"
    )
    .run();
  return result.changes;
}
