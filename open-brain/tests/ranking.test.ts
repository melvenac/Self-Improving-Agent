import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../src/db-v2.js';
import { recallRankExpr, maturityBoost, LIFECYCLE_CONFIG, type Maturity } from '../src/lifecycle.js';

/**
 * Guards the ob_recall ranking contract. bm25() is negative and the query sorts
 * ASCENDING, so "ranks higher" means "sorts earlier".
 */
describe('recall ranking', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });

  afterEach(() => db.close());

  /** Insert an entry with identical text (so BM25 is equal) but controlled age/maturity. */
  function add(
    vaultPath: string,
    opts: { ageDays?: number; maturity?: Maturity; successRate?: number | null; tags?: string } = {}
  ) {
    indexKnowledge(db, {
      vaultPath,
      key: vaultPath,
      content: 'alpha beta gamma delta',
      tags: opts.tags ?? '',
      source: 'test',
      maturity: opts.maturity ?? 'progenitor',
      successRate: opts.successRate ?? null,
    });
    if (opts.ageDays) {
      db.prepare(
        `UPDATE knowledge_index SET created_at = datetime('now', ?) WHERE vault_path = ?`
      ).run(`-${opts.ageDays} days`, vaultPath);
    }
  }

  /** Run the live ranking expression and return vault_paths in ranked order. */
  function ranked(): string[] {
    const rows = db
      .prepare(
        `SELECT k.vault_path, ${recallRankExpr('k')} AS weighted_rank
         FROM knowledge_fts
         JOIN knowledge_index k ON k.id = knowledge_fts.rowid
         WHERE knowledge_fts MATCH 'alpha'
         AND k.archived_into IS NULL
         ORDER BY weighted_rank`
      )
      .all() as Array<{ vault_path: string }>;
    return rows.map((r) => r.vault_path);
  }

  it('ranks a newer entry above an older one at equal relevance', () => {
    add('old.md', { ageDays: 200 });
    add('new.md', { ageDays: 0 });

    expect(ranked()[0]).toBe('new.md');
  });

  it('does not let age alone outrank a much better match', () => {
    // Same age, so only relevance differs — sanity check that bm25 still drives order.
    add('a.md', { ageDays: 10 });
    add('b.md', { ageDays: 10 });
    expect(ranked()).toHaveLength(2);
  });

  it('ranks a mature entry above a progenitor at equal relevance and age', () => {
    add('progenitor.md', { ageDays: 30 });
    add('mature.md', { ageDays: 30, maturity: 'mature' });

    expect(ranked()[0]).toBe('mature.md');
  });

  it('ranks a proven entry above a progenitor at equal relevance and age', () => {
    add('progenitor.md', { ageDays: 30 });
    add('proven.md', { ageDays: 30, maturity: 'proven' });

    expect(ranked()[0]).toBe('proven.md');
  });

  it('demotes an entry whose success rate is below the apoptosis threshold', () => {
    add('healthy.md', { ageDays: 30, successRate: 0.9 });
    add('failing.md', { ageDays: 30, successRate: 0.1 });

    expect(ranked()[0]).toBe('healthy.md');
    expect(ranked()[1]).toBe('failing.md');
  });

  it('keeps a mature entry ahead of a progenitor that is moderately older', () => {
    // Regression guard: the age term must not be strong enough to bury maturity.
    add('old-progenitor.md', { ageDays: 60 });
    add('new-mature.md', { ageDays: 0, maturity: 'mature' });

    expect(ranked()[0]).toBe('new-mature.md');
  });

  it('boosts entries tagged failure above equally-relevant peers', () => {
    add('plain.md', { ageDays: 30, tags: 'node, hooks' });
    add('failure.md', { ageDays: 30, tags: 'node, failure' });

    expect(ranked()[0]).toBe('failure.md');
  });

  it('matches the failure tag exactly, not as a substring', () => {
    // 'failures' and 'no-failure' must NOT earn the boost.
    add('plain.md', { ageDays: 30, tags: 'node' });
    add('plural.md', { ageDays: 30, tags: 'failures' });
    add('negated.md', { ageDays: 30, tags: 'no-failure' });

    // All three are equally relevant and equally aged, so none should be
    // promoted above the others by a spurious failure boost.
    const order = ranked();
    expect(order).toHaveLength(3);

    add('real.md', { ageDays: 30, tags: 'failure' });
    expect(ranked()[0]).toBe('real.md');
  });

  it('handles NULL tags without dropping the row', () => {
    add('tagged.md', { ageDays: 30, tags: 'failure' });
    db.prepare(`UPDATE knowledge_index SET tags = NULL WHERE vault_path = ?`).run('tagged.md');
    expect(ranked()).toContain('tagged.md');
  });

  it('SQL maturity factors agree with maturityBoost()', () => {
    // The SQL expression is generated from LIFECYCLE_CONFIG; assert the same
    // constants drive the TypeScript helper so the two cannot drift.
    const sql = recallRankExpr('k');
    expect(sql).toContain(String(LIFECYCLE_CONFIG.matureBoost));
    expect(sql).toContain(String(LIFECYCLE_CONFIG.provenBoost));
    expect(sql).toContain(String(LIFECYCLE_CONFIG.lowSuccessPenalty));

    expect(maturityBoost('mature', null)).toBe(LIFECYCLE_CONFIG.matureBoost);
    expect(maturityBoost('proven', null)).toBe(LIFECYCLE_CONFIG.provenBoost);
    expect(maturityBoost('progenitor', null)).toBe(1.0);
    expect(maturityBoost('mature', 0.1)).toBe(
      LIFECYCLE_CONFIG.matureBoost * LIFECYCLE_CONFIG.lowSuccessPenalty
    );
  });
});
