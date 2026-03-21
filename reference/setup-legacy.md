# Setup Guide

Step-by-step instructions to set up the self-improving agent learning system.

## Prerequisites

- [Claude Code](https://claude.ai/code) installed and working
- [Node.js](https://nodejs.org/) 18+ (for hook scripts)
- [Obsidian](https://obsidian.md/) installed (free)
- Git + GitHub CLI (`gh`) for version control

## 1. Install Open Brain MCP

Open Brain is the persistent memory layer. Install it as a Claude Code MCP server:

```bash
claude mcp add -s user open-brain-knowledge -- npx -y open-brain-knowledge
```

This gives your agent `kb_store`, `kb_recall`, `kb_list`, and other memory tools.

Repo: [github.com/melvenac/open-brain-knowledge](https://github.com/melvenac/open-brain-knowledge)

## 2. Create the Obsidian Vault

Create a vault at `~/Obsidian Vault/` (or adjust paths in the scripts):

```bash
mkdir -p ~/Obsidian\ Vault/{Experiences,Sessions,Topics,Projects,Guidelines,Logs}
```

Create the initial skill index:

```bash
cat > ~/Obsidian\ Vault/Guidelines/SKILL-INDEX.md << 'EOF'
# Skill Index

> Registry of distilled skills. Each skill is a reusable guide extracted from 3+ experiences.

(No skills yet — they'll be proposed as experiences accumulate.)
EOF
```

## 3. Install Smart Connections MCP (Optional)

Enables semantic search across your vault — much better retrieval than keyword matching:

```bash
npm install -g @anthropic-ai/smart-connections-mcp
claude mcp add -s user smart-connections -- npx -y @yejianye/smart-connections-mcp
```

Configure it to point at your vault. See the [Smart Connections MCP repo](https://github.com/yejianye/smart-connections-mcp) for details.

## 4. Copy the Hook Scripts

The hook scripts run automatically at session end. Copy them to your Claude Code config:

```bash
# Create the scripts directory
mkdir -p ~/.claude/knowledge-mcp/scripts

# Copy the skill-scan hook and package.json
cp scripts/skill-scan.mjs ~/.claude/knowledge-mcp/scripts/
cp scripts/package.json ~/.claude/knowledge-mcp/scripts/

# Install dependencies (needed by vault-writer and auto-index hooks)
cd ~/.claude/knowledge-mcp/scripts
npm install
```

The `npm install` step is required — `vault-writer.mjs` and `auto-index.mjs` depend on `better-sqlite3` for reading session databases. `skill-scan.mjs` only uses Node.js built-ins, but the other hooks in the pipeline need this dependency.

For vault-writer.mjs (the session capture hook), see the [Open Brain repo](https://github.com/melvenac/open-brain-knowledge) — it's bundled there.

## 5. Configure SessionEnd Hooks

Add the hooks to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"PATH_TO/.claude/knowledge-mcp/scripts/vault-writer.mjs\""
          }
        ]
      },
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"PATH_TO/.claude/knowledge-mcp/scripts/skill-scan.mjs\""
          }
        ]
      }
    ]
  }
}
```

Replace `PATH_TO` with your actual home directory path.

**Hook order matters:** vault-writer runs first (creates experiences), then skill-scan runs (detects clusters).

## 6. Install Slash Commands

Copy the commands to your global Claude Code commands directory:

```bash
mkdir -p ~/.claude/commands
cp commands/recall.md ~/.claude/commands/
cp commands/skill-scan.md ~/.claude/commands/
cp commands/end.md ~/.claude/commands/
```

This gives you:
- `/recall` — retrieve relevant knowledge at session start
- `/skill-scan` — manually scan for experience clusters
- `/end` — manually capture lessons from the current session

## 7. Configure Global CLAUDE.md (Optional)

Add the retrieval protocol to `~/.claude/CLAUDE.md` so it runs on every session:

```markdown
## Self-Improving Agent Protocol

### Retrieval Protocol (run at session start, via /recall)

1. Search vault for experiences: `kb_recall` with project name + domain tags
2. Check skill index: Read `~/Obsidian Vault/Guidelines/SKILL-INDEX.md`
3. Surface at most 3 experiences and 2 skills as non-prescriptive context
4. Track retrieval: update `last-used` and `retrieval-count` in frontmatter

### Accumulation Protocol (AUTOMATIC via SessionEnd hooks)

Session capture is automatic — vault-writer + skill-scan run after every session.
```

## 8. Verify It Works

1. Start a new Claude Code session
2. Run `/recall` — should greet you and search Open Brain
3. Do some work, hit a gotcha or make a decision
4. End the session — check `~/Obsidian Vault/Sessions/` for a new log
5. Check `~/Obsidian Vault/Experiences/` for auto-extracted lessons
6. Check `~/Obsidian Vault/Guidelines/SKILL-CANDIDATES.md` for updated clusters

## Optional: YouTube Transcript MCP

For adding video content to your knowledge base:

```bash
claude mcp add -s user youtube-transcript -- npx -y @kimtaeyoon83/mcp-server-youtube-transcript
```

## Troubleshooting

- **Hooks not firing:** Check `~/.claude/settings.json` syntax. Restart Claude Code after editing.
- **vault-writer errors:** Check `~/Obsidian Vault/.vault-writer.log`
- **skill-scan not finding experiences:** Verify `~/Obsidian Vault/Experiences/` has `.md` files with YAML frontmatter containing `tags: [...]`
- **Smart Connections not working:** Run `mcp__smart-connections__validate()` to check vault connection
