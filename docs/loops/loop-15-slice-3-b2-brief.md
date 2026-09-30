# Loop 15 slice three, candidate B part 2: `E_t`'s schema change (rulings-2 R10), record 187

**By:** Atlas (planner), record session 147 · 2026-09-27. **To:** Grok 4.7 in Cursor (`sia-forge`), a FRESH chat is
fine. Transport: A2A-Hub room `k57frxw0ptb8tadmqdwy0khhks8ey006` only, always with `--as grok --session …`.

**What the planner read before writing this:** the SIA Step-Back artifact, `PRD.md` and `README.md` (the intent);
`loop-15-slice-3-brief.md`'s outline; rulings-2 R10 in full; QA 132's criteria headings BE-0 to BE-8 and its §7 Open;
`loop-15-slice-3-b-et-criteria-rulings.md`. **Not read in detail:** QA 132's per-question reasoning (§3).

## Why now, and what it is for

**Candidate A (A13) merged at `677c1dd`** (PR #182, ACCEPTED by QA 162 and QA 174). R10 made `E_t`'s schema change
candidate B's, and the build waited for A (`harness/schemas`). **B part 1** (the G-042 repair) is ACCEPTED and merged
(#165). **This is part 2.** B is accepted when both hold. C (`T-155`, the shadow merge gate) keys on what this makes
recordable.

`E_t` is the evidence state the Step-Back borrowed from Harness-of-Harness: verified behaviour as a preservation
constraint, every claim tied to evidence. R10 found four places where the schema cannot say what the QA seat
actually observed. **Each is a place where a verdict could be widened or narrowed by the schema instead of the
evidence.**

## Scope: R10 (a) to (d), as ruled

- **(a)** The loop id pattern admits human-seat ids. The exact form is yours.
- **(b)** **No new status value.** Attribution is a field on the acceptance row, `order: shown | attributed`.
  **`order` is REQUIRED on `met` rows, fail-closed** (Open 2).
- **(c)** **`pending` is its own status.** A verdict row with any `pending` item is `undefined`, never
  `would-not-merge`.
- **(d)** Out-of-scope ids are declared in the same parseable block as R3's unrunnable ids, at the criteria SHA,
  before any candidate, and are excluded from the verdict. **The two lists stay separate.**
- **BE-1.3 stays in B** (Open 1): the runtime refuses an `E_t` whose `loop` is not the run's.
- **Who writes `E_t` (BE-7):** the QA seat. B supplies the validator it runs, **not a writer.**

## Done means: QA 132's BE-0 to BE-8, as written

Read them at `git show origin/qa/b-et-criteria-report:docs/loops/loop-15-slice-3-b-et-criteria.md` (§1 and §2). They
are the acceptance criteria (adopted at record 109). **BE-0 is checked first:** the diff's scope. BE-5 is backward
compatibility, and BE-6 is R2's fit test: the table that produced R10 validates without flattening.

**Preserve:**
- A13's accepted behaviour: `configwatch` R95/R96, and R77 stops before git.
- B part 1's G-042 repair.
- Every existing `E_t` consumer. Name each one you find, and how each reads the new fields.

**Ruled now, so it is not lost (Open 5):** once R2's obligation binds (the first QA report after B is accepted), a
human seat fills `runtime_checks`' `build` and `unit` from its own runs, and names each run id.

## Evidence (`.agents/roles/developer.md`, "Building checks"; D-060)

- **Red:** BE's rows, run on tcm against `677c1dd` (the unfixed product), each failing for the reason it names.
- **Green:** the same rows on your candidate, and the full suite, on tcm.
- **Mutants, each an edit to the PRODUCT on its own branch, run on tcm:** at least one per R10 item, plus BE-1.3.
  For example: accept a `met` row without `order`; write `would-not-merge` when a row is `pending`; merge the
  out-of-scope and unrunnable lists.
- Report every run id with one line on why it failed or passed.

## Rules

- **Branch** `loop/15-slice-3-candidate-b2` from `origin/master` `677c1dd`.
- Read by section; your context is 256k.
- tcm, at most 8 runs. **No `windows=true` CI.** `npx tsc --noEmit -p .` before every push.
- Commit checkpoints as you go, and keep a running handoff at `docs/loops/loop-15-slice-3-b2-developer-handoff.md`.
- Push only `loop/15-slice-3-candidate-b2*`. **Push the handoff before posting to the hub**, and read it back with
  `ls-remote`. Never push master, never force push, never tag. No `/end`. Never write the live `.agents/state.json`.
- Your first reply states your worktree and model. An atlas turn is the go-ahead. After you post, `--wait` again.
