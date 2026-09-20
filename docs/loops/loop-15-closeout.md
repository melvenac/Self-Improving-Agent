# Loop 15 close-out — the HoH runtime, slice one

**Written by:** Atlas (planner) · **Date:** 2026-09-20 · **Base at close:** `master` @ `d45c965` (rev 39);
the developer's branch carries rev 42 and is unmerged as this is written.
**Verdict:** **ACCEPTED** at `4414bcc` — the third candidate — by the QA seat, on criteria written before
the first candidate existed. One defect of the same class open, ruled onto slice two.
**Ships as:** `v0.41.0` on merge, with `loop/15-hoh-runtime` (dev, rev 42), `qa/loop-15-criteria`,
`qa/loop-15-report`, and this document — all merged by Aaron, none by a seat.

> **Sources, cited not absorbed.** The developer's handoff — `loop-15-developer-handoff.md` at
> `9b3078f`; the QA criteria — `loop-15-qa-criteria.md` at `24e33e5`; QA report 1 — `loop-15-qa-report.md`
> at `5beb13e`; QA report 2 — `loop-15-qa-report-2.md` at `a2cb718`; the brief and its two amendments;
> `g-039-ruling.md`. **Where this document and any of them disagree, the disagreement is meant to be
> visible.** Each was written by the seat that could attest it and none has been paraphrased here.

---

## 1. The finding that generalises

**Enforcement that watches the working tree is blind to every other channel a role can act through —
and committing is how a real session leaves its work.**

The first candidate refused an uncommitted write outside a role's allowlist and refused a moved tree
before QA started. Both were tested, both were seen red, both held. **A QA stub that edited the
candidate and *committed* the edit during its own stage completed the loop at exit 0 with `loop-001-qa`
on top of the tampered commit.** `git status` was clean. The freeze was checked once, before QA, and
QA is the stage the freeze exists to constrain.

The developer's own sentence, after the fix: *"committing is how a real session leaves its work, so
slice two's roles would have hit it on the first real run rather than under an adversarial stub.
Slice one shipping with that hole would have meant the runtime's first genuine use was also its first
demonstration that it did not work."* **That is the case for the third seat in one sentence, from the
seat that would have shipped the hole.**

The fix was the class, not the instance: enforcement compares against the diff from each stage's base
commit unioned with the working tree; any stage that moves HEAD is refused; identity is verified before
every tag; the candidate is asserted as the evidence commit's first parent. **Report 2 then found the
next channel — refs — by the identical argument.** See §6.

## 2. What shipped

`open-brain/src/harness/` — a runtime that runs a Planner → Developer → QA iteration with in-process
stubbed roles, validates `D_t` and `E_t` against zod-sourced schemas (the `.json` files are derived
and byte-compared; a hand-edit was seen red), retries a schema failure to a cap whose exhaustion
writes `FAILED.md` and never an `E_t`, freezes the candidate ref and refuses if any stage moves it,
refuses writes and commits outside a stage's allowlist and reverts them, tags `loop-NNN-base`,
`loop-NNN-developer`, `loop-NNN-qa` locally with all network git subcommands refused at the call
site, reads deterministic check results from exit codes only, and prints gate payloads in dry-run
without a transport that can send. **175 new tests; 648 pre-existing untouched and confirmed by a
separate exclusion run rather than by subtraction.** `module-boundary` green with the harness inside
the 41 core files.

**Three decisions the brief left open, ruled in amendment 2:** `repair_targets` may be empty
(overturning the developer's symmetric rule — the schema cannot see `E_{t-1}` and would have
deadlocked on the first loop of any project); local `loop-NNN-*` tags with no network (confirming the
developer's resolution of a contradiction the planner authored); and the harness inside
`open-brain/src` so the boundary check covers it (confirming the developer's call).

**Cut from slice one and still cut:** role prompts, `artifacts/index.md`, any Jev call.

## 3. How the verdict was reached

| | |
| --- | --- |
| **Criteria** | Written by Probe before any candidate existed, at `427663b`; amended only by planner ruling (`24e33e5`). Every row: tree, command, pass/fail/untested, blind spot. |
| **Candidate 1** — `1c8e6ca` | Voided by a ruling before evaluation: the planner overturned the developer's `repair_targets` rule. Two observations recorded as void, not deleted. |
| **Candidate 2** — `1086e55` | **Not accepted.** Four defects (D1–D4), three of them one class; both of Probe's pre-registered probes landed. Routed to the developer with the observation behind each and no fix proposed. |
| **Candidate 3** — `4414bcc` | **Accepted.** Every report-1 defect re-observed as fixed against the built candidate, not taken from the handoff. D6 found, same class, returned to the planner. |

**Two probes were pre-registered by QA before the first candidate arrived and deliberately not shown
to the developer.** A planner that leaks QA's probes lets the candidate be fitted to the evaluation,
which defeats *"a role that did not produce the candidate"* at the information level even when the
process boundary holds. Both probes landed. The round-trip they cost bought the property the seat
exists for.

**Rule 13 was met without borrowing infrastructure.** The planner announced it would check the
candidate out in the main tree; Probe objected — that tree's build is what every session's hooks and
the MCP server run from, and a session started between checkout and restore inherits whichever state
it finds. The plan was withdrawn. **Probe indexed its own tree instead**, which reproduces the
condition rule 13 exists for — generated `.gitnexus/` files — where the candidate actually is.
`sync --check` ran with **0 skipped** on the accepted candidate. **The rule, now in `shared.md`: the
main tree is not a QA fixture.**

## 4. The record

**Error counts at close: 48 Planner / 28 Developer / 0 QA.** Movement **since Loop 13's close at
45 / 25 — which is this loop's window, because no other loop was open between**: three each. The
developer counted two from the QA reports alone and asked for the derivation rather than accept the
sentence; the third, 26, is from the write-ordering exchange that preceded the first candidate, and
the planner's 46 is from the same exchange. Stated so the window is derivable, not argued over.

| # | Seat | Entry |
| --- | --- | --- |
| 46 | Planner | *"No seat takes a revision while another holds an unclosed session."* False for three seats; deadlocked the first mid-loop write the loop needed (`G-036`). |
| 47 | Planner | `HOH-JEV.md` §6.2 said the runtime never tags; the brief's A5 required tags. A contradiction the planner authored, resolved by the developer's judgement. |
| 48 | Planner | Wrote that the CC memory layer had captured findings *"without being asked."* The developer had written them by hand. A wrong claim about the question under study, caught by the seat it was about. |
| 26 | Developer | *"The developer's `/end` is the last write to the record."* False for three seats — QA's `E_t` and the close-out come after it by design. Withdrawn within the hour. |
| 27 | Developer | *"5/5"* in a commit message where the count was 7/7. |
| 28 | Developer | *"I reported that suite as green"* in `1c8e6ca`'s message; the handoff says it overstates. Chosen to record rather than rewrite — the right call, and a wrong claim in a commit. The developer claimed zero; overruled, because the rule has no direction exemption. |

**Near-misses, by family, not numbered.** Developer: the pipe-masked exit code; the deny-list scan
firing on its own constant; an untrusted schema check; the request to check a candidate out in the
main tree. QA: eight across two reports, including a failure grep that matched a passing test's
*name*, an `it(` count that answered a different question than vitest, and a probe that truncated
the one reason that mattered. Planner: a fail-closed gate that tripped on `grep -c`'s zero-count
exit; a shell chain that died on a quote before running; a filtered `grep` that nearly reported a
defect in freshly merged code; a staleness count quoted from an earlier measurement after master had
moved; **and accepting the main-tree request and announcing it to three parties before QA stopped
it.** Every one caught by reading the artifact rather than the tool's report of it.

### The three-instances paragraph

**Three times in one session, from one agent, the rule that would have prevented the mistake was
already in its context, and it did not fire.** Entry 299 in the knowledge store described the
pipe-masked exit code before the developer committed it. `developer.md` described the exit-code
defect before the developer committed it. `shared.md` described the main tree as infrastructure
before the developer asked the planner to check a candidate out there. All three were read at
session start. **`G-039` recorded the first; this paragraph records that it was three.** The
store's problem is not what it holds. See `g-039-ruling.md`.

## 5. What the loop did not fix, stated so it is not discovered as a gap

- **Measurement failures.** The brief said so in advance and it held: the runtime removes the hand
  from the checks it runs, and every seat still misread its own instruments by hand — eleven
  near-misses across three seats in this loop alone. **A runtime cannot stop a seat running a grep that
  hides the line it needed.**
- **Isolation.** With stubs there is no session to isolate. Both QA reports declined to claim
  *"enforces separation"* in either direction; what was observed is the runtime refusing specific
  moves by in-process stubs, now including moves a real session makes.
- **CI and other machines.** Nothing ran off one Windows machine. The developer's Finding 1 — a
  suite that exited 1 while reporting 805 passed, a worker heartbeat timeout under load, 7/7 before
  the fix and 4/4 clean after — is load-dependent and uncharacterised elsewhere. **Recorded as
  `G-042`** at rev 43 (`9975b17`), with the unresolved second failing file on the one-plant run
  deliberately not attributed to `G-016`.
- **`tests/harness/` is not type-checked by anything tracked** (`T-152`).

## 6. What the next loop inherits

- **D6 = `G-041` — MANDATORY repair target for slice two.** Recorded by the developer at rev 43
  (`9975b17`), found by Probe, ruled here. A role that runs `git tag -f loop-001-developer loop-001-base` during its stage — no
  commit, no write, HEAD untouched — completes the loop at exit 0; the tag then names the pre-loop
  commit while `E_t` and `A_t.gitref` name the candidate, and nothing notices. **Enforcement observes
  commits and the working tree; it does not observe refs.** Same class as D1–D3, next channel. Not
  a criteria row — A5 passed on its observable — and neither seat widened the criteria after the
  verdict. **Ruled onto slice two rather than a fourth candidate: slice one's roles are stubs, no real
  session runs through this runtime before slice two, and the loop's own rule carries a failure into
  `D_{t+1}`. The mechanism, used on its first turn.** The developer checked the construction claim
  rather than accept it: `cli.ts` hardcodes `stubRoles()`, there is no flag to supply a role, and
  nothing outside `runtime.ts` calls `runLoop` — a real role can only arrive through a programmatic
  caller, and writing one is slice two.

  **"Slice two may not run a real role until D6 is closed" is an intention, and this project's rule 4
  says an intention is not a mechanism** — the developer's objection, upheld. The first act of slice
  two is by definition making a real role runnable, which is the exact moment the constraint must fire
  and the moment whoever is building is least inclined to stop. **So slice two's first acceptance check
  is mechanical: the runtime refuses any role it did not construct itself unless a ref-watch is
  present — one flag, checked at `runLoop` entry, failing closed — and that refusal is seen red before
  the first real role is wired.** Not "slice two must remember"; "slice two's A1 is that this refuses."
  The general fix — a ref snapshot before each stage compared after, refusing on any change the runtime
  did not make — is the developer's to design. **Watch refs, not tags:** tags alone leaves branches and
  `update-ref`, and the lesson of D1 is that naming the observed channel narrowly is how the next
  channel gets missed.
- **`G-039` and the recall trigger.** The strongest candidate for the loop after this one, with the
  constraint ruled in `g-039-ruling.md`: deterministic, fails closed on nothing, and the loop is
  handed both fixes — a trigger on a queried store, and an unconditional read of a curated set.
- **`G-040` → a task:** do the repo's own `/sync` source scans match the sentence forbidding a thing
  as though it were the thing? `retirements` already handles it with `allowed_referrers`;
  `command-names` and `command-tool-names` match names in instruction files, which is where
  prohibitions get written, and nobody has looked.
- **`T-155`**, the shadow merge gate, unchanged.
- **Loop 14, re-briefed** at `loop-14-rebrief.md`, with C2's scope now answerable: Loop 15's
  `artifacts/iterations/tNNN/` exists.
- **Two limits QA recorded that are not defects — with the reasoning, so a later reader does not
  "fix" them.** A stage that moves HEAD to a non-descendant fails closed with *"recover by hand"* and
  leaves the tree at base: that is the one case where destroying history to tidy up would be worse
  than stopping. And `git clean -fd` after a rogue-commit rollback deliberately omits `-x`: adding it
  would delete `node_modules/` and `build/` on every rollback, turning a refusal into an outage. Both
  are the developer's reasoning, recorded at its request.

## 7. Held for Aaron

- **Merge order:** `loop/15-hoh-runtime` (state rev 42), then `qa/loop-15-criteria` and
  `qa/loop-15-report`, then the three open docs PRs, then this close-out. Then the `v0.41.0` tag on
  the merge commit — his to give.
- **Whether the planner seat may push its own doc branches** — implicit since 2026-09-17, ratified
  by conduct, flagged by the developer as unwritten. Record it in `shared.md` or revoke it.
- **Sequencing after Loop 15:** slice two (with D6 first), or the recall trigger, or Loop 14.
  Recommended: slice two, because D6 must close before any real role runs and slice two is where
  real roles arrive.

---

**The loop's verdict, the planner's to give:** Loop 15 asked whether the runtime could enforce the
boundaries the role files could only request. On the first candidate it could not, in exactly the way
a real session would have found; on the third it does, for every channel anyone had thought of and one
more that QA found. **The candidate was accepted by a seat that did not build it, on criteria written
before it existed, after rejecting it once with the observation behind every defect.** This project
had never had that. The runtime is the smaller half of what shipped.
