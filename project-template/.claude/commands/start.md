# /start — Session Start (Smart Routing)

> **One command, context-aware.** Detects whether you're in a project (`.agents/` exists) or a general session, and runs the appropriate startup.

## Step 0: Detect Context

Check if `.agents/` directory exists in the current working directory.

- **If `.agents/` exists** → Run **Full Project Startup** (Part A only)
- **If no `.agents/`** → Run **Lightweight Startup** (Part B only)

---

## Part A: Project Startup (only if `.agents/` exists)

> Dispatch a subagent that loads project state through `ob_start` and returns a concise summary.
> Raw file contents stay in the subagent's context — only the summary enters yours.

### Meta Mode Detection

If `.agents/META/` exists, this is the **framework template repo itself**. In meta mode:
- `ob_start` resolves `META/SUMMARY.md` instead of `SYSTEM/SUMMARY.md` automatically
- For the residual reads below, use `META/` files, NOT the `SYSTEM/` templates
- Only reference `SYSTEM/` files when working on template content

### A1. Dispatch startup subagent

**ANTI-LOOP RULE: /start dispatches EXACTLY ONE background subagent (this step). There are NO other steps for the main agent except relaying the greeting. Do NOT dispatch additional Agent calls. Do NOT invoke brainstorming, writing-plans, or any other superpowers skills during /start — this is a routine startup sequence, not complex multi-step work.**

**Anti-loop protection:** `session-bootstrap.mjs` reads its hook input JSON from stdin and checks for `agent_id` — present only when the hook fires inside a subagent. If detected, the script exits silently.

**UUID from hook:** Look for `SESSION_UUID:` in the hook output at the top of this conversation. Pass it to the subagent. If not found, pass "none". The hook discovers the UUID deterministically — no Bash calls needed.

Use the Agent tool with `run_in_background: true` and the following prompt. Adapt the residual read paths for meta mode (`.agents/META/` vs `.agents/SYSTEM/`); `ob_start` needs no adapting:

```
You are a startup subagent. Do NOT invoke any skills, do NOT dispatch agents, do NOT run /start.

## 1. Register session
Session UUID: {UUID from hook output, or "none"}
If UUID is not "none": call ob_set_session(session_id: "{UUID}", project_dir: "{cwd}")
If "none": skip — provenance tracking disabled this session.
This step MUST run before step 2: ob_start stamps the registered id into the session log instead of guessing one from transcripts.

## 2. Load project state via ob_start
Call ob_start(project_root: "{cwd}") — exactly once. Its return is the project state:
- the full text of SUMMARY.md, INBOX.md, task.md and next-session.md, each under its own `## <file>` header ("absent" when the file does not exist)
- `Project: vX.Y.Z` (from package.json), `Drift detected (N): ...` or `Drift: none`
- the session block: `Session #N`, `Log: <path>`, `Session ID: <uuid>` — ob_start has already created Session_N.md
- a `## Sizes` block (per-file lines / words / ~tokens / truncated) and `Total returned words`
Use that state for every later step. Do NOT Read SUMMARY.md, INBOX.md, task.md or next-session.md yourself, do NOT create a session log yourself, and do NOT reconcile drift yourself — relay what ob_start reported.

Then read these residual files (skip any that don't exist):
1. .agents/skills/INDEX.md
2. .agents/SYSTEM/domains.json
3. .agents/AGENT.md — parse YAML frontmatter for name, role, partner, mailbox_channel (skip silently if absent)

> The two skill-proposal reads that sat here were removed with the skill scan
> (Loop 10 C2, CUT). Nothing writes `.skill-proposals-pending.json` now, so reading it
> would report a stale count from a file no longer produced — an absence reported as a
> healthy number.

## 3. Knowledge recall — REMOVED (Loop 10 C2, SUSPENDED)

Session-start recall injection is suspended and this step is deleted rather than
disabled: a flag can gate code deterministically, but an instruction an agent can
still read can still fire.

**Why.** The ranker earns its keep — on the repaired instrument `bm25_only` loses to
`live` 10–23, p=0.035. That is evidence about *ranking*, not about *injection*. The one
attempt to measure whether injected recall changes what an agent does collapsed to
p=0.688 once the control was topic-matched. On 2026-09-15 the checkpoint slot returned a
five-loop-stale entry that genuinely was the newest in scope; the entry describing the
defect that would have repaired the system had been recalled zero times in 1,311 rows; and
347 of 561 entries carry a NULL `project_dir`, so scoping cannot work for 62% of the
corpus. In the same session a fact injected at 100% delivery, top of context, every
session — `CLAUDE.md`'s own note that the summaries table does not exist — failed to
connect to this file's instruction to call two tools that do not exist.

**Reviving observation:** a topic-matched controlled comparison showing that sessions
receiving injected recall take different actions from sessions that do not. Not a
refinement of ranking, and not an uncontrolled before/after.

**Recover the deleted text at `bfee8c0:.claude/commands/start.md`.**

`ob_recall` remains available as a deliberate mid-task tool, called with
`trigger: "explicit"`. What is suspended is the automatic injection at session start.

## 4. Read mailbox (if AGENT.md declared a mailbox_channel)
Skip this step entirely if AGENT.md was absent or had no mailbox_channel.
Otherwise:
- Channel dir: `~/.agents/mailbox/channels/{mailbox_channel}/`
- Inbox file: `{partner.toLowerCase()}-to-{name.toLowerCase()}.md` (e.g. `atlas-to-forge.md`)
- Decisions file: `decisions.md`

Read both. From the inbox, grab the subject of the newest `## [YYYY-MM-DD ...] Sender — Subject` header (first one in the file after the intro). From decisions.md: parse all `## YYYY-MM-DD` headers, sort descending by date string (ISO format sorts correctly lexically), take the first result — do NOT assume last-in-file is most recent.

## 5. Return ONLY this format (under 300 tokens):

GREETING:
Session N — {date}   ← N from ob_start's session block
Project: {name} {version}
State: {2 sentences}
Drift: {relay ob_start's drift lines verbatim, or "none"}
Revision: {rev from ob_start's "## State (state.json rev N)" line, or "none"}
Proposed: {top incomplete task from INBOX}

Mailbox: {latest subject} | Last decision: {date}   ← omit this line entirely if no mailbox_channel
Handoff: {from next-session.md, or "none"}
Skills: {relevant skills from .agents/skills/INDEX.md, or "none"}

FLAGS: {anything to verify, or "none"}   ← include "no CLAUDE.md in project root" if that is the case (don't create one — ask the user first)
```

**Important:** Choose Q1/Q2 queries based on the top INBOX priorities. The subagent sees the raw state (from ob_start) and can make informed query choices.

### A2. Relay the greeting

When the background subagent completes, relay its GREETING section to the user. If FLAGS contains anything, verify it.

That's it. No further main-agent processing needed — the subagent handled ob_set_session, ob_start (state, session log, drift) and the mailbox read. Do NOT call ob_start again from the main agent: it creates a session log on every call.

If the subagent failed or timed out, fall back to a manual greeting:
- Greet the user by name. Use your configured agent name (from your global CLAUDE.md or .agents/AGENT.md) if one is set.
- State the cwd and that startup automation failed.
- Ask what they'd like to work on.

---

## Part B: Lightweight Startup (no `.agents/`)

> For non-project sessions, dispatch a lightweight subagent for knowledge recall and session registration.

### B1. Greet
Greet the user by name. Use your configured agent name (from your global CLAUDE.md or .agents/AGENT.md) if one is set.

### B2. Dispatch startup subagent

**UUID from hook:** Look for `SESSION_UUID:` in the hook output. Pass it to the subagent. If not found, pass "none".

Use the Agent tool with `run_in_background: true`:

```
You are a startup subagent for a non-project session. Do NOT invoke skills or dispatch agents.

## 1. Register session
Session UUID: {UUID from hook output, or "none"}
If not "none": call ob_set_session(session_id: "{UUID}", project_dir: "{cwd}")

## 2. Return ONLY:

GREETING:
Hey {user} — {date}

FLAGS: {anything to verify, or "none"}
```

### B3. Relay the greeting

Same as A2 — relay GREETING, check FLAGS, done. No further main-agent processing.

---

## Present Summary

The background subagent returns a formatted GREETING. Relay it verbatim to the user, prefixed with a personal greeting and your agent name if one is configured. Do NOT add extra commentary, tool calls, or processing. The greeting IS the output.

If FLAGS contains items, verify them before presenting. If the subagent failed, greet the user manually and state that startup automation failed.

---

## Periodic maintenance (run monthly or when prompted)

If it's the first session of the month, or the user asks for a health check:

### Session aging pipeline — REMOVED (Loop 10 C2, CUT)

**It instructed calls to `ob_summarize()` and `ob_store_summary()`, neither of which
exists.** The server registers fourteen tools and neither name is among them; there is no
match anywhere in `open-brain/src`. The step could never have executed.

It survived because it was identical in all three mirrors, and `/sync`'s `command-parity`
check compares the copies **to each other** rather than the tool names to the server's
registry — so three identical copies of a false instruction agreed perfectly and the check
reported `pass`. Recover the deleted text at `bfee8c0:.claude/commands/start.md`.

### Stale experience pruning
- Use `ob_list` to find knowledge entries with `recall_count = 0`
- Flag any not recalled in 90+ days
- Present the stale list to the user: "These experiences haven't been useful — prune them?"
- Only delete with the user's approval

### Skill candidate check — REMOVED (Loop 10 C2, CUT)

The skill scan and its proposal machinery were cut: six months produced **0 skills** from
39 proposals, none of which was ever acted on. Nothing now writes
`.skill-proposals-pending.json` and nothing reads it. The vault notes are untouched.

### Protocol health score
1. If in the Self-Improving-Agent project, run `node open-brain/build/cli.js sync --score`
2. Report the score and per-category breakdown
3. If any category is below 50%, flag it: "Knowledge quality needs attention — only X% recall precision"
4. Show trend if history exists: "Score: 72 (+4 from last month)"

---

## Judgment calls

- If the user jumps straight into a task, adapt. Read state in the background and surface anything relevant as you go. The protocol serves the work, not the other way around.
- Not every session needs recalled knowledge. If nothing is relevant, say so — don't force it.
- Keep the greeting and summary to **5 lines max**. Don't dump walls of text.
- **If the user says "skip" or starts talking about work**, drop the protocol and get to work.
