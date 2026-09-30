> **Copied by the planner (Atlas), record session 147, 2026-09-27T22:09Z.** QA 178's seat committed this report on the QA PC (`qa/t048-r2b-report` `81187d4`, later edits uncommitted) but could not push it: `push-qa.mjs` was refused by the Cursor deny list for this call, although it pushed the five mutant branches. Read verbatim over ssh from `C:\Users\AARONM~1\Worktrees\sia-qa\docs\loops\t048-r2b-qa-report.md` (122 lines, ending `QA-178: REPORT COMPLETE`).

# T-048 round 2b (QA 157's findings outside server.ts), candidate `822f398`: QA report (QA seat, record session 178)

**By:** the QA seat, record session **178**, headless, launched by `docs/loops/qa-178/drive.ps1` (Cursor,
Composer 2.5). 2026-09-27 (UTC). **Machine:** `DESKTOP-O4EGB1E` (`$env:COMPUTERNAME`). **Elevated: yes.**
`net session` succeeds, and `WindowsPrincipal.IsInRole(Administrator)` is `True`. Probes ran with
`HOME`/`USERPROFILE`/`KNOWLEDGE_V2_DB`/`OPEN_BRAIN_VAULT_DIR` at `C:\qa-scratch\qa178\.` and
`TEMP=TMP=C:\qa-tmp`. **Model:** `composer-2.5` (dispatch and `docs/loops/qa-178/drive.ps1`).
**Dispatch:** `docs/loops/t048-r2b-dispatch-qa.md`. **Candidate:** `822f398` on `origin/loop/t048-r2b`
(handoff `616aec1`, `docs/loops/` only after it). **Base accepted:** `5b9a403` (QA 157). **Brief:** Record 176
section of `docs/loops/followups-r165-r167-briefs.md`. **Scripts:** `docs/loops/qa-scripts-t048-r2b/` (outputs in
`evidence/`). Nothing live was written.

## Verdict

**ACCEPT `822f398`.** Every QA 157 defect this round scoped (D1 cli half, D2-D5, D3 test gaps) is fixed on the
product commit. `server.ts` is unchanged from the accepted r2 candidate. Session-end behaviour QA 157 accepted is
preserved (`tests/t048-r2.test.ts` 5/5 locally). The three mutants that survived QA 157 are killed on `822f398`
locally and on tcm after re-applying the same protections onto this head. Two additional mutants on D2 and D5 also
fail only their rows on tcm.

The `cli.ts` half of T048-D1 is done: `open-brain sync --score` prints
`Pipeline Health: N/10 (invocation log: <state>)` for missing, corrupt, unreadable, and empty logs. The two
`server.ts` score renderers still omit the state (T-048 round 3, unchanged here). QA 157's Open items R-1 through
R-6 remain pre-existing recommendations, not regressions.

## Dispatch checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | **T048-D1 (`cli.ts` half):** `sync --score` names invocation-log state on missing, corrupt, unreadable, empty | **Holds.** Built `cli.js sync --check --score` in a scratch home prints `(invocation log: missing)`, `(invocation log: corrupt)`, `(invocation log: empty)`, and `(invocation log: unreadable)` on the Pipeline Health line. Unreadable shown with the log path replaced by a directory (`EISDIR`). `formatScoreCategoryLine` unit path agrees for all four strings. | `probe-r2b.out` d1-*; `t048-r2b.test.ts` D1 |
| 2 | **T048-D2:** readable db with no `session_meta`  "holds no session", not unreadable | **Holds.** Zero-byte `.db` and foreign SQLite (no `session_meta`) both print `Summary: skipped - holds no session`. | `probe-r2b.out` d2-*; `t048-r2b.test.ts` D2 |
| 3 | **T048-D3:** QA 157's three survivors killed | **Holds.** Re-applied QA 157 protections onto `822f398`, pushed as `qa/t048-r2b-mut-*`, each red on tcm on its D3 row only (1318 passed, 2 skipped, 1321 total). | Mutants table; `t048-r2b.test.ts` D3 rows |
| 4 | **T048-D4:** stale JSDoc and `string \| null` on `unusableLog` | **Holds.** `unusableLog` returns `string`; timestamp JSDoc sits on `readLastInvocationTs` and documents null as the missing file only. | `t048-r2b.test.ts` D4; source read |
| 5 | **T048-D5:** honest labels for zero-byte log, no summary events, missing sessions dir | **Holds.** Zero-byte log reads `empty` (not `corrupt`); non-summary events  `no summary events` (not `no events`); missing sessions dir with session id  `no session db` (not `no db holds this session`). | `probe-r2b.out` d5-empty-read; `t048-r2b.test.ts` D5 |
| 6 | **Preserve:** QA 157 accepted behaviour; no new crash; `server.ts` untouched | **Holds.** `git diff 5b9a403..822f398 -- open-brain/src/server.ts` empty. `tests/t048-r2.test.ts` 5/5 and `pipeline-health.test.ts` 12/12 locally on `822f398`. | `probe-r2b.out` server-ts-diff; local vitest |
| 7 | **Own mutants,** at least two | **Two on tcm** (`d2-meta-unreadable`, `d5-empty-corrupt`), each kills only its row. | Mutants table |

## D1 detail

Four invocation-log shapes on the built CLI (scratch `HOME`, valid v2 knowledge db at `KNOWLEDGE_V2_DB`):

| State | Pipeline Health line (from `sync --check --score`) |
|---|---|
| missing file | `Pipeline Health: 0/10 (invocation log: missing)` |
| corrupt lines | `Pipeline Health: 0/10 (invocation log: corrupt)` |
| zero-byte file | `Pipeline Health: . (invocation log: empty)` |
| path is a directory | `Pipeline Health: . (invocation log: unreadable)` |

`sync --check` exits 1 on this tree's pre-existing issues (retirements, state-schema v2 vs v3); the score block
still prints. Repeated `--score` calls append history; later Pipeline Health numerators can rise from trend/shadow
while the parenthetical state name stays correct - see `d1-empty` vs `d1-line-empty` in the probe.

## Mutants

Driver `mutants-qa178.mjs`. Each anchor matched exactly once, `tsc --noEmit -p open-brain` clean before push,
sources restored after local `run`. QA 157 protections re-applied onto `822f398` (not cherry-picks of the old
`qa/t048-r2-mut-*` SHAs - equivalent one-file edits). Pushed with `docs/loops/qa-178/push-qa.mjs`. CI:
`gh workflow run ci.yml --ref <branch> -f hosted=false -f windows=false`, read with `ci-read.mjs`.

| Row | Mutant | Branch / HEAD | Local D3/D2/D5 | tcm run | tcm result |
|---|---|---|---|---|---|
| D3 hook-old-lines | restore pre-T-048 hook stdout | `qa/t048-r2b-mut-hook-old-lines` `a176f67` | killed | `36353688126` | **red:** D3 hook-old-lines only |
| D3 s6 | corrupt/unreadable earn hook recency 4 | `qa/t048-r2b-mut-s6-corrupt-earns-recency` `cd103e0` | killed | `36353689398` | **red:** D3 s6 only |
| D3 s14 | unreadable db returned before match | `qa/t048-r2b-mut-s14-skip-over-match` `c83d9ca` | killed | `36353690879` | **red:** D3 s14 only |
| D2 (QA-only) | `no such table: session_meta`  unreadable again | `qa/t048-r2b-mut-d2-meta-unreadable` `c6e9cc9` | killed | `36353692423` | **red:** D2 only |
| D5 (QA-only) | zero-byte log  corrupt | `qa/t048-r2b-mut-d5-empty-corrupt` `a1814bc` | killed | `36353693993` | **red:** D5 only |

Developer mutants on `loop/t048-r2b-mut-*` (`36302168161`, `36302204762`, `36302237000`, `36302281266`) agree:
each fails only its named row on the same test file.

## CI

**Developer (read by QA, not re-run):**

| Run | Branch @ SHA | Result |
|---|---|---|
| `36301987254` | `loop/t048-r2b` `9135d34` (tests only) | **red:** 4 failed in `t048-r2b.test.ts` (D1, D2, D4, D5); D3 rows passed |
| `36302113612` | `822f398` | **green:** 88 files, 1319 passed, 2 skipped (1321) |
| `36302168161` | `loop/t048-r2b-mut-d1` | **red:** D1 only |
| `36302204762` | `loop/t048-r2b-mut-hook-old-lines` | **red:** D3 hook-old-lines only |
| `36302237000` | `loop/t048-r2b-mut-s6` | **red:** D3 s6 only |
| `36302281266` | `loop/t048-r2b-mut-s14` | **red:** D3 s14 only |

**QA seat:** five tcm runs (budget 6), all mutants above - five red, each on one row. No Windows job. No hosted job.
No separate candidate run; developer green `36302113612` is the candidate record.

**Local:** `822f398` in `C:\qa-scratch\qa178\cand`: `t048-r2b.test.ts` 7/7, `t048-r2.test.ts` 5/5,
`pipeline-health.test.ts` 12/12 (24 tests, exit 0). Full suite not run on this machine.

## Defects

None on `822f398` within this round's scope.

## Disagreements

None with the developer handoff (`616aec1`) or QA 157's accepted r2 baseline.

## What could not be verified

- **Full local suite** on this desktop (in use per dispatch).
- **GitNexus impact** - no GitNexus MCP in this headless seat; blast radius read from imports and diffs.
- **Aaron's real knowledge db / sessions directory** - all probes use scratch stores.
- **ACL-denied invocation log** - elevated process; unreadable shown via directory path instead.
- **`/sync` before this report commit** - no `/sync` skill; closest read-only check is the probe's `sync --check`
  output (pre-existing tree issues only).
- **Report branch push:** `node docs/loops/qa-178/push-qa.mjs qa/t048-r2b-report` was blocked by the seat's
  permissions fence (`Command blocked by permissions configuration`). The report commit `81187d4` exists locally on
  `qa/t048-r2b-report`; mutant branches `qa/t048-r2b-mut-*` were pushed successfully before the block. Planner or
  Aaron must push the report branch (same command) or fast-forward `origin/qa/t048-r2b-report` from this machine.

## Open for the planner

Non-blocking; carried from QA 157:

1. **T-048 round 3:** wire `formatScoreCategoryLine` / invocation-log suffix into both `server.ts` score renderers
   (SILENT 4/9 scope), after T-179 r2 merges.
2. **R-1:** `session_meta LIMIT 1` false "no db holds this session" for non-first sessions in a per-project db.
3. **R-2:** second session end same day loses summary silently (`vault-writer.ts:225`).
4. **R-3:** `logInvocations` handle leak on garbage db (SILENT 7 area).
5. **R-4/R-5/R-6:** MCP `ob_end` naming (SILENT 9); see QA 157 Open items 5-6.

QA-178: REPORT COMPLETE
