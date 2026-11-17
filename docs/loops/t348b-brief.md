# T348b: the READS OWED reminder, three more test rows (T-348; supersedes PR #1135)

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-17, session 178. **Tasks:** T-348. **Tag:** `t348b`. **Size:** SMALL (three source
files, one new test file). **Base:** the START sha the launcher names (a master that contains this brief). This is a
fresh build from master, NOT a commit on top of PR #1135's branch.
**Authority:** the backlog (D-145); merge on Atlas's QA ACCEPT, sent to clark. No auth, deps, workflows or hooks.

```text
IMPACT-TARGETS: describeReadsOwed (session-start/reads-owed.ts), renderStartReport (session-start/start-report.ts), handleState (server.ts)
```

## Why this supersedes PR #1135 (CAND 9c41a23e)

The t348 build was READY: 10 edits applied, 141 passed, 5 of 5 mutants red as predicted. The review found the source
correct on every question and REJECTED on two surviving mutants, both test gaps:

- **F1.** `collect.push(...paths.slice(0, 6))` in `describeReadsOwed` passes all six rows. With 7 or more owed paths
  the reminder would then print the wrong count and no `, +K more`. Only T348-5 goes through `collect`, and it owes one
  path.
- **F2.** A call to `readsOwedReminder` in `handleState`'s refusal branch passes all six rows. A refused first write
  (a stale `expected_revision`) would then use the reminder up, and the session would never see it. The two-line
  variant, the reminder computed before `applyStateOps`, survives the same way.
- **Note (the review's M7).** Dropping the string check on a record's `paths` passes all six rows. Only a hand-edited
  record is affected.

**The source does not change.** This build produces the three source files byte-identical to CAND 9c41a23e (step 3
pins their blob hashes). The only difference from PR #1135 is three more test rows.

## What changes

1. `docs/loops/t348/edits.txt`, 10 edits in 3 files: unchanged, described in `docs/loops/t348-brief.md`. There is no
   `t348b/edits.txt`.
2. `docs/loops/t348b/t348-reads-owed-reminder.test.ts`: the six rows of t348's file, unchanged, plus:
   - **T348-7** (F1): a real start in a fixture that owes at least 7 paths (the brief, six `docs/n*.md` files the
     developer handoff names, and `.agents/AGENT.md`). The reminder's `(N)` equals the start line's `(N)`, it lists the
     same first six paths, and it ends `, +K more` with K = N - 6.
   - **T348-8** (F2): in a proven session the first `ob_state` call is refused (wrong `expected_revision`): `isError`,
     no reminder line, revision unchanged. The next applied write ends with the reminder line; the one after has none.
     This row also covers the two-line variant (the reminder computed before `applyStateOps`), which has no mutant file
     because `apply.cjs` cannot express it as one edit.
   - **T348-9** (M7): a hand-edited record with `paths: ["docs/a.md", 2]` gives no line, and the write still applies.

## Existing tests that pin this behaviour (planner read; not simulated)

Same table and verdicts as `docs/loops/t348-brief.md`: no existing row turns red. The t348 build ran step 4 at
CAND 9c41a23e: 141 passed, and the review ran the full suite there: 1 failed (D4, also red at START), 5008 passed.
T348-1 to T348-6 were green there. T348-7, T348-8 and T348-9 are NOT simulated.

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t348b`, unless the launcher names the branch; then use
   that name here and in step 9, and say which. HEAD must equal START and the porcelain must be empty.
   `git grep -c readsOwedReminder -- open-brain/src` must print nothing (exit 1): if it prints a count, PR #1135 was
   merged after all; STOP, `BLOCKED t348b base already has t348`. In `open-brain`: `npm ci` (exit code), then
   `node -e "require('better-sqlite3')"`; on "Could not locate the bindings file" run `npm rebuild better-sqlite3` and
   say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`,
     any hook registration or `settings*.json`, `package.json`, `.github/`, anything under `docs/`, and the branch of
     PR #1135 (fetching `build/t348` to read three hashes, below, is allowed; checking it out is not).
3. **Apply.** `node docs/loops/t348b/apply.cjs . docs/loops/t348/edits.txt` must print exactly
   `APPLIED 10 edits to 3 files`.
   **Pin the source.** From the clone root, `git hash-object` on each file must print:
   - `open-brain/src/pipelines/session-start/reads-owed.ts`: `f82d42c4c09555a281de2b1719ec7592a2bf152a`
   - `open-brain/src/pipelines/session-start/start-report.ts`: `c8b082ab01c0b000cdc7556e3fe981d789906d6f`
   - `open-brain/src/server.ts`: `cf351389475a6cf4c77a77e3f98bf1f5b9955399`

   Then `git fetch -q origin build/t348` and `git rev-parse 9c41a23e:<path>` for each of the three paths must print the
   same three hashes. A different hash from any command: STOP, `BLOCKED t348b source differs from CAND`, pasting all
   six. If the fetch fails because the branch is gone, say so, mark the three `rev-parse` commands `NOT RUN`, and go on:
   the `hash-object` values are the pin.
   Then
   `Copy-Item docs/loops/t348b/t348-reads-owed-reminder.test.ts open-brain/tests/pipelines/session-start/t348-reads-owed-reminder.test.ts`
   (the file from `t348b/`, NOT the one in `t348/`) and, from the clone root,
   `git add open-brain/tests/pipelines/session-start/t348-reads-owed-reminder.test.ts` (S4 guard D1b fails on an
   untracked test file; the first t348 run went red there). In `open-brain`: `npx tsc --noEmit` (exit 0),
   `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build` (exit 0).
4. **The ten files.** In `open-brain`:
   `npx vitest run tests/pipelines/session-start/t348-reads-owed-reminder.test.ts tests/pipelines/session-start/g062-reads-owed.test.ts tests/pipelines/session-start/briefing-fix.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/t329-fresh-start.test.ts tests/server.test.ts tests/t314-start-read-only.test.ts tests/pipelines/fleet-ae-f4.test.ts tests/pipelines/sync/retirements-live.test.ts tests/pipelines/sync/module-boundary.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed, 144 passed, and 9 tests in the t348 file. Paste `Test Files` and `Tests`. A red row here: STOP,
   `BLOCKED t348b rows <rows>`, with each assertion message (expected vs received) and, for T348-7, the start line the
   message quotes.
5. **Mutants**, each on the applied tree. Back up once from the clone root (Windows `$env:TEMP`, Linux `/tmp`):
   `open-brain/src/pipelines/session-start/reads-owed.ts` -> `t348b-ro.bak`,
   `open-brain/src/pipelines/session-start/start-report.ts` -> `t348b-sr.bak`, `open-brain/src/server.ts` -> `t348b-sv.bak`.
   For each `docs/loops/t348b/mN.txt` (m1-m8): apply (must print `APPLIED 1 edits to 1 files`), run
   `npx vitest run tests/pipelines/session-start/t348-reads-owed-reminder.test.ts --no-file-parallelism --testTimeout=180000`
   in `open-brain`, paste the failed rows, restore that file from its backup (never git checkout). m1-m5 are byte
   copies of t348's. Predicted red (rows 1-6 confirmed by the t348 build; rows 7-9 and m6-m8 NOT simulated):
   - m1 (the once-flag is never set, `reads-owed.ts`): T348-1, T348-4, T348-6, and now T348-8.
   - m2 (the line is printed with zero owed, `reads-owed.ts`): T348-2.
   - m3 (a dry run uses the reminder up, `reads-owed.ts`): T348-3, T348-6.
   - m4 (`ob_start` records an empty list, `start-report.ts`): T348-5, and now T348-7.
   - m5 (`handleState` ignores `dry_run`, `server.ts`): T348-6.
   - m6 (review F1: `collect` gets only the six shown paths, `reads-owed.ts`): T348-7 only.
   - m7 (review F2: the refusal branch also calls `readsOwedReminder`, `server.ts`): T348-8 only.
   - m8 (review M7: the string check on `paths` dropped, `reads-owed.ts`): T348-9 only.

   **A mutant with NO red row is a STOP** (`BLOCKED t348b <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed, and rerun the
   three `git hash-object` commands of step 3: the same hashes.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on (the review reproduced it
   red at START on the QA PC). Any other red row: STOP, `BLOCKED t348b suite <rows>`, with each assertion message.
7. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | grep -E "module-boundary|retirements"`
   (Windows: `Select-String -Pattern "module-boundary|retirements"`). Paste every line; both must be `[pass]`.
8. **Commit.** One commit, `T348b: the first state write of a session repeats the READS OWED list once (T-348)`.
   - Stage exactly the 4 paths: `open-brain/src/pipelines/session-start/reads-owed.ts`,
     `open-brain/src/pipelines/session-start/start-report.ts`, `open-brain/src/server.ts`,
     `open-brain/tests/pipelines/session-start/t348-reads-owed-reminder.test.ts`.
   - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars
     (Forge, melvenac@gmail.com).
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 4 paths: the three source files `M`, the test file `A`.
   - `git rev-parse HEAD:<path>` for each of the three source paths prints the three hashes of step 3.
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t348b <sha40>`; the planner lands the commit with `job.mjs land`. Do not try to push there.
   - Push the branch of step 2, never force, and never to `build/t348`. `git ls-remote origin refs/heads/<branch>` must
     equal HEAD. Name the branch in the reply.
   - `gh pr create --base master --head <branch> --title "T348b: the first state write of a session repeats the READS OWED list once (T-348)" --body "Brief: docs/loops/t348b-brief.md. Supersedes #1135; source identical to #1135, three more test rows."`.
   - Do not close, comment on or push to #1135; the planner closes it.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t348b <sha40> PR #<n>`, `HANDBACK t348b <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t348b <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Name any HIGH, CRITICAL or UNKNOWN impact target and say which rows cover its
  callers. Do not merge.

## After merge (not this run)

Unchanged from `docs/loops/t348-brief.md`.
