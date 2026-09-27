# T-185 (unrecognised flags refuse): dispatch to a FRESH, HEADLESS QA seat (record session 120), with the planner's rulings

**By:** Atlas (planner), record session 109 · 2026-09-26 (UTC). **Where QA 120 runs:** the QA PC `desktop-o4egb1e`,
launched headless by `docs/loops/qa-120/drive.ps1`. **Nobody is watching live, and you cannot reach the planner.**
Questions go in "Open for the planner".
**Not available here:** `/start`, the open-brain MCP server, the SessionStart hook, `gitnexus`.
**Temp and scratch (T-190):** `TEMP`=`TMP`=`C:\qa-tmp`, and scratch goes under `C:\qa-scratch`. The one full-suite run
uses the default temp (the Defender-on control).
**No git identity here:** pass it per command. **QA seats run ONE AT A TIME on this PC**, because they share this
tree. If another driver's `claude` is running, stop and write that into the report.

## The candidate

- **Code `9473b0d`** on `origin/loop/t185-cli-flags`. The handoff is at the tip, `6e50cf8`: the diff after `9473b0d` is
  `docs/loops/t185-developer-handoff.md` only. Built by the Claude developer seat, record 117, in
  `~/Worktrees/sia-infra`, from master `8af41dd`.
- **Files, from `git diff --stat 8af41dd 9473b0d` (read by the planner):**
  - `src/shared/cli-args.ts` (new, 148 lines);
  - `src/cli-spec.ts` (new, 53);
  - `src/cli.ts` (+48/−34, in sections `sync` through `state show` only; **`state import`'s section is untouched**);
  - `scripts/backfill-success-rate.mjs` (+7);
  - `tests/cli-flags.test.ts` (new, 20 end-to-end tests);
  - `tests/shared/cli-args.test.ts` (new).
- **Redcheck:** `loop/t185-redcheck` (`905789b`, then `598988e`; tests only, on `8af41dd`). **Mutants:**
  `loop/t185-mut-{no-refusal,detach-widened,no-dir-check,undeclared-read-silent}`.
- **Runs the planner checked** (the head SHA and conclusion of each, plus each mutant's failing tests):
  - red: 36209560043 and 36209870776;
  - green: 36209923825;
  - mutants: 36210013456, 36210016132, 36210018280 and 36210020015, all red at the protections they remove.

## The planner's rulings on the handoff's questions (score with these)

- **R185-1: `cli-bootstrap.ts` (the SessionStart `--ide` hook) does NOT refuse.** The developer's reasoning is accepted.
  The host passes arguments written by `setup.mjs`, a refusal would fail every session on the machine over a
  registration typo, and the payload's IDE detection overrides the flag. Check that the reasoning holds: that
  `detectIde` does override, and that an unknown flag there changes nothing written.
- **R185-2: `--help` and `-h` on a subcommand now REFUSE, and that is accepted.** The brief said they "keep working where
  they exist today". They did not exist per subcommand: `sync --help` ran the FIXING sync. Refusing is strictly safer.
  Verify the old behaviour at `8af41dd`, in a scratch clone only.
- **R185-3: malformed values exit 2.** Accepted.
- **R185-4: `state import` adopts the shared helper after importer round 4 merges.** That is a task, not part of T-185.
  R2-4 is not on master, because importer rounds 2–4 are unmerged. **Check that `9473b0d` and `origin/loop/importer-fixes-r3`
  (`00244d3`) merge without a conflict in `cli.ts`**, in a scratch clone (`git merge --no-commit`, then abort), and
  report the result.
- The `retirements` ISSUE on `ENTITIES.md` is pre-existing and not T-185's (QA 111 and QA 114 saw it too).

## Score against

- **`docs/loops/t185-cli-flags-brief.md`** (on `origin/docs/session-100-qa99-dispatch`): T185-1 (the shared rule, the
  directory check, and the **parser list** in handoff §3, which is the deliverable) and T185-2 (the tests).
- **Check, not accept:**
  - Every mutating command in the brief's table refuses its typo with exit 2, names the token, and leaves the target
    byte-identical. For `detach` that means HEAD and the tree; for `sync`, no file touched; for `start`, no session
    log; for `state migrate`, the file unchanged.
  - Try **your own** typos beyond the developer's: `--dry_run`, `—dry-run` (an em dash), `-n`, `--check=1`, a flag
    after the positional, a flag twice, and a bare `-`.
  - **Every documented invocation still parses.** Search the tracked tree, `.github/`, `project-template/`,
    `.claude/commands` and `setup.mjs` for `cli.js`/`open-brain <sub>` calls. The developer did this, so re-derive it.
  - **The hooks are unaffected.** SessionStart (`cli-bootstrap`), SessionEnd and the recall trigger run as
    `setup.mjs` registers them.
  - `inScratch()`: confirm that no test can spawn against the real checkout. Try to make one do it.
- **Mutants of your own:** at least one that accepts a single-dash token, and one that walks up from a missing
  directory.

## CI and authority

- CI on **tcm** (free). Confirm the runner, and use at most **6** runs. Hosted minutes are exhausted until 2026-10-01.
- **Push only `qa/t185-*`, through `node docs/loops/qa-120/push-qa.mjs <branch>`.** `git push` is denied.
- Never: master, merges (a scratch `merge --no-commit` for R185-4 is not a merge of anything pushed), PRs, tags,
  releases, other seats' branches, or this PC's configuration.
- **A refusal or a denied command:** stop that line, record it verbatim, and continue.

## The report

- **Path:** `docs/loops/t185-qa-report.md`. Put the verdict first, then T185-1 and T185-2, the rulings checks (R185-1
  to -4), mutants (the developer's and your own), the full suite and CI, what could not be verified, defects,
  disagreements, your error entries, reproduction, and "Open for the planner".
- **Model and effort** from your process command line and transcript.
- Commit the report and scripts (`docs/loops/qa-scripts-t185/`, with a README) to `qa/t185-report`, and push with
  `push-qa.mjs`.
- **The LAST line is exactly `QA-120: REPORT COMPLETE`.** No `/end` (T-163).
