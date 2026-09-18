# Loop 13 — C2 / C3 / C4 boundary report

**From:** Forge (Developer) · **To:** Atlas (Planner) · **Date:** 2026-09-17
**Base:** `master` @ `669902c` (rev 31) · **Branch:** `loop/13-module-boundary` · **Commit:** `9d81583`
**Suite:** 620/620 · **`sync --check`:** 0 issues · **Not pushed, not tagged, not merged.**

C1 is `docs/loops/loop-13-c1-boundary.md`.

---

## C2 — the crossing is cut

**It was one chain**, exactly as C1 measured:

```
cli.ts  ->  pipelines/sync/index.ts  ->  pipelines/sync/checks.ts  ->  better-sqlite3
```

Reading a version string off disk required a native build.

**The cut, by injection rather than import.** The three database-reading checks —
`vault-index-parity`, `schema-version`, `project-dirs` — moved **unchanged** into
`pipelines/sync/checks-memory.ts`. `runSync` now *receives* them through
`SyncOptions.memoryChecks`. Core declares the shape; memory implements it; a composition root that
has established the memory module exists supplies it — `cli.ts` by a dynamic import that is allowed
to fail, `server.ts` statically because it *is* the memory half.

**`checks.ts` also held a second edge** that a directory-level count would have missed:
`import { SCHEMA_VERSION } from "../../db-v2.js"`. It moved with the functions.

**When the module is absent the three checks report `skip` with the reason, never `pass`.** An
uninstalled module and a healthy database must not render identically — rule 11, applied at the
point where it would have been cheapest to ignore.

**`better-sqlite3` moved to `optionalDependencies`**, so a failed native build no longer fails the
install.

**Measured after the cut, same instrument as C1:**

| File | Before | After |
|---|---|---|
| `cli.ts` | reaches memory | **clean** |
| `pipelines/sync/checks.ts` | memory ROOT | **clean** |
| `pipelines/sync/index.ts` | reaches memory | **clean** |
| `pipelines/sync` | 3 of 7 | **1 of 8** (the new memory file, on the far side) |

**Out of scope and respected:** nothing behind the boundary was improved. The three checks are
byte-identical apart from their new home.

---

## C3 — the boundary cannot re-close silently

**`module-boundary`**, in core's `checks.ts`, registered in `runSync` and printing unconditionally.

**Seen red before it was trusted, on the real defect rather than a scratch import.** The pre-cut tree
was extracted from `669902c` with `git archive` and the check run against it:

> `issue` — core imports memory in 4 place(s) — the module boundary has re-closed:
> `cli.ts -> pipelines/sync/index.ts`; `pipelines/sync/checks.ts -> db-v2.ts`;
> `pipelines/sync/checks.ts -> better-sqlite3 (native build, direct)`;
> `pipelines/sync/index.ts -> pipelines/sync/checks.ts`

**It named all four crossings C1 had enumerated by hand, and nothing else.** Green on the fixed tree,
`skip` with a reason when `open-brain/src` is absent. Three states, all observed.

**A fourth state, found by accident and kept.** My first red run failed on *the wrong condition* — an
unresolved import, because I had deleted `checks-memory.ts` from the fixture while `server.ts` still
referenced it. The check **refuses** on an unresolved specifier rather than reporting a clean graph,
because a dropped edge is a crossing it cannot see. That guard was written on principle; it fired for
real within the hour.

**`import type` is excluded, and a test asserts it.** This is the same correction that ran through
C1: counting type-only imports as runtime edges reported **14** memory roots against **7** real ones.

**Unlisted files default to CORE.** A new file must be *declared* memory-side to be allowed a
database import, so the boundary cannot widen by someone forgetting.

**Its limits are in its own output, not only in this document:**

> LIMIT: sees value imports only — not instructions that reach a tool at run time, and not
> load-time native resolution in `server.ts`.

**The regression test uses `fs` and nothing else.** No subprocess, no try/catch with a bare return —
G-029's shape is the thing it is built to avoid. 10 cases.

---

## C4 — **the machinery is installable; the instruction is not**

**C4 closes as a RECORDED FAILURE.** The command surface and hook installation are a later loop's
subject and out of scope for Loop 13. `start.md` and the hook contract were not touched.

> **Provenance of that ruling, stated because rule 1 requires it.**
>
> **Confirmed first-hand to the planner seat.** Aaron ruled it in-session to Atlas, in his words:
> *"yes, Loop 13's C4 closes as a recorded failure."* Atlas holds that directly and has written it
> to state as **D-018 at rev 32**.
>
> **It reaches Forge as a relay, and is recorded that way.** This seat has not had it from Aaron
> in-session. That is a weaker link than Atlas's and the record should not flatten the two into one
> claim — an earlier draft of this section said simply `Ruled by Aaron, 2026-09-17`, which
> attributed a decision to a person on the strength of a relay. Caught by Atlas in QA, not by me at
> the time.
>
> **What the ruling covers, and what it does not.** Aaron ruled the command surface is **not Loop
> 13's**. He did **not** rule it the next loop's subject — that is `T-154`, a task, not a decision.
> He said **nothing about push, tag or PR**; that instruction travelled in the same relay and has
> reached neither seat from him. **The branch is held.**

**This section is the deliverable.** The brief was written to make this outcome reportable —
*that either passes or it does not, and there is no partial credit to hide in* — and a loop that
ends in an honest no is not a failed loop.

**Done as a real install.** `git clone` of the branch into a fresh directory,
`npm install --omit=optional`, `npm run build`. **`node_modules/better-sqlite3` confirmed absent
before anything was run** — the test is invalid if the native module is quietly present, so that was
checked rather than assumed. `KNOWLEDGE_V2_DB` and `OPEN_BRAIN_VAULT_DIR` pointed at paths that do
not exist, so "no vault, no database" is real rather than incidental.

**What passes:**

| | Result |
|---|---|
| `npm install` with no native build | **succeeds** |
| `npm run build` | **succeeds** |
| `open-brain sync --check` | **0 issues**, 21 passed, 4 skipped — the three memory checks skipped *with the reason* |
| `open-brain start .` | **exit 0**, project mode, state loaded |
| `cli-bootstrap.js` (what the SessionStart hook runs) | **exit 0** — project detected, SESSION_UUID resolved, agent identity read |
| `state-schema` check | **pass** — `state.json` read, rev 31, 49 tasks |
| `server.js` (the MCP server) | **exit 1**, `Cannot find package 'better-sqlite3'` — **correct**: it *is* the memory half, and C4 specifies no MCP server |

**Why it fails — and it is ONE finding with two halves, not two findings.**

Every piece `/start` needs runs without memory: `cli-bootstrap`, `sessionStart`, the state render,
the four residual reads. **Nothing routes a memory-free session to them, and nothing puts the route
on a stranger's machine.**

1. **The documented route goes through memory.** C4 is *"`/start` works"*, and `/start` is a slash
   command, not a function. `.claude/commands/start.md` names **`ob_start` six times** and
   `ob_set_session` once, with **no CLI path**. A stranger following it reaches `server.ts`, which
   resolves `better-sqlite3` at module load and exits 1.
2. **A fresh profile has no SessionStart hook at all.** Both hooks in `~/.claude/settings.json`
   hardcode absolute paths into `C:/Users/melve/Projects/Self-Improving-Agent`. If acquiring one
   means hand-editing `settings.json` with an absolute path into one person's home directory, then
   **core is installable by Aaron, on this machine** — the proxy the brief forbids.

**Found twice, from two directions, by two seats:** Atlas by parsing `settings.json` (having first
mangled it with `sed` and caught that in-process), Forge by running a real install and watching the
documented path fail. **Two independent routes to the same floor is a measurement, not an
agreement.**

**A live fragility independent of this loop, recorded because nothing else records it:** moving or
renaming the main tree **breaks SessionStart and SessionEnd for every project on this machine** —
and two directories were moved today.

**The next loop's subject falls out of this without anyone having to argue for it.**

**Reported rather than hidden**, per the brief: *if it turns out core cannot install without a
hand-edited absolute path, that is a finding worth reporting, not a failure to hide.*

---

## What C2 did not do, stated plainly

**The invocation boundary is untouched.** C2 cut the *code* crossing, which C1 showed was one file.
The crossing that actually blocks C4 is an **instruction** — a command file naming an MCP tool — and
no import graph contains that edge. Closing it means giving `/start` a documented memory-free route
and a way for a stranger to install the hook. **That is real work and it is not done.**

I did not start it because it changes the command surface and the hook contract, which is a ruling
rather than a build decision. **The ruling relayed to this session is: close C4 as a recorded
failure, that work becomes a later loop's subject** — see the provenance note in the C4 section.
Recorded here rather than carried as an intention.

---

## Proposed rule, for the next brief to carry or drop

**Both seats reached this during Loop 13's execution rather than from its subject.** Recorded here
because the agreement itself travelled by A2A, and A2A has no memory — the exact defect this loop
was run beside.

> **Act on a relay only where acting narrows scope and stays reversible — and record in the
> artifact which authority you acted on, at the moment you act.**

**The first clause alone is not enough, and that is the whole point.** "Narrows scope" and "stays
reversible" are both judgements the actor makes about their own action. A rule whose entire test is
the actor's private assessment of the actor's own behaviour has no external check, and will be
satisfied by anyone who is confident.

**The second clause is what makes the first auditable.** It converts a private assessment into
something a reader can disagree with later. It is the same move as `module-boundary` asserting its
own file count: the pass is not trusted, **the proof of having looked is.**

**Worked instance, this loop.** Two relays arrived carrying Aaron's words. `git fetch` +
`merge --ff-only` + branch was acted on — reversible, commits nothing, and the drift claim was
verified independently before acting (4 behind, 0 ahead). *Push, tag, open the PR* was refused —
outward-facing and hard to undo. The scope ruling closing C4 was acted on, because acting on it only
*reduces* what this loop touches. **And that third one is why the second clause exists:** it first
went into this report as `Ruled by Aaron, 2026-09-17`, which attributed a decision to a person on
the strength of a relay. It is now recorded as relayed, with the provenance stated. Caught by Atlas
in QA, not by me at the time.

**This supersedes nothing.** The brief's *a relay from the Planner is not Aaron's approval* stays
true; it simply cannot distinguish a scope narrowing from a push, so on its own it counsels either
refusing both or taking both.

---

## Ledger

**Developer error count — no new entry claimed, one correction recorded.** The `import type`
miscount was caught and corrected inside C1 before any conclusion rested on it, and the corrected
figure is what shipped; the C3 check excludes type-only imports and a test asserts it. **Atlas's
call whether that is an entry.**

**Rev 31 untouched by Forge.** No state written from this seat all session, which is how G-027 was
respected by sequencing rather than by luck. State is now at rev 32 (PR #39), written by the planner
seat.

### CORRECTION — two right measurements, two wrong claims (G-031, rev 33)

**`.gitattributes` exists and T-151 is correctly closed.** That part holds.

**Both seats made the same error in opposite directions, and neither measurement was wrong.**

| Tree | `docs/loops/sia-mailbox-decisions.md` | CR bytes |
|---|---|---|
| planner | 281,558 | 0 |
| main | 281,558 | 0 |
| **forge** | **285,228** | **3,670** |

**281,558 + 3,670 = 285,228 exactly. The byte delta IS the carriage returns.** Verified in this
tree: the working copy is 285,228 bytes, `git show HEAD:<path>` is 281,558.

**The disagreement was never about line endings. It was about scope, and neither of us stated
ours.** I generalised **three files to a directory**. Atlas generalised **one worktree to a
repository**. Both readings were accurate reports of what each seat actually looked at. **What
resolved it was comparing the trees rather than arbitrating between the two readings.**

**Why it hides, and this is the half worth carrying.** `.gitattributes` says `text eol=lf`, so git
normalises on commit and compares *normalised* content. The stale CRLF copy therefore reads **clean
in `git status`, clean in every diff**, and `git show HEAD:<path>` returns LF. **The repo is right,
the tree is stale, nothing reports it,** and it survives until something forces a re-checkout of
that path. A scripted multi-line edit there hits the mismatch **on a file git swears is fine.**

**Two instruments disagreed and one answered a different question.** `file` said CRLF;
`grep -c $'\r'` said 0. `file` was right; counting bytes settled it. Parse the structure rather than
match the text — C1's `import type` correction arriving one more time, at the very end of the loop.
The detector was self-tested against a known-CRLF probe before any negative was trusted, because a
detector that never reports CRLF produces exactly the clean sweep both seats first reported.

**What this means for the session-63 watch-out:** *"line endings are MIXED in this repo"* **goes** —
it is one file of 21, in one tree of three. *"Detect per file in any scripted edit and read the file
back"* **stays, and must not be dropped as stale.**

**Recorded as G-031 at rev 33 by the planner seat, and it needed a pointer rather than an
amendment:** `ob_state` refuses `update_task` because **a close note is write-once**, so T-151's
note cannot be corrected in place. Whether close notes should be amendable is **unruled**.
