# QA 269, session-160 batch d: #397 r2 (narrow), #401, #402, #404

**By:** Atlas (planner), 2026-10-03, record session 160. Under Aaron's standing instruction (through clark, about 17:4x
CDT): "Let's get all available agents working."

**Merge authority:** none pre-approved. An ACCEPT waits for one batch approval from Aaron naming every PR and SHA.

**QA runs on Opus** (all four were built by Claude Code Sonnet seats). **Job class: LIGHT:** touched test files, **one
test file per vitest invocation**, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`, and `gh`
reads. The one exception is #404's harness: it is PowerShell, so run it once per head. No full suite, no live Jev call,
and nothing run against the real home directory, the real `%USERPROFILE%\machine-lease`, or a live queue.

**Master at dispatch:** `ef57c10c` (#393 and #405 merged). **NEW SINCE QA 268:** master's ruleset now requires branches
to be up to date (`strict_required_status_checks_policy: true`, Aaron, session 160). All four heads below are therefore
BEHIND, by record-only commits. At merge time each PR gets a merge of master, which is a moved head; the planner
range-diffs it. QA the pinned SHAs.

**Pinned heads:**

| PR | Task | Head | CI | Scope note |
|---|---|---|---|---|
| #397 | T-237 r2, **narrow** | `9ea9f54a6e81ad3f465f56bf92243f3f129ceeba` | 37166239875 | QA 268 accepted every row except F1 (the greeting-size presence bound) |
| #401 | T-236 (c) FOCUS + SEATS | `c3ee949b8e6e6a45a2758af61c7d6bafd8ca8ce0` | 37166318026 | new `tasks[].assignee`, flag `briefing_focus` |
| #402 | T-199 (A) missing-handoff notice | `3212ed69a87bf3bbfad5f933691bc457b3435a13` | 37166132797 | a port of Forge's bdc74209 and 34468921; flag `missing_handoff` |
| #404 | T-204 machine lease (a port) | `5add91379641ef211f98b2f79d1551c0090821eb` | 37164481585 | cherry-picks of 081a5e74 and d5b3623f; PowerShell |

Briefs and rulings: each task's note in `.agents/state.json`, each PR body, `docs/loops/t236c-plan.md` (on
`docs/t236c-plan`, 1493d0a2), and `docs/loops/t191-plan.md` for context only (T-191 is deferred).

## Rows for every PR (#397: rows 1, 4 and 9 only)

1. **Confined.** List the files beyond `origin/master`, and flag any file outside the task.
2. **Red then green.** Run the new test files against master's source (they should fail) and against the head (they
   should pass), and quote the counts. Where a red run fails only on a missing module, the behaviour is pinned by the
   mutants. Say which rows that applies to.
3. **Mutants.** Re-run one of the developer's mutants named in the PR body, and write one of your own. Each must turn
   a row red. Run `tsc --noEmit` on every mutant before counting it, and confirm the edit landed.
4. **CI (read only).** Run `gh pr checks <n>` and record the `test` result and run id against the table above.

## #397 r2 (narrow)

5. **F1 fixed.** `presenceBlockUpperBound` takes the longest presence-line form over every room shape. The new class
   row builds the shapes independently and must fail on the old bound: show it red against `3e95016c`'s bound and
   green at the head. Confirm that `greeting-size.test.ts` (about line 227) is the one file added beyond the original
   three, as the planner ruled.

## #401 (T-236 c)

6. **Flag OFF is byte-identical.** With `briefing_focus` absent, and also set to false, the output must match master
   byte for byte, on SIA's fixture and on the A2A fixture `a2a-state-1c200b41.json` (row O1).
7. **One hub fetch.** `ob_start` makes exactly ONE hub call with SEATS on (row M4). FOCUS never falls back to NEXT.
8. **The assignee survives a write.** Set `tasks[].assignee` through `ob_state` in a scratch record, re-read the file,
   and check the field is there. This is the KEY_ORDER class (T-238): delete `assignee` from KEY_ORDER and show a row
   go red.
9. **Budget.** With every flag on, the worst case fits 30 lines and 4,096 characters. Quote the measured numbers.

## #402 (T-199 A)

10. **Flag gating.** With `missing_handoff` absent, A2A's render is unchanged (the golden and the end-to-end A2A row).
    With it on, a checkout whose newest `sessions[]` entry has no matching handoff gets the notice, labelled by the
    T-203 seat map, never by `AGENT.local.md`'s identity.
11. **Fail closed.** Every `not checked (<why>)` reason prints. Silence only after a check that ran.
12. **Placement.** In the budgeted layout, the notice is appended to the pick-up line (160 characters or fewer, no new
    line). In the legacy layout it is its own line.

## #404 (T-204)

13. **Port fidelity.** Run `git range-diff 066ed8ca..d5b3623f origin/master..5add9137`, or diff the two cherry-picks
    against their sources, and report any difference.
14. **Harness.** At the head, 24 rows must pass. Against master's `qa-queue.ps1`, the 7 queue rows (R8, R8b, R8c, R9,
    R9b, R9c, R9d) must be red. Run it in a scratch `USERPROFILE`, never the real one.
15. **Mutants.** Re-run `nonatomic` (it kills R5) and write one of your own, for example the queue skipping the lease.

## Batch merge row

16. In `~/qa-scratch/qa269-merge`, start from `ef57c10c` and merge #397, #404, #402 and #401 in that order. **Expect a
    conflict in `open-brain/src/pipelines/session-start/briefing.ts`, in `renderBudgeted`'s pick-up area:** #402 appends
    the notice to the pick-up body line, and #401 rewrites the PICK UP header. The seats agreed that the notice goes
    after the pick-up body and FOCUS goes on the header. Resolve it that way, and also expect `greeting.json` to need
    sorted keys. Then run `tsc --noEmit`, `npm run typecheck:tests`, and these test files one per run: `briefing.test.ts`,
    `briefing-budget.test.ts`, `focus.test.ts`, `missing-handoff.test.ts`, `server.test.ts`, `hub-presence.test.ts`,
    `greeting-size.test.ts` and `a2a-byte-identical.test.ts`. Check `node --check` on the built `server.js`. Then
    measure the worst case with EVERY flag on (FOCUS, SEATS, the notice): it must still fit 30 lines and 4,096
    characters. Quote the numbers. Run a duplicate-import scan over `src`.

## Rules (headless Claude Code)

- You are **QA 269**, prefix `s160d`. Push ONLY `qa/s160d-*` branches, and only through
  `node docs/loops/qa-269/push-qa.mjs <branch>`, run from your `qa269-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names and paths, never values (G-051).
- Commit `docs/loops/s160d-qa-report.md` and its `.E_t.json` on `qa/s160d-report`.
- Give one verdict per PR with its pinned SHA. The report's last line is exactly `QA-269: REPORT COMPLETE`.
