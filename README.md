# Learning System

**A self-improving agent protocol that gives AI coding agents persistent memory, pattern recognition, and compound learning across sessions.**

Built on [Open Brain](https://github.com/melvenac/open-brain-knowledge) (MCP memory server) + [Obsidian](https://obsidian.md/) (knowledge graph) + Claude Code hooks.

---

## What This Is

Most AI coding sessions start from zero. The agent doesn't remember what you built yesterday, what gotchas you hit, or what patterns work in your stack. This system fixes that with three layers:

| Layer | What It Does | How |
|---|---|---|
| **Memory** | Persistent knowledge across sessions | Open Brain MCP + Obsidian Vault |
| **Accumulation** | Auto-captures lessons from every session | SessionEnd hooks (vault-writer + skill-scan) |
| **Retrieval** | Surfaces relevant knowledge at session start | `/recall` command + Smart Connections |

The result: **compound loops that accumulate value over time.** Each session adds experiences. The skill-scan hook detects emerging patterns. When enough experiences cluster around a topic, it proposes distilling them into a reusable skill. The agent gets smarter with every session.

## Architecture

```
Session Start                          Session End
    |                                      |
    v                                      v
 /recall                            vault-writer.mjs
    |                                   |     |
    v                                   v     v
 Open Brain ---------> Obsidian    Sessions/  Experiences/
 (kb_recall)           Vault           |          |
    |                    |             v          v
    v                    v        skill-scan.mjs
 Smart Connections   SKILL-INDEX      |
 (semantic search)       |            v
    |                    v    SKILL-CANDIDATES.md
    v               Inject        (proposals)
 Surface 3 experiences
 + 2 skills as guidance
```

### The Three "Lego Bricks" (from [this video](https://www.youtube.com/watch?v=vqnAOV8NMZ4))

An autonomous agent needs three building blocks:

1. **Memory** — persistent knowledge that survives across sessions
2. **Tools** — MCP servers that let the agent act (file I/O, APIs, knowledge stores)
3. **Proactivity** — the agent acts without being asked (hooks, `/loop`, scheduled scans)

Combine all three and you get **compound loops** — each cycle stores observations, subsequent cycles pattern-match against history, and value accumulates over time.

## Quick Start

See **[setup.md](setup.md)** for the full installation guide. The short version:

1. Install [Open Brain MCP](https://github.com/melvenac/open-brain-knowledge) for persistent memory
2. Set up an Obsidian vault with the folder structure below
3. Install the SessionEnd hooks (vault-writer + skill-scan)
4. Copy the slash commands (`/recall`, `/skill-scan`, `/end`) to `~/.claude/commands/`
5. Optionally install [Smart Connections MCP](https://github.com/yejianye/smart-connections-mcp) for semantic search

## Vault Structure

```
~/Obsidian Vault/
├── Experiences/          ← Individual lessons (gotchas, patterns, decisions, fixes)
├── Sessions/             ← Auto-generated session logs
├── Topics/               ← Auto-linked topic notes
├── Projects/             ← Synced project docs (PRD, README, Summary)
├── Guidelines/           ← Distilled skills + candidates
│   ├── SKILL-INDEX.md    ← Registry of production skills
│   └── SKILL-CANDIDATES.md  ← Auto-detected clusters
└── .vault-writer.log     ← Hook execution log
```

## Key Files in This Repo

| File | Purpose |
|---|---|
| [SELF-IMPROVING-AGENT.md](SELF-IMPROVING-AGENT.md) | Protocol quick reference for AI agents |
| [current-protocols.md](current-protocols.md) | Detailed protocol documentation |
| [gaps.md](gaps.md) | Known gaps and improvement backlog |
| [setup.md](setup.md) | Step-by-step installation guide |
| [scripts/skill-scan.mjs](scripts/skill-scan.mjs) | SessionEnd hook — pattern recognition loop |
| [commands/recall.md](commands/recall.md) | `/recall` slash command — knowledge retrieval |
| [commands/skill-scan.md](commands/skill-scan.md) | `/skill-scan` slash command — manual cluster scan |
| [commands/end.md](commands/end.md) | `/end` slash command — knowledge capture |

## How It Works In Practice

**Session 1-5:** You work normally. vault-writer captures gotchas and decisions as experiences.

**Session 6:** skill-scan detects 3 experiences tagged "convex" — proposes a skill.

**Session 10:** You approve. A "Convex Patterns" skill is distilled from 5 experiences. Future sessions surface it automatically.

**Session 20:** A new developer joins. `/recall` surfaces the accumulated knowledge — they don't start from zero.

## Related Projects

- [Open Brain](https://github.com/melvenac/open-brain-knowledge) — the MCP memory server
- [AI-First Development Framework](https://github.com/melvenac/AI-First-Development-Framework) — project scaffold (`.agents/` structure)

---

Inspired by the compound loop architecture described in [this video](https://www.youtube.com/watch?v=vqnAOV8NMZ4) by AI News & Strategy Daily.
