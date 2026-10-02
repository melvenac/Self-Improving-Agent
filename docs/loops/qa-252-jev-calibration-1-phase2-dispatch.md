# QA 252: Jev calibration 1, Phase 2 (RUN and SCORE)

**By:** Atlas (planner), 2026-10-02, record session 157. **Brief:** `docs/loops/jev-calibration-1-brief.md`, the
"Phase 2" and "Rules" sections, followed exactly.

**Rulings:**

- `jev-calibration-1-rulings-1.md` (D-096).
- `jev-calibration-1-rulings-2.md` (D-098). Its balance ruling is already applied in the freeze.

**The set:**

- **Freeze:** `a26e44d0559b9ad855578d3297c3e61debaee71e`, built by sia-builder and merged to master by #285
  (`758c9be6`).
- **`MANIFEST.json` sha256:** `8169ac9b5576b40b9f54d397825453dd486e128eaac860cf529586cbb1bcdd67`. Check it
  before any call, and stop if it differs.
- **Runlist:** `docs/loops/jev-calibration-1/runlist.json`, 67 rows.
  - The headline is N = 44 (26 ACCEPT / 18 REJECT). `meets_50` is false, so report the real N.
  - The leak-wording group, 23 cases, is scored separately.
- **Builder's handoff:** `docs/loops/jev-calibration-1-set-handoff.md`. It is the method of record for the
  per-question confidence, which is the builder's own operationalisation. Say so in the report.

**This seat is NOT the builder.** It runs on the laptop. **Job class: LIGHT.** That means the build in your own tree,
the calls, `score.mjs`, and the key scan. No suite.

## Steps

1. **Base.** The DISPATCH_SHA is a master commit that contains the freeze. Run
   `git merge-base --is-ancestor a26e44d0 HEAD` and quote its exit status. Then check the manifest sha.
2. **Build in your own tree.** `npm ci` and `npm run build` in `open-brain/`. Quote the HEAD the build was made from.
3. **Key.** Load `TYPESAFE_API_KEY` from `HKCU\Environment` into the job process. Check fingerprint `728B667EFF`.
   Never print the key.
4. **Calls.** Make one live `harness shadow-done` per runlist row, as the brief's step 3 says, into
   `docs/loops/jev-calibration-1/records`.
   - **Never re-ask.** Retry only on `transport`, `rate-limited` or `overloaded`, at most 3 retries in total.
   - On `auth`, stop everything.
   - **The spend cap is $0.50**, measured on the summed `usage`.
   - Afterwards, `harness count-attempts` over this set's records exits 0. Quote it.
5. **Score.** Run `node docs/loops/jev-calibration-1/score.mjs` as committed in the freeze. **Do not edit it.**
   Write `docs/loops/jev-calibration-1.md` per the brief's step 5:
   - **Headline:** the G_done figures as both (a) the gate as built and (b) Jev alone, with (b) labelled a
     counterfactual. Also the false-accept rate, per-class rates and balanced accuracy, and the line
     **"G_qa: uncalibratable as built, because the request carries the label"**.
   - The results tables are generated, not typed.
   - Calibration bands and the Brier score.
   - Every confident miss.
   - The source_kind split.
   - The leak group compared with the headline.
   - A recommendation. Any threshold you propose is labelled **fitted to this set; needs a held-out set**.
   - The limitations from rulings-2: the detector-only tags, and the builder's confidence operationalisation.
6. **Key scan.** Do it as QA 248's was (`docs/loops/qa-248/key-scan.mjs`), over your transcript and every file you
   commit. Name the transcript by its absolute path.

## Rules (headless Claude Code)

- You are **QA 252**, and your prefix is `jev-cal-1`. Push ONLY `qa/jev-cal-1-*` branches, and only through
  `node docs/loops/qa-252/push-qa.mjs <branch>`, run from `C:/qa-scratch/qa252-wt`.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- **No policy file and no threshold change.**
- Commit the records, `docs/loops/jev-calibration-1.md` and the key-scan output to `qa/jev-cal-1-report`. The
  report's last line is exactly `QA-252: REPORT COMPLETE`.
