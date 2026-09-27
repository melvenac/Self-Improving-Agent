# QA calibration on A12: one dispatch, two Cursor QA seats (records 163 Composer 2.5, 164 GPT-5.6 Sol)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Asked for by Aaron:** can a Cursor model do SIA's QA, so
Claude's weekly usage lasts? **This is a measurement.** A12 has already been scored by a Claude QA seat. Your report is
compared against that scoring, which is known to the planner and withheld from you.

**You are one of two seats** working the same dispatch independently:
- Composer 2.5, record 163, in `~/Worktrees/sia-qa-composer`, hub name `cursor-qa-composer`;
- GPT-5.6 Sol, record 164, in `~/Worktrees/sia-qa-gpt`, hub name `cursor-qa-gpt`.

Do not read or contact the other seat.

## The one rule that makes this a measurement: stay blind

**Do NOT read any of these.** Each would give you another scorer's answer:
- QA 149's report or any `qa/loop-15-slice-3-a12-*` branch;
- `docs/loops/loop-15-slice-3-rulings-21.md` or `docs/loops/loop-15-slice-3-dispatch-qa-a12.md`;
- anything about candidate **A13** (`loop/15-slice-3-candidate-a13*`, its handoff, its commit messages);
- `docs/loops/planner-session-146-notes.md`;
- the other calibration seat's branches or room.

**List every file and ref you read in the report's first section.** Reading one of the above by accident does not end
the run: say so plainly, and the planner discounts what it could have told you.

## Where you run, and the limits (Aaron's desktop, while he uses it)

- **Every test and probe runs on tcm through CI, never locally.** No local full suite, no local `vitest`, no local
  build. Reading files, `git` and `tsc --noEmit` on single files are fine. Dispatch CI with:
  `gh workflow run ci.yml --ref <your qa branch>`, leaving the `hosted` and `windows` inputs false. Read results per
  test with `gh run view <id> --log`. **At most 8 runs.**
- **Scratch:** make a worktree for the candidate under your own worktree's parent, e.g.
  `git worktree add --detach ../sia-qa-composer-cand 7200e1c`.
- **Push ONLY through `node docs/loops/qa-163/push-qa.mjs <branch>` (Composer) or `node docs/loops/qa-164/push-qa.mjs <branch>`
  (GPT).** Each refuses any branch outside `qa/cal-a12-composer-*` / `qa/cal-a12-gpt-*`. Never `git push` directly,
  never master, never a tag or PR, never another seat's branch.
- **Never** open a visible window: no `Win32_Process Create`, no `Start-Process` without `-WindowStyle Hidden`. Never
  write any `state.json`. No `/end`.

## The candidate

- **Product `7200e1c`**, frozen with its handoff at **`a69f07d`** on `origin/loop/15-slice-3-candidate-a12`.
- Built by Grok 4.7 in Cursor, from A11 `bbf9d07` merged with master (`afe1c3b`).
- The product diff against `afe1c3b`: `open-brain/src/harness/configwatch.ts` (+22 −3) and
  `open-brain/tests/harness/configwatch-a12.test.ts`.
- The developer's handoff is `docs/loops/loop-15-slice-3-a12-developer-handoff.md` on that branch.
- **CI on tcm, as the developer reports it:** red `36283323236`, green `36283457438`. CA-9 fails on every tcm run
  (T-182) and is not A12's.

## Score NARROWLY: `docs/loops/loop-15-slice-3-rulings-20.md`

Score R90, R91, R92, R93 and R94, the re-done R85 search, QA 130's known positives, and regressions on QA 130's row
set. QA 130's rows are on `qa/loop-15-slice-3-a11-probe` (`5564ef6`); QA 130's report is
`origin/qa/loop-15-slice-3-a11-report`, and you may read it.

1. **Each ruling R90–R94 against its known positives** from rulings 20. Re-run them byte-exact.
2. **The R85 search:** check the handoff's table against your own search of `configwatch.ts`. For each site that
   builds a side's text, what does it print, and **what does the whole change record then cause downstream:** the
   summary message, `unrestored`, and whether the runtime stops before git (R77)? Trace the effect, not only the text.
3. **Regressions:** QA 130's full row set at the candidate.
4. **Your own mutants,** at least one per ruling, run on tcm.
5. **Defects:** anything that breaks a ruling's words, including rulings older than R90 that A12's change could reach
   (R77 among them). For each defect: a row, a run id, and the exact output.

## The report

- **Path:** `docs/loops/cal-a12-composer-qa-report.md` or `docs/loops/cal-a12-gpt-qa-report.md`. Commit it to
  `qa/cal-a12-composer-report` or `qa/cal-a12-gpt-report`, and push with your `push-qa.mjs`.
- **Order:**
  - **what you read** (every file and ref);
  - the verdict (ACCEPT or REJECT) first among the findings;
  - each check, with run ids;
  - defects with severity;
  - what could not be verified;
  - your error entries;
  - **your model**, as Cursor shows it.
- **The LAST line is exactly `CAL-163: REPORT COMPLETE` (Composer) or `CAL-164: REPORT COMPLETE` (GPT).**
- **Then post the report's path and SHA on the hub:** `HUB_URL=http://100.124.212.87:4000 node C:/Users/melve/Projects/A2A-Hub/scripts/hub-talk.mjs --as <your hub name> --peer atlas --say "..."`.
  Your first run of that command creates your room with the planner. After that, run the same command with
  `--wait --wait-timeout 3500` in place of `--say`, and act on the planner's reply.
