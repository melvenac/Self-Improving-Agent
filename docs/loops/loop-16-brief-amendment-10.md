# Loop 16 brief — amendment 10: A1 restated to what the query can promise

**From:** Atlas (planner) · **Date:** 2026-09-20 · **At:** the developer's rev 10, `cd82c8b` — R25's items 1
and 2 built, A1 red by construction, hand-over held. **Amends:** §4 row A1 and R25 (`0c70b52`).

## 1. What the rebuilt fixture showed

R25 item 2 asked for ten decoys each carrying all three derived terms. Against that fixture **entry 299
ranks 9 of 11.** The developer tested the obvious explanation — that at eleven documents bm25's IDF
collapses and only length normalisation remains — by adding non-matching filler: the absolute scores
recover (4.1e-6 at 11 documents → 9.99 at 600) **and the rank stays at 9 from 10 filler documents to
589.** Not a corpus artifact. The cause is length: 299 is 566 characters; the decoys are 235–343 and
carry the same three terms; bm25 prefers the shorter document.

**So the live-store measurement at boundary 3 (299 first of five at 14.01) was a thin field, not a
demonstration.** Only five entries in the real store match all three terms. Put ten plausible
same-topic entries in front of the trigger and it surfaces a different one. QA's fixture (F2,
amendment 9) found rank 3 with a different set of decoys; the two fixtures agree on the class and
differ only in degree.

Measured and not applied — R25 forbade anything else in candidate 2: weighting the FTS `key` column
(the entry's identity, which carries all three terms) moves 299 to rank 5 at ×2, 3 at ×3, 2 at ×5,
1 at ×10 by 0.56. Arguably principled — a title matching every query term is stronger evidence than
the same terms scattered through a body — **but a weight chosen because it makes A1 pass is tuning
to the test.** Recorded for the loop that owns ranking; not chosen here.

And the fact that changes how the row should be weighed: **all ten of the developer's decoys give
the same advice as 299** — read the status from the process, not from the trimmer. For the act the
loop exists for, any of them would have warned the seat correctly. QA's decoys were plausible prose
carrying the terms and *not* that advice. bm25 over three terms cannot tell those two fixtures
apart, and that is the limit.

## 2. Ruling R26 — A1 restated; the ranking is a gap, not a weight

**Option (c), sharpened.** A1 asserts what the derivation and the precision query can promise;
the rank among full-term competitors is reported, never asserted; no column weighting is introduced
in this loop.

- **A1(a) — precision.** Against the original fixture (decoys sharing *some* of the derived terms),
  the G-039 command returns entry 299 **first**, because the conjunctive query excludes every partial
  match. This is the row as built at `ee74fd1` and it passes; it is evidence that the AND does work.
- **A1(b) — the field.** Against the rebuilt fixture (ten decoys each carrying all three terms,
  comparable length, guard asserting all ten by name), the G-039 command returns entry 299 **in the
  match set**, and the test **reports its rank** — a number in the test output and the handoff, not
  an assertion. A1(b) fails only if 299 is absent from the match set.
- **The fixture is not weakened**, the weight is not chosen, and the key-weight table goes to the
  close-out with both seats' fixtures as the evidence for a gap: *the trigger's relevance ordering
  among entries that share its query terms is bm25's length preference, and the live store's thin
  field is what makes it look right today.* The loop that owns ranking chooses between a column
  weight, a gap criterion, and a relevance signal beyond bm25, with these measurements in view.
- **What measures it in production is already built:** the fires table records every injected id,
  and `/end` rates hook-injected entries at point of use (T-014's question). Whether an injection
  was the right entry is what the next loops count, against the error table, as the brief's last
  paragraph said.

**Candidate 2, R25 restated:** items 1 (the network tripwire — accepted as built: ten surfaces,
each fired deliberately before the negative is believed) and 2 (the rebuilt fixture, with A1(b)'s
report-not-assert form) on top of `45ee2ab`, unsquashed; item 3 the handoff section citing
amendments 9 and 10 and A6's substitution. Then hand over. QA lands A1's restatement as one more
criteria commit citing this file, before evaluating candidate 2.
