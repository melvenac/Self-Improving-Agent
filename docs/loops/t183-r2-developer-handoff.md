# T-183 round 2: developer handoff (record 119)

**By:** Forge (developer), record session 119 · 2026-09-25. **Model:** Claude Opus 5.5 (1M context). **Effort:** medium.
**Brief:** "Round 2: brief" in `docs/loops/t183-rulings-qa114.md` (`origin/docs/session-100-qa99-dispatch`), plus Atlas's
ruling (a) sent over A2A in this session.
**Frozen SHA (tests):** `dd68ece`. This handoff's own commit sits on top of it and adds only this file.

## Provenance

The tests in `dd68ece` and the six mutant branches were written, committed and pushed by an earlier session in this seat.
That session was cleared before it wrote a handoff, and its reasoning is not recorded. Record 119 started after the
clear, found the work on the branch, stopped and reported it, and Atlas ruled (a): treat `dd68ece` as the candidate and
review it cold. D-035 is met because this session, the fresh one, does the review. **Authorship: an earlier, cleared
session in this seat, reasoning not recorded.** Everything below is this session's own reading. Nothing in it is
recalled from that session.

## Files

`git diff --name-only ee723f9 dd68ece` lists only test files:
- `open-brain/tests/pipelines/session-start/state-render.test.ts` (+80)
- `open-brain/tests/pipelines/sync/greeting-size.test.ts` (+51, −2 in the import lines)

**About the brief's `git diff --name-only 0f0e7ad HEAD` criterion:** it also lists
`docs/loops/t183-developer-handoff.md`, which the base `ee723f9` already carries from round 1, and this file. Neither is
source. No file under `open-brain/src/` differs from `0f0e7ad`.

## What each ruling got (review against the brief)

- **R183-1, the loop state:** two tests carry it.
  - Fixture test: one long, multi-sentence ruling and one question, both longer than `GAP_CLIP` (a guard test pins
    that). Each must appear as a whole line, `      - <item>`.
  - Real-record test: for each seat, every `loop_state.rulings` and `questions_for_aaron` item must appear as a whole line.
  - Both use `toContain` on the line array, which requires exact element equality, so they are byte-identical checks.
    A count check would have been weaker.
- **R183-1, the other seats' lines:** again, two tests.
  - Fixture test: one line at 150 characters must print whole, and one at 200 must print as 157 characters plus `...`.
  - Real-record test: for each reader, every other seat's first line must match a reference, `otherSeatLine`. That
    reference is written in the test and does not call the renderer. A guard asserts the record has more than one
    handoff.
- **R183-2, `runSync` wiring:** a test runs `runSync` in check-only mode on a copy of `tests/fixtures`. It asserts that
  `greeting-size` is among the check names, and that there is more than one name.
- **R183-2, seat sensitivity:** a test composes the same state twice, once as the unresolved reader and once as the
  planner seat (via `AGENT.local.md`).
  - It asserts the planner composition contains `Your handoff — planner, session 1:` and the watch-out line, and that
    the two texts differ.
  - That is stronger than the ruling's "must differ". Under q16 the `Seat:` line alone would still make the texts
    differ, so the content assertions are what kill it.
- **R183-3, the boundary:** one line, so it was done. Let `n` be the composed length.
  - `limit = n` must pass.
  - `limit = n − 1` (that is, `n == limit + 1`) must be an ISSUE.

## Mutants: per test, on tcm

Each mutant branch's parent is `dd68ece`. Each differs from it in one source file, by one line. That line is
character-for-character QA's edit in `docs/loops/qa-scripts-t183/mutants-t183.mjs` (`origin/qa/t183-report`). Against
`0f0e7ad`, each branch's only difference under `src/` is that same file.

I read every run's log. All seven say `Machine name: 'tcm'` (runner `tcm-1`). In each, the egress step printed 9
`blocked:` lines and `denied: /opt/doorctl`, and `npx tsc --noEmit` reported no errors.

| Mutant | Edit | Run | Result | Killing test(s), all new, all failing at an assertion |
|---|---|---|---|---|
| (none) | candidate `dd68ece` | 36212373913 | 1065 passed, 1 skipped (1066) | none fail |
| q10 | loop-state rulings clipped | 36212375501 | 2 failed / 1063 / 1 skipped | Fixture test, "prints every loop-state ruling and question for Aaron whole" (`state-render.test.ts:257`). Real-record test, "renders the planner seat's loop-state rulings…" (`:297`, on `Session 109: rulings-18…`). |
| q11 | `n > limit` → `n >= limit` | 36212377060 | 1 / 1064 / 1 | "pins the boundary…" (`greeting-size.test.ts:86`): expected `'issue'` to be `'pass'` |
| q15 | `greeting-size` not pushed in `runSync` | 36212378392 | 1 / 1064 / 1 | "is among the checks runSync runs" (`:136`): 30 names, `greeting-size` not among them |
| q16 | composition ignores the seat | 36212379754 | 1 / 1064 / 1 | "composes for the checkout's seat…" (`:109`): `Your handoff — planner, session 1:` missing |
| q18 | other seats' lines cut at 60 | 36212381223 | 4 / 1061 / 1 | Fixture test, "prints another seat's first line whole up to 160…" (`state-render.test.ts:263`). Real-record test, "renders the other seats' lines for the {developer, planner, qa} reader unchanged" (`:303`, ×3). |
| q19 | questions for Aaron clipped | 36212382673 | 1 / 1064 / 1 | The fixture test only, "prints every loop-state ruling and question for Aaron whole" (`:258`, on `QUESTION first sentence…`) |

**Totals:**
- QA reported 1052 passed and 1 skipped at `0f0e7ad`. The candidate's 1065 is 13 more, which matches the 13 new tests.
- The skipped test is the existing one in `tests/shared/paths.test.ts`. Nothing new is skipped.
- Every failure in the mutant runs is a new test. No mutant failed on CA-9 or on anything unrelated.

## What I would change, and what was not verified

- **q19 has one killer, the fixture test.** Today's real record only has short, single-sentence questions for Aaron,
  and a clip leaves those unchanged. The test's own comment says so. That is correct, but q19 depends on that one test.
- **The real-record loop-state test has no non-empty guard.** It would pass without checking anything if the record's
  `loop_state` lists were emptied. I did not add a guard, because the record is meant to change and the fixture test
  holds the rule independently. If the planner wants one, it is a single line.
- **Not verified by this session:**
  - Whether the earlier session ran `npx tsc --noEmit` locally before each push, as the brief requires. CI ran it
    clean on all seven runs.
  - The local test runs: none were made. The brief says no full local suite.
- I found nothing that needed a new commit or new runs. `dd68ece` is unamended.
