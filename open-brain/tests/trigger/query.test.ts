import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchemaV2, indexKnowledge } from '../../src/db-v2.js';
import { queryStore } from '../../src/trigger/query.js';

/**
 * A1, restated by R26 (amendment 10) into the two questions the original row
 * was asking at once.
 *
 * The original: *against a fixture holding entry 299 and at least ten decoys
 * sharing common tokens (`exit`, `code`, `tail`, `run`), the query returns 299
 * FIRST.* That sentence was written before the derivation existed, and the
 * derivation does not AND that token set — it ANDs `tail`, `exit`, `code`. So
 * the row tested two different things depending on which fixture you built,
 * and QA's second caller (R11) found that only ONE of the ten original decoys
 * was live under the real query. 299 was winning a field of two.
 *
 * Both fixtures are kept, and neither is weakened:
 *
 *   **A1(a) — precision.** The original decoys, most of which carry only some
 *   of the derived terms. 299 ranks FIRST, and that is ASSERTED. What it
 *   demonstrates is that the conjunction excludes partial matches: nine of
 *   these ten never enter the match set at all.
 *
 *   **A1(b) — the field.** Ten decoys each genuinely carrying all three
 *   derived terms, at comparable length. 299's presence in the match set is
 *   ASSERTED; its RANK is REPORTED and never asserted. Against real
 *   competitors the trigger does not put 299 first; that is a known gap owned
 *   by a later loop, and a row asserting first place here would be a claim
 *   this loop cannot defend.
 *
 * The rank is printed rather than swallowed because the number is the evidence
 * the close-out gap is built from. A test that knows a number and does not say
 * it is the same silence this loop exists to end.
 */

/** The command from G-039, verbatim. */
export const G039_COMMAND = 'npx vitest run 2>&1 | tail -8; echo $?';

/** Entry 299's shape as the live store holds it — TRIGGER/ACTION/CONTEXT. */
export const ENTRY_299 = [
  '[EXPERIENCE] Piping to tail/head masks the real exit code — and I reported a false success because of it',
  'DOMAIN: shell, tooling, verification',
  'TRIGGER: Any time a command output is trimmed with `| tail -N`, `| head -N`, or `| grep`, AND the success/failure of that command matters.',
  'ACTION: Read ${PIPESTATUS[0]} (bash) instead of $?, which reports the LAST command in the pipeline — i.e. tail, which almost always succeeds.',
  'CONTEXT: `npx gitnexus analyze 2>&1 | tail -15` returned exit 0 and the harness reported completed, so I told Aaron the re-index had succeeded.',
].join('\n');

/**
 * A1(a)'s decoys — the brief's original token list (`exit`, `code`, `tail`,
 * `run`), each sharing SOME of it. Exactly one carries all three derived
 * terms, and that is the point of this fixture rather than a defect in it:
 * the conjunction is what keeps the other nine out.
 */
export const PRECISION_DECOYS: Array<[string, string]> = [
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

/**
 * A1(b)'s decoys — ten genuine competitors, each carrying `tail`, `exit` AND
 * `code`, at lengths comparable to entry 299's 566 characters.
 *
 * Comparable length is not decoration. An earlier version of this fixture ran
 * 235–343 characters against 299's 566, which handed every decoy a bm25
 * length-normalisation advantage unrelated to relevance and reported 299 at
 * rank 9 rather than 4. A stacked fixture proves as little as a vacuous one;
 * it just fails in the flattering direction.
 */
export const FIELD_DECOYS: Array<[string, string]> = [
  ['vitest-run-alone',
   'The suite must run alone. A full vitest run that overlapped thirteen worktree additions printed 974 passed and still returned a non-zero exit code, and reading the tail of that output showed no failing test at all. Build fixtures before the run or after it, never during, and read the exit code from a variable written by the process rather than from the tail of a log. The worker heartbeat raises an unhandled error that vitest exits non-zero on without failing any test, so the summary and the exit code disagree and only one of them is right.'],
  ['exit-code-from-variable',
   'Read the exit code from the process into a variable rather than from the tail of a log file. A compound command reports one exit code for several steps, so the code you read belongs to whichever step ran last rather than to the step you care about. Capture it immediately, on its own line, before any further command runs and overwrites it, and remember that a redirect into a file is not a step that changes the code while a pipe into a trimmer is.'],
  ['deploy-exit-status',
   'A deploy script that ends by printing its log tail will report a successful exit code even when the build step inside it failed. Check the container image timestamp and the running digest rather than the exit code the wrapper reports, because the wrapper exits with the code of the last command in its own body and that is almost always the echo or the tail it used to summarise the run. Propagating the real code takes an explicit assignment.'],
  ['gitnexus-analyze-exit',
   'The analyzer can print a healthy banner and still exit non-zero, and the tail of its output shows the banner rather than the failure, so a run that wrote no index reads as a clean one. Capture the exit code as its own statement immediately after the command. An interrupted incremental run also leaves the full-text index inconsistent, which is a different failure reported through the same exit code and needs a repair pass before the next analyze.'],
  ['ci-runner-exit-codes',
   'The continuous integration runner treats any non-zero exit code as a failed job, so a script that swallows an error and exits zero turns a broken build green and nobody looks again. Print the tail of the failing step into the job summary for a human, but decide the outcome from the exit code the process itself returned. A step that ends in a pipeline needs the upstream status read explicitly or the job reports the trimmer.'],
  ['shell-pipeline-status',
   'A shell pipeline runs every stage concurrently and the last stage decides the exit code the shell reports, which is why trimming output with tail is safe only when the status of the upstream command does not matter. The code you read afterwards belongs to the trimmer. Shells offer an array of per-stage statuses and an option that makes the pipeline adopt the first failure, and one of the two is needed whenever the status is load bearing.'],
  ['test-runner-summary',
   'A test runner prints its summary at the tail of the output and returns an exit code that a wrapper script can lose on the way back. Read both, because they answer different questions: the summary says which test failed and the exit code says whether the run failed, and in a worker timeout they disagree because no test failed at all. Treat a disagreement as a reason to rerun alone rather than as a reason to trust the friendlier one.'],
  ['log-rotation-exit',
   'The log rotation job writes the tail of each file into a status record and exits when the archive is sealed. A non-zero exit code there means the rotation did not complete, and the code that reads the status record afterwards will see a stale tail from the previous run rather than an error, which makes a failed rotation look like a quiet one. Check the exit code before trusting anything the status record says about the archive.'],
  ['docker-build-exit',
   'A container build that fails part way still prints layer output, so the tail of the build log looks entirely ordinary and the failure is several screens up. The exit code is the only reliable signal, and a build run through a shell wrapper reports the wrapper exit code unless the script is written to propagate it. Compare the image identifier before and after: an unchanged digest with a zero exit code means the build never ran.'],
  ['migration-exit-code',
   'A half-applied migration exits non-zero and the tail of its output names the last statement it managed to run rather than the one that failed, so the log reads as progress and the exit code reads as failure. Read the exit code first and the log second, because the code tells you whether to trust what the tail of the file appears to say. A migration runner that wraps the database client can lose the code the same way a deploy wrapper does.'],
];

const seed = (decoys: Array<[string, string]>): { db: Database.Database; id299: number } => {
  const db = new Database(':memory:');
  initSchemaV2(db);
  const add = (key: string, content: string): number => {
    indexKnowledge(db, { vaultPath: `${key}.md`, key, content, tags: '', source: 'test' });
    return (db.prepare('SELECT id FROM knowledge_index WHERE key = ?').get(key) as { id: number }).id;
  };
  // Decoys first, so 299 is not the lowest rowid: an implementation that
  // returns insertion order must not pass by accident.
  for (const [key, content] of decoys) add(key, content);
  return { db, id299: add('pipe-to-tail-masks-exit-code', ENTRY_299) };
};

/** Keys in the match set, in the trigger's own ranked order. */
const ranked = (db: Database.Database): string[] =>
  queryStore({ db, command: G039_COMMAND, floor: -Infinity, limit: 50 }).map((h) => h.key ?? '(no key)');

describe('A1(a) — precision: the conjunction excludes partial matches, and 299 ranks first', () => {
  let db: Database.Database;
  let id299: number;

  beforeEach(() => { ({ db, id299 } = seed(PRECISION_DECOYS)); });
  afterEach(() => db.close());

  it('returns entry 299 as the first hit', () => {
    const hits = queryStore({ db, command: G039_COMMAND, floor: 0 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe(id299);
  });

  it('and it wins a SMALL field, which is what this fixture demonstrates', () => {
    // Stated rather than implied, because the original row read as though it
    // demonstrated ranking among competitors and it does not. Most of these
    // ten decoys never enter the match set: they carry some of the brief's
    // token list and not all three derived terms. That is the conjunction
    // doing its job — and it is why A1(b) exists.
    const keys = ranked(db);
    expect(keys).toContain('pipe-to-tail-masks-exit-code');
    expect(keys.length).toBeLessThan(PRECISION_DECOYS.length);
    console.log(`A1(a) match set (${keys.length} of ${PRECISION_DECOYS.length + 1} documents): ${keys.join(', ')}`);
  });
});

describe('A1(b) — the field: ten real competitors, rank reported and not asserted', () => {
  let db: Database.Database;

  beforeEach(() => { ({ db } = seed(FIELD_DECOYS)); });
  afterEach(() => db.close());

  it('every decoy is LIVE under the conjunctive query — all ten, by name', () => {
    // The guard R25 asked for. The first version of this counted matches of
    // the brief's four-token list, which is not the query the trigger runs, so
    // it reported on something other than the thing under test.
    const live = db
      .prepare(
        `SELECT k.key FROM knowledge_fts f
         JOIN knowledge_index k ON k.id = f.rowid
         WHERE knowledge_fts MATCH ?`,
      )
      .all('"tail" "exit" "code"') as Array<{ key: string }>;

    const liveKeys = live.map((r) => r.key).sort();
    expect(liveKeys).toEqual([...FIELD_DECOYS.map(([key]) => key), 'pipe-to-tail-masks-exit-code'].sort());
    expect(liveKeys).toHaveLength(11);
  });

  it('299 is IN the match set — and its rank is reported, never asserted (R26)', () => {
    const keys = ranked(db);
    const rank = keys.indexOf('pipe-to-tail-masks-exit-code') + 1;

    // The whole assertion. A1(b) fails only if 299 is absent.
    expect(keys).toContain('pipe-to-tail-masks-exit-code');

    // The number this row exists to surface. It is the evidence behind the
    // close-out's ranking gap, and a test that knows a number and does not say
    // it is the same silence this loop exists to end.
    console.log(
      `A1(b) entry 299 ranks ${rank} of ${keys.length} against ten same-topic competitors ` +
        `(top: ${keys[0]}). RANK REPORTED, NOT ASSERTED — R26 / amendment 10. bm25 length ` +
        `normalisation is the cause; the live 599-entry store ranks 299 first only because five ` +
        `entries there match all three terms, which is a thin field rather than discrimination.`,
    );
  });

  it('every competitor gives the same advice as 299, which is how the gap should be weighed', () => {
    // Recorded as a test rather than a comment because it is the fact that
    // decides how much the ranking gap costs in practice. With max_injected
    // at 1 the seat receives ONE of these, and every one of them says: read
    // the status from the process, not from the trimmed output. The ruling's
    // prohibition is on injecting an IRRELEVANT entry; these are competitors,
    // not noise.
    for (const [key, content] of FIELD_DECOYS) {
      const advice = content.toLowerCase();
      expect(advice, `${key} should carry the same advice`).toMatch(/exit code|status/);
      expect(advice, `${key} should be about the trimmed-output trap`).toContain('tail');
    }
  });
});
