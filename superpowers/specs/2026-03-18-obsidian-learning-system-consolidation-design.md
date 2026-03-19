# Obsidian Learning System Consolidation — Design Spec

> Consolidate the learning system from a split Open Brain MCP + Obsidian Vault architecture to a single Obsidian Vault with Smart Connections MCP for semantic search.

## Problem

The learning system currently splits knowledge across two backends:
- **Open Brain MCP** (SQLite/FTS5) — stores experiences, session summaries, programmatic search
- **Obsidian Vault** (markdown) — stores skills, templates, skill index

This creates a split brain: knowledge is searchable but not browsable, and there's no visual way to explore how knowledge connects across projects. The retrieval loop (`kb_recall` at session start) is also not wired up — the protocol is documented but not executing.

## Goals

1. **Single store** — all learning system knowledge lives as markdown in one Obsidian vault
2. **Visual browsability** — graph view, WikiLinks, and backlinks let Aaron explore knowledge connections
3. **Full automation** — sessions auto-capture, experiences auto-extract, topics auto-link
4. **Continuity** — migrate 36 existing sessions + stored experiences from Open Brain
5. **Programmatic search** — Clark can still search at session start via Smart Connections MCP

## Non-Goals

- Replacing Open Brain as a product (it stays as its own project)
- Changing the Claude memory file system (`~/.claude/projects/*/memory/`)
- Building a custom MCP server
- Multi-user access

## Design

### Vault Structure

All new folders live alongside existing `Guidelines/` and `Templates/` in `~/Obsidian Vault/`:

```
~/Obsidian Vault/
├── Guidelines/          # (existing) SKILL-INDEX.md, distilled skills
├── Templates/           # (existing) SKILL-TEMPLATE.md
├── Sessions/            # Auto-generated session logs
├── Experiences/         # Extracted lessons (TRIGGER/ACTION/CONTEXT/OUTCOME)
├── Topics/              # Auto-generated hub notes (people, projects, tools, concepts)
└── Summaries/           # Lightweight session recaps
```

**Sessions/** — Full session logs with YAML frontmatter (date, project, tags, type: session). One file per Claude Code session. Filename format: `YYYY-MM-DD-<project>-<brief-topic>.md`.

**Experiences/** — Individual lessons extracted from sessions. Each file has YAML frontmatter (date, project, type: gotcha|pattern|decision|fix|optimization, tags, source session link). Body uses TRIGGER/ACTION/CONTEXT/OUTCOME structure. Filename format: `<descriptive-slug>.md`.

**Topics/** — Auto-generated hub notes that aggregate references. Each topic has a type (person|project|tool|concept|organization), a brief description, and a "See Also" section with WikiLinks to every session, experience, and skill that references it. These are the high-connectivity nodes that make graph view useful.

**Summaries/** — One-line-per-session recaps for quick scanning. Filename format: `YYYY-MM-DD-summary.md`. Multiple sessions on the same day append to the same file.

### File Formats

**Session log:**
```markdown
---
date: 2026-03-18
project: makerspace-site
tags: [convex, stripe, webhooks]
type: session
---

## What Was Done
- Implemented Stripe webhook handler
- Fixed Convex action for payment processing

## Key Decisions
- Used Convex HTTP actions instead of Node actions for webhooks

## Gotchas
- Convex httpAction doesn't support middleware — validate signatures manually

## See Also
[[convex]] [[stripe]] [[tarrant-county-makerspace]]
```

**Experience:**
```markdown
---
date: 2026-03-18
project: makerspace-site
type: gotcha
tags: [convex, webhooks]
source: "[[2026-03-18-makerspace-stripe-webhook]]"
---

## Trigger
Setting up webhook handlers in a Convex app

## Action
Use httpAction directly — middleware isn't supported, validate signatures manually in the handler

## Context
Stripe webhook integration for makerspace membership payments

## See Also
[[convex]] [[stripe]] [[2026-03-18-makerspace-stripe-webhook]]
```

**Topic note:**
```markdown
---
type: tool
aliases: []
---

Convex is a reactive backend-as-a-service used across multiple projects.

## See Also
[[convex-development-patterns]]
[[2026-03-18-makerspace-stripe-webhook]]
[[convex-validator-gotcha]]
```

### Auto-Capture Pipeline

A single SessionEnd hook chains three stages after each Claude Code session:

**Stage 1: Session Log**
- Reads the session `.db` file from `~/.claude/context-mode/sessions/`
- Extracts conversation content, identifies project and topics
- Writes markdown to `Sessions/` with YAML frontmatter and WikiLinks

**Stage 2: Experience Extraction**
- Scans the session log for "Key Decisions" and "Gotchas" sections
- Creates individual experience files in `Experiences/`
- Links back to the source session

**Stage 3: Topic Linking**
- Scans new files for topic mentions (case-insensitive matching against existing topic names)
- Updates existing topic notes' "See Also" sections with new backlinks
- Creates new topic notes for previously unseen topics (minimal: just a type and See Also section)

All three stages execute in one Node.js script invocation. No background daemon required.

**Hook mechanism:** Claude Code supports lifecycle hooks in `~/.claude/settings.json` under the `hooks` key. The vault-writing script registers as a `SessionEnd` hook — a shell command that Claude Code invokes when a session ends. Multiple hooks can coexist; the vault writer runs alongside context-mode's existing SessionEnd hook. The hook entry looks like:

```json
{
  "hooks": {
    "SessionEnd": [
      { "command": "node /path/to/vault-writer.js" }
    ]
  }
}
```

The hook script receives the session directory path as context. It reads the session `.db` file (SQLite format — schema dependency on context-mode's internal format, which may change between versions; the migration and hook scripts should document the expected schema and fail gracefully if it changes).

**Fallback:** Raw session `.db` files remain in `~/.claude/context-mode/sessions/` regardless. A recovery script can backfill missed sessions if the hook fails or Claude Code crashes.

**Hook coexistence:** Context-mode's existing SessionEnd hook (`auto-index.mjs`) continues to run. The vault writer is an additional hook entry, not a replacement.

**Error visibility:** The vault-writer script logs warnings to `~/Obsidian Vault/.vault-writer.log`. If a session fails to capture, the log records the error and the raw `.db` file path for manual recovery.

**Recovery script:** Manual invocation only — run `node vault-recovery.js` to scan for `.db` files that don't have corresponding vault session logs and backfill them. Not automated; Aaron runs it when he suspects missed sessions.

### Search & Retrieval

**Programmatic (for Clark):**
- Smart Connections Obsidian plugin indexes all vault markdown using embeddings
- Its MCP server exposes semantic search (exact tool name TBD — must be verified during implementation by installing the plugin and inspecting its MCP surface; if the MCP tool name differs from `mcp__smart-connections__lookup`, update the retrieval protocol accordingly)
- **Implementation prerequisite:** Install Smart Connections, confirm MCP tool names and parameters before writing any retrieval code. If the plugin lacks MCP support or the surface is insufficient, fall back to Approach B (grep-based search) as an interim solution.
- Retrieval protocol at session start: Clark calls the Smart Connections MCP lookup with project name + domain tags
- Surfaces max 3 experiences + 2 skills (same guardrail as today)
- Dedup before writing: call Smart Connections lookup with the experience title — if a match exceeds the similarity threshold, update that file instead of creating new. Note: similarity scores are cosine distances, not percentages. The threshold must be calibrated empirically after migration by testing with known-duplicate and known-distinct experience pairs.

**Visual (for Aaron):**
- **Graph view** — Topics are hub nodes, Sessions and Experiences radiate out via WikiLinks
- **Backlinks panel** — Open any topic and see every file that links to it
- **Built-in search** — Obsidian's native full-text search
- **Smart Connections "find similar"** — semantic similarity search within Obsidian
- **Tag pane** — YAML frontmatter tags are filterable

### Migration

A one-time Node.js script that:
1. Reads each of the 36 session `.db` files → extracts content, project, date, tags → writes to `Sessions/`
2. Reads `knowledge.db` → extracts stored experiences and summaries → writes to `Experiences/` and `Summaries/`
3. Scans all migrated files for topic mentions → creates initial `Topics/` notes with See Also links
4. Smart Connections auto-indexes the new files on next Obsidian launch

### What Gets Retired

**Removed from the learning system:**
- `kb_recall` / `kb_store` / `kb_store_summary` / `kb_list` / `kb_prune` / `kb_forget` calls in global CLAUDE.md
- `~/.claude/context-mode/knowledge.db` as learning system backend (data migrated)
- `auto-index.mjs` SessionEnd hook — no longer needed for the learning system since experiences live in the vault, but may remain if context-mode's `ctx_search` still depends on it. Evaluate during implementation; remove only if context-mode works without it.

**Kept as-is:**
- Open Brain MCP server code (`~/Projects/Open-Brain/`) — product, not personal memory
- Raw session `.db` files — Claude Code writes these regardless, serve as backup
- Claude memory files (`~/.claude/projects/*/memory/`) — different purpose (user profile, feedback, references)
- Obsidian skill system (SKILL-INDEX, templates, skill files) — already in vault

### Changes to Global CLAUDE.md

- Retrieval protocol: `kb_recall` → `mcp__smart-connections__lookup`
- Accumulation protocol: `kb_store` → "write markdown to vault" (automated by hook)
- Remove Open Brain MCP references from learning system section
- Update key paths to point to vault folders
- Keep guardrails (context cap, dedup, skill gate, monthly pruning)

### Dependencies

| Component | Purpose | Status |
|---|---|---|
| Obsidian (desktop app) | Vault host, graph view, search | Already installed |
| Smart Connections plugin | Semantic indexing + MCP server | Needs installation |
| SessionEnd hook script | Auto-capture pipeline (Node.js) | Needs building |
| Migration script | One-time data export (Node.js) | Needs building |

### Risks

- **Smart Connections MCP stability** — third-party plugin, could break on updates. Mitigation: vault files are plain markdown, worst case Clark falls back to file reads.
- **Hook execution on crash** — if Claude Code force-kills, SessionEnd doesn't fire. Mitigation: raw `.db` files persist, recovery script can backfill.
- **Topic note noise** — fully automatic topic creation could generate low-value notes. Mitigation: seed an initial topic list from existing project names, domain tags, and tool names (convex, stripe, nextjs, etc.). New topics only auto-create when mentioned in 2+ files. Single-mention topics get WikiLinked but no dedicated note until the threshold is met.
- **Session `.db` schema dependency** — the hook reads context-mode's internal SQLite format, which is not a public API. Mitigation: document expected schema in the hook script, fail gracefully with a warning if schema changes, and log the raw `.db` path for manual recovery.
- **Migration data loss** — one-way migration with no undo. Mitigation: migration script runs in dry-run mode first (previews output without writing files). Source data (`.db` files and `knowledge.db`) is never deleted.
