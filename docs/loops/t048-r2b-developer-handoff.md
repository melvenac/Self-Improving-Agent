# T-048 round 2b: developer handoff (record 176)

**By:** Forge, record 176. **Seat:** `~/Worktrees/sia-forge`. **Model:** Grok 4.7. **Date:** 2026-09-27.

**Brief:** `docs/loops/followups-r165-r167-briefs.md`, common rules and the record 176 section, on
`origin/docs/session-100-qa99-dispatch`. QA 157 part of `docs/loops/t048-t171-rulings-qa157-qa158.md` on that
same branch. Report Defects and Open: `docs/loops/t048-r2-qa-report.md` on `origin/qa/t048-r2-report`.
Surviving mutants: `origin/qa/t048-r2-mut-hook-old-lines` `d0972fa`, `origin/qa/t048-r2-mut-s6-corrupt-earns-recency`
`33428ed`, `origin/qa/t048-r2-mut-s14-skip-over-match` `f931c2d`.

**Branch:** `loop/t048-r2b` from `5b9a403`. **Product: `822f398`.** This handoff is the commit on top.
`server.ts` was not edited. Records 165, 166, and 167 were not this round.

## 1. What changed

**D1, the `cli.ts` half.** `formatScoreCategoryLine` in `open-brain/src/pipelines/sync/score-line.ts` is what
`sync --score` prints. When Pipeline Health's `invocationLog` is not `ran`, the line is
`Pipeline Health: N/10 (invocation log: <state>)`. `ran` stays the bare score. The two `server.ts` renderers
are unchanged and still omit the state. That is T-048 round 3.

**D2.** `findSessionDb` treats `no such table: session_meta` as a readable file that holds no session. The skip
is `holds no session` when no file had a `session_meta` row. A throw that is not that missing table stays
`unreadable while finding session db`. A file whose `session_meta` names a different session still says
`no db holds this session`.

**D4.** `unusableLog` returns `string`. The timestamp JSDoc sits on `readLastInvocationTs` and says null is the
missing file. The comment that named a mutant is gone.

**D5.** An empty invocation log returns `empty`, and `scorePipelineHealth` records `invocationLog: "empty"`
with the same score as a missing log. `no events` is only the zero-row `session_events` table. A table whose
rows are not summary types says `no summary events`. A missing sessions directory says `no session db` even
when a session id was passed.

**D3** is tests only, in `open-brain/tests/t048-r2b.test.ts`. The three rows pass on `822f398`.

## 2. Callers

`formatScoreCategoryLine` is called from `cli.ts` only. `getSessionSummary` is called from `sessionEndV2`.
`readLastInvocationTs` is called from `pipelines/sync/score.ts` and from `server.ts` (the value, not a new
print). `scorePipelineHealth` is called from `score.ts`, `cli.ts`, and `server.ts`. The empty state is a new
string; a timestamp, `corrupt`, `unreadable`, and null score as they did.

GitNexus impact was not run. The sync before this handoff measured the index 123 commits behind `822f398` (indexed `6bd97f2`), and this worktree has no GitNexus checkout. The caller list above is from the imports.

## 3. Red, read per test

**Run** `36301987254`, `loop/t048-r2b` `9135d34` (tests only), tcm, hosted and windows left false. Failure.
**Test Files 1 failed | 87 passed (88). Tests 4 failed | 1315 passed | 2 skipped (1321).** Every failure is in
`t048-r2b.test.ts`. The three D3 rows passed on this commit.

| Row | What failed |
|---|---|
| D1 | `formatScoreCategoryLine` is not a function |
| D2 | the skip contains `unreadable while finding session db`, not `holds no session`. Both the zero-byte db and the foreign db threw `no such table: session_meta` |
| D4 | `unusableLog` is still `string \| null` |
| D5 | a zero-byte log reads `corrupt` |

## 4. Green

**Run** `36302113612`, `822f398`, tcm. Success. **Test Files 88 passed (88). Tests 1319 passed | 2 skipped (1321).**
`t048-r2b.test.ts` 7 passed. 1319 = the red run's 1315 plus the four rows that were red.

`tsc --noEmit` was clean before the push. Local vitest of `t048-r2b.test.ts`, `t048-r2.test.ts`, and
`pipeline-health.test.ts` was 24 passed. The full suite was not run on this machine.

## 5. Mutants

Each is one change off `822f398`, `tsc --noEmit` clean, tcm, hosted and windows left false. The product branch
was not moved. Each run is 1 failed | 1318 passed | 2 skipped (1321). 1318 + 1 = the green 1319.

| Protection | What was reverted | Branch / SHA | Run | The row that died |
|---|---|---|---|---|
| D1 | the score line drops `(invocation log: …)` | `loop/t048-r2b-mut-d1` `f33679f` | `36302168161` | D1. Received `Pipeline Health: 0/10` |
| D3 hook-old-lines | the hook prints the three pre-T-048 lines | `loop/t048-r2b-mut-hook-old-lines` `b40c7ed` | `36302204762` | D3 hook-old-lines. Stdout has `Summary: skipped` and not `Summary: skipped —` |
| D3 s6 | corrupt and unreadable earn hook recency 4 | `loop/t048-r2b-mut-s6` `52d5398` | `36302237000` | D3 s6. `expected 4 to be 0` |
| D3 s14 | an unreadable db is returned before the db that matched | `loop/t048-r2b-mut-s14` `8288780` | `36302281266` | D3 s14. Received `Summary: skipped — unreadable while finding session db` |

These four, plus the red and the green, are the six tcm runs. D2, D4, and D5 were not given a seventh run.
They are red on `9135d34` and green on `822f398`.

## 6. Left as it was

- Both `server.ts` score renderers. Round 3, with SILENT 4 and 9, after T-179 round 2 merges.
- R-1 (`session_meta LIMIT 1`), R-2 (second summary the same day), R-3 (`logInvocations` leaves a handle open).
  QA 157's Open items 3–6. Not this record.

## 7. Sync

`ob_sync` check_only, before the test commit, before the product commit, and before this handoff. It did not modify files. The issues
are the ones already on this tree: retired names in `ENTITIES.md`, a stale local build, mirror-parity on
`end.md` / `sync.md`, and greeting-size over 40k. Not repaired here.
