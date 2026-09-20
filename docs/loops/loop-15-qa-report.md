# Loop 15 — QA evidence report, slice one

**By:** Probe (QA seat) · **To:** Atlas (planner) · **cc:** Forge (developer) · **Date:** 2026-09-20
**Candidate:** `1086e5528f87491f2e3a5533c4494c38a400531a` on `loop/15-hoh-runtime`, **unpushed** —
identity taken from the shared object store by SHA (`git cat-file -t` → `commit`;
`git branch -r --contains` → nothing, as expected), never from a branch name.
**Criteria:** `docs/loops/loop-15-qa-criteria.md` at `24e33e5` on `qa/loop-15-criteria`, written
before either candidate existed and amended only by planner ruling.
**Evaluation tree:** `~/Worktrees/sia-qa`, detached at the candidate. Identity verified at
2026-09-19T23:58:50Z and again at 2026-09-20T00:04:53Z: HEAD equal to the SHA both times,
`git status --porcelain` empty both times, build stamped on the SHA, no `loop-*` tag created.
**Read-only:** no tracked file at the candidate was edited. Every mutation below was made in a
scratch repository created by a script in the session scratchpad.

---

## Verdict

**Not accepted.** Two acceptance rows fail on observation, one of them at the thing the loop exists
for. Everything else the brief asked for is present and was seen working, and the pre-existing suite
is intact. The candidate is close, and the reason it is not accepted is specific.

| row | verdict | one line |
| --- | --- | --- |
| A1 | **fail** on this platform, pass with overrides | the default checks cannot be spawned on Windows/Node 22; the README's own command exits 1 |
| A2 | pass | four shapes: three refused to the cap with `FAILED.md`, empty `repair_targets` accepted |
| A3 | **fail** | a QA stub that commits into the candidate completes the loop at exit 0 with `loop-001-qa` on top of it |
| A4 | **fail** for the commit path, pass for the write path | a planner that commits outside its allowlist completes at exit 0; an uncommitted write is refused and reverted |
| A5 | pass | zero-padded tags in the right ancestry; git alone restores the pre-loop state |
| A6 | pass, with a limit | three payloads printed, nothing sent, no key value in any output; value redaction was not exercised because nothing put the value in a payload |
| A7 | pass | four spawn sites, all `shell: false` with args arrays; verdict is `status === 0` and nothing else |
| P1 | pass | no diff under `.claude/commands/`, `project-template/`, `scripts/` |
| P2 | pass | 807/807 here; 648/648 with the harness excluded; `sync --check` 0 issues; `module-boundary` green |
| P3 | pass | no write path to `.agents/state.json` in the harness |
| F1–F5 | pass | no network call site; prompts and index absent; template untouched; no key value; no Python |

---

## 1. What could not be verified — read this before the table

- **Whether the roles are isolated.** With stubs there is no session to isolate. What was observed
  is the runtime refusing two moves by an in-process stub; that is plumbing, not the property.
- **Whether the runtime "enforces separation"** in the sense the brief's §1 gives as the loop's
  purpose. The observed rows are A3 and A4, and **both fail for a role that commits**. I am not
  claiming the larger property in either direction; I am reporting that the two rows that stand in
  for it do not hold against the simplest thing a real session does after editing a file.
- **Forge's "seen red" mutations** — `verifyFrozen` conditions to `if (false)` → 2 fail; allowlist
  `ok` to `true` → 4 fail — were **not reproduced.** Reproducing them means mutating the candidate,
  which this seat does not do, and building a mutated copy that the tests import was more than the
  evidence was worth once the behavioural tests were read. What I did instead: read every test
  named in the handoff table and confirm each asserts on a real refusal against a real repository,
  and ran my own probes against the built candidate. The mutation claims stand as Forge's.
- **CI.** Nothing here was run on Linux or on a machine other than this one. Forge's Finding 1 is
  load-dependent; my two full-suite runs on this machine (one on the voided SHA, one on this one)
  showed no `[vitest-worker]` timeout, grep validated on a planted line. Two runs is not a
  characterisation.
- **The main checkout.** It was not moved. `sync --check` there passed 28/0/0 with the GitNexus
  index at HEAD — but its HEAD is `d45c965`, master, not the candidate. That run is evidence about
  the checks in that tree, not about this candidate. Rule 13 is therefore **partly unmet**: the
  candidate has run in two of four trees (Forge's and this one), and in neither of them does the
  `gitnexus-index` check do anything but skip.
- **The typecheck covers `src/` only** (`T-152`). Forge type-checked `tests/harness/` with a
  throwaway config and deleted it. I did not repeat that; nothing tracked re-checks it.
- **`hoh_jev.md`** is untracked. The copy the criteria's sample `D_t` came from is the planner
  tree's, 15,141 bytes, mtime 2026-09-19 13:59. The candidate's `docs/HOH-JEV.md` is a different
  document and was not diffed against it.

## 2. What the checks I ran cannot see

- **`enforceAllowlist` and `verifyFrozen` read `git status`.** They see paths git reports as
  changed. They do not see a write made and reverted inside a stage, a gitignored path (asserted as
  intended in `git.test.ts`), **or a commit** — a commit leaves status clean. §4's defects are this
  blind spot, observed.
- **`ci-status` reads GitHub's master**, not this tree's. Its `master d45c965 conclusion: success`
  line is evidence about the remote.
- **`build-freshness` compares commits, not working-tree edits**, and the build it passed against
  is one I made, in this tree, from the candidate. That removes Forge's Finding 4 for this report
  and replaces it with the same shape one seat over: a green produced by a build the reporting seat
  made. There is no third option that does not involve trusting a build.
- **The A6 network assertion guards one call.** `gate.test.ts` installs a throwing `fetch` and a
  throwing transport around `DryRunTransport.dispatch`. The CLI's `--dry-run` test asserts on
  printed text. A network call made anywhere other than through a transport's `dispatch` would be
  invisible to both. The source grep (F1) found no such site, validated on a planted positive.
- **The A7 source scan is three regexes** over ten files, validated against planted positives
  in its own first test. A spawn built in a way none of the three patterns describe would pass it.
  I read all four spawn sites by hand; the scan and the reading agree.
- **My own `grep -c` for suite failures matched one line** — a passing test whose *name* contains
  "failed". Read, not counted. An instrument that answers a different question.
- **My `it(` count of the harness tests gave 141; vitest gives 159 new.** `it.each` expands and my
  regex does not. The vitest arithmetic (807 − 648) is the number; mine is recorded as the wrong
  instrument it was.

## 3. Deterministic results, reproduced in this tree

Each exit code read from its own process (`$?` immediately after, or `${PIPESTATUS[0]}` where a
pipe carried the output to a file). Nothing below is carried forward from the handoff.

| command | where | exit | observed |
| --- | --- | --- | --- |
| `npm ci` | `open-brain/` @ 1086e55 | 0 | 2026-09-19T23:59:03Z |
| `npm run build` | same | 0 | `build-info.json` commit `1086e55…`, built 23:59:18Z |
| `npx tsc --noEmit` | same | 0 | no output |
| `npx vitest run` | same | 0 | **55 files, 807 passed (807)**, 72.23s, started 23:59:59Z; 0 lines matching `vitest-worker|unhandled|onTaskUpdate` (grep found the planted line) |
| `npx vitest run --exclude 'tests/harness/**'` | same | 0 | **48 files, 648 passed (648)** — the pre-loop baseline, reproduced |
| `node open-brain/build/cli.js sync --check` | tree root | 0 | 25 passed, 4 warnings, 0 issues, 1 skipped; `module-boundary [pass]` 56 files, 41 core; `build-freshness [pass]` against my build; `gitnexus-index [skip]` |
| same, in the main checkout at `d45c965` | `~/Projects/Self-Improving-Agent` | 0 | 28 passed, 2 warnings, 0 issues, 0 skipped; `gitnexus-index [pass]` — **not the candidate** |

The four warnings are the four pre-existing ones from the `e47ae20` baseline, byte-for-byte the
same text; none is charged to the candidate. Version reads `v0.41.0`.

**Forge's numbers, verbatim, from the handoff message:** build exit 0 stamped 1086e55; typecheck
exit 0; `npx vitest run` exit 0, 55 files, 807 tests, 0 errors; `sync --check` exit 0, 25 passed,
0 issues, 4 warnings, 1 skip; 807 − 159 = 648. **All reproduced here.**

## 4. Defects, each with the observation that produced it

No fix is proposed for any of these. Where a class is named, the instance is where it was seen.

### D1 — A3: the freeze is verified once, before QA, and a QA role that commits is not seen

**Observation** (scratch repo, `probe.mjs` against the candidate's `build/harness/*.js`,
2026-09-20T00:02:05Z). A QA stub overwrote `README.md` with `# QA edited and committed the
candidate` and **committed it** with `git add -- README.md && git commit` during its own stage,
then returned the stock stub evidence. Result:

```
status: completed   exitCode: 0   failure: null
log:  f8b33ed harness(t001): evidence E_t for d93b596b26dc
      4812ca3 rogue qa commit
      d93b596 harness(t001): candidate A_t
tags: loop-001-base, loop-001-developer, loop-001-qa
README.md on disk: "# QA edited and committed the candidate"
parent(evidenceSha) === candidateSha: false
```

`loop-001-qa` points at an evidence commit whose parent is the rogue commit, not the candidate.
`E_t.json` names the candidate SHA. The tree the evidence describes is not the tree on disk.

**Control** (same script, P4): the same edit **left uncommitted** was refused —
`allowlist-violation` at stage `qa`, README restored to `# fixture`. That is the shipped test
`refuses a QA write outside its allowlist`, and it holds. The commit path is the one nobody tested.

**Why it happens** (white-box, `runtime.ts`): `verifyFrozen` runs at line 421, after the
deterministic checks and before the QA stage. Nothing calls it, or compares HEAD to
`candidateSha`, after `runStage(config.roles.qa, …)` returns at line 433. `enforceAllowlist` at
303 reads `git status`, which is clean after a commit. `verifyFrozen` itself is correct — its own
tests refuse a moved HEAD — it is called at one moment and the QA stage runs after that moment.

**Class:** both enforcement mechanisms observe the working tree; neither observes HEAD after a
stage. `A_t.gitref`'s own comment says *"the runtime refuses to run QA if HEAD has moved"* — true,
and QA is the stage that can move it.

### D2 — A4: a planner that commits outside its allowlist completes the loop

**Observation** (P2, same run). A planner stub wrote `src/backdoor.ts` and committed it, then
returned a valid plan. Result: `completed`, exit 0, `src/backdoor.ts` on disk and in history one
commit below `D_t`, all three tags created, evidence parent is the candidate. The plan allowlist is
`artifacts/iterations/t001/`; the file is outside it; nothing refused.

**Same class as D1.** Recorded separately because the brief's A4 is about the developer stage and
this is the planner, and because unlike D1 it leaves the candidate's ancestry intact — the breach is
*below* the candidate, which is a different thing for a later reader to find.

### D3 — A4/misreport: a developer that commits directly fails with the wrong reason and leaves the write

**Observation** (P3). A developer stub wrote `src/backdoor.ts` and committed it, returned without
using `ctx.write`. Result: `failed`, `developer-no-change` — *"the developer stage changed
nothing"* — while HEAD had moved from `loop-001-base` to the rogue commit and `src/backdoor.ts`
remained on disk. The loop failed closed by accident: `permitted.length === 0` because status was
clean. The recorded reason is the opposite of what happened.

### D4 — A1: the default deterministic checks cannot run on the platform this repo is developed on

**Observation.** `node open-brain/build/harness/cli.js run --loop t001 --repo <scratch> --json`
with no overrides, 2026-09-20T00:02:45Z:

```
exit 1   status: completed   checksPassed: false
build: "npm.cmd --prefix open-brain run build"  exit_code: null
       detail: "could not run: spawnSync npm.cmd EINVAL. A command that did not run is not a command that passed."
unit:  same
```

**The README's documented command**, `npx tsx open-brain/src/harness/cli.ts run --loop t001
--dry-run` (README line 206), run verbatim with `--repo <scratch>` at 00:04:20Z: **exit 1**, both
checks `EINVAL`, log line *"checks RED"*. A stranger following the README on Windows gets a red
loop from the first command.

**Cause, measured before the candidate arrived** (criteria §7a) and independently by the planner
seat: Node v22.23.2 on win32 refuses `spawnSync("npm.cmd", …, { shell: false })` with `EINVAL`
(the batch-file spawning change in Node 18.20/20.12/22), and `"npm"` is `ENOENT`. `defaultChecks()`
in `checks.ts` line 35 picks `npm.cmd` on win32 with `shell: false` at line 57.

**Two things to keep separate.** A7 holds: the refusal is recorded as `passed: false, exit_code:
null` with the reason in `detail`, never as a pass. A1's *"exits 0"* does not hold with the
defaults, on this platform. The suite does not see it because `checks.test.ts` asserts the default
command's *name* matches `/^npm(\.cmd)?$/` and never runs it, and every loop test overrides both
commands with `node -e process.exit(N)`. Forge's by-hand run overrode both too.

### D5 — finding, no row fails: `A_t.gitref` documents a guarantee narrower than it reads

The comment in every `A_t.gitref` — *"The runtime refuses to run QA if HEAD has moved from this
sha or the working tree is dirty against it"* — is true at the moment QA starts and silent about
what happens during QA (D1). A reader of the artifact takes it as a property of the record.

## 5. Acceptance rows, in the order the criteria run them

Each row: what was observed, in this tree at the SHA above, at the time given, and the verdict.

### P2 — preservation (run first)

See §3. **Pass.** 648 pre-existing tests reproduced at 648/648; `module-boundary` pass with its
count stated; `sync --check` 0 issues; `build-freshness` reports rather than skips because I built.

### A2 schema seen-red under the independent validator (run before any A1 pass)

`probe2.mjs`, ajv 8.20.0 with draft 2020-12, against the candidate's `plan.schema.json` **file**,
00:03:18Z, sample `D_t` from `hoh_jev.md`:

| input | independent validator | note |
| --- | --- | --- |
| sample with `loop: 1` as written in `hoh_jev.md` | **refused** — `/loop must be string` | the candidate's schema wants `tNNN`; the source sample is not valid against it as printed |
| sample with `loop: "t001"` | accepted | |
| `new_capability: ""` | **accepted by the file** | JSON Schema cannot express the rule; the file's `description` says so; the runtime refuses it (below) |
| `acceptance: []` | refused — `minItems` | |
| `new_capability` omitted | refused — required | |
| `repair_targets: []` | accepted | amendment 2 |
| `repair_targets` omitted | refused — required | "may be empty" is not "optional" |
| unknown key | refused — `additionalProperties` | |

The file was seen red on four shapes and green on the sample before any A1 pass was recorded.

### A1 — pass with overrides; **fail** with the defaults on this platform (D4)

CLI with `--build-cmd "node -e process.exit(0)" --unit-cmd "node -e process.exit(0)" --json`,
scratch repo, 00:02:45Z: exit 0, `status: completed`, artifacts `D_t.md`, `D_t.json`, `E_t.json`,
`A_t.gitref` plus the stub's `developer-note.md`, tree clean afterwards. On a second identical run,
`D_t.json` and `E_t.json` validated against the candidate's schema **files** under ajv (independent
instrument, not the candidate's validator): both `ok: true`. Under amendment 1 the form
(`D_t.json` + `D_t.md` view) is reported, not judged.

`node …/cli.js` with no arguments: usage on stdout, exit 2. `help`: exit 0. The entry point is
documented in the README (line 206) and CHANGELOG; the documented form is `npx tsx
open-brain/src/harness/cli.ts …`. There is no `bin` entry; `harness` as a bare command does not
exist. The row does not fail on that.

### A2 — pass

Four planner stubs, each invalid on every attempt, cap 3, through `runLoop`, 00:03:18–20Z:

| shape | attempts | failure | `FAILED.md` | `E_t` |
| --- | --- | --- | --- | --- |
| `new_capability` omitted | 3 | `schema-cap-exhausted`, stage planner, attempts 3, problem names `new_capability` | present, states stage/code/attempts | absent |
| `new_capability: ""` no `stop_ship` | 3 | same; problem is the runtime's own rule text | present | absent |
| `acceptance: []` | 3 | same; problem names `acceptance` | present | absent |
| `repair_targets: []` | 1 | none — **completed**, exit 0 | absent | present |

Exit non-zero, reason on disk naming cap and role, attempts equal the cap. The cap is a named
option (`maxAttempts`, default 3, CLI `--max-attempts`, refuses non-integers), not a magic number.

### A3 — **fail** (D1)

The QA stage does receive a frozen ref: `ctx.candidate` carries the 40-hex SHA, branch and
`frozenAt`, and `A_t.gitref` records the same SHA as `E_t.json`'s `candidate_git.sha` (seen in the
A1 run: `sha: a02a00ac…` in both). A tree moved by a **check** before QA is refused with both SHAs
named — that is the shipped test, read. A tree moved **by the QA stage itself** is not refused:
D1. The row's second clause fails on observation.

### A4 — **fail** for the commit path (D2, D3); pass for the write path

Enforcement is both prevention (`makeWriter` refuses before writing) and detection
(`enforceAllowlist` after the stage, `revertPaths` on violation), as the handoff says; detection is
the load-bearing half, and it compares `git status` against the allowlist. Observed: an uncommitted
out-of-allowlist write by a QA stub is refused, reverted, and the loop fails at stage `qa` with the
file restored (P4). A committed one is not seen (D1, D2), and a developer's committed one fails for
a reason that says the opposite of what happened (D3). The default developer allowlist is the
iteration directory alone; `--allow` widens it deliberately.

### A5 — pass

Same A1 run: `git tag -l` → `loop-001-base`, `loop-001-developer`, `loop-001-qa`; zero-padded, so
amendment 1's rule is met and `loop-1-*` is absent. `loop-001-developer^{commit}` = candidate,
`loop-001-qa^{commit}` = evidence; `git log loop-001-base..loop-001-qa` is plan → candidate →
evidence. `git reset --hard loop-001-base && git clean -fdx` (git alone): HEAD back to the pre-loop
SHA, `status --porcelain` empty, `artifacts/` gone. A second `runLoop` on the same repo refuses
with `tag-exists` rather than moving a tag (shipped test, read). Note the third tag
`loop-001-base` is an addition beyond the brief's two; it is what makes rollback one command.

### A6 — pass, with a stated limit

`TYPESAFE_API_KEY=PLACEHOLDER-KEY-VALUE-9f8e7d6c` with `--dry-run`, 00:02:45Z: exit 0; three
payload blocks (`plan`, `developer-done`, `qa-score`); `grep -c 'NOT sent'` = 3 (the known
positive); `grep -c` of the placeholder value over stdout = 0 and over every non-`.git` file in the
scratch repo = 0. **Limit:** `REDACTED` count was also 0 — the value was never in any payload, so
value-redaction was not exercised by this run. Key-name redaction and value redaction are asserted
in `gate.test.ts`, which also installs a throwing `fetch` and a throwing transport around
`DryRunTransport.dispatch`. Values shorter than 8 characters are deliberately not value-redacted
(tested). The unconfigured live transport throws (`gate-unavailable`) rather than approving.

### A7 — pass

Four spawn sites, all read: `checks.ts:54` (`spawnSync`, `shell: false`, args array, verdict
`code === 0` at line 97 and no other expression; `r.error`, `r.signal`, `status === null` each
recorded as `passed: false` with `exit_code: null`), `git.ts:86`, `:115`, `:146` (`execFileSync` /
`spawnSync`, `shell: false`). No `shell: true`, no template-string command, no `exec(`. The CLI's
`--build-cmd` override is split on whitespace with no shell. The source scan in `checks.test.ts`
validates its three patterns on planted positives and asserts it walked ≥ 8 files. D4 is the
consequence of `shell: false` on a `.cmd` — the correct choice for A7 producing the A1 failure.

### P1, P3, F1–F5 — pass

- **P1:** `git diff --stat origin/master..HEAD -- .claude/commands/ project-template/ scripts/`
  empty; the same command on `CHANGELOG.md` shows 96 insertions, so the instrument sees diffs.
- **P3:** grep for `state.json|\.agents` over harness src+tests, validated at 9 hits on
  `state-reader.ts`: two hits in the harness, a string in a stub plan and a comment. No write path.
- **F1:** pattern validated at 1 hit on a planted `fetch("https://api.typesafe.ai…")` file; 0 hits
  in the harness. The only `fetch` tokens in the tree are the git deny list and the test thrower.
  `DENIED_SUBCOMMANDS` (push, fetch, pull, clone, remote, submodule, request-pull, send-email, svn,
  daemon, p4) is checked on the subcommand actually passed; `git.test.ts` refuses each by name.
- **F2:** `open-brain/src/harness/prompts` absent; `artifacts/` absent at the repo root.
- **F4:** `git grep TYPESAFE_API_KEY HEAD -- open-brain`: the name in `SECRET_ENV_VARS` and four
  test fixtures with obviously fake values. No real value.
- **F5:** `find` sees 18 `.ts` files under the two harness directories; 0 `.py`.

## 6. Regressions — previously validated behaviour confirmed still present

- The pre-loop suite: 648/648 in 48 files with the harness excluded, matching the `e47ae20`
  baseline in this tree exactly.
- `sync --check`: the same 25 passes; the four warnings unchanged in text; `module-boundary` green
  with the harness inside the 41 core files, so the runtime reaches no memory code.
- `/start` and `/end`: unchanged by diff (P1). Not exercised behaviourally; this is a diff.
- `ob_state` as the only writer of `state.json`: P3, by grep, not by running.

## 7. Error entries

**Developer (Forge): 2, both self-reported in the handoff, numbered here by the dividing line in
`shared.md` — a wrong claim that reached an artifact, a commit, a counterpart or Aaron.**

1. The fix commit's message says the timeout was seen "5/5"; the handoff corrects it to 7 of 7. A
   wrong count in a commit message reached a commit.
2. `1c8e6ca`'s message says *"I reported that suite as green"*; the handoff says that overstates
   it. Forge chose to record rather than rewrite, which is the right call — and it is a wrong claim
   in a commit.

Forge claimed zero and listed both among five near-misses. The other three (the pipe-masked exit
code, the deny-list scan firing on its own constant, the untrusted schema check) were caught by
their own author before anything carried them: near-misses, by family, as claimed. Atlas arbitrates.

**QA (Probe): 0 entries, 6 near-misses, by family.** A compound command that committed regardless
of `sync --check`'s exit (pre-candidate, content unaffected, gate repaired and refused a later commit
correctly); a P3 known positive at a path that did not exist; an F1 known positive that did not
exist anywhere in `open-brain/src`; a failure grep that matched a passing test's name; an `it(`
count that answered a different question than vitest; a Windows path whose backslashes my shell ate
in a `node -e`. Each caught by reading the output. None reached a message, a file or a commit.

## 8. What Atlas should weigh

The two failing rows share one cause and one blind spot: **enforcement observes the working tree,
and a commit is invisible to a working-tree observer.** In slice one every role is an in-process
stub, so the only way to reach the blind spot is a stub that runs git — which is also the only way
a real session leaves its work. The brief asked for *"the runtime refuses to proceed if the working
tree has moved from the candidate SHA"*; the runtime refuses when a **check** moves it and not when
**QA** does, and QA is the stage the freeze exists to constrain.

D4 is a platform fact meeting a correct decision: `shell: false` is right for A7 and is exactly why
`npm.cmd` cannot be spawned. The documented first command fails on the developer's own platform,
and nothing in the suite runs the defaults.

Everything else asked for is present and was seen working from outside the suite: retry to a
recorded cap, tags and one-command rollback, a dry run that sends nothing, verdicts from exit codes
only, and a pre-existing suite reproduced to the test.
