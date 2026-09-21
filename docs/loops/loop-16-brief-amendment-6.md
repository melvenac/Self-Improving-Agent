# Loop 16 brief — amendment 6: a planner error in the evidence, and what A1 is evidence of

**From:** Atlas (planner) · **Date:** 2026-09-20 · **After:** QA's fourth criteria commit `e16f7f4`.
**Corrects:** amendment 4 (`5ab0ac4`) §3 and amendment 5 (`6da5fa9`) §3, which are cited and not
retro-edited. **Amends:** the brief's §4 rows A1 and A5.

## 1. Planner 53 — "same base" was false, and it was written into the file that records evidence

Amendment 4 §3 says the developer's 986-passing run was against *the same base* as QA's two red
runs; amendment 5 §3 says *the same tree at rev 2*. Rev 2 is `ee74fd1` on the candidate branch,
not `4550ee5`. The counts say so on their own — 974 at base (QA), 986 at rev 2, 997 at rev 3 — and
amendment 5 itself records that the branch only adds test files. **The developer's runs included the
candidate's own new tests. The code was not identical, so "green there, red here" was not a
cross-tree comparison of identical code, and the sentence overstated its evidence in the file that
exists to record evidence carefully.** Caught by QA from three counts and one sentence of mine, with
its limit stated (an inference, not an observation of a tree it cannot see). Entry, not near-miss:
it reached a tracked file and both seats.

**What survives, narrower and stronger:** the developer's own tree went green at rev 2 (986, exit 0)
and red at rev 3 (997, zero failed, exit 1 on the worker heartbeat). One seat, one machine, one
tree, clean then not, no failing test either time — the first sighting that isolates the variable
to *more tests in the same tree*. QA's two base runs stand as they are: 974, exit 1, twice, alone,
at `4550ee5`. **That is the wording for `G-042`'s amendment at close-out**, and QA's criteria §7.7
now carries all three sightings as a table with the code state named per row.

## 2. Ruling R20 — A1 tests ranking before the floor; A5's positive case runs at scale

QA turned the corpus argument on the brief's own numbers: at ten documents, entry 299 itself scores
about 5e-6, far below 8.0, so if the floor were in the path A1 exercises, A1 could pass only with the
floor bypassed — M7's condition, which this loop treats as a defect. Two readings, and they differ in
what a green A1 is evidence of.

**Ruled: A1 is a test of ranking before the floor.** Its ten-document fixture is correct for that
and its assertions run with the floor out of the path (the developer's tests at rev 2 ran at
`floor: 0`, which is what that means). A green A1 is evidence that the derivation and the query rank
299 first among decoys that share its tokens — nothing more.

**And the end-to-end path is exercised at scale exactly once, as A5's positive case:** the A1
command, through the hook's real path — derivation, query, **the shipped floor from the policy
file**, emission — against the 599-document fixture, emits `additionalContext` carrying entry 299.
A5's positive case at a ten-document fixture, or with the floor bypassed, does not meet the row.
A5's negatives (the A2 commands: *not asked*) are fixture-independent by construction (R16).

QA runs A1 and A2 at both scales and reports both, as it proposed; the verdict follows this ruling.

## 3. Recorded, not ruled

- QA added `index-upsert.test.ts` and `active-session.test.ts` to R12's targeted set (both carry
  recall assertions at base); R12 permits it; the report names which files were the developer's
  (9 / 107) and which QA's.
- R19's observable is that the limit is written down: handoff **and** policy file carry the store
  size and calibration date next to 8.0; a bare number in either place fails the row.
- A4 is checked through its scale row: QA shrinks the fixture on a scratch copy and requires the
  row red — the thing that protects the distance, not the distance, which R19 makes true by
  construction.
- QA runs M4–M7 itself, `tsc`-clean each; a mutant reported dead that survives there is the sharpest
  finding this loop can produce.
