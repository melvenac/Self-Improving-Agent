# Loop 15 slice three: dispatch of candidate A7 to a FRESH QA seat (record session 96)

**By:** Atlas (planner), record session 90 · 2026-09-24 (UTC). The live planner sends QA 96 a pointer to this file,
and QA 96 reports to that planner, found by `ListAgents`.

**First:** run `/start`. Your record number is **96**; the greeting's number is local (T-164). **Then:** bring the
QA tree to `origin/master` with `node open-brain/build/cli.js detach`. QA 94 left it detached at `853e758`.

## The candidate

- **A7 is `d223d1dbe4247fdc0131cd92bfc14288c52d7cf5`** on `origin/loop/15-slice-3-candidate-a7`. It is not for
  merge; the merge is Aaron's.
- It sits on A6 `dc35b24`. **This table is built from each commit's `git diff --stat`:**

  | Commit | Files it changes | Carries |
  |---|---|---|
  | `8d44f3e` | new `configwatch-a7-seam.test.ts` (+117), `configwatch-links.test.ts` (+179) | the tests only (the redcheck base) |
  | `e169733` | `configwatch.ts` (±27) | R64: attribution by stage-start `lstat` facts, `drifted` out |
  | `d2144ff` | `configwatch.ts` (±25), `runtime.ts` (+1), `config-channel.test.ts` (±11), `configwatch-links.test.ts` (±8) | R65: every machine path in every stage record |
  | `e018ee2` | `configwatch.ts` (±8), `configwatch-links.test.ts` (±5) | R67. **The test change is only D-042's flip:** R55's "replaced by a new file" goes from "not read" to "read", checked by the planner |
  | `32101e3` | `configwatch-a7-seam.test.ts` (+1) | R66: the R29 seam counts opens only after the plant |
  | `b36760a` | `configwatch.ts` (±2) | R66: TRADE-DIFF names both resolutions |
  | `0111bb0`, `d223d1d` | the handoff only | — |

- **Built by:** Grok 4.7 in Cursor, developer record session 95 (T-177). **Handoff:**
  `docs/loops/loop-15-slice-3-a7-developer-handoff.md` at `d223d1d`.

## Evidence the developer left, which the planner read per test (Linux CI)

**Re-read these yourself; do not inherit them.**

| Run | Head | What | Result |
|---|---|---|---|
| `36053246665` | `8d44f3e` redcheck | A7's tests on A6 | 9 failed: R64; both R65s; the three R67s; the handle; TRADE-DIFF; R29 (**R29's red was the test's own fault**, fixed in `32101e3`) |
| `36060449503` | `d223d1d` | the candidate | 1153 passed, 6 skipped |
| `36058556896` | mut-drifted | `drifted` back in attribution | R64 only |
| `36058567322` | mut-facts | size and mtime dropped from the facts | R57 only |
| `36058578477` | mut-record | no per-stage record | R65 "unchanged … as read" only |
| `36058592630` | mut-handle | the handle comparison dropped | the handle-swap seam test only (R29 stays green) |
| `36058625414` | mut-r50 | R50 reverted | R66 R50 only |
| `36058640092` | mut-r67 | R67 reverted to "same file" | four: R55 (D-042) and the three R67 rows |
| `36058651869` | mut-trade | TRADE-DIFF identities dropped | TRADE-DIFF only |
| `36059922307` | mut-type | the at-path type check dropped | the at-path row only |

**Not run by the developer:** a full local suite, and POSIX tests on its own seat.

## Score against

- The criteria **FINAL at `6672e83`**, read with **rulings-9 to rulings-14** on master. **D-042 (R67) amends D-041**:
  the read gate is the same real path, plus either the base file (`nlink` ignored) or a single-name regular file,
  re-checked on the handle. The row table in rulings-14 says how each touched row is scored.
- **Your predecessor's handoff:** QA report A6 §14.
- **Known positives:**
  - A6 `dc35b24`: GITCONFIG-LOOP, EXISTBETWEEN, and R29's instrument;
  - A5 `4c1287f`: A5-1's eight Linux shapes (`qa/loop-15-slice-3-a5-probe`);
  - A4 `f9a1aa8`: A4-1 (`qa/loop-15-slice-3-a4-probe`). **Under D-042, A4-1's R shape is now READ; H, J and LOOP stay
    unread.**

## Procedure

1. **Every row is re-run.** The probe files run on CI against A7 and A6 on your own `qa/*` branches (D-040).
2. **Three things the planner wants looked at specifically:**
   - **(a) No mutant has yet turned the R29 seam test red.** The redcheck's R29 red was the instrument's fault. Build
     one: for example, a mutant whose gate reads through a link the role planted. Show that the R29 test turns red
     under it.
   - **(b) R67's protective direction has no mutant.** mut-r67 reddens only the "allowed read" rows. Build the narrow
     one: drop the `nlink === 1` condition, so that any new file at the same real path is read. Show that a hard link
     to an outside file (A4-1 H) is then read and turns red.
   - **(c) D-042's trade, both ways, and a third case if one exists:**
     - a lock-and-rename is read;
     - a hard link made elsewhere does not stop reads;
     - a new two-name file is not read.
3. **R65:** every watched path, in every stage record, in one state, with true texts ("unreadable", never "absent";
   stage-start facts as "before").
4. **One mutant per protection;** check that each of the developer's eight reverts what it claims.
5. **Take plain `sync`'s exit code in a scratch clone.**
6. **LOCAL MEASUREMENT (mutants, probes, the full suite): tell the live planner BEFORE you start.** A2A-Hub's seats
   will be stopped for the WHOLE window, not only the suite, because load can make a mutant falsely red. Record
   `ListAgents` at the start and the end of the window.

## Authority (D-038, D-040)

- **Push:** your own `qa/*` branches, read back each one.
- **CI:** your own branches, without asking (D-040). **Mind the Actions budget.** It was at 90% on 2026-09-24. Batch
  probe files into one run where you can.
- **Questions for Aaron or the developer:** they go to the live planner.
- **Model and effort:** from your transcript.
- **No /end** (T-163).
