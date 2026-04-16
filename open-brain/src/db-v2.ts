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
      content TEXT NOT NULL DEFAULT '',
      tags TEXT DEFAULT '',
      source TEXT DEFAULT 'manual',
      project_dir TEXT,
      maturity TEXT DEFAULT 'progenitor' CHECK(maturity IN ('progenitor', 'proven', 'mature')),
      helpful INTEGER DEFAULT 0,
      harmful INTEGER DEFAULT 0,
      neutral INTEGER DEFAULT 0,
      success_rate REAL DEFAULT NULL,
      recall_count INTEGER DEFAULT 0,
      last_recalled_at TEXT,
      archived_into INTEGER DEFAULT NULL,
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
      key, content, tags,
      content=knowledge_index,
      content_rowid=id,
      tokenize='porter unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS ki_ai AFTER INSERT ON knowledge_index BEGIN
      INSERT INTO knowledge_fts(rowid, key, content, tags)
      VALUES (new.id, new.key, new.content, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS ki_ad AFTER DELETE ON knowledge_index BEGIN
      INSERT INTO knowledge_fts(knowledge_fts, rowid, key, content, tags)
      VALUES ('delete', old.id, old.key, old.content, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS ki_au AFTER UPDATE ON knowledge_index BEGIN
      INSERT INTO knowledge_fts(knowledge_fts, rowid, key, content, tags)
      VALUES ('delete', old.id, old.key, old.content, old.tags);
      INSERT INTO knowledge_fts(rowid, key, content, tags)
      VALUES (new.id, new.key, new.content, new.tags);
    END;
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
  source?: string;
  projectDir?: string;
  maturity?: string;
  helpful?: number;
  harmful?: number;
  neutral?: number;
  successRate?: number | null;
}

export interface KnowledgeIndexRow {
  id: number;
  vault_path: string;
  key: string;
  content: string;
  tags: string;
  source: string;
  project_dir: string | null;
  maturity: string;
  helpful: number;
  harmful: number;
  neutral: number;
  success_rate: number | null;
  recall_count: number;
  last_recalled_at: string | null;
  archived_into: number | null;
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
  const successRate = input.successRate ?? null;

  db.prepare(`
    INSERT OR REPLACE INTO knowledge_index
      (vault_path, key, content, tags, source, project_dir, maturity, helpful, harmful, neutral, success_rate, recall_count, last_recalled_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
  `).run(
    input.vaultPath, input.key, input.content, input.tags,
    input.source ?? 'manual', input.projectDir ?? null,
    maturity, helpful, harmful, neutral, successRate, now, now
  );
  // FTS is populated automatically via INSERT trigger (content-backed)
}

export function searchFts(db: Database.Database, query: string): FtsResult[] {
  // knowledge_fts is content-backed (content=knowledge_index, content_rowid=id).
  // JOIN to knowledge_index for full metadata.
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

// --- Stats for scorer ---

export interface KnowledgeQualityStats {
  helpful: number;
  harmful: number;
  neutral: number;
  totalEntries: number;
  ratedEntries: number;
  duplicateClusters: number;
}

export interface StalenessStats {
  staleRatio: number;
  lowSuccessCount: number;
  summarizedSessions: number;
  eligibleSessions: number;
}

export interface CoverageStats {
  domainsWithEntries: number;
  totalDomains: number;
  matureCount: number;
  provenCount: number;
  totalEntries: number;
  skillsImplemented: number;
  proposalClusters: number;
}

export function getKnowledgeQualityStats(db: Database.Database): KnowledgeQualityStats {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS totalEntries,
      SUM(helpful) AS helpful,
      SUM(harmful) AS harmful,
      SUM(neutral) AS neutral,
      SUM(CASE WHEN helpful + harmful + neutral > 0 THEN 1 ELSE 0 END) AS ratedEntries
    FROM knowledge_index
    WHERE archived_into IS NULL
  `).get() as { totalEntries: number; helpful: number; harmful: number; neutral: number; ratedEntries: number };

  // Duplicate clusters: tags appearing on 5+ entries (potential redundancy)
  const tags = db.prepare(`SELECT tags FROM knowledge_index WHERE tags IS NOT NULL AND tags != '' AND archived_into IS NULL`).all() as { tags: string }[];
  const counts = new Map<string, number>();
  for (const r of tags) {
    for (const t of r.tags.split(',').map(s => s.trim()).filter(Boolean)) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const duplicateClusters = Array.from(counts.values()).filter(c => c >= 5).length;

  return {
    helpful: row.helpful ?? 0,
    harmful: row.harmful ?? 0,
    neutral: row.neutral ?? 0,
    totalEntries: row.totalEntries ?? 0,
    ratedEntries: row.ratedEntries ?? 0,
    duplicateClusters,
  };
}

export function getStalenessStats(db: Database.Database): StalenessStats {
  const total = db.prepare(`SELECT COUNT(*) AS c FROM knowledge_index WHERE archived_into IS NULL`).get() as { c: number };
  const stale = db.prepare(`
    SELECT COUNT(*) AS c FROM knowledge_index
    WHERE archived_into IS NULL
      AND recall_count = 0
      AND created_at < datetime('now', '-60 days')
  `).get() as { c: number };
  const lowSuccess = db.prepare(`
    SELECT COUNT(*) AS c FROM knowledge_index
    WHERE archived_into IS NULL
      AND success_rate IS NOT NULL
      AND success_rate < 0.3
      AND (helpful + harmful + neutral) >= 5
  `).get() as { c: number };

  return {
    staleRatio: total.c > 0 ? stale.c / total.c : 0,
    lowSuccessCount: lowSuccess.c,
    summarizedSessions: 0, // v2 sessions table not yet populated
    eligibleSessions: 0,
  };
}

export function getCoverageStats(db: Database.Database, domainTags: string[]): CoverageStats {
  const totalDomains = domainTags.length;
  let domainsWithEntries = 0;

  for (const tag of domainTags) {
    const match = db.prepare(`
      SELECT COUNT(*) AS c FROM knowledge_index
      WHERE archived_into IS NULL AND tags LIKE ?
    `).get(`%${tag}%`) as { c: number };
    if (match.c >= 2) domainsWithEntries++;
  }

  const maturityRow = db.prepare(`
    SELECT
      COUNT(*) AS totalEntries,
      SUM(CASE WHEN maturity = 'mature' THEN 1 ELSE 0 END) AS matureCount,
      SUM(CASE WHEN maturity = 'proven' THEN 1 ELSE 0 END) AS provenCount
    FROM knowledge_index
    WHERE archived_into IS NULL
  `).get() as { totalEntries: number; matureCount: number; provenCount: number };

  return {
    domainsWithEntries,
    totalDomains,
    matureCount: maturityRow.matureCount ?? 0,
    provenCount: maturityRow.provenCount ?? 0,
    totalEntries: maturityRow.totalEntries ?? 0,
    skillsImplemented: 0,
    proposalClusters: 0,
  };
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
