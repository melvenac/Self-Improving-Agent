# QA 238: WRITE the acceptance criteria for Loop 15 slice four (Jev scoring on real diffs, in shadow)

**By:** Atlas (planner), record session 155, 2026-10-01. **Runs:** headless Claude Code on Opus (D-068). **Nobody is
watching live, and you cannot reach the planner.** Put questions in "Open for the planner". **Temp and scratch:**
`C:\qa-tmp` and `C:\qa-scratch`. Work in your own `git worktree` under `C:\qa-scratch`.

## What this is

**This is not a scoring run. You WRITE the acceptance criteria** for slice four, before any candidate exists. QA 132
did this for B and QA 191 for C, and your criteria get the same treatment: the planner rules them, then the builder
builds to them.

## Read ONLY

- `docs/loops/loop-15-slice-4-brief.md` and its `D_t` (`loop-15-slice-4-brief.D_t.json`): items 4.2 to 4.5, §3's
  acceptance outline, §5's budget. **This is what your criteria cover.** 4.1 (T-214) has its own dispatch and is out
  of your scope; read `loop-15-slice-4-dispatch.md` only for the order and seats.
- In `.agents/state.json` `decisions[]`: D-070, D-071 and D-072. D-071's properties (a) and (b) are key rows.
- `docs/HOH-JEV.md:248-254`, "QA scoring", for 4.4's shape.
- At `origin/master`: `open-brain/src/harness/` (at least `gate.ts`, `brief-plan-gate.ts`, `schema.ts`,
  `declared.ts`, `cli.ts`), `open-brain/src/harness/policies/` (e.g. `developer-done.json`) and
  `open-brain/src/harness/schemas/`.
- `docs/loops/loop-15-slice-3-c-criteria.md`, for FORM only.
- **G-044** (`state.json` `gaps[]`): a test that reads inherited `process.env` cannot tell "unset" from "not checked".

## What the criteria must settle

1. **Honesty:** every reported threshold names N, the SHAs and the spread. The word "calibrated" appears nowhere. No
   threshold file changes in this slice. Say how each is checked mechanically.
2. **Provenance:** every `G_done` and `G_qa` carries `source` (`seat` | `runtime`) and `plan_provenance`
   (`reconstructed-after` | `written-before`), and a record without them is refused.
3. **Shadow:** no new gate changes a runtime outcome, a QA verdict or a merge. Define the mutant that lets a gate
   decision flow into an outcome, which must go red.
4. **Key, D-071:**
   - (a) the key reaches the Jev endpoint, proved by an authenticated response carrying the resolved model,
     `jev-1.13.0` or later;
   - (b) the key reaches nothing else: no artifact, log, gate record or transcript, proved by constructing the
     environment with a canary and asserting on the outputs, never by reading inherited `process.env`.
   - Each needs its own test. Say which half can be tested before any live call and which needs the live run.
5. **Budget:** live calls ≤ 20, counted from the gate records, not from memory. A re-run to get a different score is
   forbidden. Define how a transport retry is told apart from a re-roll in the record.
6. **4.3's independence:** a reconstructed `D_t` is written by a seat that did not build that diff. Say how that is
   evidenced.
7. **4.4's QA-score gate:** `policies/qa-score.json` and its schema, with thresholds as data under the threshold-scan
   guard. Per requirement it records pass, fail or untested; a `severity` per fail; `regression_of_validated`; and
   `artifact_complete_enough_to_stop`. Missing evidence is `untested`. It writes `G_qa` beside the QA's `E_t` and never
   changes a verdict.
8. **4.5, F11:** the answer is committed at an ancestor of any candidate that claims green, and the first green CI run
   id postdates it.
9. **Your own parse check.** Your file's `qa-declared` block must parse with `parseDeclared` at `origin/master`.
   **Write it with NO blank lines inside the block**: T-214's fix may not be merged when the planner runs your
   criteria. Run the parse yourself and quote the result.

For each criterion give an id (S4-1 onward), its pass condition, and how it is red at `origin/master` today.

## The declared block

List the unrunnable ids and the out-of-scope ids separately, in the `qa-declared` format. Calibration itself, turning
any gate on, and jev-mcp are out of scope (brief §4).

## Authority and limits

- **Make no live Jev call.** A dry-run plan gate is allowed.
- **Make no laptop runs.** Use at most **2** tcm runs, and only to show a row red.
- **Push only `qa/s4-criteria-*`, through `node docs/loops/qa-238/push-qa.mjs <branch>`.** Never master, merges, PRs,
  or other seats' branches.
- The report: `docs/loops/loop-15-slice-4-criteria.md` on `qa/s4-criteria-report`. Criteria first, then your
  reasoning, the declared block, what could not be verified, and "Open for the planner". The LAST line is exactly
  `QA-238: REPORT COMPLETE`.
