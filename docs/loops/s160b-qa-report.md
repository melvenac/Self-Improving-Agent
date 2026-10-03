# QA 267 report: session-160 batch (#387, #388, #391, #393)

**By:** QA 267 (headless Claude Code, Opus 5.5), record session 160, prefix `s160b`. Dispatch:
`docs/loops/qa-267-s160-dispatch.md`.
**Dispatch tree:** `git -C ~/qa-scratch/qa267-wt log -1 --format=%H` = `1d6f7ad06069ec7722624a5e747480ec62454b47`.
**origin/master at start:** `1d6f7ad0`. It differs from the dispatch's master `a68d0393` only in `.agents/` views, `state.json`
and the QA 267 dispatch files (`git diff --stat a68d0393 1d6f7ad0`: 8 files, none under `open-brain/`). All base and merge
trees were made at `a68d0393`, as the dispatch says.
**Job class:** LIGHT. One test file per vitest invocation, mutants on touched files only, no full suite, no live Jev call.
`gh` was used to read only.

## Verdicts

| PR | Pinned head (full SHA) | Verdict |
|---|---|---|
| #387 | `9d1ed0c55751f07dd5fb1a184cfc999c9c43023d` | **ACCEPT** |
| #388 | `913a5a436c1d45fce1793b2d0454efbbf0a1111a` | **ACCEPT** |
| #391 | `b2096051d207344e150e275648a5b6806c2b2aea` | **ACCEPT** |
| #393 | `4020a42bdd0b20e1299342af3b353e0eb84a90a6` | **REJECT** (row 12 only: the batch merge does not typecheck) |

**Batch: REJECT.** Every per-PR row (1 to 11) passed for all four PRs. **Row 12 failed.** Merged in the ruled order, with the
ruled `greeting.json` resolution, `open-brain/src/server.ts` has **two identical `import { greetingFlag } ...` lines**.
#391 adds one at line 27 and #393 adds one at line 35. Git merges them without a conflict because they are in different hunks.
The result: `tsc --noEmit` gives `error TS2300: Duplicate identifier 'greetingFlag'` (lines 27 and 35), and so does
`npm run typecheck:tests`. Vitest still passes because its transform tolerates the duplicate, but Node ESM refuses it at load
(`SyntaxError: Identifier 'f' has already been declared`, reproduced in a two-file `.mjs` probe). A server built from that tree
would fail to compile, or crash when it is imported. **The planner's trial merge reported only the `greeting.json` conflict,
so it cannot have run `tsc`.**

The fix is one line: delete either import. I demonstrated it in a separate commit, which is not a ruling and not a product
change by QA: tsc 0, typecheck:tests 0, server 35/35, role-docs-by-sha 11/11. The fix belongs to whichever PR lands second.
In the ruled order that is #393, so #393 needs a new head, rebased or merged onto #391 with that line dropped. That new head
needs a narrow re-QA covering row 12 and a range-diff. All other rows can carry over.

## Pinned heads

Every head equalled its pin when the job started (`gh pr view --json headRefOid`). All four PRs are OPEN.

| PR | Short | Full | Merge base with `a68d0393` |
|---|---|---|---|
| #387 | `9d1ed0c5` | `9d1ed0c55751f07dd5fb1a184cfc999c9c43023d` | `60abf014` |
| #388 | `913a5a43` | `913a5a436c1d45fce1793b2d0454efbbf0a1111a` | `60abf014` |
| #391 | `b2096051` | `b2096051d207344e150e275648a5b6806c2b2aea` | `2b95434e` |
| #393 | `4020a42b` | `4020a42bdd0b20e1299342af3b353e0eb84a90a6` | `2b95434e` |

Trees: `~/qa-scratch/qa267-pr<N>` at each head; `qa267-base391` and `qa267-base393` at `a68d0393` for the red-first rows. I made
no base tree for #387 or #388, because the dispatch says their red evidence is the product mutant. `qa267-merge` is for row 12.
Each tree had its own `npm ci`. npm 11 skipped the install scripts, but the better-sqlite3 binary was present and loaded.

## Deviations from the setup

- **TMPDIR was not set to `~/qa-tmp`.** The permission layer refused every environment assignment (`export TMPDIR=...` and
  `env TMPDIR=...`). Vitest's own temp files therefore went to `/tmp`. The real home was not touched: `tests/setup-env.ts` points
  the score history, shadow log, active session, knowledge DB and vault at a `mkdtemp` directory. My two probes write only
  under `/home/agents/qa-tmp` (fixed paths in the probe) or to a `mkdtemp` copy.
- **Mutants** were made with the Edit tool. Before each run I confirmed the edit landed (`git diff --stat`) and that
  `tsc --noEmit` exited 0. Afterwards I saved the diff under `docs/loops/qa-267/mutants/` and reverted with
  `git checkout -- open-brain/src`; `git status --short -- open-brain/src` was empty after each revert.

## Row 1: confined (`git diff --stat a68d0393...<head>`)

| PR | Files | Count (planner) | Outside the task? |
|---|---|---|---|
| #387 | `open-brain/tests/server.test.ts` (+4) | 1 (1) | No. Test-only. |
| #388 | `tests/pipelines/session-end/recalled-ids.test.ts` (+46 −1) | 1 (1) | No. Test-only. |
| #391 | `.agents/SYSTEM/greeting.json`, `.gitignore`, `CHANGELOG.md`, `session-start/greeting-flags.ts`, `session-start/role-files.ts`, `server.ts`, the A2A fixture, `role-docs-by-sha.test.ts` | 8 (8) | No. The CHANGELOG entry is the slice's own. |
| #393 | `greeting.json`, `.gitignore`, `briefing.ts`, `greeting-flags.ts`, `state-render.ts`, `state-views/index.ts`, `server.ts`, `shared/handoff-caps.ts`, `state-schema.ts`, `state-writer.ts`, the golden, the A2A fixture, `a2a-byte-identical.test.ts`, `briefing-budget.test.ts`, `server.test.ts`, `handoff-caps.test.ts` | 16 (16) | No. The `state-render.ts` and `state-views` changes are only `watchText(w)` for the widened watch-out type. |

## Row 2: red then green (one file per run)

- **#387:** green at the head: `server.test.ts` 33/33. As ruled, there is no red run on master (it is a pin); see row 3.
- **#388:** green at the head: `recalled-ids.test.ts` 37/37. As ruled, there is no red run on master; see row 3.
- **#391:** green at the head: `role-docs-by-sha` 11/11 and `role-files` 13/13. **Red:** I brought the test file and the A2A
  fixture into `qa267-base391` (master's `src`) with `git checkout b2096051 -- ...`. Result: **5 failed | 6 passed (11)**.
  The 5 failures are first read, unchanged, changed, unknown seat and unreadable record. The 6 that pass are another seat,
  measuring, and the four flag-OFF cases, all of which pass on master by design. This matches the PR's table.
- **#393:** green at the head: `a2a-byte-identical` 3/3, `briefing-budget` 31/31, `handoff-caps` 19/19, `server` 35/35 and
  `briefing` 48/48. **Red:** the new test files and the golden were placed in `qa267-base393`, on master's `src`.
  - `server.test.ts`: **2 failed | 33 passed (35)**. The failures are the two T-236 slice-2 rows: `handoff_caps` ON refuses a
    fourth watch-out, and `briefing_budget` ON prints the budgeted block.
  - `briefing-budget` and `handoff-caps`: they fail at import (`src/shared/handoff-caps.js` does not exist on master).
  - With only #393's two NEW modules (`handoff-caps.ts`, `greeting-flags.ts`) added to master's `src`: `briefing-budget`
    **30 failed | 1 passed (31)** and `handoff-caps` **9 failed | 10 passed (19)**. These differ from the developer's 27/31 and
    11/19 because we reverted different files; both are red.
  - `a2a-byte-identical` passes on master (3/3), as a golden must.
  - Master's `src` was restored with `git rm` of the two modules; `git status -- open-brain/src` was empty afterwards.

## Row 3: mutants (each landed, `tsc --noEmit` 0, then reverted)

| PR | Mutant | Whose | Result |
|---|---|---|---|
| #387 | The KEPT summary line is pushed once per kept id (2 ids, so 2 lines) | QA | **Killed**: 1 failed / 33 (`expected 2 to be 1`). It **survives** the pre-PR test file (`60abf014` version: 33/33), so the new assertion is what kills it. |
| #387 | Print-twice (the summary is pushed twice) | dev | **Killed**: 1 failed / 33 (`expected 2 to be 1`), as the PR says. |
| #388 | ENOENT **or ENOTDIR** is treated as absent | QA | **Killed**: 1 failed / 37 (the `ENOTDIR is rethrown` row). It **survives** the pre-PR test file (29/29). |
| #388 | Only EISDIR is rethrown, so every other code is absent (QA 265's mutant) | dev | **Killed**: 7 failed / 37, as the PR says. |
| #391 | An OFF render is recordable (`printedFull.push` without `if (bySha)`) | QA | **Killed**: 4 failed / 11 (all four flag-OFF cases: a store file appears). |
| #391 | M4: `describeRoleFiles` records (so `composeGreeting` records too) | dev | **Killed**: 9 failed / 11 (first read, changed, another seat, unreadable, measuring, and the four flag-OFF cases). |
| #393 | `handoffCapViolations` returns only the first violation | QA | **Killed**: `handoff-caps` 1 failed / 19 ("every violation is named in one refusal"). |
| #393 | Budget layout on by default (`i.budget !== false`) | dev | **Killed**: `a2a-byte-identical` 1 failed / 3 (golden) and `briefing-budget` 1 failed / 31. |
| #393 | Control: `server.ts` passes `budget: !greetingFlag(root, "handoff_caps")`, so the budget is on when the flag is absent | QA | **Killed**: `server.test.ts` 1 failed / 35. My row-5 probe reports all four cases DIFFERENT. |

Note on #393's "on by default" mutant: it changes `renderBriefing` only for a caller that passes `budget: undefined`. `handleStart`
always passes a boolean (`greetingFlag` returns `false` when the flag is absent), so through `ob_start` this mutant is invisible.
My flag-OFF probe showed IDENTICAL under it. Only the golden test, which calls `renderBriefing` directly, catches it. The
server-level control mutant above is the one that reaches `ob_start`, and both the PR's `server.test.ts` row and my probe catch
it. This is not a defect. It only means the probe needed the server-level control to show it detects anything.

## Row 4: CI (read only, `gh pr checks`)

| PR | `test` | Run id | Run headSha |
|---|---|---|---|
| #387 | pass (2m41s) | 37117818217 | `9d1ed0c5…` |
| #388 | pass (2m14s) | 37117828586 | `913a5a43…` |
| #391 | pass (2m55s) | 37118672284 | `b2096051…` |
| #393 | pass (2m46s) | 37118934612 | `4020a42b…` |

All runs are `pull_request` events with conclusion success. `test-windows` was skipped on all four, and `changed` passed.
**CI cannot see the row-12 defect.** Each PR's run is on its own merge with master, where `server.ts` has only one import.

## Row 5: flag OFF is byte-identical (#391, #393)

- **QA probe** (`docs/loops/qa-267/qa267-flagoff-probe.test.ts`): the **whole `ob_start` text** through `handleStart`. It ran on
  a fixed project root, over SIA's fixture (`tests/fixtures-state/state.json`) and A2A's fixture, with `greeting.json` absent and
  with all three keys `false`. It ran in `qa267-base391`, `qa267-base393` (both master), `qa267-pr391` and `qa267-pr393`.
- `compare-flagoff.mjs` masks the three environment lines: the tree's own path in "Serving build", the test process's pid and
  temp dir in "Session ID", and the token estimate, which counts the path's length.
- **Result: all 12 comparisons IDENTICAL.** SIA normalized `877646da0ef75b35` (7,474 bytes), A2A `76d6529b494c688a` (9,089
  bytes); master against master, #391 and #393, absent and false.
- The raw outputs differ only on those masked lines. `qa267-pr391` is 2 characters shorter than `qa267-base391`, and the path
  appears twice, which is the whole 4-byte size difference.
- **Positive control:** the server-level budget mutant (row 3) makes all four DIFFERENT.
- #391's own flag-OFF rows (role section only, plus "no store file after two starts") pass on master and at the head (4/4 each).
- **#393's golden first:** `git show --stat f5512b6a` adds exactly the golden, the A2A fixture and `a2a-byte-identical.test.ts`
  (3 files, 2,293 insertions) and nothing under `src`. Its parent is `2b95434e` (master). `git diff f5512b6a 4020a42b` over the
  golden, the fixture and the test is empty, so the golden was never regenerated. The golden test on master's `src`
  (`qa267-base393`) gives **3/3**.

## Row 6: the A2A fixture is the ruled one

`open-brain/tests/fixtures-state/a2a-state-1c200b41.json` checks out the same in #391, #393 and `f5512b6a`:

- blob `3cc195a5e372ccc6c4b143c361c6f4337886e063` in all three;
- **260,229 bytes**;
- sha256 `8892464b6608a82c38fa63e878b2458412fbbd12a15471c0d6aea94f21004549` at both heads.

I did not fetch it from GitHub again, because `gh` is read-CI-only in this job. The blob equals the ruled `3cc195a5…`.

## Row 7: one flag reader

- `greeting-flags.ts` is blob `6168e07e72d3b9b5382d67ffe406c60c470b6f34` in both #391 and #393.
- `.gitignore` is blob `143ad2bbc471c21dfd6bf4f1d64ca600f85f2feb` in both, and the only change is the allowlist line
  `!/.agents/SYSTEM/greeting.json` plus its comment.
- `git grep -n greeting.json -- open-brain/src` in the merged tree finds code only at `greeting-flags.ts:14`
  (`GREETING_FLAGS_REL`). The other five hits are comments, in `briefing.ts:39`, `role-files.ts:273`, `server.ts:377`,
  `handoff-caps.ts:5` and `state-writer.ts:144`.
- Every consumer goes through `greetingFlag`: `server.ts`, three call sites.

## Row 8: the flag values ruled for SIA

- #391 `.agents/SYSTEM/greeting.json` = `{"role_docs_by_sha": true}`.
- #393 = `{"briefing_budget": true, "handoff_caps": false}`. `4020a42b` changes only that file
  (`handoff_caps` true → false).

Both are as ruled.

## Row 9: #391 records a read only after printing it

- `recordRoleReads` has exactly one call site: `server.ts:425`, in `handleStart` (which starts at line 224). It is called right
  after `lines.push(...roleDocs.lines)` at line 424, and only with `renderRoleDocs`'s `printedFull`.
- `printedFull` holds only docs printed in full, and only with the flag on (`if (bySha)`).
- The only `writeFileSync` / `renameSync` in `role-files.ts` are inside `recordRoleReads`.
- `describeRoleFiles` (`role-files.ts:107–174`) only reads.
- `composeGreeting` (`sync/checks.ts:2362`) calls `describeRoleFiles`, never `renderRoleDocs` or `recordRoleReads`.
- The developer's **M4** re-run kills "measuring the greeting never records" along with eight other cases (row 3).

## Row 10: #393 caps, flag on, in a scratch fixture (QA probe `qa267-caps-probe.test.ts`, 9/9 at the head)

- **One `set_handoff` breaking all four caps is refused, and the refusal names every violation:** a 401-char `pick_up`, 4
  watch-outs, watch-out 2 at 201 chars, and watch-out 3 spanning two lines. The state file is byte-unchanged.
- An object watch-out's `text` is capped too (201 chars refused).
- Exactly at the caps is accepted: 3 × 200 chars and a 400-char `pick_up`.
- With the flag absent or `false`, the same over-cap write is accepted.
- **Expiry**, at session 160 on 2026-10-03:
  - `expires: 159` and `expires: "2026-10-02"` are dropped, and the briefing says "2 expired, not shown";
  - `expires: 160` (the last session) and `expires: "2026-10-03"` (today) still print.
- **WAITING ON AARON** lists only the unresolved `owner: aaron` question. A resolved aaron question is not shown, a
  `relay`-owned question is not in the section, and the section is absent when no aaron question is open.
- **NEXT:**
  - An objective with no task ids gives no NEXT section.
  - `"Do T-002 and then T-999."` gives NEXT with exactly `T-002` and `- T-999 (not in the record)`, followed directly by
    PICK UP HERE.
- **Worst case:**
  - Inputs: a 900-char objective naming 6 ids, a 3,000-char `pick_up`, 17 two-line 600-char watch-outs, 9 aaron and 9 other
    questions, and 14 blocked P0/P1 tasks.
  - It renders **29 lines and 2,948 chars**, within 30 lines and 4,096 chars.
  - Each cut section ends with its pointer: `+4 more: state.json tasks[]`, `+14 more: state.json handoffs[].watch_out`,
    `+7 more: state.json handoffs[].open_questions` (twice) and `blocked: T-001, T-002, T-003, +11 more: state.json tasks[]`.

## Row 11: A2A safety

- Every new schema field is optional:
  - `owner?` on question objects;
  - `expires?` on the new watch-out object;
  - `watch_out` items are `string | {text, expires?}`, so every existing string is still valid;
  - `handoff_caps?` on `ApplyStateOptions`, and `budget?` on `BriefingInput`.
- The A2A fixture parses with master's schema: the golden test's `parseState` rows pass on master's `src` (3/3).
- `renderBriefing` and `renderState` over it, with every flag absent, match the golden at the head (3/3) and in the merge (3/3).

## Row 12: batch merge (`qa267-merge`, from `a68d0393`)

The four merges, in the ruled order:

| Merge | Commit | Result |
|---|---|---|
| #387 | `b007a10d` | Clean. |
| #388 | `3aff735f` | Clean. |
| #391 | `b647e220` | Clean. |
| #393 | `6e55119b` | One conflict, as predicted: `.agents/SYSTEM/greeting.json` (add/add). Resolved to `briefing_budget: true`, `handoff_caps: false`, `role_docs_by_sha: true`, in sorted order. `server.ts` and `server.test.ts` auto-merged. |

At the merge as resolved (`6e55119b`):

- `tsc --noEmit`: **FAIL**, 2 × `TS2300 Duplicate identifier 'greetingFlag'` (`src/server.ts` lines 27 and 35).
- `npm run typecheck:tests`: **FAIL**, the same 2 errors.
- Test files, one per run: `server` 35/35, `recalled-ids` 37/37, `role-docs-by-sha` 11/11, `role-files` 13/13,
  `a2a-byte-identical` 3/3, `briefing-budget` 31/31, `handoff-caps` 19/19, `briefing` 48/48. All of these pass only because
  vitest's transform tolerates the duplicate import.
- Evidence: `docs/loops/qa-267/merge-6e55119b-server-ts.diff` (what the #393 merge added to `server.ts` on top of #391).

After QA's demonstration commit `6906f679` (removes the second import, 1 line; `docs/loops/qa-267/merge-dedup-import.diff`):

- `tsc --noEmit` 0 and `npm run typecheck:tests` 0.
- `server` 35/35 and `role-docs-by-sha` 11/11.

The merge tree is pushed as `qa/s160b-merge` (tip `6906f679`, parent `6e55119b`) for the planner to inspect.

## Gaps and observations (non-blocking unless stated)

- **B1 (blocking, row 12):** the duplicate `greetingFlag` import described above. Rule: #393 rebases onto #391 (or #391 merges
  first and #393 updates its branch) and drops one import. Re-QA scope: range-diff of the new #393 head, tsc and
  typecheck:tests at the batch merge, and `server.test.ts`.
- **O1 (#393):** the budget is proven with one-line environment strings. `describeWorkingTree` (up to 8 paths) and
  `describeSkills` (every skill name) are single lines of unbounded length, and they are not cut. A long skills list could
  push the real render past 4,096 chars. No line-count risk.
- **O2 (#393):** an object watch-out written by this code would be refused by an older build's schema. This matters only if one
  record is read by two open-brain versions. A2A's record carries none, and SIA's `handoff_caps` is off, so nothing is written
  that way unless a seat chooses to.
- **O3 (#391):** a flag accidentally ON is invisible on a first `ob_start` (a first read prints in full anyway). The PR's
  flag-OFF row covers it by starting twice and asserting that no store file appears.

## Artifacts on `qa/s160b-report`

- this report and `s160b-qa-report.E_t.json`;
- `docs/loops/qa-267/qa267-flagoff-probe.test.ts`, `qa267-caps-probe.test.ts` and `compare-flagoff.mjs`;
- `docs/loops/qa-267/mutants/*.diff` (9 files);
- `docs/loops/qa-267/merge-6e55119b-server-ts.diff` and `merge-dedup-import.diff`.

QA-267: REPORT COMPLETE
