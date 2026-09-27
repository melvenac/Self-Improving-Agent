# The `/bootstrap` fix round 3, stacked on T-179 round 2: dispatch to a FRESH, HEADLESS QA seat (record session 145)

**By:** Atlas (planner), record session 146 (this seat's greeting says 9, per T-164; uuid `cd5e385d-865d-498e-bb8c-53ff4eee82ad`) · 2026-09-27 (UTC). **Runs from**
`docs/loops/qa-queue.ps1`, via `docs/loops/qa-145/drive.ps1`. **Nobody is watching live.** Questions go in "Open for the
planner". **Not available:** `/start`, the MCP server, `gitnexus`. Scratch under `C:\qa-scratch`, temp in `C:\qa-tmp`,
and commit from a separate worktree. **Record the machine.** **Never write any live `state.json`.**

## The candidate

- **`7f4ca74`** on `origin/loop/bootstrap-fix-r3`. The branch tip is `ee3acce`, and everything after `7f4ca74` is
  `docs/loops/` only. It comes from Forge 141, effort medium, and is **stacked on r2 `b45900f`**, which is itself on
  T-179 round 2. QA 135 scored r2, and QA 134 scores T-179 round 2. **Score only what round 3 adds.**
- **Read ONLY:**
  - this file;
  - `docs/loops/bootstrap-fix-rulings-qa135.md` (R-BF-9 to R-BF-13, on this dispatch's commit);
  - the developer's handoff `docs/loops/bootstrap-fix-r3-developer-handoff.md` (on `origin/loop/bootstrap-fix-r3`);
  - its acceptance transcripts `bootstrap-fix-r3-acceptance-transcript.md` and
    `bootstrap-fix-r3-acceptance-known-positive-6543e8e.md`;
  - QA 135's own tests `qa135-bootstrap.test.ts`.
- **CI, as the developer reports it** (re-read each run yourself, per test):
  - red `36282324821`: 20 FAIL, all `AssertionError`;
  - green `36282961647` on `tcm-1`: 1368 passed, 2 skipped, `tsc` 0.
  - 13 of 14 mutants were killed. The survivor is the CLI's read-back branch, which is untested by design (handoff §5).

## The planner's rulings on the handoff's §6 (score with these)

- **R-BF-14 (§6.1): ACCEPTED. The widened `isProjectRoot` is in scope as R-BF-9's sibling.**
  - **Why:** the same walk-up serves `sync`, `ob_score`, `detach` and the session-end hook. In a non-Node child it
    resolved to a Node parent, which is the D2 class (a wrong-project write) that R-BF-9 exists to stop. Fixing only
    `state import` would have left the class open in four other doors.
  - **What the change can and cannot do:** it only ADDS roots, so a walk stops at a nearer directory, never a farther
    one. This is the fail-closed direction.
  - **The planner derived these before ruling:**
    - `b45900f` required `package.json` plus one of `.agents/SYSTEM`, `.agents/META` or `open-brain/`.
    - `7f4ca74` accepts `.agents/SYSTEM`, `.agents/META` or `.agents/state.json` alone, or `package.json` beside
      `open-brain/`.
    - On this desktop, `~/.agents/` holds only `mailbox/` and `reflection-queue.json`, so the home directory does not
      become a root.
  - **`project-template/` becoming a root is accepted.** It IS a project layout, and `sync` inside it answering for
    the template is the truthful answer.
- **R-BF-15 (§6.2): ACCEPTED. `archive/` is never residue.** "Never nest" cannot hold otherwise.
- **R-BF-16 (§6.3): ACCEPTED, bounded.** `move-residue` may move `state.json` ONLY when `check` calls it `NOT A RECORD`.
  A parseable record is never residue.
- **What the planner read before these rulings (amended at Aaron's question, "have you read the artifact before
  ruling?").**
  - **The first version of this file ruled on the handoff's account.** The only code it had read was `isProjectRoot`.
  - **The rulings were then checked against the code at `7f4ca74`:** `gitState`, `agentsState`, `notARecord`,
    `nextStep` and `moveResidue` in `pipelines/bootstrap/index.ts`. Also checked: PRD.md ("Project Template: `.agents/`
    scaffold for any new codebase"; automatic accumulation through the session-end hook).
  - **The code agrees with R-BF-15 and R-BF-16:**
    - `moveResidue` throws unless the state is `residue` or `not-a-record`, and in the second case it moves
      `state.json` alone.
    - The `archive/` filter drops only untracked (`?? `) lines, so a tracked file under `archive/` that has been
      modified still counts as dirty.
  - **The acceptance transcripts and the tests were NOT read by the planner.** Check 5 below is where they get read.
- **The not-done item:** "READER'S SEAT UNRESOLVED" on a not-a-seat checkout (handoff §8) is out of this round and
  becomes a task. It is not a defect of round 3.
- **The developer's own error entry** is accepted as that seat's, as written in handoff §9: the handoff commit `a1f5baf`
  was made on a 4-issue `sync` and pushed. The candidate's code is unaffected. Do not re-score it.

## Check, not accept

1. **R-BF-9 to R-BF-13, each against its row.**
   - QA 135's D1–D5 tests, unmodified: the file's blob must be `85ae260`. Check that yourself with `git hash-object`.
   - Each must be green at `7f4ca74` and red at `6543e8e`.
   - Read each ruling's wording against the code, not against the handoff's table.
2. **R-BF-14: attack the root walker.**
   - Find EVERY caller of `isProjectRoot`, `resolveRepoRoot` and `resolveHookProjectDir` by searching the source. Do not
     take the handoff's list; `gitnexus` is unavailable and the developer's index was 113 commits behind.
   - For each caller, is a nearer root ever WRONG? Look for a directory with a stray `.agents/state.json` or
     `.agents/SYSTEM/` sitting between a real project and the cwd.
   - SIA's own root must resolve unchanged from SIA's root, `open-brain/`, `open-brain/src/` and `docs/`. The stray
     `open-brain/.agents/` must not be a root.
   - A home directory with a mailbox-only `~/.agents/` must not be a root. Make it a known-negative row.
   - **Run the real built session-end hook** (`open-brain/build/cli-session-end.js`) in install (iii). Aim `HOME`,
     `USERPROFILE` and `KNOWLEDGE_V2_DB` at scratch. Show that its writes land in the CHILD and the parent gains
     nothing. The developer ran only the resolver (handoff §7, honest limits). **This is the row that decides whether
     R-BF-14 holds.**
3. **R-BF-15:**
   - An `archive/` that exists before `move-residue` is untouched, and nothing nests inside a new residue folder.
   - Does `gitState` ignoring every UNTRACKED `archive/` path also hide a TRACKED, modified file under `archive/`? It
     must not.
4. **R-BF-16:**
   - A valid, parseable `state.json` is never moved.
   - A tracked zero-byte `state.json` that gets moved shows as deleted in `git status`.
   - `Next:` names restore-from-git.
   - **PROBE, report and do not fail on it:** `notARecord` treats any JSON that parses and is not the seed as a record.
     So a `state.json` of `{}`, `[]`, `null` or `42` should read as BOOTSTRAPPED, as the planner read the code.
     - Confirm or refute that by running it.
     - Say what `/start` then does on each.
     - R-BF-11's wording ("parses") is met, so this is not a round-3 defect. **Put the result in "Open for the
       planner"**; the planner rules on it after the report.
5. **The acceptance, re-run by you, not read:**
   - installs (i) frogger's shape, (ii) an empty folder, and (iii-a)/(iii-b), all with no manual fix;
   - the developer's driver may be reused, but **validate it against `6543e8e` first**. It must fail there, as the
     known-positive transcript says.
   - **Add one install of your own design** that the developer did not try. A candidate: a child inside the parent's
     repository that is NOT its own repository (handoff §7's "nested and untracked"). `check` must STOP, and it must
     name what to do.
6. **Your own mutants,** at least:
   - `isProjectRoot` reverted to `b45900f`'s rule: the hook row must go red;
   - `archive/` treated as residue;
   - `move-residue` accepting a parseable `state.json`;
   - the `SCAFFOLDED` state removed.

## CI and authority

- tcm, at most **6** runs. **No laptop CI.** **Push only `qa/bootstrap-fix-r3-*`, through
  `node docs/loops/qa-145/push-qa.mjs`.**

## The report

- **Path:** `docs/loops/bootstrap-fix-r3-qa-report.md`.
- Order: the verdict first, then each check, mutants, CI, what could not be verified, defects, disagreements, error
  entries, and "Open for the planner".
- Commit to `qa/bootstrap-fix-r3-report`. **The LAST line is exactly `QA-145: REPORT COMPLETE`.** No `/end`.
