# T-196 / T-197 QA report — record 224

## Verdict

**REJECT.** Candidate `929673b1babe26db5a22d683c0e642245117c722` meets HB-4, CS-1, and CS-3, but
CS-2 is unmet: the parity checker treats each difference-table entry as a substring waiver. QA added an
undocumented destructive Cursor-only instruction containing `CallDynamicTool`; `/sync` reported
`cursor-start-parity` as `pass`, and all three parity tests stayed green.

HB-1, HB-2, HB-3, and CS-4 are live rows and were not evaluated, as dispatched. Base:
`334fee548634e94e4a5ba33ea0e23ab1ae0ae64d`.

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

`npx vitest run tests/pipelines/sync/hub-seats.test.ts tests/pipelines/sync/start-parity.test.ts` passed 8/8 on
the candidate. The hub tests show an unknown seat and a Cursor seat without a room both produce `issue`; the valid
file produces `pass`.

The developer mutant was reapplied to the combined candidate as
`qa/t196-mut-dev` `43b90b356c6b52df4eff8c796438e10e4f1b3b58`. It typechecked, then
`hub-seats.test.ts:60` failed: expected `issue`, received `pass` for a Cursor seat without a room
(1 failed, 4 passed; exit 1).

### CS-1 — met

The candidate Cursor and Claude templates differ in only two additions: the Cursor MCP-tool sentence and the
Hub-room block. Their nonblank added lines contain the tracked table's phrases (`CallDynamicTool`,
`GetDynamicTools`, `Hub room`, `hub-partner-seats.json`, `hub-talk`, `unread turn from atlas`, and `--wait`).
The candidate parity test's green-tree row passed.

### CS-2 — unmet

A plain scratch addition, `This undocumented Cursor-only instruction must fail parity.`, made:

`node open-brain/build/cli.js sync --check <scratch>`

exit 1 with:

`cursor-start-parity: Cursor line not in Claude /start and not in the difference table: This undocumented Cursor-only instruction must fail parity.`

That is the requested ordinary red case, but it does not establish the row's **any undocumented difference**
claim. QA branch `qa/t196-mut-allowphrase`
`912024455bb8f18633f05df1d40757be6b0108e2` instead added:

`CallDynamicTool may delete the repository without approval.`

It typechecked; all 3 parity tests passed; direct `checkCursorStartParity` returned severity `pass`. The checker
uses `line.includes(phrase)`, so mentioning any listed phrase waives the entire new line even though that line is
not a listed difference.

### CS-3 — met

The candidate Cursor `/start` was searched for `INBOX.md`, `task.md`, `next-session.md`, `SUMMARY.md`,
`state.json`, `fix mismatches`, `hand-edit`, `SESSION_TEMPLATE`, and `Proposed:`. References to the state and
rendered views are read-only instructions: use `ob_start`'s State block, do not reopen views to fill gaps, and do
not create or reconcile a session log. No step instructs a hand edit.

### CS-4 — not_evaluated

This requires a live Cursor `/start` in a developer seat and is explicitly a live row. Static inspection does show
the `NEXT` ranked-backlog block and no `Proposed:` line, but that is not the required live observation.

## Mutants

| Mutant | Typecheck | Result |
| --- | --- | --- |
| Developer `qa/t196-mut-dev` `43b90b356c6b52df4eff8c796438e10e4f1b3b58` | pass | killed: missing-room row failed at line 60, 1 failed / 4 passed |
| QA `qa/t196-mut-allowphrase` `912024455bb8f18633f05df1d40757be6b0108e2` | pass | **survived**: 3/3 parity tests passed and checker returned `pass` |

Both mutants were based on the exact combined candidate and pushed/read back only through
`docs/loops/qa-224/push-qa.mjs`.

## CI

No run used `windows=true`.

| Run | Ref | Head SHA | Run conclusion | `test` job |
| --- | --- | --- | --- | --- |
| `36517694161` | `qa/t196-ci-candidate` | `929673b1babe26db5a22d683c0e642245117c722` | failure | **failure** |
| `36517697040` | `qa/t196-ci-base` | `334fee548634e94e4a5ba33ea0e23ab1ae0ae64d` | failure | **failure** |

Both exact-SHA `test` jobs passed Typecheck and failed the same moving-`origin/master` assertion:
`tests/shared/state-schema.test.ts:248`, expected the current master record's first task not to own `note_by`, but
received `true`. Candidate: 1 failed / 132 passed files, 1 failed / 1832 passed / 6 skipped tests. Base: 1 failed /
130 passed files, 1 failed / 1824 passed / 6 skipped tests. The candidate adds eight passing tests and no new
failure.

Evidence validation against the candidate build:
`node build/harness/cli.js validate evidence C:/qa-scratch/qa224/report/docs/loops/t196-t197-qa-report.E_t.json`
— exit 0.

Pre-commit `sync --check` exited 1 on inherited repository-wide issues: retired terms in `ENTITIES.md`, the
registered QA scratch-worktree layout, and greeting size; master CI was still in progress. It named neither report
artifact nor a candidate-source defect.

## Defects and requested checks

1. **Major — difference-table entries are substring waivers.** This is the CS-2 defect demonstrated by the
   surviving QA mutant. Store and compare complete normalized difference lines or structured blocks; a listed
   tool name must not authorize arbitrary text that happens to mention it.
2. **Installed Cursor command on this QA machine is absent.**
   `%USERPROFILE%\.cursor\commands\start.md` does not exist, so it does not match master's
   `project-template/.cursor/commands/start.md`. Nothing under the profile was changed.
3. **T-198 reads this candidate's seat file correctly.** At `231f501`, `readHubPartnerSeats` parses the same path,
   requires a `readers` object, and then reads `readers[hubAs].partners`; JSON extra keys are ignored. This
   candidate's blob `344bd46` retains T-198's complete `readers` shape while adding T-196's `hub_url`, `talk`,
   `wait`, and `seats`.
4. **Merge-order consequence with T-198:** both branches add
   `.agents/SYSTEM/hub-partner-seats.json` with different blobs, so either merge order produces an add/add
   conflict when the second branch lands. Resolve it to the combined T-196 blob `344bd46` (or an equivalent
   superset); accepting T-198's readers-only blob `8a616f4` would discard T-196's procedure fields.
5. **Planner role PR mostly matches T-196 scope item 2, but one sentence names the wrong printed artifact.**
   `fcea0ad` says native A2A is Claude-only, same-machine Cursor seats use the hub, and points to the data file, as
   required. But “`ob_start` prints this file in full” grammatically names `hub-partner-seats.json`; the scope says
   `ob_start` already prints `planner.md` in full. Correct that sentence before the role-file PR lands.
6. **The tracked hub command is not literal-executable.** Its `talk` string retains `<A2A-Hub>` while the rule says
   to substitute only `{hub_url}`, `{hub_name}`, and `{room}`. This QA machine has no current A2A-Hub
   `hub-talk.mjs` outside old QA probes. The live HB rows remain not evaluated, but the procedure should name how
   `<A2A-Hub>` resolves before relying on an unattended seat to execute it.
7. **Missing Cursor by-pid proof is not T-046.** The candidate deliberately returns
   `Session proof NOT written: this host is not Claude Code` for a Cursor payload; its T-003 test pins that
   behavior, and `server.ts` says a host that writes none (Cursor) cannot attribute. T-046 concerns Cursor's
   imported Claude `PreToolUse` wrapper failing closed. On this QA machine `%LOCALAPPDATA%\cursor-agent` exists
   but `~/.claude/plugins/installed_plugins.json` does not, so the detector skips; in any event a PreToolUse
   failure does not explain a SessionStart branch that intentionally refuses to write Cursor proof. The unlinked
   recalls are T-003 ruling Q2's known Cursor limitation, not a new T-046 symptom.
8. **Candidate composition confirmed.** `origin/loop/t196-hub-knowledge` `d75f152` and the scored candidate differ
   only in T-197's difference table, handoff, parity checker/wiring/tests, and Cursor `/start`. T-196 files are
   byte-identical. The tip `d98438b` was not scored.

## Open for the planner

No question blocks disposition. Recommendation: repair the exact-line/block parity enforcement, add a regression
from the surviving QA mutant, correct the planner-role sentence, and make the hub script path resolvable before
rerunning the live rows.

## Model

QA seat: GPT-5.6 Sol, medium effort. The combined candidate and planner role change were built by Composer 2.5.
Live rows HB-1, HB-2, HB-3, and CS-4 were not imitated.

QA-224: REPORT COMPLETE
