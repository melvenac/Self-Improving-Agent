# Loop 15 slice three — QA report A13: candidate A13 `4b43410` (handoff `0d44374`): ACCEPTED

**By:** the QA seat, record session **162** · **Date:** 2026-09-27 (UTC).
**Where:** the QA PC **`DESKTOP-0GV3HAD`**, in `C:\Users\Aaron\Worktrees\sia-qa`, launched headless by
`docs/loops/qa-162/drive.ps1` from `docs/loops/qa-queue.ps1`. Nobody watched the run.
**Elevation (QA 138's O-a):** **this process runs elevated.** `whoami /groups` shows
`BUILTIN\Administrators` enabled; .NET `IsInRole(Administrator)` is `True`. **`SeBackupPrivilege` is
Enabled** in `whoami /priv`. Real EACCES shapes on tcm use chmod; win32 uses a wrapped `lstat` in the
mock rows (§2, check 1).

**Dispatch:** `docs/loops/loop-15-slice-3-dispatch-qa-a13.md`. **Rulings:** `docs/loops/loop-15-slice-3-rulings-21.md`
(R95–R97, the re-done R85 search). **Predecessor:** QA 149's report (`origin/qa/loop-15-slice-3-a12-report`
`7133e27`), which rejected A12 on A12-1.

**Candidate (frozen):** product **`4b434101e6e93f0b967ca20effa6a0c8ab96735c`** on
`origin/loop/15-slice-3-candidate-a13`; handoff **`0d44374e7b1bcaa768c92ac21cd5566e743edf4b`** (docs only).
Built on A12 `a69f07d` by Grok 4.7 in Cursor (record 159). Product diff against `a69f07d`: 10 lines in
`configwatch.ts` (R95 unrestored note + R96 `kind: "unobservable"`) and `configwatch-a13.test.ts` (+231).

**Scored on:** win32 (Windows 10 Pro 19045), Node v22, and Linux on tcm (`Machine name: 'tcm'`, runners
`tcm-1`/`tcm-2`): **5 of the 8 allowed runs** (§6). **Temps (T-190):** probes and mutants used
`TEMP`=`TMP`=`C:\qa-tmp`; the one full suite used `%USERPROFILE%\AppData\Local\Temp` (§6.1).

---

## Verdict: ACCEPTED. A12-1 is healed. R95 pushes the true unrestored note and R77 stops before git; R96 stores `kind: "unobservable"`; R97's four developer rows pass on tcm and the mock row passes on win32. QA 149's probe shapes and QA 130's full row set pass on tcm. No regressions in the scored set.

A13 is the minimal fix QA 149's `FIX-q149` pointed at, plus a distinct stored kind. The product does not
remove the planted file; it records what is true and refuses before git. Every protection mutant this seat
applied goes red on the four R97 rows.

---

## 1. Check 1 — A12-1 healed (R95 + R77): **PASS**

QA 149's probe files, byte-exact from `origin/qa/loop-15-slice-3-a12-probe` and `-probe2`, on candidate
`4b43410` via branch `qa/loop-15-slice-3-a13-probe` (`cd3379c`). tcm run **`36306379644`**. win32: local
vitest on the same branch.

| Row | Platform | `gitAfterRole` | Summary | `plantStill` | Result |
|---|---|---|---|---|---|
| Q149-C1-HOOKS-ONLY | tcm | `[]` | `FILE(S) COULD NOT BE PUT BACK` + `Recover by hand`; no `Every file was put back` | true | ✓ |
| Q149-C1-SUBDIR-ONLY | tcm | `[]` | same | true | ✓ |
| Q149-MOCK-HOOKS-ONLY | win32 + tcm | `[]` | same | true | ✓ |
| Q149-MOCK-PLUS-CONFIG | win32 + tcm | `[]` | same; `cfgRestored` true on tcm | true | ✓ |
| Q130-R83-SUBDIR-NOSEARCH-PLANT | tcm (QA 130 probe) | `[]` | same; `kind: "unobservable"` in change record | true | ✓ |

**Measured (tcm, Q149-C1-HOOKS-ONLY log):** `claimsRestore: false`, `gitAfterRoleCount: 0`,
`unrestored` holds `… (absent at the open; cannot be lstat'd at close (EACCES); not removed)`,
`stored.kind: "unobservable"`.

**Measured (win32, Q149-MOCK-HOOKS-ONLY local):** same shape; `lstatHits: 2`, `gitAfterRole: []`.

Contrast row Q149-C1-DOTGIT-CONTRAST still passes: multiple unrestored paths, no false restore claim.

---

## 2. Check 2 — R96, every `ConfigChange.kind` consumer: **PASS (no wrong gate; union widened safely)**

Search at `4b43410` with `rg ConfigChange` and `c.kind` over `open-brain/src` and
`open-brain/tests/harness` (excluding `node_modules`):

| Site | What it does with `ConfigChange.kind` | Acts on stored kind? |
|---|---|---|
| `configwatch.ts:377` | union `"created" \| "deleted" \| "modified" \| "unobservable"` | defines |
| R90 arm `:835` | writes `"unobservable"` | writes |
| general arm `:844` | writes `"created"`, `"deleted"`, or `"modified"` | writes; not reached for R90 |
| message `:894–896` | prints `${c.kind}` only when `after` does **not** start with `unobservable (` | message only; prefix gate, not kind |
| `runtime.ts` | reads `unrestored.length`, `unlisted.length`; never `kind` | no |
| `renderFindings` | serialises `changes` verbatim into findings JSON | stored, not interpreted |
| `configwatch-a12.test.ts` R90-ABSENT-UNOBSERVABLE | asserts `kind` is not `"created"` | assertion |
| `configwatch-a13.test.ts` | asserts `kind === "unobservable"` on the four rows | assertion |

No switch, exhaustive map, count, serializer branch, or restore gate reads `kind === "modified"` vs
`"unobservable"`. `tsc --noEmit` passes with the widened union. **Mutant evidence:** `qa/loop-15-slice-3-a13-mut-r96`
(`5219f9d`, tcm **`36306457143`**) sets `kind` back to `"modified"` while keeping the unrestored line; all four
R97 rows fail on `kind` only (`claimsRestore` false, `gitAfterRole` `[]`, note still present).

---

## 3. Check 3 — R97 rows and protections: **PASS**

Developer rows in `configwatch-a13.test.ts` at `4b43410`. tcm: all four pass on run **`36306379644`** (same
probe branch). win32: `R97-Q149-MOCK-PLUS-CONFIG` passes locally.

**FIX-q149 inverse (this seat's mutant, not copied):** `qa/loop-15-slice-3-a13-mut-r95` (`b19bb3f`) drops only
the `unrestored.push(leftInPlace)` line; `kind` stays `"unobservable"`. tcm **`36306454576`**: all four rows
fail — `claimsRestore: true`, `namesUnrestored: false`, `unrestored: []`, **6 git calls**
(`for-each-ref`, `symbolic-ref HEAD` ×3, `rev-parse HEAD`, `status`, `symbolic-ref HEAD`). Matches developer
mutant `loop/15-slice-3-a13-mut-r95` run **`36294505899`**.

**Note-text mutant (this seat):** `qa/loop-15-slice-3-a13-mut-r97-note` (`c05b8fc`) changes `not removed` →
`was removed`. tcm **`36306455809`**: all four rows fail on `namesUnrestored: false` while `plantStill: true`
and `gitAfterRole: []` — the stop still fires, but the summary no longer carries the scored substring.

Developer red/green on tcm (read from handoff, confirmed by this seat's green probe run):
- Red `f712955` run **`36294235947`**: four R97 rows fail (A12 behaviour).
- Green `4b43410` run **`36294470032`**: four rows pass; suite 1426 passed (+4 vs red), 1 failed (CA-9).

---

## 4. Check 4 — the note is true: **PASS**

The R90 arm (`b === null && a.readError && a.dev === null`) `continue`s after recording; it does not call
`unlinkSync` / `removeLink`. Every scored row shows `plantStill: true` when the note ends `not removed`.

The note is emitted only from `leftInPlace` in that arm (`configwatch.ts:831–839`). Paths that were removed
or successfully restored use other `unrestored` templates (`a ${cur.kind} was created`, `read back … expected`,
`the link is still there`, etc.) — none use the R90 absent-at-open wording. Q149-MOCK-PRESENT-CONTROL (present
at open, unreadable at close) stays on the `modified`/restore path, not the R90 absent branch.

---

## 5. Check 5 — re-done R85 search: **PASS (matches handoff)**

Independent read of `configwatch.ts` at `4b43410` against the handoff table (`docs/loops/loop-15-slice-3-a13-developer-handoff.md`,
§R85 search). **Only the R90 arm (`:829–839`) pushes the absent-at-open / failed-close-lstat path onto
`unrestored`.** All other named sites (`stateHash`, message builder, `factText`, `linkSide`, `ancestorLinkText`,
`unobservableSide`, `currentSide`, `baseText`, `stageBefore`, created-other note, `absent →`, type-change) build
text only; they do not add this path to `unrestored`. `observe` fills snaps only. No disagreement with the
handoff column.

---

## 6. Check 6 — regressions (QA 130 full set + QA 149 rows): **PASS on tcm**

Branch `qa/loop-15-slice-3-a13-probe` (`cd3379c`) carries byte-exact:
- `qa149-a12-probe.test.ts` and `qa149-a12-mock.test.ts` from QA 149 probe branches;
- `qa130-a11-probe.test.ts` from `origin/qa/loop-15-slice-3-a11-probe`.

tcm **`36306379644`**: **1447 passed, 1 failed, 5 skipped (1453)**. The sole failure is **CA-9**
(`--permission-prompts`); T-182, not this candidate. All QA 149 rows (3 chmod + 3 mock) and all **15**
`qa130-a11-probe` rows are ✓ in the log. No scored regression.

### 6.1 Full suite, default TEMP (local)

One run at product `4b43410` with `TEMP`=`TMP`=`C:\Users\Aaron\AppData\Local\Temp`:
**1352 passed, 2 failed, 78 skipped (1432)**. The two failures are `tree-currency.test.ts` timeouts
(5000 ms); flaky/environmental on this machine, not in the scored harness rows. Developer tcm green
**`36294470032`** reports **1426 passed, 1 failed (CA-9), 5 skipped** — consistent with scored harness health.

`git merge-tree` against `origin/master` at `4b43410`: **clean** (tree `f4719339d0ad44c80da1f307b8b03355d51ba357`).

---

## 7. Check 7 — this seat's mutants (≥1 per ruling): **PASS**

| Ruling | Branch | SHA | tcm run | What changed | Killed |
|---|---|---|---|---|
| R95 | `qa/loop-15-slice-3-a13-mut-r95` | `b19bb3f` | `36306454576` | drop `unrestored.push` | all 4 R97 rows |
| R96 | `qa/loop-15-slice-3-a13-mut-r96` | `5219f9d` | `36306457143` | `kind: "modified"` | all 4 R97 rows |
| R97 | `qa/loop-15-slice-3-a13-mut-r97-note` | `c05b8fc` | `36306455809` | `was removed` note | all 4 R97 rows |

Each mutant also fails CA-9 on tcm (same as every run in this slice). Developer mutants on
`loop/15-slice-3-a13-mut-r95` / `-r96` (`36294505899`, `36294528231`) agree.

---

## 6 (authority). CI on this seat's branches

| Run | Branch | Head | Result | Scored tests |
|---|---|---|---|---|
| `36306379644` | `qa/loop-15-slice-3-a13-probe` | `cd3379c` | 1447 pass, **CA-9 fail** | all probes ✓ |
| `36306454576` | `qa/loop-15-slice-3-a13-mut-r95` | `b19bb3f` | 4 R97 fail + CA-9 | mutants kill |
| `36306457143` | `qa/loop-15-slice-3-a13-mut-r96` | `5219f9d` | 4 R97 fail + CA-9 | mutants kill |
| `36306455809` | `qa/loop-15-slice-3-a13-mut-r97-note` | `c05b8fc` | 4 R97 fail + CA-9 | mutants kill |

**5 of 8** dispatches used. No `windows=true` CI. Pushed only through `node docs/loops/qa-162/push-qa.mjs`.

Reference (developer, not re-dispatched): green **`36294470032`** at `4b43410`; red **`36294235947`** at `f712955`.

---

## 7. Defects

None in the scored set.

---

## 8. Disagreements

None with the handoff on R85 sites or R96 consumers. O-1 (`baseText` / EACCES base) remains out of scope per
rulings 21.

---

## 9. Error entries

None.

---

## 10. Reproduction

```text
# Probe + regressions (tcm)
gh workflow run ci.yml --ref qa/loop-15-slice-3-a13-probe -f hosted=false
# run 36306379644

# Mutants (tcm)
gh workflow run ci.yml --ref qa/loop-15-slice-3-a13-mut-r95 -f hosted=false
gh workflow run ci.yml --ref qa/loop-15-slice-3-a13-mut-r96 -f hosted=false
gh workflow run ci.yml --ref qa/loop-15-slice-3-a13-mut-r97-note -f hosted=false

# win32 mock rows (local, TEMP=C:\qa-tmp)
cd open-brain && npx vitest run tests/harness/qa149-a12-mock.test.ts tests/harness/configwatch-a13.test.ts

# Full suite, default TEMP
cd open-brain && set TEMP=%USERPROFILE%\AppData\Local\Temp && npx vitest run
```

Branches pushed: `qa/loop-15-slice-3-a13-probe`, `-mut-r95`, `-mut-r96`, `-mut-r97-note`, `-report`.

---

## 11. Open for the planner

- **CA-9** still fails on every tcm run (T-182); do not read it as a candidate defect.
- **Local full suite** had two `tree-currency` timeouts on this PC; tcm probe run at 1447 passed is the
  authoritative regression read for suite health.
- **R96** is durable-record hygiene only today; no runtime gate depends on `"unobservable"` yet. Worth keeping
  for findings JSON accuracy.

---

QA-162: REPORT COMPLETE
