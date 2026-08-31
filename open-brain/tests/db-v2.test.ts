import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import {
  openV2Database,
  initSchemaV2,
  indexKnowledge,
  searchFts,
  getMetadata,
  recordRecall,
  updateFeedbackV2,
  getClusterCandidates,
  SCHEMA_VERSION,
  checkSchemaSkew,
} from '../src/db-v2.js';

describe('db-v2 schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('creates all required tables', () => {
    initSchemaV2(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);

    expect(tables).toContain('sessions');
    expect(tables).toContain('chunks');
    expect(tables).toContain('knowledge_index');
    expect(tables).toContain('reflection_log');
  });

  it('creates knowledge_index with vault_path column', () => {
    initSchemaV2(db);

    const columns = db.pragma('table_info(knowledge_index)').map((c: any) => c.name);

    expect(columns).toContain('vault_path');
    expect(columns).toContain('key');
    expect(columns).toContain('maturity');
    expect(columns).toContain('helpful');
    expect(columns).toContain('harmful');
    expect(columns).toContain('neutral');
    expect(columns).toContain('recall_count');
    expect(columns).toContain('last_recalled_at');

    // `content` is required here, despite the vault being the source of truth
    // for knowledge content. knowledge_fts is an external-content FTS5 table
    // (content=knowledge_index, content_rowid=id) and its sync triggers read
    // new.content / old.content — SQLite refuses to drop the column while they
    // exist. Removing it would break the FTS index, searchFts, and ob_recall.
    // This assertion was inverted until v0.6.0 made FTS content-backed.
    expect(columns).toContain('content');
  });

  it('keeps knowledge_fts wired to knowledge_index as external content', () => {
    initSchemaV2(db);

    const sql = db
      .prepare(`SELECT sql FROM sqlite_master WHERE name = 'knowledge_fts'`)
      .get() as { sql: string };

    // Guards the coupling that makes the `content` column mandatory above.
    expect(sql.sql).toContain('content=knowledge_index');
    expect(sql.sql).toContain('content_rowid=id');
  });

  it('creates FTS5 index for keyword search', () => {
    initSchemaV2(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_fts'")
      .all();

    expect(tables.length).toBe(1);
  });

  it('creates chunks table with session FK', () => {
    initSchemaV2(db);

    // Insert a session first
    db.prepare('INSERT INTO sessions (uuid, project_dir, started_at) VALUES (?, ?, ?)').run(
      'test-uuid', '/test/project', new Date().toISOString()
    );

    const session = db.prepare('SELECT id FROM sessions WHERE uuid = ?').get('test-uuid') as any;

    // Insert a chunk referencing the session
    db.prepare(
      'INSERT INTO chunks (session_id, category, content, created_at) VALUES (?, ?, ?, ?)'
    ).run(session.id, 'prompt', 'test content', new Date().toISOString());

    const chunk = db.prepare('SELECT * FROM chunks WHERE session_id = ?').get(session.id) as any;
    expect(chunk.content).toBe('test content');
    expect(chunk.category).toBe('prompt');
  });

  it('creates reflection_log table', () => {
    initSchemaV2(db);

    const columns = db.pragma('table_info(reflection_log)').map((c: any) => c.name);

    expect(columns).toContain('cluster_tag');
    expect(columns).toContain('source_ids');
    expect(columns).toContain('result');
    expect(columns).toContain('created_at');
  });
});

describe('query helpers', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });

  afterEach(() => {
    db.close();
  });

  it('indexKnowledge inserts into both knowledge_index and knowledge_fts', () => {
    indexKnowledge(db, {
      vaultPath: '/vault/test-note.md',
      key: 'test-key',
      tags: 'typescript,testing',
      content: 'This is a test entry about TypeScript patterns.',
    });

    const row = db.prepare('SELECT * FROM knowledge_index WHERE vault_path = ?').get('/vault/test-note.md') as any;
    expect(row).toBeDefined();
    expect(row.key).toBe('test-key');
    expect(row.tags).toBe('typescript,testing');
    expect(row.maturity).toBe('progenitor');

    // knowledge_fts is contentless — verify via FTS MATCH + rowid JOIN
    const ftsRows = db.prepare(`
      SELECT ki.key FROM knowledge_fts f
      JOIN knowledge_index ki ON ki.id = f.rowid
      WHERE knowledge_fts MATCH 'TypeScript'
    `).all() as any[];
    expect(ftsRows.length).toBeGreaterThan(0);
    expect(ftsRows[0].key).toBe('test-key');
  });

  it('searchFts returns matches ranked by BM25', () => {
    indexKnowledge(db, {
      vaultPath: '/vault/note-a.md',
      key: 'note-a',
      tags: 'typescript',
      content: 'TypeScript type inference patterns for generics.',
    });
    indexKnowledge(db, {
      vaultPath: '/vault/note-b.md',
      key: 'note-b',
      tags: 'python',
      content: 'Python list comprehensions and generators.',
    });

    const results = searchFts(db, 'TypeScript');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].key).toBe('note-a');
    expect(results[0].vault_path).toBe('/vault/note-a.md');
    expect(typeof results[0].rank).toBe('number');
  });

  it('getMetadata returns full row for a vault path', () => {
    indexKnowledge(db, {
      vaultPath: '/vault/meta-test.md',
      key: 'meta-key',
      tags: 'meta',
      content: 'Metadata test content.',
      maturity: 'proven',
      helpful: 3,
    });

    const row = getMetadata(db, '/vault/meta-test.md');
    expect(row).toBeDefined();
    expect(row!.key).toBe('meta-key');
    expect(row!.maturity).toBe('proven');
    expect(row!.helpful).toBe(3);
    expect(row!.vault_path).toBe('/vault/meta-test.md');
  });

  it('recordRecall increments recall_count', () => {
    indexKnowledge(db, {
      vaultPath: '/vault/recall-test.md',
      key: 'recall-key',
      tags: 'recall',
      content: 'Recall test content.',
    });

    const before = getMetadata(db, '/vault/recall-test.md');
    expect(before!.recall_count).toBe(0);

    recordRecall(db, '/vault/recall-test.md');
    recordRecall(db, '/vault/recall-test.md');

    const after = getMetadata(db, '/vault/recall-test.md');
    expect(after!.recall_count).toBe(2);
    expect(after!.last_recalled_at).not.toBeNull();
  });

  it('updateFeedbackV2 increments correct counter', () => {
    indexKnowledge(db, {
      vaultPath: '/vault/feedback-test.md',
      key: 'feedback-key',
      tags: 'feedback',
      content: 'Feedback test content.',
    });

    updateFeedbackV2(db, '/vault/feedback-test.md', 'helpful');
    updateFeedbackV2(db, '/vault/feedback-test.md', 'helpful');
    updateFeedbackV2(db, '/vault/feedback-test.md', 'harmful');
    updateFeedbackV2(db, '/vault/feedback-test.md', 'neutral');

    const row = getMetadata(db, '/vault/feedback-test.md');
    expect(row!.helpful).toBe(2);
    expect(row!.harmful).toBe(1);
    expect(row!.neutral).toBe(1);
  });

  it('getClusterCandidates finds tags with 3+ entries', () => {
    const entries = [
      { vaultPath: '/vault/c1.md', key: 'c1', tags: 'typescript,testing', content: 'c1' },
      { vaultPath: '/vault/c2.md', key: 'c2', tags: 'typescript,patterns', content: 'c2' },
      { vaultPath: '/vault/c3.md', key: 'c3', tags: 'typescript,patterns', content: 'c3' },
      { vaultPath: '/vault/c4.md', key: 'c4', tags: 'typescript,testing', content: 'c4' },
      { vaultPath: '/vault/c5.md', key: 'c5', tags: 'python', content: 'c5' },
      { vaultPath: '/vault/c6.md', key: 'c6', tags: 'python', content: 'c6' },
    ];
    for (const e of entries) indexKnowledge(db, e);

    const candidates = getClusterCandidates(db);
    const tagMap = Object.fromEntries(candidates.map(c => [c.tag, c.count]));

    // typescript appears 4 times, testing appears 2 times, patterns appears 2 times, python appears 2 times
    expect(tagMap['typescript']).toBe(4);
    expect(tagMap['testing']).toBeUndefined(); // only 2, below threshold
    expect(tagMap['python']).toBeUndefined();  // only 2, below threshold
  });
});

describe('openV2Database first-run', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ob-dbv2-'));
  });

  afterEach(() => {
    try { rmSync(tmp, { recursive: true }); } catch { /* Windows race */ }
  });

  it('creates the parent directory instead of throwing', () => {
    // The v0.8.1 first-run failure: better-sqlite3 creates the file but not the
    // directory, and nothing in the repo creates ~/.claude/open-brain/.
    const dbPath = join(tmp, 'does-not-exist-yet', 'knowledge-v2.db');
    expect(existsSync(dirname(dbPath))).toBe(false);

    const db = openV2Database(dbPath);
    try {
      expect(existsSync(dbPath)).toBe(true);
      // Schema init must have run against the newly created file.
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r: any) => r.name);
      expect(tables).toContain('knowledge_index');
    } finally {
      db.close();
    }
  });

  it('stamps user_version with SCHEMA_VERSION, forward-only', () => {
    const dbPath = join(tmp, 'stamp.db');
    const db = openV2Database(dbPath);
    expect(Number(db.pragma('user_version', { simple: true }))).toBe(SCHEMA_VERSION);
    expect(checkSchemaSkew(db)).toEqual({
      codeVersion: SCHEMA_VERSION, dbVersion: SCHEMA_VERSION, writerIsStale: false,
    });
    db.close();

    // A DB stamped by a newer build must not be lowered by an older open —
    // the stamp is how the older writer learns it is behind.
    const future = new Database(dbPath);
    future.pragma(`user_version = ${SCHEMA_VERSION + 1}`);
    future.close();

    const reopened = openV2Database(dbPath);
    expect(Number(reopened.pragma('user_version', { simple: true }))).toBe(SCHEMA_VERSION + 1);
    expect(checkSchemaSkew(reopened).writerIsStale).toBe(true);
    reopened.close();
  });

  it('is a no-op when the directory already exists', () => {
    const dbPath = join(tmp, 'knowledge-v2.db');
    const first = openV2Database(dbPath);
    indexKnowledge(first, { vaultPath: '/vault/a.md', key: 'a', tags: 'testing', content: 'a' });
    first.close();

    // Reopening must not clobber the existing file.
    const second = openV2Database(dbPath);
    try {
      const row = second.prepare('SELECT COUNT(*) as c FROM knowledge_index').get() as { c: number };
      expect(row.c).toBe(1);
    } finally {
      second.close();
    }
  });
});
