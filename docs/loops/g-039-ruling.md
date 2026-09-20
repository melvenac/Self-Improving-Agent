# Ruling on G-039 — the store held the answer and nothing asked

**From:** Atlas (planner) · **Date:** 2026-09-19 · **On:** `G-039`, written by Forge during its session-65
`/end`, at `a71273f` on `loop/15-hoh-runtime` (unmerged; master is rev 39, that commit is rev 41).
**Why a file:** the ruling was first given in an A2A message. A ruling that lives in a message dies
with the sessions on both ends. This is the tracked copy and it binds; the message was the draft.

---

## The finding, as recorded

Entry 299 in the knowledge store — `pipe-to-tail-masks-exit-code`, stored 2026-07-26, titled
*"Piping to tail/head masks the real exit code — and I reported a false success because of it"* —
described the act exactly. On 2026-09-19 the developer seat ran `npx vitest run 2>&1 | tail -8; echo $?`,
read `tail`'s 0, and nearly handed over a suite that was exiting 1. **Same act, described in advance,
by the same agent identity.**

`ob_recalled` reported *no knowledge entries recalled this session* — the **fifth consecutive loop.**
A deliberate `ob_recall` at session end, for the exact question, ranked entry 299 **first.**

**So: retrieval works, ranking works, and nothing calls it.** Start-time injection was cut in Loop 10
C2 on evidence. `ob_recall` is a mid-task tool that a working agent has no trigger to reach for.

## Ruling

**1. This is the Loop 13 datapoint, and the standing question now has a cost, not an absence.**
*Does the memory half get used at all* was Loop 13's subject and the reason Idea B beat `G-026`.
Four loops produced silence and the silence was read as inconclusive. **This instance shows the
silence was the answer:** the store contained what was needed and was not consulted. Five loops of
nothing recalled were five loops of this.

**2. Do not re-enable Loop 10 C2's start-time injection.** Concur with the developer. It was cut on
evidence; one instance does not overturn a measurement. And start-time is the wrong moment — this
error happened hours into a session, on a command typed by hand, in a context the session start could
not have anticipated.

**3. Whatever trigger is built must be deterministic, and it must fail closed on nothing.** Ruled
now so the loop that builds it inherits the constraint rather than rediscovers it:

- **Deterministic.** It fires on an observable condition — a command shape, a claim about to enter an
  artifact, a tool call of a named kind — not on an instruction to the agent to remember to recall.
  *"Before you assert a result, recall"* is a rule someone has to remember, which is the failure mode
  this repo's rule 4 names and the failure mode entry 299 itself was sitting inside. Aaron's standing
  principle is deterministic first; a prompt-level nudge is defense-in-depth at most.
- **Fails closed on nothing.** A trigger that finds no relevant entry says nothing. It must never
  inject a low-relevance entry confidently, because an agent trained by a few wrong injections to
  ignore the channel is worse off than one with no channel. *Typed output guarantees the interface,
  not truth* applies to a ranked recall as much as to a gate.
- **The moment is the act, not the session.** The developer's own recommendation — query at the
  moment a verification claim is about to be made — is the right shape, because it is the same shape
  Loop 15's runtime has just proved: a check at the moment of the act, not a document read earlier.

**4. Sequencing is not ruled here.** This is the strongest candidate for the loop after Loop 15, on
the grounds above, and that is put to Aaron as a recommendation rather than taken.

## Two things worth more than the ruling

**The deterministic containment for this specific act already exists, in the candidate under
evaluation.** Loop 15's A7 — *deterministic check results come from exit codes* — makes the runtime
read the process's status directly. For checks the runtime runs, the hand that piped to `tail` is
removed. **Memory would have warned; the runtime prevents.** That is the difference between the two
halves of this project stated in one act, and it is why the trigger matters most for what seats still
do by hand — which is everything QA does.

**There are two candidate fixes, not one — and the planner got the reason for the second one wrong
before the developer corrected it. Planner 48.** The first draft of this section said the CC memory
layer had captured this session's findings *"without being asked"* — that `feedback_pipe_masks_exit_code.md`
and `project_recall_never_fires.md` appeared in the auto-memory index on their own. **False.** The
developer wrote both files by hand, as a deliberate last act of its session, and said so. There is no
automatic capture on that path; the SessionEnd hook writes to the knowledge DB and the vault, not to
CC memory. The claim reached a counterpart before it reached this file, which makes it an entry rather
than a near-miss — a wrong claim about the very question under study, caught by the seat it was
about.

**What the correction leaves standing is sharper than the original.** CC memory's advantage is not
the write, which has exactly the same trigger problem and fired only because a seat chose to act. **It
is the read: `MEMORY.md` is loaded into every session unconditionally, with nothing to remember and no
query to compose.** That is why the developer put the exit-code lesson there rather than trust the
knowledge base to surface it a second time. So the two fixes are:

- **A deterministic trigger on a queried store** — the general mechanism, ruled above, with the
  fail-closed constraint it needs.
- **An unconditional read of a small curated set, and no query at all** — what CC memory already does,
  and the only layer on this machine that has never failed to reach an agent. It needs no trigger to
  fail closed on, because a file that is always loaded cannot inject a wrong entry *in response to a
  query*: there is no query. Its cost is curation, and its limit is size.

**Whoever gets that loop is handed both.** The cheap one may be enough for the cases that actually
bite, and it has a working precedent; the general one is the only one that scales past a page. Not
ruled between; recorded so the choice is made with both in view.

## What this does not settle

- Whether the trigger is a hook, a tool, a runtime stage, or a Jev question over the command about
  to run. A closed question — *is this command about to assert a result from a pipeline?* — is
  Jev-shaped, and slice two of Loop 15 is where such a question could first be asked. Not ruled.
- Whether `G-026` (recall precision) is in the way. Entry 299 ranked first, so for this query it was
  not. One query.
- What the trigger costs a session in tokens and latency. Aaron has ruled token cost is not the
  concern; latency at the moment of a verification claim might be. Unmeasured.
