# [Project Name]

[One-line description of what this project does.]

## Key Rules

- **Run `/sync` before any commit.** Validates version consistency across docs.
- **`.agents/` is gitignored.** PRD, SUMMARY, INBOX, and session logs are local-only project state.

## Architecture

- [Brief description of project structure]
- [Key directories and their purpose]

## Context for Agents

- Full project state: `.agents/SYSTEM/SUMMARY.md`
- Current priorities: `.agents/TASKS/INBOX.md`
- Session protocol: `/start` and `/end` handle lifecycle
