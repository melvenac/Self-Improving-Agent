# T-300 option A: clark gets its own SIA record, and the hand-kept handoff is frozen

Runtime: clark, in its own window (NOT headless). Step 5 needs Aaron to type one `!` command there. The content is
clark's own state, which only clark holds.
SEAT: desktop. No builds, tests or npm: only the built SIA CLI (`OB` below), git, and `ob_state` / `ob_start`.
ROOM: none. REPLY: tell Atlas `DONE T-300 <fleet sha40>` or `BLOCKED T-300 <step> <reason>`.

**By:** Atlas (planner), 2026-10-18, session 173. **Task:** T-300 (P2). **Aaron's word:** "yes" in clark's window
(e255061a, 2026-10-18T15:58:09Z), answering "Should clark get its own SIA record (T-300 option A) …". Atlas checked
it with relay-check. **Size:** SMALL. No SIA code changes; every step uses a tool that already ships.

`OB` = `node C:/Users/melve/Projects/Self-Improving-Agent/open-brain/build/cli.js`. `F` = `C:/Users/melve/Projects/fleet`.

## Where the record lives: `~/Projects/fleet`, not `~/Worktrees`

- **Why not `~/Worktrees`.** `~/Worktrees` is not a git repository (`git rev-parse` fails there). A record has to be
  tracked, and its tree-currency line compares it against an upstream. In `~/Worktrees` it would be one untracked file
  on one disk. That is the session-77 failure (CLAUDE.md: "An untracked file reaches ONE checkout").
- **Why fleet.** It is clark's own private repo (melvenac/fleet), already holds `fleet.json`, `roles.md` and
  `lessons.md`, and clark commits it directly on `main`. Its record follows it to any box that clones fleet.
- **Clark's window stays in `~/Worktrees`.** Nothing has to move. Each SIA call takes the path:
  `ob_set_session(project_dir: F)`, `ob_start(project_root: F)` and `ob_state(project_root: F, …)` all accept it,
  and so do `OB bootstrap … F` and `OB state import … F`.
- **Attribution works.** clark's SessionStart hook already writes the session proof ("Session proof written:
  session e255061a…" appears in its transcript), so `set_handoff` can be attributed.

## How the hand-kept handoff migrates and retires

`agent-dashboard/docs/handoffs/clark.md` is not in a format the importer reads. So the migration is by hand, once,
and small:

| Content in clark.md (the newest two ROLLs) | Goes to |
|---|---|
| where clark left off | the session handoff's `pick_up` (400 chars max) |
| standing cautions | `watch_out[]`, one line each, current ones only |
| questions waiting on Aaron | `open_questions[]` with `owner: "aaron"` (the T-298 lane reads these) |
| clark's own open jobs (not other lanes' work) | tasks in `INBOX.md` before the draft, then `ob_state` |
| the current objective | `task.md`'s `## Current Objective` before the draft |
| everything older | stays in clark.md as history; nothing is copied |

Then **clark.md is frozen, not deleted**. Its first line becomes
`FROZEN 2026-10-18 (T-300): clark's handoff is now ~/Projects/fleet/.agents/state.json. History only; do not write here.`
That change lands as an agent-dashboard docs PR. From then on clark writes no ROLL into it.

## Steps

1. **Look.** Run `OB bootstrap check F`. Expect `.agents/` to be `absent`.
   - Today fleet has two untracked paths, `.gitignore` and `hooks/` (they're clark's). Scaffold refuses a dirty tree.
   - Look at both and commit them as `fleet: before SIA` if they belong. If not, say so and stop.
   - `check` must end at `Next: … scaffold`.
2. **Scaffold.** Run `OB bootstrap scaffold F`.
   - It never overwrites, and it merges the template's `gitignore`/`gitattributes` into fleet's.
   - Read the tracked/local list it prints. A `VERIFY FAILED` means STOP.
   - **Skip bootstrap step 4 (CLAUDE.md).** fleet's CLAUDE.md is not loaded in clark's `~/Worktrees` window, so the
     SIA section would be text nobody reads.
3. **Make it clark's.**
   - In `F/.agents/AGENT.md`, set `name: Clark`. Leave `role: none`, since clark is not a planner, developer or QA
     seat. Only the startup hook text says NOT A SEAT; the briefing does not.
   - Create `F/.agents/SYSTEM/greeting.json` with the flag set Courier runs:
     `{"briefing_budget":true,"greeting_metrics":true,"handoff_by_checkout":true,"merged_citations":true,"missing_handoff":true,"role_docs_by_sha":true}`.
   - Add `!/.agents/SYSTEM/greeting.json` after the `.agents` rules in `F/.gitignore`, so a clone of fleet keeps the
     flags.
   - Edit `INBOX.md` (keep the four P0–P3 headings, one `- [ ] Title` per task) and `task.md`'s objective, per the
     table above.
4. **Draft.** Run `OB state import --draft --name "Fleet (clark)" F`. Expect `Validates: yes` and the task count you
   wrote, with no template-unchanged WARNING.
5. **Aaron commits the record.** Ask Aaron to type, in clark's window:
   `! node C:/Users/melve/Projects/Self-Improving-Agent/open-brain/build/cli.js state import --commit C:/Users/melve/Projects/fleet`
   This writes `state.json` rev 0. Then run `OB bootstrap install-commands F` only if step 1's `commands:` line said
   `OLD` or `absent`.
6. **Seed the handoff.**
   - Run `ob_set_session(session_id: <yours>, project_dir: F)`.
   - Then run `ob_state(project_root: F, ops: [{op: "set_handoff", …}])` with the pick_up, watch_out and
     open_questions from the table.
   - Then run `ob_start(project_root: F)`. Its `## Briefing` block must show your pick-up and Aaron's questions, and
     must not say `Handoff MISSING`.
7. **Commit fleet.**
   - Run `git -C F status --short --untracked-files=all`. Expect exactly scaffold's tracked list, plus
     `.agents/state.json`, `.agents/SESSIONS/next-session.md` and `.agents/SYSTEM/greeting.json`.
   - Commit `fleet: SIA record (T-300)` and push to `main`.
8. **Switch clark's /start and roll** (clark-ops is clark's own skill, so this is clark's edit):
   - **start.md / clark-start.sh:**
     1. `git -C F fetch` (tree currency compares against the last fetch).
     2. `ob_set_session(project_dir: F)`.
     3. `ob_start(project_root: F)`, printing its `## Briefing` … `## End Briefing` verbatim.
     4. Then the machine checks as today.
     - Drop the "newest block" cut of clark.md.
   - **The roll:**
     1. `ob_state(project_root: F, set_handoff)` replaces writing a ROLL into clark.md.
     2. Commit and push fleet's `state.json` and views directly on main (fleet takes no PRs today).
     3. Run `git -C F status` clean before a /clear.
9. **Freeze clark.md.** Add the FROZEN line above as an agent-dashboard docs PR.
10. **Proof on a fresh session.** At clark's next roll, the new session's /start prints the SIA briefing for fleet,
    with no read of clark.md. Send Atlas that briefing's first 3 lines and its line count. Atlas then scores it on
    the 7-question scorecard and records the V-entry.

## Not in this brief

- The global `~/.claude/CLAUDE.md` Identity line could point at fleet's record. That is Aaron's file, so it's a
  proposal only.
- A `coordinator` role value in SIA, which would remove the NOT A SEAT hook line. File it if that line turns out to
  be noise on the scorecard.
- Option B (a fleet-wide render over the planners' records). It stays parked.
