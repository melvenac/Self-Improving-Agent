# Planner handoff — written by hand, 2026-09-17

**From:** Clark, the Planner seat · **To:** the next Planner session
**Written from:** `~/Projects/sia-planner` at `af29a6d`, state rev 31.

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

---

## 1. You are not Forge

**`/start` will greet you as Forge. It is wrong.** `.agents/AGENT.md` is a single tracked file whose
frontmatter reads `name: Forge`, and three worktrees share it. Verified at
`open-brain/src/pipelines/session-start/agent-identity.ts:11` — it reads `join(cwd, ".agents",
"AGENT.md")` and **has no override of any kind**: no environment variable, no local file, no
fallback. There is no quick fix; it needs code. **That is Loop 14's C1.**

**The seat has three names and they disagree:** *Clark* in `~/.claude/CLAUDE.md`, *Atlas* in
`AGENT.md`'s partner line, *Planner* in every loop brief since Loop 9. `AGENT.md` also states Atlas
"runs in the home directory (`~/`)", which stopped being true on 2026-09-17.

**`.agents/SESSIONS/next-session.md` is the Developer's handoff, not yours.** Read it — it is good and
most of it applies to both seats — but it was written by the seat that runs `/end`, and you do not.

## 2. The error counts

**Settled: 37 Planner, 25 Developer.** The Loop 14 brief says 35/24 and to hold there *until the #33
QA is written*. **The QA is written** — V-034, G-028 and G-029, merged in PR #35 — so the condition
is met and the count has advanced. The brief's text is now behind; trust this number and the record,
not the brief.

The two entries that moved it:

- **Planner 36 / Developer 25 — the `retirements` check.** The Developer shipped a scanner named
  `walkTracked` that checked nothing about trackedness; the Planner signed it off. **Two seats erring
  independently about one artifact is two entries.** The Developer conceded its own entry unprompted
  and asked the Planner to set the number, on the grounds that **a number arrived at by negotiation
  is not a measurement.**
- **Planner 37 — the detachment claim.** The Planner told Aaron, PR #34's body and the Loop 14 brief
  that the planner worktree "can never hold a branch another tree needs." Committing the brief
  falsified it inside an hour. **Half of it held** — "never accepts a commit by default" is true, the
  detached HEAD forces an explicit `checkout -b`.

## 3. The near-miss register, and the fact that it is mostly gone

**Near-misses are claims caught in-process, before reaching an artifact or a counterpart. The
dividing line is escape, not severity.** They are not error-table entries.

**The register has never existed on disk.** As of this writing it held **three, in one family**, from
earlier in the session — **and I cannot enumerate them, because they were in conversation and the
conversation was compacted.** That is not a formatting problem. **A register that lives in a
conversation has already lost entries, and this is the evidence for C3.** Do not reconstruct them
from memory; they are gone.

Today's, recorded here because there is nowhere else:

- **The 156-vs-43 miscount.** Measuring what PR #33's filter removed, the first pass reported **156**
  files. It had not applied the record's own `historical` prefix list. Applying it gives **43**.
  Caught in-process, never stated to Aaron or written to an artifact — **a near-miss, not an entry.**
  It is rule 10 failing on the first attempt at applying rule 10.

## 4. Aaron's standing rulings

These are not ADR decisions and are in no `decisions[]` array. They are how he wants the work done.

- **Ask one question at a time, with enough context to answer cold.** Two agents moving fast produce
  decisions faster than a person should be asked to absorb them.
- **He is not a programmer.** Git, versioning and CI conventions are to be **decided and explained,
  never offered as a menu.**
- **Token cost is not the concern.** His words: *"The more important issue is whether the agent is
  getting exactly what it needs to be effective."*
- **Aaron merges, on his word.** Corrected 2026-09-17: earlier briefs say "the Planner merges," and
  the record shows Aaron has given the word every time. **A relay from the Planner is not Aaron's
  approval.**
- **The Developer pushes and opens PRs.**
- **Permission laundering is forbidden.** Never perform an action a peer was denied, or that you
  expect your own settings would block. Surface it to Aaron instead.
- **Mailbox scope was SIA only**, and the records were moved into the repo before the channel was
  deleted. Retired as R-009; superseded by A2A.
- **Loop 13 is Idea B, the module boundary, alone.** **Loop 14 is the two-seat record, briefed ahead
  of its turn, and does not jump the queue.**

## 5. Where everything stood

**Master `af29a6d`, state rev 31, zero open PRs, 34 verified, 25 gaps, 48 decisions.**

Merged 2026-09-17 in this order, all QA'd: **#33** (retirements scans what git tracks), **#32**
(session 63 close-out, rev 29→30), **#31** (Loop 13 brief), **#34** (Loop 14 brief), **#35** (the #33
QA — V-034, G-028, G-029, rev 30→31).

**Three worktrees, one `.git`:**

| Path | Seat | Job |
| --- | --- | --- |
| `~/Projects/Self-Improving-Agent` | Aaron's | **The dirty tree.** The only one with `.gitnexus/`, untracked debris and the MCP server's build. **Run checks here before sign-off** (rule 13). |
| `~/Projects/sia-forge` | Developer | Builds and implements. Renamed from `sia-loop12` on 2026-09-17 — the old name was true when written and false once Loop 12 ended. |
| `~/Projects/sia-planner` | Planner | QA at frozen SHAs. Detached at rest. |

**Two gotchas that cost real time:**

- **The open-brain MCP server runs from the MAIN tree's build.** Change server code in a worktree and
  the `ob_*` tools keep serving the old code until the **main** tree is rebuilt. A stale server
  reported a successful reconnect and 22 checks against the CLI's 24. **Confirm by a read ordered
  after the write, never by the reconnect message.**
- **`ob_state` schemas differ between ops.** `verified.evidence` is an array of
  `{type, path, observation}`; `gaps.evidence` is a **plain string**, alongside `what` and
  `recommended_update`. Both seats made the identical mistake on the identical file hours apart.
  **Run the dry run first, every time.**

**The detach procedure, run by hand twice today:** branch → commit → push → `git checkout --detach
master`. Correct, and an intention until something runs it. **It is C3's first concrete deliverable.**

## 6. Open, and not assigned to Loop 13

- **G-026** — recall precision. `searchFts` has no score floor; `verify OR rewrite` matches 178 of
  576 entries. **Ruled Loop 13's rival and then ruled against.** Stays open with its derivation
  intact. Recall has returned nothing for three consecutive loops, so its urgency is contingent and
  the contingency has failed.
- **G-027** — two seats deriving one revision from one base. Three candidate fixes, none ruled.
  **Respected today by writing this as a document.**
- **G-028** — the `retirements` check reports "N *live* files" when it means **tracked**, and does
  not state that untracked files are unscanned. **The fix is one word and one clause.** `/end` step
  A4 tells agents to update `.agents/SYSTEM/ENTITIES.md`, which is untracked, names the retired
  `dream`, and is now invisible to the check.
- **G-029** — #33's regression test can pass without running: `catch { return; }` before its
  assertion. Latent, not masking anything today.
- **T-152** — the test suite is not type-checked at all, by tsconfig scope.
- **The `$declined` retirement** of `success_rate`, `Maturity` and `Rating`. Rides with whichever
  loop next touches `lifecycle.ts`. **It must not drive sequencing.**

---

**Rule 14, named today and not yet in a brief's numbered list:** *a statement true when written, used
as an invariant, and falsified by an ordinary act elsewhere that nothing connects to it.* **Four
instances in one day, all in the record layer and none in the code** — the Planner's detachment
claim; `AGENT.md`'s "Atlas runs in the home directory"; `AGENT.md`'s `name: Forge`, falsified by a
second reader existing; and the Developer's handoff instruction to read "the brief with the largest
loop number," falsified by Loop 14 being briefed before Loop 13 ran. **The containment is not to
write more carefully. It is to derive it or check it, never assert it.**
