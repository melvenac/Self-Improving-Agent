# Loop 15, slice two — the ref channel closes, and the gates go live

**From:** Atlas (planner) · **Date:** 2026-09-20 · **Sequenced by Aaron, 2026-09-20:** *"Loop 15 slice
two next, with G-041 as its mechanical first repair, then Loop 14."*
**Base:** `origin/master` at the revision that carries both seats' session close-outs (rev 46 or
later — the developer reads the number from `state.json`, not from this file).
**Branch:** `loop/15-slice-2-gates` · **Fresh sessions required** for developer and QA: both seats
roll after every complete loop, ruled 2026-09-20.
**Guide:** `docs/HOH-JEV.md` is binding. **Roles:** `.agents/roles/*.md`. **Slice one:**
`loop-15-brief.md`, amendments 1 and 2, `loop-15-closeout.md`, QA criteria at
`loop-15-qa-criteria.md`, QA reports 1 and 2.

> **What slice one left, in one sentence.** The runtime enforces the seat boundaries for every
> channel anyone had thought of and one nobody had — commits — and it is blind to the one QA found
> last: **refs.** A role that runs `git tag -f loop-001-developer loop-001-base` during its stage
> completes the loop at exit 0 (`G-041`). Nothing real runs through this runtime until that is a
> refusal, and this slice makes the *not running* mechanical before it makes anything else.

---

## 1. What this loop is for

**Two things, in this order: close the ref channel, then put the Jev client and the first two gates
behind the runtime.** The guide's build order (§7) puts the Jev client, the plan gate and the
developer done-gate in slice two and real role prompts in slice three, and it is right for the same
reason slice one was: *a gate belongs on top of an enforced boundary, not under one.* The boundary
has a hole. The hole closes first.

**Where this brief resolves a loose phrase in the close-out.** `loop-15-closeout.md` §6 says
"slice two is where real roles arrive." The guide's table says real prompts are slice three. **The
guide is the tracked contract and it stands: this slice does not wire a real role.** What the
close-out meant — and what is binding — is that the *first act that could* wire a real role is
`runLoop` accepting a role it did not construct, and that act must refuse until a ref-watch is
present. That refusal is A1, it is testable today through a programmatic caller in a test, and it
is seen red before the ref-watch exists.

## 2. The increment, bounded and locally complete

**Repair — `G-041`, mandatory, first.** A ref snapshot before each stage, compared after, refusing
any change the runtime did not make itself. **Refs, not tags** — tags alone leaves branches and
`update-ref`, and D1's lesson is that naming the observed channel narrowly is how the next channel
gets missed. The developer designs the mechanism; the brief fixes only what it must refuse.

**New capability — one, observable:** `harness run --gate live` sends the plan gate and the
developer done-gate to Jev with the state the guide specifies (§4), reads typed answers, applies
policy from `harness/policies/`, and records the gate's verdict and the runtime's decision in
`artifacts/iterations/tNNN/`. **Roles stay stubbed.** The stubs' `D_t` and diff are what the gates
see; that is enough to observe whether the gate is asked the right question and whether policy is
applied from a file rather than a prompt.

### Deliverables

- **`refWatch` in `open-brain/src/harness/`** (name is the developer's): snapshot of every ref under
  `refs/` before a stage, compared after; any delta the runtime did not author is a failure with a
  new `FailureCode` — the record names the ref and both SHAs. Rollback restores the ref.
- **The refusal flag at `runLoop` entry:** a role object that is not one the runtime constructed
  (`stubRoles()` and, later, its own real-role constructors) is refused unless the ref-watch is
  active. **One flag, failing closed, checked before any stage runs.** Not a comment, not a doc
  line — a thrown refusal with a test that a foreign `RoleSession` triggers it.
- **`JevTransport implements GateTransport`** in `gate.ts` or beside it: `POST
  https://api.typesafe.ai/v1/systemone`, Bearer from `TYPESAFE_API_KEY` **read from the environment
  only**, `model: "jev-latest"`. Absent key → `GateUnavailable` naming the variable; the key never
  appears in a log line, an artifact, a payload dump, a test fixture or a commit — `redact()` runs
  before anything is written. **The four failure classes stay four** (`401`, `422`, `429`, `529`),
  each a distinct outcome the runtime can act on; `422` carries the field the API named.
- **The plan gate and the developer done-gate**, exactly the questions in `docs/HOH-JEV.md` §4, one
  batched call each. `score` requests send `criteria` as a **list** and read `legend` as an
  **object** (the live-call finding, §3). **The done-gate payload carries test exit codes as data
  and never asks Jev whether tests passed.**
- **`open-brain/src/harness/policies/`** — thresholds as data (JSON, zod-validated, derived schema
  drift-checked like `D-021`): `has_observable_acceptance ≥ 0.7`, `scope_size` near `2` at high
  confidence rejects, `stop_ship` halts only with deterministic-check and QA-history support, and
  the done-gate's hand-to-QA / roll-back rules. **No threshold in a prompt or a string literal.**
- **Gate verdicts in the artifact:** `artifacts/iterations/tNNN/G_plan.json` and `G_done.json` —
  the request as sent (redacted), the typed answer, the policy applied, and the runtime's decision,
  with timestamps. Dry-run mode writes the same files with `sent: false`.
- **`T-156`:** every source-text scan in `tests/harness/` gains a fixture that MUST match and one
  that MUST NOT, both asserted, or is replaced by a parse. Small, and it goes in this slice because
  this slice adds scans (no key in source, no network in tests).

### Explicitly out of scope

Real role prompts and real role sessions (slice three). QA scoring through Jev (slice three).
Selective retrieval and the artifact index (slice four). **`T-155`, the shadow merge gate:** it needs
a merge point in the runtime and a gate opinion on QA evidence, neither of which exists until slice
three; it is named here so nobody reads its absence as an oversight. `G-039`'s recall trigger. Any
change to `.claude/commands/` or the hook contract (`T-154`). `G-042` beyond what A9 asks.

## 3. What must be preserved

- **Every slice-one acceptance row still holds on the final candidate** — A1–A6 of
  `loop-15-brief.md` §4, re-run by QA, not taken from the handoff.
- **823 tests green, `sync --check` clean in the QA tree with zero skipped, `module-boundary`
  green.** The harness stays inside `open-brain/src` and imports nothing from memory.
- **`ob_state` remains the only writer of `.agents/state.json`.** The runtime does not touch the
  record.
- **No network in the test suite.** A6's assertion — a test that fails if a network call is
  attempted — extends to the live transport: it is exercised against a fake server in tests and
  against Jev exactly once, by QA, by hand, in A7.
- **The runtime never merges, never pushes, never creates a release tag** (`D-019`, guide §6.2).
  The ref-watch must not change this: `loop-NNN-*` local tags remain permitted and are the one ref
  delta the runtime authors itself.

## 4. Acceptance — observable, derived per item, written before the candidate

QA writes its criteria from this table before the developer's first commit, as in slice one, and
does not widen them after a verdict. **A1 is first and is seen red before A2 exists.**

| id | type | observable |
| --- | --- | --- |
| **A1** | white-box | `runLoop` called with a `RoleSession` the runtime did not construct, with no ref-watch active, **refuses before any stage runs** — a thrown refusal with a distinct `FailureCode`, asserted by a test. The same call with the ref-watch active proceeds. Seen red first: the developer's first commit is this test failing. |
| **A2** | black-box | A stub role that runs, during its stage, each of (i) `git tag -f loop-001-developer loop-001-base`, (ii) `git branch -f <any> <sha>`, (iii) `git update-ref refs/anything <sha>` **fails the loop with a recorded reason naming the ref and both SHAs**; after failure the ref is restored to its pre-stage target. Three cases, three assertions. |
| **A3** | white-box | With `TYPESAFE_API_KEY` unset, `--gate live` fails closed **naming the variable**, before any request is built. With it set, the key appears in **no** log line, artifact, `G_*.json`, test output or fixture — asserted by a test that greps the whole iteration directory and the captured log for the value. |
| **A4** | white-box | Against a fake server returning each of `401`, `422` (with a named field), `429`, `529`, the transport yields **four distinct outcomes**, and the `422` outcome carries the field name. No case collapses into another. |
| **A5** | black-box | `harness run --gate dry-run` writes `G_plan.json` and `G_done.json` with `sent: false` and the exact payload; the done-gate payload **contains the deterministic checks' exit codes as data** and contains no question whose text asks whether tests passed — asserted against the payload, not the prompt file. |
| **A6** | white-box | Changing a threshold in `harness/policies/*.json` changes the runtime's decision with **no source change**; a threshold hand-edited into a prompt or string literal is caught by the policy schema's drift check (the `D-021` pattern). |
| **A7** | live, by QA | **One** real call per gate, from the QA tree, with the key in QA's environment, against the accepted candidate: the response is `jev-1.13.0` or a later version the docs name, each answer is well-typed, the `score` legend is an object, and the two `G_*.json` files record it with `sent: true`. QA records request ids, never the key. Run once; not in CI. |
| **A8** | black-box | Slice one's A1–A6 hold on the final candidate, re-run by QA. |
| **A9** | white-box | `T-156`: every source-text scan in `tests/harness/` asserts one fixture that must match and one that must not; `npx vitest run tests/harness` exits 0 **and** its exit code is read from the process, not from the last line of output (`G-042`). |

## 5. Rulings, so nothing is asked twice

1. **Refs, not tags.** The snapshot covers `refs/` entirely. A watch that lists tags is a slice-one
   observer with a different name.
2. **Foreign-role refusal is a flag at `runLoop` entry, not a convention in `cli.ts`.** The developer
   objected in slice one that "may not run a real role until D6 is closed" was an intention; it was
   right; this is the mechanism.
3. **The key is read from `process.env` at call time and nowhere else.** No `.env` file, no config
   key, no CLI flag, no prompt. `gate.ts` already lists it in `SECRET_ENV_VARS`; the transport uses
   that list.
4. **Thresholds live in `harness/policies/` as data.** zod source, derived JSON, drift-checked —
   the same shape as `D-021`.
5. **Tests never reach the network.** The live transport is unit-tested against a local fake; A7 is
   the one live observation and it belongs to QA, not the developer. An author's green is where
   evaluation starts.
6. **Gate verdicts are artifacts.** `G_plan.json` and `G_done.json` are written whether the mode is
   `dry-run` or `live`; the difference is `sent`.
7. **Failure classes do not collapse.** Four HTTP classes, four outcomes, each nameable by the
   runtime. A transport that returns "gate failed" for all of them has not been built.
8. **`loop-NNN-*` tags remain the runtime's own ref writes** and are the *only* ref delta the watch
   accepts as authored. Anything else during a stage is a failure, including a well-meant one.

## 6. Process — the three-seat loop, as slice one ran it

- **Fresh sessions.** Both seats ended their slice-one sessions on the record before this brief was
  written; the developer and QA who read this are new sessions greeted at the current revision.
- **Criteria before candidate.** QA writes `loop-15-slice-2-qa-criteria.md` from §4 before the
  developer's first commit, on its own branch, and reports it to the planner by SHA.
- **Frozen candidate by SHA.** The developer hands off a SHA; QA runs in the QA tree, made to
  resemble the main tree (indexed, built, `sync --check` with zero skipped). **The main tree is not
  a QA fixture** (`shared.md`).
- **QA probes are not shown to the developer.** They are written into the report after the verdict.
- **The record moves one seat at a time** (`G-036`). Developer writes at the end of its build; QA
  does not write the record; the planner closes.
- **Cite the developer branch by rev, not tip.** The tip moves under every reference.
- **A9's exit-code rule applies to every check in every seat:** check to a file, exit status into a
  variable, commit inside the `if`.
- **Local tags `loop-002-*`.** The runtime's own fixture loop is `t001` again; SIA loop numbering
  and runtime iteration numbering are different counters and this brief does not conflate them.

## 7. What a fresh developer session reads first

In this order, by path, nothing restated here:

1. `.agents/roles/developer.md` and `shared.md` — the rules, with provenance.
2. `docs/HOH-JEV.md` §3 (Jev, verified), §4 (the gates, question by question), §8 (secrets).
3. `docs/loops/loop-15-closeout.md` §6 — what slice one left and why D6 was not a fourth candidate.
4. The prior developer's handoff in `.agents/SESSIONS/next-session.md` — the ref-watch sketch, the
   `G-042` vitest caveat, `T-156`'s fixtures.
5. `open-brain/src/harness/runtime.ts` (`LoopConfig`, `FailureCode`, `runLoop`), `roles.ts`
   (`RoleSession`, `RoleContext`, `stubRoles`), `gate.ts` (`GateTransport`, `DryRunTransport`,
   `UnconfiguredTransport`, `SECRET_ENV_VARS`, `redact`), `git.ts` (`DENIED_SUBCOMMANDS`,
   `resolveRef`, `tagAt`).
6. The scratchpad smoke shape that made the first live call is described in `docs/HOH-JEV.md` §3;
   there is no script to reuse and none should be committed.

## 8. Not held for Aaron

Sequencing is ruled. Merge order at close will be the slice-one order: developer branch by rev, QA
criteria, QA report, planner close-out — presented to Aaron for his word. The version bump is the
developer's, once, in `package.json`, with the CHANGELOG entry; the tag is made after the merge on
Aaron's word or the standing versioning rule.

**What this brief cannot make true:** that a gate's typed answer is correct. *Typed output
guarantees the interface, not truth.* A7 observes that the gate answers; whether it answers well is
what `T-155` will count, later, against Aaron.
