import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge, getSessionRecalledIds } from '../../src/db-v2.js';
import { runTrigger, withholdDraw } from '../../src/trigger/run.js';
import { fireCounts } from '../../src/trigger/fires.js';
import { loadPolicy, TriggerPolicySchema, type TriggerPolicy } from '../../src/trigger/policy.js';

/**
 * T-331: the recall trigger's withheld arm (RSI research idea #1). A share of
 * would-be injections is withheld, by a hash of the session and the ids, and
 * recorded as a silent fire carrying `withheld:<ids>`, so an injection can be
 * compared with the same match left uninjected. It ships OFF (0).
 */

const SESSION = '11111111-2222-3333-4444-555555555555';
const BASE: TriggerPolicy = { relevance_floor: 0, max_injected: 1, deadline_ms: 2000, provenance: 'test fixture' };
const G039 = 'npx vitest run 2>&1 | tail -8; echo $?';
const G039_B = 'npx tsc 2>&1 | tail -3; echo $?';

const ENTRY_299 = [
  '[EXPERIENCE] Piping to tail/head masks the real exit code',
  'TRIGGER: any time output is trimmed with tail or head AND the exit status matters.',
  'ACTION: Read ${PIPESTATUS[0]} instead of $?, which reports the last command in the pipeline',
  'i.e. tail, which almost always succeeds.',
].join('\n');

describe('T-331 withheld arm', () => {
  let db: Database.Database;
  let id299: number;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
    indexKnowledge(db, {
      vaultPath: 'pipe-to-tail.md', key: 'pipe-to-tail-masks-exit-code',
      content: ENTRY_299, tags: '', source: 'test',
    });
    id299 = (db.prepare('SELECT id FROM knowledge_index WHERE key = ?')
      .get('pipe-to-tail-masks-exit-code') as { id: number }).id;
  });

  afterEach(() => db.close());

  const rows = () =>
    db.prepare('SELECT state, query, injected_ids FROM trigger_fires ORDER BY id')
      .all() as Array<{ state: string; query: string; injected_ids: string }>;
  const recallCount = () =>
    (db.prepare('SELECT recall_count FROM knowledge_index WHERE id = ?').get(id299) as { recall_count: number }).recall_count;

  it('W1: at fraction 1 a would-be injection is withheld: silent, withheld:<id> in the query, nothing recalled', () => {
    const outcome = runTrigger({ db, sessionUuid: SESSION, command: G039, policy: { ...BASE, withhold_fraction: 1 } });
    expect(outcome.state).toBe('silent');
    expect(outcome.ids).toEqual([]);
    expect(outcome.withheldIds).toEqual([id299]);
    expect(outcome.additionalContext).toBeUndefined();
    const r = rows();
    expect(r).toHaveLength(1);
    expect(r[0].state).toBe('silent');
    expect(r[0].injected_ids).toBe('[]');
    expect(r[0].query.split(/\s+/)).toContain(`withheld:${id299}`);
    expect(getSessionRecalledIds(db, SESSION)).toEqual([]);
    expect(recallCount()).toBe(0);
    expect(fireCounts(db, SESSION)).toEqual({ 'not-asked': 0, silent: 1, injected: 0 });
  });

  it('W2: at fraction 0 the same match is injected exactly as before, with no withheld token', () => {
    const outcome = runTrigger({ db, sessionUuid: SESSION, command: G039, policy: { ...BASE, withhold_fraction: 0 } });
    expect(outcome.state).toBe('injected');
    expect(outcome.ids).toEqual([id299]);
    expect(outcome.withheldIds).toBeUndefined();
    expect(rows()[0].query).not.toContain('withheld:');
    expect(recallCount()).toBe(1);
  });

  it('W3: ON since 11-01 (Aaron): the shipped policy says 0.5, an absent field injects, and the schema refuses out-of-range values', () => {
    expect(loadPolicy().withhold_fraction).toBe(0.5);
    const outcome = runTrigger({ db, sessionUuid: SESSION, command: G039, policy: BASE });
    expect(outcome.state).toBe('injected');
    expect(outcome.withheldIds).toBeUndefined();
    expect(TriggerPolicySchema.safeParse({ ...BASE, withhold_fraction: 1.5 }).success).toBe(false);
    expect(TriggerPolicySchema.safeParse({ ...BASE, withhold_fraction: -0.1 }).success).toBe(false);
    expect(TriggerPolicySchema.safeParse({ ...BASE, withhold_fraction: 0.5 }).success).toBe(true);
  });

  it('W4: the draw is deterministic, in [0, 1), about even across sessions, and the cut is strict (draw < fraction)', () => {
    const d = withholdDraw(SESSION, [id299]);
    expect(withholdDraw(SESSION, [id299])).toBe(d);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThan(1);
    let under = 0;
    for (let i = 0; i < 2000; i++) if (withholdDraw(`session-${i}`, [1]) < 0.5) under++;
    expect(under).toBeGreaterThan(900);
    expect(under).toBeLessThan(1100);
    // The boundary: a fraction equal to the draw injects; a hair above withholds.
    expect(runTrigger({ db, sessionUuid: SESSION, command: G039, policy: { ...BASE, withhold_fraction: d } }).state).toBe('injected');
    expect(runTrigger({ db, sessionUuid: SESSION, command: G039, policy: { ...BASE, withhold_fraction: Math.min(1, d + 1e-9) } }).state).toBe('silent');
  });

  it('W5: the arm is per session and entry, not per command: two commands reaching one entry get the same arm', () => {
    const d = withholdDraw(SESSION, [id299]);
    const policy = { ...BASE, withhold_fraction: Math.min(1, d + 1e-9) };
    const a = runTrigger({ db, sessionUuid: SESSION, command: G039, policy });
    const b = runTrigger({ db, sessionUuid: SESSION, command: G039_B, policy });
    expect(a.withheldIds).toEqual([id299]);
    expect(b.withheldIds).toEqual([id299]);
  });
});
