# QA 285: Jev calibration 2, round 2, DEVELOPMENT phase (live calls)

**By:** Atlas (planner), 2026-10-06, record session 162. **Brief:** `docs/loops/jev-calibration-2-brief.md`.
**Authority:** Aaron, planner window 2026-10-05: *"Keep calibrating until jev is useful"* and *"No cap for jev is
needed. The model is cheap, do as many calls as you need for calibration."*

**This job runs the DEVELOPMENT phase only.** The held-out phase is a separate job (QA 286), run once, after the
planner freezes the policy from this job's evidence. **Running any held-out row here voids the calibration.**

## Inputs (all frozen)

- **Code and inputs:** PR #470 head `1e1ca3423bac37bffb7ab04c24bb51ecf3c8624d` on `loop/jev-cal-2-inputs`. Run `git rev-parse` on the fetched PR head
  and use the full SHA. This tree contains the collector (#465), the gate changes (#463), the inputs, the runlist, the
  manifest, the runner (`harness shadow-done --request … --policy … --phase …`) and `score.mjs`.
- **Split:** `docs/loops/jev-calibration-2-split.json`, frozen at commit `3b122586`. `runlist.json` phase `dev` has
  33 rows. Phase `heldout` (34 rows) is NOT run here.
- **Policy:** each runlist row names its policy file (`developer-done-cal2-r2.json`). Do not edit any policy.

## Steps

1. **Trees.** The dispatch tree is `C:/qa-scratch/qa285-wt` at the DISPATCH_SHA. The run tree is
   `C:/qa-scratch/qa285-run`: `git worktree add --detach` at PR #470's head (fetch `pull/470/head`). Quote both SHAs.
2. **Manifest.** In the run tree, run `manifest.mjs`'s check and quote it: every input, the runlist, `score.mjs` and the
   policy match their recorded sha256. Then confirm `runlist.phases.heldout` equals `split.json`'s `held_out.case_ids`,
   and that no dev row is a held-out id.
3. **Build.** `npm ci` and `npm run build` in `open-brain/` of the run tree.
4. **Dry run first, every row.** For each of the 33 dev rows, run the runner in `--mode dry-run` with
   `--phase dev`. Quote the count, with 0 refusals. Spot-check 3 rows: the dry-run payload equals that input file's
   `request` field byte for byte (the runner's own test asserts this; show it on real files).
5. **Key.** Load `TYPESAFE_API_KEY` from `HKCU\Environment` into the job process only. Check fingerprint `728B667EFF`
   (D-087). Never print, log or commit the key.
6. **Live, development phase only.** One `--mode live --phase dev` call per dev row, records into
   `docs/loops/jev-calibration-2/records`, ledger `docs/loops/jev-calibration-2/records/attempts.jsonl`.
   - **Never re-ask** a row that got an answer. Retry only on `transport`, `rate-limited` or `overloaded`, at most 3
     times per row. On `auth`, stop everything and report.
   - **No spend cap** (Aaron). Report the total calls, the total retries and the summed `usage`.
   - A request rejected for its size (HTTP 413 or similar) is recorded as such and not cut. Report which rows.
   - Afterwards, `harness count-attempts` over these records exits 0. Quote it.
7. **Score the dev phase** with `score.mjs` as committed (do not edit it). Report, for the dev phase:
   - the brief's four usefulness criteria (balanced accuracy, false-accept rate, driving-question Brier with the 0.25
     baseline beside it, and the accuracy and count of answers at p ≥ 0.9), as (a) the gate as built and (b) Jev alone,
     with (b) labelled counterfactual;
   - per requirement-row answers: the distribution by verdict, and the AUC of the combined per-row score;
   - the policy cut that maximises balanced accuracy on these 33 rows, labelled **fitted to the development set**;
   - every confident miss (p ≥ 0.9 and wrong), by case_id.
   **Do not propose using any threshold.** The planner reads this and freezes the policy for QA 286.
8. **Key scan.** As QA 248's (`docs/loops/qa-248/key-scan.mjs`), over your transcript (absolute path) and every file
   you commit: exit 0, with the known positive caught.

## Rules (headless Claude Code)

- You are **QA 285**, prefix `jev-cal-2`. Push ONLY `qa/jev-cal-2-*` branches, and only through
  `node docs/loops/qa-285/push-qa.mjs <branch>`, run from `C:/qa-scratch/qa285-wt`.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- **No policy file and no threshold change. No held-out row.**
- Commit the dev records, the ledger, `docs/loops/jev-calibration-2-dev.md` (the report) and the key-scan output to
  `qa/jev-cal-2-dev-report`. The report's last line is exactly `QA-285: REPORT COMPLETE`.
