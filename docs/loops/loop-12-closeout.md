# Loop 12 close-out — make deletion a pipeline, not an intention

**Subject:** when something is cut, what must stop naming it — and can a machine check that?
**Base:** `ae1988d` → `loop/12-deletion`. **v0.37.0.**
**Seats:** Planner (Clark) · Developer (Forge, session 63) · **Aaron ruled the subject.**

---

## The finding that generalises

**An instrument that cannot distinguish "nothing there" from "I did not look."**

Four instruments failed that way today and they are one failure, not four:

- `grep -c … || echo 0` — the fallback fires when grep *errors*, printing 0 for broken, not clean.
- `grep … ; echo "(blank = not listed)"` — the echo fires **over** a real hit, printing a false
  negative beside the true positive.
- `find … | head -25` — a truncated list read as a complete enumeration. **It undercounted a
  nine-channel mailbox as six, while enumerating what was about to be deleted.**
- `git show <ref>:<path>` under MSYS with a slash in the ref — returns 0 for every string, including
  the ones that are present.

A zero, a blank, a truncation and a mangled ref **all render as absence**, and absence-of-evidence
becomes indistinguishable from evidence-of-absence. **The only defence that worked, every time, was
reading what the instrument returned rather than the number it reduced to.**

**What makes this the loop's best evidence is where it kept happening: inside the work describing
it.** Three near-misses today, each by an author who knew the failure mode intimately and shipped it
into a draft anyway — a dangling cross-reference in the close-out about dangling references, a
replace that printed `fixed` while deleting a line, and a bullet about mangled line endings that was
itself mangled. **Each caught only by looking at the artifact instead of the tool's report of it.**

**The delta below is about this repo. This is about how anyone verifies anything.**

## The headline for this project

**The record already existed, in prose, and it changed nothing.**

`.agents/LIFECYCLE.md` has a Component Log. Tracked. Correct since April:

```
2026-04-16 | /recall | PRUNED | Absorbed into /start
```

**The `/recall` reference survived to v0.36.0 anyway** — five months, thirty-four minor versions,
eleven loops, and an audit of 77 instruction files *looking for exactly that defect class*. It
survived because **nothing read the log.**

That is Loop 11's rule 4 in a single artifact — *every containment that worked was a command, every
containment that failed was an intention* — and it is the whole argument for this loop. A check found
it in one run, for free.

## What shipped

| | |
|---|---|
| **`command-names`** | resolves `/name` against the command files that exist. Found `/skill-scan` in the README's live Commands table and `/recall` from v0.2.0. |
| **`retirements`** | reads `.agents/retirements.json` on every `/sync`, over the whole history. 8 retirements, 4 event classes, 39 allowed referrers. |
| **`prebuild`** | `tsc` never deletes stale output. G-025's class is now structurally impossible. |

Both checks were **seen red on real defects before they were trusted**, with the repair isolated in
its own commit — so the failure is reproducible from history rather than asserted in prose. That is
strictly stronger than `command-tool-names`' scratch input, and it is the shape every future check
should use *where a real defect exists*.

## The generalisation this loop produced

**A referent is checkable only where a registry exists — and the filesystem is not one, because a
registry is a closed list of what exists *and may be named*, and the filesystem answers only the
first half.**

Tool names have a registry in `server.ts`. Command names have one in the command directories. **File
paths have none**, which is why the path check was built and **not shipped**: over the same surface
it produced six findings and one was real, the other five being prose that names a missing path
*correctly* — an obituary, an example, a conditional. Separating those means parsing intent.

**For a retired name there is no registry anywhere, because the thing is gone. So the record IS the
missing registry**, built by hand at the one moment anyone can build it.

## The delta — C4, and the order was the experiment

| | found | real | false |
|---|---|---|---|
| **pipeline, unaided** | 11 | **11** | **0** |
| **manual sweep, beyond it** | 7 | 2 | **5** |

**100% precision against 29%.** All five phantoms were `INBOX` — the *task* inbox, unrelated to the
mailbox — **rule 8 firing in the loop's own manual sweep**, caught only by reading each hit instead
of counting it.

**The shape beats the count.** The pipeline's entire blind spot is **one nameable structural
boundary: the repo root.** Both real misses are command mirrors under `~/`, and the same check
pointed at the four mirrors — as `command-names` already is — reaches both. **A closeable gap, not a
capability limit.**

**Swept together this reports "18 referrers found" and hides both the perfect precision and the
structural gap.** Freezing the pipeline first is what produced the finding; collapsing the steps
would have produced a number.

## Errors

**Developer 23 — undercounted the thing I was about to delete.** I enumerated the mailbox with
`find … | head -25` and reported **six** channels from a list the pipe had truncated. There are
**nine, eight non-empty** — I missed `worthit` (10 files) and `TCM` (6 files), two projects with
named seats this loop has never looked at. **An agent enumerating the thing it is about to delete
undercounted it by a third**, which is evidence for the stop rather than against it. Same class as
*a zero from a broken instrument*: a truncated artifact read as a complete one.

**Developer 24 — reported a flake count from memory.** I told the Planner the intermittent suite
failure happened once. It had happened twice in about seven runs. Corrected unprompted; three further
runs were clean; **the failure summary did not survive to my output on either occurrence, so I cannot
say which test it was.** Refusing to attribute it to G-016 on a shape match is the same discipline as
refusing to retire a task on its title.

**Planner 32, 33** — recorded by the Planner: a ruling's status asserted from the narrative rather
than the record (`D-004` is *recommended, not adopted*; Loop 7 never closed it), and a `C3` spec that
would have fired on four correct obituaries.

### The broken-check shape bit both seats, all day

**Planner 34 — a fallback `echo` that fired over a real hit.** `grep … ; echo "(blank = not listed)"`
printed a false negative *next to* the true positive during QA. **The fourth instance of this shape
today and the third inside a QA**, and only the true positive saved the reading. It is the same
family as Loop 11's `grep -c … || echo 0`, `git show` mangled by MSYS, and Developer 23's truncated
`head -25` above. **The loop should carry that its Planner kept committing this shape while ruling on it**
— which is the honest version of the pattern, not an aside.

**All four are one failure: an instrument that cannot distinguish "nothing there" from "I did not
look."** A zero, a blank, a truncated list and a mangled ref all read as absence. **The only defence
that worked, every time, was looking at what the instrument actually returned** rather than at the
number it reduced to.

**And the family arrived twice more while that paragraph was being written.** Both were caught
before reaching the file, and both are recorded here rather than in a commit message because they
are the clearest illustration the loop produced.

1. **A dangling cross-reference, in the close-out of the loop about dangling references.** The first
   draft cited "the substring row below". That row exists in **Loop 11's** close-out, not this one.
   Written by an author who had spent the day building a check for exactly that defect, into the
   document reporting it.
2. **A CRLF mismatch that made an edit report success while silently dropping a line.** A multi-line
   replace looked for two bare linefeeds in a file stored with carriage-return linefeeds, matched
   nothing, **printed `fixed`**, and left the running-count line deleted. The tool said it had worked. Only re-reading the file showed it
   had not — *the instrument that cannot distinguish "nothing there" from "I did not look", one
   more time, inside the paragraph defining it.*

**Running count: 34 Planner, 24 Developer.**

### What the table admits, and what it does not

**Written down so it is not decided case by case by whoever is holding the pen.** It came up because
the Developer asked whether a near-miss caught before commit should be numbered; the answer is no,
and the reasoning matters more than the verdict.

- **Error table** — a wrong claim that reached an artifact, a commit, a counterpart, or Aaron.
  Counted, numbered, attributed to a seat. **Every entry is something that would have misled someone
  if nobody had caught it.**
- **Near-miss register** — the same failure caught in-process by its own author. Recorded as
  instances of a named family, counted separately, **never numbered into the error table.**

**The dividing line is escape, not severity.** Admitting near-misses would change what the number
measures — from *errors that escaped* to *mistakes made*, which is every draft revision anyone has
ever done. **And it would tax the behaviour the table exists to encourage: a rule that adds a row
every time someone checks their own work makes checking your own work look like failure.**

**Near-miss count today: three, all one family** — the one this document now opens with. That number
says how often the failure mode *fires*; the error count says how often it *escapes*. Both are worth
having and they are not the same measurement.

## The mechanism caught its author four times

1. **C2** — `command-names` fired on its own repair. Writing `` `/recall` ``'s obituary in place is
   textually identical to the defect. **The obituary was dropped rather than reworded to dodge the
   check** — never reword to dodge a check; record the retirement and declare the referrer.
2. **C3** — case-insensitive matching made `KB_PATH`, a live variable, match the retired `kb_*`
   **tool** prefix. Rule 8 inside the check written to enforce it. Now strict by default, pinned.
3. **C3** — the backfill went red on `dream`, which no audit had looked for.
4. **R-010** — the `retirements` check caught `README.md` still describing
   `enableHeuristicRatings` as a live gate. **That line was written by me in C2, hours earlier, while
   repairing the same file for the same class of defect.**

**The fourth is the strongest argument the check is not ornamental, precisely because its author
could not avoid the defect by knowing about it.** Twice in one day my own text was caught by my own
mechanism. Knowing a failure mode intimately does not prevent it — it is the same finding this
document opens with, arriving in the code rather than in the prose.

## The check that passed by spelling

**Found in QA at `a3bcf2f` and recorded rather than fixed.** `skill-scan`'s pattern is
`skill[-_]?scan`, which does **not** match **"the skill scan"** with a space. `cli-session-end.ts:8`
uses exactly that spelling — **written by this loop's own C3 repair** — so that line **passes by
spelling rather than by rule.** The outcome is still right: the file is an allowed referrer under the
reflection-queue retirement. **The reason is accidental, and a genuinely dangling "the skill scan"
would pass too.**

**The fix is measured and cheap** — widening the pattern adds exactly two referrers needing entries,
both obituaries. **It was not applied**, because changing shipped matching behaviour after sign-off
needs re-QA rather than a quiet amend, and the SHA was signed off. Recorded as `coverage_gap` on
R-002 in the record itself, where the next person to touch that retirement will see it.

**This is the mechanism's own limitation showing in the mechanism's own file**, which is the right
place for it.

## Measured, not executed

**C4's retirement is blocked on scope, and the stop was correct.** `~/.agents/mailbox/` serves nine
channels. Aaron ruled on the one in front of him; executing it as written deletes **seven other
projects'** coordination state, including `nexcrm` (mason, quill, scout), `worthit` and `TCM`.

**One question, his alone:** *does "retire the mailbox" mean the `sia` channel, or the whole
transport?* `R-009` is deliberately **not** in the record — an unexecuted retirement would make
`/sync` red for everyone until a sweep that cannot legally begin.

## Two asymmetries the next loop inherits

**1. The record is self-checking in one direction only.** It verifies that recorded referrers are
still present and still name their retirement. **Nothing forces a new retirement to be recorded at
all.** That is exactly why the pass message says *green means every RECORDED retirement is finished,
not that every retirement is recorded* — in the output, where a reader in three months will see it,
not in this document.

**The successor gap, stated so it is inherited rather than rediscovered: a CUT ruling should not be
closeable without an entry.** That is what makes the record complete rather than diligent.

**2. `docs/loops/` carried this loop's conclusions as a habit, not a mechanism.** Every ruling in this
channel survives in a tracked file because both seats chose to write it down. **Nothing compels the
next loop to do the same** — the same shape as (1), and as every other finding here.

## The constraint on whatever replaces the mailbox

**A2A is a transport with no memory, and this loop is the evidence.** Four boundaries, four times the
reporting seat went idle before the reply drained, four nudges asking whether the ruling had arrived.
**From outside, an idle seat and a working seat are indistinguishable** — the read-ordering problem
one level up.

**The mailbox had the opposite failure: durable but unread**, and `/recall` is the proof.

**Neither transport alone makes a handoff both delivered and durable.** Not an objection — Aaron ruled
it — but the conclusions need a durable home even though the coordination does not.

## Held for Aaron

1. **The mailbox scope question** — the only blocker.
2. **`enableHeuristicRatings`** is gated off for a reason Loop 10 cut. Nobody has ruled whether the
   gate stays.
3. **`$declined`** — `success_rate`, maturity, apoptosis: behaviour cut, vocabulary live.
4. **D-004** itself, still recommended and not adopted.

## What this loop did not do

**It did not end at one more measurement.** Loop 11 measured 25 of 38. This loop built the thing,
shipped it red-first, and **declined to ship the half it could not make honest** — the path check —
rather than shipping something that cries wolf and gets switched off, occupying the slot a real check
would have had.
