# Loop 15 slice three: dispatch of candidate A8 to a FRESH, HEADLESS QA seat (record session 99)

**By:** Atlas (planner), record session **100** · 2026-09-25 (UTC). QA 99 was reserved before this planner session
started, so the planner's number is the higher one (T-164).
**Where QA 99 runs:** the QA PC `desktop-o4egb1e` (D-045), in `C:\Users\Aaron Melven\Worktrees\sia-qa`, launched
headless by `docs/loops/qa-99/drive.ps1`. **Nobody is watching this run live, and you cannot reach the planner
mid-run.** Anything you would have asked goes in the report under **"Open for the planner"**, and you carry on with
whatever does not depend on the answer.

**Not available on this PC, by the planner's ruling (infra handoff §4):** `/start`, the open-brain MCP server and the
SessionStart hook. Do not try to install them. This file, the criteria and the rulings are your whole brief.

## The candidate

- **A8 is `9e2dd5dd8762f95431cffc80cab65f7c02885724`** on `origin/loop/15-slice-3-candidate-a8`. It is not for merge;
  the merge is Aaron's.
- It sits on A7 `d223d1d`. **This table is built from each commit's `git diff --stat`, read by the planner:**

  | Commit | Files it changes | Carries |
  |---|---|---|
  | `e644c96` | `configwatch-a7-seam.test.ts` (±22), `configwatch-links.test.ts` (+86) | the tests only (the redcheck base) |
  | `4e849a3` | `configwatch.ts` (±44) | R68: facts on an unread machine path |
  | `d448bdd` | `configwatch.ts` (±14) | R69: a path absent at base read once it appears at its own place |
  | `2052251` | `configwatch.ts` (±3) | R70: the handle re-checks `nlink` |
  | `270e601` | `configwatch.ts` (±21) | R71: true record texts |
  | `9e2dd5d` | the handoff only | — |

- **Built by:** Grok 4.7 in Cursor, developer record session 98. **Handoff:**
  `docs/loops/loop-15-slice-3-a8-developer-handoff.md` at `9e2dd5d`.

## Evidence the developer left (Linux CI, GitHub-hosted)

The planner confirmed each run's head SHA and conclusion. **Re-read the runs per test yourself; do not inherit them.**

| Run | Head | What | Conclusion |
|---|---|---|---|
| `36083149768` | `e644c96` redcheck | A8's tests on A7 | failure (the developer reads 4: R68, R69 single-name, R70, R71) |
| `36083152202` | `270e601` | the code | success (1158 passed, 6 skipped) |
| `36083648742` | `9e2dd5d` | the candidate | success (1158 passed, 6 skipped) |
| `36083230156` | mut-facts `92f04a2` | R68 reverted | failure (R68 only, per the developer) |
| `36083232599` | mut-appear `b40c82c` | R69 reverted | failure (R69 only) |
| `36083234983` | mut-nlink `c37c84b` | R70 reverted | failure (R70 only) |
| `36083237474` | mut-record `6f94b2e` | R71 reverted | failure (R71 only) |

**Not run by the developer:** a full local suite, and POSIX tests on its own seat (Windows).

## Score against

- The criteria **FINAL at `6672e83`** (`docs/loops/loop-15-slice-3-qa-criteria-a.md`), read with **rulings-9 to
  rulings-15** on master. **D-042 (R67)** is in force, and **D-046 records that Aaron accepted R69.** Rulings-15's
  "Rows touched" table says how each touched row is scored.
- **Your predecessor's handoff:** QA report A7 §14. Read all of it; its items 2 and 3 say which old probe assertions
  are obsolete and how to compare changes rather than rows.
- **Known positives:** A7 `d223d1d` and A6 `dc35b24` for A7-1 (ABSENT-BASE-LOOP, TWO-NAME-LATER, R65-FACTS,
  WRITEONLY-LATER) and A7-2 (UNREAD-BASE, STAGE-START-UNREAD); QA 96's probe files are in `docs/loops/qa-scripts-a7/`.

## Procedure

1. **Set up.** Your tree is detached at the planner's dispatch commit. Examine the candidate in a separate worktree or
   `git archive` copy at `9e2dd5d`, and the known positives the same way. Build each with `npm ci` and `npm run build`
   in its `open-brain`.
2. **Every row is re-run.** Win32 rows run locally on this PC, which is dedicated and quiet: this is the machine D-045
   moved QA to so that local measurement costs nothing. POSIX rows (symlinks) need Linux, which here is CI only.
3. **R69 widens what is read. Probe its edges, each against A8 and with a mutant where one protects:**
   - a file that appears as a **hard link** (`nlink` 2) is not read;
   - a **symlink** that appears at the name is not read;
   - the **parent directory replaced** by a link to elsewhere (the parent's `realpath` differs) is not read;
   - a **renamed** appearance (a different name in the same place) is not read;
   - `git config --global`'s first write on a machine with no `~/.gitconfig` at base **is** read, with both hashes.
   - The gap between the `realpath` check and `open` is R37's named limit (rulings-15, R70). Record it; do not score it.
4. **R70:** show a mutant dropping only the `nlink` comparison reads HANDLE-NLINK's file, independently of the
   developer's mut-nlink.
5. **R68 and R71 on both sides:** every unread path carries type, `dev`, `ino`, `nlink`, `size`, `mtimeNs`; stage-start
   facts show as "before"; a failed read says "unreadable", never "absent"; an unread repository record never prints two
   identical placeholder sides.
6. **Regressions:** A4-1 H, J and LOOP stay unread; D-042's trade holds both ways; A6-1, A6-2 and A7's closed rows stay
   closed.
7. **One mutant per protection;** check that each of the developer's four reverts what it claims.
8. **The full suite once, alone, locally, at `9e2dd5d`,** captured unpiped (`npx vitest run > file; SUITE_EXIT=$?`).
   Record the processes running on this PC just before and just after it.
9. **Plain `sync`'s exit code in a scratch clone.** If `gitnexus` is not available here, say so and mark `/sync --check`
   unrun. Do not install global tools.

## CI budget: a hard cap

GitHub Actions minutes are nearly exhausted for the month (1,802 of 2,000 on 2026-09-24, before A8's seven runs; it
resets Oct 1). Probe branches built on the candidate carry the candidate's `ci.yml` and run on GitHub-hosted runners, and
the planner of record 90 ruled that they stay there ("a result shift would be confounded"; tcm has git 2.43).

- **At most 8 CI runs in total.** Batch every POSIX probe for one candidate into one branch and one run.
- Do everything that runs on win32 locally, not on CI.
- **If a run fails to start or is queued for billing, stop using CI.** Mark the rows it would have measured as unrun,
  with the reason, rather than scoring them from the developer's runs.

## Authority (D-038, D-040), and how it is enforced here

- **Push only your own `qa/loop-15-slice-3-a8-*` branches, and only through
  `node docs/loops/qa-99/push-qa.mjs <branch>`.** `git push` is denied to you directly. The script refuses any other
  name and any force, and reads the push back. The driver compares every remote ref before and after your run, and
  flags any change outside `qa/`.
- **CI on those branches:** `gh workflow run` without asking (D-040), inside the cap above.
- **Never:** master, merges, PRs, tags, releases, other seats' branches, or this PC's Claude configuration.
- **A refusal or a denied command:** stop that line of work, record it verbatim in the report, and continue with what
  does not depend on it. Do not look for another route.

## The report

- **Path:** `docs/loops/loop-15-slice-3-qa-report-a8.md`, in the same structure as report A7 (verdict first; rows;
  detail; mutants; full suite and CI; what could not be verified; defects; regressions; disagreements returned rather
  than scored; your error entries and near-misses; reproduction; handoff to the next QA session).
- Add a section **"Open for the planner"**: every question you would have asked, with what you did instead.
- **Model and effort:** from your session's init line and transcript. The driver launched you with
  `--model claude-opus-5-5 --effort high`; say whether your transcript agrees.
- Track your scripts in `docs/loops/qa-scripts-a8/` with a README, as QA 96 did.
- Commit the report and scripts to `qa/loop-15-slice-3-a8-report` and push it with `push-qa.mjs`.
- **The report's LAST line is exactly `QA-99: REPORT COMPLETE`.** Write it only when every item above is either done or
  written up as blocked, with the reason. The driver checks for that line and resumes your session if it is missing.
- **No /end** (T-163).
