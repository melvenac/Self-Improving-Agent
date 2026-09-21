# Loop 16 brief — amendment 8: the act happened inside the loop, and the census has a price

**From:** Atlas (planner) · **Date:** 2026-09-20 · **At:** the developer's boundary 5, `1afb04c` (rev 5)
on `loop/16-recall-trigger` — A5, A6, A10 built. **Amends:** the brief's §2 (cost), §4 row A10, §6 (the
freeze), and records one near-miss by family.

## 1. G-039, live, in the loop built for it

While measuring A10 the developer ran `node .a10.tmp.mjs 2>&1 | tail -12; echo $?`; the script
crashed on a module-resolution error; the shell reported `A10_EXIT=0`; the developer read tail's
status. Entry 299 describes that act; the store being benchmarked contains it; the hook that had
just been built would have injected 299's `ACTION` next to that tool result — and it is not
registered, so nothing fired. Caught by its author because the output was visibly a stack trace
under a green exit; a quieter failure would have been reported as a measurement. **A near-miss by
family, never numbered — and the single strongest piece of evidence this loop has for its premise:
the store was asked nothing, eight loops running, by a seat that had the rule loaded and the fix
built.** The close-out leads with it.

## 2. Ruling R22 — the census keeps its denominator this loop; the price is stated and put to Aaron

A10, measured (60 samples per arm, warm-up discarded, 599-document store, nothing else running):
interpreter floor p50 58.8 / p95 65.5 ms; *not asked* (`git status`) p50 229.7 / p95 277.2 ms;
*injected* (the G-039 command) p50 235.6 / p95 306.6 ms. The developer had predicted the number
would be mostly interpreter startup; **it is 21%.** The cost is the hook's own work — loading the
native sqlite binding and opening the store — and **the common case pays about 0.28 s on every
`Bash` call while asking the store nothing**, because R16 requires a fire row for every invocation
and that row is a write.

**Ruled for this loop: keep it as built.** The loop's subject is *does the memory half get used*,
and the denominator is what makes that answerable; a census that skips the common case cannot say
how often the trigger was silent. Aaron has ruled token cost is not the concern and left latency at
the moment open; 0.28 s per tool call is noticeable and not blocking, and it is the evaluation
period's price, not the design's ceiling. **Named as the first follow-up, not built now:** record
*not asked* without opening the store — an append to the log the hook already writes, reconciled
into the fires table at session end by the hook that already runs there — so the common case pays
the interpreter floor and the denominator survives. The developer's handoff names where the 220 ms
goes. **Put to Aaron in §8 of the close-out as a decision, since it is his to overrule.**

## 3. Rulings R23 and R24

**R23 — a malformed payload is logged and dropped, not refused.** Unlike `SessionStart`'s F4
(refuse, exit non-zero), and for R15's own reason: this hook runs after every tool call on an event
where stderr reaches the model. Refusing loudly would be an injection by another channel. Accepted.

**R24 — the freeze.** The developer writes `docs/loops/loop-16-developer-handoff.md` now, on the
branch, as rev 6, and hands over that SHA as the frozen candidate; QA's criteria are complete
(`08b2bd9`, six commits, none amending an earlier one). **No version bump, CHANGELOG or README
entry before acceptance** — as Loop 14 did, the bump is one commit above the accepted SHA,
re-verified by QA in scope. The hand-off names the first commit (`90e314f`, R9), the targeted set
(R12), the floor's provenance (R19), where A10's 220 ms goes, and M22 as declared.

## 4. Recorded, not ruled

- **M18 found a defect in the test, not the code:** the harness hardcoded `stderr: ''` on the
  success path (`execFileSync` returns stdout only), so every `expect(stderr).toBe('')` in A6 passed
  without looking — on the observable R15 exists for. Rewritten on `spawnSync`; M18b red on four
  rows. The class: an assertion on a value the harness never captured. M20 and M21 were the same
  family (a redundant guard answering before the real one; an invalid mutant noticed because
  *survived* did not match the code). All five hook mutants now red except M22.
- **M22 declared alive, with a reason:** the query only reads, so restricting its handle has no
  behavioural evidence until code exists that would violate it; a row asserts the handle is
  read-only in both directions instead.
- **Fifth `G-042` sighting, and it is clean:** 70 files, 1021 tests, exit 0, alone, at rev 5. Within
  one tree: rev 2 clean, 3 timeout, 4 timeout, 5 clean. The monotonic-count correlation QA was
  careful not to call a cause is broken by the fifth point.
- Three full-suite-only failures at rev 5, all the candidate's and fixed before the commit: hook
  rows against vitest's 5 s default while spawning; stale temp policies predating `deadline_ms`;
  `cli-recall-trigger.ts` unlisted in `MEMORY_SIDE` — the boundary check catching the same class a
  second time.
