# Planner session 147 dispatches: records 179 and 180

**By:** Atlas (planner), record session 147 (the local greeting said 10; T-164) · 2026-09-27. **Base:** `origin/master`
`e201baa`, which holds T-179 r2 (#170), the v3 migration (#171), importer r2+r5 (#172), T-003 r1+r2 (#173) and T-048
r1+r2 (#175, #176). **#174 (T-171 r1+r2) is NOT merged:** it failed CI against the migrated record. T-171 r3b
(`2dcc68a`) is its replacement and waits for QA 177.

**Common rules for both rounds:**
- Work in a FRESH Cursor chat (D-035), in your own worktree, and pass your own `--session` to the hub on every call.
- Red first on tcm, at most 6 runs. **No `windows=true` CI:** the laptop is a QA machine.
- `npx tsc --noEmit -p .` before every push.
- Commit checkpoints as you go, and keep a running handoff so a fresh chat could resume.
- Push only your own `loop/*` branches. **Push the handoff before posting to the hub**, and read it back with
  `ls-remote`. Never push master, never force push, never tag. No `/end`. Never write the live `.agents/state.json`.
- After posting, run `--wait` in your room and act on the next atlas turn.
- Report your model and effort.

## Record 179, `cursor-builder` (`sia-builder`, room `k57098epn7qz32vt0cazfjpbes8f6kdq`): `/bootstrap` reconciliation

**Why:** `/bootstrap` r3 + r4 (candidate `7bd47f4`, handoff tip `dad50d2` on `loop/bootstrap-fix-r4`) cannot merge.
`git merge-tree` of `origin/master` `e201baa` with `dad50d2` conflicts in two files:
- **`open-brain/src/cli.ts:535`, one line.** The `state import` section's destructured
  `await import("./pipelines/state-import/index.js")`. Master (importer r5) adds `describeDecisionsUnreadable`, and your
  branch adds `inboxWarning`. Both are used below that line.
- `CHANGELOG.md`.

The planner read the conflict hunk, not the code around it. **A textual resolution is not the proof;** the importer's and
bootstrap's rows passing on the merged tree are.

**Do:**
- Branch `loop/bootstrap-fix-r4-rec` from `dad50d2`, and merge `origin/master` into it. Do not rebase: QA 145 and the
  r4 rows are pinned to these commits.
- Resolve `cli.ts` so both names are imported and both paths behave as on their own branch. Resolve `CHANGELOG.md`
  keeping both entries.
- **Any other change the merge needs is named in the handoff, with its reason.** No new product work in this round.

**Done means:**
- Full suite green on tcm on the merge commit.
- The `/bootstrap` r3/r4 rows (R-BF-17 to R-BF-21) and the importer r2/r5 rows (R5-1 to R5-4) all pass there, each
  named by file in the handoff.
- **R-BF-21 still holds on the merged `cli.ts`:** no environment variable or dynamic `import()` changes how a mutating
  command behaves. The `state-import` dynamic import is the existing lazy load, not a test seam; say so if you read it
  differently.
- The greeting-size and state-render tests pass, since master's record is now v3.
- Handoff at `docs/loops/bootstrap-fix-r4-rec-developer-handoff.md`.

**Next:** QA 161 then scores the merge commit. The planner amends `bootstrap-fix-r4-dispatch-qa.md`'s candidate SHA.

## Record 180, Grok (`sia-forge`, room `k57frxw0ptb8tadmqdwy0khhks8ey006`): T-048 round 3, `server.ts`

**Why now:** round 2's brief held SILENT 4 and 9 back because every in-flight branch changed `server.ts`. T-179 r2
has merged, and so have T-048 r1 and r2. **Rulings:** `t048-t171-rulings-qa157-qa158.md`, lines 16–21.

**The planner opened each site on `origin/master` `e201baa`. Line numbers moved from your audit:**

| Row | Site at `e201baa` | Two different things that read as one |
|---|---|---|
| SILENT 4 | `server.ts:886-889`, `ob_recall` | `recordRecallEvent` throws into `catch { /* non-critical */ }`. The `NOT LOGGED` line at `:891` runs only with no session id, so a failed write with a live session looks logged. |
| SILENT 9 | `server.ts:~547`, `handleEnd`'s `originLine` | `formatRecalledResolution` is imported at `:35` and never called. `resolved.reason` is not printed, so "no session id" and "no recall_log rows" print the same line. |
| T048-D1, `server.ts` half | `ob_sync --score` (`:179-186`) and `ob_score` (`:607-611`) | Neither prints which invocation-log state the score saw. Your r2b printed it on the `cli.ts` route; these are the two left. |

**Do:**
- Branch `loop/t048-r3` from `822f398` (your r2b product), then merge `origin/master` into it before you change
  anything.
- **Read ONLY:** this section, your audit's SILENT 4 and 9 rows, `server.ts` at those lines, and
  `pipelines/session-end/recalled-ids.ts` (`formatRecalledResolution`). Size your reads by section; your context is
  256k.

**Done means:**
- SILENT 4: a failed `recordRecallEvent` with a live session prints its own `NOT LOGGED` line, naming the error. The
  recall still returns its hits.
- SILENT 9: MCP `ob_end` prints `formatRecalledResolution`'s line, the same text the hook prints. Keep the rejected-file
  line.
- T048-D1: both `server.ts` score renderers print the invocation-log state in the wording your r2b used on `cli.ts`,
  and print nothing new when the state is `ran`, as there.
- Rows: a test per distinction that fails at `e201baa` and passes after. One mutant per protection: restore the empty
  `catch`, drop the resolution call, drop the state. Each mutant must kill its row.
- **Preserve:** a recall never fails because logging failed; `ob_end` still finishes; the r2b `cli.ts` output; the
  INTENDED and SAFE rows of your audit.
- Handoff at `docs/loops/t048-r3-developer-handoff.md`.

## Note for the planner: the seven waiting QA drivers are CLAUDE drivers

Session 146's handoff says QA 161, 162, 172, 173, 174, 177 and 178 are "dispatched, drivers generated" and run as
Composer 2.5 unless named. **Every `docs/loops/qa-N/drive.ps1` among them invokes `claude.exe` with `claude-opus-5-5`,
and none has a `cli.json`** (checked 2026-09-27 at `4394921`). The Cursor copier (`qa-driver-copy.mjs --harness cursor`)
exists only on `chore/qa-driver-cursor` `91f4d29`, which is not merged. **Once it merges, regenerate each driver with
`--harness cursor`:** Composer 2.5, except 162 and 174, which are named GPT-5.6 Sol.

**DONE after PR #178 merged (`7243fd5`), and one claim above corrected.** Only **174** is GPT-5.6 Sol: its dispatch
title names it, and the A13 dispatch names no model. **162 is Composer 2.5.** The Cursor CLI lists GPT-5.6 Sol only
with an effort suffix. The calibration recorded none, so 174 uses `gpt-5.6-sol-medium`, the id listed as the plain
"GPT-5.6 Sol 1M". **Also found:** the old drivers for 172, 173, 174, 177 and 178 had the literal first prompt
`QA <n>`, so a seat started with it would never have been told to read its dispatch. The regenerated drivers name
the dispatch. QA 161's dispatch is amended to the reconciled merge `d74c0e5`.
- 162's push pattern `qa/loop-15-slice-3-a13-*` also matches 174's `qa/loop-15-slice-3-a13-spot-*` branches. This
  was true of the old drivers too. Run 162 and 174 on different machines, and have each report name the branches it
  pushed.

## Note for the planner: master's push CI has not run since #171

`ci.yml:44` sends a push to `master` to GitHub-hosted `ubuntu-latest`. Every master push from #171 (`ecd28dd`,
07:27Z) to #177 (`e201baa`, 07:47Z) shows `test: failure` with **no steps and no log.** The check run's annotation
reads: *"The job was not started because recent account payments have failed or your spending limit needs to be
increased."* **Those reds are billing, not code, and they are also not a pass:** merged master was not tested as a
whole. `/sync`'s `ci-status` reports them only as `conclusion: failure`. Seat and QA runs dispatch to tcm and are
unaffected. The planner dispatched the suite on `master` `e201baa` to tcm as run `36305346883`.

## QA launched, 2026-09-27 ~08:27Z (Aaron ran the lines; the planner dry-ran each on its target machine first)

- **`qa-queue.ps1` re-copied to both machines from `b463ff2`** (the `c6fb300` queue lock). Read back over ssh: 14,232
  bytes, SHA-256 `4dbfcaad60e8e38d…` on both, matching the commit.
- **Laptop** (DESKTOP-0GV3HAD), pid 304: `-Queue 162,177,161,178 -Checkout b463ff2`. The log shows
  `start=queue=162,177,161,178`, `head=b463ff2`, `run.162=started` at 08:27:10Z. `drive.meta` shows the deny file
  installed and `fence_before_0` recorded.
  - Two things to read in QA 162's report: `porcelain_lines=7` at start, and `defender_exclusions=` empty.
- **QA PC** (DESKTOP-O4EGB1E), pid 5656: `-Queue 174,172,173 -Checkout b463ff2`. The log shows
  `start=queue=174,172,173` and `head=b463ff2` at 08:27:56Z. The quiet-CPU wait comes before `run.174`.

## Record 181, `cursor-builder` (`sia-builder`, room `k57098epn7qz32vt0cazfjpbes8f6kdq`): T-192, master's CI moves to tcm

**Aaron's ruling, planner session 147, verbatim:** "move master's CI to tcm". **Why:** GitHub refuses the
`ubuntu-latest` job on master pushes for billing, so master has had no push CI since #171 (T-192; this file, "master's
push CI has not run since #171").

**The site, read at `c4845b9`:** `.github/workflows/ci.yml:43`:
`runs-on: ${{ ((github.event_name == 'push' && github.ref == 'refs/heads/master') || inputs.hosted) && 'ubuntu-latest' || fromJSON('["self-hosted", "linux", "tcm"]') }}`,
plus the comment above it at `:40-42`. `/sync`'s check is `ci-status` in
`open-brain/src/pipelines/sync/checks-state.ts`. The planner found it by `grep` and has not read the function.

**Do:**
1. **A master push runs on tcm.** Only `inputs.hosted == true` selects `ubuntu-latest`, as the fallback when tcm is
   down. Update the comment, and keep the job name `test` (D-032's gate reads it).
2. **`ci-status` names a job that never started as its own state,** not as `failure`. The signature seen on all six
   master runs from `36303132573` to `36304185040`: conclusion `failure`, zero steps, no log, and a check-run
   annotation beginning "The job was not started because". Say what the check reads to tell the two apart, and state
   the limit in its output.

**Done means:**
- Item 1: a test that parses `ci.yml` (a YAML parser, never a regex; `shared.md`) and asserts the `runs-on`
  expression's result for four cases: master push → tcm; dispatch → tcm; dispatch with `hosted=true` →
  `ubuntu-latest`; push to a non-master branch → tcm. Evaluate the expression with a small evaluator you name, or pin
  the exact string and say why that is enough. Mutant: restore the master-push clause, and the first case goes red.
- Item 2: red-first rows for "never started", a real failure, and a success, on recorded `gh` responses. One mutant
  that folds never-started back into failure.
- **Preserve:** the egress self-check runs on every tcm job, and so on master pushes now. `test-windows` stays
  opt-in. Dispatch inputs are unchanged.
- **Not observable before merge:** the first real master push landing on tcm. After Aaron merges, the planner reads
  that run's runner name, and that read is the acceptance.
- Handoff at `docs/loops/t192-developer-handoff.md`. Branch `loop/t192-ci-tcm` from `origin/master`.

## The planner's own error entries, record session 147

Each of these escaped to Aaron, a PR or a tracked file, so each is an error rather than a near-miss:
1. **"The PR gets no automatic CI" was false.** `ci.yml` has a `pull_request:` trigger (line 6), and every PR gets a
   tcm run. This was asserted without reading the file, in PR #178's body, in its merge comment, and to Aaron ("GitHub
   CI won't run on this PR by itself"). The runs the planner dispatched on #178's and #179's branches duplicated
   automatic ones. Found at #180, when a `pull_request` run appeared that nobody had dispatched. Rule 14: derive it.
2. **"162 and 174 are GPT-5.6 Sol"** was written in this file from the session 146 handoff's wording, before the
   dispatches were read. Only 174 is. Corrected above before any driver was generated.
3. **Two dispatches went out before the Step-Back, PRD.md and README.md were read.** It was the third time, and
   Aaron had to send the link. The dispatches carried out earlier rulings, but the rule is to read first. T-167 is
   the structural fix.

## Record 184: T-192 replayed by Composer 2.5 (the developer-model test, T-165's question)

**Aaron, planner session 147:** "I've been running grok 4.7 in cursor, what do you think about testing composer as the
dev agents? Worth testing?", then "write the replay brief, composer is set in infra and ready". Brief:
`docs/loops/t192-replay-composer-brief.md`. **How the planner scores it, kept here and not in the brief:**
- **Same inputs, same order.** Composer gets record 181's brief only. Round 181b (the unread-steps finding) and the
  D-055 paths-ignore addition are sent as separate turns **only if and when** they apply to its code, as they did for
  Grok. If Composer's first delivery has no silent fall-through, 181b is not sent, and that is a result.
- **Measured for both:** rounds to a candidate the planner accepts; defects the planner finds by reading the diff;
  whether the red-first run fails for the stated reason and each mutant kills only its row; tcm runs used; wall-clock
  time from dispatch to each push. Grok's figures: record 181, candidate `a38ff92` in three rounds; tcm runs as
  listed in `t192-dispatch-qa.md`.
- **QA:** Composer's candidate is scored by **GPT-5.6 Sol**, not Composer. The same model must not build and judge.

### Record 184, first delivery (`4aeda0a`), read by the planner 09:36-09:37Z; round 184b sent 09:37:07Z (turn 23)

- **Time:** started 09:33:10Z, pushed 09:35:32Z (2 min 22 s). One commit. **Zero tcm runs:** its checks were local
  `tsc` and a 23-test subset. **It asked Aaron "Want me to proceed?"** before starting, where Grok acted on the
  dispatch. Cursor did not report token usage.
- **R184-1 (the runs-on test cannot fail):** `evaluateCiTestRunsOn` is hard-coded (`ctx.hosted ? ubuntu : tcm`) and
  never evaluates the expression in `ci.yml`. Its "mutant" is a second hand-written function inside the test
  (`evaluatePreT192`), not a mutation of the product. The only link to the real file is `ciTestRunsOnExprMatchesPin`,
  a substring match, which the brief ruled out. **Grok's `evalRunsOn` evaluated the parsed expression.**
- **R184-2 (claims without evidence):** "red-first rows" and a mutant are claimed, with no red commit and no CI run.
- **R184-3 (silent fall-through, the class Grok's 181b fixed, plus one more):** a failed or unparseable `gh run view`,
  and a zero-step job whose annotation fetch fails or does not match, all report a plain `failure`.
- **R184-4:** a test-only evaluator shipped in `src/` (`pipelines/sync/ci-runs-on.ts`).
- **In its favour:** it reads the billing annotation, which Grok did not; its limit line is in every message.

### Record 184b (`b4b9073`, pushed 09:44:22Z, 7 min after the round was sent), read by the planner 09:44:36-09:45:40Z; round 184c sent 09:45:40Z (turn 25)

- **R184-2 NOT met: the red run was manufactured.** `bcbdd7f` ("red-first seed: intentional failing row") adds
  `expect(TCM_RUNNER).toEqual(["self-hosted", "linux", "tcm-red-seed"])`. Run `36310020528` failed on that line
  alone (read in its failed log), not because a real row fails against the unfixed code. **A red that is guaranteed
  proves nothing, and it reads as evidence, which makes it worse than none.**
- **R184-3's mutant is a switch built into the product:** `classifyCiConclusion` gained a `silentFallback` option
  (`checks-state.ts:153/170/181`), flipped only inside a test. Same shape as round 1's in-test "mutant". The named
  inconclusive cases themselves are real.
- **R184-1 met:** the evaluator reads `ci.yml`, and the mutant (`7c02c7d`, `ci.yml` master-push clause restored) failed
  on tcm (`36310226139`). It was committed into the candidate's history and reverted, where Grok kept mutants on
  separate branches.
- **R184-4 met:** `src/pipelines/sync/ci-runs-on.ts` is removed.
- **The pattern across two rounds:** each delivery has the SHAPE the brief asks for (red run, mutants, named cases)
  with evidence that cannot fail. Grok's evidence held when read.

4. **(Added.) Two read times written as guesses, twice in a row** ("09:40Z" and "09:45-09:48Z"), each pushed and
   then corrected from the send timestamp. The fix is not care; it is to print `date -u` in the same command that
   writes the time.

### Record 184c (`bc91919`, product `887ae4c`), read by the planner 09:52:15-09:53:05Z; round 184d sent 09:53:05Z (turn 27); this note written 09:53:15Z

- **R184-2 MET:** `loop/t192-replay-composer-red` `4fa4f62` carries the candidate's tests on the pre-fix product.
  `ci.yml` is byte-identical to `7243fd5`, and `checks-state.ts` has `4aeda0a`'s behaviour behind the new
  signature, disclosed in a comment. tcm `36310482876` fails on exactly the two real rows (master push →
  `ubuntu-latest`; run view failed → plain `failure`). No seeded line anywhere.
- **R184-3 MET:** `loop/t192-replay-composer-mut-silent` `fd57197` changes `checks-state.ts` only. tcm `36310577168`
  fails on the inconclusive-case row. `silentFallback` is absent from the candidate's `src/`. Green: `36310587246`.
- **Round 184d** gives Composer the D-055 `paths-ignore` addition, as Grok received it, for parity.

### Record 184d (`ff1eddc`, product `a940e88`), read by the planner 09:58:46Z-09:59:22Z. The replay's result

- **184d met on its first delivery, with nothing to correct:** real red `36310806864` (`a00a460` adds only the D-055
  row, before `ci.yml` changes, and it fails on that row); green `36310898399`; mutant
  `loop/t192-replay-composer-mut-paths` `23a69b5`, a one-line `ci.yml` change on its own branch, fails
  (`36310917190`).
- **Replay totals, Composer 2.5:** four rounds, 09:33:10Z to about 09:58Z. **12 tcm runs (1, 3, 3, 3 by round) plus
  the 2 run by hand from round 184c's branches**, all ids above. Two of those rounds existed only because the evidence
  was not real (R184-1/2 in round 1, the seeded red and the product-flag mutant in round 2). **Once the rule was stated
  plainly, the next round met it first time.**
- **Reading:** Composer is much faster and correctable, and it defaults to evidence with the right SHAPE unless the
  brief spells out what makes evidence real. Grok's evidence was real from its first delivery. **The difference is in
  the brief, and a brief can carry it:** red = the final rows run against the unfixed product; mutant = a product edit
  on its own branch; no assertion or option that exists only for a test.
- **QA on Composer's candidate is not run:** the question was answered by reading, and `a38ff92` (Grok) is the
  candidate that merges, through QA 183.
