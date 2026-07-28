import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  initSchemaV2,
  indexKnowledge,
  recordRecallEvent,
  recordFeedbackEvent,
} from '../src/db-v2.js';
import {
  runShadowStage,
  readShadowLog,
  appendShadowLog,
  aggregateShadowLog,
  formatShadowReport,
  MIN_SESSIONS_FOR_VERDICT,
  type ShadowLogEntry,
} from '../src/pipelines/shadow/index.js';

const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function entry(session: string, scores: Array<[string, number, number, number]>): ShadowLogEntry {
  return {
    date: '2026-07-28',
    session_uuid: session,
    queries: ['q'],
    label_counts: { helpful: 1, harmful: 0, neutral: 0 },
    scores: scores.map(([strategy, ndcg, mrr, harmful]) => ({
      strategy, ndcg, mrr, harmful, precision: 0, labeled: 1, returned: 1,
    })),
  };
}

describe('shadow log', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'shadow-'));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  it('returns an empty history when the log does not exist', () => {
    expect(readShadowLog(join(dir, 'nope.jsonl'))).toEqual([]);
  });

  it('creates missing parent directories when appending', () => {
    const path = join(dir, 'nested', 'deep', 'shadow.jsonl');
    appendShadowLog(path, entry(SESSION, [['live', 1, 1, 0]]));
    expect(existsSync(path)).toBe(true);
  });

  it('round-trips appended entries', () => {
    const path = join(dir, 'shadow.jsonl');
    appendShadowLog(path, entry('s1', [['live', 1, 1, 0]]));
    appendShadowLog(path, entry('s2', [['live', 0.5, 0.5, 0]]));
    expect(readShadowLog(path).map((e) => e.session_uuid)).toEqual(['s1', 's2']);
  });

  it('skips a torn line instead of discarding the whole history', () => {
    const path = join(dir, 'shadow.jsonl');
    appendShadowLog(path, entry('s1', [['live', 1, 1, 0]]));
    writeFileSync(path, readFileSync(path, 'utf-8') + '{"broken\n');
    appendShadowLog(path, entry('s2', [['live', 1, 1, 0]]));
    expect(readShadowLog(path)).toHaveLength(2);
  });
});

describe('shadow aggregation', () => {
  it('averages each strategy across sessions and sorts by nDCG', () => {
    const rows = aggregateShadowLog([
      entry('s1', [['live', 0.4, 0.5, 1], ['no_recency', 0.8, 0.9, 0]]),
      entry('s2', [['live', 0.6, 0.5, 1], ['no_recency', 0.8, 0.9, 0]]),
    ]);
    expect(rows[0].strategy).toBe('no_recency');
    expect(rows[0].meanNdcg).toBeCloseTo(0.8, 5);
    expect(rows[1].strategy).toBe('live');
    expect(rows[1].meanNdcg).toBeCloseTo(0.5, 5);
    expect(rows[1].harmful).toBe(2);
    expect(rows[0].sessions).toBe(2);
  });

  it('reports no evaluated sessions on an empty history', () => {
    expect(formatShadowReport([])).toContain('no evaluated sessions');
  });

  it('refuses to name a winner below the minimum sample', () => {
    const report = formatShadowReport([entry('s1', [['live', 0.1, 0.1, 0], ['no_recency', 0.9, 0.9, 0]])]);
    expect(report).toContain('sample too small');
    expect(report).not.toContain('Candidate:');
  });

  it('names a candidate once the sample is large enough', () => {
    const entries = Array.from({ length: MIN_SESSIONS_FOR_VERDICT }, (_, i) =>
      entry(`s${i}`, [['live', 0.2, 0.2, 0], ['no_recency', 0.9, 0.9, 0]])
    );
    const report = formatShadowReport(entries);
    expect(report).toContain('Candidate: no_recency');
  });

  it('says so plainly when live is still the best', () => {
    const entries = Array.from({ length: MIN_SESSIONS_FOR_VERDICT }, (_, i) =>
      entry(`s${i}`, [['live', 0.9, 0.9, 0], ['no_recency', 0.2, 0.2, 0]])
    );
    expect(formatShadowReport(entries)).toContain('No variant beats live');
  });
});

describe('shadow stage', () => {
  let db: Database.Database;
  let dir: string;
  let logPath: string;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
    dir = mkdtempSync(join(tmpdir(), 'shadow-stage-'));
    logPath = join(dir, 'shadow-recall.jsonl');
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  function seed() {
    indexKnowledge(db, {
      vaultPath: 'a.md', key: 'a', content: 'alpha beta gamma', tags: '', source: 'test',
    });
    const { id } = db.prepare('SELECT id FROM knowledge_index WHERE key = ?').get('a') as { id: number };
    recordRecallEvent(db, SESSION, 'alpha', [id]);
    recordFeedbackEvent(db, SESSION, id, 'helpful');
    return id;
  }

  it('skips cleanly when there is no session uuid', () => {
    const result = runShadowStage({ db, sessionUuid: '', logPath });
    expect(result.evaluated).toBe(false);
    expect(result.skipped).toBe('no session uuid');
    expect(existsSync(logPath)).toBe(false);
  });

  it('skips without writing a log line when there is no ground truth', () => {
    const result = runShadowStage({ db, sessionUuid: SESSION, logPath });
    expect(result.evaluated).toBe(false);
    expect(existsSync(logPath)).toBe(false);
  });

  it('evaluates and appends one line for a scorable session', () => {
    seed();
    const result = runShadowStage({ db, sessionUuid: SESSION, logPath });

    expect(result.evaluated).toBe(true);
    expect(result.queries).toBe(1);
    expect(result.leader).toBeTruthy();

    const log = readShadowLog(logPath);
    expect(log).toHaveLength(1);
    expect(log[0].session_uuid).toBe(SESSION);
    expect(log[0].scores.length).toBe(result.strategies);
  });

  it('appends rather than overwriting across sessions', () => {
    seed();
    runShadowStage({ db, sessionUuid: SESSION, logPath });
    recordRecallEvent(db, 'second-session', 'alpha', [1]);
    recordFeedbackEvent(db, 'second-session', 1, 'helpful');
    runShadowStage({ db, sessionUuid: 'second-session', logPath });

    expect(readShadowLog(logPath)).toHaveLength(2);
  });

  it('does not throw when the log path is unwritable', () => {
    seed();
    // A path whose parent is an existing file cannot be created.
    const blocked = join(dir, 'shadow-recall.jsonl', 'nested.jsonl');
    writeFileSync(logPath, '');
    expect(() => runShadowStage({ db, sessionUuid: SESSION, logPath: blocked })).not.toThrow();
  });
});
