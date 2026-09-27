# Loop 15 slice three — QA calibration report A12: candidate `7200e1c` (Composer arm, record 168)

**By:** the QA seat, record session **168**, hub **`cursor-qa2-composer`** · **Date:** 2026-09-27 (UTC).
**Where:** Aaron's desktop, worktree `~/Worktrees/sia-qa-composer`, interactive (not driver-launched).
**Model:** Composer 2.5 (as Cursor shows this session).

**Dispatch read:** `docs/loops/cal-a12-dispatch-qa.md` (the user named `cal2-a12-dispatch-qa.md`; that path does not exist in this worktree — only `cal-a12-dispatch-qa.md` at `c917c4b`). This session follows that file, adapted for record 168 and hub `cursor-qa2-composer`.

**Accidental exposure:** `grep` over the worktree returned one line from `docs/loops/loop-15-slice-3-dispatch-qa-a12.md` (forbidden). That line was not opened or read; it is discounted below.

---

## What I read

| File / ref | Purpose |
|---|---|
| `docs/loops/cal-a12-dispatch-qa.md` | Dispatch |
| `docs/loops/loop-15-slice-3-rulings-20.md` | Scoring rubric (R90–R94, R85 re-search) |
| `a69f07d:docs/loops/loop-15-slice-3-a12-developer-handoff.md` | Developer handoff (product `7200e1c`) |
| `7200e1c` product tree: `open-brain/src/harness/configwatch.ts`, `open-brain/tests/harness/configwatch-a12.test.ts` | Candidate diff and A12 rows |
| `origin/qa/loop-15-slice-3-a11-report` `cc4b185`: `docs/loops/loop-15-slice-3-qa-report-a11.md` | QA 130 report (allowed) |
| `5564ef6:open-brain/tests/harness/qa130-a11-probe.test.ts` | QA 130 probe rows (cherry-picked onto probe branch) |
| `origin/qa/loop-15-slice-3-a11-fix-q130` `0cb509f` diff vs `7200e1c` | R90 known negative (read, not copied) |
| `afe1c3b..7200e1c` diff, merge commit `afe1c3b`, `7200e1c:.github/workflows/ci.yml` | R94 verification |
| Developer CI logs: `36283323236` (red), `36283457438` (green) | Corroboration only |
| Scratch worktree `../sia-qa-composer-cand` at `7200e1c` | R85 independent trace |

**Not read (forbidden):** QA 149 report/branches, `loop-15-slice-3-rulings-21.md`, `loop-15-slice-3-dispatch-qa-a12.md` (except the accidental grep line), A13 material, `planner-session-146-notes.md`, the GPT calibration seat.

---

## Verdict: REJECT — one QA 130 regression (R77.4) on an otherwise clean A12

Every **R90–R94** ruling passes on tcm. The **R85 re-search** in the handoff matches my independent trace of `configwatch.ts`. **QA 130's R90-class texts** are healed (`Q130-R85-REPO-UNREADABLE-ZEROED`, `Q130-R83-DOTGIT-NOSEARCH`'s `config.worktree` row). **All seven A12 developer rows pass.** **Five own mutants kill** their target rows on tcm.

**Rejection:** `Q130-R83-SUBDIR-NOSEARCH-PLANT` regresses **R77.4** — **6 git calls after the developer role** where QA 130 measured **0** at A11 (`36298202084`). The R90 record text is correct (`absent → unobservable (EACCES); … no facts: lstat failed`; `kind: "modified"`, plant still present). The boundary leak is the defect.

---

## Checks

### R90 — pass

| Row | Run | Result |
|---|---|---|
| R90-STATEHASH | `36298202084` | ✓ `unreadable (EACCES); no facts: lstat failed`; no `type file`, no zeroes |
| R90-ABSENT-UNOBSERVABLE | `36298202084` | ✓ not `created`; message `absent → unobservable (EACCES)`; no `config.worktree created` / `a other was created` |
| Q130-R85-REPO-UNREADABLE-ZEROED | `36298202084` | ✓ |
| Q130-R83-DOTGIT-NOSEARCH (`config.worktree`) | `36298202084` | ✓ `(absent → unobservable (EACCES); …)` not `created`; `gitAfterRole: []` |
| **Known negative** `fix-q130` | diff read | Heals `stateHash` text only; **does not** add the `:824` classification branch — would not fix `created` alone |

### R91 — pass

| Row | Run | Result |
|---|---|---|
| R91-VIA-FACTS | `36298202084` | ✓ link `lstat` + `resolves to:` file facts |
| Q130-R85-VIA-FILE000 | `36298202084` | ✓ `after` contains both `ino` values |

### R92 — pass

| Row | Run | Result |
|---|---|---|
| R92-ABSENT-ANCESTOR | `36298202084` | ✓ `link: type symlink … ino …` in `absent →` branch |
| Q130-R86-ABSENT-ANCESTOR-LINK | `36298202084` | ✓ |

### R93 — pass

| Row | Run | Result |
|---|---|---|
| R93-STAT-FACTS | `36298202084` | ✓ |
| R93-LSTAT-AT-OPEN | `36298202084` | ✓ `config-watch-unestablished`, role did not run |
| R93-PARENT-LINK | `36298202084` | ✓ parent link `lstat` |

### R94 — pass (local)

Merge commit `afe1c3b` ("Merge origin/master into A12 (R94)"). Resolution **both edits**: `test` job keeps `--reporter=verbose`; `test-windows` job retained whole (`7200e1c:.github/workflows/ci.yml`).

### R85 re-search — pass

Independent trace of `configwatch.ts` at `7200e1c` confirms the handoff table (`a69f07d` § "R85 search"): **`stateHash :517`** now prints `unreadable (<code>); no facts: lstat failed` when `readError && dev === null`; **`:824`** routes absent-at-open + failed lstat to `absent → unobservable (<code>)` without `created` or unrestored "a other was created"; **`:894`** omits kind word for `unobservable (` afters; **`unobservableSide :1319`** appends `resolves to:` + `factText` under parent link when `dev` set; **`:1389`** prepends `ancestorLinkText` on the absent→ancestor-link branch. No new side building zeroed facts for failed `lstat` found outside the handoff list.

### QA 130 full row set — **one regression**

Branch `qa/cal-a12-composer-probe` (`c2263aa` = `7200e1c` + probe file). tcm run **`36298202084`**: **1436 passed**, **2 failed** (1443 total; failures: CA-9 + one probe row).

All non-win32 probe rows **pass except one**. CA-9 (`--permission-prompts` missing on tcm) fails as documented T-182 — not scored against A12.

### Own mutants (tcm, 4 branches + 4 runs)

| Branch | Run | Kills |
|---|---|---|
| `qa/cal-a12-composer-m168-r90` | `36297472901` | R90-STATEHASH; Q130-R85-REPO-UNREADABLE-ZEROED |
| `qa/cal-a12-composer-m168-r91` | `36297483759` | R91-VIA-FACTS; Q130-R85-VIA-FILE000 |
| `qa/cal-a12-composer-m168-r92` | `36297502756` | R92-ABSENT-ANCESTOR; Q130-R86-ABSENT-ANCESTOR-LINK |
| `qa/cal-a12-composer-m168-r93` | `36297485242` | R93-STAT-FACTS |

Each mutant run also fails CA-9 (+1). Extra failure count matches the killed row.

**CI runs used:** 6 dispatched (1 cancelled stuck queue `36297441252`, replaced by `36298202084`).

---

## Defects

| ID | Severity | Ruling | Row | Run | Evidence |
|---|---|---|---|---|---|
| **A12-REG-1** | medium | R77.4 (rulings 1–19 reachable) | Q130-R83-SUBDIR-NOSEARCH-PLANT | `36298202084` | Stage fails `stage-changed-config` (correct). Record: `absent → unobservable (EACCES); unreadable (EACCES); no facts: lstat failed`. **`gitAfterRole` = 6** (`git for-each-ref`, `git status`, `git symbolic-ref HEAD`, …). QA 130 at A11 measured **0** git calls for this shape. Likely interaction: R90 `:824` `continue` skips the old `created`/unlink path; restore completes ("Every file was put back…") while the runtime still records post-role git. |

No other defects on R90–R94 wording. A11-4 (directory at `.git/config` → `absent`) unchanged per handoff.

---

## What could not be verified

- No win32 / laptop run (EACCES shapes are Linux-only; tcm only).
- No full local suite (dispatch forbids).
- First probe dispatch (`36297441252`) stuck **queued** ~20 min; cancelled and re-dispatched.
- Developer green `36283457438` did not include the QA 130 probe file (developer noted); used for A12-row corroboration only.

---

## Errors (this seat)

1. **`cal2-a12-dispatch-qa.md` missing** — used `cal-a12-dispatch-qa.md`.
2. **`push-qa.mjs` absent on probe branch** — copied from `c917c4b` to `/tmp/push-qa.mjs`.
3. **Accidental grep line** from forbidden `loop-15-slice-3-dispatch-qa-a12.md` (not read).
4. **Branch name collision** — remote `qa/cal-a12-composer-mut-r90` pre-existed; own mutants prefixed `m168-`.

---

## Model

Composer 2.5 (Cursor session model label).

CAL-168: REPORT COMPLETE
