# Security Considerations

> This project is a documentation + scripts repo, not a web application. Security considerations focus on data sensitivity and script execution safety.

## Secrets & API Keys

- **No secrets stored in this repo**
- MCP server tokens configured via `claude mcp add` (stored in `~/.claude/settings.json`, not committed)
- Open Brain and Smart Connections MCP run locally — no external API keys required

## Vault Path Exposure

- Absolute paths (`~/Obsidian Vault v2/`, `~/.claude/`) appear in docs and code
- These are user-specific — contributors must update to their own paths
- No sensitive data in the paths themselves, but they reveal local directory structure

## Session Database Access

- The SessionEnd pipeline reads Claude Code's SQLite session databases (`.db` files) to self-generate a summary (`open-brain/src/pipelines/session-end/`)
- These contain full conversation history — **treat as sensitive**
- Never committed, never uploaded, read-only access only

## Script Execution Safety

- SessionEnd hooks run automatically with the user's shell permissions
- The hooks should never write outside `~/Obsidian Vault v2/` and `~/.claude/open-brain/`
- No network calls — all operations are local file I/O
- Scripts are ES modules — auditable plain JavaScript

## For Users Cloning This Repo

- Review hook scripts before installing them. The only registered hooks are `open-brain/build/cli-bootstrap.js` (SessionStart) and `open-brain/build/cli-session-end.js` (SessionEnd); both are compiled from `open-brain/src/`.
- The project template contains no secrets — safe to commit to public repos
- `.agents/` and `.claude/` directories created by the template are local state, not distributed
