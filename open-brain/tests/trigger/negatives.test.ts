import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';
import { deriveQuery, queryStore } from '../../src/trigger/query.js';

/**
 * A2 (query half) and A3 — the two rows about SILENCE.
 *
 * A2's record half — "and the fire is recorded for each, with zero ids" —
 * lands with the fires table, and A2 becomes one test at that commit. What is
 * here is the half that can be observed without it: the query returns nothing.
 *
 * Every negative below is paired with the positive that would fail the same
 * way (T-156, and amendment 1's Planner 51/52 both being this class). A
 * negative assertion against a path nothing reaches is indistinguishable from
 * a passing one, and this loop has already produced two of those in the brief.
 */

const add = (db: Database.Database, key: string, content: string): number => {
  indexKnowledge(db, { vaultPath: `${key}.md`, key, content, tags: '', source: 'test' });
  return (db.prepare('SELECT id FROM knowledge_index WHERE key = ?').get(key) as { id: number }).id;
};

/** Text that clears any floor for the G-039 shape — the positive control. */
const STRONG =
  'Piping to tail masks the real exit code: the exit code you read after a pipe is tail exit code, not the command exit code.';

describe('A2 — commands the trigger says nothing about', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
    add(db, 'pipe-to-tail-masks-exit-code', STRONG);
    add(db, 'git-porcelain', 'git status --porcelain is the machine-readable form and is safe to parse.');
    add(db, 'ls-listing', 'ls -la lists a directory including dotfiles.');
  });

  afterEach(() => db.close());

  it.each([
    ['git status --porcelain'],
    ['ls -la'],
    ['zzqx --flurb wibble'],
  ])('returns nothing for %s', (command) => {
    expect(queryStore({ db, command, floor: 0 })).toEqual([]);
  });

  it('derives no query at all for those three, which is WHY they are silent', () => {
    // The distinction matters and is invisible from the result alone: a
    // command that derives no query was never asked about, and a command that
    // derives one and clears nothing was. Both return []; only one of them is
    // the store having been consulted. Conflating them is G-039's own defect
    // one layer down, so the two are asserted apart.
    for (const command of ['git status --porcelain', 'ls -la', 'zzqx --flurb wibble']) {
      expect(deriveQuery(command)).toBe('');
    }
  });

  it('[mine] a trimmer that is NOT a pipeline stage does not make the shape', () => {
    // Written because a mutant survived. Dropping the "more than one stage"
    // condition in lastPipelineStage left all eleven rows green, so the word
    // PIPELINE in the module's own description of the shape was carried by
    // nothing. `tail -f` reading a file is not the G-039 act: no command's
    // status is being hidden, because no command is upstream.
    expect(deriveQuery('tail -f build.log; echo $?')).toBe('"exit" "code"');
    expect(deriveQuery('tail -f build.log')).toBe('');

    // And the direction that must still fire, in the same test: the same
    // trimmer, this time consuming a pipeline.
    expect(deriveQuery('npm run build 2>&1 | tail -5; echo $?')).toBe('"tail" "exit" "code"');
  });

  it('POSITIVE CONTROL: the same store, the same call, a recognised command — injects', () => {
    // Without this, every row above passes against a broken queryStore, an
    // empty store, or a fixture whose FTS index was never populated.
    const hits = queryStore({ db, command: 'npx vitest run 2>&1 | tail -8; echo $?', floor: 0 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].key).toBe('pipe-to-tail-masks-exit-code');
  });

  it('[mine] fails closed on a store with nothing relevant, not just on an unrecognised command', () => {
    // Marked as mine: the brief's three cases are all about the COMMAND. This
    // is the other direction — the command is recognised, the query is real,
    // and the store simply has no answer. A channel that stays quiet only
    // because it did not understand the question is not yet fail-closed.
    const empty = new Database(':memory:');
    initSchemaV2(empty);
    add(empty, 'unrelated', 'Convex table names are case sensitive and a wrong one reads as an empty table.');

    const command = 'npx vitest run 2>&1 | tail -8; echo $?';
    expect(deriveQuery(command)).not.toBe('');
    expect(queryStore({ db: empty, command, floor: 0 })).toEqual([]);
    empty.close();
  });
});

describe('brief §3 — the query path is handed a genuinely read-only handle', () => {
  /**
   * DECLARED SURVIVING MUTANT, M22: handing `runTrigger` the WRITABLE
   * connection instead of the read-only one changes nothing observable,
   * because the query only reads. The restriction is a capability, and a
   * capability's only behavioural evidence is the failure of code that does
   * not exist yet — it would kill the mutant the moment the query path tried
   * to write.
   *
   * What CAN be asserted is that the handle the hook opens is really
   * read-only, rather than named so in a comment. Both directions: the query
   * works through it, and a write through it is refused.
   */
  it('the query works through a read-only connection, and a write through it is refused', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'trigger-ro-')), 'store.db');
    const seed = new Database(file);
    initSchemaV2(seed);
    add(seed, 'pipe-to-tail-masks-exit-code', STRONG);
    seed.close();

    const ro = new Database(file, { readonly: true, fileMustExist: true });
    expect(queryStore({ db: ro, command: 'npx vitest run 2>&1 | tail -8; echo $?', floor: -Infinity }).length)
      .toBeGreaterThan(0);
    expect(() => ro.prepare('DELETE FROM knowledge_index').run())
      .toThrow(/readonly|read-only/i);
    ro.close();
  });
});

describe('A3 — the precise query underfills and the trigger does NOT broaden', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);
    // No entry holds all of tail + exit + code. Each decoy holds a subset, so
    // the conjunctive query matches nothing while an OR broadening would
    // return every one of them.
    add(db, 'decoy-tail', 'Use tail -f to follow a log file while a long build proceeds.');
    add(db, 'decoy-exit', 'A stage that fails should exit rather than continue with partial state.');
    add(db, 'decoy-code', 'Keep the generated code out of the diff by writing it at build time.');
    add(db, 'decoy-tail-exit', 'The tail of a crash log rarely shows why a process chose to exit.');
  });

  afterEach(() => db.close());

  it('returns nothing where a broadened query would return decoys', () => {
    expect(queryStore({ db, command: 'npx vitest run 2>&1 | tail -8; echo $?', floor: 0 })).toEqual([]);
  });

  it('POSITIVE CONTROL: an OR over the same terms against the same fixture DOES return decoys', () => {
    // This is what makes the row above evidence rather than a tautology. If
    // this assertion ever fails, the fixture stopped being one where
    // broadening would differ, and the negative above went green for free —
    // which is exactly how a vacuous assertion survives a suite.
    const broadened = db
      .prepare(
        `SELECT k.key FROM knowledge_fts
         JOIN knowledge_index k ON k.id = knowledge_fts.rowid
         WHERE knowledge_fts MATCH ?`,
      )
      .all('"tail" OR "exit" OR "code"') as Array<{ key: string }>;

    expect(broadened.length).toBeGreaterThanOrEqual(4);
  });

  it('POSITIVE CONTROL: add one entry holding all three terms and the same call finds it', () => {
    add(db, 'complete', STRONG);
    const hits = queryStore({ db, command: 'npx vitest run 2>&1 | tail -8; echo $?', floor: 0 });
    expect(hits.map((h) => h.key)).toEqual(['complete']);
  });
});
