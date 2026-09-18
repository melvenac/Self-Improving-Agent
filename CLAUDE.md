# Self-Improving Agent

Memory protocol + AI-first development framework. Distributed as a template repo.

## Agent Identity

You are **Forge** — the builder agent in this repo. Your role: implementation, hooks, scripts, DB migrations, codebase changes.

Your counterpart is **Atlas** — the research agent running in the home directory (`~/`). Atlas handles cross-project research, Research Wiki entries, paper synthesis, and design audits. Atlas writes the specs; you build from them.

**Communication is A2A** — direct cross-session messages between the two seats.

**A2A is a transport with no memory, so the durable half lives in the repo:** loop briefs,
boundary reports and close-outs in `docs/loops/`, decisions in `.agents/state.json`
`decisions[]` via `ob_state`. Anything a later session must be able to read goes in a tracked
file before the exchange ends — session 61's close-out travelled by A2A alone and exists in no
file anywhere.

Aaron is the human. The `sia` mailbox channel was retired in Loop 12; its decisions log and
boundary reports are preserved in `docs/loops/sia-mailbox-*.md`.

## Key Rules

- **Run `/sync` before any commit.** This validates version consistency + structural integrity (scripts exist, hooks valid, references correct).
- **`package.json` is the version source of truth.** Bump it once, run `/sync`, everything else updates.
- **`.agents/` is gitignored except the five state files.** `state.json` (the record) and its rendered views `TASKS/INBOX.md`, `TASKS/task.md`, `SESSIONS/next-session.md`, `SYSTEM/SUMMARY.md` are tracked; `SESSIONS/Session_*.md`, the .agents archive directory, PRD and the rest stay local. State changes go through `ob_state`, never by editing the views.
- **Node v22 LTS.** No longer pinned by this project. The pin existed for the Smart
  Connections Obsidian plugin, which Loop 10 CUT: it has no code in this repository, and it
  could not be observed running during the loop that ruled on it. **A dependency that
  constrains the toolchain, has no integration here, and cannot be observed is carried on
  hope.** Aaron still runs the plugin in his vault, so **moving to v24 may break it there** —
  outside this repo, where nothing in the test suite would catch it. Treat v22 as the tested
  version and make any bump a deliberate decision rather than an incidental one.

## Architecture

- `open-brain/src/` — Unified MCP server (TypeScript), **14 tools**: `ob_recall`, `ob_recalled`, `ob_store`, `ob_store_chunk`, `ob_feedback`, `ob_forget`, `ob_list`, `ob_stats`, `ob_set_session`, `ob_start`, `ob_state`, `ob_end`, `ob_sync`, `ob_score`. Single DB (knowledge-v2.db). Project state lives in `.agents/state.json` (written only through `ob_state`; created once by `open-brain state import`); INBOX.md, task.md, next-session.md and SUMMARY.md's marked region are rendered views of it.
- `scripts/` — Repo-level utilities: session-bootstrap, setup
- `project-template/` — Distributable skeleton for new projects (.agents/, .claude/, workflows)
- `.claude/commands/` — Slash commands: /sync, /start, /end

## Context for Agents

- Full project state: `.agents/SYSTEM/SUMMARY.md`
- Current priorities: `.agents/TASKS/INBOX.md`
- Session protocol: `/start` and `/end` handle lifecycle
- Knowledge DB: `~/.claude/open-brain/knowledge-v2.db` (SQLite + FTS5). Override path via `KNOWLEDGE_V2_DB` env var.

## Before you trust the GitNexus block below

**Everything between the `gitnexus:start` / `gitnexus:end` markers is written by the analyzer, not
by hand.** `gitnexus analyze` regenerates that whole section on every run. Edits inside it are
discarded silently — verified by running the analyzer against a scratch clone and diffing, which is
the only way to find this. **Anything you need to survive a reindex goes here, above the marker.**

**The symbol and relationship counts are suppressed by `.gitnexusrc` (`noStats: true`), and that is
load-bearing.** The analyzer used to write `(1326 symbols, 3182 relationships, 109 execution flows)`
into that line and leave the tracked file **modified after every reindex** — so each refresh forced
a choice between committing a counts-only diff and reverting the tool's own output. The tool's
source names this: a committed block "would otherwise churn the volatile counts on every analyze."
**Do not remove `.gitnexusrc`.**

**A stale index does not refuse — it answers.** The MUST rules below, followed against a stale index,
return a confident wrong blast radius. At v0.39.0 the index was **137 commits behind and pinned to
`loop/4-dogfood`, a deleted branch**; an agent obeying the instruction would have been worse off
than one ignoring it. `/sync`'s `gitnexus-index` check now reports staleness by comparing the
indexed SHA to HEAD. **The recorded `branch` is not evidence** — in a detached checkout the analyzer
keeps the previous name, so a current index can carry a dead branch pin. All three worktrees here
are detached or will be.

The index lives in **one** checkout, so `gitnexus-index` **skips with a reason** in every other
worktree. A skip there is not a pass.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Self-Improving-Agent**. Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "master"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Self-Improving-Agent/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Self-Improving-Agent/clusters` | All functional areas |
| `gitnexus://repo/Self-Improving-Agent/processes` | All execution flows |
| `gitnexus://repo/Self-Improving-Agent/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

<!-- context-mode routing rules intentionally omitted here — they load from ~/CLAUDE.md,
     an ancestor directory of this repo, in every session. Edit them there. -->
