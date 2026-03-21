# /end — Session End Protocol

> **Trigger:** Run at the end of every development session, even short ones.

---

## Meta Mode Detection

If `.agents/META/` exists, this is the **framework template repo itself**. In meta mode:
- Write session tracking updates to `META/` files, NOT the `SYSTEM/` templates
- Only modify `SYSTEM/` files when intentionally improving template content
- This prevents framework development sessions from polluting the clean skeleton

---

## Steps

### 1. Update Session Log
```
Update: .agents/SESSIONS/Session_N.md
```
Fill in:
- **What Was Done** — List of accomplishments
- **Files Modified** — All files changed
- **Files Created** — All new files
- **Gotchas & Lessons Learned** — Hard-won knowledge
- **Decisions Made** — Any architectural decisions

### 2. Update SUMMARY.md
```
If META/ exists:  Update: .agents/META/SUMMARY.md
Otherwise:        Update: .agents/SYSTEM/SUMMARY.md
```
Overwrite the "Current State" section with:
- What's working NOW
- What's broken / blocked NOW
- What's next

### 3. Update DECISIONS.md (if applicable)
```
If META/ exists:  Update: .agents/META/DECISIONS.md
Otherwise:        Update: .agents/SYSTEM/DECISIONS.md
```
Add any new entries for significant decisions made this session.

### 4. Update ENTITIES.md (if schema changed)
```
Update: .agents/SYSTEM/ENTITIES.md
```
If the data model was modified, update the entity documentation to match.
_(Not applicable in meta mode — framework has no data model.)_

### 5. Run Entity Validation (if schema changed)
```
Run: validate:entities (if it exists and schema was modified)
```

### 6. Update INBOX.md
```
If META/ exists:  Update: .agents/META/INBOX.md
Otherwise:        Update: .agents/TASKS/INBOX.md
```
- Mark completed tasks as `[x]`
- Add any new tasks discovered during the session
- Re-prioritize if needed

### 7. Run Post-Session Validation (if configured)
```
Run: validate:session:post (if it exists)
```

### 8. Present Summary
Present to the user:
- What was accomplished
- What's next
- Any blockers or concerns

---

## Output

After running /end, the agent should present:

```
✅ Session N Complete — [Date]

📝 Accomplished:
- [list of what was done]

📄 Files Changed:
- [list of files]

💡 Gotchas:
- [any lessons learned]

🎯 Next Session:
- [recommended focus]

⚠️ Blockers:
- [any blockers, or "None"]
```

---

## Critical Rule

> **Never skip /end.** Even for short sessions. The next session's quality depends on this session's /end being thorough. Without it, the next session starts from zero.
