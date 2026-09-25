# Candidate B, Step 0: amendment 1 (sequencing, base, worktree)

**By:** Atlas (planner), record session 109 · 2026-09-25. **Amends:** `loop-15-slice-3-b-step0-brief.md` (record
session 90, `549117c`). Everything in that brief stands except the three items below.

## Why an amendment

The record contradicted itself on when B starts:

- The Step 0 brief, §0 and §2.3, says: **not before candidate A is accepted and merged**, and Step 0 runs at A's
  accepted SHA.
- The objective, from `d329c0d` (a planner write, rev 124 -> 125, 2026-09-24 23:29 -0500) through rev 130, says: B goes on the Claude developer seat
  **"NOT waiting for A"**.

No decision in `state.json` backs the second. It was a planner sentence in an objective write, and it silently
replaced a brief's stated condition. Both came from this seat. This amendment is the ruling that either line should
have had.

## R81: B's Step 0 does not wait for A

1. **Sequencing.** Step 0 starts without waiting for candidate A. The reasons:
   - A has been rejected nine times (A to A9), and A10 is in build. Waiting ties B's timing to a candidate whose end
     nobody can predict.
   - G-042 is a property of the test infrastructure and the machine's load. **Derived, not asserted:**
     `git diff --name-only origin/master 6bd97f2` (master `9bc06e3`, A9) outside `docs/` and `.agents/` is only
     `open-brain/src/harness/*`, `open-brain/tests/harness/*` and two lines of `.github/workflows/ci.yml`. No vitest
     config and no setup file. A adds tests, so it adds load, and that is why item 2's consequence exists.
   - Step 0 builds nothing in the product. It is a measurement. A measurement of G-042 at master is a measurement of
     G-042.
2. **Base.** Step 0 branches from **`origin/master` at the moment of dispatch**, not from A's SHA. That is `9bc06e3`
   (v0.44.2) today, or the importer merge if that lands first. The dispatch names the SHA. **Consequence, stated so
   B's criteria carry it:** if A merges before B's candidate is frozen, B's red-under-load is shown again on the
   new master before B's fix is judged. A red shown on an older base does not transfer.
3. **Worktree.** Step 0 runs in `~/Worktrees/sia-infra`, **after the importer round-2 work has left it** (QA 106's
   verdict, and Aaron's merge if it is accepted). `~/Worktrees/sia-forge` belongs to candidate A's seat while A10 is
   in build. Two seats never share one tree.

## What does not change

- **Machine rule (§3):** Step 0 IS load. Ask atlas before every run. Record `ListAgents` before and after. Grok's CI
  runs on tcm and does not count, but **any local suite, build or other project's session on this box does.**
- **Red first, n = 3, every step reported, and "not reproducible here" as the honest outcome (§2.3–2.5).**
- **QA writes B's criteria after Step 0 and before any fix.**
- **Not in Step 0:** the fix, `E_t`'s schema change (R10), anything of C.

## Dispatch (for Aaron to start the session; the planner cannot)

Start a fresh Claude Code session in `~/Worktrees/sia-infra` and paste:

> You are the developer seat (Forge), record session {N from the planner}. Read
> `docs/loops/loop-15-slice-3-b-step0-brief.md` and `docs/loops/loop-15-slice-3-b-step0-amendment-1.md` on
> `origin/docs/session-100-qa99-dispatch` (or master once merged), then the design at `e1173b1` on
> `origin/loop/15-slice-3-forge-design-b`. Branch `loop/15-slice-3-b-step0` from the SHA the planner names. Ask atlas
> before every run.
