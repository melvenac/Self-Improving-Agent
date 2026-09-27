---
description: Agent framework standards — loaded when reading .agents/ files
globs: .agents/**
---

# Agent Framework Rules

- Always read `SUMMARY.md` at session start
- Write project state through `ob_state` as the work happens — `SUMMARY.md` is rendered from it, and `/end` only stores lessons
- Log gotchas in the session log — don't let hard-won knowledge disappear
- When modifying the data model, update `ENTITIES.md` immediately
- When making architectural decisions, log them in `DECISIONS.md`
- Don't create skills upfront — create when you've repeated a pattern 3+ times
- Keep SUMMARY.md focused on NOW — archive old milestones
