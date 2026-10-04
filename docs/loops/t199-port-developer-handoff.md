# T-199 (A) port, developer handoff

Seat: sia-builder (Claude Code Sonnet, QA PC). Branch `loop/t199-missing-handoff-port`, STACKED on #393's head `6f145faf`
(`loop/t236-slice2-briefing`), per the planner's ruling: the notice has to render through `renderBudgeted`, which only exists there.

## Source
Forge's `loop/t199-missing-handoff` (2026-09-30): red rows `bdc74209`, product `34468921`, base `abae5f92` (575 commits behind). Ported, not
cherry-picked: three of its design points changed (rulings below). Its planner.md commit `58aad859` is part (B), a separate docs PR.

## Rulings applied (Atlas, 2026-10-03)
- Port, re-show red, re-cut mutants. Do NOT add a session-log source: a dev seat that never writes through ob_state is normal, so a checkout with no
  session in the record is CLEAR, not missing (a row pins it).
- Opt-in: greeting.json `missing_handoff`, default OFF, SIA true. A2A is unchanged with the flag absent.
- Line in BOTH renderers. Agreed with sia-infra (T-236(c), same head): legacy = its own line after the pick-up body; budgeted = APPENDED to the pick-up
  line (`<pick-up> · <notice>`), because #393's worst case is exactly 30 of 30 lines. The notice is <= 160 chars by construction (a row asserts it).
- Label = the T-203 map's seat for the checkout (`resolveCheckoutSeat`), then the session's own seat, then the reader's, then the checkout. Never the identity first.
- HO-3 (planner.md rows) is NOT in this PR.

## Red first (base = #393 head, product reverted, tests committed: `13c26eaa`)
29 rows: **26 failed, 3 passed** at base. The 26 fail with `missingHandoffLine is not a function` (the API does not exist at base), which is a real
absence, not a behaviour assertion; the behaviour is pinned by the mutants below. The 3 passing are controls (flag-off rows and the null/absent field row).

## Green and neighbours (one vitest file per run, QA PC)
missing-handoff 29/29, briefing-budget 32/32 (one new WORST CASE row with the notice on: 30 lines, <= 4096 chars), a2a-byte-identical 3/3 (the golden is untouched),
briefing 48/48, state-render 48/48, server 35/35, sync/greeting-size 11/11, role-docs-by-sha 11/11. `tsc --noEmit` 0 and `npm run typecheck:tests` 0.
Full suite NOT run (QA PC RAM rule): QA runs it.

## A bug a row found in my own port
`current === null || s.uuid !== current`: the first version excluded any session whose uuid was null when no session was proven, which hid the
"carries no uuid" case. Found by the HO-6 row, fixed before the commit.

## Mutants (product edits, restored with git, each `tsc --noEmit` 0, edit-landed asserted; run sequentially against missing-handoff.test.ts)
```
M2 any handoff of this checkout satisfies it: tsc 0; vitest rc=1; 3 failed | 26 passed (29)
    HO-1: the last session of this checkout wrote the record and left no handoff > names the NEWEST
    HO-1: the last session of this checkout wrote the record and left no handoff > orders by first_
    HO-1: the last session of this checkout wrote the record and left no handoff > a handoff that e
M3 current session is not excluded: tsc 0; vitest rc=1; 3 failed | 26 passed (29)
    HO-1: the last session of this checkout wrote the record and left no handoff > does not count t
    end to end through handleStart (opt-in: greeting.json missing_handoff) > flag ON (briefing_budg
M4 picks the OLDEST session: tsc 0; vitest rc=1; 3 failed | 26 passed (29)
    HO-1: the last session of this checkout wrote the record and left no handoff > names the NEWEST
    HO-1: the last session of this checkout wrote the record and left no handoff > orders by first_
    HO-2: no line when nothing is missing > an older session lacks a handoff but a newer one has on
M5 server stops passing sessionUuid: tsc 0; vitest rc=1; 2 failed | 27 passed (29)
    end to end through handleStart (opt-in: greeting.json missing_handoff) > flag ON (briefing_budg
M6a legacy briefing drops the line: tsc 0; vitest rc=1; 2 failed | 27 passed (29)
    HO-4: the line is in the BRIEFING, once, and the budgeted layout gets no extra line > legacy la
    end to end through handleStart (opt-in: greeting.json missing_handoff) > flag ON (briefing_budg
M6b budgeted briefing drops the line: tsc 0; vitest rc=1; 3 failed | 26 passed (29)
    HO-4: the line is in the BRIEFING, once, and the budgeted layout gets no extra line > budgeted 
    end to end through handleStart (opt-in: greeting.json missing_handoff) > flag ON (briefing_budg
M7 label prefers the reader identity over the map: tsc 0; vitest rc=1; 4 failed | 25 passed (29)
    HO-5: the label is the T-203 map's seat for the CHECKOUT, never the identity > sia-builder reso
    HO-5: the label is the T-203 map's seat for the CHECKOUT, never the identity > sia-infra resolv
    HO-5: the label is the T-203 map's seat for the CHECKOUT, never the identity > sia-forge resolv
    HO-5: the label is the T-203 map's seat for the CHECKOUT, never the identity > a checkout the m
M8 not-checked is silent: tsc 0; vitest rc=1; 2 failed | 27 passed (29)
    HO-6: what cannot be checked is NAMED, never silent > no project root: the checkout is unknown
    HO-6: what cannot be checked is NAMED, never silent > every session of this checkout carries no
M9 flag ignored (always on): tsc 0; vitest rc=1; 1 failed | 28 passed (29)
    end to end through handleStart (opt-in: greeting.json missing_handoff) > flag OFF or absent: no
M10 fallback path says nothing: tsc 0; vitest rc=1; 1 failed | 28 passed (29)
    end to end through handleStart (opt-in: greeting.json missing_handoff) > flag ON and the record
restored: src clean
file:///C:/Users/Aaron%20Melven/AppData/Local/Temp/claude/C--Users-Aaron-Melven-worktrees-sia-builder/23c97e0b-bfd6-4ecf-b244-9c17a667a2c6/scratchpad/mutant-m1.mjs:8
  ["M1 never rendered (flag AND false)", SV, "missingHandoff: greetingFlag(projectRoot, \"missing_handoff\")
                                             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

SyntaxError: Invalid or unexpected token
    at compileSourceTextModule (node:internal/modules/esm/utils:346:16)
    at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:110:18)
    at #translate (node:internal/modules/esm/loader:559:20)
    at afterLoad (node:internal/modules/esm/loader:612:29)
    at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:617:12)
    at #createModuleJob (node:internal/modules/esm/loader:640:36)
    at #getJobFromResolveResult (node:internal/modules/esm/loader:353:34)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:321:41)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:680:25)

Node.js v22.23.3
M1 never rendered (flag AND false): tsc 0; vitest rc=1; 2 failed | 27 passed (29)
    end to end through handleStart (opt-in: greeting.json missing_handoff) > flag ON (briefing_budg
restored: src clean
```
M1 was first cut as `missingHandoff: false`, which failed `tsc` (rc 2), so it was discarded and re-cut as `(flag && Boolean(0))`.

## Not verified / limits
- HO-1 is silent on today's record: sessions[] has no sia-infra entry and every other checkout's last session has a handoff (reported to Atlas earlier).
- The A2A row compares the flag-on output with the pure check on the same record, under an arbitrary checkout name, so it proves gating, not that Relay's real checkout has a gap.
- Merge order: #393 first (this PR is stacked), then rebase on master. sia-infra's T-236(c) edits the same file; whoever merges second rebases the pick-up lines.
- The `/sync` greeting-size check passes no session uuid and does not read the flag; it does not count this line.
