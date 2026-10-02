# T-163: verify first. Both halves are already built; one test added

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t163-closeout-append` from `origin/master` `8b7aa952`. **Dispatch:** atlas-sia, session 157 (LIGHT). Not merged; one PR.

## Result

**Neither (1) nor (2) is missing.** Both shipped in `d31769df` (schema v3, T163-1 and T163-2) and were hardened by R179-1..3. T-163 is still `open` in the record (its note predates the fix); closing it is the planner's, through `ob_state`. I built no source. This PR adds one test and the evidence below.

## Step 1: can seat B's `set_handoff` remove or overwrite seat A's handoff or session uuid? No.

- **Code:** `state-writer.ts` `case "set_handoff"` (about 635-665): the entry carries `session_uuid: ctx.uuid`, and `s.handoffs.findIndex((h) => h.session_uuid === ctx.uuid)` either pushes a new entry or replaces the writer's own. It never touches another uuid. With no registered session it refuses ("a handoff nobody can attribute is one the next close-out could not be kept from erasing"). Sessions are keyed the same way (`sessions[]` by uuid, `first_rev`). The key is the writing session, not the seat name, which is what v2 got wrong: `SeatName` is a role, so three developer checkouts shared one slot (Step 0, record 118).
- **Fixture run** (new test `tests/shared/closeout-append.test.ts`, through the real writer with `render: true`): developer A (`sia-builder`, session 200) closes out; developer B (`sia-forge`, session 201) closes out, then closes out again **claiming A's number 200**. Result in `state.json`: handoffs `[A: "A's handoff text", B: "B's second handoff, claiming A's number"]` (B updated only its own entry), sessions include both uuids, A's still numbered 200. Rendered view `.agents/SESSIONS/next-session.md` contains both A's and B's text. `SUMMARY.md` and `INBOX.md` carry no handoff text, so there is nothing to lose there.
- **Red evidence:** the same test against a writer keyed by seat NAME again (`docs/loops/t163/mutants/seat-keyed-slot.diff`, v2's behaviour; `tsc --noEmit` 0): **red**, `expected [ [ ...(2) ] ] to deep equally contain [ ... ]` (A's handoff gone). Green on master.

## Step 2: the /sync check ("no close-out removes a uuid another seat's close-out added") exists

`open-brain/src/pipelines/sync/record-erasure.ts`, registered at `sync/index.ts:119` as `record-erasure`; 17 tests in `tests/pipelines/sync/record-erasure.test.ts`. It is a superset of the proposed shape: instead of one step from HEAD to its first parent, it walks every `state.json` change on HEAD's history (merges compared three-way, G-027), keys records by session uuid (legacy entries by seat and number), and flags a removal that retention does not explain, naming the commit, both revisions, the removed record (kind, uuid, session, seat, checkout) and the record the same step added. Rows already present, mapped to yours:

- a fixture commit that drops another seat's uuid fails: `KNOWN POSITIVE: a hand edit that drops another session's handoff FAILS`, and the rev 61 / rev 62 shape;
- an append passes: `KNOWN NEGATIVE: two sessions handing off through the writer erase nothing`, and a merge that keeps both;
- retention-dropped superseded entries are not flagged, and the same drop is flagged when retention does not explain it (`does NOT flag a retention drop`, `DOES flag the same drop when retention does not explain it`; retention is recomputed from `first_rev` by `isSuperseded`, the rule `ob_state` reports as "Superseded");
- schema < 3 history is counted and fails nothing; a shallow clone and a non-git directory are SKIP, not pass.
- **Counts-instead-of-ids mutant** (`docs/loops/t163/mutants/count-not-ids.diff`: a removal is ignored when the after-state has at least as many records of that kind; `tsc --noEmit` 0): **red on 6 of 17** (the hand-edit positive, the replacing-session shape, the legacy listing, the repository-history positive, the 1124 write, the R179-7 fixture). That mutant is already caught; I added nothing for it.
- **Live repository**, called directly: `pass, 0 erasures since schema v3; walked 1681 commits, 455 .agents/state.json changes (222 at schema v3+); 44 erasure(s) in schema <3 history ... failing nothing`.

## One difference from the dispatch's wording

The dispatch asked for a comparison against the first parent "or a supplied base". The existing check has no supplied-base mode; it reads the whole history. I did not add one: it would be a second code path for the same rule, and nothing in the task's note needs it. If a PR-scoped run is wanted (cheaper than 1681 commits), that is a small follow-up.

## Runs and overlap

`tsc --noEmit` 0. `closeout-append` 1 passed; `record-erasure` 17 passed on master (the mutant run is the only red). My files here: one new test, plus the handoff and two mutant diffs. **No overlap with `sync/checks.ts` or with #295, #298 or #300**, so this branch is from master, not stacked. Not run: the full suite.
