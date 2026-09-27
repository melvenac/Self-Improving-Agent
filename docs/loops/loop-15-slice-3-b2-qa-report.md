# Loop 15 slice three, candidate B part 2 (`E_t`, R10): QA report

**QA:** record session **189**, Composer 2.5 (`composer-2.5` in the headless driver), 2026-09-27.
**Machine:** `DESKTOP-O4EGB1E`, Windows 10.0.19045. Worktree for probes:
`C:\qa-scratch\qa189\cand` (detached at handoff `c1eda2f`, product `8c7769f`). Report branch
worktree: `C:\qa-scratch\qa189\report` (`qa/b2-report`).

**Candidate:** product `8c7769ff6c5c16cacdb7b08cd47144af04d15ef0` on
`origin/loop/15-slice-3-candidate-b2`. Handoff `c1eda2f6fb6e75020d2f7f517d72b33b29026452`.
Base: `677c1dd` (A13 merged). Criteria: QA 132 BE-0 to BE-8, rulings Open 1–6 adopted.

## Verdict

**ACCEPTED.** The product diff is inside B part 2's scope (BE-0). Every BE-1 to BE-8 row
passes on the candidate locally and on tcm. Developer red/green and five developer mutants
behave as the handoff claims. QA 189 added three independent mutants; all kill their target
rows locally. A13 `configwatch` spot-check, B part 1's G-042 files, and runtime `tNNN` guards
are preserved.

---

## BE-0. Scope of the diff

| Row | Result | Evidence |
|-----|--------|----------|
| BE-0.1 | PASS | `EvidenceSchema` only widens `loop`. `PlanSchema`, `DeveloperReportSchema` and `cli.ts --loop` keep `^t\d{3,}$`. `plan.schema.json` byte-identical to base (`git diff 677c1dd..8c7769f` empty). |
| BE-0.2 | PASS | `evidence.schema.json` derived; loop pattern updated to human-seat form. Regenerated, not hand-edited. |
| BE-0.3 | PASS | No touch to `configwatch.ts`, G-042 instruments (`spawn-async.ts`, `eld-setup.ts`, vitest G-042 load), or B-0 files. Diff is nine files under harness + tests + handoff. |
| BE-0.4 | PASS | No `.skip`/`.todo`/`runIf`. One fixture hunk in `schema.test.ts` (`validEvidence()` gains `order: "shown"`); pre-B refusal asserted in `b2-et.test.ts` BE-2.2. |

**Inside B's scope:** +223/−10 product lines across `cli.ts`, `declared.ts` (new), `index.ts`,
`runtime.ts`, `schema.ts`, `evidence.schema.json`; +467 test lines in `b2-et.test.ts`; fixture
edit in `schema.test.ts`.

---

## BE-1. Loop id admits human-seat ids

| Row | Result | Evidence |
|-----|--------|----------|
| BE-1.1 | PASS | `validateEvidence` accepts `t001`, `15-slice-3`, `15-slice-3-b`; refuses `""`, `" "`, `a/b`, `a\\b`, `..`, `../x`, `15-slice-3\nextra`. Pattern `^(?:t\d{3,}\|[0-9]+(?:-[a-z0-9]+)+)$` exported as `EVIDENCE_LOOP_PATTERN`. |
| BE-1.2 | PASS | `harness run --loop 15-slice-3` exit 2, stderr contains `--loop must look like t001`. |
| BE-1.3 | PASS | Runtime returns `evidence-loop-mismatch` once (`qa.calls === 1`) for `loop: "t002"` and for schema-valid `15-slice-3` on a `t001` run. **Filesystem check:** `existsSync(artifacts/iterations/t001/E_t.json)` is **false** on both refusal paths (`b2-et.test.ts` lines 421–440; QA re-ran locally). |

---

## BE-2. `order: shown \| attributed`; no new status

| Row | Result | Evidence |
|-----|--------|----------|
| BE-2.1 | PASS | Acceptance enum exactly five values on disk and from zod; `attributed` / `met_attributed` refused. Requirements stay four values. |
| BE-2.2 | PASS | `met` + `order: "shown"` and `met` + `order: "attributed"` accepted; `inferred` refused; **met with no `order` refused** with message naming `order`. |
| BE-2.3 | PASS | `partial`: optional `order`. `unmet`, `not_evaluated`, `pending`: omit OK; `order` on those statuses refused. Rule documented in `schema.ts` AcceptanceFindingSchema comment. |
| BE-2.4 | PASS | Runtime loop with `order: "attributed"` completes; committed `E_t.json` carries `"order": "attributed"`. |

---

## BE-3. `pending` is its own status

| Row | Result | Evidence |
|-----|--------|----------|
| BE-3.1 | PASS | `acceptance[].status: "pending"` validates; `Pending` / `pending ` refused. Requirements refuse `pending`. |
| BE-3.2 | PASS | Runtime passes `pending` through to committed `E_t.json`. |
| BE-3.3 | PASS | No `verdict`, `would_merge`, `out_of_scope`, or `invisible` on `E_t`. |

---

## BE-4. Declared lists parser

| Row | Result | Evidence |
|-----|--------|----------|
| BE-4.1 | PASS | `parseDeclared`: absent `{ present: false }` ≠ present-empty `{ present: true, unrunnable: [], outOfScope: [] }`. |
| BE-4.2 | PASS | Valid lists separate; refuses id in both lists, duplicate id, bad line format, multiple blocks. |
| BE-4.3 | PASS | Legacy `qa-unrunnable` → U1–U6, no out-of-scope. |
| BE-4.4 | PASS | Criteria-B block → empty unrunnable, BC-1–BC-5 out-of-scope. |
| BE-4.5 | PASS | `E_t` carries neither list; omission validates; `out_of_scope`, `invisible`, status `out_of_scope` refused. |

---

## BE-5. Backward compatibility

| Row | Result | Evidence |
|-----|--------|----------|
| BE-5.1 | PASS | `StubQa` unchanged (`not_evaluated`, no `order`). `runtime.test.ts` (65 rows), `schema.test.ts`, `refwatch*`, `gate-artifacts`, `policies`, `cli.test.ts` all pass locally without edits. |
| BE-5.2 | PASS | **Refusing pre-B `met` without `order` is what BE-5 asks** (deliberate rejection per BE-5.2 text and rulings Open 2). Not a break BE-5 forbids — BE-5.2 names exactly this case. |
| BE-5.3 | PASS | Derived `evidence.schema.json` description names LIMIT rules: duplicate acceptance, order-on-met, separate unrunnable/out-of-scope lists, runtime_checks run ids. Drift test passes. |
| BE-5.4 | PASS | `git log --all -- '*E_t.json'` empty on this clone (re-run at scoring). |

### BE-5.2 — every `E_t` producer and fixture the pre-B `met` refusal affects

| Producer / fixture | Role | Affected? |
|--------------------|------|-----------|
| **`StubQa`** (`roles.ts`) | Runtime's only loop `E_t` writer | **No** — writes only `not_evaluated`, never `met`, never `order`. |
| **`schema.test.ts` `validEvidence()`** | In-repo test fixture | **Updated** — gained `order: "shown"` in named hunk. |
| **`b2-et.test.ts` `evidence()`** | BE row helper | **No** — default row is `not_evaluated`. |
| **BE-6 / BE-7 test documents** | Constructed in tests | **No** — use `order` where `met`. |
| **`FixedQa` in `b2-et.test.ts`** | Runtime BE rows | Uses explicit `order` on `met` rows (BE-2.4). |
| **Human-seat QA writer** (outside repo) | Future `E_t` beside prose | **Yes** — any `met` row must carry `order`; intentional per R10(b). |

No other `status: "met"` site exists in `open-brain/src` or `open-brain/tests` (`git grep` on candidate).

---

## BE-6. R10 fit test

| Row | Result | Evidence |
|-----|--------|----------|
| BE-6 | PASS | Independent document (QA 189, separate from test source): `loop: "15-slice-3"`, A1 `met`/`attributed`, A8 `pending`, A4–A7 omitted — `validateEvidence` → ACCEPTED. Matches `b2-et.test.ts` BE-6. Out-of-scope ids excluded via omission (BE-4.5), not flattening to `not_evaluated`. |

---

## BE-7. Validator, not writer

| Row | Result | Evidence |
|-----|--------|----------|
| BE-7.1 | PASS | `harness validate evidence <file>` exits 0 on valid, non-zero on invalid; stdout lines equal `validateEvidence` problems. Uses zod, not JSON Schema alone. |
| BE-7.2 | PASS | **No human-seat writer added.** Only `validate evidence` subcommand. Runtime's pre-existing `writeQa`/`renderEvidence` for loop runs is unchanged in role — not scored as a new writer per BE-7.2. |

---

## BE-8. Suite and CI

| Row | Result | Evidence |
|-----|--------|----------|
| BE-8 | PASS | tcm green [36316975390](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316975390): **122** files, **1699 passed \| 6 skipped (1705)**. Local: `tsc --noEmit`, `b2-et.test.ts` 41/41, `schema.test.ts` + `runtime.test.ts` 65/65. |

---

## Dispatch focus items

### 1. BE-5 vs one test edit (`order: "shown"`)

Refusing pre-B `met` is **required by BE-5.2**, not a regression. Rulings Open 2 binds fail-closed
`order` on `met`. The fixture edit is the named hunk; refusal is tested in BE-2.2.

### 2. mut-b and BE-7.1 — one row, two jobs?

**Yes, one invalid document does two jobs** on mut-b: the same `met` row without `order` is refused by
the BE-2.2 schema refinement and by BE-7.1's CLI path. That is intentional: BE-7.1's invalid file
is chosen to prove the CLI calls `validateEvidence` (not JSON Schema), which misses the refinement.

**BE-7.1 is not separately killable** from BE-2.2 while that file remains the invalid fixture —
any mutant that accepts `met` without `order` breaks both rows together (mut-b CI:
[36316978635](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316978635), 2 failed).
A different invalid document could isolate BE-7.1, but the candidate correctly couples them.

### 3. mut-a — empty and newline loop ids stayed green

**Unguarded by the human-seat pattern; guarded by JavaScript regex semantics of the mutant.**
mut-a widened `EVIDENCE_LOOP_PATTERN` to `/^.+$/`. Empty `""` still fails (`.+` needs ≥1 char).
`"15-slice-3\nextra"` still fails (`.` does not match newline; anchored match fails). Those rows
stay green on mut-a **without** the real pattern's path-segment rules — a latent gap if someone
widened to `.+` thinking it was equivalent. The candidate's real pattern refuses them via explicit
segment rules, not incidentally.

### 4. BE-1.3 no-write path

Verified by **filesystem**, not return value alone: after `runLoop` with mismatched `loop`,
`artifacts/iterations/t001/E_t.json` is absent; `failure.code === "evidence-loop-mismatch"`;
`qa.calls === 1`.

### 5. BE-7 — no writer

Confirmed: no `writeEvidence` helper, no prose-to-JSON tool. Seat validates with
`harness validate evidence <file>`.

---

## Who reads the new fields (preserve check)

| Consumer | Reads |
|----------|-------|
| `runtime.ts` | `validateEvidence`; compares `evidence.loop` to run loop (BE-1.3); `renderEvidence` JSON-stringifies full object (`order`, `pending` preserved). |
| `cli.ts` | `validate evidence` → `validateEvidence`; `run --loop` still `tNNN` only. |
| `index.ts` | Re-exports `EVIDENCE_LOOP_PATTERN`, `parseDeclared`, `DeclaredParseError`, schemas. |
| `artifacts.ts` | `renderEvidence` / `evidencePath` — unchanged contract, wider shape. |
| `StubQa` | Does not set `order` or `pending` (BE-5.1). |
| **A13 `configwatch`** | Untouched in diff; `configwatch-a13.test.ts` 1 passed / 3 skipped locally. |
| **G-042 repair** | No diff in `spawn-async.ts`, `eld-setup.ts`, or vitest G-042 wiring. |

---

## Developer mutants (tcm)

| Run | Branch | SHA | Result | Killed rows |
|-----|--------|-----|--------|-------------|
| [36316976945](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316976945) | `mut-a` | `2ae7201` | fail 5 | BE-1.1: `" "`, `a/b`, `a\\b`, `..`, `../x` accepted |
| [36316978635](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316978635) | `mut-b` | `594d044` | fail 2 | BE-2.2 + BE-7.1 (`met` no `order`) |
| [36316980342](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316980342) | `mut-c` | `dec9e99` | fail 5 | BE-2.1, BE-2.3, BE-3.1, BE-3.2, BE-6 |
| [36316982075](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316982075) | `mut-d` | `9fe3f59` | fail 3 | BE-4.2, BE-4.4, BE-6 |
| [36316983679](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316983679) | `mut-loop` | `0e66f2c` | fail 2 | BE-1.3 both rows (`completed`, `E_t.loop=t002`) |

## QA 189 mutants (local vitest; branches pushed)

| Branch | Edit | Killed row |
|--------|------|------------|
| `qa/b2-mut-nowrite` `7816460` | Write `E_t.json` before `evidence-loop-mismatch` fail | BE-1.3 no-write (2 fails: `existsSync(et)` true) |
| `qa/b2-mut-cli-widen` `bce7c84` | CLI `--loop` uses `EVIDENCE_LOOP_PATTERN` | BE-1.2 (run starts; no `--loop must look like t001`) |
| `qa/b2-mut-verdict` `a5f8335` | Optional `verdict` enum on `EvidenceSchema` | BE-3.3 (`verdict: "would-merge"` accepted) |

Pushed via `node docs/loops/qa-189/push-qa.mjs`. No additional tcm dispatch (developer used 7/8 budget).

---

## CI summary

| Run | SHA | Conclusion | Tests |
|-----|-----|------------|-------|
| [36316975271](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316975271) red | `043fb8b` | failure | 23 failed \| 1676 passed \| 6 skipped |
| [36316975390](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36316975390) green | `8c7769f` | success | **1699 passed \| 6 skipped** |

Red failures are all `b2-et.test.ts` rows; no `src/` change on red branch. Green ≥ base + 41 new rows.

---

## Defects

None found.

---

## What could not be verified

- **Full local suite on win32:** `qa104-a9-probe2.test.ts` symlink `EPERM` on this checkout (pre-existing; named not-for-merge in developer handoff). tcm is authoritative (BE-8).
- **BE-2.4 / BE-3.2 at unfixed product:** red by code path only on developer machine; QA confirmed green on candidate via runtime rows.
- **tcm on QA mutants:** local vitest only; branches pushed for audit.
- **GitNexus:** stale in this worktree; callers found by read/grep.

---

## Open for the planner

None blocking acceptance. BC-4 (attributed `met` weight in C's verdict) remains C's question per rulings Open 3.

---

**Model:** Composer 2.5 (`composer-2.5`).

QA-189: REPORT COMPLETE
