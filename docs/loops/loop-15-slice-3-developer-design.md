# Loop 15 slice three — developer design proposal: §3.2 (a real role) and `T-155` (shadow merge gate)

**By:** Forge (developer seat), **record session 80**. The greeting said 7; `T-164` explains why that
number was not used. · **Date:** 2026-09-22
**Model:** Opus 5.5 (`claude-opus-5-5[1m]`). This supersedes the brief's "Opus 5" line, on Aaron's
move reported by the planner.
**Base:** `5759008`, which is the G-045 candidate `9ed674c` plus its handoff. It is **not**
`origin/master`, which does not carry the G-045 repair (the planner's instruction, 2026-09-22).
**Dispatched by:** `loop-15-slice-3-dispatch-2.md` §3 (origin/master `9788064`).
**Status:** **A proposal for a ruling. Nothing here is built.** Criteria come before a candidate. No
build or suite run was made while Probe scores `9ed674c`.

> **What this slice is for, in the PRD's terms.** The problem statement is that sessions start cold,
> lessons from past mistakes are forgotten, and each session repeats the same discovery. This slice
> puts a real model-backed role inside the HoH runtime. The evidence state that answers that
> problem is verified behaviour kept as preservation constraints and open gaps kept as update
> targets. With a real role running, that state crosses a loop boundary mechanically instead of
> being rebuilt from prose. `T-155` is the instrument that counts where the runtime's judgement
> disagrees with Aaron's, before anything built on that judgement is trusted.

**Read before writing:** the tracked PRD at `origin/master` (read with `git show`); the README at
`origin/master`; the Step-Back **artifact**, Parts 1–5. The vault copy stops at Part 3. The brief;
`docs/HOH-JEV.md`; `roles.ts`, `runtime.ts`, `schema.ts` and `git.ts` at this base; `T-155`,
`T-165`, `T-168` and `T-170` at state rev 79.

---

## 0. The design in five sentences

1. **One role becomes real in this slice: the developer.** The planner's `D_t` is read from a file
   the planner seat writes. QA stays a separate seat. A model-backed QA is not proposed here.
2. **A real role is an external process, and the runtime treats it as adversarial by construction.**
   Every boundary is enforced by the runtime observing the repository afterwards, never by prompt
   text. Step-Back §5.1 is the evidence: `CLAUDE.md`, delivered at 100% reliability, did not change
   behaviour. A role prompt will not do better.
3. **The role adapter is one argv template with an environment the runtime constructs.** Claude Code
   is the first adapter. The interface is harness-agnostic, so `T-165`'s shadow developer (Cursor
   first, then DeepSeek) is a second adapter and needs no second runtime.
4. **`T-155` attaches to the merges Aaron actually makes, which are the human-seat loops' PRs.** The
   runtime never reaches a merge (`D-019`). A would-merge verdict computed from a machine-readable
   `E_t` only means something if it is written at a PR candidate before Aaron decides.
5. **Two new enforcement channels, one of them measured today.** A role process can plant git hooks
   and config that **execute inside the runtime's own git calls**. I observed this in a scratch
   repository (§2.3). §3.2 cannot be safe without closing it, and closing it reuses G-045's
   *restore before any read* ordering.

---

## 1. What must be true of G-045's acceptance for this design to hold

Named first, so that a QA rejection of `9ed674c` shows up as upstream of this design.

| # | Must hold | Why this design depends on it |
|---|---|---|
| G1 | **Every ref delta a stage makes ends in a `LoopResult`, never in an exception out of `runLoop`.** That includes deleting the checked-out branch. The result must carry `stage-changed-ref`, and `FAILED.md` must be on disk. | A model-backed role runs arbitrary git. Under a stub, a crash with no record was a withheld probe. Under a real role it is an ordinary afternoon. |
| G2 | **The end state is restored, not merely reported:** HEAD resolves, it resolves to the stage base, and the deleted ref is back at its `before` SHA. | Every later stage and the next loop's base read HEAD. The developer handoff §3–4 is where the *ordering fix alone turns a loud crash into a silent pass* was caught, and only by a row asserting the end state. |
| G3 | **The restore reads nothing from the repository through git before the snapshot is restored.** | §2.3 extends exactly this ordering to `.git/config` and `.git/hooks`, where a *read* (`git status`) is itself the execution vector. If G-045 lands with a different ordering, the §2.3 hook is rebased onto that one, and the principle does not change. |
| G4 | **The QA verdict states that G-045 closes one channel of five-plus** (index, hooks, config, submodules, reflog). | This design closes two more: hooks and config. It leaves three open and says so. A green G-045 must not be read as "safe against repository states", which the brief §2 forbids anyway. |

**If QA rejects `9ed674c`:** §2.1 and §3 are unaffected. §2.3 waits for whatever G-045 repair
lands, and the real developer adapter (§2.2) **must not run** until G1–G2 hold. A real role pointed
at a runtime that crashes without a record produces observations nobody can read. That is the
brief's own reason for ordering G-045 first.

---

## 2. §3.2 — a real model-backed role through the runtime

### 2.1 The interface change: `run` may return a promise

`RoleSession.run(ctx): unknown` is synchronous today (`roles.ts:60`), and `runStage` calls it inline
(`runtime.ts:656`). A spawned process is asynchronous. The proposal:

- `run(ctx): unknown | Promise<unknown>`. `runStage` becomes `async` and awaits it. The ref window,
  the config window and the allowlist verdict are all still computed **after the process has
  exited**, never while it runs.
- `runLoop`'s synchronous foreign-role refusal is **unchanged**. It sits before `runLoopInner`
  (`runtime.ts:242–257`), and the ordering claim it defends does not depend on `run`.
- Stubs keep returning plain values. Their tests do not change except where `runStage` is awaited.

### 2.2 The role process: `ProcessRole`, one adapter per harness

A `ProcessRole` is constructed **in `roles.ts`** and registers its exact class, so its provenance
is `isRuntimeConstructed` (`roles.ts:84–113`). It holds:

- **`argv`**: an array, spawned with `execFile`/`spawn` and **no shell**. This is the shared.md rule,
  because the shell eats `^`, `$` and backslashes.
- **`env`**: **constructed, never inherited**, per G-044. There is an explicit allowlist (PATH, the
  home and profile variables the harness needs, and the harness's own auth variables). The runtime
  asserts `TYPESAFE_API_KEY` is absent from the child's environment, **in a test that sets it in
  the parent first**, so the absence discriminates the transition. `CLAUDE_CODE_CHILD_SESSION` is
  removed and `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1` is set, so the role's transcript exists as
  evidence (`T-161`'s mirror case). The transcript path is recorded in the iteration directory.
- **`prompt`**: generated, not hand-maintained. It holds the path to `D_t` in the repository, the
  path to `.agents/roles/<role>.md` and `shared.md` (HOH-JEV §6.4: prompts point at the role files
  and do not restate them), the allowlist as data, and the deliverable path. Step-Back §5.2 found
  that prose rots and tools stay correct, so **the prompt carries no rule the runtime relies on.**
  Every rule the runtime relies on is a check.
- **`deliverable`**: a JSON file the role writes to a runtime-chosen path **outside the repository**
  (under the OS temp directory). That way it is neither a repository write nor an allowlist question.
  If it is missing, unparseable or schema-invalid, the capped schema retry applies, exactly as for
  `D_t`/`E_t` today.
- **`timeout`**: a wall-clock bound. Expiry kills the process tree and fails the stage with a new
  code, **`role-timeout`**. The ref, config and allowlist windows **still close and still restore
  afterwards**, because a killed role is exactly the one most likely to leave a half-written state.
- **`exit code`**: recorded. A non-zero exit with a valid deliverable is **not** silently accepted.
  It is recorded beside the deliverable and handed to the done-gate as data. It does not fail the
  stage, for the same reason red tests do not (`runtime.ts:25–28`): it is evidence.

**The Claude Code adapter** is `claude -p` with JSON output, a turn cap, and a permission profile
that denies network git and writes outside the repository. **The exact flags are not claimed in
this proposal.** At build time they are read from the installed `claude --help`, and a test pins
them, so a flag that changes upstream fails the suite rather than the loop. The permission profile
is **defence in depth, not enforcement**: Step-Back §5.2 found two of fourteen tool descriptions
false, and a host deny rule that pattern-matches a Bash command can be routed around (`sh -c`). The
runtime **observes the effect** regardless of what the profile claims.

**The developer's deliverable** gets a schema, where today it has none (`schema: null`,
`runtime.ts:570`): **`R_t`** holds `{loop, summary, changes[{path, what}], commands[{argv,
exit_code}], claims[]}`. It is **never trusted**. The done-gate's state is still the runtime's
measured diffstat and exit codes (`runtime.ts:870–879`). `R_t` adds only the "recent commands"
HOH-JEV §4 lists as done-gate state and the runtime does not have today. **A disagreement between
`R_t.changes` and the measured diff is recorded as a finding**, which is Step-Back §4.3's *build
the thing that can disagree with you* applied to the role's own report.

**Refusals at preflight**, before any tag:
- **a `ProcessRole` with the ref-watch off** is refused. The existing rule only refuses *foreign*
  roles with the watch off, and a runtime-constructed process role is still a process;
- **a target repository with any remote configured** is refused while a `ProcessRole` is present.
  This is structural: the README already says to point `--repo` at a scratch clone, and this makes
  it a check. **Stated limit:** a role can still push to an explicit URL, and nothing inside the
  runtime can see the network.

**What the runtime still cannot see, stated in the loop's own output (see §4, F11):** writes
outside the repository, reads of anything on disk, network traffic, and child processes that
outlive the role. Containment below the process boundary (a container or a sandbox) is **not
proposed**. It is named so its absence is not read as coverage.

### 2.3 The new channel: config and hooks execute inside the runtime's git calls

**Measured 2026-09-22 in a scratch repository under this session's scratchpad, git 2.54.0.windows.1:**

| Planted by a "role" | Runtime-style call | Executed? |
|---|---|---|
| `.git/hooks/post-commit` | `git commit --no-verify --no-gpg-sign` (the exact `commitPaths` flags, `git.ts:344`) | **yes** |
| `.git/hooks/reference-transaction` | the same commit, then `git tag -a` | **yes** (10 invocations) |
| `core.fsmonitor = <script>` in `.git/config` | `git status --porcelain` (what `enforceAllowlist` runs) | **yes** |
| all three, with `-c core.hooksPath=<empty dir> -c core.fsmonitor=false` | the same calls | **no, none of the three** |
| control: the same repository, overrides removed | `git status` | **yes**, so the "no" above discriminates |

`--no-verify` skips only `pre-commit` and `commit-msg`. **A role that plants a hook or a
program-valued config key gets code execution in the runtime's process, with the runtime's
environment, which in live mode holds `TYPESAFE_API_KEY`.** With stubs this was unreachable. With a
real role it is one line of shell. **It was not found by reading. It was found by running the four
lines above.**

**Proposed repair, in two layers:**

1. **Structural, on every runtime git call:** `git.ts` prefixes `-c core.hooksPath=<runtime-owned
   empty dir> -c core.fsmonitor=false`, and passes `--no-verify` where it already does. The probe
   shows this silences all three.
2. **A config/hooks window, like the ref window:** before a stage, snapshot the bytes of
   `.git/config`, `.git/info/*` and `.git/hooks/*`. After it, compare **by reading files, with no
   git call at all**, then restore from the snapshot, **before** `closeRefWindow` and before
   anything reads HEAD. This is G-045's ordering (§1 G3) applied one channel earlier. A change is a
   stage failure with a new code, **`stage-changed-config`**, refused and never retried, like a ref
   change.

**Why both layers.** Layer 1 alone is an allowlist of dangerous keys, and program-valued config is
a class (`core.fsmonitor`, `core.sshCommand`, `diff.external`, `filter.<x>.clean`/`smudge`,
credential helpers, and whatever git adds next). Enumerating the class is the failure mode shared.md
names, *a finding reported against a line is usually a finding about a class*. Layer 2 refuses the
whole class by detecting **any** change, and layer 1 means the detection itself runs no role code.
**Stated limit:** `.gitattributes` is a tracked file. A `filter=` attribute is inert without its
config half, which layer 2 refuses, but that is an argument, not a probe, and it is listed for the
criteria (§5, P5).

**Channels after this design:** refs (slice two), HEAD after a deleted ref (G-045), hooks and config
(this). **Still unprobed:** index, submodules, reflog, and everything outside `.git/`.

---

## 3. `T-155` — the shadow merge gate

### 3.1 Where the merge actually is

`T-155`'s note says *"at every point where a merge to master could occur."* **In the runtime there
is no such point, by design** (`D-019`, `runtime.ts:32–34`). The merges Aaron makes are the
human-seat loops' PRs: this loop, Loop 16's three candidates, and so on. **A shadow gate that only
runs on runtime iterations would count disagreements on merges nobody makes.** So the gate has one
verdict function and two entry points:

- **(a) Human-seat loops, where the count comes from.** The QA seat emits, beside its prose report,
  an `E_t` JSON valid against the existing `EvidenceSchema` for the frozen candidate.
  `harness shadow-verdict --candidate <sha> --evidence <path>` computes the verdict and writes it.
  **This is a request of the QA seat, and it is the planner's to rule.** Without it, entry point (a)
  produces only `UNDEFINED`, which is honest and counts nothing.
- **(b) Runtime iterations.** After the QA stage, the runtime computes the same verdict and writes
  it into the evidence commit beside `G_done.json`. A stub QA's `E_t` yields **`UNDEFINED`**, by
  rule and not by threshold, because a stub's evidence "establishes nothing" (`roles.ts:222`).

### 3.2 The verdict: deterministic code, not a model

`would-merge | would-not-merge | undefined`, computed from `policies/merge.json`, which is data
validated with zod like the other two policies:

| Input | Rule |
|---|---|
| `E_t` absent, from a stub, or schema-invalid | **`undefined`** |
| a gate that was asked and could not be reached | **`undefined`**, never agreement (`T-155`) |
| build or unit exit code ≠ 0 | `would-not-merge` |
| any acceptance `unmet` or `partial`; any `regressions` | `would-not-merge` |
| any acceptance `not_evaluated` | `would-not-merge`. **Ruling asked:** `T-155` says missing evidence is `UNDEFINED`. I read an `E_t` that says *"I did not look at A3"* as evidence **of a gap**, not missing evidence. The alternative reading is defensible. |
| a gate verdict `reject` or `halt` | `would-not-merge` |
| otherwise | `would-merge` |

**Jev does not decide the merge.** It may be an *input*, through the §3.3 QA-scoring gate once
calibrated. HOH-JEV §3: *typed output guarantees the interface, not truth.*

**What the verdict cannot see, recorded as a field on every row:** CI (the runtime has no network),
Aaron's reading of the diff, and the question nobody wrote down (HOH-JEV §6.2). A disagreement
explained by CI is still a disagreement. The row says CI was invisible, so a reader can attribute
the disagreement.

### 3.3 Written before Aaron decides, structurally

- The verdict row is **committed on the candidate's branch**, after the candidate and before the PR
  is merged. A merge commit necessarily postdates its parents, so the ordering is a property of the
  git graph and not of anyone's discipline. For a rejected PR the row still exists on the branch.
- Row: `{loop, candidate_sha, evidence_sha|null, verdict, reasons[], inputs{checks, acceptance,
  regressions, gates[{gate, model_resolved, verdict}]}, invisible[], at, developer{harness, model},
  qa{seat|stub|model}}`.
- `developer` and `qa` are there for `T-165`. They are the only fields that change when the
  developer is Cursor or DeepSeek instead of Forge.

### 3.4 Aaron's decision: derived, not asserted (rule 14)

A separate command outside the runtime (the runtime has no network), run by the planner seat after
a fetch:

- **merged**: the candidate SHA is an ancestor of `origin/master` (`git merge-base --is-ancestor`,
  local only);
- **rejected**: the loop record names a later candidate for the same loop, or the PR is closed
  unmerged. The second needs `gh`, which is the planner's network and not the runtime's;
- **pending**: neither, which is counted as neither.

It appends a decision row to a tracked **append-only** ledger, `docs/loops/shadow-merge-ledger.jsonl`,
joined on `candidate_sha`. **A `/sync` check** fails when a decision row has no verdict row, when
the verdict row is not an ancestor-side commit of the decision (it was written after), or when a
line was edited rather than appended (checked against the file at `HEAD~`).

### 3.5 The count, and what makes it mean something

Reported, never collapsed into one number: **agree, disagree (would-merge→rejected and
would-not-merge→merged, kept apart), undefined, pending**, plus **the defect denominator**: how many
rows' candidates were rejected by QA or carried an `unmet` acceptance. `T-155` says it directly:
*zero disagreements with no defects in the stream is not evidence of anything.* Loop 16 alone had
two rejected candidates. **Backfilling Loops 14–16 from their QA reports** would make those rows
the first real denominator, but the verdicts would then be written *after* Aaron decided. They go in
a separate, labelled **`retrospective`** section and are **never** summed with prospective rows.

### 3.6 How `T-165` points a shadow developer at it

The same tracked `D_t` goes to a second `ProcessRole` adapter in its own scratch clone at the same
base, through the same runtime, with the same windows. Its candidate gets a verdict row with
`developer.harness` set and `human_decision: n/a`. It never becomes a PR. **The comparison `T-165`
needs is between two verdict rows on one `D_t`, not against Aaron.** That design is `T-165`'s, and
is gated on this one. **Stated so it is not assumed:** the Cursor adapter is phase 2 (`D-030`), and
`T-046`, `G-001` and `G-009` stand between it and a runnable argv.

---

## 4. F11: what a green live loop means. The developer's draft; the planner rules

> **A green live loop means:** the runtime completed; build and unit exited 0; both gates were
> consulted live with the resolved model recorded; the ref window and the config window were clean
> at every stage; `E_t` came from a seat that did not build the candidate. **It does not mean** the
> candidate is correct, safe or mergeable. That is the shadow verdict's question, then Aaron's. **It
> does not mean** the role stayed inside the repository: writes outside it, the network, and
> surviving child processes are invisible to the runtime and are listed as such in the loop's own
> output.

---

## 5. Observables this design makes testable, for QA's criteria (QA writes the criteria)

- **P1.** A role that plants each of `post-commit`, `reference-transaction` and `core.fsmonitor` is
  failed with `stage-changed-config`. The planted script **did not run**: an artifact it would have
  written is absent, **and the same script without the overrides does write it** (discriminating
  control).
- **P2.** Deleting the checked-out branch while also planting a hook still ends in a `LoopResult`
  with both findings recorded. G-045 and §2.3 compose.
- **P3.** A `ProcessRole` whose parent environment holds `TYPESAFE_API_KEY` spawns a child that does
  not have it, shown by the child printing its own environment to its deliverable.
- **P4.** `role-timeout`: a role that sleeps past the bound is killed, and the windows still close
  and restore.
- **P5.** A tracked `.gitattributes` with `filter=x` and no config half changes nothing the runtime
  executes. This is the argument in §2.3, which is not yet probed.
- **P6.** A verdict row cannot be appended after its decision row without `/sync` failing, and
  `undefined` rows appear in neither the agree nor the disagree count.
- **P7.** The first real `ProcessRole` run is **one** loop against a scratch clone with no remote,
  run by the developer, with the transcript kept. **The first run is an observation, not
  acceptance**, as V-046 and V-048 established.

---

## 6. Not proposed, and why

- **A model-backed QA stage.** Acceptance by a seat that did not build the candidate is the project's
  best result (Step-Back §2.1 item 2, §5.3). Replacing that seat before the shadow count exists would
  remove the instrument the count is measured against.
- **A model-backed planner stage.** Nothing in the brief asks for it, and `D_t` is already a file.
- **Jev thresholds (§3.3 of the brief).** This design produces the **real diffs** they are to be
  calibrated against. It does not calibrate them.
- **A version bump.** Per `D-031` (PR #98), a loop candidate carries none.

## 7. Rulings asked, one at a time, in order

1. **Developer only** as the real role this slice (§0.1, §6)?
2. **The QA seat emits an `E_t` JSON** at each human-seat candidate, so `T-155` has a stream (§3.1a)?
3. **`not_evaluated` → `would-not-merge`** rather than `undefined` (§3.2)?
4. **Config/hooks window plus overrides** as part of §3.2's candidate rather than a separate repair
   (§2.3)? I recommend yes. A real role without it is code execution in the runtime's environment,
   and the live-mode environment holds the API key.

**Where I looked for an objection and did not find one:** whether `T-155` could live entirely inside
the runtime. It cannot, because the runtime has no merge point and no network. The split in §3.1 and
§3.4 follows from `D-019`, not from preference.
