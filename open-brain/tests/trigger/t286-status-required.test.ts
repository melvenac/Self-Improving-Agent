import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import * as query from '../../src/trigger/query.js';
import * as run from '../../src/trigger/run.js';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';

/**
 * T-286 — the recall trigger asks only when the status element is present.
 *
 * T-274 (docs/loops/t274/result.md) replayed every fire against a 695-entry
 * snapshot: 14,023 trimmer pipelines with no `$?` read held no VIOLATING fire,
 * and their top hit sat 0.08 under the floor. So a command without the status
 * element asks nothing, and the status element's query names the whole
 * mistake: "tail" "exit" "code".
 *
 * Imported as a namespace so the red commit runs: a changed behaviour is a
 * failing row, not a file that cannot load.
 */

const TRIM_ONLY = [
  'git log --oneline | tail -5',
  'npm test 2>&1 | tail -20',
  'cat build.log | grep error',
  'ls | head -3',
  'npm test | tail -5; echo "${PIPESTATUS[0]}"',
];
const STATUS_ONLY = 'make 2>&1 | tail -3; echo $?; ls | wc -l';
const G039 = 'npx vitest run 2>&1 | tail -8; echo $?';
const ENTRY = [
  '[EXPERIENCE] Piping to tail/head masks the real exit code',
  'ACTION: Read ${PIPESTATUS[0]} instead of $?, because tail exit code is not the command exit code.',
].join('\n');
const POLICY = { relevance_floor: 0, max_injected: 1, deadline_ms: 2000, provenance: 'test fixture' };

function store(): Database.Database {
  const db = new Database(':memory:');
  initSchemaV2(db);
  indexKnowledge(db, { vaultPath: 'e.md', key: 'pipe-to-tail', content: ENTRY, tags: '', source: 'test' });
  return db;
}

describe('T-286 — a query is asked only on a $? read of a trimmer pipeline', () => {
  it.each(TRIM_ONLY)('D1: a trimmer pipeline with no $? read derives no query: %j', (cmd) => {
    expect(query.deriveQuery(cmd)).toBe('');
  });

  it('D2a: a $? read of a tail pipeline asks "tail" "exit" "code" even when the last pipeline is not a trimmer', () => {
    expect(query.deriveQuery(STATUS_ONLY)).toBe('"tail" "exit" "code"');
  });

  it('D2b: G-039 asks "tail" "exit" "code"', () => {
    expect(query.deriveQuery(G039)).toBe('"tail" "exit" "code"');
  });

  it('D3: queryStore returns nothing for a trimmer-only command; G-039 still finds the entry', () => {
    const db = store();
    try {
      for (const cmd of TRIM_ONLY) expect(query.queryStore({ db, command: cmd, floor: -Infinity })).toEqual([]);
      expect(query.queryStore({ db, command: G039, floor: -Infinity })[0].key).toBe('pipe-to-tail');
    } finally {
      db.close();
    }
  });

  it('D4: runTrigger records a trimmer-only command as not-asked, with an empty query', () => {
    const db = store();
    try {
      const outcome = run.runTrigger({
        db,
        sessionUuid: '28600000-0000-4000-8000-000000000001',
        command: TRIM_ONLY[0],
        policy: POLICY,
      });
      expect(outcome.state).toBe('not-asked');
      expect(outcome.ids).toEqual([]);
      expect(db.prepare('SELECT state, query FROM trigger_fires').all()).toEqual([{ state: 'not-asked', query: '' }]);
    } finally {
      db.close();
    }
  });
});
