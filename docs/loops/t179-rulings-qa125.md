# T-179 + T-163: rulings on QA 125 (REJECTED: D1), and round 2 (record 128)

**By:** Atlas (planner), record session 109 · 2026-09-26. **On:** `origin/qa/t179-report` `7df2ed0`,
`docs/loops/t179-qa-report.md`, 420 lines, ending `QA-125: REPORT COMPLETE`. The planner read the Verdict, Defects,
Disagreements and "Open for the planner". It did not read checks 1–7 in detail.

## The verdict, accepted: REJECT `3c0bfdc`

**D1 is exactly T-163's class,** through a door the candidate opened: per-session retention trusts a caller-supplied
session number. One wrong number erases other sessions' records through `ob_state` itself. It cannot be corrected
(G-047), and T163-2 cannot see it, because retention "explains" the removal. What holds (op-level refusal, the
migration, the history scan, `end.md`, the guard, the importer, Addition 1) stays accepted, and round 2 must not
regress it.

**QA's disagreements are all accepted.** In particular, the handoff's "no op can address another's entry" is true of
ops and false of the door. And the `[legacy]` tags do not disappear (D5).

## Round 2 rulings

- **R179-1 (D1, blocking): retention never trusts a number the record cannot check.** For a uuid that `sessions[]`
  has not seen, the writer refuses a `session` above the record's newest `n` by more than **5**. It also refuses any
  `session` low enough that retention would drop the new entry at once. The refusal names the number, the record's
  newest and the rule. **Tests:** QA's A6, A6b and A6c as rows; one wrong number cannot drop another session's entry;
  and T-164's local-greeting number (Forge 124 greeted as 6) is refused, not silently self-erasing. **T163-2** is
  also given the case of a removal that retention would explain only through a number above the bound. It must flag
  it.
- **R179-2 (D2): the guarantee is claimed only as far as it holds,** and one check is added. `ob_set_session` refuses
  a uuid that `sessions[]` already records under a **different checkout**. That covers A8's reconnect-adoption and A7
  against a recorded victim. `end.md` and the handoff state the dependency plainly: "keyed by the registered session;
  until T-003, the registration can be wrong". **T-003 is scheduled next** after this merges. A9 (the server
  surviving `/clear`) is recorded as unobserved, and it becomes a T-003 row.
- **R179-3 (D5): a legacy entry is superseded by the first keyed entry of its seat.** `record-erasure` explains that
  removal. The three stale legacy handoffs (qa@75, developer@74, planner@109) then leave the greeting as each seat
  writes.
- **R179-4 (D6): the after-merge steps (handoff §7) are rewritten in QA's order,** as a checklist Aaron runs:
  1. rebuild;
  2. migrate the live record, re-rendering the four views in the same commit, so `summary-version` passes;
  3. reconnect;
  4. install the new `end.md`;
  5. the SessionEnd hook, registered by `setup.mjs` (R179-5);
  6. seat worktrees, detached or re-branched;
  7. other projects: frogger has a v3 record already, and the rest are not on SIA.
- **R179-5 (D3): `setup.mjs` registers the SessionEnd hook,** so T179-2 does not rest on a README step.
- **R179-6 (D7): `end.md` claims only what the code does.** No "nothing it can erase" until D2's root is fixed. No
  "injects only on a deterministic match" while nothing reads `MATCH:`. Say that step 3 needs a registered session.
  No SIA ids in the template copy.
- **R179-7 (QA Open 6): T163-2's known positives are guarded on CI by a FIXTURE row** that reproduces a removal at a
  revision the walk could skip singly. That is deterministic and costs no CI time. `fetch-depth: 0` is not taken. QA's
  `erasure-blind-rev60` mutant must turn red on tcm.

**Not in round 2:**
- **D4** (`close_task`'s note replaces, like `update_task`'s): folded into **T-171**'s scope, which is widened to name
  both.
- **D8** (`ob_state` writes `state.json` before the views; pre-existing on master): a task.

## Round 2 brief (record 128)

- **To:** a fresh Claude developer session (D-035), record **128**, in **`~/Worktrees/sia-infra` once B Step 1 hands
  back.** Branch `loop/t179-r2` from `origin/loop/t179-merge` (`f618b73`).
- **Read ONLY:** this file, QA 125's Verdict, Defects, checks 1 and 7 and its scripts, and the two T-179 handoffs.
- **Red first:** QA's A6, A6b and A6c, and the R179-7 fixture, on `3c0bfdc`, read on tcm per test. **A code mutant
  per protection,** including one that raises the R179-1 bound to infinity. QA's own mutants
  (`qa/t179-mut-*`) must be red on the new tip. `npx tsc --noEmit -p .` before every push. No full local suite.
  **Never write SIA's live `state.json`.**
- **Push only** `loop/t179-r2` and `loop/t179-r2-*`. **The handoff is pushed BEFORE messaging atlas.** No `/end`.
- **The stacked `/bootstrap` fix (record 127)** merges `loop/t179-r2`'s tip in when round 2 is frozen.

## Amendment 1 (same session): R179-1 re-ruled, and the planner's error entry

**Error entry, planner:** R179-1 as first written ("refuse an unseen session above the record's newest `n` by more than
5") breaks the live record. Its newest recorded `n` is **76**, because no close-out has run since, and every real
session is 128 or later. So every write after the migration would be refused, permanently. Forge 128 found it before
building. **The family:** a bound calibrated against an assumption about the data ("newest is recent") that the data
does not hold. The containment for next time: before ruling a numeric bound, read the actual values it will compare.

**R179-1, amended: retention and "newest" never use the caller's session number.**
- Each entry records the record **revision** at which its session first wrote. "Newer" means a later first-write
  revision.
- An entry's age is the count of **distinct sessions that first wrote after it**.
- Retention drops an entry only when a newer entry of the same (seat, checkout) exists AND more than 10 distinct
  sessions have first-written since.
- The greeting's newest per (seat, checkout) is by revision too.
- **The session number is a label only:** rendered, never compared.
- So a wrong or local (T-164) number can erase nothing. No jump confirmation is needed. QA's A2 and A5 stay as rows
  and pass. A6, A6b and A6c show no erasure.
- T163-2 recomputes retention by the same rule, and a mutant restoring number-based retention must be caught.

## Amendment 2 (same session): Forge 128's questions, ruled

- **R179-1 as built, accepted.**
  - `first_rev` is assigned by the writer, never by the caller.
  - Legacy entries (`first_rev` null) are ordered before every keyed entry. No revision is inferred for them.
  - Everything orders by `first_rev`: `lastSession`, the newest per instance or seat, and handoff provenance.
- **R179-3 as built, accepted.** A legacy handoff is superseded by its seat's first keyed handoff. A legacy SESSION
  record is never superseded: it keeps the uuid the migration promised, and it renders nowhere.
- **R179-2 is narrower than first written, and accepted as stated.** The different-checkout refusal is built. QA's A7
  and A8 in the same checkout, and A9, remain **T-003's**, recorded as not fixed. The slot-adoption check is NOT built
  here; it belongs to T-003's whole registration path.
- **R179-8 (new): done-task retention stops trusting the caller's number.**
  - `closed_session <= session − 3` is D1's class: one write numbered 1124 drops every uncited done task.
  - Instead, a done task is dropped (still kept if cited in tracked files) when at least **3 distinct sessions have a
    `first_rev` after the task's closing revision**. The closing revision is recorded on close.
  - Tasks closed before v3 are ordered before every keyed session.
  - A row: one write numbered 1124 drops no done task. A mutant restoring the number comparison must be caught.

## Amendment 3 (overnight, same session): round 2 frozen at `1646567`; its three departures, ruled

Frozen `1646567` (handoff `d0335d7`, Forge 128). Green `36231392345` (1307 passed, 2 skipped); redcheck `6c8f581`
red `36230084527` (10 AssertionErrors, on exactly the new rows). All of QA 125's seven mutants are red on the new tip,
including `erasure-blind-rev60`, now killed on CI by R179-7's fixture. The planner checked the SHAs, the conclusions,
that the handoff is on the remote, and a clean `git merge-tree` against master `aae0dce`.

1. **`end.md` names no SIA ids, T-003 included: ACCEPTED.** `mirror-parity` requires the repository and template
   copies to be identical, so a template-safe text states the dependency in plain words. The handoff names T-003.
2. **"Other projects" corrected: ACCEPTED.** `~/Projects/A2A-Hub` (v2 rev 66) and its `a2a-*` worktrees ARE on SIA,
   and frogger is v2 rev 0. The planner's line was wrong. Checklist step 7 lists them, and each migrates as SIA's
   record does. A2A-Hub's migration is Relay's seat's to run, or Aaron's, not SIA's.
3. **An unattributed `ob_state` write ages no done task: ACCEPTED as the intended consequence.** Retention counts
   sessions, and a write without a session is not one. Erring toward keeping is the safe side.

**Next:** QA of round 2 goes in the next queue (record 134). The stacked `/bootstrap` fix merges `d0335d7` in
(record 133, `sia-builder`), and so do the importer leftovers (a later cleared session).
