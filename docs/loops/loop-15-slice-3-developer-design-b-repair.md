# Loop 15 slice three — candidate B, repair half: design proposal for G-042

**By:** Forge (developer seat), record session 80 · **Model:** Opus 5.5 (`claude-opus-5-5`) · **Effort:**
high (the transcript's run from 01:04:10Z) · **Date:** 2026-09-23
**Ruled scope:** Aaron's ruling via the planner — B's repair half is **G-042**. A full suite must pass or
fail on the code, not on what else the machine is doing, so that D-034's pauses become unnecessary. The
capability half stays `T-155`.
**Base for the build:** A's **accepted** SHA only (`D-033`). **Status: a proposal. Nothing is built.** QA
writes B's criteria first.

---

## 1. The mechanism, read from the installed code rather than assumed

vitest **3.2.4** on a **6-core** machine (`os.availableParallelism()`).

- The error is raised by `createRuntimeRpc` in `node_modules/vitest/dist/chunks/rpc.-pEldfrD.js:49`
  (`[vitest-worker]: Timeout calling "onTaskUpdate"`). It is birpc's call timeout,
  `DEFAULT_TIMEOUT = 6e4` (`index.B521nVV-.js:3`); `createRuntimeRpc` sets none of its own.
- `index.B521nVV-.js:55–70`: when the **worker** calls `onTaskUpdate`, birpc arms `setTimeout(…, 60000)`
  **in the worker's own event loop** and posts the request. The timer is cleared only when the reply is
  **processed** by the worker.
- Node's loop runs the **timers** phase before the **poll** phase, where the IPC reply is read. So if a
  worker's event loop sees **no macrotask for 60 s or more** after it called `onTaskUpdate`, the expired
  timer fires first and the error is thrown. **The reply may have been sitting in the queue the whole
  time.** The main process does not have to be slow at all.

**Why this suite's harness files can starve their own loop.** With stub roles, `runLoop` never yields a
macrotask:
- every git call is `spawnSync`;
- every check is `spawnSync`;
- every `await` inside it resolves as a **microtask** (a stub's `run()` returns a value, and `consultGate` in
  skip mode returns synchronously).

A whole test, often several loops, is therefore one synchronous stretch as far as timers and IPC are
concerned. `cli.test.ts` runs the whole CLI in `execFileSync`, which blocks for the child's entire run.

**The evidence already in hand:**
- **The per-file worst event-loop block** (`monitorEventLoopDelay`, a harness-only run, candidate A's tree,
  handoff §6) is **5096 ms** (`cli.test.ts`), **4492** (`runtime.test.ts`), **4287**
  (`config-channel.test.ts`), **3911** and **3318**. A **12× slowdown** of the worst stretch reaches 60 s.
  On Windows, with process creation under contention and antivirus scanning each spawn, that is plausible.
  It has not been measured.
- **G-042's first repair supports the same mechanism:** `rmSync` over `.git` (a synchronous block) made
  async fixed the original sighting (`1c8e6ca`).
- **One more observation:** QA's reading that a 5 s block "cannot" reach 60 s holds only for a worker that
  yields between blocks. **A stub loop does not yield between its blocks**, so the relevant quantity is the
  longest macrotask-free stretch, not the longest single spawn.

**Two hypotheses the design must still separate, not assume:**
- **H-worker:** a worker's macrotask-free stretch exceeds 60 s under load. It predicts that, at the failure,
  one worker's `monitorEventLoopDelay` max is **≥ 60 s**.
- **H-main:** the main process cannot answer within 60 s. It predicts **no** worker stretch near 60 s at the
  failure.

---

## 2. The proposal — in three steps, the first of which decides the rest

### Step 0 — a reproducible load, seen RED on the current code first

**No fix is built until this exists.** The acceptance the ruling names cannot discriminate without it.

- `open-brain/scripts/load-generator.mjs`, tracked, with fixed and printed parameters:
  - `--cpu N`: N busy-loop Node processes (default: `availableParallelism()`);
  - `--disk M`: M writers doing write-and-fsync of 4 MiB files in a temp dir, in a loop;
  - `--spawn K`: K loops spawning `git --version` back to back. **Process creation is the contended resource
    the harness actually uses**, so a CPU-only load could miss the channel.
  - A fixed duration, the start time and parameters printed, and all children killed at the end (a process
    group on POSIX; `taskkill /T` on its own live root on win32).
- **The instrument, beside the load:** a tracked `tests/eld-setup.ts`, enabled only by an environment
  variable. It records each file's `monitorEventLoopDelay` max, p99 and wall time to a file. This is what
  tells H-worker from H-main (§1).
- **Red first:** the full suite at A's accepted SHA, run **n = 3** times under one fixed parameter set.
  - The set is chosen by stepping `N`, `M` and `K` up from zero until the error appears.
  - **Every step is reported, including the green ones**, so the threshold is a measurement and not a
    choice.
  - If no parameter set reproduces the error in 3 of 3, **the discriminating row does not exist**, and I
    report that rather than claim a fix.

**Decision at the end of Step 0:**
- the failing run shows a worker stretch **≥ 60 s** (H-worker) → Step 1;
- it shows none → Step 2, and Step 1 is dropped.

### Step 1 — bound the longest macrotask-free stretch (if H-worker)

The repair is to make the event loop **reachable** often enough that no stretch can approach 60 s, rather
than hoping each stretch stays short:

- **(a) The runtime yields a macrotask at every stage boundary.** `await yieldToEventLoop()`, which is
  `setImmediate` wrapped in a promise, before each stage, after each commit or tag, and between the checks and
  the done-gate: about 6 per loop.
  - **This is product code, and the change has to be safe on its own terms, not only for tests.**
  - **Safety argument, to be checked by QA:** no yield sits between a check and the act it guards.
    - R20's byte compare and its git call are in one synchronous function (`spawnGit`).
    - Layer 2's restore and the first git read after it are in one synchronous sequence in `runStage`.
    - The freeze check and the QA stage start are adjacent, with no yield between.

    The yields go only where the runtime already crosses a boundary and holds no invariant open.
  - **What it bounds:** the longest stretch becomes **one stage segment**. Estimated at under 1 s here, from
    ~2 s per stub loop and ~6 segments; **to be measured, not assumed.**
- **(b) `cli.test.ts` runs the CLI with async `execFile`,** so the worker keeps servicing timers and IPC while
  the child runs. That is test-only. It is the worst file in the table.
- **(c) A sweep of the test tree for other synchronous waits** longer than a budget (`execFileSync` of a long
  child, `Atomics.wait`, `rmSync` over a repo). The sweep is an AST scan, the same instrument as CA-4b, not a
  pattern. Each hit is converted, or named and justified.
- **What it deliberately does NOT do:** make git itself asynchronous. Every `git.ts` function becoming
  `async` would ripple through every caller and every ordering argument candidate A just established. That
  is a rewrite of the channel logic for a scheduling problem.

### Step 2 — reduce self-contention (if H-main, or as a second layer)

- **A vitest `projects` split:** the spawn-heavy harness files in their own project with a worker cap
  (`maxWorkers: 2`), and the rest unchanged. Or `fileParallelism: false` for the harness project only.
- **Cost:** wall time. The harness files run ~90 s + 63 s + 114 s + … today in parallel, and that cost is
  measured and reported.
- **This alone does not satisfy the ruling:** an external load still slows the capped workers. It is the
  second layer, not the fix, unless Step 0 points here.

### Not proposed

- **Raising or disabling the RPC timeout.** vitest 3.2.4 exposes no setting for it. Patching `node_modules`
  or monkey-patching `setTimeout` would hide the symptom and also the next real hang, which is the shape
  this project keeps finding (an instrument that stops being able to report).
- **Retrying a red suite until green.** That is the widened criterion the project forbids.

---

## 3. What acceptance would have to show (QA writes the criteria; these are the observables)

- **B-1 red first:** at A's accepted SHA, under the Step 0 generator at a fixed parameter set, the full suite
  exits **1** with the `onTaskUpdate` timeout in **3 of 3** runs. The parameters and each run's
  `SUITE_EXIT`, peers and eld table are recorded.
- **B-2 green under the same load:** at B's candidate, the same generator and parameters, **3 of 3** runs
  exit **0**. The test counts equal A's, so nothing is skipped to get there.
- **B-3 the mechanism, not just the outcome:** the eld table at the candidate shows every file's worst stretch
  under a stated budget, **well below 60 s under the load**. At A under the same load, at least one file is
  at or above it. That shows **why** it turned green.
- **B-4 mutant:** the Step 1 yields removed, and the result is red again under the generator.
- **B-5 no semantic change in the runtime:** the full harness suite and candidate A's rows are unchanged and
  green. §2's safety argument is evidenced from the code path.
- **B-6 the load is honest:** the generator's children are all dead at the end (a PID and heartbeat check,
  as in CA-6), so the load cannot leak into the next measurement.

---

## 4. Limits, stated now

- **One machine.** CI is Linux, where spawns are cheap, and has never shown this. A green on CI is not
  evidence for or against.
- **The generator is a model of load, not the load that bit.** Run 1's worktrees-82 activity was an
  interactive Claude session, not a burner. If Step 0 cannot make the failure appear, the honest outcome is
  that the fault is not reproducible here, recorded as such.
- **External load can always exceed any bound.** The claim is "passes under the recorded load", with the
  parameters stated, never "passes whatever the machine is doing".

---

## 5. Ruling asked, one question

**May Step 0 run before B's criteria exist?** It builds nothing in the product: a load script and an opt-in
instrument, run against A's accepted SHA. Its result decides between Step 1 and Step 2. It also determines
whether B-1 exists at all. QA writing criteria for a red that may not be reproducible would be criteria
before evidence of the fault. I recommend yes: Step 0 as a measurement, owned by whichever seat you rule,
with QA's criteria written after it and before any fix.
