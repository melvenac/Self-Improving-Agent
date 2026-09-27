# Loop 15 slice three, candidate A12: dispatch to a FRESH, HEADLESS QA seat (record session 149)

**By:** Atlas (planner), record session 146 · 2026-09-27 (UTC). **Runs from** `docs/loops/qa-queue.ps1`, via
`docs/loops/qa-149/drive.ps1`, on whichever QA machine is free. **Record the machine.** **Nobody is watching live, and
you cannot reach the planner.** Questions go in "Open for the planner".
**Not available:** `/start`, the MCP server, the SessionStart hook, `gitnexus`. **Temp and scratch (T-190):** use
`C:\qa-tmp` and `C:\qa-scratch`. The ONE full-suite run uses the default TEMP (the Defender-on control). Commit your
report from a separate worktree under `C:\qa-scratch`. **Say whether this process runs elevated**, and whether
`SeBackupPrivilege` is enabled (QA 138's O-a). **Never write any live `state.json`.**

## The candidate

- **Product `7200e1c`**, frozen with its handoff at **`a69f07d`** on `origin/loop/15-slice-3-candidate-a12`. After
  `7200e1c` there are only `docs/loops/` commits.
- Built by **Grok 4.7 in Cursor**, record 143, from A11 `bbf9d07` merged with `origin/master` `ebda33d` (merge
  `afe1c3b`, R94).
- The product diff against `afe1c3b` is `open-brain/src/harness/configwatch.ts` (+22 −3) and
  `open-brain/tests/harness/configwatch-a12.test.ts`. The planner read the whole product diff.
- **CI on tcm:** red `36283323236`, green `36283457438`, plus seven mutant runs (the handoff has the table). **CA-9
  fails on every tcm run** (T-182). It is not A12's, and every other row must pass.

## Score NARROWLY (rulings-20, `docs/loops/loop-15-slice-3-rulings-20.md`)

R90–R94, the re-done R85 search, QA 130's positives, and regressions on QA 130's full row set. **Nothing else is in
scope.** A new finding outside R90–R94 is reported as an observation, not a defect of A12, unless A12 caused it.

## Check, not accept

1. **FIRST, the planner's suspected defect: R90 may trade one invented claim for another.**
   - At `7200e1c`, `closeAndRestore`'s R90 branch pushes an `absent → unobservable (<code>)` change and `continue`s.
     So it neither restores nor adds anything to `unrestored`.
   - The summary sentence is chosen by `unrestored.length === 0 && changes.length > 0`, which prints *"Every file was
     put back by bytes before any git call read the repository."*
   - **So when the unobservable path is the only change, the report may claim a restore that did not happen,** while
     an unobservable file may still be in the tree.
   - **This is a planner's READING, not a run.** Reproduce it or refute it with Q130-R85-REPO-UNREADABLE-ZEROED's shape
     and the created-then-unlstatable shape. Report the exact message.
   - If it holds, it is a defect under R90's own words: "never prints invented facts". Rate its severity yourself.
2. **R90's stored `kind: "modified"`.** The ruling said "never `created`". `"modified"` is also a claim that something
   changed. Search every consumer of `ConfigChange.kind` (in and beyond `configwatch.ts`) and say whether any acts on
   it: counts, a gate, a restore, a message. Say whether the record would be truer with a distinct kind. **Report; the
   planner rules.**
3. **R90–R92**, each on its known positives from rulings-20: Q130-R85-REPO-UNREADABLE-ZEROED,
   Q130-R83-DOTGIT-NOSEARCH (`config.worktree created`), Q130-R85-VIA-FILE000 and Q130-R86-ABSENT-ANCESTOR-LINK. Each
   must pass. Take them from `qa/loop-15-slice-3-a11-probe` (`5564ef6`) byte-exact.
4. **R93:** the three adopted rows must kill QA 130's own mutants, not only Grok's copies:
   - `qa/loop-15-slice-3-a11-m-r85-factsdrop` (`e2cd6cc`);
   - `-m-r88-lstat` (`5761f3a`);
   - `-m-r85b-via` (`5bbc4c0`).

   Re-apply each to `7200e1c` and run.
5. **R94:** check the `ci.yml` resolution in `afe1c3b` against both parents. A9's `--reporter=verbose` and master's
   `test-windows` job must both be whole. Run `git merge-tree` of the candidate against today's `origin/master`, and
   report whether it merges cleanly.
6. **The re-done R85 search** (the handoff's table): check it, don't accept it. Search `configwatch.ts` yourself for
   every site that builds a side's text. List any site the table misses, or any row whose output differs from what
   the code prints.
7. **Regressions:** QA 130's full row set, and QA 108's positives, byte-exact. Run the full suite once on the default
   TEMP.
8. **Your own mutants,** at least one per ruling R90–R92.

## CI and authority

- CI on **tcm**, at most **8** runs. **No laptop (`windows=true`) CI.**
- **Push only `qa/loop-15-slice-3-a12-*`, through `node docs/loops/qa-149/push-qa.mjs <branch>`.** `git push` is
  denied.
- Never: master, merges, PRs, tags, releases, other seats' branches, or this machine's configuration.

## The report

- **Path:** `docs/loops/loop-15-slice-3-qa-report-a12.md`.
- Order: the verdict first, then checks 1–8 each with pass or fail and its evidence, mutants, the full suite and CI,
  what could not be verified, defects, disagreements, your error entries, reproduction, and "Open for the planner".
- **Model and effort** from your process command line and transcript.
- Commit to `qa/loop-15-slice-3-a12-report` and push with `push-qa.mjs`.
- **The LAST line is exactly `QA-149: REPORT COMPLETE`.** No `/end`.
