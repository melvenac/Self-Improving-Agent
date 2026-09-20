# Loop 14 — close-out

**From:** Atlas (planner) · **Date:** 2026-09-20 · **Verdict:** **ACCEPTED** at `c7fbdd9` — the second
candidate — by the QA seat in report 2 (`667cd9d`), on criteria written before the first candidate
existed (`424c618` → `a68c358`), after rejecting the first candidate (`7e1c041`) in report 1
(`867790b`) on one row. Branch tip `3135da4` adds the version bump to `0.43.0` above the accepted
SHA, re-verified in scope by the QA seat in report 3 (`97bdbe6`): eight files, none under
`open-brain/`, record unchanged at rev 56, suite 974/974 alone, the one `sync` issue still the
`end.md` mirror and the version checks green.
**Briefs:** `loop-14-brief.md` (2026-09-17) → `loop-14-rebrief.md` (2026-09-19) → amendments 1 and 2
(2026-09-20). **Developer handoff:** `loop-14-developer-handoff.md` on the branch, by rev.

> **Sources cited by SHA, not absorbed.** Branches were unpushed when this was written; §9's merge
> order lands them.

---

## 1. What was asked, and what happened

The three-seat record: give the planner the durable record the other two seats already had, decide
where it lives now that a runtime owns per-loop artifacts, and make a fresh session's greeting true.
**All four subjects landed, and the loop found that the greeting had been false in a way none of the
briefs named.**

**Before the kickoff, both fresh seats reported their greetings for verification.** Both were
faithful renders of trees two merges behind master — the developer's worktree still on its
predecessor's close-out branch, the QA worktree detached at what master had been. Four instruments
(clean tree, `Drift: none`, a valid render, a matching version) reported healthy on a stale tree. The
staleness line was added to the brief with the developer's design constraint: *legible next to a
green drift line, because they answer different questions.* (Amendment 2 §1.)

**Candidate 1 (`7e1c041`) — NOT ACCEPTED, one row.** Eight rows passed; the derived close-out SHAs
matched git history by hand; six mutants all red. C2d, the enumeration of what the planner needs at
a roll, failed on one item: the near-miss register was sorted nowhere. Ruled: it belongs to the
close-out document, by family, never numbered — and the row failed correctly because nothing said so
anywhere. Four findings of the loop's own class rode with the second candidate.

**Candidate 2 (`c7fbdd9`) — ACCEPTED.** Every row, the four ridden findings red at `7e1c041` and
green here, twelve mutants red with `tsc` clean on each. And a fifth fix the developer found by
reading its own record back: the session-number repair had stamped every op in a batch with a
number `last_session` did not yet hold — the exact contradiction `G-047` exists to remove,
introduced by its repair.

**`3135da4`** — version `0.43.0`, CHANGELOG, and one stale number in the handoff corrected with
**Developer 31** set beside it. No code, no record op.

## 2. What it built

- **Staleness** (`tree-currency.ts`): HEAD and the record's revision compared to the local
  `origin/master` ref, printed first, on three surfaces from one function; explicit *current*,
  *could not compare* with the reason and "this is not a pass", *ahead* never called behind, never
  fetches, carries the last-fetch time. Seen red on this morning's actual stale tree.
- **C1** (`role-files.ts`): the seat's role file and `shared.md` loaded by content, each named with
  its commit; absent / untracked / stale-vs-HEAD / behind-upstream kept apart. **`G-032` closes.**
  Cost measured: about a third more words at session start, spent deliberately.
- **C2** (`state-schema.ts`, `state-writer.ts`, `handoff-provenance.ts`, `state migrate`):
  `handoffs[]` keyed by seat; `set_handoff` and `end_session` refuse a missing or unknown seat; the
  greeting renders the reader's own seat's last handoff and names the others' close-out commits,
  derived from git by the seat's *words* and failing closed; `end_session` idempotent per uuid.
  The migration is a program with a dry run that refuses an unknown shape. **`G-046`, `G-047` close.**
- **C3** (`detach`): the return-to-detached step, run by hand more than twenty times, is a command
  with three refusals the by-hand version never had — dirty tree, commits `origin/master` does not
  have, and a read-back of the end state. The planner's handoff carries required rows —
  `open_prs`, `frozen_sha`, `questions_for_aaron`, `rulings` — that may be empty but not absent.
- **`T-157`**: retention refuses to evict a done task whose id the tracked tree cites; verified
  against the real tree, where 16 of 36 ids are uncited so the guard can still fire.
- **`role: none`**: a checkout may declare it is not a seat; the greeting says so; record writes from
  it are refused by the schema. The tracked default `AGENT.md` had declared `role: builder` — outside
  the closed set, with no rules file — so every checkout without a local override, the main tree
  included, resolved a role that did not exist, silently. Found the moment C1 could see role files.
- **The four ridden findings:** an uncommitted edit to another seat's handoff renders no SHA rather
  than an old SHA beside new words; the reconnect advice appears only on a schema mismatch and says
  *rebuild*; `ob_start` refuses a present record at an unknown schema version in words with no prose
  fallback (absent keeps the prose regime); a malformed hook payload refuses, writes nothing and exits
  non-zero, and a well-formed payload with no session id writes nothing to the identity slot.

## 3. The finding that generalises

**A derived value inherits the question its derivation asks, not the question its caller asks, and
no assertion written from inside the derivation can tell the difference.** (The developer's
sentence.) Three instances this loop, every one green in the tests:

1. The fetch-time instrument reported *unknown* everywhere while looking like caution; the test
   only looked for the word "fetch". Two real bugs hid under it that only a linked worktree shows.
2. The greeting named the migration commit as the QA seat's close-out — correct by "where this entry
   last changed", because the migration rewrote every entry's bytes, and wrong for what a close-out
   SHA is for. 946 tests were green.
3. The session-number repair stamped a batch with a number the record did not hold.

Each was found by reading the artifact after the fact, not by a test. **Green on the first run is
the signal to mutate** — three mutants survived green suites at first pass this loop, each the exact
defect being fixed; and **assert both directions**, because a vacuous negative shipped inside the
repair for a vacuous positive and was caught only because the positive failed against the same
wrong path. **`tsc` clean is part of calling a mutant valid.** All three go into `shared.md` with
the developer's provenance.

## 4. The record layer, three results

- **`G-032` closes and immediately shows its limit.** `shared.md` is now loaded into every session
  and named by commit. The developer read it at start, quoted its rule on restated numbers at the C1
  boundary, and then restated a number in its own handoff (Developer 31). **Loading a rule and
  applying it are still two different things.** That is the sentence the `G-039` loop is briefed
  with, and it is why that loop is next.
- **The freeze is a mechanism and it did the work.** The planner asked for a one-line addition to a
  document inside a frozen candidate. The developer refused to touch the tree, because the QA stage
  refuses a moved or dirty tree as two separate conditions, and said in writing that under a
  convention it would have made the edit. The planner's instruction was the error; the sentence is
  in §6 below instead.
- **Checking which seat a checkout is had reassigned that checkout's session identity.** The hook
  writes the active-session slot and generated an id when its input carried none. → **`G-048`** at
  the close-out write, closed in the candidate. **The denial was correct and was not worked around:
  the repair went through the hook's own write path with the real session id in the payload, which
  is the designed door. Nothing wrote that file by hand.**

## 5. Instruments and the machine

- **`G-042`, second sighting.** QA's first suite run, overlapped with thirteen worktree adds, exited
  1 printing "974 passed" with the worker heartbeat timeout — the same signature as the 805/exit-1
  run. That kills "only the developer's process" and leaves "only this machine" untouched: one
  machine's worth of evidence, twice, both times with the count right and the exit code the only
  instrument that knew. Clean runs the measurement, overlapped runs recorded.
- **`T-055`** fired on incremental analyzes in the QA tree again; `analyze --repair-fts` recovered
  every time.
- **`build-freshness` goes red on docs-only commits** because it compares the build's commit to
  HEAD, not to the last commit that touched the server source; a seat reading the red as "stale
  code" is told something false. G-034's family from the other side. Fix shape noted; not this loop.
- **The CHANGELOG gate enforced itself**: the moment `package.json` moved, `sync --check` reported
  the missing entry. That is the shape every check here is meant to have, and the opposite of the
  `end.md` mirror, which a human carries across a boundary no check can see (§9).
- **The old build fell back to prose on the new record** — `ob_state` refused, `ob_start` did not.
  The loud failure the choreography assumed held for one door of two; fixed in the candidate for the
  next bump, and the main tree's current build still falls back until it is rebuilt.

## 6. Near-misses, by family, all three seats

None numbered; every one caught by reading the artifact rather than the tool's report of it. Hand
counts of the same task render disagreeing between two seats, and a wrong split under a correct
total (the planner's greeting check). Parallel shell calls moving a shared cwd (planner, QA). A
plant that validated one instrument on the plant and not on the file; two instruments lying the same
way about CRLF; `grep -c` exiting 1 on a zero count inside a gate (QA). A fixture describing an
impossible state, refused by the schema it was testing (developer). Two mutants that failed `tsc`
rather than behaviour, replaced before being counted (QA). QA's baseline hook runs writing six
scratch slots into the real active-session file before it redirected `HOME` — disclosed by QA, in
Aaron's home directory, his to clean.

## 7. The record

**50 Planner / 31 Developer / 2 QA** at close, from 50 / 30 / 2 at slice two's. One entry this
loop, set by its own seat before being asked. Two candidates, one rejected on one row, twelve mutants.

**Written at the close-out record write, after the merge and the main-tree rebuild** (the record's
schema moved; an older build cannot read it): `D-025` (Loop 14 accepted at `c7fbdd9`, `3135da4` the
bump); `D-026` (sequencing: the `G-039` recall-trigger loop, then slice three — ruled by Aaron
2026-09-20, amendment 2 §5); `G-032`, `G-046`, `G-047` closed; `G-048` (identity reassignment,
closed in the candidate); `T-157` closed; `shared.md` gains the three rules in §3 and loses nothing
(the file now has a context budget — additions are short, with provenance, and the reasoning stays
here); objective → the `G-039` loop.

## 8. What the next loops inherit

- **The `G-039` loop** (next): a deterministic trigger that fails closed on nothing, handed both
  fixes from `g-039-ruling.md`; briefed with §4's first result as its problem statement.
- **Slice three** (after): `G-045` first, mechanical; real roles; QA scoring through Jev; thresholds
  calibrated against real diffs; F11's "what a green live loop means"; the open channel denominator
  (index, hooks, config, submodules, reflog); `T-155` now buildable.
- **Not this loop's, named so nobody reads their absence as an oversight:** the `build-freshness`
  fix shape; `G-042` on a second machine; the injected-transport preflight (F9 of slice two).

## 9. Held for Aaron — the merge choreography

Because the record's schema moves with this merge, the order is not optional:

1. **Merge:** `loop/14-three-seat-record` (cite rev 56; tip `3135da4`), then
   `qa/loop-14-criteria` (`a68c358`), then `qa/loop-14-report` (`97bdbe6`), then #75 (amendment 2),
   then this close-out.
2. **Before any seat reads the record:** the main tree checked out at the merge, rebuilt, and the
   server reconnected (`/mcp reconnect open-brain`); a session on the old build falls back to prose
   on the new record.
3. **Two files in Aaron's home and main tree, his to write or to authorise:** `~/.claude/commands/end.md`
   copied from the template (the one `sync` issue at every candidate SHA, deliberately not written
   from a branch); an untracked `.agents/AGENT.local.md` in the main tree declaring `role: none`, so
   it stops greeting as the developer.
4. **The planner and QA trees rebuild before their first read.**
5. **Tag `v0.43.0`** on the merge.
6. **The roll, one seat at a time, on the new build:** the developer's `/end`, then QA's, then —
   for the first time — **the planner's**, which is C3's acceptance: its required rows written by
   the command. Then the close-out record write, then fresh sessions for the `G-039` loop.
7. **Two things in Aaron's home directory from QA's report, his to clean or ignore:** six scratch
   entries in the real active-session file; the shared repository's local `master` branch, 105
   commits behind, a trap for anyone who checks it out by habit.

---

**The loop's verdict, the planner's to give:** Loop 14 asked whether a fresh session could be
greeted with the truth. On the first candidate it could, for every seat, on every row but one — and
the one it missed was the item the planner had listed first. On the second it can, and the file that
carries the rules is finally read at every start. The same loop is the first evidence that being
read is not the same as being applied. That is the next loop's brief, and it was earned here.
