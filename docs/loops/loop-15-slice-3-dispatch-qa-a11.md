# Loop 15 slice three, candidate A11: dispatch to a FRESH, HEADLESS QA seat (record session 130)

**By:** Atlas (planner), record session 109 · 2026-09-26 (UTC). **Where QA 130 runs:** the QA PC `desktop-o4egb1e`,
launched by `docs/loops/qa-queue.ps1` (Aaron's overnight queue), which runs `docs/loops/qa-130/drive.ps1`. **Nobody is
watching live, and you cannot reach the planner.** Questions go in "Open for the planner".
**Not available here:** `/start`, the open-brain MCP server, the SessionStart hook, `gitnexus`.
**Temp and scratch (T-190):** `TEMP`=`TMP`=`C:\qa-tmp`, and scratch goes under `C:\qa-scratch`. The one full-suite run
uses the default temp (the Defender-on control).
**No git identity here:** pass it per command. **QA seats run one at a time on a machine.** Commit your report from a
separate worktree under `C:\qa-scratch`, so the shared tree's HEAD never moves.

## The candidate

- **Product `ef2a8a7`**, frozen with its handoff at **`bbf9d07`** on `origin/loop/15-slice-3-candidate-a11`. The diff
  after `ef2a8a7` is `docs/loops/` only. Built by **Grok 4.7 in Cursor**, record 115 (no effort setting is shown in
  Cursor), on A10 `4b7a5ae` (product `ecf1f62`). **Master was not merged in.** The handoff records the drift, which is
  `docs/` and `.agents/` plus master's merges since `9bc06e3`. Check with `git merge-tree` against today's
  `origin/master` whether A11 merges cleanly, and report it.
- **Commits** (from each commit's own diff; the handoff has the table):
  - `0cf7933` R83;
  - `6fa7cea` R84;
  - `a5f3715` R85;
  - `adb20a4` R86;
  - `ff637a2` R87 (test only);
  - `0f42cc8` R88;
  - `ef2a8a7` R85b (a realpath failure with no lstat prints no zeroed facts).
- **CI on tcm:** freeze `36229579888`. **CA-9 fails on every tcm run** (tcm's Claude Code lacks `--permission-prompts`,
  T-182), and it is not A11's. Every other row must pass.

## Score against

- **`docs/loops/loop-15-slice-3-rulings-19.md`: R83 to R88**, plus **R85b**, ruled in hub turn 155. That text is in
  this file: "when observe has no lstat facts, the text says so and prints no zeros; where observe HAS an lstat, it
  prints those real facts".
- **Rulings-18 readings 1, 5 and 6, and R82,** which must still hold.
- **Your predecessor QA 108's report** (`origin/qa/loop-15-slice-3-a10-report` `d352af3`), and its probe files
  (`docs/loops/qa-scripts-a10/`, and `qa108-a10-probe*.test.ts` on `qa/loop-15-slice-3-a10-probe` and `-probe2`).
  **Re-run them byte-exact.**
  - Each positive that A10 failed must pass now.
  - **§14 item 2's list is adopted as the obsolete set** (rulings-19): re-read each of those in its new form, and
    say, for each, whether the new form holds.
- **The consumer list (R83) and the R85 search** in the handoff: check them, don't accept them. Search `configwatch.ts`
  yourself for any site that turns an identity or read result into null, or builds a side from a bare word or
  zeroed facts. Grok's answers on the `kind: dir` null (`:479`/`:715`/`:736`) and on `:227` were accepted by the
  planner. Check both.
- **The mutants:** the developer's (`loop/15-slice-3-a11-mut-*`, each run id in the handoff), plus **QA 108's own
  `q108-r72-callsite`**, which R87 must kill. Then at least one of your own per ruling.

## CI and authority

- CI on **tcm**, at most **8** runs. **The laptop is not yours:** B's scoring may be using it.
- **Push only `qa/loop-15-slice-3-a11-*`, through `node docs/loops/qa-130/push-qa.mjs <branch>`.** `git push` is denied.
- Never: master, merges, PRs, tags, releases, other seats' branches, or this PC's configuration.

## The report

- **Path:** `docs/loops/loop-15-slice-3-qa-report-a11.md`. Put the verdict first, then R83 to R88 and R85b each with
  pass or fail and its evidence, then the regressions against rulings-18 and QA 108, mutants, the full suite and CI,
  what could not be verified, defects, disagreements, your error entries, reproduction, and "Open for the planner".
- **Model and effort** from your process command line and transcript.
- Commit it to `qa/loop-15-slice-3-a11-report`, and push with `push-qa.mjs`.
- **The LAST line is exactly `QA-130: REPORT COMPLETE`.** No `/end` (T-163).
