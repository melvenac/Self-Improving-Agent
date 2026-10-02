# Jev calibration 1, Phase 1 (BUILD): developer handoff, WORK IN PROGRESS (parked at the roll)

**By:** Forge (builder), 2026-10-02. **Dispatch:** `DISPATCH_SHA 6b82ae1c73e5782a04b3844be8e2ada699720c07`, brief
`docs/loops/jev-calibration-1-brief.md`. **Branch:** `loop/jev-calibration-1-set` from `origin/master`.
**State: NOT FROZEN.** The set is incomplete. No Jev call and no dry-run was made. No policy or threshold was touched. No PR is open.

## What exists (all under `docs/loops/jev-calibration-1/`)

| File | State |
|---|---|
| `lib.mjs` | Done. Git wrapper, stable JSON writer, seeded PRNG (`SEED = 20261002`). |
| `collect.mjs` | Working. 74 cases from 94 report files; 20 reports are unusable and logged with the reason in `collect.json`. |
| `inputs.mjs` | Working. 74 `D_t` built mechanically, 0 dropped. Reads only `dispatches.json` and the dispatch blobs. Run with `node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-1/inputs.mjs`. |
| `labels.mjs` | Partly done. Parses each report's Verdict, classifies ACCEPT or REJECT, and sets the leak exclusion. `RULING_OVERRIDES` and `EXCLUSIONS` are still empty. 29 ACCEPT, 30 REJECT, 15 excluded as it stands. |
| `sample.mjs`, `manifest.mjs`, `score.mjs`, `MANIFEST.json` | **Not written.** |
| generated: `collect.json`, `dispatches.json`, `inputs.json`, `inputs/*.D_t.json`, `labels.json` | Regenerate with the scripts. They are WIP outputs, not frozen. |

## How each part works (decisions I made; Atlas should confirm or overrule)

- **Case unit:** one row per candidate SHA. The candidate is the commit the report names near its top (`Candidate`/`Product`/ACCEPT `<sha>`), resolved to a full SHA. Reports that name none (the two slice-four step-4 reports), and reports with no dispatch (loop-14/15/16, slice-2, A, A2, A3, and a few others), are logged as unusable. They are never patched.
- **The report is read at its LAST commit on any origin ref**, not its first. QA 239's first commit was an `INCOMPLETE` stub, and the final report is an ACCEPT. The leak check uses the FIRST commit's date, which is the conservative choice.
- **Dispatch = the QA dispatch for the round** (`<stem>-dispatch-qa.md` or `qa-NNN-<stem>-dispatch.md`), matched by name tokens, then the QA number, then the file the report cites. The repo has no per-round developer dispatch for most cases, so the QA dispatch is the planner's text for that round.
- **`D_t` derivation** is documented at the top of `inputs.mjs`. It is crude: it takes the H1 as the objective and list items and table rows as tasks, and no dispatch has id-rows, so acceptance falls back to `T1..Tn` for all 74. Some "tasks" are fragments such as `T-217:`. That is what a no-hand-edit rule gives.
- **`merge_commit` and `base_sha`** are chosen for `harness shadow-done`, which diffs `base..candidate` two-dot. The base is whichever of {previous round's candidate, master at the candidate's date} gives the shorter path list. Slice four's PRs were squash-merged, so most candidates are not ancestors of master; `merge_commit` is then the candidate itself and `collect.json` says `merged: false`.

## What is left before the freeze

1. **`labels.mjs` rulings.** I read the rulings headlines. Overrides to add, each with its ruling as the source:
   - `s3-b-step1` ACCEPT: `loop-15-slice-3-b-step1-rulings-qa129.md`, "ACCEPTED: the G-042 repair (`e815e3d`)". The report itself reads "B as a whole is not accepted". This is slice-four #165.
   - `importer-leftovers` ACCEPT: `importer-leftovers-rulings-qa138.md`, "Verdict accepted: PASS. `d500730` merges".
   - `importer-fixes-r4` ACCEPT: `importer-fixes-r4-rulings-qa122.md`.
   - The `PASS` family (importer-fixes r1-r3, importer-leftovers-r5/r6, t003, t003-r2, t048-r1, t048-r1b, bootstrap-fix) has no ACCEPT or REJECT word. Rule decided so far: a leading `PASS` with no defect named, or "No defects", is ACCEPT. Anything with defects, and `t183` and `t185` ("accept with defects"), is excluded as `ambiguous-verdict`. **That tag is mine, not the brief's**: Atlas should approve it or rule otherwise.
   - Exclusion tags `environmental`, `unrelated-test`, `superseded-unruled` are not yet applied to any case. `t214` (QA 239) needs a check: it reads ACCEPT at its last commit, and its first commit said INCOMPLETE.
2. **`sample.mjs`:** at least 50 scored cases, close to 50/50, fixed seed. With the pool above the balance limit is the ACCEPT count (about 27 to 29 after exclusions), so about 54 to 58 cases. Must-includes, by `case_id`: slice four #165 `s3-b-step1`, #182 `s3-a13`, #187 `s3-b2`, #195 `s3-c-r4`, #209 `t195-r2`, #218 `t158-r2`, #220 `t196-t197-r2`, #227 `t198-r2`. Slice four scored the PR head, which is the QA candidate plus docs-only commits: verify that with a `git diff --name-only` and record it. Candidate A's rejected rounds: `s3-a4` to `s3-a12`. T-194: `t194-r2` to `r7` exist; **r1 and r8 have no QA report**, so they cannot be cases, and the manifest must say so.
3. **`manifest.mjs` / `MANIFEST.json`:** seed, pool size, scored-set size, per-label counts, drop and exclusion counts by reason, sha256 of every input file and script, the `origin/master` and qa-ref tips used, and a per-case `verdict_words_in_dt` count (27 of 74 D_t contain reject/accept wording, mostly "after QA nnn's REJECT" in round two and later; the brief's leak rule is date-based and does not catch it, so report it).
4. **`score.mjs`:** must be in the freeze. **Important finding for Phase 2:** with `--checks none` the done-gate rejects EVERY case (`hand_to_qa_requires_green_checks`), whatever Jev says, which is exactly slice four's 8 of 8. Verdict accuracy is therefore meaningless unless the score recomputes the decision from the recorded per-question scores with `checksPassed: true`, or the runner supplies exit codes per case. I propose score.mjs reports both and uses the scores-only decision for the headline. That changes no policy.
5. **B-1 to B-4 evidence:** the grep for B-1 (`inputs.mjs` has no read of a QA report or ruling), the double-run manifest comparison for B-2, the empty `records/` check for B-3, and the changed-paths check for B-4.
6. **Freeze:** one commit, then the PR to master, not merged. The `.scratch-show.mjs` helper is deleted and is not part of the set.

## Resuming

`git fetch origin`, check out `loop/jev-calibration-1-set`, then run `collect.mjs`, `inputs.mjs` (under tsx), and `labels.mjs` in that order (about 25 s). `collect.mjs` reads live `origin` refs, so rerun it only when nothing new has been pushed to `origin/qa/*`, or the manifest will differ between runs.
