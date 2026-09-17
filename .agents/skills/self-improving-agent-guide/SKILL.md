---
name: self-improving-agent-guide
description: Architecture and operating guide for the Self-Improving Agent memory protocol — the 3-tier hub-and-spoke model, which of the three stores has write authority over what, the session lifecycle (/start, /checkpoint, /end, /sync), vault structure, what ratings do and do not drive, and the skill graduation path. Use this skill when asked how open-brain works, where a given kind of knowledge should live, why recall returned what it did, what a session hook does, or how experiences become skills. Trigger for any question about the framework's design or data flow — as opposed to debugging its code, which is self-improving-agent-gotchas.
---

# Self-Improving AI Agent Framework

> A system that makes AI coding assistants learn from every session and share knowledge across projects — built on Claude Code, SQLite, and Obsidian.

## The Problem

Every new Claude Code session starts from zero. Hard-won lessons — "Stripe must be lazy-initialized in Convex actions", "Roundcube Docker volumes are path-sensitive" — die in the session that discovered them. Across multiple projects the problem compounds: knowledge learned in one never reaches another.

## The Solution: 3-Tier Hub-and-Spoke

```
┌─────────────────────────────────────────────┐
│              GLOBAL TIER                     │
│  ~/.claude/CLAUDE.md (boot loader)           │
│  knowledge-v2.db  — sessions, knowledge      │
│  Obsidian Vault v2 — human-browsable mirror  │
└──────────────┬──────────────────┬────────────┘
               │                  │
       ┌───────▼───────┐  ┌──────▼────────┐
       │  DOMAIN TIER  │  │  DOMAIN TIER  │
       │  Tagged by:   │  │  Tagged by:   │
       │  convex,      │  │  php,         │
       │  nextjs,      │  │  roundcube,   │
       │  stripe       │  │  docker       │
       └───────┬───────┘  └──────┬────────┘
               │                  │
    ┌──────────▼──┐         ┌────▼───────────┐
    │ PROJECT TIER│         │ PROJECT TIER   │
    │ Makerspace  │         │ Mail Server    │
    │ .claude/    │         │ .claude/       │
    │ .agents/    │         │ .agents/       │
    └─────────────┘         └────────────────┘
```

**Knowledge flows up** (accumulation) and **down** (retrieval) automatically.

### Three stores, one retrieval path

Write authority is split (ADR-005); retrieval is federated across all three.

| Store | Owns | Written by |
|---|---|---|
| `knowledge-v2.db` | Sessions, chunks, knowledge entries, lifecycle data | `ob_store`, `ob_store_chunk`, session hooks |
| Obsidian Vault v2 | Human-browsable markdown mirror of experiences and skills | `ob_store` (writes both DB row and vault note) |
| CC Memory | Identity and bootstrap facts | The memory tool |

## How It Works

### Session Start: Retrieval

`/start` registers the session and pulls relevant prior knowledge:

1. **`ob_set_session`** — binds the session UUID to the project directory, so everything stored this session carries provenance.
2. **`ob_recall(queries, project)`** — federated search over the knowledge base, ranked by relevance and maturity. Broadens to `global: true` when project-scoped results are thin.

At most **3 experiences + 2 skills** are surfaced, as non-prescriptive guidance.

### Session End: Accumulation (Automatic)

The `SessionEnd` hook runs `open-brain/build/cli-session-end.js`. It captures the session and extracts experiences — no manual step required. (Skill-scan clustering was cut in Loop 10.) `/end` adds a review pass that improves what was auto-extracted, but capture happens regardless.

**Skill proposal:** when 3+ experiences cluster on one problem class, the scan proposes a skill in `SKILL-CANDIDATES.md` and writes `.skill-proposals-pending.json`. It never auto-creates — Aaron approves every skill.

### Outcome tracking

`ob_feedback` records ternary ratings (helpful / harmful / neutral) on recalled knowledge. It
increments the entry's counter and writes a `feedback_log` row. **Nothing is derived from it
further.**

**The maturity lifecycle (Progenitor → Proven → Mature) and apoptosis were both CUT in Loop 10** —
`evaluateLifecycle` with E3 and the auto-delete arm with E18. Ranking reads neither `maturity` nor
`success_rate`. The apoptosis threshold had never fired in the corpus's entire life: it gated on a
success rate that excluded neutral ratings and so read 1.0 for almost anything ever rated helpful
once. Retiring an entry is `ob_forget`, with a human in the loop.

The `maturity` and `success_rate` columns still exist on the table and are inert.

### Experience Format

```markdown
---
date: 2026-02-15
project: makerspace-site
type: pattern
tags: [convex, stripe]
---

## Trigger
Integrating Stripe API calls within Convex action functions

## Action
Create the Stripe instance inside the action handler, not at module top level

## Context
Top-level new Stripe(key) caused silent failures in Convex actions

## Outcome
Moving initialization inside the handler resolved the issue

## See Also
[[self-improving-agent]] [[convex]] [[stripe]]
```

This maps to the XSkill model: **TRIGGER** = when is this relevant, **ACTION** = what to do.

> The `TRIGGER:`/`OUTCOME:` template matches ~287 of 341 entries. It is how nearly everything here is written, so it is **not** a useful signal for classifying entries — a pattern firing on 84% of a corpus separates nothing.

### State vs event

Every entry is one of two kinds, recorded in `knowledge_index.fact_kind`:

- **State** — one current value that changes (a path, a version, a port). Wants *replacing*.
- **Event** — a timestamped thing that happened (a gotcha, a decision). Wants *appending*.

The update rules are opposites. `knowledge_index` can only append, so every changed state fact has left its predecessor live and recallable. **NULL means unclassified, not `event`.** Pass `kind` on `ob_store` — `effectiveKind` always prefers a recorded label over an inferred one.

### Skill Distillation

Distilled skills live in `~/.claude/skills/<name>/SKILL.md` and are registered in `~/Obsidian Vault v2/Skill-Candidates/SKILL-INDEX.md`.

The index is maintained by hand. Its **Domain** column is descriptive, not a contract — nothing reads it.

## Guardrails

| Rule | Why |
|---|---|
| Max 3 experiences + 2 skills per session | Prevents context window bloat |
| Dedup before writing new experiences | Check the vault for similar files first |
| Never auto-create skills | Aaron approves all skill creation |
| 3-experience minimum for proposals | Keeps skills grounded in real patterns |
| Non-prescriptive guidance | The agent can override based on current context |
| Never infer worth from low recall counts | Multi-word recall was broken for most of this corpus's life; disuse is not evidence |

## Infrastructure

| Component | Role | Location |
|---|---|---|
| Global CLAUDE.md | Boot loader — loaded every session | `~/.claude/CLAUDE.md` |
| open-brain MCP | 13 tools: `ob_recall`, `ob_store`, `ob_feedback`, … | `open-brain/build/server.js` |
| knowledge-v2.db | SQLite + FTS5, single source for sessions and knowledge | `~/.claude/open-brain/knowledge-v2.db` |
| SessionStart hook | Emits `SESSION_UUID`, runs health checks | `open-brain/build/cli-bootstrap.js` |
| SessionEnd hook | Captures the session, writes the vault summary | `open-brain/build/cli-session-end.js` |
| Obsidian Vault v2 | Human-browsable knowledge mirror | `~/Obsidian Vault v2/` |
| Dashboard | Read-only browser over the DB | `open-brain/scripts/dashboard.mjs` → `:3456` |

Override the vault location with `OPEN_BRAIN_VAULT_DIR`, and the database with `KNOWLEDGE_V2_DB`.

## Vault Structure

```
~/Obsidian Vault v2/
├── Archive/         — Retired notes
├── Checkpoints/     — Mid-session captures (/checkpoint)
├── Experiences/     — Individual lessons, filed per project subdirectory
├── Skill-Candidates/— SKILL-INDEX.md + SKILL-CANDIDATES.md
├── Skills/          — Reserved; distilled skills currently live in ~/.claude/skills/
└── Summaries/       — Session recaps, one note per session UUID
```

v1 had `Sessions/`, `Topics/`, and `Guidelines/`. **None exist in v2** — v2 was a clean rebuild, not a migration, and both vaults still sit on disk with near-identical names. Code that hardcoded the old name kept resolving to the abandoned one, so always resolve through `obsidianVaultDir()`.

Experiences are filed under a project subdirectory (`Experiences/General/`, `Experiences/A2A-Hub/`). Any reader must recurse — a flat `readdir` sees 1 note out of 399 and reports a healthy-looking zero.

## CLI

| Command | Purpose |
|---|---|
| `open-brain sync [--check] [--score]` | Validate version + structural consistency |
| `open-brain start` / `end [--dry-run]` | Session lifecycle |
| `open-brain dream [--since=<days>] [--json]` | Reconcile stored memory. **Read-only** — `--dry-run` is the default, and `--apply` exits non-zero because no write path exists yet |

## Research Background

- **XSkill** — skills as k=(M, W, P): Metadata for retrieval, Workflow for procedure, tool templates for reuse.
- **SAGE** — experience banks and accumulation loops that let agents learn from past sessions.

The key insight: Obsidian provides storage *and* visualization, while SQLite provides ranked retrieval. The missing pieces were the **automation loop** (session hooks) and the **format standards** (frontmatter, WikiLinks, TRIGGER/ACTION/CONTEXT/OUTCOME) that make stored knowledge retrievable.

## Evolution

- **v1.0 (2026-03)** — Open Brain MCP (SQLite/FTS5) for experiences, Obsidian for skills only.
- **v2.0 (2026-03-18)** — Consolidated to a single Obsidian vault, automatic capture via SessionEnd hook.
- **v0.4.0** — Outcome tracking: `ob_feedback`, maturity lifecycle, apoptosis. (The lifecycle and apoptosis were cut in Loop 10; the ratings remain.)
- **v0.9.0** — v2 rebuild: `knowledge-v2.db`, `Obsidian Vault v2`, v1 tree retired.
- **v0.10.0** — `dream` wired to the CLI; every fact carries a state-vs-event kind.
- **v0.10.1** — Skill graduation restored; `sync` now fails on v1-vault references.

## Verification Checklist

- [ ] Start a session — verify `SESSION_UUID` is emitted exactly once
- [ ] `ob_recall` on a known topic — verify results carry maturity data
- [ ] End a session — verify a new note appears in `~/Obsidian Vault v2/Summaries/`
- [ ] `open-brain sync` — verify 0 issues
- [ ] Open the dashboard — verify sessions, chunks, and knowledge render
