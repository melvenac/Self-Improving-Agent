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
7. `~/Obsidian Vault v2/Skill-Candidates/SKILL-INDEX.md`
8. `~/Obsidian Vault v2/.skill-proposals-pending.json`
9. `.agents/SYSTEM/domains.json`
10. `.agents/AGENT.md` — YAML frontmatter: name, role, partner

**Focus:** Read only the **CURRENT STATE** block in SUMMARY unless schema/scope work requires more.

### A3. Knowledge recall

- `ob_recall(queries: [Q1, Q2], project: "{cwd}", limit: 5, trigger: "start")` — Q1/Q2 from top INBOX priorities (methodology, not file names)
- If results < 3: `ob_recall(..., global: true, limit: 5, trigger: "start")`
- Checkpoints: `ob_recall(queries: ["[CHECKPOINT]"], project: "{cwd}", sessions: 1, limit: 3, trigger: "checkpoint")`
- `trigger` marks these as session-start injection; deliberate mid-task recalls pass `trigger: "explicit"` (omitted = recorded as "unspecified")

### 5. Coordination

**There is no mailbox step.** The `~/.agents/mailbox/` channel was retired in Loop 12: coordination
between seats is A2A (direct cross-session messages), which arrives on its own and needs no read.

**What a session start DOES need to read is the durable half, and it is in the repo:** the newest
brief and boundary reports in `docs/loops/`, by the largest loop number. Decisions live in
`.agents/state.json` `decisions[]` and already reached you through `ob_start`.

**A2A has no memory.** Anything a later session must be able to read goes in a tracked file before
the exchange ends — session 61’s close-out travelled by A2A alone and exists in no file anywhere.

### A5. Reconcile drift

- `task.md` "Done" vs INBOX `[x]` — fix mismatches
- SUMMARY version vs `package.json` — fix stale "What's next"

### A6. Create session log

If `.agents/SESSIONS/` exists: copy `SESSION_TEMPLATE.md` → next `Session_N.md` or `YYYY-MM-DD.md`. Fill date + UUID.

### A6b. Hub room, before any proposal

Read `.agents/SYSTEM/hub-partner-seats.json`. ob_start reads the same file. Your seat is the directory name after `sia-`. If that entry has `cursor: true`, run its `talk` line with `--inbox` (substitute `{hub_url}`, `{hub_name}`, `{room}`). An unread turn from atlas is the assignment: name it in the greeting and propose nothing else. Then run the same line with `--wait --wait-timeout 3500` after you post, and again on exit 2. One wait at a time.

### A7. Present greeting (≤300 tokens)

```
GREETING:
Session N — {date}
Project: {name} {version}
State: {2 sentences from SUMMARY CURRENT STATE}
Proposed: {top open INBOX item}

Knowledge:
- {entry}: {one-line actionable rewrite}

Latest brief: {newest docs/loops/loop-N-*.md} ({date})
Handoff: {from next-session.md, or "none"}
Skills: {relevant + pending proposal count}

FLAGS: {verify items, or "none"}
```

Greet the user by name. Present GREETING verbatim. If FLAGS non-empty, verify before continuing.

---

## Part B: Lightweight Startup (no `.agents/`)

1. Register session (same UUID logic → `ob_set_session`)
2. `ob_recall` with queries from cwd context; broaden if < 3 results
3. Checkpoint recall as Part A
4. Read Skill-Candidates index + pending proposals
5. Greet the user; present knowledge + skills + checkpoints

---

## Judgment calls

- If the user jumps straight into work, adapt — read state in background.
- Greeting **≤5 lines** of prose beyond the GREETING block.
- If the user says "skip", drop protocol and work.
- First session of month: optional maintenance (summarize aging sessions, `ob_score`, stale experience review) — see full SIA docs.
