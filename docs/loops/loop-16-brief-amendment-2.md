# Loop 16 brief — amendment 2: A11 against a base that is already red

**From:** Atlas (planner) · **Date:** 2026-09-20 · **Amends:** `loop-16-brief.md` (`8457600`) §4 row A11
and §6. **After:** amendment 1 (`1453e5f`); the developer's first commit `90e314f` (A1 red, branch
`loop/16-recall-trigger` rev 1); QA's criteria `154d1b3`.

## 1. What QA measured at base, before any candidate existed

Two full-suite runs at `4550ee5`, alone from the QA seat, exit code read from a file: **both exit 1
with 973 of 974 passing and a different single victim each time** — `state-writer.test.ts` (EPERM on
an atomic rename; `G-016`'s family) then `role-files.test.ts` (5000 ms timeout; Loop 14's own C1
file). Both files pass together in isolation (49 tests, exit 0). **`G-042`'s worker-heartbeat
timeout fired in both runs, alone.** The previous QA seat recorded four clean runs alone at a
different SHA; the open question *is G-042 real when nothing else is running* now has two sightings
with nothing else running from that seat — with the honest limit QA stated, that "alone" cannot see
another session's load on the same machine.

A11 as written — *suite exit code read from the process* — would fail a candidate that changes
nothing about this. QA returned the row instead of narrowing it. That is the A7-style rule working.

## 2. Ruling R12 — A11 is scored on the targeted run; the full suite is reported, not scored

**Scored (pass/fail):** the targeted run — the trigger's own tests plus the existing recall tests
(the developer names the exact set in the handoff; QA may add the recall tests if the developer's
set omits them) — exits `0`, exit code from the process; `sync --check` clean with zero skipped in
the QA tree; `module-boundary` green; the network-attempt test covers the trigger's module.

**Reported (a number, both ways):** the full suite, run once alone at the candidate SHA — files and
tests passed/failed, the exit code, the unhandled-errors line, and every victim by file and test
name. **A full-suite failure counts against the candidate only if the failing test (i) fails again
when run alone, or (ii) lives in a file the candidate touched, or (iii) is in the targeted set.**
Otherwise it is recorded as environment, with the SHA, and does not move the verdict. Deterministic
by construction: three checks, any one of which turns an environment failure into a candidate one.

**Not this loop:** repairing `G-042` or `G-016`. Out of scope stands (`§2`); the planner amends
`G-042` at the close-out record write with QA's two runs and their counts, cited by this file.

## 3. Rulings R13 and R14 — two things that needed no file, recorded anyway

**R13 — the developer does not read the criteria.** The planner's GO named the criteria file and
its SHA; the developer declined to open it, on brief §6 (*the developer does not see the probes*)
and on the asymmetry that unreading is impossible. **Correct.** The GO was the planner's slip and
the developer's refusal is the mechanism working — the same shape as the frozen-candidate refusal in
Loop 14 §4. Not numbered, by that precedent; it is here so the next planner does not repeat it.

**R14 — the floor's policy pattern is rebuilt trigger-owned.** Ruling 5 named `harness/policies/`
as the *shape*; §3 forbids the trigger importing from the harness. Both stand: the same pattern —
zod contract, JSON values read at run time, derived schema, byte-for-byte drift test — in a directory
the trigger owns, with no edge to `src/harness/`. The literal module is not reused.

## 4. Sequencing of the criteria file

QA lands the changes from amendment 1 (R1–R4, R8–R10), the A11 change above, and the base-suite
measurement in §7.6, **as one second commit** on `qa/loop-16-criteria` — `154d1b3` is cited and is
not amended. The developer's branch is unaffected. Nothing is pushed by any seat.
