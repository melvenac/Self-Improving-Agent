# Widen Extraction Patterns + Unified Experience Format

**Date:** 2026-03-28
**Session:** 6
**Status:** Approved (pending spec review)

## Problem

vault-writer's extraction pipeline runs correctly on every SessionEnd but captures almost nothing. Sessions with 35 prompts, 74 file changes, and 5 decisions produce 0 experiences. Three root causes:

1. **Narrow extraction triggers** — only `event.category === 'decision'` and a small gotcha keyword regex
2. **Silent filtering** — decisions failing `MIN_DECISION_LENGTH` (40 chars) produce no log, making it invisible
3. **Missing pattern types** — planning discussions, architecture decisions, and workaround patterns have no extraction logic
4. **Inconsistent formats** — vault-writer writes `situation:`/`action:` tuples, `/end` writes `[EXPERIENCE]` prose blocks. Two formats in one DB hurts recall consistency.

## Design Decisions

- **Data flow direction:** knowledge.db (SQLite FTS5) is source of truth. Obsidian `.md` files are read-only mirrors for human monitoring.
- **Format per destination:** Structured text for FTS5 content column. YAML frontmatter for Obsidian files.
- **Both writers kept:** vault-writer (automated, `source: vault-writer`) + `/end` skill (curated, `source: agent`). Same format, different source tags.
- **Extraction approach:** Hybrid — use existing context-mode categories + scan user prompts and agent responses for planning/decision/workaround language.
- **Capture depth:** Full exchange — user prompt that triggered it + matched text + surrounding context.

## Unified Experience Format

### In knowledge.db (FTS5-optimized structured text)

```
[EXPERIENCE] Short descriptive title
PROJECT: project-name
DOMAIN: comma, separated, tags
DATE: 2026-03-28
TYPE: decision | gotcha | pattern | planning | workaround
SOURCE: vault-writer | agent

TRIGGER: When this knowledge is relevant
ACTION: What was done or decided
CONTEXT: The user prompt + agent reasoning that led to this (full exchange)
OUTCOME: What happened, what to do differently
```

Fields are uppercase labels on their own lines. Natural language values. No YAML, no JSON. FTS5 indexes the full content column so all fields are searchable.

### In Obsidian (YAML frontmatter + readable body)

```yaml
---
date: 2026-03-28
project: project-name
type: experience
subtype: decision | gotcha | pattern | planning | workaround
tags: [domain-tag, file-touch:filename.mjs]
files: [changed-file.mjs]
outcome: success | failure | unknown
source: vault-writer | agent
---

## Trigger
When this knowledge is relevant

## Action
What was done or decided

## Context
The user prompt + agent reasoning that led to this

## Outcome
What happened, what to do differently
```

## Extraction Patterns (vault-writer)

### Existing (keep)

| Pattern | Source | Matches |
|---------|--------|---------|
| Decision category | `event.category === 'decision'` | Context-mode tagged decisions |
| Gotcha keywords | All non-system events | `gotcha`, `caveat`, `careful`, `watch out`, `broke`, `failed`, `workaround`, `bug`, `error` |

### New conversation scanning patterns

| Pattern | Source | Regex / keywords | Type |
|---------|--------|-------------------|------|
| Planning language | User prompts | `let's go with`, `the approach is`, `we decided`, `the plan is`, `I want to build`, `should we` | planning |
| Architecture decisions | Agent responses | `chose .+ over`, `because`, `trade-?off`, `instead of`, `the reason is` | decision |
| Workaround patterns | Agent responses | `workaround`, `hack`, `temporary fix`, `until we`, `for now we`, `fixed by` | workaround |
| Root cause patterns | Agent responses | `root cause`, `the issue was`, `turns out`, `the problem is`, `doesn't support`, `incompatible` | gotcha |
| Explicit experience markers | User prompts | `remember this`, `note that`, `important:`, `lesson learned` | pattern |

### Scanning rules

- Scan **user prompts** and **agent responses** (not just categorized events)
- Skip system noise: events starting with `<local-command`, `<command-name`, `<system-reminder`
- For each match, capture the **full exchange**: the user prompt that preceded the match + the matched text + up to 3 lines after
- One experience per unique trigger match (dedup by first line)

## Quality Gates (updated)

| Gate | Old | New | Rationale |
|------|-----|-----|-----------|
| MIN_LENGTH | 40 chars | 25 chars | Let more through, monitor via Obsidian |
| MAX_PER_SESSION | 3 | 3 | Keep for now, monitor |
| DEDUP_SIMILARITY | 0.80 | 0.80 | Keep |
| **Filter logging** | None | Log every skip with reason | Critical for monitoring |

### Filter log format

Every skip gets a log line:
```
SKIP (decision): LENGTH below 25 chars: "short text here"
SKIP (gotcha): DEDUP 0.85 similar to existing-experience-slug
SKIP (planning): MAX_CAP reached (3/3)
```

## Data Flow (new)

```
SessionEnd fires
  |
  v
auto-index.mjs -> indexes raw events into chunks table (unchanged)
  |
  v
vault-writer.mjs (refactored):
  1. Find most recent session .db
  2. Extract events, scan for triggers (existing categories + new patterns)
  3. For each matched experience:
     a. Build structured text (FTS5 format)
     b. Write to knowledge.db knowledge table (source: vault-writer)
     c. Generate .md mirror to ~/Obsidian Vault/Experiences/
  4. Log all actions and skips
  5. Stage 4: safety net for .agents/SESSIONS/ (unchanged)
  |
  v
skill-scan.mjs -> scans Experiences/ for clusters (unchanged)
```

## /end Skill Update

Update the experience format instructions in `~/.claude/commands/end.md` to use the unified format:

- Replace the `[EXPERIENCE]` format block with the new format
- Keep `SOURCE: agent` to distinguish from automated extraction
- Keep `kb_store` as the write mechanism
- No code changes needed — just prompt template updates

## Files to Modify

| File | Location | Change |
|------|----------|--------|
| `vault-writer.mjs` | Both repo + installed | Reverse data flow, widen extraction, add conversation scanning, add filter logging |
| `vault-utils.mjs` | Both repo + installed | Add `mirrorToObsidian()` function (generate .md from DB entry) |
| `end.md` | `~/.claude/commands/end.md` | Update experience format instructions |

## Files NOT changing

| File | Reason |
|------|--------|
| `auto-index.mjs` | Indexes raw chunks — separate concern |
| `skill-scan.mjs` | Scans Obsidian Experiences/ — will benefit from more .md mirrors |
| knowledge.db schema | No new columns needed — existing schema sufficient |

## Post-implementation

1. Run vault-writer manually on a recent session to verify extraction
2. Check `~/Obsidian Vault/Logs/vault-writer.log` for filter logging
3. Check `~/Obsidian Vault/Experiences/` for new .md mirrors
4. Query knowledge.db for new `source: vault-writer` entries in unified format
5. Copy updated scripts to `~/.claude/knowledge-mcp/scripts/`
6. Run a test session with `/end` to verify curated experiences use new format
7. Monitor over next 3-5 sessions, adjust MIN_LENGTH and patterns as needed

## Investigate separately

- `kb_recall` returns zero results despite 143 knowledge entries — FTS5 index may need rebuild
- SUMMARY.md claims `recall_count`/`last_recalled` columns exist but schema doesn't have them — update SUMMARY.md
