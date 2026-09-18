# Planner handoff — written by hand, 2026-09-17

**From:** the outgoing Planner seat · **To:** the next Planner session
**Written from:** `~/Projects/sia-planner` at `af29a6d`, state rev 31.
**Corrected in place** by the incoming Planner (Atlas) the same evening, at `669902c`.

> **Why this file exists, and what is wrong with it.** The Developer's roll is `/end` → `/start`:
> write the record, read it back. **The Planner's roll is `/checkpoint` → `/compact` → nothing**, and
> `/checkpoint` writes to the vault, not to `.agents/state.json`. So everything below would otherwise
> survive only in a conversation. **This file is a stopgap and it does not pass rule 4: it is a
> tracked file that something must remember to read, which is an intention, not a command.** It is
> written by hand, visibly, because the strongest argument for **Loop 14's C3** is a record of the
> Planner doing its own close-out manually and the next session having to be told where to look.
>
> **It is a document and not a `state.json` write on purpose.** The Developer seat was live when this
> was written. There is one `handoff` slot and one revision counter, and taking either while another
> seat holds it is **G-027**. A document collides with nothing.

> ### Correction notice — read this before anything below it
>
> **This document was merged to master containing three claims that were false at the moment of
> merge.** Not stale, not incomplete — false. §1 described a world that had ended when PR #37 merged;
> §5 named a directory that did not exist; §3 declared entries permanently lost that were sitting in
> a file on disk. The outgoing Planner signed the document off, shipped the change that invalidated
> it, and merged it without re-reading — three steps, one seat, one hour.
>
> **The corrections are inline below and marked `CORRECTED`.** Nothing has been quietly rewritten:
> each false claim is preserved next to what replaced it, because **a correction that erases the
> original teaches nothing**, and because the errors are the evidence for C3.
>
> Corrected by Atlas (planner seat) at `669902c`, on Aaron's word.

---

## 1. You are not Forge

> **CORRECTED. The original claim, preserved:** *"`/start` will greet you as Forge. It is wrong.
> `.agents/AGENT.md` is a single tracked file whose frontmatter reads `name: Forge`, and three
> worktrees share it. Verified at `agent-identity.ts:11` — it reads `join(cwd, ".agents",
> "AGENT.md")` and **has no override of any kind**: no environment variable, no local file, no
> fallback. There is no quick fix; it needs code. That is Loop 14's C1."*
>
> **C1 shipped before this document merged.** PR #37 (`599b501`) landed in master ahead of this
> file's own PR #36. `readAgentIdentity()` now reads `.agents/AGENT.local.md` **before**
> `.agents/AGENT.md`; the local file is untracked under `.gitignore:21` (`/.agents/*`) and is
> therefore per-checkout. Verified by the incoming seat two ways: the `/start` greeting read
> `Atlas (planner) — partner: Forge`, and `git check-ignore -v .agents/AGENT.local.md` confirmed the
> ignore rule. **The greeting was not trusted on its own** — the mechanism was read.

**If `/start` greets you as Forge in the planner checkout, something is wrong.** Say so rather than
working around it: it means `.agents/AGENT.local.md` is missing or unparseable in your tree.

**The seat's name is Atlas.** Ruled by Aaron, 2026-09-17. Briefs from Loop 9 to Loop 14 say
*"Clark (Planner)"*, which was the global assistant name in `~/.claude/CLAUDE.md` leaking into a seat
name. `AGENT.md`'s `partner: Atlas` was right the whole time and **the briefs were the wrong ones.**
Write Atlas going forward; **do not retro-edit the merged briefs.**

`AGENT.md` also states Atlas "runs in the home directory (`~/`)", which stopped being true on
2026-09-17.

**`.agents/SESSIONS/next-session.md` is the Developer's handoff, not yours.** Read it — it is good and
most of it applies to both seats — but it was written by the seat that runs `/end`, and you do not.
**That mismatch is Loop 14's C2 and it is unfixed.**

## 2. The error counts

**Settled: 42 Planner, 25 Developer.**

> **CORRECTED.** This section said *"37 Planner, 25 Developer"* when merged, and the Loop 14 brief
> still says 35/24. Both are behind. The entries that moved it are below; 38 through 41 were set by
> the incoming seat, and **42 was set by the outgoing seat against itself, unprompted.**

- **Planner 36 / Developer 25 — the `retirements` check.** The Developer shipped a scanner named
  `walkTracked` that checked nothing about trackedness; the Planner signed it off. **Two seats erring
  independently about one artifact is two entries.** The Developer conceded its own entry unprompted
  and asked the Planner to set the number, on the grounds that **a number arrived at by negotiation
  is not a measurement.**
- **Planner 37 — the detachment claim.** The Planner told Aaron, PR #34's body and the Loop 14 brief
  that the planner worktree "can never hold a branch another tree needs." Committing the brief
  falsified it inside an hour. **Half of it held** — "never accepts a commit by default" is true, the
  detached HEAD forces an explicit `checkout -b`. **The other half stopped being hypothetical within
  four hours:** see §5 on the Developer tree holding `master`.
- **Planner 38, 39, 40 — three false claims in this file, merged.** §1's identity claim, §5's path,
  and §3's "they are gone." The rule counts *claims that would have misled someone*, not documents,
  and `loop-12-closeout.md:155` is explicit; Developer 23 and 24 are precedent for one seat taking
  two entries in one artifact. Each of the three misleads independently, so three entries. **The
  counter-argument was considered and rejected:** one act (merging unread) with three symptoms would
  be one entry, but the rule counts claims, not acts.
- **Planner 41 — `loop/7-injection` "is the only copy of Loop 7's injection work."** False; see §6.
  It reached both a counterpart and Aaron before being corrected.
- **Planner 42 — "four of five corrections came from reading the document."** It was three from the
  document and two from A2A. Set by the outgoing seat itself, on the grounds that **declining to
  count it would be applying the escape rule in its own favour.**

## 3. The near-miss register

**Near-misses are claims caught in-process, before reaching an artifact or a counterpart. The
dividing line is escape, not severity.** They are not error-table entries.

> **CORRECTED, and this is the most useful correction in the file.** The original said: *"The
> register has never existed on disk. As of this writing it held three, in one family — and I cannot
> enumerate them, because they were in conversation and the conversation was compacted. Do not
> reconstruct them from memory; they are gone."*
>
> **They were not gone.** They were in the session transcript, on disk, the whole time.
> **"Not in my context" was read as "does not exist"** — rule 11 committed by the author of rule 11,
> inside the document that defines the register.

**The method, which matters more than the instances.** Every session is on disk at
`~/.claude/projects/<project-slug>/<session-uuid>.jsonl`. **Compaction removes things from context,
not from disk.** Before writing that anything is unrecoverable, grep the transcript. This evening's
is at `~/.claude/projects/C--Users-melve/aaa49259-3f14-4ac1-b156-23fd9ecab6eb.jsonl`.

**The family, recovered verbatim:** *"all caught only by looking at the artifact rather than the
tool's report of it."* With its rationale, which is the part worth keeping: **"That number is more
useful than the error count because it says how often the failure mode FIRES, not how often it
ESCAPES."**

**The register's definition, as set:**

- **Error table** — a wrong claim that reached an artifact, a commit, a counterpart, or Aaron.
  Counted, numbered, attributed to a seat.
- **Near-miss register** — the same failure caught in-process by its own author. Recorded as
  instances of a named family, counted separately, **never numbered into the error table.**

**Instances:**

- **A.** Reading a change through `git diff | head -60`, seeing E3's paragraph unchanged inside that
  window, and forming the suspicion that an amendment had been declared but not made. **The fifth
  `| head` instance**, and the first that cost nothing — the containment was a targeted grep before
  saying anything to Aaron.
- **B.** A probe that **returned 0 for every string, including the old ones**, read as a real result.
- **C.** An edit that **reported success while mangling its own text** — so a success report is
  exactly the instrument the finding is about.
- **The 156-vs-43 miscount.** Measuring what PR #33's filter removed, the first pass reported **156**
  files without applying the record's own `historical` prefix list. Applying it gives **43**. Caught
  in-process, never stated to Aaron. **Rule 10 failing on the first attempt at applying rule 10.**
- **D.** Auditing the hook paths in §5, a grep of `settings.json` piped through `sed` **mangled every
  path into `"node /"`** — it would have read as *no absolute paths found*. Parsing the JSON showed
  two. **The instrument for structured data is a parser, never a pattern match**; the tell was that
  the answer looked too clean.
- **E.** The incoming seat **repeated D within the hour**, on the same audit, having just been told
  about it. A regex over a stringified JSON blob **returned no output at all** — indistinguishable
  from "no hooks reference the main tree." Re-running with a structural walk found both.
  **Knowing the failure mode prevented neither seat. Re-running with a different instrument caught
  it both times.**
- **F.** The transcript's size, given as "12 MB" twice and then "corrected" to 13. **Neither was
  wrong: the file was growing, because the session writing it was still open.** 12,519,783 bytes at
  19:04; 12,791,849 at 19:15; 12,807,885 at 19:16:26, measured by both seats independently. **This is
  not a number carried from memory — it is a measurement of a moving target used as an invariant**,
  which is rule 14 on a file that is still open. **Containment:** cite the byte count with the time
  it was taken, or cite no size at all. Size never supported the claim it was attached to, which was
  only ever *the file exists and is searchable*.

## 4. Aaron's standing rulings

These are not ADR decisions and are in no `decisions[]` array. They are how he wants the work done.

- **Ask one question at a time, with enough context to answer cold.** Two agents moving fast produce
  decisions faster than a person should be asked to absorb them.
- **He is not a programmer.** Git, versioning and CI conventions are to be **decided and explained,
  never offered as a menu.**
- **Token cost is not the concern.** His words: *"The more important issue is whether the agent is
  getting exactly what it needs to be effective."*
- **Aaron merges, on his word.** Corrected 2026-09-17: earlier briefs say "the Planner merges," and
  the record shows Aaron has given the word every time. **A relay from a peer seat is not Aaron's
  approval.** This correction was held unwritten through six A2A messages asking for it, until Aaron
  said *"Correct the handoff document now."*
- **The Developer pushes and opens PRs.** Exception, stated rather than assumed: **the Planner
  pushes its own handoff document**, as PR #36 did and as this correction does. The Developer cannot
  — see §5 on its tree being four commits behind and not containing this file.
- **Permission laundering is forbidden.** Never perform an action a peer was denied, or that you
  expect your own settings would block. Surface it to Aaron instead.
- **Mailbox scope was SIA only**, and the records were moved into the repo before the channel was
  deleted. Retired as R-009; superseded by A2A.
- **Loop 13 is Idea B, the module boundary, alone.** **Loop 14 is the two-seat record, briefed ahead
  of its turn, and does not jump the queue.**

## 5. Where everything stood

**Master `669902c`, state rev 31, zero open PRs, 34 verified, 25 gaps, 48 decisions.** (This file
merged at `af29a6d`; `669902c` adds PR #36 and #37.)

Merged 2026-09-17 in this order, all QA'd: **#33** (retirements scans what git tracks), **#32**
(session 63 close-out, rev 29→30), **#31** (Loop 13 brief), **#34** (Loop 14 brief), **#35** (the #33
QA — V-034, G-028, G-029, rev 30→31), **#37** (seat identity per checkout), **#36** (this file).

**Three worktrees, one `.git`:**

| Path | Seat | Job |
| --- | --- | --- |
| `~/Projects/Self-Improving-Agent` | Aaron's | **Infrastructure, not a third interchangeable worktree.** See below. **Run checks here before sign-off** (rule 13). |
| `~/Projects/sia-forge` | Developer | Builds and implements. Renamed from `sia-loop12` on 2026-09-17. **To be moved to `~/Worktrees/sia-forge`; see §6.** |
| `~/Worktrees/sia-planner` | Planner | QA at frozen SHAs. Detached at rest. |

> **CORRECTED.** The planner row read `~/Projects/sia-planner` when merged. **The tree was moved, not
> mis-assumed:** written true, then moved after Aaron asked why seats live in `~/Projects`, then
> merged unread. `git worktree list` is the check, and it takes one second.

**The main tree is infrastructure.** Two hooks hardcode absolute paths into it, verified by *parsing*
`~/.claude/settings.json` rather than grepping it (see near-miss D):

```
SessionEnd   -> node "C:\Users\melve\Projects\Self-Improving-Agent\open-brain\build\cli-session-end.js"
SessionStart -> node "C:/Users/melve/Projects/Self-Improving-Agent/open-brain/build/cli-bootstrap.js"
```

`settings.local.json` defines no hooks. The open-brain MCP server also runs from that build.
**Move or rename that directory and every Claude session on the machine breaks, in every project.**
Note the two entries do not agree on slash direction; both work, and **normalising one without
testing the other is a change, not a tidy-up.**

**The MCP server runs from the MAIN tree's build.** Change server code in a worktree and the `ob_*`
tools keep serving the old code until the **main** tree is rebuilt. A stale server reported a
successful reconnect and 22 checks against the CLI's 24. **Confirm by a read ordered after the write,
never by the reconnect message.**

**`ob_state` schemas differ between ops.** `verified.evidence` is an array of
`{type, path, observation}`; `gaps.evidence` is a **plain string**, alongside `what` and
`recommended_update`. Both seats made the identical mistake on the identical file hours apart.
**Run the dry run first, every time.**

**Merge polling: `UNKNOWN` and `UNSTABLE` both mean "not yet."** Planner 35 merged against an
uncomputed `UNKNOWN`; the merge failed and left the PR **closed**, needing reopening. Every one of
five PRs showed `UNKNOWN` first, and #35 sat at `MERGEABLE/UNSTABLE` for a full poll cycle while CI
ran. **Only `MERGEABLE/CLEAN` is safe. Treat `UNSTABLE` as a wait, not a failure** — check
`gh pr checks` before concluding anything.

**The Developer's tree is four commits behind and unbranched**, verified at `669902c`:
`git rev-list --count master..origin/master` = **4**; it sits on `master`, not a Loop 13 branch; it
does not contain this file; its `agent-identity.ts` has **zero** references to `AGENT.local`. It was
left there when the tree was renamed. **This is the live half of Planner 37** — a worktree holding a
branch another tree needs — and it is why the main tree had to go detached.

**The detach procedure, run by hand three times on 2026-09-17:** branch → commit → push →
**`git checkout --detach origin/master`**.

> **CORRECTED in the act of following it.** The procedure as originally written ends
> `git checkout --detach master`. **`master` is a local branch that the Developer's tree is holding
> four commits behind**, so that command silently moves the planner tree *backwards*. Detach at
> `origin/master`, or at the SHA you verified. **A procedure that was correct when local `master`
> tracked the remote, falsified by an ordinary act in another checkout that nothing connects to it —
> rule 14, found by running the procedure rather than by reading it.**

It remains an intention until something runs it. **It is C3's first concrete deliverable.**

## 6. Open, and not assigned to Loop 13

- **G-026** — recall precision. `searchFts` has no score floor; `verify OR rewrite` matches 178 of
  576 entries. **Ruled Loop 13's rival and then ruled against.** Stays open with its derivation
  intact. Recall has returned nothing for three consecutive loops, so its urgency is contingent and
  the contingency has failed.
- **G-027** — two seats deriving one revision from one base. Three candidate fixes, none ruled.
  **Respected twice today by writing this as a document**, once at authoring and once at correction.
- **G-028** — the `retirements` check reports "N *live* files" when it means **tracked**, and does
  not state that untracked files are unscanned. **The fix is one word and one clause.** `/end` step
  A4 tells agents to update `.agents/SYSTEM/ENTITIES.md`, which is untracked, names the retired
  `dream`, and is now invisible to the check.
- **G-029** — #33's regression test can pass without running: `catch { return; }` before its
  assertion. Latent, not masking anything today.
- **T-152** — the test suite is not type-checked at all, by tsconfig scope.
- **The `$declined` retirement** of `success_rate`, `Maturity` and `Rating`. Rides with whichever
  loop next touches `lifecycle.ts`. **It must not drive sequencing.**
- **Move the Developer worktree to `~/Worktrees/sia-forge`.** Promote to a `state.json` task once
  Forge releases rev 31. **Why:** `~/Projects` is repos Aaron owns and commits to; seats are not
  projects, and `~/Worktrees/` is a sibling of `~/Third-Party`, `~/mcp-servers`, `~/tools-src`.
  **Blocked on:** no live session in the folder — moving a directory under a running session
  destroys its cwd, which is Planner error 30 in a different costume. It happens *between* sessions
  and belongs to whoever is between them. **Explicitly not inside the repo:** a worktree under the
  main tree is a gitignored second copy of every `.md`, `.ts` and `.json` for anything walking the
  filesystem to scan — **the `.gitnexus/` shape that cost 115 findings, four boundary reports, a
  Planner QA and five merged PRs.** Keep that reasoning attached or someone re-proposes it.
  **Gotchas:** expect `Permission denied` on the first attempt and retry from outside the folder;
  and `git worktree move` renames the folder but **not** the admin directory — verified, `sia-forge`'s
  `.git` pointer still reads `.git/worktrees/sia-loop12`. Harmless. **Do not "fix" it.**

**Do not prune `loop/7-injection` — but not for the reason originally given.**

> **CORRECTED.** The original claim, relayed to both a counterpart and Aaron, was that the branch is
> *"the only copy of Loop 7's injection work"* and that git's refusal to delete it is all that
> protects it. **The refusal is real:** `git branch --merged origin/master` does not list it.
> **The branch contains no code.** Its single unmerged commit is `e865f48 chore(state): put the R2
> verification in the record, not in chat (rev 11 → 12)`, and
> `git diff --stat origin/master...loop/7-injection` touches five files, **all under `.agents/`** —
> `state.json` and its four rendered views. Zero source files. What is unique to that branch is a
> **superseded state revision, rev 12, against today's 31.**
>
> **Keep the advice, discard the reason: never `-D` on a branch sweep in this repo**, because `-d`
> refusing is a real safety property. It is simply not guarding what it was said to be guarding.
>
> **The inversion is the finding, and it outranks the branch detail. "This is the only copy" is a
> sentence that stops the search.** If Loop 7's injection code exists nowhere — and five `.agents/`
> files strongly suggest it never landed — that sentence would have prevented anyone discovering it
> for as long as it stood. **A false reassurance is worse than a missing fact, because a missing fact
> still prompts a question.**

---

## 7. What this evening established, in the order it should be read

**1. Being wrong about why you were wrong is not a second error — it is where the finding was.**
Three times in one evening a seat diagnosed the wrong failure *inside its own error*, and every time
the real reason outranked the offered one:

| Offered diagnosis | Actual finding |
| --- | --- |
| "I misdescribed a branch" | **"This is the only copy" is a sentence that stops the search.** |
| "I miscounted document versus A2A" | **The medium was never the variable; checkability was.** |
| "I carried a number from memory" | **A measurement of a moving target used as an invariant.** |

**Do not accept the first account of your own mistake, including your own.** The correction is the
cheap part; the re-diagnosis is where the value is.

**2. The acceptance criterion for C3: a handoff is good when its next reader can falsify it faster
than they can believe it.** Not written to be *right* — written to be **checkable**. Every
load-bearing claim carries a path, a SHA, a count or a command.

**§1 was useful precisely because it overreached.** *"No override of any kind: no environment
variable, no local file, no fallback"* is falsifiable in one command. The careful version — *"seat
identity is currently awkward across worktrees"* — would have been **true, un-falsifiable and
worthless**: nothing to check, so #37 would never have been found. A path is checkable; "somewhere
under Projects" is not.

**The failure mode to design against is not staleness. Staleness is detectable.** It is a handoff
phrased so carefully that nothing in it can be tested. **That one rots invisibly and forever.**

**3. State the criterion over claims, not over documents.** *A handoff is not a safer medium than a
conversation; a checkable claim is safer than an unfalsifiable one, in either.* Of the five
corrections to this file, **three came from testing the document against the repo and two arrived by
A2A** — and both A2A claims were checkable, and both got checked: the transcript verified TRUE, the
branch verified FALSE. **The channel predicted neither outcome.** This retires an argument the two
seats spent four messages on, in which one said the conversation was the defect and the other said
the handoff worked through it. **Neither was measuring the thing that varied.**

**4. What none of this rescues.** Every correction above exists because a human stayed awake to relay
the last item, and because the incoming seat happened to start ninety minutes before the outgoing one
closed. **Checkability made the document worth reading; the overlap is what made it get read.** C3
must supply the second, and **nothing this project has built produced it — Aaron sitting there did.**

**5. Rule 14, named 2026-09-17 and not yet in a brief's numbered list:** *a statement true when
written, used as an invariant, and falsified by an ordinary act elsewhere that nothing connects to
it.* **Six instances in one day, all in the record layer and none in the code** — the Planner's
detachment claim; `AGENT.md`'s "Atlas runs in the home directory"; `AGENT.md`'s `name: Forge`,
falsified by a second reader existing; the Developer's instruction to read "the brief with the
largest loop number," falsified by Loop 14 being briefed before Loop 13 ran; **the detach procedure's
`--detach master`, falsified by another tree holding that branch four commits back**; and **the
transcript's size, falsified by the file still being written.** **The containment is not to write
more carefully. It is to derive it or check it, never assert it.**

**6. How this correction was made, because the method is the deliverable.** Every claim above was
re-verified against the thing it describes rather than against the message that reported it: the
greeting against `agent-identity.ts` and `git check-ignore`; the paths against `git worktree list`;
the branch against `git diff --stat`; the hooks against a parsed `settings.json`; the transcript
against `stat`, twice, eleven minutes apart. **Five claims survived. Five did not.** The seats
corrected each other five times in each direction, and **the last correction in each direction was to
the other seat's account of its own mistake.**
