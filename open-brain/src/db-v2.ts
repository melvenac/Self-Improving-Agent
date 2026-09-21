import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { canonicalizeProjectDir } from './shared/paths.js';
import {
  type Maturity,
  type Rating,
} from './lifecycle.js';

/**
 * `archived_into` value for an entry retired with no successor.
 *
 * The column was designed for merges — "this entry was folded into entry N" —
 * so every live-row filter reads `archived_into IS NULL`. A retirement has no
 * successor to point at but still needs a non-NULL value or the row stays live.
 * Zero is not a valid `knowledge_index.id` (AUTOINCREMENT starts at 1), so it
 * cannot collide with a real merge target.
 *
 * Moved here from lifecycle.ts in Loop 10 C2: it was never apoptosis-specific —
 * `ob_forget` retires through the same path — and lifecycle.ts is now only the
 * ranking expression.
 */
export const ARCHIVED_NO_SUCCESSOR = 0;

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
      -- Loop 10 C2 (E4b): success_rate is CUT and new databases do not declare
      -- it. Existing databases keep the column with its last values; nothing
      -- reads or writes it, and dropping it would be a migration on live data
      -- this loop did not rule on.
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

    -- Loop 10 C2: reflection_log is CUT. It held 0 rows after six months — it
    -- never once recorded anything — so new databases no longer declare it.
    -- Existing databases keep the empty table; nothing reads or writes it, and
    -- dropping it would be a migration on live data this loop did not rule on.

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

    -- rating_origin records WHERE the rated id came from, computed at the
    -- moment the rating is created: 'explicit' (ids passed to ob_end),
    -- 'recall-log' (resolved from recall_log), 'file' (.recalled-entries.json
    -- naming this session), 'direct' (a single ob_feedback call), 'unspecified'
    -- (a post-column caller that didn't say). resolveRecalledIds already
    -- computed this and threw it away into a log string — meanwhile 106 of 290
    -- ratings were "provenance-broken" with at least three indistinguishable
    -- mechanisms. NULL = pre-column; unknowable, never backfilled.
    CREATE TABLE IF NOT EXISTS feedback_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_uuid TEXT NOT NULL,
      knowledge_id INTEGER NOT NULL,
      rating TEXT NOT NULL CHECK(rating IN ('helpful', 'harmful', 'neutral')),
      created_at TEXT NOT NULL,
      rating_origin TEXT DEFAULT NULL,
      rating_method TEXT DEFAULT NULL
    );

    -- Every INVOCATION of the recall trigger, whether or not it surfaced
    -- anything. Loop 16 R5 and R16.
    --
    -- A SIBLING TABLE RATHER THAN MORE ROWS IN recall_log, for a reason that
    -- is structural and not stylistic. recall_log means "this entry reached
    -- the agent": getSessionRecalledIds treats it as the authoritative rated
    -- set at /end, and those ratings move success_rate, which gates
    -- apoptosis and boosts ranking. An entry the trigger LOOKED AT and did not
    -- surface was never in front of anyone, so a looked-at row in recall_log
    -- would write ratings for entries nobody read. Keeping fires here means
    -- that cannot happen BY CONSTRUCTION rather than by a filter someone must
    -- remember to keep. (knowledge_id is also NOT NULL there, and
    -- recordRecallEvent returns early on an empty id list, so a silent fire
    -- has no shape to take in that table at all.)
    --
    -- state is the whole point of the table: 'not-asked' (no element of the
    -- command was recognised, the store was never consulted), 'silent' (the
    -- store was consulted and nothing cleared the floor), 'injected' (ids went
    -- to the model). Before this, ob_recalled reporting "no knowledge
    -- entries recalled this session" could not tell "nothing asked" from
    -- "asked, and nothing relevant" — and for five loops the silence was read
    -- as inconclusive when it was the answer (G-039). Three states, three
    -- counts, and "did the memory half get used" finally has a denominator.
    CREATE TABLE IF NOT EXISTS trigger_fires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_uuid TEXT NOT NULL,
      command TEXT NOT NULL,
      query TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('not-asked', 'silent', 'injected')),
      injected_ids TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recall_log_session ON recall_log(session_uuid);
    CREATE INDEX IF NOT EXISTS idx_trigger_fires_session ON trigger_fires(session_uuid);
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
  { table: 'feedback_log', column: 'rating_origin', ddl: 'TEXT DEFAULT NULL' },
  { table: 'feedback_log', column: 'rating_method', ddl: 'TEXT DEFAULT NULL' },
];

/**
 * The schema version this build writes.
 *
 * Derived from the migration list so an additive migration bumps it by
 * construction — a stamp that has to be remembered is a stamp that gets
 * forgotten. A migration that CHANGES a column's meaning (a table rebuild —
 * see the constraint note above) must bump SCHEMA_REBUILDS explicitly, because
 * nothing about it changes the list's length.
 *
 * Why this exists: MCP stdio servers are per-session subprocesses over one
 * shared SQLite file, and each picks up new code only when its own session
 * reconnects. Two writers on different builds ran against this DB for hours on
 * 2026-08-31 — an old default contaminated 2 of 3 rows in a young column, and
 * nothing detected it. Benign for an additive column; not benign once a
 * migration changes what existing values mean.
 */
const SCHEMA_REBUILDS = 0;
export const SCHEMA_VERSION = 1 + SCHEMA_REBUILDS + ADDED_COLUMNS.length;

export interface SchemaSkew {
  codeVersion: number;
  dbVersion: number;
  /** True when the DB was stamped by a NEWER build than this one. */
  writerIsStale: boolean;
}

/**
 * Compare this build against the version stamped in the database.
 *
 * `writerIsStale` means some newer build has already opened (and possibly
 * migrated) this DB — this process is writing into a schema it does not fully
 * know. Callers surface that loudly; refusing to run would brick every session
 * that simply has not reconnected yet, which is the wrong trade for additive
 * changes (the stale-slot precedent: warn and keep working, but stop sounding
 * healthy).
 */
export function checkSchemaSkew(db: Database.Database): SchemaSkew {
  const dbVersion = Number(db.pragma('user_version', { simple: true })) || 0;
  return { codeVersion: SCHEMA_VERSION, dbVersion, writerIsStale: dbVersion > SCHEMA_VERSION };
}

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
  // Stamp forward only: a newer build raises the version, an older one must
  // never lower it — the stamp is how an older writer learns it is behind.
  const stamped = Number(db.pragma('user_version', { simple: true })) || 0;
  if (stamped < SCHEMA_VERSION) db.pragma(`user_version = ${SCHEMA_VERSION}`);
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
  /**
   * Loop 10 C2 (E4b): CUT. Optional because this interface describes a
   * `SELECT *` — databases created before this loop still return the column
   * with its last written value, and databases created after it do not have it
   * at all. Nothing computes or reads it; it is here so the type does not lie
   * about what a row may contain.
   */
  success_rate?: number | null;
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

/**
 * Inserts a knowledge row, or updates the one already holding this `key`.
 *
 * A same-key store is an UPDATE, not a replace. `INSERT OR REPLACE` deleted
 * the conflicting row and inserted a fresh one, which reset maturity, all
 * three counters, `success_rate`, `recall_count`, `last_recalled_at` and
 * `created_at`, took a new AUTOINCREMENT id, and silently orphaned every
 * `feedback_log` / `recall_log` row pointing at the old one (neither table
 * has a foreign key). Entry 416 carried one of only two `harmful` ratings in
 * the corpus and had no canonical note, so a single re-store would have
 * destroyed half of all negative signal ever recorded.
 *
 * The caller owns content, tags, vault_path, source, project_dir, fact_kind
 * and updated_at; the lifecycle owns everything else. The lifecycle inputs
 * (`maturity`, `helpful`, ...) therefore seed a NEW row only and are ignored
 * on conflict. `project_dir` and `fact_kind` overwrite only when supplied, so
 * a re-store that omits them cannot unclassify an entry.
 *
 * A `vault_path` collision with a DIFFERENT key is left to raise. The old
 * behaviour silently deleted the other row; a thrown UNIQUE error is the
 * honest outcome for two keys claiming one file.
 */
export function indexKnowledge(db: Database.Database, input: KnowledgeIndexInput): void {
  const now = new Date().toISOString();
  const maturity = input.maturity ?? 'progenitor';
  const helpful = input.helpful ?? 0;
  const harmful = input.harmful ?? 0;
  const neutral = input.neutral ?? 0;
  db.prepare(`
    INSERT INTO knowledge_index
      (vault_path, key, content, tags, source, project_dir, maturity, helpful, harmful, neutral, recall_count, last_recalled_at, fact_kind, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      vault_path  = excluded.vault_path,
      content     = excluded.content,
      tags        = excluded.tags,
      source      = excluded.source,
      project_dir = COALESCE(excluded.project_dir, project_dir),
      fact_kind   = COALESCE(excluded.fact_kind, fact_kind),
      updated_at  = excluded.updated_at
  `).run(
    input.vaultPath, input.key, input.content, input.tags,
    input.source ?? 'manual', input.projectDir ?? null,
    maturity, helpful, harmful, neutral,
    input.factKind ?? null, now, now
  );
  // FTS follows via the content-backed triggers: ki_ai on insert, ki_au on
  // the conflict-update path (delete the old rowid's text, insert the new).
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
 * Record one rating against an entry's counters.
 *
 * Loop 10 C2: this used to recompute `success_rate` in the same statement. That
 * rate was `helpful / (helpful + harmful)` — neutral excluded from numerator and
 * denominator — and it was CUT under the false-report clause. Neutral is **446 of
 * 615 ratings**, so the rate read 1.0 for almost everything ever rated: a number
 * that could not be false, measuring recall volume rather than usefulness.
 *
 * The three counters still accumulate. They are the record a replacement would be
 * built from, and building one is E3/E18/E9b's reviving observation.
 */
export function updateFeedbackV2(db: Database.Database, vaultPath: string, rating: 'helpful' | 'harmful' | 'neutral'): void {
  const now = new Date().toISOString();
  const col = rating === 'helpful' ? 'helpful' : rating === 'harmful' ? 'harmful' : 'neutral';
  // Loop 10 C2 (E4b): the `success_rate` recomputation that stood here is gone.
  // The rate was `helpful / (helpful + harmful)`, which excludes neutral — and
  // neutral is 446 of 615 ratings, 72.5%. It read 1.0 for almost everything ever
  // rated, so it measured recall volume rather than usefulness: a number that
  // could not be false. The three counters still accumulate, which is the record
  // a replacement would be built from.
  db.prepare(`
    UPDATE knowledge_index
    SET ${col} = ${col} + 1,
        updated_at = ?
    WHERE vault_path = ?
  `).run(now, vaultPath);
}

/**
 * Retire an entry by apoptosis without destroying it.
 *
 * Replaces the `DELETE FROM knowledge_index` this path used to run. The delete
 * was unsafe for a reason the schema makes structural: neither `feedback_log`
 * nor `recall_log` declares a foreign key, so removing the row left their rows
 * pointing at an id that no longer resolved. The evidence that justified the
 * prune became unreadable at the moment the prune acted on it, and an entry
 * pruned for being bad became indistinguishable from one never rated at all.
 *
 * Writing `archived_into` instead drops the entry out of every live view — all
 * of which already filter `archived_into IS NULL` — while keeping the row, its
 * counters, and the joins into both logs intact. Reversible by clearing one
 * column; `ob_forget` remains the way to remove an entry for good.
 *
 * The final rating is applied in the same statement, so the archived row shows
 * the verdict that retired it rather than the state just before it. Same rule
 * as `updateFeedbackV2`: a counter and everything derived from it move together
 * or the derived value silently describes a state that never existed.
 */
export function archiveKnowledgeEntry(
  db: Database.Database,
  id: number,
  final: { rating: Rating },
): number {
  const col = final.rating === 'helpful' ? 'helpful' : final.rating === 'harmful' ? 'harmful' : 'neutral';
  return db.prepare(`
    UPDATE knowledge_index
    SET ${col} = ${col} + 1,
        archived_into = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(ARCHIVED_NO_SUCCESSOR, id).changes;
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
  // Loop 10 C2: `lowSuccessCount` counted entries below the apoptosis threshold
  // on `success_rate`, which was cut as a number that could not be false — it
  // excluded neutral, and neutral is 72.5% of all ratings. Reported as 0 rather
  // than removed from the shape, because the scorer and its fixtures read this
  // field; what it used to count no longer exists to be counted.
  return {
    staleRatio: total.c > 0 ? stale.c / total.c : 0,
    lowSuccessCount: 0,
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
export type RecallTrigger = 'start' | 'checkpoint' | 'explicit' | 'unspecified' | 'hook';

/**
 * `hook` is Loop 16's value and it is deliberately NOT in `ob_recall`'s zod
 * enum (R6). The enum is what an agent may pass; this set is what the store
 * may record. Keeping them different is the only thing that makes the census
 * answerable: if an agent could pass `hook`, a deliberate mid-task fetch
 * could be filed as an injection nobody asked for, and the one question the
 * column exists to answer — does the memory half get used WITHOUT being
 * asked — would be unanswerable by construction.
 */
const RECALL_TRIGGERS: ReadonlySet<string> = new Set(['start', 'checkpoint', 'explicit', 'unspecified', 'hook']);

/**
 * Record what a live recall actually returned, in rank order.
 *
 * `rank` is 1-based position as the agent saw it. Without it there is no way to
 * ask "did the variant put the useful entry higher than production did".
 *
 * `trigger` records the treatment. A caller that says nothing gets
 * 'unspecified', never 'explicit': defaulting to a real treatment would file
 * every forgotten label as a deliberate fetch — contamination in the exact
 * direction the column exists to remove — while 'unspecified' keeps the
 * labeling gap countable. NULL stays reserved for pre-column rows; reusing it
 * here would merge two different unknowables. An unrecognized value is also
 * stored as 'unspecified', not dropped and not passed through: dropping would
 * make the row uninterpretable again, and passing through would let free text
 * erode the vocabulary.
 */
export function recordRecallEvent(
  db: Database.Database,
  sessionUuid: string,
  query: string,
  entryIds: number[],
  trigger: RecallTrigger = 'unspecified',
): void {
  if (!sessionUuid || entryIds.length === 0) return;
  const now = new Date().toISOString();
  const safeTrigger = RECALL_TRIGGERS.has(trigger) ? trigger : 'unspecified';
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

/** Where a rated id came from — see the feedback_log DDL comment. */
export type RatingOrigin = 'explicit' | 'recall-log' | 'file' | 'direct' | 'unspecified';

const RATING_ORIGINS: ReadonlySet<string> = new Set(['explicit', 'recall-log', 'file', 'direct', 'unspecified']);

/**
 * WHICH ARM produced a rating — as distinct from `rating_origin`, which records
 * where the rated *ids* came from.
 *
 * Those are different questions and conflating them is why the corpus cannot
 * currently answer the one that matters. A row reading
 * `origin='explicit', rating='neutral'` is equally consistent with "the agent
 * judged this entry neutral" and "the tag-substring fallback defaulted to
 * neutral on ids that happened to come from an explicit recall" — and 33 of the
 * 57 post-`rating_origin` rows are exactly that shape. Those two readings
 * demand opposite fixes: the first is a rater problem, the second is plumbing.
 *
 * - `supplied`  — an explicit per-entry judgment the agent passed to `ob_end`.
 *                 The only sweep-path input that can carry `harmful`.
 * - `heuristic` — CUT in Loop 12 (R-010). It rated an entry helpful when one of
 *                 its tags appeared as a SUBSTRING of the session summary: a
 *                 topic-mention detector, structurally unable to emit
 *                 `harmful`, so a `helpful` from it meant "mentioned", not
 *                 "worked". It never ran — zero rows across the entire life of
 *                 this column, confirmed against the live database — and what
 *                 it fed (success_rate, maturity) was cut in Loop 10. Retained
 *                 in this list as an obituary, not in the type.
 * - `direct`    — a deliberate `ob_feedback` call. The only path that also runs
 *                 `evaluateLifecycle`, which is why apoptosis has never fired.
 * - `unspecified` — a caller that did not say. Countable, never assumed to be a
 *                 judgment; same rule as `recall_trigger`'s default.
 *
 * NULL means pre-column and is unknowable, not `unspecified`.
 */
export type RatingMethod = 'supplied' | 'direct' | 'unspecified';

const RATING_METHODS: ReadonlySet<string> = new Set(['supplied', 'direct', 'unspecified']);

/**
 * Record a rating as an event, alongside the aggregate counters.
 *
 * `origin` follows the recall_trigger rules exactly: a silent caller gets
 * 'unspecified' (countable, never fabricated as a real origin), an
 * unrecognized value is coerced to 'unspecified', and NULL stays reserved for
 * pre-column rows.
 */
export function recordFeedbackEvent(
  db: Database.Database,
  sessionUuid: string,
  knowledgeId: number,
  rating: ShadowRating,
  origin: RatingOrigin = 'unspecified',
  method: RatingMethod = 'unspecified',
): void {
  if (!sessionUuid) return;
  const safeOrigin = RATING_ORIGINS.has(origin) ? origin : 'unspecified';
  const safeMethod = RATING_METHODS.has(method) ? method : 'unspecified';
  db.prepare(`
    INSERT INTO feedback_log (session_uuid, knowledge_id, rating, created_at, rating_origin, rating_method)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionUuid, knowledgeId, rating, new Date().toISOString(), safeOrigin, safeMethod);
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

/**
 * The moment a session's recall happened — earliest `recall_log` row for it.
 *
 * This is the single "as of" timestamp the replay needs: entries created after it
 * did not exist to be recalled, and feedback recorded after it had not yet moved
 * any entry's maturity. Returns null when the session logged no recalls, in which
 * case there is nothing to replay and the caller should not attempt a cutoff —
 * a null here must never be silently coerced to "now", which would reinstate the
 * defect for exactly the sessions we cannot reconstruct.
 */
export function getSessionAsOf(db: Database.Database, sessionUuid: string): string | null {
  const row = db.prepare(`
    SELECT MIN(created_at) AS as_of FROM recall_log WHERE session_uuid = ?
  `).get(sessionUuid) as { as_of: string | null } | undefined;
  return row?.as_of ?? null;
}

/**
 * Loop 10 C2 (E9b) — `captureLifecycleSnapshot` and `replayLifecycleAsOf` are
 * SUSPENDED and deleted, along with `ReplayCoverage`.
 *
 * Together they were the as-of replay: the production half captured live
 * `maturity` and `success_rate` before auto-feedback ran, and the backfill half
 * reconstructed those columns by replaying `feedback_log` for sessions that ended
 * before the capture existed. Both existed so the shadow stage ranked against the
 * state it saw rather than the state it had just written.
 *
 * `recallRankExpr` no longer reads either column — E3 and E4b were cut — so there
 * is nothing left to substitute and the confound cannot arise.
 *
 * IF E3/E18's TRIGGER FIRES, THIS COMES BACK IN THE SAME CHANGE. Restoring
 * maturity-weighted ranking restores the confound; evaluating the restored ranking
 * without this machinery measures it with the evaluating session's own labels
 * inside it, which is the defect Loop 9 built it to remove. A revival that omits
 * it is not a partial revival, it is one that cannot be honestly measured.
 *
 * Recover at `bfee8c0:open-brain/src/db-v2.ts`.
 */


/**
 * Entries that did not exist as of `asOf`, and so could never have been recalled
 * or labelled by the session being replayed.
 *
 * Exposed for tests and reporting; the ranking query applies the same cutoff
 * inline rather than passing this set around.
 */
export function countEntriesAfter(db: Database.Database, asOf: string): number {
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM knowledge_index WHERE created_at > ?
  `).get(asOf) as { n: number };
  return row.n;
}
