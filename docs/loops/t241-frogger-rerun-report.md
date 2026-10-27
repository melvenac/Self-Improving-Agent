# T-241 frogger pilot re-run: report (QA PC job #194)

Brief: docs/loops/t241-frogger-rerun.md. SIA at d149450f. Copied verbatim from the job reply by Atlas (planner), session 175, 2026-10-26.
Planner ruling: F1-F13 and F15 graded FIXED except F11 (STILL PRESENT, minor); F14 N/A. New findings N1-N6 are filed as a follow-up task; N7/N8 are run artifacts, not SIA findings.

---

READY t241 d149450f FIXED 13/15

Reply path: C:\Users\Aaron Melven\Worktrees\sim-t241-reply.md
SIA clone = C:\Users\Aaron Melven\Worktrees\oneoff-sim-t241 (HEAD d149450f, clean). Frogger clone = %TEMP%\frogger-rerun, ended at b805cd6 "Bootstrap SIA" on master (local, no remote, nothing pushed).
Non-ASCII dashes in pasted output were changed to "-" in this file.

## Grading

| F# | Grade | Evidence |
|---|---|---|
| F1 | FIXED | Step c. Scaffolded INBOX has P0-P3 headings; `state import --draft` printed `Tasks: 3 (open 3, ...)` for the 3 tasks written. The 0-task WARNING exists in source (`state-import/index.ts:341`, "WARNING: ... exists but 0 tasks were parsed") but I did NOT exercise it in this run. |
| F2 | FIXED | Step 6 `state import --draft` then step 7 `--commit`: `Wrote:    .agents/state.json at revision 0`. |
| F3 | FIXED | Step 3: `OB bootstrap scaffold` lists `copied` for INBOX, task, SUMMARY, roles, commands (one source: project-template). |
| F4 | FIXED | Scaffold: `tracked copied .claude/commands/start.md` (and end, task, sync) - no global-copy skip. After: `commands: start.md SIA; end.md SIA; task.md SIA; sync.md SIA`. |
| F5 | FIXED | Step 1 check: `.agents/:  RESIDUE - reflection-queue.json (no state.json, no TASKS/)`; `CLAUDE.md: present, without the SIA section` -> bootstrap.md Step 4 offered the SIA section (appended). |
| F6 | FIXED | Scaffold ended `Verified with git: every file above is tracked or ignored exactly as stated`. Step 8 status listed exactly the tracked files + state.json + next-session.md + CLAUDE.md; commit b805cd6 = 17 files, `git status` empty after. |
| F7 | FIXED (from text) | bootstrap.md Step 2 item 2: "Not a repository: ask ... `git init` ... commit ... `git add -A -- . ":(exclude).agents"` ... `git commit -m "The project before SIA"`" and Step 3 scaffold "refuses a dirty tree". Project is committed before scaffolding. Not executed here (folder already a repo at 05ec972, as expected). |
| F8 | FIXED | Scaffold: `tracked generated .agents/AGENT.md`, `tracked copied .agents/roles/{shared,planner,developer,qa}.md`; all in `git ls-files`. |
| F9 | FIXED | Draft/commit output has no negative session; report line: `closed_session = 0`, `Current session: 0 ((no Session_N.md))`. "could not tell" is explained per file in the report ("no SESSIONS/Session_N.md to compare against"), though the stdout summary calls it neither expected nor fine (see N3). |
| F10 | FIXED | `.gitattributes` contains `/.agents/** text eol=lf` (and `/.claude/commands/*.md text eol=lf`), pasted in step 8. |
| F11 | STILL PRESENT | Record name `frogger` came from package.json (`"name": "frogger"`), but the draft summary prints only `Project: frogger` with no source. Source is stated only for the folder-name case (cli.ts:585). |
| F12 | FIXED | Step d: `Project: frogger v0.0.1` (twice, header and State). |
| F13 | FIXED | Step d: `Tree currency: NOT CHECKED - origin/master does not exist in this checkout - nothing to compare against. This is not a pass.` Plain, though `record source: LOCAL (origin/master unreadable: ...)` uses "unreadable" (N5). |
| F14 | N/A | Model behaviour. |
| F15 | FIXED | Step d: `Latest brief: none (looked in docs/loops/ and docs/loop-*-brief.md)`, no error. |

## Owner asks

| step | question verbatim | answer given |
|---|---|---|
| 2.1 (residue) | "Show the owner the entries `check` listed and say they will be moved, not deleted." (check listed: `reflection-queue.json`) | yes (pilot 1: Aaron approved) |
| 4 | "Append this SIA section to your CLAUDE.md?" | yes (pilot 1 shows no answer; default yes) |
| 5 | (no task source: frogger has no TODO/FIXME; "ask the owner what they are building") | I invented 3 tasks: lives counter + game-over (P1), high-score table, touch controls (P2). Pilot 1 shows none of its task titles. |
| 7 | OWNER STEP: `state import --commit` | run by me, labelled OWNER STEP |
| 8 | "If anything else appears, stop and ask the owner. Then, on the owner's word: git add -A / git commit" (nothing else appeared) | yes (pilot 1: approved commits) |
| 7b | not needed: all four commands already SIA after scaffold | n/a |

## New problems (not in F1-F15)

- **N1 - CONFUSING:** after `move-residue`, `git status --short --untracked-files=all` shows `?? .agents/archive/pre-bootstrap-residue-2026-10-26/reflection-queue.json`, yet `check` says `0 uncommitted change(s)` and the text says the folder "is local (the template gitignore ignores .agents/archive/)". True only after scaffold merges the gitignore; at that point it is untracked, and a bootstrap.md Step 2.3 reader who runs status sees a dirty tree.
- **N2 - MINOR:** the project's CLAUDE.md is CRLF; the SIA section from bootstrap.md has LF, so appending produces mixed line endings (git warns "LF will be replaced by CRLF" on add). bootstrap.md has no note on matching the file's endings.
- **N3 - CONFUSING:** `state import --draft` prints `unparsed lines 19` with no hint that these are the INBOX legend/How-to lines, and `2 could not tell` with no "expected at session 0" in stdout (only in the report).
- **N4 - MINOR:** `/start` CLI at session 1 prints `Your handoff - developer [legacy], session 0:` with an empty `pick up:`, `Session logs unreadable: not searched`, `Transcript directories unreadable: 0`, and `READS OWED (1): .agents/AGENT.md` - all read like faults on a clean fresh install. Seat name shown is the folder name (`frogger-rerun`).
- **N5 - MINOR:** `record source: LOCAL (origin/master unreadable ...)` and `Tree currency: NOT CHECKED` appear together and say the same thing twice; "unreadable" suggests a failure.
- **N6 - MINOR:** the scaffolded SUMMARY.md keeps `_Not yet defined. Will be populated after PRD is written._` and a Key Metrics table of zeros after import; no bootstrap step mentions a PRD. Step 5 says "Leave the status line", fine, but the leftover Architecture placeholder references a PRD the project does not have.
- **N7 - my own error (not SIA):** in step 5 a PowerShell helper of mine returned null and I wrote empty INBOX.md/task.md/SUMMARY.md (attempt 1). I restored them by copying the three files from `project-template/.agents/` (identical to what scaffold copied, nothing else was lost) and edited with the Edit tool (attempt 2). Everything below is from the restored, edited files.
- **N8 - MINOR:** `OB start` could not read the real fleet (`FLEET: unavailable (C:\Users\Aaron Melven\Projects\fleet\fleet.json: not found)`); it did not reach the real KB (KNOWLEDGE_V2_DB scratch used).

## Output of steps a-e (abridged where marked; every command is the one in the brief)

### a. SIA clone
```
node -v           v22.23.3
git rev-parse HEAD d149450f084a488b1c39b6bb27f84f9d567a0f60
git status --porcelain   (empty)
npm ci   -> exit 0   (tail: "To address all issues, run: npm audit fix")
npm run build -> exit 0
  copied 7 runtime asset file(s) into build/
  build stamped d149450
```

### b. Starting state
```
git checkout -q master; git rev-parse HEAD -> 05ec972ecb5193a95e83970a4108070038f07253
git branch -a:  * master / remotes/origin/HEAD -> origin/master / remotes/origin/master / remotes/origin/sia/bootstrap
git tag:        frogger-pilot1
git log --oneline -3: 05ec972 Initial commit: frogger arcade as it stood before SIA bootstrap
git remote remove origin; git remote -v -> (empty)
Get-FileHash .agents\reflection-queue.json -> SHA256 F038ECCC09B949CF1978BEC56BC24A1915060EAC642EB00C1E2746234007921B
Get-ChildItem -Force -Name: .agents .git src .gitignore CLAUDE.md index.html package-lock.json package.json README.md tsconfig.json vite.config.ts
git status --short --untracked-files=all: ?? .agents/reflection-queue.json
CLAUDE.md first lines: "# CLAUDE.md / This file provides guidance to Claude Code ... / ## Project / Browser-based arcade hosting two HTML5 Canvas reimplementations ..." (present)
```
Difference from pilot 1: pilot 1's folder was not a git repo (its step 1 ran `git init` -> 05ec972); this one is already a repo at 05ec972. The `.agents/` content (reflection-queue.json only) and CLAUDE.md match.

### c. Bootstrap
Step 1 `OB bootstrap check`:
```
bootstrap check - C:\Users\Aaron Melven\AppData\Local\Temp\frogger-rerun
Template:  C:\Users\Aaron Melven\Worktrees\oneoff-sim-t241\project-template
git:       repository root; has commits; 1 uncommitted change(s)
CLAUDE.md: present, without the SIA section
.agents/:  RESIDUE - reflection-queue.json (no state.json, no TASKS/)
commands:  start.md absent; end.md absent; task.md absent; sync.md absent
Next:      Move the residue aside first (`bootstrap move-residue`), then run check again.
```
Step 2.1 `OB bootstrap move-residue` (owner: yes):
```
bootstrap move-residue - moved, nothing deleted
To:      .agents/archive/pre-bootstrap-residue-2026-10-26/
Entries: reflection-queue.json
It is local (the template gitignore ignores .agents/archive/). Delete it yourself once you have looked.
```
check after: `git: ... 0 uncommitted change(s)`, `.agents/:  empty`, `Next:      Scaffold (`bootstrap scaffold`).`; git status: `?? .agents/archive/pre-bootstrap-residue-2026-10-26/reflection-queue.json` (N1).
Step 3 `OB bootstrap scaffold`:
```
  tracked  copied    .agents/TASKS/INBOX.md
  tracked  copied    .agents/TASKS/task.md
  tracked  copied    .agents/SYSTEM/SUMMARY.md
  local    copied    .agents/SESSIONS/SESSION_TEMPLATE.md
  tracked  generated .agents/AGENT.md
  tracked  copied    .agents/roles/shared.md, planner.md, developer.md, qa.md
  tracked  copied    .claude/commands/start.md, end.md, task.md, sync.md
  tracked  merged    .gitignore
  tracked  created   .gitattributes
Verified with git: every file above is tracked or ignored exactly as stated; state.json and next-session.md will be tracked; session logs and archive/ will not; .agents/ is eol=lf.
```
check after: `14 uncommitted change(s)`, `.agents/:  SCAFFOLDED - not yet imported; INBOX.md is still the template's`, `commands: ... all SIA`, `Next: ... continue at step 4 (CLAUDE.md), then step 5, then step 6`.
Step 4: SIA section appended (owner: yes). Step 5: 3 files edited (N7).
Step 6 `OB state import --draft`:
```
Root: C:\Users\Aaron Melven\AppData\Local\Temp\frogger-rerun
Project: frogger
Validates: yes
Current session: 0 ((no Session_N.md))
Staleness: 0 stale - 2 could not tell (.agents/TASKS/INBOX.md, .agents/TASKS/task.md) - 0 current. Details are in the report's first section.
Tasks: 3 (open 3, in_progress 0, blocked 0, done 0); superseded links 0; unparsed lines 19
Decisions: 0 (0 skipped) - verified 0 - gaps 0 - objective found
Handoff seat: developer (the role .agents/AGENT.md or AGENT.local.md declares)
SUMMARY.md: --commit will remove 24 lines (2 blockquote + 20 Current State)
```
Step 7 OWNER STEP `OB state import --commit`:
```
state import - committed
Snapshot: .agents\archive\pre-state-migration-2026-10-26 (12 files)
Wrote:    .agents/state.json at revision 0
SUMMARY.md: removed 24 lines (2 blockquote + 20 Current State); kept Architecture Overview, Key Metrics
Rendered: .agents/TASKS/INBOX.md, .agents/TASKS/task.md, .agents/SESSIONS/next-session.md, .agents/SYSTEM/SUMMARY.md
Role files: installed none - kept .agents/roles/shared.md, planner.md, developer.md, qa.md
Git files: none changed - unchanged: .gitignore ... .gitattributes ...
```
check: `.agents/:  BOOTSTRAPPED - state.json is a record`, commands all SIA, `Next: Already bootstrapped (.agents/state.json exists). Run /start.`
Step 7b: NOT RUN (commands already SIA).
Step 8 `git status --short --untracked-files=all`: ` M .gitignore`, ` M CLAUDE.md`, and `??` for .agents/{AGENT.md, SESSIONS/next-session.md, SYSTEM/SUMMARY.md, TASKS/INBOX.md, TASKS/task.md, roles/{developer,planner,qa,shared}.md, state.json}, .claude/commands/{end,start,sync,task}.md, .gitattributes. Owner: yes -> `git add -A; git commit -m "Bootstrap SIA"` -> `[master b805cd6] Bootstrap SIA - 17 files changed, 606 insertions(+)` (+ CRLF warnings on CLAUDE.md, .gitattributes).

Step 9 summary I would print:
```
Project on SIA.

[ok] git         - the project before SIA is its own commit (05ec972); SIA's files are the next (b805cd6)
[ok] .agents/    - state.json (the record) + its views; session logs stay local
[ok] .claude/    - /start, /end, /task, /sync
[ok] CLAUDE.md   - SIA section appended

Next: open a NEW session here and run /start.
```

### d. `OB start "%TEMP%\frogger-rerun"` (first lines in full, rest abridged)
```
Build d149450 - current (2 records-only commits behind)
Tree currency: NOT CHECKED - origin/master does not exist in this checkout - nothing to compare against. This is not a pass.
record source: LOCAL (origin/master unreadable: origin/master does not exist in this checkout (no remote, or nothing fetched)). Rendering this tree's own record, which may be older than master's.

Session Start - project mode
Project: frogger v0.0.1

Drift: none
Latest brief: none (looked in docs/loops/ and docs/loop-*-brief.md)

Session #1
Log: C:\Users\AARONM~1\AppData\Local\Temp\frogger-rerun\.agents\SESSIONS\Session_1.md
Session ID: none - CLI start: no MCP server process, so no session is proven (T-154)
Session logs unreadable: not searched (no session id, or no .agents/SESSIONS directory)
Transcript directories unreadable: 0

Seat: frogger-rerun (developer)
Role knowledge loaded (2 of 2): .agents/roles/developer.md @ b805cd6, .agents/roles/shared.md @ b805cd6

## State (state.json rev 0)
Project: frogger v0.0.1
Objective: **Add a lives counter and game-over screen to Frogger** (since session 0)
Tasks (3 active; done: 0): P1 [open] T-001 ...; [P2] 2 active: INBOX.md
Verified (0) / Gaps (0) / Decisions: 0 recorded
Your handoff - developer [legacy], session 0:
  pick up: 
Last session: #0 2026-10-26 - 1 writing session(s) in the record

## Briefing
Session 1 - 2026-10-27Z - frogger v0.0.1 - state rev 0 ; Drift: none
NEXT - [P1] T-001 ... ; 3 active (0 P0, 1 P1, 2 P2, 0 P3); 0 done.
FLEET: unavailable (C:\Users\Aaron Melven\Projects\fleet\fleet.json: not found)
PICK UP HERE (nothing recorded) ; Working tree: clean ; Latest brief: none (looked in docs/loops/ and docs/loop-*-brief.md)
READS OWED (1): .agents/AGENT.md ; Skills: none (no .agents/skills/INDEX.md)
```
(then the developer.md and shared.md stubs; Total returned words: 563.)

### e. Final state
```
OB bootstrap check:
  git:       repository root; has commits; 0 uncommitted change(s)
  CLAUDE.md: present, with the SIA section
  .agents/:  BOOTSTRAPPED - state.json is a record
  commands:  start.md SIA; end.md SIA; task.md SIA; sync.md SIA
  Next:      Already bootstrapped (.agents/state.json exists). Run /start.
git log --oneline --all --decorate:
  b805cd6 (HEAD -> master) Bootstrap SIA
  07640b8 (tag: frogger-pilot1) Bootstrap frogger onto SIA (T-181 pilot 1)
  05ec972 Initial commit: frogger arcade as it stood before SIA bootstrap
git status --short --untracked-files=all: (empty)
git ls-files .agents .claude CLAUDE.md .gitignore .gitattributes:
  .agents/AGENT.md  .agents/SESSIONS/next-session.md  .agents/SYSTEM/SUMMARY.md  .agents/TASKS/INBOX.md
  .agents/TASKS/task.md  .agents/roles/{developer,planner,qa,shared}.md  .agents/state.json
  .claude/commands/{end,start,sync,task}.md  .gitattributes  .gitignore  CLAUDE.md
```
