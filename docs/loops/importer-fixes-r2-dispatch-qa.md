# Importer fixes round 2: dispatch to a FRESH, HEADLESS QA seat (record session 106)

**By:** Atlas (planner), record session 100 · 2026-09-25 (UTC). **Where QA 106 runs:** the QA PC `desktop-o4egb1e`, launched
headless by `docs/loops/qa-106/drive.ps1`. **Nobody is watching live, and you cannot reach the planner.** Questions go in
"Open for the planner"; carry on with whatever does not depend on the answer.
**Not available here:** `/start`, open-brain MCP, the SessionStart hook, `gitnexus`.
**No git identity on this PC:** pass it per command (`git -c user.name="Aaron Melven" -c user.email=melvenac@gmail.com
commit …`). Do not write any git config.

## The candidate

- **`aba35de`** on `origin/loop/importer-fixes-r2`, the same commit as `-r2-ci`. The handoff is at the tip of
  `origin/loop/importer-fixes-r2`: `docs/loops/importer-fixes-r2-developer-handoff.md`. It is not for merge.
- Built by the Claude developer seat, record 105, on round 1's tip `65e3a89` (candidate `f6b6d44` plus its handoff).
  **This table is built from each commit's full `git diff --name-only`, read by the planner:**

  | Commit | Files | Carries |
  |---|---|---|
  | `c3e3297` | new `state-import-atomic.test.ts`, `state-import-r2.test.ts` | red tests (the redcheck base) |
  | `a1269b2` | `CHANGELOG.md`, `state-import/index.ts`, `state-import-r2.test.ts` | R2-1: one decode for every input |
  | `8942261` | `CHANGELOG.md`, `state-import/index.ts` | R2-2: ahead of the latest log is could-not-tell |
  | `7fac365` | `CHANGELOG.md`, `state-import/index.ts`, `state-import-atomic.test.ts` | R2-3: complete or change nothing |
  | `f021519` | `CHANGELOG.md`, `cli.ts` | R2-4: unknown `-` token, a second positional, a missing directory |
  | `8723ccf` | `state-import-atomic.test.ts`, `state-import-staleness.test.ts` | R2-5: guards |
  | `aba35de` | `state-import/index.ts` | R2-1: the BOM strip is the one protection (`ignoreBOM: true`) |

## Score against

- **`docs/loops/importer-fixes-round-2-brief.md` §3, rows IF-9 to IF-15,** plus round 1's **IF-1 to IF-8**, which must
  still hold (`docs/loops/importer-fixes-brief.md`). Both files are on `origin/docs/session-100-qa99-dispatch`.
- **IF-15's full-suite clause is moved here,** before any verdict. The developer could find no moment when every
  session on the shared machine was idle, and this PC is quiet by construction (D-045). **You run the full suite once,
  at `aba35de`,** captured unpiped, with the processes on this PC recorded before and after. The row's other parts
  stand: `/sync` shows no new issue, and CI is green on tcm.
- **Your predecessor's report:** QA 102's, on `origin/qa/importer-fixes-report`. Its probes, scripts and evidence are in
  `docs/loops/qa-scripts-importer/` there. **Re-run its `probes.mjs` and `mutants.mjs` against `aba35de` yourself.** The
  developer reports 26/26 on its own build; do not inherit that. **Copy scripts byte-exact:** the developer's first copy
  went through PowerShell's ascii encoding and gave 5 false FAILs.
- **Limits the developer states, which you check rather than accept:**
  - PROBE-10 (a stale input with a future-session heading) is now could-not-tell: narrowed, not closed;
  - the path where the rollback itself fails is written, but no test induces it. **Induce it if you can** (for
    example, a snapshot file made read-only before the rollback), and record what the project is left as.

## Procedure

1. Set up worktrees at `aba35de` and at `65e3a89` (round 1, as the control), plus a fresh A2A-Hub archive at `e0bc3f8`.
2. Every IF row, 1 to 15, re-run by you through the built CLI, not only through the developer's tests.
3. **The class, not the instance:** for R2-1, try every encoding shape this PC's tools write: UTF-8 with and without a
   BOM, UTF-16 LE with a BOM (PowerShell 5.1's `>`), and CRLF. For R2-4, try each of `-x`, `x`, two positionals, and a
   non-existent directory, before and after the flag.
4. Mutants: re-run QA 102's set and one per new protection, and check that each of the developer's reverts only what it
   claims.
5. The full suite (above), and plain `sync` in a scratch clone. `/sync --check` after `gitnexus analyze` is unrun.

## CI and authority

- Branches built on `aba35de` run on **tcm**, which is free; confirm the runner. At most **8** runs. tcm has two
  runners, and QA 104's probes may share them.
- **Push only `qa/importer-fixes-r2-*`, through `node docs/loops/qa-106/push-qa.mjs <branch>`.** `git push` is denied to
  you. The driver audits remote refs, and other seats' pushes will be flagged too; the planner attributes them.
- Never: master, merges, PRs, tags, releases, other seats' branches, or this PC's configuration.
- **A refusal or a denied command:** stop that line of work, record it verbatim, and continue with the rest.

## The report

- **Path:** `docs/loops/importer-fixes-r2-qa-report.md`, in QA 102's structure: the verdict first, then rows IF-1 to
  IF-15, probes, mutants, the full suite and CI, what could not be verified, defects, disagreements, your error entries
  and near-misses, reproduction, and "Open for the planner".
- **Model and effort** from your process command line and transcript. The driver passes
  `--model claude-opus-5-5 --effort high`.
- Commit the report and scripts (`docs/loops/qa-scripts-importer-r2/`, with a README) to `qa/importer-fixes-r2-report`,
  and push it with `push-qa.mjs`.
- **The LAST line is exactly `QA-106: REPORT COMPLETE`.** No `/end` (T-163).
