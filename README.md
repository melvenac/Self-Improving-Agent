# Self-Improving Agent

*A full-stack AI development environment that learns across sessions.*

---

## What is this?

You install this system once and get persistent AI memory across all your projects. Each coding session makes the agent smarter -- it accumulates lessons, detects patterns, and distills reusable skills automatically. Over time, the agent stops repeating mistakes, surfaces relevant knowledge exactly when you need it, and builds a growing library of best practices tailored to your stack.

This repo includes everything you need: the memory protocol, automation hooks, slash commands, and a project template for structuring new codebases with AI-readable context.

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

## Related Project: A2A Hub

The A2A Intelligent Hub (agent-to-agent communication system) was originally developed in this repo and has been extracted to its own project at [`A2A-Hub`](https://github.com/melvenac/A2A-Hub). It is not part of the Self-Improving Agent setup.

## What you'll set up

- **Claude Code CLI** -- AI coding agent that runs in your terminal
- **VS Code** (or any editor) -- your development environment
- **Node.js (LTS)** -- runs the automation hooks that capture knowledge
- **Git + GitHub** -- version control for your projects
- **Obsidian** -- desktop app for browsing and editing your knowledge vault
- **Open Brain MCP** -- persistent memory storage server for the AI agent
- **Smart Connections MCP** -- semantic search over your knowledge vault

## Getting Started

Follow the step-by-step guide to set up your environment.

See [getting-started/01-prerequisites.md](getting-started/01-prerequisites.md)

## Architecture

Learn how the memory layer, accumulation hooks, and skill distillation work together.

See [how-it-works/overview.md](how-it-works/overview.md)

## Project Template

New projects benefit from a standard folder structure that gives the AI agent immediate context about your codebase. The included project template sets up an `.agents/` directory with a PRD, task tracking, and session logs so the agent can orient itself from the first session.

See [project-template/README.md](project-template/README.md)

## License

MIT
