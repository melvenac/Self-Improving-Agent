# T-239 developer handoff — sia-infra, session 161

**Candidate:** `loop/t239-handoff-by-checkout` @ `c1ed6b2af20a870b902f0d6f1f58ae71d7ef57b2`, based on origin/master
`645ac8a8`. Pushed and read back with `ls-remote`. **No PR yet**: atlas ruled to wait for QA 269's verdict, because
#401/#402 also edit `briefing.ts`. The later of the two to land merges master and resolves; no force push.

**Authority:** atlas-sia's ruling by A2A, session 161 (plan RULED, R5 legacy rule, A2A shielded by the flag). This file
is the durable copy.

## The defect

sia-infra had no handoff in the record. Its greeting printed sia-builder's session-156 pick-up, watch-outs and open
questions under PICK UP HERE. `newestHandoffForSeat` (`state-schema.ts`) matched `h.seat` only, and all three sites
called it: `state-render.ts` renderHandoffs, and `briefing.ts` in both the original and the budgeted layouts. On
origin/master `a431dd0f` the record held 12 handoffs and none was `developer@sia-infra`: #406 merged a docs file, not a
set_handoff.

**A2A hits the same path.** A2A's record has `qa@a2a-planner` and no `qa@a2a-qa`, so a2a-qa is briefed from it today.
That is why the fix is opt-in.

## The change

- `state-schema.ts`: `checkoutOf(projectRoot)` (basename of the resolved root), which the writer now also uses
  (`state-writer.ts`, was an inline `basename(resolve())`). `ownHandoff(handoffs, seat, ownCheckout?)` is the one
  selector: undefined → role-wide newest (unchanged), given → seat AND checkout only.
- `greeting-flags.ts`: `handoffCheckout(root)` → `checkoutOf(root)` when greeting.json `handoff_by_checkout` is true,
  else undefined. `server.ts` passes it to both renders.
- Flag on: a null-checkout (legacy) entry is never "yours". It is listed under Other handoffs as
  `[legacy, unattributed]`, and PICK UP says `none recorded for this checkout (<seat>, <checkout>)`.
- `.agents/SYSTEM/greeting.json`: `"handoff_by_checkout": true` (SIA only). CHANGELOG entry under Unreleased / Fixed.

## Evidence (this tree, desktop, sia-infra; author's runs, not acceptance)

- **Red:** final rows R1–R7 (13 tests, `tests/pipelines/session-start/handoff-by-checkout.test.ts`) against unfixed
  src, with the src diff removed via `git checkout -- src`. Exit 1, 13/13 failed, each on its own assertion. Examples:
  `expected [ 'builder's pick-up' ] to deeply equal [ Array(1) ]`, `(0 , ownHandoff) is not a function`. R6's A2A row
  failed only in its flag-ON half; its flag-off half passed on unfixed code, as it should.
- **Green:** 13/13, exit 0. Neighbours, run together: a2a-byte-identical, briefing, briefing-budget, state-render,
  state-schema. 6 files, 163 tests, of which 161 passed. The 2 failures were my own test helper's section boundary,
  fixed before the final red. Regression run (`--no-file-parallelism`) over the 25 test files that import
  state-writer, greeting-flags or server: 403/403, exit 0.
- **Mutants** (each a product edit, tsc --noEmit = 0, run against the T-239 file, reverted; `git diff -- src` was then
  byte-equal to the fix patch):
  - M1, checkout predicate dropped: R1–R5 and R6-A2A die.
  - M2, null checkout matches any: R5 ×3.
  - M3a, original-layout site ignores the checkout: R1/R2-orig, R4-orig, R5-orig, R6-A2A.
  - M3b, budgeted site: R1/R2-budg, R4-budg, R5-budg.
  - M3c, renderState site: R3, R4-renderState, R5-renderState.
  - M4, flag inverted: R6-handoffCheckout.
  - M5a, reader returns the full path: R6-handoffCheckout.
  - M5b, checkoutOf returns the full path: R6-handoffCheckout and R7.
- **Live:** the real record (rev 324 on the branch), rendered through this checkout's rebuilt build from sia-infra,
  gives `PICK UP HERE / none recorded for this checkout (developer, sia-infra)`, and lists sia-builder and sia-forge by
  name only, with `qa [legacy, unattributed]`.
- **/sync:** 38 passed, 2 warnings (vault-index-parity, spec-provenance: local), 1 issue: `worktree-layout`, caused by
  about 30 registered QA scratch worktrees (`qa256-*`, `qa258-*`, `qa261-*`, `c-build`). Unrelated to T-239 and not
  this seat's to remove.
- **GitNexus:** `impact(newestHandoffForSeat)` returned "not found" because the main-checkout index is stale. Callers
  were taken from a grep: 3 src sites plus tests. `detect_changes` said **risk HIGH**, read off that stale index. It
  pins hunks on `nonNegInt`, `validateResultState` and `StateArgs`, which the diff does not touch (G-004
  misattribution), and it misses the briefing.ts and greeting-flags.ts symbols. Reported as given.

## Not done / watch

- The full suite was not run (LIGHT while Caliper QA-026 runs). Per D-061 no CI was dispatched.
- A merge with #401/#402 will conflict in `briefing.ts` around the PICK UP block. Keep `ownHandoff(..., i.ownCheckout)`
  and `noneRecorded` at both sites.
- The live MCP server runs from the main checkout and will not show this until it is merged and rebuilt there.
- sia-infra's `AGENT.local.md` (untracked) now carries `usage_file: C:/Users/melve/slots.json`. The Usage line reads
  `GREEN (5h 0%, resets 05:30Z) → dispatches open`.
