# QA 145 probes

SIA: `C:\qa-scratch\bf145\cand` at `7f4ca74`, build stamp `7f4ca741e6ba4836590ca9f83d7ae9a2b28bfabf`. Scratch: `C:\qa-tmp\qa145-probes-QKvFDI`. Node v22.23.2, win32.

## P-HOOK: the real built session-end hook in install (iii)

> Scratch DB created with this build's openV2Database at C:\qa-tmp\qa145-probes-QKvFDI\home\.claude\open-brain\knowledge-v2.db; vault C:\qa-tmp\qa145-probes-QKvFDI\home\vault.

### Install (iii-b): the parent is a repository; the child its own repository inside it

```
$ git init -q -b master   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent)

[exit 0]
```

```
$ git add -A -- . :(exclude)tools   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent)
warning: in the working copy of '.agents/SYSTEM/SUMMARY.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.agents/TASKS/INBOX.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.agents/TASKS/task.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
[exit 0]
```

```
$ git commit -q -m parent   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent)

[exit 0]
```

```
$ git init -q -b master   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)

[exit 0]
```

```
$ git add -A -- . :(exclude).agents   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'csvtool/__main__.py', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'pyproject.toml', LF will be replaced by CRLF the next time Git touches it
[exit 0]
```

```
$ git commit -q -m The project before SIA   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)

[exit 0]
```

```
$ OB bootstrap scaffold   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)
bootstrap scaffold — C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool
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

```
$ OB state import --draft   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)

state import — draft (nothing else changed)

Root: C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool
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

```
$ OB state import --commit   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)

state import — committed

Root: C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool
Could not tell whether current: .agents/TASKS/INBOX.md, .agents/TASKS/task.md
Snapshot: .agents\archive\pre-state-migration-2026-09-26 (7 files)
Wrote:    .agents/state.json at revision 0
SUMMARY.md: removed 24 lines (2 blockquote + 20 Current State); kept Architecture Overview, Key Metrics
Rendered: .agents/TASKS/INBOX.md, .agents/TASKS/task.md, .agents/SESSIONS/next-session.md, .agents/SYSTEM/SUMMARY.md
Moved into snapshot: .agents/archive/pre-state-migration-2026-09-26/state.draft.json, .agents/archive/pre-state-migration-2026-09-26/state.import-report.md
[exit 0]
```

```
$ git add -A   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/end.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/start.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/sync.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/task.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.gitattributes', LF will be replaced by CRLF the next time Git touches it
[exit 0]
```

```
$ git commit -q -m Bootstrap SIA   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)

[exit 0]
```

**OK** H-iii-b-setup — the child has its own record

```
$ git checkout -q -b loop/child-work   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)

[exit 0]
```

```
$ git add -A   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)
warning: in the working copy of '.gitattributes', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'loop-child-work.txt', LF will be replaced by CRLF the next time Git touches it
[exit 0]
```

```
$ git commit -q -m work on loop/child-work   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)

[exit 0]
```

```
$ git checkout -q master   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)

[exit 0]
```

```
$ git checkout -q -b loop/parent-work   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent)

[exit 0]
```

```
$ git add -A   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent)
warning: in the working copy of 'loop-parent-work.txt', LF will be replaced by CRLF the next time Git touches it
warning: adding embedded git repository: tools/csvtool
hint: You've added another git repository inside your current repository.
hint: Clones of the outer repository will not contain the contents of
hint: the embedded repository and will not know how to obtain it.
hint: If you meant to add a submodule, use:
hint:
hint: 	git submodule add <url> tools/csvtool
hint:
hint: If you added this path by mistake, you can remove it from the
hint: index with:
hint:
hint: 	git rm --cached tools/csvtool
hint:
hint: See "git help submodule" for more information.
hint: Disable this message with "git config set advice.addEmbeddedRepo false"
[exit 0]
```

```
$ git commit -q -m work on loop/parent-work   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent)

[exit 0]
```

```
$ git checkout -q master   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent)
warning: unable to rmdir 'tools/csvtool': Directory not empty
[exit 0]
```

> Both repositories have a loop/* commit since the session start and no handoff, so the hook's handoff guard writes its marker into whichever project it resolved.

#### CLAUDE_PROJECT_DIR = the child

```
$ node open-brain/build/cli-session-end.js  <<< {session_id, transcript_path}  CLAUDE_PROJECT_DIR=C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool)
[session-end] HANDOFF MISSING: session qa145-iii-b committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:36.803Z and committed no docs/loops/*-handoff.md. Its reasoning is not in any file. Write and push the handoff before the next /clear (Aaron, record session 109).
[session-end] Recalled ids: 0 from none
[session-end] Nothing rated: no recall_log rows for session qa145-iii-b and no readable .recalled-entries.json (looked in 2 location(s))
[session-end] Summary: skipped
[session-end] Feedback: 0 entries
[session-end] Invocations: 0 logged
[session-end] HANDOFF MISSING: session qa145-iii-b committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:36.803Z and committed no docs/loops/*-handoff.md. Its reasoning is not in any file. Write and push the handoff before the next /clear (Aaron, record session 109).
[exit 0]
```

**OK** H-iii-b-env — the hook ran and exited 0

**OK** H-iii-b-env — its handoff guard answered for the CHILD's branch: [session-end] HANDOFF MISSING: session qa145-iii-b committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:36.803Z and committed no docs/loops/*-handoff

**OK** H-iii-b-env — its write (the missing-handoff marker) landed in the CHILD

**OK** H-iii-b-env — the parent gained nothing (every file outside tools/ and .git/ has the same bytes, none new)

**OK** H-iii-b-env — the parent's git status and refs are what they were

#### No CLAUDE_PROJECT_DIR; cwd child/csvtool/ (a drifted cwd)

```
$ node open-brain/build/cli-session-end.js  <<< {session_id, transcript_path}   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-b\node-parent\tools\csvtool\csvtool)
[session-end] HANDOFF MISSING: session qa145-iii-b committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:36.803Z and committed no docs/loops/*-handoff.md. Its reasoning is not in any file. Write and push the handoff before the next /clear (Aaron, record session 109).
[session-end] Recalled ids: 0 from none
[session-end] Nothing rated: no recall_log rows for session qa145-iii-b and no readable .recalled-entries.json (looked in 2 location(s))
[session-end] Summary: skipped
[session-end] Feedback: 0 entries
[session-end] Invocations: 0 logged
[session-end] HANDOFF MISSING: session qa145-iii-b committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:36.803Z and committed no docs/loops/*-handoff.md. Its reasoning is not in any file. Write and push the handoff before the next /clear (Aaron, record session 109).
[exit 0]
```

**OK** H-iii-b-cwd — the hook ran and exited 0

**OK** H-iii-b-cwd — its handoff guard answered for the CHILD's branch: [session-end] HANDOFF MISSING: session qa145-iii-b committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:36.803Z and committed no docs/loops/*-handoff

**OK** H-iii-b-cwd — its write (the missing-handoff marker) landed in the CHILD

**OK** H-iii-b-cwd — the parent gained nothing (every file outside tools/ and .git/ has the same bytes, none new)

**OK** H-iii-b-cwd — the parent's git status and refs are what they were

### Install (iii-a): the parent is not a repository; the child becomes one at step 2.2

```
$ git init -q -b master   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)

[exit 0]
```

```
$ git add -A -- . :(exclude).agents   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'csvtool/__main__.py', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'pyproject.toml', LF will be replaced by CRLF the next time Git touches it
[exit 0]
```

```
$ git commit -q -m The project before SIA   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)

[exit 0]
```

```
$ OB bootstrap scaffold   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)
bootstrap scaffold — C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool
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

```
$ OB state import --draft   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)

state import — draft (nothing else changed)

Root: C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool
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

```
$ OB state import --commit   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)

state import — committed

Root: C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool
Could not tell whether current: .agents/TASKS/INBOX.md, .agents/TASKS/task.md
Snapshot: .agents\archive\pre-state-migration-2026-09-26 (7 files)
Wrote:    .agents/state.json at revision 0
SUMMARY.md: removed 24 lines (2 blockquote + 20 Current State); kept Architecture Overview, Key Metrics
Rendered: .agents/TASKS/INBOX.md, .agents/TASKS/task.md, .agents/SESSIONS/next-session.md, .agents/SYSTEM/SUMMARY.md
Moved into snapshot: .agents/archive/pre-state-migration-2026-09-26/state.draft.json, .agents/archive/pre-state-migration-2026-09-26/state.import-report.md
[exit 0]
```

```
$ git add -A   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/end.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/start.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/sync.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.claude/commands/task.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.gitattributes', LF will be replaced by CRLF the next time Git touches it
[exit 0]
```

```
$ git commit -q -m Bootstrap SIA   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)

[exit 0]
```

**OK** H-iii-a-setup — the child has its own record

```
$ git checkout -q -b loop/child-work   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)

[exit 0]
```

```
$ git add -A   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)
warning: in the working copy of '.gitattributes', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '.gitignore', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'loop-child-work.txt', LF will be replaced by CRLF the next time Git touches it
[exit 0]
```

```
$ git commit -q -m work on loop/child-work   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)

[exit 0]
```

```
$ git checkout -q master   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)

[exit 0]
```

> Both the child has a loop/* commit since the session start and no handoff, so the hook's handoff guard writes its marker into whichever project it resolved.

#### CLAUDE_PROJECT_DIR = the child

```
$ node open-brain/build/cli-session-end.js  <<< {session_id, transcript_path}  CLAUDE_PROJECT_DIR=C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool)
[session-end] HANDOFF MISSING: session qa145-iii-a committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:38.736Z and committed no docs/loops/*-handoff.md. Its reasoning is not in any file. Write and push the handoff before the next /clear (Aaron, record session 109).
[session-end] Recalled ids: 0 from none
[session-end] Nothing rated: no recall_log rows for session qa145-iii-a and no readable .recalled-entries.json (looked in 2 location(s))
[session-end] Summary: skipped
[session-end] Feedback: 0 entries
[session-end] Invocations: 0 logged
[session-end] HANDOFF MISSING: session qa145-iii-a committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:38.736Z and committed no docs/loops/*-handoff.md. Its reasoning is not in any file. Write and push the handoff before the next /clear (Aaron, record session 109).
[exit 0]
```

**OK** H-iii-a-env — the hook ran and exited 0

**OK** H-iii-a-env — its handoff guard answered for the CHILD's branch: [session-end] HANDOFF MISSING: session qa145-iii-a committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:38.736Z and committed no docs/loops/*-handoff

**OK** H-iii-a-env — its write (the missing-handoff marker) landed in the CHILD

**OK** H-iii-a-env — the parent gained nothing (every file outside tools/ and .git/ has the same bytes, none new)

#### No CLAUDE_PROJECT_DIR; cwd child/csvtool/ (a drifted cwd)

```
$ node open-brain/build/cli-session-end.js  <<< {session_id, transcript_path}   (cwd C:\qa-tmp\qa145-probes-QKvFDI\iii-a\node-parent\tools\csvtool\csvtool)
[session-end] HANDOFF MISSING: session qa145-iii-a committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:38.736Z and committed no docs/loops/*-handoff.md. Its reasoning is not in any file. Write and push the handoff before the next /clear (Aaron, record session 109).
[session-end] Recalled ids: 0 from none
[session-end] Nothing rated: no recall_log rows for session qa145-iii-a and no readable .recalled-entries.json (looked in 2 location(s))
[session-end] Summary: skipped
[session-end] Feedback: 0 entries
[session-end] Invocations: 0 logged
[session-end] HANDOFF MISSING: session qa145-iii-a committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:38.736Z and committed no docs/loops/*-handoff.md. Its reasoning is not in any file. Write and push the handoff before the next /clear (Aaron, record session 109).
[exit 0]
```

**OK** H-iii-a-cwd — the hook ran and exited 0

**OK** H-iii-a-cwd — its handoff guard answered for the CHILD's branch: [session-end] HANDOFF MISSING: session qa145-iii-a committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:38.736Z and committed no docs/loops/*-handoff

**OK** H-iii-a-cwd — its write (the missing-handoff marker) landed in the CHILD

**OK** H-iii-a-cwd — the parent gained nothing (every file outside tools/ and .git/ has the same bytes, none new)

## P-JSON: a state.json that parses and is not a record-shaped object

### state.json = `{}`

```
$ OB bootstrap check   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\7b7d)
bootstrap check — C:\qa-tmp\qa145-probes-QKvFDI\json\7b7d
Template:  C:\qa-scratch\bf145\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  BOOTSTRAPPED — state.json is a record
Next:      Already bootstrapped (.agents/state.json exists). Run /start.
[exit 0]
```

```
$ node -e "handleStart({ project_root })"   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\7b7d)
Tree currency: NOT CHECKED — C:\qa-tmp\qa145-probes-QKvFDI\json\7b7d is not inside a git work tree. This is not a pass.

Session Start — project mode
Project: v0.0.0

Drift: none

Session log: no .agents/SESSIONS/ dir — log not created
Session ID: discovery failed

Seat: UNRESOLVED
Role knowledge loaded (0 of 1):
  .agents/roles/shared.md — ABSENT (shared)
  (not inside a git work tree — commits could not be resolved; this is not a claim that the files are current)

ROLE KNOWLEDGE PROBLEMS (2):
  NO SEAT IDENTITY RESOLVED — neither .agents/AGENT.local.md nor .agents/AGENT.md yielded a name and role, so no seat-specific role file could be chosen. Only .agents/roles/shared.md was loaded.
  ROLE FILE MISSING: .agents/roles/shared.md does not exist — the "shared" seat's rules are not in this checkout. This is absence, not an empty ruleset.

## Sizes (tokens estimated as chars/4)
  SUMMARY.md (.agents/SYSTEM/SUMMARY.md): absent
  INBOX.md (.agents/TASKS/INBOX.md): absent
  task.md (.agents/TASKS/task.md): absent
  next-session.md (.agents/SESSIONS/next-session.md): absent
  state.json (.agents/state.json): 2 lines, 1 words, ~1 tokens, truncated: no

STATE RECORD REFUSED: schema_version: Invalid input: expected 3.
This build cannot read this record's schema version. NOT falling back to the prose files: they are a DIFFERENT and older account of the project, and a greeting built from them would look ordinary while describing a state the record has moved past.
Rebuild the checkout this process runs from against a commit carrying the record's schema, then start again.

Total returned words: 224 (~396 tokens)
isError: true
[exit 0]
```

```
$ OB bootstrap move-residue   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\7b7d)
bootstrap move-residue refused: .agents/ is bootstrapped, not residue — nothing moved
[exit 1]
```

### state.json = `[]`

```
$ OB bootstrap check   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\5b5d)
bootstrap check — C:\qa-tmp\qa145-probes-QKvFDI\json\5b5d
Template:  C:\qa-scratch\bf145\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  BOOTSTRAPPED — state.json is a record
Next:      Already bootstrapped (.agents/state.json exists). Run /start.
[exit 0]
```

```
$ node -e "handleStart({ project_root })"   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\5b5d)
Tree currency: NOT CHECKED — C:\qa-tmp\qa145-probes-QKvFDI\json\5b5d is not inside a git work tree. This is not a pass.

Session Start — project mode
Project: v0.0.0

Drift: none

Session log: no .agents/SESSIONS/ dir — log not created
Session ID: discovery failed

Seat: UNRESOLVED
Role knowledge loaded (0 of 1):
  .agents/roles/shared.md — ABSENT (shared)
  (not inside a git work tree — commits could not be resolved; this is not a claim that the files are current)

ROLE KNOWLEDGE PROBLEMS (2):
  NO SEAT IDENTITY RESOLVED — neither .agents/AGENT.local.md nor .agents/AGENT.md yielded a name and role, so no seat-specific role file could be chosen. Only .agents/roles/shared.md was loaded.
  ROLE FILE MISSING: .agents/roles/shared.md does not exist — the "shared" seat's rules are not in this checkout. This is absence, not an empty ruleset.

## Sizes (tokens estimated as chars/4)
  SUMMARY.md (.agents/SYSTEM/SUMMARY.md): absent
  INBOX.md (.agents/TASKS/INBOX.md): absent
  task.md (.agents/TASKS/task.md): absent
  next-session.md (.agents/SESSIONS/next-session.md): absent
  state.json (.agents/state.json): 2 lines, 1 words, ~1 tokens, truncated: no

state.json invalid at $: Invalid input: expected object, received array — falling back to files

## SUMMARY.md
absent

## INBOX.md
absent

## task.md
absent

## next-session.md
absent

Total returned words: 183 (~337 tokens)
isError: false
[exit 0]
```

```
$ OB bootstrap move-residue   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\5b5d)
bootstrap move-residue refused: .agents/ is bootstrapped, not residue — nothing moved
[exit 1]
```

### state.json = `null`

```
$ OB bootstrap check   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\6e756c6c)
bootstrap check — C:\qa-tmp\qa145-probes-QKvFDI\json\6e756c6c
Template:  C:\qa-scratch\bf145\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  BOOTSTRAPPED — state.json is a record
Next:      Already bootstrapped (.agents/state.json exists). Run /start.
[exit 0]
```

```
$ node -e "handleStart({ project_root })"   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\6e756c6c)
Tree currency: NOT CHECKED — C:\qa-tmp\qa145-probes-QKvFDI\json\6e756c6c is not inside a git work tree. This is not a pass.

Session Start — project mode
Project: v0.0.0

Drift: none

Session log: no .agents/SESSIONS/ dir — log not created
Session ID: discovery failed

Seat: UNRESOLVED
Role knowledge loaded (0 of 1):
  .agents/roles/shared.md — ABSENT (shared)
  (not inside a git work tree — commits could not be resolved; this is not a claim that the files are current)

ROLE KNOWLEDGE PROBLEMS (2):
  NO SEAT IDENTITY RESOLVED — neither .agents/AGENT.local.md nor .agents/AGENT.md yielded a name and role, so no seat-specific role file could be chosen. Only .agents/roles/shared.md was loaded.
  ROLE FILE MISSING: .agents/roles/shared.md does not exist — the "shared" seat's rules are not in this checkout. This is absence, not an empty ruleset.

## Sizes (tokens estimated as chars/4)
  SUMMARY.md (.agents/SYSTEM/SUMMARY.md): absent
  INBOX.md (.agents/TASKS/INBOX.md): absent
  task.md (.agents/TASKS/task.md): absent
  next-session.md (.agents/SESSIONS/next-session.md): absent
  state.json (.agents/state.json): 2 lines, 1 words, ~2 tokens, truncated: no

state.json invalid at $: Invalid input: expected object, received null — falling back to files

## SUMMARY.md
absent

## INBOX.md
absent

## task.md
absent

## next-session.md
absent

Total returned words: 183 (~338 tokens)
isError: false
[exit 0]
```

```
$ OB bootstrap move-residue   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\6e756c6c)
bootstrap move-residue refused: .agents/ is bootstrapped, not residue — nothing moved
[exit 1]
```

### state.json = `42`

```
$ OB bootstrap check   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\3432)
bootstrap check — C:\qa-tmp\qa145-probes-QKvFDI\json\3432
Template:  C:\qa-scratch\bf145\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  BOOTSTRAPPED — state.json is a record
Next:      Already bootstrapped (.agents/state.json exists). Run /start.
[exit 0]
```

```
$ node -e "handleStart({ project_root })"   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\3432)
Tree currency: NOT CHECKED — C:\qa-tmp\qa145-probes-QKvFDI\json\3432 is not inside a git work tree. This is not a pass.

Session Start — project mode
Project: v0.0.0

Drift: none

Session log: no .agents/SESSIONS/ dir — log not created
Session ID: discovery failed

Seat: UNRESOLVED
Role knowledge loaded (0 of 1):
  .agents/roles/shared.md — ABSENT (shared)
  (not inside a git work tree — commits could not be resolved; this is not a claim that the files are current)

ROLE KNOWLEDGE PROBLEMS (2):
  NO SEAT IDENTITY RESOLVED — neither .agents/AGENT.local.md nor .agents/AGENT.md yielded a name and role, so no seat-specific role file could be chosen. Only .agents/roles/shared.md was loaded.
  ROLE FILE MISSING: .agents/roles/shared.md does not exist — the "shared" seat's rules are not in this checkout. This is absence, not an empty ruleset.

## Sizes (tokens estimated as chars/4)
  SUMMARY.md (.agents/SYSTEM/SUMMARY.md): absent
  INBOX.md (.agents/TASKS/INBOX.md): absent
  task.md (.agents/TASKS/task.md): absent
  next-session.md (.agents/SESSIONS/next-session.md): absent
  state.json (.agents/state.json): 2 lines, 1 words, ~1 tokens, truncated: no

state.json invalid at $: Invalid input: expected object, received number — falling back to files

## SUMMARY.md
absent

## INBOX.md
absent

## task.md
absent

## next-session.md
absent

Total returned words: 183 (~337 tokens)
isError: false
[exit 0]
```

```
$ OB bootstrap move-residue   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\3432)
bootstrap move-residue refused: .agents/ is bootstrapped, not residue — nothing moved
[exit 1]
```

### state.json = `"text"`

```
$ OB bootstrap check   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\227465787422)
bootstrap check — C:\qa-tmp\qa145-probes-QKvFDI\json\227465787422
Template:  C:\qa-scratch\bf145\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  BOOTSTRAPPED — state.json is a record
Next:      Already bootstrapped (.agents/state.json exists). Run /start.
[exit 0]
```

```
$ node -e "handleStart({ project_root })"   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\227465787422)
Tree currency: NOT CHECKED — C:\qa-tmp\qa145-probes-QKvFDI\json\227465787422 is not inside a git work tree. This is not a pass.

Session Start — project mode
Project: v0.0.0

Drift: none

Session log: no .agents/SESSIONS/ dir — log not created
Session ID: discovery failed

Seat: UNRESOLVED
Role knowledge loaded (0 of 1):
  .agents/roles/shared.md — ABSENT (shared)
  (not inside a git work tree — commits could not be resolved; this is not a claim that the files are current)

ROLE KNOWLEDGE PROBLEMS (2):
  NO SEAT IDENTITY RESOLVED — neither .agents/AGENT.local.md nor .agents/AGENT.md yielded a name and role, so no seat-specific role file could be chosen. Only .agents/roles/shared.md was loaded.
  ROLE FILE MISSING: .agents/roles/shared.md does not exist — the "shared" seat's rules are not in this checkout. This is absence, not an empty ruleset.

## Sizes (tokens estimated as chars/4)
  SUMMARY.md (.agents/SYSTEM/SUMMARY.md): absent
  INBOX.md (.agents/TASKS/INBOX.md): absent
  task.md (.agents/TASKS/task.md): absent
  next-session.md (.agents/SESSIONS/next-session.md): absent
  state.json (.agents/state.json): 2 lines, 1 words, ~2 tokens, truncated: no

state.json invalid at $: Invalid input: expected object, received string — falling back to files

## SUMMARY.md
absent

## INBOX.md
absent

## task.md
absent

## next-session.md
absent

Total returned words: 183 (~339 tokens)
isError: false
[exit 0]
```

```
$ OB bootstrap move-residue   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\227465787422)
bootstrap move-residue refused: .agents/ is bootstrapped, not residue — nothing moved
[exit 1]
```

### state.json = `true`

```
$ OB bootstrap check   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\74727565)
bootstrap check — C:\qa-tmp\qa145-probes-QKvFDI\json\74727565
Template:  C:\qa-scratch\bf145\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  BOOTSTRAPPED — state.json is a record
Next:      Already bootstrapped (.agents/state.json exists). Run /start.
[exit 0]
```

```
$ node -e "handleStart({ project_root })"   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\74727565)
Tree currency: NOT CHECKED — C:\qa-tmp\qa145-probes-QKvFDI\json\74727565 is not inside a git work tree. This is not a pass.

Session Start — project mode
Project: v0.0.0

Drift: none

Session log: no .agents/SESSIONS/ dir — log not created
Session ID: discovery failed

Seat: UNRESOLVED
Role knowledge loaded (0 of 1):
  .agents/roles/shared.md — ABSENT (shared)
  (not inside a git work tree — commits could not be resolved; this is not a claim that the files are current)

ROLE KNOWLEDGE PROBLEMS (2):
  NO SEAT IDENTITY RESOLVED — neither .agents/AGENT.local.md nor .agents/AGENT.md yielded a name and role, so no seat-specific role file could be chosen. Only .agents/roles/shared.md was loaded.
  ROLE FILE MISSING: .agents/roles/shared.md does not exist — the "shared" seat's rules are not in this checkout. This is absence, not an empty ruleset.

## Sizes (tokens estimated as chars/4)
  SUMMARY.md (.agents/SYSTEM/SUMMARY.md): absent
  INBOX.md (.agents/TASKS/INBOX.md): absent
  task.md (.agents/TASKS/task.md): absent
  next-session.md (.agents/SESSIONS/next-session.md): absent
  state.json (.agents/state.json): 2 lines, 1 words, ~2 tokens, truncated: no

state.json invalid at $: Invalid input: expected object, received boolean — falling back to files

## SUMMARY.md
absent

## INBOX.md
absent

## task.md
absent

## next-session.md
absent

Total returned words: 183 (~338 tokens)
isError: false
[exit 0]
```

```
$ OB bootstrap move-residue   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\74727565)
bootstrap move-residue refused: .agents/ is bootstrapped, not residue — nothing moved
[exit 1]
```

### state.json = `{"project":{}}`

```
$ OB bootstrap check   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\7b2270726f6a656374223a7b7d7d)
bootstrap check — C:\qa-tmp\qa145-probes-QKvFDI\json\7b2270726f6a656374223a7b7d7d
Template:  C:\qa-scratch\bf145\cand\project-template
git:       NOT a repository
CLAUDE.md: absent
.agents/:  BOOTSTRAPPED — state.json is a record
Next:      Already bootstrapped (.agents/state.json exists). Run /start.
[exit 0]
```

```
$ node -e "handleStart({ project_root })"   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\7b2270726f6a656374223a7b7d7d)
Tree currency: NOT CHECKED — C:\qa-tmp\qa145-probes-QKvFDI\json\7b2270726f6a656374223a7b7d7d is not inside a git work tree. This is not a pass.

Session Start — project mode
Project: v0.0.0

Drift: none

Session log: no .agents/SESSIONS/ dir — log not created
Session ID: discovery failed

Seat: UNRESOLVED
Role knowledge loaded (0 of 1):
  .agents/roles/shared.md — ABSENT (shared)
  (not inside a git work tree — commits could not be resolved; this is not a claim that the files are current)

ROLE KNOWLEDGE PROBLEMS (2):
  NO SEAT IDENTITY RESOLVED — neither .agents/AGENT.local.md nor .agents/AGENT.md yielded a name and role, so no seat-specific role file could be chosen. Only .agents/roles/shared.md was loaded.
  ROLE FILE MISSING: .agents/roles/shared.md does not exist — the "shared" seat's rules are not in this checkout. This is absence, not an empty ruleset.

## Sizes (tokens estimated as chars/4)
  SUMMARY.md (.agents/SYSTEM/SUMMARY.md): absent
  INBOX.md (.agents/TASKS/INBOX.md): absent
  task.md (.agents/TASKS/task.md): absent
  next-session.md (.agents/SESSIONS/next-session.md): absent
  state.json (.agents/state.json): 2 lines, 1 words, ~4 tokens, truncated: no

STATE RECORD REFUSED: schema_version: Invalid input: expected 3.
This build cannot read this record's schema version. NOT falling back to the prose files: they are a DIFFERENT and older account of the project, and a greeting built from them would look ordinary while describing a state the record has moved past.
Rebuild the checkout this process runs from against a commit carrying the record's schema, then start again.

Total returned words: 224 (~402 tokens)
isError: true
[exit 0]
```

```
$ OB bootstrap move-residue   (cwd C:\qa-tmp\qa145-probes-QKvFDI\json\7b2270726f6a656374223a7b7d7d)
bootstrap move-residue refused: .agents/ is bootstrapped, not residue — nothing moved
[exit 1]
```

## P-WALK: the root walker inside SIA's own tree

**OK** W-sia-root — resolveRepoRoot(<SIA>/) is SIA: C:\qa-scratch\bf145\cand

**OK** W-sia-open-brain — resolveRepoRoot(<SIA>/open-brain) is SIA: C:\qa-scratch\bf145\cand

**OK** W-sia-open-brain/src — resolveRepoRoot(<SIA>/open-brain/src) is SIA: C:\qa-scratch\bf145\cand

**OK** W-sia-docs — resolveRepoRoot(<SIA>/docs) is SIA: C:\qa-scratch\bf145\cand

**OK** W-sia-open-brain/tests/pipelines — resolveRepoRoot(<SIA>/open-brain/tests/pipelines) is SIA: C:\qa-scratch\bf145\cand

**OK** W-stray — with the stray open-brain/.agents/reflection-queue.json, open-brain/ is not a root and open-brain/src resolves to SIA

Directories in SIA's tracked tree that are roots under this build: `.`, `open-brain/tests/fixtures`, `open-brain/tests/fixtures-import`, `open-brain/tests/fixtures-import-a2a-hub`, `project-template`

## P-STRAY: a stray between a real project and the cwd

### The stray is packages/x/.agents/state.json (zero bytes); cwd packages/x/src

> resolveRepoRoot(packages/x/src) = C:\qa-tmp\qa145-probes-QKvFDI\stray\statejsonzerobytes\packages\x

```
$ OB state show   (cwd C:\qa-tmp\qa145-probes-QKvFDI\stray\statejsonzerobytes\packages\x\src)
state show refused: .agents/state.json invalid at $: not valid JSON — Unexpected end of JSON input
[exit 1]
```

```
$ OB sync --check   (cwd C:\qa-tmp\qa145-probes-QKvFDI\stray\statejsonzerobytes\packages\x\src)

Sync — v0.0.0

ISSUES:
  mirror-parity: Slash-command mirrors out of sync — repo↔template (.claude): missing directory
  state-schema: .agents/state.json invalid at $: not valid JSON — Unexpected end of JSON input, as parsed by this CLI process — note this is the CLI's schema, not the running server's. The server may hold a different one; run ob_sync as an MCP tool to test that.

WARNINGS:
  readme-version: README.md not found
  prd-version: PRD.md not found
  changelog: CHANGELOG.md not found
  readme-refs: README.md not found
  hook-configs: settings.json not found
  hook-registration: settings.json not found
  claude-md: CLAUDE.md not found
  obsidian-vault: Vault missing directories: Experiences, Skill-Candidates, Summaries
  template-personal-names: project-template/ not found
  template: project-template/ directory not found
  spec-provenance: specs/ directory not found
  rules: RULES.md not found

SKIPPED:
  summary-version: skipped — .agents/state.json invalid at $: not valid JSON — Unexpected end of JSON input (see state-schema); not touching SUMMARY.md
  command-parity: skipped — .claude/commands or project-template/.claude/commands absent
  command-tool-names: skipped — open-brain/src/server.ts not found (running outside the source tree)
  command-names: skipped — no command directories found
  retirements: skipped — .agents/retirements.json not found
  module-boundary: open-brain/src not present — dependency direction not checked
  gitnexus-index: no .gitnexus/ in this tree — index freshness not checked (the index lives in one checkout; this is not a pass)
  build-freshness: open-brain/build absent — nothing built here to compare (not a pass)
  state-views: skipped — .agents/state.json invalid at $: not valid JSON — Unexpected end of JSON input (see state-schema)
  record-erasure: skipped — not a git repository with a HEAD — there is no committed history to read
  ci-status: skipped — gh failed: failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git; conclusion: unknown (absent is not green)
  merge-markers: skipped — git ls-files failed (fatal: not a git repository (or any of the parent directories): .git); markers: unknown
  greeting-size: skipped — no valid .agents/state.json, so ob_start returns the prose fallback, which this check does not measure

REPORTED (printed whatever the severity):
  gitnexus-index [skip]: no .gitnexus/ in this tree — index freshness not checked (the index lives in one checkout; this is not a pass)
  build-freshness [skip]: open-brain/build absent — nothing built here to compare (not a pass)
  state-schema [issue]: .agents/state.json invalid at $: not valid JSON — Unexpected end of JSON input, as parsed by this CLI process — note this is the CLI's schema, not the running server's. The server may hold a different one; run ob_sync as an MCP tool to test that.
  record-erasure [skip]: skipped — not a git repository with a HEAD — there is no committed history to read
  ci-status [skip]: skipped — gh failed: failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git; conclusion: unknown (absent is not green)
  merge-markers [skip]: skipped — git ls-files failed (fatal: not a git repository (or any of the parent directories): .git); markers: unknown
  greeting-size [skip]: skipped — no valid .agents/state.json, so ob_start returns the prose fallback, which this check does not measure

Summary: 5 passed, 0 fixed, 12 warnings, 2 issues, 13 skipped
[exit 1]
```

### The stray is packages/x/.agents/state.json (a copied record); cwd packages/x/src

> resolveRepoRoot(packages/x/src) = C:\qa-tmp\qa145-probes-QKvFDI\stray\statejsonacopiedrecord\packages\x

```
$ OB state show   (cwd C:\qa-tmp\qa145-probes-QKvFDI\stray\statejsonacopiedrecord\packages\x\src)
state show refused: .agents/state.json invalid at objective: Invalid input: expected object, received undefined
[exit 1]
```

```
$ OB sync --check   (cwd C:\qa-tmp\qa145-probes-QKvFDI\stray\statejsonacopiedrecord\packages\x\src)

Sync — v0.0.0

ISSUES:
  mirror-parity: Slash-command mirrors out of sync — repo↔template (.claude): missing directory
  state-schema: .agents/state.json invalid at objective: Invalid input: expected object, received undefined, as parsed by this CLI process — note this is the CLI's schema, not the running server's. The server may hold a different one; run ob_sync as an MCP tool to test that.

WARNINGS:
  readme-version: README.md not found
  prd-version: PRD.md not found
  changelog: CHANGELOG.md not found
  readme-refs: README.md not found
  hook-configs: settings.json not found
  hook-registration: settings.json not found
  claude-md: CLAUDE.md not found
  obsidian-vault: Vault missing directories: Experiences, Skill-Candidates, Summaries
  template-personal-names: project-template/ not found
  template: project-template/ directory not found
  spec-provenance: specs/ directory not found
  rules: RULES.md not found

SKIPPED:
  summary-version: skipped — .agents/state.json invalid at objective: Invalid input: expected object, received undefined (see state-schema); not touching SUMMARY.md
  command-parity: skipped — .claude/commands or project-template/.claude/commands absent
  command-tool-names: skipped — open-brain/src/server.ts not found (running outside the source tree)
  command-names: skipped — no command directories found
  retirements: skipped — .agents/retirements.json not found
  module-boundary: open-brain/src not present — dependency direction not checked
  gitnexus-index: no .gitnexus/ in this tree — index freshness not checked (the index lives in one checkout; this is not a pass)
  build-freshness: open-brain/build absent — nothing built here to compare (not a pass)
  state-views: skipped — .agents/state.json invalid at objective: Invalid input: expected object, received undefined (see state-schema)
  record-erasure: skipped — not a git repository with a HEAD — there is no committed history to read
  ci-status: skipped — gh failed: failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git; conclusion: unknown (absent is not green)
  merge-markers: skipped — git ls-files failed (fatal: not a git repository (or any of the parent directories): .git); markers: unknown
  greeting-size: skipped — no valid .agents/state.json, so ob_start returns the prose fallback, which this check does not measure

REPORTED (printed whatever the severity):
  gitnexus-index [skip]: no .gitnexus/ in this tree — index freshness not checked (the index lives in one checkout; this is not a pass)
  build-freshness [skip]: open-brain/build absent — nothing built here to compare (not a pass)
  state-schema [issue]: .agents/state.json invalid at objective: Invalid input: expected object, received undefined, as parsed by this CLI process — note this is the CLI's schema, not the running server's. The server may hold a different one; run ob_sync as an MCP tool to test that.
  record-erasure [skip]: skipped — not a git repository with a HEAD — there is no committed history to read
  ci-status [skip]: skipped — gh failed: failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git; conclusion: unknown (absent is not green)
  merge-markers [skip]: skipped — git ls-files failed (fatal: not a git repository (or any of the parent directories): .git); markers: unknown
  greeting-size [skip]: skipped — no valid .agents/state.json, so ob_start returns the prose fallback, which this check does not measure

Summary: 5 passed, 0 fixed, 12 warnings, 2 issues, 13 skipped
[exit 1]
```

### The stray is packages/x/.agents/SYSTEM/; cwd packages/x/src

> resolveRepoRoot(packages/x/src) = C:\qa-tmp\qa145-probes-QKvFDI\stray\SYSTEM\packages\x

```
$ OB state show   (cwd C:\qa-tmp\qa145-probes-QKvFDI\stray\SYSTEM\packages\x\src)
state show refused: .agents/state.json is absent — run the migration first
[exit 1]
```

```
$ OB sync --check   (cwd C:\qa-tmp\qa145-probes-QKvFDI\stray\SYSTEM\packages\x\src)

Sync — v0.0.0

ISSUES:
  summary-version: SUMMARY.md does not mention version 0.0.0
  mirror-parity: Slash-command mirrors out of sync — repo↔template (.claude): missing directory

WARNINGS:
  readme-version: README.md not found
  prd-version: PRD.md not found
  changelog: CHANGELOG.md not found
  readme-refs: README.md not found
  hook-configs: settings.json not found
  hook-registration: settings.json not found
  claude-md: CLAUDE.md not found
  obsidian-vault: Vault missing directories: Experiences, Skill-Candidates, Summaries
  template-personal-names: project-template/ not found
  template: project-template/ directory not found
  spec-provenance: specs/ directory not found
  rules: RULES.md not found

SKIPPED:
  command-parity: skipped — .claude/commands or project-template/.claude/commands absent
  command-tool-names: skipped — open-brain/src/server.ts not found (running outside the source tree)
  command-names: skipped — no command directories found
  retirements: skipped — .agents/retirements.json not found
  module-boundary: open-brain/src not present — dependency direction not checked
  gitnexus-index: no .gitnexus/ in this tree — index freshness not checked (the index lives in one checkout; this is not a pass)
  build-freshness: open-brain/build absent — nothing built here to compare (not a pass)
  state-schema: skipped — no .agents/state.json (this project has not been migrated; ob_state never creates the file)
  state-views: skipped — no .agents/state.json (views are prose, not generated)
  record-erasure: skipped — not a git repository with a HEAD — there is no committed history to read
  ci-status: skipped — gh failed: failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git; conclusion: unknown (absent is not green)
  merge-markers: skipped — git ls-files failed (fatal: not a git repository (or any of the parent directories): .git); markers: unknown
  greeting-size: skipped — no valid .agents/state.json, so ob_start returns the prose fallback, which this check does not measure

REPORTED (printed whatever the severity):
  gitnexus-index [skip]: no .gitnexus/ in this tree — index freshness not checked (the index lives in one checkout; this is not a pass)
  build-freshness [skip]: open-brain/build absent — nothing built here to compare (not a pass)
  state-schema [skip]: skipped — no .agents/state.json (this project has not been migrated; ob_state never creates the file)
  record-erasure [skip]: skipped — not a git repository with a HEAD — there is no committed history to read
  ci-status [skip]: skipped — gh failed: failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git; conclusion: unknown (absent is not green)
  merge-markers [skip]: skipped — git ls-files failed (fatal: not a git repository (or any of the parent directories): .git); markers: unknown
  greeting-size [skip]: skipped — no valid .agents/state.json, so ob_start returns the prose fallback, which this check does not measure

Summary: 5 passed, 0 fixed, 12 warnings, 2 issues, 13 skipped
[exit 1]
```

## P-UNDO: a residue move that fails part-way and cannot be undone

> The CLI's catch, applied to what moveResidue threw: bootstrap move-residue refused: residue move failed (EBUSY: simulated) and could not be undone: aaa are in .agents/archive/pre-bootstrap-residue-2026-09-26/, the rest in .agents/

## Results

| Id | What | Result |
|---|---|---|
| H-iii-b-setup | the child has its own record | OK |
| H-iii-b-env | the hook ran and exited 0 | OK |
| H-iii-b-env | its handoff guard answered for the CHILD's branch ([session-end] HANDOFF MISSING: session qa145-iii-b committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:36.803Z and committed no docs/loops/*-handoff) | OK |
| H-iii-b-env | its write (the missing-handoff marker) landed in the CHILD | OK |
| H-iii-b-env | the parent gained nothing (every file outside tools/ and .git/ has the same bytes, none new) | OK |
| H-iii-b-env | the parent's git status and refs are what they were | OK |
| H-iii-b-cwd | the hook ran and exited 0 | OK |
| H-iii-b-cwd | its handoff guard answered for the CHILD's branch ([session-end] HANDOFF MISSING: session qa145-iii-b committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:36.803Z and committed no docs/loops/*-handoff) | OK |
| H-iii-b-cwd | its write (the missing-handoff marker) landed in the CHILD | OK |
| H-iii-b-cwd | the parent gained nothing (every file outside tools/ and .git/ has the same bytes, none new) | OK |
| H-iii-b-cwd | the parent's git status and refs are what they were | OK |
| H-iii-a-setup | the child has its own record | OK |
| H-iii-a-env | the hook ran and exited 0 | OK |
| H-iii-a-env | its handoff guard answered for the CHILD's branch ([session-end] HANDOFF MISSING: session qa145-iii-a committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:38.736Z and committed no docs/loops/*-handoff) | OK |
| H-iii-a-env | its write (the missing-handoff marker) landed in the CHILD | OK |
| H-iii-a-env | the parent gained nothing (every file outside tools/ and .git/ has the same bytes, none new) | OK |
| H-iii-a-cwd | the hook ran and exited 0 | OK |
| H-iii-a-cwd | its handoff guard answered for the CHILD's branch ([session-end] HANDOFF MISSING: session qa145-iii-a committed 3 commit(s) on loop/child-work since 2026-09-27T02:01:38.736Z and committed no docs/loops/*-handoff) | OK |
| H-iii-a-cwd | its write (the missing-handoff marker) landed in the CHILD | OK |
| H-iii-a-cwd | the parent gained nothing (every file outside tools/ and .git/ has the same bytes, none new) | OK |
| J-{} | probe ({"agents":"BOOTSTRAPPED — state.json is a record","next":"Already bootstrapped (.agents/state.json exists). Run /start.","startIsError":true,"startFirst":"Tree currency: NOT CHECKED — C:\\qa-tmp\\qa145-probes-QKvFDI\\json\\7b7d is not inside a git work tree. This is not a pass. \| Session Start — project mode \| Project: v0.0.0","moveResidue":1,"fileKept":true}) | OK |
| J-[] | probe ({"agents":"BOOTSTRAPPED — state.json is a record","next":"Already bootstrapped (.agents/state.json exists). Run /start.","startIsError":false,"startFirst":"Tree currency: NOT CHECKED — C:\\qa-tmp\\qa145-probes-QKvFDI\\json\\5b5d is not inside a git work tree. This is not a pass. \| Session Start — project mode \| Project: v0.0.0","moveResidue":1,"fileKept":true}) | OK |
| J-null | probe ({"agents":"BOOTSTRAPPED — state.json is a record","next":"Already bootstrapped (.agents/state.json exists). Run /start.","startIsError":false,"startFirst":"Tree currency: NOT CHECKED — C:\\qa-tmp\\qa145-probes-QKvFDI\\json\\6e756c6c is not inside a git work tree. This is not a pass. \| Session Start — project mode \| Project: v0.0.0","moveResidue":1,"fileKept":true}) | OK |
| J-42 | probe ({"agents":"BOOTSTRAPPED — state.json is a record","next":"Already bootstrapped (.agents/state.json exists). Run /start.","startIsError":false,"startFirst":"Tree currency: NOT CHECKED — C:\\qa-tmp\\qa145-probes-QKvFDI\\json\\3432 is not inside a git work tree. This is not a pass. \| Session Start — project mode \| Project: v0.0.0","moveResidue":1,"fileKept":true}) | OK |
| J-"text" | probe ({"agents":"BOOTSTRAPPED — state.json is a record","next":"Already bootstrapped (.agents/state.json exists). Run /start.","startIsError":false,"startFirst":"Tree currency: NOT CHECKED — C:\\qa-tmp\\qa145-probes-QKvFDI\\json\\227465787422 is not inside a git work tree. This is not a pass. \| Session Start — project mode \| Project: v0.0.0","moveResidue":1,"fileKept":true}) | OK |
| J-true | probe ({"agents":"BOOTSTRAPPED — state.json is a record","next":"Already bootstrapped (.agents/state.json exists). Run /start.","startIsError":false,"startFirst":"Tree currency: NOT CHECKED — C:\\qa-tmp\\qa145-probes-QKvFDI\\json\\74727565 is not inside a git work tree. This is not a pass. \| Session Start — project mode \| Project: v0.0.0","moveResidue":1,"fileKept":true}) | OK |
| J-{"project":{}} | probe ({"agents":"BOOTSTRAPPED — state.json is a record","next":"Already bootstrapped (.agents/state.json exists). Run /start.","startIsError":true,"startFirst":"Tree currency: NOT CHECKED — C:\\qa-tmp\\qa145-probes-QKvFDI\\json\\7b2270726f6a656374223a7b7d7d is not inside a git work tree. This is not a pass. \| Session Start — project mode \| Project: v0.0.0","moveResidue":1,"fileKept":true}) | OK |
| W-sia-root | resolveRepoRoot(<SIA>/) is SIA (C:\qa-scratch\bf145\cand) | OK |
| W-sia-open-brain | resolveRepoRoot(<SIA>/open-brain) is SIA (C:\qa-scratch\bf145\cand) | OK |
| W-sia-open-brain/src | resolveRepoRoot(<SIA>/open-brain/src) is SIA (C:\qa-scratch\bf145\cand) | OK |
| W-sia-docs | resolveRepoRoot(<SIA>/docs) is SIA (C:\qa-scratch\bf145\cand) | OK |
| W-sia-open-brain/tests/pipelines | resolveRepoRoot(<SIA>/open-brain/tests/pipelines) is SIA (C:\qa-scratch\bf145\cand) | OK |
| W-stray | with the stray open-brain/.agents/reflection-queue.json, open-brain/ is not a root and open-brain/src resolves to SIA | OK |
| W-roots-in-sia | tracked directories that are roots (["","open-brain/tests/fixtures","open-brain/tests/fixtures-import","open-brain/tests/fixtures-import-a2a-hub","project-template"]) | OK |
| W-root-open-brain/tests/fixtures | resolveRepoRoot(<SIA>/open-brain/tests/fixtures) (C:\qa-scratch\bf145\cand\open-brain\tests\fixtures) | OK |
| W-root-open-brain/tests/fixtures-import | resolveRepoRoot(<SIA>/open-brain/tests/fixtures-import) (C:\qa-scratch\bf145\cand\open-brain\tests\fixtures-import) | OK |
| W-root-open-brain/tests/fixtures-import-a2a-hub | resolveRepoRoot(<SIA>/open-brain/tests/fixtures-import-a2a-hub) (C:\qa-scratch\bf145\cand\open-brain\tests\fixtures-import-a2a-hub) | OK |
| W-root-project-template | resolveRepoRoot(<SIA>/project-template) (C:\qa-scratch\bf145\cand\project-template) | OK |
| W-real-home | this machine's home ({"home":"C:\\Users\\Aaron","agents":"absent","isProjectRoot":false}) | OK |
| S-state.json (zero bytes) | resolveRepoRoot from below a stray (the STRAY (packages/x)) | OK |
| S-state.json (a copied record) | resolveRepoRoot from below a stray (the STRAY (packages/x)) | OK |
| S-SYSTEM/ | resolveRepoRoot from below a stray (the STRAY (packages/x)) | OK |
| U-double-failure | the CLI's words when a move cannot be undone ({"printed":"bootstrap move-residue refused: residue move failed (EBUSY: simulated) and could not be undone: aaa are in .agents/archive/pre-bootstrap-residue-2026-09-26/, the rest in .agents/","movedAside":true}) | OK |

**43 rows, 0 failed.**
