# /start — Session Start (Cursor + SIA)

> **Cursor Composer:** Execute all steps **inline in this agent** — do NOT dispatch a background subagent or Task. Use **open-brain MCP tools** (`ob_set_session`, `ob_recall`, etc.). Requires `open-brain` in `~/.cursor/mcp.json`.
>
> **One command, context-aware.** If `.agents/` exists → Part A. Otherwise → Part B.

## Step 0: Detect Context

Check if `.agents/` exists in the current working directory.

- **`.agents/` exists** → **Part A** (project startup)
- **No `.agents/`** → **Part B** (lightweight startup)

---

## Part A: Project Startup

### Meta mode

If `.agents/META/` exists, read/write `META/` files — not `SYSTEM/` templates (framework dev repo).

### A1. Register session

**Session UUID:** Look for `SESSION_UUID:` in hook output at the top of this conversation (from `sessionStart` hook). If missing, use `"none"`.

- If UUID is not `"none"`: call `ob_set_session(session_id: "{UUID}", project_dir: "{cwd}")`
- If `"none"`: skip — provenance disabled this session

### A2. Read project state

Read these files (skip missing):

1. `.agents/SYSTEM/SUMMARY.md` (or `.agents/META/SUMMARY.md`)
2. `.agents/TASKS/INBOX.md` (or `.agents/META/INBOX.md`)
3. `.agents/TASKS/task.md`
4. `.agents/SESSIONS/next-session.md`
5. `.agents/skills/INDEX.md`
6. `package.json` (version field only)
7. `~/Obsidian Vault/Skill-Candidates/SKILL-INDEX.md`
8. `~/Obsidian Vault/.skill-proposals-pending.json`
9. `.agents/SYSTEM/domains.json`
10. `.agents/AGENT.md` — YAML frontmatter: name, role, partner, mailbox_channel

**Focus:** Read only the **CURRENT STATE** block in SUMMARY unless schema/scope work requires more.

### A3. Knowledge recall

- `ob_recall(queries: [Q1, Q2], project: "{cwd}", limit: 5)` — Q1/Q2 from top INBOX priorities (methodology, not file names)
- If results < 3: `ob_recall(..., global: true, limit: 5)`
- Checkpoints: `ob_recall(queries: ["[CHECKPOINT]"], project: "{cwd}", sessions: 1, limit: 3)`

### A4. Write `.recalled-entries.json`

Write to project root `{cwd}/.recalled-entries.json`. Merge with existing (dedupe by id). Only `result_type: "knowledge"`.

```json
{
  "session_id": "{UUID or null}",
  "session_start": "{ISO timestamp}",
  "queries": ["..."],
  "entries": [{ "id": N, "key": "...", "source": "knowledge" }]
}
```

### A5. Mailbox (if AGENT.md has mailbox_channel)

- `~/.agents/mailbox/channels/{mailbox_channel}/`
- Inbox: `{partner}-to-{name}.md` · Decisions: `decisions.md`
- Newest inbox subject + most recent decision date (sort `## YYYY-MM-DD` headers descending)

### A6. Reconcile drift

- `task.md` "Done" vs INBOX `[x]` — fix mismatches
- SUMMARY version vs `package.json` — fix stale "What's next"

### A7. Create session log

If `.agents/SESSIONS/` exists: copy `SESSION_TEMPLATE.md` → next `Session_N.md` or `YYYY-MM-DD.md`. Fill date + UUID.

### A8. Present greeting (≤300 tokens)

```
GREETING:
Session N — {date}
Project: {name} {version}
State: {2 sentences from SUMMARY CURRENT STATE}
Proposed: {top open INBOX item}

Knowledge:
- {entry}: {one-line actionable rewrite}

Mailbox: {latest} | Last decision: {date}   ← omit if no mailbox
Handoff: {from next-session.md, or "none"}
Skills: {relevant + pending proposal count}

FLAGS: {verify items, or "none"}
```

Greet Aaron by name. Present GREETING verbatim. If FLAGS non-empty, verify before continuing.

---

## Part B: Lightweight Startup (no `.agents/`)

1. Register session (same UUID logic → `ob_set_session`)
2. `ob_recall` with queries from cwd context; broaden if < 3 results
3. Checkpoint recall as Part A
4. Write `.recalled-entries.json` in cwd
5. Read Skill-Candidates index + pending proposals
6. Greet Aaron; present knowledge + skills + checkpoints

---

## Judgment calls

- If Aaron jumps straight into work, adapt — read state in background.
- Greeting **≤5 lines** of prose beyond the GREETING block.
- If Aaron says "skip", drop protocol and work.
- First session of month: optional maintenance (summarize aging sessions, `ob_score`, stale experience review) — see full SIA docs.
