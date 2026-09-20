# Loop 15 slice two — QA acceptance criteria, written before a candidate exists

**By:** Probe (QA seat, fresh session, this loop) · **Date:** 2026-09-20 · **Derived from:**
`docs/loops/loop-15-slice-2-brief.md` §2–§5 at `origin/master` @ `293cddb`, its amendment 1
(`docs/loops/loop-15-slice-2-brief-amendment-1.md` at `7fc2f3e` on
`origin/docs/loop-15-slice-2-amendment-1`, not yet merged — ruling 8 becomes a ledger and A2 gains a
fourth case), and `docs/HOH-JEV.md` §3, §4, §8 at the same base. **Amendment 2** (ruled by the
planner by A2A on 2026-09-20 after this file's first commit `71f9760`; the planner is writing it as
tracked text) resolves the four questions in §9 — the rulings are recorded inline where they change
a row, marked **RULED**.
**Handoffs cited by close-out SHA, not by the rendered view** (amendment 1 §2): the developer's at
`git show b92c1ae:.agents/SESSIONS/next-session.md`; the previous QA seat's at
`git show 293cddb:.agents/SESSIONS/next-session.md`.
**Candidate:** none yet. This file is committed before the developer's first commit exists so the
criteria cannot be fitted to what arrives. **They are not widened after a verdict.**

> **Rule of this file.** Every criterion names what will be observed, in which tree, with which
> command, and what result means **pass**, **fail** or **untested**. A criterion I cannot state that
> way is in §6 as unverifiable now, not silently dropped. **Missing evidence is a gap, not a pass.**
> Where the brief is ambiguous I state the reading I will apply and return the question to the
> planner in §9 — I do not resolve it, because a QA seat resolving the planner's ambiguities is
> setting scope.

---

## 1. Fixed conditions for the evaluation

| | |
| --- | --- |
| **Candidate identity** | One SHA, handed over by the developer (`sia-forge-0f`) in writing, cited by rev. Every observation carries it. `git cat-file -t <SHA>` must print `commit`; if the commit is not in this checkout's object store, `git fetch origin` first and record that it was fetched. |
| **Evaluation tree** | `~/Worktrees/sia-qa`, moved with `git checkout --detach <SHA>`; then `git status --porcelain` empty and `git rev-parse HEAD` equal to the SHA, **checked before the first observation and again after the last.** If either changes between them, every observation is void, recorded as void, and the evaluation restarts on the new SHA. |
| **Made to resemble the main tree** | In order: `npm ci` and `npm run build` in `open-brain/` (exit codes into variables); `node .gitnexus/run.cjs analyze` from the root — if it fails with the FTS `file_fts` inconsistency (T-055), `analyze --repair-fts` then `analyze` again; **never `clean` without `--force`** (G-043: it exits 0 and deletes nothing); then `node open-brain/build/cli.js sync --check` from the root, which must report **0 skipped**. The analyzer's exit code and the indexed commit it prints are recorded beside the build's. |
| **Read-only** | No edit to any tracked file at the candidate. Nothing is repaired. Where a check must be *seen red* on a mutated copy, the mutation is made on a **scratch clone** in the session scratchpad (`git clone <this checkout> <scratch>` — a local clone, no remote), never in the candidate tree. Loops are run against **scratch repositories** under the scratchpad, never against this checkout: a loop commits and tags in the repository it runs in. |
| **The key** | `TYPESAFE_API_KEY` is in this seat's environment for A7 and for nothing else. Its **value** appears in no command I echo, no report, no log I commit, no artifact and no message; presence is checked with `[ -n "$TYPESAFE_API_KEY" ]`, absence is produced with `env -u TYPESAFE_API_KEY`, and every redaction grep prints a **count**, never a match. Every run other than A7 uses `env -u TYPESAFE_API_KEY` or a **planted placeholder value** of my choosing; no run other than A7 reaches the network. |
| **The main checkout** | `~/Projects/Self-Improving-Agent` is not moved and not built by me. The one main-tree-only condition — Aaron's untracked `.agents/SYSTEM/PRD.md`, which `sync` reports as an issue there and nowhere else — is reported as **unrun**, not implied green by this tree's result. |
| **Not shown** | Probe shapes beyond the brief's own cases are not listed here and are not shown to the developer before the report; they are written into the report after the verdict (brief §6). |

**"Exit 0" everywhere below** means the process exit status captured directly from the process under
test — `cmd > file 2>&1; rc=$?` or `execFileSync` — never a pipeline's last stage and never a line of
output. **Every instrument that returns a zero is validated against a planted positive first.**

## 2. Acceptance criteria, one per brief §4 row

Each row: **required** (the brief's words), **procedure** (what I run, where), **pass / fail /
untested**, and **blind spot** (what the procedure cannot see).

### A1 — `runLoop` refuses a role it did not construct unless the ref-watch is active

- **Required:** `runLoop` called with a `RoleSession` the runtime did not construct, with no ref-watch
  active, **refuses before any stage runs** — a thrown refusal with a distinct `FailureCode`, asserted
  by a test. The same call with the ref-watch active proceeds. **Seen red first:** the developer's
  first commit is this test failing.
- **Procedure, white-box:** read `runtime.ts` for the flag at `runLoop` entry — what "constructed by
  the runtime" means mechanically (a private brand, a `WeakSet` of instances, a symbol — not a
  structural check on method names), where it is evaluated relative to the first `git` call
  (`tagAt(… loop-NNN-base …)` at base is the first repository write), and the new `FailureCode`
  member (the union at `293cddb` has thirteen; the refusal must be a fourteenth, not one reused).
  Read the shipped test. **Seen red:** on a scratch clone at the developer branch's **first
  commit**, run `npx vitest run tests/harness/runtime.test.ts` (or the file the test lives in) —
  it must fail; at the candidate it must pass. If the first commit does not contain the test, or the
  test passes there, that is a finding and this row is **fail** on the seen-red clause.
  **Black-box, in a scratch repo through a programmatic caller against the candidate's build:**
  (a) a stub role obtained from `stubRoles()` and then **copied** (`{ ...role }` — same methods,
  no identity) passed with the watch off → must refuse; (b) the same copied role with the watch on →
  must proceed past entry (reaches the planner stage: `loop-001-base` tag created, planner called);
  (c) `stubRoles()` unmodified with the watch off → per the brief this is the runtime's own role and
  is not refused; I record which of (c)'s two possible designs the candidate chose.
- **Pass:** (a) throws; the thrown value carries the new `FailureCode`; after the throw
  `git tag -l 'loop-*'` in the scratch repo is **empty** and `artifacts/` does not exist — nothing
  ran; (b) proceeds; the shipped test asserts (a) with a foreign object, not a stub; the test is red
  at the first commit and green at the candidate. **Fail:** a structural (duck-typed) identity check
  that (a)'s copy passes; refusal that returns `status: "failed"` after the base tag exists; the
  refusal lives in `cli.ts` rather than at `runLoop` entry (ruling 2); no distinct code. **Untested:**
  no programmatic caller can reach `runLoop` without editing the candidate.
- **Blind spot:** says nothing about whether a *real* session (slice three) is refused — only that
  a foreign object is. Whether "the ref-watch is active" is a config value a caller can simply set
  to `true` without a watch existing is what A2 exists to see.

### A2 — a role that moves, creates or rewrites a ref during its stage fails the loop

- **Required (as amended):** a stub role that runs, during its stage, each of (i) `git tag -f
  loop-001-developer loop-001-base`, (ii) `git branch -f <any> <sha>`, (iii) `git update-ref
  refs/anything <sha>`, (iv) `git tag loop-001-<anything> <sha>` — **creating** a new `loop-001-*`
  ref — **fails the loop with a recorded reason naming the ref and both SHAs**; after failure the ref
  is restored to its pre-stage target. Four cases, four assertions.
- **Procedure, white-box first:** find the snapshot (must enumerate **`refs/` entirely** — `git
  for-each-ref` or equivalent, not `git tag -l`; ruling 1), the compare, the **ledger** of refs the
  runtime recorded it was about to write (amendment 1: accepted by exact ref, once — not by
  `loop-NNN-*` name), the new `FailureCode`, and the rollback. Note whether the snapshot is taken
  before **every** stage (planner, developer, qa) and compared after each. **Black-box:** in a
  scratch repo with a probe script against the candidate's build (the `probe3.mjs` shape from
  `loop-15-qa-report-2.md` §4), a stub role that shells out to git during its stage and then returns
  stock output. Run each of the four cases, in the **qa** stage (the D6 shape) and at least one of
  them additionally in the **developer** stage, capturing the `LoopResult`, the exit code, and
  `git for-each-ref` before the stage and after the failure. Then a **control**: a clean run
  completes, the runtime's own `loop-001-base/-developer/-qa` tags exist, and `git reset --hard
  loop-001-base && git clean -fdx` restores the pre-loop commit — the ledger must not refuse the
  runtime's own writes.
- **Pass:** all four cases give `status: "failed"`, exit non-zero, `FAILED.md` on disk, and a reason
  that names the ref **and both SHAs** (for (iv), the pre-stage side states the ref did not exist —
  see §9 Q4); after failure `git for-each-ref` equals the pre-stage snapshot exactly (the moved ref
  restored, the created ref deleted); no `loop-001-qa` tag and no evidence commit exist after a
  qa-stage refusal; the control completes at exit 0. **Fail:** any case completes; any case fails
  without naming the ref and SHAs; any ref left moved after "refusal"; the snapshot covers tags only;
  the accept-list is by name pattern rather than ledger; the control is refused. **Untested:** a
  stub cannot run a shell command during its stage without editing the candidate (it could in slice
  one; see `probe3.mjs`).
- **Blind spot:** a snapshot-compare cannot see a ref moved and moved back within one stage, nor
  anything that reaches the repository outside `refs/` — the index, hooks, config, submodules,
  the reflog, packed-refs storage. Those are the open denominator (§6); the check must **state its
  own limit in its output** (`shared.md`), and I will quote what it states.

### A3 — the key is read from the environment, fails closed when absent, and leaks nowhere

- **Required:** with `TYPESAFE_API_KEY` unset, `--gate live` fails closed **naming the variable**,
  before any request is built. With it set, the key appears in **no** log line, artifact, `G_*.json`,
  test output or fixture — asserted by a test that greps the whole iteration directory and the
  captured log for the value.
- **Procedure, black-box:** `env -u TYPESAFE_API_KEY npx tsx open-brain/src/harness/cli.ts run
  --loop t001 --gate live --repo <scratch>` (or the candidate's documented live form); capture exit
  and stderr; `ls` the iteration directory. **White-box:** in the transport, the `process.env` read
  and the absence branch must precede payload construction; the variable must come from
  `SECRET_ENV_VARS` (ruling 3); grep the harness for `.env`, `dotenv`, `--key`, `apiKey` in config
  or CLI parsing, validated against a planted `--key` in a scratch copy first. **The leak test:**
  read it — it must set a value, run a loop (dry-run is enough), and walk the **whole** iteration
  directory and the captured log for that value; on a scratch copy, disable `redact()` in one
  write path and see it red. **My own leak run:** dry-run with `TYPESAFE_API_KEY=<planted
  placeholder>`; then `grep -r -c -F -- "<placeholder>"` over the scratch repo including
  `git log -p --all`, and over every log the run wrote, after confirming the same grep counts a
  known-present string in the same set. Also `git grep -n TYPESAFE_API_KEY <SHA>` — every hit is a
  read of the variable's *name*, never a value.
- **Pass:** unset → exit non-zero, stderr names `TYPESAFE_API_KEY`, no `G_*.json` with `sent:
  true`, no request built (white-box ordering); set → the placeholder count is **0** everywhere
  walked, and the shipped test asserts on the iteration directory and the log and is seen red.
  **Fail:** a failure that does not name the variable; a `GateUnavailable` raised after a request
  object exists; the key read from a file, config or flag; a non-zero count anywhere; a test that
  greps stdout only. **Untested:** the test cannot be seen red without editing the candidate.
- **Blind spot:** my grep walks the scratch repo and the logs I captured; a value that reaches a
  path outside those (a temp file elsewhere, a process title) is not seen. The shipped test with
  the value **unset** proves nothing (value redaction is vacuous then — previous QA handoff); I check
  that it sets one.

### A4 — four HTTP failure classes are four distinct outcomes

- **Required:** against a fake server returning each of `401`, `422` (with a named field), `429`,
  `529`, the transport yields **four distinct outcomes**, and the `422` outcome carries the field
  name. No case collapses into another.
- **Procedure, white-box:** read the shipped test and the transport. "Distinct" means distinguishable
  by the runtime — a discriminant (class, code, tagged union), not four message strings under one
  `GateUnavailable`. The `422` outcome must expose the `loc`/field from the body's `detail` array.
  Run the test; on a scratch copy merge the `429` and `529` branches and see it red; drop the field
  from the `422` outcome and see it red. Also observe, as findings not verdicts: what a `200` with a
  body that fails the answer schema yields; what `ECONNREFUSED` yields; whether `429`/`529` are
  marked retryable and `401`/`422` not (guide §3); whether the `422` `detail` array is surfaced
  verbatim (guide §3).
- **Pass:** four outcomes with four distinct discriminants, the `422` one carrying the field; the
  fake server is local (loopback) and the test never resolves `api.typesafe.ai`; seen red twice on
  the scratch copy. **Fail:** any two classes share a discriminant; the field is absent from the
  `422` outcome; the test reaches a non-loopback address. **Untested:** the fake server cannot be
  bound on this machine.
- **Blind spot:** a fake server verifies the client's handling of the status codes it is shown; the
  real API's body shapes were observed once (guide §3, one `422` and one `200`) and `401`/`429`/`529`
  bodies have never been seen live. A7 adds one more `200`, nothing else.

### A5 — dry-run writes both gate artifacts, and the done-gate carries exit codes as data

- **Required:** `harness run --gate dry-run` writes `G_plan.json` and `G_done.json` with `sent:
  false` and the exact payload; the done-gate payload **contains the deterministic checks' exit
  codes as data** and contains no question whose text asks whether tests passed — asserted against
  the payload, not the prompt file.
- **Procedure, black-box:** run the candidate's **README command verbatim** (at `293cddb` the README
  documents `--dry-run`; the brief names `--gate dry-run`; whichever the candidate's README says is
  what a stranger would run — a README still documenting only slice one's form is a finding).
  Capture exit; `ls -la artifacts/iterations/t001/`; parse both files with `node -e` as JSON.
  Assert against `docs/HOH-JEV.md` §4: `G_plan.json` questions are exactly `plan_mode` (choice over
  `repair_only`/`capability_increment`/`mixed`/`stop_ship`), `scope_size` (score, three-step
  scale), `preserves_validated`, `addresses_top_failures`, `has_observable_acceptance` (noul);
  `G_done.json` questions are exactly `diff_matches_plan`, `touches_out_of_scope`,
  `local_tests_support_claim`, `stuck_repeating_prior_failure` (noul), `risk_of_regression` (score).
  The base's placeholder questions (`bounded`, `repairs`, `complete`) must be gone. `score`
  requests carry `criteria` as an **array** (guide §3). The done-gate state carries the build and
  unit **exit codes as numbers**. No question `prompt` matches a "did the tests pass" shape — the
  regex is validated against a planted `"Did the tests pass?"` before its zero is believed.
  **White-box:** the shipped assertion reads the written `G_done.json`, not the source that built it.
- **Pass:** exit 0; both files present, `sent: false`, question ids and kinds exactly §4's, `criteria`
  an array, exit codes present as data, prompt regex count 0 after validation, and the shipped test
  asserts on the file. **Fail:** a file missing; `sent` absent or true; any question outside §4 or
  any §4 question missing; a prompt asking whether tests passed; exit codes absent or rendered as
  "passed"/"failed" text only; a test that asserts on the prompt source. **Untested:** the run
  needs an input I do not have.
- **Blind spot:** that the dry-run payload equals the live payload is an assumption unless one
  builder serves both; A7 compares its `G_*.json` request bodies to A5's (all fields but `sent` and
  timestamps) and reports any difference.

### A6 — thresholds are data, and a threshold in source is caught

- **Required:** changing a threshold in `harness/policies/*.json` changes the runtime's decision with
  **no source change**; a threshold hand-edited into a prompt or string literal is caught by the
  policy schema's drift check (the `D-021` pattern).
- **Procedure, white-box:** find `open-brain/src/harness/policies/` (absent at `293cddb`), the zod
  source, the derived JSON, and the drift check — where it runs (test, `/sync` check, or both) and
  what it compares. Confirm the values named in §4 are in the JSON: `has_observable_acceptance ≥
  0.7`, `scope_size` near `2` at high confidence, `stop_ship` needing deterministic-check and
  QA-history support, and the done-gate's hand-to-QA / roll-back rules. Grep `gate.ts`, `runtime.ts`
  and any prompt text for numeric literals in comparison position (`>= 0.`, `> 0.`, `< 0.`), validated
  against a planted `>= 0.7` first. **Black-box, scratch clone:** a fake transport returning fixed
  answers (`has_observable_acceptance: 0.75`, everything else passing); with the shipped JSON the
  loop proceeds; edit **only** the JSON threshold to `0.8` and the loop is rejected at the plan
  gate with the policy named; `git diff --stat -- '*.ts'` empty. **Seen red:** plant `0.7` as a
  literal in a prompt string on the scratch clone and run the drift check; it must fire (see §9 Q2
  on what "drift check" means here — the behaviour is binding, the name is not).
- **Pass:** JSON-only change flips the decision; no `.ts` changed; the planted literal is caught by
  a check that has its own positive and near-miss fixtures (A9); the JSON is zod-validated and an
  invalid threshold (a string, `1.5`) is refused at load. **Fail:** a threshold in a `.ts` literal or
  prompt; a JSON edit with no effect; the planted literal passes; an invalid JSON value accepted.
  **Untested:** no transport seam accepts fixed answers without editing the candidate.
- **Blind spot:** whether the thresholds are *good* is not observable here (guide §9); A6 observes
  that they are data and that the mechanism obeys them.

### A7 — the one live call, by QA, against the accepted candidate

- **Required:** **one** real call per gate, from the QA tree, with the key in QA's environment,
  against the accepted candidate: the response is `jev-1.13.0` or a later version the docs name,
  each answer is well-typed, the `score` legend is an object, and the two `G_*.json` files record it
  with `sent: true`. QA records request ids, never the key. Run once; not in CI.
- **When — RULED (amendment 2, §9 Q3):** last, after A1–A6, A8 and A9 have been observed on the
  frozen SHA with no fail. The live pair — one call per gate — runs on **every** candidate that
  passes every other row, not once per loop; a superseded candidate that reached A7 does not carry
  its observation forward to the next SHA. If any row failed, A7 is **untested** on that candidate
  with that reason. The discipline is that it is last, not that it is rare.
- **Procedure:** `[ -n "$TYPESAFE_API_KEY" ]` prints `set` (never the value). Run the candidate's
  documented live command against a scratch repo with `--loop t001`; capture exit and the log to a
  file. Parse `G_plan.json` and `G_done.json`: `sent: true`; the resolved `model` recorded with the
  decision (guide §3 requires it); for each `noul` a number in `[0,1]` and — as observed live on
  2026-09-19 — **no** `confidence`; for each `choice` a `choice` inside the options plus
  `probabilities` and `confidence`; for each `score` an integer inside the scale, `legend` an
  **object**, `probabilities`, `confidence`. Record request ids if the response or headers carry
  them, `usage`, HTTP status, latency, and the resolved model. Then the leak grep of §A3 with the
  **real** value: `grep -r -c -F` over the scratch repo, `git log -p --all`, and the captured log,
  printing counts only, after validating the grep on a planted string. Count the requests: exactly
  two (plan, done); a third to the qa-score gate is fence F2.
- **Pass:** exit 0; two requests; `model` is `jev-1.13.0` or a later version the TypeSafe docs name
  at the time of the call (I record the docs' page and date); every answer typed as above; both
  files `sent: true`; leak count 0; the request bodies equal A5's dry-run bodies apart from `sent`
  and timestamps. **Fail:** any answer ill-typed; `legend` an array; `sent` false or absent; the key
  count non-zero anywhere; more than two requests; a model older than `jev-1.13.0`. **Untested:**
  the key is absent from my environment, the API returns a non-`200` (recorded with its class — that
  is A4's evidence, not A7's), or a prior row failed.
- **Blind spot:** one call is one sample of latency, cost and answer distribution — a
  characterisation of nothing (guide §9). Whether the answers are *right* is not observable
  (T-155, later).

### A8 — slice one's rows hold on the final candidate

- **Required:** slice one's acceptance rows hold on the final candidate, re-run by QA. **RULED
  (amendment 2, §9 Q1): all seven** — the brief's "A1–A6" was a miscount of a seven-row table
  (Planner 50); slice one's A7 is inside this row's verdict, not preservation.
- **Procedure:** re-run the procedures of `docs/loops/loop-15-qa-criteria.md` §2 (at `293cddb`)
  rows A1–A7 at the new SHA, in a fresh scratch repo, with the same shapes: the three artifacts and
  their schema validation by an independent validator (A1); the three invalid `D_t` shapes retried
  and the cap recorded, `repair_targets: []` accepted (A2); the frozen ref and the moved-tree
  refusal, HEAD moved and tree dirty reported separately (A3); the out-of-allowlist write refused
  and reverted, uncommitted and **committed** both (A4); zero-padded tags and `git reset --hard
  loop-001-base && git clean -fdx` restoring the pre-loop state (A5); dry-run sends nothing and the
  no-network test is seen red (A6); deterministic verdicts from exit codes with no text inference,
  every spawn an args array with no shell, and a forced-failure check recording `fail` in
  `E_t.json` (A7).
- **Pass:** every one of the seven passes on the new SHA by its own row's definition. **Fail:**
  any one fails. **Untested:** any one's procedure cannot complete, named individually.
- **Blind spot:** the same as each row's own, at `loop-15-qa-criteria.md`.

### A9 — every source-text scan has a must-match and a must-not-match fixture

- **Required:** `T-156`: every source-text scan in `tests/harness/` asserts one fixture that must
  match and one that must not; `npx vitest run tests/harness` exits 0 **and** its exit code is read
  from the process, not from the last line of output (`G-042`).
- **What a scan is:** a test that reads source files from disk and applies a pattern to their text.
  At `293cddb` there are two: `tests/harness/checks.test.ts` (`SHELL_TRUE`, `SHELL_PLATFORM`,
  `TEMPLATE_COMMAND` over the harness source, with `stripComments`) and `tests/harness/git.test.ts`
  (`NETWORK_SUBCOMMAND` over the harness source, with the `DENIED_SUBCOMMANDS` block **removed
  before scanning** — a workaround for the prohibition-vs-instance flaw, not a fixture against it).
  The candidate adds at least two (no key in source; no network in tests). I enumerate scans by
  reading every test file's `node:fs` imports and every `readFileSync`/`readdirSync` over `src/`,
  validated against the two known ones; a scan I could miss is one written another way, and I say
  which files I read.
- **Procedure:** for each scan, the positive fixture is an instance of the forbidden thing and the
  negative fixture is the **prohibition form** — text that names the forbidden thing without being
  it: a constant listing denied subcommands, a comment or sentence saying "never pass `shell:
  true`", a doc line naming the key variable. Both asserted in the same test as the scan. Then
  `npx vitest run tests/harness > file 2>&1; rc=$?` and the log read for `Unhandled Error` and
  `[vitest-worker]` (grep validated on a plant). **Seen red, scratch clone:** plant a real instance
  in a `src/harness` file and the scan fires; plant the prohibition sentence and it does **not**.
- **Pass:** every enumerated scan has both fixtures, the negative being the prohibition form; `rc`
  is 0; the log has no unhandled-error line; both plants behave. **Fail:** a scan with only a
  positive; a negative that is merely unrelated text (as `git.test.ts:64` is at base); `rc` non-zero
  whatever the summary line says; a scan replaced by nothing. **Untested:** a scan whose fixtures
  cannot be identified without editing.
- **Blind spot:** the enumeration is itself a grep; and a pattern too narrow to catch a real
  instance written differently from the positive fixture stays green (G-040's other direction).
  The repo-level scans (`command-names`, `command-tool-names`) are outside `tests/harness/` and
  outside this row; still nobody has looked.

## 3. Preservation — what must still be true (brief §3)

| id | required | procedure | pass / fail / untested |
| --- | --- | --- | --- |
| **P1** | 823 tests green | `npx vitest run > file 2>&1; rc=$?` in `open-brain/` at the SHA; total from the summary line; `rc` from the variable; log grepped for `Unhandled Error` / `[vitest-worker]` after a plant | **pass:** total ≥ 823, 0 failed, `rc` 0, no unhandled-error line. **fail:** any failed, or `rc` ≠ 0 with a green summary (G-042 — reported as its own finding). **untested:** the suite does not run here. |
| **P2** | `sync --check` clean in the QA tree, zero skipped, `module-boundary` green | after build and analyze (§1): `node open-brain/build/cli.js sync --check > file 2>&1; rc=$?`, every line read unfiltered | **pass:** `rc` 0, `0 issues`, `0 skipped`, `module-boundary [pass]` with its walked-file count, `gitnexus-index [pass]` at the candidate SHA, `build-freshness [pass]` at the candidate SHA. **fail:** any issue; any skip; `module-boundary` naming a memory import. |
| **P3** | `ob_state` remains the only writer of `.agents/state.json` | grep the harness source and tests for `state.json` and `.agents/`, validated against `open-brain/src/pipelines/state-writer.ts` first; read every hit | **pass:** no write path outside `ob_state`. **fail:** any. |
| **P4** | No network in the test suite; the runtime never merges, pushes or creates a release tag | the deny-list test still green; the no-network test seen red (A8/A6); the fake server in A4 loopback-only; `git for-each-ref` in every scratch repo after every run shows only `refs/heads/*` the fixture made and `refs/tags/loop-001-*`; the suite run with `env -u TYPESAFE_API_KEY` and again with a planted value gives the same totals | **pass:** all of those. **fail:** any test resolving a non-loopback host; any `v*` tag or remote ref written by a run. *Limit:* I cannot observe the network from outside on this machine; this is code-path plus test evidence, and the report says so. |
| **P5** | *(folded into A8 — RULED, amendment 2, §9 Q1)* Slice one's A7 is part of A8's verdict; the id is kept so the numbering below does not shift | — | see A8. |
| **P6** | `/start`, `/end`, the hook contract, `project-template/` untouched | `git diff --stat 293cddb..<SHA> -- .claude/commands/ project-template/ scripts/ .agents/roles/` | **pass:** empty (a roles change is reported, not failed). **fail:** any hunk in commands, template or scripts. A diff, not a behaviour test. |
| **P7** | Version bumped once in `package.json` with a CHANGELOG entry; `/sync` clean on it | `git diff 293cddb..<SHA> -- package.json CHANGELOG.md`; P2 covers consistency | **pass:** one bump, one entry. **finding** otherwise, not a fail — the bump is the developer's and the tag is Aaron's (brief §8). |

## 4. Scope fences — things the brief says the candidate must NOT do

| id | fence | procedure | verdict |
| --- | --- | --- | --- |
| **F1** | No real role prompts or sessions (slice three) | `grep -rn` the harness for `claude`, `spawn`/`execFile` of anything but `git`, `node` and `npm`, `prompts/`; validated on a plant; `cli.ts:167` still constructs `stubRoles()` | **fail** on a spawned session. |
| **F2** | No QA scoring through Jev | in A5 and A7: no `G_qa*.json` with `sent: true`; A7 counts **two** requests | **fail** on a third live request. A `qa-score` gate stubbed or skipped is fine and is reported as found. |
| **F3** | No artifact index, no selective retrieval, no `T-155` merge gate | `ls artifacts/index.md`; grep for `index.md` writes and for a merge point | present = finding (scope widened), reported. |
| **F4** | The key comes from `process.env` and nowhere else | A3's white-box: no `.env`, `dotenv`, config key or CLI flag (`--key`, `--api-key`) parsed anywhere; `git grep -n TYPESAFE_API_KEY <SHA>` every hit a read of the name | **fail** on any other source, or on a value. |
| **F5** | No threshold in a prompt or string literal | A6's grep | **fail** on a literal in comparison position outside `policies/`. |
| **F6** | No `.claude/commands/` or hook-contract change; no `G-039` trigger; no `G-042` work beyond A9 | P6's diff; `git diff --stat 293cddb..<SHA>` read in full for anything outside `open-brain/`, `docs/`, `README.md`, `CHANGELOG.md`, `package.json` | anything else = finding, reported. |
| **F7** | TypeScript, not Python; harness stays under `open-brain/src/harness/` | `find open-brain/src/harness open-brain/tests/harness -name '*.py'` after confirming `find` sees a known `.ts`; `module-boundary` walked count | **fail** on any `.py` or a harness file outside the boundary. |

## 5. What I will report as a finding even though no row fails

- How the live transport does HTTP: `GateTransport.dispatch` is **synchronous** at `293cddb`
  (`dispatch(payload): GateAnswer`); a synchronous HTTP call in Node is either a redesign of the
  seam, a worker-thread trick, or a spawned `curl` — the last is a shell spawn the checks scan
  exists to catch. I report which.
- Whether `429`/`529` are retried with backoff and `401`/`422` are not (guide §3); whether the
  `422` `detail` array is surfaced verbatim before anything else.
- Whether the resolved model is logged with **every** gate decision, in the artifact.
- Whether the ref-watch **states its own limit in its output** — what it walked and what it cannot
  see — and whether it covers all three stages.
- What the ledger does with a ref the runtime intended to write but did not (a failed `tagAt`).
- Whether the README documents the `--gate` form a stranger would run, and whether that command
  run verbatim on win32 exits 0 (the D4 lesson: a command asserted by name has not been run).
- Any `shell: true`, template-string command, or `npm.cmd` spawn without a shell (`EINVAL` on this
  machine — `loop-15-qa-criteria.md` §7a).
- Which form the policy source and derived JSON take, and where the drift check runs.

## 6. What cannot be verified now, stated so nobody inherits it as settled

- **Whether a real session is refused.** A1 refuses a foreign *object*; slice three is where a
  spawned session exists to be refused.
- **Whether the ref channel is the last one.** The snapshot covers `refs/`. The index (`git add`
  without commit is seen as a working-tree change; `update-index --assume-unchanged` is not), hooks,
  config, submodules, packed-refs storage and the reflog have not been probed by any seat. A2's
  blind spot names them; this slice does not claim them closed. Probes in this class are run and
  reported after the verdict, not listed here.
- **Whether a ref moved and moved back inside one stage is visible.** A snapshot-compare says no
  by construction; the report states it.
- **Whether the gates decide well.** Typed output guarantees the interface, not truth (guide §3).
  A7 observes that the gate answers; `T-155` will count whether it answers well.
- **Whether the vitest unhandled-error condition (G-042) exists on CI.** One machine; three
  slice-one runs here showed none; today's baseline showed none. A9 reads the exit code so it
  cannot hide here; CI is not observed by me.
- **The main tree.** Not moved, not built by me; the `PRD.md` issue there is unrun.
- **`401`, `429`, `529` bodies from the real API.** Never observed live; A4's fake shows the client
  what the client was written to expect.

## 7. Baseline, reproduced in this tree before any candidate

From `~/Worktrees/sia-qa` at `293cddb` (`origin/master` at `git fetch` time, 2026-09-20, before the 05:23:00Z build), this
seat's own tree, after `npm ci` and `npm run build`. **These are this tree's numbers**; the brief's
"823" is the author's.

| observation | result | how it was read |
| --- | --- | --- |
| `npm ci` in `open-brain/` | exit 0 | `$?` into a variable, output to file |
| `npm run build` | exit 0, built 2026-09-20T05:23:00Z | `$?`; `build-freshness` reports the stamp |
| `npx vitest run` | **823 passed (823)**, 55 files, 0 failed, **exit 0**, 102.21s; no `Unhandled Error` / `[vitest-worker]` line | summary line from the log file; exit from `$?`, not a pipe |
| `node .gitnexus/run.cjs analyze` | exit 0, 20.0s, 2,195 nodes / 4,390 edges / 160 clusters / 130 flows; `.gitnexus/` is gitignored (`.gitignore:77`) | `$?`; last lines of the log |
| `node open-brain/build/cli.js sync --check` | **exit 0 — 26 passed, 0 fixed, 4 warnings, 0 issues, 0 skipped** | full output read |
| `module-boundary` | pass: 56 files, 41 core | its own line |
| `gitnexus-index` | pass: indexed 293cddb, measured against HEAD 293cddb | its own line — the SessionStart hook had reported it 6 commits behind before the analyze |
| `build-freshness` | pass: build matches HEAD 293cddb | its own line |
| `state-schema` | rev 47, 37 tasks | its own line |
| `ci-status` | master 293cddb success — evidence about the **remote**, not this tree | its own line |
| `git tag -l 'loop-*'` | empty; 66 tags total | unfiltered `wc -l` |
| `open-brain/src/harness/policies/`, `artifacts/` | absent at base | `ls` |
| `FailureCode` members | 13 at `runtime.ts:113–126` | read |
| plan-gate / done-gate questions at base | `bounded`, `repairs` / `complete` — placeholders, not §4's | `runtime.ts:405–474` read |
| Node / npm / git | v22.23.2 / 11.19.0 / 2.54.0.windows.1 | `--version` |

The four warnings (`prd-version`, `vault-index-parity`, `project-dirs`, `spec-provenance`) are
pre-existing at the base and are not attributed to the candidate unless their text changes.

## 8. Procedure order on hand-over

1. Record the handed-over SHA, the time, and the developer's stated numbers verbatim.
2. `git cat-file -t <SHA>`; `git checkout --detach <SHA>`; verify identity (§1). Start the clock.
3. `npm ci`, `npm run build`, `analyze` (repair-fts if needed), `sync --check` — exit codes into
   variables; P2 read now.
4. **A1's seen-red at the branch's first commit, on a scratch clone, before any A1 pass is
   recorded.** Then A1 at the candidate.
5. A2 (four cases plus control), A9's plants, A3 (unset, then planted), A5, A6, A4 — each in its own
   scratch repo. Then P1, P3–P7, F1–F7. Then A8 (slice one's six rows, plus P5).
6. Verify identity again (§1). If moved, void and restart.
7. **A7 last, once**, only if no row above failed. Leak grep with the real value, counts only.
8. Write `docs/loops/loop-15-slice-2-qa-report.md`: for each row required / observed / tree / SHA /
   time / verdict; then **what could not be verified**; what the checks cannot see; defects with the
   observation each came from, including the probe shapes withheld from this file; regressions
   confirmed absent. Commit on `qa/loop-15-slice-2-report`, gated on `sync --check`'s exit read
   into a variable, and tell the planner by SHA. **Do not push.**

## 9. Returned to the planner at `71f9760` — all four RULED (amendment 2, 2026-09-20)

1. **A8 says "A1–A6"; slice one's §4 had seven rows.** Reading applied at `71f9760`: re-run slice
   one's A7 as P5 outside A8's verdict. **RULED otherwise:** A8 covers all seven; the "A1–A6" was
   the planner miscounting the brief it wrote (Planner 50). A8 and P5 above are updated.
2. **A6's "caught by the policy schema's drift check".** A `D-021` drift check compares a zod source
   to its derived JSON; it cannot by itself see a `0.7` typed into a prompt string. **RULED as
   read:** the behaviour binds — a threshold literal outside `policies/` is caught by a check with
   its own positive and negative fixtures (A9's shape) — and the words "drift check" do not bind
   the form. I report the form found.
3. **A7's spend.** Reading applied at `71f9760`: one call, `untested` on a superseding SHA unless a
   second is authorised. **RULED otherwise:** the live pair runs on every candidate that passes
   every other row; a superseded candidate's observation does not carry forward. A7 is updated.
4. **"Both SHAs" for a created ref (A2 case iv).** **RULED as read:** the record states the ref was
   absent before the stage and names the SHA it was created at; a record naming one SHA with no
   statement of prior absence is a fail.

Two findings from the base, sent to the developer by the planner at the same time: A5 asserts §4's
exact ids and kinds, so the placeholder questions at `293cddb` fail it; and the transport seam is
**ruled async** rather than a spawned process — a spawned process in the live transport is now a
fail on that ruling, not only a finding under §5.
