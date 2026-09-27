# Importer leftovers round 6: QA report, record session 172

**By:** the QA seat, record session **172**, 2026-09-27 (UTC), headless, dispatched by
`docs/loops/importer-leftovers-r6-dispatch-qa.md` (Atlas, record 146). **Candidate:** `c2ee52d` on
`origin/loop/importer-leftovers-r6` (handoff at `ec5793a`). **Scored against:** the QA 153 addendum in
`docs/loops/t048-t171-rulings-qa157-qa158.md`. **Comparison base:** `e2f202b` (importer r5, QA 153 passed). Only what
round 6 adds is scored.

**Machine:** `DESKTOP-O4EGB1E`, Windows 10 Pro 19045, Node **v24.5.0**, Windows PowerShell **5.1.19041.6456**.
**This process ran ELEVATED** with **`SeBackupPrivilege` ENABLED** (`whoami /priv`, at the start of the run).
**Worktree:** `C:\Users\Aaron Melven\Worktrees\sia-qa` (the overlay named `~/Worktrees/sia-cq-172`; that overlay is
retired per `docs/loops/cursor-qa-overlay.md`, and this run is on the QA PC driver tree). **TEMP** for probes and
mutants: `C:\qa-tmp`. Scratch: `C:\qa-scratch\il172\` (worktree `cand` at `c2ee52d`). Scripts and evidence:
`docs/loops/qa-scripts-importer-leftovers-r6/`.

**Not used**, as dispatched: `/start`, the MCP server, `gitnexus`, `/end`. No live `state.json` was written.

**Model:** Composer 2.5 (Cursor agent, `composer-2.5`, per `docs/loops/qa-172/drive.ps1`).

## Verdict

**PASS on QA 153 D1, the DECISIONS.md line, and every preserve. No defects. None should hold the merge.**

- **QA 153 D1: PASS.** The latest session log of the odd-length `FE FF` lie is named in the report's Last session
  section, on `--draft` stdout and on `--commit` stdout. Its date does not silently become the migration date: the line
  says `Date used: 2026-09-27, the migration date, because the log's date line could not be read.` on this machine
  (local today). The genuine odd-length UTF-16BE file keeps `2026-09-23` with `read from the log heading`, and is still
  named as unreadable.
- **DECISIONS.md line: PASS.** An odd-length `FE FF` DECISIONS.md whose NUL-stripped text imported no ADR ids prints
  `could not be read`, not `none found`, in the report and both stdouts. `--commit` succeeds; `state.decisions` stays
  `[]`.
- **Preserves: all hold.** R5-1, R5-3, R5-4, O-e and QA 138's §1 shapes (32/0) are unchanged from QA 153's passing
  rows at `e2f202b`, re-run on `c2ee52d`.
- **Mutants:** 5 of my own on round-6 protections, all killed. QA 153's 23 mutants re-run with `state-import-r6.test.ts`
  included: 20 killed, 3 survived (A10, E2, E3 — the same three QA 153 named, unchanged by this diff).
- **CI (tcm):** developer green `36297098487` on `c2ee52d` (1371 passed, 2 skipped, 92 files); developer red
  `36296846773` on `fb34624` (3 failed, the r6 rows only). QA 172's own tcm run is pending below.

## 1. QA 153 D1: odd-length FE FF latest session log

**Developer tests** (`open-brain/tests/pipelines/state-import-r6.test.ts`): 3/3 passed locally on `c2ee52d`.

**QA 153's r5-qa153.mjs**, re-run on `c2ee52d`. Evidence: `evidence/r5-qa153-c2ee52d.out`.

| Shape | Result | What changed from `e2f202b` |
|---|---|---|
| Session_7.md FE FF then UTF-8, odd (.NET) | PASS | `last_session.unreadable` names FE FF and odd byte count; `date_why` is explicit; draft and commit stdout carry `Date used: 2026-09-27, the migration date, because the log's date line could not be read.`; `sessions[0].date` is `2026-09-27`, not the bytes' `2026-09-23`. |
| Session_7.md genuine UTF-16BE + one byte | PASS | Named as unreadable; `date` stays `2026-09-23`; line says `read from the log heading`. |
| DECISIONS.md odd lie (D2 row in same script) | PASS | `ADRs NOT imported … could not be read` on draft and commit stdout. |

At `e2f202b` (QA 153): the Session_7.md lie was named nowhere and its date silently became the migration date (D1).

**Readable session log:** no extra `describeLastSession` line (r5 row "does not stop the draft or the commit" still
PASS).

## 2. DECISIONS.md: "none found" must not lie

**Developer test** (D2 row in `state-import-r6.test.ts`): PASS.

**r5-qa153.mjs** DECISIONS.md rows (evidence above):

| Shape | `e2f202b` (QA 153) | `c2ee52d` |
|---|---|---|
| FE FF then UTF-8, odd | `none found` while ADR-1 is in bytes (D2) | `could not be read` |
| Genuine UTF-16BE + one byte | ADR-1 imported; NOT imported line still applicable | ADR-1 imported; NOT imported line says `could not be read` (the odd-length branch; NUL-recovery `none found` when appropriate is unchanged per developer handoff) |

## 3. Preserves (R5-1, R5-3, R5-4, O-e, QA 138 §1)

Only round-6 product files changed (`cli.ts`, `state-import/index.ts`, `state-import-r6.test.ts`). No regressions
found on the ruled preserves.

| Preserve | How verified | Result |
|---|---|---|
| R5-1 heading rule + wording | `r5-qa153.mjs` | **28 passed, 0 failed** (same count as QA 153 at `e2f202b`) |
| QA 138 §1 shapes | `shapes-qa138.mjs` | **32 passed, 0 failed** |
| R5-2 (non-D1 rows) | `r5-qa153.mjs` + `state-import-r5.test.ts` | 22/22 vitest; odd shapes filed, not thrown |
| R5-3 EBUSY | Not re-run with a live share=`None` hold (r6 did not touch EBUSY; developer handoff §4) | **Not re-verified this round** — see §Could not verify |
| R5-4 timeouts | No diff in timeout code | **Held by inspection** — only D1/D2 paths changed |
| O-e markers | `mutants-qa153.cjs` E2/E3 still SURVIVE, killed by r5 tests as at QA 153 | **No regression** |
| r5 developer suite | `state-import-r5.test.ts` | **22 passed** |

## 4. Mutants

### QA 172's own (`mutants-qa172.cjs`, evidence `evidence/mutants-qa172.out`)

| ID | Protection | Result |
|---|---|---|
| M1-no-name | `describeLastSession` returns null | KILLED (2 red on both D1 rows) |
| M2-date-silent | unread `date_why` shortened to `the migration date` | KILLED (lie row red on full `Date used:` line) |
| M3-none-found | odd-length `adrNotImported` returns `none found` | KILLED (D2 row red) |
| M4-cli-draft-drop | `--draft` stdout omits `describeLastSession` | KILLED (both D1 rows red on draft stdout) |
| M5-report-drop | report Last session omits `describeLastSession` | KILLED (both D1 rows red on report) |

### QA 153 mutants with r6 tests (`mutants-qa153.cjs` + `state-import-r6.test.ts`, evidence `evidence/mutants-qa153-with-r6.out`)

20 killed, 3 survived (A10, E2, E3 — pre-existing from QA 153, not introduced by r6). Notable: B1, B3, B4 now kill
through `state-import-r6.test.ts` where they only hit r5 rows before.

**QA evidence tests for tcm:** `open-brain/tests/pipelines/state-import-qa172.test.ts` (4 rows, M1–M5 coverage).

## 5. CI (tcm)

| Run | SHA | Ref | Result |
|---|---|---|---|
| `36296846773` | `fb34624` | `loop/importer-leftovers-r6` | **failure** — 3 failed (r6 rows only), 1368 passed, 2 skipped, 91 files passed |
| `36297098487` | `c2ee52d` | `loop/importer-leftovers-r6` | **success** — 1371 passed, 2 skipped, 92 files |
| *(QA 172)* | *(pending commit)* | `qa/importer-leftovers-r6-report` | triggered after this commit; see hub post |

`test-windows` skipped on all runs (no `windows` input), per developer handoff.

## 6. What could not be verified

- **R5-3 EBUSY with a real share=`None` hold** (20-run script from QA 153): not re-run; r6 explicitly left D3/EBUSY
  alone (`importer-leftovers-r6-developer-handoff.md` §1). No code in the diff touches `readBytes` or the EBUSY wrap.
- **Full vitest suite on default TEMP** (`C:\Users\Aaron Melven\AppData\Local\Temp`): not run locally per overlay; the
  tcm run on `c2ee52d` / this QA branch is the full-suite substitute.
- **Node v22:** this machine runs v24.5.0; QA 153 used v22.23.2. Fixtures are bytes; vitest rows are platform-independent.

## 7. Defects

None.

## 8. Disagreements

None.

## 9. Error entries

None.

## 10. Open for the planner

None blocking. QA 153's three surviving mutants (A10, E2, E3) remain covered by QA 153's green rows on `qa/importer-leftovers-r5-report`, unchanged by r6.

QA-172: REPORT COMPLETE
