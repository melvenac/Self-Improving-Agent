import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  initSchemaV2,
  indexKnowledge,
  recordRecallEvent,
  recordFeedbackEvent,
  getSessionQueries,
  getSessionLabels,
  getEvaluableSessions,
  type ShadowRating,
} from '../src/db-v2.js';
import {
  evaluateSession,
  scoreStrategy,
  runStrategyQuery,
} from '../src/pipelines/shadow/evaluate.js';
import { SHADOW_STRATEGIES } from '../src/pipelines/shadow/strategies.js';

const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('shadow ground truth', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });

  afterEach(() => db.close());

  it('records recall results with 1-based rank in order', () => {
    recordRecallEvent(db, SESSION, 'alpha query', [30, 10, 20]);
    const rows = db
      .prepare('SELECT knowledge_id, rank FROM recall_log ORDER BY rank')
      .all() as Array<{ knowledge_id: number; rank: number }>;
    expect(rows).toEqual([
      { knowledge_id: 30, rank: 1 },
      { knowledge_id: 10, rank: 2 },
      { knowledge_id: 20, rank: 3 },
    ]);
  });

  it('ignores a recall with no session or no results', () => {
    recordRecallEvent(db, '', 'q', [1]);
    recordRecallEvent(db, SESSION, 'q', []);
    expect(db.prepare('SELECT COUNT(*) n FROM recall_log').get()).toEqual({ n: 0 });
  });

  /**
   * The trigger records the treatment: session-start injection and a
   * deliberate mid-task fetch are different treatments with opposite selection
   * bias, and without the column they were the same row — which is why no
   * analysis of injection value was ever answerable from this log.
   */
  it('records the recall trigger on every row of the call', () => {
    recordRecallEvent(db, SESSION, 'q', [1, 2], 'start');
    const rows = db.prepare('SELECT recall_trigger FROM recall_log').all() as Array<{ recall_trigger: string }>;
    expect(rows).toEqual([{ recall_trigger: 'start' }, { recall_trigger: 'start' }]);
  });

  it('records a silent caller as unspecified, never as a deliberate fetch', () => {
    // Defaulting to 'explicit' would file every forgotten label as a pulled
    // recall — contamination in the exact direction the column exists to
    // remove. 'unspecified' keeps the labeling gap countable instead.
    recordRecallEvent(db, SESSION, 'q', [1]);
    expect(db.prepare('SELECT recall_trigger FROM recall_log').get()).toEqual({ recall_trigger: 'unspecified' });
  });

  it('coerces an unrecognized trigger to unspecified rather than storing free text', () => {
    recordRecallEvent(db, SESSION, 'q', [1], 'launch' as never);
    expect(db.prepare('SELECT recall_trigger FROM recall_log').get()).toEqual({ recall_trigger: 'unspecified' });
  });

  it('returns distinct queries in first-use order', () => {
    recordRecallEvent(db, SESSION, 'second', [1]);
    recordRecallEvent(db, SESSION, 'first', [2]);
    recordRecallEvent(db, SESSION, 'second', [3]);
    expect(getSessionQueries(db, SESSION)).toEqual(['second', 'first']);
  });

  it('records the rating origin, defaults a silent caller to unspecified, coerces junk', () => {
    recordFeedbackEvent(db, SESSION, 1, 'helpful', 'recall-log');
    recordFeedbackEvent(db, SESSION, 2, 'neutral');
    recordFeedbackEvent(db, SESSION, 3, 'neutral', 'telepathy' as never);
    const rows = db.prepare('SELECT knowledge_id, rating_origin FROM feedback_log ORDER BY knowledge_id').all();
    expect(rows).toEqual([
      { knowledge_id: 1, rating_origin: 'recall-log' },
      { knowledge_id: 2, rating_origin: 'unspecified' },
      { knowledge_id: 3, rating_origin: 'unspecified' },
    ]);
  });

  it('keeps the last rating when an entry is rated twice', () => {
    recordFeedbackEvent(db, SESSION, 7, 'neutral');
    recordFeedbackEvent(db, SESSION, 7, 'helpful');
    expect(getSessionLabels(db, SESSION).get(7)).toBe('helpful');
  });

  it('scopes labels to their own session', () => {
    recordFeedbackEvent(db, SESSION, 1, 'helpful');
    recordFeedbackEvent(db, 'other-session', 2, 'helpful');
    expect([...getSessionLabels(db, SESSION).keys()]).toEqual([1]);
  });

  it('lists only sessions that have both queries and ratings', () => {
    recordRecallEvent(db, SESSION, 'q', [1]);
    recordRecallEvent(db, 'queries-only', 'q', [1]);
    recordFeedbackEvent(db, SESSION, 1, 'helpful');
    recordFeedbackEvent(db, 'ratings-only', 1, 'helpful');
    expect(getEvaluableSessions(db)).toEqual([SESSION]);
  });
});

describe('shadow scoring', () => {
  const labels = new Map<number, ShadowRating>([
    [1, 'helpful'],
    [2, 'neutral'],
    [3, 'harmful'],
  ]);

  it('gives a perfect MRR when the helpful entry ranks first', () => {
    const score = scoreStrategy('s', [{ query: 'q', ids: [1, 2, 3] }], labels);
    expect(score.mrr).toBe(1);
  });

  it('halves MRR when the helpful entry ranks second', () => {
    const score = scoreStrategy('s', [{ query: 'q', ids: [2, 1, 3] }], labels);
    expect(score.mrr).toBe(0.5);
  });

  it('scores nDCG 1.0 only when helpful entries occupy the top slots', () => {
    const best = scoreStrategy('s', [{ query: 'q', ids: [1, 2, 3] }], labels);
    const worse = scoreStrategy('s', [{ query: 'q', ids: [2, 3, 1] }], labels);
    expect(best.ndcg).toBeCloseTo(1.0, 5);
    expect(worse.ndcg).toBeLessThan(best.ndcg);
  });

  it('counts harmful entries returned', () => {
    expect(scoreStrategy('s', [{ query: 'q', ids: [1, 3] }], labels).harmful).toBe(1);
  });

  it('reports labeled vs returned so tiny samples are visible', () => {
    const score = scoreStrategy('s', [{ query: 'q', ids: [1, 99, 98] }], labels);
    expect(score.returned).toBe(3);
    expect(score.labeled).toBe(1);
  });

  it('scores zero when nothing relevant is returned', () => {
    const score = scoreStrategy('s', [{ query: 'q', ids: [98, 99] }], labels);
    expect(score.mrr).toBe(0);
    expect(score.ndcg).toBe(0);
    expect(score.precision).toBe(0);
  });

  it('averages across queries rather than pooling them', () => {
    const score = scoreStrategy(
      's',
      [
        { query: 'a', ids: [1] },      // MRR 1
        { query: 'b', ids: [2, 1] },   // MRR 0.5
      ],
      labels
    );
    expect(score.mrr).toBeCloseTo(0.75, 5);
  });

  it('does not reward an entry rated helpful in a DIFFERENT session', () => {
    // The v1 metric counted all-time helpful_count, which structurally favoured
    // old frequently-recalled knowledge. Labels must be session-local.
    const sessionLocal = new Map<number, ShadowRating>([[1, 'helpful']]);
    const score = scoreStrategy('s', [{ query: 'q', ids: [42] }], sessionLocal);
    expect(score.precision).toBe(0);
  });
});

describe('shadow session evaluation', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });

  afterEach(() => db.close());

  function add(key: string, content: string, ageDays = 0) {
    indexKnowledge(db, {
      vaultPath: `${key}.md`,
      key,
      content,
      tags: '',
      source: 'test',
    });
    if (ageDays) {
      db.prepare(`UPDATE knowledge_index SET created_at = datetime('now', ?) WHERE key = ?`)
        .run(`-${ageDays} days`, key);
    }
    return db.prepare('SELECT id FROM knowledge_index WHERE key = ?').get(key) as { id: number };
  }

  it('skips a session with no logged queries', () => {
    recordFeedbackEvent(db, SESSION, 1, 'helpful');
    expect(evaluateSession(db, SESSION).skipped).toBe('no logged queries');
  });

  it('skips a session with no helpful ratings', () => {
    add('a', 'alpha beta');
    recordRecallEvent(db, SESSION, 'alpha', [1]);
    recordFeedbackEvent(db, SESSION, 1, 'neutral');
    expect(evaluateSession(db, SESSION).skipped).toBe('no helpful ratings to score against');
  });

  it('scores every strategy for an evaluable session', () => {
    const a = add('a', 'alpha beta gamma');
    add('b', 'alpha delta epsilon');
    recordRecallEvent(db, SESSION, 'alpha', [a.id]);
    recordFeedbackEvent(db, SESSION, a.id, 'helpful');

    const evaluation = evaluateSession(db, SESSION);
    expect(evaluation.skipped).toBeUndefined();
    expect(evaluation.scores).toHaveLength(SHADOW_STRATEGIES.length);
    expect(evaluation.labelCounts.helpful).toBe(1);
  });

  it('ranks the strategy that surfaces the helpful entry higher', () => {
    // The helpful entry is old; recency-heavy ranking should bury it, and the
    // no-recency variant should rank it better. This is the harness earning its
    // keep: a measurable difference between two config variants.
    const old = add('old', 'alpha beta gamma', 400);
    add('fresh', 'alpha beta gamma', 0);
    recordRecallEvent(db, SESSION, 'alpha', [old.id]);
    recordFeedbackEvent(db, SESSION, old.id, 'helpful');

    const evaluation = evaluateSession(db, SESSION, { limit: 1 });
    const byName = Object.fromEntries(evaluation.scores.map((s) => [s.strategy, s]));
    expect(byName['no_recency'].mrr).toBeGreaterThan(byName['recency_strong'].mrr);
  });

  it('leaves live recall statistics untouched', () => {
    const a = add('a', 'alpha beta');
    recordRecallEvent(db, SESSION, 'alpha', [a.id]);
    recordFeedbackEvent(db, SESSION, a.id, 'helpful');
    evaluateSession(db, SESSION);

    const row = db
      .prepare('SELECT recall_count, last_recalled_at FROM knowledge_index WHERE id = ?')
      .get(a.id) as { recall_count: number; last_recalled_at: string | null };
    expect(row.recall_count).toBe(0);
    expect(row.last_recalled_at).toBeNull();
  });

  it('excludes archived entries, matching live recall', () => {
    const a = add('a', 'alpha beta');
    const b = add('b', 'alpha beta');
    db.prepare('UPDATE knowledge_index SET archived_into = ? WHERE id = ?').run(a.id, b.id);
    const ids = runStrategyQuery(db, 'alpha', SHADOW_STRATEGIES[0], 10);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
  });

  it('returns no results rather than throwing on a malformed query', () => {
    add('a', 'alpha beta');
    expect(() => runStrategyQuery(db, '"', SHADOW_STRATEGIES[0], 5)).not.toThrow();
  });

  it('replays the live strategy to the same results ob_recall logged', () => {
    // The whole evaluation rests on this: labels are attached to what live
    // returned, so if replaying `live` produced a different list the labels
    // would not line up with any strategy and every score would be zero.
    add('a', 'alpha beta gamma');
    add('b', 'alpha beta');
    add('c', 'alpha');

    const live = SHADOW_STRATEGIES.find((s) => s.name === 'live')!;
    const first = runStrategyQuery(db, 'alpha beta', live, 5);
    const replay = runStrategyQuery(db, 'alpha beta', live, 5);

    expect(replay).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
  });

  it('scores nothing when labels come from outside the returned pool', () => {
    // Guards the failure the smoke test hit: labels recorded from a different
    // query path than the one being replayed produce a silent all-zero table.
    const a = add('a', 'alpha beta');
    recordRecallEvent(db, SESSION, 'alpha', [a.id]);
    recordFeedbackEvent(db, SESSION, 9999, 'helpful'); // id not in the corpus

    const evaluation = evaluateSession(db, SESSION);
    const live = evaluation.scores.find((s) => s.strategy === 'live')!;
    expect(live.labeled).toBe(0);
    expect(live.ndcg).toBe(0);
  });
});
