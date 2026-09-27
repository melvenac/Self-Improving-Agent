# Importer fixes round 4: dispatch to a FRESH, HEADLESS QA seat (record session 122)

**By:** Atlas (planner), record session 109 · 2026-09-26 (UTC). **Where QA 122 runs:** the QA PC `desktop-o4egb1e`,
launched headless by `docs/loops/qa-122/drive.ps1`. **Nobody is watching live, and you cannot reach the planner.**
Questions go in "Open for the planner". Carry on with whatever does not depend on the answer.
**Not available here:** `/start`, the open-brain MCP server, the SessionStart hook, `gitnexus`.
**Temp and scratch (T-190):** `TEMP`=`TMP`=`C:\qa-tmp`, and scratch goes under `C:\qa-scratch`. **The one full-suite
run is the Defender-on control:** `TEMP="$QA_DEFAULT_TEMP" TMP="$QA_DEFAULT_TEMP" npx vitest run > file 2>&1;
SUITE_EXIT=$?`. A failure only in the control run is a finding.
**No git identity here:** pass it per command. Do not write any git config.
**QA seats run ONE AT A TIME on this PC**, because they share this tree. If `%USERPROFILE%\sia-qa120` has no `done`
marker, or a `claude` process from another driver is running, **stop and write that into the report**.

## The candidate

- **`78a7d13`** on `origin/loop/importer-fixes-r4`. The handoff is at the tip, `2005a3e`, and the diff after
  `78a7d13` is `docs/loops/` only. It is not for merge by you. Built by the Claude developer seat, record 116, on round
  3's tip `00244d3`. **Effort:** the dispatch said medium, and the developer read **high** on 286 of 286 transcript
  records and recorded high (D-047). Score it as a finding about the dispatch, not the build.
- **Each commit's own files, read by the planner:**

  | Commit | Files | Carries |
  |---|---|---|
  | `8da95f9` | `state-import-r4.test.ts` | rows IF-21 to IF-24 (R4-1, R4-2, R4-3, O8, O10) |
  | `4b88f5d` | `cli.ts` (the import section only, +3/−1), `state-import/index.ts` | R4-1: an unreadable input blocks `--commit` like STALE |
  | `4c07246` | `state-import-r4.test.ts` | the half-restored way out stays parseable by QA 111's probe |
  | `fa91ca3` | `state-import/index.ts` | O10's sentence moved after "Nothing written" (4b88f5d broke QA 111's `probes-r3`; the developer caught it) |
  | `78a7d13` | `state-import-r2.test.ts` | R4-2's NUL SUMMARY.md test, also in the file QA 106's N5 runs |
  | `2005a3e` | `docs/loops/` only | the handoff and `dev-scripts-importer-r4/` |

- **Redcheck:** `loop/importer-fixes-r4-redcheck` = `94704f4` (tests only, on `063662b`). tcm run 36212605596: 12
  failed, all `AssertionError`, all in `state-import-r4`.
- **Green:** 36212603856, 1108 passed and 1 skipped. **Mutants:** 13, on `loop/importer-fixes-r4-mut-*`, all red
  (36212607378 to 36212626961).

## Score against

- **`docs/loops/importer-fixes-round-4-brief.md` §1 and §3, rows IF-21 to IF-25** (on
  `origin/docs/session-100-qa99-dispatch`), plus IF-1 to IF-20 from the round 1–3 briefs.
- **Your predecessors' scripts, byte-exact:** QA 106's (`probes-r2.mjs`, `probe-existing-snapshot.mjs`,
  `mutants-r2.mjs`) and QA 111's (`probes-r3.mjs`, `mutants-r3-qa.mjs`, on `origin/qa/importer-fixes-r3-report`).
  The developer reports probes-r2 at 24/1 and probes-r3 at 17/4, and says every FAIL is a row checking "all STALE and
  bare `--commit` refuses", which R3-2 or R4-1 changed. **Re-derive that for each FAIL row, and name the ruling that
  changed each.** A FAIL no ruling covers is a defect.
- **R4-1, check, not accept:**
  - QA 111's four append shapes (PS 5.1 `>>` onto UTF-8, onto UTF-8 with a BOM and onto 1252, and a stray NUL), plus
    UTF-16LE and UTF-16BE with no BOM. Write them **with Windows PowerShell 5.1 itself here**, not only as bytes. A
    bare `--commit` exits 1 and leaves the tree identical (sha256, size, mtime, the read-only bit), and
    `--accept-stale` completes.
  - IF-22's list says `unreadable` is the only blocking could-not-tell reason, and that `no_session_log`,
    `no_declared_session` and `ahead_of_latest` do not block. Check it against `index.ts` (the table at about `:457`),
    and check that IF-10's +13/+1 still commit.
  - **Look for another shape:** an input that is readable but judged unreadable, or unreadable but judged readable.
    Candidates include a UTF-8 BOM followed by UTF-16, a file that is all NULs, a zero-byte file, and a file that
    another process holds open for writing.
- **R4-2 and R4-3:** QA 111's N5, Q1, Q17 and Q20 must be red. The developer reports N5 at 1/45.
- **The developer's own claim to check:** QA 106's `mutants-r2.mjs` runs a fixed list of five test files. That is why
  R4-2's test was duplicated into `state-import-r2.test.ts`. Confirm that the duplicate is the same test.
- **Merge check:** `9473b0d` (T-185, accepted with a round 2) and `78a7d13` in a scratch clone (`git merge --no-commit
  --no-ff`, then abort): no conflict in `cli.ts`, and tsc clean on the merged tree. Report it.
- **O7 was not done** (which snapshot to name is an open question). Record your view on it under "Open".

## CI and authority

- CI on **tcm** (free). Confirm the runner, and use at most **8** runs. Hosted minutes are exhausted until 2026-10-01.
- **Push only `qa/importer-fixes-r4-*`, through `node docs/loops/qa-122/push-qa.mjs <branch>`.** `git push` is denied.
- Never: master, merges, PRs, tags, releases, other seats' branches, or this PC's configuration.
- **A refusal or a denied command:** stop that line, record it verbatim, and continue.

## The report

- **Path:** `docs/loops/importer-fixes-r4-qa-report.md`, in QA 111's structure.
- **Model and effort** from your process command line and transcript.
- Commit the report and scripts (`docs/loops/qa-scripts-importer-r4/`, with a README) to `qa/importer-fixes-r4-report`,
  and push with `push-qa.mjs`.
- **The LAST line is exactly `QA-122: REPORT COMPLETE`.** No `/end` (T-163).
