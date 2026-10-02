import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge, getSessionRecalledIds } from '../../src/db-v2.js';
import { runTrigger, actionOf } from '../../src/trigger/run.js';
import { recordFire, fireCounts, injectedIds } from '../../src/trigger/fires.js';
import type { TriggerPolicy } from '../../src/trigger/policy.js';

/**
 * A2 complete (the query half from `negatives.test.ts` plus the record half),
 * R16's three states, R5's sibling table, R6's census value, and A8's counts.
 *
 * The row this file exists for is the one the brief calls the mandatory first
 * repair: THE SILENCE THAT CANNOT BE READ. Before this, "no knowledge entries
 * recalled this session" was the same sentence whether nothing was asked or
 * everything was asked and nothing was relevant — and five loops read it as
 * inconclusive when it was the answer.
 */

const SESSION = '11111111-2222-3333-4444-555555555555';
const POLICY: TriggerPolicy = { relevance_floor: 0, max_injected: 1, deadline_ms: 2000, provenance: 'test fixture' };
const G039 = 'npx vitest run 2>&1 | tail -8; echo $?';

const ENTRY_299 = [
  '[EXPERIENCE] Piping to tail/head masks the real exit code',
  'TRIGGER: any time output is trimmed with tail or head AND the exit status matters.',
  'ACTION: Read ${PIPESTATUS[0]} instead of $?, which reports the last command in the pipeline',
  'i.e. tail, which almost always succeeds.',
  'CONTEXT: I read the exit code 0 from a pipe and reported a false success.',
].join('\n');

describe('the fire record — three states, one row each', () => {
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

  const states = () =>
    db.prepare('SELECT state, query, injected_ids FROM trigger_fires ORDER BY id')
      .all() as Array<{ state: string; query: string; injected_ids: string }>;

  it('A2 COMPLETE: three commands, three NOT-ASKED fires, zero ids each', () => {
    for (const command of ['git status --porcelain', 'ls -la', 'zzqx --flurb wibble']) {
      const outcome = runTrigger({ db, sessionUuid: SESSION, command, policy: POLICY });
      expect(outcome.state).toBe('not-asked');
      expect(outcome.ids).toEqual([]);
      expect(outcome.additionalContext).toBeUndefined();
    }

    // The record half: three fires, recorded, with nothing injected.
    const rows = states();
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.state === 'not-asked')).toBe(true);
    expect(rows.every((r) => r.injected_ids === '[]')).toBe(true);
    // And the store was never consulted — an empty query is how that is read.
    expect(rows.every((r) => r.query === '')).toBe(true);

    expect(fireCounts(db, SESSION)).toEqual({ 'not-asked': 3, silent: 0, injected: 0 });
  });

  it('R17: a recognised command against a store with no answer is ASKED, SILENT', () => {
    // The state that was invisible before this table existed, and the whole
    // reason it does. Same empty outcome as the rows above; different record.
    const bare = new Database(':memory:');
    initSchemaV2(bare);
    indexKnowledge(bare, {
      vaultPath: 'unrelated.md', key: 'unrelated',
      content: 'Convex table names are case sensitive.', tags: '', source: 'test',
    });

    const outcome = runTrigger({ db: bare, sessionUuid: SESSION, command: G039, policy: POLICY });
    expect(outcome.state).toBe('silent');
    expect(outcome.additionalContext).toBeUndefined();

    const row = bare.prepare('SELECT state, query FROM trigger_fires').get() as { state: string; query: string };
    expect(row.state).toBe('silent');
    // NOT empty — this is what distinguishes it from the three above.
    expect(row.query).toBe('"tail" "exit" "code"');
    expect(fireCounts(bare, SESSION)).toEqual({ 'not-asked': 0, silent: 1, injected: 0 });
    bare.close();
  });

  it('INJECTED: the id and the ACTION reach the model, and the fire says so', () => {
    const outcome = runTrigger({ db, sessionUuid: SESSION, command: G039, policy: POLICY });

    expect(outcome.state).toBe('injected');
    expect(outcome.ids).toEqual([id299]);
    expect(outcome.additionalContext).toContain(String(id299));
    expect(outcome.additionalContext).toContain('PIPESTATUS');
    // The ACTION field, not the whole entry: the CONTEXT line stays out.
    expect(outcome.additionalContext).not.toContain('false success');

    expect(fireCounts(db, SESSION)).toEqual({ 'not-asked': 0, silent: 0, injected: 1 });
    expect(injectedIds(db, SESSION)).toEqual([id299]);
  });

  it('R6: an injection is logged as `hook`, never `explicit` and never `unspecified`', () => {
    runTrigger({ db, sessionUuid: SESSION, command: G039, policy: POLICY });

    const rows = db.prepare('SELECT knowledge_id, recall_trigger FROM recall_log WHERE session_uuid = ?')
      .all(SESSION) as Array<{ knowledge_id: number; recall_trigger: string }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].knowledge_id).toBe(id299);
    // A fire that lands in the census as 'unspecified' is a FAIL (R6) — that
    // is what db-v2's coercion does to a value not in RECALL_TRIGGERS, and it
    // would make the census unable to tell an injection from a forgotten
    // label. Asserted by name rather than by "not explicit".
    expect(rows[0].recall_trigger).toBe('hook');
  });

  it('A8: only INJECTED entries are rateable — a looked-at entry never enters recall_log', () => {
    // The constraint R5 is built to make structural. A silent fire consulted
    // the store and touched rows; none of them may reach the rated set,
    // because ratings there move success_rate, which gates apoptosis.
    const highFloor: TriggerPolicy = { relevance_floor: 1e9, max_injected: 1, deadline_ms: 2000, provenance: 'test fixture' };
    const outcome = runTrigger({ db, sessionUuid: SESSION, command: G039, policy: highFloor });

    expect(outcome.state).toBe('silent');
    expect(getSessionRecalledIds(db, SESSION)).toEqual([]);

    // POSITIVE HALF, same test: lower the floor and the same entry DOES
    // become rateable. Without this the assertion above passes against a
    // recall_log nothing ever writes to.
    runTrigger({ db, sessionUuid: SESSION, command: G039, policy: POLICY });
    expect(getSessionRecalledIds(db, SESSION)).toEqual([id299]);

    expect(fireCounts(db, SESSION)).toEqual({ 'not-asked': 0, silent: 1, injected: 1 });
  });

  it('R7: an INJECTED entry bumps recall_count and last_recalled_at', () => {
    const before = db.prepare('SELECT recall_count, last_recalled_at FROM knowledge_index WHERE id = ?')
      .get(id299) as { recall_count: number; last_recalled_at: string | null };
    expect(before.recall_count).toBe(0);
    expect(before.last_recalled_at).toBeNull();

    runTrigger({ db, sessionUuid: SESSION, command: G039, policy: POLICY });

    const after = db.prepare('SELECT recall_count, last_recalled_at FROM knowledge_index WHERE id = ?')
      .get(id299) as { recall_count: number; last_recalled_at: string | null };
    expect(after.recall_count).toBe(1);
    expect(after.last_recalled_at).not.toBeNull();
  });

  it('R7, the other direction: a LOOKED-AT entry does not bump either column', () => {
    // The half that matters, and the half an implementation can pass by
    // accident. The query considers this entry and the floor excludes it, so
    // it was never in front of anyone — counting it would inflate the number
    // /start's pruning maintenance reads when it asks what has never been
    // recalled. Both columns asserted, because bumping one without the other
    // is a state nothing else in the store would explain.
    const highFloor: TriggerPolicy = { relevance_floor: 1e9, max_injected: 1, deadline_ms: 2000, provenance: 'test fixture' };
    const outcome = runTrigger({ db, sessionUuid: SESSION, command: G039, policy: highFloor });
    expect(outcome.state).toBe('silent');

    const row = db.prepare('SELECT recall_count, last_recalled_at FROM knowledge_index WHERE id = ?')
      .get(id299) as { recall_count: number; last_recalled_at: string | null };
    expect(row.recall_count).toBe(0);
    expect(row.last_recalled_at).toBeNull();
  });

  it('R7: a NOT-ASKED fire touches no counter at all', () => {
    runTrigger({ db, sessionUuid: SESSION, command: 'git status --porcelain', policy: POLICY });

    const row = db.prepare('SELECT recall_count, last_recalled_at FROM knowledge_index WHERE id = ?')
      .get(id299) as { recall_count: number; last_recalled_at: string | null };
    expect(row.recall_count).toBe(0);
    expect(row.last_recalled_at).toBeNull();
  });

  it('R7: repeated injections accumulate, so the counter counts reaches and not entries', () => {
    for (let i = 0; i < 3; i++) runTrigger({ db, sessionUuid: SESSION, command: G039, policy: POLICY });
    const row = db.prepare('SELECT recall_count FROM knowledge_index WHERE id = ?')
      .get(id299) as { recall_count: number };
    expect(row.recall_count).toBe(3);
  });

  it('refuses a fire whose state and ids disagree, in both directions', () => {
    const base = { sessionUuid: SESSION, command: G039, query: '"tail"' };
    expect(() => recordFire(db, { ...base, state: 'injected', injectedIds: [] }))
      .toThrow(/the injection is the ids/);
    expect(() => recordFire(db, { ...base, state: 'silent', injectedIds: [1] }))
      .toThrow(/only an injection carries ids/);
    expect(() => recordFire(db, { ...base, state: 'not-asked', injectedIds: [] }))
      .toThrow(/a derived query means the store was asked/);

    // And nothing was written by any of the three refusals.
    expect(fireCounts(db, SESSION)).toEqual({ 'not-asked': 0, silent: 0, injected: 0 });
  });

  it('the schema itself refuses a fourth state', () => {
    // The CHECK constraint, asserted rather than assumed: three states is a
    // claim the table makes, not only one the TypeScript union makes, and the
    // union is erased at run time.
    expect(() =>
      db.prepare(
        `INSERT INTO trigger_fires (session_uuid, command, query, state, injected_ids, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(SESSION, 'x', '', 'maybe', '[]', new Date().toISOString()),
    ).toThrow(/CHECK constraint/);
  });
});

describe('actionOf', () => {
  it('takes the ACTION field and stops at the next field marker', () => {
    expect(actionOf(ENTRY_299)).toBe(
      'Read ${PIPESTATUS[0]} instead of $?, which reports the last command in the pipeline i.e. tail, which almost always succeeds.',
    );
  });

  it('falls back to the first non-empty line when there is no ACTION field', () => {
    expect(actionOf('\n\nA plain note with no fields.\nSecond line.')).toBe('A plain note with no fields.');
  });

  it('returns empty for empty content rather than throwing', () => {
    expect(actionOf('')).toBe('');
  });
});
