# T-179 round 2: the after-merge checklist, amended (R2-D3, R2-D4), for Aaron to walk

**By:** Atlas (planner), record session 146 · 2026-09-27.
- **Replaces** section 6 of `docs/loops/t179-r2-developer-handoff.md` (`d0335d7`), which QA 134 accepted with two
  checklist defects: R2-D3 (step 6) and R2-D4 (step 7).
- **The planner walks the read-only parts and the dry runs.** **Aaron** merges, and runs anything that changes his
  machine or the live record.

**Facts read today, 2026-09-27:**
- `origin/master`'s `.agents/state.json` is **v2 rev 133**. The planner's branch is identical to it.
- **None of the 13 stacked candidates changed any record file** (`state.json`, TASKS, `next-session.md`, SUMMARY)
  against its base: `git diff <merge-base> <candidate>`, 13 of 13 zero.
  - So a seat that merges master after the migration takes master's v3 record with no conflict.
  - R2-D3's "seat with record writes on its branch" has **no instance today**.

## 0. The merge

- The planner opens a PR `loop/t179-r2` → `master` (candidate `1646567`, handoff `d0335d7`).
- CI must be green, and the PR `MERGEABLE`/`CLEAN`.
- **Aaron merges.** It is code, and it migrates the live record.

## 1. Rebuild the main checkout. Do NOT reconnect yet.

In `~/Projects/Self-Improving-Agent`: `git pull`, then `cd open-brain && npm ci && npm run build`.

**Until step 2 lands, any session whose server was rebuilt is refused its greeting** ("STATE RECORD REFUSED"). That is
by design. Keep working in the sessions you have; reconnect nothing.

## 2. Migrate the live record, and re-render its views, in ONE commit (in the main checkout)

1. `node open-brain/build/cli.js state migrate --dry-run .agents/state.json`, and read it. The planner reads it too
   before step 2.2.
2. The same, without `--dry-run`.
3. `node open-brain/build/cli.js sync` (**without** `--check`). This re-renders the four views.
4. Commit `.agents/state.json` and the four views together, on a `docs/*` branch. Merged under D-032: every path is on
   its allowlist.

## 3. Reconnect

`/mcp reconnect open-brain` in each open Claude session. **Confirm by a greeting that shows the v3 record,** never by
the reconnect message.

## 4 and 5. Install the new `end.md` and register the SessionEnd hook

`node scripts/setup.mjs`, in the MAIN checkout only. Look for `SessionEnd hook registered (cli-session-end.js)` or
`already registered`.

## 6. Seat worktrees (AMENDED, R2-D3)

**Use the MAIN checkout's CLI.** A seat worktree usually has no build of its own, and QA 134 hit `MODULE_NOT_FOUND`.
- **A detached seat:** `node ~/Projects/Self-Improving-Agent/open-brain/build/cli.js detach`, run in the seat's worktree.
- **A seat on a working branch:** `git fetch origin && git merge origin/master`.
- **If that merge conflicts in `state.json` or a view** (none would today; see the facts above): take master's v3
  files (`git checkout --theirs .agents/state.json` and the views), then re-apply the seat's intended record changes
  **through `ob_state`**.
- **Never migrate a branch's own copy.** That makes a second, independent migration (G-027's shape).
- **Which seats:** `sia-builder`, `sia-infra`, `sia-forge`, `sia-research`, `sia-qa`, `sia-planner`. The `sia-a5-*`
  scratch worktrees were removed on 2026-09-27.
- The QA machines' `sia-qa` trees are moved by the queue's `-Checkout`, not by this step.

## 7. Other projects on this machine with a v2 record (AMENDED, R2-D4)

For each project (and QA 134 showed why the extra steps matter):
1. `node ~/Projects/Self-Improving-Agent/open-brain/build/cli.js state migrate --dry-run <project>/.agents/state.json`,
   and read it.
2. Run it.
3. **In that project, re-render and commit:** run the same CLI's `sync` (without `--check`) with that project as its
   directory. Then commit its `state.json` and views together. Without this, the project's `sync --check` fails
   `summary-version` and `state-views`.

**The projects:**
- `~/Projects/A2A-Hub` and its worktrees `~/Worktrees/a2a-*`: **Relay's (A2A-Hub's planner).** The planner asks Relay
  to run step 7 there, or to hand it back to Aaron.
- `~/Projects/frogger`: **v2 rev 0.** Pilot 1b restores it after `/bootstrap` r4 merges, so migrate it only if it is
  kept as it is.

## Known issues after the migration, not caused by it

- `retirements` (ENTITIES.md names `dream` and `reflection queue`).
- `greeting-size`: about 46,900 characters against a 40,000 limit. It was an issue before this candidate. T-183 owns it.
