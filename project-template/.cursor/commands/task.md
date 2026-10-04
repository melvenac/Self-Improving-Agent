# /task — Next task picker (Cursor + SIA)

> **Cursor Composer:** run this inline. Claude Code's `/task` copy (`.claude/commands/task.md`) is the same
> protocol with no subagent dispatch — both hosts read the record and present the next item to the user.

Read `.agents/TASKS/INBOX.md` and `.agents/TASKS/task.md` to identify the next pending task.

Present the highest-priority incomplete item to the user with:
- What the task is
- Which phase it belongs to
- Any relevant files or context needed to start (reference SUMMARY.md and ENTITIES.md as needed)
- A suggested first step

Then ask the user if they want to proceed with that task or choose a different one.
