# /end — Session End (Smart Routing)

> **One command, context-aware.** Detects whether you're in a project (`.agents/` exists) or a general session, and runs the appropriate close-out.

## Step 0: Detect Context

Check if `.agents/` directory exists in the current working directory.

- **If `.agents/` exists** → Run **Full Project Close-Out** (Part A only)
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
node scripts/sync.mjs
```
This automatically fixes version drift and runs structural consistency checks using package.json as the source of truth.

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

### A10. Capture external research

> The SessionEnd hooks (`session-end.mjs` → `skill-scan.mjs`) auto-capture session logs and extract experiences. Steps A10-A14 catch what automation misses.
If any external research was done this session (GitHub repos, YouTube videos, website docs, NotebookLM content), store a knowledge entry for each source using `ob_store`:

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

### A11. Review for non-obvious lessons
The hooks extract experiences from explicit gotcha/decision patterns. Look for things they'd miss:
- Subtle patterns that emerged across multiple steps (not a single "aha" moment)
- Context about _why_ a decision was made that isn't obvious from the code
- Cross-project insights ("this pattern from project X applies to project Y")
- Corrections to existing experiences that turned out to be wrong

### A12. Store supplemental experiences
For anything the hooks would miss, use `ob_store` directly. **Dedup first:** run `ob_recall` with each experience title before storing — skip if >90% similar already exists, update if there's meaningful new detail.

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

### A13. Write session summary (dual-store)

Write the session summary to **both** stores:

1. **SQLite:** `ob_store_summary(session_id, summary_text)` — for keyword search via `ob_recall`
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

### A14. Collect knowledge feedback (agent self-evaluation)

If knowledge was recalled during `/start`, self-evaluate each entry — don't ask Aaron.

1. Read `.recalled-entries.json` to get the recalled entry IDs and keys
2. For each entry, self-assess:
   - Did I reference this in my reasoning or approach?
   - Did it change how I tackled a problem?
   - Did it lead me astray or waste time?
3. Rate accordingly:
   - **helpful** — actively informed a decision or prevented a mistake
   - **harmful** — misled reasoning or caused wasted effort
   - **neutral** — recalled but not referenced or used
4. Call `ob_feedback(entry_id, rating, referenced)` for each
5. Report ratings to Aaron (he can override if needed)

**Why self-evaluate:** Aaron can't see whether recalled knowledge helped the agent's internal reasoning. The agent that consumed it is the only one who knows.

This feeds the maturity lifecycle (Progenitor → Proven → Mature) and apoptosis (auto-prune below 0.3 success rate after 5 ratings).

If no knowledge was recalled, skip this step.

### A15. Call ob_end with v2 pipeline args

After all knowledge capture and feedback steps are complete, call `ob_end` to finalize the session in the Open Brain pipeline. Pass the v2 paths so the session lands in the new stores:

```
ob_end(
  v2_db_path:    "~/.claude/open-brain/knowledge-v2.db",
  v2_vault_path: "~/Obsidian Vault v2"
)
```

This writes the session summary and any extracted experiences into the v2 SQLite database and v2 Obsidian vault. If `ob_end` returns an error, log a warning but do not block the rest of the close-out.

---

## Part B: Knowledge Capture (no `.agents/`)

> For non-project sessions, run knowledge capture directly. Steps B1-B5 mirror A10-A14 above.

### B1. Capture external research
_(Same format as A10)_

### B2. Review for non-obvious lessons
_(Same format as A11)_

### B3. Store supplemental experiences
_(Same format as A12)_

### B4. Write session summary (dual-store)
_(Same format as A13)_

### B5. Collect knowledge feedback
_(Same format as A14)_

---

## Present Summary

**If project session (Part A):**
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
