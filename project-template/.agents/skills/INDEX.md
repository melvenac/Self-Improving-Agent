# Skill Registry

> **Last Updated:** Session 0 (Initial Setup)

---

## How to Use Skills

Skills are reusable patterns that agents can reference when performing specific types of work. Each skill lives in its own directory under `.agents/skills/` with a `SKILL.md` file.

**When to create a skill:**
- You've explained the same pattern to the AI 3+ times
- A technology has project-specific conventions
- A workflow has more than 5 steps
- An integration has gotchas
- You want to prevent a class of bugs

---

## Registered Skills

| Skill | Directory | Description | Created |
|---|---|---|---|
| session-manager | `skills/session-manager/` | Universal session lifecycle — enforces /start and /end protocols, meta mode awareness | Session 2 |
| playwright-tester | `skills/playwright-tester/` | Zero-token E2E testing — AI writes `.spec.ts` files, Playwright runs them natively | Session 1 |

---

## Skill Template

To create a new skill, create a directory under `.agents/skills/` and add a `SKILL.md`:

```
.agents/skills/<skill-name>/SKILL.md
```

Each SKILL.md should contain:
1. **When to use** — What triggers this skill
2. **Steps** — The procedure to follow
3. **Gotchas** — Common mistakes to avoid
4. **Examples** — Code snippets or patterns
5. **Validation** — How to verify correctness
