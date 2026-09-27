# T-048 round 3 (`server.ts`: SILENT 4, SILENT 9, T048-D1 server half), candidate `b048df8`: QA report (QA seat, record session 182)

**By:** the QA seat, record session **182**, headless, launched by `docs/loops/qa-182/drive.ps1` (Cursor,
Composer 2.5). 2026-09-27 (UTC). **Machine:** `DESKTOP-O4EGB1E` (`$env:COMPUTERNAME`). **Elevated: yes.**
`net session` succeeds, and `WindowsPrincipal.IsInRole(Administrator)` is `True` for this process tree.
**Defender exclusions:** `C:\qa-scratch`, `C:\qa-tmp`. Probes and mutants ran with `TEMP=TMP=C:\qa-tmp`.
**Model:** `composer-2.5` (named in `docs/loops/qa-182/drive.ps1`; Cursor did not surface token usage in this
headless run). **Dispatch:** `docs/loops/t048-r3-dispatch-qa.md`. **Candidate:** `b048df8` on
`origin/loop/t048-r3` (handoff `40881b6`, `docs/loops/` only after it). **Base for round-3 product diff:**
`e48c5e7` (merge of `origin/master` `e201baa` before any r3 edit). **Brief:** Record 180 in
`docs/loops/session-147-dispatches.md`. **Scripts and outputs:** `docs/loops/qa-scripts-t048-r3/` (outputs in
`evidence/`). **Nothing live was written.** Every run pointed `HOME`, `USERPROFILE`, `KNOWLEDGE_V2_DB` and
`OPEN_BRAIN_VAULT_DIR` at `C:\qa-scratch\qa182\…`.

## Verdict

**ACCEPT `b048df8`.** All three round-3 distinctions reach a printed line on the routes the brief names. A failed
recall log write with a live session names the error and still returns hits. MCP `ob_end` prints
`formatRecalledResolution`, so "no session id" and "no recall_log rows" are different lines and the rejected-file
line is kept. Both `ob_sync --score` and `ob_score` append r2b's ` (invocation log: <state>)` parenthetical on
Pipeline Health when the state is not `ran`, and add nothing when it is `ran`. Preserve holds: recall does not fail
because logging failed; `ob_end` still finishes; `cli.ts` score output is unchanged; the audit's INTENDED and SAFE
rows are untouched. Developer CI and both QA mutants on tcm behave as claimed.

- **Low (test gap, not blocking):** `tests/t048-r3.test.ts` mocks `readLastInvocationTs` for **corrupt** and **ran**
  only on the server score renderers. It does not assert **missing** or **unreadable** on those routes. The product
  path is one shared `invocationLogSuffix` helper; I verified all four strings locally (below). A row per state on
  `handleSync`/`handleScore` would close the gap.
- **Low (handoff wording):** the developer handoff says "`server.ts` only". Round 3 also changes
  `open-brain/src/pipelines/sync/score-line.ts`, extracting `invocationLogSuffix` so `formatScoreCategoryLine`
  (`cli.ts`) and the two `server.ts` renderers share one wording without editing `cli.ts`.

## Round-3 product diff

`git diff e48c5e7 b048df8 -- open-brain/src` touches **two** source files:

| File | Belongs to round 3? | Role |
|---|---|---|
| `open-brain/src/server.ts` | **Yes** | SILENT 4 (`handleRecall` + `ob_recall` wrapper), SILENT 9 (`handleEnd` uses `formatRecalledResolution`), T048-D1 (`invocationLogSuffix` on `handleSync` and `handleScore`) |
| `open-brain/src/pipelines/sync/score-line.ts` | **Yes** | Extracts `invocationLogSuffix` from `formatScoreCategoryLine` so the `cli.ts` route and both server renderers print identical parentheticals; `cli.ts` itself has **no** diff in this round |

Tests added: `open-brain/tests/t048-r3.test.ts` (not in `open-brain/src`; scored separately).

## The dispatch's checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | **SILENT 4:** failed `recordRecallEvent` with live session prints `NOT LOGGED` naming the error; hits still returned; no-session line unchanged | **Holds.** `handleRecall` catches the write error and appends `_(NOT LOGGED: recall log write failed — <message>)_`. A SQLite trigger `RAISE(ABORT, 'recall-log-refused')` still returns the hit (`t048-r3-hit` / content token). No-session path still prints `cannot prove its session`. | `tests/t048-r3.test.ts` SILENT 4 row; local mutant `m-s4-empty-catch` kills by dropping the line |
| 2 | **SILENT 9:** MCP `ob_end` prints `formatRecalledResolution`; "no session id" ≠ "no recall_log rows"; rejected file line kept | **Holds.** `handleEnd` sets `originLine = formatRecalledResolution(resolved).join("\n")`. No session: `Nothing rated: no session id (ob_set_session never ran)…`. Proven session, no rows: `Nothing rated: no recall_log rows for session <id>…`. Garbage `.recalled-entries.json`: `Ignored <path>: unparseable` plus `Nothing rated: the only candidate file was refused (above)`. | `tests/t048-r3.test.ts` SILENT 9 row; `probe-r3.out` silent9 |
| 3 | **T048-D1 (`server.ts` half):** `ob_sync --score` and `ob_score` print invocation-log state in r2b wording; nothing extra when `ran`; check missing, corrupt, unreadable | **Holds** on wording and routes. Both append ` (invocation log: <state>)` after `(pct%)` on Pipeline Health when `details.invocationLog !== "ran"`. `invocationLogSuffix` returns `""` for `ran`. **Automated row:** corrupt (mocked) + ran on both routes. **Manual:** suffix strings for `missing`, `corrupt`, `unreadable: EBUSY…`, and `ran` on the built `score-line.js` module; `ob_sync --score` on a scratch project with no log file prints `Pipeline Health: 0/10 (0%) (invocation log: missing)` on both sync and score paths. | `tests/t048-r3.test.ts` D1 row; `probe-r3.out` score-missing, cli-parity |
| 4 | **Preserve:** recall never fails because logging failed; `ob_end` finishes; r2b `cli.ts` output unchanged; INTENDED and SAFE rows untouched | **Holds.** Throwing mutant `m-preserve-recall-throws` makes recall fail (FTS error, hit absent) — the fix prevents that. `handleEnd` dry_run returns in all three SILENT-9 states without throw. `git diff e48c5e7 b048df8` does not touch `cli.ts`; `formatScoreCategoryLine` text unchanged (verified on built module). Diff touches only `server.ts` recall/end/score lines and `score-line.ts` suffix extraction — no audit INTENDED/SAFE site files. | mutant `m-preserve-recall-throws`; `git diff`; `probe-r3.out` |
| 5 | **My mutants,** at least two, including one the developer did not run | **Five local, two on tcm** (budget 2 of 6 used). All five kill `tests/t048-r3.test.ts` locally. Two QA-only mutants pushed and red on tcm on their target rows only. | Mutants table |

## Mutants

Driver `mutants-qa182.mjs`. Each anchor matched exactly once (or both `handleSync`/`handleScore` lines for
`m-d1-no-suffix`), `tsc --noEmit` passed before commit, sources restored after local `run`.

| Row | Mutant | What it breaks | Local kill | tcm run | tcm kill |
|---|---|---|---|---|---|
| SILENT 4 | `m-s4-empty-catch` (developer) | restores empty `catch { /* non-critical */ }` | **yes** — no `NOT LOGGED` | *(developer)* `36306235793` | SILENT 4 only |
| SILENT 9 | `m-s9-old-origin` (developer) | drops `formatRecalledResolution`, restores count-only line | **yes** — no `Nothing rated: no session id` | *(developer)* `36306237680` | SILENT 9 only |
| T048-D1 | `m-d1-no-suffix` (developer) | removes `invocationLogSuffix` from both server score lines | **yes** — no `invocation log:` on sync/score | *(developer)* `36306239438` | T048-D1 only |
| Preserve | `m-preserve-recall-throws` (**QA-only**) | rethrow on failed `recordRecallEvent` | **yes** — recall loses hit (`t048-r3-hit` absent) | `36351526140` | SILENT 4 only (`AssertionError` on hit) |
| T048-D1 | `m-d1-missing-only` (**QA-only**) | `invocationLogSuffix` names only `missing`, not corrupt/unreadable | **yes** — corrupt mock fails regex | `36351527659` | T048-D1 only (+ r2b D1 cli bar line) |

**Branches pushed** (read back via `push-qa.mjs`): `qa/t048-r3-mut-preserve-recall-throws` `51bb659`;
`qa/t048-r3-mut-d1-missing-only` `5b5adab`.

## CI

- **Developer red** `cc56fa4`, run `36305739687`, tcm-2: **3 failed** — all three `tests/t048-r3.test.ts` rows (D1
  had no invocation-log parenthetical; SILENT 9 had count-only origin line; SILENT 4 still had empty catch).
- **Developer green** `b048df8`, run `36305953718`, tcm: **99 files, 1431 passed, 2 skipped (1433)**. `test-windows`
  skipped. No `windows=true` job.
- **Developer mutants:** `36306235793` (empty catch), `36306237680` (drop resolution), `36306239438` (drop score
  state) — each **1 failed, 1430 passed, 2 skipped**, on its named row only (per handoff; conclusions confirmed).
- **My CI:** **2 of 6** tcm runs (`workflow_dispatch`, `hosted=false`, no Windows). Both **failure** on the
  intended row only, as above. No run for the candidate itself — developer green is its record.

## Defects

| ID | Severity | Defect | Where |
|---|---|---|---|
| T048-D6 | Low (test gap) | Server score renderers are regression-tested for **corrupt** and **ran** only; **missing** and **unreadable** reach the same `invocationLogSuffix` but have no dedicated `handleSync`/`handleScore` assertion. | `tests/t048-r3.test.ts` D1 row |
| T048-D7 | Low (doc) | Developer handoff table says "`server.ts` only"; `score-line.ts` is also product. | `docs/loops/t048-r3-developer-handoff.md` |

## Disagreements

None with the developer's CI numbers, mutant kills, or the three distinctions. The handoff understates the file
count (T048-D7); the code is correct.

## Error entries (my own)

- First `git push` via `push-qa.mjs` failed on credential store (`wincredman` / no TTY). `gh auth setup-git` before
  `push-qa.mjs` fixed it; read-back succeeded on both mutant branches.
- `probe-r3.mjs` first version used bare Windows paths in `import()` (ESM URL error). Fixed with `pathToFileURL`.
- `probe-r3.mjs` SILENT-4 manual section used a scratch db path inconsistent with shell `KNOWLEDGE_V2_DB` and returned
  no hit; the vitest row is authoritative. Score corrupt/unreadable manual section wrote to the wrong log filename
  (`invocation-log.jsonl` vs `skill-invocations.jsonl`); missing-file probe and `invocationLogSuffix` unit read are
  authoritative for D1 wording.

## Open for the planner

None block the merge.

1. **T048-D6:** add three mocked `readLastInvocationTs` values (`null`/`corrupt`/`unreadable: …`) to the D1 test, or
   one parameterized row, so missing and unreadable are pinned on `handleSync` and `handleScore` the way corrupt is.
2. **T048-D7:** amend the handoff to name `score-line.ts` and why it was shared with `cli.ts`.

## Reproduce

Scratch root `C:\qa-scratch\qa182`: `cand/` = candidate worktree at `b048df8`; `mut/` = mutant/report worktree.

```
node docs/loops/qa-scripts-t048-r3/probe-r3.mjs C:/qa-scratch/qa182/cand/open-brain
QA_ROOT=C:/qa-scratch/qa182/mut node docs/loops/qa-scripts-t048-r3/mutants-qa182.mjs <name> run
node docs/loops/qa-182/push-qa.mjs qa/t048-r3-mut-<name>
gh workflow run ci.yml --ref qa/t048-r3-mut-<name> -f hosted=false
```

No PR, no `/end`, and no live `state.json` was written.

QA-182: REPORT COMPLETE
