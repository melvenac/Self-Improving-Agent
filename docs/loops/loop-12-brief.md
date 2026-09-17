# Loop 12 brief — make deletion a pipeline, not an intention

**From:** Clark (Planner) · **To:** Forge (Developer) · **Date:** 2026-09-17
**Base:** `master` @ `207eb6e` — v0.36.0, state rev 22, 35 active tasks. **Check it, do not assume it.**
**Branch:** `loop/12-deletion` · **Tag:** yes, at the end. **Fresh session required.**

---

## The subject

Loop 11 audited 77 instruction files and found 38 defects. The distribution is the whole brief:

| question | count | what it is |
|---|---|---|
| **Q1** | **25** | names something that no longer exists |
| **Q2** | 12 | contradicts another file, or a check |
| **Q3** | **1** | the tool behaves differently from its description |

**Q3 = 1 across 77 files. The tools do what they say.** What rots is the prose around them, and it
rots at one identifiable moment: **when something is deleted.** All 25 Q1 defects pointed at things
the protocol removed itself — Loop 10's cuts, the `knowledge-mcp` → `open-brain` rename, the retired
`kb_*` prefix, the v1 vault.

**So this is not a synchronisation problem. It is a deletion problem, and deletion is a bounded
event you can put a procedure around.**

`/skill-scan` is the proof. **Loop 10 ruled it CUT. The source went; the prose stayed, in four
mirrors, for two loops.** When the ruling was finally executed, the command was referenced from
**eighteen files**. Deleting only the command would have manufactured **fifteen dangling
references** — the loop committing the exact defect class it existed to remove.

## What this loop is

**Build the thing that makes a retirement finish itself** — and make it standing, not a sweep. In
Aaron's own priority order from `CLAUDE.md`: deterministic first, structural second, prompt last.

**C1** enumerates what a retirement has to reach, across every event class that ends a name, and
completes the partial orphan count so C3 has a baseline. **C2** extends the check that shipped in
Loop 11 to the rest of the machine-checkable referents. **C3** is the half that has to outlive this
loop: a structured retirement record, a check that reads it on every `/sync`, and a build that prunes
itself. **C4 is the proof** — retire the mailbox, on Aaron's ruling, by running it through the
pipeline rather than by hand, and report what the pipeline caught against what a human had to.

**The measure of this loop is not how much it deletes. It is whether the next deletion finishes
without anyone remembering to make it** — and C4 is the only part that can tell you whether it does.

---

## Rules in force

Carried because each earned its place. **Read the Loop 11 close-out at
`docs/loops/loop-11-closeout.md` before C1** — it is tracked now, which it nearly was not.

1. **No claim enters the conclusions until someone has read the thing it describes, and the write-up
   names what was read.** Running count **31 Planner, 22 Developer**.
2. **A passing check is not evidence until someone has seen it fail.** `command-tool-names` shipped
   this way and must be the template: red on a scratch input, green again on removal.
3. **Two measurements that share a premise are one measurement.**
4. **Every containment that worked was a command; every containment that failed was an intention.**
5. **Do not check a stand-in for the thing; check the thing.** Cost a retracted finding in Loop 11 —
   raw md5 across a tracked/untracked boundary reported seven divergent commands where there were
   zero.
6. **A claim re-read from an artifact is not a claim derived from the thing it describes.**
7. **The title is not the record.**
8. **NEW — a substring check answers a different question than the one being asked, and the answers
   coincide most of the time.** **Five instances in Loop 11**, four where grep matched a *citation*
   of a retired thing and one where it was too literal to match a correct document. **Screening with
   grep is fine. Deciding on it is not.**
9. **NEW — for an instruction that produces artifacts, look at the artifacts.** `/checkpoint` and
   `server.ts:1198` were each internally consistent and produced `…-phase-1-phase-1.md` on **every
   checkpoint ever written**. No cross-reading finds that. `ls` does.

---

## C1 — Enumerate what a deletion has to reach, before deleting anything

**Pinned before any code is written.** The question is not "what is dead" — Loop 11 answered that.
It is **"when something is cut, what set of places must stop naming it, and which of those can a
machine check?"**

Produce that set from the evidence, not from intuition. **`/skill-scan`'s eighteen referrers are the
worked example and they are recorded in `e0b2fc8`.** Classify every one:

- **machine-checkable** — a tool name, a file path, a script name, a flag, a CLI subcommand;
- **prose-only** — a sentence describing behaviour, checkable by a human or not at all;
- **historical** — `DECISIONS.md`, `PRD.md`, the loop docs, session logs. **These keep their
  references and must be excluded by rule, not by judgement each time.**

**Record the three counts before you build anything.** The ratio decides how much of the problem C2
can actually reach, and it is the honest ceiling on this loop's result.

### C1b — A rename is a deletion. So is retiring a prefix.

**The brief would miss the two largest sources in its own data if it only covered CUT rulings.** Of
Loop 11's 25 Q1 defects, the biggest clusters are the **`knowledge-mcp` → `open-brain` rename** and
the **retired `kb_*` prefix**. Neither was ruled CUT by anybody. They are deletions wearing a
different name, with identical consequences: the old name stops existing and the sentences naming it
stay.

**Enumerate the event classes, not just the rulings:** a component cut · a file or module renamed ·
an identifier prefix retired · a flag or subcommand removed · a dependency dropped. **Every one ends
with "a name that used to resolve no longer does."** If the pipeline covers that sentence, it covers
all of them; if it covers only `CUT`, it covers the minority.

### C1c — Finish the orphan enumeration, and record the baseline

**The 2026-09-17 sweep was partial and the Planner said so.** It covered `.agents/` two levels deep
and `open-brain/build`; it cut 20 files and 14 branches. **It never looked at `project-template/`,
the 59 session logs, `.agents/archive/`, `open-brain/docs/`, or the test fixtures.**

**Complete it, and record the count before C3 changes anything.** That number is the "before" the
pruning mechanism is measured against — without it, C3 ships with no way to show it worked.

## C2 — Extend the checkable set

**`command-tool-names` (`checks.ts:977`) is the shape.** It resolves every `ob_*` a command names
against the server's registration sites — **80 references across 32 command files to 14 tools** —
and it reads the registry from the registration sites rather than a list beside them.

**Extend the same mechanism to the other machine-checkable referents**, in the order C1's counts
justify. Candidates, to be confirmed or displaced by C1:

1. **File and directory paths** named in commands and skills. Would have caught
   `.agents/workflows/test.md` and `harness-eval.md`.
2. **Script and module names** — `session-end.mjs`, `skill-scan.mjs`, `vault-sync-projects.mjs`.
   Every one named a file that does not exist.
3. **Flags and subcommands**, which is **T-150's mirror image**: `--check-only` was silently
   discarded and the tool ran in fix mode. **A check that a named flag exists, and a CLI that
   refuses an unrecognised one, are the same repair from two sides. Do both.**
4. **The retired `kb_*` prefix** — already covered; verify it stays covered.

**Each check ships only after it has been seen to fail.** State both results in the write-up.

**Out of scope for C2, and say so in the check's own output as `command-tool-names` already does:
none of this catches a tool that lies about itself.** Two of fourteen tool descriptions were false
in Loop 11 and **both tools existed under exactly the names the commands used**. A name check is
green on that class forever. **Never describe these checks as covering it.**

## C3 — The structural half: make the pipeline standing, not a sweep

**This is the part the first draft of this brief got wrong, and the Planner says so plainly.** As
first written, C3 was *prune the build and sweep the dangling references* — **a one-time repair**.
Do that and the loop ends with the project in exactly the same exposure the next time something is
cut. **That is the failure shape this entire sequence keeps rediscovering: a repair where a mechanism
was needed.**

**1. Make the retirement record DATA, not a sentence in a close-out.**

Today a ruling lives as prose, so *"has this cut finished?"* can only be answered by a person
remembering to grep. **Give it a structured record** — what name was retired, which session ruled it,
what class of event (cut / rename / prefix / flag), what referenced it at ruling time, and which
paths are allowed to keep naming it (the historical set from C1).

**Then one check reads that record and asserts, for every retirement ever made, that nothing outside
the historical set still names it.** It runs on every `/sync`, forever, over the whole history — not
over whatever this loop happened to look at. **That is what converts C3 from a sweep into the thing
that makes sweeps unnecessary**, and it is rule 4 stated exactly: a command instead of an intention.

**`/skill-scan` is the test case.** It was ruled CUT with no record that eighteen files named it, and
that missing number is precisely what made the ruling expensive two loops later. **Backfill the
record with Loop 10's and Loop 11's retirements and confirm the check goes green only because they
are genuinely finished** — not because the record is empty. An empty record passing is the same
defect as an unfallen check.

**2. Make the build prune.** `open-brain/build` is not pruned on rebuild; Loop 11 cut **twenty**
orphaned `.d.ts` / `.js.map` files with no `.js` beside them, in two passes, because the first pass
worked from a description rather than the filesystem (**Planner error 32**). **A build that removes
what its source no longer produces ends that whole category at the source.**

**3. ~~Finish T-151~~ — DONE BEFORE THIS LOOP STARTED.** Session 62 shipped `.gitattributes` and it
merged as PR #21. The Planner then ran the clone that V-026 had only proxied: `git clone` of
`fed9e99`, `npm install` with no shared `node_modules`, **44 files / 588 tests passing**, recorded as
V-028. **Do not re-do it. Its slot in this loop is taken by C4.**

---

## C4 — Retire the mailbox, and let the pipeline do it

**Aaron's ruling, 2026-09-17:** *"the mailbox was pre-A2A and should be retired. HoH with A2A solves
the agent-to-agent communication issue."* **This is his decision, not the audit's.** What is the
loop's to decide is only *how* it is executed.

**Why it belongs in this loop and not the next one.** C3 backfills retirements that are already
finished, so the check would go green because there is no live work in the record — **rule 2 broken
by the loop that exists to enforce it.** The mailbox is the largest live retirement available:
`/start`'s mailbox step, `/end`, `AGENT.md`'s `mailbox_channel`, `~/.agents/mailbox/README.md`, the
`{sender}-to-{receiver}` convention, four command mirrors, eight loop briefs and a 285 KB
`decisions.md`. **If the pipeline can finish this, it works. If it cannot, better to find out on the
loop that built it.**

### C4a — Order. Do not collapse these two steps.

1. **Freeze the pipeline from C3.** Then run it against the mailbox retirement and **record what it
   reports, before anyone sweeps by hand.**
2. **Then sweep by hand**, and record what the sweep found that the pipeline missed.

**The difference between those two numbers is this loop's most valuable output.** It is the measured
answer to the question C1 can only estimate — *how much of this problem can a machine actually
reach?* **Sweep them together and a clean result proves nothing**: it cannot distinguish a working
pipeline from a careful agent, which is the confound this project has spent eleven loops learning to
avoid.

### C4b — The record needs a home before the transport dies.

**Everything in the mailbox now has a better place than it had a week ago, which is why this is
possible at all:**

- **loop briefs and close-outs → `docs/loops/`**, tracked since Loop 11 and no longer silently
  ignored;
- **decisions → `state.json` `decisions[]`**, which already supersedes the 285 KB `decisions.md`;
- **ephemeral coordination → A2A.** It needs no durable home, but **its conclusions do.**

**The hazard, stated plainly: A2A is a transport with no memory.** Session 61's entire close-out
travelled that way and **exists in no file anywhere** — it could not be grepped by either seat and it
cost a false attribution and a correction. Session 62's survived only because its author also wrote
it to a file. **Retiring the mailbox without landing the record half repeats session 61 permanently.**

**And do not delete the channel this loop is running on while it is running on it.** Move the brief
and the boundary reports into `docs/loops/` **first**, prove the loop works that way, **then** retire.
A brief in `docs/loops/` is a tracked artifact the Developer reads natively — strictly better than an
untracked file outside the repo reached through a convention that was already wrong this morning.

### C4c — What is NOT being retired

**The protocol is the portable asset; the files were its implementation.** Named seats, a frozen SHA,
read-only QA by the seat that did not build it, structured boundary reports, *a relay is not
approval*, the error table. **None of that is mailbox-specific and none of it goes.** If the
retirement touches any of it, stop and report — that is a scope error, not a repair.

## Out of scope

**The three held files** — `research-wiki-audit.md`, `v2-pipeline-e2e.md`, and the 2026-03-25 debug
report. They carry intent recorded nowhere else and cutting them is Aaron's call, not an audit's.

**`loop/7-injection`** — holds commits that never reached master. Real, not debris. Its own question.

**T-149 (a worktree per seat)** — filed, demonstrated three times in one day, still not implemented.
**Use worktrees this loop regardless; implementing the task is not this loop's subject.**

**Idea B, the module boundary** — core installable with Node and git, memory an opt-in module.
**Scheduled as Loop 7 and displaced four times, every time into a loop that had its own subject.**
It needs no measurement, which is exactly why it keeps losing. **It should be Loop 13, alone.** Do
not fold it in here; that is the mechanism by which it has been lost four times already.

**~~The mailbox channel question~~ — RULED BY AARON AND NOW IN SCOPE AS C4.** This brief previously
deferred it for want of his decision. He gave it: retire the mailbox, A2A plus HoH covers the
transport. **It is no longer a question, and it is this loop's proving subject.**

**Generating prose from code**, and **asserting load-bearing prose in tests**. Both are real answers
to the Q3 class — the one `skill-scan` string that had a test could not change silently, while none
of the eighteen `.md` references had anything of the kind. **Both are a loop of their own.**

**And the standing one: do not end this loop at "one more measurement."** Loop 11 measured. The
number is 25 of 38. **Build the thing.**

---

## Reporting

Boundary report at each of C1, C2 and C3. `npm test` from the repo root; `/sync` before any commit —
and **`--check`, which exists; `--check-only` does not and will silently write.** Freeze a SHA and
the Planner QAs read-only, **on disk as well as in the diff**. If the SHA moves, say so; a sign-off
does not transfer across an amend. On acceptance push branch and tag by name and open a PR.
**The Planner merges, on Aaron's word.** Close-out is a separate PR off master, per R4.

**A relay from the Planner is not Aaron's approval.**

**One more, learned the hard way in Loop 11:** Aaron has asked for **one question at a time, with
enough context to answer it cold.** Two agents moving fast produce decisions faster than a person
should be asked to absorb them. **Queue them; do not batch them.**
