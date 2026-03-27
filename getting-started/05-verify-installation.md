# Step 5: Verify Your Installation

**What you'll do:** Run through a guided first session to confirm everything is working end to end.

You have installed all the tools, set up the vault, configured hooks, and installed commands. Now it is time to test the full system by doing a short session and checking that it captures your work automatically.

---

## Start Claude Code

1. Open a terminal.
2. Navigate to any project directory. If you do not have one, you can use the Self-Improving-Agent directory:

```bash
cd ~/Self-Improving-Agent
```

3. Start Claude Code:

```bash
claude
```

You should see Claude Code start up and wait for your input.

---

## Test the Start Command

Type the following in Claude Code:

```
/start
```

Since your vault is brand new and empty, you should see something like "no relevant experiences found" or a message indicating the knowledge base has no content yet. This is correct. It means the `/start` command is working -- it successfully searched the knowledge base and found nothing (because there is nothing to find yet).

**If `/start` is not recognized:**
- Make sure you copied the command files to `~/.claude/commands/` in Step 4.
- Restart Claude Code (close it and run `claude` again).

---

## Do a Small Task

Ask Claude Code to do something simple so there is session activity to capture. Type:

```
Create a simple hello.py file that prints "Hello, world!"
```

Claude Code should create a file called `hello.py` with a print statement. This gives the system something to record in the session log.

---

## End the Session

You can end the session in one of these ways:

- Type `/end` to manually trigger a session capture, then close Claude Code.
- Or simply close the terminal window or press **Ctrl+C** to exit. The `SessionEnd` hook will fire automatically.

Wait a few seconds after closing for the hooks to finish running.

---

## Check the Vault

Now open Obsidian and look at your vault. You should see new files:

### Check Sessions

Sessions are stored in the Knowledge MCP database, not as files in Obsidian. To verify a session was captured, you can run `kb_recall` with a query matching what you worked on, or check the vault-writer log:

```bash
cat "~/Obsidian Vault/.vault-writer.log"
```

You should see an entry showing the session was processed.

### Check Experiences

1. Open the `Experiences/` folder.
2. If the session was substantial enough, you may see one or more experience files here. Each one captures a specific lesson, decision, or gotcha.
3. If this folder is empty after your first short session, that is normal. The system only creates experience files when there is something meaningful to record. Longer, more complex sessions will generate more experiences.

### Check Guidelines

1. Open the `Guidelines/` folder.
2. You should still see `SKILL-INDEX.md`. It will remain mostly empty until you accumulate enough experiences for the system to propose a skill (the threshold is 3 similar experiences).

---

## Troubleshooting

**Session log did not appear:**
- Check that the hooks are configured in `~/.claude/settings.json` (see Step 4).
- Check for error logs at `~/Obsidian Vault/.vault-writer.log`.
- Make sure `vault-writer.mjs` exists in the path specified in your settings.

**`/start` command not found:**
- Verify the files exist: `ls ~/.claude/commands/` should show `start.md`, `skill-scan.md`, and `end.md`.
- Restart Claude Code.

**MCP server errors:**
- Run `claude mcp list` to see registered servers.
- Make sure both `knowledge-mcp` and `smart-connections` appear in the list.
- If one is missing, re-run the `claude mcp add` command from Step 3.

---

## You Are Done

Congratulations. Your self-improving agent is set up and running. From now on, every coding session automatically captures what you learn, and every new session starts by recalling relevant past experiences. The system gets smarter the more you use it.

---

## Where to Go Next

To understand how the system works under the hood -- how experiences are stored, how retrieval works, and how skills get distilled -- read the **[Architecture Guide](../how-it-works/overview.md)**.

To start a new project with an AI-ready structure that integrates with this system, see the **[Project Template](../project-template/README.md)**.

To run multiple coordinated agents across machines, see the **[A2A Wrapper](../how-it-works/multi-agent.md)**. This is optional -- the core learning system works great on its own. The wrapper adds multi-agent coordination when you need it.
