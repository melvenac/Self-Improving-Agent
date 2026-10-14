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

- The hooks run automatically with the user's shell permissions
- The hooks should never write outside `~/Obsidian Vault v2/` and `~/.claude/open-brain/`, with two exceptions, both in the project: the SessionStart hook's `git fetch --prune origin` updates the remote-tracking refs and writes its fetch markers into the project's git common dir, and it claims (renames) and then deletes a leftover `.agents/SESSIONS/.missing-handoff.jsonl`
- Network, every call:
  - the SessionStart hook runs `git fetch --prune origin` in the project
  - `/sync` may run `npx gitnexus@<version>` (see Trust boundaries)
  - `ob_start` (the MCP tool and the CLI `start`) sends a GET carrying the seat's `X-Agent-Key` to `HUB_URL` (default `http://100.124.212.87:4000`) for the hub presence roster, when the seat map names partners for the seat and its key file exists under `A2A_KEY_DIR` (default `~/.a2a-hub/keys`)
  - the CLI `open-brain detach` runs `git fetch origin` unless given `--no-fetch`
  - `npm run test:heavy` (`cli-suite-run`) sends the same `X-Agent-Key` GET to `HUB_URL` (or `--hub`) for its census, and the harness's brief-plan gate posts the brief plan to `https://api.typesafe.ai` with `TYPESAFE_API_KEY`; both are developer tools, not hooks or MCP tools
- Scripts are ES modules — auditable plain JavaScript

## Trust boundaries

These are boundaries by design: they are written down here rather than changed.

- **`/sync` runs code from the repository it syncs.** Its GitNexus step runs `node .gitnexus/run.cjs` from the project root (a gitignored launcher GitNexus writes), and falls back to `npx gitnexus@<version>` when that file is missing, which reaches the network. A repository you run `/sync` in is code you run.
- **`ob_start` and `ob_sync` are shell-equivalent inside `project_root`.** Both take a model-chosen `project_root`. They write only create-only files inside an existing `.agents/SESSIONS/` (T-255), but they run git there, and `git status` honours `core.fsmonitor`, which runs a configured command. Treat these MCP tools as shell-equivalent inside `project_root`.
- **Environment overrides move reads, writes and where the agent key is sent.** `OPEN_BRAIN_VAULT_DIR`, `KNOWLEDGE_V2_DB`, `RECALL_TRIGGER_LOG`, `TRIGGER_POLICY_DIR`, `OPEN_BRAIN_ACTIVE_SESSION`, `OPEN_BRAIN_SCORE_HISTORY` and `OPEN_BRAIN_SHADOW_LOG` change where things are read and written. `HUB_URL` moves where the seat's `X-Agent-Key` is SENT, and `A2A_KEY_DIR` (and `SUITE_KEY_PATH` for `test:heavy`) which key file is read. `CLAUDE_PROJECT_DIR` picks which project the SessionEnd hook reads and writes for. `FLEET_JSON` and `SIA_USAGE_FILE` move what `ob_start` reads, and `LOCALAPPDATA` where `/sync` looks for Cursor. `HOME`/`USERPROFILE` move every default above. They are not a boundary: whoever sets the process environment can already run code (`NODE_OPTIONS`).

## For Users Cloning This Repo

- Review hook scripts before installing them. The only registered hooks are `open-brain/build/cli-bootstrap.js` (SessionStart), `open-brain/build/cli-recall-trigger.js` (PostToolUse) and `open-brain/build/cli-session-end.js` (SessionEnd); all are compiled from `open-brain/src/`.
- The project template contains no secrets — safe to commit to public repos
- `.agents/` and `.claude/` directories created by the template are local state, not distributed
