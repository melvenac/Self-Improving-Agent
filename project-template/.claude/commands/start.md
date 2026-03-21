# /start — Session Start

Follow the session start protocol defined in `.agents/workflows/start.md`.

## Meta Mode

If `.agents/META/` exists, read from META/ instead of SYSTEM/ templates. See workflow for details.

## Quick Reference

1. Read `.agents/META/SUMMARY.md` (or `.agents/SYSTEM/SUMMARY.md` if no META/)
2. Read `.agents/META/INBOX.md` (or `.agents/TASKS/INBOX.md` and `.agents/TASKS/task.md`)
3. Read `.agents/SYSTEM/ENTITIES.md` (if schema work planned)
4. Check `.agents/skills/INDEX.md` for relevant skills
5. Create session log from `.agents/SESSIONS/SESSION_TEMPLATE.md`
6. Run pre-session validation (if configured)
7. State objective and get user approval
