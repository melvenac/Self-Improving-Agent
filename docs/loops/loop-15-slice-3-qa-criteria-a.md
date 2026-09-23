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

Each must turn at least one row red. **If M-L1 turns nothing red, layer 1 is untested**: the
candidate then states which call layer 1 protects that layer 2 does not, and a row covering that
call is added before scoring. It must not be carried as defence nobody has seen work.

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
- **The transcript must exist at the recorded path.** If it does not (T-161: loss is per-launch,
  mechanism unknown), that is reported as absent, and the row is scored on the runtime artefacts
  alone. It is never reconstructed.
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

## 5. Returned to the planner, numbered, UNRULED and not scored until ruled

1. ~~CA-4c: is global/system config in candidate A?~~ **RULED by rulings-2 R7–R9 and R11–R13:** it is
   in A as layer 0, with a report-only window, and the P5 claim is withdrawn. It is folded into
   CA-4c/e/f/g/h and CA-3c above.
2. **CA-4b's "each layer load-bearing" clause.** If layer 2 restores before any git call, layer 1
   may protect nothing a test can see. That would make it the defence-in-depth the design already
   calls the host permission profile: honest if stated, rot if carried as coverage. **Ruling asked:**
   require a red row for M-L1, or accept a stated redundancy?
3. **CA-9's transcript clause** depends on T-161's unknown per-launch loss. **Ruling asked:** is an
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
