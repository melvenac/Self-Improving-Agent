# QA 255, batch B1 (session-start render): #287, #291, #297, #312

**By:** QA 255 (record session 255), headless Claude Code on Opus, 2026-10-02. Dispatch: `docs/loops/qa-255-b1-start-dispatch.md`.
**Dispatch tree:** `git -C ~/qa-scratch/qa255-wt log -1 --format=%H` = `507004147df01ec665ff5970257ee400534720ef`.
Job class LIGHT: one test file per vitest invocation, every run with `TMPDIR=~/qa-tmp` and a scratch `KNOWLEDGE_V2_DB`.
No live Jev call. `gh` used only for reads. No live `state.json`, knowledge DB or settings file was written.

## Heads (pinned = current; none moved)

| PR | pinned head | `gh pr view` headRefOid | base used for red-first | worktree |
|---|---|---|---|---|
| #287 | `0085e78a81e445d942965efce1c358fb9e83f57e` | same | `79d1f5d9` (merge-base with master) | `qa255-pr287` / `qa255-base287` |
| #291 | `f76392d2963ad549defee2e52fecc5ba8eee20b6` | same | `0085e78a` (#287 head) | `qa255-pr291` / `qa255-base291` |
| #297 | `fc71d9696527f97f28ac6a7c4cd8ee572e0fa1f0` | same | `0085e78a` (#287 head) | `qa255-pr297` / `qa255-base297` |
| #312 | `19714baa42a002d306f118f6b5c4403617bdaf34` | same | `5ec37cdf` (merge-base with master) | `qa255-pr312` / `qa255-base312` |

All four are OPEN and MERGEABLE. GitHub shows `master` as the base of all four. #291 and #297 are stacked on #287 by ancestry.

## #287: T-209 gaps newest-first + T-210 latest brief (round 2)

1. **Confined.** `79d1f5d9..0085e78a` (3 commits): `session-start/latest-brief.ts` (new), `session-start/state-render.ts`, `server.ts` (+6),
   `tests/.../latest-brief.test.ts` (new), `tests/.../state-render.test.ts`, `tests/server.test.ts`, `docs/loops/t209-t210-developer-handoff.md`.
   Nothing outside T-209/T-210. **met**
2. **Red then green.** Head tests on the base source:
   `latest-brief.test.ts` fails to load (`Cannot find module .../latest-brief.js`), 1 failed suite;
   `state-render.test.ts` **4 failed | 35 passed (39)** (T209-1, T209-4, T209-5, T209-6);
   `server.test.ts` **1 failed | 29 passed (30)** (`renders the State section…`, newest-first gaps).
   On the head: latest-brief **10/10**, state-render **39/39**, server **30/30**. `tsc --noEmit` exit 0. **met**
3. **Mutants.** Own: tie-break flipped to ascending (`return na - nb`). Caught by state-render T209-1/4/5/6 (4 failed),
   QA 253's Q253-2b/2c (2 failed) and server.test.ts (1 failed). Developer's "id order kept"
   (`.sort((a, b) => a.id.localeCompare(b.id))`): state-render **3 failed | 36 passed** (T209-1, T209-4, T209-5); the handoff's
   "1 failed | 35" predates the round-2 rows. Both reverted. **met**
4. **CI.** `test` = **success** on run `36984193973` (push, headSha `0085e78a`) and run `36984199234` (pull_request, headSha `0085e78a`).
   `test-windows` skipped. **met**
5. **QA 253 failures.** QA 253's `docs/loops/qa-253/tests/qa253-t209.test.ts` from `origin/qa/t209-t210-report` (`a753fb7f`) copied into the
   head: **4/4 passed** (Q253-2a session order, Q253-2b G-100 before G-99, Q253-2c G-10, G-9, G-2, Q253-2d). `qa253-t210.test.ts`: **9/9**.
   `tests/server.test.ts`: **30/30**. Regex bytes from `cat -A` of `state-render.ts`:
   ```
   114:  const na = Number(/(\d+)\s*$/.exec(a.id)?.[1]);$
   115:  const nb = Number(/(\d+)\s*$/.exec(b.id)?.[1]);$
   ```
   They read `/(\d+)\s*$/`. **met**

**#287 verdict: ACCEPT.**

## #291: T-183 render cut (newest 10 gaps, 100-char title clip, P2/P3 count lines)

1. **Confined.** `0085e78a..f76392d2` (5 commits): `state-render.ts`, `state-render.test.ts`, `tests/server.test.ts`,
   `docs/loops/session-157-builder-2-handoff.md`. The handoff also has the T-221 M-push-only (ci.yml) note, but no ci.yml change is
   in this PR's diff. **met**
2. **Red then green.** Head tests on `0085e78a`: state-render **8 failed | 40 passed (48)** (T183-3 real record, C183-1, C183-2b, C183-3,
   P3-1..P3-4); server **1 failed | 29 passed (30)**. On the head: state-render **48/48**, server **30/30**. `tsc --noEmit` exit 0. **met**
3. **Mutants.** Own: count line at `>= GAPS_SHOWN` (prints "… and 0 older" at exactly 10): caught by **C183-2**, 1 failed | 47 passed.
   Developer's M-clip-99 (`slice(0, TITLE_CLIP - 1)`): **2 failed | 46 passed** (C183-3 and the T183-3 real-record row), as the handoff says;
   my Q255-6b also fails. Both reverted. **met**
4. **CI.** `test` = **success** on run `36984200811` (push, headSha `f76392d2`) and `36984205043` (pull_request, headSha `f76392d2`). **met**
6. **B1 rows.** My own fixture file (`qa255-t183.test.ts`, scratch only), **3/3 passed** on the head:
   - Q255-6a: 40 open gaps over 40 distinct shuffled sessions, inserted in id order, plus 3 *closed* gaps in the newest session. The output has exactly
     **10** gap lines, the 10 newest by session, `Gaps (40):`, and `… and 30 older open gaps (40 open in all): state.json gaps[]`. The closed
     gaps are neither counted nor printed, so the count comes from open `gaps[]`, not from the printed lines.
   - Q255-6b: a 250-char title with no space at the cut renders `    [blocked] T-12345 <first 100 chars>…`. That is exactly 100 characters plus `…`, and the id is intact.
   - Q255-6c: P1 title listed. `  [P2] 2 active: INBOX.md` (blocked counted, done excluded) and `  [P3] 1 active: INBOX.md`. No P2/P3 titles.
   - `server.test.ts` on this head: **30/30**.
   - **Live greeting** (`handleStart({ project_root })` through vitest, with `HOME`, `TMPDIR` and the DB pointed at `~/qa-tmp`. The record is the
     scratch worktree's own tracked copy, never the live one):
     at #287 head (rev 278) **51,827 chars, 563 lines**. At **#291 head (rev 278), 40,789 chars, 515 lines**: 10 gap lines,
     `[P2] 16 active`, `[P3] 3 active`, `… and 30 older open gaps (40 open in all)`. At the batch merge (master's record, rev 283), **39,908 chars,
     501 lines**. **met**

**#291 verdict: ACCEPT.**

## #297: T-226 `/start` takes the brief from `Latest brief:`

1. **Confined.** `0085e78a..fc71d969` (2 commits): the three `start.md` copies, `tests/pipelines/sync/start-parity.test.ts`,
   `docs/loops/t226-developer-handoff.md`. **met**
2. **Red then green.** Head `start-parity.test.ts` on `0085e78a`: **7 failed | 4 passed (11)**, the same as the handoff's red. On the head: **11/11**.
   `tsc --noEmit` exit 0. **met**
3. **Mutants.** Own: deleted "If that line is absent there is no brief to read." from the Cursor copy only. Caught by
   `checkCursorStartParity > is green on this tree` and the T-226 Claude/Cursor equality row (**2 failed | 9 passed**). `mirror-parity` stayed 13/13.
   The handoff names no mutant. Its stated red-before (7 failed | 4 passed) was re-run as the developer's check, and it reproduces. Reverted. **met**
4. **CI.** `test` = **success** on run `36984206826` (push, headSha `fc71d969`) and `36984213521` (pull_request, headSha `fc71d969`). **met**
7. **Parity.** `start-parity` **11/11**, `command-parity` **9/9**, `mirror-parity` **13/13**. **met**

**#297 verdict: ACCEPT.**

## #312: T-148 legend: read the note before ruling, working or retiring

1. **Confined.** `5ec37cdf..19714baa` (2 commits): the three `start.md` copies, `state-views/index.ts` (the INBOX legend sentence; T-148 names it),
   `tests/pipelines/state-views.test.ts` (+2), `tests/pipelines/sync/start-legend.test.ts` (new), `docs/loops/t148-developer-handoff.md`. **met**
2. **Red then green.** Head tests on `5ec37cdf`: start-legend **4 failed (4)**, state-views **1 failed | 13 passed (14)**. On the head:
   start-legend **4/4**, state-views **14/14**. `tsc --noEmit` exit 0. **met**
3. **Mutants.** Own (a): the INBOX legend in `state-views/index.ts` reverted to the old sentence. Caught by start-legend row 1
   (1 failed | 3 passed) and state-views V4 (1 failed | 13 passed). Own (b): the Cursor copy only reverted. Caught by start-legend's Cursor row
   and `checkCursorStartParity` (1 failed | 3 passed each). The handoff names no mutant. Its red-before (4 failed) was re-run and reproduces.
   Both reverted. **met**
4. **CI.** `test` = **success** on run `36985908808` (push, headSha `19714baa`) and `36985912412` (pull_request, headSha `19714baa`). **met**
7. **Parity.** `start-parity` **4/4**, `command-parity` **9/9**, `mirror-parity` **13/13**. **met**

**#312 verdict: ACCEPT.**

## Row 8: batch merge order

Scratch branch `qa255-scratch-merge` (local only, not pushed) from `origin/master` `50700414`, merged with `--no-ff` in order:
`0085e78a` (#287), then `f76392d2` (#291), then `fc71d969` (#297), then `19714baa` (#312). **No conflicts.** Git auto-merged the three `start.md`
copies at the last step: #297's hunks (step 5, the template line, the omit sentence) and #312's hunk (line 74) do not overlap.
Merged tip `29f81fcc`.

On the merge, one file per invocation:

| test file | result |
|---|---|
| `tests/pipelines/session-start/latest-brief.test.ts` | 10 passed (10) |
| `tests/pipelines/session-start/state-render.test.ts` | 48 passed (48) |
| `tests/server.test.ts` | 30 passed (30) |
| `tests/pipelines/sync/start-parity.test.ts` | 11 passed (11) |
| `tests/pipelines/sync/start-legend.test.ts` | 4 passed (4) |
| `tests/pipelines/state-views.test.ts` | 14 passed (14) |
| `tests/pipelines/sync/command-parity.test.ts` | 9 passed (9) |
| `tests/pipelines/sync/mirror-parity.test.ts` | 13 passed (13) |
| QA 253 `qa253-t209.test.ts` / `qa253-t210.test.ts` | 4/4, 9/9 |
| QA 255 `qa255-t183.test.ts` | 3/3 |
| `tsc --noEmit` | exit 0 |

**Row 8: met. The batch merges cleanly as a set in this order.**

## Observations (non-blocking)

- **#291 greeting size.** At rev 278 the #291 head's greeting is 40,789 chars. That is still over the 40,000 `greeting-size` limit the handoff
  cites, by 789 (the handoff's 42,629 was taken before the P2/P3 commit). On master's current record (rev 283) the merged batch is 39,908, under
  the limit by 92. That margin is thin, and it moves with the record.
- **#291 cosmetic.** `clipTitle` was inserted between `formatTask`'s doc comment and `formatTask`. The comment ("A task's rationale is its `note`…")
  now sits on `clipTitle`.
- **#297 coverage.** The per-copy T-226 rows pin the template line, the omit sentence and the "names for you on" clause. They do not pin
  "If that line is absent there is no brief to read." A deletion from all three copies at once would keep the Claude/Cursor equality, so by
  reading the test it would likely survive. **I did not run it:** editing the `.claude/commands/` copy in the scratch tree needed a permission this
  headless job did not have. Only the Cursor-only variant was run, and it was caught.
- **#297 handoff SHA.** The handoff's "Code SHA to freeze" `496762b8` is not on the PR branch. `git range-diff` shows it is patch-identical
  (`=`) to the head's code commit `ba22373c`, so the branch was rebased after the handoff was written.
- **#312.** The tracked `.agents/TASKS/INBOX.md` keeps the old legend until the next `ob_state` render, as the handoff says. Nothing was hand-edited.
- **Measurement side effects.** `handleStart` wrote `.agents/SESSIONS/Session_158.md` (gitignored) inside the scratch worktrees only.
  `HOME` was redirected to `~/qa-tmp/home` for the measurement, and the test suite's own `setup-env.ts` redirects the DB, session and score paths.

## Verdicts

- #287: **ACCEPT**
- #291: **ACCEPT**
- #297: **ACCEPT**
- #312: **ACCEPT**
- **Batch B1: ACCEPT.** Every PR is accepted, and row 8 merges cleanly in the order #287, #291, #297, #312.

QA-255: REPORT COMPLETE
