# T-179 + T-163: cut `/end` to a lessons step, and make a close-out unable to erase another seat's record. Brief for a FRESH developer session (record 118)

**By:** Atlas (planner), record session 109 · 2026-09-26. **To:** a Claude developer seat (Forge), **record session
118**, a fresh session (D-035), in whichever of `sia-builder`, `sia-infra` or `sia-forge` frees first. The planner names
the checkout in the dispatch. **Authority:** Aaron's word in session 109 ("write that brief"). This work is brought
forward from "after slice three" (T-179's note). **Starting the session is Aaron's act.** Merging stays his (D-019).
**Timing:** this touches `ob_state`, which every seat writes through. It is dispatched **between** two candidates'
builds, never while a seat is mid-build, and the dispatch says which.

## 1. What is true now (read by the planner; verify before building on it)

- **`end.md` is 408 lines** (`.claude/commands/end.md`), unchanged in substance since T-179 was opened. Every brief
  repeats "no `/end` (T-163)", because nothing but that sentence stops it.
- **`ob_end` writes no project state.** `server.ts:624` summarises the session from its DB, records entry ratings,
  writes the vault summary and logs invocations. The state writes in a close-out come from **`end.md`'s own steps**
  (A7b and its neighbours: `set_handoff`, `add_decision` and others), run by the agent through `ob_state`.
- **Loop 14 already made the handoff per seat:** `state.json` `handoffs[]` is an array keyed by `seat`, at most one per
  seat (`shared/state-schema.ts:150–201`, G-046). **But `SeatName` is a ROLE** (planner, developer, qa), and today three
  developer seats (Grok in `sia-forge`, and Forge in `sia-builder` and `sia-infra`) share the one `developer` slot. A
  developer's close-out therefore still replaces another developer's. At rev 132 the slots read planner 109,
  developer 74 and qa 75. The developer and QA slots are stale by 35 sessions, because the seats stopped closing out.
- **`last_session` is a single project-wide slot** (`{n: 76, …, seat: "planner"}`), and it is stale for the same
  reason.
- **T-163's measured failure** (rev 61 and rev 62): each close-out removed the other seat's uuid and added its own.
  Whether that exact path still exists after Loop 14 is **not verified**. Step 0 establishes it.

## 2. The work

**Step 0: measure before cutting (no product change).** In a scratch copy of a project with a `state.json`, run what
`end.md` instructs a developer seat to do, once for each of two different developer sessions in sequence. Record
what each step writes: which `ob_state` ops, which fields, and which files. Answer in the handoff: (a) does the second
close-out remove or replace anything the first wrote? (b) which of `end.md`'s steps write state at all? (c) which are
already done as work happens (T-179's reading: A7b's `set_handoff`, `add_decision`, and others)? **A row red for the
wrong reason does not count.** If (a) is no for every path, say so, and T-163's code half becomes the `/sync` check alone.

**T163-1: a close-out can only add its own record.** The deterministic fix, which is Aaron's stated preference over
prompt-level guidance: whatever Step 0 finds a close-out replacing is keyed by **the writing session** (its uuid,
plus its seat role for rendering), not by role alone. Appending or updating your own entry is the only write allowed,
and replacing another session's entry refuses.
- **The planner seat is one seat,** so its handoff may stay singular. Say whether you kept that.
- **`last_session`** either becomes per session, or is derived from the session logs and not stored. Choose one, and
  say why.
- **A schema change is a migration.** Follow `state-migrate`'s existing pattern, bump `schema_version`, and show the
  migration run against this repository's own `state.json` in a scratch copy, before and after. **Never against the
  live file.**
- Retention (the done-task pruning) must not drop a still-open seat's entry.

**T163-2: the `/sync` check.** "No write removes an entry another session added." This is the developer seat's own
proposal from session 77. It checks the committed history of `state.json`: for each revision, a record present at N
and absent at N+1 was removed by a session that did not write it. It fails, naming both revisions and both sessions.
Run it against this repository's history and report what it finds. **Rev 61 and rev 62 must be flagged**, as the
known positives. Tell atlas if they are not.

**T179-1: cut `/end` to a lessons step.**
- The new `end.md` does one thing: **store this session's lessons**, each with the key that would have caught it
  (T-170: lookup by default, injected only on a deterministic match), through `ob_store` or `ob_store_chunk`, plus
  `ob_end` for the session summary and ratings.
- **Every state write leaves `/end`.** The record is written as work happens (the handoff via `set_handoff` when a
  seat hands back, decisions when made). Where Step 0 finds a step that is NOT already done during work, list it and
  say where it moved (a brief's hand-back section, `/checkpoint`, or nowhere, with the reason).
- Target: under 60 lines. Aaron's word: compatibility with other projects' `/end` is **not** a constraint.
- `project-template/`'s copy of `end.md` gets the same change. `/sync`'s checks that reference `end.md`'s old
  steps are updated, and listed.
- After this lands, **the "no `/end` (T-163)" line in future briefs is retired.** Say so in the handoff, and the
  planner retires it.

**Out of scope:** `/start`, `/checkpoint` (except as a destination for a moved step), T-164's counter, and T-170's
recall side.

## 3. Start

1. `/start`. Your record number is **118**. The greeting's number is local (T-164). **Do not run `/end`** in this
   session. The irony is noted.
2. `git fetch origin && git switch -c loop/t179-end origin/master`.
3. `npm ci && npm run build` in `open-brain`.
4. **Read ONLY:** this brief; `.agents/state.json` tasks T-163, T-179 and T-170 (their notes); `.claude/commands/end.md`;
   `shared/state-schema.ts`; the `state-migrate` pipeline; and `ob_state`'s op handler.

## 4. How

- **Red first with your own tests**, on master, as `loop/t179-redcheck`: two sessions of the same role close out, and
  the first's record survives. Read the redcheck run on tcm per test.
- **A code mutant per protection** (at least: the key back to role only, the refusal removed, and the `/sync` check
  blind to one revision), each on `loop/t179-mut-<name>` and batched on tcm. `npx tsc --noEmit -p .` before every
  push and on every mutant.
- CI on **tcm** (D-040). CA-9 is red there (T-182), and it is not yours.
- **No full local suite** (this box is never quiet).
- **Never write this repository's live `.agents/state.json`.** Every state write in a test or a probe goes to a scratch
  copy under the OS temp dir.
- Push only `loop/t179-end` and `loop/t179-*`. Never master, never force, and read back each push. On a refusal or a
  denied command, stop and tell atlas.

## 5. Hand back

`docs/loops/t179-developer-handoff.md`, with:
- Step 0's answers (a), (b) and (c), with the evidence;
- a commit table built from each commit's own `git diff --stat`;
- the migration's before and after on the scratch copy;
- T163-2's findings against this repository's history;
- the list of `/sync` checks changed;
- the red run, the green run and every mutant with its run id;
- your model and effort, read from your own transcript.

Then name the frozen SHA. Message atlas by SendMessage when it is pushed.
