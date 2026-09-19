# HoH + Jev — the loop guide

**Status:** live contract. **Supersedes `hoh_jev.md`**, Aaron's original brief, which was untracked in
one worktree and was being used as the guide from there. **The original is his and stays where it is;
this is the tracked version and the one that binds.** Where they disagree, this file wins, and every
divergence below says why.

**Last verified against sources:** 2026-09-19 — `docs.typesafe.ai/api.md`, the `typesafe-ai/skills`
repository, and this repo at `e3d33c7`.

**Read with:** [`.agents/roles/shared.md`](../.agents/roles/shared.md) and the seat file for your
role. **This document describes the loop; those describe the seats.** Neither restates the other.

---

## 1. What HoH is, and what it is for here

**Paper:** *Harness-of-Harness: Multi-Day Autonomous Software Development with Continual Improvement*,
arXiv:2609.01481.

An outer harness around Claude Code. Each iteration is **Planner → Developer → QA**, and its value
here is not automation — it is **enforcement**.

**This project already had the three roles as documents and could not keep to them.** The planner
seat has held scope, verdict and write authority in a single session: setting the objective, merging,
tagging, writing the record and rebuilding the main tree. Nothing prevented it except a file asking
it not to. **A runtime that freezes inputs and refuses writes outside an allowlist is a check. A role
file is a rule someone has to remember**, and this repo's own rule 4 says an intention is not a
mechanism.

### State

| Symbol | Meaning | Here |
| --- | --- | --- |
| `S` | Fixed specification | The repo's objective plus the loop brief's subject |
| `A_t` | Artifact after loop *t* | A commit on a loop branch |
| `D_t` | Plan for loop *t* | The loop brief — `docs/loops/loop-N-brief.md` |
| `E_t` | QA evidence for loop *t* | The QA report, written by the QA seat |

Transition: `(A_{t-1}, E_{t-1}) --loop t under S--> (A_t, E_t)`.

**Two channels, and they do not cross.** The artifact channel carries `A_t` to the next Developer.
The evidence channel carries `E_t` to the next Planner. **`D_t` is not a third persistent channel** —
the next planner builds a new one from `S` and `E_t` rather than editing the last.

### Rules the runtime enforces

- **Each plan repairs outstanding problems AND adds one small observable capability.** A loop that is
  only repair collapses into local patching; one that is only capability abandons what the last
  loop found.
- **Increments are bounded but locally complete.** Bounded so a failure localises; complete so the
  capability is testable when it lands.
- **Developer tests are shift-left and are not acceptance.**
- **QA evaluates a frozen, read-only candidate.**
- **Constrain deliverable schemas, not the agent's internal workflow.** A schema violation retries
  that role; it does not rewrite how the role works.
- **Persist artifacts on disk, expose a short index, load details on demand.**
- **Version by role and iteration** so rollback is a git operation.

## 2. The three seats, concretely

One `.git`, four checkouts. **Seat identity is per checkout via untracked `.agents/AGENT.local.md`;
the knowledge is tracked in `.agents/roles/`.**

| Seat | Name | Checkout | May write |
| --- | --- | --- | --- |
| Planner | **Atlas** | `~/Worktrees/sia-planner` | Briefs, close-outs, `ob_state`, the record. **Not product code.** |
| Developer | **Forge** | `~/Projects/sia-forge` → `~/Worktrees/sia-forge` (`T-153`) | The artifact, inside `D_t`'s allowlist. |
| QA | **Probe** | `~/Worktrees/sia-qa` | Its report only. **Never the candidate.** |
| — | Aaron's | `~/Projects/Self-Improving-Agent` | **Infrastructure.** Both hooks and the MCP server run from its build. |

**Why QA cannot be the planner**, and this is not organisational tidiness:

> *The implementing agent has direct knowledge of its changes, but its completion claim cannot
> establish that the intended behavior is present. Acceptance must be determined from observations of
> a fixed candidate by a role that did not produce that candidate.*

The planner is biased toward its own increment succeeding and its context is contaminated with design
intent. **Same model is fine. Separate process, separate prompt, separate permissions.**

**The evidence this is real, from this repo:** the `build-freshness` check shipped asserting a
consequence true in one checkout of three. Its author ran it and its tests were green. **An author's
green is where evaluation starts, not a substitute for it.**

## 3. Jev — verified, not assumed

**Jev is a System One model.** It does not chat and does not generate text. It answers **closed typed
questions** about state you send. **Code owns the workflow; the model owns the judgement.**

**Do not use Jev to write code, summaries or explanations. Do not ask it to count, do date maths,
compare SHAs, or anything code can compute.** Never ask it whether tests passed — **read the exit
code.**

### API, confirmed against `docs.typesafe.ai/api.md` on 2026-09-19

```http
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

`model` is **required**: `"jev-latest"`. `state` is a string, object or array. `questions` is a map
whose keys you choose; **the keys are not sent to the model** and answers return under the same keys.

### The three primitives

| Type | Question | Answer |
| --- | --- | --- |
| `noul` | Does this hold? | `noul`: 0–1, the probability of yes |
| `choice` | Which one of these? | `choice`, `probabilities`, `confidence` |
| `score` | Where on this ordered scale? | `score`, `legend`, `probabilities`, `confidence` |

> ### The asymmetry that breaks naive gate policies
>
> **`noul` has no `confidence` field.** Only `choice` and `score` carry one, derived from the answer's
> probability distribution.
>
> A policy written *"reject if X is low with high confidence"* is expressible for a **score** and
> **not** for a **noul**, where the returned number **is** the probability. Several of the suggested
> policies in the original brief are noul-based. **Write noul policies as thresholds on the value.**

### Failure classes — four, not one

`401` bad or missing key · `422` malformed request, body names the field · `429` rate limited ·
`529` overloaded.

**These must not collapse into a single "gate failed" branch.** `429` and `529` are **retryable with
backoff**; `401` and `422` are **defects in our code or config** and retrying them is a loop. Per
TypeSafe's own guidance, **separate missing evidence, model errors, code errors and service
failures.**

**Fail closed on anything that would authorise a destructive action. Fail open only on optional
ranking.** A gate that cannot reach Jev must not become a gate that passes.

> **TypeSafe's own words, and they are this project's lesson arriving from outside it:**
> **"Typed output guarantees the interface, not truth."**
>
> A schema-valid gate answer is not a correct one. **A gate is an instrument**, so
> `.agents/roles/shared.md` applies to it in full: it must fail closed, state its limits in its own
> output, and never be believed because its shape was valid.

### The agent skill

`typesafe@typesafe-ai` v0.5.7, installed 2026-09-19, user scope, enabled. Added via
`claude plugin marketplace add typesafe-ai/skills` then `claude plugin install typesafe@typesafe-ai`.
Update with `claude plugin marketplace update typesafe-ai` and `claude plugin update`, then
`/reload-plugins`. **Use one installation method** — mixing the plugin with `npx skills add` leaves
duplicate copies.

**It is a skill for WRITING Jev integrations, not a runtime dependency.** Invoke `/typesafe:typesafe-ai`
when designing questions or building the client. The live docs are the source of truth; Mintlify
serves Markdown by appending `.md` to a page path.

## 4. The gates

**Send small structured state. Batch many questions in one call. Combine answers in code.** Thresholds
live in `harness/policies/`, never in a prompt.

### Plan gate — after the Planner writes `D_t`

State: spec excerpt, plan summary, prior failures, validated behaviours, changed-area hints.

- `plan_mode` — **choice**: `repair_only` · `capability_increment` · `mixed` · `stop_ship`
- `scope_size` — **score**: `0` too small to observe · `1` one testable increment · `2` unbounded rewrite
- `preserves_validated` — **noul**
- `addresses_top_failures` — **noul**
- `has_observable_acceptance` — **noul**: names concrete observable checks, not file lists

**Policy:** reject `repair_only` unless `S` is already feature-complete. Reject `scope_size` near `2`
at high confidence. Reject `has_observable_acceptance` below `0.7`. **`stop_ship` halts only when
deterministic tests and QA history support it** — never on the gate alone.

### Developer done-gate — after implementation and deterministic checks

State: plan summary, diffstat, **test exit codes**, recent commands, prior failure ids.

- `diff_matches_plan` — **noul**
- `touches_out_of_scope` — **noul**
- `local_tests_support_claim` — **noul**
- `stuck_repeating_prior_failure` — **noul**
- `risk_of_regression` — **score**: `0` validated behaviour untouched · `2` likely breakage

**Policy:** hand to QA when `diff_matches_plan` is high, `touches_out_of_scope` low and tests green.
Roll back when `stuck_repeating_prior_failure` is high, or `risk_of_regression` is high **and** tests
failed. **Never ask Jev whether tests passed.**

### QA scoring — after Probe writes `E_t`

One **choice** per requirement — `pass` / `fail` / `untested` — plus a `severity` **score** per fail,
`regression_of_validated` **noul**, and `artifact_complete_enough_to_stop` **noul**.

**Missing evidence is `untested`, never `pass`.** The next planner consumes the typed fields first and
retrieves only the relevant report sections.

### Progressive disclosure and routing

Index entries are candidates. Ask a **noul**: *is this prior report relevant to the current plan?* —
and load only those. Route skills and MCP servers with a closed **choice** over the role's allowed
set. **The developer must not load planner skills, or the reverse.**

## 5. Schemas

`D_t`: `loop`, `objective` (one observable sentence), `tasks`, `out_of_scope`, `preserve`,
`acceptance[{id, observable, type: blackbox|whitebox}]`, `repair_targets`, `new_capability`.
**Reject an empty `new_capability`** unless `stop_ship` is explicitly requested and justified.

`E_t`: `loop`, `candidate_git`, `runtime_checks{build, unit}`,
`requirements[{id, status, evidence, severity}]`, `acceptance[{id, status, evidence}]`, `regressions`,
`gaps`, `notes`.

**Schema violation retries that role, capped — and an exhausted cap is a recorded failure, never a
silent pass.**

## 6. Where this diverges from the original brief

**1. The runtime is TypeScript, not Python.** The original offered `runtime.py # or ts`. This repo is
TypeScript, `open-brain` carries the build, test and lint toolchain, and `/sync` is wired to it. A
second language needs its own CI lane.

**2. The loop does not run without Aaron.** The original specifies a fully autonomous loop that
escalates to a recorded blocker rather than asking a human. **That is incompatible with "Aaron
merges, on his word", which has held for every loop in this record.** Current binding rule: **the
runtime stops at a candidate commit and never merges, pushes or tags.** This must be ruled again
before the gates land — **a gate that can roll back and re-run is most of the way to a loop that
ships without him.**

**3. `harness/` is a component, not the product.** The original says the runtime *is* the product.
This repo's product is the memory protocol and its template; `project-template/` is untouched.

**4. Role prompts point at `.agents/roles/`, they do not restate it.** Duplicating role knowledge into
a prompt is the defect PR #44 exists to fix.

## 7. Build order, and where we are

| Slice | Contents | Status |
| --- | --- | --- |
| 1 | Runtime spawning three stubbed roles; schemas + capped retry; git versioning per loop; deterministic checks from exit codes; dry-run | **Loop 15, briefed** (`docs/loops/loop-15-brief.md`) |
| 2 | Jev client, plan gate, developer done-gate | Next |
| 3 | Real role prompts; QA scoring through Jev | Later |
| 4 | Index and selective retrieval | Later |

**Do not start with compaction, or with a single "is it done?" question.** Ranking-by-compaction
plugins are **not** HoH memory — the filesystem index is.

**Sequencing ruled 2026-09-19: Loop 15 runs before Loop 14**, which is re-briefed rather than
deferred.

**What slice 1 does not fix, stated so nobody expects it to.** It addresses **boundary** failures —
one seat holding scope, verdict and write authority at once. **It does nothing about measurement
failures**, which are far more frequent: eleven near-misses in two days, every one an agent
misreading its own instrument. **A runtime cannot stop a seat from running a grep that hides the line
it needed.**

## 8. Secrets

**`TYPESAFE_API_KEY` is read from the environment.** It is never written to a file in this repo, a
prompt, a payload log, an artifact, a commit, or a conversation. **Nobody pastes it into an agent
session.** The client **redacts before logging** and **fails closed with a message naming the
variable** when it is absent.

## 9. Not verified

- **Pricing and latency figures** from the original brief. Not load-bearing for any policy here.
- **Whether the gate policies in §4 produce good decisions.** The shapes are verified; the thresholds
  are guesses until a loop has run against them. **Treat the first numbers as a starting position,
  not a calibration.**
- **The community plugins** `HyunjunJeon/jev-judgment` and `tamaratran/fast-jev-compaction` exist but
  are unevaluated here and are **not** required.
