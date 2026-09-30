# Moving the builder and Forge seats to the QA PC

**By:** Atlas (planner), 2026-09-30, record session 150. **Aaron's direction, relayed Aaron → worktrees-d5 (Clark) →
Atlas:** "We need to move two devs from this computer over to the qa pc, this computer can't handle this many agents"
… "Move them when we can." The timing and order are the planner's ruling. The machine roles are D-065.

## What a SIA seat needs on a machine (read from this desktop's config, 2026-09-30)

A seat worktree alone is NOT enough. The desktop's `~/.claude/settings.json` and `~/.claude.json` point into the
**main checkout's build**:

- the MCP server `open-brain`: `node <main>/open-brain/build/server.js` (`/start` calls `ob_start` through it);
- a SessionStart hook: `<main>/open-brain/build/cli-bootstrap.js` (session proof, tree currency, role files);
- a SessionEnd hook: `<main>/open-brain/build/cli-session-end.js`;
- a PostToolUse (Bash) hook: `<main>/open-brain/build/cli-recall-trigger.js`.

So the QA PC needs its **own main checkout** as infrastructure, and it is not a spare worktree (shared.md): a clone at
`C:\Users\Aaron Melven\Projects\Self-Improving-Agent`, with `npm install` (not `npm ci` once servers run), a build,
and the four registrations pointing at it. **The profile path has a space**, so every hook command quotes its path.
Test that before relying on it (G-030's class).

**Memory splits by machine.** The QA PC's open-brain has its own `knowledge-v2.db`. **The record does not split:**
`state.json` travels by git through master (D-062), and that is what seats work from. What splits is recall and
session capture. Aaron decides whether that is acceptable. Clark is asking him. The planner's view: acceptable for
developer seats, because they work from the record, not from recall.

## Order

1. **Builder first, now.** It has just finished T-200, a clean stopping point. **Forge second**, at its next commit
   point in T-203. Nothing waits on T-203 landing: T-203 keys seats by worktree **basename** (`sia-forge`,
   `sia-builder`), which is the same on both machines.
2. **Before a seat stops**, on the desktop:
   - commit everything, including uncommitted work (Forge has an uncommitted `sync/seat-identity.ts`), then push every
     branch with work on it, including local-only mutant branches;
   - read each branch back with `ls-remote` and post the list to the planner;
   - write the per-seat handoff with `ob_state set_handoff` (NOT `/end`, T-163), naming the branch and the next step.
   - Pushes to `loop/*` don't touch the laptop queue: QA works on its own checkout of a fixed SHA.
3. **QA PC setup**, by Clark over SSH, on Aaron's word:
   - the main checkout, built, with the four registrations;
   - `C:\Users\Aaron Melven\Worktrees\sia-builder` and `\sia-forge` as git worktrees of that clone, detached at
     `origin/master`;
   - an untracked `.agents/AGENT.local.md` in each, with the seat's own identity: **Builder** for sia-builder and
     **Forge** for sia-forge (T-203's names). Not "Forge / developer" in both, which is G-049's defect;
   - git and `gh` credentials that can push `loop/*`;
   - Remote Control available.
   - **It must not touch** `sia-qa-queue`, `qa-queue.ps1`, `C:\qa-scratch`, `C:\qa-tmp` or the QA checkout.
4. **Aaron closes the desktop seat** (never kill by PID). On the QA PC he opens a Claude Code session in the seat
   worktree with Remote Control, `/rename`s it (`sia-builder`, `sia-forge`), and runs `/start`.
5. **The seat's first act:** `git fetch`, then check out its own branch from origin, rebuild, and report to the planner
   over Remote Control: machine, branch, SHA, record rev. The planner checks the `/start` output named the right seat
   and rev before sending work.
6. **The desktop worktrees stay** until Aaron says to remove them, after a dirty and unpushed check (shared.md).

## Verification per seat

- A planner message reaches it and its reply comes back (Remote Control bridge).
- Its `/start` shows master's record rev and its own seat. A stale rev means T-200 isn't merged yet: the seat fetches
  before starting.
- A branch pushed from the QA PC is readable from the desktop.

## Known limits

- **Forge's hub enrollment** was never completed on the desktop. If it happens on the QA PC, `forge.key` lives there;
  the code expires 24 h after 05:51Z.
- **The QA PC is not used for SIA QA until T-204** (the lease) ships. Developer suites there don't wait on anything
  yet. Laptop QA is unaffected.
