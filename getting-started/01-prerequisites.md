# Step 1: Install the Prerequisites

**What you'll do:** Install the six tools that the self-improving agent system depends on.

Before you can use this system, you need a few pieces of software installed on your computer. This page walks you through each one. Every step includes a way to verify it worked, so you will never be left wondering if something went wrong.

---

## Claude Code CLI

Claude Code is the AI coding assistant that powers this entire system. It runs in your terminal and acts as your AI pair programmer. The self-improving agent is built on top of it.

1. Go to the official install page: [https://docs.anthropic.com/en/docs/claude-code/overview](https://docs.anthropic.com/en/docs/claude-code/overview)
2. Follow the instructions for your operating system.
3. Once installed, open a terminal and verify it works:

```bash
claude --version
```

You should see a version number printed, like `1.x.x`.

**If it does not work:**
- Make sure you completed the install instructions fully (some require restarting your terminal).
- On Windows, try closing and reopening your terminal.
- On macOS/Linux, make sure the install location is in your `PATH`. The install instructions will explain this.

---

## VS Code (or any code editor)

VS Code is a free code editor. You will use it to browse files and open a terminal. All examples in this guide use VS Code, but any editor with a built-in terminal works (Cursor, Windsurf, etc.).

1. Download VS Code from [https://code.visualstudio.com/](https://code.visualstudio.com/)
2. Run the installer and follow the prompts.
3. Open VS Code. If it launches, you are good to go.

**If it does not work:**
- Try downloading the installer again. Make sure you chose the correct version for your operating system (Windows, macOS, or Linux).

---

## Node.js

Node.js lets your computer run JavaScript outside of a web browser. The hook scripts that automatically capture your learning are written in JavaScript, so Node.js is required for them to run.

1. Go to [https://nodejs.org/](https://nodejs.org/) and download the **LTS** version (the one labeled "Recommended For Most Users").
2. Run the installer and accept all the defaults.
3. Open a terminal and verify it works:

```bash
node --version
```

You should see a version number like `v20.x.x` or higher.

**If it does not work:**
- Close your terminal and open a new one. Installers sometimes need a fresh terminal to take effect.
- On Windows, if `node` is still not found, restart your computer. The installer adds Node.js to your system PATH, but this sometimes requires a reboot.

---

## Git

Git is a version control tool. It keeps a history of every change you make to your code, so you can undo mistakes and collaborate with others. You will use it to download ("clone") this repository.

1. Download Git from [https://git-scm.com/downloads](https://git-scm.com/downloads)
2. Run the installer. The default settings are fine for beginners.
3. Open a terminal and verify it works:

```bash
git --version
```

You should see something like `git version 2.x.x`.

**If it does not work:**
- Close and reopen your terminal after installing.
- On Windows, the Git installer includes "Git Bash" -- you can use that as your terminal if the regular terminal does not recognize the `git` command.

---

## GitHub Account

GitHub is a website that stores code repositories online. You will use it to download this project's code and (optionally) store your own projects.

1. Go to [https://github.com/](https://github.com/) and click **Sign up**.
2. Follow the steps to create a free account.
3. No verification command needed -- just make sure you can log in at [https://github.com/](https://github.com/).

---

## Obsidian

Obsidian is a note-taking app that stores all your notes as plain text files on your computer. Unlike cloud-based note apps, everything lives in a folder on your hard drive. The self-improving agent uses Obsidian as its memory -- it writes session logs, experiences, and skills as markdown files in an Obsidian vault, and reads them back to get smarter over time.

1. Download Obsidian from [https://obsidian.md/](https://obsidian.md/)
2. Run the installer.
3. Open Obsidian. If it launches and shows a welcome screen, you are ready. (You will set up the vault in a later step.)

**If it does not work:**
- Try downloading the installer again from the official site.
- On macOS, you may need to allow the app in **System Preferences > Security & Privacy**.

---

## Checklist

Before moving on, confirm all of these pass:

| Tool | Verification Command | Expected Output |
|---|---|---|
| Claude Code | `claude --version` | A version number |
| Node.js | `node --version` | `v20.x.x` or higher |
| Git | `git --version` | `git version 2.x.x` |
| VS Code | Open the app | It launches |
| GitHub | Log in at github.com | You see your dashboard |
| Obsidian | Open the app | It launches |

---

**Next step -->** [Clone and Configure](02-clone-and-configure.md)
