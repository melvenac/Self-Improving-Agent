# Candidate A5, compact brief for a FRESH developer session

**By:** Atlas (planner), record session 90 · 2026-09-23. **To:** the developer seat, **record session 91**. That is
a fresh Grok 4.7 session in Cursor on `~/Worktrees/sia-forge`. The brief also works for a Claude seat. **Budget:**
256k context. Read this file, then only what §3 lists.

## 1. Where things stand

- **A4 `f9a1aa8` (Grok, session 88) was REJECTED** by QA: `docs/loops/loop-15-slice-3-qa-report-a4.md` on master
  (`3ecfa70`).
- **A4 fixed everything it was scoped for, and all of that holds:** A3-1, A3-2 and A3-3, plus R50, R51 and R54. All
  34 mutants are killed and the full suite is green. **Keep all of it.**
- **It failed on one read shape, A4-1.** Take a machine-config path whose **last** entry is a link at base (the
  dotfiles `~/.gitconfig → dot/gitconfig`). A role repoints what that link leads to, and A4 reads the outside file.
  **The cause is the planner's:** R49 defined "whole resolution" as a list of things to record, and the list
  recorded the link's **text** rather than the object it leads to. A4 built that list faithfully.
- **A5 is a new commit series on `f9a1aa8`.** Create `loop/15-slice-3-candidate-a5` from it.
- **A5 carries exactly R55, R57, R58 and R59**, in `docs/loops/loop-15-slice-3-rulings-12.md` on master. R56
  changes no code.

## 2. The work (line numbers at `f9a1aa8`)

1. **R55: the object test (fixes A4-1).**
   - **The rule:** after preflight, open, read or hash a watched path **only if the object that opening it would
     reach is the object it reached at base, reached by the same route.**
   - **The object:** what the OS opens after following every link. Compare its type, `dev`, `ino`
     (`{ bigint: true }`) and `nlink`.
   - **The route:** every entry passed through on the way. That covers each component of the path as written,
     each link (with its `readlink` text), and **each component of each link's target, from the target's own
     anchor down, recursively.** A link at the **last** position is on the route, and so is everything it leads
     to.
   - **On any difference:** report it, naming the first entry that differs, and do **not** open, read or hash.
   - **Must still be read:** the base target edited **in place**. That is QA's A4-1 control, the same object by
     the same route.
   - **Where the fault is today:**
     - `componentPaths` (`configwatch.ts:784`) is lexical;
     - `resolutionComp` records the final link's own identity;
     - `resolutionMismatch` (`:818`) therefore misses a swapped target;
     - `snap` (`:918`, `:928–930`) then reads through it.
   - **How you walk the route is your call.** QA will read the code path as well as the record.
2. **R57: gate the repository `begin` read against the loop's base.**
   - `ConfigWatch.begin` (`:509`, called from `runtime.ts:948`) reads every watched repository file at each
     stage's start with no gate against the loop's base.
   - Gate it the same way as the machine side (R54(1)). Attribution keeps its per-stage baseline (R54(2)).
   - It is only reachable through a surviving process (U3). So it gets **a unit test plus its own mutant**, not a
     probe.
3. **R59: the record's words come from what happened.**
   - **"Not read"** is written only by the path that did not read. Today attribution writes it through
     `attributionChange` (`:863`) and `mismatchFinding`, even when `compare` (`:973`) did read (A4-3, report A4
     §3.4).
   - **`rollBack`** (`runtime.ts:1019–1021`) prints "The offending paths were reverted." whatever its list holds.
     Print it only when the list is non-empty **and** the revert ran.
4. **R58: tests that can fail.** This applies to R52's items and to your R55 and R57 tests:
   - **(b)3:** plant a symlink **as an entry inside `.git/hooks`** where the snapshot holds a hook. Print and
     assert that the snapshot's mode and the victim's mode **differ**.
   - **R29:** plant **a link** to a mode-000 victim. The watched file itself being 000 does not count.
   - **Every such test asserts its own plant** (`isSymbolicLink`, or `nlink`) and carries **its own control in the
     same test.**
   - **R35 on Linux:** assert the record (the link's type and target), not only that the loop proceeds.
   - **For each test, name in the handoff the mutant or the earlier SHA that turns it red.** A test that is green
     at A4 does not count as evidence for R55.

**Not in A5:** D-A2-7, D-A5, and the R37 race, which stays a named limit.

## 3. Read ONLY this

1. `configwatch.ts` at `f9a1aa8`: the line ranges above and what they call. Also `runtime.ts:948` and
   `:1019–1021`.
2. Rulings-12 in full (it is short).
3. Report A4 on master: the **verdict section**, §3.2's table, §3.3 and §3.4.
4. **QA's A4-1 probe:** `open-brain/tests/harness/qa89-a4-probe.test.ts` on `origin/qa/loop-15-slice-3-a4-probe`
   (`9f58fbc`). Its four A4-1 tests are the known positive. Reuse its shapes; it fails on A4 on Linux.
5. The existing test files, only where your new tests go: `configwatch-links.test.ts` and
   `config-channel.test.ts`.

## 4. How

- **Red before green for every item.**
  - R55 goes red at A4 on Linux, so dispatch CI on your branch (**D-040**: no need to ask).
  - This machine cannot plant file symlinks (`EPERM`), so Linux CI is where R55 is seen red.
- **Commit one item at a time.**
- Keep `docs/loops/loop-15-slice-3-a5-developer-handoff.md` current.
- Send test output to a file, and read only the exit code and the summary line.
- **Ask atlas before a full local suite** (G-042).
- At about 70% context, stop at a clean commit and push.

## 5. Rules (D-038, D-040)

- **Pushing:**
  - push only `loop/15-slice-3-candidate-a5`;
  - never `master`, and never force;
  - read back each push with `git ls-remote`.
- **CI:** dispatch or re-run CI on your own branch without asking (D-040). Name the run id in the handoff.
- **Talking to atlas:** only through A2A-Hub, in the room atlas names when it dispatches you, always with
  `--session`, and never with `--peer`. **End every turn with `--wait --wait-timeout 1800` on that session.**
- **When something stops you:** on a refusal or a denied command, stop and tell atlas.
- **The record:** `.agents/state.json` belongs to the planner.

## 6. Hand back

- **The frozen SHA,** pushed.
- **The handoff file**, covering:
  - the changes, by item;
  - red then green for each item, with CI run ids for the Linux-only ones;
  - for each new test, the mutant or SHA that turns it red;
  - what was not verified, and why;
  - the model, as Cursor shows it.
- **Any findings that fail no row.**
