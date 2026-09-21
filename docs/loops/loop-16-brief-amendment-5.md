# Loop 16 brief — amendment 5: the floor is corpus-relative

**From:** Atlas (planner) · **Date:** 2026-09-20 · **At:** the developer's boundary 3, `12b5aeb` (rev 3)
on `loop/16-recall-trigger`. **Amends:** amendment 1 (`1453e5f`) §3, and the brief's §2 deliverable 2.

## 1. What the developer measured

**bm25's IDF term is a function of the corpus, so a toy fixture cannot test a floor at all.** The
precision-only query `"tail" "exit" "code"` against the live store (599 entries) scores 14.01 for
entry 299 at rank 1, then 12.29, 10.62, 6.83, 6.03; the same query against a three-document fixture
scores every row at about 5e-6. At any shipped floor a small fixture is silent for every input, and
"the floor silenced the weak match" passes with the floor doing no work — the class amendment 1 §1
records twice. **A4's fixture is therefore 599 documents, and a row asserts the fixture is still at
that scale** (strong above the floor, weak below), so shrinking the corpus turns that row red instead
of making A4 quietly vacuous. Fixture at scale: 20.98 strong / 4.28 weak; shipped floor 8.0.

**The floor value is measured, not picked:** 8.0 sits in the live store's gap between the third
genuinely relevant entry (10.62 — `G-042`'s own) and the first irrelevant one (6.83). `max_injected`
is 1. Both in the policy file; the measurement's source named in the module, not restated as a bare
number.

**This supersedes amendment 1 §3's "unknown":** the precision path returns five matches at base and
ranks 299 first at 14.01. The broadening was not carrying the rank; it was adding the two rows below
the gap. QA still measures it independently (criteria §5.1) — this is the developer's number.

## 2. Ruling R19 — an absolute floor is calibrated to a corpus and rots with it

The floor is a score on a scale that moves as the store grows: IDF falls for a term as more entries
carry it, and a floor measured against 599 entries on 2026-09-20 is not the same cut on a store of
2,000. **This is accepted for this loop and stated as a limit, not repaired:** the handoff names the
store size and date the floor was calibrated against, next to the number; the policy file carries
the same provenance. Whether the floor should be relative — a ratio to the top score, or a gap
criterion — is a later loop's question, recorded here so it is asked with the measurement in view
rather than rediscovered when the trigger goes quiet.

## 3. Recorded, not ruled

- **M5 dead at rev 3**, as declared at rev 2; M6 (derived schema hand-edited) and M7 (floor set to 0)
  red; the one source-text scan carries a known positive and a known negative in the same test with
  its limit written into it (T-156).
- **R12's targeted set, named:** `tests/trigger/**`, recall-broadening, ranking, db-v2,
  rating-method, `pipelines/session-end/recalled-ids`, server — 9 files, 107 tests, exit 0.
- **Third `G-042` sighting:** the developer's tree, alone, at rev 3 — 68 files, 997 tests, zero
  failed, exit 1 on the worker heartbeat timeout; the same tree at rev 2 exited 0 with 986. One seat,
  one machine, one tree, clean then not, no failing test either time. R12 has nothing to score here;
  reported. Carried to the `G-042` amendment at close-out with QA's two runs.
- A9 holds by construction so far: the branch only adds test files.
