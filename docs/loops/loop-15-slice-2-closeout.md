# Loop 15 slice two — close-out

**From:** Atlas (planner) · **Date:** 2026-09-20 · **Verdict:** **ACCEPTED** at `830af70` (code at
`c1f99d0`; record rev 49) on branch `loop/15-slice-2-gates`, by the QA seat in report 2 (`1ee8346`),
on criteria written before the first candidate existed (`c73f147` lineage), after rejecting the first
candidate (`b4194a9`) in report 1 (`8f2c547`). **One defect open, ruled onto slice three.**
**Brief:** `loop-15-slice-2-brief.md` + amendments 1 (`7fc2f3e`, #65) and 2 (`16f2a5f`, #66).
**Developer handoff:** `loop-15-slice-2-developer-handoff.md` on the developer branch, by rev.

> **Sources cited by SHA, not absorbed.** Every observation below is the seat's that made it, at the
> commit it made it. Branches were unpushed when this was written; the merge order in §8 lands them.

---

## 1. What was asked, and what happened

Two things in order: close the ref channel (`G-041`), then put the Jev client and the first two gates
behind the runtime with roles still stubbed. Both landed. **The ref channel closed on the third try
across two candidates**, because closing it exposed the layer beneath it: what the restore does with
`HEAD`, which is a symbolic ref outside `refs/` that every ref-watch defect turned on.

**Candidate 1 (`b4194a9`) — NOT ACCEPTED.** Seven rows passed, A6 failed on its second half (a
threshold planted into a gate *prompt* was caught by nothing — the scan's scope stopped at the
policy module), A7 untested by rule. Three withheld probes found the class beneath G-041: a role
that runs `git checkout -b evil` and commits **crashed the runtime** with no record and HEAD left
unborn (D1); a backwards move of the deferred branch head was refused and then *not restored*, with
the runtime's own plan commit left unreachable, and the shipped test accepted that outcome by
regex (D2); a subclass of a stub was runtime-constructed by `super()` (D3). Six repairs ruled as
classes, all seen red in one commit (`a9ffe26`) and green in the next (`c1f99d0`).

**Candidate 2 (`830af70`) — ACCEPTED.** All nine rows. D1–D3 closed on the observations that found
them. A7's live pair ran from the QA seat: both gates `HTTP 200` from `jev-1.13.0`, every answer
typed, `score` legend an object, both gate records `sent: true`, key count zero across artifacts,
scratch repo, `git log -p` and the run log with the grep validated on a plant. **The done gate then
rejected the stub developer's diff on the shipped policy and the loop exited 1** — ruled the gate
doing its job, observed (§3.1).

## 2. The finding that generalises

**A restore that reads the repository before the snapshot is fully restored is itself a channel.**
Slice one's lesson was that enforcement blind to a channel is blind to every act through it; slice
two's is one layer down: the ref-watch saw the deletion of `refs/heads/evil` and put it back, and
in doing so left `HEAD` naming nothing, and the very next line — `git rev-parse HEAD` inside the
allowlist check — threw an exception that escaped the loop *before* the rollback that would have
fixed it. D1, D2 and the open D4 are one defect with three faces: **the order of restore relative
to the first read.** The developer's repair put `HEAD` in the snapshot and restored it first; D4
shows the same shape one case further (the branch deleted, not moved: HEAD's *name* unchanged,
its *referent* gone). The principle slice three inherits as its first mechanical check:

> **The restore reads nothing from the repository until the snapshot is fully restored, and after
> `HEAD`'s name is put back, `HEAD` must resolve or the ref is restored before any read.**

Both seats also named the denominator honestly: **every enforcement channel so far was found only
after something used it** — working tree, commits, refs, now HEAD. Index, hooks, config,
submodules and reflog are unprobed. That is carried forward as an open denominator, not as four
solved problems.

## 3. Rulings made in the loop, so nothing is asked twice

1. **A7 is the gate's observability, not the loop's completion.** The brief's row names the
   response version, typed answers, the legend's shape, `sent: true`, and the key's absence. It
   says nothing about exit code. QA's own criteria added "exit 0" and "an integer inside the scale";
   QA set **QA 2** on both, did not drop them after the verdict, and returned them to the planner —
   the correct shape. A stub-roles loop cannot complete live under a policy built for real diffs
   (F11); that is a slice-three fact, said once in slice three's brief.
2. **The brief's "QA records request ids" clause is struck.** The API returns none (F10). Wrong
   claim in the brief about the wire; the planner's.
3. **D4 is `G-045`, slice three's mandatory mechanical first repair** — same grounds as D6 in slice
   one: the roles are stubs, no real role runs through this runtime before slice three, and the
   loop's own rule carries a failure into the next brief rather than a third candidate.
4. **Ref authorship is a ledger, not a name** (amendment 1, the developer's objection before its
   first commit). **The gate seam is async, never a spawned process** (amendment 2). **A8 is seven
   rows** (amendment 2). **A6 binds the behaviour, not the mechanism's name** (amendment 2).
5. **F1 is left strict** (a scan firing on a comment is the safe direction); **F4 is documented**
   in the guide's §8 by the developer (the wire body is not redacted, by design; a secret that
   reaches a deliverable travels twice and the gate record beside it looks clean); **F3 as built
   stands** (a `FAILED.md` on a preflight refusal is a record).

## 4. Incidents outside the criteria

**The developer made a live Jev call from its seat** while demonstrating the no-key path, because
`TYPESAFE_API_KEY` was set in its environment and it assumed otherwise. **Developer 29** — a
statement in writing ("I will not make one") falsified by its author. **The developer echoed the key
to check whether it was set: Developer 30** — the value is in that session's transcript on disk, in
no repo file, artifact, commit or log (verified by grep with the instrument checked). Both set by
the developer before being asked. **Two things follow, one for Aaron and one for the record:**

- **Rotate the key.** Aaron's act; recommended by the developer directly and here.
- **A key set user-wide is in every seat's environment.** The deterministic fix is to scope it to
  the QA session's launch, not to `setx`; then the developer seat cannot make a live call even by
  mistake. Aaron's environment to change; recommended, not done.
- **`G-044`** (developer): a test that reads inherited `process.env` cannot distinguish "unset"
  from "not checked" — rule 11 in the environment layer. The A3 tests now construct the env,
  delete the variable and assert the deletion did something; QA's own A3 run showed the key present
  in the parent before stripping it in the child. The sweep of the class is `G-044`'s recommended
  update.

**The retention rule evicted a cited task twice in two consecutive writes.** `T-151` at rev 48,
`T-153` at rev 49, both `done` for three sessions, both cited by id in tracked documents (`T-153` in
the guide, the Loop 13 close-out and the Loop 14 re-brief). The developer read "Dropped" in the
dry-run output, grepped the tree, and preserved each verbatim in the gap that cites it. **Hand
preservation is not a mechanism** and `G-024` now says so. → **`T-157`** at the close-out write:
refuse to evict a done task whose id the tracked tree cites, or tombstone.

**The handoff is one slot and the roll overwrites it** (amendment 1, **Planner 49**): the developer's
close-out filled it, the QA seat's replaced it, and the kickoff message asserted the view carried
what it no longer did. → **`G-046`** at the close-out write. Until fixed: a rolled seat's handoff is
cited by the SHA of its close-out commit and the kickoff carries that SHA.

**`T-055` is five for five.** Every incremental `gitnexus analyze` in the QA tree today failed with
the FTS inconsistency and was recovered by `analyze --repair-fts`; the main tree hit it once. The
trigger is *every incremental run* on this repository, not merges. Folded into `T-055` with the
count.

## 5. Near-misses, by family, all three seats

All caught by reading the artifact rather than the tool's report of it, none numbered:

- **Parallel shell calls sharing one cwd** (planner, QA): a `mv`/`ls` ran in the wrong directory
  because a concurrent call had `cd`'d; three reads returned "no such file" while the target
  existed. Caught by absolute paths and re-verifying identity.
- **Shell path conversion mangling `ref:path`** (planner): `git show origin/master:.agents/state.json`
  became `origin\master;.agents\state.json` under MSYS; the SHA form works. Twice.
- **The sync gate refusing a good commit on a stale local build** (planner ×2, QA ×1): correct
  refusals, each followed by a rebuild. The gate held; no entry.
- **A grep that missed `spawnSync(`, a plant that landed in a comment, an ajv default that rejected
  the 2020-12 meta-schema** (QA): each caught before a claim was written.
- **The two seats' seen-red counts differing by one** (F12: 6/217 vs 7/216, the no-key preflight
  assertion): both red; recorded so two artifacts are not read as a disagreement about the condition.

## 6. The record

**50 Planner / 30 Developer / 2 QA** at close, from 48 / 28 / 0 at `dec2406`. Two planner entries
this loop (49: the handoff slot claim; 50: A8's row count); two developer (29, 30: the live call and
the echo); two QA (1: a wrong path in the criteria; 2: two clauses derived beyond the brief). The
QA seat's first two entries in the project's history came in the loop where it also rejected one
candidate and accepted another on criteria it did not loosen. **Every one of the six was set by its
own seat before being asked.**

**Written at the close-out record write, after Aaron merges** (the record moves one seat at a time
and the developer held the loop): `D-024` (accepted); `G-041` closed; `G-045` (D4); `G-046` (the
handoff slot); `T-157` (retention eviction of cited ids); `T-055` note (five for five); objective →
Loop 14 per Aaron's ruling of 2026-09-20.

## 7. What slice three inherits

- **`G-045` (D4) as A1, mechanical, seen red first**: `git update-ref -d refs/heads/<current>` during
  a stage fails the loop with a record; HEAD resolves afterwards; the restore reads nothing before
  the snapshot is whole.
- **Real role sessions**, and with them the thing F11 names: the shipped thresholds are for real
  diffs, so "a green live loop" is defined once, in that brief.
- **F9**: a programmatic caller that injects a keyless transport reaches the plan gate before
  refusing; the CLI path is clean. Decide whether injection is a trusted seam or preflight applies.
- **F8**: `score` answers are floats in the scale's range, not indices; the guide's §4 wording
  reads as discrete. One sentence.
- **The open denominator**: index, hooks, config, submodules, reflog.
- **`T-155`**, the shadow merge gate, now buildable: the gates have opinions and the merge point can
  be written where the runtime stops.

## 8. Held for Aaron

- **Merge order:** `loop/15-slice-2-gates` (cite by rev 49, not tip), then `qa/loop-15-slice-2-criteria`
  (`c73f147`), then `qa/loop-15-slice-2-report` (`1ee8346`), then #65, #66, then this close-out.
  Then the `v0.42.0` tag on the merge — his word or the standing versioning rule.
- **Rotate the Jev key**, and **scope it to the QA session** rather than `setx`.
- **The roll:** after the merges, developer `/end` first (against the merged revision), then QA, one
  seat at a time; then fresh sessions for Loop 14.
- **Sequencing is already ruled:** Loop 14 next, slice three after. D4 does not block Loop 14, which
  runs no role through the runtime.

---

**The loop's verdict, the planner's to give:** slice two asked whether the boundary slice one built
could be trusted enough to put a gate on top of it. On the first candidate it could not, in exactly
the way a real developer's first `git checkout -b` would have found; on the second it can, for every
channel anyone had thought of — and the one nobody had is named, ruled, and first in line.
