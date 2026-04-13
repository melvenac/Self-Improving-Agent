import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchemaV2 } from '../src/db-v2.js';

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
    expect(columns).not.toContain('content'); // Content lives in vault, not DB
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
