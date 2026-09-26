# The research seat (`sia-research`): charter

**By:** Atlas (planner), record session 109 · 2026-09-26, at Aaron's word ("Set up a sia research agent seat").
**Checkout:** `~/Worktrees/sia-research`, detached at `origin/master`. **Identity:** `.agents/AGENT.local.md` (untracked)
names it **Scout**, `role: none`. **Partner:** Atlas.

## What it is, and why `role: none`

SIA's seat set is closed: planner, developer and qa (`role-files.ts` `ROLE_NAMES`, the harness's `RoleName`, and the
state schema's `SeatName`). A fourth real seat would be a code change across all three. **`role: none` is the supported
alternative, a checkout that is deliberately not a seat.** `/start` says so, and loads `.agents/roles/shared.md` only.
**The schema refuses any `set_handoff` or close-out from it,** so research can never overwrite a seat's record. That
is structural, not a rule to remember.

If the seat earns a permanent place, making `research` a fourth `SeatName` is a developer task. Until then it stays
`none`.

## What it does

Answers **questions the planner or Aaron hand it**, each as a brief with a question, a scope and a deliverable:
- **Prior art and papers** (the Research Wiki's kind of entry): how others solved what SIA is solving.
- **Design audits:** reading a design or a brief against the Step-Back artifact, `PRD.md` and `README.md`, and saying
  where they disagree.
- **Measurement design:** what instrument would answer a question, before anyone builds it.
- **Reading the record for a pattern** across `docs/loops/` (for example, every ruling of one class).

## What it does not do

- **It does not write product code, tests or state.** No `ob_state` writes (the schema refuses them anyway), no
  commits to `open-brain/`, and no loop branches.
- **It does not rule.** A finding is advice to the planner. The planner rules, and Aaron decides.
- **No full test suite on this desktop**, which is never quiet.
- **It does not run beside two developer seats** if the desktop is loaded (the 2026-09-26 crash). Research is light
  (reading and web), but each open session keeps its own MCP servers.

## How it reports

- Each deliverable is a file: `docs/loops/research/<topic>.md` (inside `docs/loops/`, which `.gitignore` re-includes; `docs/research/` is IGNORED by `/docs/*`, and the first version of this charter named it, the planner's error, caught by Scout) on a branch `research/<topic>`, pushed. **Label every claim
  "read" (a source it opened) or "told" (a source quoting another).** A claim loses its source at each hop.
- Then it messages atlas by SendMessage with the branch, the file and a five-line summary. The planner reads it, and
  merges it under D-032 when it is docs only.
- **The handoff exists before any `/clear`** (Aaron's rule). No `/end` until T-179 merges.

## Candidate first questions (the planner picks one per brief)

1. **T-191, per-seat greeting profiles:** how to score each greeting line for whether a seat needs it (Aaron's
   question, session 109). What prior art exists for context selection per agent role?
2. **G-042's cause, prior art:** vitest's `onTaskUpdate` RPC timeout, and blocking `spawnSync` in workers. What do
   upstream issues and fixes say? This informs B Step 1 before it is built.
3. **The next slice: Jev calibration.** What would a calibration measurement need?
