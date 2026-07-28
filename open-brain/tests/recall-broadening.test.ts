import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../src/db-v2.js';
import { sanitizeFtsQuery, broadenFtsQuery } from '../src/server.js';
import { recallRankExpr } from '../src/lifecycle.js';

/**
 * FTS5 joins bare terms with AND, so a multi-word query required every term to
 * appear in one entry. The /start protocol asks agents for "methodology-focused"
 * queries — exactly that shape — and they silently returned nothing while dozens
 * of entries matched most of the terms.
 */
describe('query broadening', () => {
  describe('broadenFtsQuery', () => {
    it('OR-joins a multi-word query', () => {
      expect(broadenFtsQuery('knowledge maturity feedback'))
        .toBe('"knowledge" OR "maturity" OR "feedback"');
    });

    it('returns null for a single term, where AND and OR are identical', () => {
      expect(broadenFtsQuery('session')).toBeNull();
      expect(broadenFtsQuery('  session  ')).toBeNull();
    });

    it('escapes embedded quotes so the FTS expression stays valid', () => {
      expect(broadenFtsQuery('say "hi" now')).toBe('"say" OR """hi""" OR "now"');
    });

    it('differs from the precise form only in the joiner', () => {
      const q = 'mirror parity drift';
      expect(sanitizeFtsQuery(q)).toBe('"mirror" "parity" "drift"');
      expect(broadenFtsQuery(q)).toBe('"mirror" OR "parity" OR "drift"');
    });
  });

  describe('AND/OR behaviour against a real FTS index', () => {
    let db: Database.Database;

    beforeEach(() => {
      db = new Database(':memory:');
      initSchemaV2(db);
      const add = (vaultPath: string, content: string) =>
        indexKnowledge(db, {
          vaultPath, key: vaultPath, content, tags: '', source: 'test',
        });

      add('a.md', 'knowledge maturity feedback loop all four terms');
      add('b.md', 'knowledge only appears here');
      add('c.md', 'maturity discussed in isolation');
      add('d.md', 'feedback mentioned alone');
      add('e.md', 'entirely unrelated content');
    });

    afterEach(() => db.close());

    const search = (matchExpr: string) =>
      db.prepare(
        `SELECT k.vault_path FROM knowledge_fts
         JOIN knowledge_index k ON k.id = knowledge_fts.rowid
         WHERE knowledge_fts MATCH ? AND k.archived_into IS NULL
         ORDER BY ${recallRankExpr('k')}`
      ).all(matchExpr).map((r) => (r as { vault_path: string }).vault_path);

    it('the precise query matches only the entry containing every term', () => {
      expect(search(sanitizeFtsQuery('knowledge maturity feedback'))).toEqual(['a.md']);
    });

    it('the broadened query reaches partial matches the precise one misses', () => {
      const broad = search(broadenFtsQuery('knowledge maturity feedback')!);

      expect(broad).toContain('a.md');
      expect(broad).toContain('b.md');
      expect(broad).toContain('c.md');
      expect(broad).toContain('d.md');
      expect(broad).not.toContain('e.md'); // still excludes genuine non-matches
    });

    it('broadening is a superset — it never drops a precise hit', () => {
      const precise = search(sanitizeFtsQuery('knowledge maturity feedback'));
      const broad = search(broadenFtsQuery('knowledge maturity feedback')!);

      for (const hit of precise) expect(broad).toContain(hit);
    });

    it('a query with no matching term still returns nothing when broadened', () => {
      expect(search(broadenFtsQuery('zebra giraffe')!)).toEqual([]);
    });
  });
});
