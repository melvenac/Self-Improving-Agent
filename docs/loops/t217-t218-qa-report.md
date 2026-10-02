# QA 247 report: T-217 + T-218 (two test guards)

**By:** QA 247 (SIA QA seat, record session 247), headless Claude Code on Opus 5.5 on Plumb (Linux), 2026-10-01.
**Dispatch:** `docs/loops/qa-247-t217-t218-dispatch.md` at `bd9b78f601737864bb6c37c530b7bda41a64a6ab`
(`git -C ~/qa-scratch/qa247-wt log -1 --format=%H` → `bd9b78f601737864bb6c37c530b7bda41a64a6ab`).
**Candidate:** `1a38e3f2bc2ce0b850d2bf68949823c5812c2576` on `origin/loop/t217-t218-guards`. **Base:** `c34866d3`.
No live Jev call made. No issue or PR touched; `gh` used only to read CI.

**Verdict: ACCEPT.** All five rows met. All five mutants were killed: three are QA's own originals and two are new for QA 247.

## Row 1: Confined: MET

`git diff --stat c34866d3 1a38e3f2` touches 6 files: `docs/loops/t217-t218-developer-handoff.md`, the three
diffs under `docs/loops/t217-t218/mutants/`, `open-brain/tests/harness/t214-declared-blank.test.ts`, and
`open-brain/tests/harness/t216-loop-id.test.ts`. `git diff --name-only c34866d3 1a38e3f2 -- open-brain/src` lists
0 files.

The three kept mutant diffs are **byte-identical** to QA's originals. `git diff --exit-code` printed nothing for each pair:
- `qa236-M6-…` vs `origin/qa/t216-report:docs/loops/qa-236/mutants/M6-identical-literal-copy-regen.diff`
- `qa236-M7-…` vs `origin/qa/t216-report:docs/loops/qa-236/mutants/M7-widen-i-flag-regen.diff`
- `qa239-q5-…` vs `origin/qa/t214-report:docs/loops/qa-239/mutants/q5-leading-space-tab-stripped.diff`

## Mutation runs (rows 2 and 3)

Runner: `docs/loops/qa-247/qa247-mut.mjs`, in a detached worktree `~/qa-scratch/qa247-cand` at the candidate.
For each mutant it does five things:
1. Restores `open-brain/`.
2. Applies the mutant.
3. Runs `tsc --noEmit`.
4. Runs `t216-loop-id.test.ts` and `t214-declared-blank.test.ts` with the json reporter.
5. Restores again.

The tree was clean afterwards. Raw rows: `docs/loops/qa-247/mutants/results.json`.

| Mutant | tsc | Result (16 tests) | Killed by |
| --- | --- | --- | --- |
| clean candidate | 0 | 16 passed, 0 failed | n/a |
| QA 236 **M6** (identical literal copy) | 0 | 15 / **1 failed** | L3b: `expected /…/ to be /…/ // Object.is equality` |
| QA 236 **M7** (own copy with `/i`) | 0 | 14 / **2 failed** | L2b (`"T001": expected true to be false`) and L3b |
| QA 239 **q5** (strip leading spaces and tabs) | 0 | 15 / **1 failed** | J3: `qa-declared [" [unrunnable]","A-1: x"]: expected false to be true` |
| **QA 247 A**: `new RegExp(LOOP_ID_PATTERN.source)` in `PlanSchema.loop` | 0 | 15 / **1 failed** | L3b, the identity check |
| **QA 247 B**: strip only leading TABs (`.replace(/^\t+/, "")`) | 0 | 15 / **1 failed** | J3: `qa-declared ["\t[unrunnable]","A-1: x"]: expected false to be true` |

### Row 2: T-217: MET
- M6 and M7 go red on the candidate's tests.
- **QA 247's mutant A** (`docs/loops/qa-247/mutants/qa247-A-new-RegExp-source.diff`) builds a regex equal in source
  and flags but as a new object. **L3b's identity check catches it**, as it should: `toBe(LOOP_ID_PATTERN)` fails.
  The source/flags-only rows (L2b, L3) all pass under it, so identity is the only thing that kills it.

### Row 3: T-218: MET
- q5 goes red on J3.
- **QA 247's mutant B** (`docs/loops/qa-247/mutants/qa247-B-strip-leading-tab-only.diff`) strips a leading tab but
  leaves spaces. **J3 catches it** at its first tab row, `["\t[unrunnable]", "A-1: x"]` under `qa-declared`.
  The space rows that come before it in J3 (`" [unrunnable]"`) still refuse, so the kill comes from the tab rows.
- One observation, not a defect: J3 asserts in a loop, so a mutant is reported only at its *first* surviving row.
  Each row carries a label (`${kind} ${JSON.stringify(lines)}`), and that is enough to name the row.

## Row 4: Full suite once at the candidate: MET (0 failed)

Runner: `docs/loops/qa-247/qa247-full.mjs`, `npx vitest run --reporter=json` in `qa247-cand/open-brain`, Node v22.22.1.
It took 464 s.

| Item | Result |
| --- | --- |
| Suites | 559 |
| Tests | **2089 passed, 0 failed**, 5 skipped |
| Failed suites | 0 |
| JSON `success` | `true` |

**vitest exited 1** even though `success: true` and no test or file failed. My runner kept only the stderr lines that
matched `error`, and none matched. So the run recorded no message for the non-zero exit, and I cannot attribute it.
The dispatch says to run the suite once, so I did not run it again to capture one. This is consistent with D-083's
"unattributed vitest RPC error is environmental", but I did not observe that error's text.
CI's full `Test` step at the same SHA passed (row 5).

## Row 5: CI: MET

I pushed `qa/t217-t218-ci-candidate` at `1a38e3f2` through `push-qa.mjs`, and the read-back matched. That gave 1 run:

| Field | Value |
| --- | --- |
| Run id | **36948923624** (CI, push) |
| headSha | `1a38e3f2bc2ce0b850d2bf68949823c5812c2576` |
| conclusion | **success** |
| `changed` job | success |
| `test` job | **success** (job id 110657297570, 2m32s; Install, Typecheck and Test all passed) |
| `test-windows` | skipped |

## Branches pushed
- `qa/t217-t218-ci-candidate` → `1a38e3f2bc2ce0b850d2bf68949823c5812c2576`
- `qa/t217-t218-report`: this report, `t217-t218-qa-report.E_t.json`, and `docs/loops/qa-247/` (runners, mutant diffs, results)

QA-247: REPORT COMPLETE
