# Self-Improving Agent

*A memory protocol that enables AI coding agents to learn across sessions.*

**Latest: v0.4.0** · [Changelog](CHANGELOG.md)

---

## What is this?

You install this system once and get persistent AI memory across all your projects. Each coding session makes the agent smarter — it accumulates lessons, detects patterns, and proposes reusable skills automatically. Over time, the agent stops repeating mistakes and surfaces relevant knowledge exactly when you need it.

This repo includes the memory protocol, automation hooks, slash commands, and a project template for structuring new codebases.

## How it works

Every session follows a three-phase feedback loop:

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

## Prerequisites

- **Claude Code CLI** — AI coding agent ([claude.ai/code](https://claude.ai/code))
- **Node.js v22 LTS** — runs the automation hooks (v24 breaks Smart Connections)
- **Git + GitHub** — version control
- **Obsidian** — desktop app for browsing your knowledge vault
- **VS Code** (or any editor)

## Getting Started

### Quick Start (recommended)

```bash
git clone https://github.com/melvenac/Self-Improving-Agent.git
cd Self-Improving-Agent
node scripts/setup.mjs
```

This installs the Knowledge MCP server, registers hooks, copies slash commands, and scaffolds the Obsidian vault. Restart Claude Code after running.

For framework developers (symlinks source for live editing):
```bash
node scripts/setup.mjs --dev
```

### Manual Setup

<details>
<summary>Step-by-step instructions (if you prefer manual control)</summary>

### 1. Clone and install

```bash
git clone https://github.com/melvenac/Self-Improving-Agent.git
cd Self-Improving-Agent
```

### 2. Set up Knowledge MCP

The knowledge MCP server provides persistent memory (kb_recall, kb_store, kb_feedback, kb_stats).

```bash
# Install to the Claude Code MCP directory
mkdir -p ~/.claude/knowledge-mcp
cp -r knowledge-mcp/src knowledge-mcp/package.json knowledge-mcp/tsconfig.json ~/.claude/knowledge-mcp/
cp -r knowledge-mcp/scripts ~/.claude/knowledge-mcp/
cd ~/.claude/knowledge-mcp
npm install
npm run build
```

Register it in your Claude Code MCP settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "open-brain-knowledge": {
      "command": "node",
      "args": ["~/.claude/knowledge-mcp/build/server.js"]
    }
  }
}
```

### 3. Set up automation hooks

Copy the hook scripts to your Claude Code scripts directory:

```bash
cp -r knowledge-mcp/scripts ~/.claude/knowledge-mcp/scripts
cp scripts/session-bootstrap.mjs ~/.claude/knowledge-mcp/scripts/
```

This installs 5 scripts: `vault-writer.mjs`, `vault-utils.mjs`, `vault-sync-projects.mjs`, `auto-index.mjs`, `skill-scan.mjs`, plus the session bootstrap hook.

Add hooks to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "node ~/.claude/knowledge-mcp/scripts/session-bootstrap.mjs" }]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "node ~/.claude/knowledge-mcp/scripts/vault-writer.mjs" },
          { "type": "command", "command": "node ~/.claude/knowledge-mcp/scripts/skill-scan.mjs" }
        ]
      }
    ]
  }
}
```

### 4. Set up slash commands

Copy the commands to your global Claude Code commands directory:

```bash
mkdir -p ~/.claude/commands
cp .claude/commands/start.md ~/.claude/commands/
cp .claude/commands/end.md ~/.claude/commands/
cp .claude/commands/skill-scan.md ~/.claude/commands/
```

### 5. Set up Obsidian vault

Create the vault directory structure:

```bash
mkdir -p ~/Obsidian\ Vault/{Experiences,Sessions,Guidelines,Topics,Logs}
```

Open this folder in Obsidian as a vault. Install the **Smart Connections** plugin for semantic search (optional but recommended).

### 6. Verify installation

Start a Claude Code session and run `/start`. You should see:
- Session bootstrap hook fires (project detection, handoff check)
- Knowledge recall attempts (may be empty on first run)
- Session log created

</details>

## Commands

| Command | When | What it does |
|---|---|---|
| `/start` | Session start | Reads project state, recalls relevant knowledge, creates session log |
| `/end` | Session end | Captures lessons, updates project state, writes handoff notes |
| `/sync` | Before commits | Validates version consistency across all doc files |
| `/skill-scan` | On demand | Scans experience clusters and proposes reusable skills |

## Automation hooks

| Hook | Trigger | What it does |
|---|---|---|
| `session-bootstrap.mjs` | SessionStart | Auto-detects project, reads handoff, checks vault-writer health |
| `vault-writer.mjs` | SessionEnd | Extracts experiences from session DB, writes to Knowledge MCP |
| `skill-scan.mjs` | SessionEnd | Detects experience clusters, proposes skills |

## Project Template

New projects benefit from a standard folder structure that gives the AI agent immediate context. The included template sets up an `.agents/` directory with a PRD, task tracking, and session logs.

```bash
cp -r project-template/.agents your-project/.agents
cp -r project-template/.claude your-project/.claude
```

See [project-template/README.md](project-template/README.md) for details.

## A2A Wrapper (Multi-Agent)

A lightweight wrapper that turns any machine with Claude Code into a hub-connected agent. It polls an [A2A Hub](https://github.com/melvenac/A2A-Hub) for tasks, runs them via `claude --print`, and reports results back.

See [a2a-wrapper/](a2a-wrapper/) for details.

## License

MIT
