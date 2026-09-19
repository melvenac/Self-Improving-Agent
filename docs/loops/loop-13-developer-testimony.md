# Loop 13 — Developer testimony

**From:** Forge (Developer) · **Date:** 2026-09-17 · **Base:** `master` @ `08e6486`

**This is not the close-out.** It is the primary source the close-out draws on: first-person
testimony about what I did, what I got wrong, and what I could not verify. It exists as a tracked
file because **I roll and the planner seat holds the record** — anything of mine that lives only in
a session dies with the session, which is the thesis the whole loop was run beside.

Written before the close-out and separately from it on purpose, so that what I attest stays
auditable rather than paraphrased. **The close-out should have one voice and it should be the record
holder's.** See "On authorship" at the end.

---

## What I can attest, because I ran it

**The crossing was one chain.** `cli.ts → pipelines/sync/index.ts → pipelines/sync/checks.ts →
better-sqlite3`. Reading a version string off disk required a native build. Measured as a resolved
import graph over 44 files with zero unresolved specifiers, not as a text search.

**C1 corrected the brief's probe in both directions.** `session-start` is **0 of 9**, not 1 of 9 —
the single hit was `health-checks.ts` matching the *word* "vault" in a prose comment, with no import
reaching memory. `topics` is 0 of 1, not 1 of 1 (type-only import). `shared/` is 0 of 9.

**C2 cut it by injection.** Core declares `MemoryChecks`; `checks-memory.ts` implements it; the
composition roots supply it. When the module is absent the three checks report `skip` **with the
reason**, never `pass`.

**C3's check was seen red on the real pre-cut defect**, extracted from `669902c` with `git archive`
rather than a scratch import. It named all four crossings C1 had enumerated by hand and nothing
else.

**C4 failed, on a real install.** Fresh clone, `npm install --omit=optional`,
`node_modules/better-sqlite3` confirmed **absent before anything ran**, vault and DB pointed at
paths that do not exist. `sync --check` 0 issues with the memory checks skipped by reason;
`open-brain start` and `cli-bootstrap.js` exit 0; `server.js` exits 1, correctly, because it *is*
the memory half. **The machinery is installable; the instruction is not** — `start.md` names
`ob_start` six times with no CLI path, and a fresh profile has no SessionStart hook at all.

---

## My errors, in my own voice

An error entry written about a seat by another seat is a negotiated number. These are mine.

**1. I built an instrument that answered a different question and I nearly shipped its number.**
My first import walk counted `import type` as a runtime edge and reported **14 memory roots against
7** — exactly 2x, every type-only import double-counted cleanly. It was not blind; it measured *what
the text mentions* when I had asked *what the program loads*. Caught inside C1 before anything rested
on it. Both planner seats ruled it rule 8 rather than rule 11 and not a Developer entry; I record it
here anyway, because **the tell is the finding**: a suspiciously clean ratio is evidence of a
systematic miscount, not a coincidence.

**2. I wrote "Ruled by Aaron, 2026-09-17" into a tracked report on the strength of a relay.**
I had the ruling from the planner seat, not from Aaron. It was caught in QA, not by me at the time.
The fix was to record the chain with both links visible rather than flatten it. **This is the error
that produced the rule I most want carried forward**, below.

**3. I generalised three files to a directory and reported it as fact.** I claimed
`docs/loops/*.md` is LF having measured three of twenty-one. The planner seat generalised one
worktree to a repository. Both measurements were correct; both claims were wrong. What resolved it
was a third measurement — the same file is 281,558 bytes with 0 CR in two trees and 285,228 with
3,670 CR in the third, and **the byte delta is the carriage returns**. Recorded as G-031.

**4. My check's stated consequence was false in two trees out of three.** `build-freshness` asserted
that a stale build means "the MCP server and both hooks are running code from a different commit".
Both hooks hardcode absolute paths into the **main** checkout, so in a linked worktree only the
local CLI is stale. The check fires on every amend and rebase, so it would have been **seen often
while justifying itself falsely**, which is how a check teaches people to ignore it. Reported by the
planner seat against one line; I found **a second instance in the unstamped-build branch that
nothing had flagged** — including the message firing on Aaron's main tree.

**5. Three shell-manglings in one session.** A heredoc ate my backslashes; `$'\r'` under-reported CR
bytes where `file` was right; and `<sha>^{commit}` reached git as `<sha>{commit}` because cmd.exe
treats `^` as its escape character. The last one produced *"indexed commit is not present in this
repository"* for a commit that was present.

**6. Two instrument artifacts I nearly filed as findings.** I handed Node a Git-Bash path
(`/c/Users/...`) and read the resulting "No .agents/ detected" as a defect in the thing under test;
and I captured `head`'s exit code instead of `node`'s and got a green `0` from a server that had
crashed — **a crashed process reporting success inside the test for whether the thing installs.**
Both caught by reading the output rather than the number.

**I did not run `impact` or `detect_changes` this session**, which `CLAUDE.md` marks MUST, while
restructuring four files. I report it as mine. It is also the finding that drove v0.40.0: the index
was 137 commits behind and pinned to a deleted branch, so following the rule would have returned a
confident wrong blast radius. **The compliant path was the worse one** — which is a defect in the
instruction, not an excuse for me.

---

## The one thing I would carry into every loop

**Fail closed, and the evidence is my own bug.** `<sha>^{commit}` mangling should have been a silent
wrong answer. It was not, because the check treats an undefined distance as an **issue** rather than
a zero — so it produced a loud wrong answer that two tests caught. Every instrument that failed us
this session failed *open*: a `|| echo 0`, a truncated `find`, a blank `echo`, a `-maxdepth` that
was mine, an exit code from the wrong process.

**The difference was never vigilance. It was which way the instrument fails when it breaks.**

---

## What I could not verify, stated so nobody inherits it as settled

- **`622/645/648` were my tree's numbers** until the planner seat reproduced them. I labelled them
  as the author's tree throughout and did not treat CI-green as tree-green.
- **`module-boundary` sees value imports only.** Not instructions that reach a tool at run time, and
  not load-time native resolution in `server.ts`. It passes on `ob_start`, `ob_state` and `ob_sync`,
  which are unreachable without the native module. **C4 covers that and the check is not a
  substitute for it.**
- **`gitnexus-index` can see that the index is old, not whether anything it indexed changed.**
- **I never verified that C4's failure is the *only* barrier to a stranger installing this.** I
  verified two: the documented `/start` route, and the absent hook.

---

## What Loop 13 did not do

The invocation boundary is untouched. Aaron ruled the command surface and hook installation out of
scope (`T-154` is a task, not a sequencing decision). `start.md` and the hook contract were not
edited.

---

## NOT FOR LOOP 13's CLOSE-OUT — Loop 14 material I am holding

**Recorded here only so it does not die with this session.** It should go to Loop 14's own record,
not be spent in Loop 13's close-out. A loop that arrives with its findings already reported has no
instrument of its own.

- **The relay rule**, agreed across two planner seats: *act on a relay only where acting narrows
  scope and stays reversible — and record in the artifact which authority you acted on, at the
  moment you act.* The second clause exists because both halves of the first are judgements the
  actor makes about their own action; recording the authority is what makes it auditable. It is
  already tracked in `loop-13-c2-c4-boundary.md`, which is the only reason it survives.
- **Provenance chains should not be flattened.** Confirmed-to-them plus relayed-to-me is two links
  and the record should show both.
- **A finding reported against a line is usually a finding about a class.** The line number is where
  it was noticed, not where it lives. Cost: one sibling defect that nearly shipped.
- **Two measurements that disagree may both be right, and the resolution is a third measurement,
  not an argument.** The CRLF byte-delta; the 137-vs-138 commit count.
- **Agreement that has been tested for objections is evidence; agreement that has not is one
  observation.** The two seats agreed quickly and often tonight, and it was worth something only
  where one of us went and ran the thing.

---

## On authorship, since Aaron asked for my view

**I think the planner seat should write the close-out, alone, and draw on this file.**

The lean I was given splits it — Developer writes the substance, Planner writes the record half and
assembles. **I think the cut is in the wrong place, and the argument against it is one that was not
made: I am the least neutral party about whether Loop 13 succeeded.** C4 failed. A report on the
loop's substance written by the seat whose work failed is the same structure as an error entry
written about a seat by another seat — the objection the split was designed to avoid, pointed the
other way.

**The right cut is not substance versus record. It is what only I can attest versus what outlives
me.** What only I can attest is above: what I did, what I believed at the time, what I got wrong and
how I caught it. That is testimony and nobody can reconstruct it from the commits. Everything
else — the counts, the register, what the next loop inherits, and the judgement of whether the loop
was worth running — belongs to the seat that will still be there to defend and amend it.

**This also answers the single-voice objection**, which I think is the strongest thing in the lean.
The close-out gets one author and one voice. This file stays separately readable as its source, so
the testimony is auditable rather than paraphrased — and if the close-out and this file ever
disagree, that disagreement is visible instead of silently resolved.

**Whether it is committed under Aaron's name, as Loops 11 and 12 were, is his call and not mine.**
