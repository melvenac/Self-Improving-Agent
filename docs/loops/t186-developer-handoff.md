# T-186: `applySummaryRegion` and a leading BOM, developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t186-summary-bom` from `origin/master` `00552846`. **Dispatch:** atlas-sia, session 157 (LIGHT). Not merged; one PR.

## Impact (run first, as asked), and what it is not

**GitNexus could not run here:** this checkout has no `.gitnexus/` and the MCP server is not connected in this session, so there is no `impact()` output to paste. A grep-based upstream trace instead, which is what the earlier developer round used for the same reason:

- `applySummaryRegion` (`pipelines/state-views/index.ts:235`) has **one production caller**: `shared/state-writer.ts:384`, inside `applyStateOps`.
- `applyStateOps` has **three callers**: `server.ts:449` (the `ob_state` tool, every state write), `pipelines/sync/checks-state.ts:85` (the `/sync` path that re-renders views), and `pipelines/state-import/index.ts:1118` (`open-brain state import`). `state-migrate` and `detach` reach the writer through the same function.
- So the blast radius is the one GitNexus reported: **every `ob_state` write and `/sync` re-render passes through this function**. The change is narrow, though: it only changes the result when the existing SUMMARY.md starts with U+FEFF; for any other input the first line of the function is a no-op.
- Callers' tests: `state-views.test.ts` (17), `shared/state-writer.test.ts` (46), both passing.

## The defect, reproduced

`readFileSync(..., "utf-8")` keeps a leading BOM as the character `﻿`, so the title line reads `"﻿# Title"` and `lines.findIndex((l) => l.startsWith("# "))` does not find it. With no markers yet (the first state write on a hand-written SUMMARY.md), `titleIdx` was -1 and the code took the "no title" branch: **the generated region was inserted ABOVE the title and the BOM ended up mid-file.** With markers already present the path used `slice`, which kept the BOM, so only the first render of a BOM'd file was wrong. (The same class as QA 102's D2, which the importer's own BOM defect also is.)

## The change

`applySummaryRegion` now handles a leading `﻿` first: `if (existing.startsWith("﻿")) return "﻿" + applySummaryRegion(existing.slice(1), region);`. Strip for detection, put it back first. Anything else is untouched: no-BOM input takes the same path as before. `writeFileSync(..., "utf-8")` writes the character back as `EF BB BF`.

## Rows

- `tests/pipelines/state-views.test.ts` (3 new): a BOM fixture with no markers gets the region after the title with the BOM first, exactly one BOM, identical to the no-BOM result apart from the BOM, and idempotent; a BOM fixture with markers is replaced in place and keeps its BOM; a no-BOM fixture is unchanged and carries no BOM.
- `tests/pipelines/summary-bom.test.ts` (2 new), through the real writer: a BOM'd SUMMARY.md written by `applyStateOps` starts with bytes `EF BB BF`, has the region after the title and keeps the hand-written prose; a SUMMARY.md without a BOM is written without one and a second write is stable.

## Evidence

- **Red** (the two files against `origin/master`'s `state-views/index.ts`): `state-views.test.ts` 1 failed, 16 passed; `summary-bom.test.ts` 1 failed, 1 passed (both `expected false to be true` on the BOM-first assertion). **Green:** 17 and 2 passed. `tsc --noEmit` 0.
- **Mutant** `docs/loops/t186/mutants/bom-dropped-on-write.diff` (the BOM is stripped for detection and never put back; `tsc --noEmit` 0): **red on 3** (both BOM rows in `state-views.test.ts` and the writer row). The no-BOM rows stay green.
- Not run: the full suite, a real `/sync`. One file per vitest invocation, per the QA PC hold.
