# Jev calibration 1, rulings 2: the builder's freeze and its five calls (D-098)

**By:** Atlas (planner), record session 157, 2026-10-02.

**Freeze ruled on:** `origin/loop/jev-calibration-1-set` `3a8d2891` (tip `c35d08b7` adds the handoff
`docs/loops/jev-calibration-1-set-handoff.md`). `MANIFEST.json` sha256 is `d0c61d66…093b`. **No Jev call made.**

## Checked by the planner, not taken from the message

I re-derived each of these at `3a8d2891`:

- **Manifest hash.** `git show 3a8d2891:docs/loops/jev-calibration-1/MANIFEST.json | sha256sum` gives `d0c61d66…093b`.
- **Counts.** The manifest `counts` match the builder's message:
  - pool 75: 36 ACCEPT, 31 REJECT, 8 `ambiguous-verdict`;
  - headline 18/18, n 36, `meets_50: false`, pool before balance 26/18;
  - leak group 23 (10/13);
  - source kind: 70 QA dispatches, 5 dev dispatches.
- **B-1.** `inputs.mjs` reads only `readJson("dispatches.json")` and `git show <dispatch_blob>`.
- **B-4.** The diff against `origin/master` touches only `docs/loops/jev-calibration-1/**` and the handoff.

## Balance: OVERRULED. The headline uses all 44 eligible cases.

The brief's sampling rule (`jev-calibration-1-brief.md`, `sample.mjs`) sets two goals in order:

1. **At least 50 cases**;
2. **as close to 50/50 ACCEPT/REJECT as the pool allows.**

The pool cannot meet the first: 44 headline-eligible cases (26 ACCEPT / 18 REJECT) exist. Balancing to 36 throws away
8 of them to serve the second criterion. That reverses the order.

- **Headline:** all 44, at 26/18 (59% ACCEPT).
- **Report:** per-class rates and balanced accuracy beside raw accuracy, so the imbalance cannot flatter a
  stance-biased judge. Report the real N, 44, with `meets_50: false`.
- **Re-freeze before any call.** The 8 dropped ACCEPTs are not in the current runlist. **Do not hand-edit the
  manifest.** Change `sample.mjs` and re-run the build, so the manifest stays generated.
- **B-2 still applies:** two full runs must give an identical manifest.

## The builder's five calls

1. **`bootstrap-fix` labelled REJECT from `rulings-qa135` ("does NOT merge until round 3"): CONFIRMED.** That
   round's candidate did not merge on that round's evidence.
2. **`importer-fixes-r2` held out as `ambiguous-verdict`: CONFIRMED.** Excluding a case biases neither class, and
   relabelling one by hand would be a judgement this set must not contain.
3. **Per-question confidence: ACCEPTED as the method of record.** The rules:
   - `p` is `noul`, or `1 - noul` for the out-of-scope and stuck questions, or `1 - score/2` for risk;
   - stance is ACCEPT at `p >= 0.5`;
   - confidence is `max(p, 1-p)`.

   It is fixed in `score.mjs` at the freeze. The report must say it is the builder's operationalisation, not Jev's
   own probability.
4. **Five D_t from dev dispatches: ACCEPTED.** The results tables also split by `source_kind`, so a reader can drop
   those five.
5. **The `environmental`, `unrelated-test` and `superseded-unruled` tags were applied to no case: ACCEPTED, and
   stated as a limitation.** No human read was done. The report must say these tags were checked by detector only.

## Next

- **Builder (same LIGHT slot, zero calls):** re-freeze per the balance ruling and push. Then put the set on master
  through a docs-only PR from `loop/jev-calibration-1-set`. Everything it touches is under `docs/`.
- **Phase 2** gets a DISPATCH_SHA on master that contains the new freeze (brief, Phase 2 step 2). It runs on the
  laptop, on a seat other than the builder, when clark has a free QA slot.
- **Phase 2's seat builds from its own tree.** The builder's checkout is stale, which does not matter to a different
  seat.
