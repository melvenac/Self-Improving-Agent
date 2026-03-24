# Learning System — Known Gaps & Improvement Backlog

> Last updated: 2026-03-20 — reflects v2.1 with compound feedback loop.

## Completed

### ~~1. No Automatic Session Capture Safety Net~~ — DONE
**Was:** If you forget to run `/end` or a session crashes, that session's knowledge is lost.
**Fix:** `SessionEnd` hook (`vault-writer.mjs`) auto-writes session logs and experience files to the Obsidian Vault after every Claude Code session. No manual `/end` required for capture.

### ~~2. No Visual Knowledge Graph~~ — DONE
**Was:** Experiences searchable via `kb_recall` but not browsable. No way to see connections between topics, projects, or patterns.
**Fix:** Experiences now live as individual `.md` files in `~/Obsidian Vault/Experiences/` with WikiLinks to projects, topics, and related sessions. Obsidian's graph view surfaces the full knowledge network visually.

### ~~3. No Conversation Import~~ — DONE
**Was:** Historical Claude Code conversations not captured — only sessions where `/end` was explicitly run.
**Fix:** Two migration scripts cover all session sources:
- `vault-migration.mjs` — migrated 10 sessions + 16 experiences from Knowledge MCP (SQLite .db files)
- `vault-migrate-jsonl.mjs` — migrated 79 sessions from Claude Code's native JSONL transcripts (`~/.claude/projects/*/*.jsonl`)
- **Total: 89 sessions** in the vault, dating back to 2026-03-07

### ~~4. Vault Writer Was Broken~~ — FIXED
**Was:** `vault-writer.mjs` used wrong event categories (`prompt` instead of `user_prompt`), tried `JSON.parse` on raw text data, and produced empty session files.
**Fix:** Rewrote event parsing to match actual `.db` schema. Output format now matches migration script (What Was Done, Files Changed, Key Decisions, Gotchas, See Also with WikiLinks).

### ~~5. Smart Connections MCP~~ — DONE
**Was:** Retrieval depended on Smart Connections MCP for semantic search, but it wasn't configured or verified.
**Fix:** Installed `@yejianye/smart-connections-mcp` (npm), configured in `~/.mcp.json`. Exposes 4 tools: `lookup` (semantic search), `connection` (find similar notes), `stats`, `validate`. Verified working — "convex validator import gotcha" returns `convex-validator-imports.md` at 0.836 similarity.

---

## High Priority

### ~~1. Experience Quality Varies~~ — IMPROVED
**Was:** Auto-extracted experiences were generic ("Workaround or fix applied related to error") because extraction used keyword spray across all text.
**Fix:** Rewrote extraction to use structured session data (decision events and gotcha detections). Added quality gates: min 40 char length, max 3 per session, actual content in Action field instead of boilerplate, `source: auto-extracted` tag for easy review. Manually written experiences via `/end` are still higher quality but auto-extracted ones are now useful.

### ~~3. Skill Distillation Is Manual~~ — FULLY AUTOMATED
**Was:** The "3+ similar experiences → propose skill" pipeline required the agent to notice the pattern during retrieval.
**Fix (v1):** `vault-skill-scan.mjs` clusters experiences by tag, project, and type. Outputs `SKILL-CANDIDATES.md` with WikiLinks. Run on-demand.
**Fix (v2, 2026-03-20):** `skill-scan.mjs` SessionEnd hook runs automatically after vault-writer. Diffs against previous scan, detects new/growing clusters, writes pending proposals to `.skill-proposals-pending.json`. No manual scanning needed — the compound feedback loop detects patterns as experiences accumulate.

---

## Medium Priority

### ~~4. No Semantic Dedup in Auto-Extraction~~ — DONE
**Was:** `vault-writer.mjs` could write near-duplicate experiences. Dedup was filename-based only.
**Fix:** Added `findSemanticDuplicate()` to vault-writer — calls `smart-cli lookup` before writing each experience. If an existing experience in `Experiences/` scores >= 0.80 similarity, the write is skipped and logged. Falls back gracefully if smart-cli is unavailable.

### ~~5. Vault Writer Error Visibility~~ — DONE
**Was:** Errors logged to hidden `.vault-writer.log` only, not visible in Obsidian.
**Fix:** Fatal errors now also write to `~/Obsidian Vault/Logs/vault-writer-errors.md` — a visible note with frontmatter that appears in the graph. Appends timestamped entries with stack traces. Gives the `Logs/` folder a purpose.

### ~~6. Session Filename Collisions~~ — DONE
**Was:** 13 sessions lost because duplicate filename slugs caused `writeIfNew` to skip them.
**Fix:** All three scripts (`vault-writer.mjs`, `vault-migrate-jsonl.mjs`, `vault-migration.mjs`) now append the first 8 chars of session/db ID to every filename. Re-ran JSONL migration and recovered all 13 lost sessions. **102 total sessions** in vault.

---

## Low Priority

### ~~7. No Decay/Relevance Scoring~~ — DONE
**Was:** Old experiences had equal weight to new ones. No way to know which are actually useful.
**Fix:** Retrieval protocol now updates `last-used` (date) and `retrieval-count` (integer) in experience frontmatter each time one is surfaced. Enables future pruning of stale experiences and prioritization of frequently used ones.

### 8. No Cross-Machine Sync — DEFERRED
**Status:** Deferred. If a second machine is added, use git-based sync or Obsidian Sync.

### ~~9. Empty Vault Folders~~ — DONE
**Was:** `Projects/`, `Context/`, `Logs/` folders were empty and unused.
**Fix:**
- `Projects/` — now holds synced PRD, README, and Summary docs from all 6 projects. `vault-sync-projects.mjs` copies them with vault frontmatter so Smart Connections indexes them. Runs automatically via vault-writer on each SessionEnd, only rewrites changed files.
- `Logs/` — now holds `vault-writer-errors.md` for visible error reporting (Gap #5).
- `Context/` — still unused, can be deleted or repurposed later.
