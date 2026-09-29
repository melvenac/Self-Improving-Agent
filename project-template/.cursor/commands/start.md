# /start — Session Start

> **One command, context-aware.** Detects whether you are in a project (`.agents/` exists) or a general session, and runs the matching startup.

Run this inline. **There is no startup subagent.** A relay that summarises the state is a place where
the state degrades; the agent doing the work should read the record itself, not an account of it.

**Do not invoke brainstorming, writing-plans, or any other multi-step skill during `/start`.** This is
a routine startup, not complex work.

Cursor MCP calls use CallDynamicTool. Read the schema with GetDynamicTools before the call.


## Step 0: Detect context

Does `.agents/` exist in the current working directory?

- **Yes** → Part A.
- **No** → Part B.

Run one part. Never both.

---

## Part A: Project startup

### Meta mode

If `.agents/META/` exists, this is the framework template repo. `ob_start` resolves `META/SUMMARY.md`
instead of `SYSTEM/SUMMARY.md` on its own. Use `META/` paths for the residual reads below. Only touch
`SYSTEM/` when working on template content itself.

### 1. Register the session

Find `SESSION_UUID:` in the hook output at the top of this conversation — the hook resolves it, so no
Bash call is needed.

- **Found:** `ob_set_session(session_id: "{UUID}", project_dir: "{cwd}")`
- **Absent:** skip; provenance tracking is off this session, and say so in FLAGS.

**This must run before step 2.** `ob_start` stamps the registered id into the session log instead of
guessing one from transcripts.

### 2. Load state

Call `ob_start(project_root: "{cwd}")`. Once is enough; a repeat call is not destructive — when a log
already exists for the registered session id it is **reused**, and the session line says so
(`Session #N (existing log for this session id — reused, nothing created)`). That line is the
check: if it is absent on a second call, a duplicate log was created and something is wrong with
session registration.

**What it returns depends on `state.json`, and the two shapes are different. Read whichever you got;
do not assume.**

**When `.agents/state.json` is present and valid — the normal case:**

- the session block: `Session #N`, `Log: <path>`, `Session ID: <uuid>` — the log is already created
- `Drift detected (N): ...` or `Drift: none`
- a `## Sizes` block listing the four prose files. **These sizes describe files that are NOT in the
  return.** They are reported so the substitution is visible, not because the content is there.
- **`## State (state.json rev N)`** — this **replaces** the four prose files and is everything you
  need: `Project`, `Objective` with `since_session`, `Tasks` grouped by priority (active only; done
  is a count), `Verified`, `Gaps`, `Decisions` count plus the latest, `Handoff` with pick-up,
  watch-outs and open questions, and `Last session`.
- `Total returned words`

**When `state.json` is absent or invalid — the fallback:** the full text of `SUMMARY.md`,
`INBOX.md`, `task.md` and `next-session.md`, each under its own `## <file>` header, with `absent`
spelled out for a missing file. An invalid `state.json` says so before falling back.

**Build the whole briefing from what `ob_start` returned.** In the normal case the `## State` block
carries every field the briefing needs — do not open `task.md`, `INBOX.md`, `SUMMARY.md` or
`next-session.md` to fill a gap that is not there. Do not create a session log or reconcile drift
yourself.

Task lines are `[status] id title` — **titles only, by design.** A task's rationale is its `note` in
`.agents/state.json` under `tasks[]`. Read that when you work a task, not when you pick one.

### 3. Working tree

Run `git status --porcelain`. Uncommitted work is state the record does not carry, and a session that
starts without knowing about it will misread someone else's in-flight change as drift. One command.

### 4. Residual reads

Skip any that do not exist:

1. `.agents/skills/INDEX.md`
2. `.agents/SYSTEM/domains.json`
3. `.agents/AGENT.md` — parse YAML frontmatter for `name`, `role`, `partner`

### 5. Coordination

**There is no mailbox step.** The `~/.agents/mailbox/` channel was retired in Loop 12: coordination
between seats is A2A (direct cross-session messages), which arrives on its own and needs no read.

**What a session start DOES need to read is the durable half, and it is in the repo:** the newest
brief and boundary reports in `docs/loops/`, by the largest loop number. Decisions live in
`.agents/state.json` `decisions[]` and already reached you through `ob_start`.

**A2A has no memory.** Anything a later session must be able to read goes in a tracked file before
the exchange ends — session 61’s close-out travelled by A2A alone and exists in no file anywhere.


### Hub room

Read `.agents/SYSTEM/hub-partner-seats.json` for this worktree's seat. Cursor seats run the file's hub-talk line with `--inbox` before the briefing. An unread turn from atlas is the assignment: name it and propose nothing else. After each post, run hub-talk with `--wait --wait-timeout 3500`, and again on exit 2. One wait at a time.

### 6. Present the briefing

Print this and stop. No commentary, no summary of the summary.

```
Session {N} — {date} · {project} v{version} · state rev {R}
Drift: {ob_start's drift lines verbatim, or "none"}

OBJECTIVE
{objective text} (since session {n})

NEXT
- [{priority}] {id} {title}          ← top 3 by priority from the State block
{n} active ({n} P0, {n} P1, {n} P2, {n} P3); {n} done

PICK UP HERE
{the handoff's pick-up, 2-3 sentences}

WATCH OUT
- {every item, VERBATIM}

OPEN QUESTIONS
- {every item, verbatim}

BROKEN ({n} gaps open; newest {m})
- {gaps, newest first, up to 5}
- {any task with status blocked}

Working tree: {clean | N uncommitted: path, path, ...}
Latest brief: {newest docs/loops/loop-N-*.md} ({date})
Skills: {relevant entries from .agents/skills/INDEX.md, or "none"}

FLAGS: {anything to verify, or "none"}
```

**Omit an empty section rather than printing a placeholder.**

**WATCH OUT is the highest-value part of this briefing.** It is short, already curated, and it is
where the previous session wrote down what will bite this one. Print every item verbatim. Never
summarise it, never drop items for length.

**NEXT is the backlog ranked by priority. It is not a decision.** If the handoff says the next
subject is unruled, or the objective is complete, **say so on the NEXT line** rather than presenting
three old P0s as though they were today's plan — a briefing whose sections disagree about whether
there is work to start has told the reader nothing.

Include in FLAGS: a missing `CLAUDE.md` in the project root (**do not create one — ask first**), a
missing `SESSION_UUID`, any drift reported as `not fixed`, and any MCP server that failed to connect.

---

## Part B: Lightweight startup (no `.agents/`)

1. Find `SESSION_UUID:` in the hook output. If present, call
   `ob_set_session(session_id: "{UUID}", project_dir: "{cwd}")`. If absent, skip.
2. Greet the user by name, using your configured agent name from global `CLAUDE.md` or
   `.agents/AGENT.md` if one is set.
3. Ask what they would like to work on.

---

## Periodic maintenance (monthly, or when asked)

Only on the first session of the month or an explicit health-check request.

**Stale experience pruning**
- `ob_list` for entries with `recall_count = 0`; flag any not recalled in 90+ days.
- Present the list: "These have never been recalled — prune them?"
- **Delete only with the user's approval.**

**Protocol health score**
- In Self-Improving-Agent: `node open-brain/build/cli.js sync --score`.
- Report the score and per-category breakdown; flag any category below 50%; show the trend if
  history exists.

---

## Judgment calls

- **If the user opens with a task, drop the protocol and work.** Read state as you go and surface
  what is relevant. The protocol serves the work.
- **Length follows content.** Seven watch-outs print as seven. Omit empty sections rather than
  padding, and never trim WATCH OUT or OPEN QUESTIONS to hit a length.
- **`ob_recall` is a deliberate mid-task tool**, called with `trigger: "explicit"`. Automatic
  injection at session start is suspended (Loop 10 C2); do not reintroduce it here.
