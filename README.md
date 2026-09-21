# Self-Improving Agent

*A memory protocol that enables AI coding agents to learn across sessions.*

**Latest: v0.43.0** · [Changelog](CHANGELOG.md)

---

## What is this?

You install this system once and get persistent AI memory across all your projects. Each coding session makes the agent smarter — it accumulates lessons, detects patterns, and proposes reusable skills automatically. Over time, the agent stops repeating mistakes and surfaces relevant knowledge exactly when you need it.

This repo includes the memory protocol, automation hooks, slash commands, and a project template for structuring new codebases.

## How it works

Every session follows a three-phase feedback loop:

```
    +---------------------------------------------+
    |                                              |
    v                                              |
RETRIEVAL (session start)                          |
  Surface relevant experiences                     |
  and skills from memory                           |
    |                                              |
    v                                              |
DEVELOPMENT (normal coding)                        |
  Work as usual -- the agent                       |
  has context from past sessions                   |
    |                                              |
    v                                              |
ACCUMULATION (session end)                         |
  Auto-capture lessons learned                     |
  Detect emerging patterns ---------> feeds back --+
```

Knowledge is organized in four tiers:

| Tier | Location | Purpose |
|---|---|---|
| **Core** | `CLAUDE.md` (always loaded) | Identity, global rules, bootstrap instructions |
| **Hot** | Obsidian Vault v2 `Experiences/`, `Skills/` | Cross-project lessons and reusable skills; Smart Connections semantic search |
| **Warm** | Obsidian Vault `Summaries/`, `Archive/` | Session summaries, older experiences for broader recall |
| **Cold** | SQLite `knowledge-v2.db` `chunks` table | Ephemeral session chunks; metadata index only (no content) |
| **Project** | `.agents/` folder in each repo | Project-specific context (PRD, tasks, session logs) |

## Prerequisites

- **Claude Code CLI** — AI coding agent ([claude.ai/code](https://claude.ai/code))
- **Node.js v22 LTS** — runs the automation hooks (v24 breaks Smart Connections)
- **Git + GitHub** — version control
- **Obsidian** — desktop app for browsing your knowledge vault
- **VS Code** (or any editor)

## Getting Started

### Quick Start (recommended)

```bash
git clone https://github.com/melvenac/Self-Improving-Agent.git
cd Self-Improving-Agent
node scripts/setup.mjs
```

This installs the open-brain MCP server, registers hooks, copies slash commands, and scaffolds the Obsidian vault. Restart Claude Code after running.

For framework developers (symlinks source for live editing):
```bash
node scripts/setup.mjs --dev
```

### Manual Setup

<details>
<summary>Step-by-step instructions (if you prefer manual control)</summary>

### 1. Clone and install

```bash
git clone https://github.com/melvenac/Self-Improving-Agent.git
cd Self-Improving-Agent
```

### 2. Set up open-brain MCP server

The open-brain MCP server provides persistent memory and project state (14 tools: ob_recall, ob_recalled, ob_store, ob_store_chunk, ob_feedback, ob_forget, ob_list, ob_stats, ob_set_session, ob_start, ob_state, ob_end, ob_sync, ob_score). Project state lives in `.agents/state.json`, created once by `open-brain state import`, read with `open-brain state show` and written only through `ob_state`; INBOX.md, task.md, next-session.md and SUMMARY.md's marked region are rendered views of it. `ob_start` and `ob_sync` resolve the project root from any subdirectory.

```bash
cd open-brain
npm install
npm run build
```

Register it in your Claude Code MCP settings (`~/.claude/.mcp.json` or `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "open-brain": {
      "command": "node",
      "args": ["<path-to-repo>/open-brain/build/server.js"]
    }
  }
}
```

### 3. Set up automation hooks

The session bootstrap and session-end hooks are compiled TypeScript under `open-brain/build/`. After installing dependencies and building (`cd open-brain && npm install && npm run build`), register the hooks in `~/.claude/settings.json`:

```jsonc
{
  "hooks": {
    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "node \"/abs/path/to/open-brain/build/cli-bootstrap.js\"" }] }],
    "SessionEnd":   [{ "matcher": "", "hooks": [{ "type": "command", "command": "node \"/abs/path/to/open-brain/build/cli-session-end.js\"" }] }],
    "PostToolUse":  [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "node \"/abs/path/to/open-brain/build/cli-recall-trigger.js\"", "timeout": 10 }] }]
  }
}
```

**On the recall trigger's registration, three things that are not obvious.**

- **`PostToolUse`, not `PreToolUse`, and the choice is load-bearing.** Both
  events accept `hookSpecificOutput.additionalContext` and both insert it next
  to the tool result. They differ in whether blocking is possible: on
  `PreToolUse` exit 2 blocks the tool call, and `permissionDecision` and
  `updatedInput` are honoured; on `PostToolUse` none of them are. The trigger
  must never block, and on this event that is structural rather than a promise
  the code keeps.
- **`timeout` is the host's bound; `deadline_ms` in the policy is the
  trigger's own.** They do different jobs. The host's `timeout` bounds how long
  the process may RUN. `deadline_ms` decides whether a result that came back
  late may still be EMITTED — a reminder that arrives after the seat has read
  the tool result is attached to the wrong moment. Set `timeout` comfortably
  above `deadline_ms`.
- **It runs the build it is registered against.** Like the other two hooks, the
  path is absolute, so a stale checkout serves a stale trigger (`G-030`,
  `G-034`). `T-154` owns fixing that for all three.

Every failure is silent to the model and loud to the log: the hook exits 0,
writes nothing to stdout or stderr, and appends one line to
`recall-trigger.log` beside the knowledge database.

Session-end automation (session summary, auto-feedback, invocation logging, shadow recall, topics) is handled by the open-brain MCP server's `ob_end` tool — called by the `/end` slash command. No separate hook scripts needed.

### 4. Set up slash commands

The setup script (`scripts/setup.mjs`) automatically installs global slash commands to **Claude Code** (`~/.claude/commands/`) and **Cursor** (`~/.cursor/commands/`), registers open-brain MCP in both IDEs, and wires sessionStart hooks. Re-run to update after pulling:

```bash
node scripts/setup.mjs
```

Restart **Claude Code and Cursor** after setup.

### 5. Set up Obsidian vault

Create the vault directory structure:

```bash
mkdir -p ~/Obsidian\ Vault/{Experiences,Sessions,Skill-Candidates,Topics}
```

Open this folder in Obsidian as a vault. Install the **Smart Connections** plugin for semantic search (optional but recommended).

### 6. Verify installation

Start a Claude Code session and run `/start`. You should see:
- Session bootstrap hook fires (project detection, handoff check)
- Knowledge recall attempts (may be empty on first run)
- Session log created

</details>

## Commands

| Command | When | What it does |
|---|---|---|
| `/start` | Session start | Reads project state, recalls relevant knowledge, registers session UUID, creates session log |
| `/end` | Session end | Captures lessons, updates project state, writes handoff notes |
| `/checkpoint` | Mid-session | Captures phase-level work context before `/compact`, enabling multi-phase sessions |
| `/sync` | Before commits | Validates version consistency, structural integrity, and installed copy drift (26 checks) |

## Automation hooks

| Hook | Trigger | What it does |
|---|---|---|
| `open-brain/build/cli-bootstrap.js` | SessionStart | Auto-detects project, emits `SESSION_UUID`, runs health checks, surfaces skill proposals |
| `open-brain/build/cli-recall-trigger.js` | PostToolUse (`Bash`) | Queries the knowledge store at the moment of the act and injects a matching entry's `ACTION` next to the tool result. Deterministic and local — the query is derived from the command by code, never by asking the model. **Precision only: it never broadens, and below the relevance floor it says nothing at all** rather than surfacing the best of a bad set. Every invocation is recorded in `trigger_fires` as `not-asked`, `silent` or `injected`, so "nothing recalled" can finally be told apart from "nothing asked" |
| `open-brain/build/cli-session-end.js` | SessionEnd | 5-stage pipeline: session summary, auto-feedback, invocation logging, shadow recall, topics — numbered 1–4 and 7 in `index-v2.ts`, because stages 5 and 6 were cut in Loop 10. **Auto-feedback rates only entries the agent judged explicitly.** The tag-substring fallback beside it was cut in Loop 12 (R-010): it had never written a row, and what it fed — `success_rate` and the maturity lifecycle — was cut in Loop 10. An entry the agent did not judge is now skipped rather than rated, because a fallback neutral is indistinguishable from a considered “retrieved and not used” |

## Knowledge kinds — `state` and `event`

Entries carry a **`state` or `event`** kind. A *state* is one current value that
changes — a path, a version, a port — and wants replacing. An *event* is a
timestamped thing that happened and wants appending. The distinction matters
because appending a state leaves two live answers with nothing marking which is
current. Pass `kind` to `ob_store` to record it (`server.ts:802`); storing still
appends either way.

## Dashboard

A read-only web viewer for the knowledge base.

```bash
node open-brain/scripts/dashboard.mjs      # http://localhost:3456
```

Browse sessions, chunks, knowledge entries with their maturity lifecycle, CC memory, and config files. Nothing is ever written — the database is opened read-only.

| Env var | Default | Purpose |
|---|---|---|
| `OPEN_BRAIN_DB` | `~/.claude/open-brain/knowledge-v2.db` | Database to view |
| `DASHBOARD_PORT` | `3456` | Port to serve on |

> The viewer predates the v2 schema and still queries v1 table names (`knowledge`, `summaries`, `tags`, `chunks_fts`). A shim maps these to `knowledge_index` and empty stand-ins using **TEMP views scoped to the connection**, so `knowledge-v2.db` is never modified. The `summaries` tab is empty by design — v2 has no summaries table.

## HoH loop runtime (`open-brain/src/harness/`)

An outer harness around the three seats — **planner, developer, QA** — from
*Harness-of-Harness* (arXiv:2609.01481). Its value here is **enforcement, not automation**: this
repo already had the three roles as documents and could not keep to them, because a role file is a
rule someone has to remember.

**The roles are still stubs.** Slice two adds the Jev client and the first two gates; real role
prompts are slice three. A stubbed role's `D_t` and diff are what the gates see, which is enough to
observe whether a gate is asked the right question and whether policy comes from a file.

```bash
# Prints the derived D_t / E_t and gate-policy schemas. Changes nothing.
npx tsx open-brain/src/harness/cli.ts schemas

# Runs a loop. Pass --repo: a loop COMMITS and TAGS in the repository it runs
# against, so point it at a scratch clone rather than your working checkout.
npx tsx open-brain/src/harness/cli.ts run --loop t001 --gate dry-run --repo /path/to/scratch/repo

# The same loop with the gates live. Needs TYPESAFE_API_KEY in the environment —
# it is read from there and nowhere else, and its absence is a refusal naming it.
npx tsx open-brain/src/harness/cli.ts run --loop t001 --gate live --repo /path/to/scratch/repo
```

The target repository needs a clean tree and, for the default checks, an `open-brain/` directory with
`build` and `test` scripts. Roll a loop back with `git reset --hard loop-001-base`.

| Mechanism | What it does |
|---|---|
| **Write allowlist** | Refuses before the write *and* detects afterwards against the diff from the stage's base commit — **committed and uncommitted both**, because a role that commits leaves a clean `git status`. A breach is refused, not warned, reverted, and never retried |
| **Frozen candidate** | QA is handed a SHA; the runtime refuses if HEAD moved or the tree is dirty, checks identity again **after** every stage and before every tag, and asserts the candidate is the evidence commit's parent |
| **Schema retry, capped** | A rejected `D_t`/`E_t` is handed back its own problems and schema. An exhausted cap writes `FAILED.md` and exits non-zero |
| **Exit codes only** | Build and unit results come from process status; no stage reads stdout to decide. A report contradicting the measurement is refused, not corrected |
| **Per-loop git tags** | `loop-<NNN>-base`, `-developer`, `-qa`. Rollback is one git command. Tags refuse to move |
| **Dry run** | Prints every gate payload and sends nothing; secrets redacted by live value *and* field name |
| **Ref watch** | Snapshots every ref under `refs/` around each stage. A role that runs `git tag -f`, `git branch -f` or `git update-ref` fails the loop, the ref is put back, and the record names the ref and both SHAs. Authorship is a ledger of the exact refs the runtime declared, not a name pattern a role could imitate (`G-041`) |
| **Foreign-role refusal** | `runLoop` throws before any stage runs if it is handed a role it did not construct while the ref-watch is off. Provenance is a set inside `roles.ts` that the module does not export, so it cannot be forged from outside |
| **Gate policy as data** | Thresholds live in `open-brain/src/harness/policies/*.json`, zod-validated, with the JSON Schema derived and drift-checked. Changing a number changes the decision with no source change; there is no built-in default to fall back to |
| **Four failure classes** | `401`, `422`, `429`, `529` map to four distinct outcomes the runtime can act on — `422` carries the field the API named — and an undocumented status is its own outcome rather than filed under one of the four |

**The runtime never merges, pushes, or touches a remote** — ten network subcommands are refused at
the call site (`D-019`: autonomous inside a branch, Aaron at master).

**What it does not fix, stated so nobody expects it to:** boundary failures only. It does nothing
about measurement failures, which are far more frequent. A runtime cannot stop a seat running a
grep that hides the line it needed.

See [`docs/HOH-JEV.md`](docs/HOH-JEV.md) for the loop contract.

## Key Features

| Feature | Since | What it does |
|---|---|---|
| **HoH loop runtime** | v0.41.0 | Enforces the planner/developer/QA boundary: frozen candidate for QA, write allowlist that refuses, capped schema retry, per-loop git tags. Roles are stubbed |
| **Ref watch + gates** | v0.42.0 | Closes the ref channel (`G-041`) and puts the plan gate and developer done-gate behind the runtime, with thresholds as data and gate verdicts written into the iteration artifact |
| **Dashboard** | v0.9.0 | Read-only web viewer at `localhost:3456`; surfaces the maturity lifecycle (progenitor/proven/mature), which the v1 schema could not represent |
| **Tiered Memory** | v0.6.0 | 4-tier access (Core/Hot/Warm/Cold); Obsidian Vault as SOT; Smart Connections semantic search replaces sqlite-vec; vault-first store pipeline; reflection cycle for experience distillation |
| **Session manifest** | v0.5.5 | Threads Claude's session UUID across all memory layers for full provenance tracking |
| **Outcome tracking** | v0.4.0 | Ternary feedback (helpful/harmful/neutral) on recalled knowledge with maturity lifecycle (1.5x Mature, 1.2x Proven, 1.3x Failures) |
| **Protocol health** | v0.5.4 | `ob_score` — deterministic 0-100 health score across 5 categories |

## Project Template

New projects benefit from a standard folder structure that gives the AI agent immediate context. The included template sets up an `.agents/` directory with a PRD, task tracking, and session logs.

```bash
cp -r project-template/.agents your-project/.agents
cp -r project-template/.claude your-project/.claude
```

See [project-template/README.md](project-template/README.md) for details.

## A2A Wrapper (Multi-Agent)

A lightweight wrapper that turns any machine with Claude Code into a hub-connected agent. It polls an [A2A Hub](https://github.com/melvenac/A2A-Hub) for tasks, runs them via `claude --print`, and reports results back.

See [a2a-wrapper/](a2a-wrapper/) for details.

## License

MIT
