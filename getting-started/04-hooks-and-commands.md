# Step 4: Configure Hooks and Commands

**What you'll do:** Set up automatic session capture (hooks) and install shortcut commands you can use inside Claude Code.

---

## What Are Hooks?

Hooks are scripts that run automatically at specific moments -- like after every coding session ends. They are how the system captures what you learned without you having to do anything.

For example, when you finish a coding session, a hook called `vault-writer.mjs` automatically creates a session log in your Obsidian vault. Another hook called `skill-scan.mjs` checks whether your accumulated experiences form patterns worth turning into reusable skills. You never have to remember to do this manually.

---

## What Are Slash Commands?

Slash commands are shortcuts you type in Claude Code to trigger workflows. They start with a `/` character. For example:

- `/recall` -- pulls up relevant past experiences at the start of a session
- `/skill-scan` -- manually scans for experience clusters
- `/end` -- manually captures lessons from the current session (supplements the automatic hook)

---

## Install the Hook Scripts

First, create the directory where hook scripts live and copy the files there:

```bash
mkdir -p ~/.claude/knowledge-mcp/scripts
```

Now copy the scripts from the repository. Make sure you are in the Self-Improving-Agent directory (where you cloned the repo), then run:

```bash
cp scripts/vault-writer.mjs ~/.claude/knowledge-mcp/scripts/
cp scripts/vault-utils.mjs ~/.claude/knowledge-mcp/scripts/
cp scripts/skill-scan.mjs ~/.claude/knowledge-mcp/scripts/
cp scripts/package.json ~/.claude/knowledge-mcp/scripts/
```

This copies all four files needed by the SessionEnd hooks:

| File | Purpose |
|---|---|
| `vault-writer.mjs` | Captures session logs and experiences to your Obsidian vault |
| `vault-utils.mjs` | Shared utilities used by vault-writer |
| `skill-scan.mjs` | Detects experience clusters and proposes reusable skills |
| `package.json` | Declares npm dependencies for the hook scripts |

Now install the dependencies that the hook scripts need:

```bash
cd ~/.claude/knowledge-mcp/scripts
npm install
```

This downloads the required packages (like `better-sqlite3`, which is needed to read session data). You only need to do this once.

---

## Configure the SessionEnd Hooks

Now you need to tell Claude Code to actually run these scripts when a session ends. This is done by editing Claude Code's settings file.

The settings file is located at:

- **Windows:** `%USERPROFILE%\.claude\settings.json` (typically `C:\Users\YourName\.claude\settings.json`)
- **macOS/Linux:** `~/.claude/settings.json`

Open this file in a text editor (you can use VS Code). If the file does not exist yet, create it. Add the following content:

```json
{
  "hooks": {
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

**Hook order matters.** The vault-writer hook must come first because it creates the experience files. The skill-scan hook runs second and looks for patterns in those files.

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
cp commands/recall.md ~/.claude/commands/
cp commands/skill-scan.md ~/.claude/commands/
cp commands/end.md ~/.claude/commands/
```

This gives you four commands:

| Command | What it does |
|---|---|
| `/start` | Full session start protocol -- retrieves experiences, checks skills, sets context. |
| `/recall` | Searches your vault for experiences relevant to your current project. Use this at the start of a session. |
| `/skill-scan` | Scans your experiences for clusters that could become reusable skills. |
| `/end` | Manually captures lessons from the current session. Supplements the automatic SessionEnd hook. |

---

## Verify Hooks Are Registered

To confirm Claude Code knows about your hooks:

1. Open the settings file (`~/.claude/settings.json`) in a text editor.
2. Check that the `hooks` section exists and contains the two `SessionEnd` entries.
3. Make sure the file paths in the `command` fields point to real files. You can verify by running:

```bash
ls ~/.claude/knowledge-mcp/scripts/
```

You should see `skill-scan.mjs`, `package.json`, and a `node_modules/` folder.

To confirm the slash commands are installed:

```bash
ls ~/.claude/commands/
```

You should see `start.md`, `recall.md`, `skill-scan.md`, and `end.md`.

---

**Next step -->** [Verify Your Installation](05-verify-installation.md)
