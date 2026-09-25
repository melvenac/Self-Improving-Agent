# Importer fixes, round 3: brief for a FRESH developer session (record session 110)

**By:** Atlas (planner), record session 109 · 2026-09-25. **To:** the Claude developer seat (Forge), **record session
110**, a fresh session (D-035) in **`~/Worktrees/sia-infra`**.
**Authority:** the planner's ruling on QA 106's report. The report is on `origin/qa/importer-fixes-r2-report`
`9d50e1f`, read by the planner: the verdict, all 15 rows, Defects, Disagreements, the error entries and "Open for the
planner". It was written while Aaron slept. **Starting the session is Aaron's act.** Merging and releasing afterwards
stay his (D-019).
**Why:** QA 106 passed IF-1 to IF-15 as written. Tested by class, two of round 2's own fixes regress against round 1:
**D6** deletes the snapshot a refusal names, and **D5** lets Windows-1252 text past T-180's block. D7 makes D6 a
data-loss chain. Adoption (T-181, D-048) waits on this.

## 1. Start

1. `/start`. Your record number is **110**. The greeting's number is local (T-164).
2. Branch from round 2's tip: `git fetch origin && git switch -c loop/importer-fixes-r3 origin/loop/importer-fixes-r2`
   (`665b3a2`: candidate `aba35de` plus its handoff).
3. `npm ci && npm run build` in `open-brain`.
4. **Read:**
   - this brief;
   - QA 106's report **in full** (424 lines):
     `git show origin/qa/importer-fixes-r2-report:docs/loops/importer-fixes-r2-qa-report.md`. Its scripts are in
     `docs/loops/qa-scripts-importer-r2/`. **`probe-existing-snapshot.mjs` is D6's known positive**;
   - round 2's brief `docs/loops/importer-fixes-round-2-brief.md` and round 1's `importer-fixes-brief.md`. **IF-1 to
     IF-15 must all still hold.**

## 2. The work (sites at `aba35de`, from QA 106)

**R3-1 (D6, high): a refusal never deletes what it names.**
- `takeSnapshot` throws its "already exists — pass --force-snapshot" refusal (`state-import/index.ts:728`) inside the
  `try` at `:791`. The `catch` at `:795` runs `rmSync(snapshotDir, …)` on any error, so the named snapshot is gone
  by the time the message prints.
- **The class:** a cleanup that removes what it did not create. Remove only what **this run** created: record it at
  creation, not by path. Make the existence refusal happen before anything is written. Check every other `rmSync` and
  `rm` in the importer's failure paths for the same shape, and list what you find.
- **Test:** a same-day snapshot plus a plain `--commit`, and the same with `--accept-stale`. Both refuse, and the
  snapshot is byte-identical afterwards. **This test must also kill N13** (QA 106's mutant that removes the partial
  snapshot's `rmSync`, which survived 0/44). Show both.

**R3-2 (D5, medium–high): an encoding detail never turns a STALE input into "could not tell". This is R2-1's own
sentence, applied to the class.**
- An input that is not valid UTF-8 and has no BOM is filed as "could not tell", so it does not block. Windows-1252
  is PowerShell 5.1's `Set-Content`/`Add-Content` default, and its session marker is ASCII.
- **RULING (QA 106's open question 2): decode as Windows-1252 and judge as usual.** Every ASCII byte is unchanged,
  so the verdict is reliable. Name the encoding in the evidence string. Keep "could not tell" only for text that
  really cannot be read (the NUL case, UTF-16 without a BOM).
- **Change the candidate's own test** that asserts the current behaviour ("an input that is not UTF-8 … says so").
  It pins the defect.
- **Known positive:** the three Windows-1252 shapes in QA 106's R2-1 table (`evidence/ps51-bytes.out`). Stale must
  refuse without `--accept-stale`, as round 1 does.

**R3-3 (D7, medium; high with D6): a failed rollback leaves a project that says so.**
- **RULING (open question 3):** "restore by hand from the kept snapshot" is an acceptable end state **only if**
  nothing later can make it worse. So: while a same-day snapshot exists and `state.json` does not, `--draft` and
  `--commit` refuse, name the snapshot, and say to restore from it. A marker file is acceptable if the check that
  reads it is the refusal.
- **Better, if it is cheap:** restore by copying the snapshot **over** `.agents/` first, and only then remove what
  the snapshot does not hold, so a failure part-way costs no original. Your call. Say which you built.
- **Known positive:** QA 106's rollback-failure sequence (a read-only share handle on SUMMARY.md), step by step.
  After R3-1 and R3-3, `Session_7.md` exists at every step.

## 3. Rows

| Row | Passes when |
|---|---|
| IF-16 | R3-1: both same-day-snapshot refusals leave the snapshot byte-identical. The test is red at `aba35de`, and N13 and the new guard's mutant are red. |
| IF-17 | R3-1's class list: every failure-path remove in the importer is named, with its creator. |
| IF-18 | R3-2: the three Windows-1252 stale shapes refuse without `--accept-stale`, and the evidence names the encoding. The NUL and UTF-16-without-BOM shapes are still "could not tell". |
| IF-19 | R3-3: QA 106's rollback-failure sequence loses no original at any step, and a re-run refuses while the project is half-restored. |
| IF-20 | IF-1 to IF-15 still hold, and QA 106's `probes-r2.mjs` fails only where round 3 changed the rule (R3-2), and says so. |

## 4. How

- **Red first:** the new tests alone on `aba35de`, as `loop/importer-fixes-r3-redcheck`. Report that run per test.
- **One commit per R3 item.** A code mutant for each protection, `tsc --noEmit` clean before it counts.
- **CI on tcm** is free (D-040, D-044). Confirm the runner and read each run per test.
- **Ask atlas before a full local suite** (G-042: this box is shared).
- **Out of scope:** O1 (`""` as the directory) goes to T-185's shared parser; O3 needs no change now; O5 goes to the
  QA driver template.

## 5. Rules and hand-back

- Push only `loop/importer-fixes-r3*` (D-038). Never master, never force, and read back each push.
- The handoff is at `docs/loops/importer-fixes-r3-developer-handoff.md` on the branch: every row with its run id and
  per-test result, each mutant and what it reddened, what was not verified, and your model and effort.
- On a refusal or a denied command: stop, and tell atlas.
- No `/end` (T-163).
