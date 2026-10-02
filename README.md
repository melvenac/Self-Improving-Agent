# Self-Improving Agent

*A protocol, a tool server and a small runtime that let AI coding agents start warm, keep one record of project state, and work as seats whose boundaries are enforced.*

**Latest: v0.45.0** · [Changelog](CHANGELOG.md) · [What it is for](.agents/SYSTEM/PRD.md)

---

## What is this?

AI coding sessions start cold: the agent does not know what the project is for, what was decided, or what comes next. This repo gives a project:

- a **session lifecycle** (`/start`, `/end`, `/checkpoint`, `/sync`) that reads and writes one project record;
- the **open-brain MCP server** (14 tools): the record, recall over a knowledge store, and health checks;
- a **recall trigger** that surfaces a matching lesson at the moment of the act;
- the **HoH loop runtime**, which enforces the planner, developer and QA boundaries with gates instead of asking each seat to remember them;
- a **project template** and `/bootstrap` to put a new project on SIA.

The purpose, what was cut and why, and the success metrics are in [`.agents/SYSTEM/PRD.md`](.agents/SYSTEM/PRD.md).

## Prerequisites

- **Claude Code CLI** ([claude.ai/code](https://claude.ai/code)); Cursor is also supported
- **Node.js v22 LTS**, the tested version. A newer Node may work but is not tested here
- **Git**
- Optional: **Obsidian**, as a viewer for the knowledge vault. It is never required

Recall, the project record and the slash commands need nothing else. **The live HoH gates need a TypeSafe key; see below.**

## Getting Started

```bash
git clone https://github.com/melvenac/Self-Improving-Agent.git
cd Self-Improving-Agent
node scripts/setup.mjs
```

This builds open-brain, registers the `SessionStart` and `SessionEnd` hooks, installs the slash commands for Claude Code (`~/.claude/commands/`) and Cursor (`~/.cursor/commands/`), registers the MCP server in both, and scaffolds the knowledge vault. **Restart Claude Code (and Cursor) afterwards.** Then open Claude Code in any project and run `/start`.

For framework developers (symlinks the source for live editing): `node scripts/setup.mjs --dev`.

### Put a project on SIA

Open Claude Code in the project and run **`/bootstrap`**. It works through `open-brain bootstrap check | move-residue | scaffold`: it detects an existing `CLAUDE.md` and leftover `.agents/` files and never overwrites or deletes either. It copies the fresh-install files from `project-template/` and checks with git that each is tracked or local as it says. The owner then creates the record with `open-brain state import --draft` and `--commit`. See [project-template/README.md](project-template/README.md).

### The TypeSafe key (needed for the live HoH gates only)

The HoH gates call **TypeSafe's Jev API**. **Every project that adopts SIA needs its own `TYPESAFE_API_KEY`**, set in that project's *local* environment (a user environment variable is fine) and **never committed**, never placed in a shared or CI secret. **SIA ships no key.** The runtime reads it from the environment and nowhere else; its absence is a refusal that names it (D-070).

Without a key, `--gate dry-run` still prints every gate payload and sends nothing.

### Manual setup

<details>
<summary>Step by step, if you prefer manual control</summary>

**1. Build the MCP server**

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

**2. Register the hooks** in `~/.claude/settings.json`. `node scripts/setup.mjs` registers `SessionStart` and `SessionEnd` for you (from the checkout you run it in; it replaces a registration of the same script from another checkout). `PostToolUse`, the recall trigger, is not registered by `setup.mjs`; add it by hand:

```jsonc
{
  "hooks": {
    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "node \"/abs/path/to/open-brain/build/cli-bootstrap.js\"" }] }],
    "SessionEnd":   [{ "matcher": "", "hooks": [{ "type": "command", "command": "node \"/abs/path/to/open-brain/build/cli-session-end.js\"" }] }],
    "PostToolUse":  [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "node \"/abs/path/to/open-brain/build/cli-recall-trigger.js\"", "timeout": 10 }] }]
  }
}
```

Three things about the trigger's registration that are not obvious:

- **`PostToolUse`, not `PreToolUse`, and the choice is load-bearing.** Both accept `hookSpecificOutput.additionalContext`. On `PreToolUse` exit 2 blocks the tool call; on `PostToolUse` nothing can. The trigger must never block, and on this event that is structural rather than a promise the code keeps.
- **`timeout` is the host's bound; `deadline_ms` in the policy is the trigger's own.** The host's `timeout` bounds how long the process may run. `deadline_ms` decides whether a result that came back late may still be emitted. Set `timeout` comfortably above `deadline_ms`.
- **It runs the build it is registered against.** The path is absolute, so a stale checkout serves a stale trigger (`G-030`, `G-034`; `T-154`).

Every failure is silent to the model and loud to the log: the hook exits 0, writes nothing to stdout or stderr, and appends one line to `recall-trigger.log` beside the knowledge database.

**3. Install the slash commands and vault** with `node scripts/setup.mjs`, and restart Claude Code.

**4. Verify.** Start a Claude Code session and run `/start`. The bootstrap hook fires (project detection, handoff check), recall may be empty on first run, and a session log is created.

</details>

## Commands

| Command | When | What it does |
|---|---|---|
| `/start` | Session start | Reads project state, recalls relevant knowledge, registers the session UUID, creates the session log |
| `/end` | Session end | Stores the session's lessons, each with the key (command, path or error) that would have caught it, then `ob_end`. Writes no project state: the record is written through `ob_state` as work happens (T-179) |
| `/checkpoint` | Mid-session | Captures phase-level work context before `/compact` |
| `/sync` | Before commits | Validates version consistency, structural integrity and installed copy drift |
| `/bootstrap` | Once per project | Puts a project on SIA (see above) |

## The project record

Project state lives in `.agents/state.json`, created once by `open-brain state import`, read with `open-brain state show`, and **written only through `ob_state`**. `INBOX.md`, `task.md`, `next-session.md` and the marked region of `SUMMARY.md` are rendered views of it; never edit them by hand.

The 14 tools: `ob_recall`, `ob_recalled`, `ob_store`, `ob_store_chunk`, `ob_feedback`, `ob_forget`, `ob_list`, `ob_stats`, `ob_set_session`, `ob_start`, `ob_state`, `ob_end`, `ob_sync`, `ob_score`. `ob_start` and `ob_sync` resolve the project root from any subdirectory.

## Recall

`ob_recall` is FTS5 keyword search over the knowledge index, ranked by BM25 with recency decay and a failure boost. Knowledge content is markdown in a vault directory (`OPEN_BRAIN_VAULT_DIR`, default `~/Obsidian Vault v2`); `knowledge-v2.db` (override with `KNOWLEDGE_V2_DB`) holds the index, the recall and feedback logs, sessions and chunks. Entries carry a **`state` or `event` kind**: a state is one current value that wants replacing, an event is a timestamped thing that wants appending. Pass `kind` to `ob_store`.

### The recall trigger

`open-brain/build/cli-recall-trigger.js` (PostToolUse on `Bash`) queries the store at the moment of the act and injects a matching entry's `ACTION` next to the tool result. It is deterministic and local: the query is derived from the command by code, never by asking the model. **Precision only: it never broadens, and below the relevance floor it says nothing at all.** Every invocation is recorded in `trigger_fires` as `not-asked`, `silent` or `injected`, so "nothing recalled" can be told apart from "nothing asked".

### Session-end pipeline

`open-brain/build/cli-session-end.js` (SessionEnd) and `ob_end` produce the session summary, record feedback, log invocations, run the shadow recall and update topics. **Feedback rates only entries the agent judged explicitly**; an unjudged entry is skipped, because a fallback neutral is indistinguishable from a considered "retrieved and not used".

## HoH loop runtime (`open-brain/src/harness/`)

An outer harness around the three seats, **planner, developer, QA**, from *Harness-of-Harness* (arXiv:2609.01481). Its value here is **enforcement, not automation**: this project had the three roles as documents and could not keep to them, because a role file is a rule someone has to remember. The contract is [`docs/HOH-JEV.md`](docs/HOH-JEV.md).

```bash
# Prints the derived D_t / E_t and gate-policy schemas. Changes nothing.
npx tsx open-brain/src/harness/cli.ts schemas

# Runs a loop. Pass --repo: a loop COMMITS and TAGS in the repository it runs
# against, so point it at a scratch clone rather than your working checkout.
npx tsx open-brain/src/harness/cli.ts run --loop t001 --gate dry-run --repo /path/to/scratch/repo

# The same loop with the gates live. Needs TYPESAFE_API_KEY in the environment.
npx tsx open-brain/src/harness/cli.ts run --loop t001 --gate live --repo /path/to/scratch/repo
```

The target repository needs a clean tree and, for the default checks, an `open-brain/` directory with `build` and `test` scripts. Roll a loop back with `git reset --hard loop-001-base`.

| Mechanism | What it does |
|---|---|
| **Write allowlist** | Refuses before the write *and* detects afterwards against the diff from the stage's base commit, committed and uncommitted both. A breach is refused, reverted, and never retried |
| **Frozen candidate** | QA is handed a SHA; the runtime refuses if HEAD moved or the tree is dirty, and checks again after every stage and before every tag |
| **Schema retry, capped** | A rejected `D_t`/`E_t` is handed back its own problems and schema. An exhausted cap writes `FAILED.md` and exits non-zero |
| **Exit codes only** | Build and unit results come from process status; a report contradicting the measurement is refused, not corrected |
| **Per-loop git tags** | `loop-<NNN>-base`, `-developer`, `-qa`. Rollback is one git command. Tags refuse to move |
| **Ref watch** | Snapshots every ref under `refs/` around each stage; a role that moves a ref fails the loop and the ref is put back (`G-041`) |
| **Gate policy as data** | Thresholds live in `open-brain/src/harness/policies/*.json`, zod-validated, with no built-in default |
| **Plan gate, done gate** | The plan gate and the developer done-gate call Jev; their verdicts are written into the iteration artifact |
| **Shadow merge gate** | Before a merge decision the runtime records what it *would* have done (`would-merge`, `would-not-merge`, `undefined`); after, it records what Aaron did, in the append-only `docs/loops/shadow-merge/ledger.jsonl`. Procedure: `docs/loops/shadow-merge/PROCEDURE.md` |
| **Four failure classes** | `401`, `422`, `429`, `529` map to four distinct outcomes; an undocumented status is its own outcome |
| **Dry run** | Prints every gate payload and sends nothing; secrets redacted by live value and field name |

**The runtime never merges, pushes, or touches a remote** (`D-019`): autonomous inside a branch, Aaron at master, until the shadow gate's disagreement count is zero across loops that contained real defects. **What it does not fix:** boundary failures only. It does nothing about measurement failures, which are far more frequent.

### The seats

Planner (Atlas), developer (Forge) and read-only QA work on frozen SHAs; role files are in `.agents/roles/`. Sessions talk over **A2A**, which is a transport with no memory: anything a later session must read goes in a tracked file (`docs/loops/`, `state.json` `decisions[]`).

## Dashboard

A read-only web viewer for the knowledge base.

```bash
node open-brain/scripts/dashboard.mjs      # http://localhost:3456
```

Nothing is ever written; the database is opened read-only.

| Env var | Default | Purpose |
|---|---|---|
| `OPEN_BRAIN_DB` | `~/.claude/open-brain/knowledge-v2.db` | Database to view |
| `DASHBOARD_PORT` | `3456` | Port to serve on |

## Project Template

New projects get a standard folder structure that gives the agent immediate context: [project-template/README.md](project-template/README.md). The project is not a seat (`role: none`).

## License

MIT
