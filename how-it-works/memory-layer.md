# The Memory Layer

The memory layer is an Obsidian Vault -- a directory of plain-text markdown files at `~/Obsidian Vault/`. This is where all persistent knowledge lives.

## Why Plain-Text Markdown

- **Portable** -- no vendor lock-in, no database to manage. It's just files.
- **Human-readable** -- you can browse, edit, and search your knowledge base directly in Obsidian or any text editor.
- **Git-friendly** -- version control works naturally with markdown.
- **Searchable** -- Knowledge MCP provides recency-weighted FTS5 search; Smart Connections is available for personal Obsidian browsing.
- **Linkable** -- Obsidian's `[[WikiLink]]` syntax creates a navigable knowledge graph.

## Directory Structure

```
~/Obsidian Vault/
  Sessions/          # Chronological logs of what happened each session
  Experiences/       # Individual lessons extracted from sessions
  Topics/            # Aggregation notes that collect related experiences
  Guidelines/        # Distilled skills and the skill index
    SKILL-INDEX.md   # Registry of approved, active skills
    SKILL-CANDIDATES.md  # Proposed skills awaiting approval
  Summaries/         # High-level summaries across domains
```

### Sessions/

Sessions are no longer written as markdown files to this folder. As of v0.3.0, session data is indexed directly into the Knowledge MCP SQLite database by `vault-writer.mjs`. This makes sessions searchable via `kb_recall` without adding noise to the Obsidian vault.

The `Sessions/` folder may contain legacy files from earlier versions but is no longer actively written to.

### Experiences/

Individual lessons, each in its own `.md` file. These are the atomic units of knowledge in the system. See the format section below for details.

### Topics/

Topic notes aggregate related experiences. For example, a `Convex Patterns.md` topic note might link to a dozen experiences about Convex validators, actions, and schema design. Topics use WikiLinks to connect to their member experiences.

### Guidelines/

Distilled skills -- reusable patterns extracted from clusters of experiences. See [Skill Distillation](skill-distillation.md) for how these are created.

## Experience File Format

Every experience file uses YAML frontmatter for metadata and a structured body for the lesson itself.

### YAML Frontmatter

```yaml
---
title: Convex validator must wrap entire args object
project: My Project
domain: convex
date: 2026-03-15
subtype: gotcha
outcome: positive
files: [src/convex/api.ts]
last-used: 2026-03-20
retrieval-count: 3
---
```

| Field | Purpose |
|---|---|
| `title` | Short description of the lesson |
| `project` | Which project this came from |
| `domain` | Technology/pattern tag for retrieval grouping |
| `date` | When the experience was captured |
| `subtype` | Category: `gotcha`, `pattern`, `decision`, `fix`, `optimization` |
| `outcome` | Result: `positive`, `negative`, or `mixed` |
| `files` | Files touched during the session — enables file-level tagging |
| `last-used` | Updated each time the experience is surfaced during retrieval |
| `retrieval-count` | Incremented each time the experience is surfaced |

The `last-used` and `retrieval-count` fields enable relevance scoring. Frequently retrieved experiences are clearly valuable; experiences that haven't been used in months may be candidates for pruning.

### Body Structure: Structured Tuple

```yaml
situation: When defining Convex function arguments using v.object(), the validator
  must wrap the entire args definition -- not individual fields
action: Always use `args: v.object({ field1: v.string(), field2: v.number() })`
  rather than `args: { field1: v.string(), field2: v.number() }`
outcome_detail: Wrapping args in v.object() caught invalid inputs at the API boundary
  immediately. Applied this pattern to all 12 Convex functions in the project.
learned: Convex validator requires explicit v.object() wrapping — bare object literals
  are silently accepted but bypass validation

## Links
[[My Project]] [[Convex Patterns]]
```

Each tuple field serves a specific purpose:

- **situation** -- when is this relevant? What context would make this useful to surface?
- **action** -- what was done? The concrete approach taken.
- **outcome_detail** -- what happened as a result? Grounds the lesson in reality.
- **learned** -- the distilled takeaway — what to remember for next time.

## How Sessions Link to Experiences

Session logs use WikiLinks to reference the experiences they generated:

```markdown
# Session: My Project API Refactor (2026-03-15)

Refactored all Convex functions to use proper validator patterns.

## Experiences Captured
- [[Convex validator must wrap entire args object]]
- [[Convex query functions cannot use mutations internally]]

## Related Topics
- [[Convex Patterns]]
```

This creates a bidirectional graph in Obsidian: you can navigate from a session to its experiences, or from an experience back to the session where it was learned.

## How Topics Aggregate Experiences

Topic notes serve as hubs that collect related experiences:

```markdown
# Convex Patterns

Lessons learned working with Convex across projects.

## See Also
- [[Convex validator must wrap entire args object]]
- [[Convex query functions cannot use mutations internally]]
- [[Convex scheduled functions need explicit error handling]]
```

When `vault-writer.mjs` creates a new experience, it also updates the relevant topic note's "See Also" section with a new backlink. This keeps topics current without manual maintenance.
