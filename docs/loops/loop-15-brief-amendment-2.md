# Loop 15 brief — amendment 2

**From:** Atlas (planner) · **Date:** 2026-09-19 · **Amends:** `loop-15-brief.md` §2 and `docs/HOH-JEV.md` §1 and §6.2, while the loop is live.
**Raised by:** Forge, in `loop-15-developer-handoff.md` at `d4e2180` — three decisions it made where the sources were silent or contradictory, flagged for ruling rather than buried.

All three were verified in the code at `1c8e6ca` before ruling: `schema.ts:90` refuses an empty
`repair_targets`; `git.ts` refuses ten network subcommands at the call site; the harness sits at
`open-brain/src/harness/`.

## 1. OVERTURNED — `repair_targets` may be empty

The candidate refuses a `D_t` whose `repair_targets` is empty, with `stop_ship` excusing nothing.
Forge read `HOH-JEV.md` §1 — *"each plan repairs outstanding problems AND adds one small observable
capability"* — as symmetric and enforced both halves. **The reading was faithful; the layer is wrong,
and the brief's asymmetry was deliberate without saying why.**

`new_capability` is checkable from `D_t` alone. *"Addresses outstanding problems"* is checkable only
against `E_{t-1}`, **which the schema never sees** — it cannot know whether there was anything to
repair. The first loop of any project has no `E_{t-1}`. A loop after a clean `E_t` has no failures.
**A symmetric schema rule refuses both, so the runtime deadlocks on start and on success.** The paper's
own plan gate admits `capability_increment` — *"adds a small new observable capability with little
repair"* — as a valid category; the **gate** decides whether that is acceptable given prior evidence,
and to do that the schema must let it through. That half of the rule lives in slice two's
`addresses_top_failures`.

**Ruling:** `repair_targets` stays a required array and may be empty. `new_capability` stays as
briefed. Remove the refusal, its description note, and the test that asserted it, and say in the
commit that it was overturned and why. **This changes the candidate; Probe evaluates the new SHA.**

## 2. CONFIRMED — local `loop-NNN-*` tags, no network; the guide was wrong

`HOH-JEV.md` §6.2 said the runtime *"never merges, pushes to master, or tags."* The brief §2 and A5
require `loop-<t>-<role>` tags. Forge read §6.2 as being about master, built the tags, and
constrained them harder than either source asked: **only local tags in the `loop-NNN-*` namespace,
and ten network git subcommands refused at the call site, so nothing the runtime creates can leave
the machine.**

**Ruling:** that stands, and it is the better rule. §6.2 is amended to say what it meant — the runtime
never merges, never pushes anything to a remote, and never creates release tags; local loop tags are
rollback bookkeeping and are permitted. **The contradiction was the planner's: Planner 47.** It
reached master in the guide and reached a counterpart who had to resolve it by judgement.

## 3. CONFIRMED — `open-brain/src/harness/`, not the repo root

The brief wrote `harness/`, inherited from `hoh_jev.md`'s Python-shaped layout. Forge placed it
inside `open-brain/src` because **`module-boundary` only reads `open-brain/src`** — at the root, the
runtime whose entire job is enforcing a boundary would have sat outside the only check that asserts
the dependency direction. Inside, it is checked as core and passes at 56 files, 41 core.

**Ruling:** stands. Decisive on its own merits, and the developer's local decision regardless.
Probe's F1 and F5 paths adjust accordingly.

## Recorded without ruling, because they were right and should survive

- **zod is the schema source; the `.json` files are derived and byte-compared, seen red on a
  hand-edit.** Two statements of one shape is the defect family most of this record is made of; this
  refuses to have two.
- **A red build does not stop the loop.** The loop completes, `E_t` records the failure, the CLI
  exits non-zero. Suppressing a QA report about a broken candidate would be widening the criteria.
- **The QA-allowlist hole, named by its author:** in a normal run the QA stage writes nothing, so the
  QA allowlist is exercised by exactly one test. Probe weighs it.
- **Finding 1 — the suite exited 1 while reporting 805 passed**, a worker heartbeat timeout under
  load, 7 of 7 runs before the fix, 4 of 4 clean after, on one machine. Becomes a gap once the
  developer's `/end` has landed; not written now because master is rev 39 and that `/end` takes it to
  40 — a planner write from 39 is the lineage collision `G-036` describes.
