# /start — Session Start Protocol

> **Trigger:** Run at the beginning of every development session.

---

## Meta Mode Detection

If `.agents/META/` exists, this is the **framework template repo itself**. In meta mode:
- Read from `.agents/META/SUMMARY.md`, `META/INBOX.md`, and `META/DECISIONS.md` instead of the SYSTEM/ templates
- Session logs still go to `.agents/SESSIONS/Session_N.md` (gitignored)
- **Do NOT overwrite SYSTEM/ template files** — those are the skeleton that ships to users
- Only modify SYSTEM/ files when intentionally improving the template content

---

## Steps

### 1. Read Current State
```
If META/ exists:  Read: .agents/META/SUMMARY.md
Otherwise:        Read: .agents/SYSTEM/SUMMARY.md
```
Understand where the project is RIGHT NOW — what's working, what's broken, what's next.

### 2. Read Task Backlog
```
If META/ exists:  Read: .agents/META/INBOX.md
Otherwise:        Read: .agents/TASKS/INBOX.md
                  Read: .agents/TASKS/task.md
```
Understand priorities and current sprint focus.

### 3. Read Entities (if schema work planned)
```
Read: .agents/SYSTEM/ENTITIES.md
```
Only if this session involves data model changes.

### 4. Read Relevant Skills
```
Read: .agents/skills/INDEX.md
```
Check if any registered skills are relevant to today's work. Read those SKILL.md files.

### 5. Create Session Log
```
Copy: .agents/SESSIONS/SESSION_TEMPLATE.md → .agents/SESSIONS/Session_N.md
```
Replace N with the next session number. Fill in the date and objective.

### 6. Run Pre-Session Validation (if configured)
```
Run: validate:session:pre (if it exists)
```

### 7. State Objective
Present to the user:
- What you understand the current state to be
- What you propose to work on this session
- Ask for approval before proceeding

---

## Output

After running /start, the agent should present:

```
📋 Session N — [Date]
📊 Project State: [summary from SUMMARY.md]
🎯 Proposed Objective: [what to work on]
⏳ Awaiting approval...
```
