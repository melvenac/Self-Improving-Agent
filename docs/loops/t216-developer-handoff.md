# T-216 developer handoff — plan accepts the loop ids planner briefs use

**By:** Builder (developer seat), 2026-10-01. **Branch:** `loop/t216-plan-loop-id` from origin/master `c204d1d4`.

## NOT RUN — read this first

**Nothing below has been executed.** The QA PC was under a compute hold (Rivet's run) when this was written: no
`npm ci`, build, `tsc` or vitest. Every "red" and "green" cell is therefore **PENDING**, not a result. `/sync` was also
not run before the commit, for the same reason. The seat that runs them owns those columns.

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
| seat id `15-slice-4` and `t001` accepted | `t216-loop-id` L1 | PENDING | PENDING |
| empty, `15/slice`, `../x`, `15` refused | L2 | PENDING | PENDING |
| plan and evidence share one constant | L3 | PENDING | PENDING |
| developer report stays `tNNN` | L4 | PENDING | PENDING |
| `validate plan` on slice-four `D_t` exits 0 | L5 | PENDING (expected exit 1) | PENDING |
| `plan-gate --mode dry-run` reaches the gate | L6 | PENDING | PENDING |
| mutant: plan gets its own narrow regex | `mutants/m1-plan-own-narrow-regex.diff` | — | must turn L1/L3/L5 red: PENDING |

`b2-et.test.ts` BE-0.1 rows that pinned the old plan behaviour are inverted (superseded by T-216).
Files touching `schema.ts` beyond `tests/harness` were not enumerated by running; grep for importers before trusting
the vitest scope.
