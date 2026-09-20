# Loop 15 slice two — QA evidence report, first candidate

**By:** Probe (QA seat) · **Date:** 2026-09-20 · **Candidate:** `b4194a97070d7cb371894ed62c7876cf33e9a6ac`
(`b4194a9`, tip of `loop/15-slice-2-gates`, record rev 48, v0.42.0, base `origin/master` @ `293cddb`).
**Criteria:** `docs/loops/loop-15-slice-2-qa-criteria.md` at `c73f147`, committed before the candidate existed.
**Evaluation tree:** `~/Worktrees/sia-qa`, detached at the candidate. **Identity:** `git rev-parse HEAD` =
`b4194a9…` and `git status --porcelain` empty at **06:11:29Z** (before the first observation) and at
**06:39:14Z** (after the last); the branch tip did not move in between. **Build:** stamped `b4194a9`.
**Index:** GitNexus at `b4194a9`. Every exit code below was read from the process into a variable or
from `execFileSync`, never from a pipeline's last stage or a line of output.

> **This report does not repair anything.** Nothing in the candidate tree was edited. Every seen-red
> and every plant was made on a scratch clone under the session scratchpad; every loop ran in a
> scratch repository there. Probe shapes withheld from the criteria (§1 "Not shown") are in §5.

---

## Verdict

**Not accepted on the criteria as written and as ruled.** One row fails, one is untested as a
direct consequence of the ruling, seven pass, and three defects of the ref-channel and provenance
class are recorded with the observations that produced them.

| row | verdict | one line |
| --- | --- | --- |
| A1 | **pass** | foreign object refused, thrown, before any git write; seen red at the branch's first commit (3 of 6) |
| A2 | **pass** on the four cases and the control; **D1, D2 open** in the same class | every case names the ref and both SHAs and is restored to the byte; a `checkout -b` + commit **crashes the runtime with no record**, and a backwards move of the deferred ref is **recorded but not restorable** |
| A3 | **pass** | no-key refusal names the variable with zero requests built; a planted key reaches no file, commit, log line or request body; value redaction was **exercised**, not assumed |
| A4 | **pass** | four distinct classes, `422` carries the field, undocumented statuses and bad `200`s are their own outcomes |
| A5 | **pass** | README command verbatim: both records `sent: false`, §4's ids and kinds exactly, exit codes as data, no prompt asks about test results |
| A6 | **FAIL** (second half) | a JSON-only edit flips the decision with no source change (pass); **a `0.7` typed into a `gate.ts` prompt is caught by nothing** — `policies.test.ts` 17/17 and the whole harness suite 234/234 stay green with the plant |
| A7 | **untested** | by ruling (amendment 2, Q3) the live pair runs only on a candidate that passes every other row; A6 failed. No live call was made from this seat. |
| A8 | **pass** | slice one's seven rows re-run and hold |
| A9 | **pass** | every scan enumerated has a planted positive and a planted near-miss; `npx vitest run tests/harness` exit 0 from the process |

**The fail is narrow and the fix is small; the defects are not narrow.** D1 is the same class as
slice one's D1–D3 and D6 — a role reaching the repository through a channel the observer handles
badly — and it is the first one that leaves the target repository needing hand recovery *and*
writes no record. Whether D1/D2 block is the planner's call, as D6 was; my recommendation is in §8.

## 1. What could not be verified

- **A7, the live wire.** Not run, by the ruling. Everything this report says about the wire shape
  is from the developer's accidental call (their E1) and the docs — claims, not observations of
  this seat. The next candidate that passes every other row gets the live pair.
- **That the ref channel is the last one.** The watch covers `refs/`. It states so in every verdict
  line. `HEAD` itself is not under `refs/` and **P(xiii)** shows it is a channel: a `symbolic-ref`
  switch is caught only by the commit boundary's side effect and leaves HEAD on another branch.
  The index, hooks, config, submodules, packed-refs storage (probed once, P(vii), correctly
  ignored) and the reflog remain unprobed.
- **A ref moved and moved back inside one stage** (P(ix)): completes at exit 0. By construction of
  a snapshot-compare; recorded, not a defect.
- **Whether a real session is refused** (slice three). A1 refuses a foreign object; **D3** shows a
  subclass of a stub is not foreign to the mechanism.
- **The main tree.** Not moved, not built. The `PRD.md` issue there is unrun.
- **CI.** Nothing here is evidence about another machine.

## 2. What the checks I ran cannot see

- **My scan for scans is a grep.** I enumerated source-text scans by `readdirSync`/`readFileSync`
  over `src/harness` in `tests/harness/*.test.ts` and by reading every test file's imports:
  `checks.test.ts` (shell spawn), `git.test.ts` (network subcommand), `policies.test.ts`
  (threshold literal), `gate-artifacts.test.ts` (test-result prompt). `schema.test.ts` and
  `policies.test.ts` also compare derived files byte-for-byte; those are parsers, not scans.
- **"No network" is a property of transport injection, not an observation of the network.** The
  suite passes with the key present (882/882, 234/234) and with it stripped (234/234); every
  transport test injects `fetchImpl` and answers in-process. **The header of `gate-live.test.ts`
  claims the global `fetch` is replaced with one that fails the test if touched; no line in that
  file does so** — only `gate.test.ts:43` does, for the dry-run path. Finding F2.
- **The leak grep walks what I named:** every file under the scratch repo excluding `.git/`,
  `git log -p --all`, every log line, every request body. A value reaching a path outside those is
  not seen.
- **The A2 restore check compares `for-each-ref` after the failure to a snapshot taken inside the
  stage, just before the sabotage command.** It proves the refs are byte-identical to what the role
  found; it says nothing about the working tree or the index, which §5 reports separately.

## 3. Deterministic results, reproduced in this tree

| what | this tree at `b4194a9` | developer's (their tree) |
| --- | --- | --- |
| `npm ci` / `npm run build` | exit 0 / exit 0, stamped `b4194a9`, 06:12:06Z | — |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npx vitest run` (full) | **882 passed, 60 files, exit 0**, no `Unhandled`/`vitest-worker`/`timed out` line (grep validated on a plant), 06:12–06:13:59Z | 882 / 60 / exit 0 |
| `npx vitest run tests/harness` | **234 passed, 12 files, exit 0**; again with `env -u TYPESAFE_API_KEY`: 234 / exit 0 | 234 / 12 / exit 0 |
| `node .gitnexus/run.cjs analyze` | **first run exit 1** — T-055's `FTS index 'file_fts' is inconsistent … offset 180`; `analyze --repair-fts` exit 0; analyze exit 0 (2,388 nodes / 4,960 edges / 171 clusters / 149 flows) | skipped (no `.gitnexus/` there) |
| `node open-brain/build/cli.js sync --check` | **exit 0 — 26 passed, 0 issues, 4 warnings, 0 skipped**; `module-boundary` pass 58 files / 43 core; `gitnexus-index` pass at `b4194a9`; `build-freshness` pass at `b4194a9`; `state-schema` rev 48 | 25 passed, 1 skipped (their skip is `gitnexus-index`) |
| README dry-run command, verbatim, scratch repo | **exit 0**; `A_t.gitref D_t.json D_t.md E_t.json G_done.json G_plan.json developer-note.md`; three tags; tree clean | exit 0, six artifacts |
| version | root `package.json` 0.41.0 → 0.42.0, one hunk; CHANGELOG `[0.42.0]` entry present; `open-brain/package.json` stays 0.1.0 as at base | — |

The four `sync` warnings are the base's. **T-055 is now four for four on incremental analyze in this
tree this session** (293cddb clean, 71f9760 clean, 398afc1 failed, b4194a9 failed); carried to the
close-out with the earlier observations.

## 4. Rows — required, observed, verdict

### A1 — pass

**Observed (scratch clone `clone-a1`, `refwatch.test.ts`, node_modules junctioned from this tree):**
at `9cdcc84` (the branch's first commit) **3 of 6 red, exit 1** — *"runLoop returned instead of
throwing"*, *"expected [Function] to throw"* — exactly the developer's count; at `6f3344b` 6/6 exit
0; at `b4194a9` 6/6 exit 0 (06:22:48–06:23:16Z). **White-box:** the refusal is the first statement
in `runLoop`, synchronous, above the first git call; `LoopRefused` carries `code:
"foreign-role-unwatched"` (the 14th `FailureCode`; the union has 18 now) and the seat names;
provenance is a module-private `WeakSet` in `roles.ts` filled only by the stub constructors.
**Black-box (probe, candidate build):** a delegating copy of each stub with `refWatch: false` →
thrown `LoopRefused`, `tags: ""`, no `artifacts/`, HEAD unchanged; the same copies with the watch on
→ completed, exit 0; `Object.create(stub)` and `new Proxy(stub, {})` → refused. **Default:** watch on.
**Blind spot realised as D3:** `class Evil extends StubPlanner { run() {…} }` →
`isRuntimeConstructed(evil) === true`, loop completes with the watch off.

### A2 — pass on the four cases and the control; D1 and D2 recorded

Each case: a stub that does its normal work, snapshots `for-each-ref`, runs the command, returns.
After the loop: status, code, `FAILED.md`, and `for-each-ref` compared to the in-stage snapshot.

| case | stage | code | reason names | refs after == in-stage snapshot |
| --- | --- | --- | --- | --- |
| (i) `tag -f loop-001-developer loop-001-base` | qa | `stage-changed-ref` | `refs/tags/loop-001-developer moved 0684328f821a → 1c8cc8648331` | **yes**; dev tag peels to the candidate |
| (ii) `branch -f side HEAD` | developer | `stage-changed-ref` | `refs/heads/side moved 4b8c0ce5d8ee → b156502dfb4c` | **yes**; `side` back at pre-loop |
| (iii) `update-ref refs/anything <base>` | developer | `stage-changed-ref` | `refs/anything created at bf656a130ee0` — absence before stated as *created* | **yes**; ref gone |
| (iv) `tag loop-001-anything HEAD` | developer | `stage-changed-ref` | `refs/tags/loop-001-anything created at f04c3453c1d9` | **yes**; ref gone |
| (i) again, `tag -f loop-001-base HEAD` | developer | `stage-changed-ref` | base tag moved, both SHAs | **yes** |
| (iv) again, `tag loop-001-zzz` | qa | `stage-changed-ref` | created | **yes** |
| control: clean loop | — | completed, exit 0 | three tags; `loop-001-qa^1` is the candidate | `reset --hard loop-001-base && clean -fdx` → pre-loop sha, clean, `artifacts/` gone |

Every verdict line states its limit (`LIMIT: refs/ only — not the index, reflogs, hooks, config or
submodules; refs/heads/main is left to the commit boundary…`) and its count (`examined N ref(s)`).
Q4's reading holds: a created ref's record says `created at <sha>`, and `(absent)` is the printed
"before". The ruled current-branch case: `update-ref refs/heads/main <pre-loop>` and a role commit
both fail as `stage-committed` **naming `refs/heads/main` and both SHAs** — see D2 for what
follows. The withheld shapes are in §5.

### A3 — pass

**CLI, key stripped explicitly** (`[ -n ]` → set in the parent; `env -u` for the child):
`--gate live` → **exit 1**, `FAILED.md` at stage planner, code `gate-unavailable`, reason names
`TYPESAFE_API_KEY` and ends *"No request was built"*; `G_plan.json` present with `sent: false`,
`answer: null`. **White-box:** `JevTransport.dispatch` reads `this.env[JEV_KEY_VAR]` and throws
`GateUnavailable` before `buildJevRequest`; `JEV_KEY_VAR` is the constant `SECRET_ENV_VARS` lists;
no `.env`, `dotenv`, config key or CLI flag reads it (F4 grep: every hit is the *name*).
**Probe, no key:** `fetchCalled: 0`. **Probe, planted key, fake wire:** 2 requests; the instrument
first — every `Authorization` header carried the plant; then **0** occurrences in request bodies,
in 8 files walked, in `git log -p --all`, in log lines. **Value redaction exercised:** with the
plant inside the plan's `objective`, `G_plan.json`/`G_done.json` carry `[REDACTED]` and not the
value — the first run in this project where the redactor did work (slice one's REDACTED count was
0). **The shipped no-key test** (`gate-live.test.ts:76`) copies `process.env`, deletes the
variable and asserts the strip — run here with the key present: green. `runtime.test.ts:634` does
the same through `LoopConfig.env`. Neither mutates `process.env`.

### A4 — pass

Probe against in-process responses: `401 → auth`, `422 → request-invalid` with `fields:
["body.questions.scope_size.score.criteria"]` and the body's `msg` in `detail`, `429 →
rate-limited` (retryable), `529 → overloaded` (retryable); **four distinct classes**. Beyond the
four: `500`/`503 → unexpected-status`; `200` with no `answers` map and `200` non-JSON →
`malformed-response`; `200` with a partial answer set → an answer whose note says `NOT ANSWERED:
…` and which the policy then rejects on `missing`; `ECONNREFUSED` whose message carried the plant
→ `transport` with `[REDACTED]`. Seen red twice on the scratch clone by the shipped tests' own
fixtures.

### A5 — pass

README command verbatim (`--gate dry-run`; `--dry-run` remains an alias) against a scratch repo
with the scripts: exit 0. `G_plan.json`: `sent: false`, `mode: dry-run`, `model_resolved: null`,
`decision: null`; ids `plan_mode, scope_size, preserves_validated, addresses_top_failures,
has_observable_acceptance`; kinds `choice, score, noul, noul, noul`; `plan_mode.criteria` a **map**
of 4, `scope_size.criteria` an **array** of 3. `G_done.json`: ids `diff_matches_plan,
touches_out_of_scope, local_tests_support_claim, stuck_repeating_prior_failure,
risk_of_regression`; kinds `noul×4, score`; `state.checks.build.exit_code: 0`,
`state.checks.unit.exit_code: 0` with the resolved npm command; prompt regex validated on `"Did
the tests pass?"` → 0 of 5 prompts match. The base's `bounded`/`repairs`/`complete` are gone.
The shipped assertion reads the written file (`gate-artifacts.test.ts:129`) and is structural
first; a `"Did the tests pass?"` prompt planted in `gate.ts` turns it red (plant 6).

### A6 — FAIL on the second half

**Half one, pass.** Probe with a table transport answering `has_observable_acceptance: 0.75`:
shipped `plan-gate.json` (0.7) → completed, `G_plan.json` records `applied.has_observable_
acceptance_min: 0.7`, `verdict: proceed`; **the same run with only the JSON edited to 0.8** →
`gate-rejected`, reason *"has_observable_acceptance 0.75 is below the required 0.8"*, applied 0.8.
No `.ts` changed (`git status --porcelain` on this tree empty at the end). `1.5` → refused at
preflight as `policy-unreadable` (*"Too big: expected number to be <=1"*); unknown key → refused
(*"Unrecognized key"*); `"0.7"` as a string → refused. The shipped test does the flip through
`runLoop` with `policiesDir`, and the derived schema files match zod byte-for-byte.

**Half two, fail.** Required (brief): *a threshold hand-edited into a prompt or string literal is
caught*; ruled: *caught by a check with its own positive and negative fixtures*. The candidate's
check is `policies.test.ts` "T-156 — no threshold hides in the decision code": it scans **the
region of `policies.ts` after the marker `Applying a policy`** and nothing else. Plants on the
scratch clone at `b4194a9`, 06:29–06:31Z: a real `0.7` in `decidePlanGate` → **red** (2 failed);
**`"… Answer at least 0.7 if so."` appended to the `has_observable_acceptance` prompt in `gate.ts`
→ `policies.test.ts` 17/17 green, `npx vitest run tests/harness` 234/234 green, exit 0.** The
prompts — where §4 says thresholds must never live — are outside every scan's scope. Also outside
it: `runtime.ts`, where the gate context is assembled. My F5 grep found no such literal in the
candidate, so the candidate is clean today; the row requires that a hand-edit be *caught*, and
it is not.

### A7 — untested

Ruled: the live pair runs on every candidate that passes every other row; A6 failed. No request
left this seat. The key is present in this seat's environment (`[ -n ]` → set); nothing printed it.

### A8 — pass (seven rows)

| slice-one row | observed at `b4194a9` |
| --- | --- |
| A1 artifacts | dry-run loop exit 0; `D_t.json`, `D_t.md`, `A_t.gitref`, `E_t.json` (+ `G_*`); **independent validator** (ajv draft-2020) accepts `D_t.json` and `E_t.json` against the candidate's schema files; rejects `D_t` with `new_capability` **missing** and `E_t` without `runtime_checks`; `A_t.gitref` carries `sha: <candidate>`, 40 hex. **Limit found:** the derived `plan.schema.json` **accepts** `new_capability: ""` — the non-empty rule is a zod `superRefine` the JSON file cannot carry, and the file's own description says so (*"enforced by the runtime and not by JSON Schema"*). Unchanged since base (`{"type":"string"}` in both); the runtime refuses it (next row). Not a regression; a documented gap between the tracked contract and the code. |
| A2 invalid `D_t` | `new_capability` missing / `""` / `acceptance: []` → each `schema-cap-exhausted`, **attempts 3 = cap**, `FAILED.md` names planner and `**Attempts:** 3`, no `E_t.json`; `repair_targets: []` → **completed**, 1 attempt (amendment 2 of slice one holds) |
| A3 frozen ref | a unit check that commits → `candidate-moved` naming both SHAs; a check that writes a file → `candidate-moved` with *"HEAD is the candidate … but the working tree is dirty in 1 path(s) — dirty.txt"* — the two conditions distinguished in the reason, one code (as V-039 recorded) |
| A4 allowlist | `node:fs` write to `src/backdoor.ts` → `allowlist-violation`, file absent, no developer tag; a commit of only-permitted paths → `stage-committed`, names `refs/heads/main` |
| A5 tags | `loop-001-base/-developer/-qa`; `reset --hard loop-001-base && clean -fdx` → pre-loop sha, clean, `artifacts/` gone |
| A6 dry-run | with `globalThis.fetch` replaced by a thrower and a planted key in env: completed, `fetchTouched: 0`, plant in 0 files, `sent: false`; `gate.test.ts:43` still asserts the exploding transport explodes |
| A7 exit codes | a unit check printing `All 648 tests passed!` and exiting 1 → `checksPassed: false`, loop exit 1, `E_t.runtime_checks.unit.passed: false`, `exit_code: 1`; every spawn in `src/harness` is `spawnSync`/`execFileSync` with an args array and `shell: false` (F1 grep re-validated after my first pattern missed `spawnSync`) |

### A9 — pass

Four scans enumerated (§2). Each asserted on the clone: **checks.test.ts** — `shell: true` on the
real `spawnSync` line (`checks.ts:125`) → red (and nine spawn tests with it, the EINVAL family);
my first plant landed in a doc comment and was correctly ignored. **git.test.ts** — a real
`git(cwd, ["push", …])` → red; the deny-list constant is now asserted both as a positive for the
pattern and as suppressed by the exclusion. **policies.test.ts** — planted literal → red; comment
near-misses asserted. **gate-artifacts.test.ts** — planted question → red; near-miss asserted.
`npx vitest run tests/harness > file; rc=$?` → 0, 234/234, no unhandled-error line. Finding F1:
git.test.ts's scan **fires on a comment** that names the call (plant 3 → red) — the safe
direction, but the prohibition-vs-instance flaw is handled by exclusion of one constant, not by
comment stripping as checks.test.ts does.

### Preservation and fences

P1 882/0/exit 0 · P2 26/0/0 skipped, `module-boundary` pass · P3 no write path to `state.json` or
`.agents/` in the harness (plant re-validated on `src/shared/state-writer.ts`; the criteria named
`src/pipelines/`, which is wrong — QA error entry, §7) · P4 as §2 · P6 `git diff --stat
293cddb..b4194a9 -- .claude/commands/ project-template/ scripts/ .agents/roles/` **empty** · P7 one
bump, one entry · F1 no session spawned; `cli.ts` still passes `stubRoles()` · F2 `qa-score` gate
**not consulted** and the log says so; two records only · F3 no index, no merge point · F4 clean ·
F5 no comparison literal in `gate.ts`/`runtime.ts`/`policies.ts` · F6 nothing outside `open-brain/`,
`docs/`, `README.md`, `CHANGELOG.md`, `package.json` and the developer's own record write (rev 48) ·
F7 no `.py`.

## 5. Defects, each with the observation that produced it

### D1 — a role that checks out a new branch and commits **crashes the runtime**; no record, HEAD left unborn

**Observation** (P(viii), developer stage, 06:32Z): `git checkout -b evil && git add -A && git
commit`. The watch sees `refs/heads/evil` created, `restore()` deletes it — **while HEAD
symbolically points at it** — then `enforceAllowlist` calls `headSha` and `git rev-parse HEAD`
fails: *"fatal: ambiguous argument 'HEAD': unknown revision"*. `GitFailed` propagates out of
`runLoop`: **no `LoopResult`, no `FAILED.md`**, `headResolves: false`, `symbolic-ref HEAD` →
`refs/heads/evil` (absent), `git status -sb` → `## No commits yet on evil`, the whole tree staged.
`refs/heads/main` is intact at the plan commit. Through the CLI this is `main`'s generic catch:
`harness: git rev-parse HEAD failed …`, exit 1. **Class:** the restore is correct for the ref and
wrong for the repository — it puts back a ref without asking what pointed at it. A real developer
session's first act is often `checkout -b`. Recovery is `git symbolic-ref HEAD refs/heads/main`
by hand.

### D2 — a backwards move of the deferred ref is recorded but **not restored**, and the shipped test accepts that

**Observation** (P(xii), developer stage): `git update-ref refs/heads/main <pre-loop>`. Result
`stage-committed`, reason names `refs/heads/main` and both SHAs — and continues *"THE TREE COULD
NOT BE ROLLED BACK: refusing to reset … it is not an ancestor of HEAD … Recover by hand."*
`resetHardTo` refuses because the stage base (the plan commit) is not an ancestor of the moved
HEAD (its parent). After the loop `refs/heads/main` is at the pre-loop commit, the runtime's own
plan commit is reachable from no ref, and the index holds the plan files as staged. **The
ref-watch had `before`/`after` for this ref and a compare-and-swap restore that would have put it
back; the deferral hands the channel to a check that can only roll forward.** The same shape with
`symbolic-ref HEAD refs/heads/side` (P(xiii)): `stage-committed` naming `refs/heads/side`, rollback
refused, **HEAD left on `side`**. `refwatch-stage.test.ts:221` asserts
`/moved HEAD|could not be rolled back/i` — the second alternative is this outcome, so the test
passes on it.

### D3 — provenance by constructor admits a subclass whose `run()` is foreign

**Observation** (A1c): `class Evil extends StubPlanner { run(ctx) { … } }` — `super()` calls
`registerRuntimeRole(this)`, so `isRuntimeConstructed(evil) === true`; with `refWatch: false` the
loop **completes**. The mechanism's own doc says *"a role is runtime-constructed iff its
constructor ran in this file"* — true, and the point of the check (*"behaviour is what an
adversarial role controls"*) is defeated by inheritance. `Object.create` and `Proxy` are refused.

## 6. Findings that fail no row

- **F1** `git.test.ts`'s network scan fires on a comment naming the call (plant 3); `checks.test.ts`
  strips comments first. Safe direction; inconsistent.
- **F2** `gate-live.test.ts`'s header claims a global-`fetch` guard the file does not contain.
- **F3** A no-key `--gate live` run is refused **after** the planner stage: `loop-001-base` and a
  `FAILED.md` are left in the target repo. Policy unreadability is checked at preflight; key
  absence is not. Inconsistent, not a fail (the row says "before any request is built").
- **F4** The wire body is not redacted — by design, the state is what the model judges — so a
  secret that reaches a role's deliverable goes to the API and into the `D_t` commit; only the
  `G_*.json` record is redacted. Observed with the plant in the plan objective. Worth a sentence in
  `HOH-JEV.md` §8.
- **F5** The developer's accidental live call rejected the stub plan on `addresses_top_failures
  0.32 < 0.5` with `prior_failures: []` — a threshold on a question that has no referent when
  there are no prior failures. On the CLI path with stubs, the done gate may be **unreachable**
  live. A7 will find out; the planner may want to weigh this before it does.
- **F6** No scan named "no key in source" or "no network in tests" exists as such (brief §2
  T-156 bullet); the properties are carried by A3's tests and by transport injection.
- **F7** The derived `plan.schema.json` accepts a blank `new_capability` (A8 row 1); documented in
  the file itself since slice one.

## 7. Error entries

**QA 1.** The criteria at `c73f147` name `open-brain/src/pipelines/state-writer.ts` as P3's known
positive; the file is `open-brain/src/shared/state-writer.ts`. A wrong path in a committed artifact,
found when the plant returned "No such file" rather than a count. Developer 30 / Planner 50 stand
as the counterparts set them.

**Near-misses, by family, not numbered:** three reads returned "no such file"/an empty diff while a
parallel call had moved the shared cwd — the same instrument-lies-in-both-directions family as the
CRLF count in the criteria session; caught by re-verifying identity with absolute paths. My first
`spawn(` grep missed `spawnSync(`; my first `shell: true` plant landed in a comment; the ajv default
draft rejected the 2020-12 meta-schema. Each caught before a claim was written.

## 8. What Atlas should weigh

1. **The A6 fail is a scope line.** The scan needs the prompt constants (`PLAN_GATE_QUESTIONS`,
   `DONE_GATE_QUESTIONS` in `gate.ts`) and the gate-context assembly in `runtime.ts` inside it —
   with a planted prompt literal as its positive. Small; and the criteria already say how it is
   seen red.
2. **D1 and D2 are one design question, not two bugs:** what the restore does about `HEAD`. The
   ref-watch owns `refs/`; `HEAD` is a symbolic ref outside `refs/` that both defects turn on. A
   restore that first re-points `HEAD` at the branch it was on when the window opened — the watch
   already records `deferredRef` — would fix D1 (`checkout -b`), and letting the watch's own CAS
   restore the deferred ref before the commit boundary judges it would fix D2. Whether this slice
   or slice three; my recommendation is **before any real role runs**, because `checkout -b` and
   `reset` are the ordinary vocabulary of a developer session.
3. **D3** is cheap to close (`new.target === StubPlanner` in the constructor, or registration at
   the `stubRoles()` factory rather than in constructors) and cheap to leave for slice three if
   the real-role constructors are built with it in mind.
4. **F5 before A7.** If the next candidate is otherwise accepted, the live pair will be spent on a
   stub plan that the shipped policy may reject at the plan gate, leaving the done gate unobserved
   live. That is the ruling as written and I will run it as written; saying it now costs nothing.
5. **T-055 is four for four in this tree today**; the "third data point" is now five.
