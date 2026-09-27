# T-003 round 2 developer handoff

**By:** Forge (developer), record session **152**. This Cursor seat had no `SESSION_UUID` in the hook
output, so `ob_set_session` was not bound; the local session log this tree created is not the record
number.
**Model / effort:** Grok 4.7, in Cursor. This seat's transcript has no Claude Code per-entry `effort`
field, so none is reported.
**Candidate:** `loop/t003-r2` at **`d781b59`**, stacked on the round-1 handoff `9f4fc1e` / code
`706c029`.
**Brief:** `docs/loops/t179-t003-rulings-qa134-qa142.md` on `origin/docs/session-100-qa99-dispatch`,
section "T-003 round 2". Read only what that section names.
**No `/end`.** The live `state.json` and the real by-pid directory were not written. Tests use scratch.

**"It works" is not a claim this seat can make.** What follows is what ran, and what it printed.

## What this round changed

T-003's contract, at the places round 1 did not hold:

| Protection | What the code does now |
|---|---|
| **D1** | `ob_start` passes the proven id, and `null` does not discover. No proof prints `Session ID: none — <reason>` and does not reuse another session's log. |
| **D3** | `ob_end` with no `session_id` uses the proven id for both `resolveRecalledIds` and `sessionEndV2`. A rating `ob_recalled` would list is written to `feedback_log`. |
| **R2-D1** | `applyStateOps` refuses when that uuid is already recorded with a non-null `checkout` that differs from this write's. The registration check is unchanged. Null checkout (a legacy session) is not refused. |
| **end.md** | All three copies. A write with no session records nothing in `sessions[]` and says so. A write is refused when its session is already recorded under a different checkout. A legacy record (`checkout` null) is not refused on that comparison. The old sentences ("Every write records its session", "Only a different checkout's recorded session is refused") are gone. |
| **D2** | A proof file whose JSON is `null`, not an object, or an array is a named refusal (`is not a session record`), not a `TypeError`. |
| **D4** | `ob_feedback` with no proof prints `NOT LOGGED: this server cannot prove its session — <reason>`. |
| **D5** | The proof block uses the same payload-then-flag `ide` as the slot. `--ide cursor` with no `cursor_version` writes no Claude proof. |
| **R2-D5** | `record-erasure` already flagged a hand removal of the migrated legacy session record. The missing row is in `record-erasure.test.ts`. |

## Rows

- QA 142's D1 and D2, taken from `qa/t003-tests` `189f184`: `open-brain/tests/qa142-t003.test.ts`.
- The rest: `open-brain/tests/t003-r2.test.ts` (D1's `Session ID: none` line, D3, D4, D5, P2, P3, P4,
  same-checkout and null-checkout, the three `end.md` copies).
- R2-D5: `open-brain/tests/pipelines/sync/record-erasure.test.ts`, "a hand removal of the migrated
  legacy session record, after that seat has written a keyed session, is flagged".
- `sessionStart`: an explicit `null` does not discover (`index.test.ts`).

## Runs

**Red first**, tests only, on `573ac65`, tcm run **36287132237** (workflow_dispatch, `windows` not
set; `test-windows` skipped). **11 failed**, the rest of the suite passed. The failures were the
unfixed defects: D1 (both rows, plus the null-id unit row), D2 (`TypeError` on JSON `null`), D3
(`Recalled ids` not `from recall-log`), D4 (no `NOT LOGGED`), D5 (a Claude proof under `--ide cursor`),
P2, P3, P4, and the `end.md` sentences. The same-checkout / null-checkout row and the R2-D5 row
passed on that commit: those protections already held.

**Green**, `d781b59`, tcm run **36287331316**. **Success.** `test-windows` skipped. Locally, before
that push: `tsc --noEmit` clean; the four round-2 files **40 passed**; `t003-session-proof`,
`server`, `state-writer`, `session-order`, `closeout-erasure` **107 passed**.

## Mutants (one per protection)

Each branch is the fix plus one edit. A `failure` on tcm is the row killing it. Read the run for
the assertion; do not take this table as a substitute for the log where the run had not finished
when this file was written.

| Protection | Branch | SHA | tcm run | When this was written |
|---|---|---|---|---|
| D1 discovery | `loop/t003-r2-mut-d1` | `245064b` | 36287373437 | failure |
| D2 null proof | `loop/t003-r2-mut-d2` | `9435a1d` | 36287383074 | failure |
| D3 `ob_end` id | `loop/t003-r2-mut-d3` | `1c5265b` | 36287393691 | in progress |
| D4 NOT LOGGED | `loop/t003-r2-mut-d4` | `41879cf` | 36287405024 | queued |
| D5 `--ide` | `loop/t003-r2-mut-d5` | `0903ffc` | 36287418795 | queued |
| R2-D1 writer | `loop/t003-r2-mut-r2d1` | `540e1d3` | 36287470332 | failure |
| R2-D5 legacy session | `loop/t003-r2-mut-r2d5` | `5f3b048` | 36287503550 | in progress |

**end.md**, local only (not a ninth dispatch): restoring "Every write records its session in
`sessions[]`" in `.claude/commands/end.md` failed `end.md says what a write records` (1 failed).
The file was restored; `git diff` after that was empty.

R2-D5 was also killed locally before its branch existed: the `true` yield failed the legacy-session
row (1 failed, 15 passed in that file). Restored.

## Not this round (for the planner to file; this seat did not write `state.json`)

- **O-1.** `_parentStart` caches a null start time for the server's life, so one failed
  `processStartTime` disables attribution until reconnect. It fails closed.
- **O-2.** Proof files for claude processes that exit without SessionEnd are not pruned. The
  start-time check makes a stale file a refusal, not a wrong id.
- **Open 3.** An install with SessionStart and no SessionEnd is not detected. `setup.mjs` can
  repair one; nothing says one needs repair.
- **Row #348** waits. It needs the transcript `1f1d05c2-….jsonl` on Aaron's machine to show
  `ob_feedback(372, helpful)` at about 08:28:52Z. Session_53.md's id does not establish it.

## What is not shown

- **GitNexus `impact` / `detect_changes`:** not run. This worktree has no `.gitnexus/`
  (`gitnexus-index` skips). A stale index answers with a confident wrong blast radius.
- **`/sync --check`** on this tree: `20 passed, 4 warnings, 4 issues, 4 skipped`. Named in that
  output: `mirror-parity` and `state-schema`. `state-schema` is this worktree's record still at
  schema v2; it was not migrated (the brief forbids writing the live `state.json`). The two Claude
  `end.md` copies are text-identical (`git diff` empty); the Cursor copy differs by its preamble;
  `sync.md` was not touched. `build-freshness` reports this checkout's build is not `d781b59`
  (the hooks and server run from the main checkout). `gitnexus-index` skips: no `.gitnexus/` here.
- **No laptop (`windows=true`) CI.**
