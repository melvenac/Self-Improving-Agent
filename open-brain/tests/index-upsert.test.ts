import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge, searchFts, recordRecall, updateFeedbackV2 } from '../src/db-v2.js';

/**
 * A same-key store must be an UPDATE, never a replace. `INSERT OR REPLACE`
 * deleted the row and re-inserted it, which reset every lifecycle field, took
 * a new id, and orphaned the log rows that referenced the old one.
 *
 * The seed mirrors the live shape of entry 416: indexed under `Checkpoints/`,
 * carrying ratings and recalls, with no canonical `Experiences/` note — so the
 * store pipeline's dedup branch never fires and `indexKnowledge` collides on
 * the key.
 */
describe('indexKnowledge upsert', () => {
  let db: Database.Database;

  const OLD_PATH = 'Checkpoints/2026-08-01-door-access.md';
  const NEW_PATH = 'Experiences/tcm-server/door-access-phase-1.md';
  const KEY = 'door-access-phase-1';

  const row = () => db.prepare('SELECT * FROM knowledge_index WHERE key = ?').get(KEY) as any;
  const count = (sql: string) => (db.prepare(sql).get() as any).c as number;

  const seed = () => {
    indexKnowledge(db, {
      vaultPath: OLD_PATH,
      key: KEY,
      content: 'original body',
      tags: 'tcm,door-access',
      source: 'manual',
      projectDir: '/proj/tcm-server',
      factKind: 'event',
    });
    recordRecall(db, OLD_PATH);
    recordRecall(db, OLD_PATH);
    updateFeedbackV2(db, OLD_PATH, 'helpful');
    updateFeedbackV2(db, OLD_PATH, 'harmful');
    return row();
  };

  const restore = () =>
    indexKnowledge(db, {
      vaultPath: NEW_PATH,
      key: KEY,
      content: 'rewritten body',
      tags: 'tcm,door-access,rfid',
    });

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });

  afterEach(() => {
    db.close();
  });

  it('keeps the id; MAX(id) does not advance', () => {
    const before = seed();
    const maxBefore = count('SELECT MAX(id) AS c FROM knowledge_index');

    restore();

    expect(row().id).toBe(before.id);
    expect(count('SELECT MAX(id) AS c FROM knowledge_index')).toBe(maxBefore);
    expect(count('SELECT COUNT(*) AS c FROM knowledge_index')).toBe(1);
  });

  it('documents the SQLite quirk: the AUTOINCREMENT sequence still advances on a resolved conflict', () => {
    // SQLite reserves the candidate rowid before the conflict resolves, so
    // `sqlite_sequence` moves even though no row was inserted. The next fresh
    // insert therefore lands on id 3, not 2. An id gap after this fix means
    // "re-store OR delete" and cannot be read as a deletion on its own.
    seed();
    restore();
    indexKnowledge(db, { vaultPath: 'Experiences/x/fresh.md', key: 'fresh', content: 'x', tags: '' });

    const fresh = db.prepare('SELECT id FROM knowledge_index WHERE key = ?').get('fresh') as any;
    expect(fresh.id).toBe(3);
  });

  it('preserves every lifecycle field the caller does not own', () => {
    const before = seed();
    expect(before.helpful).toBe(1);
    expect(before.harmful).toBe(1);
    expect(before.recall_count).toBe(2);
    expect(before.last_recalled_at).not.toBeNull();

    restore();

    const after = row();
    expect(after.helpful).toBe(before.helpful);
    expect(after.harmful).toBe(before.harmful);
    expect(after.neutral).toBe(before.neutral);
    expect(after.success_rate).toBe(before.success_rate);
    expect(after.maturity).toBe(before.maturity);
    expect(after.recall_count).toBe(before.recall_count);
    expect(after.last_recalled_at).toBe(before.last_recalled_at);
    expect(after.created_at).toBe(before.created_at);
  });

  it('updates the fields the caller owns', () => {
    seed();
    restore();

    const after = row();
    expect(after.vault_path).toBe(NEW_PATH);
    expect(after.content).toBe('rewritten body');
    expect(after.tags).toBe('tcm,door-access,rfid');
    expect(after.updated_at >= after.created_at).toBe(true);
  });

  it('ignores lifecycle inputs on conflict; they seed a new row only', () => {
    const before = seed();

    indexKnowledge(db, {
      vaultPath: NEW_PATH,
      key: KEY,
      content: 'x',
      tags: '',
      maturity: 'mature',
      helpful: 99,
      harmful: 0,
      neutral: 0,
      successRate: 1.0,
    });

    const after = row();
    expect(after.maturity).toBe(before.maturity);
    expect(after.helpful).toBe(before.helpful);
    expect(after.success_rate).toBe(before.success_rate);
  });

  it('does not unclassify an entry when project_dir / fact_kind are omitted', () => {
    seed();
    restore();

    expect(row().project_dir).toBe('/proj/tcm-server');
    expect(row().fact_kind).toBe('event');
  });

  it('overwrites project_dir / fact_kind when supplied', () => {
    seed();
    indexKnowledge(db, {
      vaultPath: NEW_PATH,
      key: KEY,
      content: 'x',
      tags: '',
      projectDir: '/proj/TCM-Server',
      factKind: 'state',
    });

    expect(row().project_dir).toBe('/proj/TCM-Server');
    expect(row().fact_kind).toBe('state');
  });

  it('keeps the feedback_log and recall_log joins intact', () => {
    const before = seed();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO feedback_log (session_uuid, knowledge_id, rating, created_at) VALUES ('sess-1', ?, 'harmful', ?)`)
      .run(before.id, now);
    db.prepare(`INSERT INTO recall_log (session_uuid, query, knowledge_id, rank, created_at) VALUES ('sess-1', 'door', ?, 1, ?)`)
      .run(before.id, now);

    restore();

    expect(count(`SELECT COUNT(*) AS c FROM feedback_log f JOIN knowledge_index k ON k.id = f.knowledge_id WHERE k.key = '${KEY}'`)).toBe(1);
    expect(count(`SELECT COUNT(*) AS c FROM recall_log r JOIN knowledge_index k ON k.id = r.knowledge_id WHERE k.key = '${KEY}'`)).toBe(1);
  });

  it('resyncs FTS to the new content and drops the old', () => {
    seed();
    expect(searchFts(db, 'original').map((r) => r.key)).toEqual([KEY]);

    restore();

    expect(searchFts(db, 'original')).toEqual([]);
    expect(searchFts(db, 'rewritten').map((r) => r.key)).toEqual([KEY]);
    // exactly one FTS row for the key: no stale duplicate left behind
    expect(searchFts(db, 'door').length).toBe(1);
  });

  it('raises when a different key claims an existing vault_path, instead of deleting the other row', () => {
    seed();
    expect(() =>
      indexKnowledge(db, { vaultPath: OLD_PATH, key: 'some-other-key', content: 'x', tags: '' })
    ).toThrow(/UNIQUE constraint failed: knowledge_index.vault_path/);
    expect(count('SELECT COUNT(*) AS c FROM knowledge_index')).toBe(1);
    expect(row().content).toBe('original body');
  });
});
