# QA 287: Jev calibration 2, round 2, DEVELOPMENT phase rerun (live calls)

**By:** Atlas (planner), 2026-10-06, record session 163. **Brief:** `docs/loops/jev-calibration-2-brief.md`.
**Authority:** D-128 (Aaron, planner window s163): *"hold QA 286 and send Jev calibration 2 back for the tool fixes and
smaller inputs."* No spend cap (Aaron, 2026-10-05).

**Why a rerun:** QA 285 (`origin/qa/jev-cal-2-dev-report` @ `edad72ab`) lost 16 of 33 dev rows to Jev's size limit,
including 4 of 7 REJECTs, and found four tool defects (F1 to F4). The builder has fixed F1 to F4 and F6, and has cut
every input below a 90,000-byte ceiling (PR #470). **Read QA 285's report first**, especially its Findings.

**This job runs the DEVELOPMENT phase only.** QA 286 (held-out) runs later, once, after the planner freezes the policy
from THIS job's evidence. **Running any held-out row here voids the calibration.**

## Inputs (all frozen)

- **Code and inputs:** PR #470 head `fa8a821361fdd1d534aa8f11639f6e90b914b82c` on `loop/jev-cal-2-inputs` (CI
  37436725935 green). Fetch `pull/470/head` and confirm it equals that SHA. If PR #470 has moved, stop and report
  INCOMPLETE.
- **Split:** unchanged: `runlist.json` phase `dev` has 33 rows, and phase `heldout` (34 rows) is NOT run.
- **Policy:** each runlist row names its policy file. Do not edit any policy.

## Steps

1. **Trees.** The dispatch tree is `C:/qa-scratch/qa287-wt` at the DISPATCH_SHA. The run tree is
   `C:/qa-scratch/qa287-run`, made with `git worktree add --detach` at `fa8a8213…`. Quote both full SHAs.
2. **Manifest and split.** In the run tree, run `manifest.mjs`'s check and quote it. Confirm `runlist.phases.heldout`
   equals `split.json`'s `held_out.case_ids`, and that no dev row is a held-out id.
3. **Build.** Run `npm ci` and `npm run build` in `open-brain/` of the run tree.
4. **Sizes.** Run `wire-size-report.mjs` and quote it. **Every dev request body must be ≤ 90,000 bytes.** Report the
   dev min, median and max. Report held-out sizes only as the counts the script prints; open no held-out input.
5. **Dry run first, every row.** For each of the 33 dev rows, run `harness shadow-done --request … --policy … --phase dev
   --mode dry-run`, with `--records` and `--ledger` pointed at a scratch dir under `C:/qa-tmp`. Quote the count, with 0
   refusals. Spot-check 3 rows: the payload equals that input file's `request` field, byte for byte.
6. **F1 on the real CLI.** **No shim this time.** The live calls go through `harness shadow-done … --mode live` as
   built. If the CLI still cannot send, stop and report INCOMPLETE. Do not work around it.
7. **Key.** Load `TYPESAFE_API_KEY` from `HKCU\Environment` into the job process only, and check fingerprint
   `728B667EFF` (D-087). Never print, log or commit the key.
8. **Live, development phase only.** One `--mode live --phase dev` call per dev row.
   - Records go to `docs/loops/jev-calibration-2/records-dev-r2/`, and the ledger to
     `docs/loops/jev-calibration-2/records-dev-r2/attempts.jsonl`. **Never write into `records/`**, which holds QA 285's
     evidence.
   - **Never re-ask** a row that got an answer. Retry only rows whose outcome class is transport, rate-limited or
     overloaded, at most 3 times per row. On `auth`, stop everything and report.
   - Check F4 as you go: report every outcome class seen, and for any non-2xx, show that the record keeps the status
     and a bounded body.
   - A size refusal is recorded as such and not cut. **Expect none.** Report every one as a finding.
   - Report the total calls, the total retries and the summed `usage`. Afterwards,
     `harness count-attempts --records … --ledger … --runlist …` exits 0 **without** a `--max` override (F6). Quote it.
9. **Score the dev phase with `score.mjs` as committed, unedited, and with no re-join** (F2, F3):
   `score.mjs --records docs/loops/jev-calibration-2/records-dev-r2 --out <scratch>`. It must exit 0 and write both
   `scores.json` and `scores.md`. Report, for the dev phase:
   - the brief's four usefulness criteria (balanced accuracy, false-accept rate, driving-question Brier with the 0.25
     baseline beside it, and the accuracy and count of answers at p ≥ 0.9), as (a) the gate as built and (b) Jev
     alone, with (b) labelled counterfactual;
   - per requirement-row answers by verdict: the distribution, and the AUC of the combined per-row score (min over
     rows), plus the mean and pooled AUCs as QA 285 gave them;
   - calibration bands (< 0.7, 0.7 to 0.9, ≥ 0.9), and the all-questions calibration, which must now differ from the
     driving-question one if the question sets differ (F6);
   - the policy cut that maximises balanced accuracy on these 33 rows, labelled **fitted to the development set**;
   - every confident miss (p ≥ 0.9 and wrong), by case_id;
   - **a side-by-side with QA 285** for the 17 cases both runs answered: same verdict count, and per-case min-row
     score then and now. Smaller inputs change what Jev sees, so a difference is information, not an error.
   **Do not propose using any threshold.** The planner reads this and freezes the policy for QA 286.
10. **Key scan.** Run QA 285's `docs/loops/qa-285/key-scan.mjs`, adapted only in its paths to this run's files, over
    your transcript and every file you commit. It must exit 0, with the known positive caught.

## Rules (headless Claude Code)

- You are **QA 287**, prefix `jev-cal-2-r2`. Push ONLY `qa/jev-cal-2-r2-*` branches, and only through
  `node docs/loops/qa-287/push-qa.mjs <branch>`, run from `C:/qa-scratch/qa287-wt`.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- **No policy file and no threshold change. No held-out row. No shim.**
- Commit the dev records, the ledger, `docs/loops/jev-calibration-2-dev-r2.md` (the report) and the key-scan output to
  `qa/jev-cal-2-r2-dev-report`. The report's last line is exactly `QA-287: REPORT COMPLETE`.
