# /start — Session Start (Smart Routing)

> **One command, context-aware.** Detects whether you're in a project (`.agents/` exists) or a general session, and runs the appropriate startup.

## Step 0: Detect Context

Check if `.agents/` directory exists in the current working directory.

- **If `.agents/` exists** → Run **Full Project Startup** (Part A only)
- **If no `.agents/`** → Run **Lightweight Startup** (Part B only)

---

## Part A: Project Startup (only if `.agents/` exists)

> Read project state so you can pick up where the last session left off.

### Meta Mode Detection

If `.agents/META/` exists, this is the **framework template repo itself**. In meta mode:
- Read state from `META/` files, NOT the `SYSTEM/` templates
- Only reference `SYSTEM/` files when working on template content

### A1. Read current state
```
If META/ exists:  Read: .agents/META/SUMMARY.md
Otherwise:        Read: .agents/SYSTEM/SUMMARY.md
```
Understand where the project is — what's working, what's broken, what's next.

### A2. Read task priorities
```
If META/ exists:  Read: .agents/META/INBOX.md
Otherwise:        Read: .agents/TASKS/INBOX.md
```
Also read `.agents/TASKS/task.md` to understand current sprint focus.

### A3. Reconcile INBOX vs task.md
- Compare items marked "Done" in `task.md` against INBOX.md status
- If any task.md "Done" items are still `[ ]` in INBOX, flag them and fix before proceeding
- This catches drift from prior sessions where `/end` missed an INBOX update

### A3b. Check SUMMARY.md for staleness
- Compare the version in SUMMARY.md status line against `package.json` version
- Compare "What's broken or incomplete" against completed INBOX items — if something marked `[x]` in INBOX is still listed as broken in SUMMARY, fix it
- Compare "What's next" against current INBOX priorities — if they don't match, update SUMMARY
- If any drift is found, fix SUMMARY.md immediately before proceeding
- This is the safety net for `/end` missing the SUMMARY update

### A4. Check project skills
```
Read: .agents/skills/INDEX.md (if it exists)
```
Note any project-specific skills relevant to today's work.

### A5. Generate project CLAUDE.md (if missing)
If the project has `.agents/` but no `CLAUDE.md` in the project root, offer to generate one:
- Read SUMMARY.md for project description
- Read ENTITIES.md for data model context
- Read INBOX.md for current priorities
- Generate a lightweight `CLAUDE.md` with:
  - Project name and one-line description
  - Tech stack (from package.json, etc.)
  - Key conventions from `.agents/SYSTEM/RULES.md` if it exists
  - Pointer to `.agents/` for full context
- Ask Aaron before writing: "No CLAUDE.md found — want me to generate one from .agents/ state?"

### A6. Create session log
```
Copy: .agents/SESSIONS/SESSION_TEMPLATE.md → .agents/SESSIONS/Session_N.md (next number)
```
Fill in the date. Leave objective blank until Aaron approves.

### A7. Discover and register session UUID

Claude Code stores session data under `~/.claude/projects/<project-key>/<session-uuid>/`. The project key is derived from the cwd (e.g., `C:\Users\melve\Projects\Foo` → `C--Users-melve-Projects-Foo`), but casing varies. Discovery algorithm:

1. **Derive expected key:** Take cwd, replace `:\` with `--`, remaining `\` or `/` with `-`
2. **Case-insensitive match:** Find the directory under `~/.claude/projects/` whose name matches (case-insensitive)
3. **Find newest session:** List `.jsonl` files in that directory, sort by mtime descending. The newest `.jsonl` filename (minus extension) is the current session UUID.
   - Filter to UUID-shaped names only (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) — skip `memory/` and other non-UUID entries.
4. **Register:** Call `ob_set_session(session_id)` with the discovered UUID
5. **Record:** Write the session_id into `Session_N.md` header: `> **Session ID:** {session_id}`
6. **Include** the session_id when writing `.recalled-entries.json` (see B3)

**If discovery fails:** Do NOT fabricate a UUID. Log a warning: "UUID discovery failed — provenance tracking disabled for this session." Continue without calling `ob_set_session`.

> **Platform note (Windows only):** This algorithm assumes Windows paths with drive letters (`C:\...`). Mac/Linux paths (`/home/user/...`, `/Users/user/...`) will need a different key derivation — no drive letter, no `:\` to replace. This is a future TODO for cross-platform support.

---

## Part B: Knowledge Recall (always runs)

> Surface relevant experiences and skills so you don't start from zero.
> Full protocol details: `~/docs/self-improving-agent-reference.md`

### B1. Greet
Greet Aaron by name. You are Clark.

### B2. Identify context
- Determine the current working directory and project
- Look up domain tags from `~/.claude/CLAUDE.md` (Guardrails section) or `~/docs/self-improving-agent-reference.md` (Domain Tags table)
- If `.agents/` exists, use INBOX.md to understand today's likely work

### B2.5. Discover and register session UUID (if not already done in A7)

If Part A didn't run (no `.agents/`), discover the session UUID here using the same algorithm as A7:
1. Derive project key from cwd, case-insensitive match under `~/.claude/projects/`
2. Find newest UUID-shaped `.jsonl` file by mtime
3. Call `ob_set_session(session_id)` to register with the MCP server
4. Write session_id into `.recalled-entries.json` (see B3)

**If discovery fails:** Do NOT fabricate a UUID. Skip silently and continue without provenance.

### B3. Knowledge recall
- **Knowledge MCP:** `ob_recall(queries: [Q1, Q2], project: cwd, limit: 5)` — methodology-focused queries, not file-specific
- Results are recency-weighted — recent experiences rank higher automatically
- If results < 3 for project scope, broaden: `ob_recall(queries: [Q1, Q2], global: true, limit: 5)`

### B4. Skills check
- Read `~/Obsidian Vault/Skill-Candidates/SKILL-INDEX.md` for matching skills
- Check `.skill-proposals-pending.json` — if new clusters exist, mention them to Aaron

### B5. Rewrite for today's task
- Rewrite each experience as **directly actionable** guidance for today's context
- Drop anything that matched by keyword but isn't actually useful
- Surface max **3 experiences** + **2 skills** as non-prescriptive context

### B6. Context budget check
Before injecting, estimate the context cost:
- If SUMMARY.md is over 50 lines, summarize it to 3-5 sentences instead of injecting raw
- If more than 3 experiences matched, pick the top 3 by relevance — don't inject all
- If the session will involve large files (e.g., full codebase review), keep startup injection minimal
- Goal: startup should consume <5% of the context window

---

## Step 1: Check for next-session handoff

If `.agents/SESSIONS/next-session.md` exists, read it and include in the summary. This file is written by `/end` and contains:
- What was in progress
- Gotchas to watch for
- Open questions

The bootstrap hook (`session-bootstrap.mjs`) may have already surfaced this — don't duplicate it, just incorporate.

---

## Present Summary

**If project session (Part A + B):**
```
Session N — [Date]
Project State: [1-2 sentences from SUMMARY.md]
Proposed Objective: [highest priority incomplete task from INBOX.md]

Relevant Knowledge:
- [experience title] — [one-line actionable rewrite]
- [skill name] — [why it's relevant]
```

### Reflection Queue

Before awaiting approval, check for pending experience distillations:

1. Check if `.agents/reflection-queue.json` exists
2. If it exists, read and parse it — it is an array of cluster objects, each with `tag`, `count`, and `files` fields
3. For each cluster, report:
   ```
   Reflection ready: {count} experiences tagged '{tag}' — want me to synthesize a principle?
   ```
4. If Aaron approves for a cluster:
   - Read all vault `.md` files listed in the cluster's `files` array
   - Synthesize a concise, reusable principle from the common patterns across those experiences
   - Present the proposed principle title and body for Aaron's review
   - If Aaron approves the principle:
     - Write it to `~/Obsidian Vault/Skills/{tag}-principle.md` (or a name Aaron provides)
     - Log the outcome: call `ob_end` or write directly to the reflection log marking status `approved` with the cluster tag and date
   - If Aaron rejects the principle: log status `rejected` with the cluster tag, date, and a 30-day re-flag embargo
5. If Aaron rejects synthesizing for a cluster (step 4 not entered): log status `rejected` the same way
6. After processing all clusters (approved or rejected), delete `.agents/reflection-queue.json`

```
Awaiting approval...
```

**If lightweight session (Part B only):**
```
Hey Aaron — [Date]

Relevant Knowledge:
- [experience title] — [one-line rewrite]
- [skill name] — [why it's relevant]

What would you like to work on?
```

---

## Periodic maintenance (run monthly or when prompted)

If it's the first session of the month, or Aaron asks for a health check:

### Session aging pipeline
1. Call `ob_summarize()` to find unsummarized sessions
2. For each (up to 5 per maintenance run):
   - Read the session chunks
   - Summarize into 3-5 sentences capturing: what was done, key decisions, gotchas
   - Call `ob_store_summary(session_id, summary, model)` to persist
3. Report: "Summarized N aging sessions"
4. If any summarized sessions are older than 30 days, note that their raw chunks can be pruned on next run

### Stale experience pruning
- Use `ob_list` to find knowledge entries with `recall_count = 0`
- Flag any not recalled in 90+ days
- Present the stale list to Aaron: "These experiences haven't been useful — prune them?"
- Only delete with Aaron's approval

### Skill candidate check
- Read `~/Obsidian Vault/Skill-Candidates/SKILL-CANDIDATES.md`
- If any cluster has 3+ experiences and hasn't been acted on, remind Aaron

---

## Judgment calls

- If Aaron jumps straight into a task, adapt. Read state in the background and surface anything relevant as you go. The protocol serves the work, not the other way around.
- Not every session needs recalled knowledge. If nothing is relevant, say so — don't force it.
- Keep the greeting and summary to **5 lines max**. Don't dump walls of text.
- **If Aaron says "skip" or starts talking about work**, drop the protocol and get to work.
