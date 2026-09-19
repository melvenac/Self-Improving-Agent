# Loop 15 brief — the HoH runtime, slice one

**Written by:** Atlas (planner seat) · **Date:** 2026-09-19 · **Base:** `master` @ `e65f251`
**Source:** `hoh_jev.md` (Aaron, untracked in the planner worktree) and
*Harness-of-Harness*, arXiv:2609.01481.

> ### Sequencing: RULED. Loop 15 runs before Loop 14.
>
> **Ruled by Aaron, 2026-09-19.** His reason: it solves problems that keep recurring. The planner
> seat put two stronger ones to him and he took the ruling on all three.
>
> **1. Loop 14 is briefed against a world that no longer exists.** It was written when there were two
> seats and no runtime. There are now three seats, and Loop 15 adds the component that would own
> exactly the artifacts Loop 14 planned to design by hand — who writes which record, when, and where
> it persists. **Run Loop 14 first and its output is obsolete on arrival.** That is rule 14 applied to
> a plan instead of a document.
>
> **2. Loop 15 generates Loop 14's evidence rather than spending it.** It is the first loop whose
> verdict is written by a seat that neither set the objective nor built the candidate. That is Loop
> 14's subject.
>
> **Loop 14 is therefore RE-BRIEFED, not merely deferred.** Its C1 has already shipped (PR #37); its
> C2 and C3 look different once a runtime owns the artifacts.
>
> **What this loop does NOT fix, stated so nobody expects it to.** It addresses **boundary** failures
> — one seat holding scope, verdict and write authority at once. **It does nothing about measurement
> failures**, which were far more frequent: eleven near-misses in two days, every one an agent
> misreading its own instrument. **A runtime cannot stop a seat from running a grep that hides the
> line it needed.**
>
> **Slice one was narrowed after briefing**, by the seat that wrote it: the role prompts and the
> artifact index are cut below. The first draft carried eight deliverables and seven acceptance
> checks, which fails this seat's own rule that bounded scope exists so a failure points somewhere.

---

## 1. What this loop is for

**Build the outer runtime that spawns three isolated role sessions, validates their deliverables
against schemas, and versions each loop in git. No Jev, no API key, no model calls at the gates.**

The brief's own build order puts the runtime first and the decision layer fourth, and it is right
for a reason worth stating: **the runtime is the thing that enforces separation, and separation is
what this project has been failing at without one.** Three seats now exist as worktrees with role
files, and nothing makes a seat stay inside its role — it is an intention, which is the failure mode
named in `.agents/roles/shared.md`. **A runtime that freezes inputs and enforces write permissions is
a check; role files are a rule someone must remember.**

**Jev is deliberately out of scope for this loop**, and the reason has changed since this brief was
first written. The original reason was that the API was unverified. **It has since been verified —
see §9 — so the remaining reason is sequencing, not risk:** the runtime is what enforces separation,
and a gate belongs on top of an enforced boundary rather than under one. Slice one produces a runtime
that is useful with the gates stubbed, and slice two replaces the stubs.

## 2. The increment, bounded and locally complete

**Repair** — the standing defect this loop fixes: **nothing enforces the seat boundaries the role
files describe.** The planner has held scope, verdict and write authority in the same session, and
the only thing preventing a recurrence today is that a role file asks it not to.

**New capability** — one, small, observable: **`harness` runs a loop end-to-end with three stubbed
role sessions and produces a versioned, schema-valid `artifacts/iterations/t001/`.**

### Deliverables

- **`harness/` in TypeScript**, not Python. *Ruled, not asked:* this repo is TypeScript, `open-brain`
  already carries the build, test and lint toolchain, `/sync` and the checks are wired to it, and a
  second language would need its own CI lane. The brief offers `runtime.py # or ts`.
- **`harness/schemas/plan.schema.json`** and **`evidence.schema.json`**, from the shapes in
  `hoh_jev.md` §"Artifact schemas". `D_t` rejects an empty `new_capability` unless `stop_ship` is
  explicitly requested and justified.
- **Schema validation with retry**, capped, and **the cap is a recorded failure rather than a silent
  pass.**
- ~~`harness/prompts/{planner,developer,qa}.md`~~ — **cut from slice one.** Prompts do nothing while
  the roles are stubs; they belong to the slice that spawns real sessions. When they land they must
  point at the tracked `.agents/roles/*.md` rather than restate it — duplicating role knowledge into
  a prompt is the defect PR #44 exists to fix.
- **Git versioning per loop:** commit after the developer stage and after evidence is stored, tag
  `loop-<t>-<role>` so rollback is a git operation.
- **Deterministic checks before QA** — build and unit tests — whose **exit codes are read, never
  inferred and never asked of a model.**
- ~~`artifacts/index.md`~~ — **cut from slice one.** An index solves selective retrieval, which is
  not a problem at one iteration. It lands with the slice that has something to select from.
- **A dry-run mode** that prints what would be sent to a gate without sending it. Required now, while
  the gates are stubs, so it exists before there is anything to get wrong.

### Explicitly out of scope

Jev client, plan gate, developer done-gate, QA scoring, selective retrieval, skill routing,
compaction, and any change to `.claude/commands/`. **`start.md` and the hook contract stay untouched**
— that is `T-154` and it is not this loop.

## 3. What must be preserved

- **`/start` and `/end` keep working unchanged.** The HoH runtime sits beside the existing session
  protocol; it does not replace it in this loop. A seat must still be able to work by hand.
- **648 tests, `sync --check` clean, `module-boundary` green.** The runtime is new surface; it must
  not reach into `open-brain/src` core in a way the boundary check refuses.
- **`ob_state` remains the only writer of `.agents/state.json`.**

## 4. Acceptance — observable, and derived per item

| id | type | observable |
| --- | --- | --- |
| **A1** | black-box | `harness` runs loop `t001` with three stubbed role sessions and exits 0, producing `artifacts/iterations/t001/` containing `D_t.md`, `A_t.gitref`, `E_t.json`. |
| **A2** | black-box | An invalid `D_t` causes that role to be **retried**, and exhausting the cap **fails the loop with a recorded reason** — not a pass, not a silent continue. |
| **A3** | white-box | The QA stage receives a **frozen git ref**, and the runtime refuses to proceed if the working tree has moved from the candidate SHA. |
| **A4** | white-box | The developer stage's write path is restricted; a stub role writing outside its allowlist is **refused by the runtime**, not merely warned. |
| **A5** | black-box | `loop-001-developer` and `loop-001-qa` tags exist and `git` alone can restore the pre-loop state. |
| **A6** | black-box | Dry-run mode prints the gate payload and sends nothing. Asserted by a test that would fail if a network call were attempted. |
| **A7** | white-box | Deterministic check results come from **exit codes**; no stage infers pass/fail from text. |

**Every check above must fail first on the real condition before it is trusted** — see
`.agents/roles/developer.md`.

## 5. Two conflicts this loop surfaces, neither of them Forge's to settle

**1. Autonomy versus "Aaron merges, on his word."** `hoh_jev.md` specifies a loop that does not block
on a human — *"escalate to 'stop this loop and record a blocker' instead."* That is incompatible with
the standing ruling that Aaron merges every change, which has held for every loop in this repo's
record. **Assumption for slice one, stated so it can be overruled: the runtime stops at a candidate
commit and never merges or pushes. Aaron remains the merge gate.** **RULED 2026-09-19 (`D-019`): autonomous inside a branch, Aaron at master.** The runtime
records what it would have done at each merge and disagreements are counted (`T-155`); the
human gate is removed only when that count is zero across loops that contained real defects.
The assumption above is now the rule, and the gates may land against it.

**2. What the product is.** `hoh_jev.md` says *"the runtime is the actual product you are building."*
This repo's product is the memory protocol and its template. **Slice one treats `harness/` as a
component of this repo, not as a replacement for it**, and nothing in `project-template/` changes.
Whether HoH eventually becomes what SIA ships is a larger question than one loop.

## 6. Secrets

**`TYPESAFE_API_KEY` is read from the environment and never written to a file in this repo.** No key
appears in a prompt, a payload log, an artifact, a commit, or a conversation. **The Jev client, when
it lands, redacts before logging** — brief §"What Claude Code should do", item 3.

**Nobody should paste the key into an agent session.** Set it in the environment; the runtime reads
it there or fails closed with a message naming the variable.

## 7. Roles for this loop

- **Planner (Atlas)** — this brief, the ruling on sequencing once Aaron gives it, and the close-out.
  **No product edits.**
- **Developer (Forge)** — `harness/`, schemas, tests. Pushes and opens the PR. **Each push needs
  authority for that push.**
- **QA (Probe)** — **first real use of the seat.** Evaluates a frozen candidate SHA, read-only, and
  writes the evidence report. Criteria derived from §4, not from a checklist. **Missing evidence is
  a gap, not a pass.**

**This loop is the first one where acceptance is not written by the seat that set the objective.**
That is the point of it as much as the runtime is.

## 8. Open, for Aaron

- ~~Does Loop 15 run before Loop 14?~~ **Ruled 2026-09-19: yes.** See the header. Loop 14 is re-briefed, not deferred.
- ~~The autonomy boundary in §5.1~~ **Ruled 2026-09-19: `D-019`.** See §5.1.
- **The TypeSafe plugin** (`claude plugin marketplace add typesafe-ai/skills`) is a config change to
  his environment and is **his to run, not an agent's** — and it is not needed for slice one.

## 9. The Jev dependency, verified 2026-09-19

**Checked against the source rather than taken from `hoh_jev.md`.** The marketplace was not
configured — `claude plugin marketplace list` shows five, none of them TypeSafe.

**The plugin is real.** `typesafe-ai/skills` on GitHub, 512 stars, last pushed 2026-09-12, and its
`.claude-plugin/marketplace.json` declares one plugin, `typesafe`. **Aaron installs it; an agent does
not** — it changes his environment. It is a skill for *writing* Jev integrations, not a runtime
dependency, and **slice one does not need it.**

**`hoh_jev.md`'s API details are accurate**, confirmed against `docs.typesafe.ai/api.md`:

| Claim | Status |
| --- | --- |
| `POST https://api.typesafe.ai/v1/systemone` | **Confirmed** |
| `Authorization: Bearer <API_KEY>` | **Confirmed** |
| `model: "jev-latest"`, required field | **Confirmed** |
| Three question types — `noul`, `choice`, `score` | **Confirmed** |
| `choice` returns `choice` + `probabilities` + `confidence` | **Confirmed** |
| `score` returns `score` + `legend` + `probabilities` + `confidence` | **Confirmed** |
| Pricing and latency figures | **Not verified** — not load-bearing for any gate policy |

**One asymmetry the gate policies must respect: `noul` has no `confidence` field.** Only `choice` and
`score` carry one, derived from the answer's probability distribution. A policy written as *"reject
if X is low with high confidence"* is expressible for a score and **not** for a noul, where the
returned number is the probability itself.

**Two lines from TypeSafe's own skill that belong in the gate design**, and both are this project's
existing lessons arriving from outside it:

> **"Typed output guarantees the interface, not truth."**

A schema-valid gate answer is not a correct one. **A gate is an instrument and the rules in
`.agents/roles/shared.md` apply to it** — it must fail closed, state its limits, and never be
believed because its shape was valid.

> **"Separate missing evidence, model errors, code errors, and service failures."**

The documented failures are `401` (bad key), `422` (malformed question), `429` (rate limited) and
`529` (overloaded). **These are four different conditions and must not collapse into one "gate
failed" branch.** `429` and `529` are retryable; `401` and `422` are defects. **Fail closed on
anything that would authorise a destructive action, fail open only on optional ranking** — the
brief's own rule, and it needs the error classes separated to be implementable.
