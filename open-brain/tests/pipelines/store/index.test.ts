import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initSchemaV2 } from '../../../src/db-v2.js';
import { store, storeFailure } from '../../../src/pipelines/store/index.js';

function makeTempDir(): string {
  const dir = join(tmpdir(), `store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('store pipeline', () => {
  let db: Database.Database;
  let vaultDir: string;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
    vaultDir = makeTempDir();
  });

  afterEach(() => {
    db.close();
    rmSync(vaultDir, { recursive: true, force: true });
  });

  it('writes vault file AND indexes in SQLite', () => {
    const result = store({
      db,
      vaultDir,
      key: 'typescript-generics',
      tags: ['typescript', 'generics'],
      content: 'TypeScript generics allow writing reusable, type-safe code.',
      project: 'test-project',
    });

    // vaultPath returned
    expect(result.vaultPath).not.toBeNull();
    expect(result.vaultPath).toBeTruthy();

    // vault file exists on disk
    expect(existsSync(result.vaultPath!)).toBe(true);

    // SQLite row exists
    const row = db.prepare('SELECT * FROM knowledge_index WHERE vault_path = ?')
      .get(result.vaultPath!) as { key: string; tags: string; vault_path: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.key).toBe('typescript-generics');
    expect(row!.tags).toContain('typescript');
  });

  it('returns null vaultPath for duplicate key (dedup)', () => {
    const input = {
      db,
      vaultDir,
      key: 'duplicate-entry',
      tags: ['test'],
      content: 'First write.',
      project: 'test-project',
    };

    const first = store(input);
    expect(first.vaultPath).not.toBeNull();

    const second = store(input);
    expect(second.vaultPath).toBeNull();

    // Only one row in SQLite
    const rows = db.prepare('SELECT COUNT(*) as cnt FROM knowledge_index WHERE key = ?')
      .get('duplicate-entry') as { cnt: number };
    expect(rows.cnt).toBe(1);
  });

  it('storeFailure: writes failure .md with structured body + indexes in SQLite', () => {
    const result = storeFailure({
      db,
      vaultDir,
      key: 'npm-install-failure',
      tags: ['npm', 'install'],
      attempted: 'npm install with legacy peer deps',
      whyFailed: 'Peer dependency conflict with React 18',
      whatWorked: 'Using --force flag resolved the conflict',
      project: 'test-project',
    });

    // vaultPath returned
    expect(result.vaultPath).not.toBeNull();
    expect(result.vaultPath).toBeTruthy();

    // vault file exists on disk
    expect(existsSync(result.vaultPath!)).toBe(true);

    // File path contains 'failure-' prefix
    expect(result.vaultPath!).toContain('failure-');

    // SQLite row exists with failure- key and failure tag
    const row = db.prepare('SELECT * FROM knowledge_index WHERE vault_path = ?')
      .get(result.vaultPath!) as { key: string; tags: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.key).toBe('failure-npm-install-failure');
    expect(row!.tags).toContain('failure');

    // Content stored in FTS includes structured sections
    // (verify via FTS search for a term from the content)
    const ftsRows = db.prepare(`
      SELECT ki.key FROM knowledge_fts f
      JOIN knowledge_index ki ON ki.id = f.rowid
      WHERE knowledge_fts MATCH ?
    `).all('conflict') as { key: string }[];
    expect(ftsRows.length).toBeGreaterThan(0);
    expect(ftsRows[0].key).toBe('failure-npm-install-failure');
  });
});
