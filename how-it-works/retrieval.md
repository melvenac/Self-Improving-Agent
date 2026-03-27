# Retrieval: How Knowledge Gets Surfaced

Retrieval is the process of finding and presenting relevant knowledge at the start of a session. It turns the accumulated vault into actionable guidance for the current task.

## When Retrieval Happens

Retrieval runs automatically in two ways:

1. **`session-bootstrap.mjs` hook** (SessionStart) — lightweight, automatic. Detects project context, reads the `next-session.md` handoff, checks backup freshness, checks for pending skill proposals.
2. **`/start` command** (manual or prompted) — full retrieval with federated search, project state reading, and context injection.

## The Retrieval Protocol

### Step 1: Knowledge Recall

The agent queries the Knowledge MCP using recency-weighted BM25 ranking:

| Store | Tool | What it searches |
|---|---|---|
| **Knowledge MCP** | `kb_recall(queries, project, limit: 5)` | FTS5 index of sessions, experiences, stored knowledge, summaries — recency-weighted |
| **CC Memory** | Scan MEMORY.md index | In-context identity, preferences, project status |

`kb_recall` first searches within the current project scope. If fewer than 3 results are found, it automatically broadens to a global search across all projects.

**Note on Smart Connections:** Smart Connections MCP is no longer part of the agent retrieval path. It remains available for personal Obsidian browsing and manual vault exploration, but `/start` uses `kb_recall` exclusively.

### Step 2: Check Skills and Proposals

- Read `~/Obsidian Vault/Guidelines/SKILL-INDEX.md` — scan for skills matching the session's planned work
- Check `~/Obsidian Vault/Guidelines/SKILL-CANDIDATES.md` — if any cluster has 3+ experiences, propose distilling
- Check `.skill-proposals-pending.json` — written by `skill-scan.mjs` when new clusters cross threshold

### Step 3: Read next-session handoff

If `.agents/SESSIONS/next-session.md` exists (written by `/end`), read it for:
- What was in progress
- Gotchas to watch for
- Open questions needing input

### Step 4: Context Budget Check

Before injecting, estimate the context cost:
- If SUMMARY.md is over 50 lines, summarize to 3-5 sentences instead of injecting raw
- If more than 3 experiences matched, pick the top 3 by relevance
- Startup injection should consume < 5% of the context window

### Step 5: Surface Results

The agent presents at most:
- **3 experiences** — the most relevant individual lessons, rewritten as actionable guidance
- **2 skills** — the most relevant reusable patterns

These are presented as non-prescriptive guidance. The agent suggests; it does not mandate.

## Relevance Scoring

Two frontmatter fields on experience files enable relevance tracking:

### `retrieval-count`

Incremented each time an experience is surfaced during retrieval. A high retrieval count means the experience is frequently relevant — it's a signal of high value.

### `last-used`

Updated to today's date each time an experience is surfaced. This enables staleness detection:

- **Frequently used, recently used** — high-value, keep prominent
- **Frequently used, not recently used** — may still be valuable, review periodically
- **Rarely used, not recently used** — candidate for pruning or archival (flagged monthly)

## Stale Experience Pruning

On the first session of each month (or when prompted), `/start` flags experiences with:
- `retrieval-count: 0` and `last-used` older than 90 days
- These are presented to the user for review — never auto-deleted

## Example: What a Session Start Looks Like

When you run `/start` in a Convex project, the agent might surface:

```
Session 4 — 2026-03-25
Project State: Auth module complete, Stripe webhooks in progress
Proposed Objective: Finish webhook signature verification (P1 from INBOX)

Relevant Knowledge:
- "Convex validator must wrap entire args object" — wrap your webhook handler args
- "Stripe webhook retry backoff" — use idempotency keys in your action
Skills: "Convex Function Patterns" — validator wrapping, error handling

Handoff from last session: webhook endpoint scaffolded, needs signature verification

Awaiting approval...
```
