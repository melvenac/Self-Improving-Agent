# /end — Store this session's lessons (Cursor + SIA)

> **Cursor Composer:** execute inline, through the open-brain MCP (`ob_recall`, `ob_store`, `ob_store_chunk`,
> `ob_recalled`, `ob_end`); requires `open-brain` in `~/.cursor/mcp.json`. Same steps as the Claude copy.

> **One job:** store each lesson this session learned, with the key that would have caught the
> mistake, then close the session's memory with `ob_end`. That is all `/end` does.

**`/end` writes no project state.** The record is written as the work happens, through `ob_state`:
the handoff with `set_handoff` when you hand back, a decision with `add_decision` when it is made,
a task's status when it moves. Every write records its session in `sessions[]` by itself, and a
session can only add or update its own handoff (schema v3, T-163), so there is nothing left for a
close-out to write and nothing it can erase. The SessionEnd hook writes the session summary,
auto-feedback and logging whether or not `/end` runs.

## 1. Find the lessons

A lesson is a wrong turn, a surprise, or a correction that a later session could repeat. Look at
what went wrong and what you had to re-do; most sessions have zero to three. Nothing to store is a
fine answer: say so and go to step 3.

## 2. Store each one with its KEY

The recall trigger injects an entry only on a **deterministic match against the act** (T-170). An
entry with no machine-matchable key can only ever be found by someone who already knows to ask.

For each lesson, `ob_recall` its title first (explicit trigger); skip it if it is already stored,
or add the new detail. Then call `ob_store` with `kind: "event"`:

```
[EXPERIENCE] {short title}
MATCH: {exactly one of:}
  command: {the command shape that did it, e.g. `| tail`, `git show <ref>:<path>`}
  path: {the file or glob where it bites, e.g. open-brain/src/shared/state-writer.ts}
  error: "{the exact error text you saw}"
  none — lookup only   {only when no act identifies it; say so, never leave MATCH out}
TRIGGER: {the moment it matters}
ACTION: {what to do — name the command, file or check, not a principle}
CONTEXT: {what happened and how it was found}
```

Tags: one tool tag and one problem-area tag at least. A long write-up (a spec, a close-out) goes
through `ob_store_chunk` instead. Read the stored row back if you passed anything new: a server
that has not been restarted strips unknown parameters and still reports success.

## 3. Close the session's memory

Call `ob_end` once. Pass `entry_ratings` only for entries that were **injected or recalled this
session** (`ob_recalled` lists them): `helpful` if it changed what you did, `harmful` if it misled
you, `neutral` if it was there and unused. Do not rate what you did not see.

## 4. Report

`Lessons stored: {n} — {title} [MATCH: command|path|error|none], ... · Ratings: {ids} or none`

## What moved out of /end

Session log (A1): `ob_start` creates it, local and untracked. SUMMARY/INBOX/task/next-session
(A2, A5–A7b): rendered from the record `ob_state` writes as work happens. DECISIONS/ENTITIES
(A3–A4): written with the change that makes them true. Doc drift (A9): `/sync`. Vault summary
(A13): the SessionEnd hook. Research (A10): step 2, `MATCH: none` unless an act identifies it.
