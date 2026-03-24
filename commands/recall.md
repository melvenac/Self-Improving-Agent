# /recall — Knowledge Recall (Global)

> **Lightweight global knowledge recall.** Use `/start` inside projects for the full AI framework workflow.

## What to do

1. **Greet the user by name** (check `~/.claude/CLAUDE.md` for identity).

2. **Decompose into sub-queries:**
   - Determine the current working directory and what project this is (if any)
   - Look up domain tags from `~/.claude/CLAUDE.md` (Project Domain Tags table)
   - Based on what the user wants to work on (or pending tasks), generate **2-3 methodology-focused queries** — focus on techniques and patterns, not specific files
   - If no specific project or task yet, use broad queries based on what the user says

3. **Federated search (run all three in parallel):**
   - **Knowledge MCP [KB]:** `kb_recall(queries: [Q1, Q2], project: cwd, limit: 5)` — FTS5 across sessions, knowledge, summaries
   - **Smart Connections [SC]:** `mcp__smart-connections__lookup(query: Q1, limit: 5)` — semantic search across vault
   - **CC Memory [CC]:** Scan MEMORY.md index descriptions for keyword matches
   - **Fallback:** If Smart Connections errors, `grep -rl` over `~/Obsidian Vault/Experiences/` and `Guidelines/`
   - Read `~/Obsidian Vault/Guidelines/SKILL-INDEX.md` for matching skills

4. **Merge, deduplicate, and present:**
   - If same decision appears in [KB] (mirror) and [SC] (primary), keep the Obsidian version
   - Tag results with source `[KB]`/`[SC]`/`[CC]` for provenance
   - Rank: FTS5 keyword matches first, then semantic, then CC memory
   - For each result, rewrite to be **directly actionable** — turn abstract tips into concrete guidance
   - **Drop** anything that isn't actually useful despite matching by keyword
   - Don't modify the vault — only rewrite what you present
   - Surface at most **3 experiences** and **2 skills** as context
   - Keep it brief — titles and one-liners, not full content
   - Ask what the user wants to work on today

## Keep it light

This isn't a ceremony. If the user jumps straight into a task, recall in the background and surface anything relevant as you go. The point is to not start from zero — not to add overhead.
