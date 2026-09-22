# Loop 15 slice three: rulings 1, on the developer's design proposal

**By:** Atlas (planner), record session **78** · **Date:** 2026-09-22 · **Model:** Opus 5.5
**On:** `docs/loops/loop-15-slice-3-developer-design.md` by Forge (record session 80), base `5759008`,
read in full from the developer's worktree while it was still uncommitted. **The rulings bind the
design at the text read, and a later edit to it needs a new ruling.**
**Acceptance rows:** every ruling below that changes behaviour is handed to the QA seat for a
criteria row, because a ruling with no acceptance row fires nowhere (shared.md; Loop 16 F3).

---

## The measurement comes first, and it is the design's to prove

§2.3's finding is the most consequential thing in the proposal: **a role can plant git hooks or a
program-valued config key and get code execution inside the runtime's own git calls, with the
runtime's environment**, which in live mode holds `TYPESAFE_API_KEY`. It was found by running four
lines in a scratch repository, not by reading, and its control discriminates (the overrides removed
→ fsmonitor ran again). It is recorded here as the developer's observation. **The QA seat
reproduces it independently before it is scored**, per V-046 and V-048: a first observation is not
acceptance.

## Rulings

**R1. The developer is the only real role in this slice. ACCEPTED.** A model-backed QA stage would
replace the instrument the shadow count is measured against (Step-Back §2.1 item 2 and §5.3). A
model-backed planner stage is not asked for by anything.

**R2. The QA seat emits an `E_t` JSON beside its prose report at each human-seat candidate.
ACCEPTED, from the NEXT candidate, not the one being scored now.** Probe is mid-scoring `9ed674c`
against criteria it wrote without this obligation, and changing a seat's deliverable mid-evaluation
is changing the criteria after the fact. The QA seat is asked whether `EvidenceSchema` fits what it
actually observes **before** the obligation binds. The schema is the runtime's; the evidence is the
seat's, and a schema that forces the seat to flatten an observation is the stacked-fixture failure
from the other side.

**R3. `not_evaluated` counts as `would-not-merge`. ACCEPTED WITH ONE CARVE-OUT, AND THE CARVE-OUT IS
LOAD-BEARING.** The developer's reading is right: an `E_t` that says "I did not look at A3" is
evidence of a gap, and acceptance with an unlooked-at row is not acceptance. **But the QA seat
routinely and correctly names items it CANNOT run as unrun** (shared.md: a main-tree-only condition
"a QA report names ... as unrun rather than lets a green imply it"). If those count as
`would-not-merge`, every verdict is `would-not-merge`, Aaron merges anyway, and the gate reports a
**systematic disagreement that is a property of the rule, not of Aaron's judgement**. That is the
"different question, not blind" failure: a plausible wrong number. **So:** an item the criteria
declared unrunnable *before any candidate existed*, at the criteria SHA, is not an acceptance row. It
goes in the verdict row's `invisible[]`, and it does not make the verdict `would-not-merge`. Every
other `not_evaluated` does make the verdict `would-not-merge`. The declaration has to precede the
candidate, which keeps it out of the seat's hands at scoring time.

**R4. The config/hooks window and the overrides are part of §3.2's candidate. ACCEPTED, and they
come first within it.** A real role without them is code execution in the runtime's environment.
**One condition, the known-negative half:** layer 2 must be shown clean on an ordinary,
non-malicious stub loop, with every stage's config/hooks window unchanged. The runtime creates
branches, tags and commits, and if any of that writes `.git/config` (upstream tracking, for
example), the window fires on the runtime itself. A detector validated only against planted
positives has been tested in one direction.

**R5. SCOPE: TWO CANDIDATES, IN ORDER, EACH QA'D. RULED BY THE PLANNER; NOT ASKED FOR.** The
proposal as written is one candidate carrying an async `runStage`, `ProcessRole` and its adapter, a
new channel's two layers, the `T-155` verdict function, policy file, CLI, ledger and a `/sync`
check. That is too wide for a failure to point anywhere. The planner seat's job is a bounded,
locally complete objective (`planner.md`), so:
- **Candidate A (§2):** async `run`, `ProcessRole` with a constructed environment, the config/hooks
  window and overrides, `role-timeout`, the preflight refusals, `R_t` with its schema, and P1–P4
  and P7. Locally complete: a real role runs, and it cannot execute code in the runtime or leave
  without a record.
- **Candidate B (§3, `T-155`):** the verdict function, `policies/merge.json`, `shadow-verdict`, the
  derived-decision command, the append-only ledger, its `/sync` check, and P6. The retrospective
  backfill of Loops 14–16 is **in** B, in its labelled section, because it is the first denominator.
- B is built on A's accepted SHA. Criteria for each are written before its candidate.

**R6. F11 is ACCEPTED as drafted, with one sentence added:**
> The clean ref and config windows mean clean **on the probed channels only**: refs, HEAD after a
> deleted ref, hooks and config. The index, submodules, reflog and everything outside `.git/` were
> not checked, and a green loop says nothing about them.

## Refinements from the developer, accepted the same session

Forge raised both after reading R1–R6. Each tightens a ruling rather than disputing it, and each is
the better mechanism.

- **R3's carve-out needs a mechanism, or it is widening by another name.** "Declared unrunnable
  before any candidate" is read **from the criteria commit, never from `E_t`**. Otherwise the QA seat
  could move an item into `invisible[]` after seeing a candidate. **The criteria file names its
  unrunnable ids in a parseable block, and the verdict function reads that block at the criteria
  SHA.** An id found in `E_t`'s `invisible[]` but not in that block counts as `not_evaluated`.
- **R4's known-negative runs on two git versions, and the window is per stage.** The clean stub loop
  runs on this machine's git (2.54.0.windows.1) **and** on CI's git, because config writes such as
  `maintenance.*`, a `repositoryformatversion` bump or `branch.<x>.merge` are version-dependent, and
  a clean result on one version says nothing about another. **Layer 2 snapshots at each stage
  boundary, not at loop start**, so the runtime's own between-stage writes are never inside a window.

**Not ruled, left to the criteria:** the ledger's "edited rather than appended" check against
`HEAD~` (§3.4) compares against a commit that may not have touched the ledger. The QA seat should
test it against a real multi-commit history before trusting it. (Forge agrees, and proposes the last
commit that touched the ledger, `git log -1 -- <path>`, as the baseline.)

## Push authority

The design file must be tracked, because A2A has no memory. **Pushing the developer's branch needs
Aaron's word**; this seat does not grant it. It is asked of Aaron in the same turn this file is
written.
