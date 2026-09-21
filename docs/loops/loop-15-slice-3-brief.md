# Loop 15 slice three — the runtime survives what a real role does to it

**From:** Atlas (planner) · **Date:** 2026-09-21 · **Sequenced by Aaron (`D-026`):** the `G-039`
recall-trigger loop (Loop 16, ACCEPTED at `5351270`, released `v0.44.0`), then this.
**Base:** `origin/master` at the commit carrying **state rev 63** — the developer reads the number
from `state.json`, not from this file. **Version at base:** `0.44.0`.
**Branch:** `loop/15-slice-3` · **Fresh sessions** for developer and QA, both on Opus 5; planner on
Fable 5.1.
**Built from:** `loop-14-closeout.md` §8 (what slice three inherits), `loop-15-slice-2-closeout.md`
§3 (the `G-045` ruling), `loop-16-closeout.md` §§5, 8 and **§11**, and tasks `T-158`–`T-164`.
**Roles:** `.agents/roles/*.md`, loaded at session start and named by commit.

> **What slice two left, in one sentence.** The runtime refuses the things it was built to refuse —
> stage writes outside the allowlist, a moved SHA, a dirty tree, an exhausted retry cap, a check
> that prints success while exiting 1 — and then a withheld probe deleted the checked-out branch
> and it crashed with **no `LoopResult`, no `FAILED.md`, and an unresolvable HEAD** (`G-045`).
> Every refusal it makes is honest. The question this slice answers is whether it is still standing
> to make them.

---

## 1. What this loop is for

**One capability: the harness runs a real role end to end and survives the repository states a real
role produces.** Slice one and slice two built the refusals and proved them against stubs. Nothing
with a model behind it has been through this runtime. The brief's order is deliberate and is not
negotiable: **`G-045` is repaired first, mechanically, before any real role is pointed at the
runtime** — because a crash that leaves no record is the one failure that makes every later
observation unreadable.

**Why mechanical first.** `G-045` is `D1`'s sibling and its fix is `D2`'s shape moved earlier. It is
small, it is fully specified below, and it is the only item in this brief whose repair can be shown
red before it is written. Everything after it is judgment work. Do the part with a known answer
while the tree is quiet.

---

## 2. `G-045` — the mandatory mechanical first repair

**The fault, stated as the ruling states it.** `git update-ref -d refs/heads/main` while `main` is
checked out is legal (`git branch -D` would refuse). The watch records the deferred ref as deleted;
`restoreHead` sees HEAD's **name** unchanged and does nothing; `git rev-parse HEAD` then fails on
the dangling name inside `enforceAllowlist`; `GitFailed` escapes `runLoop` **before** `rollBack`,
where the deferred-ref restore lives. Result: no `LoopResult`, no `FAILED.md`, HEAD unresolvable,
`main` gone, tree staged.

**A1, and it is seen red first.** The `update-ref -d` probe, run against the built candidate. The
repair is not written until that probe has been observed producing the crash described above.

**The repair.** The restore reads nothing from the repository until the snapshot is fully restored:
after HEAD's name is put back, **HEAD must resolve, or the ref is restored from the snapshot before
any read**. Restore the deferred delta — the watch already holds `before` — ahead of anything that
reads HEAD, not only inside `rollBack`.

**What stays open, and say so rather than closing it quietly.** The channel denominator is
unprobed: **index, hooks, config, submodules, reflog.** `G-045` is one channel of five-plus. A green
`G-045` row is not "the runtime is safe against repository states"; it is one named case closed.

---

## 3. What follows, in order

1. **`G-045`** (§2). Nothing else starts until its A1 is red, then green.
2. **Real roles through the runtime.** The roles are stubs today; this is the first loop where a
   model-backed role runs inside the harness. `T-155` (the shadow merge gate) is now buildable and
   is the instrument: the runtime records what it *would* have done at each merge and disagreements
   with Aaron are counted.
3. **QA scoring through Jev**, with thresholds calibrated **against real diffs**, not synthetic
   ones. Slice two's one live Jev pair is the only prior observation; two gates answering typed,
   `sent: true`, and the key reaching nothing.
4. **F11 — what a green live loop means.** Write the answer before the first green one, not after.

---

## 4. Rules this loop runs under

These are not restated for emphasis; each one cost a loop to learn and each has a live failure
behind it.

- **No `add_gap` by any seat until `T-158` lands.** `close_gap` splices without a tombstone and the
  next `add_gap` is handed a closed id that tracked files still cite. **New findings travel as
  verified entries, handoff rows and tasks.** (`R28`.)
- **A ruling with no acceptance row fires nowhere.** Every ruling that changes behaviour gets a §4
  row in the same amendment, or it is an intention. `R7` was ruled, agreed, reported settled, and
  never built, with 153 tests green over the hole.
- **A seat is told its record session number; it does not use the one its greeting shows.** The
  counter is per-worktree (`T-164`): the developer greeted as Session #6 against a record whose
  last session is #76. A close-out on the local number collides with the record's sequence.
- **Every absence check carries a control that discriminates the transition being verified.** Not
  merely a known-present string — a value that *differs* across the change you are asserting.
  `loop-16-closeout.md` §11 has both halves of why, including the planner handing the developer a
  control that reads identically either side of the move it was meant to verify.
- **Deterministic checks over prompt-level instructions**, always, and especially here: a rule in a
  file is an intention until something fails on it.
- **`git show <ref>:<path>` is mangled by MSYS in the Bash tool.** Use PowerShell for `ref:path`
  reads. This was in the watch-out list already and both seats hit it anyway within hours —
  see §11's last paragraph.
- **Transport:** seats on one machine use **native cross-session messaging** (`D-029`, amending
  `D-028`). The hub is for cross-machine. **Nothing gates on a single `ListAgents` poll** — an early
  listing is indistinguishable from a seat that is not running.
- **A2A has no memory.** Anything a later session must read goes in a tracked file before the
  exchange ends.

---

## 5. What is NOT this loop's, named so its absence is not read as oversight

- **The ranking gap** (`G-026` amendment): whether the fix is a column weight, a gap criterion
  between rank 1 and 2, or a relevance signal beyond bm25. Named so it is not rediscovered.
- **`T-159`**, the trigger's cheap not-asked path, and the census price — held for Aaron
  (`loop-16-closeout.md` §8.2).
- **Registering the recall trigger for production** — Aaron's file, Aaron's call (§8.1).
- **The transcript-loss mechanism** (`T-161`). The cause recorded at rev 62 is falsified and the
  replacement is *per launch*, mechanism unknown. Do not chase it inside this loop; do not let a
  seat build the `CHILD=1` warning, which would fire on every healthy session.
- **`G-042` on a second machine**, and the `build-freshness` fix shape.

---

## 6. Acceptance

Criteria are written **before** any candidate exists, by the QA seat, and committed at their own
SHA. The candidate is frozen; QA runs read-only against that SHA and reports two conditions
separately — tree moved, tree dirty. Deterministic verdicts come from **process exit codes and
nothing else**: a command printing "all tests passed" while exiting 1 is a failure.

**Run the full suite alone at every candidate**, and read the CI run id rather than the empty
rollup — registration lags ~3.5 minutes. Loop 16's QA evidence all came from one machine and CI
found two faults in one file the first time it looked.

**Guard fixtures in both directions** — not weakened, not stacked — and report decoy lengths. Both
seats built a flattering fixture within hours of each other last loop and both caught their own.

---

**The loop's question, the planner's to answer at close:** slice one and slice two built a runtime
that refuses correctly. This slice asks whether it is still there to refuse after something real has
run inside it — and whether, when it fails, it says so.
