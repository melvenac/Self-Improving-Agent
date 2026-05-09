# /bootstrap — Project Bootstrap

> **One command to go from empty folder to AI-ready project.** Combines `/init`-style CLAUDE.md generation with `.agents/` framework scaffolding.

## What This Does

1. Generates a project-aware `CLAUDE.md` (like `/init`)
2. Scaffolds the `.agents/` framework for task tracking and session management
3. Initializes git if needed
4. Gets you productive in under 60 seconds

## Step 1: Check Current State

- Does `CLAUDE.md` already exist? If yes, skip generation (don't overwrite).
- Does `.agents/` already exist? If yes, skip scaffolding (don't overwrite).
- Is this a git repo? Note for Step 4.

If both exist, tell the user: "This project is already bootstrapped. Run `/start` to begin a session."

## Step 2: Generate CLAUDE.md (if missing)

Scan the project directory to understand:
- **Tech stack** — check `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, etc.
- **Structure** — key directories, entry points, config files
- **Conventions** — linting configs, test patterns, existing docs

Generate a concise `CLAUDE.md` with:
```markdown
# [Project Name] — Project Instructions

## About
[One-line description based on README or package.json]

## Tech Stack
[Detected stack with versions]

## Commands
- Build: [detected or "TBD"]
- Test: [detected or "TBD"]
- Lint: [detected or "TBD"]
- Dev: [detected or "TBD"]

## Conventions
[2-5 key conventions detected from config files]

## Structure
[Key directories and what they contain]
```

Ask the user to review before writing: "Here's what I'd generate for CLAUDE.md — look good?"

## Step 3: Scaffold .agents/ (if missing)

Create the following structure:

```
.agents/
├── TASKS/
│   └── INBOX.md          # Task backlog — what needs doing
├── SESSIONS/
│   └── SESSION_TEMPLATE.md  # Template for session logs
├── SYSTEM/
│   ├── SUMMARY.md         # Project state snapshot
│   ├── ENTITIES.md         # Key data models / domain objects
│   └── RULES.md            # Project-specific rules and constraints
└── skills/
    └── INDEX.md            # Project-specific skills (empty to start)
```

### TASKS/INBOX.md
```markdown
# [Project Name] — Task Inbox

## Priority
- [ ] [First task based on project state]

## Backlog
- [ ] [Additional tasks if detectable]
```

### SESSIONS/SESSION_TEMPLATE.md
```markdown
# Session N — [Date]

## Objective
[What we're working on]

## Progress
- [ ] [Tasks tackled]

## Decisions
- [Key decisions made]

## Handoff
- [State for next session]
```

### SYSTEM/SUMMARY.md
```markdown
# [Project Name]

## Status
[Current state — just bootstrapped]

## What's Working
[Detected from project state, or "Fresh project — nothing yet"]

## What's Next
[First priority from INBOX]
```

### SYSTEM/ENTITIES.md
```markdown
# Entities

[Detected from schema files, models, types — or placeholder]
```

### SYSTEM/RULES.md
```markdown
# Rules & Conventions

[Pulled from linting config, CLAUDE.md conventions, or starter set]
```

### skills/INDEX.md
```markdown
# Project Skills

No project-specific skills yet. Skills emerge from repeated patterns — they'll be proposed as you work.
```

## Step 4: Install Session Commands (if missing)

Check if `.claude/commands/` exists. If not, create it and add these lightweight session commands:

```
.claude/commands/
├── start.md    → /start (load project state, begin session)
├── end.md      → /end (save state, write handoff notes)
├── task.md     → /task (pick up next priority)
└── sync.md     → /sync (validate docs before commit)
```

These commands power the session workflow: `/start → work → /sync → /end`

If the user already has these commands (e.g., from a global setup), skip this step.

Source for lightweight command templates: the power-user curriculum repo (`commands/` directory).

## Step 5: Git Setup

- If not a git repo, ask: "Initialize git here?"
- If yes, `git init` and create initial commit with CLAUDE.md + .agents/ + .claude/commands/
- Add `.agents/SESSIONS/Session_*.md` to `.gitignore` (session logs are ephemeral)
- Add `.agents/SESSIONS/next-session.md` to `.gitignore`

## Step 6: Summary

```
Project bootstrapped!

✓ CLAUDE.md    — project instructions for Claude Code
✓ .agents/     — task tracking, session management, project state
✓ .claude/     — session commands (/start, /end, /task, /sync)
✓ git          — initialized with initial commit

Next steps:
- Run /start to begin your first session
- Edit CLAUDE.md to add project-specific conventions
- Add tasks to .agents/TASKS/INBOX.md
```

## Judgment Calls

- If the project already has substantial code, populate INBOX.md with detected TODOs, FIXMEs, or obvious next steps
- If it's a brand new empty project, ask the user what they're building and populate from there
- Don't over-scaffold — keep files minimal. They'll grow organically as the user works
- If the user seems overwhelmed, just say: "You don't need to understand all of this yet. Run `/start` when you're ready to work."
