# Accumulation: How Knowledge Gets Captured

Accumulation is the process of turning session work into persistent knowledge. It happens in two complementary ways: automatic hooks at session end, and the manual `/end` command for what automation misses.

## What Happens at Session End

Three hooks fire in sequence when a session ends:

```
Session ends
    |
    v
auto-index.mjs    -- indexes session data into Knowledge MCP SQLite
    |
    v
vault-writer.mjs  -- captures session data as markdown in Obsidian
    |
    v
skill-scan.mjs    -- checks for emerging skill clusters
```

## vault-writer.mjs

This is the primary accumulation engine. It runs as a `SessionEnd` hook and writes to the Obsidian Vault.

### Step 1: Create a Session Log

The writer creates a new file in `~/Obsidian Vault/Sessions/` with YAML frontmatter:

```yaml
---
date: 2026-03-15
project: My Project
tags: [convex, api, refactor]
---
```

The session log records what was worked on, key decisions, and problems encountered. It includes WikiLinks to any experiences extracted (see step 2).

### Step 2: Extract Experiences

Significant lessons -- decisions, gotchas, patterns, fixes -- get extracted into individual files in `~/Obsidian Vault/Experiences/`.

Each experience follows the standard format:

```yaml
---
title: Convex scheduled functions need explicit error handling
project: My Project
domain: convex
date: 2026-03-15
type: gotcha
---
```

With a body containing TRIGGER / ACTION / CONTEXT / OUTCOME sections. See [The Memory Layer](memory-layer.md) for the full format specification and examples.

Not every session produces experiences. The writer looks for:
- **Gotchas** -- something that was surprising or counterintuitive
- **Patterns** -- a reusable approach that worked well
- **Decisions** -- an architectural choice with clear rationale
- **Fixes** -- a bug fix with a non-obvious root cause
- **Optimizations** -- a performance or workflow improvement

### Step 3: Mirror to Knowledge MCP

Each new experience is UPSERTed into the Knowledge MCP SQLite `knowledge` table with `source='vault-mirror'`. This ensures `kb_recall` can find experiences via FTS5 search, not just Smart Connections semantic search.

### Step 4: Update Topic Notes

When a new experience is created, the writer checks if a relevant topic note exists in `~/Obsidian Vault/Topics/`. If it does, a new WikiLink backlink is added to the topic's "See Also" section.

### Step 5: Safety Net (Stage 5)

If the user skipped `/end` in a project with `.agents/`, the vault-writer auto-fills empty sections in `.agents/SESSIONS/Session_N.md`. This ensures project state is never silently lost. It only fills empty sections — if `/end` already wrote content, that content is preserved.

### Step 6: Dedup Check

Before creating a new experience, the writer searches existing experiences for near-duplicates (>90% similar content). If a match is found, the existing experience is updated rather than creating a duplicate.

## skill-scan.mjs

This hook runs after `vault-writer.mjs` and looks for patterns across experiences that might warrant distillation into a reusable skill.

### What It Does

1. **Reads all experiences** in `~/Obsidian Vault/Experiences/`
2. **Groups by domain tags** -- clusters experiences that share the same `domain` frontmatter value (filtering out noise tags like `gotcha` or `test`)
3. **Detects clusters** -- identifies groups of 3+ experiences with similar triggers or contexts
4. **Diffs against existing candidates** -- compares current clusters to `~/Obsidian Vault/Guidelines/SKILL-CANDIDATES.md` to detect new or growing clusters
5. **Updates SKILL-CANDIDATES.md** -- writes fresh scan results with a diff table showing what changed
6. **Writes proposal notifications** -- if new clusters cross the 3+ threshold, writes `.skill-proposals-pending.json` so the agent can surface them at the next session start
7. **Logs results** -- scan summary is appended to `~/Obsidian Vault/.vault-writer.log`

See [Skill Distillation](skill-distillation.md) for what happens after a cluster is detected.

## The /end Command: Complementing Hooks

The `/end` command is designed to capture what the automatic hooks miss:

- **Subtle cross-step patterns** that emerged across multiple conversation turns
- **Context about _why_** a decision was made that isn't obvious from the code
- **Cross-project insights** ("this pattern from project X applies to project Y")
- **Corrections** to existing experiences that turned out to be wrong

`/end` also handles project close-out if `.agents/` exists: updating session logs, SUMMARY.md, INBOX.md, and writing the `next-session.md` handoff file for the next `/start`.

## Next-Session Handoff

At `/end`, the agent writes `.agents/SESSIONS/next-session.md` containing:
- **Pick up here:** what was in progress or next in line
- **Watch out for:** any gotchas the next session should know
- **Open questions:** anything unresolved needing input

This file is read by both the `session-bootstrap.mjs` hook (automatically) and `/start` (manually). It's overwritten each session — a relay baton, not a log.

## Guardrails

The accumulation system has several safeguards:

- **Dedup** -- always checks for similar existing experiences before creating new ones
- **Skill gate** -- the scanner NEVER auto-creates skills. It only proposes candidates. A human must approve.
- **Context cap** -- at retrieval time, a maximum of 3 experiences + 2 skills are surfaced per session start
- **Context budget** -- startup injection must stay under 5% of context window
- **Logging** -- errors and scan results are logged to `~/Obsidian Vault/.vault-writer.log`
- **Stale pruning** -- monthly flagging of experiences with `retrieval-count: 0` and `last-used` > 90 days
