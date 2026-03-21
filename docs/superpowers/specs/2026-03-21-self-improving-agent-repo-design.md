# Self-Improving-Agent Repo Consolidation Design

> **Date:** 2026-03-21
> **Status:** Draft
> **Author:** Clark + Aaron

## Summary

Consolidate the Learning System and AI-First Development Framework into a single GitHub repo called **Self-Improving-Agent**. The learning system (global memory protocol) is the primary product. The AI-First Framework becomes a project template nested inside it.

**Tagline:** *A full-stack AI development environment that learns across sessions*

**Target audience:** Developers new to Claude Code CLI and AI-assisted development. Setup instructions assume minimal prior experience with CLI tools, IDEs, and MCP servers.

## Core Concept

The system has two layers:

- **Global layer** (this repo) — persistent memory across all projects. Obsidian Vault stores experiences, sessions, and skills. SessionEnd hooks auto-capture lessons. `/recall` surfaces relevant knowledge at session start.
- **Project layer** (the template) — `.agents/` scaffold copied into each new project. PRD, entities, rules, tasks, sessions, workflows. Gives the AI agent structured context for one specific codebase.

The global layer is the brain. The project layer is a tool it uses.

## Repo Structure

```
Self-Improving-Agent/
├── README.md                          # Landing page + tagline + links
├── CHANGELOG.md
├── package.json                       # Hook dependencies
│
├── getting-started/                   # Step-by-step beginner guide
│   ├── 01-prerequisites.md            # Claude Code, VS Code, Node, Git, Obsidian
│   ├── 02-clone-and-configure.md      # Clone repo, create vault dirs, open in Obsidian
│   ├── 03-mcp-servers.md              # Open Brain, Smart Connections (+ index repo)
│   ├── 04-hooks-and-commands.md       # SessionEnd hooks, slash commands
│   └── 05-verify-installation.md      # Guided first session
│
├── how-it-works/                      # Architecture docs
│   ├── overview.md                    # Three-layer feedback loop
│   ├── memory-layer.md                # Vault structure, experience format
│   ├── accumulation.md                # SessionEnd hooks, skill-scan
│   ├── retrieval.md                   # /recall, Open Brain, Smart Connections
│   └── skill-distillation.md          # Clustering, proposals, skill template
│
├── project-template/                  # AI-First Framework (copy into new projects)
│   ├── README.md                      # How to use this template
│   ├── .agents/
│   │   ├── FRAMEWORK.md
│   │   ├── SYSTEM/                    # PRD, entities, rules, testing, decisions, security, runbook, summary
│   │   ├── TASKS/                     # INBOX.md, task.md
│   │   ├── SESSIONS/                  # Session template
│   │   ├── skills/                    # INDEX.md
│   │   └── workflows/                # start.md, end.md, test.md, task.md
│   ├── .claude/
│   │   └── commands/                  # Claude Code slash commands
│   └── .gemini/
│       └── commands/                  # Gemini equivalents
│
├── scripts/                           # Automation hooks
│   ├── vault-writer.mjs               # SessionEnd: session log + experience extraction
│   └── vault-skill-scan.mjs           # On-demand: cluster detection
│
├── commands/                          # Global slash commands
│   ├── recall.md                      # /recall — surface relevant knowledge
│   ├── end.md                         # /end — manual review of auto-extracted experiences
│   ├── skill-scan.md                  # /skill-scan — trigger skill candidate detection
│   └── start.md                       # /start — project-aware session startup
│
└── reference/                         # Advanced docs
    ├── current-protocols.md           # Full protocol specification
    ├── gaps.md                        # Known limitations + roadmap
    └── advanced-config.md             # Customizing hooks, tuning retrieval
```

## Required Tools (All Required)

| Tool | Purpose |
|---|---|
| Claude Code CLI | AI coding agent |
| VS Code (or any IDE) | Development environment |
| Node.js (LTS) | Runs hooks and scripts |
| Git + GitHub account | Version control |
| Obsidian | Knowledge vault UI |
| Open Brain MCP | Persistent memory storage |
| Smart Connections MCP | Semantic search across vault + repo |

All tools are required for the system to function. No tiered setup — the getting-started guide walks through every install sequentially.

## Getting Started Guide Design

Five numbered docs. Each starts with a **"What you'll do"** one-liner and ends with **"Next step →"** linking forward.

### 01-prerequisites.md
- One sentence per tool explaining why it's needed
- Install Claude Code CLI (link to official docs, verify with `claude --version`)
- Install VS Code (note: any IDE works, VS Code used in examples)
- Install Node.js LTS (verify with `node --version`)
- Install Git (verify with `git --version`)
- Create GitHub account if needed
- Install Obsidian (link, brief explanation)

### 02-clone-and-configure.md
- Clone the repo
- Directory structure walkthrough — what each folder is for
- Create Obsidian Vault directory structure: `~/Obsidian Vault/` with subdirectories:
  - `Sessions/`, `Experiences/`, `Topics/`, `Guidelines/`
- Open the vault in Obsidian for the first time

### 03-mcp-servers.md
- What MCP servers are (one beginner-level paragraph)
- Install and configure Open Brain
- Install and configure Smart Connections
- Configure Smart Connections to index the repo directory (so how-it-works docs are searchable)
- Verify both are working in Claude Code

### 04-hooks-and-commands.md
- What hooks are and why they matter (auto-capture after every session)
- Copy/configure SessionEnd hooks in Claude Code's `settings.json`
- Copy slash commands to `~/.claude/commands/` for global availability
- Verify hooks are registered

### 05-verify-installation.md
- Guided first session: start Claude Code, run `/recall`, do a small task, end session
- Check that a session log appeared in the vault
- Check that an experience was captured
- "You're set up!" — link to how-it-works for deeper understanding

## How It Works Docs

### overview.md
- Core idea: three-layer feedback loop (Memory → Retrieval → Development → Accumulation → Memory)
- Text diagram of the cycle
- Three tiers: Global (vault), Domain (tagged experiences), Project (.agents/)
- Links to detail docs

### memory-layer.md
- What the Obsidian Vault stores: sessions, experiences, skills
- File structure and YAML frontmatter format
- Experience structure: TRIGGER / ACTION / CONTEXT / OUTCOME
- How sessions link to experiences via WikiLinks

### accumulation.md
- What happens at session end (automatic via hooks)
- vault-writer.mjs: creates session log, extracts experiences, updates topic links
- vault-skill-scan.mjs: detects experience clusters, proposes skills at 3+ similar
- Guardrails: dedup, skill gate (never auto-creates), context cap

### retrieval.md
- What happens at session start (/recall)
- How Open Brain + Smart Connections surface relevant experiences
- The 3 experiences + 2 skills cap per session
- How retrieval-count and last-used frontmatter enable relevance scoring

### skill-distillation.md
- How experiences cluster into skill candidates
- SKILL-CANDIDATES.md and SKILL-INDEX.md
- Proposal flow: detect cluster → propose to user → user approves → create skill
- Skill template format

## Project Template

A clean copy of the AI-First Framework `.agents/` structure. No personal config, no Obsidian references, no Open Brain calls. Those live in the global layer.

**Template README explains:**
1. What this is (project-level AI context scaffold)
2. How to use it: copy `project-template/` contents into your new project root
3. First steps: fill in PRD.md, ENTITIES.md, RULES.md
4. How it connects to the learning system (sessions feed experiences back to vault)

## Scripts & Commands

### Scripts (automation hooks)
| Script | Trigger | Purpose |
|---|---|---|
| `vault-writer.mjs` | SessionEnd | Creates session log, extracts experiences, updates topic links |
| `vault-skill-scan.mjs` | On-demand / periodic | Scans experiences for clusters, updates SKILL-CANDIDATES.md |

### Commands (global slash commands)
| Command | When | Purpose |
|---|---|---|
| `/recall` | Session start | Surfaces relevant experiences + skills from vault |
| `/end` | Session end | Optional manual review of auto-extracted experiences |
| `/skill-scan` | Anytime | Triggers skill candidate detection |
| `/start` | Session start | Full project-aware startup (reads .agents/ + runs /recall) |

Scripts are configured as SessionEnd hooks in `settings.json`. Commands are copied to `~/.claude/commands/` for global availability.

## Migration Plan

### Phase 1: Restructure this repo
1. Reorganize existing files into new directory structure
2. Move `current-protocols.md`, `gaps.md` → `reference/`
3. Move existing `scripts/`, `commands/` into place
4. Move `scripts/package.json` to repo root
5. Move `setup.md` content into `getting-started/` guides (rewrite for beginners)
6. Archive or remove existing planning artifacts (`docs/superpowers/`, `superpowers/`) — this spec moves to `reference/` once implementation is complete

### Phase 2: Import framework template
> **Note:** The AI-First Framework repo contains the complete `.agents/` scaffold with all files. This phase copies them into the template, stripping personal config.

1. Copy `.agents/` structure from `AI-First-Developement-Framwork` into `project-template/` (excluding META/ and session logs)
2. Copy `.claude/commands/`, `.gemini/commands/`, `.clinerules/` into `project-template/`
3. Rename existing `scripts/skill-scan.mjs` to `scripts/vault-skill-scan.mjs` (aligning with spec naming)
4. Strip any personal config (Obsidian paths, Open Brain references) — template is project-scoped only
5. Write template README

### Phase 3: Write new docs and missing scripts
1. Write README with tagline and landing page structure
2. Write all five getting-started guides
3. Write all five how-it-works docs
4. Write `reference/advanced-config.md`
5. Author `vault-writer.mjs` — the core SessionEnd hook (currently configured in Claude Code settings but not yet in this repo as a standalone script)
6. Author `commands/start.md` — does not exist yet in the current repo

### Phase 4: Rename and archive
1. Rename GitHub repo `Learning-System` → `Self-Improving-Agent`
2. Archive `AI-First-Developement-Framwork` repo with redirect README
3. Update `~/.claude/CLAUDE.md` paths and domain tags
4. Decide whether repo gets a project-level `CLAUDE.md` or relies on the global one

## Future Enhancements (Not in Scope)

- **Setup scripts** (`setup.sh` / `setup.ps1`) — automate tool installation
- **Version checking** — script to verify all tools are at compatible versions
- **Template CLI** — `npx create-ai-first-project` or similar

## Assumptions

| Assumption | Impact if wrong |
|---|---|
| `vault-writer.mjs` needs to be authored as a standalone script (currently behavior is in Claude Code settings/hooks, not a repo file) | Phase 3 scope increases — need to extract or write the hook logic |
| The `.agents/` template files exist in the framework repo and can be copied directly | If files are incomplete, we'd need to author missing pieces |
| The existing `superpowers/` and `docs/superpowers/` planning artifacts can be archived after implementation | If they're referenced elsewhere, we need redirects |
| Smart Connections can be configured to index directories outside the vault | If not, we fall back to symlinks or copying how-it-works docs into the vault |

## Decisions Made

| Decision | Rationale |
|---|---|
| Repo named `Self-Improving-Agent` | Captures the core concept; tagline clarifies it's a full dev environment |
| All tools required, no tiered setup | The pieces depend on each other; the system doesn't work without the full stack |
| Nested structure (template inside learning system) | The learning system is the product; the framework is a component |
| Smart Connections indexes the repo | How-it-works docs become searchable without copying into vault |
| Archive old framework repo | Clean break; redirect prevents confusion |
| Beginner-focused docs | Target audience may be new to CLI, IDEs, and MCP |
