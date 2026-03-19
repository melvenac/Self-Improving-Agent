# Self-Improving Agent Protocol

> Quick reference for AI agents. For the full guide, see `~/Obsidian Vault/Guidelines/SELF-IMPROVING-AGENT-GUIDE.md`.

## Architecture

3-tier hub-and-spoke: **Global** (CLAUDE.md + Open Brain + Obsidian) → **Domain** (tagged experiences) → **Project** (.claude + .agents).

## Retrieval (at /start, steps 0a-0b)

1. `kb_recall` with project name + domain tags → max 3 experiences
2. Read `~/Obsidian Vault/Guidelines/SKILL-INDEX.md` → max 2 skills
3. Present as non-prescriptive guidance

## Accumulation (at /end, steps 9-10)

1. Extract gotchas/lessons from session log
2. Format as `[EXPERIENCE]` block (PROJECT, DOMAIN, DATE, TYPE, TRIGGER, ACTION, CONTEXT, OUTCOME)
3. Dedup via `kb_recall` before `kb_store`
4. Store session summary via `kb_store_summary`
5. If 3+ similar experiences → propose skill to Aaron (never auto-create)

## Experience Format

```
[EXPERIENCE] {short-title}
PROJECT: {name}
DOMAIN: {tags}
DATE: {YYYY-MM-DD}
TYPE: {gotcha | pattern | decision | fix | optimization}

TRIGGER: {when relevant}
ACTION: {what to do}
CONTEXT: {what was happening}
OUTCOME: {what happened}
```

## Guardrails

- Max 3 experiences + 2 skills per session start
- Always dedup before storing
- Never auto-create skills (ask Aaron, 3-experience minimum)
- Non-prescriptive — all retrieved knowledge is guidance
- Monthly `kb_prune`
