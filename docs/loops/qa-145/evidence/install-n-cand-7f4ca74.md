# QA 145 install (N): a nested, untracked child

SIA: `C:\qa-scratch\bf145\cand`. Scratch: `C:\qa-tmp\qa145-install-n-AXr3kK`. Node v22.23.2, win32.

```
$ git init -q -b master

[exit 0]
```

```
$ git add -A
warning: in the working copy of '.agents/SYSTEM/SUMMARY.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.agents/TASKS/INBOX.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.agents/TASKS/task.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'index.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
[exit 0]
```

```
$ git commit -q -m parent

[exit 0]
```

> The parent is a repository with .agents/ and a package.json. tools/csvtool/ (pyproject.toml, no package.json) sits inside it, untracked, and is not its own repository.

## Step 1

```
$ OB bootstrap check
bootstrap check — C:\qa-tmp\qa145-install-n-AXr3kK\node-parent\tools\csvtool
Template:  C:\qa-scratch\bf145\cand\project-template
git:       inside another repository at C:/qa-tmp/qa145-install-n-AXr3kK/node-parent
CLAUDE.md: absent
.agents/:  absent
Next:      STOP: this folder is inside another repository (C:/qa-tmp/qa145-install-n-AXr3kK/node-parent). Bootstrap a project at its own repository root.
[exit 0]
```

**OK** — check STOPs: STOP: this folder is inside another repository (C:/qa-tmp/qa145-install-n-AXr3kK/node-parent). Bootstrap a project at its own repository root.

**OK** — check names the enclosing repository (git's form: forward slashes)

**OK** — check names an action a stranger can take here (git init, or make this folder its own repository): STOP: this folder is inside another repository (C:/qa-tmp/qa145-install-n-AXr3kK/node-parent). Bootstrap a project at its own repository root.

> bootstrap.md step 1 is read for the STOP row next.

bootstrap.md lines that mention the nested case:

    If `git:` says `inside another repository`, **stop**: bootstrap a project at its own repository root.

**FAIL** — bootstrap.md says what to do in the nested case (git init the child, or move it out): 1 line(s)

## The stranger ignores STOP and runs each later step

```
$ OB bootstrap scaffold
bootstrap scaffold refused: inside another git repository (C:/qa-tmp/qa145-install-n-AXr3kK/node-parent) — bootstrap a project at its own repository root. Nothing written
[exit 1]
```

**OK** — scaffold refuses and writes nothing

```
$ OB state import --draft
state import refused: C:\qa-tmp\qa145-install-n-AXr3kK\node-parent\tools\csvtool has no .agents/ directory. The import reads THIS directory's .agents/ and never walks up into a parent, whose record is not this project's. Run it from the project root, or pass the project directory. Nothing written.
[exit 1]
```

**OK** — state import --draft refuses (no .agents/ here) and never walks up

**OK** — the parent gained nothing so far

## The stranger makes the child its own repository (the only reading of "at its own repository root")

```
$ git init -q -b master

[exit 0]
```

```
$ OB bootstrap check
bootstrap check — C:\qa-tmp\qa145-install-n-AXr3kK\node-parent\tools\csvtool
Template:  C:\qa-scratch\bf145\cand\project-template
git:       repository root; NO commit yet; 2 uncommitted change(s)
CLAUDE.md: absent
.agents/:  absent
Next:      Commit the project as it stands (the repository has no commit yet), leaving .agents/ out of that commit (`git add -A -- . ":(exclude).agents"`), before anything is scaffolded.
[exit 0]
```

**OK** — check's Next names the step taken (2.2 the before-SIA commit)

```
$ git add -A -- . :(exclude).agents
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'csvtool/__main__.py', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'pyproject.toml', LF will be replaced by CRLF the next time Git touches it
[exit 0]
```

```
$ git commit -q -m The project before SIA

[exit 0]
```

```
$ OB bootstrap check
bootstrap check — C:\qa-tmp\qa145-install-n-AXr3kK\node-parent\tools\csvtool
Template:  C:\qa-scratch\bf145\cand\project-template
git:       repository root; has commits; 0 uncommitted change(s)
CLAUDE.md: absent
.agents/:  absent
Next:      Scaffold (`bootstrap scaffold`).
[exit 0]
```

**OK** — check's Next names the step taken (3 scaffold)

```
$ OB bootstrap scaffold
bootstrap scaffold — C:\qa-tmp\qa145-install-n-AXr3kK\node-parent\tools\csvtool
Template: C:\qa-scratch\bf145\cand\project-template

Written (tracked = committed with the project; local = this disk only, by design):
  tracked  copied    .agents/TASKS/INBOX.md — the task list `state import` reads into the record; afterwards a rendered view of it
  tracked  copied    .agents/TASKS/task.md — the current objective `state import` reads; afterwards a rendered view
  tracked  copied    .agents/SYSTEM/SUMMARY.md — the project summary; its marked region is rendered from the record
  local    copied    .agents/SESSIONS/SESSION_TEMPLATE.md — the shape of each per-session log, and session logs are local
  tracked  generated .agents/AGENT.md — declares this checkout is not a seat (role: none), so /start says so instead of NO SEAT IDENTITY RESOLVED
  tracked  copied    .claude/commands/start.md — /start — travels with the project, so a clone on another machine has it
  tracked  copied    .claude/commands/end.md — /end — store the session's lessons
  tracked  copied    .claude/commands/task.md — /task — pick up the next priority
  tracked  copied    .claude/commands/sync.md — /sync — validate before a commit
  tracked  merged    .gitignore — tracks the record and its views under .agents/ and keeps the rest local
  tracked  created   .gitattributes — keeps .agents/ LF on every checkout, so core.autocrlf cannot rewrite the record's bytes

Verified with git: every file above is tracked or ignored exactly as stated; state.json and next-session.md will be tracked; session logs and archive/ will not; .agents/ is eol=lf.
[exit 0]
```

**OK** — scaffold exits 0

```
$ OB bootstrap check
bootstrap check — C:\qa-tmp\qa145-install-n-AXr3kK\node-parent\tools\csvtool
Template:  C:\qa-scratch\bf145\cand\project-template
git:       repository root; has commits; 10 uncommitted change(s)
CLAUDE.md: absent
.agents/:  SCAFFOLDED — not yet imported; INBOX.md is still the template's
Next:      Scaffolded, not yet imported: continue at step 4 (CLAUDE.md), then step 5, then step 6 (`state import --draft`). .agents/TASKS/INBOX.md still holds the template's example tasks: step 5 replaces them with this project's.
[exit 0]
```

**OK** — check's Next names the step taken (4 CLAUDE.md)

```
$ OB state import --draft

state import — draft (nothing else changed)

Root: C:\qa-tmp\qa145-install-n-AXr3kK\node-parent\tools\csvtool
Project: csvtool — the folder's name: there is no package.json name, and none is needed
Draft:  .agents/state.draft.json
Report: .agents/state.import-report.md
Validates: yes
Current session: 0 ((no Session_N.md))
Staleness: 0 stale · 2 could not tell (.agents/TASKS/INBOX.md, .agents/TASKS/task.md) · 0 current. Details are in the report's first section.
Tasks: 1 (open 1, in_progress 0, blocked 0, done 0); superseded links 0; unparsed lines 0
Decisions: 0 (0 skipped) · verified 0 · gaps 0 · objective found
Handoff: pick_up 0 lines, watch_out 0, open_questions 0
SUMMARY.md: --commit will remove 24 lines (2 blockquote + 20 Current State)

Review the report, then run: open-brain state import --commit
[exit 0]
```

**OK** — the draft validates for THIS folder, named by the folder

```
$ OB state import --commit

state import — committed

Root: C:\qa-tmp\qa145-install-n-AXr3kK\node-parent\tools\csvtool
Could not tell whether current: .agents/TASKS/INBOX.md, .agents/TASKS/task.md
Snapshot: .agents\archive\pre-state-migration-2026-09-26 (7 files)
Wrote:    .agents/state.json at revision 0
SUMMARY.md: removed 24 lines (2 blockquote + 20 Current State); kept Architecture Overview, Key Metrics
Rendered: .agents/TASKS/INBOX.md, .agents/TASKS/task.md, .agents/SESSIONS/next-session.md, .agents/SYSTEM/SUMMARY.md
Moved into snapshot: .agents/archive/pre-state-migration-2026-09-26/state.draft.json, .agents/archive/pre-state-migration-2026-09-26/state.import-report.md
[exit 0]
```

**OK** — --commit writes the child's record

```
$ git add -A
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/end.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/start.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/sync.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/task.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.gitattributes', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'CLAUDE.md', LF will be replaced by CRLF the next time Git touches it
[exit 0]
```

```
$ git commit -q -m Bootstrap SIA

[exit 0]
```

```
$ OB bootstrap check
bootstrap check — C:\qa-tmp\qa145-install-n-AXr3kK\node-parent\tools\csvtool
Template:  C:\qa-scratch\bf145\cand\project-template
git:       repository root; has commits; 0 uncommitted change(s)
CLAUDE.md: present, with the SIA section
.agents/:  BOOTSTRAPPED — state.json is a record
Next:      Already bootstrapped (.agents/state.json exists). Run /start.
[exit 0]
```

**OK** — a final check says BOOTSTRAPPED

**OK** — the parent's files outside tools/ are unchanged

> The parent's git status before: "?? tools/\n"; after: "?? tools/\n". (The child is now a nested repository, which the parent sees as one untracked directory.)

## Verdicts

- OK check STOPs (STOP: this folder is inside another repository (C:/qa-tmp/qa145-install-n-AXr3kK/node-parent). Bootstrap a project at its own repository root.)
- OK check names the enclosing repository (git's form: forward slashes)
- OK check names an action a stranger can take here (git init, or make this folder its own repository) (STOP: this folder is inside another repository (C:/qa-tmp/qa145-install-n-AXr3kK/node-parent). Bootstrap a project at its own repository root.)
- **FAIL** bootstrap.md says what to do in the nested case (git init the child, or move it out) (1 line(s))
- OK scaffold refuses and writes nothing
- OK state import --draft refuses (no .agents/ here) and never walks up
- OK the parent gained nothing so far
- OK check's Next names the step taken (2.2 the before-SIA commit)
- OK check's Next names the step taken (3 scaffold)
- OK scaffold exits 0
- OK check's Next names the step taken (4 CLAUDE.md)
- OK the draft validates for THIS folder, named by the folder
- OK --commit writes the child's record
- OK a final check says BOOTSTRAPPED
- OK the parent's files outside tools/ are unchanged

**Manual fixes (steps no Next named):** git init in the child: check names the goal, not the command

**15 checks, 1 failed.**
