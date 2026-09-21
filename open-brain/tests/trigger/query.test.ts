import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';
import { queryStore } from '../../src/trigger/query.js';

/**
 * A1 — the row this loop starts red on.
 *
 * Loop 16 brief §4: against a fixture store holding entry 299's text and at
 * least ten decoys sharing common tokens (`exit`, `code`, `tail`, `run`), the
 * trigger's query for the literal command that produced G-039 returns entry
 * 299 FIRST.
 *
 * The decoys are the point. A query that returns 299 out of a store where
 * nothing else mentions `tail` or `exit` has demonstrated nothing about
 * ranking — it has demonstrated that FTS can find the only matching row. Every
 * decoy below shares at least two of the four tokens with the command, and
 * three of them are about exit codes in a way that is genuinely adjacent.
 *
 * Amendment 1 §3: at base the live store returns 299 at rank 1 only inside a
 * BROADENED set. The trigger is forbidden that path (§5.4), so this fixture
 * asserts the precision path's ranking directly rather than inheriting a
 * number measured through a different query.
 */

/** The command from G-039, verbatim. */
const G039_COMMAND = 'npx vitest run 2>&1 | tail -8; echo $?';

/** Entry 299's shape as the live store holds it — TRIGGER/ACTION/CONTEXT. */
const ENTRY_299 = [
  '[EXPERIENCE] Piping to tail/head masks the real exit code — and I reported a false success because of it',
  'DOMAIN: shell, tooling, verification',
  'TRIGGER: Any time a command output is trimmed with `| tail -N`, `| head -N`, or `| grep`, AND the success/failure of that command matters.',
  'ACTION: Read ${PIPESTATUS[0]} (bash) instead of $?, which reports the LAST command in the pipeline — i.e. tail, which almost always succeeds.',
  'CONTEXT: `npx gitnexus analyze 2>&1 | tail -15` returned exit 0 and the harness reported completed, so I told Aaron the re-index had succeeded.',
].join('\n');

/**
 * Ten decoys sharing the command's tokens. Not filler: each one is a plausible
 * near-miss a real store would hold, and four of them are about exit codes.
 */
const DECOYS: Array<[string, string]> = [
  ['vitest-run-alone', 'The suite must run alone: a vitest run that overlaps worktree creation exits 1 while every line reports passed.'],
  ['exit-code-from-variable', 'Read the exit code from the process into a variable, never from the tail of a log.'],
  ['npx-runner-selection', 'npx picks a runner from node_modules; run the local binary directly when the version matters.'],
  ['echo-debugging', 'Using echo to print a value mid-script is fine; using echo to report a run exit code after a pipe is not.'],
  ['tail-follow-logs', 'Use tail -f to follow a log file while a long run proceeds in another shell.'],
  ['gitnexus-analyze-exit', 'gitnexus analyze can print a healthy banner and exit non-zero; capture the code as its own statement.'],
  ['head-truncation', 'head -n trims output to the first N lines and is safe when the command exit status does not matter.'],
  ['shell-pipeline-basics', 'A shell pipeline runs every stage concurrently; the last stage decides the exit code the shell reports.'],
  ['run-command-allowlist', 'The runtime allowlist decides which command a stage may run and refuses everything else.'],
  ['code-review-exit', 'A review that exits early on the first finding hides the rest of the code from the reader.'],
];

describe('A1 — the trigger ranks entry 299 first for the G-039 command', () => {
  let db: Database.Database;
  let entry299Id: number;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchemaV2(db);

    const add = (key: string, content: string): number => {
      indexKnowledge(db, { vaultPath: `${key}.md`, key, content, tags: '', source: 'test' });
      const row = db.prepare('SELECT id FROM knowledge_index WHERE key = ?').get(key) as { id: number };
      return row.id;
    };

    // Decoys first, so 299 is not the lowest rowid: an implementation that
    // happens to return insertion order must not pass this row by accident.
    for (const [key, content] of DECOYS) add(key, content);
    entry299Id = add('pipe-to-tail-masks-exit-code', ENTRY_299);
  });

  afterEach(() => db.close());

  it('returns entry 299 as the first hit', () => {
    const hits = queryStore({ db, command: G039_COMMAND, floor: 0 });

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe(entry299Id);
  });

  it('has a fixture whose decoys really do share the command tokens', () => {
    // Guards the guard: if the decoys stopped matching, the row above would go
    // green for the wrong reason — the "only matching row" case the fixture
    // exists to rule out. Asserted against FTS directly, not through the
    // trigger, so a broken trigger cannot make this look healthy.
    const matching = db
      .prepare(
        `SELECT COUNT(*) AS n FROM knowledge_fts f
         JOIN knowledge_index k ON k.id = f.rowid
         WHERE knowledge_fts MATCH ?`,
      )
      .get('"tail" OR "exit" OR "run" OR "code"') as { n: number };

    expect(matching.n).toBeGreaterThanOrEqual(10);
  });
});
