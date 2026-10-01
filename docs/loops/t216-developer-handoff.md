# T-216 developer handoff — plan accepts the loop ids planner briefs use

**By:** Builder (developer seat), 2026-10-01. **Branch:** `loop/t216-plan-loop-id` from origin/master `c204d1d4`.

## Run on the QA PC, sequentially (2026-10-01, product ef7a1ce)

`npm ci` exit 0; `npm run build` exit 0 (stamped ef7a1ce); `tsc --noEmit` exit 0; `vitest run tests/harness` exit 0
(29 files passed, 7 skipped; 483 tests passed, 75 skipped). `schema.ts` has no importer outside `tests/harness`.
`validate plan` on slice-four D_t: exit 0 fixed. `plan-gate --mode dry-run` (temp copy, no Jev call): exit 0.
**Red** was taken with mutant m1 applied, which narrows the plan back to `^t\d{3,}$` (the pre-fix plan rule):
`validate plan` exit 1 (`loop: loop must look like t001`); vitest on t216-loop-id + b2-et exit 1, 4 failed. Mutant reverted.
`/sync` NOT run.

## Change

- `schema.ts`: one exported `LOOP_ID_PATTERN` (+ `LOOP_ID_MESSAGE`), used by `PlanSchema` and `EvidenceSchema`.
  `EVIDENCE_LOOP_PATTERN` stays as an alias so existing imports keep working. `index.ts` re-exports `LOOP_ID_PATTERN`.
- `schemas/plan.schema.json`: hand-edited to the pattern zod emits for the evidence schema (not regenerated — no
  build). A build-time regeneration should leave it unchanged; if it does not, the regenerated file wins.

## Audit of other `tNNN` assumptions

| Site | Decision |
|---|---|
| `DeveloperReportSchema` loop (`schema.ts`) | stays `tNNN`: `R_t` is written by the runtime's own developer stage. |
| `cli.ts:143` `--loop` | stays `tNNN`: names a loop the runtime runs (branch, tag, `artifacts/iterations/<loop>/`). |
| `brief-plan-gate.ts` `GATE_RECORD_RE` | no change: keyed on the brief stem and a timestamp, no loop id in it. |
| `brief-plan-gate.ts:293,305` | `plan.loop` is copied into the record, never built into a path. |
| `artifacts.ts:83` | heading text only. |
| `shadow-merge.ts` `verdictPath(loop)` | loop comes from a validated `E_t`; already seat-id-safe by the evidence pattern (no `/`, `.`). |

## Rows

| Row | Test | Red (unfixed) | Green |
|---|---|---|---|
| seat id `15-slice-4` and `t001` accepted | `t216-loop-id` L1 | red (m1) | green |
| empty, `15/slice`, `../x`, `15` refused | L2 | not red under m1 (refusals hold either way) | green |
| plan and evidence share one constant | L3 | NOT red under m1 (m1 leaves both constants equal; guards drift in the JSON pattern only) | green |
| developer report stays `tNNN` | L4 | n/a (unchanged behaviour) | green |
| `validate plan` on slice-four `D_t` exits 0 | L5 | exit 1 (m1) | exit 0 |
| `plan-gate --mode dry-run` reaches the gate | L6 | red (m1) | green |
| mutant: plan gets its own narrow regex | `mutants/m1-plan-own-narrow-regex.diff` | — | red: L1, L5, L6, b2-et BE-0.1 (4 failed); L3 stays green |

`b2-et.test.ts` BE-0.1 rows that pinned the old plan behaviour are inverted (superseded by T-216).
