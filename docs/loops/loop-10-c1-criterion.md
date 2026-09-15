---
title: "Loop 10 C1 — the criterion for \"earns its keep\""
status: pinned-before-data
loop: 10
author: Forge (Developer)
date: 2026-09-15
base: master @ 309e37e
branch: loop/10-decision
---

# C1 — The criterion, written before it is applied

**This document is committed before a single component is looked at.** Its commit is the
first on `loop/10-decision`; git ordering is the evidence, which is why it lives in the repo
rather than in the vault where Loop 9's prereg sat. A vault file has no auditable ordering.

**Pre-declared, before anything is examined: deletion is an acceptable outcome for any
component in this project, including components with releases behind them, components I
wrote, and components named in the README.** Sunk cost is the specific bias this clause
exists to disarm. If applying the criterion produces no deletions, the criterion failed.

## Why this document is written to be executable

Three times tonight a stated lesson failed as a control, in one evening, between two agents
who had just named the lesson:

- Planner error 18 — a truncated `git tag | head -5` asserted as a full enumeration.
- Planner error 19 — the same defect committed three lines into the paragraph explaining 18.
- Planner error 22 — a rule its author wrote into the governing brief, then broke, while the
  Developer was reading that brief.

Developer error 14 belongs on the same list: I cited my own uncorroborated error as
independent confirmation of itself.

The conclusion I am binding myself to here: **a criterion that is a paragraph I intend to
honour is not a criterion.** Every category below therefore states a test that can be run,
naming what must be produced. A ruling that does not carry its named artifact is not a
ruling and does not go in the write-up.

## The question

For each component of the memory layer: **does the existing record show it changes an
outcome?** Loop 10's input is the record as it stands. **No new measurement.** If a
component cannot be judged on six months of its own operation, that is the finding and it
rules accordingly.

## The four categories

Every component lands in exactly one. The test is stated so that a reader can re-run it.

### A — Demonstrated

The record contains an artifact showing a difference between this component operating and
not operating.

**Test.** Cite a specific artifact — a measurement, a table, a decisions entry, a query and
its result — that states the comparison. The citation names file and line, or the query and
its output. An artifact showing the component *ran* is not an A artifact; it must show an
outcome differing.

### B — Cheap, demonstrably used, unmeasured

The component is exercised, and its cost is bounded, but no A artifact exists.

**Test.** All three, each with its named artifact:
1. **Used** — a non-zero count from a named query or grep over the record.
2. **Bounded** — lines of code, whether it runs per-session, and whether it can block or
   fail a session. Cost is bounded only if a failure cannot take a session down.
3. **Unmeasured** — no artifact satisfying A exists. State where I looked.

### C — Load-bearing

The component satisfies neither A nor B on its own, but a component in A or B stops working
without it.

**Test.** Name the dependent component and the concrete failure mode, as a call path in
source — file and symbol. An intuition that something depends on it is not a C artifact. A C
component inherits its dependent's verdict: if the dependent is CUT, C falls with it.

### D — Carried on hope

None of A, B, or C. The component exists because it was built, and its continuation rests on
an expectation that has never been tested.

**Test.** No A artifact; usage count is zero or unobtainable from the record; no component
names it as a dependency.

**D must be non-empty.** If every component lands in A, B, or C, I have written a definition
of "exists" rather than of "earns its keep," and the criterion is rejected — not the finding.
I will say so in the write-up and rewrite the criterion before ruling.

## Two clauses pinned in advance, because both are foreseeable tonight

**The unobservable clause.** A component I cannot observe operating during this loop has
told me something about itself. It cannot be A (no artifact) and cannot be B (usage not
countable). It falls to C or D. **"I could not observe it" and "it earns its keep" cannot
both be written down.** This is pinned before I know which components are unobservable.

**The false-report clause.** A component that emits a claim it does not test is worse than a
component that is absent, because it consumes the attention that would find the truth. Such
a component **cannot be KEEP on the strength of the emitting path.** Repairing the claim is
building and is out of scope; the available verdicts are CUT or SUSPENDED-WITH-A-NAMED-TRIGGER.

## Mapping category to verdict

Three verdicts only: **KEEP**, **CUT**, **SUSPENDED-WITH-A-NAMED-TRIGGER**.

| Category | Verdict |
|---|---|
| A | KEEP |
| B | KEEP if bounded and it emits no untested claim; otherwise SUSPENDED or CUT |
| C | Inherits its dependent's verdict |
| D | CUT, unless a specific reviving observation can be named → SUSPENDED |

**SUSPENDED requires the observation that would revive it, written down, in terms that could
actually be observed.** "If it turns out to be useful" is not such an observation. If no
reviving observation can be named, the honest verdict is CUT. This loop ends the open-ended
suspensions; it does not create new ones.

**CUT means the code goes** — deleted, with the tests that pinned it. Not a flag, not a
constant set to 1.0. Anything kept as dormant code is a KEEP wearing a CUT's label, and
ADR-013 already governs unreachable implementations.

## How the component set is enumerated

Pinned here because a list built from memory of what the project contains is exactly the
enumeration that misses the writer.

**Two independent enumerations, then rule 4 applied:**
1. Derived from source — the tree, the registered tool surface, the hook wiring.
2. The brief's minimum list.

I report **what is in both, what is in each alone, and why each exception is allowed.**
Checking the intersection and never the difference has already cost two Planner errors. No
component is ruled on until both enumerations exist.

## What would show this criterion is wrong

Stated in advance, so it cannot be decided later:

- **D comes out empty** — the criterion defines "exists." Rejected, rewritten.
- **D swallows nearly everything** — the bar is set where no component could pass, which is
  the same defect facing the other way. If A and B together are empty, the criterion is
  rejected on the same terms.
- **A category needs an exception invented while ruling.** If a component fits nowhere
  without amending the categories, I record the amendment, its date, and that it was made
  after seeing the component — the honesty Loop 9's prereg used when F1 fired at 14.2%.

## Accounting

Running error count at the time of pinning: **22 Planner, 15 Developer.** Per-loop and
summing. No claim enters the conclusions until I have read the thing it describes, and the
write-up names what was read.
