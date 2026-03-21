# Accumulation: How Knowledge Gets Captured

Accumulation is the process of turning session work into persistent knowledge. It happens automatically at the end of every Claude Code session via hooks -- you don't need to remember to save anything.

## What Happens at Session End

Three hooks fire in sequence when a session ends:

```
Session ends
    |
    v
auto-index.mjs    -- indexes new/changed files
    |
    v
vault-writer.mjs  -- captures session data as markdown
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
project: Open Brain
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
project: Open Brain
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

### Step 3: Update Topic Notes

When a new experience is created, the writer checks if a relevant topic note exists in `~/Obsidian Vault/Topics/`. If it does, a new WikiLink backlink is added to the topic's "See Also" section. This keeps topics current as new experiences accumulate.

### Step 4: Dedup Check

Before creating a new experience, the writer searches existing experiences for near-duplicates (>90% similar content). If a match is found, the existing experience is updated rather than creating a duplicate. This prevents the vault from filling with redundant entries.

## vault-skill-scan.mjs

This hook runs after `vault-writer.mjs` and looks for patterns across experiences that might warrant distillation into a reusable skill.

### What It Does

1. **Reads all experiences** in `~/Obsidian Vault/Experiences/`
2. **Groups by domain tags** -- clusters experiences that share the same `domain` frontmatter value (filtering out noise tags like `gotcha` or `test`)
3. **Detects clusters** -- identifies groups of 3+ experiences with similar triggers or contexts
4. **Diffs against existing candidates** -- compares current clusters to `~/Obsidian Vault/Guidelines/SKILL-CANDIDATES.md` to detect new or growing clusters
5. **Updates SKILL-CANDIDATES.md** -- writes fresh scan results with a diff table showing what changed
6. **Writes proposal notifications** -- if new clusters cross the 3+ threshold, writes `.skill-proposals-pending.json` so the agent can propose them at the next session start
7. **Logs results** -- scan summary is appended to `~/Obsidian Vault/.vault-writer.log`

### Example Output in SKILL-CANDIDATES.md

```markdown
## Cluster: convex (5 experiences)
- Convex validator must wrap entire args object
- Convex query functions cannot use mutations internally
- Convex scheduled functions need explicit error handling
- Convex action retries need idempotency keys
- Convex schema changes require explicit migration

Status: NEW (crossed 3+ threshold this scan)
```

See [Skill Distillation](skill-distillation.md) for what happens after a cluster is detected.

## Guardrails

The accumulation system has several safeguards:

- **Dedup** -- always checks for similar existing experiences before creating new ones. Updates the existing file if the match is >90% similar.
- **Skill gate** -- the scanner NEVER auto-creates skills. It only proposes candidates. A human must approve before a skill is created. See [Skill Distillation](skill-distillation.md).
- **Context cap** -- at retrieval time, a maximum of 3 experiences + 2 skills are surfaced per session start. This prevents information overload even as the vault grows. See [Retrieval](retrieval.md).
- **Logging** -- errors and scan results are logged to `~/Obsidian Vault/.vault-writer.log` for debugging.

## Manual Supplement: /end

The `/end` skill can be run manually during a session to trigger a review pass. This supplements the automatic capture -- it doesn't replace it. Use it when you want to explicitly capture something mid-session or review what the automatic system extracted.
