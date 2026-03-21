# Cline Agent Rules

> **Purpose:** Point Cline to the AI-first development framework.

---

## Framework Location

All project documentation, tasks, session logs, skills, and workflows live in `.agents/`.

**Before starting any work, read:**
1. `.agents/SYSTEM/SUMMARY.md` — Current project state
2. `.agents/TASKS/INBOX.md` — Prioritized task backlog
3. `.agents/SYSTEM/RULES.md` — Coding standards

**Session lifecycle:**
- Start sessions with the protocol in `.agents/workflows/start.md`
- End sessions with the protocol in `.agents/workflows/end.md`

---

## Key Principles

1. **Read before writing** — Always check SUMMARY.md and INBOX.md before starting work.
2. **Update docs as you go** — If you change the schema, update ENTITIES.md. If you make a decision, log it in DECISIONS.md.
3. **Never skip /end** — Always run the end-of-session protocol, even for short sessions.
4. **Check skills** — Before starting a task, check `.agents/skills/INDEX.md` for relevant skills.
5. **Log gotchas** — If you discover something surprising or tricky, log it in the session log so future sessions benefit.

---

## File References

| Document | Path | Purpose |
|---|---|---|
| Framework Guide | `.agents/FRAMEWORK.md` | How the framework works |
| PRD | `.agents/SYSTEM/PRD.md` | Product requirements |
| Summary | `.agents/SYSTEM/SUMMARY.md` | Current project state |
| Entities | `.agents/SYSTEM/ENTITIES.md` | Data model |
| Decisions | `.agents/SYSTEM/DECISIONS.md` | Architecture decisions |
| Rules | `.agents/SYSTEM/RULES.md` | Coding standards |
| Testing | `.agents/SYSTEM/TESTING.md` | Testing strategy |
| Runbook | `.agents/SYSTEM/RUNBOOK.md` | Production operations |
| Security | `.agents/SYSTEM/SECURITY.md` | Security checklist |
| Task Inbox | `.agents/TASKS/INBOX.md` | Task backlog |
| Current Sprint | `.agents/TASKS/task.md` | Current focus |
| Skills | `.agents/skills/INDEX.md` | Skill registry |
