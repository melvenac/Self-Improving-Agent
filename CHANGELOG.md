# Changelog

## [v0.7.2] - 2026-07-28

### Fixed
- **`ob_recall` ranked older entries higher, not newer** — the weighted rank multiplied `bm25()` (negative, more-negative = better) by a factor that *grew* with age, so every day an entry aged it gained ~0.5% ranking advantage and at 200 days its score doubled. Documented as "recency-weighted BM25" since v0.3.0; it was anti-recency weighted. Now divides by the age term. Measured on the live 315-entry database, average age of top-5 results dropped from 123d to 44d.
- **Maturity boost was computed and discarded** — `server.ts` called `maturityBoost()` into a variable that was never read, and the SQL `ORDER BY` never referenced maturity. The 1.5x/1.2x boosts had never applied to a real recall. Maturity, the low-success-rate penalty, and the 1.3x failure boost are now part of the ranking expression, so they affect selection rather than just display order.
- **PRD and RULES checks could never pass** — `syncPrdVersion` and `checkRules` hardcoded `docs/` and the repo root while the framework convention (and `checkSummary`) use `.agents/SYSTEM/`. The PRD drifted three versions unnoticed because the drift detector was looking in the wrong place. New `resolveDocPath()` resolves `.agents/SYSTEM/` → `docs/` → root. The version pattern now tolerates `| **Version** | v0.7.1 |` as well as `| Version | 0.7.1 |`, preserving the author's style when auto-fixing.
- **Pipeline Health could not score above 3/10** — `lastHookRun` and `lastShadowRecall` were hardcoded `null` at both call sites, and nothing has written shadow-recall data since the v1→v2 port. Hook recency now reads the SessionEnd pipeline's own write marker; the dead shadow component was removed and its points redistributed.
- **`ob_sync --score` never recorded history** — only `ob_score` appended, so the trend stopped collecting in April despite `/sync` being the route in actual use.
- **CLI and MCP server reported different health scores** for the same repo — the CLI scored against the retired v1 `knowledge.db` (frozen since April) while the server used v2. `computeScore` now lives in `pipelines/sync/score.ts` and both call it.
- **Telemetry was written into a retired component's directory** — score history and the skill-invocation log lived under `~/.claude/knowledge-mcp/`, which is slated for deletion. Both moved to `~/.claude/open-brain/` (877 invocation entries and score history preserved).
- **Windows test teardown raced intermittently** — `ENOTEMPTY` on recursive `rmSync` failed a different test on roughly half of runs. 14 teardown sites now pass `maxRetries`/`retryDelay`.

- **Multi-word recall queries returned nothing** — FTS5 joins bare terms with AND, so `ob_recall(["knowledge maturity feedback loop"])` required all four terms in one entry and returned zero, while 86 entries matched some of them. `/start` instructs agents to use "methodology-focused" queries, which are exactly that shape, so the most common query form was the one that silently failed. `ob_recall` now retries with the terms OR-joined when the precise query returns fewer than `limit` results, keeping precise hits ranked first and labelling partial matches. Strictly additive — it can only fill empty slots, never displace an exact hit. Measured against the live database: `deterministic verification` 0 → 5, `test coverage strategy` 0 → 5.

### Added
- **CI workflow** (`.github/workflows/ci.yml`) — Node 22, `npm ci` → typecheck → test. The repo had no CI, which is why 7 tests stayed red for 3.5 months.
- **Root `npm test` / `build` / `typecheck` scripts** — the root `package.json` had no scripts, so `npm test` from the repo root was a no-op and tests only ran from `open-brain/`.
- **`checkMirrorParity`** — byte-for-byte parity across repo, template, and live `~/.claude` + `~/.cursor` command directories, with `MIRROR_EXCEPTIONS` documenting each intentional non-mirror. Distribution drift recurred across 12 sessions because parity was only ever checked by eye.
- **`checkHookRegistration`** — counts hook registrations per event and flags duplicates. A duplicate SessionStart entry made the bootstrap hook emit `SESSION_UUID` twice.
- **Session provenance** — `recordSession`, `recordChunk`, `getSessionByUuid`, `getChunksForSession`. The `sessions` and `chunks` tables shipped in the v2 schema but nothing ever wrote to them, so `ob_set_session` only held the UUID in memory and there was no record to verify after a session ended. This is why SESSION_UUID verification stayed manual across 10 sessions.
- **Contract tests for `cli-bootstrap.ts`** — the most repeatedly-fixed file in the repo had no tests. Five tests assert the SESSION_UUID emission contract against the real entry point.
- **Ranking regression tests** — recency, maturity, success-rate penalty, exact failure-tag matching, and TS/SQL agreement, generated from one `LIFECYCLE_CONFIG` so the SQL and `maturityBoost()` cannot drift.

### Removed
- **`src/pipelines/recall/`** — `recall()` and `mergeAndRank()` were never imported by anything. The module held the only implementation of the semantic/keyword hybrid and failure boost, appeared in the architecture map as a cohesion-1.0 cluster, and had passing tests — for code that never ran. The failure boost was ported into the live ranking expression.
- **5 orphaned tests** in `checks.test.ts` for `syncKmcpVersion` and `checkInstalledDrift`, deleted from `src/` in April but left behind in tests.
- **Dead `paths.ts` keys** (`prd`, `knowledgeMcpPackageJson`, `hooksDir`) and the unused `dbPath` parameter on `checkSpecProvenance`.

### Changed
- **PRD reconciled against the code** — version corrected to v0.7.1, retired `knowledge-mcp`/`sqlite-vec` references removed, the expired "v1/v2 parallel until May 13" claim corrected, and a "Not currently implemented" section added naming four documented-but-absent features (semantic/keyword hybrid, RRF, cosine diversity filter, vector search).
- **Working cadence guidance** added to `RUNBOOK.md`.

## [v0.7.1] - 2026-07-27

### Fixed
- **Skill-scan cluster consolidation measured containment, not similarity** — `consolidateClusters` normalized file overlap by `Math.min(sizeA, sizeB)`, so any small cluster fully inside a large one scored 1.0 and merged unconditionally. One seed cluster then snowballed through the vault: the 2026-07-25 scan produced a 23-file cluster labeled `clerk` (only 2 of 23 files were Clerk-related) and a 22-file `node` cluster that was really "everything I hit on Windows". Now uses Jaccard (`intersection / union`) — the same 3-in-20 case scores 0.15 and is left alone.
- **Merged clusters were named after `tags[0]`** — whichever tag happened to come first out of the cluster map, which is why a Convex/VPS cluster was labeled `clerk`. Merged clusters now take the tag covering the largest share of the merged file set; the rest are recorded in `consolidatedFrom`.
- **Tag quoting was never stripped** in `parseExperienceTags` — `"deployment"` and `deployment` clustered separately (40 and 15 files), and quoted noise tags bypassed `NOISE_TAGS` entirely (`"gotcha"` reached 45 files). Surrounding quotes are now stripped before noise-filtering and deduplication.
- **Session UUID was discovered by filesystem mtime scan** — `cli-bootstrap.ts` scanned `~/.claude/projects/*.jsonl` for the newest transcript, but at SessionStart the current session's transcript does not exist yet. The hook either emitted nothing (provenance silently disabled for the session) or returned the *previous* session's UUID, mis-attributing everything stored. Now reads `session_id` from the hook's stdin payload; emits nothing rather than a wrong UUID if absent.

### Added
- **Merged-cluster size cap (8)** — a merge whose result would exceed `MAX_CLUSTER_SIZE` is refused. A skill distilled from 20+ experiences is not reviewable, so it gets skipped every scan and re-proposed the next one.
- **`oversized` flag on `SkillCluster`** — a single broad tag can exceed the cap without any merging (`deployment` 40, `convex` 36, `windows` 33 in the current vault). These are now flagged "TOO LARGE — split into narrower tags" in `SKILL-CANDIDATES.md` and excluded from both `pendingProposals` and `.skill-proposals-pending.json`, instead of being proposed as skills.
- **`dedupeClusters`** — a cluster whose files are ≥75% covered by a larger one is dropped rather than proposed alongside it. Consolidation deliberately leaves these alone (their Jaccard overlap is low), but proposing both spends two review cycles on the same material.

### Changed
- **`sessionStart()` accepts an optional `sessionId`** — callers that already know the UUID (hook payload, prior `ob_set_session`) pass it directly; `ob_start` now passes the registered session ID. Transcript discovery remains only as a mid-session fallback.

## [v0.7.0] - 2026-04-17

### Fixed
- **`project_dir` path canonicalization** — the server previously did partial normalization (backslash → forward-slash only), which caused the same project to be stored under up to 5 different keys (drive-case, path-case, double-slash variants). `ob_recall` missed 15 of 33 entries when queried with the canonical form. New `canonicalizeProjectDir()` in `shared/paths.ts` produces a single canonical form: lowercase drive + forward slashes + collapsed `/+` + trimmed trailing slash (Windows paths fully lowercased; non-drive paths preserve case for POSIX filesystems). Applied at both write (`ob_store`, `ob_store_chunk`, vault-path derivation) and query (`ob_recall`, `ob_list`) boundaries.
- **One-shot migration** on database open canonicalizes all existing `project_dir` values. 74 non-NULL rows collapsed from ~25 variants down to 12 canonical values (one per real project). Idempotent — second run changes 0 rows.
- **Redundant inlined backslash replays removed** from `server.ts` (lines 435, 665) — they duplicated what `normalizePath()` already did, now fully handled by the single canonicalizer.

### Added
- **`.agents/AGENT.md` convention** — declarative agent persona file (YAML frontmatter: `name`, `role`, `partner`, `mailbox_channel`). Keeps persona data out of `CLAUDE.md` and gives every project a predictable slot. Blank template with placeholders shipped in `project-template/.agents/AGENT.md`.
- **SessionStart hook emits identity line** — `cli-bootstrap.ts` reads `.agents/AGENT.md` via a new `agent-identity.ts` helper (regex frontmatter, no YAML dep) and emits `Agent: {name} ({role}) — partner: {partner}, channel: {channel}` after `SESSION_UUID`. Graceful skip if AGENT.md absent.
- **SessionStart hook surfaces mailbox state** — when `mailbox_channel` is declared, emits `Mailbox: N message(s) in {inbox-file}, last decision {date}`. Reads `~/.agents/mailbox/channels/{channel}/{partner}-to-{name}.md` (message count = `## [` header count) and `decisions.md` (latest `## YYYY-MM-DD` header).
- **`/start` reads mailbox before greeting** — the `/start` startup subagent now reads the inbox + decisions log if a mailbox_channel is declared, and surfaces the newest message subject + latest decision date in its GREETING. Projects without `AGENT.md` or without a channel get the unchanged greeting.

### Changed
- **Slash commands now ship through `project-template/`** — previously all `/start`, `/end`, `/sync`, `/task`, `/test`, `/skill-scan`, `/checkpoint`, `/bootstrap` evolution lived only in Aaron's user-global `~/.claude/commands/` and never reached template consumers. Cloning SIA and using the template today would have given a mid-2026-02 version of `/start` with no subagent dispatch, no mailbox logic, no AGENT.md parsing. Mirror rule established: `~/.claude/commands/` is the upstream live-scratch source; SIA-specific commands mirror to `project-template/.claude/commands/` (distribution channel) and SIA repo-root `.claude/commands/` (SIA dogfooding). Personal/generic commands (`/notebooklm`, `/transcript`) stay user-global only. v0.7.1 will add deterministic drift-detection (`/sync` parity check or pre-commit hook) so this class of drift cannot recur silently.
- **`/start` decision-date extraction disambiguated** — prompt previously said "grab the most recent `## YYYY-MM-DD` header," which the subagent interpreted positionally (last-in-file) rather than by date. Now: "parse all `## YYYY-MM-DD` headers, sort descending by date string (ISO format sorts correctly lexically), take the first result." Hook logic (`cli-bootstrap.ts`) was already correct; only the slash-command prompt needed clarification.
- **Live `/sync` command cleaned** — removed stale reference to `knowledge-mcp/package.json` as a downstream file (the `knowledge-mcp/` directory was deleted in commit `7696953`).

## [v0.6.1] - 2026-04-17

### Fixed
- **cli-bootstrap now emits `SESSION_UUID`** so `/start` can scope recalls + writes to the right session. `discoverSessionUuid()` was already built in `pipelines/session-start/session-discovery.ts` but was never wired into the SessionStart hook entry — resulting in `/start` reading "none" and silently skipping `ob_set_session`. Fix wires it in and pushes `SESSION_UUID: <uuid>` into the hook's output lines when non-null.

## [v0.6.0] - 2026-04-06

### Added
- **Recall-time diversity filter:** Post-RRF cosine similarity check (threshold 0.85) skips near-duplicate results, ensuring agents get diverse knowledge. Over-fetches 3x then filters down.
- **`kb_recall_report` MCP tool:** Analyzes knowledge base quality — finds duplicate clusters by vector similarity, lists stale entries with zero recalls. Configurable threshold and staleness window.
- **`kb_consolidate` MCP tool:** Archives multiple overlapping knowledge entries into a single consolidated entry. Inherits feedback counts and maturity from sources. Originals soft-deleted via `archived_into` column.
- **`kb_forget_chunk` MCP tool:** Delete individual chunks by ID for fine-grained cleanup.
- **Storage-time dedup:** `kb_store` checks for similar existing entries (Jaccard >50%) and logs near-duplicates to `~/.claude/knowledge-mcp/dedup-review.json` with a warning. Non-blocking — entries still stored.
- **Skill proposal consolidation:** `skill-scan.mjs` merges tag-based clusters with >60% file overlap, reducing noise (e.g., 51 clusters → ~15 groups).
- **Spec provenance tracking:** `/sync` validates that design specs in `docs/superpowers/specs/` have corresponding knowledge chunks with `category: "spec"`.
- **Subagent /start loop fix:** Lock file mechanism (`.agents/.start-lock`) prevents recursive `/start` invocation when Explore subagents trigger SessionStart hooks.

### Changed
- **`archived_into` schema migration:** New nullable column on knowledge table. Archived entries excluded from `recall()` and `listKnowledge()`.
- **`recall()` over-fetches:** FTS and vector queries now fetch `limit * 3` candidates, then diversity-filter down to `limit`.

## [v0.5.5] - 2026-04-05

### Added
- **Session manifest:** Unified session UUID threading across all memory layers — chunks, knowledge, and summaries are now traceable back to the session that created them
- **`kb_set_session` MCP tool:** Register the active session ID at startup; all subsequent `kb_store` and `kb_store_chunk` calls auto-inherit session provenance
- **Knowledge provenance:** `created_by_session` and `updated_by_session` columns on knowledge table
- **`updateKnowledge()` function:** Update existing knowledge entries with session stamping
- **`/start` session discovery:** A7/B2.5 steps discover Claude's session UUID from `.db` files and register via `kb_set_session`

### Changed
- **`kb_store_chunk` fallback:** Replaced `checkpoint-YYYY-MM-DD` synthetic IDs with active session fallback, then `local-YYYY-MM-DD-HHMM` (local time) as last resort
- **Sessions table cleaned:** Removed 143 orphaned sessions and renamed legacy checkpoint sessions

### Fixed
- **Session ID collisions:** Multiple sessions on the same day no longer share a single `checkpoint-YYYY-MM-DD` ID
- **UTC off-by-one:** Checkpoint IDs no longer show next day after ~7pm CDT

## [v0.5.4] - 2026-04-02

### Added
- **Protocol health scoring:** `sync.mjs --score` computes a deterministic 0-100 health score across 5 categories (config & structure, knowledge quality, staleness, coverage, pipeline health). `--score --json` for machine-readable output. `--history` shows trend across sessions.
- **Shadow-recall:** `session-end.mjs` Stage 3 replays recall queries with alternative search strategies (FTS-only, vector-only, weighted RRF variants) and logs comparisons to `shadow-recall.jsonl` for future proposer analysis.
- **Score history:** Each `--score` run auto-appends to `~/.claude/knowledge-mcp/score-history.jsonl` for trend tracking.
- **`/start` updated:** Monthly maintenance now includes protocol health score reporting. `.recalled-entries.json` now includes `queries` array for shadow-recall replay.

### Fixed
- **Stale references:** Fixed 8 references to removed scripts (`sync-docs.mjs`, `vault-writer.mjs`, `harness-eval.mjs`) across 6 files including global commands, project template, CLAUDE.md, and session-bootstrap.mjs.

## [v0.5.3] - 2026-03-31

Unified sync pipeline, structural consistency checks, and code maintainability cleanup. Inspired by Meta-Harness (Lee et al., 2026).

### Added
- **Unified `sync.mjs`:** Consolidated `sync-docs.mjs` (version sync) + `harness-eval.mjs` (structural checks) into single script — 31 checks covering versions, file references, hook configs, vault structure, and template consistency
- **`/harness-audit` command:** Scope 2 deep semantic consistency audit — LLM agent cross-references all protocol documents for contradictions and drift. Run at minor/major releases
- **Release checklist in RULES.md:** Scope 1 (every commit), Scope 2 (Y/X bumps), Scope 3 (quarterly)

### Changed
- **`/sync` command:** Now runs unified `sync.mjs` instead of `sync-docs.mjs` — one command for all consistency checks
- **SessionEnd hook order fixed:** `session-end.mjs` now runs before `skill-scan.mjs` in settings.json (was wrong order)
- **`session-end.mjs` paths:** `Guidelines/` → `Skill-Candidates/`, log file renamed from `vault-writer.log` → `session-end.log`
- **`session-bootstrap.mjs`:** Updated health check warnings to reference `session-end.mjs` instead of removed `vault-writer.mjs`

### Removed
- **`sync-docs.mjs`:** Merged into `sync.mjs`
- **`harness-eval.mjs`:** Merged into `sync.mjs`
- **`/harness-eval` command:** Checks absorbed by `/sync`
- **`vault-utils.mjs`:** Dead code — 12 exported functions, zero consumers since v0.5.0 consolidation
- **`vault-writer.mjs` hook:** Removed dead reference from settings.json SessionEnd hooks
- **Duplicate `session-bootstrap.mjs` hook:** Removed wrong-path duplicate from settings.json SessionStart hooks

## [v0.5.2] - 2026-03-31

Skill-scan domain scoping, skill architecture cleanup, and enhanced skill rewrites.

### Added
- **Domain-scoped skill-scan:** `skill-scan.mjs` reads `.agents/SYSTEM/domains.json` to filter clusters to project-relevant domains (58 → 15 clusters for this project)
- **`domains.json` config:** Projects define relevant domain tags; skill-scan uses forward-only TAG_EXPANSION to include related tags without pulling in unrelated stacks
- **Enhanced convex skill:** `convex-development-patterns` v2.0 in `~/.claude/skills/` — 11 source experiences, severity tags, dual checklists, debugging decision tree
- **Enhanced docker skill:** `docker-vps-deployment` v2.0 in `~/.claude/skills/` — 11 source experiences, severity tags, dual checklists, debugging decision tree
- **Setup migration:** `setup.mjs` auto-renames `Guidelines/` → `Skill-Candidates/` on upgrade, registers `skill-scan.mjs` hook

### Changed
- **Skill architecture:** Global skills live in `~/.claude/skills/`, project skills in `.agents/skills/`, scan output in `~/Obsidian Vault/Skill-Candidates/` (was `Guidelines/`)
- **skill-scan.mjs promoted:** Moved from `docs/temp/` draft to canonical `knowledge-mcp/scripts/`, installed copy synced
- **All references updated:** `/start`, `/skill-scan`, `setup.mjs`, project-template commands, memory files, gap-analysis doc

### Removed
- **`docs/temp/` directory:** 9 deprecated draft scripts cleaned up
- **`Guidelines/` folder:** Renamed to `Skill-Candidates/` for clarity; skills migrated to proper locations

## [v0.5.1] - 2026-03-30

Pipeline simplification, knowledge quality improvements, and auto-feedback.

### Added
- **Auto-feedback:** `session-end.mjs` automatically rates recalled knowledge entries helpful/neutral based on session summary domain overlap, feeding the maturity lifecycle
- **Obsidian dual-writes:** `/end` B1 and B3 now write research to `Research/` and experiences to `Experiences/` for Smart Connections semantic search
- **CONCEPTS line:** New field in experience format for plain English domain description, improving semantic search matching
- **Domain concept tags:** `kb_store` guidance and `/end` templates now include broader domain tags (e.g., `payments` alongside `stripe`)
- **Recalled entry tracking:** `/start` B3 writes recalled entry IDs to `.recalled-entries.json` for auto-feedback consumption
- **`--force` flag:** `--backfill-vectors` can now re-embed existing entries (not just new ones)

### Changed
- **Removed chunk indexing:** Deleted `auto-index.mjs` hook and all 6,928 chunks — tool metadata had zero retrieval value
- **Removed Stage 5 safety net:** `/end` is consistently used; auto-fill of `.agents/SESSIONS/` was unused complexity
- **Removed `chunks_fts` table:** No longer created or searched in `kb_recall`
- **SessionEnd hooks:** 4 → 3 (removed `auto-index.mjs`)

### Fixed
- **sqlite-vec upsert bug:** `INSERT OR REPLACE` doesn't work on `vec0` virtual tables — changed to `DELETE` + `INSERT` in both `db.ts` and `session-end.mjs`
- **sqlite-vec not loaded in scripts:** `session-end.mjs` now loads the `sqlite-vec` extension for `--backfill-vectors`
- **Knowledge quality:** Pruned 65 low-value entries (169 → 104), backfilled CONCEPTS lines and domain tags on all 104, re-embedded all vectors
- **Stale Obsidian Experiences/:** Deleted 38 auto-extracted files from removed pipeline

## [v0.5.0] - 2026-03-30

Hybrid search, summary vault writing, and pipeline consolidation.

### Added
- **Hybrid `kb_recall`:** FTS5 keyword + sqlite-vec semantic search merged via Reciprocal Rank Fusion — one tool call, both search modes
- **Enriched session summaries:** Written to `~/Obsidian Vault/Summaries/` (semantic search via Smart Connections) and SQLite (keyword search via `kb_recall`). Structured format: What/Why/How/Lessons with project tags and relative file paths
- **Research capture:** `/end` B1 explicitly prompts for external research (GitHub repos, YouTube, docs, NotebookLM) with standardized source tags
- **kb_feedback wiring:** `/end` B5 collects helpful/harmful/neutral ratings for recalled knowledge
- **Local embeddings:** `@yarflam/potion-base-32m` for 32-dimensional vectors — no API key needed
- **Consolidated SessionEnd pipeline:** `session-end.mjs` replaces 5 separate scripts (auto-index, vault-writer, vault-utils, skill-scan, vault-sync-projects)

### Changed
- `kb_recall` no longer searches raw chunks — only knowledge entries + summaries
- `kb_store` and `kb_store_summary` embed content on write for vector search
- `/end` summary format: structured What/Why/How/Lessons with project tags and relative file paths

### Removed
- Auto-extracted experiences (vault-writer regex patterns) — zero retrieval value confirmed via audit
- Obsidian mirroring (`mirrorToObsidian()`) — replaced by summary vault writing
- Topic linking (dependent on auto-extraction)
- `SESSIONS_DIR` constant — nothing writes to `~/Obsidian Vault/Sessions/`
- 10 deprecated scripts moved to `docs/temp/`

## [v0.4.0] - 2026-03-29

Outcome tracking and skill lifecycle — knowledge entries now have quality feedback and maturity stages.

### Added
- **Outcome tracking:** `kb_feedback` tool records helpful/harmful/neutral ratings for knowledge entries
- **Skill lifecycle:** Maturity stages (progenitor → proven → mature) with automatic promotion based on helpful ratings
- **Apoptosis:** Auto-prunes non-manual knowledge entries below 0.3 success rate after 5 ratings; manual entries flagged for approval
- **Maturity boost:** `kb_recall` ranks mature entries 1.5x higher, proven 1.2x; low-success entries penalized 0.5x
- **Session recall tracking:** `kb_recalled` tool lists which entries were recalled this session (for `/end` feedback collection)
- **Stats enhancement:** `kb_stats` shows maturity distribution; `kb_list` shows maturity badge and success rate

## [v0.3.3] - 2026-03-28

One-command setup for new users and framework developers.

### Added
- `scripts/setup.mjs` — automated setup: installs Knowledge MCP server, registers hooks, copies slash commands, scaffolds Obsidian vault
- `--dev` flag for framework developers (symlinks `src/` and `scripts/` instead of copying for live editing)
- Idempotent design — safe to re-run, skips anything already configured
- README Quick Start section with `node scripts/setup.mjs` as the recommended path

## [v0.3.2] - 2026-03-28

Fix kb_recall returning zero results, Windows path normalization, repo/installed sync.

### Fixed
- kb_recall returning zero results — `build/db.js` had stale `KB_DIR` pointing to `knowledge-mcp/` instead of `context-mode/` (source was correct but build wasn't recompiled)
- Windows path normalization — `normalizePath()` helper ensures `project_dir` uses forward slashes on read (`recall`) and write (`insertSession`, `insertKnowledge`), so Git Bash and PowerShell users get consistent behavior
- Repo/installed copy drift — synced 11 scripts (`scripts/*.mjs`) from installed copy into repo, synced v0.3.0 source updates (`indexer.ts`, `server.ts`, `tags.ts`) to installed copy, reconciled `package.json` identity (`knowledge-mcp` v0.3.0)
- Cleaned up stale `summarizer.*` build artifacts from installed copy
- Added `recall_count`/`last_recalled` migration and `weighted_rank` to `RecallResult` type in `db.ts`

### Added
- `scripts/sync-docs.mjs` — reads authoritative sources (package.json, CHANGELOG, SUMMARY), updates downstream files (README, PRD, knowledge-mcp/package.json). Supports `--check` mode for pre-commit validation.
- `/sync` slash command — runs sync-docs.mjs on demand
- `CLAUDE.md` — project-level instructions loaded at every session start (run /sync before commits, architecture overview, key rules)
- README.md rewritten as single source of setup instructions (clone → install → verify)

### Changed
- `.claude/rules/` added to project-template with path-specific rule files (frontend, backend, database, testing, agents)
- `.clinerules/` removed from project-template FRAMEWORK.md (replaced by `.claude/rules/`)

### Removed
- `getting-started/` directory (5 files) — stale, hard to maintain during rapid iteration; README is now the setup guide
- `how-it-works/` directory (6 files) — stale; architecture is documented in README and `.agents/SYSTEM/`
- `reference/` directory (4 files) — stale legacy docs
- `SELF-IMPROVING-AGENT.md` — redundant with README

## [v0.3.1] - 2026-03-28

Widen extraction patterns, unified experience format, SQLite-first data flow.

### Added
- Hybrid conversation scanning — planning, architecture, workaround, root cause, and explicit marker patterns supplement existing decision/gotcha extraction
- `writeExperienceToDb()` — SQLite-first writer that writes to knowledge.db then generates Obsidian `.md` mirrors
- `mirrorToObsidian()` — generates YAML-frontmattered `.md` files from knowledge.db entries
- Filter logging — every SKIP logged with reason (LENGTH, DEDUP, MAX_CAP, INTRA_SESSION)
- `/end` skill updated with unified format including `SOURCE: agent` and expanded TYPE options (planning, workaround)

### Changed
- Data flow reversed: knowledge.db is source of truth, Obsidian files are read-only mirrors (was: Obsidian first, mirror to DB)
- Unified experience format: structured text for FTS5 (`[EXPERIENCE]`, `TRIGGER:`, `ACTION:`, `CONTEXT:`, `OUTCOME:`), YAML frontmatter for Obsidian
- MIN_DECISION_LENGTH and MIN_GOTCHA_LENGTH lowered from 40 to 25 chars
- Log file moved from vault root (`~/Obsidian Vault/.vault-writer.log`) to `~/Obsidian Vault/Logs/vault-writer.log`

### Removed
- `mirrorToOpenBrain()` — replaced by `writeExperienceToDb()` + `mirrorToObsidian()`
- `parseFrontmatter()` — only used by removed mirror function
- Session markdown writes to Obsidian Sessions/ (already in knowledge.db via auto-index)

### Fixed
- `recall_count`/`last_recalled` removed from SUMMARY.md claims — columns were never added to schema
- `backfillMirror()` updated to use `mirrorToObsidian` instead of deleted `mirrorToOpenBrain`

## [v0.3.0] - 2026-03-27

Knowledge retrieval redesign: recency weighting, structured experiences, quality gate.

### Added
- Recency-weighted ranking in kb_recall — recent results rank higher via time-decay on BM25 scores (chunks/summaries decay at 0.02, curated knowledge at 0.005)
- File-touch tagging — experiences include basenames of modified files as tags for file-aware retrieval
- Session quality gate — vault-writer skips sessions below substance thresholds (logs detailed skip reason)
- Structured experience format — situation/action/outcome tuples replace prose templates (YAML frontmatter with subtype, files, outcome fields)
- Recall count tracking on knowledge entries (recall_count, last_recalled columns)
- Aging session helpers — `getAgingSessions()` and `pruneChunksForSummarizedSessions()` for future summarization pipeline

### Changed
- kb_recall uses unified recency-weighted sort instead of type-based ordering
- Vault-writer no longer writes session files to Obsidian vault (FTS5 is primary store)
- `/start` uses single kb_recall retrieval path with auto-broadening (Smart Connections removed from agent retrieval)
- Experience mirror includes structured metadata (subtype, files, outcome) in FTS5 tags

### Removed
- Smart Connections from `/start` federated search (kept for personal Obsidian browsing)
- Session markdown files no longer written to Obsidian Sessions/ directory

## [v0.2.2] - 2026-03-26

Session backfill, noise filtering, and automated health checks.

### Added
- `--backfill-sessions` flag on vault-writer — processes all .db files, skips already-captured ones
- Vault-writer health check in `session-bootstrap.mjs` — warns at session start if recent sessions aren't being captured to Obsidian
- System noise filter for user prompts and gotcha detection — skips `<system-reminder>`, `<command-name>`, etc.
- Empty session detection — skips vault write when session has no meaningful content
- Windows path normalization for `isDirectRun` CLI guard

## [v0.2.1] - 2026-03-26

Bug fixes from first external tester (Alice) running v0.2.0 on a fresh machine.

### Fixed
- Removed phantom `vault-sync-projects.mjs` import that crashed vault-writer on every SessionEnd
- Fixed `SESSIONS_DB_DIR` path — was pointing to `~/.claude/knowledge-mcp/sessions/` but context-mode writes to `~/.claude/context-mode/sessions/`
- Fixed `KNOWLEDGE_DB_PATH` — was pointing to `~/.claude/knowledge-mcp/knowledge.db` but the DB lives at `~/.claude/context-mode/knowledge.db`
- Added Stage 4 safety net (`updateAgentsSessionLog`) to repo copy — was only in installed copy, missing from distributed source
- Removed dead Stage 4 (project sync) that depended on the non-existent module

### Known Issues
- `better-sqlite3` may need `npm rebuild` if compiled against a different Node version — Node v24 also causes issues with the Smart Connections Obsidian plugin, so Node v22 LTS is recommended

## [v0.2.0] - 2026-03-25

Session lifecycle improvements: unified commands, automatic bootstrap, and session handoff.

### Added
- `session-bootstrap.mjs` — SessionStart hook that auto-detects project context, reads next-session handoff, checks Obsidian backup freshness, checks pending skill proposals
- Next-session handoff — `/end` writes `.agents/SESSIONS/next-session.md` with pick-up-here notes, gotchas, and open questions; `/start` and bootstrap hook read it
- Context budget check — `/start` keeps startup injection under 5% of context window
- Stale experience pruning — monthly flagging of experiences with `retrieval-count: 0` and `last-used` > 90 days
- Per-project CLAUDE.md generation — `/start` offers to generate a project CLAUDE.md from `.agents/` state if missing
- Federated search in retrieval — Knowledge MCP (FTS5) + Smart Connections (semantic) + CC Memory in parallel

### Changed
- Merged `/recall` into `/start` (Part B) — two commands instead of three (`/start` + `/end`)
- `/start` now uses smart routing (matches `/end` pattern) — full project startup if `.agents/` exists, lightweight recall otherwise
- `/end` Part B now complements hooks instead of duplicating them — focuses on what automation misses
- Updated `SELF-IMPROVING-AGENT.md` with session lifecycle, federated search, and commands table
- Updated `how-it-works/retrieval.md` with federated search, handoff, context budget, stale pruning
- Updated `how-it-works/accumulation.md` with hooks-complementary /end, next-session handoff, Knowledge MCP mirroring
- Updated `getting-started/04-hooks-and-commands.md` with SessionStart hook setup, removed /recall references

### Removed
- `/recall` command — merged into `/start` Part B

## [v0.1.0] - 2026-03-23

First public pre-release. The system is functional and tested but the API surface may change.

### Added
- `knowledge-mcp/` — bundled Knowledge MCP server (persistent FTS5 search over sessions and stored knowledge)
- `a2a-wrapper/` — lightweight agent wrapper for multi-agent coordination via A2A Hub
- `how-it-works/multi-agent.md` — architecture docs for the A2A wrapper

### Changed
- Renamed all "Open Brain" references to "Knowledge MCP" across docs, scripts, and commands
- Templated all user-specific content — repo is now cloneable by anyone
- Getting-started guide 03 now points to bundled `knowledge-mcp/` instead of external npm package
- Replaced hardcoded project domain tags with generic examples
- Replaced personal SEED_TOPICS in `vault-utils.mjs` with minimal generic set
- Aligned all DB paths to `~/.claude/knowledge-mcp/`
- Updated package.json name to `self-improving-agent`, version reset to 0.1.0

### Fixed
- Duplicate "Obsidian vault orphan audit" entry in `.agents/TASKS/INBOX.md`
- Added INBOX reconciliation step to `/start` command to catch future drift
- Missing files in step 04 verification checklist

---

*Prior versions (v2.0–v4.0) were internal development iterations.*

## [v4.0.0] - 2026-03-22 (internal)

### Removed
- Extracted A2A Intelligent Hub (hub/, wrapper/, reference/) to standalone project at `~/Projects/A2A-Hub/`
- Hub, wrapper, Convex schema, Telegram mirror, repo fixer, and all A2A research docs now live independently

## [v3.2.0] - 2026-03-21

### Fixed
- Step 04: Added missing `vault-writer.mjs` and `vault-utils.mjs` copy commands — previously told users to find vault-writer elsewhere even though it ships in `scripts/`
- Step 04: Added missing `/start` command to the copy instructions (was shipping 4 commands but only documenting 3)
- Step 03: Fixed inconsistent Smart Connections package names (was referencing two different npm packages)
- Step 03: Removed unnecessary global npm install step for Smart Connections

### Added
- `.gitignore` — prevents `node_modules/`, `.env`, logs, and OS files from being committed
- Script purpose table in Step 04 explaining what each hook file does

## [v3.1.0] - 2026-03-21

### Added
- Task decomposition for retrieval — /start and /recall now generate 2-3 methodology-focused sub-queries instead of a single broad query (inspired by XSkill)
- Experience rewriting — retrieved experiences are rewritten to be directly actionable for the current task before presenting (inspired by XSkill)

### Changed
- Updated /start command with 4-step retrieval flow: identify context → decompose → retrieve → rewrite
- Updated /recall command with decomposition and rewriting steps

## [v3.0.0] - 2026-03-21

### Changed
- Restructured repo as Self-Improving-Agent (consolidated with AI-First Framework)
- Reorganized docs into getting-started/, how-it-works/, reference/
- Moved AI-First Framework into project-template/
- Updated SELF-IMPROVING-AGENT.md links to new doc locations

### Added
- Beginner-friendly getting started guides (5 docs)
- Architecture documentation in how-it-works/ (5 docs)
- vault-writer.mjs and vault-skill-scan.mjs SessionEnd hooks
- vault-utils.mjs shared utilities
- /start global slash command
- project-template/ with complete .agents/ scaffold
- reference/advanced-config.md

## [v2.2.0] - 2026-03-21

### Added
- `getting-started/01-prerequisites.md` — install guide for all required tools
- `getting-started/02-clone-and-configure.md` — repo cloning and Obsidian vault setup
- `getting-started/03-mcp-servers.md` — Knowledge MCP and Smart Connections MCP installation
- `getting-started/04-hooks-and-commands.md` — SessionEnd hooks and slash command setup
- `getting-started/05-verify-installation.md` — guided first-session walkthrough

### Removed
- `getting-started/.gitkeep` — replaced by actual guide files

## [v2.1.0] - 2026-03-20

### Added
- `skill-scan.mjs` — SessionEnd hook that auto-detects experience clusters and proposes skills
- `/skill-scan` slash command for manual cluster scanning
- `/recall` slash command for global knowledge retrieval (renamed from `/start` to avoid project-level conflicts)
- `setup.md` — step-by-step installation guide
- `README.md` — project overview with architecture diagram
- `scripts/` directory with hook scripts
- `commands/` directory with slash commands
- Compound feedback loop: experiences accumulate → skill-scan detects patterns → proposals surface at next session start

### Changed
- Updated `SELF-IMPROVING-AGENT.md` with feedback loop documentation
- Updated `gaps.md` — skill distillation gap now fully automated

## [v2.0.0] - 2026-03-18

### Added
- Initial commit: learning system documentation
- `SELF-IMPROVING-AGENT.md` — protocol quick reference
- `current-protocols.md` — detailed retrieval and accumulation protocols
- `gaps.md` — known gaps and improvement backlog
- Obsidian-based architecture (migrated from SQLite-only approach)
