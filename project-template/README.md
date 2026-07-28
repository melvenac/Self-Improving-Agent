# Project Template: AI Context Scaffold

This is the **project-level** layer of the [Self-Improving Agent](https://github.com/melvenac/Self-Improving-Agent) system — structured `.agents/` context that gives coding agents deep understanding of your codebase from the first prompt.

**Session lifecycle is global.** Install SIA once; `/start`, `/end`, `/sync` live in `~/.claude/commands/` (Claude Code) and `~/.cursor/commands/` (Cursor), not in each project.

---

## Supported Agents

| Agent | Project context | Session protocol |
|-------|-----------------|------------------|
| **Claude Code** | `CLAUDE.md` + `.agents/` | Global `/start`, `/end` (via SIA `setup.mjs`) |
| **Cursor** | `AGENTS.md` + `.agents/SYSTEM/SUMMARY.md` | Global `/start`, `/end` (via SIA `setup.mjs` → `~/.cursor/commands/` + open-brain MCP) |
| **Cline** | `.clinerules/` + `.agents/` | Manual or custom rules |
| **Gemini** | `CLAUDE.md` + `.agents/` | Manual |

---

## How to Use

### Full setup (recommended)

```bash
# 1. One-time: install SIA globally
git clone https://github.com/melvenac/Self-Improving-Agent.git
cd Self-Improving-Agent && node scripts/setup.mjs
# Restart Claude Code and Cursor

# 2. Per project: copy the scaffold
cp -r project-template/.agents /path/to/your-project/
cp -r project-template/.claude/rules /path/to/your-project/.claude/   # optional
cp project-template/CLAUDE.md /path/to/your-project/                   # customize
```

### Standalone (no SIA)

```bash
cp -r project-template/.agents /path/to/your-project/
```

Works without cross-project memory or global commands. Agents must manually read `SUMMARY.md` + `INBOX.md` each session.

---

## Fill in project context

| File | Purpose |
|------|---------|
| `PRD.md` | What the project does, phases, tech stack |
| `ENTITIES.md` | Data models and schemas |
| `RULES.md` | Coding standards and conventions |
| `SUMMARY.md` | **CURRENT STATE block** — overwritten each session |
| `DECISIONS.md` | Architectural decisions (append-only) |
| `INBOX.md` | Live task queue |
| `task.md` | Phase completion ledger (append-only) |
| `TESTING.md`, `RUNBOOK.md`, `SECURITY.md` | Add as project matures |

**Start with PRD, ENTITIES, and RULES** — enough for the agent to be useful on day one.

---

## Directory structure

```
.agents/
  FRAMEWORK.md        # Full guide (v1.1) — read for deep reference
  SYSTEM/             # Project truth (you fill these in)
  TASKS/              # INBOX.md (live) + task.md (ledger)
  SESSIONS/           # Session logs (/start creates these)
  skills/             # Stack-specific patterns (emerge over time)
  a2a/                # Optional: multi-agent mailbox (mature projects)

.claude/rules/        # Optional: path-triggered rules (Claude Code only)
CLAUDE.md             # Claude Code entry point
AGENTS.md             # Cursor / generic entry point
```

**Not copied per project:** `~/.claude/commands/` and `~/.cursor/commands/` (`/start`, `/end`, `/sync`, …) — installed by SIA `setup.mjs`.

---

## Session workflow

1. **`/start`** — recalls cross-project knowledge, reads SUMMARY + INBOX, creates session log
2. **Work** — agent uses `.agents/` + your codebase
3. **`/end`** — updates SUMMARY, INBOX, session log; accumulates lessons to vault

See [`.agents/FRAMEWORK.md`](.agents/FRAMEWORK.md) for the full v1.1 guide (two-layer model, skills, zero-token testing, anti-patterns).

---

## Connection to SIA

| SIA (global) | This template (per project) |
|--------------|----------------------------|
| open-brain MCP recall/store | PRD, ENTITIES, RULES |
| Obsidian vault experiences | SUMMARY, DECISIONS, gotchas |
| `/skill-scan` proposals | Project skills in `.agents/skills/` |
| Session hooks | Session logs in `.agents/SESSIONS/` |

Sessions in any project feed experiences back into your vault — patterns learned on Project A help Project B.

Full SIA setup: [README.md](../README.md)
