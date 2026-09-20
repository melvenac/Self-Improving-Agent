# Loop 15 slice two — brief amendment 2

**From:** Atlas (planner) · **Date:** 2026-09-20 · **Amends:** `loop-15-slice-2-brief.md` §3, §4 (A6,
A7, A8), §5 ruling 5. Raised by the QA seat in its criteria pass (`71f9760`, unpushed at the time
of writing, cited by SHA), before the developer's first commit. The brief is not retro-edited.

## 1. A8 covers seven rows, not six — Planner 50

The brief's A8 says slice one's "A1–A6" hold on the final candidate. Slice one's brief has **seven**
rows; A7 is *deterministic check results come from exit codes; no stage infers pass/fail from
text.* The planner miscounted the table it wrote. **A wrong claim in a tracked artifact: Planner
50.** Ruling: A8 is all seven. QA had proposed running slice-one A7 as a preservation item outside
the verdict; it is inside it.

## 2. A6 binds the behaviour, not the mechanism's name

The brief said a threshold hand-edited into a prompt or string literal is "caught by the policy
schema's drift check (the `D-021` pattern)". QA observed correctly that a zod-to-JSON drift check
cannot see a `0.7` typed into a prompt string. Ruling: **the behaviour is what is held** — a
threshold literal outside `harness/policies/` is caught by *some* check with its own positive and
negative fixtures (A9's shape). The check's form is the developer's.

## 3. A7 runs on every candidate that reaches it

The brief's ruling 5 said "one live call, by QA, once". Ruling: **one live call per gate on every
candidate that has passed every other row.** A superseded candidate's observation does not carry
forward to its successor. Aaron has ruled that token cost is not the concern; the discipline is that
the live call is *last*, not that it is rare. QA does not need to ask again.

## 4. A2 case (iv) — a created ref has no prior SHA

Amendment 1's fourth case, a role creating a new `loop-001-<anything>` ref during its stage, has no
pre-stage SHA. Ruling, as QA proposed: the record states the ref was **absent** before the stage and
names the SHA it was created at.

## 5. Two findings from the base, handed to the developer

Reported by QA at `293cddb`, neither a criteria row:

- **The gate questions at base are placeholders.** The plan gate asks `bounded` / `repairs` and the
  done-gate asks `complete`. A5 asserts the exact §4 ids and kinds; a candidate still sending the
  placeholders fails A5. Stated so the developer does not read the stubs as the contract.
- **`GateTransport.dispatch` and `runLoop` are synchronous.** A live HTTP transport is therefore
  either a redesign of that seam or a spawned process — and a spawned process for HTTP is exactly
  what the no-shell scan exists to catch. **Ruling: the seam becomes async** — `dispatch` returns a
  promise and `runLoop` becomes async as far as that must propagate. The test that asserts no
  network call is attempted (slice-one A6) must still hold under the async shape. How far async
  propagates is the developer's.

## 6. Counts

Planner 50 / Developer 28 / QA 0. Both of QA's findings and all four readings were caught before a
line of the candidate existed; they are entries for nobody.
