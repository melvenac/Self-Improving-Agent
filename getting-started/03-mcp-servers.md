# Step 3: Set Up MCP Servers

**What you'll do:** Install two plugins that give Claude Code the ability to read from and write to your Obsidian vault.

---

## What Are MCP Servers?

MCP (Model Context Protocol) servers are plugins that give Claude Code extra abilities. Think of them as extensions -- they let Claude read from and write to external tools like your Obsidian vault.

Without these plugins, Claude Code is a smart assistant but it has no memory between sessions. With them, it can store what it learns and recall it later.

You will install two MCP servers:

1. **Knowledge MCP** -- gives Claude Code tools to store and retrieve knowledge (like `kb_store` and `kb_recall`). It is bundled in this repository under `knowledge-mcp/`.
2. **Smart Connections** -- enables semantic search across your vault, so Claude can find relevant past experiences even if the exact words do not match.

---

## Install Knowledge MCP

Knowledge MCP is the persistent memory layer. It gives Claude Code commands like `kb_store` (save a piece of knowledge) and `kb_recall` (search for relevant knowledge). It is included in this repository, so you build it locally.

1. Open a terminal and navigate to the knowledge-mcp directory inside the cloned repo:

```bash
cd Self-Improving-Agent/knowledge-mcp
npm install
npm run build
```

2. Register it as an MCP server in Claude Code. Use the **absolute path** to the built server file:

```bash
claude mcp add -s user knowledge-mcp -- node /ABSOLUTE/PATH/TO/Self-Improving-Agent/knowledge-mcp/build/server.js
```

> **Replace the path** with the actual location on your system:
> - **Windows:** `node C:/Users/YourName/Self-Improving-Agent/knowledge-mcp/build/server.js`
> - **macOS:** `node /Users/YourName/Self-Improving-Agent/knowledge-mcp/build/server.js`
> - **Linux:** `node /home/YourName/Self-Improving-Agent/knowledge-mcp/build/server.js`

**What this command does:** It tells Claude Code to register a new MCP server called `knowledge-mcp`. The `-s user` flag means it is installed for your user account (available in all projects, not just one).

---

## Install Smart Connections MCP

Smart Connections enables semantic search. Instead of only matching exact keywords, it understands meaning. For example, if you search for "database error handling," it can find an experience you wrote about "Convex mutation failure recovery" because the concepts are related.

Register it as an MCP server in Claude Code:

```bash
claude mcp add -s user smart-connections -- npx -y @yejianye/smart-connections-mcp
```

After registering, configure Smart Connections to know about your vault. You need to tell it where your Obsidian vault is located. See the [Smart Connections MCP repository](https://github.com/yejianye/smart-connections-mcp) for the latest configuration instructions.

---

## Configure Smart Connections to Index This Repo

Smart Connections can search more than just your vault. By also indexing the Self-Improving-Agent repository, you make the how-it-works documentation and other reference material searchable by Claude.

In the Smart Connections MCP configuration, add the path to your cloned repository as an additional directory to index. This is typically done in the MCP server's settings or config file. Refer to the [Smart Connections MCP docs](https://github.com/yejianye/smart-connections-mcp) for the exact syntax -- it varies by version, but you are adding a path like:

- **Windows:** `C:\Users\YourName\Self-Improving-Agent`
- **macOS/Linux:** `~/Self-Improving-Agent`

(Use whatever path you cloned the repo to in Step 2.)

---

## Verify Both MCP Servers Are Working

Now let's confirm everything is connected.

1. Open a terminal and start Claude Code:

```bash
claude
```

2. Once Claude Code is running, ask it to test the Knowledge MCP:

```
Can you use kb_list to show what's in the knowledge base?
```

You should see Claude Code call the `kb_list` tool and return a result. Since your knowledge base is new, it will likely say there are no entries yet. That is expected.

3. Now test Smart Connections. Ask Claude Code:

```
Can you use Smart Connections to search for "getting started"?
```

Claude Code should call the Smart Connections search tool. If your vault is empty, it may return few or no results -- that is fine. The important thing is that the tool call succeeds without an error.

**If Knowledge MCP does not work:**
- Make sure you ran `npm run build` in the `knowledge-mcp/` directory and it completed without errors.
- Make sure the path in your `claude mcp add` command points to the actual `build/server.js` file.
- Restart Claude Code (close it and run `claude` again).
- Check that Node.js is installed (`node --version` should print a version number).

**If Smart Connections does not work:**
- Verify the MCP server is registered: run `claude mcp list` and check that `smart-connections` appears.
- Restart Claude Code after adding the MCP server.
- Check the [Smart Connections MCP repo](https://github.com/yejianye/smart-connections-mcp) for troubleshooting steps.

---

**Next step -->** [Configure Hooks and Commands](04-hooks-and-commands.md)
