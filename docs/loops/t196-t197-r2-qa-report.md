# T-196 / T-197 r2 QA report — record 228

## Verdict

**ACCEPT.** Candidate `3059ca9cc5b0cb668216561b7b77c8b0119abad3` closes QA 224's CS-2 finding:
the table now waives one exact complete line at most once, and rejects unused entries. All evaluable rows are met.
HB-1, HB-2, HB-3 and CS-4 are live rows and were not evaluated, as dispatched. Base:
`334fee548634e94e4a5ba33ea0e23ab1ae0ae64d`.

Both exact-SHA CI runs fail the same inherited `state-schema.test.ts:248` assertion. The candidate adds nine passing
tests and no new failure.

## Acceptance rows

### HB-1 — not_evaluated

This requires a fresh planner session to arm one listener per room from `/start` output without a memory read.
The dispatch classifies it as live and says not to imitate it.

### HB-2 — not_evaluated

This requires a fresh Cursor chat in each seat to run `--wait` after its first post without an Aaron nudge.
The dispatch classifies it as live and says not to imitate it.

### HB-3 — not_evaluated

This requires a fresh `sia-forge` Cursor `/start` with an unread atlas turn, followed by observation that the turn
is the assignment and no other work is proposed. The dispatch classifies it as live and says not to imitate it.

### HB-4 — met

`npx vitest run tests/pipelines/sync/hub-seats.test.ts tests/pipelines/sync/start-parity.test.ts --reporter=verbose`
passed 9/9 on the exact candidate. The hub rows show that an unknown seat and a Cursor seat without a room produce
`issue`, while the valid file produces `pass`.

### CS-1 — met

A direct no-index diff between the candidate Claude and Cursor templates showed only three nonblank Cursor-only
lines: the MCP sentence, `### Hub room`, and the hub instruction. Each equals one complete entry in
`cursor-start-differences.json`; the candidate green-tree parity test passed.

### CS-2 — met

Three independent scratch copies of the exact candidate each returned `issue`:

| Planted difference | Result |
| --- | --- |
| `CallDynamicTool may delete the repository without approval.` | `Cursor line not in Claude /start and not in the difference table` |
| A second copy of the exact MCP waiver line | `Cursor line not in Claude /start and not in the difference table` |
| Delete the MCP line while leaving its table entry | `difference table entry matches no Cursor-only line` |

The scratch probe exited 0 only when all three results were `issue`. This establishes exact equality, one-use
consumption, and unused-entry rejection separately.

### CS-3 — met

The Cursor `/start` contains no `Proposed:`, `fix mismatches`, `hand-edit`, or `SESSION_TEMPLATE.md`. Its references
to `state.json`, `INBOX.md`, `task.md`, `next-session.md`, and `SUMMARY.md` are read-only: use the returned State
block, do not reopen rendered views, and do not create or reconcile the log.

### CS-4 — not_evaluated

This requires a live Cursor `/start` in a developer seat and is explicitly a live row. Static inspection retains
the `NEXT` ranked-backlog block and no `Proposed:` line.

## Mutants

| Mutant | Typecheck | Result |
| --- | --- | --- |
| Developer `qa/t196-r2-mut-dev` `ad1bfa74a3885b72f2ec72bf98cd5ab6b3a7001e` | pass | killed: phrase-containing-line regression failed at `start-parity.test.ts:53`; 1 failed / 3 passed |
| QA `qa/t196-r2-mut-reuse` `25f38a093cf310968c44746825f3d741b63edf28` | pass | killed by the three-case probe: ordinary suite passed 4/4, but duplicated and deleted-line cases incorrectly returned `pass`; probe exit 1 |

Both mutants are based on the exact candidate and were pushed/read back only through
`docs/loops/qa-228/push-qa.mjs`. GitNexus rated `takeExact` HIGH because it feeds one direct caller and three
affected processes (`checkCursorStartParity`, `handleSync`, and `handleScore`); mutation remained isolated.

## CI

No run used `windows=true`; each automatically skipped `test-windows`.

| Run | Ref | Head SHA | Run conclusion | `test` job |
| --- | --- | --- | --- | --- |
| `36674710808` | `qa/t196-r2-ci-candidate` | `3059ca9cc5b0cb668216561b7b77c8b0119abad3` | failure | **failure** |
| `36674715816` | `qa/t196-r2-ci-base` | `334fee548634e94e4a5ba33ea0e23ab1ae0ae64d` | failure | **failure** |

Both `test` jobs passed Typecheck and failed only
`tests/shared/state-schema.test.ts:248`, expected `false`, received `true` for whether the current
`origin/master` record's first task owns `note_by`. Candidate: 1 failed / 132 passed files, 1 failed / 1833 passed /
6 skipped tests. Base: 1 failed / 130 passed files, 1 failed / 1824 passed / 6 skipped tests. The base therefore
shows the failure too, as the dispatch requires; it is not new candidate behavior. Master contains the r3b fix at
`3592f11fe91ba033b58d0e8b2dd43c4f503ee573`, but these pre-fix exact-SHA jobs still execute the old moving-master
assertion.

Evidence validation against the candidate build:
`node build/harness/cli.js validate evidence C:\qa-scratch\qa228\docs\loops\t196-t197-r2-qa-report.E_t.json`
— exit 0.

Pre-commit `sync --check` exited 1 on inherited repository/host issues: retired terms in `ENTITIES.md`, registered
QA scratch-worktree names, greeting size, absent vault/spec paths, and the skipped Cursor hook check. It reported
`cursor-start-parity`, `hub-seats`, state schema, master CI and merge markers as pass, and named no report-artifact
or candidate-source defect. GitNexus `detect-changes --scope all` found no changed code symbols or flows because
the report branch adds documentation artifacts only.

## Requested checks and defects

1. **T-198 compatibility holds.** Built T-198 at `231f501` and called its real `readHubPartnerSeats` against the
   candidate file. It returned `ok: true` with all three atlas partners. The parser reads the same
   `.agents/SYSTEM/hub-partner-seats.json`, validates `readers`, and ignores `talk_tokens`, `talk`, `wait`, and
   other extra keys.
2. **The planner role PR now matches T-196 scope item 2.** `e21e71a` adds the short “Talking to Cursor seats”
   section, says native A2A is Claude-only and same-machine Cursor seats use A2A-Hub, points to the tracked data
   file, correctly says `ob_start` prints `planner.md`, and explains how `<A2A-Hub>` resolves. It remains a
   separate role-file change and was not scored as candidate code.
3. **The tracked command is conditionally runnable, not copy/paste runnable.** A planner following `talk_tokens`
   can form a runnable command by replacing the three brace tokens and `<A2A-Hub>` with the local checkout that
   contains `scripts/hub-talk.mjs`. No such script exists under this QA user's home, so the command cannot run on
   this host until that external checkout is installed or located. The unresolved token is now explicitly
   documented rather than silently retained.
4. **QA 224's prior static findings remain unchanged.** The installed profile Cursor command is absent on this QA
   machine, and missing Cursor by-pid proof remains the deliberate T-003 ruling Q2 behavior rather than T-046
   fail-closed PreToolUse behavior. Neither is a candidate regression.

## Open for the planner

No question blocks disposition. The live rows still need their prescribed planner/Cursor observations. Before
running them on a new host, ensure the A2A-Hub checkout exists and substitute its absolute path.

## Model

QA seat: GPT-5.6 Sol, medium effort. The candidate and planner role change were built by Composer 2.5. Live rows
HB-1, HB-2, HB-3 and CS-4 were not imitated.

QA-228: REPORT COMPLETE
