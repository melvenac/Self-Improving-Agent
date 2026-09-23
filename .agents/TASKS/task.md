<!-- generated from .agents/state.json rev 93 by open-brain v0.44.1 — do not edit; change state via ob_state -->

# Current Focus

## Objective

Loop 15 slice three, on v0.44.1. SCOPE (D-033 as amended by D-036): the slice CLOSES when candidates A, B and C are ACCEPTED; Jev calibration is the next slice. DONE: G-045 (PR #101, f673d5e, v0.44.1). CANDIDATE A 3b19287 was REJECTED by QA (report docs/loops/loop-15-slice-3-qa-report-a.md at 10eb4d0 on origin/qa/loop-15-slice-3-report-a; PR #112 closed; branch kept). BLOCKER D-A1: layer 2's restore follows a planted directory junction OUT of the repository, deleting and writing files outside it, then records a successful restore; the runtime is the actor, proven by the attribution mutant. Everything else passed. NOW (rulings-6): CANDIDATE A2 = a new frozen SHA on A's base that repairs D-A1 (in the direction of the developer's final handoff section 1, at 216cec6 on origin/loop/15-slice-3-forge-design-b) and D-A3 (the timeout text must say only what the kill did), and nothing else. FIRST the fresh QA session finalises CA-15 (the watched paths' TYPE: a junction, a POSIX symlink on CI, and the attribution mutant) plus the criteria-side fixes D-A2 and D-A4, commits them, and only then is A2 built. THEN B = the G-042 repair (design e1173b1; Step 0 reproduces red 3 of 3 under generated load at A2's accepted SHA before B's criteria) + E_t's schema (rulings-2 R10). THEN C = T-155. THEN the close-out with T-169. ALL SEATS START FRESH SESSIONS (D-035); the developer and QA seats of sessions 79/80 have stopped with tracked handoffs, and the planner of session 78 hands off at rev 91. Record model AND effort from the transcript's per-entry field in every report. Merges: record/docs-only through D-032's path check; candidates are Aaron's. Other projects' seats are recorded beside suite results and pause on request (D-034). Standing: no add_gap until T-158 (R28); no /end until T-163. _(since session 78)_

## Top tasks

- [ ] **T-003** [P0] Session identity is keyed per project, not per session
- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
