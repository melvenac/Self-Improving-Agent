# T-048 round 1b QA report (QA seat, record session 173)

**By:** the QA seat, record session **173**, headless, launched by `docs/loops/qa-173/drive.ps1`.
2026-09-27 (UTC). **Machine:** `DESKTOP-O4EGB1E` (`$env:COMPUTERNAME`). **Worktree:**
`C:\Users\Aaron Melven\Worktrees\sia-qa`. **Model:** Composer 2.5 (as dispatched).
**Dispatch:** `docs/loops/t048-r1b-dispatch-qa.md`. **Candidate:** `d5b78cb` on `origin/loop/t048-r1b`
(handoff `f3bc55c`, `docs/loops/` only after `d5b78cb`). **Base for preserve:** `7913c5f` (T-048 r1,
QA 151 PASS). **Product:** `open-brain/src/pipelines/sync/checks.ts` and
`open-brain/tests/pipelines/sync/t048-r1b.test.ts`. **Scripts:**
`docs/loops/qa-scripts-t048-r1b/` (`mutants-qa173.mjs`). **Evidence:**
`C:\qa-scratch\t048-r1b\evidence\`. **Elevation: yes.** `SeBackupPrivilege` is **ENABLED**
(`whoami /priv`), same class as QA 151 and QA 157 on this PC. **Nothing live was written.** No
`state.json` was edited. **TEMP** for probes: `C:\qa-tmp`.

## Verdict

**PASS `d5b78cb`.** Round 1b fixes all three QA 151 output defects (D1–D3) without regressing QA
151's unreadable-path behaviour or the repository's own `sync --check` verdict counts. The eight
developer rows pass locally and on tcm (`36297117421`, 1329 passed). My three mutants (one per
item) are killed locally and are pushed for tcm confirmation (CI section).

## D1: real findings are named before unreadables; checks do not return early

**Holds** on all three checks named in the addendum, using QA 151's shapes:

| Check | Shape | Result |
|---|---|---|
| `template-personal-names` | unreadable `project-template/a.md` beside personal name in `b.md` | **Both named:** message contains `project-template/a.md` and `project-template/b.md ("Clark")` (`t048-r1b.test.ts` D1-TEMPLATE; local 8/8 pass) |
| `module-boundary` | unreadable `cli.ts` beside crossing `core/leak.ts -> db-v2.ts` | **Both named:** message contains `cli.ts` and `core/leak.ts -> db-v2.ts` (D1-BOUNDARY) |
| `retirements` | six unreadable files plus `docs/z-finding.md names widgetizer` | **Finding shown:** message contains `docs/z-finding.md names widgetizer`, not buried in `+N more` (D1-RETIREMENTS) |

**Code:** the early-return blocks on unreadable-only paths were removed from `checkTemplatePersonalNames`
and `checkModuleBoundary`; `checkRetirements` now concatenates `[...unexpected, ...stale]` before
unreadables and only applies the six-slot cap to the unreadable list (`checks.ts` ~1145–1165,
~1459–1474, ~420–433).

**Mutant `m-d1-early-return`:** restores the template early return; **killed** (2/8 rows fail locally;
D1-TEMPLATE loses Clark).

## D2: FALLBACK and PARTIAL stay in the message when there is also a finding

**Holds.** D2-PARTIAL: fallback walk with denied `hidden/` readdir and a retired-name finding prints
`docs/b.md names widgetizer`, `hidden/`, `FALLBACK`, and `PARTIAL` in one issue message. The
`scanNote` append after findings was added at `checks.ts` ~1156–1160.

**Mutant `m-d2-drop-label`:** removes `scanNote`; **killed** (D2-PARTIAL and D3-RETIREMENTS lose
`FALLBACK` locally).

## D3: the scope statement is complete in every check

**Holds** on all four D3 rows:

| Row | What is checked | Result |
|---|---|---|
| D3-TEMPLATE-PASS | pass carries scope | `report: true`, message has `1 file(s) read` |
| D3-TEMPLATE-ISSUE | issue carries scope | `report: true`, `file(s) read` beside the Clark hit |
| D3-BOUNDARY | unreadable issue carries file count | `report: true`, `file(s)` in message |
| D3-RETIREMENTS | finding carries listing label | `report: true`, `FALLBACK` in message |

**CLI proof (this repository, candidate build):** `template-personal-names [pass]` now prints
`37 file(s) read; excluded: none …` — invisible at `7913c5f` (QA 151 D3). The `retirements`
issue adds `(listed by git ls-files)` after the ENTITIES finding (`sync-cand.out`). That is scope
on the issue, not a verdict change.

**Mutant `m-d3-no-report`:** drops `report: true` on the combined template issue path; **killed**
(D3-TEMPLATE-ISSUE fails).

## Preserve: QA 151 behaviour and own-tree verdicts

| Preserve item | Result |
|---|---|
| Every truly unreadable path is still an ISSUE naming it | **Unchanged from r1.** r1b only changes ordering and message composition when a real finding is also present; the unreadable-only paths from QA 151 are not weakened (code review; r1 tests still in suite on tcm) |
| `sync --check` on this repository: same verdict counts at `7913c5f` and `d5b78cb` | **Holds:** both give `Summary: 23 passed, 0 fixed, 3 warnings, 2 issues, 4 skipped` (base worktree `C:\qa-scratch\t048-r1b\base`, candidate `sia-qa`) |
| `retirements` still issues on ENTITIES.md | **Holds:** identical finding text; candidate adds listing label on the issue line only |
| QA 151 real-unreadable probes (icacls, share-None, EISDIR, ENOENT) | **Not re-run on this seat.** `SeBackupPrivilege` is ENABLED here, so ACL and share-None denies are not observable without a privilege-disabled child (QA 151 §1). r1b does not touch the read/catch paths those probes exercise. **No disagreement** with QA 151 on this point |

**Expected cosmetic deltas (not regressions):** `module-boundary` excluded count 8→9 (added
`t048-r1b.test.ts` in tree), `merge-markers` file count +1, `build-freshness` HEAD strings differ.

## Mutants

| Mutant | Branch | Targets | Local (8 r1b rows) | tcm |
|---|---|---|---|---|
| `m-d1-early-return` | `qa/t048-r1b-m-d1-early-return` | D1 template early return | **killed** (2 fail) | pending — see CI |
| `m-d2-drop-label` | `qa/t048-r1b-m-d2-drop-label` | D2 `scanNote` removal | **killed** (2 fail) | pending |
| `m-d3-no-report` | `qa/t048-r1b-m-d3-no-report` | D3 `report: true` on template issue | **killed** (1 fail) | pending |

**Developer mutants (dispatch):** `loop/t048-r1b-mut-d1` run `36297377709`, d2 `36297433772`, d3
`36297488383` — all **failed** on tcm (killed). Red-before-green: `36296837114` at `9c1438a`
(test-only) had **8/8** `t048-r1b.test.ts` failures; green `36297117421` at `d5b78cb` had **8/8**
pass among 1329 total.

## CI

| Run id | Ref | Result | Notes |
|---|---|---|---|
| `36296837114` | `loop/t048-r1b` @ `9c1438a` (red) | failure | 8/8 r1b rows fail — expected before fix |
| `36297117421` | `loop/t048-r1b` @ `d5b78cb` (green) | success | 1329 passed, 2 skipped; r1b 8/8 pass |
| `36297377709` | `loop/t048-r1b-mut-d1` | failure | developer mutant killed |
| `36297433772` | `loop/t048-r1b-mut-d2` | failure | developer mutant killed |
| `36297488383` | `loop/t048-r1b-mut-d3` | failure | developer mutant killed |
| *(this seat)* | `qa/t048-r1b-report` + three `qa/t048-r1b-m-*` | pending | pushed with this report; `gh workflow run ci.yml --ref <branch>` |

## What could not be verified

- **Real icacls / share-None / EISDIR / ENOENT probes** were not re-run: this process is elevated
  with `SeBackupPrivilege` ENABLED, so the ACL and EBUSY classes from QA 151 §1 are not visible
  without `nopriv.ps1`. r1b's diff does not alter those read paths.
- **Hub post** (`hub-talk.mjs`) not run — no hub URL configured on this machine in the dispatch.

## Defects

None blocking. No new false passes found.

## Disagreements

None.

## Error entries

None.

## Open for the planner

- Confirm tcm results for the four QA-173 CI dispatches once runs complete.
- D3 on `retirements` when **only** unreadables (no finding) already had `report: true` at r1; r1b's
  D3 win is mainly `template-personal-names` reaching CLI output and the listing label on
  finding+unreadable issues.

## Model

Composer 2.5

QA-173: REPORT COMPLETE
