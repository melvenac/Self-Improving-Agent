# /task — Next Task Protocol

> **Trigger:** Run when the user wants to pick up the next task.

---

## Steps

### 1. Read Task Backlog
```
Read: .agents/TASKS/INBOX.md
Read: .agents/TASKS/task.md
```
Identify the highest-priority incomplete item.

### 2. Present Task
Present to the user with:
- What the task is
- Which phase it belongs to
- Any relevant files or context needed to start (reference SUMMARY.md and ENTITIES.md as needed)
- A suggested first step

### 3. Get Approval
Ask the user if they want to proceed with that task or choose a different one.
