# The `/bootstrap` fix round 4 reconciled with master (`d74c0e5`): QA report (QA 161)

**By:** the QA seat, record session **161**, for T-154. Composer 2.5 (`composer-2.5`), launched headless by
`docs/loops/qa-161/drive.ps1`, started 2026-09-27 ~21:33 UTC. **Dispatch:**
`docs/loops/bootstrap-fix-r4-dispatch-qa.md` (Atlas, record 146, amended record 147). **Machine:** `DESKTOP-O4EGB1E`,
Windows 10, user `Aaron`, **elevated** (Administrator). Node **v24.5.0**. `drive.meta` would record `temp=C:\qa-tmp`.
**Scratch:** `C:\qa-scratch\bf161\` (`cand`, `base`, `qat`, `mut-*`, `report`). No live `state.json` written. No `/end`.

**Candidate:** `d74c0e5` on `origin/loop/bootstrap-fix-r4-rec` — r4 `7bd47f4` merged with `origin/master` `e201baa`
(record 179). Round-4 product-only tip on the pre-merge branch is `7bd47f4`; handoff-only commits follow on
`loop/bootstrap-fix-r4`. **Read:** the dispatch; `docs/loops/t171-bootstrap-rulings-qa144-qa145.md` (QA 145 section);
`docs/loops/bootstrap-r4-amend-and-queue-guard-brief.md` (R-BF-21); developer handoff on the branch; QA 145's report
on `origin/qa/bootstrap-fix-r3-report`; `qa145-bootstrap-r3.test.ts` from `origin/qa/bootstrap-fix-r3-qa-tests`
(blob `7ef880e`); `bootstrap-fix-r4.test.ts` on the candidate.

**Branches pushed** (each through `node docs/loops/qa-161/push-qa.mjs`, read back):

| Branch | Commit | What |
|---|---|---|
| `qa/bootstrap-fix-r4-qa-tests` | `5b498d1` | `d74c0e5` + evidence transcripts |
| `qa/bootstrap-fix-r4-mut-bf17` | `4d5f6dc` | mutant: `{}` counts as a record |
| `qa/bootstrap-fix-r4-mut-bf18` | `9a9013f` | mutant: zero-byte `state.json` is a root marker |
| `qa/bootstrap-fix-r4-mut-bf19` | `12c71c5` | mutant: nested STOP omits `git init` remedy |
| `qa/bootstrap-fix-r4-mut-bf20` | `0e067cc` | mutant: failed-undo says "refused" |
| `qa/bootstrap-fix-r4-mut-bf21` | `2495dcd` | mutant: `OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK` dynamic import in `cli.ts` |
| `qa/bootstrap-fix-r4-report` | | this report and `docs/loops/qa-161/` |

## Verdict

**ACCEPT `d74c0e5`.** R-BF-17 through R-BF-21 hold on the candidate and on the rows named in the dispatch. The
reconciliation merge changes `cli.ts` only to the union of both parents' import lists and message wording; importer
r2/r5 behaviour is unchanged by that hunk. QA 145's regression rows pass **13 of 15** locally; the two failures are
install-N rows that pin pre-r4 `Next:` wording superseded by R-BF-19 (the developer's `bootstrap-fix-r4.test.ts` row
covers install N). All four installs pass with no manual fix. Five mutants are killed on tcm. Nothing found blocks the
merge.

## R-BF-17: non-record JSON

All seven QA 145 shapes are **NOT A RECORD** with byte-exact reasons, and `move-residue` sets each aside (evidence
`docs/loops/qa-161/evidence/probes-r4.md`, section P-JSON-R4; local `bootstrap-fix-r4.test.ts` rows).

| `state.json` | `check` | `move-residue` |
|---|---|---|
| `{}` | NOT A RECORD — a JSON object with no schema_version | moved aside |
| `{"project":{}}` | same | moved aside |
| `[]` | NOT A RECORD — JSON array | moved aside |
| `null` | NOT A RECORD — JSON null | moved aside |
| `42` | NOT A RECORD — JSON number | moved aside |
| `"text"` | NOT A RECORD — JSON string | moved aside |
| `true` | NOT A RECORD — JSON boolean | moved aside |

A v3 record and a v2 record with `schema_version` stay **BOOTSTRAPPED**; `move-residue` refuses (P-RECORD rows).

**`/start` on each (reported, not scored this round):** through `sessionStart` / `readProjectState`, every shape above
has `stateJson.present=true`, `stateJson.valid=false`. Objects missing `schema_version` (`{}`, `{"project":{}}`) get
`errorPath: schema_version`. The five non-objects get `errorPath: $`. Mode stays `project` because `.agents/` exists. This
is the same split QA 145 reported for `handleStart`; the greeting path now goes through `sessionStart`'s structured
`stateJson` rather than a single `isError` flag. Fixing the non-object fallback remains out of scope (dispatch: "its
fallback is not this round's").

## R-BF-18: zero-byte stray and shared `state-record.ts`

- **Zero-byte stray:** a zero-byte `.agents/state.json` between a real record and the cwd does **not** win the walk
  (local row; mutant bf18 red on tcm).
- **`state-record.ts` is shared** by `whyNotARecord` in `bootstrap/index.ts` and `isStateRecord` in `repo-root.ts`.
- **Call sites (9, unchanged from QA 145):** `resolveRepoRoot` callers in `cli.ts` (`sync`, `detach`, `state erasures`,
  `state show`), `sync/index.ts` `runSync`, `server.ts` `handleScore` and `ob_start`, and `resolveHookProjectDir` in
  `cli-session-end.ts` (twice). `isProjectRoot` has one caller (`resolveRepoRoot`).
- **SIA's own root** resolves unchanged from `<SIA>`, `open-brain/`, `open-brain/src/` and `docs/` (P-WALK-SIA).
- On **real records**, behaviour matches r3: a directory with `.agents/state.json` carrying `schema_version` is still
  a root marker.

## R-BF-19: nested STOP names both remedies

Install N reaches step (e) with `Next:` naming **`git init` here** and **move the folder out**, with no inference
(`bootstrap-fix-r4.test.ts`; evidence in acceptance transcript). `bootstrap.md` step 1 matches (same two remedies in
the `inside another repository` stop). Mutant bf19 (drops `git init` wording) is red on tcm.

## R-BF-20 and R-BF-21: failed-undo path and no test seam in `cli.ts`

- **R-BF-20:** `formatMoveResidueFailure` in `bootstrap/index.ts` prints `not undone:` for `ResidueUndoError`, never
  "refused" on the failed-undo path (P-UNDO row in `bootstrap-fix-r4.test.ts`). Mutant bf20 restores "refused" and is
  red on tcm.
- **R-BF-21:** `git grep OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK` over `open-brain/src/` finds **nothing** on the candidate.
  No `import(process.env…)` in `cli.ts` changes how a mutating command behaves; the only dynamic imports are the
  existing lazy loads (`checks-memory.js`, pipeline modules). Mutant bf21 adds the env-hook line and is red on tcm (grep
  row fails).

## Merge with master (`cli.ts`)

`git show --cc d74c0e5 -- open-brain/src/cli.ts` resolves the conflict to import **both** `inboxWarning` and
`describeDecisionsUnreadable`, and keeps both CHANGELOG sections. No bootstrap behaviour change beyond that union.

## Regressions

| Suite | Local at `d74c0e5` | Notes |
|---|---|---|
| `bootstrap-fix-r4.test.ts` | 11/11 | R-BF-17..21 |
| `bootstrap-fix-r3.test.ts` | 22/22 | R-BF-9..16 |
| `qa135-bootstrap.test.ts` | 7/7 | blob `85ae260` |
| `qa145-bootstrap-r3.test.ts` | 13/15 | blob `7ef880e` unmodified; **N1/N2 fail** — they assert pre-r4 nested `Next:`; R-BF-19 row passes |
| Four installs (`accept-bf-r3.mjs`) | 77/77 | evidence `docs/loops/qa-161/evidence/accept-r4.md` |

Importer r2/r5 rows are included in the full suite; developer merge CI `36305482242` at `d74c0e5` reports **1493 passed,
2 skipped**.

## Mutants (one per ruling)

| ID | Protection | Local vitest | tcm run |
|---|---|---|---|
| bf17 | `{}` is a record | red (2 R-BF-17 rows) | `36352751114` failure |
| bf18 | zero-byte root marker | red (R-BF-18) | `36352754691` failure |
| bf19 | nested STOP missing `git init` | red (R-BF-19) | `36352758601` failure |
| bf20 | failed-undo says "refused" | red (R-BF-20) | `36352762721` failure (1 fail) |
| bf21 | env-hook in `cli.ts` | red (R-BF-21 grep) | `36352766770` failure |

Applied by `docs/loops/qa-161/mutants-r4.mjs`; never to merge.

## CI

**Budget: 6 tcm runs** (`workflow_dispatch`, `hosted=false`, no `windows=true`). All on self-hosted tcm.

| Run | Branch | Result | Tests (from log) |
|---|---|---|---|
| `36352746439` | `qa/bootstrap-fix-r4-qa-tests` | **success** | 1493 passed, 2 skipped |
| `36352751114` | `qa/bootstrap-fix-r4-mut-bf17` | failure | 2 failed (R-BF-17) |
| `36352754691` | `qa/bootstrap-fix-r4-mut-bf18` | failure | R-BF-18 failed |
| `36352758601` | `qa/bootstrap-fix-r4-mut-bf19` | failure | R-BF-19 failed |
| `36352762721` | `qa/bootstrap-fix-r4-mut-bf20` | failure | 1 failed (R-BF-20) |
| `36352766770` | `qa/bootstrap-fix-r4-mut-bf21` | failure | R-BF-21 grep failed |

**Developer runs re-read (dispatch):**

| Run | SHA | Result |
|---|---|---|
| `36305482242` | `d74c0e5` | success — 1493 passed (merge tip) |
| `36292685700` | `856d413` | success (r4 green before R-BF-21 amendment) |
| `36292493433` | `6e21800` | failure (r4 red first) |
| `36294196644` | `7bd47f4` | success (R-BF-21 green) |
| `36294232450` | `2a30b19` | failure (R-BF-21 mutant) |

## What could not be verified

- **The real built session-end hook** in install (iii) was not re-run on this machine; QA 145's H rows on r3 are
  accepted as regression, and r4 does not change `resolveHookProjectDir` beyond `isStateRecord`.
- **`/start` CLI output** (`ob_start` greeting text) was not re-run; `sessionStart`'s `stateJson` results are reported
  above.
- **This machine is not the QA PC** named in earlier reports (`DESKTOP-0GV3HAD`); results are from `DESKTOP-O4EGB1E`.
- **Defender exclusions** for `C:\qa-tmp` were not confirmed.

## Defects

None found in round 4 or the reconciliation merge.

## Disagreements

None.

## Error entries

- First mutant pass accidentally committed `*.qa161bak` files; branches were reset to `d74c0e5`, patches reapplied, and
  recommitted without backups.
- `qa/bootstrap-fix-r4-qa-tests` initially included `qa145-bootstrap-r3.test.ts`, which would fail CI (N1/N2); the
  commit was amended to evidence-only so tcm stays green. QA 145 rows were run locally from blob `7ef880e`.

## Open for the planner

1. **QA 145 N1/N2 on r4:** the unmodified `qa145-bootstrap-r3.test.ts` rows fail because R-BF-19 changed nested `Next:`.
   Recommend treating `bootstrap-fix-r4.test.ts` install N as the authoritative row going forward, or amending N1/N2 on a
   qa branch if CI must carry them.
2. **`/start` non-object fallback:** unchanged from QA 145's Open 1; still a separate task.
3. **`sync` auto-fix on a non-literal root** (QA 145 Open 2, second narrowing): still not ruled; not retested here.

QA-161: REPORT COMPLETE
