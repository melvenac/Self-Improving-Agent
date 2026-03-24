# .agents/ Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a populated `.agents/` directory at the repo root so the Self-Improving Agent project can track its own development.

**Architecture:** Create 12 markdown files across 4 directories. All content is pre-defined in the approved spec (`docs/superpowers/specs/2026-03-23-agents-scaffold-design.md`). The entire `.agents/` directory is gitignored.

**Tech Stack:** Markdown files, git

**Spec:** `docs/superpowers/specs/2026-03-23-agents-scaffold-design.md`

---

### Task 1: Update .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add .agents/ and .claude/ to .gitignore**

Append to `.gitignore`:

```
# Local development framework (not distributed)
/.agents/
/.claude/
```

Leading slash anchors to repo root so `project-template/.agents/` and `project-template/.claude/` are unaffected.

- [ ] **Step 2: Verify gitignore works**

Run: `git status`
Expected: `.gitignore` shows as modified, no `.agents/` files visible.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore .agents/ and .claude/ for local dev framework"
```

---

### Task 2: Create directory structure

**Files:**
- Create: `.agents/SYSTEM/` (directory)
- Create: `.agents/TASKS/` (directory)
- Create: `.agents/SESSIONS/` (directory)
- Create: `.agents/skills/` (directory)

- [ ] **Step 1: Create all directories**

```bash
mkdir -p .agents/SYSTEM .agents/TASKS .agents/SESSIONS .agents/skills
```

- [ ] **Step 2: Verify**

```bash
ls -R .agents/
```

Expected: Four empty subdirectories.

---

### Task 3: Create SYSTEM/PRD.md

**Files:**
- Create: `.agents/SYSTEM/PRD.md`

- [ ] **Step 1: Write PRD.md**

```markdown
# Self-Improving Agent — Product Requirements Document

## Project Overview

| Field | Value |
|---|---|
| **Project** | Self-Improving Agent |
| **Description** | A memory protocol and automation layer that enables AI coding agents to learn across sessions. Provides retrieval/accumulation hooks, slash commands, and a project template for persistent AI learning. |
| **Repo** | https://github.com/melvenac/Self-Improving-Agent |
| **Version** | v4.0.0 |
| **License** | MIT |

## Target Users

- **Solo developers** using Claude Code who want persistent AI memory across projects (primary)
- **Small teams** wanting shared AI context across sessions
- **Aaron** (dogfooding — using the system to develop the system)

## Problem Statement

AI coding sessions start cold. Skills learned in one project die there. Lessons from past mistakes are forgotten. Each session repeats the same discovery process.

## Core Features

1. **3-Tier Knowledge Architecture** — Global vault + domain-tagged experiences + project-level `.agents/`
2. **Automatic Accumulation** — SessionEnd hooks capture lessons without manual steps (vault-writer.mjs)
3. **Smart Retrieval** — Semantic search surfaces relevant past experiences at session start (Smart Connections + Open Brain MCP)
4. **Skill Distillation** — Clusters of 3+ similar experiences proposed as reusable skills (vault-skill-scan.mjs)
5. **Project Template** — `.agents/` scaffold for any new codebase (Claude Code, Gemini, Cline support)
6. **Slash Commands** — `/start`, `/end`, `/recall`, `/skill-scan` for session lifecycle management

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (LTS) |
| Database | SQLite (better-sqlite3) — reads Claude Code session .db |
| Knowledge Store | Obsidian Vault (plain markdown) |
| Search | Smart Connections MCP (semantic), Open Brain MCP (FTS5) |
| CLI | Claude Code |
| VCS | Git + GitHub |

## Non-Functional Requirements

- **Portable** — markdown-based, no proprietary lock-in
- **Agent-guided setup** — guides written for users to walk through with their AI agent coaching each step
- **Works offline** — vault is local files, no cloud dependency
- **Beginner-friendly** — 5-step getting-started guide assumes no prior knowledge
```

---

### Task 4: Create SYSTEM/SUMMARY.md

**Files:**
- Create: `.agents/SYSTEM/SUMMARY.md`

- [ ] **Step 1: Write SUMMARY.md**

```markdown
# Project Summary

> **Last Updated:** 2026-03-23
> **Status:** Active Development (v4.0.0)

## Current State

**What's working:**
- vault-writer.mjs auto-captures sessions to Obsidian Vault
- vault-skill-scan.mjs detects experience clusters
- /start and /recall retrieve relevant knowledge at session start
- Smart Connections MCP + Open Brain MCP both functional
- 5 getting-started guides + 5 architecture docs complete
- Project template with full .agents/ scaffold ships in project-template/

**What's broken or incomplete:**
- vault-writer drops planning/architecture conversations — extraction filters only match gotcha/error/bug patterns
- Command boundary unclear — global vs project commands overlap with no clear authority
- Database layer has three overlapping stores (Claude Code memory, Open Brain SQLite, Obsidian Vault) with no defined authority
- Obsidian vault may have orphaned files needing cleanup

**What's next:**
- Database architecture redesign (P0) — must resolve before other fixes
- Fix vault-writer extraction filters (blocked by database decision)
- Resolve global vs project command architecture
- Obsidian vault orphan audit

## Architecture Overview

3-tier hub-and-spoke memory protocol:

| Tier | Location | Purpose |
|---|---|---|
| **Global** | `~/Obsidian Vault/` + `CLAUDE.md` | Cross-project experiences, reusable skills, user preferences |
| **Domain** | Tagged experiences in vault | Stack-specific knowledge (Convex patterns, Stripe gotchas, etc.) |
| **Project** | `.agents/` in each repo | Project-specific context (PRD, tasks, session logs) |

## Key Distinction

- **Self-Improving Agent** = the memory protocol (how knowledge flows across sessions)
- **AI-First Development Framework** = the project template (how projects are structured for AI agents)
- These are complementary layers distributed from this repo, but they are not the same thing
```

---

### Task 5: Create SYSTEM/ENTITIES.md

**Files:**
- Create: `.agents/SYSTEM/ENTITIES.md`

- [ ] **Step 1: Write ENTITIES.md**

```markdown
# Entities

> Conceptual entities the Self-Improving Agent system operates on. These are not database models — they are knowledge objects stored as markdown files.

## Entity Overview

| Entity | Description | Storage Location |
|---|---|---|
| **Experience** | A lesson learned — structured as TRIGGER/ACTION/CONTEXT/OUTCOME | `~/Obsidian Vault/Experiences/*.md` |
| **Skill** | Distilled from 3+ experiences — a reusable workflow | `~/Obsidian Vault/Guidelines/*.md` |
| **Session Log** | Record of one coding session's work and outcomes | `~/Obsidian Vault/Sessions/*.md` |
| **Topic** | A subject note with backlinks to related experiences | `~/Obsidian Vault/Topics/*.md` |
| **Skill Candidate** | A cluster of similar experiences not yet promoted to skill | `~/Obsidian Vault/Guidelines/SKILL-CANDIDATES.md` |
| **Project Context** | PRD + entities + rules + decisions for one codebase | `.agents/SYSTEM/` in each project |
| **Task** | A prioritized work item tracked within a project | `.agents/TASKS/INBOX.md` |

## Relationships

```
Sessions ──produce──> Experiences ──tagged by──> Domain
                          │
                          ├──update──> Topics (via WikiLinks)
                          │
                          └──cluster into──> Skill Candidates ──promoted to──> Skills
                                                                    │
                                                              (requires 3+ experiences
                                                               + human approval)

Project Context ──consumed by──> /start ──shapes──> Session
Tasks ──tracked across──> Sessions ──closed when──> Done
```

## Experience Format

YAML frontmatter:
```yaml
---
title: Short description of the lesson
project: Project Name
domain: comma, separated, tags
date: YYYY-MM-DD
type: gotcha | pattern | decision | fix | optimization
last-used: YYYY-MM-DD
retrieval-count: N
---
```

Body sections: `## TRIGGER`, `## ACTION`, `## CONTEXT`, `## OUTCOME`

## Skill Format

Aligned with XSkill k=(M,W,P):
- **M (Metadata)** — YAML frontmatter (title, domain, triggers)
- **W (Workflow)** — Step-by-step procedure
- **P (Tool templates)** — Reusable code/command patterns

## Changelog

| Date | Change | Session |
|---|---|---|
| 2026-03-23 | Initial entity documentation | Scaffold session |
```

---

### Task 6: Create SYSTEM/RULES.md

**Files:**
- Create: `.agents/SYSTEM/RULES.md`

- [ ] **Step 1: Write RULES.md**

```markdown
# Rules & Conventions

## General Rules

1. **All knowledge is plain markdown** — no proprietary formats, no databases as primary store
2. **Never auto-create skills** — always propose to Aaron, 3-experience minimum required
3. **Context cap** — max 3 experiences + 2 skills injected per session start
4. **Always dedup before storing** — check vault for >90% similarity before writing new experiences
5. **Non-prescriptive** — all retrieved knowledge is guidance, not mandates; override based on current context
6. **Don't modify `project-template/`** — it's the distributable copy; develop the template in its own repo and copy updates here

## Documentation Standards

- Getting-started guides are **agent-guided** — written so a user can follow them step-by-step with their AI agent coaching each action
- How-it-works docs are technical but accessible; use diagrams where helpful
- All docs use GitHub-flavored markdown
- Code examples should be copy-pasteable

## Script Conventions

- Scripts are ES modules (`.mjs`)
- Use `vault-utils.mjs` for shared utilities (file I/O, slugify, topic detection, logging)
- Errors log to `~/Obsidian Vault/.vault-writer.log` — never silently swallowed
- Scripts read Claude Code `.db` files via `better-sqlite3`
- Hook execution order matters: `vault-writer.mjs` → `vault-skill-scan.mjs`

## Git Conventions

- Branch naming: `feature/`, `fix/`, `docs/`
- Commit messages: concise, focus on "why" not "what"
- CHANGELOG.md updated with every version bump
- Annotated git tags for releases (`vX.Y.Z`)
- Push tags alongside code: `git push origin <branch> --tags`

## Command Architecture (PENDING — see INBOX P1)

- **Global commands** (`~/.claude/commands/`): vault-level operations only
- **Project commands** (`.claude/commands/`): `.agents/` operations only
- **Current state:** these boundaries are blurred — global commands contain project-level logic
- Resolution is tracked as a P1 architecture issue

## Agent-Specific Rules

1. Read SUMMARY.md before starting any work
2. Check INBOX.md for current priorities
3. Update SUMMARY.md at session end
4. Log decisions in DECISIONS.md with ADR format
5. Never commit `.agents/` or `.claude/` to this repo (gitignored)
```

---

### Task 7: Create SYSTEM/DECISIONS.md

**Files:**
- Create: `.agents/SYSTEM/DECISIONS.md`

- [ ] **Step 1: Write DECISIONS.md**

```markdown
# Architectural Decision Records

## How to Use

Log significant technical decisions here using the ADR format. Each decision gets a numbered entry with context, alternatives considered, and consequences.

---

## Decisions

### ADR-001: Obsidian Vault as primary knowledge store

- **Date:** 2026-03
- **Status:** Accepted
- **Context:** Needed persistent, searchable, human-readable knowledge storage that works across projects.
- **Decision:** Use plain markdown files in an Obsidian Vault with YAML frontmatter for metadata.
- **Alternatives:** SQLite-only via Open Brain (fast but opaque), custom database (overkill), JSON files (poor readability).
- **Consequences:** Portable, version-controllable, browseable in Obsidian UI. Requires file I/O for programmatic access. Semantic search via Smart Connections MCP.

### ADR-002: Automatic accumulation via SessionEnd hook

- **Date:** 2026-03
- **Status:** Accepted
- **Context:** Manual `/end` was frequently forgotten, causing session knowledge to be lost.
- **Decision:** vault-writer.mjs fires automatically at SessionEnd to capture sessions and extract experiences.
- **Alternatives:** Keep manual-only (unreliable), cron job (wrong granularity), background daemon (overkill).
- **Consequences:** Zero-effort capture for every session. `/end` remains available for optional manual review pass.

### ADR-003: Human approval gate for skill creation

- **Date:** 2026-03
- **Status:** Accepted
- **Context:** Auto-creating skills from experience clusters could introduce noise and degrade retrieval quality.
- **Decision:** Never auto-create skills. vault-skill-scan.mjs proposes candidates; Aaron must explicitly approve.
- **Alternatives:** Auto-create with confidence threshold (risky), auto-create and prune later (messy).
- **Consequences:** Higher quality skills, slower skill growth. Acceptable tradeoff for solo developer workflow.

### ADR-004: Extract A2A Hub to standalone project

- **Date:** 2026-03-22
- **Status:** Accepted
- **Context:** A2A Intelligent Hub grew beyond the scope of this repo into its own product.
- **Decision:** Moved hub/, wrapper/, and A2A-specific reference/ files to `~/Projects/A2A-Hub/`.
- **Alternatives:** Keep as subdirectory (clutters repo), git submodule (adds complexity).
- **Consequences:** Clean separation. Both repos audited — 38 files in A2A-Hub, 60 in Self-Improving-Agent, no duplicates or orphans.

### ADR-005: Database architecture redesign

- **Date:** 2026-03-23
- **Status:** PENDING
- **Context:** Three overlapping knowledge stores exist — Claude Code memory (`~/.claude/projects/.../memory/`), Open Brain SQLite (FTS5), and Obsidian Vault (markdown). No clear authority defined for which store is canonical for what data.
- **Decision:** TBD — research required. Options: consolidate to one store, define clear boundaries between stores, or adopt a primary-with-cache pattern.
- **Alternatives:** TBD
- **Consequences:** TBD — this decision will reshape vault-writer, retrieval protocol, and storage patterns.
```

---

### Task 8: Create SYSTEM/SECURITY.md

**Files:**
- Create: `.agents/SYSTEM/SECURITY.md`

- [ ] **Step 1: Write SECURITY.md**

```markdown
# Security Considerations

> This project is a documentation + scripts repo, not a web application. Security considerations focus on data sensitivity and script execution safety.

## Secrets & API Keys

- **No secrets stored in this repo**
- MCP server tokens configured via `claude mcp add` (stored in `~/.claude/settings.json`, not committed)
- Open Brain and Smart Connections MCP run locally — no external API keys required

## Vault Path Exposure

- Absolute paths (`~/Obsidian Vault/`, `~/.claude/`) appear in docs and scripts
- These are user-specific — contributors must update to their own paths
- No sensitive data in the paths themselves, but they reveal local directory structure

## Session Database Access

- vault-writer.mjs reads Claude Code's SQLite session databases (`.db` files)
- These contain full conversation history — **treat as sensitive**
- Never committed, never uploaded, read-only access only

## Script Execution Safety

- SessionEnd hooks run automatically with the user's shell permissions
- Scripts should never write outside `~/Obsidian Vault/` and `.vault-writer.log`
- No network calls — all operations are local file I/O
- Scripts are ES modules — auditable plain JavaScript

## For Users Cloning This Repo

- Review hook scripts (`scripts/vault-writer.mjs`, `scripts/vault-skill-scan.mjs`) before installing them
- The project template contains no secrets — safe to commit to public repos
- `.agents/` and `.claude/` directories created by the template are local state, not distributed
```

---

### Task 9: Create SYSTEM/TESTING.md

**Files:**
- Create: `.agents/SYSTEM/TESTING.md`

- [ ] **Step 1: Write TESTING.md**

```markdown
# Testing Strategy

> This is a documentation + scripts project, not an application. Testing focuses on verifying scripts work and docs are accurate.

## Test Layers

| Layer | What | How |
|---|---|---|
| **Script smoke test** | vault-writer.mjs, vault-skill-scan.mjs, vault-utils.mjs load without errors | `node --check scripts/*.mjs` |
| **Hook integration** | SessionEnd hook fires and produces vault output | Run a short Claude Code session, check `~/Obsidian Vault/Sessions/` for new file |
| **Retrieval validation** | `/recall` returns relevant results | Run `/recall` in a project with known experiences, verify results match |
| **Template validation** | Project template scaffolds correctly | Copy `project-template/` to a temp dir, run `/start`, verify session log created |
| **Doc accuracy** | Getting-started guides match actual setup steps | Walk through each guide on a clean machine (or with a new user) |

## What We Don't Test

- No unit tests for markdown documentation
- No CI/CD pipeline (single developer, scripts are hooks not services)
- No coverage metrics

## Validation Commands

```bash
# Scripts parse without syntax errors
node --check scripts/vault-writer.mjs
node --check scripts/vault-skill-scan.mjs
node --check scripts/vault-utils.mjs

# Dependencies installed correctly
cd scripts && npm ls
```
```

---

### Task 10: Create SYSTEM/RUNBOOK.md

**Files:**
- Create: `.agents/SYSTEM/RUNBOOK.md`

- [ ] **Step 1: Write RUNBOOK.md**

```markdown
# Runbook

## Developer Installation (working on this repo)

```bash
git clone https://github.com/melvenac/Self-Improving-Agent.git
cd Self-Improving-Agent
cd scripts && npm install
```

## User Installation (Brian/Alice)

Follow the step-by-step guides in order:
1. `getting-started/01-prerequisites.md` — Install Claude Code, Node.js, Git, Obsidian
2. `getting-started/02-clone-and-configure.md` — Clone repo, create vault structure
3. `getting-started/03-mcp-servers.md` — Install Open Brain + Smart Connections MCP
4. `getting-started/04-hooks-and-commands.md` — Configure SessionEnd hooks, install slash commands
5. `getting-started/05-verify-installation.md` — First session walkthrough + troubleshooting

## Hook Configuration

Scripts must be registered as SessionEnd hooks in `~/.claude/settings.json`.

**Order matters:** vault-writer runs first, skill-scan second.

1. `vault-writer.mjs` — captures session logs + extracts experiences to vault
2. `vault-skill-scan.mjs` — scans experiences for emerging skill clusters

## Required Vault Structure

```
~/Obsidian Vault/
  Sessions/          # Auto-generated session logs
  Experiences/       # Auto-extracted lessons learned
  Topics/            # Subject notes with backlinks
  Guidelines/        # Skills + SKILL-INDEX.md + SKILL-CANDIDATES.md
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| No session captured after session ends | Hook not registered | Check `~/.claude/settings.json` for SessionEnd entry pointing to vault-writer.mjs |
| vault-writer errors on run | Missing vault directories | Create the required folder structure under `~/Obsidian Vault/` |
| `kb_recall` returns nothing | Open Brain MCP not running | Run `claude mcp list`, verify `open-brain-knowledge` is present |
| Smart Connections returns nothing | Vault not indexed | Open Obsidian, let Smart Connections plugin re-index |
| Scripts fail on Windows | Path separator issues | vault-utils.mjs handles normalization — check for hardcoded forward slashes |

## Logs

- Hook errors and warnings: `~/Obsidian Vault/.vault-writer.log`
```

---

### Task 11: Create TASKS/INBOX.md

**Files:**
- Create: `.agents/TASKS/INBOX.md`

- [ ] **Step 1: Write INBOX.md**

```markdown
# Inbox — Prioritized Work Items

> **Priority levels:** P0 = Critical (do first), P1 = High, P2 = Medium, P3 = Low
> **Status:** [ ] = pending, [~] = in progress, [x] = done, [!] = blocked

## P0 — Critical

- [ ] **Database architecture redesign** — Research and decide between Claude Code memory, Open Brain SQLite, and Obsidian Vault. Currently all three store overlapping data with no clear authority for what goes where. Must resolve this before other fixes make sense. → ADR-005
- [!] **Fix vault-writer extraction filters** — Drops planning/architecture conversations entirely. Extraction regex only matches gotcha/error/bug patterns, missing high-value planning decisions. Blocked by database architecture decision.

## P1 — High

- [ ] **Resolve global vs project command architecture** — Clear boundary needed between commands that write to `.agents/` (project-level) vs commands that write to the vault (global-level). Current `/start` and `/end` do both.
- [ ] **Obsidian vault orphan audit** — Find and reconnect disconnected files in the vault.

## P2 — Medium

- [ ] **Setup scripts** — Create `setup.sh` / `setup.ps1` to automate tool installation for new users.
- [ ] **LLM critique step for vault-writer** — Add `claude --print` critique pass to improve auto-extracted experience quality. Tested and ready to implement.

## P3 — Low

- [ ] **Monthly kb_prune** — Remove stale experiences with zero retrievals.

## Completed

- [x] Extract A2A Hub to standalone project (v4.0.0)
```

---

### Task 12: Create TASKS/task.md

**Files:**
- Create: `.agents/TASKS/task.md`

- [ ] **Step 1: Write task.md**

> **Note:** Spec says current objective is "Scaffold .agents/ framework for this repo" but the scaffold will be complete by the time this file is first read. Populating with the next priority (P0 database architecture) so task.md is immediately useful.

```markdown
# Current Focus

## Current Objective

Database architecture redesign — research best options for knowledge storage.

## Active Tasks

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Research Claude Code memory capabilities and limits | Pending | What can it store? How is it scoped? |
| 2 | Audit current Open Brain SQLite usage | Pending | What data lives there now? What queries depend on it? |
| 3 | Audit current Obsidian Vault usage | Pending | What overlaps with SQLite? What's vault-only? |
| 4 | Draft ADR-005 with recommendation | Pending | Consolidate findings into a decision |

## Acceptance Criteria

- [ ] Clear understanding of what each store currently holds
- [ ] Defined authority — which store is canonical for which data type
- [ ] ADR-005 written with decision, alternatives, and consequences
- [ ] Migration path documented if stores are being consolidated

## Notes

Three stores currently overlap:
- **Claude Code memory** (`~/.claude/projects/.../memory/`) — curated manually, always loaded
- **Open Brain SQLite** (FTS5) — sessions, knowledge chunks, summaries via kb_store/kb_recall
- **Obsidian Vault** (markdown) — experiences, sessions, topics, skills via file I/O + Smart Connections
```

---

### Task 13: Create SESSIONS/SESSION_TEMPLATE.md

**Files:**
- Create: `.agents/SESSIONS/SESSION_TEMPLATE.md`

- [ ] **Step 1: Write SESSION_TEMPLATE.md**

Standard session log format (same as project-template version):

```markdown
# Session N — [Date]

> **Objective:** [One-line description of what this session aims to accomplish]
> **Status:** In Progress | Completed | Abandoned

---

## Pre-Session Checklist

- [ ] Read SUMMARY.md
- [ ] Read INBOX.md
- [ ] Read ENTITIES.md (if schema work planned)
- [ ] Read relevant skills (if applicable)
- [ ] Run pre-session validation (if configured)

---

## Objective & Plan

**Goal:** [What are we trying to accomplish?]

**Approach:**
1.
2.
3.

**User Approval:** [ ] Approved / [ ] Modified

---

## Work Log

### What Was Done
-

### Files Modified
-

### Files Created
-

---

## Gotchas & Lessons Learned

<!-- Hard-won knowledge that should persist across sessions -->

-

---

## Decisions Made

<!-- Reference ADR numbers if logged in DECISIONS.md -->

-

---

## Post-Session Checklist

- [ ] Session log completed (this file)
- [ ] SUMMARY.md updated with current state
- [ ] DECISIONS.md updated (if applicable)
- [ ] ENTITIES.md updated (if schema changed)
- [ ] INBOX.md updated (tasks marked done, new tasks added)
- [ ] Validation scripts run (if applicable)

---

## Next Session Recommendations

<!-- What should the next session focus on? -->

-
```

---

### Task 14: Create skills/INDEX.md

**Files:**
- Create: `.agents/skills/INDEX.md`

- [ ] **Step 1: Write INDEX.md**

```markdown
# Skills Index

> Project-specific skills for the Self-Improving Agent repo. For global skills, see `~/Obsidian Vault/Guidelines/SKILL-INDEX.md`.

## How to Use Skills

- Skills are reusable workflows for recurring tasks
- Create a skill when 3+ experiences show the same pattern
- Each skill lives in its own directory with a `SKILL.md` file

## Registered Skills

| Skill | Directory | Description | Created |
|---|---|---|---|
| *(none yet)* | | | |
```

---

### Task 15: Commit (gitignored — informational only)

Note: `.agents/` is gitignored, so there is nothing to commit for tasks 2-14. Only Task 1 (.gitignore update) produces a commit. This task is a verification step.

- [ ] **Step 1: Verify .agents/ is ignored**

```bash
git status
```

Expected: Only `.gitignore` modification and `docs/` additions visible. No `.agents/` files listed.

- [ ] **Step 2: Commit spec and plan docs**

```bash
git add docs/superpowers/
git commit -m "docs: add spec and implementation plan for .agents/ scaffold"
```
