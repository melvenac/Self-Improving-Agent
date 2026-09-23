# Loop 15 slice three — candidate A, developer handoff

**By:** Forge (developer seat), **record session 80**. The greeting counts per worktree and said 7
(`T-164`); 80 is the record's number.
**Model:** Opus 5.5, `claude-opus-5-5`, read from this session's own transcript
(`~/.claude/projects/C--Users-melve-Worktrees-sia-forge/63bf56f7-f003-4f89-af12-062fbe7db3ca.jsonl`, per-entry
`message.model`).
**Effort, from the transcript's per-entry `effort` field** (dispatch-2's correction: not from
`settings.json`), as timestamped runs:

| Run | From | To | Entries |
|---|---|---|---|
| medium | 2026-09-22T23:50:45Z | 2026-09-23T01:02:38Z | 193 |
| high | 2026-09-23T01:04:10Z | 2026-09-23T02:17:47Z (last read) | 354 |

What was written in each run, by commit time:
- **medium:** the design `ae87fc6` (23:59:51Z), the v0.44.1 release commit `19563a2` (00:28:19Z), and its
  view-restore repair `5a1309e` (00:32:03Z);
- **high:** candidate A `3b19287` (02:24:58Z) and this report.

**Date:** 2026-09-23.

---

## 0. The hand-over

| | |
|---|---|
| **Candidate (frozen)** | **`3b19287111b07ee61100adc9d5a6bbb0e1b5cf10`** on `loop/15-slice-3-candidate-a` |
| Parent | `eee9f10`, the merge of the final criteria tip `c9947c5` into the cut |
| Cut from | `origin/master` **`f673d5e`** (#101 merged, v0.44.1 tagged on it) |
| This report | a docs-only commit on top of the candidate; it is not part of the candidate |
| Version | **no bump** (`D-031`). `git diff f673d5e 3b19287 -- package.json open-brain/package.json CHANGELOG.md` is empty (0 lines) |

**The criteria are ancestors of the frozen SHA, checked with `git merge-base --is-ancestor`, not by eye:**
`770bcb9`, `ce8e6a1`, `96738a8`, `b14c0ad`, `847fc35`, `d627d8c` and `c9947c5` are all ancestors of `3b19287`, as
are `f673d5e` and the G-045 candidate `9ed674c`.

**Scope, as ruled:** rulings-1 R5 (candidate A); rulings-2 R7–R13; rulings-3 R14–R21; rulings-4 on R19, R21 and
R22 (as narrowed by ruling (b)); QA report 1's repair half (CA-10). Candidate B (`T-155`) is untouched.

**Files the candidate changes against `f673d5e`:**
- the criteria file, from the merges only;
- 9 files under `open-brain/src/harness/`: `artifacts`, `checks`, `configwatch` (new), `git`, `process` (new),
  `refwatch`, `roles`, `runtime`, `schema`;
- 6 files under `open-brain/tests/harness/`, 4 of them new: `candidate-a-fixture`, `config-channel`,
  `process-role`, `spawn-sites`.

Nothing under `.agents/`, no PRD, README, CHANGELOG or package file. 4190 insertions, 509 deletions.

---

## 1. What was built, by mechanism

**The one git spawn site (R16).** `git.ts` `spawnGit()` is the only `spawnSync("git", …)` in `src/harness/`.
`git()`, `gitTry()`, `changedPaths()` and `committedPaths()` all route through it. Every call carries:
- **Layer 0 (R7, R19, R20):**
  - `GIT_CONFIG_NOSYSTEM=1`;
  - `GIT_CONFIG_GLOBAL` at a **runtime-generated file** carrying only `SAFE_MACHINE_KEYS`, which are
    non-program keys (`core.autocrlf`, `eol`, `safecrlf`, `symlinks`, `ignorecase`, `longpaths`, `filemode`,
    `precomposeunicode`, `protectntfs`, `checkstat`, `trustctime`);
  - identity by `-c user.name/-c user.email` (`RUNTIME_IDENTITY`);
  - **the file's exact bytes are compared before every call**, and a mismatch throws `GitRefused`.

  Before the safe keys have been read (early preflight) the global config is the null device.
- **Layer 1 (R17):** `-c core.hooksPath=/dev/null -c core.fsmonitor=false`, **and** the same pair as
  `GIT_CONFIG_COUNT`/`KEY_n`/`VALUE_n` in the environment, so descendant gits (the build check) get them too.
- **R18 pinning:** `GIT_DIR` and `GIT_WORK_TREE` are resolved at preflight and pinned per repository for the
  loop's life. The pin is released however the loop ends.
- Inherited variables that redirect git (`GIT_DIR`, `GIT_CONFIG_*`, …) are stripped first.

**Layer 2 — `configwatch.ts` `ConfigWatch`.** It is a per-stage **byte and mode** snapshot of:
- `<common>/config`;
- `<git-dir>/config.worktree` and `<common>/config.worktree`;
- `<common>/hooks/**` and `<common>/info/**`, plus the worktree's `info/` when it differs;
- a linked worktree's `.git` pointer file.

The dirs are resolved **once at preflight** (R12). `closeAndRestore()` is **file I/O only** and runs **first**
after the role exits, before `closeRefWindow` and before anything reads HEAD. A change fails the stage with
**`stage-changed-config`**, is refused and never retried, and every file is put back by bytes and mode.

**R8 — `MachineConfigWatch`.** It hashes `~/.gitconfig`, the XDG global config and the system config
(`GIT_CONFIG_SYSTEM` when set) around each stage, using the loop's `env`. A change is a **finding**, with path,
scope and both hashes. It fails nothing and restores nothing.

**`ProcessRole` (roles.ts) and `process.ts`.** A real role process:
- **developer only**; constructing any other role throws (R1);
- constructed env (`BASE_ENV_ALLOW` plus the adapter's names). `TYPESAFE_API_KEY` and
  `CLAUDE_CODE_CHILD_SESSION` are **denied**: refused if asked for, and asserted absent.
  `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1` is forced;
- **no shell**: the launcher is resolved to a native executable or to `node <entry>`, or refused naming the
  path;
- **prompt on stdin**, so no command-line limit applies to it and argv never carries it (CA-2.4's
  over-limit clause is structurally unreachable);
- context and deliverable in a runtime-chosen temp dir **outside** the repository;
- bounded by `timeoutMs`, with **`role-timeout`**.

The Claude Code adapter (`claudeAdapter`):
- flags: `--print --output-format json --session-id <uuid> --permission-mode acceptEdits
  --permission-prompts none --strict-mcp-config --setting-sources local`, plus allow and deny tool lists;
- **no MCP servers**, so the role cannot call `ob_state`;
- **no user settings, and therefore none of your hooks**;
- the transcript is located by session id.

**Tree kill (R22 as narrowed by ruling (b)).**
- **POSIX:** the role leads its own process group, and SIGKILL goes to the group on **every exit path** before
  any runtime git call.
- **win32:** the timeout path uses `taskkill /T /F` while the root is alive. The normal-exit path is a **stated
  limit**. `TREE_KILL_STATEMENT` is in every loop's output (log line and `findings.json`) and matches the ruled
  sentence byte for byte. The kill note on a win32 normal exit is `WIN32_NORMAL_EXIT_NOTE`, which claims no
  kill.

**`R_t` (`DeveloperReportSchema`).** `{loop, summary, changes[{path, what}], commands[{argv, exit_code}],
claims[]}`:
- capped schema retry, with the rejected attempt's permitted writes reverted before the next attempt;
- disagreement with the measured diff, in both directions, recorded as findings;
- a non-zero role exit with a valid `R_t` recorded as a finding;
- the done-gate gets `developer_claims`, **labelled "reported by the developer role, not measured"**, beside
  the measured diffstat and exit codes.

**Preflight** (`runLoop`, synchronous, so every refusal is before any tag, commit or artefact):
1. foreign role with the watch off;
2. **process role with the watch off**;
3. git dirs resolved, then **pin (null-device global)**;
4. **R13 includes → R21 local-config default-deny → R19 required-filter-by-tracked-attribute**, then a
   **re-pin with the generated global config**;
5. process-role **remote** refusal, and **launcher resolution**.

A refusal after the pin releases it.

**R14 backstop.** Everything after preflight is inside one `try/catch/finally`. Any throw becomes
`runtime-git-failed`, `runtime-git-refused` or `runtime-error`, as a `LoopResult` plus `FAILED.md` naming the
stage and the failing call. The record says "a RECORD, not a repair … nothing here put it back". `finally`
releases the pin and removes the generated file.

**R15.** The checks run with `checkEnv()`:
- constructed, no key;
- `CI`, `NODE_ENV`, `FORCE_COLOR`, `NO_COLOR` and `TERM` allowlisted;
- layers 0 and 1 carried as environment, with the same generated global config;
- **`GIT_DIR` deliberately not pinned**, because the suite creates its own repositories.

**The iteration record.** `findings.json` and `R_t.json` go in the evidence commit on a completed loop. On a
failed loop the same content goes **inside `FAILED.md`**, as an appendix, not beside it: accepted G-045 rows D2
and D4 assert that the tree is clean except `FAILED.md`. `findings.json` lists the layer-0 carried keys, the
generated file's path, the per-stage config verdicts, machine-config findings, `LOOP_LIMITS` and `tree_kill`.

---

## 2. Rulings this report records (A2A has no memory)

- **R19, how "needs" is read.** Built this way, then confirmed by the planner, who wrote "your reading of
  R19 is confirmed, and it is the one the ruling meant". A target **needs** a required filter when **a
  TRACKED path's attribute names it** (`git ls-files -z`, then `git check-attr -z filter`, in chunks of 200).
  Machine config having `filter.<x>.required=true` is not "needs". **The measurement that forced it:** Git
  for Windows ships `filter.lfs.required=true` in **system** config, and the literal reading refused **144**
  of the suite's loops, the plain stub included. **Stated limit:** a path the role **adds** with `filter=lfs`
  meets a runtime git with no lfs driver, so the attribute is **inert**. That is fail-safe, and it is not a
  refusal.
- **Preflight order (ruled by the planner, with a condition): R13 includes → R21 local config → R19
  attribute query.** The condition: the attribute query is itself a git call, so it must run after R21, and
  pinned under layers 0 and 1. **Built that way:** the pin is placed with the null-device global as soon as
  the dirs are resolved, so all three run pinned. Code path: `runLoop` → `resolveGitDirs` → `pinRepo(null)` →
  `preflightConfig` (R13, R21, R19, then re-pin) → `preflightUnderPin`.
- **R21's named extension list (planner, on Probe's question 1).** Exactly this list, with a reason each in
  `configwatch.ts` `SAFE_LOCAL_KEYS`:
  - `user.name`, `user.email`;
  - `commit.gpgsign`, **any value**, because every runtime commit passes `--no-gpg-sign`;
  - `core.autocrlf`, `core.eol`;
  - `extensions.worktreeConfig`.

  To those go the measured init/clone keys: the six `core.*`, `branch.*.remote/merge`, `remote.*.url/fetch`.
  My earlier, wider list (safecrlf, longpaths and others) was **removed** to match.
- **R22 narrowed by ruling (b)**, and its three conditions:
  1. the win32 line is in every loop's own output;
  2. no kill is claimed on win32, tested in both directions;
  3. the job-object launcher is its own follow-up (**T-174**), which must fail closed if `Add-Type` is
     unavailable or AV interferes.

---

## 3. Validation, row by row — my tree's evidence, not acceptance

The implementation-time tests are mine. Acceptance is QA's, from the frozen SHA. "My tree" means
`~/Worktrees/sia-forge` on git `2.54.0.windows.1`, Node 22.23.2, win32.

| Row | Status (my tree) | Observation |
|---|---|---|
| CA-1 | pass | A process sleeps 2 s, then writes `refs/tags/delayed` and plants `post-commit`. It fails **the developer stage** with `stage-changed-config`, and the reason names both. Control: the same role writing nothing reaches a clean developer window (`developer-no-change`). |
| CA-2.1–2.3 | pass | Parent has the key, a sentinel and `CHILD=1`. The child's own printed env: allowlisted sentinel **present** (the control), key and sentinel absent, non-allowlisted name absent, `CHILD_SESSION` absent, `FORCE…=1` present. |
| CA-2.4 | pass (planted JS-entry form) | Probe `^caret`, `$HOME`, backslash, space, `"`, newline, trailing backslash arrives byte-for-byte through a planted npm `.cmd` resolved to `node <entry>`. `argvHead` is `[node, entry]`. The prompt arrived on stdin and is absent from argv. **Native form:** the real `claude.cmd` resolves to `…\bin\claude.exe`, spawned directly; see CA-9. |
| CA-2.5 | pass (win32) | Two planted `.cmd` forms (no target line; a missing target exe) are refused `role-unresolvable`, naming the path, before any tag or `artifacts/`, and the marker is absent. |
| CA-2.6 | pass | A role-authored script run as the **build check**: no key, no sentinel, `CI` present, `GIT_CONFIG_GLOBAL` = the generated file, `GIT_CONFIG_COUNT=2` with `core.hooksPath`/`core.fsmonitor`, no `GIT_DIR`. |
| CA-3a/3b | pass | Refused before tags, commit and `artifacts/`. The remote refusal states "a role can still push to an explicit URL". Controls proceed. |
| CA-3c | pass | `include.path` and `includeIf.gitdir:…path` are refused and named; removing each lets the loop proceed. **Not probed by me:** an include in `config.worktree`. |
| CA-3d | pass | `filter.x.clean` and `core.sshCommand` are refused and named, and the loop proceeds once removed. Every key written by `init`, `clone` and `worktree add` passes (re-measured by the test on the running git), and the instrument sees a planted key. `commit.gpgsign=true` produces 3 runtime commits with **no `gpgsig`**; control: a hand-built object with a gpgsig header is seen. **Not built:** QA's `gpg.program=<marker>` liveness control. |
| CA-4a | pass | `post-commit`, `reference-transaction` and `core.fsmonitor`, one per run: `stage-changed-config`, marker absent, hooks **file set** and `.git/config` bytes restored. Control: the same program through the same kind of call without the runtime writes its marker. Garbage config and `repositoryformatversion=99` both end in `stage-changed-config` with `FAILED.md`, restored, and each control makes git fail. |
| CA-4b | pass | AST walk (TypeScript compiler API): exactly one git spawn (`git.ts:spawnGit`), and three named non-git spawns (`runCheck`, `runBounded`, `killTree`). Validated on planted positives in `execFileSync`, `execFile`, `spawnSync`, `spawn`, **multi-line `"git"` on its own line**, and a namespace call; an unclassified spawn fails. |
| CA-4c | pass | A global filter plus attribute does not run under the runtime, and does run without it. The generated file, parsed by `git config --file … --list`, carries only allowlisted keys; planted `sshCommand`, `fsmonitor` and `filter.x.clean` are not carried. Runtime commits carry `RUNTIME_IDENTITY`. |
| CA-4e | pass | An XDG filter does not run with layer 0, and does run without it (HOME and XDG in scratch). One git version (mine). |
| CA-4f | pass | `~/.gitconfig`, XDG and `GIT_CONFIG_SYSTEM` (all simulated) are each reported with path and both hashes; nothing restored, nothing failed. Control: no finding. |
| CA-4g | pass (3 of 6 cells shown, by the rows above) | Local: refused by layer 2, did not run; control ran. Global (4c) and XDG (4e): did not run with layer 0; each control ran. |
| CA-4h | pass | Linked worktree with `extensions.worktreeConfig`: a common hook, a `config.worktree` key and a common-config key are each detected, restored and never run. **R18:** a rewritten `.git` pointer is `stage-changed-config`, restored; the runtime's tags land in the original repo, and the other repo's `show-ref` is identical. **See §5.1:** this row found a real defect in my restore. |
| CA-4i | pass | An appended filter in the generated file gives `runtime-git-refused`; `FAILED.md` names the file and the filter never runs. A **same-length** one-character edit is caught. Control: the unedited file completes. |
| CA-4d | pass | `watchedLocations` states the set. `config.worktree`, `info/attributes` and a planted `include.path` pointing outside are each detected. |
| CA-5 | pass (git 2.54 only) | A stub loop has 3 clean config verdicts. `.git/config` and hooks are **unchanged across the whole loop**, so on this git the runtime's own writes never touch them, and the per-stage snapshot is **untested by this runtime**, not verified. The R19 target (cloned under machine config, no `.gitattributes`) completes with a clean `status`. **Not done by me:** the CRLF-save `ls-files --eol` comparison. CI's git is QA's. |
| CA-6 | timeout: pass; POSIX rows: **skipped on win32, must be read from CI**; win32 limit: pass | Timeout at 4 s: `role-timeout`, hooks restored, and the grandchild dead by **both** PID and a heartbeat that stopped growing. Control: under the bound the grandchild completes. POSIX normal and error exit (with the 300 ms config-edit ordering probe) are `skipIf(win32)`. win32: the ruled line is in the log and in `findings.json`, and the kill note equals `WIN32_NORMAL_EXIT_NOTE`. **Not run:** QA's double-fork measurement. |
| CA-7 | pass | Missing, garbage and invalid `R_t` each give `schema-cap-exhausted`, attempts 2, `FAILED.md`, exit ≠ 0. Mismatch gives both findings, and exit 3 gives a finding. The done-gate context has `diffstat` = measured, and `developer_claims.role_exit_code` = 3. Control: a matching `R_t` gives no finding. |
| CA-8 | pass | Deleting `main` plus planting a hook gives one record naming both, `FAILED.md`, HEAD resolving, `main` at its window value, marker absent. |
| CA-9 | observation (not acceptance) | §4. |
| CA-10.1 | pass; **seen red** | A ref re-created at a different sha between `compare()` and the restore is refused and reported ("left alone rather than overwritten"). Control: nothing re-created, so it is restored. |
| CA-10.2 | pass | D4 now asserts `main` = the window value, and that the window value ≠ the pre-loop sha. **Not run by me:** the end-state mutant. |
| CA-11 | pass | `LOOP_LIMITS` and `TREE_KILL_STATEMENT` are in the loop's output; the test checks F11's sentence, R8's amendment and the channel list. |
| CA-12 | **two full-suite runs, one red** | §6. |
| CA-13 | pass | The diff is empty. |
| CA-14 | pass; **seen red** | Garbage `.git/HEAD` and garbage `.git/index` each give `runtime-git-failed`, `FAILED.md` saying "a RECORD, not a repair", with the failing call named; the reason claims no restoration. Controls: the same bytes make git fail. |

**Mutants I ran,** each type-clean (`tsc` exit 0), with the edit asserted landed and the original restored and
re-checked:
- **M-CAS** (`ZERO_OID` → `null` in `restoreDeletedDeferred`): the CA-10.1 row goes **red**, and its control
  stays green.
- **M-backstop** (the backstop catch rethrows): both CA-14 rows go **red**. My first M-backstop hit two catch
  sites and failed `tsc` (rc=2), so it was **discarded, not counted**, and redone at the one site.

QA's other mutants (M-L0, M-L1, M-L2, M-L2-order, M-R18, M-R22, the resolve-late mutant and the end-state
mutant) are unrun by me.

---

## 4. CA-9 — the first real `ProcessRole` run: an observation, not acceptance

Run at **2026-09-23T02:12:43Z → 02:13:13Z** on your word in my session ("Yes, run it once"). The driver is in
my scratchpad, `…/scratchpad/ca9/driver.mts`. The target was a scratch repo with **no remote**. The developer
was `ProcessRole("developer", claudeAdapter())`, the planner a `StubPlanner` with a one-file objective, and
QA a stub. The parent environment carried a `TYPESAFE_API_KEY` sentinel and `CLAUDE_CODE_CHILD_SESSION=1`.

**From the runtime's own artefacts** (`result.json` and the scratch repo):
- `completed`, exit 0. Base `6d62435`, candidate `0b650c9`, evidence `95dfb60`, three `loop-001-*` tags.
- Both checks exit 0; the unit check read `docs/hello.md` and found exactly the requested line.
- Config windows: planner, developer and QA all clean (17 files each). Machine findings: none. Findings: none,
  because `R_t` matched the diff.
- `developerRun`:
  - `form: native`;
  - `how: npm shim claude.cmd → native …\node_modules\@anthropic-ai\claude-code\bin\claude.exe`;
  - `argvHead: […\claude.exe, --print]`, with **no `cmd.exe`**;
  - exit 0, 24.9 s, not timed out;
  - kill note = `WIN32_NORMAL_EXIT_NOTE`;
  - env names: 25, **no `TYPESAFE_API_KEY`, no `CLAUDE_CODE_CHILD_SESSION`**.
- **Transcript: present**, at the path the runtime recorded (39 entries). It records the role at effort
  `medium`, model `claude-opus-5-5`.

**The child's environment, read from the child and verified in the transcript** (a tool result, not only the
model's claim). Inside the role's Bash tool: `TYPESAFE_API_KEY=<absent>; CLAUDE_CODE_CHILD_SESSION=1;
CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1`. The runtime's record shows `CHILD_SESSION` **absent** from the
environment `claude.exe` received. So **Claude Code sets `CLAUDE_CODE_CHILD_SESSION=1` on its own tool
subprocesses**, and the role session itself, launched without it, **wrote a transcript**.
- This is a **T-161 data point**, and only that. V-073 already records that this variable does not cause the
  missing transcript, and I do not claim a mechanism.
- It does say that any session launched **from inside a Claude Code tool** inherits `CHILD=1`.

**Your hooks did not touch the role session:**
- `active-session.json` was last written at 01:57:03Z, before the run, and does not contain the role's session
  id;
- the knowledge DB, read-only, has **0** rows naming the role session across the 4 session columns. Control:
  this seat's own session id names 110.

---

## 5. What went wrong, and what the rows found

**5.1 A real defect in layer 2, found by CA-4h's redirection probe.** Git for Windows marks a linked
worktree's `.git` pointer **hidden**, and on Windows `writeFileSync` cannot create-and-truncate a hidden file
(`EPERM`). My first probe failed as `role-threw`, because the probe's own write failed. The same call was the
**restore's**. So layer 2 could not have put back **exactly the file this channel is about**, and would have
reported it unrestored. Fixed: `writeBack()` rewrites an existing file in place (`r+`, truncate, write). The
probe now writes the way a real role can. Found by running it, not by reading it.

**5.2 Developer error entries, set before being asked (both accepted by the planner earlier):**
1. `9ed674c`'s false "no compare-and-swap" comment. It is fixed here as CA-10.1 and was seen red.
2. The design's "closes hooks and config", when it closed repo-local config only. It is fixed here as layer 0
   (R7), with R11–R13 found as siblings.

A third was conceded on the release commit: `/sync` fix mode re-rendered views from a stale branch record,
which made PR #101 conflict. It was repaired at `5a1309e`.

**5.3 Near-misses, caught in-process by me before any artefact, so not numbered:**
- **G-040 in my own test.** The win32 row asserted `killNote` did not match `/swept|killed|SIGKILL/`. It went
  red on the sentence "…are NOT swept…", a scan matching the sentence that forbids the thing. The row now
  asserts **equality** with an exported constant.
- **The spawn-site classifier asked a different question.** It named the nearest `const r = spawnSync(…)`,
  not the enclosing function, and its own unclassified-call rule failed on it. Fixed to count a variable only
  when it holds a function.
- **Two invalid measurement attempts, both of which ran nothing:**
  - a heredoc ate `${…}`;
  - `--setupFiles` is not a vitest CLI flag.

  The CA-9 driver also failed to transform twice (top-level await as `cjs`, a `C:/` ESM import) before any
  `claude` was launched.

---

## 6. CA-12 — the full suite, twice, and both runs are reported

| Run | Window (UTC) | `SUITE_EXIT` (unpiped) | Result | Peers (ListAgents) |
|---|---|---|---|---|
| 1 | 02:14:39 → 02:17:12 | **1** | 74/74 files, 1096 passed, 2 skipped; **1 unhandled `[vitest-worker]: Timeout calling "onTaskUpdate"`** (G-042's signature). Vitest named **no** file or test. | before: all idle. During: **worktrees-82 BUSY**, by Probe's listing at ~02:14:48Z. worktrees-82 is recorded as the "A2A-Hub planner seat (non-SIA work)": provenance is its own messages → planner → Probe, and Aaron's assignment is unconfirmed. After: worktrees-82 busy. |
| 2 | 02:21:29 → 02:23:54 | **0** | 74/74, 1096 passed, 2 skipped, no error | before: worktrees-82 idle, planner **busy**; after: all idle |

**What separates the hypotheses, and what does not:**
- **Measured:** each harness file's worst event-loop block (`monitorEventLoopDelay`, a harness-only run, all
  green):

  | File | Worst block | |
  |---|---|---|
  | `cli.test.ts` | 5096 ms | pre-existing |
  | `runtime.test.ts` | 4492 ms | pre-existing |
  | `config-channel.test.ts` | 4287 ms | new |
  | `refwatch-stage.test.ts` | 3911 ms | |
  | `process-role.test.ts` | 3318 ms | new |

  The new files block **less than** the worst pre-existing file, and their wall times are large (90 s and
  63 s). The table is kept at `…/scratchpad/eld-harness.txt`.
- **Probe's reading, which I accept:** birpc's 60 s default RPC timeout cannot be reached by a ~5 s per-worker
  block. So "a new test blocks its worker" is ruled out, and both surviving hypotheses are **load**: external
  (worktrees-82), or the suite's own (A adds ~153 s of process and git spawning at full parallelism).
- **Not separated:**
  - one green at full parallelism is consistent with external load, but does not rule out self-load, and an
    intermittent fault predicts the same pair;
  - I did not run `--maxWorkers=1` or the base-suite comparison.

  **Both are open for QA's CA-12.**

**`/sync --check` at the frozen tree** (rebuilt to `eee9f10` first, then the commit is the only change):
**exit 1**, 24 passed, 3 warnings, **3 issues, 0 skipped**:
- `prd-version`;
- `summary-version` (views v0.44.0 at rev 84: the known post-release re-render, owned by the planner under
  D-032);
- `retirements` (ENTITIES.md names `dream` and `reflection queue`: the known T-169 item).

**None is in a file this candidate changes** (the changed-file list in §0 has no `.agents/`, PRD, README or
ENTITIES; checked with `git diff --name-only`).

**GitNexus `detect_changes`, before commit:** CRITICAL scope, with 80 changed symbols, 44 affected and 9 files.
Every affected flow is inside the harness module, the same blast radius that `impact` on `git()` (CRITICAL, 23)
and `StubDeveloper` (HIGH, 16) reported before editing. The index is this worktree's own, built at the start of
the build.

---

## 7. Deviations from the criteria's wording, each with its reason

- **Layer 1's `core.hooksPath` is the null device, not a "runtime-owned empty dir".** A directory outside the
  repository is writable by a role, and a layer the role can fill is removable. Measured on Git for Windows,
  from both MSYS and Node: the null device silences hooks and a global filter, and the control ran both.
- **The claude shim form is native.** The planner and Probe re-derived this and folded it in as CA-2.4 and U6.
  The JS-entry form is exercised only by a planted shim.
- **The machine-wide system path** is `GIT_CONFIG_SYSTEM` when set. Otherwise it is **derived** (Git for
  Windows: three levels above `git --exec-path`, then `etc/gitconfig`; elsewhere `/etc/gitconfig`), because
  asking git would be a call that reads system config under layer 0. It was probed via `GIT_CONFIG_SYSTEM`
  only, and the derived default is **unprobed**.
- **Findings on a failed loop live inside `FAILED.md`** (§1), not in a separate file, because D2 and D4 assert
  a clean tree except `FAILED.md`.

---

## 8. Stated limits, carried into the loop's own output

- **win32:** the normal-exit tree kill is unavailable (no job object; T-174). The compare-then-call window on
  the generated config is **open on that path**, narrowed by R17, R20 and R18 but not closed.
- `taskkill /T` walks parent links from a live root. **A double-forked grandchild on the win32 timeout path is
  unmeasured by me**; that is QA's [mine] measurement, and I do not claim it covered.
- The runtime cannot see: network egress (U1), writes outside the repository other than the deliverable
  (U2), or descendants that escape the tree (U3).
- **Unprobed channels:** index, submodules, reflog. Channels **recorded, not repaired**: HEAD and index made
  unreadable (R14).
- The Claude adapter's permission profile is **defence in depth, not enforcement**.

---

## 9. Authority recorded

- **Design branch push** (`ae87fc6`): Aaron in my session, "Yes, push ae87fc6". One link.
- **v0.44.1 release push** (`19563a2`, fast-forward): Aaron in my session, "Yes, push 19563a2".
- **View-restore repair push** (`5a1309e`): Aaron in my session, "Yes, push 5a1309e".
- **CA-9 real run:** Aaron in my session, "Yes, run it once".
- **This candidate:** **not pushed.** It waits for Aaron's word in my session.

---

## 10. Next

QA scores `3b19287` against `c9947c5`. The rows I could not produce here:
- **CI's Linux run:** CA-6's POSIX rows read as *passed*, CA-5 on git 2.55;
- the mutants listed in §3;
- the double-fork measurement;
- the `gpg.program` liveness control;
- the CRLF `ls-files --eol` comparison;
- an include in `config.worktree`.

Candidate B (`T-155`) starts from A's accepted SHA.
