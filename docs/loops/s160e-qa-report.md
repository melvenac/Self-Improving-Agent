# QA 270 report (s160e): #412 (T-238 KEY_ORDER guard) + #413 (T-239 handoff by checkout)

**By:** QA 270 (headless Claude Code, Opus 5.5), record session 160, 2026-10-04 UTC. **Dispatch:**
`docs/loops/qa-270-s160e-dispatch.md`. **Dispatch tree:** `~/qa-scratch/qa270-wt` at
`0bc93353a7eae700b59835e09e573549948ce13c` (`git -C ~/qa-scratch/qa270-wt log -1 --format=%H`).
**Candidates:** #412 `f918de5844a89d38f03d4d4e23173e4540c9f814` (`~/qa-scratch/qa270-pr412`), #413
`e00c0d5aae7ad902a589d09b60a672d0700ae78c` (`~/qa-scratch/qa270-pr413`). Both are still the PR heads (`gh pr view`), and the merge-base
of each with `origin/master` is `be913275`. Bases: `~/qa-scratch/qa270-base412` and `qa270-base413`, both at `be913275`.
Merge row: `~/qa-scratch/qa270-merge`.

Job class LIGHT: one test file per vitest invocation, mutants on the touched files only, `tsc --noEmit`, `typecheck:tests`,
and `gh` reads. No full suite. **No live Jev call. No live `.agents/state.json` was written**: every write went to a copy under
`~/qa-tmp`. No issue or PR was created, commented on or edited. The only branch pushed is `qa/s160e-report`, through `push-qa.mjs`.

**Deviations, stated:**
- The harness refused `export TMPDIR=...` and env-prefixed commands. My two runner scripts (`mutate.mjs`, `runeach.mjs`, in
  `~/qa-tmp`) set `TMPDIR=~/qa-tmp` for the vitest children they spawn. Direct `npx vitest` calls ran with the default TMPDIR, so
  the existing tests' `mkdtemp(tmpdir())` directories (for example `t239-*`) went to `/tmp`. They contain test fixtures only.
- The first four `npm ci` runs, `--prefix` into the scratch trees, used npm's default cache (`~/.npm`). The merge tree's
  install used `--cache ~/qa-tmp/npm-cache`. npm ran no install scripts (allowScripts). The checks here do not load
  better-sqlite3's native binding, and `server.test.ts` passed 35/35 without it.

## Verdicts

- **#412 / T-238 (`f918de5844a89d38f03d4d4e23173e4540c9f814`): ACCEPT.** No gaps.
- **#413 / T-239 (`e00c0d5aae7ad902a589d09b60a672d0700ae78c`): ACCEPT.** Two non-blocking gaps: a server-wiring mutant
  survives (row 3), and the worst case sits at exactly 30 of 30 lines (row 11).
- **Batch: ACCEPT.** Merge authority is not pre-approved: this waits for Aaron's batch approval naming both PRs and SHAs.

## Rows for both PRs

### 1. Confined: MET (both)

`git diff --stat be913275 f918de58` (#412), **3 files**, all T-238:

```
 docs/loops/t238-developer-handoff.md           |  60 +++++++++++++
 open-brain/src/shared/state-schema.ts          |  73 ++++++++++++++-
 open-brain/tests/shared/state-keyorder.test.ts | 118 +++++++++++++++++++++++++
```

`git diff --stat be913275 e00c0d5a` (#413), **10 files**, all T-239. Commits: `c1ed6b2a` (the change) and `e00c0d5a` (a merge of
master `be913275`).

```
 .agents/SYSTEM/greeting.json                       |   1 +       (SIA opts in: "handoff_by_checkout": true)
 CHANGELOG.md                                       |   7 +
 open-brain/src/pipelines/session-start/briefing.ts |  20 ++-
 .../src/pipelines/session-start/greeting-flags.ts  |  11 +-
 .../src/pipelines/session-start/state-render.ts    |  29 +++-
 open-brain/src/server.ts                           |   6 +-
 open-brain/src/shared/state-schema.ts              |  24 +++
 open-brain/src/shared/state-writer.ts              |   5 +-       (writer uses checkoutOf; drops basename/resolve import)
 .../session-start/briefing-budget.test.ts          |  51 ++++++
 .../session-start/handoff-by-checkout.test.ts      | 186 +++++++++++++++++++++
```

Nothing is outside either task. One note: the `greeting.json` line turns the new behaviour on for SIA as soon as #413 merges.
That is the intent ("SIA sets it true"), and it is what makes rows 9 and 11 live for this repo.

### 2. Red then green: MET (both)

- **#412**: at base, with the new test file copied into `qa270-base412`, the file **fails to collect** with
  `TypeError: (0 , schemaObjectSlots) is not a function` and runs no tests. **That is not counted as red.** The behaviour is pinned
  by the mutants in row 3. At the head: **23 passed (23)**.
- **#413**: `handoff-by-checkout.test.ts` loads at base, and **13 of 13 fail** (assertion failures on the sibling's pick-up, plus
  `ownHandoff is not a function`). At the head: **13 passed (13)**. The edited `briefing-budget.test.ts` at base: **1 failed | 32
  passed (33)**. The new all-flags worst-case row fails with "this checkout's handoff, not the newer sibling's: expected false to be
  true". At the head: **33 passed (33)**. Both base trees were restored afterwards (`git status` clean).

### 3. Mutants: #412 MET, #413 MET with one survivor (non-blocking)

Runner: `~/qa-tmp/mutate.mjs`. Each mutant was applied alone, with a unique-match find, `landed=true` asserted and `tsc --noEmit`
run. Then each listed test file ran alone, and the source was restored and byte-checked. `git status src tests` was clean after
each set.

**#412**, against `state-keyorder.test.ts`:

| Mutant | tsc | Result |
|---|---|---|
| dev a1: delete `assignee` from `KEY_ORDER.tasks` | 0 | **killed**: 6 failed / 17 passed (slot tasks, keyOrderGaps empty, the round trip, ...) |
| dev c2: write refusal removed alone (`assertKeyOrder()` commented out of `serializeState`) | 0 | **killed**: 1 failed / 22 passed ("a drifted KEY_ORDER REFUSES the write") |
| QA own: walker enters only the first union option | 0 | **killed**: 3 failed / 20 passed (13-slot count, unordered-slot list, nested-slot probe) |
| QA own: missing-entry check off (`if (false && !UNORDERED_SLOTS...)`) | 0 | **killed**: 1 failed / 22 passed (the missing-slot sentence) |

**#413**:

| Mutant | tsc | Result |
|---|---|---|
| dev M2: null checkout matches any | 0 | **killed**: handoff-by-checkout 3 failed / 10 passed (R5 ×3) |
| dev M3a: original-layout site ignores the checkout | 0 | **killed**: 4 failed / 9 passed (R1/R2, R4, R5 original, R6-A2A) |
| QA own: `noneRecorded` never names the checkout | 0 | **killed**: handoff-by-checkout 5 failed / 8 passed (briefing-budget stays 33/33) |
| QA own: `server.ts` stops passing `ownCheckout` to `renderBriefing` | 0 | **SURVIVES**: handoff-by-checkout 13/13, server 35/35 |

**Gap (#413, non-blocking):** no test pins the wiring in `server.ts`, the one production path that reads the flag and hands the
checkout to the renderers. Deleting `ownCheckout,` from the `renderBriefing({...})` call disconnects the feature from the greeting,
and every row stays green. That includes the dispatched files and `server.test.ts`. By reading the diff, both calls pass it
(`renderState(..., { seat, projectRoot, ownCheckout })` and `renderBriefing({ ..., ownCheckout, ... })`). The developer reports a live
check from sia-infra before the master merge. The fix is a server-level row: a scratch repo with the flag on and a sibling
handoff, with the `ob_start` output asserted. It is not blocking, because the selector and all three renderers are pinned and the
wiring is visibly present at the head.

### 4. CI (read only): MET (both)

- #412: `gh pr checks 412`: `test` **pass** (3m0s), run **37169473529**, `changed` pass, `test-windows` skipping. Run headSha
  `f918de58…` conclusion `success`.
- #413: `gh pr checks 413`: `test` **pass** (3m7s), run **37169676054**, `changed` pass, `test-windows` skipping. Run headSha
  `e00c0d5a…` conclusion `success`.

## #412 (T-238)

### 5. The walker is derived, not a list: MET

- I wrote an independent walker against zod's class API (`instanceof ZodObject/ZodArray/ZodOptional/ZodNullable/ZodDefault/ZodUnion`,
  not `.def.type`). On `StateSchema` it found the **same 14 slots with the same key sets** as `schemaObjectSlots()`: `$, decisions,
  evidence, gaps, handoffs, loop_state, objective, open_prs, open_questions, project, sessions, tasks, verified, watch_out`. `KEY_ORDER`
  has 12 entries. The two slots without one are `open_questions` and `watch_out`, the declared union variants.
- I added a nested object to the scratch copy:
  `StateSchema.safeExtend({ project: ProjectSchema.safeExtend({ meta: z.strictObject({ inner: z.strictObject({x}).optional() }) }) })`.
  The walker found `meta → [["inner"]]` and `inner → [["x"]]`, and `project`'s key set now contains `meta`. (`.extend` refuses
  on a refined schema in zod 4, so `safeExtend` was used.) The developer's b2 is the same thing done in `src`, and the developer
  reports it killed 8 of 23.
- **Throws** on every unseen type tried. For `z.record`, `z.tuple`, `z.lazy`, `z.intersection` and `z.map`:
  `schemaObjectSlots: cannot see through zod type "<t>" at slot "r"; handle it before this guard can be trusted`.

### 6. The refusal on write: MET

The scratch record is a copy of master's `.agents/state.json` (rev 325) in `~/qa-tmp/qa270-r6-*/.agents/state.json`, in a
`git init` scratch root (the citation scan needs git). I deleted `recommended_update` from `KEY_ORDER.gaps` and called the real
`applyStateOps` (the function `ob_state` wraps) with an `add_gap` op:

- It **threw** `serializeState refused: KEY_ORDER and StateSchema disagree, and writing would lose data. slot "gaps": schema field
  "recommended_update" is not in KEY_ORDER, so serializeState would drop it from disk`.
- The file is **byte-identical**: sha256 `c331e59e9cadaee8…` before and after, and `Buffer.compare` = 0. No views were written,
  because the views loop comes after the state write. Only `state.json` is in `.agents/`.
- Control: with `KEY_ORDER` restored, the same op wrote `ok=true`, rev 325→326.
- Through `ob_state`, `handleState`'s `catch` turns the throw into `ob_state error: serializeState refused: …` with `isError: true`.
- The developer's "refusal removed alone" mutant (c2) **dies** (row 3).
- Note, not a defect: a `dry_run` and a render-only batch (`ops: []`) never call `serializeState`, so neither refuses. A dry run
  can report ok on a drifted `KEY_ORDER`, and the real write then refuses loudly.

### 7. No regression on a real-shaped record: MET

On master's `.agents/state.json` (645,692 bytes), `serializeState(parseState(text))` at the head equals master's serializer
**byte for byte**: sha `dec92962441a35dd` for both. It loaded from `qa270-base412` in the same process. Neither equals the raw file,
on master or at the head. That is pre-existing: the file omits `note_by` on 32 of 117 tasks, parse fills in null, and the writer's
`tasksOmittingNoteBy` deletes it again before a real write. Cost over 100 writes: head **843.7 ms** against base **834.9 ms**,
which is inside the noise (a second run gave 737.5 against 754.0). `assertKeyOrder()` alone takes **8.7 ms per 100 calls, about
87 µs per write** (5.2 ms in the other run).

## #413 (T-239)

### 8. Flag OFF is byte-identical: MET

With no `ownCheckout` (flag absent), the head and master (`qa270-base413`, loaded in the same process) gave identical strings
on all 12 renders. The 12 are: seats planner, developer, qa and null; `renderBriefing` in the original and budgeted layouts;
and `renderState`. They ran on three records: the SIA fixture `state.json`, the A2A fixture `a2a-state-1c200b41.json`, and
master's real `.agents/state.json`. That is 36 identical renders. On the A2A fixture, with the flag off, the qa seat's own handoff
is **`qa@a2a-planner#19`**, as Relay's ruling requires. `a2a-byte-identical.test.ts` passes 3/3 at the merge.

### 9. Flag ON: MET

The rulings are pinned by R1–R5 at the head. I checked them independently on **master's real record** (12 handoffs:
`qa@null#75`, `developer@sia-forge#151`, `developer@sia-builder#152` and `#156`, and `planner@sia-planner#153–#160`), for every seat
× {sia-forge, sia-builder, sia-planner, sia-nowhere}:
- A checkout with no handoff of its own prints exactly `none recorded for this checkout (<seat>, <checkout>)`, in both layouts.
  `renderState` has no "Your handoff" block. Example: developer @ sia-planner, and qa @ every checkout.
- **A newer sibling never displaces your own:** developer @ sia-forge gets its own `#151`, although sia-builder's `#156` is newer.
- **Legacy is never yours:** `qa@null#75` is never returned for qa. With the flag on, `renderState` lists it as `[legacy, unattributed]`,
  and no "Your handoff — … [legacy" line appears.

### 10. One derivation: MET; finding below

The writer (`applyStateOps`), `handoffCheckout` and the readers all use `checkoutOf(root) = basename(resolve(root))`. Master's
`checkMissingHandoff` (T-199) still computes `basename(resolve(options.projectRoot))` inline, and #413 does not touch it. On real
paths under `~/qa-tmp`, the two agree on every spelling tried: the plain path, a trailing `/`, a trailing `//`, `/.`, `sub/..`,
a different-case path (`SIA-INFRA`) and a symlink (`infra-link → sia-infra`).

**Finding (not a fix):** the two derivations **cannot disagree with each other**, because they are the same expression on the
same `projectRoot` string. On the server they receive the same `projectRoot`. What can disagree is **two spellings of one
checkout**, and that hits the writer and both readers alike. Neither form resolves symlinks or folds case. A session that writes
through `…/infra-link` stamps `checkout: "infra-link"`, and a later session opened at `…/sia-infra` will not find it as its own.
With the flag on, it prints `none recorded`. The same applies to case on a case-insensitive filesystem (Windows `C:/…/SIA-Infra`
against `sia-infra`). Trailing slashes are harmless, because `resolve` strips them. The inline copy is a drift risk, not a live
disagreement. Pointing `checkMissingHandoff` at `checkoutOf` would make "one derivation" literally true.

### 11. The three-way PICK UP: MET; the limit is reached exactly (non-blocking)

I ran the head's new all-flags worst-case row, instrumented in a scratch copy, with every flag on: FOCUS, SEATS, a T-199 notice
and `ownCheckout: "sia-infra"`, with a newer `sia-builder` sibling present.
- `PICK UP HERE · FOCUS: T-008 Title xxxxxx…` on the header. The body starts `OWN Pick up …`, so it is this checkout's own handoff,
  and `SIBLING` appears nowhere. The body **ends with ` · <notice>`**. `SEATS:` is at line 10, **above** PICK UP at line 11 (my
  added assertion `seatsAt < at` passes).
- The notice is **160 = `MISSING_HANDOFF_MAX_CHARS`**, imported from `state-render.ts`, the product constant.
- Size: **30 lines, 3,834 characters**, against limits of 30 lines and 4,096 characters. That matches the developer's 30 and 3,834.
  **Gap (non-blocking):** the line budget has zero headroom in the worst case, so the next feature that adds a line to the
  briefing will fail this row. That is the row doing its job, but it is worth knowing before the next flag is added.

## Batch merge row

### 12. MET

`~/qa-scratch/qa270-merge`: start from `be913275`, then `git merge --no-ff f918de58` (→ `a3c95733`), then `git merge --no-ff e00c0d5a`
(→ `add445db191d7d1946609c62e7c56e0c608d5c56`). **No conflict.** Both PRs edit `open-brain/src/shared/state-schema.ts`, in
disjoint hunks: #413 adds the `node:path` import at the top and `checkoutOf`/`ownHandoff` after `newestHandoffForSeat` (around
line 433); #412 edits `serializeState`/`KEY_ORDER` and adds the walker (around line 471 and on). Git's 3-way merge auto-resolved
it. The merged file has all five of `export function checkoutOf`, `export function ownHandoff`, `export function schemaObjectSlots`,
`export const KEY_ORDER` and `assertKeyOrder();` in `serializeState`. #413 adds no schema field, so the merged `KEY_ORDER` guard
stays clean (state-keyorder 23/23).

- `npx tsc --noEmit`: **0**. `npm run typecheck:tests`: **0**.
- One file per run (`~/qa-tmp/runeach.mjs`, sequential), all rc=0:

| File | Result |
|---|---|
| tests/shared/state-keyorder.test.ts | 23/23 |
| tests/shared/state-writer.test.ts | 48/48 |
| tests/shared/state-schema.test.ts | 20/20 |
| tests/pipelines/session-start/handoff-by-checkout.test.ts | 13/13 |
| tests/pipelines/session-start/briefing.test.ts | 48/48 |
| tests/pipelines/session-start/briefing-budget.test.ts | 33/33 |
| tests/pipelines/session-start/missing-handoff.test.ts | 29/29 |
| tests/pipelines/session-start/focus.test.ts | 10/10 |
| tests/server.test.ts | 35/35 |
| tests/pipelines/session-start/a2a-byte-identical.test.ts | 3/3 |

- `npm run build` (tsc → `build/`), then `node --check build/server.js`: **OK**.
- Duplicate-import scan over 104 `src/**/*.ts` files (same specifier imported twice, value and type imports kept apart): 2 hits,
  `src/cli-session-end.ts` (`./shared/paths.js`) and `src/harness/runtime.ts` (`./git.js`). **Both are pre-existing on master**
  (the same two counts in `qa270-base413`), and neither PR touches either file. **Neither PR introduces a duplicate import.**

## Gaps (non-blocking)

1. #413: no row pins `server.ts` passing `ownCheckout` to the renderers. The QA mutant survives (row 3).
2. #413: the all-flags worst case sits at exactly 30 of 30 lines (row 11).
3. #413 / T-199: `checkMissingHandoff` still derives the checkout inline. It agrees today. All derivations are sensitive to symlink
   and case spelling of the root (row 10).
4. #412: a `dry_run` does not exercise the refusal, which only fires on a real write (row 6).

QA-270: REPORT COMPLETE
