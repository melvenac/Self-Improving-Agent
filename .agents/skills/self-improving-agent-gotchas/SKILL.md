---
name: self-improving-agent-gotchas
description: Common gotchas and proven patterns for developing the Self-Improving Agent knowledge pipeline. Use this skill whenever working on open-brain TypeScript source (open-brain/src/**/*.ts), the SessionStart/SessionEnd hooks, SQLite/FTS5 queries, the vault writer, embedding/vector search, or the knowledge-v2.db schema. Also trigger when the user encounters ob_recall returning zero or wrong results, queries working globally but failing per-project, source code looking correct but runtime behavior diverging, path mismatches between shells, UPSERT failures on the knowledge table, session chunks providing no retrieval value, semantic search missing obvious matches, or "it works in the repo but not when installed." Trigger even if the user does not explicitly mention gotchas — these lessons apply any time Self-Improving Agent code is being written, debugged, or extended.
---

# Self-Improving Agent Gotchas

> **Version:** 1.0 | **Last updated:** 2026-03-30 | **Source experiences:** 8
> **Tier:** 2-Methodology
> **Scope:** Pitfalls, patterns, and architectural decisions for the Self-Improving Agent repo (TypeScript MCP server, ESM hooks, SQLite DB, Obsidian vault integration) | **Not:** General TypeScript/Node best practices unrelated to this project; Obsidian plugin development; Claude Code internals

Hard-won lessons from building and debugging the Self-Improving Agent knowledge pipeline. Each section is standalone — an orchestrator can reference individual sections by number. Ordered by frequency and impact: the first few entries are the ones you will hit most often.

---

## 1. Stale TypeScript Builds Cause Silent Runtime Failures [COMMON]

**Principle:** In any TypeScript project with separate `src/` and `build/` directories, the compiled output can silently diverge from the source. The runtime executes `build/*.js`, not `src/*.ts`.

**Symptom:** The MCP server behaves differently than the source code suggests — `ob_recall` returns
nothing, a config change has no effect, a bug you fixed reappears.

**Fix:** `cd open-brain && npm run build` after every source edit. **There is one copy, not two:** the
server and both hooks run from `open-brain/build/` inside this repo, and `~/.claude/open-brain/` holds
data only (`knowledge-v2.db`, `active-session.json`) — no source, no build.

**A rebuild is not enough on its own.** The running MCP server keeps the old code until it
reconnects, and a stale server reports success on a parameter it silently strips. Rebuild, then ask
Aaron to run `/mcp reconnect open-brain`, then verify by reading a row back.

> This gotcha was itself stale until Loop 11: it told you to `cp` source into
> `~/.claude/knowledge-mcp/`, a directory that does not exist. The skill about stale builds had gone
> stale.

**Why this matters:** This is the single most common time-waster in this repo. The failure is completely silent — no error, no warning, just old behavior from old code.

---

## 2. Windows Path Separators Break SQLite LIKE Queries [COMMON]

**Principle:** Path separators must be normalized before both storage and query. Mixed `\` and `/` paths will cause LIKE clauses to silently return zero rows.

**Symptom:** `ob_recall` works for global queries but returns nothing when scoped to a project. Queries filtering by file path return empty results on Windows.

**Fix:** Normalize all paths to forward slashes at both write time and read time using a shared helper:

```typescript
const normalizePath = (p: string | null) => p ? p.replace(/\\/g, "/") : null;
```

Apply in `recall()`, `insertSession()`, `insertKnowledge()`, and any new function that touches path columns.

**Why this matters:** Git Bash reports forward slashes, PowerShell reports backslashes. SQLite `LIKE '%C:\path%'` will never match `'C:/path'` stored in the DB. The mismatch is invisible unless you inspect raw query parameters.

---

## 3. Knowledge Table Has No UNIQUE Constraint on `key` [SUBTLE]

**Principle:** The `knowledge` table in knowledge.db uses a non-unique index (`idx_knowledge_key`), not a UNIQUE constraint. Standard UPSERT syntax will fail silently or error.

**Symptom:** `INSERT ... ON CONFLICT(key)` throws an error or creates duplicate rows instead of updating.

**Fix:** Use a SELECT-then-UPDATE/INSERT pattern, keyed on `key + source`:

```typescript
const existing = db.prepare("SELECT id FROM knowledge WHERE key = ? AND source = ?").get(key, source);
if (existing) {
  db.prepare("UPDATE knowledge SET ... WHERE id = ?").run(...values, existing.id);
} else {
  db.prepare("INSERT INTO knowledge ...").run(...values);
}
```

**Why this matters:** This is a schema-level surprise that wastes debugging time. The natural assumption is that `key` is unique — it is not.

---

## 4. Raw Session Chunks Are Not Knowledge — Don't Index Breadcrumbs [ARCHITECTURAL]

**Principle:** Auto-indexing tool call metadata (file paths read, commands run, task status JSON) produces zero retrieval value. The valuable knowledge — why decisions were made, what was learned — lives in the assistant's reasoning, which hooks cannot see. Session summaries written by `/end` capture this context; raw chunks do not.

**Symptom:** Thousands of indexed chunks (6,900+) that never surface in `ob_recall`. Storage and indexing overhead with no recall benefit.

**Fix:** Do not build or re-enable chunk indexing pipelines. Session logs written by `/end` are the authoritative source of session knowledge. If you need richer session data, improve the `/end` summarization prompt rather than indexing raw tool output.

**Why this matters:** It is tempting to "capture everything." But breadcrumbs (82-char file paths, "yes"/"continue" prompts, single-word git commands) are noise, not signal. Only 59 out of 6,928 chunks had any substance.

---

## 5. Data Quality Trumps Model Quality for Semantic Search [ARCHITECTURAL]

**Principle:** When semantic search returns poor results, enrich the stored data before upgrading the embedding model. A small model with rich vocabulary outperforms a large model searching sparse content.

**Symptom:** Queries like "how did we handle payments?" miss entries about Stripe webhooks. Semantic search returns irrelevant results despite relevant entries existing in the knowledge base.

**Fix:** Add a `CONCEPTS` line (plain English domain description with synonyms and related terms) and broad domain tags to each knowledge entry. This gives both FTS5 keyword search and vector embeddings richer vocabulary to match against:

```
CONCEPTS: Stripe webhook integration for processing subscription payments and billing events
```

**Why this matters:** The 32-dim `potion-base-32m` embedding model is sufficient when the content contains the right vocabulary. The fix that works is free (richer text), while the fix that doesn't (bigger model) costs compute and complexity.

---

## 6. Fix Wiring Between Stores, Don't Consolidate [ARCHITECTURAL]

**Principle:** When multiple knowledge stores overlap, the instinct to consolidate into one store is usually wrong. Each store likely serves a distinct access pattern. Fix the wiring (define write authority, add cross-store mirroring, build federated search) instead.

**Symptom:** Knowledge is scattered across CC Memory, SQLite, and Obsidian with no clear source of truth. Duplicates appear, entries conflict, and retrieval misses knowledge that exists in a different store.

**Fix:** For each store, identify its unique access pattern:
- **CC Memory:** Zero-latency in-context bootstrap (identity, key rules)
- **SQLite (knowledge.db):** Structured FTS5 search with filters (sessions, experiences, ephemeral data)
- **Obsidian Vault:** Human-browsable knowledge graph + semantic search (durable skills, experiences)

Define a write authority table (ADR-005) specifying which store is authoritative for each data type. Add mirroring (e.g., Obsidian experiences mirrored to SQLite) and federated search that queries all stores.

**Why this matters:** Consolidation loses the unique strengths of each store. The correct fix preserves all access patterns while eliminating confusion about where data lives.

---

## 7. Bundle Dependencies for Self-Contained Distribution [SUBTLE]

**Principle:** If users must clone multiple repos or install separate npm packages to get a working system, adoption will fail. Bundle all dependencies into the repo so a single clone provides everything needed.

**Symptom:** New users cannot get the system running from a single `git clone`. Setup instructions reference external repos or npm packages that may be outdated or unavailable.

**Fix:** Copy dependent source into the repo (e.g., `open-brain/` bundled directly). Users run `npm install && npm run build` in each subdirectory. Keep origin repos separate for independent development but sync source manually.

**Tradeoff:** Source is duplicated from origin repos. Accept the sync overhead in exchange for single-clone usability.

---

## 8. XSkill Comparison — Three Features Worth Adopting [ARCHITECTURAL]

**Principle:** The XSkill framework (research-grade, Python, multimodal agents) shares the same core loop as Self-Improving Agent (accumulate, retrieve, improve). Three of its features transfer well to this project's production Node.js context.

**Features worth adopting:**

1. **Experience critique:** Use LLM-as-judge to validate experiences before storing. Score quality, reject low-value entries. (Planned — requires a `vault-writer.ts` change using `claude --print`.)
2. **Task decomposition:** Split retrieval queries into 2-3 methodology-focused sub-queries for better recall. (Implemented as prompt changes to `/start` and CLAUDE.md.)
3. **Experience rewriting:** Adapt retrieved experiences to the current task context before presenting them. (Implemented as prompt changes.)

**Why this matters:** Not every insight needs to be invented from scratch. Studying analogous systems surfaces improvements that are easy to implement once identified.

---

<!-- NEW ENTRIES: Add new sections above this line, incrementing the number -->

---

## Pre-Commit Checklist

Before pushing changes to the Self-Improving Agent repo, verify:

- [ ] TypeScript source was recompiled (`cd open-brain && npm run build`)
- [ ] The running MCP server was reconnected after the rebuild (`/mcp reconnect open-brain`) — a stale server reports success on a parameter it strips
- [ ] All file paths in new SQL queries use `normalizePath()` at both write and read time
- [ ] New knowledge table operations use SELECT-then-UPDATE/INSERT, not `ON CONFLICT(key)`
- [ ] New knowledge entries include a `CONCEPTS` line with domain vocabulary and synonyms
- [ ] `/sync` was run to validate version consistency across README, PRD, and package.json
- [ ] No raw tool metadata is being indexed — only curated summaries and experiences

---

## Debugging Decision Tree

When something breaks, walk through this sequence:

1. **Is the runtime code actually current?**
   - Compare `build/*.js` timestamps against `src/*.ts` timestamps
   - If stale: `npm run build` and retest
   - If both copies exist (repo + installed): check which one the MCP server is loading

2. **Is the query returning empty results?**
   - Check path separators: log the raw query parameters and the stored values
   - If on Windows: confirm `normalizePath()` is applied to both the query parameter and the stored data
   - If LIKE query: test with a manual `SELECT * FROM table WHERE column LIKE '%fragment%'` in the SQLite CLI

3. **Is the UPSERT creating duplicates?**
   - Check whether the table has a UNIQUE constraint (it probably doesn't on `key` alone)
   - Switch to SELECT-then-UPDATE/INSERT pattern keyed on `key + source`

4. **Is semantic search missing obvious matches?**
   - Check the stored entry's text: does it contain the vocabulary the query uses?
   - If not: add a CONCEPTS line with synonyms and domain terms, re-index
   - Don't upgrade the embedding model until you have confirmed the data is rich enough

5. **Is the knowledge base growing but recall quality is flat or declining?**
   - Check for noise: are raw session chunks being indexed?
   - Review the `/end` summarization output for quality
   - Consider implementing experience critique (LLM-as-judge) before storage

6. **Is knowledge scattered with no clear source of truth?**
   - Consult ADR-005 write authority table
   - Verify mirroring is running (Obsidian to SQLite)
   - Check federated search is querying all stores
