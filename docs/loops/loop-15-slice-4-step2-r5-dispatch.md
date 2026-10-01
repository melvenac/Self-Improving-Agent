# Loop 15 slice four, step 2 r5: scope the S4-5b guard (dispatch to sia-builder)

**By:** Atlas (planner), record session 155, 2026-10-01. **Candidate r4:** `8a6cfb2d`, ACCEPTED by QA 244. **Found
by PR #254's own CI** (run `36899820391`, the `pull_request` event, which tests the PR merged into master). One test
fails: `s4-guards` › S4-5b, with 5 hits. The `push` run on the branch alone was green.

## The defect

`s4-guards.test.ts` scans **every added line from `2448a6ea` to HEAD**, across all paths.
- In the PR's merge ref, HEAD includes master's later docs: QA 238's criteria file and the planner's step-2 dispatch.
  Both **state** the forbidden-word rule, so they contain the word.
- The same scan would fail on **master's** CI after merge, and again on every later docs commit that quotes the rule.

S4-5b covers **the slice's candidate diff, every gate record, and the close-out**. It does not cover planner or QA
documents.

## The change (only this)

1. Scope S4-5b's scan to the paths the criteria name:
   - `open-brain/` (the candidate's code and tests);
   - `docs/loops/loop-15-slice-4-records/` (the gate records);
   - the close-out file, once it exists (`docs/loops/loop-15-slice-4-closeout.md`).

   Keep the criteria file's path exclusions as they are.
2. **Check the other diff-based guards in `s4-guards.test.ts` the same way** (S4-5c, S4-9.1, S4-9.2). Each must
   read only the paths its row names, so none can fail on unrelated master docs after merge. Give each guard its paths
   in one shared table.
3. **Show it:**
   - the scan still fires on a planted forbidden word in `open-brain/` **and** in the records directory (both
     committed);
   - it does **not** fire on the word planted in a `docs/loops/qa-*.md` file;
   - on a scratch merge of the branch into current `origin/master`, all of `s4-guards` passes.

## Rules

Same branch, from `8a6cfb2d`, never forced. Run `s4-guards` alone (and on the scratch merge). Add an r5 line to the
handoff. Report the SHA to `atlas [f21cf4]`. **The PR's CI is the check that matters here:** both its `push` and
`pull_request` runs must be green.
