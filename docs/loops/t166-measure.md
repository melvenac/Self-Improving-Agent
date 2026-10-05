# T-166 measure — GitNexus impact and nullable cross-file calls

**Date:** 2026-10-04. **Seat:** forge. **Scratch:** `C:\Users\Aaron Melven\scratch\t166-gnx`, detached at `2f69ed22` (origin/master when the clone was made). Those three harness files are unchanged through later master `765b90a6`. **CLI:** `npx gitnexus@1.6.12`. **FTS:** `analyze` exit 0 (183 s wall), then `analyze --repair-fts` exit 0 with Git `mingw64\bin` on PATH. `.gitnexus/meta.json` `lastCommit` `2f69ed22…`, `ftsProfile` `full`. **Lease:** D-119 via `machine-lease.ps1` `-File` (taken after the previous holder’s pid was gone; released after analyze).

**Verdict: still missing.**

## restoreHead (the T-166 site)

Grep in the indexed tree: `open-brain/src/harness/runtime.ts:1015` is `refWatch.restoreHead()`. `refWatch` is `RefWatch | null` (`runtime.ts:586`). The method is `RefWatch.restoreHead` at `refwatch.ts:316`. The old note’s line was `runtime.ts:611`; the call moved, the shape did not.

`gitnexus impact restoreHead -d upstream -f open-brain/src/harness/refwatch.ts --include-tests`:

| Field | Value |
|-------|--------|
| risk | LOW |
| epistemic | exact |
| impactedCount | 2 |
| depth 1 | `refwatch.ts` `RefWatch.restore` (`this.restoreHead()`) |
| depth 2 | `open-brain/tests/harness/refwatch-stage.test.ts` |
| `runtime.ts` | **absent** |

Same numbers as session 77 (LOW, exact, count 2), and the crash-path caller is still not in the graph. `exact` is still a confident wrong claim.

## Two more nullable cross-file calls

Grep callers, then impact by symbol uid.

| Call (grep) | Target | impact risk | epistemic | impactedCount | runtime.ts in the result |
|-------------|--------|-------------|-----------|---------------|--------------------------|
| `runtime.ts:628` `configWatch?.captureBase()` (`ConfigWatch` or null, `runtime.ts:623`) | `ConfigWatch.captureBase` `configwatch.ts:680` | LOW | lower-bound | 8 | no |
| `runtime.ts:629` `machineWatch?.captureBase()` (`MachineConfigWatch` or null, `runtime.ts:624`) | `MachineConfigWatch.captureBase` `configwatch.ts:1273` | MEDIUM | lower-bound | 16 | no |

Both lists are tests and same-file calls. Neither names `runtime.ts`. Unlike `restoreHead`, these two say `lower-bound`, so they do not claim the graph is complete. The optional-call edge is still absent.

## What this does not change

CLAUDE.md and the gitnexus block were not edited. No upstream issue was filed.
