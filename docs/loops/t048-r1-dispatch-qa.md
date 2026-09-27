# T-048 round 1 (`/sync`'s checks must prove they looked): dispatch to a FRESH, HEADLESS QA seat (record session 151)

**By:** Atlas (planner), record session 146 · 2026-09-27 (UTC). **Runs from** `docs/loops/qa-queue.ps1`, via
`docs/loops/qa-151/drive.ps1`. **Record the machine.** **Nobody is watching live.** Questions go in "Open for the
planner".
**Not available:** `/start`, the MCP server, `gitnexus`. Use `C:\qa-tmp` and `C:\qa-scratch`, and commit the report
from a separate worktree. **Say whether this process runs elevated.** This round is about unreadable paths, so
elevation matters (QA 138's O-a). **Never write any live `state.json`.**

## The candidate

- **`7913c5f`** on `origin/loop/t048-r1`. The handoff is at `0ec1eba`, and everything after `7913c5f` is
  `docs/loops/` only. Built by Forge, record 148, **stacked on T-179 round 2 `1646567`**. Score only what this round
  adds.
- **The brief:** `docs/loops/t048-r1-brief.md`. **The audit:** `docs/loops/research/t048-silent-drops.md`, rows
  SILENT 1, 2, 3, 20 and 26.
- **CI on tcm:**
  - red `36286042335` (`a061f72`): 13 failed, exactly the red rows;
  - green `36286037658`: 1321 passed, 0 failed;
  - P1 mutant `36286040025` (`ec67acd`): the SILENT 1 row alone fails.
  - The developer reports 13 of 13 mutants killed.
- **The developer's own correction:** his first report called six local runs "tcm runs". Re-read the three run ids
  above per test yourself.
- **The planner read `7913c5f`'s `checks.ts` diff in full.** It did not read the test file.

## Check, not accept

1. **Each of the five checks, on a real unreadable path, not only on the mocks.**
   - The developer's 14 rows use a `vi.mock` of `node:fs` with a synthetic EACCES. Make at least one real
     unreadable file and one real unreadable directory on this machine, then run `sync --check` in a scratch clone.
     Candidate mechanisms: an ACL deny with `icacls`, a file held with share None, or a directory where a file is
     expected.
   - **Run it with and without `SeBackupPrivilege`.** An elevated process may read straight through a deny, which is
     exactly the "cannot see it" class this round exists for. Say which runs could see the path.
2. **Nothing new reads as a pass:**
   - an unreadable path is an ISSUE naming it, in all five checks;
   - each pass states what it walked and what it excluded;
   - the fallback walk says FALLBACK, and PARTIAL when a path was unreadable.

   Attack the edges:
   - `git ls-files` failing;
   - `git ls-files` listing nothing (the developer's addition (d));
   - an unreadable file that is ALSO historical, or ALSO an allowed referrer;
   - several unreadable paths alongside real findings. Does the output's cut-off at six hide the real finding?
3. **The widened retirements scan** (`.sh`, `.ps1`, `.yml`, `.yaml`, `.toml`, `.mts`, `.cts`). The developer reports it
   finds nothing new on this tree. Plant a retired name in a tracked `.sh` in a scratch clone: the base misses it and
   the candidate finds it. Check the count by extension in the output.
4. **Preserve:** `sync --check` on this repository's own clean tree gives the same verdicts at `1646567` and at
   `7913c5f`. `retirements` is an issue on both, naming ENTITIES.md. The tree is unchanged after `--check`.
5. **The developer's audit additions:**
   - (a) SILENT 3's "binary" catch never fires;
   - (b) SILENT 2 used to CRASH on an unreadable file;
   - (c) the allowed_referrers read still has no try, and is left open.

   Confirm each by a run. For (c), say whether it is a crash or a false pass.
6. **Your own mutants,** at least one per check, plus a re-run of P1.

## CI and authority

- tcm, at most **6** runs. **No laptop (`windows=true`) CI.** **Push only `qa/t048-r1-*`, through
  `node docs/loops/qa-151/push-qa.mjs`.**

## The report

- **Path:** `docs/loops/t048-r1-qa-report.md`.
- Order: the verdict first, then each check, mutants, CI, what could not be verified, defects, disagreements, error
  entries, and "Open for the planner".
- Commit to `qa/t048-r1-report`. **The LAST line is exactly `QA-151: REPORT COMPLETE`.** No `/end`.
