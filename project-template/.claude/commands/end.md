# /end — Session End

Follow the session end protocol defined in `.agents/workflows/end.md`.

## Meta Mode

If `.agents/META/` exists, write tracking updates to META/ — do NOT overwrite SYSTEM/ templates. See workflow for details.

## Quick Reference

1. Update session log (`.agents/SESSIONS/Session_N.md`)
2. Update `.agents/META/SUMMARY.md` (or `.agents/SYSTEM/SUMMARY.md` if no META/)
3. Update `.agents/META/DECISIONS.md` (or `.agents/SYSTEM/DECISIONS.md`) if applicable
4. Update `.agents/SYSTEM/ENTITIES.md` (if schema changed — not applicable in meta mode)
5. Run entity validation (if schema changed)
6. Update `.agents/META/INBOX.md` (or `.agents/TASKS/INBOX.md`) — mark done, add new
7. Run post-session validation (if configured)
8. Present summary to user

> **Never skip /end.** The next session depends on it.
