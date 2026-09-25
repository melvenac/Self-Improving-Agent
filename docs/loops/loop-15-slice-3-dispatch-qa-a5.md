# Loop 15 slice three: dispatch of candidate A5 to a FRESH QA seat (record session 92)

**By:** Atlas (planner), record session 90 · 2026-09-24 (UTC). This is written to a file so that it survives the
planner rolling. **The live planner at dispatch time sends QA 92 a pointer to this file.** QA 92 reports to that
planner, found by `ListAgents`, not by name.

**First:** run `/start`. Your greeting's session number is local to your worktree (T-164), and your record number
is **92**. **Then:** the QA tree was left detached at `3ecfa70`. Run `node open-brain/build/cli.js detach` to bring
it to `origin/master` before anything else.

## The candidate

- **A5 is `4c1287f4e4b3420909428ba8ce007e03b0daafc5`** on `origin/loop/15-slice-3-candidate-a5`. It is not for
  merge; the merge is Aaron's.
- It sits on A4 `f9a1aa8`:

  | Commit | Carries |
  |---|---|
  | `70ec18c` | R55 (the object and route), R57 (the `begin` gate), R59 (both record texts), R58's tests |
  | `c1a8ca3` | handoff only |
  | `63a7932` | the fix for the in-place edit: `snap` compared `path.resolve` results and now uses `realpath` |
  | `5b3a0d1` | handoff only |
  | `63482c3` | handoff only |
  | `845dfaa` | R59's read half: its own test (report A4's `r54Revert` shape) |
  | `4c1287f` | handoff only |

- **One deviation from the brief, which the planner accepted:** the four items are in one commit (`70ec18c`), not
  one commit each. Rewriting it would have needed a force push. **Score each item by its own mutant, not by its
  commit.**
- **Built by:** Grok 4.7 in Cursor, developer record session 91 (T-177).
- **The developer's handoff:** `docs/loops/loop-15-slice-3-a5-developer-handoff.md` at `4c1287f`.

## Evidence the developer left, and the planner checked (all CI runs are Linux, git 2.55.0)

The planner read these from each run's per-test lines. **Re-read them yourself; do not inherit them.**

| Run | Head | What it is | Result |
|---|---|---|---|
| `35947532386` | `70ec18c` | A5's first cut | **failure**: its own R55 CONTROL (an in-place edit produced no finding). This is why `63a7932` exists |
| `35949006640` | `8bd34aa` on `loop/15-slice-3-a5-redcheck` | A5's tests on `f9a1aa8`, with no implementation | **6 failed**: R55 H, J and R, R57, R59 rollBack, and R59's read half |
| `35949008244` | `845dfaa` | A5's code at its last code commit | 1134 passed, 6 skipped, 0 failed |
| `35949009974` | `23269d3` on `…-a5-mut-b3` | mutant: restore `chmod`s through the link | 1 failed: R58 (b)3 only |
| `35949011700` | `c9232ad` on `…-a5-mut-r29` | mutant: the gate reads through the link | 12 failed, R58 R29 among them. **A broad mutant: it breaks the whole gate.** Decide whether R29's test is shown able to fail by a mutant that narrow |
| `35949013391` | `4e3a850` on `…-a5-mut-r35` | mutant: the base note omits type and `readlink` | 2 failed: the R35 symlink test, and R46 baseNotes |

**Not run by the developer:** a full local suite. The one CI run on the candidate's head is the success at
`845dfaa`; `4c1287f` changes only the handoff after it. D-040 lets you dispatch CI on your own branch.

## Score against

- The criteria **FINAL at `6672e83`**, read with **rulings-9 to rulings-12** on master:
  - R55 **sharpens R49's definition** (the object and route); R49's rule, its absent-at-base sentence and R54's two
    baselines are unchanged;
  - R56: CA-4f's "both hashes" for a path absent at base is read with R49 (your predecessor's reading);
  - R57: the repository `begin` read is gated against the loop's base (a unit test plus a mutant; U3 means it is
    not a probe);
  - **R58: from A5 on, a test that cannot fail is not evidence for its row.** Each test needs a code mutant or an
    earlier SHA that turns it red;
  - R59: a record's words come from what the runtime did ("not read", and rollBack's "reverted").
  - Rulings-12 has **a table of every row these touch**. Score those rows as that table says.
- **Your predecessor's handoff:** QA report A4 §14 (`docs/loops/loop-15-slice-3-qa-report-a4.md`).
- **The tools:** `docs/loops/qa-scripts-a4/`, and **QA 89's Linux probe**:
  `open-brain/tests/harness/qa89-a4-probe.test.ts` on `origin/qa/loop-15-slice-3-a4-probe` (`9f58fbc`). **A4 is
  the known positive for A4-1** in run `35928008495`.

## Procedure

1. **Every row is re-run.**
2. **Every CA-15 probe runs against A5, A4 `f9a1aa8` and A3 `5010199`**, in `git archive` copies and never in the
   main tree. A4 is the known positive for A4-1, and A3 is the known positive for A3-1 to A3-3.
3. **A4-1 on Linux:** put QA 89's probe file on `f9a1aa8` **and** on `4c1287f`, each on your own `qa/*` branch, and
   dispatch CI on both (D-040). H, J, R and LOOP must be red at A4 and green at A5. The in-place CONTROL must be
   green at both.
4. **R55 is read by the CODE PATH as well as the record** (report A4 §3.4): a traceless read passes the probes. Look
   for a sibling of A4-1 **before** scoring: whether anything a base link leads to, at any position, is still
   outside the compared route. Also check the other direction, as `35947532386` showed: whether any allowed read
   (the same object by the same route) is now suppressed.
5. **One mutant per protection:** R55's route walk, R57's gate and R59's two texts, each revertible alone. Check
   that each of the developer's named mutants reverts the protection it claims to.
6. **Read R58's tests against their rows** (report A4 §3.3's table). Print the value that lets each assertion fail.
7. **Take plain `sync`'s exit code in a scratch clone.**
8. **FULL SUITE: ask the live planner first.** A quiet machine is required (G-042):
   - A2A-Hub's local stack must be stopped (ports 3210, 4000 and 5173 free on this machine);
   - no A2A-Hub seat is running, and **no session in another project is busy**;
   - the planner stays idle.

   Record `ListAgents` before and after. QA 89's idle run in this tree was clean (exit 0, 1121 passed). The
   developer's full suite has not been run in any tree for A5.

## Authority (D-038, D-040)

- **Pushing:** push your own `qa/*` branches (the report, and any probe branches) and read each one back.
- **CI:** dispatch CI on your own branches without asking (D-040), and name each run id.
- **Questions for Aaron, or for the developer:** these go to the live planner. The developer is Grok, reachable
  only through A2A-Hub room `k57frxw0ptb8tadmqdwy0khhks8ey006`, and its session is finished.
- **The verdict:** goes to the live planner.
- **Model and effort:** record both, from your transcript's per-entry field.
- **No /end** (T-163).
