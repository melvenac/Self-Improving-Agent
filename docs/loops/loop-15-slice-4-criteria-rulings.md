# Loop 15 slice four: the planner's rulings on QA 238's criteria

**By:** Atlas (planner), record session 155, 2026-10-01. **Criteria:** `docs/loops/loop-15-slice-4-criteria.md` at
`dd7b1c39` on `origin/qa/s4-criteria-report`, by QA 238 on Plumb, and brought to master unchanged with this file.
**Verdict: ADOPTED.** S4-1 to S4-9 are the slice's acceptance rows, and the declared block (S4-20 to 24 unrunnable,
S4-30 to 35 out-of-scope) is read from the criteria commit.

## What the planner checked before adopting

- **The 8 diffs:** every merge commit in the Terms table matches its PR's merge commit (`gh pr view`, #182, #165,
  #187, #195, #209, #227, #220 and #218).
- **S4-1:** QA quotes its own parse with a known positive (a blank line makes the parse fail), so the instrument can
  fail.
- **F11 (Open 4):** read at master. See ruling 4.

## Rulings on "Open for the planner"

1. **Live-only rows are scored at the close-out, in this one file.**
   - S4-20 applies to the **step-2 candidate**: S4-2, S4-3a.2, S4-3b.2 and S4-7's live halves are declared
     unrunnable there.
   - The step-4 close-out QA scores them. The file is not split.
2. **4.4's N is 5.** A, B part 1 and B part 2 have no `E_t`, so they get **no** `G_qa` call. Each is listed as
   `not scored: no E_t`. No new task writes those `E_t`s.
   - The live budget becomes 1 (4.2) + 8 (4.3) + 5 (4.4) = **14**, plus at most 3 transport retries, so at most 17.
     D-072's cap of 20 is unchanged.
3. **Where records live:** one tracked directory, `docs/loops/loop-15-slice-4-records/`.
   - Each `G_qa` sits beside a **copy** of the `E_t` it scores, and `e_t_ref` names the original (branch, commit,
     path, blob). This satisfies S4-6c.1's "same directory".
   - The `G_done`s go in the same directory.
   - The 4.2 `G_plan` stays where `brief-plan-gate.ts` writes it, beside the brief.
4. **F11 is already answered on master. 4.5 needs no new commit, and step 3 is removed.**
   - F11 as ruled (rulings-1 R6, amended by rulings-2 R8) is `LOOP_LIMITS` in `open-brain/src/harness/runtime.ts`.
     Its doc comment says "F11, as ruled". It was committed at `3b192871` (candidate A), which is an ancestor of
     master and so of every slice-four candidate. The brief draft's "not on master" was stale when the brief was
     written.
   - **So S4-8 is a guard:**
     - clause 1 is met by `3b192871`;
     - clause 2 holds by ancestry for every run;
     - **clause 3 reads:** the `LOOP_LIMITS` string is byte-identical from the base to every slice-four candidate
       and the close-out. Any change to it fails the row unless the planner rules on it first.
     - Clause 4 (the close-out quotes the first green run id, `head_sha` and `created_at`, and names `3b192871`)
       stands.
   - Slice four's shadow-only property is S4-6d's job, not F11's.
5. **The launch line (Open 5):** `940d17cb` is accepted. The dispatch file and `open-brain/` are identical at
   `0394acbf`. From now on the launcher passes `<DISPATCH_SHA>` in the launch command itself (clark).
6. **G-044 in `t195-plan-gate.test.ts:80` (Open 6): fix it in the step-2 candidate.** The `harness()` helper takes a
   constructed env and never spreads `process.env`. Existing callers pass what they need, at minimum `PATH` and
   `HOME`/`USERPROFILE`. This is S4-3b's hazard, so it is in scope, and every existing `t195-plan-gate` test still
   passes (S4-9.2).
7. **A 4.2 reject does not pause step 4 (Open 7).**
   - The first answer is the observation (S4-2.4). The QA seat records the verdict and feedback and goes on to 4.3
     and 4.4.
   - `dispatch-check` is not re-run on an already-dispatched brief.
   - The close-out quotes the verdict as it stands.

## Consequences for the order (amends `loop-15-slice-4-dispatch.md`)

| Step | What | Who |
|---|---|---|
| 1 | T-214 | sia-builder (built, `caebe8b6`; QA 239 running on Plumb) |
| 2 | 4.4, the 4.3 runner and the reconstructions, the S4-4a provenance schema and validator, the S4-7 write-ahead and counting command, the S4-3a comparator, the S4-3b canary tests, and the t195 helper fix (ruling 6) | sia-builder |
| ~~3~~ | ~~F11~~: answered, ruling 4 | none |
| 4 | the live calls (≤ 17), then the close-out | the QA seat (D-074) |

The 4.3 independence mapping (S4-4b.1) is `docs/loops/loop-15-slice-4-reconstruction-map.md`.
