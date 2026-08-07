# /start — Session Start (Smart Routing)

> **One command, context-aware.** Detects whether you're in a project (`.agents/` exists) or a general session, and runs the appropriate startup.

## Step 0: Detect Context

Check if `.agents/` directory exists in the current working directory.

- **If `.agents/` exists** → Run **Full Project Startup** (Part A only)
- **If no `.agents/`** → Run **Lightweight Startup** (Part B only)

---

## Part A: Project Startup (only if `.agents/` exists)

> Dispatch a subagent to read all project state and return a concise summary.
> Raw file contents stay in the subagent's context — only the summary enters yours.

### Meta Mode Detection

If `.agents/META/` exists, this is the **framework template repo itself**. In meta mode:
- Read state from `META/` files, NOT the `SYSTEM/` templates
- Only reference `SYSTEM/` files when working on template content

### A1. Dispatch startup subagent

**ANTI-LOOP RULE: /start dispatches EXACTLY ONE background subagent (this step). There are NO other steps for the main agent except relaying the greeting. Do NOT dispatch additional Agent calls. Do NOT invoke brainstorming, writing-plans, or any other superpowers skills during /start — this is a routine startup sequence, not complex multi-step work.**

**Anti-loop protection:** `session-bootstrap.mjs` reads its hook input JSON from stdin and checks for `agent_id` — present only when the hook fires inside a subagent. If detected, the script exits silently.

**UUID from hook:** Look for `SESSION_UUID:` in the hook output at the top of this conversation. Pass it to the subagent. If not found, pass "none". The hook discovers the UUID deterministically — no Bash calls needed.

Use the Agent tool with `run_in_background: true` and the following prompt. Adapt file paths for meta mode (`.agents/META/` vs `.agents/SYSTEM/`):

```
You are a startup subagent. Do NOT invoke any skills, do NOT dispatch agents, do NOT run /start.

## 1. Register session
Session UUID: {UUID from hook output, or "none"}
If UUID is not "none": call ob_set_session(session_id: "{UUID}", project_dir: "{cwd}")
If "none": skip — provenance tracking disabled this session.

## 2. Read project state
Read these files (skip any that don't exist):
1. .agents/SYSTEM/SUMMARY.md (or .agents/META/SUMMARY.md if META/ exists)
2. .agents/TASKS/INBOX.md (or .agents/META/INBOX.md)
3. .agents/TASKS/task.md
4. .agents/SESSIONS/next-session.md
5. .agents/skills/INDEX.md
6. package.json (version field only)
7. ~/Obsidian Vault v2/Skill-Candidates/SKILL-INDEX.md
8. ~/Obsidian Vault v2/.skill-proposals-pending.json
9. .agents/SYSTEM/domains.json
10. .agents/AGENT.md — parse YAML frontmatter for name, role, partner, mailbox_channel (skip silently if absent)

## 3. Knowledge recall
- ob_recall(queries: [Q1, Q2], project: "{cwd}", limit: 5)
  Choose Q1/Q2 based on INBOX.md priorities (methodology-focused, not file-specific).
- If results < 3, broaden: ob_recall(queries: [Q1, Q2], global: true, limit: 5)
- Check for checkpoints: ob_recall(queries: ["[CHECKPOINT]"], project: "{cwd}", sessions: 1, limit: 3)

## 4. Write .recalled-entries.json
Write to .recalled-entries.json in the project root (cwd), NOT ~/.claude/context-mode/.
Read .recalled-entries.json first (may exist from prior session).
Merge new recalled entries (deduplicate by id), update session_start timestamp.
Only include entries with result_type: "knowledge" (not summaries).
Write the merged result:
{
  "session_id": "{UUID or null}",
  "session_start": "{ISO timestamp}",
  "queries": ["{all unique queries}"],
  "entries": [{ "id": N, "key": "entry-key", "source": "knowledge" }]
}

## 5. Read mailbox (if AGENT.md declared a mailbox_channel)
Skip this step entirely if AGENT.md was absent or had no mailbox_channel.
Otherwise:
- Channel dir: `~/.agents/mailbox/channels/{mailbox_channel}/`
- Inbox file: `{partner.toLowerCase()}-to-{name.toLowerCase()}.md` (e.g. `atlas-to-forge.md`)
- Decisions file: `decisions.md`

Read both. From the inbox, grab the subject of the newest `## [YYYY-MM-DD ...] Sender — Subject` header (first one in the file after the intro). From decisions.md: parse all `## YYYY-MM-DD` headers, sort descending by date string (ISO format sorts correctly lexically), take the first result — do NOT assume last-in-file is most recent.

## 6. Reconcile drift
- Compare items marked "Done" in task.md against INBOX.md status. Fix any mismatches.
- Compare SUMMARY.md version against package.json. Fix stale "What's next" or "What's broken".

## 7. Create session log (if .agents/SESSIONS/ exists)
Copy SESSION_TEMPLATE.md → Session_N.md (next number). Fill in date and session UUID.
If no CLAUDE.md in project root, note it in FLAGS (don't create one — ask Aaron first).

## 8. Return ONLY this format (under 300 tokens):

GREETING:
Session N — {date}
Project: {name} {version}
State: {2 sentences}
Proposed: {top incomplete task from INBOX}

Knowledge:
- {entry}: {one-line actionable rewrite}

Mailbox: {latest subject} | Last decision: {date}   ← omit this line entirely if no mailbox_channel
Handoff: {from next-session.md, or "none"}
Skills: {relevant skills + pending proposal count}

FLAGS: {anything to verify, or "none"}
```

**Important:** Choose Q1/Q2 queries based on the top INBOX priorities. The subagent sees the raw files and can make informed query choices.

### A2. Relay the greeting

When the background subagent completes, relay its GREETING section to Aaron. If FLAGS contains anything, verify it.

That's it. No further main-agent processing needed — the subagent handled ob_set_session, .recalled-entries.json, session log creation, and drift reconciliation.

If the subagent failed or timed out, fall back to a manual greeting:
- Greet Aaron by name. You are Clark.
- State the cwd and that startup automation failed.
- Ask what he'd like to work on.

---

## Part B: Lightweight Startup (no `.agents/`)

> For non-project sessions, dispatch a lightweight subagent for knowledge recall and session registration.

### B1. Greet
Greet Aaron by name. You are Clark.

### B2. Dispatch startup subagent

**UUID from hook:** Look for `SESSION_UUID:` in the hook output. Pass it to the subagent. If not found, pass "none".

Use the Agent tool with `run_in_background: true`:

```
You are a startup subagent for a non-project session. Do NOT invoke skills or dispatch agents.

## 1. Register session
Session UUID: {UUID from hook output, or "none"}
If not "none": call ob_set_session(session_id: "{UUID}", project_dir: "{cwd}")

## 2. Knowledge recall
- ob_recall(queries: [Q1, Q2], project: "{cwd}", limit: 5)
  Choose queries based on the working directory context.
- If results < 3: ob_recall(queries: [Q1, Q2], global: true, limit: 5)
- Checkpoint: ob_recall(queries: ["[CHECKPOINT]"], project: "{cwd}", sessions: 1, limit: 3)

## 3. Write .recalled-entries.json
Write to .recalled-entries.json in the working directory (cwd), NOT ~/.claude/context-mode/.
Read .recalled-entries.json first (may have prior entries).
Merge new recalled entries (deduplicate by id, only result_type: "knowledge").
Write merged result with session_id, session_start, queries, entries.

## 4. Skills check
Read ~/Obsidian Vault v2/Skill-Candidates/SKILL-INDEX.md
Read ~/Obsidian Vault v2/.skill-proposals-pending.json

## 5. Return ONLY:

GREETING:
Hey Aaron — {date}

Knowledge:
- {entry}: {one-line actionable rewrite}

Skills: {relevant + pending count}
Checkpoints: {count or "none"}

FLAGS: {anything to verify, or "none"}
```

### B3. Relay the greeting

Same as A2 — relay GREETING, check FLAGS, done. No further main-agent processing.

---

## Present Summary

The background subagent returns a formatted GREETING. Relay it verbatim to Aaron, prefixed with "Hey Aaron" and your name (Clark). Do NOT add extra commentary, tool calls, or processing. The greeting IS the output.

If FLAGS contains items, verify them before presenting. If the subagent failed, greet Aaron manually and state that startup automation failed.

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
- Read `~/Obsidian Vault v2/Skill-Candidates/SKILL-CANDIDATES.md`
- If any cluster has 3+ experiences and hasn't been acted on, remind Aaron

### Protocol health score
1. If in the Self-Improving-Agent project, run `node scripts/sync.mjs --score`
2. Report the score and per-category breakdown
3. If any category is below 50%, flag it: "Knowledge quality needs attention — only X% recall precision"
4. Show trend if history exists: "Score: 72 (+4 from last month)"

---

## Judgment calls

- If Aaron jumps straight into a task, adapt. Read state in the background and surface anything relevant as you go. The protocol serves the work, not the other way around.
- Not every session needs recalled knowledge. If nothing is relevant, say so — don't force it.
- Keep the greeting and summary to **5 lines max**. Don't dump walls of text.
- **If Aaron says "skip" or starts talking about work**, drop the protocol and get to work.
