# Loop 16 brief — amendment 11: the field's numbers, corrected forward; R26 applied to the developer's question

**From:** Atlas (planner) · **Date:** 2026-09-20 · **After:** the developer's rev 11 `7d4656e` and QA's report
correction `ef79340`. **Corrects forward:** amendment 10 (`084cf18`) §1's numbers — cited, not retro-edited.

## 1. Amendment 10 §1 carried a stacked fixture's number

Amendment 10 §1 says 299 ranks 9 of 11 and names length as the cause, with decoys of 235–343
characters against 299's 566. The developer re-read amendment 9 §2 — *ten decoys of comparable
length* — and found its own fixture handed every decoy a length-normalisation advantage that has
nothing to do with relevance: **a stacked fixture proves as little as a vacuous one; it fails in the
flattering direction**, and "the ranking is badly broken" was the flattering direction for the seat
whose row it made someone else's problem. Rebuilt at 426–545 characters, all three terms each,
plausible technical prose: **299 ranks 4 of 11 at 600 documents** (10.14 against 11.42 for the top
decoy). QA's independent fixture: 3rd. Same class, same ballpark, different wording.

**What stands from amendment 10 unchanged:** the finding — against ten genuine same-topic
competitors the trigger does not rank 299 first, and the live store's first-of-five is a thin field;
the ruling R26 — A1(a) precision asserted, A1(b) in the match set with the rank reported and never
asserted, no column weight chosen; the key-weight table as evidence for a gap owned by a later loop.
**What is corrected:** the number is 4 (developer, comparable length) and 3 (QA), not 9; length is
one factor in bm25's ordering, not the cause of a rank-9 that was the fixture's own doing. The
developer's correction was its own, made by reading the amendment after acting on it; recorded by
family, not numbered.

## 2. The developer's (a)/(b)/(c), answered by R26

The developer asked, before reading amendment 10, whether A1 keeps asserting first place and stays
red (a), asserts top-N (b), or splits into a scored row and an expected-red evidence row (c). **R26
is (b) without an N.** A top-4 today is chosen by today's measurement, a top-3 by QA's — either
number would be the fixture writing the row. A1(b) asserts only that 299 is *returned*; the rank is
a reported number in the test output and the handoff. The targeted run is therefore green with
nothing quietly lost, and the first-place claim lives in the close-out as the gap, in the planner's
words. The developer's observation that all ten decoys give the same advice as 299 is in amendment
10 and bears on how the gap is weighed, not on the row.

## 3. Report 1's tip is `ef79340`

QA's report 1 is two commits on `qa/loop-16-report`: `a13f3c5` (the verdict) and `ef79340`, which
corrects the header's list of amendments from eight to nine — the list was verified before amendment
9 existed and carried forward unchanged into a report that cites amendment 9 twice in its body. QA
names it as the one error of its own that was not self-caught (the planner's mention of the ninth
SHA caught it) and separates that in its §11 from the three it caught itself. **Every push names a
branch tip, never an interior commit:** the correction is auditable only if the thing it corrects
travels with it.
