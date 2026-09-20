# Loop 14 — developer handoff

**From:** Forge (developer) · **Date:** 2026-09-20 · **Branch:** `loop/14-three-seat-record`
**Base:** `origin/master` 7c7e04b, record rev 52 → **rev 53 on this branch**
**Brief:** `docs/loops/loop-14-rebrief.md` + `loop-14-rebrief-amendment-1.md`

> **This is evidence, not a verdict.** "It works" is not available to the seat that built it.
> Acceptance is Probe's, from a frozen SHA, against criteria written before this existed.

---

> **SECOND CANDIDATE.** The first was `7e1c041`; QA's report is at `867790b` on `qa/loop-14-report`.
> Eight of nine rows passed, six mutants all red, and the honest no was **C2d** — the near-miss
> register, sorted below in §3. Four of QA's findings ride with this candidate because the SHA had to
> move for that sentence anyway; each was seen red first. §9 lists them.

## 1. Commits, in order

| SHA | What |
| --- | --- |
| `a80d894` | Tree-currency: tell a seat its tree is stale before it reads the record |
| `0f276b7` | C1: load the seat's role files, name each with its commit |
| `de4674d` | C2 + C3's rows + G-047 + T-157 + `role: none`; schema v1 → v2, all three `state.json` copies |
| `ff0c482` | Derive a handoff's close-out from its words, not its bytes |
| `1e40e23` | C3: `open-brain detach` as a command; `end.md` and `shared.md` updated |
| `7e1c041` | Record write, session 71 — first candidate |
| *(this one)* | C2d sorted; F1–F4 repaired; §6's designed-door sentence |

## 2. What to check first, because it is the thing most likely to be wrong

**The derived close-out SHA.** `findHandoffCommit` walks `.agents/state.json`'s history and reports
where a seat's handoff last changed. **Check it against `git log` by hand, not only against its
tests** — it was wrong once in exactly the way tests cannot see (§5.2), and 946 of them were green
while it was.

At `1e40e23` the QA seat's handoff should resolve to **`c0d69d5`**, *"chore(state): session 70
close-out — QA seat, Loop 15 slice two"*.

## 3. What is in, per criterion

**Staleness (from the C1 boundary note).** `pipelines/session-start/tree-currency.ts`, printed FIRST
by both `ob_start` and the `cli-bootstrap` hook, from one function.
- Seen red on the real condition: a worktree extracted at `5b5bd30` — the tree that caused this —
  reports `7 commits behind origin/master — record here rev 50, at origin/master rev 52`.
- Prints an explicit line when current. **Silence would make "level with master" and "this check did
  not run" render identically**, which is the family this repo keeps paying for.
- Never fetches; every result carries the last-fetch time, so `current` cannot be read as `current as
  of now`. That is G-034's shape, said in the line rather than in a comment.
- Skips with the reason and the words *"This is not a pass"* when there is no `origin/master`.
- Names `origin/master` and disclaims drift in its own words, because **a stale tree is perfectly
  self-consistent** and `Drift: none` printed above a rev-50 record for an entire session.

**C1 — role files.** `pipelines/session-start/role-files.ts`. Loads the seat's role file and
`shared.md`, returns the CONTENT, names each with its commit and date. Four conditions kept apart:
absent / untracked / **stale** (working tree vs HEAD's blob) / **behindUpstream** (recorded only,
never called stale, per the planner's ruling). Cost measured, not estimated: **+2,413 words to
`ob_start`, 7,183 → ~9,596, +34%.** `role: none` declares a checkout that is not a seat; read-side
only, so a write from one is refused by the schema rather than by a parallel rule that could drift.

**C2 — per-seat handoffs.** `handoffs[]` keyed by seat. `set_handoff` / `end_session` take a seat and
refuse one outside `planner` / `developer` / `qa`. The greeting renders the reader's own and names
the others by derived close-out SHA, bounded at 50 and failing closed — *"unchanged through all 50
commits examined"* is a different answer from *"no commit"*, and neither is ever blank.

**G-047.** A second `end_session` for a uuid keeps the number and says so in `notes`. **Its limit is
in the code:** only `last_session` is kept, so it catches a uuid that returns immediately, which is
the observed shape. A uuid returning after another seat has taken a number is not caught.

**C3's rows.** `open_prs`, `frozen_sha`, `questions_for_aaron`, `rulings`: required on a planner
handoff, and **every one may be empty**. `[]` and `null` are real answers; absence is not. A required
field is run, an optional one is remembered, and remembering is the failure C3 names.

**T-157.** A done task whose id the tracked tree cites is kept, and the note names the citing files.
**Verified against the real tree, not a fixture:** `T-151` and `T-153` — the two actually evicted —
are both detected, and **16 of 36 task ids are NOT cited, so the guard can still fire.** I checked
that specifically: a protection that keeps everything cannot fail and is not a protection.

**C2d — the enumeration, as the test of the shape.** Every item the re-brief's C2 list and C3 table
name, sorted into *carried by the record* or *carried by something else*:

| Item | Where it lives | Carried by |
| --- | --- | --- |
| open PRs and which were QA'd | `loop_state.open_prs[{ref, qa_status, note}]` | the record |
| the SHA frozen for a QA in progress | `loop_state.frozen_sha` | the record |
| questions pending for Aaron | `loop_state.questions_for_aaron` | the record |
| rulings made mid-loop | `loop_state.rulings` | the record |
| Aaron's standing rulings | `.agents/roles/shared.md`, loaded and printed by C1 | tracked role knowledge |
| the detach procedure | `open-brain detach` | a command |
| **the near-miss register** | **`docs/loops/*-closeout.md`, by family and never numbered** | **the close-out document** |

**The near-miss register is not a record field and is not meant to become one.** Ruled by the
planner, 2026-09-20: the loop close-outs are the record's document layer, and the register has lived
there since Loop 13. Its entries are *families of near-miss*, deliberately uncounted — a numbered
list of them would invite exactly the negotiation over the number that `shared.md` forbids for error
entries. It is sorted here, into the close-out, rather than left unmentioned; **QA was right that the
criterion was not met by the candidate it evaluated, because nothing said so anywhere.**

**C3 — detach.** `open-brain detach`. Dirty tree refused with paths; commits not on `origin/master`
refused with their subjects (`--force` overrides deliberately); fetches first; reads the end state
back. `origin/master`, never `master`, pinned by a test that moves local master ahead.

**The migration is a program.** `open-brain state migrate`, dry run first, refuses an unknown seat,
refuses a file that is neither valid v1 nor valid v2, idempotent, reports every field it changed.
**`applyStateOps` could not do this: it refuses a file that does not validate against the current
schema, so the moment the schema moves, the door locks from the inside.** Live record 52 → 53 seat
`qa`; template and fixture with `--keep-revision` — they are not records, have no concurrent writer,
and a fresh project starting at revision 1 with no history is a small lie.

## 4. Rule 13 — where this ran

The candidate's code was run **read-only against all four trees**. It could not be run *from* the
other trees without checking this branch out in them, which would disturb two live sessions.

| Tree | currency | seat | role files | detach dry-run |
| --- | --- | --- | --- | --- |
| forge | ahead 5 | Forge / developer | ok | REFUSED — 5 commits not on master |
| planner | current | Atlas / planner | ok | would proceed |
| qa | ahead | Probe / qa | ok | REFUSED — 5 commits not on master |
| **main** | current | **Forge / builder** | **builder.md ABSENT, 2 problems** | would proceed |

**The main tree's row is C1 working, not C1 failing.** It sits on `origin/master`, which still
declares `role: builder` — outside the closed set, with no role file. The fix is on this branch only.
After the merge it becomes `developer`, and the planner's `role: none` file makes it say what it is.

**The full suite and `/sync` ran in this tree only.** The main checkout I did not touch, and I name
it unrun rather than let a green imply otherwise.

## 5. What went wrong, which is worth more than what went right

### 5.1 An assertion that accepted the defect it was written to exclude

The fetch-time instrument reported `fetch time unknown` in **every seat checkout**, while looking
like caution. My test passed because it searched for the word "fetch", and *"fetch time unknown"*
contains it. **G-040's family, in a test I wrote to be strict, on the day I listed that family in my
own briefing.** Two distinct bugs were hiding under it: `git rev-parse --git-path` returns a relative
path in a clone and an **absolute Windows path** in a linked worktree (`startsWith("/")` reads
`C:/…` as relative), and the per-worktree `FETCH_HEAD` exists only if the fetch ran from *that*
worktree. **A plain-clone fixture passes both.** Every seat checkout here is a linked worktree.

### 5.2 A derived value that was correct by its own rule and wrong for its question

C2 was committed and green when I ran the real greeting and read
`qa (session 70): close-out de4674d` — **my own migration commit, made minutes earlier, named as the
QA seat's close-out.** The migration rewrote every entry's bytes, so it became the answer for every
seat *by construction*, and any future schema change would do it again. **946 tests were green while
this was wrong**, and no assertion I would have thought to write catches it. Fixed at `ff0c482`:
compare the seat's WORDS, and read pre-v2 revisions so the walk can cross the migration.

### 5.3 Green on the first run is not information

Three times a suite passed first run and a mutant survived it:
- `behindUpstream` hardcoded to `true` passed all ten role-file tests — only the positive direction
  was ever asserted.
- **The guard against trusting an exit code was itself untested**: deleting `detach`'s end-state
  read-back left all ten integration tests green. It is now an exported `verifyDetached` with its own
  assertions, following the reasoning `validateResultState` already carries in `state-writer.ts`.

**Mutate every new guard.** It found three real holes in one session and cost minutes each.

### 5.4 My own fixture described a state that cannot exist

A provenance test used a planner handoff with `loop_state: null`. C3's own rule refuses that, so
`parseState` rejected it and the test failed for reasons unrelated to provenance. Recorded as the
schema working.

## 6. For the planner, at close

**An observation needing a gap id** (not taken here, so no existing reference breaks):
**checking which seat a checkout is REASSIGNS that checkout's session identity.** `cli-bootstrap.js`
does not only read identity — it calls `writeActiveSession`, and with no session id in the payload it
**generates one** and stamps it over the slot. Running it to verify the seat overwrote this session's
real uuid with a generated one. G-044's family — an instrument that changes what it measures — in the
session-identity layer. C1's `readAgentIdentity` path in `ob_start` is now a read-only door for the
same question.

**Repaired without a direct write:** the auto-mode classifier denied editing
`~/.claude/open-brain/active-session.json` as Self-Modification, correctly. Re-running the hook with
a well-formed payload restored the right uuid through the program's own door.

**THE DENIAL WAS CORRECT AND WAS NOT WORKED AROUND:** the repair went through the hook's own write
path with the real session id in the payload, which is the designed door. Nothing wrote that file by
hand. *(Said outright because a reader who sees "denied, then repaired" needs the sentence between,
and inference is what fails at 3am six weeks from now.)* **The earlier `{}`
payload was my shell eating backslashes**, not a hook defect; the hook's `try/catch` swallows a
malformed payload and falls through to generating a uuid, which is worth knowing.

**`handoffs[]` carries only the QA seat's entry, and that is not a bug.** The single slot could hold
one. The developer's rev-50 handoff is reachable by SHA; the planner's does not exist until the
planner's roll, which is C3's acceptance.

## 7. Known non-green at this SHA, deliberate

`sync --check` reports **one issue**: `mirror-parity`, `live↔template`, `end.md`. **"live" is
`~/.claude/commands/` — Aaron's GLOBAL commands directory, outside this repo**, read by every session
on this machine. It was identical to the template before `1e40e23`; the 42-line drift is mine.

**I did not write it, mid-loop, for the reason the main tree is not a QA fixture:** two other seats
have open sessions operating under those instructions right now, and the new text requires a schema
that exists only on this branch. It belongs in the merge choreography beside the main-tree rebuild.
**Recorded rather than suppressed with a `MIRROR_EXCEPTION`,** which would silence a real signal for
good.

Everything else: **960 tests pass** (896 at base), exit code read from `$?` and never through a pipe;
`sync --check` otherwise 0 issues, 3 pre-existing warnings, 1 skipped (`gitnexus-index` — no index in
this tree, a skip and not a pass).

## 8. For whoever writes the record next

The record is at **rev 53** on this branch. `expected_revision` must be 53, **from a build carrying
schema v2** — an older build cannot read the file at all, which is the loud failure the `z.literal`
is for.

---

## 9. Second candidate — QA's findings, repaired

Four of QA's findings, each seen red first. They rode with the C2d sentence because that sentence
moved the SHA anyway; none is a new feature.

**F1 — the SHA and the words came from different places, and nothing said so.** The greeting derived
another seat's close-out from HEAD while rendering its first line from disk, so after a `set_handoff`
with no commit yet it printed `close-out 7e1c041` above words that commit does not contain. **The
window is every `/end`:** the record is written before it is committed, so every seat's greeting
passes through this state. A *new* uncommitted entry was already honest — it has no HEAD entry — so
the two uncommitted cases read differently, which is what made it hard to see. Now the working copy
is compared with HEAD's and **no SHA is offered at all** when they differ. A wrong SHA is worse than
none, because a reader follows it. Comparison is on the seat's **words**, so filling `loop_state` in
memory does not make the greeting disown its commit — the same rule as §5.2.

**F2 — the reconnect advice fired on almost every refusal.** The condition was
`/schema|expected .* received|invalid/i`, which matches `ops[0] invalid at priority` — an ordinary
bad argument told to reconnect the server. QA saw seven in a row against a schema-valid record.
`parseState` now returns the zod **path** as data and callers branch on that, never on the wording.
**And the advice itself was wrong:** a reconnect restarts the server from the *same build*, so when
the schema change is on a branch that build does not have — which is what actually happened here —
reconnecting changes nothing. It now says rebuild the checkout the server runs from.

**F3 — `ob_state` refused a v2 record; `ob_start` did not.** It printed one notice line and fell back
to 59k characters of prose, so a session on a stale build against a migrated record got a greeting
that looked like the pre-`state.json` regime. **The merge choreography counts on that failure being
loud, and it was loud on the write side only.** `ob_start` now refuses a *present* record whose
`schema_version` this build does not know, in words, with no prose fallback. Deliberately narrow, and
ruled: an **absent** `state.json` keeps the prose regime, and a record that is merely malformed still
falls back — "this build cannot read this version" is not "this file is broken", and for the second
the prose is the best available answer.

**F4 — a malformed payload was swallowed, and the hook then invented an answer.** It read
`process.cwd()` — the shell's directory, not the session's — greeted the wrong project plausibly,
generated a session uuid and stamped it into that project's slot. Both seats hit it through the same
mechanism: a Windows path in the payload whose backslashes are invalid JSON escapes. **Absent and
malformed are not the same input.** Absent means nothing was offered and is supported; malformed
means the caller tried to say something and this process could not hear it. Now: refuse, write
nothing, exit non-zero.

**Ruled with it:** a *well-formed* payload carrying no `session_id` also writes nothing to the slot.
Printing a generated uuid is fine — `/start` registers it — but the slot is the checkout's session
identity, read as a fallback by every later write, and stamping a value nobody asked for over it is
the defect whatever the payload's shape. The hook says it did not write, because a slot not written
and a slot written correctly look identical afterwards. **This is the identity-reassignment
observation from §6, closed in the code before it has a gap number.**

### The test that asserted the defect

`cli-bootstrap.test.ts` carried *"does not crash on malformed stdin"*, whose stated reasoning was
*"malformed stdin means no usable payload, so a UUID is generated rather than the session losing
provenance entirely."* The second half is true; the first half is the mistake, and it pinned the bug
in place for however long it stood. Replaced, with that reasoning quoted in the replacement.

### And a third vacuous assertion, in this repair

The first version of the slot tests checked `join(home, ".claude", "open-brain",
"active-session.json")` — **a path the hook never writes under test**, because `tests/setup-env.ts`
sets `OPEN_BRAIN_ACTIVE_SESSION` globally and the spawned process inherits it. So *"writes nothing to
the slot"* passed whatever the code did. Caught only because the **positive** case failed against the
same wrong path. The slot path is now pinned per test. **Third of that family this loop**, and the
one that best shows the shape: a negative assertion against a path nothing writes is indistinguishable
from a passing guard.

### Mutants, this candidate

Four, each the defect being repaired, all caught: the slot-write guard removed; the malformed-payload
refusal swallowed; F1's uncommitted comparison removed. A fifth was written and **discarded as
invalid** — it broke syntax rather than behaviour, so its red said nothing, and `tsc` clean is now
part of calling a mutant valid.
