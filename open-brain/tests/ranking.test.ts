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
  function ranked(overrides: Parameters<typeof recallRankExpr>[1] = {}): string[] {
    return rankRows(overrides).map((r) => r.vault_path);
  }

  /** Same query, but keeping the computed rank so ties can be asserted as ties. */
  function rankRows(overrides: Parameters<typeof recallRankExpr>[1] = {}) {
    return db
      .prepare(
        `SELECT k.vault_path, ${recallRankExpr('k', overrides)} AS weighted_rank
         FROM knowledge_fts
         JOIN knowledge_index k ON k.id = knowledge_fts.rowid
         WHERE knowledge_fts MATCH 'alpha'
         AND k.archived_into IS NULL
         ORDER BY weighted_rank`
      )
      .all() as Array<{ vault_path: string; weighted_rank: number }>;
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

  /**
   * Loop 8 R1: the maturity boost is suspended (both multipliers 1.0), so
   * maturity no longer moves an entry in the ranking. Asserted as an exact tie
   * rather than as an order, because with equal scores the returned order is
   * whatever SQLite happens to emit and asserting on it would pin noise.
   */
  it('does not rank a mature entry above a progenitor while the boost is suspended', () => {
    add('progenitor.md', { ageDays: 30 });
    add('mature.md', { ageDays: 30, maturity: 'mature' });

    const rows = rankRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].weighted_rank).toBeCloseTo(rows[1].weighted_rank, 10);
  });

  it('does not rank a proven entry above a progenitor while the boost is suspended', () => {
    add('progenitor.md', { ageDays: 30 });
    add('proven.md', { ageDays: 30, maturity: 'proven' });

    const rows = rankRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].weighted_rank).toBeCloseTo(rows[1].weighted_rank, 10);
  });

  /**
   * Loop 10 C2 (E3): the maturity boost is gone from the ranking expression, so
   * the test that pinned "restoring the constants restores the behaviour" went
   * with it. This replaces it with the guarantee that now matters: maturity does
   * not influence rank at all, which is what makes the deletion behaviour-
   * preserving against the pre-deletion state where both boosts were 1.0.
   */
  it('ignores maturity entirely — it is no longer a ranking input', () => {
    add('progenitor.md', { ageDays: 30 });
    add('mature.md', { ageDays: 30, maturity: 'mature' });
    add('proven.md', { ageDays: 30, maturity: 'proven' });

    const rows = db.prepare(`
      SELECT k.vault_path, ${recallRankExpr('k')} AS weighted_rank
      FROM knowledge_fts JOIN knowledge_index k ON k.id = knowledge_fts.rowid
      WHERE knowledge_fts MATCH 'alpha'
    `).all() as Array<{ vault_path: string; weighted_rank: number }>;

    expect(rows).toHaveLength(3);
    // Same age, same tags, same text — so identical scores regardless of maturity.
    expect(rows[0].weighted_rank).toBeCloseTo(rows[1].weighted_rank, 10);
    expect(rows[1].weighted_rank).toBeCloseTo(rows[2].weighted_rank, 10);
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

  it('builds the SQL from LIFECYCLE_CONFIG, and names neither maturity nor success_rate', () => {
    const sql = recallRankExpr('k');

    // The surviving constants still come from config rather than literals.
    expect(sql).toContain(String(LIFECYCLE_CONFIG.failureBoost));
    expect(sql).toContain(String(LIFECYCLE_CONFIG.recencyDecayPerDay));

    // Loop 10 C2: asserted as an absence. A database created after this loop has
    // no success_rate column, so an expression naming it would not merely rank
    // wrongly — it would throw.
    expect(sql).not.toContain('success_rate');
    expect(sql).not.toContain('maturity');
  });
});
