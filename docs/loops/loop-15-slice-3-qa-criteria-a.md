# Loop 15 slice three — QA acceptance criteria for CANDIDATE A, written before it exists

**By:** Probe (QA seat, record session **79**) · **Date:** 2026-09-23 (UTC) · **Model:** Opus 5.5
(`claude-opus-5-5[1m]`).
**Candidate A's scope** (`loop-15-slice-3-rulings-1.md` R5, at `origin/master` `30d0560`):
- async `run`;
- `ProcessRole` with a constructed environment;
- the config/hooks window and the overrides;
- `role-timeout`;
- the preflight refusals;
- `R_t` with its schema;
- P1–P4 and P7 from `loop-15-slice-3-developer-design.md` at `ae87fc6`.

The scope also carries R3's parseable unrunnable block and R4's known-negative. In rulings-1's words,
it is "locally complete: a real role runs, and it cannot execute code in the runtime or leave without
a record."
**Built on:** G-045's accepted candidate (`9ed674c`, QA report 1 at `76c728a`). A is built on the
release head that follows it.
**Candidate:** none exists. No branch on `origin` carries candidate A at the time of this commit;
`git for-each-ref refs/remotes/origin` was read after a fetch. **These criteria are not widened after a
verdict.** Amendments before a candidate is frozen are new commits that cite this one.

**Independent reproduction done before relying on the design's §2.3** (rulings-1: "The QA seat
reproduces it independently before it is scored"). My own script, on git `2.54.0.windows.1`, used
runtime-style calls (`status --porcelain`, `add --`, `commit --no-verify --no-gpg-sign`, `tag -a`),
with every planted program appending its name to one marker file outside the repository:

| Planted | No overrides (control) | `-c core.hooksPath=<empty> -c core.fsmonitor=false` |
|---|---|---|
| `.git/hooks/post-commit` | executed ×1 | ×0 |
| `.git/hooks/reference-transaction` | executed ×10 | ×0 |
| `core.fsmonitor` in `.git/config` | executed ×6. It fires on `add` and `commit` too, not only `status` | ×0 |
| **`filter.<x>.clean` in GLOBAL config + work-tree `.gitattributes`** | — | **executed ×3, overrides ON** |
| the same, with `GIT_CONFIG_GLOBAL=<empty file>` and `GIT_CONFIG_NOSYSTEM=1` | — | ×0 |

Rows 1–3 reproduce the developer's finding. **Rows 4–5 are new** and are the basis of CA-4c. Global
config was simulated with `GIT_CONFIG_GLOBAL` pointing at a scratch file. The real `~/.gitconfig` was
not written; `git config --global --get filter.probe.clean` returns nothing.

**Rulings folded in before any candidate:** `loop-15-slice-3-rulings-2.md` (`origin/docs/slice-3-rulings-2`
at `8aba549`) rules R7–R9 and R11–R13 as A rows and moves R10 (`E_t`) to candidate B. CA-4c, CA-4e,
CA-4f, CA-4g and CA-3(c) below carry them.

**R11, measured pre-candidate on git `2.54.0.windows.1`** with `HOME` pointed at an empty scratch dir,
`XDG_CONFIG_HOME` at a scratch dir holding `git/config` with a `filter.<x>.clean`, and a work-tree
`.gitattributes`:
- without `GIT_CONFIG_GLOBAL`, the XDG filter executed ×2;
- with `GIT_CONFIG_GLOBAL=<empty>` and `GIT_CONFIG_NOSYSTEM=1`, it executed ×0.

That is one git version, and the row re-measures it at the candidate on both versions (CA-5's pair).

---

## 1. Fixed conditions, carried from `loop-15-slice-3-qa-criteria.md` §1 and not restated

The conditions are: frozen SHA, read-only; **tree moved** and **tree dirty** reported separately;
verdicts from exit codes only; full suite with `ListAgents` peers recorded beside it (T-168); CI run
id read from the run, not the rollup; nothing pushed without Aaron's direct word; no `add_gap` (R28);
every script and message written to a file first; mutation scripts assert the edit landed; `tsc
--noEmit` on every mutant, with a planted type-error control shown to fail.

**Method for reading tracked files by ref:** compare blob hashes (`MSYS_NO_PATHCONV=1 git rev-parse
<ref>:<path>` against `git hash-object`) with a known-different pair as the control. Do not use
PowerShell 5.1's `git show | Out-File` (dispatch-2 §4).

**R2 is moved to candidate B by R10.** For candidate A the QA seat writes prose only. §6 keeps the
fit table that produced R10.

---

## 2. Acceptance rows

Every row states its **pass**, its **fail**, and the **control** that makes any absence in it
discriminating. Rows marked **[mine]** are observables the rulings do not state. They are returned
in §5 for a ruling and are **not scored until ruled**.

### CA-1 — `run` may return a promise; every window closes AFTER the process exits

**Pass:** `runStage` awaits `run`. The ref window, the config/hooks window and the allowlist
verdict are computed after the role's process has exited.
**Probe:** a role process that sleeps ~2s, **then** writes a ref and plants a hook, then exits. The
stage must fail on both.
**Control:** the same role writing nothing reaches a clean stage verdict. If a window closed at spawn
return instead of at exit, the delayed writes are invisible, and this pair discriminates.
**Fail:** any window computed while the process runs; or a delayed write that goes unreported.

### CA-2 — `ProcessRole`: a constructed environment and no shell (P3)

**Pass, all of the following:**
1. With `TYPESAFE_API_KEY` **set in the parent** to a unique sentinel, the child's own printed
   environment (in its deliverable) does not contain the variable or the sentinel value. **The
   control is the transition:** the same sentinel under a name on the env allowlist *does* reach the
   child. An absence that has never been shown capable of reporting presence is not scored.
2. A non-allowlisted variable set in the parent is absent in the child, by the same control.
3. `CLAUDE_CODE_CHILD_SESSION` set in the parent is absent in the child;
   `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1` is present. This is the design's stated behaviour. Brief
   §5's ban on a `CHILD=1` *warning* is not engaged: this removes the variable, it does not warn
   on it.
4. **No shell:** an argv element containing `^`, `$HOME`, a backslash and a space reaches the child
   byte-for-byte, as shown by the child echoing its argv into the deliverable.
   **Amendment to `ce8e6a1`, before any candidate (planner's note from Forge's plan).** On this
   machine `claude` is an npm shim (`.cmd`/`.ps1`), and Node refuses to spawn a `.cmd` without a
   shell (CVE-2024-27980). The adapter therefore resolves the shim to its JS entry and spawns
   `node <entry> <args>`. The byte-for-byte row runs through **that resolved spawn**, and it
   records the spawned executable and argv[0..1], so the path exercised is the real one. It is not a
   test-only direct spawn.
5. **Fail closed when the shim cannot be resolved.** An adapter pointed at a shim whose JS entry
   cannot be found (a planted `.cmd` with no resolvable entry) refuses **before any tag**, and the
   refusal **names the path**. It never falls back to a shell: the probe plants a marker-writing
   `.cmd` and asserts the marker is absent. **Control:** a resolvable shim in the same position
   spawns and writes its deliverable. A native executable (`claude.exe`) is spawned directly, and
   if none is available on this machine that case is reported **unprobed**, not asserted.

**Fail:** the key or sentinel reaches the child; any assertion here reads inherited
`process.env` without constructing and then checking it (G-044); a shell anywhere in the spawn.

### CA-3 — preflight refusals, before any tag

**Pass:**
- (a) a `ProcessRole` with `refWatch: false` is refused;
- (b) a target repository with **any** remote configured is refused while a `ProcessRole` is present;
- (c) **R13:** a target repository whose local config carries **any** `include.path` or `includeIf.*`
  at base is refused, and the refusal **names the key**. There is one probe per form: `include.path`,
  `includeIf.gitdir:…path`, and an include in `config.worktree` in a linked worktree (CA-4h). The
  control is the same repository with the key removed, which proceeds past preflight.

Both refusals come **before any tag, commit or artefact**: after the refusal, `loop-*` tags are
absent, HEAD is unmoved and there is no `artifacts/` directory, each read by the same expression as
the control.
**Controls:** the same loop with stub roles and the watch off proceeds past preflight, and so does
the same repository with its remote removed.
**Fail:** a refusal after any write; a refusal without a named reason; or a limit that goes
unstated ("a role can still push to an explicit URL").

### CA-4 — the config/hooks channel is closed (P1), in two layers, each shown load-bearing

**CA-4a, detection and restore (layer 2).** A role that plants each of `post-commit`,
`reference-transaction` and `core.fsmonitor`, **one per run**:
- is failed with `stage-changed-config`, refused and never retried;
- **the planted program did not run**: its marker, outside the repository, is absent;
- the snapshot files are restored **by bytes**, with each file's hash equal to its pre-stage hash.

**Control:** the same planted program, invoked through the same git call **without** the runtime,
writes its marker. That is the design's discriminating control, and it is required.

**Ordering, evidenced from the code path and not from the probe going green:** the comparison reads
files with **no git call at all**, and the restore runs before `closeRefWindow` and before anything
reads HEAD. G-045's R2 whitelist applies: no repository read between the fault and the completed
restore except the restore's own file I/O.

**CA-4b, the overrides (layer 1) on EVERY runtime git call.** Every git invocation the runtime makes
goes through one function that carries the overrides. This is evidenced by a scan that is itself
validated both ways (G-040, T-156): it finds a planted bare `execFileSync("git"` and passes the real
source.

**Each layer must be shown load-bearing, or its redundancy stated.** There are two mutants:
- M-L1 removes the overrides;
- M-L2 removes the window.

Each must turn at least one row red.

**Layer 1's visible job (§5.2, RULED; amendment to `770bcb9`).** Layer 1 is kept as defence in
depth against a **layer-2 ordering defect**. The row, CA-4b-L1, uses one mutant (M-L2-order) that
moves a runtime git read **ahead of** layer 2's restore, run with the hook or `core.fsmonitor`
planted:
- with layer 1 on, the planted program does **not** execute;
- with layer 1 also removed (M-L2-order + M-L1), it **does**.

Both runs are in the same row, with the marker read by the same expression. **If no such mutant can
be constructed** against the candidate's code, the verdict records layer 1 as **redundant by
construction**. It does not claim layer 1 protects anything.

**CA-4c — layer 0 (R7): runtime git calls do not read the machine's git config.** Every runtime git
call runs with `GIT_CONFIG_GLOBAL=<runtime-owned empty file>` and `GIT_CONFIG_NOSYSTEM=1`, and
passes identity with `-c user.name=… -c user.email=…`.
- **Discriminating, in the same test (R7):** a planted global `filter.<x>.clean` plus a work-tree
  `.gitattributes` **executes without layer 0 and does not execute with it.** The global file is
  simulated through the test's own environment and is never the real one.
- **Identity:** the runtime's own commits still carry the configured name and email, read back from
  `git log -1 --format=%an%n%ae`. A layer 0 that silences global config and then cannot commit is
  not a pass.
- **Every call:** the same single-function evidence as CA-4b. M-L0, which drops layer 0, must turn
  this row red.

**CA-4e — R11, the XDG path.** A program planted in `$XDG_CONFIG_HOME/git/config` does **not
execute** with layer 0 on, and **does** execute with it off, in the same test and on both CA-5 git
versions. `HOME` and `XDG_CONFIG_HOME` both point at scratch dirs, so the real files cannot
contribute in either direction.

**CA-4f — R8, the report-only window over machine-wide config.**
- Before and after each stage, the runtime hashes every file git would read as global or system
  config: `~/.gitconfig`, `$XDG_CONFIG_HOME/git/config` (or its default), and the system config path
  git reports on this platform.
- Any change is recorded in the loop's output as a finding naming **the path and both hashes**. It
  **fails nothing and restores nothing.**
- **Probe:** a role that appends to each watched path in turn. Each path is **simulated** by
  pointing `HOME` and `XDG_CONFIG_HOME` at scratch dirs **for the role process and the runtime
  alike**, and never by writing the real files (U4). Each write is reported with that path. After
  the loop the file still holds the role's bytes, which shows nothing was restored.
- **Control:** a role that writes nothing produces no such finding.
- **The system path:** if the runtime cannot redirect it without writing a real system file, that
  path is reported as unprobed rather than asserted.
- **Fail:** a watched path missing from the list; a change restored; a change that fails the stage;
  the hashing done with a git call that layer 0 does not cover.

**CA-4g — R9, the attribute half, measured and not argued.** A work-tree `.gitattributes` with
`filter=<x>`, with the program half placed at each of global, XDG, and repo-local config in turn, is
run with layer 0 on and off:
- repo-local: layer 2 refuses it, and the program does not run;
- global and XDG: layer 0 stops execution.

The report states the observed outcome for each of the six cells. Design §2.3's P5 sentence is
**withdrawn** (R9) and is not quoted as evidence anywhere.

**CA-4h — R12, linked worktrees.**
- Layer 2 resolves `git rev-parse --git-common-dir` and `--git-dir` **once, at preflight, before
  any role runs**.
- It snapshots `<common>/config`, `<common>/hooks/*`, `<common>/info/*` and
  `<git-dir>/config.worktree`.
- **Probe, run in a linked worktree** (where `.git` is a file) with `extensions.worktreeConfig`
  set: plant, one per run, a hook in the common dir, a program-valued key in `config.worktree`, and
  one in the common `config`. Each is detected, restored by bytes, and does not execute.
- **Redirection probe:** a role that rewrites the worktree's `.git` file to point at a different
  git dir does not move the snapshot, which is resolved at preflight. The change is reported, not
  silently followed.
- **Fail:** any path resolved after a role has run.

**CA-4d — snapshot scope stated.** The candidate states which files layer 2 snapshots, and whether
`.git/config.worktree`, `.git/info/attributes`, and a planted `include.path` pointing outside the
repository are covered. Each claimed file is shown by one planted change being detected.

### CA-5 — R4's known-negative: a clean stub loop leaves every stage's window unchanged

**Pass:** an ordinary, non-malicious stub loop completes with every stage's config/hooks window
reporting **no change**, on **both**:
- this machine's git (`2.54.0.windows.1` at the time of writing);
- **CI's git** (`2.55.0` in run `35802025272`).

Each version is cited from its own output: the CI log's `git version` line, and a recorded
`git --version` locally.

**Per-stage snapshots, and evidence that they matter.** The candidate reports, measured by hashing
`.git/config` around each runtime step, whether any runtime between-stage write touches it (tags,
commits, branch creation, upstream tracking).
- If one does, a mutant that snapshots at loop start must turn this row red.
- If none does, the report says so, and the per-stage choice is recorded as **untested by this
  loop's runtime**, not as verified.

**Fail:** a known-negative run on one git version only; a detector validated only against planted
positives.

### CA-6 — `role-timeout` (P4)

**Pass:** a role that sleeps past its bound is killed **with its process tree**. This is shown by a
grandchild the role spawned no longer being alive after the stage (PID checked by the probe, not by
the runtime's own claim). The stage fails with `role-timeout`, and **the windows still close and
restore**: a hook planted before the sleep is restored by bytes and recorded.
**Control:** the same role under a bound it does not exceed completes, and its grandchild runs to
completion.
**Fail:** a surviving grandchild reported as killed; a timeout that skips the windows; a timeout
recorded under another code.

### CA-7 — `R_t`: schema, retry, and disagreement with the measurement

**Pass:**
1. A missing, unparseable or schema-invalid `R_t` goes through the **capped** schema retry and ends
   in `FAILED.md` with a non-zero exit (V-040's shape).
2. An `R_t.changes` that claims a path the measured diff does not contain, **or** omits one it
   does, is recorded **as a finding** in the iteration record. The control is an `R_t` that matches
   the diff, which records no such finding.
3. A non-zero role exit with a valid `R_t` is **recorded beside it** and handed to the done-gate as
   data. It neither fails the stage silently nor is accepted silently.
4. `R_t` is never trusted: the done-gate's inputs are the runtime's measured diffstat and exit codes.

**Fail:** any `R_t` field consumed as fact.

### CA-8 — G-045 and the config channel compose (P2)

**Pass:** one stage deletes the checked-out branch **and** plants a hook. It ends in a `LoopResult`
with **both** findings recorded, `FAILED.md` on disk, HEAD resolving, `main` at its window value,
and the hook's marker absent.
**Fail:** either finding masking the other; an exception out of `runLoop`.

### CA-9 — the first real `ProcessRole` run (P7), which is A4b's evidence

**Pass:** one loop against a scratch clone with **no remote**, run by the developer seat, with the
transcript kept.
- A4b is met here if a model-backed role completed a stage **inside** the runtime, evidenced by the
  **runtime's own artefacts**: the `LoopResult`, the iteration directory, `R_t`, and the transcript
  path the runtime recorded.
- **The transcript (§5.3, RULED; amendment to `770bcb9`).** A missing transcript is a **reported
  absence, not a CA-9 fail.** The row is scored on the runtime's own artefacts: the iteration
  directory, the `LoopResult`, `R_t`, and the windows. The transcript is evidence of the role's
  reasoning, not of the runtime's behaviour. It is never reconstructed.
- **The child's actual environment is recorded either way:** whether
  `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1` was set, and whether `CLAUDE_CODE_CHILD_SESSION` was
  absent. It is read from the child's own printed environment (CA-2), not from the runtime's
  configuration. **A missing transcript with both set correctly is a T-161 data point, and the
  report names it as one.**
- **This run is an observation, not acceptance** (V-046, V-048). The quality of the role's output
  is not scored.
- **The adapter's flags are pinned by a test that reads the installed `claude --help`.** On CI,
  where `claude` is not installed, that test **skips with a reason**; it never passes. A skip read
  as a pass is rule 11.

**Fail:** the role runs beside the runtime; the only evidence is narrative; a missing transcript
reported as present.

### CA-10 — the repair half from QA report 1 §5, ruled by the planner as rows

1. **`restoreDeletedDeferred` uses a compare-and-swap.** It passes `update-ref <ref> <sha>
   0000000000000000000000000000000000000000`, measured here as exit 0 when the ref is absent and
   exit 128 when it is present. The false "no compare-and-swap" comment goes.
   - **Probe:** a `RefWatch` test that recreates the deleted ref at a **different** sha between
     `compare()` and `restoreDeletedDeferred()`. The restore must **refuse and report**, and must
     not overwrite.
   - **Caveat from report 1:** the second write in `rollBack → restore()` must still succeed after
     the early restore, because the ref now exists. D4 stays green.
2. **D4 asserts `main`'s VALUE**, equal to the value the window opened on, and the vacuous
   `expect(preLoop).toMatch(sha)` goes. `rollBack`'s `reset --hard stageBase` corrects a wrong early
   restore, so the value assertion must be shown able to fail on **the end state**. The mutant for
   this changes where the end state lands (for example, the reset target), not the early restore.
   That mutant turns D4 red.

### CA-11 — the channel denominator, written out (A3 carried)

The candidate's output and the loop's close-out carry this table, with no channel summarised as a
count:

| Channel | Status to report |
|---|---|
| refs | probed (slice two) |
| HEAD after a deleted ref | probed (G-045) |
| hooks (`.git/hooks`) | probed by this candidate, CA-4 |
| config in the repository (`.git/config`, and any others CA-4d names) | probed by this candidate, CA-4 |
| config in linked-worktree locations (common dir, `config.worktree`) | probed by this candidate, CA-4h |
| config outside the repository (global, XDG, system) | runtime reads closed by layer 0 (CA-4c, CA-4e); role writes **hashed and reported, not restored** (CA-4f) |
| includes present at base | refused at preflight (CA-3c) |
| index | unprobed |
| submodules | unprobed |
| reflog | unprobed |
| outside `.git/` (writes, network, surviving processes) | invisible to the runtime; see §3 |

F11's R6 sentence ("clean **on the probed channels only** …") appears in the loop's own output. It
carries R8's amendment ("…everything outside `.git/`, **except the global/system git config files,
which are hashed and reported, not restored**"), and it names the same channels this table marks
probed.

### CA-12 — suite and CI (A8 carried)

At the candidate: a full suite with the exit code captured unpiped, `ListAgents` peers recorded
before and after, and the peers told before and after. A CI run id for the **candidate head**, read
from the run itself. The same CI run supplies CA-5's second git version.

### CA-13 — no version bump (D-031)

`git diff <base>..<candidate> -- package.json open-brain/package.json CHANGELOG.md` is empty.

---

## 3. Declared unrunnable, BEFORE any candidate (R3 and its refinement)

The verdict function reads this block **at this file's commit SHA**. An id in `E_t`'s `invisible[]`
that is not listed here counts as `not_evaluated`. These are limits of the runtime or of this seat,
not acceptance rows.

```qa-unrunnable
U1: network egress by a role process — the runtime has no network view and this seat does not capture traffic
U2: writes by a role outside the repository other than its runtime-chosen deliverable path — not observable by the runtime
U3: child processes that outlive the role outside the role-timeout path (CA-6 covers the timeout path only)
U4: writes to the REAL ~/.gitconfig or system gitconfig — machine-wide, Aaron's files; CA-4c is probed via GIT_CONFIG_GLOBAL simulation only
U5: the quality or correctness of the model-backed role's output in the first real run (CA-9) — an observation, not acceptance
```

---

## 4. Procedure on hand-over

1. Fetch. Confirm the candidate SHA, its parent, and that it descends from the G-045 release head.
   Record **tree moved** and **tree dirty** separately.
2. Rebuild before measuring anything from the built CLI.
3. Run every row's control **before** its negative, in the same run and by the same expression.
4. Mutants: M-L0, M-L1, M-L2, the CA-4h resolve-late mutant (paths resolved after the stage), the
   CA-5 snapshot-timing mutant (if applicable), and the CA-10 mutants. All type-clean, and the type
   checker shown able to fail.
5. Full suite with peers recorded; CI run id for the candidate head.
6. Report, in prose (R10). Nothing is pushed without Aaron's direct word.

---

## 5. Returned to the planner, numbered — all three now RULED

1. ~~CA-4c: is global/system config in candidate A?~~ **RULED by rulings-2 R7–R9 and R11–R13:** it is
   in A as layer 0, with a report-only window, and the P5 claim is withdrawn. It is folded into
   CA-4c/e/f/g/h and CA-3c above.
2. **RULED (planner, 2026-09-23): layer 1 stays as defence in depth against a layer-2 ordering
   defect, and it gets the CA-4b-L1 row. If that row cannot be built, layer 1 is recorded as redundant
   by construction.** The original question:
   **CA-4b's "each layer load-bearing" clause.** If layer 2 restores before any git call, layer 1
   may protect nothing a test can see. That would make it the defence-in-depth the design already
   calls the host permission profile: honest if stated, rot if carried as coverage. **Ruling asked:**
   require a red row for M-L1, or accept a stated redundancy?
3. **RULED (planner, 2026-09-23): a reported absence, scored on the runtime's artefacts, with the
   child's environment recorded.** The original question: **CA-9's transcript clause** depends on T-161's unknown per-launch loss. **Ruling asked:** is an
   absent transcript a CA-9 fail, or a reported absence with the row scored on the runtime artefacts
   (as written)?

## 6. `E_t` fit — the table that produced R10 (the obligation now binds at candidate B)

`EvidenceSchema` (`schema.ts:156`), against what this seat actually recorded in QA report 1:

| Field / rule | What I observed | Fit |
|---|---|---|
| `loop` matches `/^t\d{3,}$/` | human-seat loops are named `15-slice-3`; there is no `tNNN` id | **does not fit**. A value would be invented |
| `acceptance[].status` ∈ met/unmet/partial/not_evaluated | A1: met by reproduction, **temporal order attributed** | **flattens** to met (overclaims) or partial (underclaims) |
| same | A8: CI run **did not exist yet** (pre-registration) | **flattens** to unmet, which R3 turns into would-not-merge for a candidate with no defect |
| same | A4–A7: **out of this candidate's scope** | **flattens** to not_evaluated. R3's carve-out is "unrunnable", not "out of scope" |
| `runtime_checks` holds build and unit | suite exit code **plus** peer states, CI run id, `/sync` | partial. Peers and CI have no field; `notes` would carry prose |
| `requirements`, `regressions`, `gaps`, `notes` | fits | fits |

**Ruled by R10, for candidate B:**
- (a) the loop id admits human-seat ids;
- (b) attribution is a field (`order: shown | attributed`), not a status;
- (c) `pending` is its own status and makes the verdict `undefined`;
- (d) out-of-scope ids are declared in the same parseable block as the unrunnable ids, as a
  separate list.

This file lists only in-scope rows, so for A it declares no out-of-scope ids.

---

## 7. PROPOSED amendment 3: the max-effort re-read, before any candidate. UNRULED.

**Nothing in this section binds until the planner rules on it, item by item.** The rows in §2 as
committed at `96738a8` are the binding text until then. This section exists because §2 through §6
were written at effort **medium**: the host transcript records `"effort":"medium"` on every entry
from 2026-09-22T23:50:58Z to 2026-09-23T01:02:20Z, and all four of this seat's tracked commits fall
inside that run. The re-read was done at **max** (from 01:02:27Z). Every claim below was **measured**
on git `2.54.0.windows.1` in scratch repositories, and none was argued. Where a first instrument
lied, that is said.

### 7.1 Measured today, against the runtime as it stands (the `9ed674c` harness source, now v0.44.1)

The probe is the same `probe.mts` as QA report 1: a stub role that, after its stub work, writes one
file. The positive control in the same run (a role creating `refs/anything`) fails cleanly with
`stage-changed-ref` and writes `FAILED.md`.

| A role writes garbage to | Where the runtime dies | `LoopResult` | `FAILED.md` |
|---|---|---|---|
| `.git/config` | `GitFailed` from `for-each-ref` in `RefWatch.compare` | **none** | **absent** |
| `.git/HEAD` | `GitFailed` from `for-each-ref` ("not a git repository") | **none** | **absent** |
| `.git/index` | plain `Error: Command failed: git status --porcelain=v1 -z …` from `changedPaths` | **none** | **absent** |

**These are G-045's failure class through three more channels:** a role's one-line act, and no
record. Git's own behaviour was measured first: garbage `.git/config`, garbage `.git/HEAD` and
`core.repositoryformatversion=99` each make `symbolic-ref` and `rev-parse` exit 128. A **deleted**
`.git/config` does **not** (both exit 0). A garbage `.git/index` leaves `rev-parse` working and makes
`status` exit 128.

### 7.2 Proposed items

1. **CA-1: attribution.** The failure is recorded against **the stage whose process wrote**, with
   both deltas in that one stage's record. As written, a runtime that did not await and caught the
   delayed writes in the *next* stage's window would satisfy "the stage must fail on both."
2. **CA-2.4: the probe element also carries a double quote, a newline and a trailing backslash.**
   Those are the characters a real prompt contains and the ones Windows argv quoting gets wrong.
   **[mine]:** if the prompt travels as argv, a prompt over the platform's command-line limit fails
   closed; it is never truncated.
3. **CA-2.5: "before any tag" is an observable I added without marking it [mine].** It is returned
   now: keep preflight resolution, or relax the row to "refused with a record that names the path,
   and no shell fallback."
4. **CA-2.6 [mine], NEW: the checks run role-authored code with the runtime's full environment.**
   `runCheck` (`checks.ts:122–128`) calls `spawnSync` with **no `env` option**, so `npm --prefix
   open-brain run build` and `… test` inherit `process.env`. In live mode that includes
   `TYPESAFE_API_KEY`. Those commands execute the target's package scripts and test files, which a
   model-backed developer has just written. CA-2 keeps the key out of the **role** process; this
   path reaches it one step later. The class rule: **every process the runtime spawns that runs
   role-authored code gets a constructed environment.**
   - **Probe:** a role-authored test file writes its own environment to a file outside the
     repository. With the sentinel set in the parent, the key is absent; an allowlisted variable is
     present (the control).
5. **CA-3: "Both refusals" becomes "All three refusals"** (a, b and c).
6. **CA-4a: the restore is judged on the file SET as well as the bytes.**
   - The snapshot scope's file set equals the pre-stage set: created files are removed, deleted
     files are restored, and each file's bytes are equal.
   - **Add probes:** garbage `.git/config`, and `core.repositoryformatversion=99`. Each must end in
     a `LoopResult` with `stage-changed-config` and `FAILED.md`, with no exception. **Today both
     crash with no record** (§7.1).
   - This is the **behavioural** test of layer 2's "restore before any git call": M-L2-order must
     turn it red. That is stronger than reading the code path, and it is what CA-4b-L1 lacked.
7. **CA-4a: attribute the marker.** The planted program records a value that only a runtime git call
   carries (for example, the layer-0 `GIT_CONFIG_GLOBAL` path). The probe role makes no git call
   after planting. Otherwise a role's own git call writes the marker and fails a correct runtime.
8. **CA-4b: the scan is a parser, and it covers every spawn site.** `git.ts` has **four** git spawn
   sites:
   - `git()` at :86, via `execFileSync`;
   - `gitTry` at :115, via `spawnSync`;
   - `changedPaths` at :146 and `committedPaths` at :192, both raw `execFileSync` with `"git"` on its
     own line.

   `checks.ts:122` is a fifth process spawn. **The single-line pattern `execFileSync("git"` that
   CA-4b names misses :146 and :192.** That is G-040's too-narrow scan, in this seat's own criteria.
   The scan walks the TypeScript AST for every `child_process` call. It is validated against a
   planted call of each API form, **including a multi-line one**, and against the real source.
9. **CA-4b/4c [mine]: the layers' reach into descendant processes.** Layer 0 is environment-based,
   so it reaches every descendant git process, including a check's (the build's postbuild stamping
   runs git). Layer 1 as `-c` arguments reaches only the runtime's direct calls. **Require:** git
   processes under the checks run under layer 0. The candidate also states layer 1's reach, or
   applies it through `GIT_CONFIG_COUNT`/`KEY`/`VALUE`, which descendants inherit.
10. **CA-4c [mine]: layer 0 also drops non-program settings, and that changes what the runtime sees
    and commits.** This machine's system config carries `core.autocrlf=true`, `core.symlinks`,
    `core.fscache`, `filter.lfs.{clean,smudge,process,required=true}`, `init.defaultbranch`,
    `credential.helper`, `diff.astextplain.textconv` and `http.*`. **Measured** on a target cloned
    under the machine's config with **no `.gitattributes`**:
    - an **untouched** file reads ` M` under layer 0, and clean under the machine's config;
    - a role's CRLF save is **committed as CRLF** under layer 0 (`ls-files --eol`: `i/crlf`), where
      the machine's git commits LF (`i/lf`).

    **A clone of THIS repo is not affected:** its `.gitattributes` sets `text` and `eol=lf`
    (`git check-attr`). **Every harness test is blind to this,** because `fixture.ts`'s `makeRepo`
    sets `core.autocrlf=false` locally. **Require:** the candidate enumerates the keys layer 0
    removes that change an observation or a commit. For each, it either carries the value explicitly
    (a non-program key such as `core.autocrlf` or `core.symlinks`, read at preflight and passed by
    `-c`), or refuses the target (for example, one using `filter=lfs`), or states a limit. CA-5 then
    adds a known-negative on a target cloned under the machine's own config, without
    `.gitattributes`.
    *First instrument, disclosed:* `grep -c $'\r'` counted lines, not carriage returns. It read 3
    for an LF blob, and `od -c` plus `git ls-files --eol` replaced it before anything was concluded.
11. **CA-4h: the `.git` pointer file.** **Measured:** rewriting a linked worktree's `.git` file sends
    the next `git` call into **another repository**. `rev-parse --absolute-git-dir` moved from
    `md-repo/.git/worktrees/md-wt` to `md-other/.git`. Resolving at preflight does not stop the
    runtime's later calls from following the pointer. **Require:** every runtime git call after
    preflight pins the resolved dirs (`GIT_DIR`/`GIT_WORK_TREE` or `--git-dir`/`--work-tree`), or
    the pointer file is in layer 2's snapshot and restored before any call. The probe shows the
    runtime's post-stage tags and refs land in the **original** repository.
12. **CA-6: a heartbeat as well as a PID.** The grandchild appends to a file every 200ms, and the
    file stops growing (read ≥1s after the stage). A PID alone can be reused, and a heartbeat cannot
    be faked by a new process.
13. **CA-9: the `claude --help` pin must RUN locally.** Where `claude` is installed, the test is
    reported **passed, not skipped**. Skip detection can be wrong in both directions.
14. **CA-12:** `/sync` at the candidate, in the QA tree, **after `gitnexus analyze`** (rule 13,
    V-047), with 0 skipped and the exit code recorded. QA report 1 ran `/sync` with the index 10
    commits behind.
15. **§3 block:**
    - **U6:** native `claude.exe`. This machine has only the npm shim (`which -a claude claude.exe`).
    - **U4** is widened to XDG and system config via `HOME`/`XDG_CONFIG_HOME`/`GIT_CONFIG_SYSTEM`
      simulation.
    - `%ProgramData%\Git\config` is **not read** by git `2.54.0.windows.1`: 0 references in `git.exe`
      (ASCII and UTF-16LE detectors each validated on a known positive, `GIT_CONFIG_NOSYSTEM` and
      `USERPROFILE`), and 0 executions with it redirected. It is therefore not a watched path for
      this version.
16. **SCOPE: returned, not chosen.** Candidate A's sentence says a role "cannot … leave without a
    record." §7.1 shows it can, today, through `.git/HEAD` and `.git/index`, and neither is in A's
    scope. (`.git/config` is, via item 6.) There are two honest options, and the choice is the
    planner's:
    - **(a)** A adds a **backstop**: every git failure after a role has run ends in a `LoopResult`
      and `FAILED.md` (a record, not a repair), with the three §7.1 probes as its rows;
    - **(b)** A's sentence is qualified, and CA-11 records HEAD-file and index as **"probed: crash
      without record"**.

    This seat does not narrow it by itself.
17. **CA-11 table:** add **HEAD file (content)** and **index**, both "probed §7.1: crash without
    record at v0.44.1". Index was "unprobed".
