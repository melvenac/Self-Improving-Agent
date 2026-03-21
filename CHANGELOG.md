# Changelog

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
- `getting-started/03-mcp-servers.md` — Open Brain and Smart Connections MCP installation
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
- Obsidian-based architecture (migrated from Open Brain-only approach)
