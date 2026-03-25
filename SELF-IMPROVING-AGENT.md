# Self-Improving Agent Protocol

> Quick reference for AI agents. For detailed docs, see [how-it-works/](how-it-works/overview.md). For setup, see [getting-started/](getting-started/01-prerequisites.md).

## Architecture

3-tier hub-and-spoke: **Global** (CLAUDE.md + Knowledge MCP + Obsidian) → **Domain** (tagged experiences) → **Project** (.claude + .agents).

Three stores with write authority (ADR-005): Obsidian Vault (experiences/skills), Knowledge MCP SQLite (sessions/ephemeral), CC Memory (identity/bootstrap).

## Commands

Two commands, both with smart routing:

| Command | What it does |
|---|---|
| `/start` | Detects `.agents/` → full project startup + knowledge recall, or lightweight recall only |
| `/end` | Detects `.agents/` → full project close-out + knowledge capture, or lightweight capture only |

`/recall` has been merged into `/start` (Part B).

## Session Lifecycle

### Start (via `/start` or automatic `session-bootstrap.mjs` hook)

1. **Bootstrap hook** (automatic) — detects project, reads `next-session.md` handoff, checks backup freshness, checks skill proposals
2. **Federated search** — Knowledge MCP (FTS5) + Smart Connections (semantic) in parallel → max 3 experiences + 2 skills
3. **Project state** (if `.agents/` exists) — reads SUMMARY.md, INBOX.md, reconciles task drift, generates CLAUDE.md if missing
4. **Context budget** — keeps startup injection under 5% of context window
5. **Present summary** — project state + proposed objective + relevant knowledge → await approval

### End (via `/end`)

1. **Project close-out** (if `.agents/`) — update session log, SUMMARY.md, DECISIONS.md, INBOX.md, task.md
2. **Next-session handoff** — write `next-session.md` with pick-up-here notes, gotchas, open questions
3. **Knowledge capture** — review what hooks will miss, store supplemental experiences via `kb_store`
4. **Session summary** — `kb_store_summary` with 2-3 sentence recap

## Accumulation (automatic via SessionEnd hooks)

Hook order: `auto-index.mjs` → `vault-writer.mjs` → `skill-scan.mjs`

1. **auto-index** — indexes session data into Knowledge MCP SQLite
2. **vault-writer** — creates session log in Obsidian, extracts experiences (TRIGGER/ACTION/CONTEXT/OUTCOME), mirrors to Knowledge MCP, updates topic backlinks. Stage 5 safety net auto-fills `.agents/` logs when `/end` is skipped.
3. **skill-scan** — clusters experiences by tags, diffs against `SKILL-CANDIDATES.md`, writes `.skill-proposals-pending.json` when clusters cross 3+ threshold

**The `/end` command complements these hooks** — it captures what automation misses (cross-project insights, context about _why_ decisions were made, corrections to existing experiences).

## Experience Format

```
[EXPERIENCE] {short-title}
PROJECT: {name}
DOMAIN: {tags}
DATE: {YYYY-MM-DD}
TYPE: {gotcha | pattern | decision | fix | optimization}

TRIGGER: {when relevant}
ACTION: {what to do}
CONTEXT: {what was happening}
OUTCOME: {what happened}
```

## Feedback Loop (compound, automatic)

Each session adds experiences → skill-scan detects emerging patterns → proposes skills when clusters form → agent gets smarter over time.

## Guardrails

- Max 3 experiences + 2 skills per session start
- Always dedup before storing
- Never auto-create skills (ask user, 3-experience minimum)
- Non-prescriptive — all retrieved knowledge is guidance
- Startup injection < 5% of context window
- Monthly `kb_prune` + stale experience flagging (retrieval-count: 0, last-used > 90d)
