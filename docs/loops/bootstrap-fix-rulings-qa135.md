# The `/bootstrap` fix: rulings on QA 135, and round 3 (record 141)

**By:** Atlas (planner), record session 109 · 2026-09-26. **On:** `origin/qa/bootstrap-fix-report` `47798b2` (340
lines, ending `QA-135: REPORT COMPLETE`). QA ran on the laptop, DESKTOP-0GV3HAD, the first laptop QA run. The planner
read the Verdict, Defects, Disagreements, error entries and "Open for the planner".

## Verdict accepted: BF-1 to BF-8 PASS; the candidate does NOT merge until round 3

- Frogger's shape (install (i)) met (a)–(e) with no manual fix. QA's three required mutant kinds were all killed.
- **Non-Node projects ARE in scope** (QA's Open 1). T-154 is "a stranger can install this", and Aaron's projects are
  not all Node. So install (ii)'s failure blocks.
- **D2 is a wrong-project write.** It is the class T-185 (R185-5) fixed for the other commands: a missing target that
  silently walks up and acts on another project.
- All three disagreements are accepted. D3 is a routing gap, not wording.

## Round 3 rulings

- **R-BF-9 (D1, D2): `state import` never walks into a parent.** It takes the directory literally when that directory
  holds `.agents/` (as `bootstrap check` does). It needs no `package.json`; the project name falls back to the folder
  name, with a note. With no `.agents/` it refuses, and it never walks up. This is T-185's rule, applied to the one
  command that still walks. **Rows:** QA 135's D1 and D2 tests (`qa135-bootstrap.test.ts`) turn green. A parent's
  `.agents/` gains nothing.
- **R-BF-10 (D3): `check` has a "scaffolded, not imported" state** that routes to step 4, not 6. The importer WARNS
  when INBOX is identical to the template's. **Row:** QA's P6 or D3 test.
- **R-BF-11 (D4): `check` calls a project BOOTSTRAPPED only if `state.json` parses and is not the `{{PROJECT}}` seed.**
- **R-BF-12 (D5): residue moves never nest,** and never say "refused" after moving. An existing dated folder gets a
  suffix. The read-back is accurate. M13's row is added (QA's Open 4).
- **R-BF-13 (D6): an empty project's "before SIA" commit** is `git commit --allow-empty`, named in step 2.2, and `check`
  detects the empty tree.
- **D7, D8:** fix if one line each. D8's stale comment in `role-files.ts:66–69` ("a not-a-seat write is refused") IS
  required: it is the false claim the planner's charter also made.
- **Out of scope, recorded as tasks:** the views stamped with the project's version (`header()`); the markdown bold kept
  in the objective; F13; the template README's standalone `cp -r` path.
- **Machine (QA's Open 5):** the laptop was the intended machine. Its queue was launched there, and the driver's
  `claude` rule found the right copy.

## Round 3 brief (record 141)

- **To:** a fresh Claude developer session (D-035) in the first free checkout. **Branch** `loop/bootstrap-fix-r3` from
  `origin/loop/bootstrap-fix-r2` (`b45900f`). It stays stacked on T-179 round 2.
- **Read ONLY:** this file; QA 135's Defects, installs and tests (`origin/qa/bootstrap-fix-report`,
  `docs/loops/qa-135/`); and the r2 handoff.
- **Red first:** QA's D1–D5 tests on `6543e8e`, read on tcm per test. A mutant per protection. `npx tsc --noEmit -p .`
  before every push.
- **Acceptance:** BOTH of QA's installs, (i) frogger's shape and (ii) an empty folder, meet (a)–(e) with no manual
  fix. Add a third, (iii) a non-Node project (for example a folder with a `pyproject.toml`) under a parent that IS a
  Node project with `.agents/`: nothing may touch the parent.
- Scratch only. Push only `loop/bootstrap-fix-r3` and `loop/bootstrap-fix-r3-*`. **Push the handoff BEFORE messaging
  atlas.** No `/end`.
