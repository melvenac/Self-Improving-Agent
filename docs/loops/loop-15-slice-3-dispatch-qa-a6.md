# Loop 15 slice three: dispatch of candidate A6 to a FRESH QA seat (record session 94)

**By:** Atlas (planner), record session 90 · 2026-09-24 (UTC). This is written to a file so that it survives the
planner rolling. **The live planner at dispatch time sends QA 94 a pointer to this file.** QA 94 reports to that
planner, found by `ListAgents`, not by name.

**First:** run `/start`. Your greeting's session number is local to your worktree (T-164), and your record number
is **94**. **Then:** bring the QA tree to `origin/master` with `node open-brain/build/cli.js detach`. QA 92 left it
detached at `697f9fa`.

## The candidate

- **A6 is `dc35b24869e77d2b62729d12598fb50e5adcd24b`** on `origin/loop/15-slice-3-candidate-a6`. It is not for
  merge; the merge is Aaron's.
- It sits on A5 `4c1287f`. **This table is built from each commit's `git diff --stat`, not from its subject**
  (rulings-13, error entry 1):

  | Commit | Files it changes | Carries |
  |---|---|---|
  | `023fcd0` | `config-channel.test.ts` (+10) | R63: the "reverted" sentence present after a revert |
  | `f77fd4f` | `configwatch.ts` (+/−291), `configwatch-links.test.ts` (+162) | R60, R61 and R62 together, and R63's (b) plants and controls |
  | `daac160` | `configwatch.ts` (+6), `configwatch-links.test.ts` (+/−33) | points the R60 stow tests at the real relative target, and a `routeEnd` check |
  | `8ad8728` | `configwatch-links.test.ts` (1 line) | **changes an assertion:** from `toContain(victim)` to `toContain("nlink 2")` |
  | `dc35b24` | the handoff only | — |

- **One deviation, which the planner accepted:** R60, R61 and R62 are in one commit. Score each by its own mutant.
- **Built by:** Grok 4.7 in Cursor, developer record session 93 (T-177). **Handoff:**
  `docs/loops/loop-15-slice-3-a6-developer-handoff.md` at `dc35b24`.

## Evidence the developer left, which the planner read per test (Linux CI, git 2.55.0)

**Re-read these yourself; do not inherit them.**

| Run | Head | What it is | Result |
|---|---|---|---|
| `35961731930` | `619bdb9` on `…-a6-redcheck` | A6's tests on A5, with no implementation | **6 failed:** four R60, R61 and R62. R63 was already green, because A5 had the behaviour |
| `35963678487` | `dc35b24` | the candidate | 1141 passed, 6 skipped, 0 failed |
| `35963349906` | `8dbb6c3` `…-mut-object` | the object test removed | 11 failed (R43–R45, R49, R55, R59, R60 different-file) |
| `35963360666` | `3c12e2f` `…-mut-handle` | the "handle" mutant | 5 failed: both R60 in-place edits, R55 CONTROL, R59 and CA-4f |
| `35963368623` | `62b16ef` `…-mut-rest` | `routeChain`'s `rest` fix reverted | 1 failed: the `routeEnd` test |
| `35963376352` | `f2e3498` `…-mut-unwatched` | R61 removed | 1 failed: R61 |
| `35963384988` | `beddeac` `…-mut-identity` | R62 reverted | 1 failed: R62 |
| `35963392393` | `3902557` `…-mut-revert` | the "reverted" sentence never printed | 1 failed: R63 |

**Not run by the developer:** a full local suite, and any POSIX test on its own seat (Linux CI only).

## Score against

- The criteria **FINAL at `6672e83`**, read with **rulings-9 to rulings-13** on master. **Rulings-13 R60 AMENDS
  CA-15 clause 3 for machine-config paths (D-041).** The read gate is the object, verified on the opened handle, and
  a newly planted link to the **same** base file may be read. Rulings-13 has a table of every row R60–R63 touch.
  Score those rows as it says.
- **Your predecessor's handoff:** QA report A5 §14.
- **The tools:** `docs/loops/qa-scripts-a5/`. The Linux probes are QA 92's on `qa/loop-15-slice-3-a5-probe`
  (`dfbac1b`) and QA 89's on `qa/loop-15-slice-3-a4-probe` (`9f58fbc`).

## Procedure

1. **Every row is re-run.**
2. **Known positives:**
   - A5 `4c1287f` for A5-1: QA 92's probe `35952428545`, and win32 `r35anchorEdit`;
   - A5 for A5-4: `probe-r57.mts` NEWBETWEEN;
   - A4 `f9a1aa8` for A4-1: `35928008495`.

   Run both probe files on CI against A6 **and** against A5 on your own `qa/*` branches (D-040). A6 must be green
   where A5 was red (A5-1's eight shapes), and A4-1's four shapes must stay unread.
3. **Four things the planner wants looked at specifically:**
   - **(a) The "handle" mutant may not test the handle re-check.** Its five reds are all reads that stopped
     happening, so it looks like a mutant that breaks reading, not one that removes only the `fstat`-on-handle
     comparison. **Build the narrow mutant:** keep the read, and drop only the identity comparison on the opened
     handle. Report whether any test turns red. If none does, the re-check is untested, and whether a deterministic
     test is possible is itself a finding. Consider a planted swap between resolve and open through a test seam.
   - **(b) `8ad8728` weakened an assertion,** from naming the victim to `"nlink 2"`. For a hard link the OS has no
     target path, so identity may be the honest "resolution". Judge whether R60's "report the path with its base and
     current resolution" is met, and whether the record still lets a reader see what happened.
   - **(c) D-041's trade, in both directions:** a new link to the SAME base file is read (allowed), and a new link to
     a DIFFERENT file is not read and is reported. **Look for a third case rulings-13 did not name.**
   - **(d) R61 over every watched path, in every stage record:** no path is absent. R63: are (b)1, (b)2, (b)4 and
     (b)6 each carrying their own plant assertion and control?
4. **One mutant per protection.** Check that each of the developer's six reverts the protection it claims to.
5. **R60 and R61 are read by the code path as well as the record.**
6. **Take plain `sync`'s exit code in a scratch clone.**
7. **FULL SUITE: ask the live planner first.** A quiet machine is required (G-042):
   - A2A-Hub's local stack stopped (ports 3210, 4000, 5173 free);
   - A2A-Hub's seats (Relay, Rivet, and its QA) told to stop;
   - no session in another project busy;
   - the planner idle.

   Record `ListAgents` before and after.

## Authority (D-038, D-040)

- **Pushing:** push your own `qa/*` branches and read each back.
- **CI:** dispatch CI on your own branches without asking (D-040), and name each run id.
- **Questions for Aaron, or for the developer:** these go to the live planner. The developer is Grok, reachable
  only through A2A-Hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`, and its session is finished.
- **The verdict:** goes to the live planner.
- **Model and effort:** record both, from your transcript's per-entry field.
- **No /end** (T-163).
