# Record 215 (T-195: a D_t beside every brief, judged by the plan gate): QA dispatch (record 216)

**By:** Atlas (planner), 2026-09-28, record session 149. **Runs headless through the Cursor QA driver, with GPT
(`gpt-5.6-sol-medium`),** a model that did not build this (Grok, Forge). **Never write a live `state.json` or the real
knowledge DB.** Commit the report from a separate worktree.

## The candidate

- **Code at `603be51`** on `origin/loop/t195-dt-plan-gate`. The branch tip `354154e` adds only the handoff. Base
  `origin/master` `8467cb1`. Handoff: `docs/loops/t195-developer-handoff.md` at the tip.
- **The brief:** `docs/loops/t194-t195-dispatch.md`, §"Record 215", in this commit. It holds rows DT-1 to DT-8.
- **DT-9, added after the brief by planner ruling D-062** (the record reaches seats through origin/master only):
  `dispatch-check` refuses a brief, or its D_t, that is not on origin/master with the same content. It names the
  path, the master SHA and which case applied. The planner defined these sub-rows:
  - **DT-9a:** a brief committed only on a side branch is refused.
  - **DT-9b:** HEAD on master, but the brief modified in the working tree: refused.
  - **DT-9c:** the D_t absent on master: refused.
  - **DT-9d:** brief and D_t identical to master: passes.
- **Mutant branches (Forge's):**
  - `-mut-dt9-ancestry` `8d919d7`: the HEAD-ancestry check that r1 shipped, on the fixed code.
  - `-mut-threshold` `c5da6ea`, `-mut-pass-on-error` `908167a` and `-mut-dispatch-ok` `4e0cce9`, all on `98acff5`.
    **These three predate the DT-9 fix, which changed `brief-plan-gate.ts`. Re-apply each one's single-line change to
    `603be51` and run it there.** Do not rely on their old failures.

## Score

Score every row, DT-1 to DT-8 plus DT-9a to DT-9d, as `met`, `unmet`, `partial` or `not_evaluated`, with the test or
command that shows it. Also:

1. **Full suite on tcm** at `603be51` and at the base `8467cb1`. Say whether any failure is new. Master CI runs tests
   again from `c933a44` (#200), so a green run now means tests ran; quote the `test` job's conclusion, not only the
   run's.
2. **Fails closed (DT-6):** each of these must refuse, exit nonzero and name its cause. **Never a pass.**
   - a missing `TYPESAFE_API_KEY`;
   - a transport error;
   - a non-2xx response;
   - a malformed envelope.

   Use stubs only, with a fixture environment, never inherited `process.env` (G-044). **No live Jev call:** the live
   call is the named limit, observed later by the planner.
3. **Blocks dispatch (DT-7):** name the mechanism Forge chose (`harness dispatch-check`). Say whether anything in the
   planner's actual dispatch path calls it. If nothing does, score DT-7 `partial` and say what would have to call it.
   A check that nothing runs is a tool, not a gate.
4. **DT-9 compares content, not ancestry:** try DT-9b yourself with a real brief in a scratch clone, not only through
   the test.
5. **Preserved (DT-8):** `validate evidence`, the runtime's plan gate, the done-gate and both policy files are
   unchanged. Diff them against `8467cb1`.
6. Your own mutants, at least two, on `qa/t195-mut-*`.

## The report

- **Path:** `docs/loops/t195-qa-report.md`, on `qa/t195-report`.
- **Order:** the verdict first, then each row, mutants, CI, defects, and your model.

## Evidence file

Beside the report, write `docs/loops/t195-qa-report.E_t.json`:
- loop id `t195`, following the `EvidenceSchema` (`open-brain/src/harness/schema.ts`);
- one `acceptance[]` row per item above, with status `met`, `unmet`, `partial`, `not_evaluated` or `pending`, and
  `order` set to `shown` or `attributed` on every `met` row;
- `runtime_checks` from the CI you ran;
- `candidate_git.sha` as the full 40-character code SHA of `603be51`.

From `open-brain/`, run `node build/harness/cli.js validate evidence <file>` against the candidate's build, and quote
its exit code in the report. **A report without a valid evidence file is incomplete.** Commit it on the report branch.

## CI and authority (D-061: QA runs the CI; developers do not)

Dispatch the candidate's runs on tcm yourself (`gh workflow run ci.yml --ref <branch>`), at most 6 runs. **No
`windows=true`.** Quote each run id with its conclusion, headSha and the `test` job's conclusion.

**The LAST line of the report is exactly `QA-216: REPORT COMPLETE`.** Push only `qa/t195-*`, through
`node docs/loops/qa-216/push-qa.mjs`.
