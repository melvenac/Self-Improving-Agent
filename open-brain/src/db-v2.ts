import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { canonicalizeProjectDir } from './shared/paths.js';

export function migrateProjectDirToCanonical(db: Database.Database): number {
  const rows = db.prepare(
    `SELECT DISTINCT project_dir FROM knowledge_index WHERE project_dir IS NOT NULL`
  ).all() as { project_dir: string }[];

  const stmt = db.prepare(
    `UPDATE knowledge_index SET project_dir = ? WHERE project_dir = ?`
  );
  let updated = 0;
  for (const { project_dir } of rows) {
    const canonical = canonicalizeProjectDir(project_dir);
    if (canonical && canonical !== project_dir) {
      const result = stmt.run(canonical, project_dir);
      updated += Number(result.changes);
    }
  }
  return updated;
}

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
      -- 'state' | 'event' | NULL. Deliberately unconstrained: SQLite cannot add
      -- a CHECK via ALTER TABLE, so a constraint here would hold on fresh
      -- databases and not on migrated ones. One shape everywhere beats a
      -- guarantee that half the installs do not have; validation lives in TS.
      --
      -- NULL means *unclassified*, which is the honest state for every entry
      -- written before this column existed. It is not a synonym for 'event'.
      fact_kind TEXT DEFAULT NULL,
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

    -- Ground truth for the shadow-recall harness.
    --
    -- knowledge_index carries only aggregate counters (helpful/harmful/neutral)
    -- with no timestamps and no record of which session assigned each rating,
    -- so retrieval quality cannot be reconstructed from it after the fact.
    -- These two tables capture the (query -> ranked results -> rating) chain as
    -- it happens, which is the only way to score a ranking change honestly.
    -- recall_trigger records HOW the recall reached the agent: 'start'
    -- (injected by session startup), 'checkpoint' (checkpoint restoration),
    -- 'explicit' (the agent asked mid-task). Session-start injection and a
    -- deliberate mid-task fetch are different treatments with opposite
    -- selection bias — an entry fetched on demand was fetched because it was
    -- wanted — and without this column they are the same row, so no analysis
    -- of injection value is possible. NULL = recorded before the column
    -- existed; unknowable, never backfilled. Named recall_trigger, not
    -- trigger: TRIGGER is a reserved SQLite keyword and a column by that name
    -- would force quoting in every ad-hoc query.
    CREATE TABLE IF NOT EXISTS recall_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_uuid TEXT NOT NULL,
      query TEXT NOT NULL,
      knowledge_id INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      recall_trigger TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_uuid TEXT NOT NULL,
      knowledge_id INTEGER NOT NULL,
      rating TEXT NOT NULL CHECK(rating IN ('helpful', 'harmful', 'neutral')),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recall_log_session ON recall_log(session_uuid);
    CREATE INDEX IF NOT EXISTS idx_feedback_log_session ON feedback_log(session_uuid);
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

/**
 * Columns added after the initial schema shipped.
 *
 * `CREATE TABLE IF NOT EXISTS` no-ops on a database that already holds the
 * table, so editing the DDL above reaches new installs *only* — every existing
 * database keeps the old shape and the first query naming the new column dies
 * with "no such column". Nothing in this repo had ever added a column before
 * `fact_kind`, so this is the mechanism, kept in the same call-on-open position
 * as `migrateProjectDirToCanonical`.
 *
 * Additive only, and intentionally so. SQLite's `ALTER TABLE` can append a
 * column and little else — no CHECK, no type change, no drop — and anything
 * needing more than an append needs a full table rebuild, which is a different
 * and far more dangerous operation than this list implies. Do not grow this
 * into a general migration framework; add the rebuild explicitly when something
 * actually requires one.
 *
 * Both paths must stay in sync: a column added here also belongs in the DDL, so
 * fresh and migrated databases converge on one shape.
 */
interface AddedColumn {
  table: string;
  column: string;
  /** Type and default only — see the constraint note above. */
  ddl: string;
}

const ADDED_COLUMNS: AddedColumn[] = [
  { table: 'knowledge_index', column: 'fact_kind', ddl: 'TEXT DEFAULT NULL' },
  { table: 'recall_log', column: 'recall_trigger', ddl: 'TEXT DEFAULT NULL' },
];

/** Returns the columns it added, so a caller can report a first-run migration. */
export function migrateAddedColumns(db: Database.Database): string[] {
  const added: string[] = [];
  for (const target of ADDED_COLUMNS) {
    const existing = db.prepare(`PRAGMA table_info(${target.table})`).all() as { name: string }[];
    // An absent table is the DDL's job, not this migration's — ALTERing it
    // would throw, and initSchemaV2 creates it with the column already there.
    if (existing.length === 0) continue;
    if (existing.some((c) => c.name === target.column)) continue;
    db.exec(`ALTER TABLE ${target.table} ADD COLUMN ${target.column} ${target.ddl}`);
    added.push(`${target.table}.${target.column}`);
  }
  return added;
}

export function openV2Database(dbPath: string): Database.Database {
  // better-sqlite3 creates the file but not its parent, so on a machine where
  // ~/.claude/open-brain/ does not exist yet — a fresh clone of the template, a
  // CI runner — every caller died with "Cannot open database because the
  // directory does not exist" on the first ob_* call. Nothing else in the repo
  // creates this directory. Recursive mkdir is a no-op once it exists.
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchemaV2(db);
  migrateAddedColumns(db);
  migrateProjectDirToCanonical(db);
  return db;
}

/**
 * Which update rule a stored fact obeys.
 *
 * - `state` — one current value that changes: a path, a version, an owner, a
 *   threshold. Correct update is to **replace**.
 * - `event` — a timestamped thing that happened: a gotcha, a decision, a lesson
 *   learned. Correct update is to **append**.
 *
 * The rules are opposites, which is why the distinction matters more than it
 * first appears. Appending a state leaves two answers to one question with
 * nothing marking which is current — and `ob_recall` may return either.
 * Replacing an event destroys history that cannot be recovered.
 *
 * `knowledge_index` can only append, so today every changed state fact leaves
 * its predecessor live and recallable. Recording the kind is the first step;
 * acting on it at write time is deliberately not yet done.
 */
export type FactKind = 'state' | 'event';

export function isFactKind(value: unknown): value is FactKind {
  return value === 'state' || value === 'event';
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
  /** Omitted leaves the entry unclassified, which is not the same as `event`. */
  factKind?: FactKind | null;
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
  /** NULL = unclassified. Not validated by the schema; see `isFactKind`. */
  fact_kind: FactKind | null;
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
      (vault_path, key, content, tags, source, project_dir, maturity, helpful, harmful, neutral, success_rate, recall_count, last_recalled_at, fact_kind, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)
  `).run(
    input.vaultPath, input.key, input.content, input.tags,
    input.source ?? 'manual', input.projectDir ?? null,
    maturity, helpful, harmful, neutral, successRate,
    input.factKind ?? null, now, now
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

/**
 * Record one rating and recompute `success_rate` in the same statement.
 *
 * Until v0.15.0 this only bumped the counter column, so `success_rate` kept its
 * insert-time value — NULL for 304 of 364 live entries. Since `NULL < 0.3` is
 * never true, apoptosis could not fire and `maturityBoost` ranked on a rate that
 * had never been computed. The counter and the rate derived from it must move
 * together or they drift by construction.
 *
 * The rate is `helpful / (helpful + harmful)`, matching `evaluateLifecycle` in
 * lifecycle.ts and `apoptosisFlaggedExpr` — neutral is excluded from both
 * numerator and denominator. A neutral rating therefore leaves the rate
 * untouched (NULL stays NULL): "the session summary didn't mention this entry"
 * is not evidence that it failed.
 *
 * SQLite evaluates the SET expressions against the pre-UPDATE row, so the
 * increment is applied explicitly via the deltas rather than read back.
 */
export function updateFeedbackV2(db: Database.Database, vaultPath: string, rating: 'helpful' | 'harmful' | 'neutral'): void {
  const now = new Date().toISOString();
  const col = rating === 'helpful' ? 'helpful' : rating === 'harmful' ? 'harmful' : 'neutral';
  const helpfulDelta = rating === 'helpful' ? 1 : 0;
  const nonNeutralDelta = rating === 'neutral' ? 0 : 1;
  db.prepare(`
    UPDATE knowledge_index
    SET ${col} = ${col} + 1,
        success_rate = CASE
          WHEN (helpful + harmful + ${nonNeutralDelta}) = 0 THEN NULL
          ELSE CAST(helpful + ${helpfulDelta} AS REAL) / (helpful + harmful + ${nonNeutralDelta})
        END,
        updated_at = ?
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

// ─── Session provenance ─────────────────────────────────────────────────────
// The sessions and chunks tables shipped in the v2 schema but nothing ever
// wrote to them, so there was no persisted record of which session produced
// what. That is why verifying the SESSION_UUID wiring required watching a live
// session by hand — there was nothing to inspect afterwards.

export interface SessionRow {
  id: number;
  uuid: string;
  project_dir: string;
  started_at: string;
  ended_at: string | null;
  event_count: number;
}

/**
 * Register a session, returning its row id. Idempotent: calling it again for
 * the same uuid updates the project_dir (which may arrive later than the uuid)
 * rather than creating a duplicate.
 */
export function recordSession(
  db: Database.Database,
  uuid: string,
  projectDir: string | null,
): number {
  const now = new Date().toISOString();
  // project_dir is NOT NULL in the schema; callers may legitimately not know it.
  const dir = projectDir ?? 'unknown';

  db.prepare(`
    INSERT INTO sessions (uuid, project_dir, started_at)
    VALUES (?, ?, ?)
    ON CONFLICT(uuid) DO UPDATE SET
      project_dir = CASE
        WHEN excluded.project_dir != 'unknown' THEN excluded.project_dir
        ELSE sessions.project_dir
      END
  `).run(uuid, dir, now);

  const row = db.prepare(`SELECT id FROM sessions WHERE uuid = ?`).get(uuid) as { id: number };
  return row.id;
}

export function getSessionByUuid(db: Database.Database, uuid: string): SessionRow | undefined {
  return db.prepare(`SELECT * FROM sessions WHERE uuid = ?`).get(uuid) as SessionRow | undefined;
}

/**
 * Link an artifact to the session that produced it. knowledge_index has no
 * session column, so this table is what makes "what did session X produce?"
 * answerable. `content` holds a pointer (vault path) rather than a second copy
 * of the text — the vault file remains the source of truth.
 */
export function recordChunk(
  db: Database.Database,
  sessionId: number,
  category: string,
  content: string,
  metadata: Record<string, unknown> = {},
): number {
  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO chunks (session_id, category, content, metadata, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, category, content, JSON.stringify(metadata), now);

  db.prepare(`UPDATE sessions SET event_count = event_count + 1 WHERE id = ?`).run(sessionId);
  return info.lastInsertRowid as number;
}

export function getChunksForSession(db: Database.Database, uuid: string): Array<{
  id: number; category: string; content: string; metadata: string; created_at: string;
}> {
  return db.prepare(`
    SELECT c.id, c.category, c.content, c.metadata, c.created_at
    FROM chunks c
    JOIN sessions s ON s.id = c.session_id
    WHERE s.uuid = ?
    ORDER BY c.created_at
  `).all(uuid) as Array<{ id: number; category: string; content: string; metadata: string; created_at: string }>;
}

// --- Shadow-recall ground truth ---

export type ShadowRating = 'helpful' | 'harmful' | 'neutral';

/** How a recall reached the agent — see the recall_log DDL comment. */
export type RecallTrigger = 'start' | 'checkpoint' | 'explicit';

const RECALL_TRIGGERS: ReadonlySet<string> = new Set(['start', 'checkpoint', 'explicit']);

/**
 * Record what a live recall actually returned, in rank order.
 *
 * `rank` is 1-based position as the agent saw it. Without it there is no way to
 * ask "did the variant put the useful entry higher than production did".
 *
 * `trigger` records the treatment. An unrecognized value is stored as
 * 'explicit', not dropped and not passed through: dropping would make the row
 * uninterpretable again (the exact defect this column closes), and passing
 * through would let free text erode a three-value vocabulary.
 */
export function recordRecallEvent(
  db: Database.Database,
  sessionUuid: string,
  query: string,
  entryIds: number[],
  trigger: RecallTrigger = 'explicit',
): void {
  if (!sessionUuid || entryIds.length === 0) return;
  const now = new Date().toISOString();
  const safeTrigger = RECALL_TRIGGERS.has(trigger) ? trigger : 'explicit';
  const stmt = db.prepare(`
    INSERT INTO recall_log (session_uuid, query, knowledge_id, rank, created_at, recall_trigger)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((ids: number[]) => {
    ids.forEach((id, i) => stmt.run(sessionUuid, query, id, i + 1, now, safeTrigger));
  });
  insertAll(entryIds);
}

/**
 * Entry ids `ob_recall` actually returned during one session.
 *
 * The authoritative answer to "what was recalled this session". `/end` used to
 * take this from `.recalled-entries.json`, a file written by the startup
 * subagent and trusted without checking whose session it described — on
 * 2026-08-11 the copy on disk still belonged to session 2fb67133 from four days
 * and two sessions earlier. Ordered by first appearance so the result is stable
 * across calls.
 */
export function getSessionRecalledIds(db: Database.Database, sessionUuid: string): number[] {
  if (!sessionUuid) return [];
  const rows = db.prepare(`
    SELECT knowledge_id FROM recall_log WHERE session_uuid = ?
    GROUP BY knowledge_id ORDER BY MIN(id)
  `).all(sessionUuid) as Array<{ knowledge_id: number }>;
  return rows.map((r) => r.knowledge_id);
}

/** Record a rating as an event, alongside the aggregate counters. */
export function recordFeedbackEvent(
  db: Database.Database,
  sessionUuid: string,
  knowledgeId: number,
  rating: ShadowRating,
): void {
  if (!sessionUuid) return;
  db.prepare(`
    INSERT INTO feedback_log (session_uuid, knowledge_id, rating, created_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionUuid, knowledgeId, rating, new Date().toISOString());
}

/** Distinct queries this session issued, in first-use order. */
export function getSessionQueries(db: Database.Database, sessionUuid: string): string[] {
  const rows = db.prepare(`
    SELECT query FROM recall_log WHERE session_uuid = ?
    GROUP BY query ORDER BY MIN(id)
  `).all(sessionUuid) as Array<{ query: string }>;
  return rows.map((r) => r.query);
}

/**
 * Relevance labels assigned during this session.
 *
 * Deliberately scoped to one session: ratings accrue over time to entries that
 * have been recalled before, so scoring against all-time feedback would reward
 * a ranking for resurfacing old, frequently-recalled knowledge — the exact bias
 * removed from recallRankExpr. If an entry is rated more than once in a
 * session, the last rating wins.
 */
export function getSessionLabels(
  db: Database.Database,
  sessionUuid: string,
): Map<number, ShadowRating> {
  const rows = db.prepare(`
    SELECT knowledge_id, rating FROM feedback_log
    WHERE session_uuid = ? ORDER BY id
  `).all(sessionUuid) as Array<{ knowledge_id: number; rating: ShadowRating }>;
  const labels = new Map<number, ShadowRating>();
  for (const row of rows) labels.set(row.knowledge_id, row.rating);
  return labels;
}

/** Sessions that have both queries and ratings — the only ones worth scoring. */
export function getEvaluableSessions(db: Database.Database): string[] {
  const rows = db.prepare(`
    SELECT DISTINCT r.session_uuid AS uuid FROM recall_log r
    WHERE EXISTS (SELECT 1 FROM feedback_log f WHERE f.session_uuid = r.session_uuid)
    ORDER BY r.session_uuid
  `).all() as Array<{ uuid: string }>;
  return rows.map((r) => r.uuid);
}
