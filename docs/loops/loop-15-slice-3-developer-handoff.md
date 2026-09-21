# Loop 15 slice three — developer handoff (§2, `G-045`)

**By:** Forge (developer seat; record session 78; session uuid `bf8cb461`) · **Date:** 2026-09-21
**Base:** QA criteria commit `17c9056` (criteria before candidate; the criteria SHA did not move)
**Candidate:** `9ed674c8dac8aa96502c2960b693b75ea6e3afac`
**Scope:** §2 only. Nothing in §3 (real roles, Jev thresholds, F11) was started.

> **The transferable lesson is not `G-045`.** It is that the ordering fix *alone* converts a loud
> crash into a silent pass, and that the row which caught it did so only because it asserted the
> END STATE rather than the crash message. Sections 3 and 4 are the ones worth reading twice.

---

## 1. A1 — seen red first

The probe is slice two's withheld `N(c)`, verbatim, not a lookalike: `git update-ref -d
refs/heads/main` during the developer stage, in a fresh scratch repo, via the test file's existing
`sabotage` helper. It is legal while `main` is checked out — `git branch -D` would refuse.

**Five observables, measured in a repository kept alive past the failure rather than inferred from
the throw:**

| observable | value at the crash |
| --- | --- |
| threw | `GitFailed: git rev-parse HEAD failed … fatal: ambiguous argument 'HEAD': unknown revision` |
| `FAILED.md` | `false` |
| `git rev-parse HEAD` | THREW (unknown revision) — HEAD unresolvable |
| `git symbolic-ref HEAD` | `refs/heads/main` — **the name is intact** |
| `refs/heads/main` exists | `false` — **the referent is gone** |
| `git status --porcelain` | `A README.md`, `A artifacts/iterations/t001/D_t.json`, `A …/D_t.md`, `A …/G_plan.json`, `?? …/developer-note.md` |

**The middle two lines are the whole fault.** HEAD goes on naming `refs/heads/main` while
`refs/heads/main` no longer exists. `restoreHead()` compares the symbolic *name*, finds it unchanged,
and returns `""` without acting. D1's repair keys on the name changing and therefore cannot reach
this.

Live stack, confirming the ruled escape path:

```
git (git.ts:95) → headSha (git.ts:128) → enforceAllowlist (workspace.ts:154)
  → runStage (runtime.ts:670) → runLoopInner (runtime.ts:818)
```

`GitFailed` leaves `runLoopInner` **before** `rollBack`, which is where the deferred-ref restore
lives. No `LoopResult` is returned at all.

---

## 2. The repair, and the narrowing

`RefWatch.restoreDeletedDeferred(verdict)` puts a deleted deferred ref back **before anything reads
HEAD**, called from `closeRefWindow` in `runtime.ts` immediately after `restoreHead()`.

**The gate is the watch's own record — a delta whose `kind` is `deleted` — not a caught exception.**
Keying on "`rev-parse` threw" would only ever fire for the one channel whose damage happens to land
on HEAD; a positive condition read from the comparison extends to the other channels as they start
adding deltas to the same watch, with no new catch site.

**The planner ruled "gate on the watch holding an unrestored deferred delta". That was narrowed to
"…and its kind is `deleted`", and the narrowing is load-bearing.** `runtime.ts:604` already said
why, in the code's own words:

> Nothing else is restored here: the verdict has to be computed against the repository the ROLE
> left, and a backwards move of the checked-out branch is a fact `enforceAllowlist` must still see.

A backwards **move** is how D2 is reported as `stage-committed` — `enforceAllowlist` has to see HEAD
where the role left it. Restoring *every* deferred delta before the read puts `main` back,
`headMoved` goes false, and **D2 reports nothing at all**. The row the planner named as "the one
that would notice" would have been silenced by the fix as originally ordered. Only a deletion makes
the read itself impossible, so only a deletion is put back early.

---

## 3. The result of this loop: the ordering fix ALONE is a silent pass

**After the ordering repair, `D4` did not go green. It went `status: "completed"`.** Not `failed` —
the loop reported the stage **clean** after a role deleted the checked-out branch.

`RefWatch.compare()` computes `ok = unauthored.length === 0`, and it excludes the deferred ref from
`unauthored` entirely (`refwatch.ts:209`, *"Owned by the commit boundary, which keeps its own wording
for it."*). The commit boundary catches a **move** through `headMoved`. It has **no way to say "the
branch is gone"** — and before this loop it never had to, because `rev-parse` died first and the
crash was the de-facto detection.

Once HEAD was readable again, the boundary saw a branch that had not moved and passed the stage.

**So the deferral to the commit boundary was only ever sound for a move.** A deleted deferred ref is
now a refusal in its own right: `ok` is false when `deferredDelta.kind === "deleted"`, with its own
wording, and the deferral line no longer announces a deletion as a move. The loop fails with
`stage-changed-ref`.

> **A crash that leaves no record is bad. A stage that deletes the checked-out branch and is
> reported CLEAN is worse, because nothing would ever have looked again.**

---

## 4. Why the row caught it — assert the end state, not the crash

`D4` asserts what the repair must **produce**: a failure record exists, `FAILED.md` is on disk, HEAD
resolves, `symbolic-ref HEAD` is still `refs/heads/main`, `main` is restored, the reason carries no
"recover by hand", and the tree is not left dirty. It goes red today because `runLoop` rejects and
none of those expectations is reached.

> **If `D4` had asserted the `GitFailed` message instead of the end state, it would have gone green
> the moment the crash stopped — and this would have shipped.**

That choice was made before there was any reason to know it mattered. A row that asserts the crash
text is a row that tests the bug: it passes when the bug stops and has to be inverted later.

Two rows pin the healthy path, because `restoreDeletedDeferred` now runs on **every** stage and "it
does nothing unless a deferred ref was deleted" is a claim about every clean loop in the suite:

- it is a **no-op with no deferred delta** — returns `""` and `git show-ref` is byte-identical;
- it **leaves a MOVED deferred ref alone** — asserted directly against `RefWatch`, not inferred from
  D2 staying green.

---

## 5. The `impact` miss — `T-166`

The repo rule requires `impact` before editing a symbol. It was run, and **it was incomplete.**

`impact({target: "restoreHead", direction: "upstream"})` returned `risk: LOW`, `epistemic: "exact"`,
`impactedCount: 2` — depth 1 `RefWatch.restore`, depth 2 the test file. `grep` finds **two** call
sites:

| site | in impact? |
| --- | --- |
| `refwatch.ts:314` `this.restoreHead()` | yes |
| `runtime.ts:611` `refWatch.restoreHead()` | **no** |

**The missed one is the call on the crash path — the exact site the repair changes.**

**This is not staleness, and that was checked rather than assumed:** the harness subtree hashes
identically at the indexed commit and at HEAD (`281bbae5` both), so the index held the current
source and still did not resolve the cross-file call through the nullable `refWatch` variable.
`epistemic: "exact"` is a confident claim and it was wrong here.

> **A LOW risk computed from half the call graph is indistinguishable from a LOW risk computed from
> all of it.**

**I proceeded only because I had already read the missed caller by other means, while mapping the
crash path. The next seat will not have that luck.**

Two further instrument notes:

- The main checkout's index is **58 commits behind HEAD** and still pinned to branch
  `loop/4-dogfood`, `indexedAt 2026-09-20T22:49:50Z` — three minutes before the Loop 16 launch. It
  was trusted here only for a subtree whose hash was verified identical; that is a per-question
  verification, not a clean bill.
- `repo: "Self-Improving-Agent"` is **ambiguous** — three registered repos answer to it: the main
  checkout, `sia-qa`, and a scratchpad clone under `AppData/Local/Temp`. It refused rather than
  guessing, which is correct, but anything scripted against that name will hit it. Pass the absolute
  path.

---

## 6. What is NOT closed

> **A green `G-045` is one named channel closed, not "the runtime is safe against repository
> states". Index, hooks, config, submodules and reflog are unprobed. `G-045` is one channel of
> five-plus.**

The brief's §2 says the same thing and it is repeated here so a green row in a later summary cannot
be read as the general claim.

---

## 7. Evidence

| check | result |
| --- | --- |
| `refwatch-stage.test.ts` | **19/19 passed, exit 0** (17 rows before: D4 plus two healthy-path rows added) |
| `D2` alone, by name (`-t "D2 — a backwards move"`) | **1 passed, 18 skipped, exit 0** — observed directly, not inferred from a suite pass |
| `tsc --noEmit` | exit 0 |
| full suite, run alone | **71 files, 1034 tests, 1034 passed, exit 0**, 97.5s |
| `/sync` | 26 passed, 0 issues, 3 warnings (all pre-existing: PRD.md absent, one unindexed vault note, specs/ absent), 1 skipped |
| build | `tsc -p tsconfig.build.json` exit 0, stamped `17c9056`; `restoreDeletedDeferred` present in `build/harness/refwatch.js` and `build/harness/runtime.js` |

Every exit code was captured **before** any pipe — `cmd | tail; echo $?` reports `tail`'s status,
which is the standing warning in this repo's own record.

`/sync`'s `gitnexus-index` row **skipped** with a reason ("the index lives in one checkout; this is
not a pass"). Independently of that skip, §5 records what the index actually is.

`build-freshness` passed by comparing commits, and its own stated LIMIT is that it does not see
working-tree edits. It passed for a weaker reason than the truth: the build *was* rebuilt after the
source edits and was verified by grepping the built artefacts, which the check cannot do.

---

## 8. State of the tree

| ref | value |
| --- | --- |
| candidate | `9ed674c8dac8aa96502c2960b693b75ea6e3afac` |
| parent | `17c9056` (QA criteria — unmoved) |
| `loop/15-slice-3` | still `17c9056`, **checked out in the `sia-qa` worktree** |
| `loop/15-slice-3-forge-candidate` | `9ed674c` — created so the candidate is not an unreferenced commit |
| working tree | clean |

**The branch tip was not advanced.** `loop/15-slice-3` is checked out in another worktree, so it
cannot be moved from here, and the planner pushes branch tips on Aaron's word rather than interior
commits. Fast-forwarding `loop/15-slice-3` to `9ed674c` is a one-line move once the QA seat's tree
is free; the extra branch exists only so the commit survives until then.

**No version bump and no `CHANGELOG` entry**, following this repo's loop protocol — Loop 16 carried
its bump in a separate `chore(release):` commit after acceptance, not in the candidate. Flagged
rather than assumed.

---

## 9. For the QA seat

- The candidate is frozen at `9ed674c`. This handoff is committed **after** it, so it is not in the
  candidate's diff.
- The A1 row to run is `D4` in `tests/harness/refwatch-stage.test.ts`. It can be seen red at the
  parent `17c9056` and green at `9ed674c`.
- The two healthy-path rows are the ones to attack if you want to break this: they are what stands
  behind the claim that the change does nothing on a clean loop.
- `D2` is the row that would go quiet if the narrowing in §2 were widened. Running it alone is
  cheap.
