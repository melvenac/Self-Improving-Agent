# Importer fixes round 3: dispatch to a FRESH, HEADLESS QA seat (record session 111)

**By:** Atlas (planner), record session 109 · 2026-09-25 (UTC). **Where QA 111 runs:** the QA PC `desktop-o4egb1e`,
launched headless by `docs/loops/qa-111/drive.ps1`. **Nobody is watching live, and you cannot reach the planner.**
Questions go in "Open for the planner". Carry on with whatever does not depend on the answer.
**Not available here:** `/start`, the open-brain MCP server, the SessionStart hook, `gitnexus`.
**Temp and scratch (T-190):** the driver sets `TEMP`=`TMP`=`C:\qa-tmp`, and all scratch goes under `C:\qa-scratch`
(both Defender-excluded). **The one full-suite run is the Defender-on control:**
`TEMP="$QA_DEFAULT_TEMP" TMP="$QA_DEFAULT_TEMP" npx vitest run > file 2>&1; SUITE_EXIT=$?`. A failure only in the
control run is a finding.
**No git identity here:** pass it per command. Do not write any git config.
**QA seats run ONE AT A TIME on this PC** (they share this tree). The planner launches you after QA 108 has
finished. If `%USERPROFILE%sia-qa108` has no `done` marker, or a `claude` process from another driver is running,
**stop and write that into the report**. Do not run beside it.

## The candidate

- **`063662b`** on `origin/loop/importer-fixes-r3` (the handoff is at the tip, `00244d3`; the diff outside
  `docs/loops/` is empty). It is not for merge. Built by the Claude developer seat, record 110, effort **medium**
  (Aaron's word, and the transcript's 191 records; the seat's own first self-read said "low", which is recorded as a
  finding), on round 2's tip `665b3a2`.
- **Built from each commit's own `git diff --name-only`, read by the planner:**

  | Commit | Files | Carries |
  |---|---|---|
  | `718ab99` | `state-import/index.ts`, `state-import-r2.test.ts`, `state-import-r3.test.ts` | R3-2: Windows-1252 read and judged (the r2 test that pinned the defect changed, as the brief orders) |
  | `45077d7` | `state-import/index.ts`, the r3 test | R3-1: a failure removes only what this run created |
  | `ea8a7a0` | `state-import/index.ts`, the r3 test | R3-3: the `.import-incomplete` marker, and a half-restored project refuses |
  | `dfa1a2a`, `063662b` | the r3 test only | D7 reproduced on every platform (the copy-back variant); the marker test with and without `archive/` |
  | `1c15943`, `00244d3` | `docs/loops/` only | the handoff, the mutant script and diffs, and the quiet-box samples |

- **The redcheck:** `loop/importer-fixes-r3-redcheck` = `27e4a1d` (tests only, on `aba35de`).
- **The developer's mutants are committed** as a script plus diffs: `docs/loops/dev-scripts-importer-r3/`. **Run
  THEIRS, byte-exact**, and then your own. The developer ran them locally, so the planner could not read them.

## Score against

- **`docs/loops/importer-fixes-round-3-brief.md` §3, rows IF-16 to IF-20**, plus IF-1 to IF-15 (round 1's and
  round 2's briefs), which must still hold. All three briefs are on master.
- **Your predecessor's report:** QA 106's, on `origin/qa/importer-fixes-r2-report` (`9d50e1f`). Re-run its
  `probes-r2.mjs` and `probe-existing-snapshot.mjs` **byte-exact** (blobs `bf970cc`, `e015912`) against the candidate
  and against `aba35de`.
- **IF-20, utf16le-nobom, ruled by the planner before you score it:** the round-3 brief (R3-2) keeps "could not tell"
  for UTF-16 with no BOM. QA 106's probe expects STALE for that shape, so its one FAIL there is the **rule changing by
  ruling**, not a defect. Score it as such, and say whether any OTHER shape is filed "could not tell" that should be
  judged.
- **The full suite was NOT run on the developer's machine**, by the planner's ruling (that machine is never quiet
  during the day). **Your run is the only Windows full-suite evidence.** tcm CI 36198263294 is the Linux one.
- **Check, not accept, the developer's claims:**
  - D7 depends on readdir order (NTFS vs Linux). Reproduce it on this PC's NTFS at `aba35de`, with QA 106's real
    PowerShell-handle induction, and show the candidate loses nothing at every step.
  - R3-1: the `--force-snapshot` aside and the first-created directory never overlap.
  - R3-3: the refusal names the way out (restore, then remove the marker, naming its path).

## CI and authority

- Branches on the candidate run on **tcm** (free). Confirm the runner; at most **8** runs. **Hosted minutes are
  exhausted until 2026-10-01.**
- **Push only `qa/importer-fixes-r3-*`, through `node docs/loops/qa-111/push-qa.mjs <branch>`.** `git push` is denied.
- Never: master, merges, PRs, tags, releases, other seats' branches, or this PC's configuration.
- **A refusal or a denied command:** stop that line, record it verbatim, and continue.

## The report

- **Path:** `docs/loops/importer-fixes-r3-qa-report.md`, in QA 106's structure.
- **Model and effort** from your process command line and transcript.
- Commit the report and scripts (`docs/loops/qa-scripts-importer-r3/`, with a README) to `qa/importer-fixes-r3-report`,
  and push with `push-qa.mjs`.
- **The LAST line is exactly `QA-111: REPORT COMPLETE`.** No `/end` (T-163).
