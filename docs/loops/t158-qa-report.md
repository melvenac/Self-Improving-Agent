# T-158 QA report — record 220

## Verdict

**REJECT.** Candidate `c9ba1dbf9bf14240ba4ddbe6c96d4cc335461720` correctly keeps closed gaps as
tombstones and protects the automatic next-id path, but `add_gap` can still reuse a cited id through two paths:
an explicit `op.id`, and any citation-scan failure. R28 must remain in force.

Base: `474b65245b026c8587aa81b60abf81c0c3e76f7f`.

## Acceptance rows

### TG-1 — met

The focused candidate tests passed. `close_gap` retained G-001 with `status: closed`, `closed_session: 55`, and
`closed_rev: 8`; `removed_gap_ids` stayed empty; a second close refused `already closed`.

An independent render probe marked G-001 closed and found it absent from both the session greeting and SUMMARY.
The greeting count fell from 39 to 38 rather than listing the tombstone as open.

### TG-2 — partial

The required generated-id dry-run ran against the candidate worktree's copy of the real record. It left
`.agents/state.json` byte-identical, assigned **G-049**, and emitted:

- `add_gap skipped G-046: cited in 15 tracked file(s) ...`
- `add_gap skipped G-047: cited in 15 tracked file(s) ...`
- `add_gap skipped G-048: cited in 5 tracked file(s) ...`

The higher G-048 count is explained by the candidate's handoff, source comment, and tests; the base tree has the
planner's expected two files.

The row is not fully met because the same dry-run with explicit `id: "G-046"` succeeded and reported
`applied: [{ op: "add_gap", id: "G-046" }]`. `applyOne` bypasses `assignGapId` whenever `op.id` is supplied and
checks only `gaps[]`. A second probe removed `git` from PATH: `citedGapIds` swallowed the failed scan, generated
G-046, emitted no skip note, and still returned success. Both probes were dry runs and left the record unchanged.

### TG-3 — met

The fixture test proved both directions: cited G-040 was skipped and uncited G-041 was assigned. Against the base
tree, the candidate scanner found G-048 in exactly:

- `docs/loops/loop-14-closeout.md`, where it is inside a code span;
- `docs/loops/t158-t164-dispatch.md`, where it is inside Markdown emphasis.

Thus G-048 is cited only in punctuation-wrapped forms a narrower scan could miss, and this scan catches both.

### TG-4 — met

| Mutant | Typecheck | Kill |
| --- | --- | --- |
| `qa/t158-mut-splice` `f8c36431ce9445015100c18d992d2b41d1db5187` | pass | TG-1 red: expected `removed_gap_ids` `[]`, received `["G-001"]` |
| `qa/t158-mut-scan` `41fe1db697838a78536bb151806a5e510ffe0d11` | pass | TG-2 red: generated id was G-046 |
| QA `qa/t158-mut-own` `ac2aa5ce3bac87bc0c7ba56741820838460cde05` | pass | greeting test red: closed G-009 rendered and count was 5 instead of 4 |

Each mutant was based directly on the candidate. The two developer mutations are exact fast-forward commits whose
parent is `c9ba1db`; all three QA branches were pushed and read back through `docs/loops/qa-223/push-qa.mjs`.

### TG-5 — met

`GapSchema` adds optional `status`, `closed_session`, and `closed_rev`; schema version remains 3 and absent status
means open. A synthetic revision-156 copy of the real legacy-shaped record, with no gap status fields, parsed
successfully. The candidate's `state-schema` sync check passed on the same on-disk legacy shape. The independent
closed-gap probe showed both greeting and SUMMARY omit the tombstone.

Focused preservation tests passed: 7/7 selected writer tests covering `close_task`, done-task retention, add/close
gap, and related paths; the full focused state set had 131 passes and one unrelated moving-`origin/master` failure.

## CI and full suite

No run used `windows=true`.

| Run | Ref | Head SHA | Run conclusion | `test` job |
| --- | --- | --- | --- | --- |
| `36516875607` | `qa/t158-ci-candidate` | `c9ba1dbf9bf14240ba4ddbe6c96d4cc335461720` | failure | **failure** |
| `36516890826` | `qa/t158-ci-base` | `474b65245b026c8587aa81b60abf81c0c3e76f7f` | failure | **failure** |

Both tcm jobs executed: Typecheck succeeded, then the Test step failed only
`state-schema.test.ts` “T-171 r3b: origin/master's real state.json parses, and a missing note_by is null”.
The test reads moving `origin/master`, which now has `note_by`; it failed identically at the base. Candidate:
`Test Files 1 failed | 130 passed (131)`, `Tests 1 failed | 1827 passed | 6 skipped (1834)`.
Base: `Test Files 1 failed | 130 passed (131)`, `Tests 1 failed | 1824 passed | 6 skipped (1831)`.
No candidate suite failure is new.

The local Windows suites also failed only that same assertion. Candidate exit 1:
`Test Files 1 failed | 122 passed | 8 skipped (131)`,
`Tests 1 failed | 1753 passed | 80 skipped (1834)`, plus three known worker timeout errors.
Base exit 1: `Test Files 1 failed | 122 passed | 8 skipped (131)`,
`Tests 1 failed | 1750 passed | 80 skipped (1831)`, plus the same three timeout errors.
The known Windows dangling-symlink test did not fail in either run.

## Defects

1. **Major — explicit ids bypass citation protection.** `add_gap` accepts G-046 when the record ends below it,
   despite tracked citations. This directly preserves a route to id reuse after R28 is lifted.
2. **Major — citation scanning fails open.** `gitOut` catches every `git grep` failure and returns `null`;
   `citedIds` turns that into an empty map. Automatic `add_gap` then silently assigns G-046 without naming the
   missing protection.

The generated-id happy path is correct, so these are narrow repairs: validate explicit ids against citations and
refuse when the tracked-tree scan cannot be completed.

Evidence validation against the candidate build:
`node build/harness/cli.js validate evidence ../docs/loops/t158-qa-report.E_t.json` — exit 0.

## Open for the planner

No question blocks disposition. Recommendation: return the candidate for the two fail-closed repairs above and
keep R28 active. The reusable-id paths are explicit-id injection and unavailable/failing `git grep`; direct manual
editing of `state.json` remains outside the typed writer and is prevented only by operating rules.

## Model

QA seat: GPT-5.6 Sol, medium effort. Candidate builder: Composer 2.5 (`cursor-infra`).

QA-223: REPORT COMPLETE
