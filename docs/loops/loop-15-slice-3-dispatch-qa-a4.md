# Loop 15 slice three: dispatch of candidate A4 to a FRESH QA seat (record session 89)

**By:** Atlas (planner), record session 81 · 2026-09-23. It is written to a file because the planner rolls, with
VS Code, before QA 89 starts. **The live planner at dispatch time sends QA 89 a pointer to this file.** QA 89
reports to that planner, found by `ListAgents`, not by name.

**First:** run `/start`. **Then:** the QA tree is left on `docs/qa-a3-scripts`, which is now merged. Run
`node open-brain/build/cli.js detach` before anything else.

## The candidate

- **A4 is `f9a1aa8`** on `origin/loop/15-slice-3-candidate-a4` (draft PR #130; not for merge, since the merge is
  Aaron's).
- It is six commits on A3 `5010199`:

  | Commit | Carries |
  |---|---|
  | `9788d32` | R49, the read principle |
  | `27c0e63` | R50, a base hard link is part of the base |
  | `403296d` | R51, CA-2.5's `.cmd` shim |
  | `544cf15` | R52, five POSIX tests |
  | `2db806a` | R54, the read gate versus stage attribution |
  | `f9a1aa8` | the handoff only |

- **Built by:** Grok 4.7 in Cursor, developer record session 88 (T-177).
- **The developer's handoff:** `docs/loops/loop-15-slice-3-a4-developer-handoff.md` at `f9a1aa8`.

## Score against

- The criteria **FINAL at `6672e83`**, read with rulings-9, rulings-10 and rulings-11 on master:
  - R43 and R44 are superseded for reads by R49;
  - R44's attribution is replaced by R54;
  - R51 to R53 answer QA report A3 §11;
  - R53 says a clause binds on shapes beyond the listed probes.
- **Your predecessor's handoff:** QA report A3 §14 (`docs/loops/loop-15-slice-3-qa-report-a3.md`).
- **The tools:** `docs/loops/qa-scripts-a3/` (probe15.mts, probe2.mts, the mutants, and a README with the
  rebase notes and the known positives).

## Procedure

1. **Every row is re-run.**
2. **Every CA-15 probe runs against A4, A3 `5010199`, A2 `2add792` and `3b19287`**, in `git archive` copies and never
   in the main tree.
   - A3 is the known positive for A3-1, A3-2 and A3-3.
   - A2 is the known positive for A2-1 to A2-5.
3. **R49 is read by the CODE PATH as well as the record** (QA report A3 §14.2): a traceless read passes the
   probes.
   - The R44 test's QA-stage assertion now expects no finding under R54, with `reread` asserted undefined.
   - Its no-read evidence in the QA stage therefore rests on code reading and a mutant. Score it that way.
4. **One mutant per protection.**
   - R49's repository side (`repositoryResolutionDiff`) and machine side (`resolutionMismatch`) are each
     revertible alone.
   - So is R54's attribution (`attributionChange`).
5. **R52's five POSIX tests are read from CI's per-test lines**: the verbose reporter, ANSI codes stripped, the
   `✓`/`↓` lines. Not from the counts.
6. **Take plain `sync`'s exit code in a scratch clone.**
7. **FULL SUITE: ask the live planner first.** A quiet machine is required (G-042):
   - A2A-Hub's local stack was STOPPED on Aaron's word, and must stay stopped through your run;
   - the A2A-Hub seats hold (their record, rev 25);
   - the planner stays idle.

   Record `ListAgents` before and after. **Two conditions are recorded** for the developer's own runs:
   - both exited 1, on the `onTaskUpdate` heartbeat only, in `~/Worktrees/sia-forge`, with 0 tests failed at
     `2db806a`;
   - every idle run in `~/Worktrees/sia-qa` tonight was clean.

   **The worktree is a suspect**, so record yours.

## Authority (D-038)

- **Pushing:** push your own report branch (`qa/loop-15-slice-3-report-a4`) and read it back.
- **Questions for Aaron, or for the developer:** these go to the live planner. The developer is Grok, reachable
  only through A2A-Hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`, and it has finished its session.
- **The verdict:** goes to the live planner.
- **Model and effort:** record both, from your transcript's per-entry field.
- **No /end** (T-163).
