# Multi-Agent Coordination: The A2A Wrapper

The self-improving agent makes a single Claude Code instance smarter over time. The A2A wrapper extends this to **multiple agents** that coordinate through a shared hub.

## Why Multi-Agent?

A single agent can only work on one thing at a time. With the A2A pattern, you can:

- Run agents on different machines, each with their own project context
- Delegate specialized tasks (e.g., "agent-1 handles frontend, agent-2 handles backend")
- Let agents ask each other questions through the hub
- Build always-on agents that poll for work continuously

Each wrapper agent still benefits from the self-improving memory system -- it has access to the same Obsidian vault, Knowledge MCP, and accumulated experiences.

## Architecture

```
                    +-------------+
                    |   A2A Hub   |  (central server)
                    | Task queue  |
                    | Agent cards |
                    +------+------+
                           |
              +------------+------------+
              |            |            |
        +-----+----+ +----+-----+ +----+-----+
        | Wrapper 1 | | Wrapper 2| | Wrapper 3|
        | (claude)  | | (claude) | | (claude) |
        +-----------+ +----------+ +----------+
        Machine A     Machine B     Machine C
```

The hub is a separate server (see [A2A-Hub](https://github.com/melvenac/A2A-Hub)). Each wrapper is a lightweight client that:

1. **Registers** with the hub on startup
2. **Polls** for assigned tasks every 5 seconds
3. **Executes** tasks locally via `claude --print`
4. **Reports** results back to the hub
5. **Heartbeats** every 30 seconds to stay active

## How It Works

### The Wrapper (~150 lines)

The wrapper is in `a2a-wrapper/` and has four source files:

| File | Purpose |
|---|---|
| `index.ts` | Entry point -- parses config, starts poller, handles SIGINT |
| `config.ts` | CLI argument parsing via `commander` |
| `poller.ts` | Registration, heartbeat, task polling, response submission |
| `claude.ts` | Runs `claude --print` and returns the output |

### Running a Wrapper

```bash
cd a2a-wrapper
npm install
npm run build
node dist/index.js --hub https://your-hub.example.com --key YOUR_API_KEY --name my-agent
```

Options:

| Flag | Required | Description |
|---|---|---|
| `--hub <url>` | Yes | URL of the A2A Hub server |
| `--key <apiKey>` | Yes | API key for authentication |
| `--name <name>` | Yes | Agent name (must be unique per hub) |
| `--poll-interval <ms>` | No | Polling interval in ms (default: 5000) |

### What Happens When a Task Arrives

1. The hub assigns a task to your agent based on availability
2. The wrapper receives the task message during its next poll
3. It runs `claude --print "<task message>"` locally (120s timeout)
4. Claude Code processes the request using your local context (vault, skills, project files)
5. The wrapper POSTs the response back to the hub
6. The hub delivers the response to whoever requested it

### Connection to the Learning System

The wrapper runs Claude Code locally, which means it has full access to:

- Your **Obsidian vault** (experiences, skills, topics)
- Your **Knowledge MCP** (FTS5 search via `kb_recall`)
- Your **project context** (`.agents/` files, CLAUDE.md)
- Your **SessionEnd hooks** (vault-writer captures what the wrapper does)

This means wrapper agents learn too. Tasks executed by a wrapper contribute to the same experience pool as your interactive sessions.

## When to Use This

- **You have a hub running** -- the wrapper needs an A2A Hub to connect to
- **You want always-on agents** -- run the wrapper as a background process
- **You need task delegation** -- let a hub distribute work across multiple machines
- **You're building agent workflows** -- chain agents together through the hub

If you're working solo on a single machine, you probably don't need this. The core self-improving agent (memory + retrieval + accumulation) works great on its own.
