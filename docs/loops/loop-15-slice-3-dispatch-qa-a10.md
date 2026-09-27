# Loop 15 slice three: dispatch of candidate A10 to a FRESH, HEADLESS QA seat (record session 108)

**By:** Atlas (planner), record session 109 · 2026-09-25 (UTC). **Where QA 108 runs:** the QA PC `desktop-o4egb1e`
(D-045), in `C:\Users\Aaron Melven\Worktrees\sia-qa`, launched headless by `docs/loops/qa-108/drive.ps1`. **Nobody is
watching live and you cannot reach the planner.** Put questions in **"Open for the planner"**, and carry on with
whatever does not depend on the answer.
**Not available here, by ruling:** `/start`, the open-brain MCP server, the SessionStart hook, `gitnexus`.
**This PC has no git identity.** Pass it per command (`git -c user.name="Aaron Melven" -c user.email=melvenac@gmail.com
commit …`). Do not write any git config.
**Temps (T-190):** the driver sets `TEMP`=`TMP`=`C:\qa-tmp` for probes and mutants. Keep scratch in `C:\qa-scratch`.
Run the full suite once with the default temp (the Defender-on control).

## The candidate

- **A10 is `4b7a5aebd9a17b0ce8e6ee99545f4f8f5784c90f`** on `origin/loop/15-slice-3-candidate-a10`. It is not for merge.
- It sits on A9 `6bd97f2`, which carries master `9bc06e3`. Master has since changed only `docs/` and `.agents/`
  (the planner checked: 0 other paths), so there is no merge commit.
- **Built by:** Grok 4.7 in Cursor, developer record 107, continuing through a network-error restart. **Handoff:**
  `docs/loops/loop-15-slice-3-a10-developer-handoff.md` at the frozen SHA.
- **The commit table is built from each commit's own `git diff --stat`, read by the planner:** 

  | Commits | Carries | Files (from `git diff --stat`) |
  |---|---|---|
  | `819679d` | R77 fix 1 (containment in the helpers; stop before git) | `configwatch.ts`, `runtime.ts`, `configwatch-r77-contain.test.ts`, QA 104's `qa104-a9-probe2/3.test.ts` (added) |
  | `21acfc3`, `2b7df2f`, `a88fa10`, `4ba3297`, `763611a` | R77: unlisted at close and begin (`config-watch-unestablished`), the strict any-unrestored stop, the type-error fix, unlisted kept out of links, the dependency comment | `configwatch.ts`, `runtime.ts`, the r77 test |
  | `9fe71a2`, `b9e742d`, `a00d2fe` | R77-CLOSE-VERDICT-NOT-OK (mutant (e)'s row, isolated on an empty tree) | the r77 test only |
  | `d14a874`, `27b24cb`, `9290676`, `3771d53`, `c923550` | R77 clause 2 and R82: unlisted contents, R82 made structural, **the old-path chmod added (`d14a874`) and removed (`c923550`)** | `configwatch.ts`, `runtime.ts`, the r77 test |
  | `258dfbf`, `e7fbe78` | R77-MODE000-HARDLINK | `configwatch-r77-hardlink.test.ts` (new) |
  | `fb2fbe9` | R78 | `configwatch.ts`, `configwatch-r78-read-facts.test.ts` (new) |
  | `f45c4c9` | R82: ENOENT/ENOTDIR are absence | `configwatch.ts`, the r77 test |
  | `9f55563`, `afee764` | R79 | `configwatch.ts`, `configwatch-r79-sides.test.ts` (new), **`configwatch-links.test.ts` (existing: R45, R61, R71 A6-5)** |
  | `e6a3fd4`, `e8fce2a`, `ecf1f62` | R80 | `configwatch.ts`, `runtime.ts`, `configwatch-r80-report.test.ts` and `-r80-texts.test.ts` (new), **`configwatch-links.test.ts` and `configwatch-a7-seam.test.ts` (existing)** |
  | `340f77e`, `1c26983`, `7563484`, `0a01d4a`, `4b7a5ae` | the handoff | `docs/loops/loop-15-slice-3-a10-developer-handoff.md` only |

  **For QA, from the planner's table:** `e6a3fd4` edits **`configwatch-a7-seam.test.ts`**, an existing test that is
  **not** on the handoff's list of changed existing assertions (R45, R61, R70, R71 A6-5, links R74, the hard-link
  row, the R80 fact rows). Read that change, and score whether it narrows a protection. The product tree is
  `ecf1f62`; `4b7a5ae` adds only the handoff.

## Score against

- **Rulings-17** (R77–R80) and **rulings-18** (R77 as applied in eight readings, R82 and its two precisions:
  scraped codes, and ENOENT/ENOTDIR as absence). Both are on master. Rulings-18 was made in the hub during the build,
  and it binds.
- **Your predecessor's report:** QA 104's, on `origin/qa/loop-15-slice-3-a9-report` (`e80acd4`): the verdict, §9,
  §11 and §13. Its probes (`qa104-a9-probe*.test.ts`) are in the candidate's tree now. Score them there, and check
  that each is byte-identical to QA 104's (`git hash-object`).
- **Known positives:** A9 `6bd97f2` for A9-1/A9-2 (probe3, probe2); the developer's redcheck branches
  (`loop/15-slice-3-a10-redcheck`, `-redcheck2`, `-redcheck3`, `-redcheck-hardlink`, `-redcheck-r78`) and each
  `mut-*` branch the handoff names.
- **Known negative:** `FIX-before-facts` (`qa/loop-15-slice-3-a9-fix-before-facts`) heals the three `unreadable`
  shapes.

## Procedure

1. **Every row is re-run.** Win32 rows run locally (this PC can make symlinks and junctions). POSIX rows run on CI
   on tcm, which is free: confirm the runner, **at most 10 runs**, shared with other seats. **Hosted Actions minutes
   are exhausted until 2026-10-01**, so a hosted run will not start, and dispatching one proves nothing.
2. **R77, by class:** the window always completes. Produce at least one shape of your own per helper (`identify`,
   `listTree`, `readState`, the stop before git), not only the developer's rows. **Check the one the planner found
   hardest to see:** a restore must never act on the OLD path. `d14a874` chmodded through a planted hook symlink, and
   a `kind === 'file'` guard does not stop a hard link. Build a hard-link and a symlink shape of your own.
3. **R82 on win32:** a junction on an XDG config (R35) and an ENOENT resolution must never be
   `machine-config-unobservable`. tcm cannot run the junction, so this PC is the only place it runs.
4. **R78–R80:** the texts, the labels, and the facts on every record. In the type-change and absent→symlink texts,
   the LINK's lstat facts and the labelled resolved facts must both be present.
5. **Every existing test whose assertion changed** (the handoff lists them): check each change against the ruling
   the handoff cites, and say whether any narrowed a protection. R61's narrowed detector was validated by a mutant.
   Re-validate it with one of your own.
6. **Regressions:** everything QA 104 found closed stays closed, and QA 99's R71-UNREADABLE-START/-AT-BASE (on its
   probe branch) are re-scored in R79's form.
7. **The full suite once, at the frozen SHA,** captured unpiped, with the processes recorded before and after.
8. **Plain `sync` in a scratch clone.** `/sync --check` after `gitnexus analyze` is unrun (no `gitnexus` here).

## Authority

- **Push only `qa/loop-15-slice-3-a10-*`, through `node docs/loops/qa-108/push-qa.mjs <branch>`.** `git push` is
  denied to you.
- Never: master, merges, PRs, tags, releases, other seats' branches, or this PC's Claude or git configuration.
- **A refusal or a denied command:** stop that line of work, record it verbatim, and continue with the rest.

## The report

- **Path:** `docs/loops/loop-15-slice-3-qa-report-a10.md`, in report A9's structure.
- **Model and effort** from your process command line and transcript.
- Commit the report and scripts (`docs/loops/qa-scripts-a10/`, with a README) to `qa/loop-15-slice-3-a10-report`,
  and push with `push-qa.mjs`.
- **The LAST line is exactly `QA-108: REPORT COMPLETE`.** No `/end` (T-163).
