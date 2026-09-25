# Importer fixes (T-175, T-180): dispatch to a FRESH, HEADLESS QA seat (record session 102)

**By:** Atlas (planner), record session 100 · 2026-09-25 (UTC). **Where QA 102 runs:** the QA PC `desktop-o4egb1e`
(D-045), in `C:\Users\Aaron Melven\Worktrees\sia-qa`, launched headless by `docs/loops/qa-102/drive.ps1`. **Nobody is
watching live and you cannot reach the planner.** Anything you would have asked goes in the report's **"Open for the
planner"** section, and you carry on with whatever does not depend on the answer.
**Not available here, by ruling:** `/start`, the open-brain MCP server, the SessionStart hook, `gitnexus`. Do not
install them.

## The candidate

- **`f6b6d44`**, reachable at `origin/loop/importer-fixes-ci`. It is not for merge; the merge and the release are
  Aaron's (D-019).
- **Read the handoff at the tip of `origin/loop/importer-fixes` (`65e3a89`):**
  `docs/loops/importer-fixes-developer-handoff.md`. The two commits above the candidate (`3b68500`, `65e3a89`) touch only
  that file. The planner checked that with `git diff --stat`.
- **Built by:** the Claude developer seat (Forge), record session 101, in `~/Worktrees/sia-infra`, from current master
  `9bc06e3`.
- **This table is built from each commit's `git diff --stat`, read by the planner:**

  | Commit | Files | Carries |
  |---|---|---|
  | `64901bf` | `CHANGELOG.md`, `cli.ts` (±2), `state-import/index.ts` (±54), new `state-import-seeds.test.ts`, `state-import.test.ts` (±5) | T-175: the seeds removed |
  | `bdf9ddb` | `state-import/index.ts` (+138), `cli.ts`, `CHANGELOG.md`, `.agents/retirements.json` (+1), new `state-import-staleness.test.ts`, the fixture `open-brain/tests/fixtures-import-a2a-hub/` (7 `.agents` inputs, `README.md`, `package.json`) | T-180: staleness |
  | `f6b6d44` | `state-import-staleness.test.ts` (+13) | the planner's ruling: "could not tell" reaches the `--commit` operator |

## Score against

- **The brief:** `docs/loops/importer-fixes-brief.md` §3, rows **IF-1 to IF-8**, written before any candidate existed.
- **The planner's rulings during the build** (recorded in the handoff; read them there):
  1. "Could not tell" does **not** block `--commit`. But (a) each such input is a line in the draft report's top
     section, alongside STALE findings, and carries its reason; and (b) `--commit` prints one line naming those inputs
     before it proceeds. Each has a test and a mutant.
  2. The fixture directory is listed as historical in `.agents/retirements.json`, on condition that it holds only
     importer inputs and no secret.
  3. The IF-7 deviation at `state-import.test.ts:142-143` is intended: those lines asserted the seeds themselves.
- **Known positive for T-180:** A2A-Hub at **`e0bc3f8`**. `SESSIONS/Session_14.md` exists, but `next-session.md` is
  Session 13's, and INBOX was last updated at Session 11.

## Procedure

1. **Set up:** a worktree or `git archive` copy at `f6b6d44`, then `npm ci` and `npm run build` in `open-brain`.
2. **Every IF row is re-run by you.** Do not inherit the developer's results.
3. **Check the fixture's fidelity yourself.** Clone A2A-Hub read-only from GitHub into a scratch directory (`gh` is
   authenticated here). Compare each of the fixture's 7 `.agents` files, byte for byte, with the same path at `e0bc3f8`.
   Record any difference.
4. **Scan the fixture for secrets** with a pattern you first validate against a planted positive. Report both counts.
5. **Probe past the brief's rows.** In each case, record what the import says and whether `--commit` proceeds:
   - an input newer than the latest session;
   - a project with no `SESSIONS/` directory;
   - a `next-session.md` that names no session;
   - an untracked `.agents/`;
   - a misspelled acknowledgement flag (T-150's rule: it must refuse).
6. **One mutant per protection.** Check that each of the developer's reverts only what it claims.
7. **The full suite once, at `f6b6d44`,** captured unpiped (`npx vitest run > file; SUITE_EXIT=$?`). Record the
   processes on this PC just before and after. This base carries PR #156, so the 8.3-path test should pass here.
8. **Plain `sync` in a scratch clone.** `/sync --check` after `gitnexus analyze` is unrun, because `gitnexus` is absent.
   Say so.

## CI

- Branches built on `f6b6d44` carry master's `ci.yml`, so they run on the **tcm self-hosted runners**, which cost no
  GitHub minutes.
- **Confirm each run's runner is tcm.** If one lands on a GitHub-hosted runner, stop using CI and mark those rows unrun.
- At most 8 runs.

## Authority (D-038, D-040), and how it is enforced

- **Push only `qa/importer-fixes-*` branches, and only through `node docs/loops/qa-102/push-qa.mjs <branch>`.** `git push`
  is denied to you directly.
- The driver compares every remote head and tag before and after your run. **Other seats may push during your run,
  and those pushes will be flagged too;** the planner attributes each one afterwards. Do not act on them.
- Never: master, merges, PRs, tags, releases, other seats' branches, or this PC's Claude configuration.
- **A refusal or a denied command:** stop that line of work, record it verbatim, and carry on with what does not depend on
  it.

## The report

- **Path:** `docs/loops/importer-fixes-qa-report.md`. Verdict first, then:
  - rows IF-1 to IF-8 and the rulings;
  - the fixture's fidelity and the secret scan;
  - the probes;
  - mutants;
  - the full suite and CI;
  - what could not be verified;
  - defects;
  - disagreements, returned rather than scored;
  - your error entries and near-misses;
  - reproduction;
  - "Open for the planner".
- **Model and effort** from your transcript. The driver passes `--model claude-opus-5-5 --effort high`.
- Commit the report and your scripts (`docs/loops/qa-scripts-importer/`, with a README) to `qa/importer-fixes-report`,
  and push it with `push-qa.mjs`.
- **The report's LAST line is exactly `QA-102: REPORT COMPLETE`.** Write it only when every item above is done or
  written up as blocked.
- No `/end` (T-163).
