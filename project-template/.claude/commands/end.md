# /end — Store this session's lessons

> **One job:** store each lesson this session learned, with the key that would have caught the
> mistake, then close the session's memory with `ob_end`. That is all `/end` does.

**`/end` writes no project state.** The record is written as the work happens, through `ob_state`
(`set_handoff`, `add_decision`, a task's status). Every write records its session in `sessions[]`,
and no op can name, update or delete another session's handoff. **That rests on the REGISTERED
session, and the registration can be wrong:** a second session in the same checkout, a reconnected
server re-reading the checkout's hook slot, or a server that outlives a context clear can hold another
session's id. Only a different checkout's recorded session is refused. The SessionEnd hook, if
registered (`node scripts/setup.mjs` does it), writes the summary and logging whether or not `/end` runs.

## 1. Find the lessons

A lesson is a wrong turn, a surprise, or a correction that a later session could repeat. Look at
what went wrong and what you had to re-do; most sessions have zero to three. Nothing to store is a
fine answer: say so and go to step 3.

## 2. Store each one with its KEY

Give every lesson the key a machine could match against the act that repeats it. **Nothing reads
`MATCH:` yet:** the recall trigger matches on the command text, not on this line. The line is
written now so the entries exist, keyed, when something does read it.

For each lesson, `ob_recall` its title first (explicit trigger); skip it if it is already stored,
or add the new detail. Then call `ob_store` with `kind: "event"`:

```
[EXPERIENCE] {short title}
MATCH: {exactly one of:}
  command: {the command shape that did it, e.g. `| tail`, `git show <ref>:<path>`}
  path: {the file or glob where it bites, e.g. src/db/migrate.ts}
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

**Needs a session the server can PROVE is its own** (T-003): in Claude Code the SessionStart hook writes
the proof and `ob_set_session` only checks it. **Cursor writes no proof, so under Cursor nothing is
attributed** (ruling Q2). Without a proof `ob_recalled` says why and lists nothing, and the ratings are
zero, so report that, not "none". Call
`ob_end` once, with `entry_ratings` only for entries `ob_recalled` lists: `helpful` if it changed what
you did, `harmful` if it misled you, `neutral` if unused. Do not rate what you did not see.

## 4. Report

`Lessons stored: {n} — {title} [MATCH: command|path|error|none], ... · Ratings: {ids}, none, or "no proven session"`

## What moved out of /end

Session log: `ob_start`. SUMMARY, INBOX, task, next-session: rendered from what `ob_state` writes.
DECISIONS, ENTITIES: with the change that makes them true. Validation: `/sync`. Vault summary: the SessionEnd hook.
