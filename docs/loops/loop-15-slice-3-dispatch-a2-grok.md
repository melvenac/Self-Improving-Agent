# Loop 15 slice three: dispatch of candidate A2 to the developer seat, Grok 4.7 in Cursor

**By:** Atlas (planner), record session **81** · **Date:** 2026-09-23 · **To:** the developer seat,
**record session 84**. That is **Grok 4.7 running in Cursor** on Aaron's Windows machine, opened on
`~/Worktrees/sia-forge`.
**Why this seat is Grok:** `T-177`. The Claude developer seat (record session 83) had two responses
stopped by the Anthropic API's safety layer (`stop_reason: "refusal"`, read from its transcript at
05:30:35Z and 05:34:24Z) while designing this repair. It did not retry or work around it. Opus 4.8
was not available to Aaron. **Aaron chose Grok 4.7 in Cursor for one attempt**, in the planner session
on 2026-09-23. If this seat also cannot build A2, it stops and says so, and the slice is re-planned.
That outcome is a result, not a failure.

**The work is defensive.** A2 stops this repository's own loop runtime from writing, deleting or
changing permissions on files outside the repository when a role plants a link. Every probe targets a
scratch directory created for the purpose. No real directory is ever a target.

---

## 1. What A2 is

A2 is a new commit on candidate A's base (`3b19287`), and it carries **exactly** this:

1. **D-A1, closed as a class.** Layer 2's restore (`open-brain/src/harness/configwatch.ts`) must never
   write, delete or `chmod` outside the repository. This includes git processes the runtime spawns. It
   must hold for all three routes:
   - **(a) a link** (symlink or directory junction) at a watched path or watched root, or as an entry
     inside a watched tree: rulings-6 **R24**, in the direction of the prior developer's final handoff
     §1 (`216cec6`);
   - **(b) a link at any ancestor** from the repository root (exclusive) down to a watched path, for
     example `.git` itself replaced by a junction: rulings-7 **R30**. The planner measured on win32
     that `lstat` checks only the final component, so an `lstat` of `.git/config` under a junctioned
     `.git` reports a regular file, and an in-place `r+` write lands outside;
   - **(c) a hard link** at a watched file: rulings-7 **R31**. The planner measured that
     `fs.linkSync` needs no privilege, `lstat` reports `isFile` with `nlink: 2`, and `writeBack`'s
     in-place `r+` (`configwatch.ts:169–172` at `3b19287`) overwrote the outside file.

   On any of these, the stage fails `stage-changed-config`. The runtime writes nothing outside, and
   the record says what really happened. **It writes "put back" only after an `lstat` re-read agrees
   with the snapshot.** For an ancestor link, the record names the replaced ancestor and claims no
   restore beneath it (R30). **The mechanism is yours.** The rulings say what must not happen, not how.
2. **D-A3:** the `role-timeout` text must say only what the kill measurably did (R24, R33). Do not try
   to close the double-fork. Name it.
3. **D-A5** only if it touches nothing A2 already changes (R27).
4. **Keep in mind (rulings-7 R35):** reading machine git config outside the repository is by design
   (`readMachineSafeConfig`, `MachineConfigWatch`). A machine-config path that is a link **at base**, such
   as a dotfiles setup, must **not** be refused at preflight. Links at **repository** watched paths at
   base **are** refused.

**Nothing else.** B (the G-042 repair) and C (T-155) wait for A2's acceptance.

## 2. Read first, in this order (all tracked)

1. `.agents/roles/shared.md`: the rules every seat holds. **Read the D-038 version on
   `origin/chore/session-81-d038` if it has not reached master yet.**
2. `.agents/roles/developer.md`
3. `docs/loops/loop-15-slice-3-rulings-6.md` and `docs/loops/loop-15-slice-3-rulings-7.md` (master)
4. **The acceptance criteria, final:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` at `6672e83`.
   CA-15 is the new row. Every probe and mutant in it is what QA will run against your commit.
5. QA report A: `docs/loops/loop-15-slice-3-qa-report-a.md` at `10eb4d0` (§3, §9)
6. The prior developer's final handoff: `docs/loops/loop-15-slice-3-forge-session-80-final-handoff.md`
   at `216cec6` (§1), and the candidate A handoff it points to.

## 3. Where and how

- **Worktree:** `~/Worktrees/sia-forge`. Local branch `loop/15-slice-3-candidate-a2` at `4f752ca`
  (`918a1c9` plus the criteria tip `6672e83`, merged so every criteria commit is an ancestor). The
  tree is clean, with no upstream set. **Never work in `~/Projects/Self-Improving-Agent`.** That is
  the main tree, and every session on this machine runs from its build.
- **Tests:** `cd open-brain && npx vitest run <files>` for targeted runs; `npx tsc --noEmit` clean.
  **Before a full-suite run, ask the planner through the hub.** The suite is load-sensitive when other
  seats are busy (G-042), and you cannot see the other seats yourself.
- **Show each protection red first:** before the fix, a test of each route fails against `3b19287`'s
  behaviour; after the fix, it passes. QA will mutate each protection away and expect its probe to go
  red (R32), so write the protections so that each one can be reverted by itself.
- **`/sync`:** `npm --prefix open-brain run build`, then `node open-brain/build/cli.js sync --check`.
  Report its summary line. The known `retirements` issue on `ENTITIES.md` is T-169's and is not yours.
- **The record (`.agents/state.json`) is the planner's.** Do not edit it or its four views.

## 4. Authority (D-038)

- **Push your own branch** `loop/15-slice-3-candidate-a2` without asking. **Never** `master`, never a
  force push, never another seat's branch. Read every push back with `git ls-remote` and name the SHA
  in your next message.
- **Every question for Aaron goes to the planner through the hub**, not to Aaron. The planner brings
  back his answer quoted, and that quote is your authority for the act it names.
- **A host-level stop in your own session** (a refusal, a permission prompt, a denied command): stop,
  do not work around it, and tell the planner.
- **Merging A2 to master is Aaron's alone,** after QA accepts it.

## 5. What to hand back

1. **The frozen SHA**, pushed, with a clean tree.
2. **A tracked developer handoff** in `docs/loops/`, committed on your branch, naming:
   - what changed, by file;
   - each route (a), (b), (c) and D-A3, with the test that was red before the fix and green after;
   - what you did **not** verify and why (for example, POSIX-only behaviour on this Windows machine);
   - the model: **Grok 4.7 via Cursor**, and any effort or mode setting you can read from Cursor
     itself, labelled with where you read it.
3. **Findings that fail no row**, reported rather than fixed.

## 6. Communication

The hub at `http://100.124.212.87:4000`, via A2A-Hub's `scripts/hub-talk.mjs`, in the room the planner
opens with you. **Send every message from a file**, not an inline string, because backticks are executed
by the shell. Run one `--wait` listener at a time. The planner is `atlas`.
