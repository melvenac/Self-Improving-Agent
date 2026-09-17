# Loop 13 brief — the module boundary

**From:** Clark (Planner) · **To:** Forge (Developer) · **Date:** 2026-09-17
**Base:** `master` @ `917fd68` — v0.38.0, state rev 28. **Check it, do not assume it.**
**Branch:** `loop/13-module-boundary` · **Tag:** yes, at the end. **Fresh session required.**
**Subject ruled by Aaron**, 2026-09-17, after Loop 12 closed.

---

## The subject

**Idea B from the 2026-09-14 evaluation.** *Project protocol* — `.agents/`, the lifecycle, the state
model, one hook, a thin CLI, zero external dependencies — is the proven half. *Memory* — vault,
index, recall, session-end, shadow, topics — is the research half. **They should version, install
and fail independently.**

**Scheduled as Loop 7. Displaced four times.** Every time into a loop that had its own subject.

## Why now, and it is not because it is owed a turn

**The argument that has displaced it four times is a real one**, and it was named by the Developer at
the end of Loop 12: *a subject with a measurement attached always looks more tractable than one
without, and "it fits cleanly with what we are already touching" is the specific sentence that does
the displacing.* **The Planner wrote that sentence himself, hours earlier, arguing the lifecycle cut
belonged here because `recallRankExpr` and `Maturity` share a file** — the fifth instance of a
pattern named in the same document.

**Two things make this loop the right one, on evidence rather than fairness:**

1. **G-026's urgency is contingent, and the contingency has failed.** Recall returning a third noise
   matters *if agents recall things*. **Sessions 62 and 63 ran two full loops — roughly twenty hours
   — with zero recalls.** `ob_recalled` returned nothing, injection is suspended, and no deliberate
   mid-task fetch was ever wanted. **Tuning precision on a system nobody queries optimises something
   whose value is unestablished.**
2. **This loop builds the instrument for the question that has been open since Loop 9.** Loop 9 tried
   to ask *does injection change behaviour* and its own viability check fired at **14.2% against a
   15% floor** before any code was written. Loop 10 answered a narrower version and cut injection.
   **Nobody has asked whether the memory half gets used at all — and you cannot ask it while core and
   memory are one thing.** If core genuinely installs and runs with Node and git alone, **running the
   protocol without the memory module is not a proxy for that experiment. It is the experiment.**

---

## Rules in force

Carried because each earned its place. **Read `docs/loops/loop-12-closeout.md` before C1.**

1. **No claim enters the conclusions until someone has read the thing it describes, and the write-up
   names what was read.** Running count **35 Planner, 24 Developer**.
2. **A passing check is not evidence until someone has seen it fail.** `command-names` and
   `retirements` both shipped red on real defects, not scratch inputs. Hold that bar.
3. **Two measurements that share a premise are one measurement.**
4. **Every containment that worked was a command; every containment that failed was an intention.**
   `.agents/LIFECYCLE.md` recorded `/recall`'s retirement correctly in April and the dangling
   reference survived five months, because nothing read it.
5. **Do not check a stand-in for the thing; check the thing.**
6. **A claim re-read from an artifact is not a claim derived from the thing it describes.**
7. **The title is not the record.**
8. **A substring check answers a different question than the one being asked, and the answers
   coincide most of the time.** Five instances in Loop 11, four more in Loop 12.
9. **For an instruction that produces artifacts, look at the artifacts.**
10. **For a filter that removes things, look at what it removed.** Loop 12's first path gate took
    noise from 28 to 0 and looked excellent while suppressing the two paths Loop 11 named as exactly
    what a path check should catch.
11. **NEW — an instrument that cannot distinguish "nothing there" from "I did not look" is not an
    instrument.** A zero, a blank, a truncated list and a mangled ref all render as absence. **Four
    instances in one day, across both seats.** The only defence that worked, every time, was reading
    what the instrument returned rather than the number it reduced to.
12. **NEW — a sign-off does not transfer across an amend, unless the amend is provably disjoint from
    what was signed — and "provably" means a diff someone can run, not an assurance.**

---

## C1 — Enumerate the boundary before moving anything

**Pinned before any file is moved.** Two enumerations, then report what is in both, what is in each
alone, and why each exception is allowed.

1. **The code boundary** — every import that crosses from protocol code into memory code.
2. **The invocation boundary** — every command, hook and instruction that *reaches* memory at run
   time, whether or not its code imports it.

**These are not the same set, and the Planner's probe suggests the second is the real one. Verify
both rather than inheriting either.** A first pass at `917fd68` found:

- **The code boundary is nearly clean already.** `state-views` 0 of 1 files touch the database or
  vault; `session-start` 1 of 9; `sync` 2 of 7. Against that, the memory pipelines are wholly
  database-bound: `store` 1 of 1, `session-end` 4 of 4, `topics` 1 of 1, `shadow` 2 of 3.
- **The invocation boundary is not clean at all.** `.claude/commands/start.md` names `ob_start` **six
  times**, and `ob_*` tools are served by `server.ts`. The thirteen `ob_*` names across the command
  surface are the list `command-tool-names` already resolves — **use it; do not re-derive it by
  hand.**
- **`open-brain/package.json` declares `better-sqlite3`**, a native build. **Q1 of the original
  evaluation forbids a native build in core** — *installable by a stranger with Node and git*.

**Record the counts before you move anything.** If the code boundary really is four files, this loop
is far smaller than "split two products" sounds, and **saying so early is worth more than discovering
it late.**

## C2 — Cut the crossings, in dependency order

**Core must never import memory. Memory may import core.** That direction is the whole design and it
is checkable.

**The hard part is `/start`, and it is the loop in miniature.** The protocol's own startup currently
reaches memory through an MCP tool. **A thin CLI path already exists — `cli.ts` serves `sync` and
`state import` today — and extending it is the obvious route**, but do not assume it is the right
one before C1 has said what actually crosses.

**Whatever you build, the constraint is: a project can run `/start`, `/end`, `/sync` and the state
model with no vault, no database and no MCP server.** Memory becomes something a project opts into.

**Out of scope inside C2:** improving anything on the memory side. **You are moving a boundary, not
fixing what is behind it.** If the split surfaces a memory defect, record it and leave it.

## C3 — Make the boundary unable to re-close

**A boundary maintained by discipline is an intention.** Ship a check that **fails if core acquires a
memory import** — the dependency direction asserted mechanically, not remembered.

**Seen to fail before it is trusted**, on a real crossing if one still exists at that point, on a
scratch import if none does. **Say which in the report.**

**And state its limit in the check's own output**, as `command-tool-names` and `retirements` both do.
It can see imports. It cannot see an instruction that tells an agent to call a tool.

## C4 — The acceptance test, and it is binary

**Fresh profile. No Obsidian. No vault. No database. No MCP server. Node and git only.**
**`/start` works.**

**That either passes or it does not, and there is no partial credit to hide in.** It is the whole
reason this subject is safe to run without a measurement attached.

**Do it as a real install, not a proxy.** V-026 claimed *"a fresh Windows clone passes the full
suite"* on the strength of two worktrees sharing the main tree's `node_modules`; the Developer
flagged it himself and the Planner then ran the actual clone. **Run the actual install.**

---

## Out of scope

**G-026 — recall precision.** Aaron ruled it Loop 13's rival and then ruled for this subject. **It
stays open with its derivation intact.** It becomes urgent the moment recall is used again — and if
it never is, that is an answer too.

**The `$declined` retirement** of `success_rate`, `Maturity` and `Rating`. Small enough to ride with
whichever loop next touches `lifecycle.ts`. **It must not drive sequencing — that is the displacing
argument wearing its fifth disguise.**

**T-152** — the tests are not type-checked at all, by tsconfig scope. Real, filed, not this.

**G-027** — two seats deriving the same revision from the same base. Three candidate fixes recorded,
none ruled. **Not this loop, but respect it: do not branch against a base someone is writing to.**

**And the standing one: do not end this loop at "one more measurement."** This loop's output is a
working install, not a number.

---

## Reporting

Boundary report at C1, C2, C3 and C4. `npm test` from the repo root; **`sync --check`** before any
commit — **`--check-only` does not exist and will silently run in fix mode** (T-150). Freeze a SHA
and the Planner QAs read-only, **on disk as well as in the diff**. If it moves, say so — **or show
the disjointness, per rule 12.** On acceptance push branch and tag by name and open a PR.
**The Planner merges, on Aaron's word.** Close-out is a separate PR off master, per R4.

**A relay from the Planner is not Aaron's approval.**

**One question at a time to Aaron, with enough context to answer cold.** Two agents moving fast
produce decisions faster than a person should be asked to absorb them.
