/**
 * Loop 6 C1 — the replay must be evaluated as of the session it replays.
 *
 * Three present-tense inputs leaked into the shadow harness, each standing in for
 * an as-of-then value: which entries exist (corpus), what lifecycle values they
 * hold (maturity/success_rate), and how old they are (the clock). These pin all
 * three, and pin that production ranking is unchanged.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  initSchemaV2,
  indexKnowledge,
  recordRecallEvent,
  recordFeedbackEvent,
  getSessionAsOf,
  captureLifecycleSnapshot,
  replayLifecycleAsOf,
  countEntriesAfter,
} from '../src/db-v2.js';
import { runStrategyQuery, evaluateSession } from '../src/pipelines/shadow/evaluate.js';
import { recallRankExpr, asOfLiteral, type LifecycleSnapshot } from '../src/lifecycle.js';
import { SHADOW_STRATEGIES } from '../src/pipelines/shadow/strategies.js';

const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const LIVE = SHADOW_STRATEGIES.find((s) => s.name === 'live')!;

/** Insert an entry with an explicit created_at — indexKnowledge always stamps now. */
function seed(
  db: Database.Database,
  key: string,
  content: string,
  createdAt: string,
  extra: { maturity?: string; successRate?: number | null } = {},
): number {
  indexKnowledge(db, {
    vaultPath: `${key}.md`,
    key,
    tags: '',
    content,
    maturity: extra.maturity,
    successRate: extra.successRate ?? null,
  });
  db.prepare(`UPDATE knowledge_index SET created_at = ? WHERE key = ?`).run(createdAt, key);
  const row = db.prepare(`SELECT id FROM knowledge_index WHERE key = ?`).get(key) as { id: number };
  return row.id;
}

function backdateRecall(db: Database.Database, at: string): void {
  db.prepare(`UPDATE recall_log SET created_at = ? WHERE session_uuid = ?`).run(at, SESSION);
}

describe('replay corpus cutoff', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });
  afterEach(() => db.close());

  /**
   * The acceptance criterion. An entry written after the session could never have
   * been recalled by it and can therefore never carry one of its labels, so
   * returning it can only dilute every strategy that ranks it highly — which is
   * what made the recency rows unreadable.
   */
  it('never returns an entry created after the replayed session', () => {
    const before = seed(db, 'old-entry', 'alpha beta gamma', '2026-01-01T00:00:00.000Z');
    const after = seed(db, 'future-entry', 'alpha beta gamma', '2026-06-01T00:00:00.000Z');

    const asOf = '2026-03-01T00:00:00.000Z';
    const ids = runStrategyQuery(db, 'alpha', LIVE, 10, { asOf });

    expect(ids).toContain(before);
    expect(ids).not.toContain(after);
  });

  it('returns the future entry when no cutoff is supplied — the defect, pinned', () => {
    seed(db, 'old-entry', 'alpha beta gamma', '2026-01-01T00:00:00.000Z');
    const after = seed(db, 'future-entry', 'alpha beta gamma', '2026-06-01T00:00:00.000Z');

    expect(runStrategyQuery(db, 'alpha', LIVE, 10, {})).toContain(after);
  });

  it('counts the excluded entries rather than dropping them silently', () => {
    seed(db, 'old-entry', 'alpha', '2026-01-01T00:00:00.000Z');
    seed(db, 'future-one', 'alpha', '2026-06-01T00:00:00.000Z');
    seed(db, 'future-two', 'alpha', '2026-07-01T00:00:00.000Z');

    expect(countEntriesAfter(db, '2026-03-01T00:00:00.000Z')).toBe(2);
  });

  it('derives the as-of moment from the session earliest recall', () => {
    const id = seed(db, 'e', 'alpha', '2026-01-01T00:00:00.000Z');
    recordRecallEvent(db, SESSION, 'alpha', [id], 'start');
    backdateRecall(db, '2026-02-02T03:04:05.000Z');

    expect(getSessionAsOf(db, SESSION)).toBe('2026-02-02T03:04:05.000Z');
  });

  it('reports null — not "now" — for a session that logged no recalls', () => {
    expect(getSessionAsOf(db, 'no-such-session')).toBeNull();
  });
});

describe('lifecycle snapshot substitution', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });
  afterEach(() => db.close());

  /**
   * The production confound. Stage 2 promotes an entry, then Stage 6 ranks with
   * the promotion already applied — so the entry the session rated helpful is
   * measured as though it had been mature all along.
   */
  it('ranks with the pre-feedback maturity, not the value feedback just wrote', () => {
    // Deliberately unequal bm25: `plain` is the better lexical match, so the
    // only thing that can put `boosted` first is the maturity multiplier. Equal
    // content would tie and the assertion would pass on row order alone.
    const boosted = seed(db, 'boosted', 'alpha beta gamma', '2026-01-01T00:00:00.000Z', {
      maturity: 'mature',
    });
    const plain = seed(db, 'plain', 'alpha', '2026-01-01T00:00:00.000Z');

    // Live columns say mature: the 1.5x boost overcomes the weaker match.
    expect(runStrategyQuery(db, 'alpha', LIVE, 10, {})).toEqual([boosted, plain]);

    // As of the session it was still a progenitor, so no boost applies and the
    // better lexical match wins — the order the session actually saw.
    const snapshot: LifecycleSnapshot = new Map([
      [boosted, { maturity: 'progenitor' as const, success_rate: null }],
    ]);
    expect(runStrategyQuery(db, 'alpha', LIVE, 10, { snapshot })).toEqual([plain, boosted]);
  });

  /**
   * COALESCE(override, live) would silently fall back to today's success_rate
   * whenever the historical answer was "unrated" — reinstating the confound for
   * exactly the entries this session's own labels moved off NULL.
   */
  it('treats a snapshotted NULL success_rate as unrated, not as missing', () => {
    const penalised = seed(db, 'penalised', 'alpha shared', '2026-01-01T00:00:00.000Z', {
      successRate: 0.1,
    });
    const plain = seed(db, 'plain', 'alpha shared', '2026-01-01T00:00:00.000Z');

    // Live: 0.1 is below the apoptosis threshold, so the penalty demotes it.
    expect(runStrategyQuery(db, 'alpha', LIVE, 10, {})[0]).toBe(plain);

    // As of the session it had no non-neutral ratings at all — no penalty.
    const snapshot: LifecycleSnapshot = new Map([
      [penalised, { maturity: 'progenitor' as const, success_rate: null }],
    ]);
    const ranked = runStrategyQuery(db, 'alpha', LIVE, 10, { snapshot });
    expect(ranked).toHaveLength(2);
    expect(ranked[0]).toBe(penalised);
  });

  it('leaves entries absent from the snapshot on their live values', () => {
    const untouched = seed(db, 'untouched', 'alpha', '2026-01-01T00:00:00.000Z', {
      maturity: 'mature',
    });
    const ids = runStrategyQuery(db, 'alpha', LIVE, 10, {
      snapshot: new Map([[999, { maturity: 'progenitor' as const, success_rate: null }]]),
    });
    expect(ids).toEqual([untouched]);
  });

  it('captures exactly the ids handed to it, and skips ids that do not exist', () => {
    const a = seed(db, 'a', 'alpha', '2026-01-01T00:00:00.000Z', { maturity: 'proven' });
    seed(db, 'b', 'beta', '2026-01-01T00:00:00.000Z', { maturity: 'mature' });

    const snap = captureLifecycleSnapshot(db, [a, 4242]);
    expect([...snap.keys()]).toEqual([a]);
    expect(snap.get(a)).toEqual({ maturity: 'proven', success_rate: null });
  });
});

describe('lifecycle replay from feedback_log', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });
  afterEach(() => db.close());

  /** Promotion is gated on helpful count AND success_rate, so the replay carries both. */
  it('promotes to proven only from ratings at or before the cutoff', () => {
    const id = seed(db, 'entry', 'alpha', '2026-01-01T00:00:00.000Z');
    for (let i = 0; i < 3; i++) recordFeedbackEvent(db, SESSION, id, 'helpful');
    db.prepare(`UPDATE feedback_log SET created_at = '2026-02-01T00:00:00.000Z'`).run();

    const early = replayLifecycleAsOf(db, '2026-01-15T00:00:00.000Z');
    expect(early.snapshot.get(id)).toBeUndefined();

    const late = replayLifecycleAsOf(db, '2026-03-01T00:00:00.000Z');
    expect(late.snapshot.get(id)).toEqual({ maturity: 'proven', success_rate: 1 });
  });

  /**
   * Order matters, and the replay preserves it. The harmful ratings land first,
   * so when the third helpful arrives the rate is 3/7 = 0.43 — under the 0.5
   * advance gate — and promotion is withheld.
   */
  it('withholds promotion when success_rate is below the advance threshold', () => {
    const id = seed(db, 'entry', 'alpha', '2026-01-01T00:00:00.000Z');
    for (let i = 0; i < 4; i++) recordFeedbackEvent(db, SESSION, id, 'harmful');
    for (let i = 0; i < 3; i++) recordFeedbackEvent(db, SESSION, id, 'helpful');

    const { snapshot } = replayLifecycleAsOf(db, '2099-01-01T00:00:00.000Z');
    expect(snapshot.get(id)!.maturity).toBe('progenitor');
  });

  /**
   * Maturity is monotonic in `evaluateLifecycle`: it advances and is never walked
   * back, so an entry promoted while its rate was high stays promoted after the
   * rate collapses. The replay reproduces that faithfully rather than correcting
   * it — this pins the production behaviour, it does not endorse it. Noted for
   * Loop 7: nothing currently demotes.
   */
  it('reproduces production monotonicity — a promotion survives a later collapse', () => {
    const id = seed(db, 'entry', 'alpha', '2026-01-01T00:00:00.000Z');
    for (let i = 0; i < 3; i++) recordFeedbackEvent(db, SESSION, id, 'helpful');
    for (let i = 0; i < 4; i++) recordFeedbackEvent(db, SESSION, id, 'harmful');

    const { snapshot } = replayLifecycleAsOf(db, '2099-01-01T00:00:00.000Z');
    expect(snapshot.get(id)!.maturity).toBe('proven');
    expect(snapshot.get(id)!.success_rate).toBeCloseTo(3 / 7);
  });

  /** Ratings the live counters know about but the log predates cannot be recovered. */
  it('reports unlogged ratings rather than assuming the log is complete', () => {
    const id = seed(db, 'entry', 'alpha', '2026-01-01T00:00:00.000Z');
    db.prepare(`UPDATE knowledge_index SET helpful = 5, harmful = 1 WHERE id = ?`).run(id);
    recordFeedbackEvent(db, SESSION, id, 'helpful');

    const { coverage } = replayLifecycleAsOf(db, '2099-01-01T00:00:00.000Z');
    expect(coverage.unlogged).toBe(5);
    expect(coverage.ratingsBefore).toBe(1);
  });
});

describe('the ranking clock', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });
  afterEach(() => db.close());

  /** Production passes nothing and must stay byte-identical to before Loop 6. */
  it('defaults to now, so production ranking is unchanged', () => {
    expect(asOfLiteral()).toBe("'now'");
    expect(asOfLiteral(null)).toBe("'now'");
    expect(recallRankExpr('k', {})).toContain("julianday('now')");
  });

  it('anchors the age term to the replayed moment when given one', () => {
    const expr = recallRankExpr('k', {}, '2026-02-01T00:00:00.000Z');
    expect(expr).toContain("julianday('2026-02-01T00:00:00.000Z')");
    expect(expr).not.toContain("julianday('now')");
  });

  /** A silent fallback to 'now' would reinstate the defect invisibly. */
  it('throws on a malformed timestamp rather than falling back to now', () => {
    expect(() => asOfLiteral("'); DROP TABLE knowledge_index; --")).toThrow(/ISO-8601/);
    expect(() => asOfLiteral('yesterday')).toThrow(/ISO-8601/);
  });

  /**
   * Replaying from today ages every entry by the same constant, which preserves
   * the age gap but collapses the divisor ratio that actually ranks — flattening
   * recency hardest for the strongest decay.
   */
  it('separates entries by age that an unanchored clock would flatten', () => {
    const fresh = seed(db, 'fresh', 'alpha shared', '2026-02-20T00:00:00.000Z');
    const stale = seed(db, 'stale', 'alpha shared', '2026-01-01T00:00:00.000Z');
    const strong = SHADOW_STRATEGIES.find((s) => s.name === 'recency_strong')!;

    const ids = runStrategyQuery(db, 'alpha', strong, 10, { asOf: '2026-03-01T00:00:00.000Z' });
    expect(ids).toEqual([fresh, stale]);
  });
});

describe('evaluateSession replay provenance', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
  });
  afterEach(() => db.close());

  it('records the as-of moment and what it excluded', () => {
    const id = seed(db, 'entry', 'alpha beta', '2026-01-01T00:00:00.000Z');
    seed(db, 'future', 'alpha beta', '2026-09-01T00:00:00.000Z');

    recordRecallEvent(db, SESSION, 'alpha', [id], 'start');
    backdateRecall(db, '2026-02-01T00:00:00.000Z');
    recordFeedbackEvent(db, SESSION, id, 'helpful');

    const result = evaluateSession(db, SESSION);
    expect(result.asOf).toBe('2026-02-01T00:00:00.000Z');
    expect(result.excludedAsNotYetCreated).toBe(1);
    expect(result.skipped).toBeUndefined();
  });

  it('reports asOf null for a session with no recalls instead of silently using now', () => {
    const result = evaluateSession(db, 'unknown-session');
    expect(result.asOf).toBeNull();
    expect(result.skipped).toBe('no logged queries');
  });

  it('prefers a supplied production snapshot over reconstructing one', () => {
    const id = seed(db, 'entry', 'alpha', '2026-01-01T00:00:00.000Z');
    recordRecallEvent(db, SESSION, 'alpha', [id], 'start');
    backdateRecall(db, '2026-02-01T00:00:00.000Z');
    recordFeedbackEvent(db, SESSION, id, 'helpful');

    const supplied: LifecycleSnapshot = new Map([
      [id, { maturity: 'progenitor' as const, success_rate: null }],
    ]);
    const result = evaluateSession(db, SESSION, { snapshot: supplied });
    expect(result.snapshotted).toBe(1);
    expect(result.coverage).toBeUndefined();
  });
});
