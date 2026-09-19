# Loop 15 — QA acceptance criteria, written before a candidate exists

**By:** Probe (QA seat) · **Date:** 2026-09-19 · **Derived from:** `docs/loops/loop-15-brief.md`
§2–§4 at `master` @ `e47ae20`, and the `D_t` / `E_t` shapes in `hoh_jev.md` §"Artifact schemas".
**Candidate:** none yet. This file is committed before Forge hands over a SHA so the criteria cannot
be fitted to what arrives.

> **Rule of this file.** Every criterion names what will be observed, in which tree, with which
> command, and what result means **pass**, **fail** or **untested**. A criterion I cannot state that
> way is listed under §6 as unverifiable now, not silently dropped. **Missing evidence is a gap, not
> a pass.** The report will carry `untested` on any row whose procedure did not run to completion.

---

## 1. Fixed conditions for the evaluation

| | |
| --- | --- |
| **Candidate identity** | One SHA, handed over by Forge in writing. Every observation below carries it. |
| **Candidate provenance** | The SHA will arrive **unpushed** (Aaron is away; each push needs his word). The four checkouts share one `.git`, so the commit is in the local object store the moment Forge makes it. Before anything else: `git cat-file -t <SHA>` must print `commit`; `git branch -r --contains <SHA>` printing nothing is expected, not missing. The report records that the candidate identity came from the object store by SHA, not from a branch name. |
| **Evaluation tree** | `~/Worktrees/sia-qa`, moved to the candidate with `git checkout --detach <SHA>`, then `git status --porcelain` empty and `git rev-parse HEAD` equal to the handed-over SHA, **checked before the first observation and again after the last.** If either check changes between them, every observation is void and the evaluation restarts. |
| **Build** | `npm ci` then `npm run build` in `open-brain/` of the evaluation tree, exit codes read from `$?`, not from output text. Any harness build step the candidate documents is run the same way. |
| **Read-only** | No edit to any tracked file at the candidate. Nothing is repaired. Where a check must be *seen red* on a mutated copy, the mutation is made in the session scratchpad on a copy, never in the candidate tree. |
| **Second tree** | Where a check reads files that exist only in the main checkout (`~/Projects/Self-Improving-Agent`: the `.gitnexus/` index and the build the hooks run from), the check is run there **without moving that tree** — its HEAD is infrastructure. If a check cannot be run there without moving it, that row is `untested` with that reason. |
| **Untracked source** | `hoh_jev.md` is untracked and lives in the planner tree. The copy I derived §4 from was `~/Worktrees/sia-planner/hoh_jev.md`, 15,141 bytes, mtime 2026-09-19 13:59. If the candidate's schemas disagree with a later version of that file, the disagreement is reported, not arbitrated. |

**What "exit 0" means everywhere below:** the process exit status captured directly from the
process under test — `echo $?` immediately after it, or `execFileSync` in a test — never from a
pipeline's last stage and never inferred from a line of output.

## 2. Acceptance criteria, one per brief §4 row

Each row: **required** (the brief's words), **procedure** (what I run, where), **pass / fail /
untested**, and **blind spot** (what the procedure cannot see).

### A1 — the loop runs and produces the three artifacts

- **Required:** `harness` runs loop `t001` with three stubbed role sessions and exits 0, producing
  `artifacts/iterations/t001/` containing `D_t.md`, `A_t.gitref`, `E_t.json`.
- **Procedure:** in the evaluation tree at the SHA, from a clean `git status`, run the harness
  entry point the candidate documents (its README or `--help`; if neither names one, that is a
  finding under §5 and the row is `untested`). Capture `$?`. Then `ls -la artifacts/iterations/t001/`
  unfiltered, and `git status --porcelain` to see what the run left behind.
- **Pass:** exit 0 **and** all three named files present, each non-empty, **and** `E_t.json` parses
  with `node -e 'JSON.parse(require("fs").readFileSync(...))'`. **Fail:** any of those false.
  **Untested:** no documented entry point, or the run needs an input I do not have.
- **Blind spot:** says nothing about the *content* of the three files beyond parseability; a stub
  that writes `{}` passes this row. Content is A2's job.

### A2 — an invalid `D_t` is retried, and exhausting the cap is a recorded failure

- **Required:** an invalid `D_t` causes that role to be retried, and exhausting the cap fails the
  loop with a recorded reason — not a pass, not a silent continue.
- **Procedure, white-box first:** read the retry path and find (a) the cap as a constant or config,
  (b) the branch taken when it is exhausted, (c) where the reason is written. Then **black-box:** run
  the harness with the planner stub configured, by whatever mechanism the candidate provides, to
  emit a `D_t` that violates `plan.schema.json` on every attempt. Three shapes will be tried:
  missing `new_capability`; `new_capability: ""` without `stop_ship`; and `acceptance: []`.
  Capture `$?` and read the artifact directory and any log the candidate names.
- **Pass:** exit non-zero **and** a recorded reason exists on disk (in `artifacts/` or a file the
  candidate names) that states the cap was hit and which role — **and** the number of attempts
  observed equals the cap. **Fail:** exit 0, or a continue past the invalid plan, or a reason that
  exists only on stdout. **Untested:** the stub cannot be made to emit an invalid plan without
  editing the candidate.
- **Blind spot:** validates the retry against the three shapes I chose; a schema that is loose
  elsewhere (say, `loop` accepting a string) is not seen. The schema itself gets one separate
  observation: `plan.schema.json` rejects the sample `D_t` from `hoh_jev.md` with `new_capability`
  blanked, and accepts it unblanked — a validator that accepts both has not been seen red.

### A3 — QA receives a frozen ref, and a moved tree is refused

- **Required:** the QA stage receives a frozen git ref, and the runtime refuses to proceed if the
  working tree has moved from the candidate SHA.
- **Procedure, white-box:** find where the developer-stage commit SHA is captured and where the QA
  stage receives it (a value, not a branch name). **Black-box:** run the loop to the point after the
  developer stage; before the QA stage runs, move the tree — in a run where the candidate offers a
  pause or hook point, by a commit in the evaluation tree; otherwise by reading the test the
  candidate ships for this and running it, then re-running it on a scratch copy with the refusal
  branch deleted to see it red. Capture `$?` and stderr.
- **Pass:** the QA stage receives a 40-hex SHA (seen in `A_t.gitref` and in the stage input), and a
  moved tree makes the runtime exit non-zero with a message naming both SHAs before the QA stage
  starts. **Fail:** QA receives a branch name or `HEAD`; or a moved tree proceeds; or the refusal is
  a warning followed by continuing. **Untested:** no way to move the tree between stages without
  editing the candidate, and no shipped test covers it.
- **Blind spot:** a refusal that compares SHAs but not the working tree's dirtiness. I will also
  check `git status --porcelain` is consulted; if only `rev-parse HEAD` is compared, that is
  reported as a limit, not a fail — the brief says "moved from the candidate SHA".

### A4 — the developer stage's write path is restricted and refused, not warned

- **Required:** a stub role writing outside its allowlist is refused by the runtime, not merely
  warned.
- **Procedure, white-box:** find the allowlist — where it is derived from, and what enforces it
  (a pre-write check in the runtime, a post-stage diff against the allowlist, or a permission mode
  passed to the spawned session). **Black-box:** configure the developer stub to write one file
  outside the allowlist, run, capture `$?`, then `git status --porcelain` and
  `git diff --stat HEAD` to see whether the write landed or was reverted.
- **Pass:** exit non-zero, the loop does not reach QA, and the out-of-allowlist file is either
  absent or reverted (tree clean of it). **Fail:** exit 0; or a warning printed and the loop
  continues; or the file remains in the tree after a "refusal". **Untested:** the stub cannot be
  made to write outside the allowlist.
- **Blind spot:** enforcement by *diffing after the stage* cannot stop a write, only detect it —
  I will name which of the two the candidate does, because "refused" means different things for
  each. A permission mode handed to a spawned `claude` is not observable in slice one, where the
  roles are stubs; if that is the only mechanism, the row is `untested`, with that reason.

### A5 — tags exist and git alone restores the pre-loop state

- **Required:** `loop-001-developer` and `loop-001-qa` tags exist, and `git` alone can restore the
  pre-loop state.
- **Procedure:** before the A1 run, record `git rev-parse HEAD` as the pre-loop SHA and confirm
  `git tag -l 'loop-*'` is empty (it is empty at `e47ae20`: 64 tags, none matching). After the run:
  `git tag -l 'loop-*'` unfiltered, `git rev-parse loop-001-developer^{commit}` and
  `git rev-parse loop-001-qa^{commit}`. Then `git checkout --detach <pre-loop SHA>` and
  `git status --porcelain`, plus `ls artifacts/iterations/` to see what the restore did and did not
  remove.
- **Pass:** both tags exist, each resolves to a commit that is a descendant of the pre-loop SHA,
  `loop-001-qa` is at or after `loop-001-developer`, and checking out the pre-loop SHA gives a
  clean tree. **Fail:** either tag missing, or pointing at the pre-loop SHA itself, or tagged on an
  uncommitted state. **Untested:** the run in A1 did not complete.
- **Blind spot:** the tag *name* format. The brief writes `loop-<t>-<role>` and `loop-001-*` in
  the same paragraph; if the candidate emits `loop-1-developer` I report it and pass the row with
  the deviation named — the requirement is rollback, not the padding. Note `^{commit}` is written
  here for bash; under `cmd.exe` the caret is an escape and the command silently asks a different
  question (`.agents/roles/developer.md`).

### A6 — dry-run prints the gate payload and sends nothing

- **Required:** dry-run mode prints the gate payload and sends nothing, asserted by a test that
  would fail if a network call were attempted.
- **Procedure, black-box:** run the harness in dry-run with `TYPESAFE_API_KEY` **unset** and, in a
  second run, set to a placeholder string. Capture stdout and `$?`. Grep stdout for the placeholder
  value with `grep -c` **after** first confirming `grep -c` finds a known-present string in the same
  output (the counting instrument gets validated before its zero is believed). **White-box:** find
  the test; read what it asserts. On a scratch copy of the test file, remove the guard the test
  depends on and run it to see it red — or, if the test stubs `fetch`, confirm the stub throws
  rather than records.
- **Pass:** dry-run exits 0 and prints a payload; the placeholder key value appears nowhere in
  stdout or in any file the run wrote; and a shipped test fails when a network call is attempted
  (seen red on the scratch copy). **Fail:** the key value is printed or written; or no test exists;
  or the test asserts on text ("dry run") rather than on the absence of a call. **Untested:** the
  test cannot be seen red without editing the candidate.
- **Blind spot:** "sends nothing" is verified by the absence of a `fetch`/`http` call in the code
  path plus the test, not by observing the network. A call made through a path the test does not
  stub is invisible here. I will state which modules the test intercepts.

### A7 — deterministic check results come from exit codes

- **Required:** deterministic check results come from exit codes; no stage infers pass/fail from
  text.
- **Procedure, white-box only:** read every site where the runtime runs build or tests. For each:
  is the result read from `status` / `exitCode` of the spawned process, and is it spawned with an
  args array rather than a shell string? Grep the harness source for `/pass|fail|ok|✓|passed/` in
  the vicinity of process output handling, and for `.includes(` and `/match(/` on captured stdout,
  then read every hit. Also run one deterministic check with a forced failure on a scratch copy
  (a test file that throws) and confirm `E_t.json`'s `runtime_checks.unit` says `fail`.
- **Pass:** every check site reads an exit status, none parses output for a verdict, and the
  forced-failure run records `fail`. **Fail:** any site infers a verdict from text, or the forced
  failure is recorded as `pass`. **Untested:** the forced-failure run cannot be done on a scratch
  copy.
- **Blind spot:** a shell-string spawn whose exit code is the pipeline's last stage rather than the
  test runner's — the `head` defect in the developer role file. I will read each spawn's form and
  report any `shell: true` or template-string command as a finding, whether or not the exit code
  happens to be right in the run I observe.

## 3. Preservation — what must still be true (brief §3)

| id | required | procedure | pass / fail / untested |
| --- | --- | --- | --- |
| **P1** | `/start` and `/end` unchanged | `git diff --stat <base>..<SHA> -- .claude/commands/ project-template/ scripts/` in the evaluation tree | **pass:** empty. **fail:** any hunk. This is a diff, not a behaviour test, and is labelled as such. |
| **P2** | 648 tests, `sync --check` clean, `module-boundary` green | `npm test` in `open-brain/` of the evaluation tree at the SHA, count read from vitest's summary line; `node open-brain/build/cli.js sync --check` from the tree root, exit code and every check line read unfiltered; the `module-boundary` line specifically | **pass:** test total ≥ baseline (§7) with 0 failed, `sync --check` exit 0, `module-boundary` reports a pass with its walked-file count stated. **fail:** any failed test; any check at `issue`; `module-boundary` at `skip`. **untested:** the suite does not run in this tree — reported as such, not as green. Note `build-freshness` **skips** in a tree with no build and skip is not pass; it is run after `npm run build` so it can report. |
| **P3** | `ob_state` remains the only writer of `.agents/state.json` | grep the harness source and its tests for `state.json` and `.agents/` (validate the grep against `open-brain/src/pipelines/state-writer.ts`, a known positive, first); read every hit | **pass:** no write path to `.agents/state.json` outside `ob_state`. **fail:** any. **untested:** grep instrument fails its own known-positive check. |

Rule 13 applies to P2: `sync --check` will also be run in the main checkout, against the main
checkout's own build (`node ~/Projects/Self-Improving-Agent/open-brain/build/cli.js sync --check`
from that root). That tree is at `54289fe` today and will not be moved by me; if its HEAD is not the
candidate, the main-tree run tells us about the checks' behaviour in that tree, not about the
candidate, and the report says so.

## 4. Scope fences — things the brief says the candidate must NOT do

| id | fence | procedure | verdict |
| --- | --- | --- | --- |
| **F1** | No Jev client, no gate, no network | `git diff --stat <base>..<SHA>`; grep the harness for `typesafe.ai`, `fetch(`, `https.request`, `axios` — validated against a known positive in `open-brain/src` first | **fail** on any real network call site outside a dry-run print. |
| **F2** | `harness/prompts/` and `artifacts/index.md` cut | `ls harness/prompts artifacts/index.md` | present = finding (scope widened), reported; not a fail on the runtime. |
| **F3** | Nothing in `project-template/` changes; `.claude/commands/` untouched | covered by P1's diff | as P1. |
| **F4** | No secret in any file | `git grep -n TYPESAFE_API_KEY <SHA>` — every hit must be a *read* of the variable, not a value | **fail** on a value. |
| **F5** | TypeScript, not Python | `find harness -name '*.py'` after confirming `find` finds a known `.ts` there | **fail** on any. |

## 5. What I will report as a finding even though no row fails

- No documented entry point for the harness (README or `--help`).
- Any spawn with `shell: true` or a template-string command (A7 blind spot).
- Enforcement of A4 by post-hoc diff rather than prevention.
- A retry cap that is a magic number with no name.
- A `D_t` written as Markdown while `plan.schema.json` is JSON Schema — how the candidate validates
  Markdown against a JSON schema is a design question I will describe, not rule on.

## 6. What cannot be verified now, stated so nobody inherits it as settled

- **Whether the roles are "isolated"** (§1 of the brief: "three isolated role sessions"). With
  stubs, there is no session to isolate. Slice one can show the *plumbing* for isolation; the
  property itself is slice two's to evidence.
- **Whether A4's restriction holds against a real `claude` invocation.** Same reason.
- **Whether the schemas match the author's intent.** `hoh_jev.md` is untracked; I derived from one
  copy at one mtime (§1). A different copy is a different `S`.
- **Whether the runtime "enforces separation"** in the sense the brief's §1 gives as the loop's
  purpose. The observable rows are A3 and A4; they are the runtime refusing two specific moves, not
  a proof that a seat cannot leave its role. The report will not claim the larger property.
- **Main-tree behaviour of the candidate.** I do not move the main checkout (§3). Unless Aaron or
  Forge checks the candidate out there, the main-tree run covers the checks, not the candidate.

## 7. Baseline, reproduced in this tree before any candidate

Filled in below from a run in `~/Worktrees/sia-qa` at `e47ae20`, this seat's own tree, after
`npm ci` and `npm run build`. These are **this tree's numbers**; the brief's "648" is the author's.

| observation | result | how the number was read |
| --- | --- | --- |
| `npm ci` in `open-brain/` | exit 0 | `${PIPESTATUS[0]}` of the npm process |
| `npm run build` | exit 0, 2026-09-19T23:16:15Z | `$?` |
| `npx vitest run` | **648 passed (648)**, 48 files, 0 failed, exit 0, duration 47.37s | vitest summary line, exit from `${PIPESTATUS[0]}` |
| `node open-brain/build/cli.js sync --check` (unfiltered, foreground) | exit 0 — 25 passed, 4 warnings, 0 issues, 1 skipped | full output read |
| `module-boundary` | pass: 46 files, 31 core | its own line |
| `build-freshness` | pass: build matches HEAD e47ae20 | its own line, after the build above — before the build it would have skipped |
| `gitnexus-index` | **skip** — no `.gitnexus/` in this tree, and skip is not pass | its own line |
| `git tag -l 'loop-*'` | empty; 64 tags total | unfiltered |
| `state-schema` | rev 38, 36 tasks — note ob_start at session start reported rev 33; the record moved during this session | its own line |

The four warnings (`prd-version`, `vault-index-parity`, `project-dirs`, `spec-provenance`) are
pre-existing at the base and will not be attributed to the candidate unless their text changes.
The author's "648" and this tree's 648 agree; that is one reproduction, in one tree, at one SHA.

## 8. Procedure order on hand-over

1. Record the handed-over SHA, the time, and Forge's stated numbers verbatim.
2. `git cat-file -t <SHA>` prints `commit` (object store, no fetch needed); `git checkout --detach <SHA>`;
   verify identity (§1). Start the clock.
3. `npm ci`, `npm run build`, capture exit codes.
4. P2, then A1, A5 (they share the run), then A2, A3, A4, A6, A7, then P1, P3, F1–F5.
5. Verify identity again (§1). If moved, void and restart.
6. Write `docs/loops/loop-15-qa-report.md`: for each row required / observed / tree / SHA / time /
   verdict; then **what could not be verified**; then what the checks cannot see; then defects with
   the observation each came from; then regressions confirmed absent. Commit on `qa/loop-15-report`
   and tell the planner by message. Do not push without Aaron's word for that push; the planner
   reads it from the shared object store by SHA.
