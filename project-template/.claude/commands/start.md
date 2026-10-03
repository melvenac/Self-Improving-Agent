# /start — Session Start

> **One command, context-aware.** Detects whether you are in a project (`.agents/` exists) or a general session, and runs the matching startup.

Run this inline. **There is no startup subagent.** A relay that summarises the state is a place where
the state degrades; the agent doing the work should read the record itself, not an account of it.

**Do not invoke brainstorming, writing-plans, or any other multi-step skill during `/start`.** This is
a routine startup, not complex work.

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

**The briefing is rendered by `ob_start`, in code (T-233).** In the normal case the output ends its State content with a block that opens at the
`## Briefing` line and closes at `## End Briefing`: the serving-build line first, then usage, session line, drift, objective, next, pick-up, watch-outs, open questions, broken, working tree,
latest brief and skills, all built from the record by one function that every runtime shares. Do not rebuild, reorder, summarise or trim it, and do not open
`task.md`, `INBOX.md`, `SUMMARY.md` or `next-session.md` to fill a gap that is not there. Do not create a session log or reconcile drift yourself.

Task lines are `[status] id title` — **titles only, by design.** A task's rationale is its `note` in
`.agents/state.json` under `tasks[]`. Read that before you rule on, work or retire a task, not when you merely pick one.

### 3. Working tree

The briefing's `Working tree:` line already ran `git status --porcelain`. Run it yourself only when `ob_start` returned no Briefing block.

### 4. Residual reads

Skip any that do not exist. The briefing's `Skills:` line already read `.agents/skills/INDEX.md`.

1. `.agents/SYSTEM/domains.json`
2. `.agents/AGENT.md` — parse YAML frontmatter for `name`, `role`, `partner`

### 5. Coordination

**There is no mailbox step.** The `~/.agents/mailbox/` channel was retired in Loop 12: coordination
between seats is A2A (direct cross-session messages), which arrives on its own and needs no read.

**What a session start DOES need to read is the durable half, and it is in the repo:** the newest
brief, which `ob_start` names for you on its `Latest brief: <path> (<date>)` line (the newest
brief in `docs/loops/`, a file named `*brief.md`, `*rebrief.md` or an `-amendment-N` of either, by git commit date; do not pick one by loop number or by file name).
If that line is absent there is no brief to read. Read any boundary report the brief or the handoff
names. Decisions live in `.agents/state.json` `decisions[]` and already reached you through `ob_start`.

**A2A has no memory.** Anything a later session must be able to read goes in a tracked file before
the exchange ends — session 61’s close-out travelled by A2A alone and exists in no file anywhere.

### 6. Present the briefing

Print the lines from `## Briefing` down to and including `## End Briefing` from `ob_start`'s output, **verbatim**. No commentary, no summary of the summary, no
reordering. Then print one more line:

```
FLAGS: {anything to verify, or "none"}
```

The block is the briefing: WATCH OUT is every item the previous session wrote down, OPEN QUESTIONS omits the ones already resolved and counts them, and
NEXT is the backlog by priority, not a decision. If `ob_start` returned **no Briefing block** (`state.json` absent or invalid: the fallback text), say so
in FLAGS and build nothing from the prose files yourself.

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
