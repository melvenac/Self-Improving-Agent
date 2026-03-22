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

## Repository Structure Note

The `hub/` and `wrapper/` directories are **not part of the core Self-Improving Agent setup**. They are a separate A2A (Agent-to-Agent) communication system used by the project maintainers for remote troubleshooting and knowledge accumulation.

- **`hub/`** — The A2A Intelligent Hub server (deployed centrally, not needed locally). You do not need to install or run this.
- **`wrapper/`** — Optional local agent that connects to the Hub for collaborative troubleshooting. Only needed if a maintainer asks you to connect for debugging support.

**If you're installing the Self-Improving Agent, ignore both directories.** Follow the setup guide below.

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
