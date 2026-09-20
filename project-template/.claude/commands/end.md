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
- Check off a post-session checklist item **only after the action it names has finished and you have
  seen its result** — never in the same edit that plans it. A box ticked ahead of the action cannot
  fail, and reads afterwards as evidence that the action happened (G-020: this is how a Planner came
  to report that `/end` had never run).

### Which regime you are in — decide once, here

**If `.agents/state.json` exists: A2, A5, A6 and A7 do not run. Skip all four and write the state in
A7b instead.** Those four steps edit files that are rendered views of `state.json`; a hand edit to
any of them is overwritten by the next render and is not state. This is the regime this repo is in.

**If `.agents/state.json` is absent:** A2/A5/A6/A7 are the close-out, and A7b does not run.

The four steps below are marked `[no-state fallback]` so this test is made once rather than four
times.

### A2. Update SUMMARY.md `[no-state fallback]`
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

### A5. Update INBOX.md `[no-state fallback]`
```
If META/ exists:  Update: .agents/META/INBOX.md
Otherwise:        Update: .agents/TASKS/INBOX.md
```
- Mark completed tasks as `[x]`
- Add any new tasks discovered during the session
- Re-prioritize if needed

### A6. Update task.md `[no-state fallback]`
```
Update: .agents/TASKS/task.md
```
- Update task statuses to reflect what was completed
- If the current objective is done, note that the next session should pick a new one
- Clear stale tasks that no longer apply

### A7. Write next-session handoff `[no-state fallback]`
```
Write: .agents/SESSIONS/next-session.md
```

**Important:** This file already exists from the prior session. You MUST Read it first before using the Write tool (the Write tool refuses to overwrite unread files as a safety guard). Read it, then overwrite with the new content.

A short scratchpad for the next `/start` to read. Include:
- **Pick up here:** what was in progress or next in line
- **Watch out for:** any gotchas or blockers the next session should know
- **Open questions:** anything unresolved that the user's input

This file is overwritten each session — it's a relay baton, not a log.

### A7b. Write the state through `ob_state` (ONLY when `.agents/state.json` exists)

This one step replaces A2, A5, A6 and A7. The project's state is a record; the four prose files (SUMMARY.md's marked region, INBOX.md, task.md, next-session.md) are views rendered from it. **Never edit those four files by hand when state.json exists** — a hand edit is overwritten by the next render and is not state.

Compose the session's ops from what happened (A1 and A3 are your notes), then call once:

```
ob_state(session: N, expected_revision: R, ops: [...], render: true)
```

- `N` = this session's number; `R` = the `Revision:` line from this session's `/start` greeting.
- Ops, in this order, only the ones that apply:
  - `close_task {id, note?}` — finished items
  - `open_task {title, priority, note?, supersedes?}` — new work discovered
  - `update_task {id, status?, priority?, title?, note?}` — status/priority changes on open items
  - `reopen_task {id, note}` — a done item that regressed
  - `add_verified {claim, evidence: [{type, path, observation}]}` — behaviours proven this session, with the test/tag/file that proves each
  - `add_gap {what, evidence, recommended_update}` / `close_gap {id}`
  - `add_decision {title, date, note}` — one per ADR appended in A3
  - `set_objective {text}` — only if the objective changed (`null` clears it)
  - `set_handoff {seat, pick_up, watch_out[], open_questions[], loop_state?}` — the relay baton
    (A7's content), **for your seat**.

    **`seat` is required and is one of `planner` / `developer` / `qa`.** It replaces YOUR entry and
    leaves the other seats' alone. Before Loop 14 this was one project-wide slot, so under the roll
    rule the second seat to close out erased the first — which cost a session when a later message
    sent a fresh seat to a file that no longer held what it was said to hold (`G-046`).

    **Do not assert commit or push status in it.** This op runs inside `/end`, before anything is
    committed, so "THE COMMIT IS NOT MADE" is true when written and false when read — permanently,
    every loop. State what the work *is*; the tree is authoritative about whether it landed, and the
    next `/start` reads the tree.

    **THE PLANNER SEAT MUST PASS `loop_state`, AND THE WRITE IS REFUSED WITHOUT IT.** This is not a
    reminder — the schema and the op both refuse, so the rows cannot be skipped by forgetting:

    ```
    loop_state: {
      open_prs: [{ref, qa_status, note}],   // qa_status: not_started | in_progress | accepted | rejected | not_required
      frozen_sha: "<sha>" | null,           // the SHA frozen for a QA in progress
      questions_for_aaron: ["..."],         // pending, not answered
      rulings: ["..."]                      // made mid-loop, which nothing else records
    }
    ```

    **Every field may be EMPTY and none may be ABSENT.** `[]` and `null` are real answers — "no open
    PRs" is a state of the world. Absence is not an answer, and an optional field is one a seat
    remembers to fill, which is the failure `C3` names. These four rows are what the planner loses at
    every roll: the runtime's `D_t`, `E_t` and `G_*` say what a loop decided, built, judged and
    gated, and carry none of them. In slice two all four travelled by A2A and by the planner
    remembering.

    A developer or QA seat may pass `loop_state` when it knows one of these, and may omit it.
  - `end_session {n, date, uuid, seat}` — always last.

    **`seat` is required.** If `uuid` matches the session already recorded, the number is KEPT and
    the result says so: the number counts sessions, not close-out writes (`G-047`). One developer
    seat-session took three numbers in slice two, so read the `NOTE:` lines in the result rather than
    assuming `n` was accepted.
- On `revision mismatch`: call `ob_start` once to read the current revision, then retry the same batch once with that revision. Do not retry a third time; report the refusal in the session log.
- The tool validates every op and refuses the whole batch on any error; nothing is written until all ops apply.
- **Read the result's `NOTE:` lines and the `KEPT despite retention` line.** The writer reports what
  it did differently from what you asked. Retention now keeps a done task whose id the tracked tree
  cites (`T-157`), rather than evicting it and mentioning it in passing — that happened twice in two
  consecutive writes, and both times the task was preserved only because a seat read one line of dry
  run output and then grepped the repository by hand.

When `.agents/state.json` is absent, this step does not run and A2/A5/A6/A7 run as written.

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

> The single registered SessionEnd hook (`open-brain/build/cli-session-end.js`) runs the pipeline in
> `pipelines/session-end/index-v2.ts`: summary, auto-feedback, invocation logging, shadow recall,
> topics. Steps A10-A14 catch what it misses.
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
`Experiences/{project}/{key}.md` — **nested under the project**
(`vault-writer.ts:97`). Writing a flat `Experiences/{key}.md` alongside it
produces a duplicate note with no row behind it, which `/sync`'s
vault-index-parity check reads as an unindexed experience
(`pipelines/sync/checks.ts:352`).

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

1. Call `ob_recalled` to get the recalled entry IDs and keys. **Never read `.recalled-entries.json` directly.** `ob_recalled` resolves in a fixed precedence: explicit ids, then `recall_log` for this session, then the file *only* if it names this session, then nothing — with a reason. When the session is known, `recall_log` is authoritative and the file is not consulted at all. Nothing writes that file as of the Loop 5 release; any copy still on disk is a leftover, and the resolver refuses it when it names another session.
2. For each entry, self-assess:
   - Did I reference this in my reasoning or approach?
   - Did it change how I tackled a problem?
   - Did it lead me astray or waste time?
3. Rate accordingly:
   - **helpful** — actively informed a decision or prevented a mistake
   - **harmful** — misled reasoning or caused wasted effort
   - **neutral** — recalled but not referenced or used
4. Call `ob_feedback({id, rating})` for each — **those two arguments and no others.** The live schema
   is `{ id: number, rating: "helpful" | "harmful" | "neutral" }` (`server.ts:895-897`). There is no
   `referenced` parameter, and `entry_id` is not the name of the first one.
5. Report ratings to the user (they can override if needed)

**`harmful` must be genuinely reachable, not just documented.** Across the first
760 ratings not one was `harmful`, and that zero was read as health. It was not:
the automatic SessionEnd path could only emit `helpful`/`neutral`, so the
apoptosis threshold was unsatisfiable rather than merely unmet. If an entry
actually misled you, rate it `harmful` — a rating vocabulary nothing ever uses
measures nothing. Equally, do **not** reach for `harmful` to mean "unused":
that is `neutral`. Not being mentioned is not evidence of harm.

Alternatively, pass all judgments in one call via
`ob_end(entry_ratings: {"42": "harmful", ...})`. Both paths record the same thing: the aggregate
counters, plus a row in `feedback_log`. Neither derives anything further from it — pick whichever
suits the call you are already making.

**Why self-evaluate:** The user can't see whether recalled knowledge helped the agent's internal reasoning. The agent that consumed it is the only one who knows.

**What the rating does, as of Loop 10:** it increments the entry's counter and writes a `feedback_log`
row. That is all. `evaluateLifecycle` was cut with E3 and the apoptosis auto-delete with E18
(`server.ts:908-910`, `:938-942`); ranking no longer reads `maturity` or `success_rate`. Rate
honestly anyway — the log is the only record of what was judged, and the next question the corpus
gets asked will be asked of it. Retiring an entry is `ob_forget`, with a human in the loop.

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
