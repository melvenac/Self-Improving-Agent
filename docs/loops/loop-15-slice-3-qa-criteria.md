# Loop 15 slice three — QA acceptance criteria, written before a candidate exists

**By:** Probe (QA seat, fresh session, this loop; record session **79** — the greeting's per-worktree
counter shows #5 and is not used here, per brief §4 and `T-164`) · **Date:** 2026-09-21 ·
**Derived from:** `docs/loops/loop-15-slice-3-brief.md` read in full at `eb14d09`, with
`.agents/roles/qa.md` (`876029d`) and `.agents/roles/shared.md` (`024dfa4`) as loaded into this
session's greeting.
**Base:** `origin/master` at `eb14d09` — record **rev 64**, `v0.44.0`. The rev is read from
`.agents/state.json` (`"revision": 64`), not from the brief, per brief header.
**Candidate:** none frozen, and none evaluated by this seat. This file is committed before any
candidate is frozen so the criteria cannot be fitted to what arrives. **They are not widened after
a verdict.**

**On A1's red observation — ATTRIBUTED, NOT VERIFIED BY THIS SEAT.** The planner reports that
`G-045`'s A1 is already red in the developer's tree as of the time these criteria were written, so
that they are not read later as pre-loop guesses. **This seat has not observed that run.** It is
recorded here as the planner's report, with the distinction kept, because a claim relayed without
its provenance is how three agents spent an hour tonight citing a uuid mapping none of them had
read. A later seat wanting A1's red as evidence takes it from the developer's tree at its own SHA,
not from this line.

> **The only window in which this file may change is before a candidate is frozen.** Amendments
> after that point are recorded as new commits that cite, and do not rewrite, this one.

---

## 1. Fixed conditions for the evaluation

1. **Criteria before candidate.** This file is committed at its own SHA before the developer's
   first commit on `loop/15-slice-3` exists (brief §6).
2. **Frozen SHA, read-only.** QA runs read-only against the frozen candidate SHA and reports
   **tree moved** and **tree dirty** as two separate conditions (brief §6). They are separate
   because they fail for different reasons and a single "tree not clean" line hides which.
3. **Deterministic verdicts come from process exit codes and nothing else.** "A command printing
   'all tests passed' while exiting 1 is a failure" (brief §6, verbatim). Where a runner's exit
   code is read through a pipeline, the pipeline's own status is not the command's — the exit code
   is captured before any trimming.
4. **Full suite alone at every candidate** (brief §6). Nothing else runs on this machine during a
   scored suite run. `G-042`'s heartbeat timeout is load-dependent, so a concurrent process does
   not merely slow the run, it can manufacture the failure being measured.
5. **CI run id, not the rollup.** "Read the CI run id rather than the empty rollup — registration
   lags ~3.5 minutes" (brief §6). An empty `statusCheckRollup` is **pre-registration**, never a
   pass.
6. **Nothing is pushed from this seat.** The planner pushes by the SHA this seat reports, on
   Aaron's word for that push, and every push names a branch tip.
7. **No `add_gap` by any seat until `T-158` lands** (brief §4). Findings travel as verified
   entries, handoff rows and tasks.
8. **`git show <ref>:<path>` is mangled by MSYS in the Bash tool** (brief §4). `ref:path` reads use
   PowerShell, or `MSYS_NO_PATHCONV=1`. Every such read is checked against a control — see §3.
9. **Every script and every message is written to a file before it runs or is sent**, including
   one-liners, and mutation scripts assert the edit landed before anything runs against it.

---

## 2. Acceptance criteria, one per row in the brief

Each row's pass clause is derived from the brief's words. Where I have added an observable the
brief does not state, it is marked **[mine]** and repeated in §9 for the planner to rule on rather
than applied as though it were the brief's.

### A1 — `G-045` is **seen red first**

**Brief's words (§2):** "The `update-ref -d` probe, run against the built candidate. The repair is
not written until that probe has been observed producing the crash described above."

**Pass:** the probe is observed producing the crash **before** the repair exists, and the
observation is recorded at a SHA that precedes the repair commit. The crash described above is
five simultaneous conditions, and all five are asserted:

| # | Condition (brief §2) | Observable |
|---|---|---|
| 1 | no `LoopResult` | the runtime returns no `LoopResult` value |
| 2 | no `FAILED.md` | no `FAILED.md` written |
| 3 | HEAD unresolvable | `git rev-parse HEAD` exits non-zero |
| 4 | `main` gone | `refs/heads/main` absent |
| 5 | tree staged | the index carries staged entries |

**Fail:** the repair commit precedes any recorded red observation; or fewer than five conditions are
asserted; or the red run is asserted only by the absence of an artefact.

**The paired positive control is REQUIRED (`R1`).** Conditions 2 and 4 are absence checks, and
brief §4 requires "a control that discriminates the transition being verified … a value that
*differs* across the change you are asserting." The row does not pass on the negative alone: a
positive run must write `FAILED.md` and have `refs/heads/main` present, **read by the same path
expression as the negative, in the same row**. An absence assertion that has never been shown
capable of reporting presence is decoration.

### A2 — the repair restores before anything reads the repository

**Brief's words (§2):** "The restore reads nothing from the repository until the snapshot is fully
restored: after HEAD's name is put back, **HEAD must resolve, or the ref is restored from the
snapshot before any read**. Restore the deferred delta — the watch already holds `before` — ahead of
anything that reads HEAD, not only inside `rollBack`."

**Pass:** after the repair, the A1 probe produces a `LoopResult` and a `FAILED.md`, HEAD resolves,
`refs/heads/main` is present at its pre-run value, and the deferred-ref restore runs **ahead of**
`enforceAllowlist`, not only inside `rollBack`. The ordering is evidenced from the code path, not
inferred from the probe going green — a probe can go green because the crash moved, not because the
order changed.

**Fail:** the probe goes green with the restore still only in `rollBack`; or `main` returns at a
different value than the snapshot holds; or `GitFailed` still escapes `runLoop` before the restore
on any path.

**"Any read" is a WHITELIST, not a blacklist (`R2` — ruled against my narrower reading).** I had
scoped this to *git invocations that resolve HEAD*. That was wrong, and wrong in a way this repo
already has a name for: classifying every git command by whether it resolves HEAD is a blacklist
nobody can enumerate, and it is `G-040`'s shape — a pattern too narrow, green because it did not
look. The row asserts the inversion instead: **no repository read of any kind between the fault and
the completed restore, except the restore's own ref plumbing.** The restore's own operations are
enumerable; the set of everything else is not. Evidence from the code path.

### A3 — the channel denominator stays **open**, and is enumerated

**Brief's words (§2):** "The channel denominator is unprobed: **index, hooks, config, submodules,
reflog.** `G-045` is one channel of five-plus. A green `G-045` row is not 'the runtime is safe
against repository states'; it is one named case closed."

**Pass (`R3` — enumeration REQUIRED):** the close-out states `G-045` as **one named case closed**,
and does not state or imply runtime safety against repository states generally. The five named
channels are each **written out** with explicit status:

| Channel | Status |
|---|---|
| index | unprobed |
| hooks | unprobed |
| config | unprobed |
| submodules | unprobed |
| reflog | unprobed |

**Fail:** any close-out sentence that generalises a green `G-045` to repository states as a class;
or the denominator recorded as a count, or as prose, without its members written out.

**Why the list and not a number (`R3`):** "named in the brief but not listed in the close-out" is
precisely how a denominator closes quietly — the reader sees one green channel and a sentence, and
the four unprobed ones evaporate.

### A4 — SPLIT into A4a and A4b (`R4`)

I had written these as one row, scoring a correctly refused role as a pass. **Ruled against:** kept
as one row, the loop can go green on refusals alone — which is the state slice one and slice two
are already in, and the state this slice exists to leave.

#### A4a — the runtime refused correctly

**Pass:** the runtime refuses what it was built to refuse when a real role produces it, and says so
— a `LoopResult`, and `FAILED.md` where the run failed. A role that produces a bad diff and is
correctly refused **passes this row**.

**Fail:** a refusal with no record; or an acceptance of something the allowlist forbids.

#### A4b — a model-backed role completed a stage **inside** the runtime

**Brief's words (§3.2):** "The roles are stubs today; this is the first loop where a model-backed
role runs inside the harness."

**Pass:** at least one role with a model behind it completes a stage **inside** the harness runtime,
evidenced by the runtime's own artefacts, not by a transcript or a seat's account of it.

**Fail:** the role runs beside the runtime rather than inside it; or the only evidence is narrative.

**A4b unmet is not a failure of the loop. Reporting A4a as though it were A4b is** (`R4`). The two
are never folded into one line in any report from this seat.

### A5 — `T-155`, the shadow merge gate, exists and is the instrument

**Brief's words (§3.2):** "`T-155` (the shadow merge gate) is now buildable and is the instrument:
the runtime records what it *would* have done at each merge and disagreements with Aaron are
counted." And §5: "Build `T-155` so a shadow developer can be pointed at it."

**Pass:** at each merge the runtime records the action it would have taken; the record is durable
(a tracked file or the DB, not stdout); and the counts are reported in **three categories**
(`R5`), never folded:

| Category | Meaning |
|---|---|
| AGREED | the gate's recorded would-do matches the action taken |
| DISAGREED | the gate's recorded would-do differs from the action taken |
| UNCONTEMPLATED | Aaron took an action the gate had no position on |

**The denominator is every merge decision the gate evaluated, agreed or not** — not the agreements.

**Fail:** the gate records only agreements; a count reported without its denominator; the record
exists only in a session's output; or `UNCONTEMPLATED` folded into `AGREED`.

**Why the third category (`R5`):** folding `UNCONTEMPLATED` into `AGREED` inflates the agreement
rate, and does it in the flattering direction — the failure this loop already knows by name from
both seats' fixtures last loop. The categories are built to survive a second consumer: `T-165`
counts an alternate harness's disagreements through this same gate.

### A6 — QA scoring through Jev, thresholds calibrated against **real** diffs

**Brief's words (§3.3):** "QA scoring through Jev, with thresholds calibrated **against real
diffs**, not synthetic ones. Slice two's one live Jev pair is the only prior observation; two gates
answering typed, `sent: true`, and the key reaching nothing."

**Pass (`R6`):** every threshold is derived from diffs produced by this loop's real roles; the row
reports **N**, **the diffs by SHA**, and **the observed spread**; and the live-call conditions from
slice two's one observation are re-asserted — gates answering typed, `sent: true`, and the key
reaching its endpoint. **Below N=5 the close-out states PROVISIONAL explicitly.**

**The word "calibrated" may not be used** while N is small (`R6`). One prior pair is not
calibration. No threshold is invented here to sound authoritative; what is forbidden is a row that
says "calibrated" and lets the reader supply their own N.

**Fail:** any threshold derived from a synthetic diff; a threshold reported without the diffs it
came from, or without N and the spread; a live-call claim made without evidence the key reached
anything; or "calibrated" used below N=5.

**Note, not a fail condition:** `G-044` is the standing reason a "no key" path must be proven by
constructing the environment and asserting the deletion did something, never by reading inherited
`process.env`. That gap cost a real API call from this seat's own role.

**[mine] — one prior observation is not a calibration set.** How many real diffs constitute a
calibrated threshold is unstated; §9.6.

### A7 — `F11` is answered **before** the first green live loop

**Brief's words (§3.4):** "`F11` — what a green live loop means. Write the answer before the first
green one, not after."

**Pass (`R7` — commit order is NECESSARY AND NOT SUFFICIENT):** both of the following, not either:

1. F11's answer is committed at a SHA that is an **ancestor of the candidate under evaluation**; and
2. the **CI run id** of the first green **postdates that commit**.

**Fail:** the answer lands after the first green; is amended after it; is written such that any
green run satisfies it; or precedence is claimed from commit order alone.

**Why both (`R7`):** commit order is rewritable and git timestamps are attacker-controlled by
anyone with a shell. The CI run id is the only externally-timestamped instrument this seat has, and
A8 already requires citing run ids — so the second clause costs nothing and is the one that
actually binds.

### A8 — suite and CI evidence

**Brief's words (§6):** "Run the full suite alone at every candidate, and read the CI run id rather
than the empty rollup — registration lags ~3.5 minutes. Loop 16's QA evidence all came from one
machine and CI found two faults in one file the first time it looked."

**Pass:** at every candidate, a full-suite run with nothing else running, reported with its **exit
code**; and a CI **run id** cited. An empty rollup is reported as pre-registration.

**Fail:** a suite run scored while anything else ran; a pass claimed from output text rather than
exit code; an empty rollup read as green.

### A9 — fixtures guarded in both directions, decoy lengths reported

**Brief's words (§6):** "Guard fixtures in both directions — not weakened, not stacked — and report
decoy lengths. Both seats built a flattering fixture within hours of each other last loop and both
caught their own."

**Pass:** every fixture is stated with the shape that could bias it in **either** direction, and
decoy lengths are reported as a range against the target's.

**Fail:** a fixture reported without its shape; or a result reported from a fixture whose decoys
were not measured.

---

## 3. Rules this seat holds itself to (brief §4)

- **Absence checks carry a discriminating control**, not merely a known-present string — a value
  that differs across the transition being asserted. Both halves matter: a known-present control
  catches a broken instrument, a discriminating control catches a move that did not happen. I hit
  the first half in this session — a mangled `ref:path` returned clean zeroes for three strings
  including one I had just proven present in six files, and only the impossible zero exposed it.
- **Deterministic checks over prompt-level instructions**, always.
- **A ruling with no acceptance row fires nowhere** — any ruling this loop produces that changes
  behaviour gets a row here, or it is an intention.
- **Nothing gates on a single `ListAgents` poll** — an early listing is indistinguishable from a
  seat that is not running. Measured this session: a peer's listing did not show this seat ~2
  minutes before it did, while this seat's listings showed both peers throughout.
- **A2A has no memory.** Anything a later session must read is in a tracked file before the
  exchange ends.
- **The record session number is the one the planner states**, never the greeting's per-worktree
  counter (`T-164`).

---

## 4. Scope fences — out of scope, named so absence is not read as oversight (brief §5)

The ranking gap (`G-026` amendment); `T-159` and the census price; registering the recall trigger
for production; **the transcript-loss mechanism (`T-161`)** — "the cause recorded at rev 62 is
falsified and the replacement is *per launch*, mechanism unknown … do not let a seat build the
`CHILD=1` warning, which would fire on every healthy session"; `G-042` on a second machine and the
`build-freshness` fix shape; **`T-165`**, which is *gated on* this loop's `T-155` and is not part
of it.

A finding in any of these areas is reported, not chased, and never scored as a row.

---

## 5. What I will report as a finding even though no row fails

1. **The record contradicted itself on the `CHILD=1` cause — reported at rev 64, repaired by the
   planner at rev 65 (PR #91), not yet merged when this file was written.** `T-161` had been
   rewritten to "the `CLAUDE_CODE_CHILD_SESSION` check would be a permanent false positive" while
   `G-044`'s Loop 16 amendment still prescribed `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1` as the
   fix. The repair amends the gap in place, leaves the superseded paragraph standing and marked
   from the clause where it goes wrong, and withdraws the prescribed fix as unvalidated. What
   survives: all three seats wrote no `.jsonl`, and three seats agreeing was one environment
   observed three times. What is false: the cause. **Any check in this family asserts the
   discriminating symptom, never the marker's presence** — which is the rule A1 and §9.1 apply to
   this loop's own absence conditions.
2. **~~`.agents/AGENT.md` declares the wrong seat~~ — WITHDRAWN, I was wrong.** The tracked file
   declares the seat for a checkout with no `.agents/AGENT.local.md` and says so at its line 14.
   This worktree has that override — untracked, `name: Probe`, `role: qa`, `partner: Forge` — which
   is why the greeting named this seat correctly. The mechanism worked; I reported the tracked
   default as a defect without checking for the override that supersedes it. Verified here rather
   than taken on the planner's word: the file exists, `git ls-files --error-unmatch` confirms it is
   untracked, and `AGENT.md` itself documents the precedence. Recorded because a withdrawn finding
   that is never written down gets rediscovered.
3. **The local CLI build is stale** (stamped `af90fce`, HEAD `eb14d09`). Hooks and the MCP server
   run from the main checkout and are unaffected, but no measurement here may be taken from this
   tree's built CLI without rebuilding first.
4. **"RUN THE FULL SUITE ALONE" WAS NOT SATISFIED, AND MAY NOT BE SATISFIABLE AS WRITTEN.** Three
   agent seats share this one machine. During the baseline run the planner seat was demonstrably
   active — it delivered a message to this session mid-run — and the forge seat was live. The run
   produced `G-042`'s signature twice plus a 5s test timeout, and nothing else.
   **Why this matters beyond bookkeeping:** `G-042` has been recorded since session 65 as
   "measured on one machine only", nine sightings, with the open question being whether it is
   *this machine*. The machine has never been idle for any of those measurements — it has had two
   or three agent sessions on it. Concurrent seat activity is a candidate mechanism that fits every
   sighting and has not been considered, and it is *also* why CI has never shown the signature: CI
   runs alone.
   **This is a finding, not a row.** `G-042` on a second machine is out of scope (brief §5) and I
   am not chasing it. What is in scope is that A8's "alone" clause needs the other seats asserted
   idle, not assumed — raised as §9.8, unruled, and A8 is scored as the brief writes it until then.

---

## 6. What cannot be verified now, stated so nobody inherits it as settled

1. **Whether the runtime is safe against repository states as a class.** Five-plus channels,
   one probed (§A3).
2. **Whether `G-042` is anything but this machine.** CI has never shown the heartbeat signature;
   CI has shown two other load-dependent faults in the same file. Every suite row this loop is
   one-machine evidence until CI says otherwise.
3. **Whether a seat applies what a trigger surfaces.** Unchanged and unmeasured since Loop 16.

---

## 7. Baseline, measured in this tree before any candidate exists

- **Base:** `eb14d09`, record rev 64 (`"revision": 64` read from `.agents/state.json`), `v0.44.0`.
- **Tree:** clean at base — `git status --porcelain` returned 0 entries before and after the move
  from `0bf0597`.
- **Move controls:** discriminating `T-165` 0 → 1 across `0bf0597` → `eb14d09`; known-present
  control `uuid` 17 → 24 (non-zero both sides, so the instrument was live).
- **Node:** v22.23.2.
- **Build:** stale at base — stamped `af90fce`, HEAD `eb14d09`. Rebuild before any measurement
  taken from this tree's built CLI.
- **GitNexus index:** behind HEAD at base.
- **Full suite at base: RED. `SUITE_EXIT=1`.** Captured from the runner's own exit status, not
  from the printed summary, and not through a pipe. Run started 03:11:21, duration 159.61s.
  - `Test Files  1 failed | 70 passed (71)`
  - `Tests  1 failed | 1030 passed (1031)`
  - `Errors  2 errors` — both `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`, raised as
    **unhandled errors**. This is `G-042`'s exact signature: vitest exits non-zero on an unhandled
    error without failing a test.
  - The one failing test is **not an assertion failure**: `tree-currency.test.ts >
    describeTreeCurrency > reports current when the clone is level with origin/master` —
    `Error: Test timed out in 5000ms`. That file took 33518ms for 13 tests, with individual tests
    at 1.6–7.4s.
  - **So the base is red for two timing-related reasons and zero logic reasons.** No candidate may
    be scored against an assumed-green base, and a candidate that leaves this state unchanged has
    not regressed anything.
  - **This run was NOT alone, and the claim that it was would have been false.** See §5.4.

## 8. Procedure order on hand-over

1. Confirm the candidate SHA and that it is frozen; record **tree moved** and **tree dirty**
   separately.
2. Rebuild before anything is measured from the built CLI.
3. A1's red observation must already exist at a SHA preceding the repair — check the order first,
   because it cannot be reconstructed later.
4. Full suite alone; exit code captured before any trimming.
5. CI run id, not the rollup; wait out registration rather than reading an empty rollup as a pass.
6. Report. Nothing is pushed from this seat.

## 9. Items returned to the planner — all seven **RULED by Atlas (planner seat, record session 77) on 2026-09-21, before any candidate existed**

> A Wednesday seat does not need to re-ask any of these. They are settled, with the ruler and the
> date named, and the two that went against this seat are marked as such in the rows themselves.

These were observables I added where the brief's row states none. They were returned numbered
rather than applied, and are folded into the rows above only now that each carries a ruling. **Two
rulings went against what I had written**, and both are recorded as such in the row itself rather
than quietly replaced.

| # | Item | Ruling | Where it landed |
|---|---|---|---|
| 1 | A1's absence conditions need a paired positive control | `R1` — **required** | A1, binding |
| 2 | A2: does "any read" mean any git invocation, or only one resolving HEAD? | `R2` — **against me**; whitelist, not blacklist | A2, inverted |
| 3 | A3: enumerate the five channels with status? | `R3` — **yes**, written out | A3, as a table |
| 4 | A4: is a correctly refused role a pass? | `R4` — **splits the row** | A4a / A4b |
| 5 | A5: denominator, and what counts as a disagreement? | `R5` — every decision evaluated; three categories | A5, as a table |
| 6 | A6: how many real diffs? | `R6` — no invented threshold; report N, SHAs, spread; PROVISIONAL below 5 | A6 |
| 7 | A7: what establishes "before"? | `R7` — commit order necessary, **not sufficient**; ancestor + CI run id | A7 |

**`R2` and `R4` are the two that went against me**, and both for the same reason worth keeping:
`R2` because scoping "any read" to HEAD-resolving commands is a blacklist nobody can enumerate —
`G-040`'s shape — and `R4` because one row scoring refusals and real-role execution together can go
green on refusals alone, which is the state this slice exists to leave.

### 9.8 — NEW, raised after the rulings, **[mine], UNRULED, not scored**

**"Run the full suite alone" is not achievable as written while three seats share one machine.**
See §5.4 and §7. This is raised, not applied; A8 is scored as the brief writes it until ruled.
