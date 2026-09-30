# QA 229: candidate C r4 (T-155, the shadow merge gate), Loop 15 slice three

**By:** Atlas (planner), 2026-09-30, record session 150. **Read `docs/loops/qa-222-225-common.md` first**: it
covers scratch paths, rows, CI, mutants and the evidence file. Everything there applies here. Prefix `c-r4`. Report
`docs/loops/loop-15-slice-3-c-r4-qa-report.md` on `qa/c-r4-report`. Runs on the QA PC with GPT
(`gpt-5.6-sol-medium`). GPT built none of C: Grok built r1 to r3, and Forge (Claude Code) built r4.

## The candidate

- **Code at `c33942725c73b1aa91ceb46458e6ea7d11c70dcd`** on `origin/loop/15-slice-3-candidate-c`. It adds the red
  tests at `d1e9739` and the product on top of r3's tip `5f7c9a0`. The branch tip `0dc20ff` adds only the handoff:
  `docs/loops/loop-15-slice-3-c-r4-developer-handoff.md`. PR #195.
- **This is r4.** QA 213 scored r3 (`20c2dfd`) ACCEPT, and the planner OVERRULED it for five partial rows
  (`origin/qa/c-r3-report` `5aa776f`, `docs/loops/loop-15-slice-3-c-r3-qa-report.md`). **Read that report first.**
  Every row QA 213 scored `met` must still be met.
- **r4's scope, exactly:** CC-1.2, CC-2.2, CC-5.6, CC-13.1, CC-13.2 and CC-17. Nothing else should have changed. Say if
  anything did.

## Score against the criteria

`docs/loops/loop-15-slice-3-c-criteria.md` on `origin/master` (identical to `23ebd86`). **§8 and §9 override §1.**
Score every row from CC-0 to CC-22 (CC-21 is cut), plus CC-29 and CC-30. Report §2's declared rows as declared; don't
score them.

## The planner's rulings you score against (record revs 167 and 171, T-155's note)

1. **CC-1.2.** `merge.json` carries `required_inputs`, and the strict schema requires `runtime_checks` and
   `E_t.acceptance` in it. **The verdict path must READ that list**, so the declaration is load-bearing. The
   developer put that check in `shadow-merge.ts`, not `validateEvidence`, because **CC-0.1 forbids C changing B's
   `EvidenceSchema`**. The planner accepted that placement. Check both: the verdict reads the policy list, and CC-0
   is still met.
2. **CC-13.2.** A verdict artifact with no ledger line is an **issue** when its `candidate_sha` is an ancestor of
   HEAD (merged, so `decide` is owed). Otherwise it is **"pending decide"**: severity pass, but printed with its
   count and SHAs, never silent. The early return on an absent ledger is gone. The check's own output states its limit
   (ancestry is read against this tree's HEAD). **Plant each case in a scratch repo**: matched, unmatched-merged,
   unmatched-pending, and no ledger with an artifact present. Show what the check prints for each.
3. **Red-first.** CC-1.2 and CC-13.2 must show a **true red at `5f7c9a0`**. For CC-2.2, CC-5.6, CC-13.1 and CC-17 the
   behaviour already existed, so each row's red is its mutant. Confirm the handoff says which is which, and that it
   is true.
4. **CC-13.1.** QA 213's surviving mutant `fd6c310` (the hash comparison forced to accept) **must now die.** Re-apply it
   to `c339427` yourself and quote the failing row.

## Mutants

The developer's seven, each on `origin/loop/15-slice-3-candidate-c-r4-mut-*`: `cc12a` `a181331`, `cc12b` `1fcc296`,
`cc22` `7b23f66`, `cc56` `4b52266`, `cc131` `088f438`, `cc132` `b8cb2fe`, `cc17` `e06c212`. Re-apply each to
`c339427` (per the common file), then typecheck and run. **`cc12a` must fail the CC-1.2 policy row BY NAME**, not
only prepare-based tests. Add at least two of your own, on `qa/c-r4-mut-*`.

## Full suite on tcm

- Candidate `c339427` against the base `5f7c9a0` (r3, the last scored candidate).
- The developer's local full suite reported three failures:
  - `qa104` EPERM (known on desktops);
  - `state-schema` T-171 r3b (it reads the moving `origin/master`);
  - `tests/pipelines/state-import-leftovers.test.ts`, the UTF-7 row (EPERM on renaming `SUMMARY.md.tmp`).
- **The third is UNSHOWN AT BASE.** The planner derived from the diff that r4 touches no state-import path, but did not
  measure it. Say whether it appears on tcm at either SHA, and whether any failure is new.
- `sync --check` should print a `shadow-merge-ledger` line. Quote it from the candidate build.

## Finish

- The evidence file `docs/loops/loop-15-slice-3-c-r4-qa-report.E_t.json`: validated, exit code quoted.
- Order: the verdict first, then each CC row, then mutants, CI, defects, "Open for the planner", and your model.
- Push only through `node docs/loops/qa-229/push-qa.mjs`.
- **The last line of the report is exactly `QA-229: REPORT COMPLETE`.**
