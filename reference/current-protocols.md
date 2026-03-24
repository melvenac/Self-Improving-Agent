# Current Protocols — v2.0 (Obsidian-Based)

> Snapshot of the learning system as it exists today (2026-03-18).
> Architecture migrated from SQLite-only storage to Obsidian Vault (markdown files) + Knowledge MCP (FTS5 search).

## Retrieval Protocol (Session Start)

**Trigger:** `/start` skill or manual session beginning
**Steps:**
1. Search `~/Obsidian Vault/Experiences/` and `~/Obsidian Vault/Sessions/` using Smart Connections MCP (or grep/Read fallback if MCP unavailable)
2. Read `~/Obsidian Vault/Guidelines/SKILL-INDEX.md` for matching skills
3. Surface max 3 experiences + 2 skills as non-prescriptive guidance

**Query approach:** Search by project name + domain tags. Example: `"convex validator gotcha"`, `"stripe convex action"`, or the project name directly.

**Fallback (if Smart Connections MCP unavailable):** Use Glob to list `~/Obsidian Vault/Experiences/*.md` and Read relevant files by name/date.

**Domain tag mapping:**

| Project | Tags |
|---|---|
| *(your projects)* | *(your domain tags)* |

> Define your own project/tag mappings in `~/.claude/CLAUDE.md`.

## Accumulation Protocol (Session End)

**Trigger:** Automatic via `SessionEnd` hook (`vault-writer.mjs`) — no manual `/end` required
**Steps:**
1. `vault-writer.mjs` hook fires on session end and writes session data to `~/Obsidian Vault/Sessions/`
2. Significant lessons are written as individual experience files to `~/Obsidian Vault/Experiences/`
3. WikiLinks connect experiences to projects, topics, and related notes
4. Dedup check: before writing a new experience, search existing files — merge if >90% similar
5. Skill distillation candidates surfaced when 3+ similar experiences accumulate

**Note:** `/end` skill can still be run manually to supplement automatic capture or force a session summary.

## Experience Format

Individual `.md` files in `~/Obsidian Vault/Experiences/` with this structure:

```markdown
---
title: {short-title}
project: {project-name}
domain: {domain-tag}
date: {YYYY-MM-DD}
type: {gotcha | pattern | decision | fix | optimization}
---

## TRIGGER
{when this is relevant — what situation would make this useful}

## ACTION
{what to do}

## CONTEXT
{what was happening when this was learned}

## OUTCOME
{what happened — success or failure}

## Links
[[{related-project}]] [[{related-topic}]]
```

## Guardrails

- **Context cap:** Max 3 experiences + 2 skills per session start
- **Dedup:** Search vault before writing — merge if >90% similar
- **Skill gate:** Never auto-create — propose to user, 3-experience minimum
- **Non-prescriptive:** Retrieved knowledge is guidance, not mandates
- **Monthly pruning:** Review and archive stale experience files in vault

## Infrastructure Dependencies

| Component | Role | Location |
|---|---|---|
| Smart Connections MCP | Semantic search across vault | Obsidian plugin + MCP bridge |
| Obsidian Vault | Primary storage — experiences, sessions, skills, topics | `~/Obsidian Vault/` |
| vault-writer.mjs | SessionEnd hook — auto-captures session data | `~/.claude/hooks/` (or scripts/) |
| Global CLAUDE.md | Boot loader — protocols live here | `~/.claude/CLAUDE.md` |
| `/start` skill | Triggers retrieval at session start | superpowers skill |
| `/end` skill | Manual accumulation trigger (supplement to hook) | superpowers skill |
| Claude memory files | User/feedback/project/reference memories | `~/.claude/projects/*/memory/` |

## Key Vault Folders

| Folder | Contents |
|---|---|
| `~/Obsidian Vault/Experiences/` | Individual experience `.md` files |
| `~/Obsidian Vault/Sessions/` | Session logs written by vault-writer.mjs |
| `~/Obsidian Vault/Topics/` | Topic cluster notes with WikiLinks |
| `~/Obsidian Vault/Summaries/` | High-level summaries across domains |
| `~/Obsidian Vault/Guidelines/` | SKILL-INDEX.md + reusable skill files |
