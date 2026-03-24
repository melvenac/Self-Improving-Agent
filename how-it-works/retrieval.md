# Retrieval: How Knowledge Gets Surfaced

Retrieval is the process of finding and presenting relevant knowledge at the start of a session. It turns the accumulated vault into actionable guidance for the current task.

## When Retrieval Happens

Retrieval runs when you start a session using the `/start` skill or `/recall` command. It can also be triggered manually at any point during a session.

## The Retrieval Protocol

### Step 1: Search by Project + Domain Tags

The agent queries the vault using the current project name combined with its domain tags. Each project has a predefined set of tags:

| Project | Domain Tags |
|---|---|
| My SaaS App | nextjs, stripe, postgres, auth |
| Data Pipeline | python, etl, automation |
| Mobile Backend | convex, react-native, mcp |

> **Note:** You define your own project/tag mappings in `~/.claude/CLAUDE.md`. The table above is just an example.

Example queries: `"convex validator gotcha"`, `"stripe convex action"`, or just the project name directly.

### Step 2: Check the Skill Index

The agent reads `~/Obsidian Vault/Guidelines/SKILL-INDEX.md` and scans for skills that match the session's planned work. Skills are indexed by domain and problem class, making lookup fast.

### Step 3: Check Skill Candidates

The agent glances at `~/Obsidian Vault/Guidelines/SKILL-CANDIDATES.md`. If any cluster is relevant to the current session AND has 3+ experiences, the agent proposes distilling it into a skill. See [Skill Distillation](skill-distillation.md).

### Step 4: Surface Results

The agent presents at most:
- **3 experiences** -- the most relevant individual lessons
- **2 skills** -- the most relevant reusable patterns

These are presented as non-prescriptive guidance. The agent suggests; it does not mandate. The developer decides whether the retrieved knowledge applies to the current situation.

## How Search Works

### Smart Connections MCP (Primary)

Smart Connections is an Obsidian plugin with an MCP bridge that provides semantic search. It indexes all markdown files in the vault and can find conceptually related content even when exact tags or keywords don't match.

For example, searching for `"API rate limiting"` might surface an experience titled `"Stripe webhook retry backoff"` because the concepts are semantically related, even though the words are different.

Query example:
```
mcp__smart-connections__lookup(query: "convex validator", limit: 5)
```

### Grep/Read Fallback

If Smart Connections MCP is unavailable, the agent falls back to:
1. `Glob` to list files in `~/Obsidian Vault/Experiences/*.md`
2. `Read` to examine files with relevant names or dates
3. Manual filtering based on frontmatter tags

This fallback is less powerful (no semantic matching) but ensures retrieval always works.

## Relevance Scoring

Two frontmatter fields on experience files enable relevance tracking:

### `retrieval-count`

Incremented each time an experience is surfaced during retrieval. A high retrieval count means the experience is frequently relevant -- it's a signal of high value.

### `last-used`

Updated to today's date each time an experience is surfaced. This enables staleness detection:

- **Frequently used, recently used** -- high-value, keep prominent
- **Frequently used, not recently used** -- may still be valuable, review periodically
- **Rarely used, not recently used** -- candidate for pruning or archival

Over time, these fields create a natural ranking that helps the retrieval system prioritize the most useful knowledge.

## Example: What a Session Start Looks Like

When you run `/start` in a Convex project, the agent might surface:

```
Retrieved for this session:

Experiences:
1. "Convex validator must wrap entire args object" (used 3x, last: 2026-03-20)
   TRIGGER: When defining Convex function arguments using v.object()...

2. "Convex action retries need idempotency keys" (used 1x, last: 2026-03-18)
   TRIGGER: When a Convex action calls an external API...

3. "Smart Connections requires re-index after vault restructure" (used 2x, last: 2026-03-19)
   TRIGGER: When moving files between vault directories...

Skills:
1. "Convex Function Patterns" -- validator wrapping, error handling, retry logic
2. "MCP Server Integration" -- connection lifecycle, error recovery

These are suggestions based on past sessions. Override as needed.
```

The agent presents this context and then proceeds with the session. The developer can acknowledge, ignore, or ask for more detail on any item.
