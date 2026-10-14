# T-286: the recall trigger asks only when the status element is present, always as "tail" "exit" "code"; the floor keeps 8.0, now with a 5.81 margin

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop (Aaron, 2026-10-13: the desktop's CPU is overloaded, so no npm, vitest,
tsc or build runs there). No hub key. Code PR (src): QA and Aaron's word come after READY. Ends at READY with a PR, no
merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t286-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 170. **Task:** T-286 (P2). **Tag:** `T-286`. **Size:** SMALL.
**Base:** `1f436507c7d3fd0e55f3b0e9a81c0794f8fb527d` (origin/master, after #699 put T-274's result on master). If clark
re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: deriveQuery ELEMENTS (open-brain/src/trigger/query.ts: deriveQuery gains one guard, and the status element in the ELEMENTS table gains the term "tail"; deriveQuery's callers are queryStore, runTrigger in trigger/run.ts and the T-159 not-asked path in cli-recall-trigger.ts; plus the provenance text in open-brain/src/trigger/policies/recall-trigger.json; covered by tests/trigger/t286-status-required.test.ts, tests/trigger/t265-status-read.test.ts, tests/trigger/floor.test.ts, tests/trigger/t159-fast-path.test.ts and the rest of tests/trigger)
```

## Why

T-274 (PR #699, `docs/loops/t274/result.md` on master) replayed every recall-trigger fire from 2026-09-21 to 2026-10-14
against a snapshot of the live store, which held 695 entries. Since T-265, `deriveQuery` produces only three queries.
The trigger asks for one hit (`max_injected` 1), so whether it injects depends only on the query's top hit and the
floor:

| label (query) | anchored fires | VIOLATING | top-1 hit |
|---|---:|---:|---|
| TRIM+STATUS (`"tail" "exit" "code"`) | 99 | 95 | entry 299 at 13.81 |
| STATUS (`"exit" "code"`) | 11 | 10 | entry 299 at 6.16 |
| TRIM (`"tail"`) | 14,023 | **0** | entry 642 at **7.92** |
| NONE (no query) | 20,120 | 7 | none (derivation misses; a floor cannot reach them) |

At the shipped floor of 8.0:
- 99 fires inject, with 96.0% precision, catching 84.8% of the 112 VIOLATING fires.
- All 10 STATUS-only violations stay silent: their shorter query scores entry 299 at only 6.16.
- The floor clears TRIM's top hit by only **0.08**. bm25 is corpus-relative, so as the store grows, entry 642 can
  cross it, and about 14,000 TRIM-only fires would then inject at 0.7% precision.
- No floor separates the labels: STATUS's top hit (6.16) sits below TRIM's (7.92).

**The fix is structural. It changes what is asked, not the number.**
- **A trimmer pipeline with no `$?` read of it is not the mistake.** 14,023 such fires held zero violations, so a
  TRIM-only command asks nothing. Its fire becomes not-asked and takes T-159's cheap path: one pending line, and the
  store is never opened.
- **An unsafe status read already IS a read of a trimmer pipeline's status.** `isUnsafeStatusRead` (query.ts:213-216)
  requires the `$?` to follow a trimmer pipeline. So the status element's query names the whole mistake:
  `"tail" "exit" "code"`, the same query that TRIM+STATUS asks today. (The trimmer element maps tail, head and grep
  all to the term `"tail"` already.)
- **So every asking fire asks one query,** whose top hit on T-274's data is entry 299 at 13.81. The floor STAYS 8.0
  and now has a 5.81 margin, where it had 0.08 over TRIM's top hit before.
- **The predicted result on T-274's data:** STATUS-only fires inject entry 299 like TRIM+STATUS ones. That is 110
  injections, with precision 105/110 = 95.5%, VIOLATING recall 105/112 = 93.8%, and 105/105 = 100% of the VIOLATING
  fires a query can reach.

Two consistency checks:
- **T-265 (D-148): fire only on the mistake itself.** D-148 says "no new code unless the data says so", and T-274's
  result is that data.
- **No violating command loses its query.** The status element still decides; only the status-free commands, which
  held no violation, stop asking.

## Ruling (exact; paths under `open-brain/`)

1. **`src/trigger/query.ts`, `deriveQuery` (:249-259 at the base).** Insert, as the first statement of the body
   (before `const terms: string[] = [];`):
   ```ts
     // T-286: ask only about the mistake itself. A trimmer pipeline with no $? read of it is not the act (T-274
     // measured 14,023 such fires with no VIOLATING one), so a command without the status element derives no query
     // and takes T-159's not-asked path, never opening the store.
     if (!isUnsafeStatusRead(command)) return "";
   ```
   Nothing else in `deriveQuery` changes.
2. **The status element (:227-240).**
   - `terms: ["exit", "code"],` (:239) becomes `terms: ["tail", "exit", "code"],`.
   - Add one comment line between `test: isUnsafeStatusRead,` (:238) and that `terms:` line:
     `    // T-286: the read follows a trimmer pipeline by construction, so the query names the whole mistake, "tail" included.`
   - Every asking query is now `"tail" "exit" "code"`, in that order, whether or not the trimmer element also
     matched: the loop skips a term already present.
3. **The trimmer element (:219-226) is KEPT, not deleted.** Add one comment line directly above
   `what: "a pipeline whose last stage is a trimmer",`:
   `    // Since T-286 this element adds no term of its own: deriveQuery asks only when the status element is present, and that element's terms already include "tail".`
   Why it is kept: with it gone, the table's only element is the status element, and deriveQuery's guard would be
   indistinguishable from no guard. Mutant M1 below, which removes the guard, would then survive. Kept, it changes no
   output (the loop deduplicates `"tail"`), and every test verdict below holds either way.
4. **`src/trigger/policies/recall-trigger.json`** keeps `"relevance_floor": 8.0`, `"max_injected": 1` and
   `"deadline_ms": 2000`. Only `provenance` is rewritten, to exactly:
   ```text
   relevance_floor re-measured 2026-10-14 against the live store at 695 entries (T-274, docs/loops/t274/result.md). Since T-286 the only query the trigger asks is \"tail\" \"exit\" \"code\"; its top hit is entry 299 at 13.81, so 8.0 clears it by 5.81. A trimmer pipeline with no $? read asks nothing (T-286), so TRIM's old top hit (entry 642 at 7.92) no longer bears on the floor. bm25 is corpus-relative (Loop 16 R19), so this cut moves as the store grows and must be re-measured, not assumed.
   ```
   (The `\"` are the JSON escapes inside the string, as in the current file.) Keep the key order, the 2-space indent
   and the trailing newline.
5. **The ruling-5 scan.** `floor.test.ts` (:216-241) checks that `String(relevance_floor)` does not appear in
   query.ts's code with comments stripped. For 8.0 that string is `"8"`, so the code you add must hold no `8` outside
   comments. The base code has none; the planner checked with the test's own comment-stripping pattern. Rulings 1-3
   add no digit outside comments.
6. **Out of scope:**
   - `docs/loops/t274/floor.mjs`'s LABEL_CHECK. After this change, its cases 2, 5 and 6 (TRIM) derive NONE, and case
     4 (STATUS) derives `"tail" "exit" "code"`, which it labels TRIM+STATUS. So a re-run on a newer build fails its
     label self-check by design: it measured the derivation of b7bf4c06. A future re-measure updates it.
   - `docs/loops/t264/measure.mjs` is untouched and unaffected: its SELF_CHECK tests T-264's own classifier, and it
     imports no `deriveQuery`.
   - The 7 VIOLATING fires with no query (derivation misses).

## Existing tests (planner-read at 1f436507; verdicts)

- `tests/trigger/t265-status-read.test.ts`:
  - **UNSAFE rows (:18-22): stay green.** Each already expects `"tail" "exit" "code"`, and each passes the guard.
  - **SAFE rows :30 and :32 (`''`): stay green.**
  - **SAFE rows :26, :27, :28, :29, :31 and :33 turn red in commit 1** (expected `'"tail"'`). Their new expected
    value is `''`. Commit 1 edits those six values, and commit 2 turns them green.
  - **Line 11's comment** `(the trimmer element still decides whether "tail" is in the query).` becomes
    `(since T-286 a query is asked only when the status element is present, and its terms carry "tail" themselves).`
- `tests/trigger/negatives.test.ts`: **stays green.**
  - `'tail -f build.log; echo $?'` and `'tail -f build.log'` stay `''`: a one-stage `tail` is not a trimmer pipeline,
    so the status element is silent.
  - The G-039 row stays `"tail" "exit" "code"`.
  - No row expects a TRIM-only or an `"exit" "code"` query. The planner grepped the tests for both.
  - Its comment about `lastPipelineStage` stays true: the function stays, with the trimmer element.
- `tests/trigger/query.test.ts`, `no-network.test.ts`, `fires.test.ts`, `hook.test.ts`,
  `tests/t235-p2-5-cursor-recall.test.ts`: **stay green.**
  - They use G-039 (TRIM+STATUS, unchanged) and the three unrecognised commands, and the floor is unchanged.
  - `fires.test.ts:190` builds a record with `query: '"tail"'` by hand, through `recordFire`, never `deriveQuery`.
- `tests/trigger/t159-fast-path.test.ts`: every existing row **stays green**. One row is added (below).
- `tests/trigger/floor.test.ts`:
  - **R19 (:108)** `expect(provenance).toMatch(/\b599\b/);` turns red in commit 1, with the new value
    `/\b695\b/`.
  - **:109's date pattern and :110's `toContain(String(relevance_floor))`:** stay green. The provenance holds
    `2026-10-14`, and both `8.0` and `13.81` contain `8`.
  - **The fixture rows (:113-149, :171-184):** stay green. The floor is unchanged.
  - **The ruling-5 scan (:216-241):** stays green (ruling 5).
- `.agents/retirements.json` pins no line of the files this brief edits (it names `tests/trigger/fires.test.ts`, which
  this brief does not edit). Run `tests/pipelines/sync/retirements-live.test.ts` anyway.
- Any other newly failing row: STOP, `BLOCKED T-286 <row>`.

## New rows (commit 1)

**A. New file `tests/trigger/t286-status-required.test.ts`.** Namespace imports, so a row fails rather than the file:
`import * as query from '../../src/trigger/query.js'` and `import * as run from '../../src/trigger/run.js'`, plus
`Database` from `better-sqlite3` and `initSchemaV2` and `indexKnowledge` from `../../src/db-v2.js`.

```ts
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
```

- **D1 (RED at the base):** `it.each(TRIM_ONLY)`: `query.deriveQuery(cmd)` is `''`.
- **D2a (RED):** `query.deriveQuery(STATUS_ONLY)` is `'"tail" "exit" "code"'`. At the base it is `'"exit" "code"'`:
  the command's last pipeline stage is `wc -l`, so the trimmer element does not match, though its `$?` reads the
  `tail` pipeline before it.
- **D2b (GREEN at the base, pins the other asking shape):** `query.deriveQuery(G039)` is `'"tail" "exit" "code"'`.
- **D3 (RED):** an in-memory store (`new Database(':memory:')`, `initSchemaV2`, then
  `indexKnowledge(db, { vaultPath: 'e.md', key: 'pipe-to-tail', content: ENTRY, tags: '', source: 'test' })`).
  - For every TRIM_ONLY command, `query.queryStore({ db, command: cmd, floor: -Infinity })` is `[]`.
  - Positive control in the same row: `query.queryStore({ db, command: G039, floor: -Infinity })[0].key` is
    `'pipe-to-tail'`.
- **D4 (RED):** the same store.
  - `run.runTrigger({ db, sessionUuid: '28600000-0000-4000-8000-000000000001', command: TRIM_ONLY[0], policy: POLICY })`
    returns `state` `'not-asked'` and `ids` `[]`.
  - `db.prepare('SELECT state, query FROM trigger_fires').all()` equals `[{ state: 'not-asked', query: '' }]`.
  - At the base the same call injects (state `'injected'`): the `"tail"` query matches ENTRY at floor 0.

**B. `tests/trigger/floor.test.ts`.**
- :108 becomes `expect(provenance).toMatch(/\b695\b/);`.
- After the R19 row, add:
  ```ts
  it('T-286: the shipped floor sits under the asking query\'s measured top hit and above TRIM\'s old top hit (T-274)', () => {
    // T-274 (docs/loops/t274/result.md, 695 entries): since T-286 the only asking query is "tail" "exit" "code", whose
    // top hit (entry 299) scored 13.81. TRIM alone asks nothing now, but its old top hit scored 7.92; a floor at or under
    // that is the fragile cut T-286 removed, so the lower bound guards against a drift back.
    const T274_ASKING_TOP1 = 13.81;
    const T274_TRIM_OLD_TOP1 = 7.92;
    const { relevance_floor } = loadPolicy();
    expect(relevance_floor).toBeLessThanOrEqual(T274_ASKING_TOP1);
    expect(relevance_floor).toBeGreaterThan(T274_TRIM_OLD_TOP1);
  });
  ```
  It is GREEN at the base, because 8.0 already sits between the two. It is a guard, and mutant M3 shows that it bites.

**C. `tests/trigger/t159-fast-path.test.ts`, inside `describe('N1 …')`, after the first `it`:**
```ts
  it('T-286: a trimmer pipeline with no $? read takes the same fast path: nothing heavy, one pending line, no store', async () => {
    const { r, heavy, dbPath } = await spied('git log --oneline | tail -5');
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(heavy).toEqual({ native: false, bsqlite: false, zod: false, dbV2: false, policy: false });
    expect(readLines(pendingFile(dbPath))).toHaveLength(1);
    expect(fs.existsSync(dbPath)).toBe(false);
  }, SPAWN_TIMEOUT);
```
It is RED at the base: the `"tail"` query takes the asked path, which loads better-sqlite3, zod, db-v2 and policy.
`dir` is created per test (`beforeEach`), so the pending file starts empty.

**D. `tests/trigger/t265-status-read.test.ts`:** the six SAFE values and line 11's comment, as listed under Existing
tests.

**Expected at commit 1 (the base src):**
- **RED:** D1 (5 rows), D2a, D3, D4, the six t265 SAFE rows, floor R19, and the new t159 row.
- **GREEN:** D2b, the new floor row, and every other row.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t286-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path` and `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.**
   - Work in the fresh clone the launcher named. If it named none, run
     `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t286-wt")` and
     `Set-Location` into it.
   - Run `git checkout -q -b fix/t286-status-required 1f436507c7d3fd0e55f3b0e9a81c0794f8fb527d`. `git rev-parse HEAD`
     must print that SHA, and `git status --porcelain` must be empty, else STOP, BLOCKED.
   - In `open-brain`, run `npm ci`, then `node -e "require('better-sqlite3')"`. If that fails with "Could not locate
     the bindings file", run `npm rebuild better-sqlite3`, say so, and re-check.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
     `npm run test:heavy`, killing any process by name, and any edit outside the six files in step 8 except a mutant
     (step 7), which is always reverted.
3. **Base run, before any edit** (in `open-brain`, 20-minute cap):
   `npx vitest run tests/trigger tests/t235-p2-5-cursor-recall.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`.
   All green; paste the summary. A row red here was already red at the base: paste it, and treat it as known red.
4. **Commit 1, `T-286: failing rows: a trimmer pipeline with no $? read asks nothing, and a status read asks "tail" "exit" "code"`:**
   rows A-D only. Run
   `npx vitest run tests/trigger/t286-status-required.test.ts tests/trigger/t265-status-read.test.ts tests/trigger/floor.test.ts tests/trigger/t159-fast-path.test.ts --no-file-parallelism --testTimeout=180000`.
   The red set must be exactly the one listed under "Expected at commit 1". Paste the run. Any other split: STOP,
   `BLOCKED T-286 commit-1 split <row>`.
5. **Commit 2, `T-286: the recall trigger asks only on a status read, always "tail" "exit" "code"; the floor keeps 8.0 with a 5.81 margin (T-274)`:**
   rulings 1-4. Re-run step 3's command (all green, the known reds aside) and paste it. Then run `npx tsc --noEmit`,
   which must exit 0, and paste it. You have at most 2 fix attempts on a red row, then STOP, `BLOCKED T-286 <row>`.
6. End both commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline 1f436507..HEAD` shows 2 lines, and `git status --porcelain` is empty after each commit.
7. **Mutants.** For each one: edit, run step 4's command, paste the failing row names, then `git checkout -- <file>`
   and confirm a clean tree. Never commit a mutant.

   | Mutant | File | Edit | Rows that go red |
   |---|---|---|---|
   | M1 | `query.ts` | delete the `if (!isUnsafeStatusRead(command)) return "";` line | D1, D3, D4, the six t265 SAFE rows, and the t159 T-286 row (TRIM-only asks `"tail"` again) |
   | M2 | `query.ts` | that line → `if (!ELEMENTS[0].test(command)) return "";` (the trimmer element instead of the status element) | D2a (STATUS_ONLY derives `''`), and, because TRIM-only commands ask again, D1, D3, D4, the six t265 SAFE rows and the t159 T-286 row |
   | M3 | `recall-trigger.json` | `"relevance_floor": 8.0` → `14.0` | the new floor row (14 > 13.81) |
   | M4 | `recall-trigger.json` | the provenance's `695 entries` → `599 entries` | floor R19 |
   | M5 | `query.ts` | add the code line `const PLANTED_FLOOR = 8;` right after the imports | the ruling-5 scan row (it must see a planted `8`) |
   | M6 | `query.ts` | the status element's `terms: ["tail", "exit", "code"],` → `terms: ["exit", "code"],` | D2a only (G-039 keeps `"tail"` from the trimmer element) |

   For M3, also paste the floor file's other rows. They must stay green (strong 20.98 > 14; weak 4.28 < 14; :110
   finds `14` in `2026-10-14`), so the new row is the one that catches it.
8. **Scope.** `git diff --name-only 1f436507..HEAD` must show exactly these files, and nothing else (otherwise STOP,
   BLOCKED):
   - `open-brain/src/trigger/policies/recall-trigger.json`
   - `open-brain/src/trigger/query.ts`
   - `open-brain/tests/trigger/floor.test.ts`
   - `open-brain/tests/trigger/t159-fast-path.test.ts`
   - `open-brain/tests/trigger/t265-status-read.test.ts`
   - `open-brain/tests/trigger/t286-status-required.test.ts`
9. **Push and PR.**
   - `git push origin fix/t286-status-required` (never force).
     `git ls-remote origin refs/heads/fix/t286-status-required` must equal `git rev-parse HEAD`. If the push is
     rejected, STOP.
   - Then run
     `gh pr create --base master --head fix/t286-status-required --title "T-286: the recall trigger asks only on a status read, always \"tail\" \"exit\" \"code\"; the floor keeps 8.0 with a 5.81 margin" --body "Brief: docs/loops/t286-status-element-required-brief.md. Code PR (src + policy provenance): needs a QA ACCEPT and Aaron's word naming it. Evidence: docs/loops/t274/result.md."`
   - Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

- **First line:** `READY T-286 <sha40> PR #<n>` or `BLOCKED T-286 <reason>`.
- **Then each command with its output:** `node -v`, the start state, the base run, commit 1's red set, commit 2's run,
  tsc, the six mutants, the name-only diff, `ls-remote` = `rev-parse`, and the PR URL and CI.
- **GitNexus:** name any HIGH, CRITICAL or UNKNOWN target from the launcher's impact block, and say which rows cover its
  callers:
  - `deriveQuery` is covered through `queryStore` (D3), `runTrigger` (D4) and the hook's not-asked path (the t159
    row);
  - the G-039 rows in query/negatives/hook/no-network cover the asking side.
- **Pasting:** paste test output with `grep -a`, or without grep. Mark anything not run `NOT RUN`.
- If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
