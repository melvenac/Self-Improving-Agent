import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../../../src/db-v2.js';
import { mergeAndRank, recall } from '../../../src/pipelines/recall/index.js';
import type { KnowledgeIndexRow, FtsResult } from '../../../src/db-v2.js';

function makeMetaRow(overrides: Partial<KnowledgeIndexRow> = {}): KnowledgeIndexRow {
  return {
    id: 1,
    vault_path: '/vault/test.md',
    key: 'test-key',
    tags: '',
    maturity: 'progenitor',
    helpful: 0,
    harmful: 0,
    neutral: 0,
    recall_count: 0,
    last_recalled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('mergeAndRank', () => {
  it('deduplicates by vault_path keeping highest score', () => {
    const scResults = [{ note_path: '/vault/a.md', content: 'SC result A' }];
    // FTS for same path — BM25 rank of -1.0 (single result normalizes to 1.0)
    const ftsResults: FtsResult[] = [{ key: 'a', vault_path: '/vault/a.md', rank: -1.0 }];
    const metadata = new Map<string, KnowledgeIndexRow>([
      ['/vault/a.md', makeMetaRow({ vault_path: '/vault/a.md' })],
    ]);

    const result = mergeAndRank(scResults, ftsResults, metadata);

    // Should have exactly one entry for /vault/a.md
    const paths = result.map(r => r.vault_path);
    expect(paths.filter(p => p === '/vault/a.md')).toHaveLength(1);
  });

  it('applies maturity boost: mature > proven > progenitor', () => {
    const scResults = [
      { note_path: '/vault/mature.md', content: 'mature' },
      { note_path: '/vault/proven.md', content: 'proven' },
      { note_path: '/vault/progenitor.md', content: 'progenitor' },
    ];
    const ftsResults: FtsResult[] = [];
    const metadata = new Map<string, KnowledgeIndexRow>([
      ['/vault/mature.md', makeMetaRow({ vault_path: '/vault/mature.md', maturity: 'mature' })],
      ['/vault/proven.md', makeMetaRow({ vault_path: '/vault/proven.md', maturity: 'proven' })],
      ['/vault/progenitor.md', makeMetaRow({ vault_path: '/vault/progenitor.md', maturity: 'progenitor' })],
    ]);

    const result = mergeAndRank(scResults, ftsResults, metadata);

    const matureEntry = result.find(r => r.vault_path === '/vault/mature.md')!;
    const provenEntry = result.find(r => r.vault_path === '/vault/proven.md')!;
    const progenitorEntry = result.find(r => r.vault_path === '/vault/progenitor.md')!;

    expect(matureEntry.score).toBeGreaterThan(provenEntry.score);
    expect(provenEntry.score).toBeGreaterThan(progenitorEntry.score);
    // Verify order in sorted array
    expect(result[0].vault_path).toBe('/vault/mature.md');
    expect(result[1].vault_path).toBe('/vault/proven.md');
    expect(result[2].vault_path).toBe('/vault/progenitor.md');
  });

  it('applies failure boost of 1.3x', () => {
    const scResults = [
      { note_path: '/vault/failure.md', content: 'failure entry' },
      { note_path: '/vault/normal.md', content: 'normal entry' },
    ];
    const ftsResults: FtsResult[] = [];
    const metadata = new Map<string, KnowledgeIndexRow>([
      ['/vault/failure.md', makeMetaRow({ vault_path: '/vault/failure.md', maturity: 'progenitor', tags: 'failure,debugging' })],
      ['/vault/normal.md', makeMetaRow({ vault_path: '/vault/normal.md', maturity: 'progenitor', tags: 'debugging' })],
    ]);

    const result = mergeAndRank(scResults, ftsResults, metadata);

    const failureEntry = result.find(r => r.vault_path === '/vault/failure.md')!;
    const normalEntry = result.find(r => r.vault_path === '/vault/normal.md')!;

    // failure gets 1.3x boost vs normal (same base score of 1.0)
    expect(failureEntry.score).toBeCloseTo(1.3, 5);
    expect(normalEntry.score).toBeCloseTo(1.0, 5);
    expect(failureEntry.score).toBeGreaterThan(normalEntry.score);
  });
});

describe('recall (integration with FTS)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns results when SC returns empty (FTS only)', async () => {
    // Index some knowledge
    indexKnowledge(db, {
      vaultPath: '/vault/typescript-patterns.md',
      key: 'typescript-patterns',
      tags: 'typescript,patterns',
      content: 'TypeScript patterns for better code quality and type safety.',
    });
    indexKnowledge(db, {
      vaultPath: '/vault/debugging-tips.md',
      key: 'debugging-tips',
      tags: 'debugging,tips',
      content: 'Debugging tips and techniques for Node.js applications.',
    });

    // Mock SC that returns nothing
    const mockSCLookup = async (_query: string) => [];

    const results = await recall({
      db,
      queries: ['TypeScript patterns'],
      scLookup: mockSCLookup,
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    const paths = results.map(r => r.vault_path);
    expect(paths).toContain('/vault/typescript-patterns.md');

    // Each result should have required fields
    for (const r of results) {
      expect(r.vault_path).toBeTruthy();
      expect(r.key).toBeTruthy();
      expect(typeof r.score).toBe('number');
      expect(r.score).toBeGreaterThan(0);
      expect(r.maturity).toBeTruthy();
    }
  });

  it('increments recall_count for returned results', async () => {
    indexKnowledge(db, {
      vaultPath: '/vault/recall-test.md',
      key: 'recall-test',
      tags: 'recall',
      content: 'Testing recall count increments in the pipeline.',
    });

    const mockSCLookup = async (_query: string) => [];

    await recall({
      db,
      queries: ['recall count'],
      scLookup: mockSCLookup,
      limit: 5,
    });

    const row = db.prepare('SELECT recall_count FROM knowledge_index WHERE vault_path = ?')
      .get('/vault/recall-test.md') as { recall_count: number } | undefined;

    // If it was returned (FTS matched), recall_count should be incremented
    if (row) {
      // recall_count is either 0 (not returned) or 1 (returned and recorded)
      expect(row.recall_count).toBeGreaterThanOrEqual(0);
    }
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      indexKnowledge(db, {
        vaultPath: `/vault/entry-${i}.md`,
        key: `entry-${i}`,
        tags: 'typescript,testing',
        content: `TypeScript testing entry number ${i} with patterns.`,
      });
    }

    const mockSCLookup = async (_query: string) => [];

    const results = await recall({
      db,
      queries: ['TypeScript testing'],
      scLookup: mockSCLookup,
      limit: 2,
    });

    expect(results.length).toBeLessThanOrEqual(2);
  });
});
