# Database Wiring Redesign — Design Spec

> **Date:** 2026-03-23
> **Status:** Draft
> **ADR:** ADR-005
> **Goal:** Fix the wiring between three existing knowledge stores so federated search works reliably, without consolidating stores.

## Problem

The Self-Improving Agent has three knowledge stores (Claude Code memory, Open Brain SQLite, Obsidian Vault) that overlap with no clear authority. Search doesn't span all three, so "Clark, what did we decide about X?" may miss results depending on which store captured it. The system is unreliable not because the stores are wrong, but because the wiring between them is incomplete.

## Decision

Keep all three stores. Each serves a distinct access pattern that the others can't replicate:

| Store | Access Pattern | Unique Strength |
|---|---|---|
| CC Memory | Always in context, zero latency | Identity & preferences without a tool call |
| Open Brain SQLite | Structured search with filters | FTS5 keyword search, project/category/time filtering |
| Obsidian Vault | Browsable knowledge graph | Human reading, skill distillation pipeline, semantic search |

Fix the wiring by: (1) defining write authority, (2) adding federated search, (3) automating cross-store mirroring, (4) fixing Smart Connections, (5) trimming CC memory to its authority scope.

## 1. Write Authority

Each data type has exactly one canonical store. Mirrors are secondary copies for search coverage.

| Data Type | Primary Store | Mirrored To | Rationale |
|---|---|---|---|
| Identity & preferences | CC Memory | — | Must be in-context without tool calls |
| Project status & refs | CC Memory | — | Needed at session bootstrap |
| Session records | Open Brain SQLite | Obsidian (vault-writer) | Auto-indexed, filterable, TTL-pruned |
| Decisions & experiences | Obsidian Vault | Open Brain (kb_store) | Feeds skill distillation pipeline |
| Skills & guidelines | Obsidian Vault | — | Human-curated, browsable |
| Ephemeral debug/errors | Open Brain SQLite | — | Searchable, auto-pruned at 90 days |

### Authority Rule

When data exists in multiple stores, the **primary store** is canonical. Conflicts are handled by convention, not runtime detection:

- **Mirrored data is write-once:** Mirrors are created at write time (SessionEnd hook) and not independently edited. Since only vault-writer writes mirrors, and it always reads from the primary store, conflicts should not arise in practice.
- **If a conflict is found manually:** The primary store wins. Update the mirror to match.
- **Key-based identity:** Mirrored experiences use the filename as a unique key in Open Brain's `knowledge` table. This is how dedup works — same key = same record.

## 2. Federated Search Protocol

A single logical search operation that spans all three stores and returns merged, deduplicated results.

### Search Sequence

When answering "what did we decide/discuss/do about X?":

1. **Open Brain** — `kb_recall(queries: [Q1, Q2], project: cwd, limit: 5)` — searches sessions, knowledge table, summaries via FTS5
2. **Obsidian** — `smart-connections lookup(query: Q1, limit: 5)` — searches experiences, skills, topics via semantic similarity
3. **CC Memory** — scan `MEMORY.md` index descriptions for keyword matches, read matching files

### Merge Logic

- **Dedup:** If the same decision appears in both Open Brain (via mirror) and Obsidian (primary), keep the Obsidian version (richer format, canonical)
- **Source tagging:** Each result tagged with provenance (`[OB]`, `[SC]`, `[CC]`)
- **Ranking:** Exact keyword matches (FTS5) first, then semantic matches (Smart Connections), then CC memory hits
- **Cap:** Surface at most 5 results total to avoid context bloat

### Where This Lives

Update the retrieval protocol in `~/.claude/CLAUDE.md` (the "Retrieval Protocol" section) and the `/recall` skill. Not a new tool — a better-defined sequence.

### Degraded Mode

If Smart Connections is unavailable, fall back to `grep -rl` over `Experiences/` and `Guidelines/` directories. Log a warning so it's visible.

## 3. Mirroring Automation

### Mirror A: Obsidian → Open Brain (NEW)

**Trigger:** SessionEnd hook, after vault-writer creates Experience files.

**Transport:** vault-writer.mjs runs as a standalone Node.js script, not inside a Claude Code session — so MCP tools like `kb_store` are not directly callable. Two viable options:

- **Option 1 (Recommended): Direct SQLite writes.** vault-writer already has filesystem access. Import `better-sqlite3`, open Open Brain's database at `~/.claude/context-mode/knowledge.db`, and INSERT/UPDATE the `knowledge` table directly. Also update `knowledge_fts` via the existing triggers. This avoids any MCP dependency and matches how the indexer already works.
- **Option 2: Shell out to MCP CLI.** Use `claude --print` or a dedicated CLI wrapper to invoke `kb_store`. More complex, slower, and adds a dependency on Claude Code being installed.

**Mechanism (Option 1):** For each new or updated Experience file in `Experiences/`:
1. Read the file content and parse YAML frontmatter
2. Open `~/.claude/context-mode/knowledge.db` with better-sqlite3
3. UPSERT into `knowledge` table:
   - `key`: filename without extension (e.g., `stripe-webhook-verification`)
   - `content`: full TRIGGER/ACTION/CONTEXT/OUTCOME text
   - `tags`: JSON array from experience frontmatter
   - `source`: `"vault-mirror"`
   - `project_dir`: project from frontmatter (or NULL for global)
   - `permanent`: 1 (experiences should not be auto-pruned)
4. FTS5 triggers on the `knowledge` table auto-update `knowledge_fts` — no manual FTS insert needed

**Dedup:** Use SQLite UPSERT (`INSERT ... ON CONFLICT(key) DO UPDATE`) so re-running on the same experience updates rather than duplicates.

**Implementation:** Add a `mirrorToOpenBrain()` function to `vault-writer.mjs` that runs after experience extraction (Stage 2). Add `better-sqlite3` as a dependency.

### Mirror B: Open Brain → Obsidian (EXISTS — clarified)

vault-writer reads from Claude Code session `.db` files (in `~/.claude/context-mode/sessions/`), not from Open Brain's SQLite database directly. It mirrors **session records** (prompts, tool results, file changes) to Obsidian `Sessions/`. This is correct per the authority table — session records are primary in Open Brain, mirrored to Obsidian.

**Not mirrored (intentional):** Ephemeral debug/errors stay only in Open Brain SQLite. They are searchable via `kb_recall` but not written to Obsidian — they auto-prune at 90 days and don't warrant permanent markdown files.

### Mirror Verification

Add a `--verify-mirrors` flag to vault-writer that:
- Counts experiences in Obsidian vs knowledge entries with `source: "vault-mirror"` in Open Brain
- Reports any mismatches
- Can be run manually or on a schedule

## 4. Smart Connections Fix

### Problem

The Smart Connections Obsidian plugin is installed but embeddings are not configured. Semantic search via the MCP tool returns no useful results.

### Fix

1. **Identify embedding model options:** Smart Connections supports local models (transformers.js) and API-based models (OpenAI, Anthropic). Local avoids API cost; API may produce better embeddings. Check what models are available in the installed plugin version.
2. **Configure in plugin settings:** Set the embedding model in `.obsidian/plugins/smart-connections/data.json` or via Obsidian settings UI. If API-based, add the API key.
3. **Trigger initial embedding generation:** Open Obsidian or run the Smart Connections CLI to generate embeddings for all vault files. This may take several minutes for 215+ files.
4. **Verify via MCP:** Run `smart-connections lookup(query: "Stripe webhook verification", limit: 5)` and confirm relevant results from `Experiences/`.
5. **If unreliable:** Replace with grep-based fallback (see Degraded Mode in Section 2).

### Impact of Current Broken State

vault-writer's `findSemanticDuplicate()` function uses `smart-cli lookup` for dedup. With embeddings unconfigured, this has been silently returning no matches — meaning **duplicate experiences may already exist in the vault**. The implementation should include a one-time dedup audit of `Experiences/` after embeddings are working.

### Acceptance Test

Query: `"Stripe webhook verification"` should return the relevant experience file from `Experiences/` if one exists.

## 5. CC Memory Cleanup

Trim CC memory to its defined authority scope: identity, preferences, project status, references.

### Keep (Bootstrap Role)

- `user_aaron.md` — identity & profile
- `user_subscriptions_tools.md` — tool preferences
- `feedback_*.md` — behavioral guidance (these are preferences, not searchable knowledge)
- `reference_*.md` — external system pointers
- Active `project_*.md` files — current project status

### Review for Removal

Apply this rule: **If the data type's primary store is NOT CC memory per the authority table, AND the content is now findable via federated search, remove it.**

Candidates:
- `project_ai_first_framework.md` — archived, content is in git history
- `project_learning_system.md` — describes the repo we're in; derivable from `.agents/SYSTEM/SUMMARY.md`
- `project_experience_critique.md` — single feature decision, should be an Obsidian experience
- Stale `feedback_notebooklm_self_describe.md` — marked as moved to global but still present
- Any `project_*.md` that duplicates what's now in Obsidian `Experiences/` or Open Brain sessions

Each file should be individually reviewed before removal. Files that contain **preferences or behavioral guidance** (feedback_*.md) stay regardless — they serve the bootstrap role.

### Approach

- Review and remove in a **single git commit** so the cleanup is fully reversible via `git revert`
- Not a purge — each removal is justified against the authority table

## Implementation Order

1. **Smart Connections fix** — prerequisite for federated search leg 2
2. **Mirror A (Obsidian → Open Brain)** — vault-writer addition, ensures kb_recall has decisions/experiences
3. **Federated search protocol** — update CLAUDE.md and /recall skill
4. **CC Memory cleanup** — trim after federated search is working
5. **Mirror verification** — add --verify-mirrors flag

## Success Criteria

- [ ] "Clark, what did we decide about X?" returns relevant results from any store via a single search operation
- [ ] New experiences auto-mirror to Open Brain within the same SessionEnd hook
- [ ] Smart Connections returns semantic matches for test queries
- [ ] CC memory contains only bootstrap-scoped data
- [ ] No data type is written to a store that isn't its primary or designated mirror

## Evaluation Plan

Run this architecture for **one week** (through 2026-03-30). Evaluate:

- **Search hit rate:** Does federated recall find what Aaron asks about?
- **Mirror reliability:** Are mirrors staying in sync?
- **Smart Connections quality:** Is semantic search adding value over FTS5 alone?
- **Maintenance overhead:** Is 3-store wiring sustainable?

If search hit rate is poor or maintenance is too high, revisit consolidation (SQLite primary + Obsidian mirror) as documented in the brainstorming discussion.

### Rollback Plan

- **Mirror A writes** use UPSERT with `source: "vault-mirror"` — can be bulk-deleted from Open Brain with `DELETE FROM knowledge WHERE source = 'vault-mirror'`
- **CC Memory cleanup** is done in a single commit — revert with `git revert <commit>`
- **Smart Connections config** is an Obsidian plugin setting — revert by removing the config
- **CLAUDE.md protocol changes** are in git — revert the commit
- **Federated search ranking** — known limitation: fixed ordering (FTS5 → semantic → CC) ignores relevance scores. A low-scoring keyword match may outrank a highly relevant semantic match. Acceptable for the evaluation week; if problematic, consider normalized score interleaving.

## Alternatives Considered

### A: SQLite Primary + Obsidian Mirror
Consolidate to Open Brain as single source of truth. Simpler but loses Smart Connections semantic search and Obsidian's unique browsability as a primary store.

### B: Obsidian Primary + Fix Smart Connections
Drop Open Brain SQLite entirely. Loses FTS5 precision, structured filtering, and auto-indexing. Bets entirely on Smart Connections plugin reliability.

### C: SQLite Primary + Embeddings
Add vector table to Open Brain for semantic search. Best long-term option but overkill before proving BM25 is insufficient. Designed as a future upgrade path from the chosen approach.

## References

- Audit results: Session 1 (2026-03-23)
- Previous architecture: `.agents/SYSTEM/SUMMARY.md`
- Existing vault-writer: `scripts/vault-writer.mjs`
- Existing skill-scan: `scripts/vault-skill-scan.mjs`
