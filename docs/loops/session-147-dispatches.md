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
- **Replay totals, Composer 2.5:** four rounds, 09:33:10Z to about 09:58Z. **9 tcm runs (0, 3, 3, 3 by round):
  `36310020528`, `36310124469`, `36310226139`, `36310482876`, `36310577168`, `36310587246`, `36310806864`,
  `36310898399`, `36310917190`.** Two of those rounds existed only because the evidence
  was not real (R184-1/2 in round 1, the seeded red and the product-flag mutant in round 2). **Once the rule was stated
  plainly, the next round met it first time.**
- **Reading:** Composer is much faster and correctable, and it defaults to evidence with the right SHAPE unless the
  brief spells out what makes evidence real. Grok's evidence was real from its first delivery. **The difference is in
  the brief, and a brief can carry it:** red = the final rows run against the unfixed product; mutant = a product edit
  on its own branch; no assertion or option that exists only for a test.
- **QA on Composer's candidate is not run:** the question was answered by reading, and `a38ff92` (Grok) is the
  candidate that merges, through QA 183.

5. **(Added.) A run count asserted, not counted:** "12 tcm runs (1, 3, 3, 3) plus 2 run by hand" was pushed in
   `b58fd1b`. Round 1 had no tcm runs and there were no hand-run extras: the ids sum to 9. Corrected from the list of
   run ids. Rule 14, a third time today in one file.

## Record 185, `cursor-infra` (Composer 2.5, `sia-infra`, room `k5702788wctxj75begyt4x2k5x8f6mav`): the queue's head restore fails open

**What happened, read from the laptop's `queue.log` and its QA tree, 2026-09-27:** QA 177 committed its report in the
shared QA tree, which left HEAD at `fc8d8cd` with an untracked `docs/loops/qa-177/` and a modified
`open-brain/package-lock.json`. Before 161, the queue logged `head_moved.161=fc8d8cd…; restoring b463ff2` and ran
`git checkout -q --detach $head` (`qa-queue.ps1:268`). That checkout failed: `qa-177/` is tracked at `b463ff2`, so the
untracked copy was in the way. **Nothing checked it.** The tree stayed at `fc8d8cd`, where `docs/loops/qa-161/drive.ps1`
does not exist, and PowerShell exited `-196608` in under a second. The same happened to 178. At 10:09Z the tree was
still at `fc8d8cd` with 11 porcelain lines. The QA PC's restore before 173 worked, so this depends on what the previous
seat left.

**Do (branch `loop/qa-queue-restore` from `origin/master`):**
1. **The restore must be verified.** After the restore, read HEAD back. If it is not `$head`, log
   `restore_failed.<n>` naming both SHAs and git's first error line, and do NOT start that driver. Say whether the
   queue then skips to the next item (which would face the same tree) or aborts, and why.
2. **Restore with `git checkout -f -q --detach $head`,** which discards changes to tracked files and overwrites
   untracked files in the way. Everything a QA seat must keep is pushed through `push-qa.mjs` before its report's last
   line is written. Say in the handoff if you find a case where it is not.
3. **The same for the launch `-Checkout` (`:232`):** use `-f`, and read HEAD back after it.

**Evidence (`.agents/roles/developer.md`, "Building checks"; D-060):**
- **Red:** extend `docs/loops/qa-queue-guard-harness.ps1`, whose stub repo and stub driver already exist. The
  scenario: the stub queue lists two items, and between them the tree's HEAD moves to a commit where item 2's driver
  is untracked, with an untracked file in the way. Run the harness against the CURRENT `qa-queue.ps1` (`c6fb300`) and
  show item 2 launched on the wrong tree, or exited `-196608`, from the log. That output is the red.
- **Green:** the same harness against your script: the restore succeeds and item 2 runs on `$head`. A second scenario,
  where the restore cannot succeed (lock a file so the checkout fails), logs `restore_failed` and starts no driver.
- **Mutant:** on its own branch, remove the read-back; the second scenario's assertion must fail.
- This runs on this desktop, hidden, stubs only, as the queue-guard harness does. **Never on a QA machine, and never
  in `%USERPROFILE%\Worktrees\sia-qa`.** No tcm runs are needed unless you touch `open-brain/`.
- Handoff at `docs/loops/qa-queue-restore-developer-handoff.md`.

## Rulings on QA 162, 174, 177, 172 and 173 (planner, record session 147; written 10:13:49Z)

**The planner read each candidate's product diff before ruling** (`.agents/roles/planner.md`; memory: read the
candidate, not only its handoff). Verdict sections of all five reports read; the defect tables were not re-read.

| Candidate | QA | Ruling | What the planner read |
|---|---|---|---|
| A13 `4b43410` (loop 15 candidate A) | 162 Composer, 174 GPT-5.6 Sol: both ACCEPTED | **ACCEPTED** | `configwatch.ts` +7/-3: R95 pushes the true note into `unrestored` (R77 stops before git); R96 adds `kind: "unobservable"`. `git grep` of `.kind` comparisons in `src/harness` finds only file-identity kinds, so no consumer mishandles the fourth kind. |
| T-171 r3b `2dcc68a` | 177 ACCEPT | **ACCEPTED** | `state-schema.ts` `note_by` defaults to null; `state-writer.ts` re-omits the key for untouched tasks; the note quote starts from the first differing character. |
| importer r6 `c2ee52d` | 172 PASS | **ACCEPTED** | `describeLastSession` in the report and both CLI modes; `adrNotImported` says "could not be read" for an odd-length FE FF list. |
| T-048 r1b `d5b78cb` | 173 PASS | **ACCEPTED** | `checks.ts`: no early return on unreadables; findings listed before unreadables. |

- **PRs for Aaron's merge:** #182 (A13), #183 (T-171 r1-r3b; #174 closed as superseded), #184 (importer r6), #185
  (T-048 r1b). Each tip adds only `docs/` over its scored candidate, and each merges into `origin/master`
  `895da58` cleanly on its own.
- **Merge-order note:** #184 and `loop/bootstrap-fix-r4-rec` both edit `cli.ts:535`. Whichever merges second needs a
  one-line reconciliation.
- **QA 162's report calls `DESKTOP-0GV3HAD` "the QA PC".** That is the laptop. Noted, not blocking.
- **161 and 178 did not run** (record 185): the laptop's queue restore failed and left the tree at `fc8d8cd`.

## Record 186, `cursor-builder` (Grok 4.7, `sia-builder`, room `k57098epn7qz32vt0cazfjpbes8f6kdq`): T-193, the worktree-layout check

**Why:** Relay traced A2A-Hub's six loop- and occupant-named worktrees to a gap in SIA's own rules. The one-per-seat
convention was never written down, and T-149 is still open. The text is now in `.agents/roles/shared.md` (PR #181).
This check makes it a rule. The record: T-193 (rev 140).

**Do (branch `loop/t193-worktree-check` from `origin/master`):**
- A `/sync` check, `worktree-layout`. It walks `git worktree list --porcelain` (a parser over the porcelain format,
  never a pattern over the human output). Every entry must be the main checkout, or a folder named
  `<project>-<seat>`, where `<project>` and the seats come from a **tracked data file**, not from the code. Add the
  file to `.gitignore`'s `.agents/` allowlist if it lives there. SIA's seats: planner, builder, forge, infra,
  research, qa.
- Any other entry is an ISSUE naming the folder, its branch or detached SHA, and why it fails the rule. A project
  with no data file is a SKIP that says so, never a PASS.
- **Its output states its limit:** it sees registered worktrees only. An orphan directory with no git registration
  is not seen (`sia-qa2-gpt-cand` was one, an empty folder, on 2026-09-27).
- Report what was walked (the count of entries), and assert that count in a test.

**Evidence (`.agents/roles/developer.md`, "Building checks"):**
- **Red:** real worktrees in a scratch repository, a seat folder and a loop-named folder, with the check absent or
  passing wrongly. The real rows run against the unfixed product.
- **Green:** the loop-named folder is named as an ISSUE; the seat folder and the main checkout pass; no data file
  gives a SKIP.
- **Mutants on their own branches:** accept any folder name (the loop-named row goes red); drop the data file read and
  hard-code the seats (a row with a different seat list goes red).
- tcm, at most 6 runs. Handoff at `docs/loops/t193-developer-handoff.md`.

## The planner's own error entries (continued)

6. **An `ob_state` write without its dry run first** (rev 139 → 140, `open_task T-193`). It applied cleanly, but
   `shared.md` says to read the dry run before every real call, and this one was skipped.
- **Owed to Relay when T-193 is accepted:** the seat data file's path and format, so A2A-Hub can add `a2a-planner`,
  `a2a-rivet` and `a2a-qa` as a docs-only change (Relay's message, record session 147).

## Incident: every Cursor CLI tool call blocked after context-mode 1.0.169 (fixed 10:59:55Z)

- **Cause, measured:** Grok Build updated itself (09:46-09:57Z) and pulled context-mode to 1.0.169. At 10:28:27Z the
  plugin registry moved to `…/context-mode/1.0.169`, whose `hooks/hooks.json` registers **PreToolUse for Bash, Read,
  Grep, WebFetch, Agent and `mcp__`**. The April-trimmed copy had **no** PreToolUse. Cursor CLI imports Claude plugin
  hooks, and it runs them through a PowerShell wrapper that is executed by bash (**T-046**), so every tool failed
  closed: `Hook blocked with message: --: eval: line 1: syntax error near unexpected token '&'` (Rivet, and reproduced by
  the planner with a headless `cursor-agent` started from PowerShell with no `SHELL` set, so `SHELL` is not the cause).
- **Fix:** removed the 9 PreToolUse entries from `~/.claude/plugins/cache/context-mode/context-mode/1.0.169/hooks/hooks.json`
  (backup: `hooks.json.1.0.169.bak` in the planner's scratchpad). Same test afterwards: `echo` runs,
  result `hooktest-ok`. Also done: `context-mode upgrade` (bundled CLI) removed the duplicate context-mode entries
  that the upgrade had re-added to `~/.claude/settings.json`.
- **NOT durable:** the next context-mode update rewrites the plugin cache, and the block returns. **The durable fix is
  T-046** (the hook wrapper under Cursor + Git Bash), or a deterministic re-strip, for example in
  `~/.claude/hooks/context-mode-cache-heal.mjs`. **Until then, after any context-mode or Grok Build update, re-run the
  test in this section.**
- The one remaining doctor FAIL ("plugin cache integrity", `scripts/` missing) is upstream packaging: neither
  install folder has `scripts/`.

### Record 185 (Composer, `f590448`; mutant `3b63a93`): ACCEPTED at a planner boundary check, written 11:29:50Z

**No QA seat could run** (launching QA needs Aaron, who was asleep), so the planner ran Composer's harness itself,
from `origin/loop/qa-queue-restore`, against `origin/master`'s `qa-queue.ps1` (old), the candidate (new) and the mutant:
- old: `restore_old_untracked_block_expect item2_on_shaA=False` (the bug reproduced);
  `restore_old_locked_generation_expect no_run_and_failed=False`;
- new: `item2_on_shaA=True`; `no_run_and_failed=True`, with `restore_failed=1 run9997=0`;
- mutant (read-back removed): `no_run_and_failed=False`, with `restore_failed=0 run9997=1`. Killed.

The product diff was read: `-Checkout` resolves the SHA, checks out with `-f` and reads HEAD back; the per-driver
restore does `-f`, reads back, logs `restore_failed.<n>` with both SHAs and git's first error line, then aborts. **These
match Composer's reported lines. Its first live round under D-060 had real evidence on first delivery.**

**Two harness defects (round 185b, not blocking the product):**
- **R185-1:** the harness exits 0 when an `_expect` line is False. The mutant run printed `no_run_and_failed=False`
  and exited 0. Anything reading its exit status passes the mutant.
- **R185-2:** `Get-Content` of `queue.log` races the detached queue, which still has the file open. The planner's
  first run died with `IOException … being used by another process`; the second completed.

**Morning:** re-copy `qa-queue.ps1` from `f590448` to both QA machines, clean both QA trees, and relaunch 161+178
(laptop) and 182+183 (QA PC). Each line is Aaron's, dry-run first.

### Record 186 (T-193, cursor-builder / Grok, product `683b61c`, PR #186): ACCEPTED by the planner, written 11:46:01Z

- **Evidence checked:** red `36315913592` at `ea52b80`. Its product is a stub that passes every root, and its test file
  is byte-identical to the final one, so the red is the final rows against the unfixed product. No seeded assertion.
  Green `36316160629`. Mutants on their own branches: any-name `19d5c38` (`36316403690`, only the loop-named row) and
  hard-coded seats `cbfee4a` (`36316497065`). All four conclusions read on GitHub.
- **Code read:** a porcelain parser that refuses unknown keys, with `locked` and `prunable` known; the main checkout is
  exempt; the seat file is `.agents/SYSTEM/worktree-seats.json` (allowlisted); no file is a SKIP; every message
  carries the LIMIT line and the walked count.
- **PR #186 awaits Aaron's merge** (code). On merge, close T-193, and T-149 against it. Relay has the path and format.
- **Its first live run found four stray registered worktrees in SIA's repo**, all in old sessions' temp scratchpads, all
  clean, with nothing unpushed: `…/sia-builder/6a780747…/scratchpad/tip`, `…/sia-infra/f18c4d9e…/scratchpad/tip`,
  `…/sia-planner/9a149231…/scratchpad/wt-iso` and `%TEMP%/sia-r5-probe-e2f`. Removal needs Aaron's word (shared.md).
  QA's second checkout is now `git archive`, never a worktree; seats' scratch probes should follow that too.
- **185b (`78fd6ce`, harness only) ACCEPTED, re-run by the planner at 11:51:42Z:** mutant exit 1 with
  `FAIL_EXPECT restore_new_locked_generation_expect no_run_and_failed=False`; candidate exit 0 (2 passed); old+new
  exit 0 (4 passed, with the old role's reds counted as expected). No log-read IOException in three runs. R185-1 and
  R185-2 are closed. **The QA relaunch copies `qa-queue.ps1` from `78fd6ce`** (the same script as `f590448`).

### Record 187 (candidate B part 2, Grok, product `8c7769f`, PR #187): evidence checked, sent to QA 189, 12:06:53Z

The red commit `043fb8b` adds only the tests to `677c1dd` (no `src/`), so the red is real. Five mutants are product
edits on their own branches, all failed on tcm. Green: 1699 passed. The planner read the schema diff and one test
edit: the shared fixture gained `order: "shown"` because a `met` row without it is now refused. That goes to QA
as a BE-5 question, not ruled by the planner. **QA 189** (`docs/loops/loop-15-slice-3-b2-dispatch-qa.md`, Composer
2.5, a different model from the builder) **launches in the morning with the others.** Laptop order: 189, 161, 178;
QA PC: 182, 183.

## The next day (21:11:36Z), on Aaron's word

- **Merged:** #186 (T-193) as `a1fa4b1` and #188 (record 185/185b) as `b744e19`. The #188 head `ac683f4` adds only
  the handoff over the verified `78fd6ce`. Master tcm CI `36350589982` dispatched. T-193 and T-149 closed (rev 143).
- **Removed** the four stray scratch worktrees, each re-checked clean with nothing unpushed immediately before. SIA now
  has only the main checkout and the six seat folders.
- **QA relaunched on the QA PC only** (the laptop is in use): `qa-queue.ps1` copied from `b744e19` (15,068 bytes,
  SHA-256 `40aea6e28954383c`, read back); queue `189,182,183,161,178` at `9a79ff1`, started 21:10:59Z. The launch
  checkout moved a dirty tree to `9a79ff1`: the record-185 `-f` fix working on a real machine for the first time.
- **The main checkout** (`~/Projects/Self-Improving-Agent`) is still at `ecd28dd`, far behind master. Hooks and the
  MCP server run from it, and T-193 only reaches A2A-Hub once it is updated. Updating it is Aaron's word (T-172, D-050).

### QA 189 (candidate B part 2): ACCEPTED; the planner rules candidate B ACCEPTED (21:20:33Z)

- **QA 189** (Composer 2.5, QA PC, 21:11-21:18Z; `qa/b2-report` `75c2c95`, ending `QA-189: REPORT COMPLETE`): ACCEPTED,
  BE-0 to BE-8 all PASS. On the dispatch's five items:
  - **BE-5.2:** refusing a pre-B `met` row without `order` is what BE-5.2 names, and QA lists every producer and
    fixture it affects.
  - **mut-b** couples BE-2.2 and BE-7.1 by design.
  - **mut-a's** empty and newline ids stay refused by the pattern.
  - **BE-1.3's no-write path** was verified on disk.
  - **BE-7** has no writer.
- **Caveats, not blocking:**
  - QA's own three mutants (`qa/b2-mut-*`) were run LOCALLY, not on tcm, so BE-8's tcm evidence is the developer's
    green `36316975390`.
  - The driver's post-run ref audit recorded `ref_violations=refs/heads/docs/session-100-qa99-dispatch`: a LOCAL
    branch in the QA PC's tree changed, and it no longer exists there. **Origin is untouched** (`5c0af5b`, the planner's
    own push, read back). The report does not say what did it. The audit caught it, as designed.
- **Ruling:** with B part 1 (the G-042 repair) merged as #165, **candidate B is ACCEPTED.** PR #187 goes to Aaron for
  merge. **C (T-155, the shadow merge gate) is next.**

### QA 182 (T-048 r3, `b048df8`): ACCEPT; the planner rules T-048 r3 ACCEPTED (21:28:27Z)

- `qa/t048-r3-report` `6092a99`, ending `QA-182: REPORT COMPLETE`. SILENT 4, SILENT 9 and T048-D1's server half hold,
  and the preserves hold. QA's mutants: five run locally, two confirmed on tcm (`qa/t048-r3-mut-*`).
- **Low, not blocking:** (1) `tests/t048-r3.test.ts` asserts only the corrupt and ran states on the two server score
  routes, not missing or unreadable (the product shares one `invocationLogSuffix`; QA verified all four strings by
  hand). A row per state closes it, in T-048's next touch. (2) The handoff said "server.ts only"; round 3 also
  changes `score-line.ts` (the shared helper), inside scope.
- **Merge order:** `loop/t048-r3` contains r2b (`822f398`), which QA 178 has not scored yet. The r3 PR waits for 178.
- **Recurring ref flag, now a pattern:** QA 189 AND QA 182 both recorded
  `ref_violations=refs/heads/docs/session-100-qa99-dispatch`, a LOCAL branch in the QA PC's tree. Origin is untouched.
  Something in each run (the seat, or the queue's checkout) creates or moves a local branch named after the planner's
  docs branch. **To trace before the next queue:** the QA tree's reflog for that ref, and whether the dispatches' `git
  show origin/docs/...` reads are the trigger.
- **RESOLVED (21:29:03Z): the ref flag was the PLANNER's own pushes.** The QA PC tree has no local
  `refs/heads/docs/session-100-qa99-dispatch` (`git rev-parse --verify` finds nothing; `for-each-ref refs/heads/docs` is
  empty). The driver's audit snapshots origin's ref list (`refs_counted=before=624 after=628`: the remote's branches, the
  4 being the QA branches). The planner pushed `5c0af5b` (about 21:11Z) during QA 189 (21:11:17-21:18:35Z) and
  `9a1bf1e`/`ce787ca` (about 21:22-21:24Z) during QA 182 (21:18:50-21:27:00Z). A true detection with the wrong
  suspect. **Fix, either:** (a) the planner does not push to origin while a QA run is in flight, or (b) the audit names
  WHO moved a ref (committer, or the seat's push log) before calling it a violation. Until (b) exists, (a) is the rule,
  and an audit flag on a planner branch is checked against the planner's push times first.
- **Also seen in the reflog:** QA 183 (running now) checked its candidate out IN the shared QA tree (`16:27:31` local, to
  `a38ff92`, then `qa/t192-report`), as QA 177 did. The record-185 restore now handles it, but the dispatches' "separate
  worktree / git archive" instruction is still not being followed.

### QA 183 (T-192, `a38ff92`): ACCEPT; the planner rules T-192 ACCEPTED (21:34:37Z)

- `qa/t192-report` `1bef8ea`, ending `QA-183: REPORT COMPLETE`. `runs-on`, `ci-status` never-started and the unread cases,
  D-055's `paths-ignore`, and the preserves all hold. QA-only mutants killed on tcm: `36351923059` (`.agents/**` in
  `paths-ignore`) and `36351924217` (egress `if` flipped).
- **Low:** (1) the four-case `evalRunsOn` is enough for today's expression but would not notice new event-specific
  terms. (2) **T192-D1:** when `gh run view` succeeds but the `test` job is absent or its `steps` field is missing (not
  `[]`), `checkCiStatus` says plain `failure` without naming that the steps were not read. It is the 181b class, one
  case further. **Composer's replay (record 184, `887ae4c`) names exactly this case** ("failure (job test absent in run
  view)"). A small follow-up round, not a merge blocker: T-192 fixes the live billing block.
- **PR and pushes held** until the QA queue finishes (the no-push-during-QA rule above). Then: open the T-192 PR for
  Aaron, and push this file.

### QA 161 (/bootstrap r4 reconciled, `d74c0e5`): ACCEPT; ruled ACCEPTED; record 190 sent (21:57:18Z)

- `qa/bootstrap-fix-r4-report` `ac04e7d`, ending `QA-161: REPORT COMPLETE`. R-BF-17 to R-BF-21 hold; all four installs pass
  with no manual fix; five mutants killed on tcm. QA 145's regression rows pass 13 of 15: the two failures pin the pre-r4
  `Next:` wording that R-BF-19 replaced, covered by `bootstrap-fix-r4.test.ts`'s install-N row. Expected, not a defect.
- **Conflicts with master again,** as predicted: importer r6 (#184) changed the same `cli.ts:535` import line. **Record 190**
  (cursor-builder, hub turn after 26): merge `origin/master` into `loop/bootstrap-fix-r4-rec`, resolved to the union of
  `inboxWarning`, `describeDecisionsUnreadable` and `describeLastSession`, proven on tcm. The planner verifies the `--cc`
  hunk and the runs, then opens the PR for Aaron. The accepted behaviour is unchanged; this is mechanical.
- **Record 190 ACCEPTED (22:07:50Z):** merge `d6fec6d` (parents `ade630d` and master `b744e19`), tip `bc738aa` (handoff only). tcm
  `36353805123` success, 1736 passed, with bootstrap-fix-r4 11, state-import-r2 18, r5 22 and r6 3 named. The planner read
  `git show --cc d6fec6d -- cli.ts`: the only `++` (hand-resolved) line is the import union; the draft-summary region is an
  auto-merge with every line from one parent. Clean against `b744e19`. **PR held until QA 178 finishes.**

### QA 178 (T-048 r2b, `822f398`): ACCEPT; the queue finished 22:08:24Z; PRs opened (22:09:54Z)

- The report was committed on the QA PC but **not pushed**: `push-qa.mjs qa/t048-r2b-report` was refused by the Cursor deny
  list ("Command blocked by permissions configuration"), although `push-qa.mjs` pushed the five `qa/t048-r2b-mut-*` branches
  earlier in the same run. **The deny list refused its own sanctioned route**, a Cursor-driver defect for cursor-infra.
  The planner read the report over ssh and saved it verbatim as `docs/loops/t048-r2b-qa-report.md`, with provenance.
- **Verdict ACCEPT:** D1's cli half, D2 to D5 and the D3 survivors are fixed; the three survivors are killed on tcm; `server.ts`
  is unchanged from r2. The planner rules **T-048 r2b ACCEPTED**, so `loop/t048-r3` (r2b + r3, both accepted) can merge.
- This run's audit flag (`loop/bootstrap-fix-r4-rec`) was cursor-builder's record-190 push during the run: the same
  false-positive class as the planner's pushes.
- **Queue summary (QA PC):** 189 ACCEPT (B2), 182 ACCEPT (T-048 r3), 183 ACCEPT (T-192), 161 ACCEPT (/bootstrap r4 rec),
  178 ACCEPT (T-048 r2b). Five of five.

### All four merged; T-192 live; candidate C's criteria dispatched (23:19:02Z)

- **Merged on Aaron's word, in his order:** #189 (T-192) as `2b121d9`, #187 (candidate B part 2) as `c9a7acc`, #190
  (/bootstrap r3+r4) as `d0b63a3`, #191 (T-048 r2b+r3) as `bf33fe4`. Each was CLEAN, with test SUCCESS, and clean
  against the master left by the one before.
- **T-192's post-merge acceptance read:** master push runs now carry the `self-hosted,linux,tcm` labels. Run
  `36358116586` (`2b121d9`) ran on **tcm-2**, and `36358133855` (`c9a7acc`) on **tcm-1**. Master's CI works again.
- Aaron: "laptop and qa pc are available for ci". A `windows=true` run on master `bf33fe4` was dispatched to the laptop:
  `36358221545`.
- **QA 191, candidate C's criteria:** `docs/loops/loop-15-slice-3-c-criteria-dispatch-qa.md`, with its driver in `qa-191/`.
  It carries B's Open 3 (does an attributed `met` count as met?), R10(c)/(d) as verdict rows, and R2's now-binding `E_t`
  obligation. Launch on the QA PC.

### The main checkout updated to master (T-172's step), on Aaron's word (23:21:49Z)

- `~/Projects/Self-Improving-Agent`: clean, detached `ecd28dd` → `bf33fe4` (303 behind). Build stamped `bf33fe4`;
  build-freshness PASS, worktree-layout PASS (7 worktrees, its first main-tree run), state-schema PASS. The recall-trigger
  hook smoke test on the new build: rc 0.
- **Trap, hit and recovered:** `npm ci` failed with `EPERM unlink …better-sqlite3/build/Release/better_sqlite3.node`. The
  native module is LOCKED by every running open-brain MCP server (one per open Claude session), and `npm ci` had already
  deleted most of `node_modules` (8 entries left). **For about 1 minute, hooks loading from the main tree could fail.**
  Recovered with `npm install` (no wipe; the lockfile's better-sqlite3 was unchanged): 172 packages, then `npm run build`.
  **Rule: in the main checkout, use `npm install`, never `npm ci`, while any Claude session is open.** It belongs in
  T-172's "one refusing command".
- **Running sessions still use their old in-memory MCP server** until `/mcp` reconnects open-brain. New sessions get the new
  build.

## Records 192-194: three follow-up rounds from today's findings (the common rules at the top of this file apply; the evidence rules in `.agents/roles/developer.md` bind every round)

### Record 192, `cursor-infra` (Composer 2.5): two Cursor QA-driver defects

**Branch** `loop/qa-driver-cursor-r2` from `origin/master`. Stubs only, on this desktop, hidden, local bare repo. Never touch
a QA machine or `%USERPROFILE%\Worktrees\sia-qa`. Handoff: `docs/loops/qa-driver-cursor-r2-developer-handoff.md`.
1. **The sanctioned push route was refused.** In QA 178 (QA PC, 2026-09-27 ~22:00Z), `node docs/loops/qa-178/push-qa.mjs
   qa/t048-r2b-report` was denied, "Command blocked by permissions configuration" (drive.meta `denial=…`; report
   `docs/loops/t048-r2b-qa-report.md`, "Report branch push"). Earlier in the same run, `push-qa.mjs` pushed five
   `qa/t048-r2b-mut-*` branches. **Find which deny pattern matched which command form** (the seat's exact command is in
   its stream-json transcript on the QA PC, but you cannot read it: reproduce the form with stubs). **Make the sanctioned
   route pass in every form a seat plausibly uses** (plain, `cd … &&`, through PowerShell), while every push form stays
   denied. Rows: each form, pass and deny, against the real `cli.json`.
2. **The ref audit blames the QA seat for other seats' pushes.** `ref_violations` fired on the planner's branch (QA 189,
   182) and on `loop/bootstrap-fix-r4-rec` (QA 178), all moved by OTHER seats' legitimate pushes mid-run (traced in this
   file, "RESOLVED"). **Attribution rule to implement:** a QA seat can push only commits that exist in its own repository.
   So a ref that moved on origin to a SHA the QA tree did not have before its own post-run fetch was moved by someone
   else. Report it as `ref_moved_elsewhere`, not `ref_violations`. State the rule's limit in drive.meta. Rows: a stub
   "other seat" push mid-run (not a violation), a stub seat push outside `qa/<prefix>-*` (a violation), and a mutant
   that drops the attribution.

### Record 193, `cursor-builder` (Grok 4.7): two small gaps QA found

**Branch** `loop/t192-d1` from `origin/master`. tcm, at most 6 runs. Handoff: `docs/loops/t192-d1-developer-handoff.md`.
1. **T192-D1** (QA 183): when `gh run view` succeeds but the `test` job is absent, or its `steps` field is missing (not
   `[]`), `checkCiStatus` says plain `failure`. Name each case ("steps not read: job test absent" / "steps field
   missing"). Record 184's replay already names "job test absent in run view"; match its wording where it fits.
2. **T-048 r3 test gap** (QA 182): `tests/t048-r3.test.ts` asserts only the corrupt and ran states on the two
   `server.ts` score routes (`handleSync`, `handleScore`). Add the missing and unreadable rows. Product unchanged unless a
   row goes red; if one does, that is a finding: report it.
Red first on the real rows against `origin/master`; one mutant per item on its own branch.

### Record 194, Grok (`sia-forge`): T-046's detector, so this morning's incident announces itself

**Why:** at 09:48Z a Grok Build self-update pulled context-mode 1.0.169, whose plugin `hooks/hooks.json` registers
PreToolUse for Bash/Read/Grep/WebFetch/Agent/`mcp__`. Cursor CLI imports Claude plugin hooks and runs them through a
PowerShell wrapper executed by bash (T-046), so every Cursor tool call failed closed. The fix (PreToolUse stripped from
the plugin cache) is **not durable**, and nothing detects it coming back. This file, "Incident".
**Do (branch `loop/t046-detector` from `origin/master`):** a `/sync` check, `cursor-hook-compat`:
- Read `~/.claude/plugins/installed_plugins.json` (parser, never a pattern). For each installed plugin's `installPath`,
  parse `hooks/hooks.json`.
- If a `PreToolUse` entry exists AND Cursor CLI is installed (`%LOCALAPPDATA%\cursor-agent` exists), it is an ISSUE,
  naming the plugin, the version, the matchers, and T-046, with the one-line remedy.
- No registry, or no Cursor CLI: a SKIP that says why, never a PASS. State the limit: it checks config, not whether Cursor
  actually runs the hook.
- The check reads the real files under the user profile. Tests use a fixture home, never the real one (G-044).
- Rows red against `origin/master`; mutants on their own branches: ignore PreToolUse; treat no-Cursor as PASS.
- **Do not edit anything under `~/.claude` or `~/.cursor`.** This round is detection only. The preventer (the
  cache-heal hook) is Aaron's config.
tcm, at most 6 runs. Handoff: `docs/loops/t046-detector-developer-handoff.md`.

## HANDOFF TO THE NEXT PLANNER (record session 147 rolls here, 2026-09-27T23:25Z). Read this section first.

**Why it is here and not in the record's handoff slot:** Aaron reconnected `/mcp` onto the new build, and T-003 then
correctly refused `set_handoff` and `ob_set_session` for this session. It started before the build, so its SessionStart
hook wrote no session proof (`by-pid/15644.json` absent). The record's slot still holds rev 142's handoff; **this
section supersedes it.** First act next session: `ob_set_session`, then write this handoff into the record.

**State:**
- **Loop 15 slice three:** A MERGED (#182); B MERGED (#187, QA 189 ACCEPTED). **C (T-155) is next:** QA 191 (C's criteria)
  is written and dry-run on the QA PC, **awaiting Aaron's launch** (`-Queue 191 -Checkout d8166b6bbb1a6493a9e219096fa4b88bf68f6165`,
  in `qa-launch.md`'s QA PC form). Then rule the criteria, then brief C's build.
- **Merged today:** #186, #188, #189, #187, #190, #191. Master `bf33fe4`. **Master push CI runs on tcm** (T-192 verified on
  tcm-2/tcm-1). **The main checkout is at `bf33fe4`, rebuilt**; build-freshness PASS.
- **In flight:** record 192 (cursor-infra, Composer: the Cursor QA driver's push-route refusal and ref-audit attribution);
  record 193 (cursor-builder, Grok: T192-D1 and T-048 r3's server rows; READ, working); record 194 (Grok/sia-forge: the
  T-046 `cursor-hook-compat` detector). **At 23:24Z Grok had not read 193-194, and infra had not read 36-37;** Aaron has
  nudge lines. Review every delivery's diff and failed logs (D-060).
- **A `windows=true` CI run on master** (`36358221545`, laptop) was in progress. Read its result.

**Watch out:**
- **No planner push while a QA run is in flight** (the audit reads origin's refs). Record 192 fixes the attribution.
- **Main checkout: `npm install`, never `npm ci`,** while sessions are open.
- **After any context-mode or Grok Build update, re-test Cursor CLI** (T-046); record 194 is the detector.
- **Pre-upgrade sessions** show a non-blocking "UserPromptSubmit hook error … 1.0.22/hooks/userpromptsubmit.mjs". A restart
  or `/reload-plugins` fixes it.
- **Cursor seats' `--wait` lapses after about 1 h.** Check `/a2a/agents/live` and `/reads` before asking Aaron to nudge.
- **Derive every time and count from its source.**

**Open:** Telegram approval (D-058) is on HOLD by Aaron. QA seats keep checking candidates out in the shared tree; a
driver-level guard may be worth a round.
- **Update 23:28Z: QA 191 LAUNCHED** by Aaron (QA PC pid 12704; queue `start=queue=191` at 23:27:51Z, `head=d8166b6`). All
  three dev seats had read their turns (Grok 194, infra 37, builder 30) and were working. **This commit is LOCAL and
  unpushed** (the no-push-during-QA rule). The next planner pushes it once QA 191's log shows `end=queue finished`.
- **Windows CI on master `bf33fe4`** (`36358221545`, laptop-win): **1 failed**, 1723 passed. Linux on tcm-2: 1799 passed.
  The failure is `tests/harness/qa104-a9-probe2.test.ts`, "QA 104 probe 2 (not for merge)":
  `EPERM … symlink` under the runner's NetworkService account (no symlink privilege). **Two findings for the next
  planner:** (1) a QA probe test marked "not for merge" reached master with candidate A's branch history. Find every
  `qa*-probe*` / "not for merge" test on master, and decide to remove it or keep it as a real row. (2) Any symlink test
  must skip on Windows `EPERM` or the runner needs the privilege. A small developer round (cursor-builder), and a `/sync`
  check for "not for merge" test files is worth considering.
- cursor-infra read record 192 (turn 37) and went idle without replying; Aaron was given an "act now" line.

## Planner session 11 (worktree counter), hub round-up, 2026-09-28T00:09Z

All three dev rounds were delivered over the hub. The planner read back each branch with ls-remote and each run id with gh run view. None is ruled. All three go to the QA queue.

- **Record 194** (T-046 detector, Forge/sia-forge): PR #192. Product 3af41f5, tip 44d672a. Green run 36359225675, red run 36359225141, mutants 36359226699 and 36359228066.
- **Record 193** (T192-D1 + T-048 r3, builder/sia-builder): PR #193. Product ecd378d, tip 9d449f4. Red run 36358778248, green run 36359004908, mutant run 36360002881 (routes). The builder named mut-score as too wide, and it does not count.
- **Record 192** (Cursor QA driver r2, infra/sia-infra, Composer): PR #194. Tip 462403d; product unchanged since 997f2c7. The first delivery was sent back, because its mutant was run under a flag that flips the expectation (it printed PASS), its attribution red was asserted rather than run, and the source of the denial was unstated. The amendment adds FAIL with exit 1 for the ordinary harness on mutant e385f0d, FAIL with exit 1 on bf33fe4, and the denial read from real cursor-agent stream-json (session b64479fb).

## Records 198-200: idle-seat rounds while QA 195-197 runs (2026-09-28, Aaron: "Is there anything the devs can do, they are idle")

**Common to all three:** branch from `origin/master` (`bf33fe4`). The evidence rules in `.agents/roles/developer.md` bind every round (D-060): red on the real rows first, one mutant per item on its own branch, and quote the failing line and exit code of every red and mutant. **HOLD every push and every tcm dispatch until the planner posts that the QA 195-197 queue has ended.** The running QA drivers still charge any mid-run push by another seat to the QA seat as `ref_violations` (record 192 fixes this, but it is not in these drivers), and QA 196/197 need tcm. Build and test locally until then. Then push and run tcm, at most 6 runs. The planner rules on each delivery.

### Record 198, `cursor-builder` (Grok 4.7): QA probe tests reached master

The Windows CI run on master `bf33fe4` (`36358221545`) failed on `open-brain/tests/harness/qa104-a9-probe2.test.ts` with `EPERM … symlink` (the runner has no symlink privilege). That file, and `qa104-a9-probe3.test.ts`, are QA probes marked "not for merge" that arrived with candidate A's history. `open-brain/tests/pipelines/state-import-qa138.test.ts` is in the same family.
1. For each QA-named test under `open-brain/tests/`: remove it, or keep it as a real row with a name and header that say what it guards, and say why. Nothing under `open-brain/tests/` may still say "not for merge".
2. Every symlink-creating test skips on Windows `EPERM`, and says so in its skip reason (never a silent pass).
3. A detector: a test or `/sync` check fails when a file under `open-brain/tests/` contains "not for merge". Validate it against a known positive (a fixture) and a known negative.
`docs/loops/qa-scripts-*` are archives and are out of scope. Handoff: `docs/loops/qa-probes-on-master-developer-handoff.md`. Branch `loop/qa-probes-on-master`.

### Record 199, Grok (`sia-forge`): T-150 + T-185, an unknown flag refuses

`open-brain/build/cli.js` subcommands silently ignore an unrecognised flag, and some take the first non-`--` token as their directory, so a mistyped dry-run flag runs the MUTATING default (`sync --check-only`, `detach -dry-run`, `state migrate -dry-run`; see T-150 and T-185's notes, and `docs/loops/importer-fixes-r2-developer-handoff.md` for the list).
1. Every subcommand refuses an unknown `-x` or `--xx` token before doing anything. It exits nonzero, names the token and lists the accepted flags. Tests fail if the command wrote anything at all.
2. A positional that starts with `-` is never taken as a directory.
3. Preserve: every documented flag and form works unchanged, and the existing tests stay green.
Rows per subcommand: a `-dry-run`, a `--check-only` and a `--bogus`, each refused with no write. Mutants: accept unknown flags; take a `-` positional as a directory. Handoff: `docs/loops/t150-unknown-flags-developer-handoff.md`. Branch `loop/t150-unknown-flags`.

### Record 200, `cursor-infra` (Composer 2.5): T-176, the index check measures one direction

`/sync`'s `gitnexus-index` compares the indexed SHA to HEAD in one direction only, so an index built on a different line of history (neither an ancestor nor a descendant of HEAD) reads as current or near-current.
1. Report ahead, behind and diverged distinctly. Diverged, and an indexed SHA that is not in this repository, are each an ISSUE that names both SHAs, never a PASS.
2. Preserve: an index at HEAD is PASS; a tree with no `.gitnexus` stays SKIP with its reason; `--check` stays read-only.
3. Tests build real throwaway git repos (never this repo's history), with a fixture `meta` for each case.
Mutants: diverged read as behind; an unknown SHA read as PASS. Handoff: `docs/loops/t176-index-direction-developer-handoff.md`. Branch `loop/t176-index-direction`.

## QA 195-197 ruled (queue ended 04:01:05Z; ruled 2026-09-28)

The planner read the Step-Back artifact (claude.ai/artifact/3Kv8BuKYrj5vaKQgD8NKC7) before ruling, on Aaron's instruction. Its rule applies: QA validates the frozen commit against the requirements, never against the developer's claim.

- **QA 196 (record 193, `ecd378d`): ACCEPT. The planner rules record 193 ACCEPTED.** `qa/t192-d1-report` `60c5d82`. Two low findings, not blocking: duplicate `test` jobs resolve with `.find()` (first match wins), and a non-empty `steps` of unreadable entries (`[null]`) reads plain `failure`. They go in the next `ci-status` touch. PR #193 is CLEAN at `9d449f4`, and goes to Aaron to merge.
- **QA 197 (record 194, `3af41f5`): ACCEPT. The planner rules record 194 ACCEPTED.** `qa/t046-detector-report` `c3e5ce9`. Low finding D1: a registry entry with a missing `installPath` reads PASS without having read a hook file. A plugin with zero installs, or no `hooks.json`, is correctly a pass: nothing is there to register a hook. A missing `installPath` is unreadable input and should be a SKIP or an ISSUE (shared.md: "skip is not pass"). It is a follow-up row, not a blocker, because the incident shape is detected. PR #192 is CLEAN at `44d672a`, and goes to Aaron to merge. T-046 closes on merge.
- **QA 195 (record 192, `462403d`, GPT-5.6 Sol): REJECT. The rejection stands.** `qa/qa-driver-r2-report` `dc9eee0`. This is the dangerous direction that dispatch item 4 asked QA to look for. `KnownShasAtStart` is snapshotted before the run, so a commit the QA seat creates DURING the run is unknown to it. If the seat moves a non-`qa/` ref to that commit, the move reads `ref_moved_elsewhere`, not `ref_violations`. QA reproduced this against the candidate's own `Audit-NonQaRefs`. The developer's seat row used the seed SHA, so it could not catch it. Also: the claimed `cd … &&` pass row is not in `$passForms`. It is returned to `cursor-infra` as record 192 r3, and PR #194 stays open and unmerged.

## Records 205-207: overnight rounds (2026-09-28, Aaron going to bed: "any work we can send the devs before I do?")

**Common to all three:** local only. **HOLD every push until the planner posts that QA 202-204 has ended**, because the running drivers still charge another seat's mid-run push to the QA seat. D-061: no CI of any kind; quote each local run's failing lines and exit codes. Mutants go on their own branches and pass `tsc --noEmit` first. Branch from `origin/master` `d1e8674`.

### Record 205, `cursor-builder` (Grok 4.7): T-178 (P0), CI runs automatically on push to seat branches

This is HoH's runtime step (D-061): a push to a seat's working branch runs the suite on tcm, so no seat dispatches CI by hand. Settle the two items in T-178's note: **(a) no double run** when a branch also has an open PR (a concurrency group per branch with cancel-in-progress, or any equivalent you can show); **(b) a docs-only push starts no run**, the same as D-055's `paths-ignore` for PRs. Cover `loop/**` and `qa/**` (QA mutant branches included). `master`, `workflow_dispatch` and its inputs are unchanged, and `windows` stays opt-in. **Evidence:** you cannot run GitHub's trigger locally. Extend the existing `ci-runs-on.test.ts` approach (a parsed `ci.yml`, never a regex) with rows for each trigger and filter, red against master's `ci.yml`, and one mutant per item. State the limit: the first real push after merge is the live test, and QA or the planner observes it. Handoff `docs/loops/t178-ci-on-push-developer-handoff.md`, branch `loop/t178-ci-on-push`.

### Record 206, Forge (Grok 4.7, `sia-forge`): idea B scoping, READ-ONLY

This does not start the module-boundary loop: that is Aaron's ruling, and the record's next slice after C is Jev calibration. It is the measurement that loop would need first (Step-Back idea B; T-154; G-030): **what happens when a stranger installs core with only Node and git.** In a temp directory with a throwaway `HOME`/`USERPROFILE` (never the real profile, `~/.claude` or any live DB), clone `origin/master`, follow README.md's install steps literally, and try `/start`'s path: the SessionStart hook (`cli-bootstrap`) and `ob_start`'s CLI equivalent, if one exists. Record every step that fails, needs something not in the README (Obsidian, a vault, an MCP server, a DB), or silently degrades. For each, name the file and line that causes it, and whether memory is the reason. **No product change.** Write `docs/loops/idea-b-stranger-install-probe.md` on branch `docs/idea-b-probe`.

### Record 207, `cursor-infra` (Composer 2.5): QA 197's D1, `cursor-hook-compat` must not pass without reading

A registry entry with a missing or empty `installPath` makes `cursor-hook-compat` report PASS without reading any hook file. Make that case a SKIP or an ISSUE that names the plugin and says the check could not read it. Zero installs, and an install whose `hooks/hooks.json` is absent, stay PASS: there is nothing that could register a hook. Rows: missing `installPath`, empty `installPath`, and an `installPath` that does not exist on disk, each red against master. Mutant: treat a missing `installPath` as PASS. Fixture home only (G-044). Handoff `docs/loops/t046-d1-developer-handoff.md`, branch `loop/t046-d1`. Record 200 stays committed locally and unpushed until the release.

## Laptop queue 208-209, launched while QA 202-204 runs (2026-09-28, Aaron: both QA machines available; he waited to launch)

- **Push exception, the planner's call:** infra pushed records 200 and 207, and the planner pushed this branch, while QA 202-204 was running on the QA PC. The running drivers (the old template, before 192 r3) may list these as `ref_violations`. They are traceable by SHA: `loop/t176-index-direction` `8d3143c` (mutants `08f9176`, `aca9911`), `loop/t046-d1` `a8adca0` (mutant `4686eee`), and this branch's own tip. Rule them out by those SHAs when ruling 202-204.
- The laptop's `qa-queue.ps1` was re-copied from `b744e19` and read back: 15,068 bytes, SHA-256 prefix `40aea6e28954383c`, identical to the QA PC's copy. Its QA tree was at `fc8d8cd` with 11 dirty paths; the queue's record-185 checkout handles that.
- **Record 205 (T-178) was returned to the builder:** its `push.paths-ignore` also filtered master, against D-055, and its cancel-in-progress also cancelled master runs. Master stays unchanged. It goes to QA in the morning.

## QA 208-209 ruled (laptop queue ended 07:10:02Z)

- **QA 208 (record 200, T-176, GPT): ACCEPT. Record 200 is ruled ACCEPTED.** `qa/t176-report` `9b56409`. The evidence file is present, and `validate evidence` exited 0. At HEAD is PASS, behind is WARN, and ahead, diverged or unknown is an ISSUE naming both SHAs. A dead recorded branch does not override a current SHA.
- **QA 209 (record 207, T-046 D1, GPT): ACCEPT. Record 207 is ruled ACCEPTED.** `qa/t046-d1-report` `f41d310`. The evidence file is present and validated. QA split the developer's combined red into three independent rows (`qa/t046-d1-tests` `0081dab`), because the combined row stopped at its first assertion.
- **The first two E_t.json files a QA seat has written** (C's criteria §8 P1). Infra opens the PRs, and Aaron merges.
- **Record 205 r3** (T-178, `bc6c6d2`, local): it now fails closed (`git diff before..sha`, and any error runs the suite), and master is unchanged. It goes to QA in the morning.

## QA 202-203 ruled (QA PC; 204 still running)

- **QA 202 (record 192 r3, GPT): REJECT, which stands, on the EVIDENCE ONLY.** `qa/qa-driver-r3-report` `68ac9db`, E_t present. The product `d67c5e7` fix is confirmed: direct, amended, cherry-picked and other-worktree mid-run commits all read `ref_violations`, a different clone's push reads `ref_moved_elsewhere`, and every push form behaves correctly through real `cursor-agent`. The defect is in the harness: on Git 2.55 its bare fixture has no `HEAD` pointing at `refs/heads/seed`, a clone warning becomes fatal under `ErrorActionPreference=Stop`, and the mutant run exits 1 before the seat-new row, which is red for the wrong reason. Returned as **record 192 r4, harness only**.
- **QA 203 (record 198, Composer): ACCEPT. Record 198 is ruled ACCEPTED**, read from the QA PC's LOCAL commit `120dc44` on `qa/qa-probes-report` (report plus E_t.json). **The QA seat's push through `push-qa.mjs` was refused** ("Command blocked by permissions configuration") after `qa/qa-probes-red` had pushed. That is the QA-178 defect record 192 fixes, reproduced on the old driver. Its report and its two mutant branches (`qa/qa-probes-mut-selfphrase` `aac214d`, `qa/qa-probes-mut-symlink-bypass` `3081527`) exist only on the QA PC. **The planner did not push them:** clearing another seat's permission denial by acting from outside is permission laundering. Aaron decides. QA 203's run also left the shared QA tree at `120dc44`, and the queue restored it before 204 (`head_moved.204`).

## QA 204 ruled: candidate C REJECTED (the queue ended 07:12:16Z)

- **QA 204 (candidate C `2035e89`, GPT): REJECT. The rejection stands.** `qa/c-report` `b16d5b5`, E_t present. Blockers: C-204-1 (CC-6: `inputs` omits the acceptance and gate summaries, no schema test, and the path differs); C-204-2 (CC-10: `--replaced` can record a null SHA, and a bare `--replaced` silently records `declined`); C-204-3 (CC-13: `{}` passes, `line_hash` is optional and removable, and only line counts are compared). Majors: C-204-4 (CC-18: an unreadable `--evidence` exits 1 instead of writing an `undefined` artifact) and C-204-5 (CC-20: `summary --bogus` exits 0, and an invalid `--gate` silently becomes `skip`). Rows with no asserting test: CC-0, CC-10, CC-13 and CC-19. CC-29 and CC-30 (§8) are met.
- **Criteria §9 (P5)** corrects CC-6's path for the NEXT candidate only (`<loop>/<candidate_sha>/`). It does not reopen `2035e89`.
- **Slice three stays open.** C goes back to Forge as record 201 r2.
- **Record 192 r4** (harness only, `0f816bb`): the mutant now fails ON the seat-new row. It is queued for QA.

## MORNING (supersedes the record handoff's launch line): three QA runs, two machines, checkout `1affe9d`

Forge delivered **candidate C r2** overnight: product `8054f9f`, tip `09a517f`, and five mutants, one per C-204 finding. The QA 212 dispatch (GPT) is at `1affe9d`, and that commit also carries QA 210 and 211.
- **QA PC: `-Queue 212`** (candidate C r2, which closes slice three).
- **Laptop: `-Queue 210,211`** (192 r4 harness; 205 r3 CI on push).
Both machines were idle at the last check. Both lines use `-Checkout 1affe9d819ebd59be6ea21630eb3edd2784562cf`.

## Laptop queue 212, 210, 211 ruled (ended 21:11:13Z)

- **QA 212 (candidate C r2 `8054f9f`, GPT): REJECT. The rejection stands.** `qa/c-r2-report` `2ffece8`, E_t present. All five C-204 findings are closed, and tcm is green. The one remaining defect is CC-6: `prepare` accepts a non-SHA candidate id and writes `artifacts/iterations/t001/bad/shadow_merge.json` with `candidate_sha: "bad"`. Returned as **record 201 r3**: validate every SHA input before any write.
- **QA 210 (record 192 r4 `0f816bb`, GPT): REJECT. The rejection stands.** `qa/qa-driver-r4-report` `f94a79d`. The fixture repair works; but on the LAPTOP the sanctioned `cmd /c` route gave `denial=False moved=False` twice, where QA 202 on the QA PC saw it work. Returned as **record 192 r5**: diagnose whether the environment or the route is at fault, and state which.
- **QA 211 (record 205 r3 `bc6c6d2`, Composer): ACCEPT. Record 205 (T-178) is ruled ACCEPTED.** `qa/t178-report` `2f222fc`, E_t present. The live pushes (`qa/t178-live-code` `05d31f6`, `qa/t178-live-docs` `1497149`) confirmed GitHub's trigger. The builder opens the PR, and Aaron merges.
- The laptop was unreachable on port 22 once (a connect timeout, with Tailscale active and ping at 5 ms), and reachable a few minutes later. It was probably waking from sleep.

## #196, #197 and #199 merged on Aaron's word ("merge all"); #199 broke master and PR CI

- Merged, each CLEAN and pinned with `--match-head-commit`: #196 as `89ddb96`, #197 as `949a33b`, #199 as `8467cb1`. #198 is DIRTY (it conflicts with master); the builder merges `origin/master` into it and resolves.
- **REGRESSION from #199 (record 205, T-178): master run `36485372110` (`8467cb1`, push) SKIPPED every job.** `test` has `needs: changed`, and `changed`'s `if` skips it on master and on `pull_request`. GitHub auto-skips a job whose needed job was skipped unless the dependent job's `if` contains a status function (`!cancelled()`, `always()`), so `test`'s own expression never runs. **Master and PR CI run no tests from `8467cb1` on**, until the fix merges.
- **Why every instrument missed it:** the developer's rows evaluated the `if` expression in isolation; QA 211's live pushes were seat branches, where `changed` runs; and the planner's dispatch item 3 ("master unchanged") was checked by expression, never by a live master run. The class: a check that evaluates the configuration while the platform applies a rule the evaluator does not model. A live run on the path in question is the only instrument. The planner's dispatch named a live test for seat branches only, and that is the planner's miss.
- **Fix:** record 205 r4 on `loop/t178-fix-needs`, proven by its own PR run showing `test` RUNNING before any merge.

## STATE AT VS CODE RESTART (planner session 11 ends here; the next planner starts from this section)

- **PR #200** (`loop/t178-fix-needs` `367936c`, record 205 r4): it fixes #199's master/PR skip (`test` gains `!cancelled()`). Its own PR run `36486143303` is **success, with `test` RUN**, the live proof. **Awaits Aaron's word to merge.** Until it merges, master and PR CI run no tests (from `8467cb1` on).
- **PR #198** (record 198, ACCEPTED): conflict resolved by merge commit `1c2fbb1` (only `sync/index.ts`; both checks kept; the planner checked the diff). Merge it on Aaron's standing "merge all" AFTER #200 merges and #198's own PR run shows `test` ran green.
- **QA 213** (candidate C r3, product `20c2dfd`, tip `5f7c9a0`, GPT): the dispatch is at `db8edc7`, awaiting Aaron's launch line (laptop: `-Queue 213 -Checkout db8edc74599802b97e3aef00f58419157f6dbe61`). If it ACCEPTs, slice three closes: run `shadow-verdict prepare` on QA 213's E_t BEFORE Aaron merges #195, and `decide` after (criteria §8 P4).
- **Infra, record 192 r5** (diagnose the laptop `cmd /c` route, `denial=False moved=False`): in progress, and it will post in room `k5702788…` when done. The first `--wait` a new planner runs may deliver it.
- **Forge and builder: idle.** Forge's last turn was C r3; the builder's was #200.
- **Still open for Aaron:** QA 203's report stranded on the QA PC (local `120dc44`), and Telegram (D-058, on hold).
- Listener PIDs and watchers die with the session. Re-arm one `hub-talk --as atlas --session <room> --wait --wait-timeout 3500` per room: builder `k57098epn7qz32vt0cazfjpbes8f6kdq`, forge `k57frxw0ptb8tadmqdwy0khhks8ey006`, infra `k5702788wctxj75begyt4x2k5x8f6mav`.

## Planner session 149 (record number; the greeting showed #12): record caught up, T-194 and T-195 opened and dispatched

- **Rev 148:** the handoff now carries the restart state above, plus three things found live. #199 means master/PR CI runs no tests. #200 is UNSTABLE, not CLEAN, because push run `36486110602` was CANCELLED; its PR run `36486143303` passed with `test` RUN. And the rev-147 handoff was older than this file.
- **Rev 149: T-194 (P0) and T-195 (P0) opened**, on Aaron's word relayed by a general session (`worktrees-d5`). The quote and both links are in T-194's note and in the brief. **Neither task is part of slice three, and D-036 is not amended.**
- **Brief:** `docs/loops/t194-t195-dispatch.md`. **Record 214** (T-194, the planner seat hook) goes to `cursor-builder`; **record 215** (T-195, a D_t plus the plan gate for interactive briefs) goes to Forge. If QA 213 rejects C r3, C r4 takes precedence on Forge.
- **A near-miss, recorded by family:** the planner first read the harness facts (`cli.ts` subcommands, gate exports) from this seat tree, which is 216 commits behind `origin/master`. There they showed no `validate` subcommand at all. The peer's claim that `validate evidence` exists was correct at `8467cb1`. The brief cites master only.
