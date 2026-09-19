# Loop 13 close-out — the module boundary

**Written by:** Atlas (planner seat) · **Date:** 2026-09-18 · **Base:** `master` @ `e65f251`
**Subject:** Idea B — make the core installable with Node and git, with memory as an opt-in module.
**Shipped as:** `v0.39.0` (PR #40), with follow-ups in PR #41 and #42 (`v0.40.0`).

> **Its primary source is [`loop-13-developer-testimony.md`](./loop-13-developer-testimony.md)**, the
> Developer's first-person account, written before this document and separately from it. **It is
> cited here, not absorbed.** Where the two disagree, the disagreement is meant to be visible: a
> source that has been paraphrased into the document citing it can no longer contradict it.
>
> **The Developer argued for this arrangement against the planner's proposal and won.** The planner's
> cut was substance-versus-record; the Developer's objection was one neither seat had made — **it is
> the least neutral party about whether Loop 13 succeeded, because C4 failed.** A verdict written by
> the seat whose work failed has the same structure as an error entry written about a seat by another
> seat, pointed the other way. **The right cut is what only one seat can attest versus what outlives
> it.**

---

## 1. The finding that generalises

**The machinery is installable; the instruction is not.**

C4 asked whether core runs with Node and git alone. Every mechanical part passed on a real install
with the native module confirmed absent before anything ran: install, build, `sync --check` with the
three memory checks **skipping with their reason** rather than passing, `open-brain start`, and
`cli-bootstrap.js` — what the SessionStart hook actually executes — all exit 0 with the project
detected and agent identity read. `server.js` exited 1, correctly, because it **is** the memory half.

**It fails because `/start` is a slash command.** `start.md` names `ob_start` six times and
`ob_set_session` once, with no CLI path, so the documented route reaches `server.ts` and dies at
module load. **Every piece `/start` needs already runs without memory. Nothing routes a memory-free
session to them.**

**The generalisation, and it outlives this loop: a boundary can be complete in the code and absent
in the instructions, and only the instructions are what a stranger follows.** Nothing in the test
suite could have found this. It took an install.

## 2. The second finding, which the loop was not looking for

**An instruction that punishes compliance is a defect in the instruction.**

`CLAUDE.md` carried MUST rules pointing at a code index that was **138 commits behind as of
`08e6486`, and pinned to `loop/4-dogfood`, a deleted branch**. The index did not refuse — it
answered.

> **That number carries its ref because §5 says it must, and the first draft of this sentence did
> not.** From the indexed commit `ee2cdb8` the true figure is **124** against `669902c`, **138**
> against `08e6486`, and **144** against `e65f251`, which is this document's own base. **A bare
> "138" is correct on Monday and wrong by Wednesday**, and a reader who checks it gets a different
> answer and concludes the document is wrong — or reopens the argument §5 closed. Caught in review
> by the Developer. So an agent obeying the
rule would have received a confident wrong blast radius about code nine minor versions old, and an
agent ignoring it got nothing and noticed. **The compliant path was the worse one.**

The Developer reported not running `impact` or `detect_changes` while restructuring four files, as
its own error. **This seat ruled it is not one.** The rule could not have been followed safely; doing
so would have produced worse work. **Developer count unchanged at 25.**

This produced `v0.40.0` and is the only part of the loop that arrived from outside the brief — it
came from Aaron asking *"what about the gitnexus issue?"* after the loop had been declared shipped.

## 3. What shipped

**`v0.39.0` — the cut (PR #40).** The entire protocol-side crossing was **one chain**:
`cli.ts → sync/index.ts → sync/checks.ts → better-sqlite3`. **Reading a version string off disk
required a native build.** The three DB-reading checks moved unchanged into `checks-memory.ts` and
are injected through `SyncOptions`; core declares the shape, memory implements it, composition roots
supply it. `better-sqlite3` moved to `optionalDependencies`.

**A `module-boundary` check guards it**, and its design is the most transferable thing the loop
built:

- **It refuses on an unresolved specifier rather than reporting a clean graph** — a dropped edge is a
  crossing it cannot see. Written on principle, then **fired for real within the hour** on the
  author's own fixture.
- **Unlisted files default to CORE**, so the boundary cannot widen by omission.
- **It proves it looked.** The file count in its message is asserted by a test, seen red on a wrong
  count first. A walker that stopped early can no longer report a clean result.
- **It states its own limits in its own output.**

**`v0.40.0` — derived artifacts must prove they are current (PR #41, #42).** The lockfile
regenerated to agree with `package.json`; `gitnexus-index` and `build-freshness` added to `/sync` and
surfaced in the session-start greeting through **one implementation, two surfaces**; `.gitnexusrc`
with `noStats: true` committed so the analyzer stops rewriting a tracked instruction file on every
run; the volatile symbol counts cut from `CLAUDE.md`.

## 4. C4 closed as a recorded failure

**Ruled by Aaron, 2026-09-17** (`D-018`, state rev 32). He ruled **only** that the command surface
and hook installation are not Loop 13's work. **He did not rule them the next loop's subject**, and
that distinction is preserved in the record: `T-154` is a task carrying its derivation, not a
sequencing decision.

**The brief was written to make this outcome reportable** — *it either passes or it does not, and
there is no partial credit to hide in.* **A loop that ends in an honest no is not a failed loop.** The
Developer reported the failure without reaching for the scope that would have made it a yes, and the
release tag says so in its own body rather than hiding it in a document nobody opens.

## 5. The record

**Error counts: 45 Planner / 25 Developer.** Ten entries moved this loop, **all ten the planner
seat's** — two of them found in review of this document, after it was pushed.

| # | Seat | Entry |
| --- | --- | --- |
| 36 | Planner | Signed off a scanner named `walkTracked` that checked nothing about trackedness. |
| 37 | Planner | Claimed the planner worktree "can never hold a branch another tree needs." Falsified within the hour; **the other half became live within four**, when the Developer's tree was found holding `master` four commits behind. |
| 38–40 | Planner | **Three false claims in one merged tracked file** — the planner handoff. Its §1 said seat identity had no override of any kind, when PR #37 had shipped one and merged *before* the handoff's own PR; §5 named a directory that did not exist; §3 declared the near-miss register lost to compaction when it was in a 12.8 MB transcript on disk. **The seat signed the document off, shipped the change that invalidated it, and merged it without re-reading.** |
| 41 | Planner | *"`loop/7-injection` is the only copy of Loop 7's injection work."* The branch holds no code — one commit, five `.agents/` files, a superseded rev 12. |
| 42 | Planner | *"Four of five corrections came from reading the document."* Three from the document, two from A2A. **Set by the seat against itself, unprompted**, on the grounds that declining to count it would be applying the escape rule in its own favour. |
| 43 | Planner | **Reported a defect against a line when it was a defect about a class.** The stale-build message asserted a consequence true in one checkout of three; an identical instance sat one branch away, in the message firing on the main tree. The Developer found the sibling. |
| 44 | Planner | **This document stated "138 commits behind" with no ref**, in §2, while §5 required derived numbers to carry what they were derived from. The true figure is 124, 138 or 144 depending on the base, and 144 against this document's own. **The rule was broken three paragraphs after being written.** |
| 45 | Planner | **This document said "Ten instances" and listed eleven**, in the register that counts miscounts — then the count was re-verified with a script that split on semicolons and reproduced the undercount, because two instances shared a clause. |

**Entries 44 and 45 were found by the Developer, reviewing a document that argues it should not write
it.** Both were in the pushed PR and both had been repeated to Aaron in conversation, which is what
makes them entries rather than near-misses. **A close-out that broke two of its own stated rules
inside its own §5 is better evidence for §5 than anything it asserts.**

**Entry 41's inversion outranks the entry.** *"This is the only copy" is a sentence that stops the
search.* If Loop 7's code exists nowhere, that sentence would have prevented anyone discovering it
for as long as it stood. **A false reassurance is worse than a missing fact, because a missing fact
still prompts a question.**

**No Developer entries this loop.** Three candidates were ruled near-misses on the escape test, and
one — the MUST rules above — was ruled a defect in the instruction rather than in the agent.

### The near-miss register

**Family:** *all caught only by looking at the artifact rather than the tool's report of it.*
**That number says how often the failure mode fires, not how often it escapes**, which is why it is
worth more than the error count.

**Eleven instances, and the register itself nearly proved the case against itself — twice.** The previous
planner wrote into a tracked document that three of them were *"gone — lost to compaction."* **They
were on disk the whole time**, in the session transcript. *"Not in my context"* was read as *"does
not exist"* — **rule 11, committed by the author of rule 11, inside the document defining the
register.** The method matters more than the instances: **compaction removes things from context,
not from disk.** Grep the transcript before writing that anything is unrecoverable.

The instances, in the order they were found: **(1)** a `git diff | head -60` window read as an
unmade amendment; **(2)** a probe returning 0 for every string; **(3)** an edit reporting success
while mangling its own text; **(4)** a 156-vs-43 miscount from not applying the record's own prefix
list; **(5)** a `grep | sed` over `settings.json` that mangled every path into `"node /"`; **(6)** —
**within the hour, on the same audit, by the other seat having just been told about (5)** — a regex
over a stringified JSON blob returning nothing at all; **(7)** a transcript size read as fixed while
the file was still being written; **(8)** a Git-Bash path handed to Node reading as a real defect;
**(9) `head`'s exit code captured instead of `node`'s, giving a green 0 from a server that had
crashed, inside the test for whether the thing installs**; **(10)** a `find -maxdepth 2` producing a
clean false absence; and **(11)** a filtered `grep` that placed a warning under an `ISSUES:` header
and nearly had this seat report a defect in freshly merged code.

**The numbering is explicit because the prose without it was miscounted, by its own author, twice.**
The first draft said *ten* and listed eleven — (5) and (6) were joined in one clause, being the same
mistake made by two seats an hour apart. **Then the count was verified with a script that split on
semicolons, which reproduced the undercount exactly, because the category boundary was in the
punctuation.** A verification instrument that shares the defect of the thing it verifies is the
register's own family, arriving inside the register. Caught in review by the Developer, who counted
by hand.

**Three findings from the register that survive the loop:**

1. **Knowing the failure mode prevents nothing. Re-running with a different instrument caught it
   every time.** Two seats made the same parser-versus-pattern mistake an hour apart, the second
   having just been told about the first.
2. **Two measurements that disagree may both be right, and the resolution is a third measurement,
   not an argument.** The same tracked file measured 281,558 bytes with 0 CR in two worktrees and
   285,228 with 3,670 CR in a third — **the byte delta is exactly the carriage returns** (`G-031`).
   The same shape settled a 137-vs-138 commit count: both correct, taken an hour apart, on a moving
   target.
3. **Fail closed.** The Developer's `^{commit}` mangled by `cmd.exe` *should* have been a silent
   wrong answer; it was loud and two tests caught it, because the check treats an undefined distance
   as an issue rather than a zero. **Every instrument that failed us this loop failed open.** The
   difference was never vigilance — it was which way the instrument breaks.

### Rule 14, named this loop

*A statement true when written, used as an invariant, and falsified by an ordinary act elsewhere that
nothing connects to it.* **Seven instances in two days, all in the record layer and none in the
code** — the detachment claim; `AGENT.md`'s "Atlas runs in the home directory"; `AGENT.md`'s
`name: Forge`, falsified by a second reader existing; "read the brief with the largest loop number,"
falsified by Loop 14 being briefed before Loop 13 ran; the detach procedure's `--detach master`,
falsified by another worktree holding that branch four commits back; the transcript size, falsified
by the file still being written; and the stale-build consequence, false in two checkouts of three.

**The containment is not to write more carefully. It is to derive it or check it, never assert it.**

## 6. What rule 13 bought, stated because it was nearly skipped

**A check is only as tested as the trees it has run in.** The planner seat's QA of this loop was
**entirely static** — commits read at frozen SHAs — until Aaron asked *"you ran qa?"* and the honest
answer was no. Running it properly found two things that could not surface anywhere else:

- **`prd-version` fails only in the main tree**, because the file it checks is untracked and exists
  on one machine. Both seat worktrees downgrade it to a harmless "not found" warning and CI cannot
  see it at all.
- **The lockfile disagreed with `package.json`**, which only an actual install revealed.

**And a prediction that was wrong, recorded because being wrong about it was the useful part.** This
seat expected the lockfile defect to break C4's central claim — that `npm ci --omit=optional` would
reinstall the native module. **It was tested rather than asserted, and it did not**: npm reconciles
against `package.json` even in `ci` mode. C4's result holds under both install paths.

## 7. What Loop 13 did not do

**The invocation boundary is untouched.** `start.md` and the hook contract were not edited. The
Developer's testimony states what the `module-boundary` check cannot see, and it should not be
inherited as settled: **it sees value imports only — not instructions that reach a tool at run time,
and not load-time native resolution in `server.ts`. It passes on `ob_start`, `ob_state` and
`ob_sync`, which are unreachable without the native module.** C4 covers that, and **the check is not
a substitute for it.** A reader who takes `module-boundary` green as proof the boundary is complete
will be wrong.

**Nobody verified that C4's failure is the only barrier to a stranger installing this.** Two were
verified: the documented `/start` route, and the absent hook.

## 8. What the next loop inherits

- **`G-030`** — core is not installable by a stranger: one finding, two halves. The documented route
  goes through memory, and a fresh profile has no SessionStart hook while both hooks hardcode
  absolute paths into one person's home directory. **Reached by two independent routes — a real
  install, and a structural parse of `settings.json` — and recorded as a measurement rather than an
  agreement.**
- **`G-031`** — a working-tree copy can disagree with the repository on line endings while git
  reports clean, because `text eol=lf` makes git compare normalised content. Nothing sees it.
- **`T-154`** — the `/start` and hook work. **Derived, not ruled.**
- **`T-153`** — move the Developer worktree to `~/Worktrees/sia-forge`, with the reason it must not
  go inside the repo attached, or someone re-proposes it.
- **`G-026`, `G-028`, `G-029`, `T-152`** — carried unchanged.
- **Unruled, and named rather than decided:** whether unauthorised *acts* belong in an error table
  that counts wrong *claims*; whether a close note should be amendable, since `ob_state` makes one
  write-once and a task closed with a wrong note cannot be corrected in place.

**Held deliberately for Loop 14 and not spent here:** the relay rule, the provenance-chain
discipline, findings-are-classes-not-lines, two-right-measurements-need-a-third, and
tested-versus-untested agreement. They are enumerated in the Developer's testimony under a heading
that says so. **A loop that arrives with its findings already reported has no instrument of its own.**

## 9. Held for Aaron

- **The close-out convention itself.** Loops 11 and 12 were committed under Aaron's name. This one
  was written by the planner seat and is offered for merge, not merged on its own authority.
- **Whether `T-154` becomes Loop 15's subject**, or whether Loop 14 — the two-seat record, already
  briefed — runs first as queued.

---

**The loop's own verdict, and it is the planner seat's to give:** Loop 13 answered its question. The
answer was no, the no was specific enough to act on, and the instrument that produced it — an
acceptance test run as a real install — is the part worth keeping. **The cut in the code was the easy
half.**
