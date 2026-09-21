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
 * Ten decoys sharing the command's tokens. Not filler: each one is a plausible
 * near-miss a real store would hold, and four of them are about exit codes.
 */
export const DECOYS: Array<[string, string]> = [
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
];describe('A1 — the trigger ranks entry 299 first for the G-039 command', () => {
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

  it('every decoy is LIVE under the conjunctive query — all ten, not just the ones that happened to match', () => {
    // REBUILT FOR CANDIDATE 2, on QA's F2. The first version asserted that ten
    // rows matched `tail OR exit OR run OR code`, which is the brief's token
    // list and NOT the derivation's. Under the conjunctive query the trigger
    // actually runs — "tail" AND "exit" AND "code" — only one decoy was live,
    // so A1 was choosing 299 out of two documents while the fixture's name
    // claimed eleven. A guard written to the wrong query is a guard that
    // reports on something other than the thing under test.
    //
    // Asserted against FTS directly rather than through the trigger, so a
    // broken trigger cannot make this look healthy, and asserted per decoy so
    // a failure names which one went dead.
    const live = db
      .prepare(
        `SELECT k.key FROM knowledge_fts f
         JOIN knowledge_index k ON k.id = f.rowid
         WHERE knowledge_fts MATCH ?`,
      )
      .all('"tail" "exit" "code"') as Array<{ key: string }>;

    const liveKeys = live.map((r) => r.key).sort();
    const expected = [...DECOYS.map(([key]) => key), 'pipe-to-tail-masks-exit-code'].sort();
    expect(liveKeys).toEqual(expected);
    expect(liveKeys).toHaveLength(11);
  });
});
