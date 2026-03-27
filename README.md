# Self-Improving Agent

*A memory protocol that enables AI coding agents to learn across sessions.*

**Latest: v0.3.0** · [Changelog](CHANGELOG.md)

---

## What is this?

You install this system once and get persistent AI memory across all your projects. Each coding session makes the agent smarter — it accumulates lessons, detects patterns, and proposes reusable skills automatically. Over time, the agent stops repeating mistakes and surfaces relevant knowledge exactly when you need it.

This repo includes the memory protocol, automation hooks, slash commands, and a project template for structuring new codebases.

## How it works

Every session follows a three-phase feedback loop. The output of each session feeds into the next, creating compound learning over time.

```
    +---------------------------------------------+
    |                                              |
    v                                              |
RETRIEVAL (session start)                          |
  Surface relevant experiences                     |
  and skills from memory                           |
    |                                              |
    v                                              |
DEVELOPMENT (normal coding)                        |
  Work as usual -- the agent                       |
  has context from past sessions                   |
    |                                              |
    v                                              |
ACCUMULATION (session end)                         |
  Auto-capture lessons learned                     |
  Detect emerging patterns ---------> feeds back --+
```

Knowledge is organized in three tiers:

| Tier | Location | Purpose |
|---|---|---|
| **Global** | Obsidian Vault | Cross-project experiences, reusable skills, user preferences |
| **Domain** | Tagged experiences in the vault | Stack-specific knowledge ("Convex patterns", "Stripe gotchas") |
| **Project** | `.agents/` folder in each repo | Project-specific context (PRD, tasks, session logs) |

## Commands

These are slash commands you install during setup (see [Step 4](getting-started/04-hooks-and-commands.md)).

| Command | When | What it does |
|---|---|---|
| `/start` | Session start | Reads project state, recalls relevant knowledge, creates session log |
| `/end` | Session end | Captures lessons, updates project state, writes handoff notes |
| `/skill-scan` | On demand | Scans experience clusters and proposes reusable skills |

## Automation hooks

These run automatically once configured (see [Step 4](getting-started/04-hooks-and-commands.md)).

| Hook | Trigger | What it does |
|---|---|---|
| `session-bootstrap.mjs` | SessionStart | Auto-detects project, reads handoff, checks vault-writer health |
| `vault-writer.mjs` | SessionEnd | Extracts experiences from session DB, writes to Knowledge MCP |
| `vault-skill-scan.mjs` | SessionEnd | Detects experience clusters, proposes skills |

## What you'll set up

- **Claude Code CLI** — AI coding agent that runs in your terminal
- **VS Code** (or any editor) — your development environment
- **Node.js v22 LTS** — runs the automation hooks that capture knowledge
- **Git + GitHub** — version control for your projects
- **Obsidian** — desktop app for browsing and editing your knowledge vault
- **Knowledge MCP** — persistent memory storage server (bundled in `knowledge-mcp/`)
- **Smart Connections MCP** — semantic search over your knowledge vault

## Getting Started

> **Note:** Setup is currently a guided manual process — you walk through each step with your AI agent coaching you. Automated setup scripts are planned.

See [getting-started/01-prerequisites.md](getting-started/01-prerequisites.md)

## Architecture

Learn how the memory layer, accumulation hooks, and skill distillation work together.

See [how-it-works/overview.md](how-it-works/overview.md)

## Project Template

New projects benefit from a standard folder structure that gives the AI agent immediate context. The included template sets up an `.agents/` directory with a PRD, task tracking, and session logs.

See [project-template/README.md](project-template/README.md)

## A2A Wrapper (Multi-Agent)

A lightweight wrapper that turns any machine with Claude Code into a hub-connected agent. It polls an [A2A Hub](https://github.com/melvenac/A2A-Hub) for tasks, runs them via `claude --print`, and reports results back. Bundled in `a2a-wrapper/`.

See [how-it-works/multi-agent.md](how-it-works/multi-agent.md)

## License

MIT
