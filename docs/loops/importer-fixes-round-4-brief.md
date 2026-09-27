# Importer fixes, round 4: rulings on QA 111 and the brief for a FRESH developer session (record session 116)

**By:** Atlas (planner), record session 109 · 2026-09-26. **To:** the Claude developer seat (Forge), **record session
116**, a fresh session (D-035) in **`~/Worktrees/sia-builder`**. `sia-infra` is kept for B Step 0 (record 112).
**Authority:** the planner's ruling on QA 111's report, `origin/qa/importer-fixes-r3-report` `5abe44f`, 407 lines. The
planner read the header, the Verdict, both row tables, What could not be verified, Defects (with O5–O11),
Disagreements and "Open for the planner". It did **not** read Probes, Mutants or Full suite and CI in detail
(lines 108–275). **Starting the session is Aaron's act.** Merging and releasing stay his (D-019).

## 1. Rulings on QA 111

**Accepted:** the verdict. IF-16, IF-17 and IF-19 PASS. IF-1 to IF-15 hold. D5, D6 and D7 are closed by class.

**The scoring (QA's Open 3 and 4, and Disagreements 1–3), as QA recommends:**
- IF-18 is **"PASS as written; the class FAILS (D8)"**, and IF-20 is **"PASS as ruled"**.
- R33-write's count is **3/60**, QA's number, reproduced three times. The handoff's 4/60 is not reproduced. Nothing
  depends on it.

**R4-1 (D8, medium–high): an input the importer cannot read BLOCKS `--commit` like STALE, unless `--accept-stale` is
passed.** This answers QA's Open 1 with its recommendation: **block**, rather than judging around the NUL bytes.
- **Why block rather than judge:** QA 106 turned down blocking for D5 because it would stop every ANSI project. Round
  3 now reads Windows-1252, so what stays unreadable is rare, and blocking it costs little. Blocking closes the class,
  including shapes nobody has named yet (UTF-16BE with no BOM among them), with no new decoder. Judging with the NULs
  stripped would add a second guess on top of R3-2's.
- **What this changes, stated so it is not read as a reversal:** R3-2 kept "could not tell" as the VERDICT for the
  NUL case, and it stays the verdict. What changes is the verdict's CONSEQUENCE: a judged input that could not be read
  no longer lets a bare `--commit` through. A could-not-tell verdict that has a *reason other than unreadable bytes*
  keeps round 3's behaviour: for example R2-2's "+13 and +1 with both numbers named" does not block. **List every
  could-not-tell reason the code can produce, and say which of them block and which do not.** That list is the
  deliverable, as the rmSync list was in R3-1.
- The refusal names the file, says why it could not be read (the NUL count and the first offset are enough), and names
  `--accept-stale` as the way through.
- **Tests (bytes only, so they run on tcm too):** QA 111's four shapes. PS 5.1 `>>` onto UTF-8, onto UTF-8 with a BOM
  and onto Windows-1252, and a stray NUL in plain UTF-8. Each gives bare `--commit` exit 1 with the tree identical, and
  `--accept-stale` completes. Also UTF-16LE with no BOM and UTF-16BE with no BOM (QA did not probe BE). **Known
  positive:** QA 111's `probes-r3.mjs` append table and `evidence/ps51-append-bytes.out`.
- IF-10's +13/+1 could-not-tell rows must still commit (IF-10 is re-checked, not re-ruled).

**R4-2 (D9): a killing test for `index.ts:833`** (a SUMMARY.md with NUL bytes refuses). The test is UTF-16LE with no
BOM plus `--commit`: it refuses, and the tree is identical afterwards. It must turn QA's N5 and Q20 red. Show both.

**R4-3 (D10, first half): killing tests for Q1 and Q17.**
- Q1: a marker with **another day's date** refuses both doors (`--draft` and `--commit`).
- Q17: a marker plus a `state.json` gets the half-restored refusal from `--draft`.

  Q15 and Q6 are **not required**. Add them only if each is one small test.

**Recorded, not in round 4:**
- **O6** (a Windows-1251 guess reaches `state.json`): goes to a task. It is not a regression, and the original is
  kept in the snapshot.
- **O7 and O8** (message grammar): fix them if each is one line. Not required.
- **O9** (the marker has a single reader): noted for **T-181**. If another door meets a project with a marker, it
  should say so.
- **O10** (a successful `--force-snapshot` deletes the one complete copy): **fix it in round 4 if it is one sentence**.
  The half-restored refusal adds "keep a copy of the snapshot until the re-run completes". Otherwise it goes to a task.
- **O5** (QA 99's `Get-Content -Wait`, PID 3884, still running on the QA PC): **Aaron's to end.** The planner cannot
  reach that machine. A driver change so each QA run ends its own viewer goes to a task.

## 2. Start

1. `/start`. Your record number is **116**. The greeting's number is local (T-164).
2. Branch from round 3's tip: `git fetch origin && git switch -c loop/importer-fixes-r4 origin/loop/importer-fixes-r3`
   (`00244d3`: candidate `063662b` plus its handoff).
3. `npm ci && npm run build` in `open-brain`.
4. **Read ONLY:** this brief; QA 111's report, the Verdict, Defects and "Open for the planner"
   (`git show origin/qa/importer-fixes-r3-report:docs/loops/importer-fixes-r3-qa-report.md`); its scripts in
   `docs/loops/qa-scripts-importer-r3/` on that branch; and round 3's brief §2 (`importer-fixes-round-3-brief.md`).
   **IF-1 to IF-20 must all still hold.**

## 3. Rows

| Row | What must hold |
|---|---|
| **IF-21** | R4-1: the four append shapes plus UTF-16LE and UTF-16BE with no BOM each block a bare `--commit` (exit 1, tree identical: sha256, size, mtime, read-only bit), and each completes under `--accept-stale`. |
| **IF-22** | R4-1's list: every could-not-tell reason in the code, each marked blocks or does not block, with its line. IF-10's +13/+1 still commit. |
| **IF-23** | R4-2: the `:833` test exists and turns N5 and Q20 red. |
| **IF-24** | R4-3: the Q1 and Q17 tests exist and turn their mutants red. |
| **IF-25** | IF-1 to IF-20 hold. QA 106's and QA 111's scripts pass byte-exact, except any row whose expectation R4-1 changes. Name each such row and the ruling that changed it. |

## 4. How

- **Red first with your own tests**, on `063662b`, as `loop/importer-fixes-r4-redcheck`. Read that run on tcm per test.
  A row red for the wrong reason does not count, and neither does a row that is only argued red.
- **A code mutant per protection** (at least: R4-1's block, R4-2's refusal, and Q1's date match), each on
  `loop/importer-fixes-r4-mut-<name>` and batched on tcm. `npx tsc --noEmit -p .` before every push and on every
  mutant.
- CI on **tcm** (D-040). Hosted minutes are exhausted until 2026-10-01.
- **No full local suite.** This box is never quiet during the day (the planner's ruling). QA runs it on the QA PC.
- Push only `loop/importer-fixes-r4` and `loop/importer-fixes-r4-*`. Never master, never force, and read back each push.
  On a refusal or a denied command, stop and tell atlas.

## 5. Hand back

`docs/loops/importer-fixes-r4-developer-handoff.md`, with:
- a commit table built from each commit's own `git diff --stat`;
- R4-1's could-not-tell list;
- per row, its red run, its green run and every mutant with its run id;
- every existing test whose assertion changed, with the ruling that allowed it;
- your model and effort, read from your own transcript rather than self-reported.

Then name the frozen SHA. No `/end` (T-163). Message atlas by SendMessage when it is pushed.
