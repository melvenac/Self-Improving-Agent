# T-217 and T-218 developer handoff: two test guards QA found missing

**By:** Builder (developer seat, `sia-builder`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t217-t218-guards` from `origin/master` `c34866d3`.
**Dispatch:** `docs/loops/t217-t218-dispatch.md` at `28e94677`. **Test-side only: no file under `open-brain/src` changed.** No CI. Two touched test files and the three mutants were run, one at a time.

## T-217 (QA 236 D1): the plan's loop regex must be the shared constant

`open-brain/tests/harness/t216-loop-id.test.ts`:
- **L3b** reads the regex out of zod's own check list for `PlanSchema.shape.loop` and `EvidenceSchema.shape.loop` and asserts each **is** `LOOP_ID_PATTERN` by identity (`toBe`). It also asserts the plan's regex is not an identical literal and carries no flags. Identity is what a case-insensitive or literal copy cannot satisfy: the derived JSON Schema drops flags and compares text, so every row that only reads accept and refuse passes it.
- **L2b** adds `T001`, `15-Slice-4`, `15-SLICE-4` and `t001A` to the plan's refusal rows.

| Mutant (copied from `origin/qa/t216-report`) | Result |
| --- | --- |
| `qa236-M6-identical-literal-copy-regen.diff` (an identical literal copy) | `tsc` 0; red on L3b |
| `qa236-M7-widen-i-flag-regen.diff` (own copy with `/i`) | `tsc` 0; red on L2b and L3b |

## T-218 (QA 239 G1): leading whitespace in a declared block is refused

`open-brain/tests/harness/t214-declared-blank.test.ts`, **J3**: nine rows, under both fence kinds, in which a header or an item has leading spaces or a tab (` [unrunnable]`, `\t[unrunnable]`, `  A-1: x`, `\tA-1: x`, a leading-space `[out-of-scope]` mid-block, and a leading-space header under the frozen fence, where a header is never an item) are each refused. The same lines without the leading whitespace parse, so each refusal is the whitespace's doing.

| Mutant (copied from `origin/qa/t214-report`) | Result |
| --- | --- |
| `qa239-q5-leading-space-tab-stripped.diff` | `tsc` 0; red on J3 |

## Runs

`t216-loop-id` 8 passed and `t214-declared-blank` 8 passed on the branch. Mutant diffs are kept under `docs/loops/t217-t218/mutants/`. Free RAM 1.29 to 1.62 GB (the first, green, run was under 1.5 GB).
