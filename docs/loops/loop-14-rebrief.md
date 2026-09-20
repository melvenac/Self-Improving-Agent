# Loop 14 re-brief — the three-seat record

**From:** Atlas (planner) · **Date:** 2026-09-19 · **Supersedes in part:** `loop-14-brief.md` (2026-09-17)
**Base:** `master` **after Loop 15 lands.** No SHA pinned, for the reason the original gave.
**Branch:** `loop/14-three-seat-record` · **Fresh session required**, per C4.

> **Why this file exists.** Loop 15 was sequenced ahead of Loop 14 on 2026-09-19 (`D-019`-era
> ruling; recorded in `loop-15-brief.md`) with the ruling that Loop 14 is **re-briefed, not
> deferred**. The original was written against two seats and no runtime. There are now **three
> seats**, and Loop 15 is building **the component that owns the artifacts Loop 14 planned to design
> by hand.** Run the original as written and its output is obsolete on arrival.
>
> **The original is not edited.** Merged briefs are not retro-edited in this repo; this file names what
> it supersedes and leaves the rest standing. Where a section below is silent, the original applies.

---

## What changed under the brief, verified 2026-09-19 rather than recalled

| Claim in the original | Status now | Checked by |
| --- | --- | --- |
| One tracked `AGENT.md`; every checkout greeted as Forge | **Fixed.** `.agents/AGENT.local.md` overrides per checkout (PR #37). | `cli-bootstrap.js` run in all four checkouts: Atlas, Forge, Probe, and the main tree. |
| The planner tree is at `~/Projects/sia-planner` | **Moved** to `~/Worktrees/sia-planner`; Forge to `~/Worktrees/sia-forge` (`T-153`). | `git worktree list` |
| Two seats | **Three.** Probe (QA) created 2026-09-19 at `~/Worktrees/sia-qa`. | Same. |
| Rules in force retyped into every brief by hand | **Now tracked** in `.agents/roles/shared.md`; Aaron's standing rulings there too. | `git ls-files .agents/roles/` → 4 files. |
| The near-miss register "exists on no disk anywhere" | **False when written** — it was in the session transcript. Now in `loop-13-closeout.md`. | `G-031`'s history; the close-out. |
| Count 35 / 24, provisional | **45 / 25** at Loop 13's close; **46 / 26** after this file — see *The count*. | `loop-13-closeout.md` §5. |
| "The Planner merges, on Aaron's word" | **Corrected:** Aaron merges. A relay from any seat is not his approval. | `.agents/roles/shared.md`. |
| "Clark (Planner)" | **Atlas.** Clark is the global assistant identity; Atlas is the seat. | Ruled 2026-09-17. |
| `handoff` is one slot, written only by the developer | **Still true.** Single object, written by session 64. | `state.json` at rev 39. |
| `/checkpoint` writes no state | **Still true.** | `grep -c ob_state checkpoint.md` → 0. |

**Two things the original could not have known, and both change the subject:**

1. **`G-032` — the role files are tracked and nothing reads them.** C1's deliverable said *"what it must
   not be is an untracked marker file that nothing reads."* The identity half is fixed; **the knowledge
   half is a tracked file that nothing reads**, which is the same defect with the `git add` done. Zero
   references from `open-brain/src` or `.claude/commands`. C1 is shipped and C1's warning is still live.
2. **Loop 15 produces `artifacts/iterations/tNNN/{D_t, A_t.gitref, E_t}` — a per-loop, per-role
   record, versioned in git.** That is most of what C2 and C3 asked for, built for a different reason.
   **Whether it is the planner's record, or only the runtime's, is the question Loop 14 now exists to
   answer** — and it cannot be answered until Loop 15's artifacts exist.

## The subject, re-stated for three seats

**The developer seat has a record. The QA seat will have one the moment Loop 15 runs — its `E_t` is a
tracked artifact by construction. The planner seat still has a narrative.** Loop 14 gives the planner
the same durable record the other two seats have, and decides where that record lives now that a
runtime owns per-loop artifacts.

**The planner's roll is unchanged and it is still the machine that manufactures its own errors:**
`/checkpoint` → `/compact` → nothing. Everything this seat did on 2026-09-18 and 19 to give itself a
record — the hand-written handoff, the close-out, direct `ob_state` writes, the role files — was done
by choosing to, in a session, and **the next planner has to be told where to look.** That is rule 4's
intention with better handwriting.

## Rules in force

**Not restated here.** They live in `.agents/roles/shared.md`, tracked, with provenance. **Restating
them in a brief is the hand-maintained-list defect C3 names**, and the original committed it. Read
`shared.md`; where it and an older brief disagree, `shared.md` wins.

**One addition since the original, numbered to match its list:**

14. **Do not assert what you could derive or check.** *A statement true when written, used as an
    invariant, and falsified by an ordinary act elsewhere that nothing connects to it.* Named
    2026-09-17. Seven instances in two days, all in the record layer, none in the code — including
    the original brief's own detach procedure (`--detach master`, wrong once another tree held that
    branch behind) and, twice, the rule about who writes the record last.

### The count

**46 Planner / 26 Developer**, from 45 / 25 at Loop 13's close. Two entries, one each, both from the
same exchange on 2026-09-19 and both set here rather than negotiated:

- **Developer 26** — *"the developer's `/end` is the last write to the record."* Reached the planner
  and Aaron. False for three seats: QA's `E_t` and the close-out both come after it by design. The
  developer withdrew it within the hour and asked for the entry.
- **Planner 46** — *"no seat takes a revision while another seat holds an unclosed session."* The
  replacement, reached the developer and Aaron. Falsified by the first mid-loop write the loop
  needed. **Both formulations encoded an assumption about how many seats are live at once.** The
  invariant is lineage, not sessions (`G-036`).

**A wrong rule that got falsified in an hour was worth more than a vague one neither seat could
test.** Both were checkable, so both got checked. That is the criterion working, and the entries are
the price of it.

---

## C1 — Seat identity per checkout · SHIPPED, with a remainder

**Done:** PR #37 (`AGENT.local.md` override), PR #44 (role knowledge tracked in `.agents/roles/`).
Verified through the real hook in all four checkouts, and verified to survive `git worktree move`.

**The remainder is `G-032`, and it is C1's own acceptance criterion failing:** *"if `/start` does
not consult it, it does not exist."* `/start` does not consult `.agents/roles/`. **Deliverable:** the
session-start pipeline loads the seat's role file and `shared.md`, and the greeting says it did — by
naming the file and its commit — so a seat starting in a checkout with a stale or missing role file
is told, not left to notice. **A tracked file that nothing reads is an intention with a `git add`.**

## C2 — The handoff slot · RE-SCOPED against Loop 15

**Still true:** one `handoff` object, `/end` writes it, the developer runs `/end`, so the planner's
handoff is discarded every roll. **Now also true for Probe**, which never runs `/end` either.

**What changed:** Loop 15's runtime writes `D_t`, `A_t.gitref` and `E_t` per iteration, versioned.
**Those are the developer's and QA's per-loop records, produced by a mechanism rather than a
command.** So the question is no longer *"how does `state.json.handoff` become per-seat"* — it is:

> **Is the planner's record `D_{t+1}`'s inputs — `S`, `E_t`, the index — or is it something the
> runtime does not carry?**

**Deliverable, conditioned on Loop 15's `E_t` existing:** enumerate what the planner needed at every
roll on 2026-09-18/19 — the near-miss register, open PRs and which were QA'd, the SHA frozen for a
QA in progress, questions pending for Aaron, rulings made mid-loop — and sort each into **carried by
the runtime's artifacts** or **carried by nothing**. The second list is C2's real scope. **Splitting
`state.json.handoff` into three slots is the fallback if that list is long; it is not the default.**

**Out of scope inside C2, unchanged:** improving the content of any handoff.

## C3 — The planner has no close-out · PARTLY ADDRESSED BY DOCUMENT, NOT BY MECHANISM

**What the original said was lost every roll, and where each is now:**

| Lost every roll (2026-09-17) | Now | Mechanism? |
| --- | --- | --- |
| The near-miss register | `loop-13-closeout.md` §5 | **No** — written by hand |
| Aaron's standing rulings | `.agents/roles/shared.md` | **No** — written by hand, read by nothing (`G-032`) |
| Which PRs are open / QA'd | Nowhere | **No** |
| The SHA frozen for a QA in progress | Nowhere — Probe's report will carry it | Loop 15, for QA only |
| Questions pending for Aaron | Nowhere | **No** |
| The detach procedure | `shared.md` (corrected to `origin/master`) | **No** — still run by hand |

**Every row that moved from "nowhere" to "a file" moved because a seat chose to write it, in a
session, and told the next seat where to look.** That is exactly the failure C3 describes, executed
well. **The acceptance criterion set on 2026-09-17 still holds and is still unmet by any mechanism:**

> *A planner close-out is good when its next reader can falsify it faster than they can believe it.*

**Deliverable:** a planner close-out that is **run, not remembered.** The concrete first piece is
unchanged from the original and still not done: **returning the planner tree to detached after a
push.** It has been run by hand five times since 2026-09-17. The second piece is new: **the planner's
`/end` equivalent writes the rows above that the runtime does not carry**, into a tracked artifact,
without the seat having to decide to.

**C3 must not widen into `G-026`.** The planner should not depend on recall at all. Unchanged.

## C4 — The acceptance test · CORRECTED, still binary

**Kill the planner session. Start a fresh one in `~/Worktrees/sia-planner`** — not `~/Projects`,
which the original names and which no longer exists. **Run `/start`.**

It must come back knowing **which seat it is, which loop is live, which PRs are open and which it has
QA'd, the rules in force with their counts, and Aaron's standing rulings — and which role file it
loaded, by commit** — without reading a brief, and with recall unavailable.

**Then do the same in `~/Worktrees/sia-qa`.** Probe is the seat with the least history; if the
mechanism only works for a seat that has been writing by hand for two days, it is the handwriting
that works.

**Run the loop's checks in all four trees**, per rule 13. A result from one tree is not a result.

---

## Out of scope, unchanged from the original except where noted

Loop 15's remainder, if it overran — it gets its own loop. `G-026`. `T-152`. The `$declined`
retirement. **Newly:** `T-154` (the `/start` memory-free route) and `T-155` (the shadow merge gate)
— both derived from Loop 15 and neither ruled as any loop's subject.

## Open for Aaron

- **Confirm the re-scoping of C2:** that the planner's record is defined against what Loop 15's
  runtime carries, rather than by splitting `state.json.handoff` three ways. This changes what gets
  built; it is a ruling.
- **Whether Loop 14 runs immediately after Loop 15, or after Loop 15's slice two** (the Jev gates).
  Slice two changes what `E_t` contains; C2's enumeration is cheaper to do once.

## Reporting

Boundary report at C1, C2, C3 and C4, as before. **Probe evaluates the frozen SHA; the planner does
not.** `sync --check` before any commit. The main tree's build and index must be current before any
MCP-served result is trusted — `build-freshness` and `gitnexus-index` now say so, and `G-034` records
why they can still be wrong. **Aaron merges.** Close-out is a separate PR off master.
