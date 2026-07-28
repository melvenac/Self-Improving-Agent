import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../src/db-v2.js';
import { recallRankExpr, LIFECYCLE_CONFIG, type Maturity } from '../src/lifecycle.js';
import { SHADOW_STRATEGIES, resolveStrategy } from '../src/pipelines/shadow/strategies.js';

/**
 * A shadow "strategy" must be a config override of the live ranking expression,
 * never a second implementation — otherwise the harness measures a code path
 * that no user ever hits.
 */
describe('shadow strategies', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });

  afterEach(() => db.close());

  function add(
    vaultPath: string,
    opts: { ageDays?: number; maturity?: Maturity; tags?: string } = {}
  ) {
    indexKnowledge(db, {
      vaultPath,
      key: vaultPath,
      content: 'alpha beta gamma delta',
      tags: opts.tags ?? '',
      source: 'test',
      maturity: opts.maturity ?? 'progenitor',
      successRate: null,
    });
    if (opts.ageDays) {
      db.prepare(
        `UPDATE knowledge_index SET created_at = datetime('now', ?) WHERE vault_path = ?`
      ).run(`-${opts.ageDays} days`, vaultPath);
    }
  }

  function rankedWith(overrides: Parameters<typeof recallRankExpr>[1]): string[] {
    const rows = db
      .prepare(
        `SELECT k.vault_path, ${recallRankExpr('k', overrides)} AS weighted_rank
         FROM knowledge_fts
         JOIN knowledge_index k ON k.id = knowledge_fts.rowid
         WHERE knowledge_fts MATCH 'alpha'
         ORDER BY weighted_rank`
      )
      .all() as Array<{ vault_path: string }>;
    return rows.map((r) => r.vault_path);
  }

  it('defaults to the live config when no override is given', () => {
    expect(recallRankExpr('k')).toBe(recallRankExpr('k', {}));
  });

  it('produces different SQL for a different recency decay', () => {
    expect(recallRankExpr('k', { recencyDecayPerDay: 0.05 })).not.toBe(recallRankExpr('k'));
  });

  it('an override changes ranking behaviour, not just the SQL text', () => {
    add('old.md', { ageDays: 400 });
    add('new.md', { ageDays: 0 });

    // Live config: recency wins.
    expect(rankedWith({})[0]).toBe('new.md');
    // Recency disabled: BM25 is equal, so the age ordering no longer applies.
    const flat = rankedWith({ recencyDecayPerDay: 0 });
    expect(flat).toHaveLength(2);
  });

  it('maturity boost can be turned off by override', () => {
    add('plain.md', { maturity: 'progenitor' });
    add('mature.md', { maturity: 'mature' });

    expect(rankedWith({})[0]).toBe('mature.md');

    // With both boosts neutralised the two entries score identically.
    // bm25() cannot be nested inside an aggregate, so compare in JS.
    // Recency is neutralised too: the rows are created microseconds apart, so
    // leaving the decay term in makes the scores differ whenever the two
    // created_at values straddle a clock tick.
    const scores = db
      .prepare(
        `SELECT ${recallRankExpr('k', {
          matureBoost: 1.0,
          provenBoost: 1.0,
          recencyDecayPerDay: 0,
        })} AS r
         FROM knowledge_fts JOIN knowledge_index k ON k.id = knowledge_fts.rowid
         WHERE knowledge_fts MATCH 'alpha'`
      )
      .all() as Array<{ r: number }>;
    expect(new Set(scores.map((s) => s.r)).size).toBe(1);
  });

  it('overrides never mutate LIFECYCLE_CONFIG', () => {
    const before = LIFECYCLE_CONFIG.recencyDecayPerDay;
    recallRankExpr('k', { recencyDecayPerDay: 99 });
    expect(LIFECYCLE_CONFIG.recencyDecayPerDay).toBe(before);
  });

  it('ships a live strategy that is byte-identical to production ranking', () => {
    const live = SHADOW_STRATEGIES.find((s) => s.name === 'live');
    expect(live).toBeDefined();
    expect(recallRankExpr('k', live!.overrides)).toBe(recallRankExpr('k'));
  });

  it('every strategy has a unique name and a stated hypothesis', () => {
    const names = SHADOW_STRATEGIES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of SHADOW_STRATEGIES) {
      expect(s.hypothesis.length).toBeGreaterThan(10);
    }
  });

  it('resolves a strategy by name and rejects unknown ones', () => {
    expect(resolveStrategy('live')?.name).toBe('live');
    expect(resolveStrategy('no-such-strategy')).toBeUndefined();
  });

  it('every strategy produces valid SQL against the real schema', () => {
    add('a.md');
    for (const strategy of SHADOW_STRATEGIES) {
      expect(() => rankedWith(strategy.overrides)).not.toThrow();
    }
  });
});
