# Loop 15 slice three — QA report 1: the `G-045` candidate `9ed674c`

**By:** Probe (QA seat; record session **79**; greeting counter showed #6, not used per `T-164`) ·
**Date:** 2026-09-22/23 (UTC) · **Model:** Opus 5.5 (`claude-opus-5-5[1m]`). The criteria at
`17c9056` were written on Opus 5, and this scoring runs on 5.5 (dispatch-2 §1). Acceptance rests on the separation
between seats, not on the model, but the change is recorded here.
**Criteria:** `docs/loops/loop-15-slice-3-qa-criteria.md` at `17c9056`, which was written before any
candidate existed and not amended since.
**Candidate:** `9ed674c8dac8aa96502c2960b693b75ea6e3afac` (parent `17c9056`). **Scored at:**
`57590081` (`loop/15-slice-3` fast-forwarded to it, per dispatch-2 §2). The candidate's scope is
brief §2 only (`G-045`), and rows A4–A7 are not in it.
**Required reading done before any action** (dispatch-2 §0): PRD.md, README.md, and the Step-Back.
The vault copy of the Step-Back carries Parts 1–3 only; Parts 4–5 were read from the artifact.

---

## Verdict

**`9ed674c` is ACCEPTED on its §2 scope (`G-045`).** A1 and A2 pass, with evidence independent
of the developer's. **Four items are open, and none of them is a candidate defect:**

1. **A8's CI half is UNMET.** No CI run exists for `9ed674c` or `5759008`, because CI triggers on
   `pull_request` and `master` push and no PR carries this branch. That is **pre-registration, not
   a pass.** The local full suite passed.
2. **A1's temporal order is ATTRIBUTED, not verified.** I reproduced the red at the parent, and it
   is recorded at a SHA preceding the repair. Git cannot show that the observation came before the
   repair was *written*. See A1.
3. **A3 is scored at close-out**, not at this candidate.
4. **A4a, A4b, A5, A6 and A7 are NOT EVALUATED**: brief §3 items 2–4 are not in this candidate.
   **A4b unmet is not scored as A4a met** (R4).

---

## 1. Frozen-candidate conditions, reported separately

| Condition | Observation | Result |
|---|---|---|
| **tree moved** | HEAD `5759008`; `git diff --quiet 9ed674c HEAD -- open-brain/` exits **0**. The **control** `git diff --quiet 17c9056 HEAD -- open-brain/` exits **1**, so the instrument can see a difference. `9ed674c..5759008` touches one file, `docs/loops/loop-15-slice-3-developer-handoff.md`. | not moved (source) |
| **tree dirty** | `git status --porcelain` = 0 entries: before the build, after the build, after the suite, after `/sync`, and after every probe (all probe repos are scratch dirs outside the tree) | clean |

**Method for reading tracked files by ref** (it replaces dispatch-2's "PowerShell for `ref:path`"):
compare blob hashes, `MSYS_NO_PATHCONV=1 git rev-parse <ref>:<path>` against `git hash-object
<file>`, with a known-different pair as the control. PowerShell 5.1's `git show ref:path | Out-File`
decodes git's UTF-8 as ANSI, which turned every em-dash into `â€”` and produced **36 false
differing lines** on a byte-identical PRD.md (blob `0f29e98b` both sides; control `runtime.ts`
`8ca77bc` vs `13a861c`). Reported to the planner, who put it in dispatch-2 §4.

## 2. Rows

### A1 — `G-045` seen red first: **PASS, with the temporal order ATTRIBUTED**

**Independent probe, not the developer's `D4`.** `scratchpad/probe.mts` is one script. It imports the
runtime and the test fixture from a `git archive` of a named SHA, so **the same code** runs against
the parent `17c9056` and the candidate `9ed674c`. Every observable is read by **one git helper
(`spawnSync`, exit code captured)**, used identically for the negative and the positive control (R1).

| # | Condition (criteria A1) | `17c9056` NEG: dev runs `update-ref -d refs/heads/main` | `17c9056` **POS control**: dev runs `update-ref refs/anything HEAD` |
|---|---|---|---|
| 1 | no `LoopResult` | **none**: `runLoop` threw `GitFailed: git rev-parse HEAD failed …` | `failed / stage-changed-ref` |
| 2 | no `FAILED.md` | **false** | **true** (same `existsSync` expression) |
| 3 | HEAD unresolvable | **`rev-parse --verify -q HEAD` non-zero**; `symbolic-ref HEAD` = `refs/heads/main` | resolves |
| 4 | `main` gone | **`rev-parse --verify -q refs/heads/main` non-zero** | **present**, equal to its window value |
| 5 | tree staged | **4 staged** (`README.md`, `D_t.json`, `D_t.md`, `G_plan.json`), plus 1 untracked | 0 staged |

All five conditions are asserted positively. The two absence conditions (2 and 4) are shown capable of
reading presence **in the same row, by the same expression**, and the control's values *differ* across
the transition. R1 is met.

The red is not one-shot. At `17c9056` it reproduces for **seven** deletion variants: developer
stage; QA stage; planner stage; delete-then-throw; detach-then-delete; repoint-HEAD-then-delete;
delete-main-and-a-tag. All seven threw `GitFailed` with no `LoopResult`.

**The temporal order is attributed, and here is why.** The criteria require the red to be
"recorded at a SHA that precedes the repair commit." Two records exist:

- `17c9056` (criteria lines 14–20) records the planner's report that A1 was red in the developer's
  tree. It precedes `9ed674c`, and it is **ATTRIBUTED** there.
- `5759008` carries the developer's own five-observable table and live stack, and it is committed
  **after** the repair.

**What this seat verified:** the red **reproduces** at the parent, by an independent instrument.
**What no seat can verify from git:** that the observation came before the repair was written,
because there is no commit between `17c9056` and `9ed674c`. That is a property of making the repair a
single commit, and it is reported rather than scored against the candidate.

### A2 — the repair restores before anything reads the repository: **PASS**

**At `9ed674c`, the same probe finds all ten scenarios usable without a human:**

| Scenario (candidate) | `LoopResult` | `FAILED.md` | HEAD | `main` | `main` = window value | staged |
|---|---|---|---|---|---|---|
| dev deletes main (NEG) | `failed / stage-changed-ref` | true | resolves, names `main` | present | **true** | 0 |
| dev creates `refs/anything` (POS) | `failed / stage-changed-ref` | true | resolves | present | true | 0 |
| dev moves main backwards (D2 shape) | `failed / stage-committed` | true | resolves | present | true | 0 |
| qa deletes main | `failed / stage-changed-ref` | true | resolves | present | true | 0 |
| planner deletes main | `failed / stage-changed-ref` | true | resolves | present | true | 0 |
| dev deletes main, then throws | `failed / stage-changed-ref` | true | resolves | present | true | 0 |
| dev detaches HEAD, then deletes main | `failed / stage-changed-ref` | true | resolves, names `main` | present | true | 0 |
| dev repoints HEAD to `side`, then deletes main | `failed / stage-changed-ref` | true | resolves, names `main` | present | true | 0 |
| dev deletes main **and** tag `loop-001-base` | `failed / stage-changed-ref` | true | resolves | present | true | 0 |
| clean loop | `completed` | false | resolves | present | n/a | 0 |

"`main` = window value" compares `main` after the loop with the value the role itself read
immediately before its sabotage, which is the snapshot's `before`. `reason` contains no "recover by
hand" / "could not be" in any row.

**The QA and planner deletion rows leave one untracked runtime artefact.** QA leaves
`G_done.json`; planner leaves `artifacts/`. **The discriminating control shows this is not the
candidate's doing:** the same stage refusing `refs/anything` leaves the identical entry at both the
parent and the candidate.

**Ordering, from the code path (`runtime.ts:619–623, 663–666, 679–682`), not from the probe going
green.** `closeRefWindow` runs `compare()` → `restoreHead()` → `restoreDeletedDeferred()`. Only
after it returns does `enforceAllowlist` make its first `rev-parse HEAD`. The order is the same on
the normal path and on the role-threw path.

**R2 whitelist.** Between the fault and the completed restore, the only repository operations are:
- `compare()`: `for-each-ref` (`allRefs`) and `symbolic-ref HEAD` (`symbolicHeadRef`);
- `restoreHead()`: one `symbolic-ref` read, plus a `symbolic-ref` write only when the name changed;
- `restoreDeletedDeferred()`: one `update-ref`.

All of these are the watch's own ref plumbing, and **none resolves HEAD to an object.** No path read,
index read or `rev-parse` sits between the fault and the restore.

**Stated limit.** With `refWatch: false` there is no early restore. That path is closed to G-045
only because `runLoop` refuses foreign roles when the watch is off (`runtime.ts:242–257`), and stub
roles do not delete refs. **A future model-backed role must run with the watch on**, or this repair
does not apply to it.

**Mutants.** All three are type-clean; `tsc --noEmit` exit 0 on each. The **type-check control** is
a planted `TS2322`, which exited 2, so the checker can fail. Each mutant was run against the
candidate's own `refwatch-stage.test.ts` and against my probe:

| Mutant | Edit (asserted to land exactly once) | Candidate's rows | Independent probe |
|---|---|---|---|
| M1 | drop the early restore (pre-repair ordering) | **1 red**: D4 | NEG → **no `LoopResult`, `GitFailed`**; G-045 returns |
| M2 | widen to any deferred delta (the planner's un-narrowed ruling) | **4 red**: D2 and 3 others | D2 shape → **`completed`, no FAILED.md**: a backwards move reported as nothing |
| M3 | keep the restore, drop the deletion from `ok` (ordering fix alone) | **1 red**: D4 | NEG → **`completed`**: a deleted checked-out branch reported CLEAN |
| (candidate) | none | **19/19, exit 0** | as tabulated above |

**M2 and M3 confirm the developer's two load-bearing claims independently:**
- **M2:** the narrowing to `deleted` is what keeps D2 audible.
- **M3:** the ordering fix alone converts a crash into a silent pass.

### A3 — channel denominator: **scored at close-out; nothing at this candidate generalises**

The candidate's own texts keep G-045 to one case: the developer handoff §6, and the watch's `LIMIT`
string ("not the index, reflogs, hooks, config or submodules"). The close-out owes the table, with
each channel written out:

| Channel | Status as of this report |
|---|---|
| index | unprobed |
| hooks | unprobed by QA. The developer reports an observation of code execution via planted hooks (PR #98 rulings-1 §"The measurement comes first"), **not reproduced by this seat** |
| config | unprobed by QA. Same developer observation (program-valued config key), **not reproduced** |
| submodules | unprobed |
| reflog | unprobed |

### A4a, A4b, A5, A6, A7: **NOT EVALUATED — not in this candidate**

This candidate implements brief §2 only (handoff header: "Nothing in §3 … was started"). **A4b is not
met, and a correctly refused stub role is not reported as A4b** (R4). A7's binding clause (the CI
run id postdates F11's commit) has no F11 commit to bind yet.

### A8 — suite and CI: **suite PASS; CI UNMET (pre-registration)**

**Full suite, at `5759008`, `open-brain/` identical to `9ed674c`:**
- **`SUITE_EXIT=0`**, captured from `npx vitest run` directly with output to a file and no pipe.
- `Test Files 71 passed (71)`, `Tests 1034 passed (1034)`.
- **No `Errors` line, and no `Timeout calling "onTaskUpdate"` anywhere in the log.**
- Duration 106.70s; wall clock `2026-09-22T23:56:42Z` → `23:58:36Z`.

**Build first:** `npm run build` exit 0, stamped `5759008`, `restoreDeletedDeferred` present in
`build/harness/{refwatch,runtime}.js`.

**Peers, recorded beside the result (T-168).** `ListAgents` limits apply: registration lags, and
non-Claude load is invisible.

| When | sia-planner-ff | sia-forge-8c |
|---|---|---|
| before the start notice | idle | **busy** |
| immediately before the run (after the notices) | busy | busy |
| after the run | busy | busy |

**Forge's own account**, which is testimony and not my measurement:
- "busy" was design-document writing and model turns.
- A 10-command scratch git probe ran from `23:53:58Z` to `23:54:09Z`. The end was bounded by the
  newest file mtime (`TZ=UTC`), which bounds the last write, not the last process exit.
- The run started 2m33s after that end.
- Until my END notice Forge ran only file reads and one markdown commit.

**The planner's account:** it was holding builds and heavy commands.

**Compared with the baseline at `eb14d09`** (criteria §7: RED, `SUITE_EXIT=1`, 1030/1031, two
`G-042` heartbeat errors plus one 5s timeout, with peers demonstrably active): **this run, with peers
asserted quiet, is green at 1034 tests.** That is one observation in the direction §5.4 and §9.8
predicted. It does not rule on G-042.

**CI.** `gh run list` shows **no run for `9ed674c` or `5759008`**. `ci.yml` runs on `pull_request`,
`master` push and `workflow_dispatch`, and no PR carries `loop/15-slice-3` or the candidate branch.
**No CI run id exists to cite.** This is pre-registration and is not read as a pass. Nothing is
pushed or dispatched from this seat, so A8 closes when the planner opens the PR and a run id exists.

### A9 — fixture shape: **PASS as stated**

There is no ranking fixture, so there are **no decoys, and decoy lengths are N/A**. The fixture is the
harness's own `makeRepo` scratch repository: one initial commit, stub planner/developer/QA, and
`exitingChecks(0, 0)`. It can bias in two directions:
- **Flattering:** the sabotage runs *after* a stub's deterministic work, so the index holds only
  what stubs stage. A real role's larger or partial index is not exercised, and that is the index
  channel, unprobed (A3).
- **Unflattering:** none identified. Every scenario deletes a ref unconditionally.

**The developer's `D4` is also measured.** It captures `preLoop` and asserts only that it looks like
a sha (`expect(preLoop).toMatch(/^[0-9a-f]{40}$/)`), which is vacuous. `D4` never asserts `main`'s
**value** after the restore, only its presence. My probe asserts the value (`main` = window value,
true in all nine scenarios). The gap has low consequence: `rollBack`'s `reset --hard stageBase`
would also correct a wrong early value. It is a finding, not a row failure.

## 3. D-031 — the version bump

- **The candidate carries no version bump.** `git diff 17c9056 9ed674c -- package.json
  open-brain/package.json CHANGELOG.md` is 0 lines.
- **PR #98 (D-031) touches no source or test.** Its files are `.agents/state.json`, the four views,
  `docs/loops/loop-15-slice-3-dispatch-2.md` and `docs/loops/loop-15-slice-3-rulings-1.md`. It merged
  as `30d0560` during this scoring, per `/sync`'s live `ci-status`.
- **The release commit does not exist yet.** I will confirm it touches no source or test when it does.

## 4. `/sync` in this tree, at `5759008`

**`SYNC_EXIT=0`: 26 passed, 4 warnings, 0 issues, 0 skipped.**
- `build-freshness` passes against `5759008`.
- `gitnexus-index` **warns: 10 commits behind** (indexed `af90fce`). No row in this report used
  GitNexus.
- `prd-version`: PRD.md not found. This tree predates PRD tracking, so it is expected here.
- The remaining two warnings are pre-existing: one unindexed vault note; `specs/` absent.

## 5. Findings that fail no row

1. **`restoreDeletedDeferred`'s comment is false: a compare-and-swap IS available.**
   - The code (`refwatch.ts:362–364`) says "No compare-and-swap: the ref does not exist, so there is
     no old value to swap against."
   - Measured here: `git update-ref <ref> <sha> 0000…0000` **succeeds (exit 0) when the ref is
     absent and refuses (exit 128) when it is present.** The zero oid *is* the CAS for "must not
     exist."
   - As written, the early restore is an unconditional write. A concurrent writer that recreated
     the ref between `compare()` and the restore would be overwritten silently. That contradicts the
     module's stated fail-closed direction for concurrent writers (`refwatch.ts` header) and
     `restore()`'s own docstring ("Every restore is a compare-and-swap").
   - `restore()` has the same gap for any deleted delta (`setRefTo(…, d.after)` with `after =
     null`), and it predates this candidate.
   - **Fix-shape caution:** if the early restore uses the zero-oid CAS, the second write in
     `rollBack → restore()` must not. After the early restore the ref exists, so a zero-oid CAS
     there would fail. Low likelihood; reported so it is not rediscovered.
2. **The recall trigger injected entry 299 five times this session, each after a Bash call with a
   `$?` / `PIPESTATUS` read and a trimmer.** Every time, the exit code had already been captured
   correctly, unpiped or via `PIPESTATUS`. PostToolUse delivers the reminder **after** the act it
   warns about, so it cannot change the call that triggered it, only a later one. Ratings: neutral
   ×5. This is data for the standing open question "does a seat apply what the trigger surfaces," and
   it is out of this loop's scope (brief §5).
3. **`T-166` (the GitNexus `impact` miss) is the developer's finding and was not re-verified here.**
   This tree's index is 10 commits behind.

## 6. Reproduction

Scripts are scratchpad-only and not tracked. The shapes are here so they can be rerun:

- **Probe:** `git archive <sha> open-brain/src open-brain/tests/harness/fixture.ts …` into a scratch
  dir, with a `node_modules` junction to the QA tree. Then `TREE=<dir>/open-brain npx tsx probe.mts`.
  - Each scenario wraps one stub role so that, after the stub's work, it reads `refs/heads/main` and
    runs the sabotage git commands.
  - Each scenario then records: threw / `LoopResult` status and code / `FAILED.md` / HEAD resolves
    / `symbolic-ref` / `main` present / `main` = window value / staged count / porcelain /
    "recover by hand" in the reason.
- **Mutants:** copy the archived candidate `src`. Replace exactly one string, assert one match, and
  read the file back to confirm the edit. Then `tsc --noEmit`, the candidate's
  `refwatch-stage.test.ts` in that tree, and the probe.

**Nothing is pushed from this seat.** This report is a commit on `loop/15-slice-3` on top of
`5759008`, and the planner pushes by the SHA this seat reports.
