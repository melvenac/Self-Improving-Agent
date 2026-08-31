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

**Important:** This file already exists from the prior session. You MUST Read it first before using the Write tool (the Write tool refuses to overwrite unread files as a safety guard). Read it, then overwrite with the new content.

A short scratchpad for the next `/start` to read. Include:
- **Pick up here:** what was in progress or next in line
- **Watch out for:** any gotchas or blockers the next session should know
- **Open questions:** anything unresolved that the user's input

This file is overwritten each session — it's a relay baton, not a log.

### A8. Run Validation (if configured)
```
Run: validate:entities (if schema changed)
Run: validate:session:post (if it exists)
```

### A9. Doc drift audit

Run the automated doc sync, then check for any remaining drift this session's changes may have caused.

**Step 1: Run consistency checker via MCP**

Call the `ob_sync` tool. This runs version-drift auto-fix + structural consistency checks using `package.json` as the source of truth. (Formerly `node scripts/sync.mjs` — the standalone script was retired in Session 33 and the logic moved into `open-brain` as `ob_sync`.)

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
CONCEPTS: {plain English sentence describing the topic area — enables semantic search}

FINDINGS: {key takeaways — what was learned}
DECISION: {what was decided — adopted, rejected, deferred, and why}
RELEVANCE: {how this connects to current work}
```

Use standardized source tags: `youtube-transcript`, `github-repo`, `notebooklm`, `docs`. Also include domain concept tags (e.g., `payments`, `deployment`, `memory-systems`) alongside implementation tags.

**Do not write the vault note yourself.** `ob_store` has been vault-first since
v0.6.0 — it writes `Experiences/{project}/{key}.md` and then indexes the row.
A second Write creates a duplicate at a path nothing reads.

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
CONCEPTS: {plain English sentence describing the problem domain — e.g., "Processing subscription payments via Stripe in a serverless Convex backend". This line is critical for semantic search — it lets recall match on natural language queries like "how did we handle payments?" even when specific tool names aren't mentioned.}

TRIGGER: {when this is relevant}
ACTION: {what to do or what was decided}
CONTEXT: {the full exchange — what was the user asking, what reasoning led here}
OUTCOME: {what happened, what to do differently}
```

**Tag guidance:** Always include BOTH implementation tags (specific tools/libraries: `stripe`, `convex`, `clerk`) AND domain concept tags (what problem area: `payments`, `billing`, `authentication`, `deployment`, `styling`). Domain tags enable fuzzy recall — someone searching "how did we handle auth?" should find Clerk experiences even without knowing we use Clerk.

**Do not write the vault note yourself.** `ob_store` writes
`Experiences/{project}/{key}.md` — **nested under the project**, which is the
layout `skill-scan` walks. Writing a flat `Experiences/{key}.md` alongside it
produces a duplicate that the scan reads as a separate experience.

Verify the store landed rather than trusting the success message: a rebuilt MCP
server that has not restarted yet will strip any newly-added parameter and still
report success. Read the row back if you passed something new.

### A13. Write session summary (Obsidian)

Write the enriched summary to
**`~/Obsidian Vault v2/Summaries/YYYY-MM-DD-{project-slug}.md`** with the Write tool.

The SessionEnd hook writes this same path via `writeSummary`, but it **returns
null if the file already exists** — so the enriched version written here wins,
and the hook's thinner one is only a fallback for a session that skipped `/end`.
That is the intended order; do not skip this step on the assumption the hook has
it covered. **If the file already exists** (a second session on one date), Read
it first, then Write to `YYYY-MM-DD-{project-slug}-s{N}.md` so the earlier
summary survives.

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

If knowledge was recalled during `/start`, self-evaluate each entry — don't ask the user.

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
5. Report ratings to the user (they can override if needed)

**`harmful` must be genuinely reachable, not just documented.** Across the first
760 ratings not one was `harmful`, and that zero was read as health. It was not:
the automatic SessionEnd path could only emit `helpful`/`neutral`, so the
apoptosis threshold was unsatisfiable rather than merely unmet. If an entry
actually misled you, rate it `harmful` — a rating vocabulary nothing ever uses
measures nothing. Equally, do **not** reach for `harmful` to mean "unused":
that is `neutral`. Not being mentioned is not evidence of harm.

Alternatively, pass all judgments in one call via
`ob_end(entry_ratings: {"42": "harmful", ...})`. That records counters and
`success_rate` but does **not** run maturity promotion or apoptosis — use
`ob_feedback` for any entry you expect to cross a lifecycle threshold.

**Why self-evaluate:** The user can't see whether recalled knowledge helped the agent's internal reasoning. The agent that consumed it is the only one who knows.

This feeds the maturity lifecycle (Progenitor → Proven → Mature) and apoptosis (auto-prune below 0.3 success rate after 5 ratings).

If no knowledge was recalled, skip this step.

---

## Part B: Knowledge Capture (no `.agents/`)

> For non-project sessions, run knowledge capture directly. Steps B1-B5 mirror A10-A14 above.

### B1. Capture external research
_(Same format as A10)_

### B2. Review for non-obvious lessons
_(Same format as A11)_

### B3. Store supplemental experiences
_(Same format as A12)_

### B4. Write session summary
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
- If the user says "don't store that," respect it immediately.
- **Never skip /end.** Even for short sessions. The next session's quality depends on it.
