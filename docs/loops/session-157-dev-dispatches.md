# Session 157 dev dispatches: the /start items (T-208, T-212 to sia-forge; T-209, T-210, T-183 to sia-builder)

**By:** Atlas (planner), record session 157, 2026-10-02.

**Base:** `origin/master` `79d1f5d9`. It contains T-164 (#270) and T-211 (#272), so the greeting's session number and
the standing-cron line are already in.

**Job class: LIGHT for both.** Run only the touched test files and `tsc --noEmit`; CI runs the suite. A HEAVY step
needs a slot from clark, because the QA PC allows one HEAVY job at a time.

**Why now:** Aaron, relayed by clark at 07:3xZ, asked to keep every dev seat busy on downstream work that QA does not
block. These items are next in the handoff's backlog, item (d). Neither depends on QA 252.

**The two jobs touch separate files:**

- **sia-forge:** `pipelines/session-start/tree-currency.ts`, `cli-bootstrap.ts`, `shared/handoff-guard.ts`.
- **sia-builder:** `pipelines/session-start/state-render.ts` and whatever emits the brief line.

If either needs a file on the other's list, it stops and asks the planner.

Each task's ruling is its `note` in `.agents/state.json`, and the note is the acceptance text. The rows below restate
what QA will check.

## sia-forge: T-208 then T-212, one branch each, stacked: `loop/t208-fetch-first`, then `loop/t212-trailer-attribution`

### T-208: the SessionStart hook fetches before it judges currency

The hook is `cli-bootstrap`. It runs `git fetch --prune origin` with a bounded timeout BEFORE computing tree currency.
This happens on **startup AND resume**.

- **On failure:** it prints `fetch FAILED: <cause>; currency is against a fetch from <time>`, and it never says
  `level` without that qualifier.
- `ob_start` states the fetch time it compared against.
- The `/start` text gets **no** fetch step, because the hook owns it.

Rows, each with a fixture (no network):

1. **The origin moved after the last fetch:** red before the change (`level`), green after (`behind`).
2. **An unreachable origin:** prints the FAILED line and the old fetch time.
3. **A hanging remote** does not hang start: the timeout fires.
4. **A mutant that skips the fetch** goes red on row 1.
5. **Prune is proven:** a deleted remote branch is gone after start.
6. **The resume event** fires the same path.

**Not this task:** the Cursor copy (T-197).

### T-212: the missing-handoff check attributes commits by `Claude-Session` trailer, not git identity

A commit without a trailer is reported **UNATTRIBUTED**. It is never assigned to the checkout's seat by identity.

Rows:

1. **The blamed case:** two seats share one git identity, and the commits carry no trailer.
   - Red before: they are blamed on this seat.
   - Green after: they are reported UNATTRIBUTED.
2. **A trailer for another seat's session** is not counted against this seat.
3. **A trailer for this seat's session** is still counted.
4. **A mutant that falls back to identity** goes red on row 1.

**Handoff:** `docs/loops/t208-t212-developer-handoff.md` on the T-212 branch, with red and green output and both
SHAs. **Do not merge.** Open one PR per branch; that is the only PR action authorised.

## sia-builder: T-209 and T-210, then T-183 MEASURED, on one branch: `loop/t209-t210-render`

### T-209: `ob_start` renders gaps newest-first

Order by open session descending, then by id descending.

Rows:

1. **A fixture record:** the first rendered gap is the newest. It is red before the change.
2. **A mutant that keeps id order** goes red.

### T-210: `ob_start` emits the newest `docs/loops` brief itself, by git commit date

The brief line is `Latest brief: <path> (<commit date>)`. A "brief" is a `*brief*.md` file.

Rows:

1. **A fixture repo:** two briefs, where the higher loop number is older. The newer by commit date wins.
2. **No briefs:** the line is omitted. It is not left blank.
3. **The date comes from git, not mtime.** A touched old file does not win.

### T-183, measure first and do not cut yet

Measure `ob_start`'s output at the base, in this repo: total characters and the share taken by each section (header,
tasks, verified, gaps, decisions, handoff, role files). Gaps and verified already render truncated, so report what
still dominates.

**Change nothing in role-file loading.** That was deliberate, and changing it needs a ruling. Propose the cut in the
handoff, with numbers, and the planner rules on it.

**Handoff:** `docs/loops/t209-t210-developer-handoff.md` on the branch, with red and green output, the SHA and the
T-183 measurement table. **Do not merge.** Open one PR; that is the only PR action authorised.

## Rules (both)

- The repo is PUBLIC. No issues and no comments. The only PR actions are the ones named above.
- Report to `atlas-sia`, or to `clark` if it is unreachable.
