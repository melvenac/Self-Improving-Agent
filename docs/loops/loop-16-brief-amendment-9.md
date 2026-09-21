# Loop 16 brief — amendment 9: candidate 1 not accepted, on one row

**From:** Atlas (planner) · **Date:** 2026-09-20 · **On:** candidate `45ee2ab` (rev 9), evaluated by QA against
criteria `a957270` — every non-registration row run, two findings. **Amends:** §4 rows A1 and A6; §6 (a
second candidate).

## 1. The verdict on `45ee2ab`: NOT ACCEPTED, on A11's fourth clause

**F1.** Brief §3: *a test that fails if a network call is attempted covers the new code*; A11 repeats
it. There is no such test anywhere covering `src/trigger/` or `cli-recall-trigger.ts`. QA validated
its zero before believing it (the same grep finds 120 `expect`s and 22 `import`s over the same paths,
and nothing for a nonsense token). The property itself holds statically — nothing under the trigger
imports `fetch`, `node:http(s)`, `node:net`, `node:dns` or `undici` — so this is not a live defect; it
is the missing guard against one, and the brief named the guard. **The row fails correctly.** As in
Loop 14, one row rejects the candidate and the repair rides on a second candidate.

Everything else passed at `45ee2ab`, verified rather than relayed: A1 seen-red on an assertion; A9
(five test files, all added); R24's fence; R21 both halves with M16 red; M18's class confirmed by a
planted stderr line (9 of 12 hook tests red); A4's scale row red at 5.5e-6 when the corpus is shrunk;
the `CHECK` constraint refusing four illegal states in raw SQL; M4, M7 and a broadening mutant each
killed by the right rows; M22's row both directions; A5's positive at 599 documents through the
shipped floor; A6's four failure shapes; the targeted run 14 files / 201 tests exit 0; `sync --check`
zero skipped; and **the full suite alone at the candidate in the QA tree: 1021 passed, exit 0** —
the sixth `G-042` point, clean, and the first clean full run of rev-5-or-later source in a second
tree.

## 2. F2 — A1's fixture proves less than it reads, and the ranking has a limit like R19's

The developer's A1 test passes. QA's independent second caller (R11) shows why that is weak
evidence: under the conjunctive derivation (`"tail" "exit" "code"`), **exactly one of the ten decoys
carries all three terms** — the decoys were written to the brief's token list (*exit, code, tail,
run*), which the derivation does not AND as a set. Nine decoys are inert; the query matches two
documents of eleven; 299 wins 1.15 to 0.99 against one competitor. The brief's own words are the
cause — *at least ten decoys sharing common tokens* — written before the derivation existed;
recorded here as a limit of the brief, not as an entry, since the sentence was true and the fixture
met it.

**QA's fixture to the brief's intent** — 599 documents, ten decoys of comparable length each
genuinely carrying all three terms, plausible technical prose — ranks **entry 299 third** (11.43,
behind 12.01 and 11.87). With `max_injected` 1 the trigger would inject an irrelevant entry, which is
the ruling's own prohibition. **And the counterweight:** against the live 599-entry store through
the trigger's own precision path, QA reproduces the developer's numbers exactly (14.01 / 12.29 /
10.62 / 6.83 / 6.03, 299 first). It works today on the real corpus; it is not robust to the store
acquiring a few documents of a shape it does not currently hold. **The ranking analogue of R19: a
property measured against one corpus on one day.** Not repaired this loop — a relevance ordering
beyond bm25, or a gap criterion between rank 1 and rank 2, is design under the freeze; it goes to
the close-out as a gap with QA's fixture as its evidence.

QA's first adversarial document was one short sentence and bm25's length normalisation made it win;
QA rebuilt the fixture before filing. That is the false finding not filed.

## 3. Ruling R25 — candidate 2's scope, and one accepted substitution

**Candidate 2 = new commits on top of `45ee2ab`, unsquashed, unrebased, and nothing else:**

1. **A11's fourth clause:** a test in the trigger's module that fails if a network call is
   attempted — red on a planted call, green on the candidate, both directions in the same test
   (T-156). The developer chooses the mechanism; it must cover `src/trigger/` and
   `cli-recall-trigger.ts`.
2. **A1's fixture:** every decoy carries all three derived terms, so A1 measures ranking among
   real competitors; the fixture-validation guard asserts that count (all ten, not "at least ten
   share a token"). A1 must still pass — and if it does not against a fixture built to this rule,
   that is a finding for the close-out, not a reason to weaken the fixture.
3. The handoff gains a section for candidate 2, appended, citing this file; A6's substitution below
   is written there.

**Accepted substitution (A6):** the criteria said *hook killed at its timeout*; the candidate tests
*past its own deadline* instead, because `better-sqlite3` is synchronous and nothing inside the hook
can interrupt a query in progress — the host `timeout` bounds runtime, `deadline_ms` bounds emission,
and "killed at its timeout" is not producible from inside the hook. Legitimate and explained in the
handoff's §9; QA accepted it and so does this file.

**A7, A8 and A10-live run against candidate 2**, on Aaron's word for the registration, which names
the act (the QA tree's build) and not a SHA; QA records the SHA at the time. QA writes report 1 on
`45ee2ab` now, on `qa/loop-16-report` cut from `origin/master`, and returns to candidate 2 for the
second pass, as Loop 14 ran it.
