# Research 3: Can QA be offloaded to make development faster? Decentralized networks vs. AWS

**By:** Scout (`sia-research`, `role: none`), 2026-09-26. **Model:** Claude Opus 5.5 (1M context). **Effort:** as
configured for this session; not independently measured.
**Asked by:** Aaron, directly in this session: *"qa is the bottleneck for faster dev work, I'm wondering if there are
decentralized networks that could run qa for us. The problem with this idea is I'm running windows 10 and the setup I
believe has to match for qa to work, not sure about that."* Then: *"Ask atlas about the bottleneck, I like the idea of
aws, I use aws ses and their storage, it's cheap"* (verbatim).
**Sources:** SIA's record and `ci.yml` at `origin/master` 79e20e2; Atlas's reply by SendMessage, 2026-09-26 (quoted as
TOLD-by-planner, with the planner's own labels kept); AWS's public price list for EC2 Windows on-demand, US East
(Ohio), publication date 2026-09-25T17:45:21Z (READ, fetched this session).

**Labels.** **READ**: I opened the source. **TOLD**: someone else says so and I have not checked it. **INFERENCE**: my
own reasoning.

---

## 0. The answer in four sentences

**Don't use a decentralized network for QA; an AWS Windows machine is a reasonable third QA machine, but it is not
the next thing to buy.** The evidence so far says QA is slow mainly because **every run waits for Aaron to launch it**
and because **each machine runs one seat at a time**, not because the machines are slow (TOLD, Atlas). A faster or
extra machine helps only the second of those. **Do two free things first:** measure the machine-vs-agent split from
the logs QA already writes, and get the unattended launch (`qa-queue.ps1`) working; then decide on EC2 with a number
in hand.

---

## 1. Does the QA setup have to match Aaron's Windows 10?

| Part | Must match? | Why | Label |
|---|---|---|---|
| **Windows (any recent version)** | **Yes** | QA's real catches are Windows behaviour: R82's ENOENT regression (a win32-only R35 regression), the importer's Windows-1252 text past STALE, Defender holding files the tests create (T-190), killing a process tree (T-174). Linux passes all of them. | READ (record) |
| **Windows 10 specifically** | **No** | Those behaviours belong to Windows in general, so Windows 11 or Windows Server 2022/2025 show them too. | INFERENCE |
| **Tool versions** (Node 22, git, Claude Code, gh) | **Yes, and this matters more** | T-182: tcm had an older Claude Code, and CA-9 failed on every tcm run ("flag --permission-prompts is gone") while passing elsewhere. | READ (T-182 note) |

## 2. Why not a decentralized compute network

1. **They are almost all Linux.** Akash, Golem, Flux and io.net rent Linux containers and GPUs. Windows machines on
   them are rare. Linux is what SIA already has for free (tcm, GitHub's hosted Ubuntu). (INFERENCE, from what these
   networks offer; not surveyed node by node.)
2. **Their results cannot be checked.** QA exists so that a report of "green" is not believed on its own. A stranger's
   machine saying "passed" is exactly that report (`shared.md`: *verify against the thing, never against the report
   of it*). (INFERENCE)
3. **They would hold Aaron's keys.** A QA seat runs Claude, so the machine needs his Claude credentials and the repo.
   (INFERENCE)

## 3. Where QA time actually goes (Atlas's answer)

**Wall-clock, dispatch to report** (TOLD, Atlas: "READ, from report headers and the planner's launch and watcher
timestamps"):

| QA run | Candidate | Machine | Wall-clock |
|---|---|---|---|
| QA 111 | importer round 3 | QA PC | about 42 min (00:39:20Z to 01:21Z) |
| QA 122 | importer round 4 | QA PC | about 45 min |
| QA 125 | T-179 | QA PC | about 45 min |
| QA 129 | B Step 1 | QA PC + laptop CI | about 50 min, of which about 5 laptop CI runs at 5-8 min each: **machine time dominated this one** |
| QA 135 | /bootstrap fix | laptop | 27 min (23:26:47Z to 23:54Z) |

**The machine-vs-agent split inside a run has NOT been measured** (TOLD, Atlas). **The instrument already exists:**
each driver writes `%USERPROFILE%\sia-qaN\run-N.jsonl` (stream-json with timestamps). Summing the gaps between
`tool_use` and `tool_result` per tool (Bash for suites, probes and mutants) against the model's turns gives the split.

**What has been holding QA up** (TOLD, Atlas, "READ, from the session record"):
- **(a) Launch latency.** Every QA run needs Aaron to launch it. The host classifier refuses the planner that act, so
  QA machines sat idle overnight. `qa-queue.ps1` (2026-09-26) exists to fix this, and its first two nights failed on
  planner bugs (an `int[]` parse, then an unquoted path).
- **(b) One seat per machine, run one after another,** because a timing-sensitive full suite must run alone.
- A busy laptop runner has mattered only for load-sensitive scoring (candidate B).

**Machines today** (TOLD, Atlas): the QA PC (i5-3570, 4 cores / 4 threads, 8 GB), the laptop (i7-8565U, 4c/8t, 8 GB),
plus this desktop at night. One data point says the laptop is faster: 27 min against 42-50.

**T-190 (Defender):** `C:\qa-tmp` is Defender-excluded on the QA PC (TOLD, Atlas, from the driver's comment and
Aaron's word of 2026-09-25). **Its effect on suite time has not been measured.**

**Splitting one candidate's checks across two seats:** not as a default (Atlas, INFERENCE). Each seat repeats setup
(clone, build, reading the brief and the previous report), and the verdict is one judgement over rows that interact.
The parallelism that works is **one seat per candidate across machines**, which is what runs now. Exception worth
considering: independent, machine-heavy rows (such as B's laptop scoring batches) dispatched as their own jobs.

## 4. AWS: what it would cost and what it would be

**EC2 Windows on-demand, US East (Ohio), Windows license included in the hourly price** (READ, AWS price list,
published 2026-09-25):

| Instance | vCPU | Memory | $/hour | One 45-min QA pass |
|---|---|---|---|---|
| t3.xlarge | 4 | 16 GiB | $0.240 | about $0.18 |
| m7i.xlarge | 4 | 16 GiB | $0.386 | about $0.29 |
| t3.2xlarge | 8 | 32 GiB | $0.480 | about $0.36 |
| c7i.2xlarge | 8 | 16 GiB | $0.725 | about $0.54 |
| m7i.2xlarge | 8 | 32 GiB | $0.771 | about $0.58 |

**Rough monthly figure** (INFERENCE): three QA passes a day on m7i.2xlarge, one hour each including start-up, is
about $70 a month in compute. Add disk storage, which is billed even while the machine is stopped (the per-GB rate was
not verified in this brief). **Avoid t3 for the timed suite:** t3 is a "burstable" type whose CPU is throttled once its
credits run out, which is the same kind of noise that makes load-sensitive scoring unreliable. (INFERENCE)

**What it would be** (INFERENCE):
- **Windows Server 2022 or 2025, not Windows 10.** Per section 1 that is fine for QA. (Running Windows 10/11 client
  on EC2 needs bring-your-own-licence on dedicated hosts, as far as I know: TOLD from general knowledge, not checked.)
- **Built from a script** that installs pinned Node 22, git, gh and Claude Code and records their versions in the
  QA report, so T-182's version mismatch cannot recur silently.
- **Started for a run and stopped after**, so it costs money only while QA runs.
- **Its tests would be checked the usual way:** the QA agent reads the actual results itself. Nothing is taken on
  trust, unlike section 2.

**What it would NOT fix:** launch latency. An EC2 machine still needs someone or something to launch the QA seat.
The fix for that is the unattended launch path (`qa-queue.ps1`), which is needed whether or not EC2 is used.

**Aaron's call, stated plainly:** an EC2 QA machine would hold **his Claude credentials** (and a GitHub token to read
the repo). That is a security decision about his accounts, like the Defender exclusions in T-190, and it is his.

## 5. Recommendation, in order

1. **Measure the split** from the existing `run-N.jsonl` logs for the five runs above, on the QA PC and the laptop.
   Free; the instrument exists. This turns "EC2 is a bet on machine time" into a decision.
2. **Make the unattended launch reliable** (`qa-queue.ps1`). This addresses the constraint Atlas names first, and no
   machine purchase does.
3. **Then, if machine time dominates or candidates queue for a Windows machine:** pilot one on-demand EC2 Windows
   Server instance (m7i.2xlarge or c7i.2xlarge), built from a script, stopped when idle, versions recorded. Judge it
   on one number: wall-clock against the laptop's 27 min for a comparable candidate.
4. **Do not split one candidate's rows across seats by default** (section 3); dispatch only independent,
   machine-heavy rows as separate jobs.

**What would change my mind:** the measurement in step 1 showing that suites, probes and mutants take most of a QA
pass. Then step 3 moves ahead of step 2, and the 8-vCPU EC2 types become the obvious test.
