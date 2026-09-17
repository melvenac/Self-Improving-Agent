# Loop 14 brief — the two-seat record

**From:** Clark (Planner) · **To:** Forge (Developer) · **Date:** 2026-09-17
**Base:** `master` **after Loop 13 lands.** No SHA is pinned here on purpose — Loop 13 moves master,
and a pinned SHA in a brief written ahead of its turn is a stale number wearing a precise costume.
**Read the rev and version off the record at start. Check them, do not assume them.**
**Branch:** `loop/14-two-seat-record` · **Tag:** yes, at the end. **Fresh session required.**
**Subject ruled by Aaron**, 2026-09-17.

> **This brief is written ahead of its turn.** Loop 13 has not started. It is written now because the
> planner worktree was created today and the evidence below was gathered from a live three-worktree
> repo while it was fresh. **It does not jump the queue, and nothing in it may be used to argue that
> it should.** That argument is named in the Loop 13 brief as the thing that displaced Idea B four
> times; this is the sixth place it could appear.

---

## The subject

**The developer seat has a record. The planner seat has a narrative.** Loop 14 gives the planner seat
the same durable record the developer seat already has, and makes seat identity a property of the
checkout rather than of a file every checkout shares.

**This is T-149** — *"Give each agent seat its own git worktree"* — **finished.** The worktree half was
done on 2026-09-17: `~/Projects/sia-planner`, created detached at `917fd68`. **What the worktree did
not fix is everything below.**

**The safety property was overstated when it was created, and the correction is the first evidence
for C3.** The Planner wrote that the tree *"can never hold a branch another tree needs and can never
accept a commit by default."* **Half of that was true.** Committing this very brief put the tree on
`docs/loop-14-brief`, and the Developer caught it by running `git worktree list` rather than
accepting the report. **The property survived under an hour, and it was falsified by its author's
first use of the thing it described.**

Separated honestly:

- **"Never accepts a commit by default" held.** A detached HEAD forced an explicit `git checkout -b`.
  That is a real containment and it did its job.
- **"Can never hold a branch another tree needs" is false.** Detachment is a *resting state*, not an
  invariant. A tree returns to it only if something returns it.

**And "something returns it" is the whole point.** The procedure — branch, commit, push, then
`git checkout --detach master` — is correct and is an **intention** until something runs it, which is
rule 4 exactly. **It has no home, because the planner has no close-out. That is C3.** Recorded here
rather than quietly repaired, because this is the same shape as `AGENT.md` asserting Atlas *"runs in
the home directory"* — **a stated property falsified by its own author's next action, twice in one
hour, in two files.**

## Why this, on evidence

**The planner's roll is the machine that manufactures its most-repeated error.**

The developer's roll is `/end` → `/start`: write the record, read the record back. The planner's roll
is `/checkpoint` → `/compact` → nothing. **`/checkpoint` writes to the vault, not to
`.agents/state.json`.** So a fresh planner recovers a summary it wrote *about* the work, never the
record *of* the work.

**Rule 7 in force is "the title is not the record."** Planner error 33 was asserting *"Loop 7 ruled
five loops ago"* when the record said **"RECOMMENDED not yet adopted."** Reading the narrative
instead of the record. **That is not a lapse the planner happens to have; it is the only input the
planner's roll supplies.**

**And the vault is the wrong place to stake it.** Forge reported **zero recalls for three consecutive
loops** at the close of session 63. Planner continuity currently rests entirely on the one subsystem
this project has measured as unused.

---

## Rules in force

Carried because each earned its place. **Read `docs/loops/loop-13-closeout.md` before C1.**

1. **No claim enters the conclusions until someone has read the thing it describes, and the write-up
   names what was read.** Running count **35 Planner, 24 Developer** — **provisional**, see *The
   count* below.
2. **A passing check is not evidence until someone has seen it fail.**
3. **Two measurements that share a premise are one measurement.**
4. **Every containment that worked was a command; every containment that failed was an intention.**
5. **Do not check a stand-in for the thing; check the thing.**
6. **A claim re-read from an artifact is not a claim derived from the thing it describes.**
7. **The title is not the record.**
8. **A substring check answers a different question than the one being asked, and the answers
   coincide most of the time.**
9. **For an instruction that produces artifacts, look at the artifacts.**
10. **For a filter that removes things, look at what it removed.**
11. **An instrument that cannot distinguish "nothing there" from "I did not look" is not an
    instrument.**
12. **A sign-off does not transfer across an amend, unless the amend is provably disjoint from what
    was signed — and "provably" means a diff someone can run.**
13. **NEW — a check is only as tested as the trees it has run in.** Proposed by the Developer on
    2026-09-17 and adopted here because it was paid for in full. The `retirements` check shipped
    green through **four boundary reports, one Planner QA and five merged PRs**, and fired **115
    findings** the first time it ran in Aaron's main tree — the only tree of the three carrying a
    generated `.gitnexus/` index. **Neither seat's verification was worth anything, because both
    seats looked at trees that lacked the directory.** "Run it somewhere else" is cheap and neither
    of us did it.

### The count

Rule 1's running count is **provisional pending the QA of PR #33.** On current reading the
retirements defect is **two escapes, not one**: the Developer shipped a check named `walkTracked`
that checked nothing about trackedness, and the Planner signed it off. Both claims escaped — to
master, and to `V-030`. **Two seats erring independently about the same artifact is two entries.**
The Developer agreed unprompted and in writing, and asked that the Planner set the number rather than
have it conceded in advance — **a number arrived at by negotiation is not a measurement.**

**A second, independent Planner escape is confirmed and pending nothing:** the detachment claim in
*The subject* above, which reached Aaron's report, PR #34's body and this brief before the Developer
caught it. Under the admission rule the dividing line is **escape, not severity**.

**Settled count stays 35 / 24.** With both pending entries the count opens Loop 14 at **37 Planner,
25 Developer**. **Do not carry the new numbers until the #33 QA is written** — the rule's whole point
is that the count moves when the reading is done, not when the conclusion is obvious.

---

## C1 — Seat identity is asserted by a file every seat shares

**Read `.agents/AGENT.md` first.** It is a single tracked file whose frontmatter reads
`name: Forge`, `role: builder`, `partner: Atlas`. **There are now three worktrees and one
declaration.** Every seat that runs `/start` in any checkout of this repo is greeted as Forge —
including the planner tree created today, which is how this was found.

**Two further defects in the same nine lines, both Loop 11's class:**

- The file states Atlas **"runs in the home directory (`~/`)."** As of 2026-09-17 that is false. The
  planner seat runs in `~/Projects/sia-planner`. **A tracked file describing a state the system has
  left** — the exact defect `command-names` exists to catch, in the file that names the seats.
- **The seat has three names and they disagree.** `~/.claude/CLAUDE.md` says **Clark**.
  `.agents/AGENT.md` says **Atlas**. Every loop brief from 9 to 13 says **Planner**. Nothing
  reconciles them and nothing has ever failed because of it, which is why it survived.

**Deliverable:** seat identity resolvable per checkout. **What it must not be is an untracked marker
file that nothing reads** — that is rule 4's "intention" with a filename. If `/start` does not
consult it, it does not exist.

**Enumerate before you design.** Every place a seat name is read or asserted: `AGENT.md`, the
`session-start` pipeline, `/start`'s mailbox step, the hook that prints `Agent: Forge (builder)`.
**Report the list before changing any of them.**

## C2 — `state.json.handoff` is singular and two loops stale

**Verified on 2026-09-17 by reading the file, not the views:** `state.json` at rev 28 has one
`handoff` object, and its `pick_up` opens *"Loop 11 is complete and merged: PRs #17, #18, #19 and #20
are in master, v0.36.0 is tagged at 39fefb4… PR #21 is open and not merged."* **Master is at
v0.38.0. PR #21 merged two loops ago.**

**The mechanism, not the staleness, is the finding.** There is one handoff slot; `/end` writes it;
the Developer runs `/end`; the Planner never does. **So the slot always holds the developer's
handoff, and the planner's is discarded every roll.** It is not decaying — it is being overwritten
by the only seat that writes it.

**Deliverable:** handoff becomes per-seat in the record, and `state-views` generates the planner's
view alongside `next-session.md`. **`state-views` is clean core** — 0 of 1 files touch the database
or vault — so this does not re-cross the boundary Loop 13 just cut. **Confirm that is still true at
your base before you rely on it.**

**Out of scope inside C2:** improving the *content* of either handoff. You are splitting a slot.

## C3 — The planner has no close-out

**The root cause, and the part with no existing machinery to extend.** `/checkpoint` captures a phase
to the vault and prompts a compact. It never writes to `.agents/state.json`.

**What is lost every planner roll, enumerated from this session rather than imagined:** the near-miss
register (exists on no disk anywhere); Aaron's standing rulings that are not ADR decisions — *mailbox
scope is SIA only*, *Forge pushes and opens PRs*, *the permission-laundering rule*; which PRs are
open and which the Planner has QA'd; the SHA frozen for a QA in progress; questions pending for
Aaron.

**What survives, and why that is not reassuring:** the rules in force, the error counts and the live
subject survive — **because the Planner retypes them into every brief by hand.** A hand-maintained
list beside the thing it describes is precisely the defect the Developer confessed to in
`walkTracked` on the same day. **The planner's continuity is currently implemented as the failure
mode this project exists to remove.**

**Concrete first deliverable, which the loop earned before it started:** returning the planner tree
to detached after a push belongs in the planner's close-out. It is the smallest possible instance of
the whole subject — **a correct procedure that no seat runs, because the seat that should run it has
nowhere to keep it.**

## C4 — The acceptance test, and it is binary

**Kill the planner session. Start a fresh one in `~/Projects/sia-planner`. Run `/start`.**

It must come back knowing **which seat it is, which loop is live, which PRs are open and which it has
already QA'd, the rules in force with their counts, and Aaron's standing rulings** —
**without reading a brief, and without a vault recall.**

**Either it does or it does not.** A `/start` that returns the right answer because a checkpoint
happened to rank well is a stand-in, not the thing (rule 5). **Run it with recall unavailable.**

**And run the whole loop's checks in all three worktrees plus the main tree**, per rule 13. A result
from one tree is not a result.

---

## Out of scope

**Loop 13's module boundary.** Finished before this starts. **If Loop 13 overran, this loop does not
absorb the remainder** — it gets its own loop.

**G-026 — recall precision.** Still open with its derivation intact. **C3 will be tempting to widen
into it** — "the planner's roll depends on recall, so fix recall" — and that is the displacing
argument again. **C3's answer is that the planner should not depend on recall at all.**

**G-027** — two seats deriving the same revision from the same base. **Not this loop, but C2 touches
the same file, so respect it: do not branch against a base someone is writing to.** The detached
planner worktree makes the Planner's half of G-027 harder to trip by accident; it does not fix it.

**T-152** — the tests are not type-checked at all, by tsconfig scope. Real, filed, not this.

**The `$declined` retirement** of `success_rate`, `Maturity` and `Rating`. Rides with whichever loop
next touches `lifecycle.ts`. **It must not drive sequencing.**

**And the standing one: do not end this loop at "one more measurement."** This loop's output is a
planner session that starts up correctly, not a number.

---

## Reporting

Boundary report at C1, C2, C3 and C4. `npm test` from the repo root; **`sync --check`** before any
commit — **`--check-only` does not exist and will silently run in fix mode** (T-150). **Rebuild the
main tree's build before trusting any MCP-served result** — the server runs from the main tree, and
on 2026-09-17 a stale server reported 22 checks against the CLI's 24 and reported a reconnect as
successful. Freeze a SHA and the Planner QAs read-only, **on disk as well as in the diff**, **and in
a tree that is not the one you built in.** If it moves, say so — **or show the disjointness, per rule
12.** On acceptance push branch and tag by name and open a PR. **The Planner merges, on Aaron's
word.** Close-out is a separate PR off master, per R4.

**A relay from the Planner is not Aaron's approval.**

**One question at a time to Aaron, with enough context to answer cold.**
