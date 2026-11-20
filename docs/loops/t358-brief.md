# T358: a task records its predicted effect before the change and its observed effect at close (T-358)

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-20, session 178. **Tasks:** T-358. **Tag:** `t358`. **Size:** SMALL (three source
files, one existing test file, one new test file). **Base:** the START sha the launcher names (a master that contains
this brief; drafted against `280a91d770c659ac2db12d844e30abae3788e13c`). **Authority:** Aaron, 2026-11-20, typed in Atlas's window ("Write the brief
loop", after the read of arXiv 2611.18856); merge on Atlas's QA ACCEPT and Aaron's word. No auth, deps, workflows or
hooks.

```text
IMPACT-TARGETS: TaskSchema KEY_ORDER OpSchema applyOne
```

New in `state-writer.ts`, so not in the line above (it does not exist at the base): `editEffect`. `editNote`,
`appendNote`, `checkOp`, `opShape` and `describeShape` are not edited. The shape a refusal prints is derived from
`OpSchema`, so it gains the new fields with no code of its own.

## Why

arXiv 2611.18856 (Self-Improvement Memory) carried an evolved agent harness to a new model or benchmark, with and
without a record of its own edits. What made the record useful was that each edit stored what it was predicted to fix,
written before the test, and what it fixed afterwards, failures included. Keeping only the diagnosis was no better than
keeping nothing. Accepted edits often missed their prediction (0 of 4 in one case, 2 of 8 in another).

SIA records why a change was made. It does not record what the change should fix, or whether it did. A task closes on
a merge and a live check, which says the change was accepted, not that it worked. This brief adds the two fields and
one rule in code: a task that made a prediction cannot close without saying what happened.

## What changes

`docs/loops/t358/edits.txt`, 11 edits in 4 files, plus one test file copied in. No new dependency, no hook, no
settings, no `package.json`, no `schema_version` bump (the record stays v3), no change to any rendered view.

1. **`state-schema.ts` `TaskSchema`:** two optional keys after `assignee`, `predicted` and `observed`, each
   `z.string().min(1).optional()`. Optional with no default, as `assignee` (T-236): absent stays absent on disk, so no
   write stamps the keys onto other tasks. `KEY_ORDER.tasks` gains `"predicted", "observed"` after `"assignee"`
   (T-238: a field missing from `KEY_ORDER` vanishes from disk, and `assertKeyOrder` refuses the write).
2. **`state-writer.ts` `OpSchema`:** `open_task` takes optional `predicted`. `update_task` takes optional `predicted`
   and `observed`. `close_task` takes optional `observed`. All `z.string().min(1)`. The ops stay strict: `observed` on
   `open_task`, `predicted` on `close_task`, and a misspelt key are refused as unknown keys.
3. **`state-writer.ts`, new `editEffect(t, op, ctx, closing)`**, called by `update_task` (`closing` false) and
   `close_task` (`closing` true). It checks every rule before it sets anything:
   - `predicted` given and the task already has `observed`: refused,
     `<id> already has an observed effect; a prediction cannot change after the result is recorded`.
   - `observed` given and the task has no `predicted` (on the task or in this same op): refused,
     `<id> has no predicted effect to compare with; set predicted first`.
   - closing, the task has `predicted`, has no `observed`, and the op gives none: refused,
     `<id> has a predicted effect and no observed effect: close it with observed: "<what happened>" (it may say the prediction did not hold, or was not measured and why)`.
   - otherwise it sets what was given. `predicted` may be replaced while there is no `observed`. `observed` may be
     replaced.

   In `close_task` the call sits after the "already done" check and before the task is marked done. A refusal reaches
   the caller as `ops[<i>] (<op>): <text>`, as every semantic refusal does.
4. **`open_task`** stores `predicted` when given. A task opened without it has no key.
5. **Printed lines.** Each set pushes one line onto `ctx.noteChanges`: `<id> predicted SET: <n> chars`,
   `<id> observed SET: <n> chars`. They reach the tool result through the existing `note_changes` loop in `server.ts`
   (printed as `NOTE CHANGE: T-9 predicted SET: 42 chars`), dry run included. `server.ts`'s handler is not edited.
6. **`server.ts`, the `ob_state` description:** one sentence, after the T-171 sentence, naming both fields and the
   three rules.
7. **`reopen_task` is not edited.** A reopened task keeps both fields (row E17 pins this). See "Not in this brief".

### What does not change (read at the base)

- **Views.** INBOX.md and task.md print titles; no renderer walks a task's keys (`git grep` for
  `Object.keys`/`Object.entries` on a task in `open-brain/src` and `scripts`: none). `ob_start`'s State block prints
  `[status] id title`. The fields are read from `.agents/state.json`.
- **`state-migrate`, `state-import`, `checks-state.ts`, `state-reader.ts`, `state-render.ts`, `hub-seat-state.ts`,
  `end-record-guard.ts`:** none names a task key list, and none handles `assignee` specially, so there is nothing to
  mirror. `assignee`'s only other readers are `focus.ts` and `/sync` `task-assignees`.
- **Docs.** No tracked doc outside `docs/loops/` lists the fields of an `ob_state` op (`git grep` for `append_note`:
  `CHANGELOG.md`, `server.ts`, `state-writer.ts`, `state-migrate`). No command file, template file or role file
  changes. `CHANGELOG.md` and the version are the planner's at release, not this run's.
- **Retirements.** `.agents/retirements.json` pins line hashes at `server.ts:675`, `state-writer.ts:490` and
  `state-schema.ts:55`. None of those lines is edited, and no added line matches a retired pattern (checked by running
  every pattern over the applied files on the desktop, plain node).

### Not in this brief

- **Reopen.** After `reopen_task` the old `observed` still stands, so a second close passes without a new observation
  and the prediction cannot be rewritten. A new observation can still be given at the close (E17). Whether reopen
  should move the old `observed` into the note and clear it is a planner ruling for a later task.
- **Schema-level rules.** `TaskSchema` does not refuse a hand-edited record that has `observed` without `predicted`.
  The writer is the gate, as it is for notes.
- **Showing the fields at `/start`**, provenance on rules and hooks, and grouping attempts under a recurring problem.

## Existing tests that pin this behaviour (planner read at `280a91d770c659ac2db12d844e30abae3788e13c`; rows NOT run)

**One existing constant turns red; edits.txt updates it.**

| file / row | verdict |
|---|---|
| `tests/shared/t271-op-refusals.test.ts` A6 (`update_task expects: ${UPDATE_TASK_SHAPE}`) | **turns red; new expected value**: the constant gains `predicted?: string (non-empty), observed?: string (non-empty), ` between `assignee?: string (non-empty) \| null, ` and `append_note?:` (edit 11) |
| same file A1-A5, A7-A9 | stay green: `add_verified`, `set_handoff`, `close_gap` shapes and the op-name list are unchanged; A9's `close_task` on an unknown task is refused before `editEffect` |
| same file A10, and `tests/shared/state-writer.test.ts` "the ob_state description lists reopen_gap (RG4)" | stay green: both are `toContain` on the description line, which only gains a sentence |
| `tests/shared/op-shape.test.ts` S3 (every shape starts `{op: "<name>"` and is at most `SHAPE_MAX` = 800 chars) | stays green, inferred: `update_task`'s shape grows from 258 to 321 characters |
| `tests/shared/state-keyorder.test.ts` row 1 (`KEY_ORDER[slot]` and the schema's keys are equal sets), `keyOrderGaps()` is empty, and the three `assignee` rows | stay green: the schema and `KEY_ORDER.tasks` gain the same two keys; the `assignee` rows remove or set only `assignee` |
| `tests/shared/state-writer.test.ts` (9 `close_task` ops), `tests/shared/state-writer-notes.test.ts` (3), `tests/shared/session-order.test.ts` (2), `tests/server.test.ts` (1) | stay green: every task they close has no `predicted`, so `editEffect` returns null and sets nothing; the note lines they pin are pushed after it, in the same order as before |
| `tests/pipelines/sync/retirements-live.test.ts` | stays green, inferred: no pinned line is edited (see above) |
| `tests/harness/s4-guards.test.ts` | stays green: the new file has no `skip`, `skipIf`, `runIf` or `todo` |

New rows, all in the new file `open-brain/tests/shared/t358-predicted-observed.test.ts` (beside the other
state-writer tests; it uses the same fixture record, `tests/fixtures-state/state.json`, revision 7, as T-271's file):

- **E1** a record with neither key parses; a write does not stamp the keys onto any task.
- **E2** `open_task` stores `predicted` and prints its size; a task opened without it has no key.
- **E3** a dry run prints the same line and writes nothing.
- **E4** `update_task` sets `predicted` and replaces it while there is no `observed`.
- **E5** `update_task` sets `observed` on a task that has `predicted`, and prints its size.
- **E6** `predicted` cannot change once `observed` is set (exact text), alone or with a new `observed`.
- **E7** `observed` without `predicted` is refused on `update_task` (exact text); both in one op are stored, two lines.
- **E8** `observed` without `predicted` is refused on `close_task`; the task stays open.
- **E9** `close_task` refuses a task with `predicted` and no `observed` (exact text), with or without a note.
- **E10** `close_task` with `observed` closes the task, stores it, prints its size.
- **E11** a task whose `observed` was set earlier closes with no `observed` in the close op.
- **E12** a task with neither field closes as before: the same keys on disk, no printed line.
- **E13** the rules see earlier ops of the same batch; a refused batch writes nothing.
- **E14** strictness: `predict`, `observed` on `open_task`, `predicted` on `close_task`, and empty values are refused.
- **E15** `opShape` for `update_task` and `close_task` (exact), `open_task` (its tail), `reopen_task` (unchanged).
- **E16** both fields are on disk after `closed_rev` and `assignee`, and survive serialize then parse byte for byte.
- **E17** `reopen_task` leaves both fields; a later close may replace `observed`.
- **E18** the `ob_state` description names both fields and the close rule.

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t358`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), then `node -e "require('better-sqlite3')"`; on "Could not locate the
   bindings file" run `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes in the clone, any MCP config,
     `npm install`, any hook registration or `settings*.json`, `package.json`, `CHANGELOG.md`, `.github/`, the repo's
     own `.agents/` (do NOT call `ob_state` or write this repository's `state.json`), and anything under `docs/`.
3. **Apply.** `node docs/loops/t358/apply.cjs . docs/loops/t358/edits.txt` must print exactly
   `APPLIED 11 edits to 4 files`. Then, from the clone root:
   `Copy-Item docs/loops/t358/t358-predicted-observed.test.ts open-brain/tests/shared/t358-predicted-observed.test.ts`.
   In `open-brain`: `npx tsc --noEmit` (exit 0), `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build`
   (exit 0). A type error here is a STOP: `BLOCKED t358 tsc`, with the full error text (no edit was type-checked
   before this run).
4. **The nine files.** In `open-brain`:
   `npx vitest run tests/shared/t358-predicted-observed.test.ts tests/shared/t271-op-refusals.test.ts tests/shared/op-shape.test.ts tests/shared/state-keyorder.test.ts tests/shared/state-writer.test.ts tests/shared/state-writer-notes.test.ts tests/shared/session-order.test.ts tests/server.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files` and `Tests`. A red row here: STOP, `BLOCKED t358 rows <rows>`, with each assertion
   message (expected vs received). The output carries non-ASCII characters: paste it as printed, and if you filter it
   use `grep -a`.
5. **Mutants**, each on the applied tree. Back up once from the clone root (Windows `$env:TEMP`, Linux `/tmp`):
   `open-brain/src/shared/state-writer.ts` -> `t358-sw.bak`,
   `open-brain/src/shared/state-schema.ts` -> `t358-ss.bak`,
   `open-brain/src/server.ts` -> `t358-sv.bak`. Use `Copy-Item` or `cp`, never `Get-Content | Set-Content` (it mangles
   the files' non-ASCII characters).
   For each `docs/loops/t358/mN.txt` (m1-m15): apply (must print `APPLIED 1 edits to 1 files`), run
   `npx vitest run tests/shared/t358-predicted-observed.test.ts tests/shared/t271-op-refusals.test.ts tests/shared/state-keyorder.test.ts --no-file-parallelism --testTimeout=180000`
   in `open-brain`, paste the failed rows, restore that file from its backup (never git checkout). The tests run the
   sources through tsx, so no rebuild and no type check between mutants.
   Predicted red (NOT simulated; read from the code):
   - m1 (`"predicted"` dropped from `KEY_ORDER.tasks`, `state-schema.ts`): every T358 row that writes (E1-E14, E16,
     E17), by `serializeState refused`; and the existing state-keyorder rows "KEY_ORDER lists exactly the schema's
     keys" (slot tasks) and "keyOrderGaps() is empty".
   - m2 (`open_task` does not store `predicted`): E2.
   - m3 (a prediction may change after `observed`): E6, E17.
   - m4 (`observed` accepted with no `predicted`): E7, E8.
   - m5 (the close rule never fires, inside `editEffect`): E9, E13.
   - m6 (the close rule ignores an `observed` given in the close op): E10, E13, E17.
   - m7 (the close rule fires on a task with no `predicted`): E12.
   - m8 (`open_task` does not print the line): E2.
   - m9 (the `observed` line prints the wrong size): E5, E7, E10, E13, E17.
   - m10 (`update_task` passes an empty op to `editEffect`): E3, E4, E5, E6, E7, E9, E10, E11, E13, E16, E17.
   - m11 (`close_task` calls `editEffect` with `closing` false): E9, E13.
   - m12 (`observed` removed from the `update_task` op): E5, E6, E7, E11, E15, E16, and T-271's A6.
   - m13 (`predicted` and `observed` in one op is refused): E7, E11, E16.
   - m14 (the description says `close_task accepts`): E18.
   - m15 (an existing `predicted` is not replaced): E4.

   **A mutant with NO red row is a STOP** (`BLOCKED t358 <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on; CI judges it. Any other
   red row: STOP, `BLOCKED t358 suite <rows>`, with each assertion message. (Most likely source if one appears: a row
   that pins the full text of an op's expected shape, or a harness check on `server.ts`'s tool descriptions.)
7. **Sync.** From the clone root:
   `node open-brain/build/cli.js sync 2>&1 | grep -a -E "module-boundary|retirements|state-schema" | cut -c1-300`
   (Windows: `Select-String -Pattern "module-boundary|retirements|state-schema"`, each line cut to 300 characters).
   Paste every line. The `module-boundary` and `retirements` check lines must be `[pass]`.
8. **Commit.** One commit, `T358: a task records its predicted effect and its observed effect; close_task refuses a prediction with no result (T-358)`.
   - Stage exactly the 5 paths: `open-brain/src/shared/state-schema.ts`, `open-brain/src/shared/state-writer.ts`,
     `open-brain/src/server.ts`, `open-brain/tests/shared/t271-op-refusals.test.ts`,
     `open-brain/tests/shared/t358-predicted-observed.test.ts`.
   - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars
     (Forge, melvenac@gmail.com).
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 5 paths: four `M`, and `A` for the new test file.
     `git rev-parse HEAD:open-brain/tests/shared/t358-predicted-observed.test.ts` must print the same blob id as
     `git rev-parse HEAD:docs/loops/t358/t358-predicted-observed.test.ts` (the committed file is the drafted one).
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t358 <sha40>`; the planner lands the commit with `job.mjs land`. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t358` must equal HEAD.
   - `gh pr create --base master --head build/t358 --title "T358: a task records its predicted effect and its observed effect; close_task refuses a prediction with no result (T-358)" --body "Brief: docs/loops/t358-brief.md."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t358 <sha40> PR #<n>`, `HANDBACK t358 <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t358 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Name any HIGH, CRITICAL or UNKNOWN impact target from the launcher's prompt and say
  which rows cover its callers (`applyOne`: E2-E13 and the four existing writer files in step 4; `TaskSchema` and
  `KEY_ORDER`: E1, E16 and state-keyorder; `OpSchema`: E14, E15 and T-271). Do not merge.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`. `ob_state` runs in the MCP server, which keeps its schema for the life of the process, so
the new fields need Aaron's reconnect in every session that will write or read a record carrying them.

- **Order matters, because `TaskSchema` is strict and the record stays v3.** A build without this change refuses a
  record in which any task has `predicted` (an unrecognized key), and it says so as a parse error, not as "the record
  is NEWER". So: rebuild, reconnect, and only then write the first `predicted` into a record. Until every checkout
  and server that reads a repository's record runs this build, do not use the fields in that repository.
- Live checks, in this repository after the reconnect: (1) a dry run of
  `update_task T-358 predicted: "<text>"` prints `NOTE CHANGE: T-358 predicted SET: <n> chars` and writes nothing;
  (2) the same write applied, then a dry run of `close_task T-358` is refused with the "has a predicted effect and no
  observed effect" text; (3) `open-brain sync` still reports `state-schema` as before.
- **Not changed, by the ruling:** `schema_version`, the views, `reopen_task`, `state-migrate`, `state-import`, and any
  existing task (none has either field).
