# Candidate C r4 (T-155, the shadow merge gate): QA 232 report

**Seat:** QA, record session 232. Claude Code on Opus (`claude-opus-5-5`), headless, on the laptop `DESKTOP-0GV3HAD`,
under D-068. **Dispatch:** `docs/loops/qa-232-c-r4-dispatch.md`, which also points at `qa-229-c-r4-dispatch.md` and
`qa-222-225-common.md`. All three were read at the dispatch commit **`c2a5eaa15c7e64f4e1c3e325197e86f98f346c79`**
(`origin/master` at start; the working copy `C:/qa-scratch/qa232-wt` was at that SHA).

## Verdict

**ACCEPT.** The candidate is code `c33942725c73b1aa91ceb46458e6ea7d11c70dcd` (branch tip `0dc20ff` adds only the
handoff docs). It closes the five rows the planner overruled QA 213 on (CC-1, CC-2, CC-5, CC-13, CC-17), and every row
QA 213 scored `met` is still met.

- **Red-first holds.** CC-1.2 and CC-13.2 are true reds at the base: 2 rows and 6 rows fail there. The other four
  rows' reds are mutants, and each of those mutants dies.
- **QA 213's survivor `fd6c310` now dies.** The row that kills it is named in the Mutants section.
- **CC-13.2 behaves as rev 167 ruled** in all four planted cases, plus two extra ones.
- **Nothing outside r4's six rows changed.**
- **The full suite on tcm has one failure**, a test that reads the moving `origin/master`. It fails the same way at
  the base, so no failure is new.

Three minor findings follow. None blocks.

- **Criteria:** `docs/loops/loop-15-slice-3-c-criteria.md`, identical at `origin/master` and `23ebd86` (`git diff`
  is empty). §8 and §9 override §1.
- **Base:** `5f7c9a03dc9bf979aa28bfc27f701de0523f04e6` (r3).
- **Red:** `d1e973962798810790434e7b9baf8941bc200cde`.

## Acceptance rows

| Row | Status | Evidence |
|---|---|---|
| CC-0 | met | The r4 diff `5f7c9a0..c339427` is 10 files: `policies.ts`, `policies/merge.json`, `schemas/policy-merge.schema.json`, `shadow-merge.ts`, `tests/harness/shadow-merge.test.ts` and five fixtures under `tests/harness/fixtures/shadow-merge/`. `schema.ts`, `declared.ts`, `runtime.ts`, `cli.ts` and `src/pipelines/` are unchanged (`git diff --stat` is empty). The test diff removes 4 lines: one import line widened, and three policy literals widened with `required_inputs`. No test is deleted and no `.skip`, `.todo`, `skipIf` or `runIf` is added. Tests passed on tcm: 1853 at the candidate, 1838 at the base. **Scope:** every hunk maps to CC-1.2 or CC-13.2 (product) or to a test or fixture for the six rows. Nothing else changed. |
| CC-1 | met | **CC-1.2 is now met.** `merge.json` carries `"required_inputs": ["runtime_checks", "E_t.acceptance"]`. `MergePolicySchema` (strict) requires the field and refines it to contain both names. The derived `policy-merge.schema.json` lists it under `required`. **The verdict reads the list:** `computeShadowMergeVerdict` calls `missingRequiredInput(ev, input.policy.required_inputs)`, and `prepareShadowVerdict` passes `loadMergePolicy()` when no policy is given (`shadow-merge.ts:220`). **CC-0.1 still holds:** `schema.ts` is untouched, per the placement the planner accepted at rev 171. True red at `d1e9739`: both CC-1.2 rows fail. `cc12a` fails the CC-1.2 loader row **by name**, and `cc12b` fails the CC-1.2 verdict row. CC-1.1 and CC-1.3 are as QA 213 scored them; the policy drift test in `policies.test.ts` passes. |
| CC-2 | met | **CC-2.2 is now met.** `fixtures/shadow-merge/would-merge.json`, `would-not-merge.json` and `undefined.json` exist. `it.each` names each fixture file in its title and asserts both the outcome and a reason. `cc22` kills `undefined.json`, and `cc17` kills `would-merge.json`. |
| CC-3 | met | Unchanged. The rows pass on the candidate: 69/69 focused locally, 1853 passed on tcm. |
| CC-4 | met | Unchanged. All five cause rows pass. |
| CC-5 | met | **CC-5.6 is now met.** `skipped-required-live-gate.json` has `require_done_gate: true`, `gateMode: "skip"` and no record. It returns `undefined`, and the reason says `skip`. The paired `live` case returns `undefined` with "required and missing" and no `skip`. `cc56` kills only that row. 5.1 to 5.5 are unchanged. |
| CC-6 | met | Unchanged. The rows pass. |
| CC-7 | met | Unchanged. The row passes. |
| CC-8 | met | Unchanged. The rows pass. |
| CC-9 | met | Unchanged. The row passes. In the probe, the `decide --merged` lines carry every required field. |
| CC-10 | met | Unchanged. The rows pass. |
| CC-11 | met | Unchanged. The rows pass. |
| CC-12 | met | Unchanged. The row passes. |
| CC-13 | met | **CC-13.1:** a new row isolates a present, non-empty, **incorrect** `line_hash` and asserts that it is the only problem reported. `fd6c310` and `cc131` now die on it. **CC-13.2** is scored under the rev 167 rule. The check walks `docs/loops/shadow-merge/<loop>/<sha>/` and `artifacts/iterations/<loop>/<sha>/`. The early return on an absent ledger is gone, and the output prints the count, the pending SHAs and the LIMIT. The planted cases below behave as ruled. True red at `d1e9739`: 6 CC-13.2 rows fail. `cc132` kills 5 rows, and QA mutants `noledger` and `iterroot` die. QA mutant `loopkey` **survives**; this is a coverage finding, and it is minor. |
| CC-14 | met | Unchanged. The CC-5.1 pending row passes, and `cc22` kills it. |
| CC-15 | met | Unchanged. The row passes. |
| CC-16 | met | Unchanged. The rows pass. |
| CC-17 | met | **Now met.** `all-attributed.json` has three in-scope rows, all `order: "attributed"`, and green checks. It returns `would-merge` with three `(attributed)` reasons, and removing one row does not change the outcome. `cc17` kills it. |
| CC-18 | met | Unchanged. The rows pass. The new input check turns an empty `acceptance[]` into `undefined`, which matches CC-18's "at least one row". |
| CC-19 | met | Unchanged. r4 does not touch `runtime.ts` or `cli.ts`. |
| CC-20 | met | Unchanged. `harness help` lists `shadow-verdict prepare`, `decide` and `summary`, and the usage rows pass. |
| CC-21 | cut | §8 P2 cut this row and declared it out of scope. Not scored. |
| CC-22 | met | Local `npm run build` exited 0 (`build stamped c339427`), and `tsc --noEmit` exited 0. The candidate's tcm run has **one failure**, `state-schema` T-171 r3b. That test reads the moving `origin/master`, and it fails the same way at the base. **No failure is new.** At `9823d774` (`c339427` plus one test-only commit to that test, outside C's paths) the suite is fully green. See CI. The strict reading of "CI at the candidate's SHA is green" is in Open for the planner. |
| CC-29 | met | Unchanged. The probe prepared into `docs/loops/shadow-merge/<loop>/<sha>/`. |
| CC-30 | met | Unchanged. The row passes. |

### Declared rows (reported, not scored)

- **Unrunnable:** CC-23 (live prepare, merge, decide), CC-24 (what production disagreements prove), CC-25 (recovering
  history).
- **Out of scope:** CC-26 (D-032 docs-only merges), CC-27 (the alternate harness), CC-28 (Jev calibration), CC-21
  (backfill, cut).

### The planner's rulings

1. **CC-1.2 placement.** The policy list is read in `shadow-merge.ts` (`missingRequiredInput`), and `EvidenceSchema`
   is not changed, so CC-0 is still met. There is one limit: an `E_t` whose shape passes `validateEvidence` still
   needs `runtime_checks` there. The list is load-bearing because a name added to it, such as `E_t.requirements`,
   forces `undefined` when that input is absent, and the CC-1.2 verdict row asserts exactly that.
2. **CC-13.2, planted.** Each case ran in a fresh scratch git repo under `C:/qa-tmp`. It was built with the candidate
   build's `harness shadow-verdict prepare`/`decide`, and checked with its exported `checkShadowMergeLedger`
   (`docs/loops/qa-232/c-r4-mutants/probe-cc132.mjs` and `probe-cc132b.mjs`). Every message ends with
   `LIMIT: does not prove a merge was gated or re-derive verdicts; ancestry is read against this tree's HEAD, so a
   stale tree under-reports owed decides.`

   | Case | Severity | What it prints (before the LIMIT) |
   |---|---|---|
   | matched: artifact for HEAD plus its `decide --merged` line | pass | `ledger parses (1 lines); 1 verdict artifact(s) walked, 0 pending decide.` |
   | unmatched-merged: the ledger holds a line for another artifact; this artifact's candidate is HEAD | **issue** | `verdict artifact …\15-qa232\8896384…\shadow_merge.json: no ledger line, and 8896384… is already an ancestor of HEAD (decide is owed). 2 verdict artifact(s) walked, 0 pending decide.` |
   | unmatched-pending: a real side-branch commit `e435bea…`, not merged, no ledger | pass | `ledger parses (0 lines); 1 verdict artifact(s) walked, 1 pending decide (15-side/e435bea9d919a8aaada4e451ed521206c7889261).` |
   | the same artifact after `git merge --no-ff loop/side` | **issue** | `… e435bea… is already an ancestor of HEAD (decide is owed). 1 verdict artifact(s) walked, 0 pending decide.` |
   | unmatched-pending, the ledger present, and a candidate SHA absent from the repo (`b`×40) | pass | `ledger parses (1 lines); 2 verdict artifact(s) walked, 1 pending decide (15-pending/bbbb…).` |
   | no ledger, artifact present, candidate merged (HEAD) | **issue** | `… c320d74… is already an ancestor of HEAD (decide is owed). 1 verdict artifact(s) walked, 0 pending decide.` |
   | no ledger, runtime layout `artifacts/iterations/t001/<sha>/`, candidate merged | **issue** | `…\artifacts\iterations\t001\af0d753…\shadow_merge.json: no ledger line … (decide is owed). 1 verdict artifact(s) walked, 0 pending decide.` |
   | the same SHA in loops `15-a` and `15-b`; only `15-a` is decided | **issue** | `…\15-b\e6d49fb…\shadow_merge.json: no ledger line … (decide is owed). 2 verdict artifact(s) walked, 0 pending decide.` |
   | a hand-planted artifact in a non-SHA directory `15-x/HEAD/` | **issue** | `…\15-x\HEAD\shadow_merge.json: no ledger line, and HEAD is already an ancestor of HEAD (decide is owed).` (see D-3) |
   | this repository, `sync --check` (below) | pass | `ledger absent and 0 verdict artifacts walked — first use, nothing to check.` |

3. **Red-first.** Running `shadow-merge.test.ts` and `policies.test.ts` at `d1e9739` (the base product plus the new
   tests and fixtures) gives **8 failed | 61 passed (69)**. The eight failures are exactly the two CC-1.2 rows and
   the six CC-13.2 rows, and the CC-13.2 failures show the old messages, for example `expected 'ledger absent —
   first use, nothing to…' to contain '0 verdict artifacts walked'`. The CC-2.2, CC-5.6, CC-13.1 and CC-17 rows
   pass at the base, so their reds are the mutants. **The handoff's red table is true.**
4. **CC-13.1.** `fd6c310` (its own parent is `20c2dfd`) was re-applied to `c339427`. `tsc` exited 0, and vitest
   gave 1 failed | 68 passed. The failing row is **`record 217 r4 > CC-13.1 a present, non-empty, INCORRECT line_hash
   is the only problem reported`**.

## Mutants (local, per T-207)

**Method.** Each mutant's diff (its tip against its parent, limited to `open-brain/src` and `open-brain/tests`) was
re-applied with `git apply --3way` to `c339427` in `C:/qa-scratch/qa232-mut`. The edit was confirmed to have landed
with `git diff --stat`. Then `node node_modules/typescript/bin/tsc --noEmit` ran, followed by vitest on
`tests/harness/shadow-merge.test.ts` and `tests/harness/policies.test.ts`. Script:
`docs/loops/qa-232/c-r4-mutants/mutants.mjs`. Every mutant typechecked (`tsc 0`), so none is invalid.

| Mutant | Tip | Edit | vitest | Rows that fail | Result |
|---|---|---|---|---|---|
| cc12a | `a181331` | `merge.json` drops `runtime_checks` | 16 failed / 53 passed | **`CC-1.2 merge.json names runtime_checks and E_t.acceptance, the loader refuses a copy that drops one, …`**, plus 15 prepare-based rows | killed (by name) |
| cc12b | `1fcc296` | hardcoded list restored | 1 / 68 | `CC-1.2 the verdict reads required_inputs from the policy: …` | killed |
| cc22 | `7b23f66` | pending becomes would-not-merge | 2 / 67 | `CC-5.1 pending is undefined…`; `CC-2.2 fixtures/shadow-merge/undefined.json …` | killed |
| cc56 | `4b52266` | skip mode treated as not required | 1 / 68 | `CC-5.6 fixtures/shadow-merge/skipped-required-live-gate.json …` | killed |
| cc131 | `088f438` | hash comparison forced to accept | 1 / 68 | `CC-13.1 a present, non-empty, INCORRECT line_hash …` | killed |
| cc132 | `b8cb2fe` | enumeration skipped | 5 / 64 | five CC-13.2 rows | killed |
| cc17 | `e06c212` | attributed rows block | 7 / 62 | CC-17, CC-2.2 would-merge, CC-3, CC-15, CC-9, CC-10, and the CC-1.2 verdict row | killed |
| fd6c310 (QA 213) | `fd6c310` | hash comparison forced to accept | 1 / 68 | `CC-13.1 a present, non-empty, INCORRECT line_hash …` | **killed (was a survivor)** |
| QA `emptyarray` | `2b54741` | an empty required array counts as supplied | 1 / 68 | `CC-1.2 the verdict reads required_inputs …` | killed |
| QA `noledger` | `6cb7294` | an owed decide is only an issue once a ledger exists | 1 / 68 | `CC-13.2 … an artifact whose candidate is an ancestor of HEAD and has NO ledger line is an issue, with the ledger absent` | killed |
| QA `iterroot` | `05728c1` | `artifacts/iterations` is not walked | 4 / 65 | four CC-13.2 rows | killed |
| QA `loopkey` | `72de853` | ledger match keys on `candidate_sha` only and ignores `loop` | 0 / 69 | none | **survives** |

**The handoff's mutant table is true.** In particular, cc12a's 16 failures are "the loader row plus 15 others".

**`loopkey` survives the focused files**, and no other test file names `checkShadowMergeLedger` or
`shadow-merge-ledger` (grep over `open-brain/tests`), so it would survive the full suite. That survival is derived
from the grep, not from a full-suite run. The product is right: the planted "same SHA in two loops" case reports loop
B's artifact as owed. **Only the assertion is missing** (D-1).

**Record.** `qa/c-r4-mut-loopkey` (`72de853bc213d87655e8c74fd7e4c4cbd9cc280e`) and `qa/c-r4-mut-iterroot`
(`05728c11dbb9bd0438e5631aba95fd54215445dc`) are pushed. `emptyarray` (`2b547414`) and `noledger` (`6cb72948`) stay
local, and their diffs are committed at `docs/loops/qa-232/c-r4-mutants/*.diff`. They were not pushed because
`ci.yml` at the dispatch commit still runs CI on every `qa/**` push (T-207 has not landed there). Pushing all four
would have taken this QA past six runs. No CI run appeared for either pushed mutant ref: `gh run list --branch` is
empty for both, checked after the push.

## CI (tcm)

These runs were started by the first QA 232 attempt (08:27Z) and read here, not re-pushed. No run used
`windows=true`, and every `test-windows` job is `skipped`.

| Branch | Run | headSha | Run conclusion | `test` job | Counts |
|---|---|---|---|---|---|
| `qa/c-r4-ci-candidate` | 36690140665 | `c33942725c73b1aa91ceb46458e6ea7d11c70dcd` | failure | **failure** | Files 1 failed, 131 passed (132). Tests 1 failed, 1853 passed, 6 skipped (1860). |
| `qa/c-r4-ci-base` | 36690144823 | `5f7c9a03dc9bf979aa28bfc27f701de0523f04e6` | failure | **failure** | Files 1 failed, 131 passed (132). Tests 1 failed, 1838 passed, 6 skipped (1845). |
| `qa/c-r4-ci-testfix` | 36691109295 | `9823d774e10ac3aa0d043a9b889b840d3da7625c` | success | **success** | Files 132 passed. Tests 1854 passed, 6 skipped (1860). |

- **The failure at both SHAs** is `tests/shared/state-schema.test.ts > T-171 r3b: origin/master's real state.json
  parses, and a missing note_by is null`, with the same assertion at both: `expected true to be false` at
  `state-schema.test.ts:248:75`. The test pins that `origin/master`'s `tasks[0]` has no `note_by` key, and the live
  record now has one. **No failure is new.**
- **`9823d774`** is `c339427` plus one commit, `fix: state-schema r3b must not assume live tasks[0] lacks note_by`.
  It touches only `open-brain/tests/shared/state-schema.test.ts` and was authored `Co-authored-by: Cursor`. It shows
  the candidate's suite is otherwise fully green. **It is not a candidate change.**
- **The three failures the developer reported locally:**
  - `qa104` EPERM: not seen on tcm at either SHA. On this laptop symlinks work, and the row passed at both
    `c339427` and `d1e9739`.
  - `state-schema` T-171 r3b: on tcm at both SHAs, as above.
  - `state-import-leftovers` UTF-7 EPERM: **not on tcm at either SHA.** Locally it passed in the candidate's full
    suite, and passed alone at both the candidate and `d1e9739` (22/22 each). I did not reproduce it. The planner's
    derivation stands: r4 touches no state-import path.
- **Local full suite at `c339427`** (`node node_modules/vitest/vitest.mjs run`, `TEMP`/`TMP=C:/qa-tmp`) exited 1:
  - Files 2 failed, 122 passed, 8 skipped (132). Tests 2 failed, 1780 passed, 78 skipped (1860).
  - The two failures are `state-schema` T-171 r3b, as above, and
    `session-start/role-files.test.ts > records HEAD-behind-upstream …`, which timed out at 5000 ms.
  - The run also logged 4 vitest `Timeout calling "onTaskUpdate"` RPC errors.
  - Run alone, `role-files.test.ts` passes at both the candidate (1799 ms) and the base product (1665 ms). The
    timeout is load, not the candidate; r4 does not touch session-start.
- **Run budget:** 3 runs were used, and the 2 mutant pushes started none. Pushing this report makes one more on
  `qa/c-r4-report` (docs only), for 4 in all, under the cap of 6.
- **`sync --check`** is the candidate build's, run in `C:/qa-scratch/qa232-cand` with a scratch `KNOWLEDGE_V2_DB`:
  - Build freshness: `build matches HEAD c339427`.
  - It exited 1 with 28 passed, 2 warnings, 3 issues and 2 skipped. The three issues are `worktree-layout` (this
    laptop's QA scratch worktrees), `retirements` and `greeting-size`. None is in C's paths.
  - The line: `shadow-merge-ledger [pass]: ledger absent and 0 verdict artifacts walked — first use, nothing to check.
    LIMIT: does not prove a merge was gated or re-derive verdicts; ancestry is read against this tree's HEAD, so a
    stale tree under-reports owed decides.`

## Defects

None blocks.

- **D-1 (minor, test coverage, CC-13.2).** No test gives two loops the same candidate SHA with a ledger line for only
  one of them, so QA mutant `loopkey` survives. The product keys on `(loop, candidate_sha)`, which is correct (CC-18:
  "the ledger keys on `loop`").
- **D-2 (minor, wording, CC-13.2).** With the ledger absent and at least one artifact present, the pass message reads
  `ledger parses (0 lines); …`. It never says the ledger is absent. The count and the pending SHAs are printed, so
  this is not silent, but the first clause misdescribes the tree.
- **D-3 (minor, robustness, CC-13.2).** `listVerdictArtifacts` checks that the body's `loop` and `candidate_sha`
  match the directory names, but not that the directory name is a 40-hex SHA. A hand-planted `…/15-x/HEAD/` artifact
  is reported as `HEAD is already an ancestor of HEAD (decide is owed)`. It is still an **issue**, not a pass.
  `prepare` refuses non-40-hex SHAs (CC-6), so only a hand-made file can reach this.
- **Handoff inaccuracy (cosmetic).** The handoff says "nothing pushed", but the seven mutant branches are on
  `origin`. It also cites the diff as `5f7c9a0..c549bc46` with 11 files; `c549bc46` is the first handoff commit, and
  the code diff to `c339427` is 10 files. Neither affects scoring.

## Open for the planner

1. **CC-22's strict wording.** "CI at the candidate's SHA is green" is literally false: run 36690140665 concluded
   `failure`. I scored the row `met` because:
   - the only failure is a test that reads the moving `origin/master`;
   - it fails identically at the base;
   - the same code with only that test fixed is green (36691109295).

   If the planner reads CC-22 strictly, the row is `partial`, and the fix belongs to T-171's test, not to C.
   `state-schema` T-171 r3b will keep failing every QA's base-and-candidate pair until that test stops pinning the
   live `tasks[0]`.
2. **D-1 to D-3** can ride on C's next touch or a follow-up. None changes a verdict.
3. **T-207 is not in `ci.yml` at `c2a5eaa1`.** A push to `qa/c-r4-mut-*` would still start CI under the `qa/**`
   push trigger, which is why only two QA mutants were pushed. (The two pushes started no run; I did not investigate
   why.)
4. **Tooling notes for the headless Claude Code seat.**
   - GitNexus was not used. This QA made no product edits; the mutants are `NOT FOR MERGE` branches.
   - The first QA 232 attempt ended its turn waiting on a background suite and produced no report. This attempt ran
     everything in the foreground.

## Evidence file

`docs/loops/loop-15-slice-3-c-r4-qa-report.E_t.json`:
- one `acceptance[]` row per CC-0 to CC-22 (CC-21 `not_evaluated`, cut), plus CC-29 and CC-30;
- `order` on every `met` row;
- `runtime_checks` from the local build and tcm run 36690140665;
- `candidate_git.sha` = `c33942725c73b1aa91ceb46458e6ea7d11c70dcd`.

From `C:/qa-scratch/qa232-cand/open-brain` (the candidate build),
`node build/harness/cli.js validate evidence <file>` exited **0**. As a sanity check, a malformed file exited 1 with
eight field errors.

## Model

Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code, headless (`claude -p`), QA seat, record 232, on the laptop
`DESKTOP-0GV3HAD` (D-068). Grok built C r1 to r3, and Forge (Claude Code) built r4. The QA seat and the r4 builder
share a model family; say so if that matters for independence.

QA-232: REPORT COMPLETE
