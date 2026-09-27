# [Project Name]

[One-line description of what this project does.]

## Key Rules

- **Run `/sync` before any commit.** Validates version consistency across docs.
- **`.agents/` is gitignored except the record.** `state.json` and its rendered views (`TASKS/INBOX.md`,
  `TASKS/task.md`, `SESSIONS/next-session.md`, `SYSTEM/SUMMARY.md`) and `AGENT.md` are tracked; session
  logs, PRD and the rest are local. Change the record only through `ob_state`.

## Architecture

- [Brief description of project structure]
- [Key directories and their purpose]

## Context for Agents

- Full project state: `.agents/SYSTEM/SUMMARY.md`
- Current priorities: `.agents/TASKS/INBOX.md`
- Session protocol: `/start` and `/end` handle lifecycle
