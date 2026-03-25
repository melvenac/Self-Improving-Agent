# Changelog

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
