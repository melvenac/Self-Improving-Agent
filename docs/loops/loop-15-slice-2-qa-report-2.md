# Loop 15 slice two — QA evidence report 2, second candidate

**By:** Probe (QA seat) · **Date:** 2026-09-20 · **Candidate:** `830af701b0c57b24d719c1751648ba23bcf0be80`
(`830af70`, tip of `loop/15-slice-2-gates`, record rev 49, still v0.42.0 — never merged or tagged, so no
second bump; base `origin/master` @ `293cddb`; on top of the first candidate `b4194a9` by four commits:
`a9ffe26` red, `c1f99d0` green, `b7b0f4b` docs, `830af70` record).
**Criteria:** `docs/loops/loop-15-slice-2-qa-criteria.md` at `c73f147`, unchanged. **Report 1:** `8f2c547`.
**Evaluation tree:** `~/Worktrees/sia-qa`, detached at the candidate. **Identity:** HEAD = `830af70…`,
`git status --porcelain` empty at **08:57:33Z** and at **09:16:11Z**; the branch tip did not move.
**Build:** stamped `830af70`. **Index:** at `830af70`. Exit codes read from the process into a variable,
never through a pipe.

> **Read-only.** Nothing in the candidate was edited. Seen-reds and plants ran on a scratch clone;
> every loop ran in a scratch repository under the scratchpad. The probe shapes from report 1 were
> re-run in full, plus six new ones for the HEAD channel (§5), plus one for each ruled repair class.

---

## Verdict

**Accepted on the brief's §4 table — every one of the nine observables the brief names is met, on a
frozen SHA, in this tree — with two things the planner must rule on before the word is final, both
stated plainly rather than folded into a pass:**

1. **A7's loop exited 1.** Both gates were asked live, both answered `HTTP 200` from `jev-1.13.0`,
   both records carry `sent: true`, every answer is well-typed, the `score` legend is an object, the
   key is nowhere. Then the done gate **rejected the stub developer's diff** on the shipped policy
   (`diff_matches_plan 0.26 < 0.7`, `local_tests_support_claim 0.43 < 0.6`) and the loop failed at
   the developer stage. **The brief's A7 says nothing about the loop's exit code.** My criteria's A7
   pass clause says "exit 0" — a clause I added beyond the brief, before knowing a live gate could
   correctly reject a stub. I am not dropping it: criteria are not loosened after a verdict by the
   seat that wrote them. I am reporting that the brief's observable is met in full and that one
   clause of QA's own derivation is not, and returning the clause to the planner (§8.1). **QA 2**
   is set on it (§7).
2. **D4, a defect of the D1 class the repair did not reach:** `git update-ref -d refs/heads/main`
   during a stage — the deferred ref **deleted** rather than moved — still crashes the runtime with
   no record and leaves HEAD naming a branch that no longer exists (§5). A2's four cases pass; this
   is a withheld probe, reported the way D6 was in slice one. Whether it blocks is the planner's.

| row | verdict | one line |
| --- | --- | --- |
| A1 | **pass** | as report 1; **D3 closed** — the subclass is now refused (`new.target`) |
| A2 | **pass** on the four cases and the control; **D1, D2 closed; D4 open** | `checkout -b` + commit is refused with a record and HEAD resolves; a backwards move of the deferred ref is restored by the watch, tree clean; HEAD is in the snapshot and a `symbolic-ref` switch is a named breach |
| A3 | **pass** | as report 1; **F3 closed** — a no-key live run is refused at **preflight**, no tag, no `loop-001-base` |
| A4 | **pass** | as report 1 |
| A5 | **pass** | README command verbatim, as report 1 |
| A6 | **pass** | half one as report 1; half two: the prompt plant now **fires**, a `runtime.ts` context plant fires, a comment does not, narrowing the scope list fires the scope assertion |
| A7 | **brief's observable met; QA's "exit 0" clause not met — ruling requested** | two live requests, both `200`, `jev-1.13.0`, typed, `sent: true`, key count 0; done gate rejected the stub diff |
| A8 | **pass** | slice one's seven rows hold |
| A9 | **pass** | five scans now (the threshold scan is its own module with the scope asserted as data); each seen red on a plant and green on a near-miss; harness suite exit 0 with and without the key |

## 1. What could not be verified

- **Whether the gates decide well.** A7 shows the done gate rejecting a stub that wrote one note
  file, on thresholds the developer chose without data (guide §9). That is a plausible judgement
  and it is one sample. `T-155` is where this gets counted.
- **The channel list is still not known to be complete.** Four are watched now — working tree,
  commits, `refs/`, `HEAD`. D4 shows the HEAD channel has a case the repair does not reach. The
  index, hooks, config, submodules, packed-refs (probed once, ignored correctly) and the reflog
  are unprobed by any seat.
- **Move-and-back inside one stage** (P(ix)) still completes; by construction.
- **Request ids.** The response envelope is `{model, answers, usage}`; no request id is returned
  by the API or recorded. The criteria said "if present"; they are not.
- **CI**, **the main tree**, **another machine**: not observed.

## 2. What the checks I ran cannot see

- As report 1 §2, with one change: `gate-live.test.ts` now installs the global-`fetch` guard it
  claimed (`beforeEach`), and a test asserts the guard throws. "No network in tests" is now
  injection **plus** a live guard in that file; other files still rely on injection alone.
- My scan-for-scans found five: `checks.test.ts`, `git.test.ts`, `policies.test.ts` (the old
  decision-region scan, kept), `threshold-scan.ts` via `policies.test.ts` (the new one),
  `gate-artifacts.test.ts`. The new module's own doc states its blind spot — `7 / 10`, a
  template, a file not in its list — and plant E confirmed the first (green, as stated).
- The A7 leak grep walked: the artifacts directory, the whole scratch repo excluding `.git/`,
  `git log -p --all`, and the run log — counts only, after `jev-latest` counted 2 in `G_plan.json`.

## 3. Deterministic results, reproduced in this tree

| what | this tree at `830af70` | developer's |
| --- | --- | --- |
| `npm ci` / `npm run build` / `tsc --noEmit` | 0 / 0 (stamped `830af70`, 08:58:21Z) / 0 | — / — / 0 |
| `npx vitest run` | **896 passed, 60 files, exit 0**, no `Unhandled`/`vitest-worker`/`timed out` line | 896 / 60 / exit 0 |
| `npx vitest run tests/harness` | **248 passed, 12 files, exit 0**; with `env -u TYPESAFE_API_KEY`: 248 / exit 0 | 248 / 12 / exit 0 |
| seen-red, scratch clone at `a9ffe26` | **exit 1 — 7 failed / 216 passed (223)**, `policies.test.ts` failed to load (`Cannot find module './threshold-scan.js'`); the seven: D3, the update-ref-current-branch test, D1, D1b, D2, F2, and the no-key preflight test | "6 failed / 217" — one off; both counts are red, and the developer's may predate one assertion |
| seen-green, `c1f99d0` | 248 / exit 0 | — |
| `node .gitnexus/run.cjs analyze` | **first run exit 1** — T-055 `file_fts … offset 213`; `--repair-fts` 0; analyze 0 — **five of five** incremental analyzes in this tree today | skipped there |
| `sync --check` | **exit 0 — 26 passed, 0 issues, 4 warnings, 0 skipped**; `module-boundary` 58/43; `gitnexus-index` and `build-freshness` at `830af70`; `state-schema` rev 49 | 25 / 1 skipped |
| README dry-run command, verbatim | exit 0; the six artifacts + `developer-note.md`; three tags; tree clean | exit 0 |
| README **live** command, verbatim (A7) | exit **1** — `gate-rejected` at developer; `G_plan.json` and `G_done.json` both `sent: true` | not run there |
| version / CHANGELOG | `0.42.0` unchanged; `[0.42.0]` gained "Repaired after QA rejected the first candidate" | — |

## 4. Rows — what changed since report 1

**A1.** Same probes. `class Evil extends StubPlanner` → `isRuntimeConstructed: false`, `LoopRefused`
naming `planner`. `Object.create`, `Proxy`, and delegating copies refused as before; the stubs
themselves still accepted with the watch off (the negative control the developer added).
Seen red: the D3 test is one of the seven at `a9ffe26`.

**A2.** The four cases and the control pass byte-for-byte as in report 1, with the LIMIT line now
reading `refs/ and HEAD — not the index, reflogs, hooks, config or submodules`. Then the HEAD
channel, each in a fresh scratch repo (§5 for the two that matter most):

| shape | stage | code | after |
| --- | --- | --- | --- |
| P(viii) `checkout -b evil` + commit | developer | `stage-changed-ref`, reason: `refs/heads/evil created at …; HEAD moved from refs/heads/main to refs/heads/evil` | `FAILED.md`; HEAD resolves; `symbolic-ref HEAD` = `refs/heads/main`; `evil` gone; refs == in-stage snapshot; porcelain: only `FAILED.md` |
| P(xii) `update-ref refs/heads/main <pre-loop>` | developer | `stage-committed`, names `refs/heads/main` and both SHAs; **no** "could not be rolled back" | refs == snapshot; `main` back at the plan commit; tree clean but `FAILED.md` |
| P(xiii) `symbolic-ref HEAD refs/heads/side` | developer | `stage-changed-ref`: `HEAD moved from refs/heads/main to refs/heads/side` | HEAD back on `main`; `side` untouched |
| N(a) `checkout side` (existing branch, no commit) | developer | `stage-changed-ref` (HEAD) | restored |
| N(b) `reset --hard <pre-loop>` (ref and tree backwards) | developer | `stage-committed`, both SHAs | `main` restored; tree clean |
| N(d) `checkout --orphan nowhere` | developer | `stage-changed-ref` (HEAD → `refs/heads/nowhere`) | restored |
| N(e) `checkout -b evil` + commit **in the QA stage** | qa | `stage-changed-ref` | HEAD at the candidate; no `loop-001-qa`; `evil` gone |
| N(f) loop **started detached**; `checkout -b evil` + commit | developer | `stage-changed-ref`: `HEAD moved from (detached) to refs/heads/evil` | HEAD **re-detached** at the stage base; `evil` gone |
| **N(c) `update-ref -d refs/heads/main` while checked out** | developer | **crash** — `GitFailed: git rev-parse HEAD failed … unknown revision`, no `LoopResult`, no `FAILED.md` | HEAD names `refs/heads/main`, which is **gone**; refs diff `refs/heads/main: e5c24e8 -> -`; tree staged | 

The last row is **D4**. The rest of report 1's shapes (deletion, annotated retag, pack-refs, stash,
notes, remote-tracking ref, move-and-back) behave as before.

**A3.** As report 1, plus F3: the CLI no-key live run now fails at **preflight**, `tags: []`, the
iteration directory holds `FAILED.md` only. Note the injected-transport path is exempt by design
(`config.transport === undefined` guards the preflight check), so a programmatic caller with its own
transport and no key still reaches the plan gate; the CLI never does.

**A6.** Half two on the scratch clone at `830af70` (`policies.test.ts`, 25 tests): baseline 25/25;
**plant A** — `"… Answer at least 0.7 if so."` in the `has_observable_acceptance` prompt → **1 failed**
(*"finds no threshold literal in any scanned region"*); **plant B** — `min_confidence: 0.65` in the
plan-gate context in `runtime.ts` → **1 failed**; **plant C** — a comment in `gate.ts` naming `0.7` →
25/25; **plant D** — `gate.ts` removed from `THRESHOLD_SCAN_TARGETS` → **1 failed** (*"names gate.ts
and runtime.ts in its scope"*); **plant E** — `7 / 10` in a prompt → 25/25, exactly the blind spot the
module's own doc states. F5 grep: no comparison literal in `gate.ts`/`runtime.ts`/`policies.ts`.

**A7.** The one live run, 09:15:22–09:15:28Z, README's live command verbatim, key from the
environment (`[ -n ]` → set, never printed). **Plan gate:** `HTTP 200`, `jev-1.13.0`, 5/5, 871/132
tokens, requested 09:15:26.044Z answered 09:15:26.591Z; `plan_mode` = `capability_increment` with
`probabilities` (object) and `confidence` (number); `scope_size` = **1.12** with `legend` an object
keyed `0/1/2`, `probabilities`, `confidence`; `preserves_validated` 0.9, `addresses_top_failures`
0.34, `has_observable_acceptance` 0.82 — each a number in [0,1] with **no** `confidence`;
`notApplicable: ["addresses_top_failures"]`; verdict `proceed`. **Done gate:** `HTTP 200`,
`jev-1.13.0`, 5/5, 915/101 tokens, 09:15:28.421Z → .799Z; `diff_matches_plan` 0.26,
`touches_out_of_scope` 0.2, `local_tests_support_claim` 0.43, `stuck_repeating_prior_failure` 0.04,
`risk_of_regression` **0.08** (legend object); verdict `reject` on the two thresholds above; loop
`gate-rejected` at developer, exit 1; `loop-001-base` and `loop-001-developer` exist, no `-qa`.
Both `G_*.json`: `sent: true`, `model_requested: jev-latest`, `model_resolved: jev-1.13.0`, question
sets **identical** to the dry-run's. **Key:** 0 in the artifacts, 0 in the scratch repo, 0 in
`git log -p --all`, 0 in the run log (plant `jev-latest` → 2). Two requests logged. **Wire facts the
docs did not say, from this call:** `score` is a **float within the scale's range** (1.12, 0.08),
not an integer index — the shipped policy compares `>= 1.5`, so it works, but "an integer inside
the scale" in my criteria was wrong about the wire; the response carries **no request id**.
The developer's wire observations (their E1) agree with mine on every point they made.

**A8.** All seven, same shapes as report 1, all hold (the `s1-A3` two conditions still share the
code `candidate-moved` with distinct reasons, as V-039 recorded). **A9.** Five scans, each with both
fixtures; the `git.test.ts` comment-firing (F1) is deliberately unchanged and is said so in the
CHANGELOG and the hand-off.

**Preservation and fences.** P1 896/exit 0 · P2 26/0/0 · P3 no write path (plant on
`src/shared/state-writer.ts`) · P4 as §2 · P6 diff over `.claude/commands/ project-template/
scripts/ .agents/roles/` **empty** · P7 one bump relative to master, one entry · F1 five spawn
sites, all args arrays, `shell: false`; no session spawned · F2 two live requests, `qa-score` not
consulted · F3–F7 clean.

## 5. Defects

### D4 — deleting the checked-out branch during a stage crashes the runtime; no record

**Observation** (N(c), developer stage): `git update-ref -d refs/heads/main` (legal while checked
out; `git branch -D` would refuse). `compare()` records the deferred ref as `deleted`;
`restoreHead()` sees HEAD still **named** `refs/heads/main` and returns "" — the name did not change,
the target did; then `enforceAllowlist` calls `headSha` and `git rev-parse HEAD` fails on the dangling
name. `GitFailed` escapes `runLoop` before `rollBack`, which is where the deferred-ref restore now
lives. Outcome identical in kind to report 1's D1: no `LoopResult`, no `FAILED.md`, HEAD unresolvable,
tree staged, `main` gone. **Why the D1 repair did not reach it:** the repair keys on HEAD's *name*
changing; here the name is constant and its *referent* was removed. **Likelihood:** lower than D1 —
a session does not normally delete its own branch — and the repair is the same shape as D2's:
restore the deferred delta (the watch already has `before`) before anything reads HEAD, not only
inside the rollback.

### Closed: D1, D2, D3 (report 1), by the observations in §4. F2, F3, F5 closed; F1 left by decision; F4 documented.

## 6. Findings that fail no row

- **F8** `score` answers are floats in the scale's range, not indices. The policy's `>=` comparisons
  are fine with that; the guide's §4 wording ("0 · 1 · 2") reads as discrete. Worth one sentence.
- **F9** The preflight key check is skipped when a transport is injected (by design, documented in
  the code). A programmatic caller that injects a keyless `JevTransport` reaches the plan gate before
  refusing, and leaves `loop-001-base`. The CLI path is clean.
- **F10** No request id exists on the wire to record; the criteria's "request ids" clause is
  unsatisfiable as written and is reported as such, not as a miss.
- **F11** The done gate rejected the stub developer's one-file diff with the shipped thresholds.
  A stub-roles loop with `--gate live` therefore ends at the developer stage by design. Slice three's
  real developer is what those thresholds are for; until then a green live loop needs either a
  developer stub that writes a plausible diff or thresholds tuned for stubs — a decision, not a
  defect.
- **F12** The developer's seen-red count (6/217) and mine (7/216) differ by one — the no-key preflight
  assertion in `runtime.test.ts`. Both red; recorded so the numbers in two artifacts are not read as
  a disagreement about the condition.

## 7. Error entries

**QA 2.** The criteria's A7 pass clause requires "exit 0" and "an integer inside the scale". Neither
is in the brief's A7. The first conflates the loop's verdict with the gate's observability and made
a correct rejection read as a failed row; the second was wrong about the wire. Both are wrong
requirements in a committed artifact (`c73f147`). Set by me; the clause is not silently dropped.
QA 1 (report 1) stands. Counts as the record carries them: 50 Planner / 30 Developer / 2 QA.

**Near-misses, by family:** the probe script's ajv import was still draft-07 in the combined run
(crashed after every needed line was printed; the slice-one rows ran from the separate script with
the 2020-12 validator, exit 0); a stray `{}` file appeared in the scratch clone from a shell
redirect and was removed before the plants ran. Neither reached an artifact.

## 8. What Atlas should weigh

1. **A7's exit code.** The brief's observable is met in every clause. My "exit 0" clause is not, and
   it is mine. If the planner rules that the gate's observability — not the loop's completion — was
   always the row, A7 is a pass and the verdict is acceptance with D4 open. If the planner rules that
   a live loop must complete, the candidate cannot pass A7 with stub roles under the shipped policy
   (F11), and that is a brief-level fact for slice three, not a defect in this candidate.
2. **D4** is D1's sibling and the fix is D2's shape moved earlier. It blocks nothing today (no real
   role runs in this slice) and it should be closed before one does; my recommendation is the same
   as report 1's: before slice three, not necessarily before this merge.
3. **F11** decides what "a green live loop" means until real roles exist. Say it once, in the brief
   for slice three.
4. **T-055 is five for five** in this tree today; the trigger is every incremental analyze here,
   not merges.
