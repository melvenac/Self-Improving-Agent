# Design: .agents/ Framework Scaffold for Self-Improving Agent

**Date:** 2026-03-23
**Status:** Approved
**Author:** Clark + Aaron

## Summary

Scaffold the `.agents/` directory at the root of the Self-Improving Agent repo so the project can track its own development using the AI-First Framework it distributes. All `.agents/` content is gitignored — it's local development state, not part of the public distribution. The distributable template lives separately in `project-template/`.

## Key Decisions

1. **Standard setup, not META** — This repo is a normal project using the framework, not the framework development workspace.
2. **Full scaffold, populated** — All SYSTEM docs filled with real project content, not skeleton placeholders.
3. **Gitignore `.agents/` and `.claude/` entirely** — Local-only dev state. Brian/Alice get the template from `project-template/`, not from this repo's own usage.
4. **No FRAMEWORK.md** — This repo defines a memory protocol, not a framework. SUMMARY.md handles agent orientation.
5. **No workflows/** — Deferred until global vs project command architecture is resolved (INBOX P1).
6. **Sessions gitignored** — SESSION_TEMPLATE.md included but actual session logs are ephemeral.

**Deliberate divergences from project-template/.agents/:**
- No `FRAMEWORK.md` — this repo is a memory protocol, not a framework project
- No `workflows/` — deferred until command architecture resolved
- No `examples/` — no example workflow configs needed for this project
- Empty `skills/INDEX.md` — template ships playwright-tester and session-manager, neither relevant here

## Directory Structure

```
.agents/
  SYSTEM/
    PRD.md
    SUMMARY.md
    ENTITIES.md
    RULES.md
    DECISIONS.md
    SECURITY.md
    TESTING.md
    RUNBOOK.md
  TASKS/
    INBOX.md
    task.md
  SESSIONS/
    SESSION_TEMPLATE.md
  skills/
    INDEX.md
```

## .gitignore Additions

```
/.agents/
/.claude/
```

Leading slash anchors patterns to repo root. Without it, git would also match `project-template/.agents/` and `project-template/.claude/`. The template files are already tracked so git wouldn't retroactively untrack them, but anchoring is correct practice.

**Implementation step:** Update `.gitignore` before creating `.agents/`.

## File Contents

### SYSTEM/PRD.md

**Project:** Self-Improving Agent
**Description:** A memory protocol and automation layer that enables AI coding agents to learn across sessions. Provides retrieval/accumulation hooks, slash commands, and a project template for persistent AI learning.

**Target Users:**
- Solo developers using Claude Code (primary)
- Small teams wanting shared AI context
- Aaron (dogfooding — using the system to develop the system)

**Core Features:**
1. 3-Tier Knowledge Architecture — Global vault + domain-tagged experiences + project-level `.agents/`
2. Automatic Accumulation — SessionEnd hooks capture lessons without manual steps
3. Smart Retrieval — Semantic search surfaces relevant past experiences at session start
4. Skill Distillation — Clusters of 3+ similar experiences proposed as reusable skills
5. Project Template — `.agents/` scaffold for any new codebase (Claude, Gemini, Cline support)
6. Slash Commands — `/start`, `/end`, `/recall`, `/skill-scan` for session lifecycle

**Tech Stack:**

| Layer | Technology |
|---|---|
| Runtime | Node.js (LTS) |
| Database | SQLite (better-sqlite3) — reads Claude Code session .db |
| Knowledge Store | Obsidian Vault (plain markdown) |
| Search | Smart Connections MCP (semantic), Open Brain MCP (FTS5) |
| CLI | Claude Code |
| VCS | Git + GitHub |

**Non-Functional Requirements:**
- Portable (markdown-based, no proprietary lock-in)
- Agent-guided setup (guides written to walk through with AI agent coaching each step)
- Works offline (vault is local files)

### SYSTEM/SUMMARY.md

- Status: Active Development (v4.0.0)
- Last Updated: 2026-03-23
- What's Working: vault-writer, vault-skill-scan, /start, /recall, Smart Connections + Open Brain MCP, 5 getting-started + 5 architecture docs
- What's Broken: vault-writer drops planning conversations, command boundary unclear, database layer has three overlapping stores
- What's Next: Database architecture redesign (P0), then vault-writer fix, command architecture, Obsidian orphan audit

### SYSTEM/ENTITIES.md

Conceptual entities (not database models):
- Experience, Skill, Session Log, Topic, Skill Candidate, Project Context, Task
- Key relationships: Experiences cluster into Skill Candidates, promoted to Skills with approval
- Experience format: YAML frontmatter + TRIGGER/ACTION/CONTEXT/OUTCOME
- Skill format: k = (M, W, P) — Metadata, Workflow, Tool templates

### SYSTEM/RULES.md

- All knowledge is plain markdown
- Never auto-create skills (3-experience minimum, Aaron approval)
- Max 3 experiences + 2 skills per session start
- Always dedup before storing (>90% similarity check)
- Experiences are non-prescriptive guidance
- Don't modify `project-template/` during development
- Docs are agent-guided (written for user + AI agent together)
- Scripts are ES modules (.mjs), errors log to vault, no silent swallowing
- Git: feature/fix/docs branches, CHANGELOG updated per version, annotated tags
- Command architecture: global = vault ops, project = .agents/ ops (boundary TBD)

### SYSTEM/DECISIONS.md

4 ADRs:
- ADR-001: Obsidian Vault as primary knowledge store
- ADR-002: Automatic accumulation via SessionEnd hook
- ADR-003: Human approval gate for skill creation
- ADR-004: Extract A2A Hub to standalone project
- ADR-005: (PENDING) Database architecture — Claude Code memory vs SQLite vs Obsidian vault. Placeholder for P0 decision.

### SYSTEM/SECURITY.md

- No secrets in repo; MCP tokens in ~/.claude/settings.json
- Vault paths expose local directory structure (user-specific)
- Session .db files contain full conversation history — treat as sensitive
- SessionEnd hooks run with user shell permissions, scoped to vault writes only
- Template contains no secrets — safe for public repos

### SYSTEM/TESTING.md

5 test layers: script smoke test, hook integration, retrieval validation, template validation, doc accuracy. No CI/CD pipeline. Validation via `node --check scripts/*.mjs`.

### SYSTEM/RUNBOOK.md

- Developer install: clone + `cd scripts && npm install`
- User install: follow getting-started guides
- Hook config: vault-writer first, skill-scan second in ~/.claude/settings.json
- Required vault structure documented
- Troubleshooting table (5 common issues)
- Logs at ~/Obsidian Vault/.vault-writer.log

### TASKS/INBOX.md

**P0 Critical:**
- Database architecture redesign — research Claude Code memory vs SQLite vs Obsidian vault. Must resolve before other fixes.
- Fix vault-writer extraction filters (blocked by database decision)

**P1 High:**
- Resolve global vs project command architecture
- Obsidian vault orphan audit

**P2 Medium:**
- Setup scripts (setup.sh/setup.ps1)
- LLM critique step for vault-writer

**P3 Low:**
- Monthly kb_prune

### TASKS/task.md

Current objective: Scaffold .agents/ framework for this repo.

### SESSIONS/SESSION_TEMPLATE.md

Copied from project-template — standard session log format.

### skills/INDEX.md

Empty registry — no project-specific skills yet.

## Architecture Notes

**Key distinction this design preserves:**
- **Self-Improving Agent** = memory protocol (how knowledge flows across sessions)
- **AI-First Development Framework** = project structure (how projects are organized for AI agents)
- These are complementary layers, not the same thing
- This repo distributes both but `.agents/` here is for the memory protocol project's own development

**Deferred decisions:**
- Global vs project command boundary (INBOX P1)
- Whether project-level workflows/ are needed once command architecture is resolved
- Database architecture (INBOX P0) — will reshape how vault-writer, retrieval, and storage work
