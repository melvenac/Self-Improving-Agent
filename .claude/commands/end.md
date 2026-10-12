# /end — Store this session's lessons

> **One job:** store each lesson this session learned, with the key that would have caught the
> mistake, then close the session's memory with `ob_end`. That is all `/end` does.

**`/end` writes no project state.** The record is written as the work happens, through `ob_state`
(`set_handoff`, `add_decision`, a task's status). A write that carries a session records that session
in `sessions[]`. A write with no session records nothing there, and says so. No op can name, update
or delete another session's handoff. A write is refused when its session is already recorded under a
different checkout (`checkout` set, and not this write's). A legacy session record (`checkout` null)
is not refused on that comparison. The SessionEnd hook, if
registered (`node scripts/setup.mjs` does it), writes the summary and logging whether or not `/end` runs.

## 1. Find the lessons

A lesson is a wrong turn, a surprise, or a correction that a later session could repeat. Look at
what went wrong and what you had to re-do; most sessions have zero to three. Nothing to store is a
fine answer: say so and go to step 3.

## 1b. Audit the commands you repeated (D-152)

Run the extractor on this session. It reads your transcript and writes nothing:

`node <build>/cli.js skills-audit [--seat <name>] "<project dir>"`

`<build>` is the open-brain build directory named on the SessionStart hook's `CLI start` line (in this
repository: `open-brain/build`). Pass `--seat <name>` when the header says `seat none` but you have an
ops skill at `~/.claude/skills/<name>-ops/`.

For **each `by-hand` row**, do exactly one of these, in this session:

1. **Script it.** Add or extend a script in your own `~/.claude/skills/<seat>-ops/scripts/` and run it once,
   live. Your own ops skill needs no per-script ask (D-152).
2. **Propose it.** Anything outside your own ops skill (a shared skill, a `/sync` check, an `ob_state` op) is
   one line in the step 4 report, for clark to take to Aaron. Never write it to a file or a queue.
3. **Drop it, with a reason.** To stop it returning, add the key to `audit-ignore.txt` in your ops directory
   as `<key> # <reason>`. If the reason is "already scripted and I did not use it", that is a lesson for
   step 2, keyed `MATCH: command: <key>`.

`script` rows are your existing scripts at work; they need nothing. No rows: report `0 hits`. If the
command exits 1, report its stderr line instead. A session that skips this step is named in the next
greeting (`SKILLS AUDIT NOT RUN`).

## 2. Store each one with its KEY

Give every lesson the key a machine could match against the act that repeats it. **Nothing reads
`MATCH:` yet:** the recall trigger matches on the command text, not on this line. The line is
written now so the entries exist, keyed, when something does read it.

For each lesson, `ob_recall` its title first with `purpose: "dedup"` (explicit trigger); skip it if it is already stored,
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

### Record gate (`RECORD NOT UPDATED`)

When this session has **committed work** (trailered commits, tags, or a `package.json` version bump) and the
**project record was not updated** for this session, `ob_end` **refuses** as its first line:
`RECORD NOT UPDATED: …` and writes nothing. Fix the record (`ob_state set_handoff` or any write that records
this session in `sessions[]` on the new layout; edit `.agents/SESSIONS/next-session.md` on the old layout), then
call `ob_end` again. To close without updating the record, pass `record_ok: "<reason>"` — the reason is stored and
printed once in the next session's greeting.

## 4. Report

`Lessons stored: {n} — {title} [MATCH: command|path|error|none], ... · Ratings: {ids}, none, or "no proven session" · Skills audit: {n} hits; scripted {keys}; proposed {keys}; dropped {n}`

## What moved out of /end

Session log: `ob_start`. SUMMARY, INBOX, task, next-session: rendered from what `ob_state` writes.
DECISIONS, ENTITIES: with the change that makes them true. Validation: `/sync`. Vault summary: the SessionEnd hook.
