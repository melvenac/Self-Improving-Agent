# Jev calibration 1, Phase 1 (BUILD): developer handoff, FROZEN

**By:** Forge (builder, sia-builder), 2026-10-02. **Dispatch:** Atlas, record session 157, `DISPATCH_SHA f7ac983d`
(origin/master). **Brief:** `docs/loops/jev-calibration-1-brief.md`. **Rulings applied:** `jev-calibration-1-rulings-1.md` (D-096).
**Branch:** `loop/jev-calibration-1-set`, continued from `e66cfbd4`.

**FROZEN SHA: `3a8d28915dfbdfae60fca5d89e38603baac5e50d`** (one commit; this handoff is the next, docs-only commit).
**MANIFEST.json sha256:** `d0c61d66e00c2b844a9682bc78cf6b84a29e8c924d57b2191843e7b7ac93093b`.
**Zero Jev calls were made. No policy file or threshold was touched. Not merged. No PR, issue or comment opened.**
Only `sample.mjs`, `manifest.mjs`, `score.mjs` are new scripts; no `open-brain/` file changed, so no test file was run
(the dispatch said touched test files only; there are none).

## The headline problem: the headline set is 36, not 50

Rulings-1 item 5 excludes every `D_t` that carries verdict wording from the headline. That leaves **36** headline cases
(18 ACCEPT, 18 REJECT), under the brief's 50. I report the real N and did not relax the rule or edit any text.
The 23 leak-wording cases (10 ACCEPT, 13 REJECT) are scored as their own group. **59 cases are scored in all.**

| | n | ACCEPT | REJECT |
|---|---|---|---|
| reports found | 95 | | |
| pool cases (one per candidate SHA) | 75 | | |
| labelled, not excluded | 67 | 36 | 31 |
| excluded `ambiguous-verdict` | 8 | | |
| headline-eligible (no verdict wording) | 44 | 26 | 18 |
| **headline (balanced draw, seed 20261002)** | **36** | 18 | 18 |
| leak-wording group | 23 | 10 | 13 |

- The pool is ACCEPT-heavy once the leak cases leave (26 v 18), so the balanced draw drops 8 ACCEPTs. Using all 44
  would give N = 44 at 41/59. I kept the brief's near-50/50. **Atlas's call** if N matters more than balance.
- **Verdict-wording detector:** `LEAK_RE` in `sample.mjs`, run on the VALUES of each `D_t` (keys are skipped, so the field
  `acceptance` never counts): `reject`/`rejected`/`rejects`/`accept`/`accepted`/`accepts`, case-insensitive, and not
  `accept-stale` or `acceptance`. It flags **27 of 75** `D_t`, which matches your 27. It is broad: some hits are
  innocent prose ("check it, don't accept it" in the A-round dispatches). I kept it broad because the rule is
  conservative by intent; narrowing it would be a relaxation.
- **Slice-four must-includes: only 4 of 8 are in the headline** (`s3-b-step1`, `s3-a13`, `s3-c-r4`, `t198-r2`). The other
  four (`s3-b2`, `t195-r2`, `t158-r2`, `t196-t197-r2`) carry wording and are in the leak group. All 8 are scored.
  Candidate A's rejected rounds: 6 headline (`a4`-`a7`, `a9`, `a10`), 3 leak group (`a8`, `a11`, `a12`).
  T-194: `r2`, `r5` headline; `r3`, `r4`, `r6`, `r7` leak group.
- **Slice four scored the PR head, not QA's candidate.** Checked with `git diff --name-only <candidate> <scored_sha>` against
  the slice-four records: #195, #209, #218, #220, #227 are the same SHA. #165, #182, #187 differ by exactly one path each,
  a `*-developer-handoff.md` under `docs/loops/`. So the candidate and the PR head are the same code in all eight.
  This freeze scores the QA candidate.

## Dropped, with the reason (rulings-1 item 4)

Listed in `MANIFEST.json` `dropped`. 22 entries: 16 `no-dispatch` (loop-14, loop-15 main, slice-2, loop-16, cal2-a12,
qa-driver-cursor-r6, and candidate A rounds **A, A2, A3**), 2 `duplicate-candidate`, 2 `no-candidate-commit-named` (the
two slice-four step-4 reports), and **T-194 `r1` and `r8`: `dropped: no-qa-report`** (no `origin/qa/t194-rN-report` ref
exists and no report file names them). 0 `D_t` failed to build (75 of 75).

## Ambiguous-verdict exclusions (rulings-1 item 2): 8 cases, with the triggering sentence

Each sentence is checked verbatim against the report by `labels.mjs`, which fails the run if it is not there.

| case | sentence |
|---|---|
| importer-fixes | "It is not a clean pass. There are two new defects in the code this candidate adds, and neither blocks an IF row:" |
| importer-fixes-r2 | "Do not merge aba35de as it stands." (reads as a REJECT; held out under the rule, not relabelled) |
| importer-fixes-r3 | "It does not close D5's class. D8 (new to QA, present since round 2, medium..." |
| importer-leftovers-r5 | "There are three low defects." |
| t003 | "PASS on what T-003 set out to fix, with five defects: fix D1 and D3 in this round." |
| t048-r1 | "PASS, with three defects and a test gap." |
| t183 | "so the verdict is ACCEPT WITH ONE DEFECT TO FIX OR RULE (D1, low-medium)" |
| t185 | "ACCEPT T-185 at 9473b0d, with two defects to fix in a short test-and-code round (D1, D2) and two test gaps (D3, D4)." |

**Labels read from a ruling, not the report** (quote in `labels.json` `source`): `s3-b-step1` ACCEPT (rulings-qa129),
`importer-leftovers` ACCEPT (rulings-qa138), `importer-fixes-r4` ACCEPT (rulings-qa122), and **`bootstrap-fix` REJECT**
(rulings-qa135: "the candidate does NOT merge until round 3"; the report says BF-1 to BF-8 PASS but FAIL on install (ii)).
The last one is my reading; Atlas may overrule. **Bare-PASS reports labelled ACCEPT:** `t003-r2` (one low test gap, no defect
named), `importer-leftovers-r6` ("No defects"), `t048-r1b`, `t221-t222` (QA 250, "Pair: ACCEPT").

## Source kind of each D_t (rulings-1 item 1)

`MANIFEST.json` `cases[].source_kind`: **70 `qa-dispatch`, 5 `dev-dispatch`, 0 `brief`.** The five dev-dispatches are
`loop-15-slice-3-dispatch-2.md` and the four `loop-15-slice-4-step2*-dispatch.md` files (to sia-builder, not QA). Of those, `step2-r2` and `step2-r3` are leak-wording cases. `step2-r4`'s header names its ruling ("Ruled REJECT"), but the derived `D_t` does not carry the header, so the detector does not see it. Kind is by file name.

## Not applied, and why

- **`environmental`, `unrelated-test`, `superseded-unruled`** are defined and applied to no case. Applying them needs a human
  reading of each report; I did not do it. The only exclusions in force are `ambiguous-verdict` (8). No case hit
  `leak-later-ruling` (the leak date is the report's FIRST commit, the conservative choice; this also covers QA 239 `t214`, whose first commit was an INCOMPLETE stub).
- **Rebuild the local CLI before Phase 2** (`build-freshness` is an ISSUE in this checkout; nothing here depended on the build).

## score.mjs (rulings-1 item 3)

Phase 2 runs `node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-1/score.mjs --records <dir> --out <dir>`.
`--selftest` runs on synthetic in-memory records (6 checks, all pass), makes no call and writes no file.
- It reports **(a) the gate as built** and **(b) Jev's judgement alone**, recomputed with `decideDoneGate(answer, policy, { checksPassed: true })`
  from the product and the policy file as it stands, labelled **COUNTERFACTUAL**. Both are given for the headline, the
  leak-wording group, the slice-four group and all scored, with the false-accept rate first.
- **Per-question confidence is my operationalisation; Atlas to confirm.** The `noul` answers carry no confidence field.
  Each question gives p = P(diff acceptable): `diff_matches_plan` and `local_tests_support_claim` -> noul;
  `touches_out_of_scope` and `stuck_repeating_prior_failure` -> 1 - noul; `risk_of_regression` -> 1 - score/2. Stance is
  ACCEPT at p >= 0.5; confidence is max(p, 1-p); bands <0.7, 0.7-0.9, >=0.9; Brier = mean (p - y)^2. A confident miss is
  confidence >= 0.9 and wrong. The primary table uses the two driving questions; all five are in a second table.
- The runlist (`runlist.json`) gives `--pr <case_no> --merge-commit --scored-sha --base-sha --dt --checks none` for each of the
  59 scored cases. `--pr` is the case number so a record maps back to its case. Phase 2's run command is not in this freeze.
- Retried records: `score.mjs` uses the last `answered` record per case and lists cases with none under `unscored`.

## B-1 to B-4 evidence

- **B-1: `inputs.mjs` reads no QA report, verdict or ruling.** Every read call in its code (comments excluded):
  `readJson("dispatches.json")` and `git(["show", e.dispatch_blob])`; its only imports are `lib.mjs` and the plan validator
  `harness/schema.ts`. No line names `labels.json`, `qa-report` or `ruling`, and no dispatch path in `dispatches.json` looks
  like a report or ruling. `MANIFEST.json` `b1` records the same, computed.
  `grep -nE "readJson|readFileSync|git\(|import " docs/loops/jev-calibration-1/inputs.mjs` gives lines 18-21, 106 and 114 only.
  `collect.mjs` does read reports (the brief allows it, to find the candidate); it writes no verdict.
- **B-2: two full runs give an identical manifest.** collect, inputs, labels, sample, manifest run twice in a row:
  `d0c61d66e00c2b844a9682bc78cf6b84a29e8c924d57b2191843e7b7ac93093b` both times. The case set is a function of the origin refs,
  so the manifest records `origin/master` (`f7ac983d`) and the tip of each of 359 refs as a sha256
  (`03a1df50c7c45fa3feb58deabbb93892b3eb80312349cb8cf780fe1e1f9a8a03`). A later ref would change the set; a re-run is only
  comparable against those tips. The manifest holds no timestamp or host path.
- **B-3: no gate record in the freeze.** `git ls-tree -r HEAD docs/loops/jev-calibration-1 | grep -c records/` gives 0, and
  there is no `records/` directory.
- **B-4: the PR touches only the set and the handoff.** `git diff --name-only origin/master...3a8d2891` lists nothing outside
  `docs/loops/jev-calibration-1/`; with this handoff, one more path, `docs/loops/jev-calibration-1-set-handoff.md`.
  The earlier WIP handoff (`jev-calibration-1-developer-handoff.md`) is deleted in the freeze commit.

## For Phase 2

Start from the freeze commit or a master that contains it (`git merge-base --is-ancestor 3a8d2891 HEAD`). Rulings-1 item 3
means the done-gate rejects every case under `--checks none`, so (a) will read as 100% reject; (b) is where Jev's judgement shows.
