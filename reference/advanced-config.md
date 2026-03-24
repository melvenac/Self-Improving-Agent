# Advanced Configuration

This document covers customization and troubleshooting for the Self-Improving Agent system.

## Customizing SessionEnd Hooks

The `vault-writer.mjs` script runs automatically after each Claude Code session. It is registered as a SessionEnd hook in the Claude Code settings.

### Hook registration

In `~/.claude/settings.json`, hooks are configured under the `hooks` key:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "command": "node /path/to/scripts/vault-writer.mjs",
        "timeout": 30000
      }
    ]
  }
}
```

### Adding or removing hooks

To add a new SessionEnd hook, append another entry to the array:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "command": "node /path/to/scripts/vault-writer.mjs",
        "timeout": 30000
      },
      {
        "command": "node /path/to/your-custom-hook.mjs",
        "timeout": 15000
      }
    ]
  }
}
```

To disable a hook, remove its entry from the array. Hooks run in order and are independent of each other.

### Hook environment

Hooks receive the session context via environment variables and the context-mode session database. The `vault-writer.mjs` script reads from `~/.claude/context-mode/sessions/` to find the most recent `.db` file.

## Tuning Retrieval

### Context cap

The default retrieval cap is **3 experiences + 2 skills** per session start. To change this, edit the Retrieval Protocol section in `~/.claude/CLAUDE.md`:

```
Surface at most **5 experiences** and **3 skills** as non-prescriptive context.
```

Increasing the cap gives more context but adds tokens to every session. Keep it at 3+2 unless you find yourself frequently missing relevant knowledge.

### Domain tags

Domain tags control what gets retrieved for each project. Edit the Project Domain Tags table in `~/.claude/CLAUDE.md`:

```markdown
| Project | Domain Tags |
|---|---|
| My New Project | `react, graphql, testing` |
```

Tags should be specific enough to be useful but broad enough to match related experiences. Use the same tags consistently across experiences and projects.

### Retrieval sources

The system retrieves from two sources:
1. **Knowledge MCP** (`kb_recall`) — FTS5 search over stored experiences
2. **Skill Index** (`~/Obsidian Vault/Guidelines/SKILL-INDEX.md`) — curated pattern docs

If Knowledge MCP is unavailable, retrieval falls back to reading experience files directly from `~/Obsidian Vault/Experiences/`.

## Adding New Slash Commands

### Location

- **Global commands** go in `~/.claude/commands/` — available in every project
- **Project commands** go in `{project}/.claude/commands/` — only available in that project

### Format

Commands are markdown files with a specific structure:

```markdown
# /command-name — Short Description

> **One-line summary.** Additional context about when to use this command.

## What to do

1. Step one
2. Step two
3. Step three

## Rules

- Constraints and guidelines
- Keep it focused
```

The filename becomes the command name: `start.md` creates the `/start` command.

### Tips

- Keep commands focused on a single workflow
- Use imperative voice ("Read the file", "Run the query")
- Include a Rules section for guardrails
- Reference other commands with `/command-name` syntax

## Configuring Smart Connections Indexing

Smart Connections indexes your Obsidian vault for semantic search. To configure which paths are indexed:

1. Open Obsidian Settings > Smart Connections
2. Under **Excluded paths**, add any directories you want to skip (e.g., `Templates/`, `.obsidian/`)
3. Under **Include paths**, ensure these are indexed:
   - `Experiences/` — the primary knowledge store
   - `Sessions/` — session logs for context
   - `Topics/` — topic hub pages
   - `Guidelines/` — skills and the skill index

After changing paths, click **Force Refresh** to rebuild the index.

### MCP access

Smart Connections exposes an MCP server for Claude Code to query. Ensure the MCP server config in `~/.claude/mcp_servers.json` points to the correct vault:

```json
{
  "smart-connections": {
    "command": "npx",
    "args": ["-y", "@anthropic/smart-connections-mcp"],
    "env": {
      "OBSIDIAN_VAULT": "C:\\Users\\you\\Obsidian Vault"
    }
  }
}
```

## Troubleshooting

### Hooks not firing

**Symptom:** Sessions end but no new files appear in `~/Obsidian Vault/Sessions/`.

**Checks:**
1. Verify the hook is registered: check `~/.claude/settings.json` for the `SessionEnd` entry
2. Check the vault writer log: `~/Obsidian Vault/.vault-writer.log` — errors are appended here
3. Check the error log note: `~/Obsidian Vault/Logs/vault-writer-errors.md` — fatal errors are written here as an Obsidian note
4. Verify `better-sqlite3` is installed: run `npm ls better-sqlite3` in the scripts directory
5. Verify the session database exists: check `~/.claude/context-mode/sessions/` for `.db` files

### MCP servers not responding

**Symptom:** `kb_recall` or `kb_store` commands fail or time out.

**Checks:**
1. Verify the MCP server is configured in `~/.claude/mcp_servers.json`
2. Restart Claude Code — MCP servers are started with the session
3. Check that the required npm packages are installed globally or in the MCP server's directory
4. Test the server directly: run the command from the MCP config manually in a terminal

### Experiences not being captured

**Symptom:** Sessions produce logs but no experience files in `~/Obsidian Vault/Experiences/`.

**Causes:**
1. **Quality threshold:** Decisions shorter than 40 characters and gotchas shorter than 40 characters are filtered out. The session may not have produced substantial enough content.
2. **Dedup filtering:** If `smart-cli` finds an existing experience with >80% similarity, the new one is skipped. Check the vault writer log for "DEDUP SKIP" entries.
3. **Cap reached:** Only 3 experiences are extracted per session. If 3 decisions were captured, gotchas are skipped.
4. **No decision events:** The context-mode database may not have recorded decision-category events for the session.

### Skill scan finds no candidates

**Symptom:** Running `/skill-scan` or `vault-skill-scan.mjs` reports zero clusters.

**Causes:**
1. Fewer than 3 experiences share any single tag — accumulate more experiences first
2. Tags are too specific — consolidate similar tags (e.g., use `convex` instead of `convex-queries` and `convex-mutations`)
3. Noise tags are being filtered — check the `noiseTags` set in `vault-skill-scan.mjs`
