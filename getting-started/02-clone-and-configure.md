# Step 2: Clone and Configure

**What you'll do:** Download the project files to your computer, understand the folder structure, and set up your Obsidian vault.

---

## Open a Terminal

If you are using VS Code, the easiest way to get a terminal is:

1. Open VS Code.
2. Press **Ctrl + `** (that is the backtick key, usually located above the Tab key). This opens the built-in terminal at the bottom of the window.

You should see a blinking cursor where you can type commands.

If you are not using VS Code, you can open any terminal application:
- **Windows:** Search for "Terminal" or "PowerShell" in the Start menu.
- **macOS:** Open "Terminal" from Applications > Utilities.
- **Linux:** Open your distribution's terminal emulator.

---

## Clone the Repository

"Cloning" means downloading a copy of the project from GitHub to your computer. Run this command in your terminal:

```bash
git clone https://github.com/melvenac/Self-Improving-Agent.git
```

This creates a new folder called `Self-Improving-Agent` in whatever directory your terminal is currently in. Now move into that folder:

```bash
cd Self-Improving-Agent
```

To confirm you are in the right place, list the contents:

```bash
ls
```

You should see folders and files like `getting-started/`, `how-it-works/`, `scripts/`, and others.

---

## Directory Structure

Here is what each folder in the project is for:

| Folder | Purpose |
|---|---|
| `getting-started/` | The guides you are reading right now -- step-by-step setup instructions. |
| `how-it-works/` | Technical explanations of the system architecture and protocols. |
| `project-template/` | A starter template you can copy when beginning a new AI-assisted project. |
| `scripts/` | Hook scripts that run automatically to capture what you learn. |
| `commands/` | Slash command files that add shortcuts to Claude Code (like `/recall`). |
| `reference/` | Legacy setup docs and protocol snapshots -- kept for historical reference. |

---

## Create the Obsidian Vault

The Obsidian vault is a folder on your computer where the AI agent stores its memory. You need to create this folder structure before the system can start saving anything.

Run these commands in your terminal:

```bash
mkdir -p ~/Obsidian\ Vault/Sessions
mkdir -p ~/Obsidian\ Vault/Experiences
mkdir -p ~/Obsidian\ Vault/Topics
mkdir -p ~/Obsidian\ Vault/Guidelines
```

**What these folders are for:**

| Folder | What goes in it |
|---|---|
| `Sessions/` | A log file for each coding session -- what you worked on, what happened. |
| `Experiences/` | Individual lessons learned -- gotchas, patterns, decisions, fixes. |
| `Topics/` | Notes that group related experiences by subject (like "Convex" or "Stripe"). |
| `Guidelines/` | Reusable skills distilled from multiple experiences, plus the skill index. |

Now create the initial skill index file. This file will eventually list all the reusable skills the system discovers, but it starts empty:

```bash
cat > ~/Obsidian\ Vault/Guidelines/SKILL-INDEX.md << 'EOF'
# Skill Index

> Registry of distilled skills. Each skill is a reusable guide extracted from 3+ experiences.

(No skills yet -- they'll be proposed as experiences accumulate.)
EOF
```

---

## Open the Vault in Obsidian

1. Open Obsidian.
2. If this is your first time opening Obsidian, you will see a screen asking you to create or open a vault. Click **Open folder as vault**.
3. If Obsidian is already open with another vault, click the vault icon in the bottom-left corner, then click **Open folder as vault**.
4. Navigate to and select the `Obsidian Vault` folder in your home directory:
   - **Windows:** `C:\Users\YourName\Obsidian Vault`
   - **macOS/Linux:** `/home/YourName/Obsidian Vault` (or `/Users/YourName/Obsidian Vault` on macOS)
5. Click **Open**.

You should now see the four folders (Sessions, Experiences, Topics, Guidelines) in Obsidian's left sidebar. They will be empty except for `SKILL-INDEX.md` inside Guidelines.

---

**Next step -->** [Set Up MCP Servers](03-mcp-servers.md)
