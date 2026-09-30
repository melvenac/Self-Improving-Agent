# Self-Improving Agent — Product Requirements Document

> Rewritten for T-169 at the close of Loop 15 slice three (D-033, D-036, D-070). The earlier text described
> components Loop 10 cut. History lives in git, `CHANGELOG.md`, `docs/loops/` and the SIA Step-Back artifact
> (https://claude.ai/artifact/3Kv8BuKYrj5vaKQgD8NKC7, Parts 1 to 5, through Loop 11).

## Project Overview

| Field | Value |
|---|---|
| **Project** | Self-Improving Agent (SIA) |
| **Description** | A protocol, a tool server and a small runtime that let AI coding agents start warm, keep one written record of project state, and work as separate seats (planner, developer, QA) whose boundaries are enforced rather than requested. |
| **Repo** | https://github.com/melvenac/Self-Improving-Agent (private since Loop 11) |
| **Version** | v0.44.2 |
| **License** | MIT |

## Problem Statement

AI coding sessions start cold: the agent does not know what the project is for, what was decided, or what is
next. Where several agents share one project, each also trusts its own reading of the boundaries between roles,
and a rule that only a document states gets broken.

The Step-Back (Loop 11) tested the four claims this section used to make. Three of them did not survive:

| Claim | Verdict | Source |
|---|---|---|
| Sessions start cold | **Solved.** The proven asset: `.agents/`, `/start` and `/end`, the handoff, and `state.json` with rendered views | Step-Back Part 5; Loops 2 to 4 |
| Skills die in one project | **Refuted as built.** Clustering keyed on tags, not on actions, so it was cut | Loop 10 C2 (R-002) |
| Lessons are forgotten | **Split.** Ranking at session start earns its keep; the injection of the result did not | Step-Back Part 5 |
| Each session repeats discovery | **No.** The harm signal it relied on never existed | Loop 10 C2 |

What replaced the two dead claims is the second paragraph above, which the later loops built (Loops 12 to 16).

## Target Users

Ruled 2026-09-14 (Step-Back Q1): **both**, Aaron's own machines and other developers. The test is: on a fresh
machine, with one command, `/start` works. The core needs only Node and git. Obsidian is a viewer and is never a
prerequisite.

- **Solo developers** using Claude Code (and Cursor) who want a project to start warm each session
- **Teams of agents** working one repo as planner, developer and read-only QA
- **Aaron** (dogfooding: SIA develops SIA)

## What ships

1. **Session lifecycle.** `/start` reads the project record and the handoff; `/end` stores the session's
   lessons and calls `ob_end`; `/checkpoint` captures work before `/compact`; `/sync` is the gate that
   validates version consistency and structure before a commit. Commands: `.claude/commands/`;
   SessionStart hook: `open-brain/src/cli-bootstrap.ts`.
2. **The project record.** `.agents/state.json` is the record, written only through `ob_state`; `INBOX.md`,
   `task.md`, `next-session.md` and the marked region of `SUMMARY.md` are rendered views of it
   (`open-brain/src/pipelines/state-views/`). `open-brain state import` creates it once.
3. **open-brain, the MCP server (14 tools).** `ob_recall`, `ob_recalled`, `ob_store`, `ob_store_chunk`,
   `ob_feedback`, `ob_forget`, `ob_list`, `ob_stats`, `ob_set_session`, `ob_start`, `ob_state`, `ob_end`,
   `ob_sync`, `ob_score` (`open-brain/src/server.ts`). One database, `knowledge-v2.db`
   (SQLite plus FTS5, `open-brain/src/db-v2.ts`). Knowledge content is markdown in a vault directory; the
   database holds the retrieval index, the recall and feedback logs, sessions and chunks.
4. **Ranked recall.** `ob_recall` is FTS5 keyword search ranked by BM25 with recency decay and a failure boost
   (`LIFECYCLE_CONFIG` in `open-brain/src/lifecycle.ts`). Entries carry a `state` or `event` kind, which says
   whether a change replaces or appends (`ob_store`'s `kind`).
5. **The recall trigger.** A PostToolUse hook (`open-brain/src/cli-recall-trigger.ts`, `open-brain/src/trigger/`)
   queries the store at the moment of an act, derives the query from the command by code and never by asking
   the model, and injects a matching entry's action beside the tool result. Precision only: below the relevance
   floor it says nothing. Every invocation is recorded in `trigger_fires` (`not-asked`, `silent`, `injected`).
   Policy is data in `open-brain/src/trigger/policies/`.
6. **The HoH loop runtime** (`open-brain/src/harness/`, contract in `docs/HOH-JEV.md`). An outer harness around
   planner, developer and QA. It enforces, rather than asks for: a write allowlist that refuses and detects
   against the diff; a frozen candidate for QA; a ref watch over `refs/`; capped schema retry; exit codes as
   the only source of build and test results; per-loop git tags. Three gates, with thresholds as data in
   `open-brain/src/harness/policies/`: the plan gate (`brief-plan-gate.ts`, `plan-gate.json`), the developer
   done-gate (`developer-done.json`) and the shadow merge gate.
7. **The shadow merge gate** (`open-brain/src/harness/shadow-merge.ts`, `merge.json`). Before Aaron decides a
   merge, the runtime records what it would have done (`would-merge`, `would-not-merge`, `undefined`); after,
   `decide` records what Aaron did, in the append-only `docs/loops/shadow-merge/ledger.jsonl`. The runtime never
   merges, pushes or tags on a remote (D-019).
8. **The seats and A2A.** Planner (Atlas), developer (Forge) and read-only QA, on frozen SHAs, with role files
   in `.agents/roles/` and A2A as the transport between sessions. A2A holds no memory: anything a later session
   must read goes in a tracked file (`CLAUDE.md`, `docs/loops/`, `state.json` `decisions[]`).
9. **Project template and `/bootstrap`.** `open-brain bootstrap check | move-residue | scaffold` puts a
   project on SIA from `project-template/` and never overwrites or deletes (`CHANGELOG.md` 0.45.0).
10. **Setup.** `node scripts/setup.mjs` builds open-brain, registers the hooks, installs the slash commands for
    Claude Code and Cursor, and scaffolds the vault.

### The TypeSafe (Jev) dependency

The HoH gates call TypeSafe's Jev API. **Each project that adopts SIA needs its own `TYPESAFE_API_KEY`**, set in
that project's local environment and never committed. SIA ships no key (D-070). The key is read from the
environment only (`open-brain/src/harness/`); its absence is a refusal that names it. Recall, the record and
the slash commands need no key; only the live gates do.

## Not in this product

Cut in Loop 10 (C2) and deleted from the code rather than left dormant (R-002 to R-004, and the entry
that names the maturity lifecycle):

- the maturity lifecycle: maturity boosts, Progenitor / Proven / Mature promotion, `success_rate` and apoptosis
- the reflection queue and reflection cycle
- skill distillation and `skill-scan`
- semantic (Smart Connections) fusion into `ob_recall`, vector search and rank fusion: `ob_recall` is FTS5 only

A stored `maturity` value still displays in `ob_list` and the vault frontmatter as a label last written before
Loop 10; nothing computes it (`open-brain/src/lifecycle.ts`).

## Success metrics

1. **D-019's exit criterion (the one target the record sets).** The shadow merge gate records, at every merge
   decision, what the runtime would have done, and `ledger.jsonl` counts Aaron's disagreements. **When that
   count is zero across several loops that contained real defects, the human merge gate is removed, on
   evidence.** A non-zero count is what would have been lost. Today: one ledger row
   (loop `15-slice-3-c`, verdict `undefined`, action `merged`, `disagreed: null`), so no conclusion yet.
2. **Cold-start cost.** The Step-Back measured a warm start at 677 words against 24,887 for a cold read
   (Loops 2 to 4). `greeting-size` in `/sync` enforces a 40,000-character ceiling on the `/start` greeting.
3. **Recall trigger honesty.** `trigger_fires` distinguishes "nothing asked" from "nothing recalled", so the
   trigger's hit rate can be read from the table.
4. **Protocol health.** `ob_score` gives a deterministic 0 to 100 score across five categories
   (`open-brain/src/pipelines/sync/scorer.ts`).
5. **Structural integrity.** `/sync` passes with no issue before a commit (`open-brain sync --check`).
6. **Slice four (planned, D-071).** "Calibrated" thresholds need five or more runtime-produced diffs with
   pre-work plans; until then scores on seat-built diffs are provisional.

## What the project learned that is not about memory

- **Deterministic first.** A filter that drops rows emits the dropped count; where one fact has several
  representations, something checks that they agree.
- **`/sync` is a gate that catches classes of defect**, not single instances.
- **Build the thing that can disagree with you**, and prefer a second measurement to a better first one.
- **A deletion is not finished until nothing names the deleted thing** (Loop 12; `.agents/retirements.json`).
- **The seat boundary is the best result**: planner, developer and read-only QA on frozen SHAs. Most of the
  substantive catches came from the counterpart agent.

## Still open

- **Idea B: split the core protocol from the memory module.** Displaced every time because it needs no
  measurement. It is not done. `module-boundary` in `/sync` already checks that core does not import memory.
- Slice four: Jev threshold calibration (D-033, D-071).

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v22 LTS (tested version; a bump is a deliberate decision) |
| Language | TypeScript (open-brain) |
| Database | SQLite (better-sqlite3), `knowledge-v2.db` |
| Search | SQLite FTS5 via the open-brain MCP server |
| Knowledge store | Markdown files in a vault directory (Obsidian optional viewer) |
| Gates | TypeSafe Jev API (per-project key, D-070) |
| Host | Claude Code (primary), Cursor |
| VCS | Git + GitHub |

## Non-Functional Requirements

- **Portable**: markdown and JSON, no proprietary lock-in
- **Local first**: the record, recall and the hooks work offline; only the live gates call out
- **Never blocks**: the recall trigger exits 0 and stays silent on failure, and logs to `recall-trigger.log`
- **No secrets in the repo**: SIA ships no key (D-070)
