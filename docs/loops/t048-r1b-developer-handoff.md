# T-048 round 1b: developer handoff (record 165)

**By:** Forge, record 165. **Seat:** `~/Worktrees/sia-forge`. **Model:** Grok 4.7. **Date:** 2026-09-27.

**Brief:** `docs/loops/followups-r165-r167-briefs.md`, common rules and the record 165 section, on
`origin/docs/session-100-qa99-dispatch`. Addendum read for the verdict only:
`docs/loops/t048-t171-rulings-qa157-qa158.md`. QA 151 defects and open items:
`docs/loops/t048-r1-qa-report.md` on `origin/qa/t048-r1-report`. Rows:
`qa/t048-r1-tests-red`, `t048-qa151-defects.test.ts`.

**Branch:** `loop/t048-r1b` from `7913c5f` (T-048 r1). **Product: `d5b78cb`.** This handoff is the commit on top of it.
Records 166 and 167 were not implemented. `server.ts` was not edited.

## 1. What changed

One file, `open-brain/src/pipelines/sync/checks.ts`.

**D1.** An unreadable path is named beside the real finding.

- `checkTemplatePersonalNames` no longer returns when `unreadable` is non-empty. One issue names every hit and every unreadable path, then the scope (`N file(s) read; excluded …`).
- `checkModuleBoundary` no longer returns before the graph. A file whose source was not read is skipped (`sources.get` is undefined) so the graph does not throw. The issue fires when there is a crossing or an unreadable path, and it names both.
- `checkRetirements` names every finding, then at most six unreadables. The six-cap and the `+N more` apply to unreadables. A retired name no longer falls into `+N more` behind six unreadable paths.

**D2.** When `checkRetirements` has a finding, the listing label stays on the message. A fallback walk that is also partial still contains `FALLBACK` and `PARTIAL`. The no-finding path is unchanged: it still says lowercase `partial`, which SILENT 26 asserts.

**D3.** The scope is on the message, and `report: true` is set, so `/sync` prints it (`cli.ts` filters `c.report`; `server.ts` does the same and was not edited).

- Template pass and template issue: `report: true`. The pass already said `N file(s) read`.
- Module-boundary issue: `Checked ${scale}`, which contains `file(s)`. The pass already had the scale and `report: true`.
- Retirements finding: `report: true`, and the listing label (the `FALLBACK` text).

## 2. Callers

The only callers of the three functions are `runSync` in `open-brain/src/pipelines/sync/index.ts` (it pushes each result onto the check list). `cli.ts` (the reported-checks filter) and `server.ts` (the same filter) print a check when `report` is set. Nothing else reads these three messages to decide a later action.

GitNexus impact was not run. The sync before this handoff measured the index 123 commits behind `d5b78cb` (indexed `6bd97f2`), and this worktree has no GitNexus checkout. The caller list above is from reading the imports.

## 3. Red, read per test

**Run** `36296837114`, `loop/t048-r1b` `9c1438a` (tests only), tcm, `workflow_dispatch`, hosted and windows left false. Failure. **Test Files 1 failed | 87 passed (88). Tests 8 failed | 1321 passed | 2 skipped (1331).** Every failure is in `t048-r1b.test.ts`.

| Row | Assertion that failed | What the candidate returned |
|---|---|---|
| D1-TEMPLATE | message contains `project-template/b.md ("Clark")` | `1 unreadable path(s) under project-template/ … project-template/a.md (EACCES)` |
| D1-BOUNDARY | message contains `core/leak.ts -> db-v2.ts` | `1 unreadable path(s) under open-brain/src … cli.ts (EACCES)` |
| D1-RETIREMENTS | message contains `docs/z-finding.md names widgetizer` | six `unreadable: docs/uN.md` lines and `+1 more` |
| D2-PARTIAL | message contains `FALLBACK` | the finding and `hidden/` are named; the listing label is absent |
| D3-TEMPLATE-PASS | `report` is true | `report` is undefined |
| D3-TEMPLATE-ISSUE | `report` is true | `report` is undefined |
| D3-BOUNDARY | message contains `file(s)` | the unreadable note for `cli.ts`, with no file count |
| D3-RETIREMENTS | `report` is true | `report` is undefined |

## 4. Green

**Run** `36297117421`, `loop/t048-r1b` `d5b78cb`, tcm. Success. **Test Files 88 passed (88). Tests 1329 passed | 2 skipped (1331).** `t048-r1b.test.ts` 8 passed. 1329 = the red run's 1321 plus these eight rows.

`tsc --noEmit` was clean before the push. Local vitest of `t048-r1b.test.ts` and `t048-unreadable.test.ts` was 22 passed before the push. The full suite was not run on this machine.

## 5. Mutants

Each mutant is one change off `d5b78cb`, `tsc --noEmit` clean, pushed, and read on tcm. Hosted and windows were left false. The product branch was not moved.

| Protection | What was reverted | Branch / SHA | Run | tcm result |
|---|---|---|---|---|
| D1 | Template returns on unreadable before the hits. Module boundary returns before the graph. Retirements puts unreadables in the six slots ahead of the finding. Scope text and `report` stay. | `loop/t048-r1b-mut-d1` `ac1466c` | `36297377709` | **3 failed, 1326 passed, 2 skipped.** D1-TEMPLATE, D1-BOUNDARY, D1-RETIREMENTS. D2 and D3 rows passed. |
| D2 | A finding that shares the scan with an unreadable path no longer appends the listing label. | `loop/t048-r1b-mut-d2` `9574b59` | `36297433772` | **1 failed, 1328 passed, 2 skipped.** D2-PARTIAL, on `FALLBACK`. The finding and `hidden/` are still in the message. D1 and D3 rows passed. |
| D3 | Template pass and issue, and the retirements finding, omit `report`. The module-boundary issue omits `Checked ${scale}` (so `file(s)` is gone) and keeps `report`. | `loop/t048-r1b-mut-d3` `bb4f552` | `36297488383` | **4 failed, 1325 passed, 2 skipped.** All four D3 rows. D1 and D2 rows passed. D3-BOUNDARY failed on `file(s)`; the other three failed on `report` undefined. |

1326+3, 1328+1, and 1325+4 each equal the green 1329. No other file failed.

## 6. Left as it was

- `checkModuleBoundary` still returns on an unresolved relative import before the combined crossing/unreadable message. A tree with both an unresolved import and an unreadable path names the unresolved count and not the unreadable path. None of the QA 151 rows build that tree.
- A directory the walk cannot list still hides the files inside it. The check names the directory. SILENT 2 asserts that. D1-BOUNDARY denies `cli.ts`, which is a file, and the crossing file is readable.
- QA 151 observations O1–O5, and the open items after D1–D3, were not in this record. QA 153's importer items were not this seat's work.

## 7. Sync

`ob_sync` check_only, before `d5b78cb` and before this handoff. It did not modify files. The issues are the ones already on this tree: retired names in `ENTITIES.md`, a stale local build (the hooks run from the main checkout), mirror-parity on `end.md` / `sync.md`, and greeting-size over 40k. Not repaired here.
