# T-003 round 2 developer handoff

**By:** Forge (developer), record session **152**. This Cursor seat had no `SESSION_UUID` in the hook
output, so `ob_set_session` was not bound; the local session log this tree created is not the record
number.
**Model / effort:** Grok 4.7, in Cursor. This seat's transcript has no Claude Code per-entry `effort`
field, so none is reported.
**Candidate:** `loop/t003-r2` at **`d781b59`**, stacked on the round-1 handoff `9f4fc1e` / code
`706c029`. The brief named `706c029`; `origin/loop/t003` had already moved to the handoff, and round 2
is stacked on that.
**Brief:** `docs/loops/t179-t003-rulings-qa134-qa142.md` on `origin/docs/session-100-qa99-dispatch`,
section "T-003 round 2". Read only what that section names.
**No `/end`.** The live `state.json` and the real by-pid directory were not written. Tests use scratch.

`443b898` is the same handoff, written while three mutant runs were still open. This commit fills those
runs from the logs. The candidate is unchanged.

**"It works" is not a claim this seat can make.** What follows is what ran, and what it printed.

## What this round changed

T-003's contract, at the places round 1 did not hold:

| Protection | What the code does now |
|---|---|
| **D1** | `ob_start` passes the proven id, and `null` does not discover. No proof prints `Session ID: none — <reason>` and does not reuse another session's log. |
| **D3** | `ob_end` with no `session_id` uses the proven id for both `resolveRecalledIds` and `sessionEndV2`. A rating `ob_recalled` would list is written to `feedback_log`. |
| **R2-D1** | `applyStateOps` refuses when that uuid is already recorded with a non-null `checkout` that differs from this write's. The registration check is unchanged (T-003 had already stopped comparing checkouts there: only the proven id registers). Null checkout (a legacy session) is not refused. P3 registers against the victim checkout, where that uuid is local, so the writer is the door that refuses it. |
| **end.md** | All three copies. A write with no session records nothing in `sessions[]` and says so. A write is refused when its session is already recorded under a different checkout. A legacy record (`checkout` null) is not refused on that comparison. The old sentences ("Every write records its session", "Only a different checkout's recorded session is refused") are gone. |
| **D2** | A proof file whose JSON is `null`, not an object, or an array is a named refusal (`is not a session record`), not a `TypeError`. |
| **D4** | `ob_feedback` with no proof prints `NOT LOGGED: this server cannot prove its session — <reason>`. |
| **D5** | The proof block uses the same payload-then-flag `ide` as the slot. `--ide cursor` with no `cursor_version` writes no Claude proof. |
| **R2-D5** | `record-erasure` already flagged a hand removal of the migrated legacy session record. The missing row is in `record-erasure.test.ts`. |

`handleFeedback` is exported so the D4 row can call it. The tool still calls that function.

## Rows

- QA 142's D1 and D2, taken from `qa/t003-tests` `189f184`: `open-brain/tests/qa142-t003.test.ts`.
  The transcript directory uses `deriveProjectKey`, so the row looks where discovery looks on Windows
  as well as on Linux.
- The rest: `open-brain/tests/t003-r2.test.ts` (D1's `Session ID: none` line, D3, D4, D5, P2, P3, P4,
  same-checkout and null-checkout, the three `end.md` copies).
- R2-D5: `open-brain/tests/pipelines/sync/record-erasure.test.ts`, "a hand removal of the migrated
  legacy session record, after that seat has written a keyed session, is flagged".
- `sessionStart`: an explicit `null` does not discover (`index.test.ts`).

## Runs

`workflow_dispatch` of `ci.yml`. `hosted` and `windows` left unset. `test-windows` did not run.

**Red first**, tests only, on `573ac65`, tcm run **36287132237**. **11 failed, 1325 passed, 2 skipped**
(1338). The eleven were: QA 142 D1, QA 142 D2, D1's `Session ID: none —` line, `a null session id does
not fall back to transcript discovery`, D3, D4, D5, P2, P3, P4, and the `end.md` sentences. The
same-checkout / null-checkout row and the R2-D5 row passed: those protections already held.

**Green**, `d781b59`, tcm run **36287331316**. **Success.** 89 files, **1336 passed, 2 skipped** (1338).

## Mutants (one per protection)

Each branch is `d781b59` plus one edit. `tsc --noEmit` before each push. Read from the tcm log.

| Protection | Branch | SHA | tcm run | Kills |
|---|---|---|---|---|
| D1 discovery | `loop/t003-r2-mut-d1` | `245064b` | 36287373437 | QA 142 D1, and the null-id unit row (2 failed, 1334 passed). The greeting's `Session ID: none —` row stays green: that line is printed from the proof, not from the id discovery would have found. The log row is the one that contains the other session's id. |
| D2 null proof | `loop/t003-r2-mut-d2` | `9435a1d` | 36287383074 | QA 142 D2 (1 failed) |
| D3 `ob_end` id | `loop/t003-r2-mut-d3` | `1c5265b` | 36287393691 | D3 (1 failed) |
| D4 NOT LOGGED | `loop/t003-r2-mut-d4` | `41879cf` | 36287405024 | D4 (1 failed) |
| D5 `--ide` | `loop/t003-r2-mut-d5` | `0903ffc` | 36287418795 | D5 (1 failed) |
| R2-D1 writer | `loop/t003-r2-mut-r2d1` | `540e1d3` | 36287470332 | P2, P3 and P4 (3 failed). The same-checkout write and the null-checkout write stay green. |
| R2-D5 legacy session | `loop/t003-r2-mut-r2d5` | `5f3b048` | 36287503550 | the legacy-session removal row (1 failed). The edit is `isSuperseded(..., true)`, QA's `erasure-legacy-session`. |

**end.md**, local only (not a ninth dispatch), recorded in `443b898`: restoring "Every write records
its session in `sessions[]`" in `.claude/commands/end.md` failed the wording row (1 failed). The file
was restored.

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
- **`/sync --check`**, as recorded in `443b898` and not re-run for this commit: `20 passed, 4 warnings,
  4 issues, 4 skipped`. Named in that output: `mirror-parity` and `state-schema`. `state-schema` is
  this worktree's record still at schema v2; it was not migrated (the brief forbids writing the live
  `state.json`). The two Claude `end.md` copies are text-identical; the Cursor copy differs by its
  preamble. `build-freshness` reports this checkout's build is not `d781b59` (the hooks and server run
  from the main checkout). `gitnexus-index` skips: no `.gitnexus/` here.
- **No laptop (`windows=true`) CI.**
