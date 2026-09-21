# Loop 16 brief — amendment 4: the query is narrow by construction, and "not asked" is a third state

**From:** Atlas (planner) · **Date:** 2026-09-20 · **At:** the developer's boundary 2, `ee74fd1` (rev 2)
on `loop/16-recall-trigger`. **Amends:** `loop-16-brief.md` (`8457600`) §2 deliverables 1 and 3, §4 rows
A2 and A8, as already amended by `1453e5f`, `c43a31f`, `1051cae`.

## 1. The design, ruled on the result

The developer found that deriving a query by ANDing a command's words is dead on arrival — FTS5 is
conjunctive, so the G-039 command asks for an entry containing `npx` AND `vitest` AND `tail` AND
`echo`, which matches nothing, including entry 299 — and that the only repair for that in `ob_recall`
is the `OR` fallback R1/§5.4 forbid. **So precision-only cannot be a filter over a broad query; it
forces the query to be narrow by construction.** What was built: the derivation recognises risky
*elements* of a command and ANDs the terms each contributes — a pipeline whose last stage trims
(`tail`/`head`/`grep`) → `tail`; a read of `$?` or `${PIPESTATUS` → `exit`, `code`. Two elements,
each from a real error in this repo. A fixed table in code, no model, no network, reproducible from
a transcript. A command with no recognised element derives nothing **and the store is never asked.**

**Accepted.** It is the conservative direction of *fails closed on nothing*: the channel is closed by
default and opens only for a shape the table names. The table is small on purpose and grows on
evidence, not speculation — a third element is a later loop's finding. Two consequences are ruled
below so the record and the tests carry them, not only the module header.

## 2. Rulings

**R16 — a hook invocation has three states, and the fires record carries all three.** *Not asked*
(no element recognised; the store not consulted), *asked, silent* (the store consulted, nothing at
or above the floor), *asked, injected* (ids). The fires table (R5) records the state on every
invocation, keyed to the live session uuid. A2's three commands are now *not asked* cases and the
test asserts that state apart from *asked, silent* — both return nothing and only one consulted the
store; conflating them is G-039's own defect one layer down. A8's census reads the three counts.

**R17 — a recognised command against a store with no answer is silent** — the developer's own
clause, ruled in. Tested against a store holding one unrelated entry: the G-039 command derives its
terms, the store is asked, nothing clears the floor, nothing is emitted, the state is *asked, silent*.
A channel that is quiet only because it did not understand the question has not been shown to fail
closed; this is the case that shows it.

**R18 — `tail -f file` is not the act.** The pipeline requirement (more than one stage) is asserted
in both directions: a single-stage `tail -f build.log` derives nothing; the G-039 pipeline derives
all three terms. Mutant M4 (the requirement dropped) survived eleven green rows until this assertion
existed; the word *pipeline* in the module header was carried by nothing. Ruled from the developer's
`[mine]` clause.

**R14 restated, because it was asked twice:** the policy pattern is rebuilt in a trigger-owned
directory; `src/harness/policies.ts` is not imported and not reused. Amendment 2 (`c43a31f`) §3.

## 3. Recorded, not ruled

- **M5 (floor filter removed) survives at rev 2 and was declared** — every assertion at this
  boundary runs at `floor: 0`, so the filter is unreachable as tested. A4's weak-match fixture is
  the row that kills it and it is the next commit. Declaring a live mutant beats a green suite that
  does not cover the code; QA should expect M5 dead at rev 3 and check that it is.
- **The full suite in the developer's tree: 986 passed, exit 0, alone.** QA's two base runs in the
  QA tree exited 1 alone. Same base, same machine, different trees and times. One more row for
  `G-042`'s amendment at close-out; it does not change R12.
- The developer stopped after boundary 1 instead of continuing and named it as its own slip when
  Aaron relayed that the planner was waiting. Not a claim; not numbered; recorded so the next brief
  says *continue through the boundaries, report at each* in so many words.
