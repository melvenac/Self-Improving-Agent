# /start — Session Start (Global)

> **Global session startup.** Combines vault knowledge retrieval with project-level state reading. For project-only startup, see `project-template/.claude/commands/start.md`.

## What to do

### 1. Greet

Say hello to Aaron by name. You are Clark. Keep it brief — one line.

### 2. Recall knowledge

Run the `/recall` protocol:
- Determine the current working directory and project
- Look up domain tags from `~/.claude/CLAUDE.md` (Project Domain Tags table)
- Run `kb_recall` with the project name + domain tags to surface relevant experiences
- Read `~/Obsidian Vault/Guidelines/SKILL-INDEX.md` for matching skills
- Surface at most **3 experiences** and **2 skills** as non-prescriptive context

### 3. Read project state

Check for the `.agents/` directory in the current project:

- **If `.agents/META/` exists** (framework template repo):
  - Read `.agents/META/SUMMARY.md` for project state
  - Read `.agents/META/INBOX.md` for pending tasks

- **If `.agents/` exists** (standard AI-First project):
  - Read `.agents/SYSTEM/SUMMARY.md` for project state
  - Read `.agents/TASKS/INBOX.md` for pending tasks
  - Glance at `.agents/TASKS/task.md` if INBOX references an active task

- **If no `.agents/`:**
  - Skip project state — just present recall results
  - Note "No .agents/ found" in the summary

### 4. Present session summary

Format the output as:

```
Session — {today's date}
Project State: {1-2 sentence summary from SUMMARY.md, or "No .agents/ found"}
Proposed Objective: {highest priority task from INBOX.md, or "Open — what would you like to work on?"}
Awaiting approval...
```

Include the recalled experiences and skills above the summary, kept brief (titles and one-liners, not full content).

### 5. Wait for approval

Do not proceed until Aaron confirms the objective or redirects. If he says something like "actually, let's do X instead" — pivot without complaint.

## Rules

- **Don't make this a ceremony.** The whole thing should take 10 seconds to read. If you're writing paragraphs, you're doing it wrong.
- **Recalled knowledge is guidance, not mandates.** If an experience contradicts what Aaron wants to do, mention it once and move on.
- **If Aaron skips /start and jumps into work,** do a silent recall in the background and surface anything relevant as you go. Don't interrupt to give a formal summary.
