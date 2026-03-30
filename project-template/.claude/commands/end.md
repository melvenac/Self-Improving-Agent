# /end — Session End (Smart Routing)

> **One command, context-aware.** Detects whether you're in a project (`.agents/` exists) or a general session, and runs the appropriate close-out.

## Step 0: Detect Context

Check if `.agents/` directory exists in the current working directory.

- **If `.agents/` exists** → Run **Full Project Close-Out** (Part A + Part B)
- **If no `.agents/`** → Run **Lightweight Knowledge Capture** (Part B only)

---

## Part A: Project Close-Out (only if `.agents/` exists)

> Close out the project session state so the next `/start` picks up cleanly.

### Meta Mode Detection

If `.agents/META/` exists, this is the **framework template repo itself**. In meta mode:
- Write session tracking updates to `META/` files, NOT the `SYSTEM/` templates
- Only modify `SYSTEM/` files when intentionally improving template content

### A1. Update Session Log
```
Update: .agents/SESSIONS/Session_N.md (find the current in-progress session)
```
Fill in:
- **What Was Done** — List of accomplishments
- **Files Modified** — All files changed
- **Files Created** — All new files
- **Gotchas & Lessons Learned** — Hard-won knowledge
- **Decisions Made** — Any architectural decisions
- Set status to **Completed**
- Check off the post-session checklist items as you complete them

### A2. Update SUMMARY.md
```
If META/ exists:  Update: .agents/META/SUMMARY.md
Otherwise:        Update: .agents/SYSTEM/SUMMARY.md
```
**CRITICAL — this is where staleness happens if you skip details.**

1. **Update the status line** — bump the version if a release was tagged this session, update the one-line status description
2. **Update "What's working"** — add new features/fixes from this session at the top of the list. Remove items that moved to a higher version bullet.
3. **Update "What's broken or incomplete"** — remove items that were fixed this session. Add any new issues discovered.
4. **Update "What's next"** — must match the top pending items in INBOX.md. If INBOX priorities changed, reflect that here.

The status line format: `> **Status:** vX.Y.Z Released — short description of current state`

### A3. Update DECISIONS.md (if applicable)
```
If META/ exists:  Update: .agents/META/DECISIONS.md
Otherwise:        Update: .agents/SYSTEM/DECISIONS.md
```
Add entries for any significant decisions made this session.

### A4. Update ENTITIES.md (if schema changed)
```
Update: .agents/SYSTEM/ENTITIES.md
```
_(Not applicable in meta mode — framework has no data model.)_

### A5. Update INBOX.md
```
If META/ exists:  Update: .agents/META/INBOX.md
Otherwise:        Update: .agents/TASKS/INBOX.md
```
- Mark completed tasks as `[x]`
- Add any new tasks discovered during the session
- Re-prioritize if needed

### A6. Update task.md
```
Update: .agents/TASKS/task.md
```
- Update task statuses to reflect what was completed
- If the current objective is done, note that the next session should pick a new one
- Clear stale tasks that no longer apply

### A7. Write next-session handoff
```
Write: .agents/SESSIONS/next-session.md
```
A short scratchpad for the next `/start` to read. Include:
- **Pick up here:** what was in progress or next in line
- **Watch out for:** any gotchas or blockers the next session should know
- **Open questions:** anything unresolved that needs Aaron's input

This file is overwritten each session — it's a relay baton, not a log.

### A8. Run Validation (if configured)
```
Run: validate:entities (if schema changed)
Run: validate:session:post (if it exists)
```

### A9. Doc drift audit

Run the automated doc sync, then check for any remaining drift this session's changes may have caused.

**Step 1: Run sync script**
```bash
node scripts/sync-docs.mjs
```
This automatically fixes version drift across README.md, PRD.md, and knowledge-mcp/package.json using package.json as the source of truth.

**Step 2: Manual check for behavioral drift**
If this session changed features, commands, or architecture:
1. Get the session's changes: `git diff --name-only` against the session start
2. Check these files against the changes:
   - `README.md` — feature descriptions, command/hook tables, setup instructions
   - `.agents/SYSTEM/PRD.md` — feature list, tech stack
   - `.agents/SYSTEM/SUMMARY.md` — already updated in A2, but cross-check
   - `CLAUDE.md` — architecture overview, key rules
3. Fix any stale references in place (targeted edit, not full rewrite)
4. Report: "Doc audit: updated N files" or "Doc audit: all docs current"

**Judgment:**
- Only fix docs that are actually stale due to THIS session's changes
- Don't rewrite docs for style — only fix factual inaccuracies
- If a doc file wasn't affected by session changes, skip it

---

## Part B: Knowledge Capture (always runs)

> Review what the SessionEnd hooks will auto-capture, and supplement with anything they'd miss.
>
> The hooks (`vault-writer.mjs` → `skill-scan.mjs`) automatically capture session logs and extract experiences to the Obsidian Vault + Knowledge MCP. Your job here is to catch what automation misses.

### B1. Capture external research
If any external research was done this session (GitHub repos, YouTube videos, website docs, NotebookLM content), store a knowledge entry for each source using `kb_store`:

```
[RESEARCH] {title} — {source type} Summary
SOURCE: {url or reference}
DATE: {today}
DOMAIN: {relevant tags}

FINDINGS: {key takeaways — what was learned}
DECISION: {what was decided — adopted, rejected, deferred, and why}
RELEVANCE: {how this connects to current work}
```

Use standardized source tags: `youtube-transcript`, `github-repo`, `notebooklm`, `docs`.

Even research that concluded "not useful right now" should be captured — it records the reasoning and prevents re-evaluation later. If no external research was done, skip this step.

### B2. Review for non-obvious lessons
The hooks extract experiences from explicit gotcha/decision patterns. Look for things they'd miss:
- Subtle patterns that emerged across multiple steps (not a single "aha" moment)
- Context about _why_ a decision was made that isn't obvious from the code
- Cross-project insights ("this pattern from project X applies to project Y")
- Corrections to existing experiences that turned out to be wrong

### B3. Store supplemental experiences
For anything the hooks would miss, use `kb_store` directly. **Dedup first:** run `kb_recall` with each experience title before storing — skip if >90% similar already exists, update if there's meaningful new detail.

```
[EXPERIENCE] {short-title}
PROJECT: {project-name or "general"}
DOMAIN: {domain-tags}
DATE: {today's date}
TYPE: {gotcha | pattern | decision | planning | workaround | fix | optimization}
SOURCE: agent

TRIGGER: {when this is relevant}
ACTION: {what to do or what was decided}
CONTEXT: {the full exchange — what was the user asking, what reasoning led here}
OUTCOME: {what happened, what to do differently}
```

### B4. Write session summary (dual-store)

Write the session summary to **both** stores:

1. **SQLite:** `kb_store_summary(session_id, summary_text)` — for keyword search via `kb_recall`
2. **Obsidian:** Use the Write tool to create `~/Obsidian Vault/Summaries/YYYY-MM-DD-{project-slug}.md` — for semantic search via Smart Connections

Use the enriched summary format:

```yaml
---
date: {YYYY-MM-DD}
project: {project-slug from cwd basename}
session: {N, if .agents/ project}
session_id: {session-id from current session}
type: summary
tags: [{project-slug}, {domain-tags}]
files: [{project-relative paths of files changed}]
---
```

Body sections:
- **## What** — What was accomplished (actions and outcomes)
- **## Why** — What motivated the work (INBOX item, problem, user request)
- **## How** — What approach was taken (key decisions, tradeoffs, tools)
- **## Lessons** — What was learned (gotchas, surprises, corrections)

No "Unresolved" or "What's next" section — that's SUMMARY.md's job. Use project-relative file paths (e.g., `src/components/BookingDrawer.tsx`).

### B5. Collect knowledge feedback

If knowledge was recalled during `/start` B3, collect feedback to improve future retrieval:

1. List each recalled entry by title
2. For each, ask: helpful, harmful, or neutral?
3. Call `kb_feedback(entry_id, rating)` for each rated entry

This feeds the maturity lifecycle (Progenitor → Proven → Mature) and apoptosis (auto-prune below 0.3 success rate after 5 ratings).

If no knowledge was recalled, or the user wants to skip, move on.

---

## Present Summary

**If project session (Part A + B):**
```
Session N Complete — [Date]

Accomplished:
- [list of what was done]

Files Changed:
- [list of files]

Next Session:
- [from next-session.md handoff]

Captured:
- [any supplemental experiences, or "hooks will handle it"]

Blockers:
- [any blockers, or "None"]
```

**If lightweight session (Part B only):**
```
Captured:
- [supplemental experiences, or "hooks will handle it"]
Session summary stored.
```

---

## Judgment calls

- Not every session produces experiences beyond what hooks capture. A quick Q&A might have nothing extra — that's fine, just say "hooks will handle the session log."
- Prefer fewer, high-quality supplemental experiences over many trivial ones.
- If Aaron says "don't store that," respect it immediately.
- **Never skip /end.** Even for short sessions. The next session's quality depends on it.
