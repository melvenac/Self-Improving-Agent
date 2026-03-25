# Step 4: Configure Hooks and Commands

**What you'll do:** Set up automatic session capture (hooks) and install shortcut commands you can use inside Claude Code.

---

## What Are Hooks?

Hooks are scripts that run automatically at specific moments -- like when a session starts or ends. They are how the system captures what you learned and provides context without you having to do anything.

There are two types of hooks in this system:

- **SessionStart hooks** -- run when you open a new Claude Code session. The `session-bootstrap.mjs` hook detects your project, reads the last session's handoff notes, and checks system health.
- **SessionEnd hooks** -- run when a session closes. Three hooks fire in sequence: `auto-index.mjs` indexes data, `vault-writer.mjs` captures sessions and experiences to your Obsidian vault, and `skill-scan.mjs` detects experience patterns.

---

## What Are Slash Commands?

Slash commands are shortcuts you type in Claude Code to trigger workflows. They start with a `/` character. For example:

- `/start` -- full session startup: retrieves knowledge, reads project state, proposes what to work on
- `/end` -- captures lessons from the current session (supplements the automatic hooks)
- `/skill-scan` -- manually scans for experience clusters

---

## Install the Hook Scripts

First, create the directories where hook scripts live and copy the files there:

```bash
mkdir -p ~/.claude/knowledge-mcp/scripts
mkdir -p ~/.claude/scripts
```

Now copy the scripts from the repository. Make sure you are in the Self-Improving-Agent directory (where you cloned the repo), then run:

```bash
# SessionEnd hooks
cp scripts/vault-writer.mjs ~/.claude/knowledge-mcp/scripts/
cp scripts/vault-utils.mjs ~/.claude/knowledge-mcp/scripts/
cp scripts/skill-scan.mjs ~/.claude/knowledge-mcp/scripts/
cp scripts/package.json ~/.claude/knowledge-mcp/scripts/

# SessionStart hook
cp scripts/session-bootstrap.mjs ~/.claude/scripts/
```

This copies the files needed by the hooks:

| File | Hook Type | Purpose |
|---|---|---|
| `vault-writer.mjs` | SessionEnd | Captures session logs and experiences to your Obsidian vault |
| `vault-utils.mjs` | SessionEnd | Shared utilities used by vault-writer |
| `skill-scan.mjs` | SessionEnd | Detects experience clusters and proposes reusable skills |
| `package.json` | SessionEnd | Declares npm dependencies for the hook scripts |
| `session-bootstrap.mjs` | SessionStart | Detects project, reads handoff, checks backup, checks skill proposals |

Now install the dependencies that the SessionEnd hook scripts need:

```bash
cd ~/.claude/knowledge-mcp/scripts
npm install
```

This downloads the required packages (like `better-sqlite3`, which is needed to read session data). You only need to do this once.

---

## Configure the Hooks

Now you need to tell Claude Code to run these scripts at the right times. This is done by editing Claude Code's settings file.

The settings file is located at:

- **Windows:** `%USERPROFILE%\.claude\settings.json` (typically `C:\Users\YourName\.claude\settings.json`)
- **macOS/Linux:** `~/.claude/settings.json`

Open this file in a text editor (you can use VS Code). If the file does not exist yet, create it. Add the following content:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"HOME_PATH/.claude/scripts/session-bootstrap.mjs\""
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"HOME_PATH/.claude/knowledge-mcp/scripts/vault-writer.mjs\""
          }
        ]
      },
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"HOME_PATH/.claude/knowledge-mcp/scripts/skill-scan.mjs\""
          }
        ]
      }
    ]
  }
}
```

**Important:** Replace `HOME_PATH` with the actual path to your home directory:

- **Windows:** `C:/Users/YourName` (use forward slashes, not backslashes)
- **macOS:** `/Users/YourName`
- **Linux:** `/home/YourName`

**Hook order matters.** For SessionEnd: vault-writer must come first because it creates the experience files; skill-scan runs second and looks for patterns in those files.

If `settings.json` already has content, you need to merge the `hooks` section into the existing JSON. Make sure the result is valid JSON (no trailing commas, matching braces).

---

## Install the Slash Commands

Slash commands are markdown files that live in a specific folder. Claude Code reads them from `~/.claude/commands/`.

1. Create the commands directory if it does not exist:

```bash
mkdir -p ~/.claude/commands
```

2. Copy the command files from the repository (make sure you are in the Self-Improving-Agent directory):

```bash
cp commands/start.md ~/.claude/commands/
cp commands/end.md ~/.claude/commands/
cp commands/skill-scan.md ~/.claude/commands/
```

This gives you two main commands plus a utility:

| Command | What it does |
|---|---|
| `/start` | Full session start — retrieves experiences, reads project state, proposes objective. Smart routing: full project startup if `.agents/` exists, lightweight recall otherwise. |
| `/end` | Session close-out — captures lessons, writes handoff notes. Smart routing: full project close-out if `.agents/` exists, lightweight capture otherwise. |
| `/skill-scan` | Manually scans your experiences for clusters that could become reusable skills. |

---

## Verify Hooks Are Registered

To confirm Claude Code knows about your hooks:

1. Open the settings file (`~/.claude/settings.json`) in a text editor.
2. Check that the `hooks` section contains the SessionStart entry and two SessionEnd entries.
3. Make sure the file paths in the `command` fields point to real files. You can verify by running:

```bash
ls ~/.claude/scripts/
ls ~/.claude/knowledge-mcp/scripts/
```

You should see `session-bootstrap.mjs` in the first directory, and `vault-writer.mjs`, `vault-utils.mjs`, `skill-scan.mjs`, `package.json`, and a `node_modules/` folder in the second.

To confirm the slash commands are installed:

```bash
ls ~/.claude/commands/
```

You should see `start.md`, `end.md`, and `skill-scan.md`.

---

**Next step -->** [Verify Your Installation](05-verify-installation.md)
