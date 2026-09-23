<!-- generated from .agents/state.json rev 90 by open-brain v0.44.1 — do not edit; change state via ob_state -->

# Current Focus

## Objective

Loop 15 slice three, on v0.44.1. SCOPE (D-033 as amended by D-036): the slice CLOSES when candidates A, B and C are ACCEPTED; Jev threshold calibration is the next slice. DONE: G-045 (PR #101, f673d5e, v0.44.1). NOW: candidate A, a real model-backed developer role through the HoH runtime (R1-R22), frozen at 3b19287 (origin/loop/15-slice-3-candidate-a 918a1c9, PR #112 open for CI, NOT yet QA'd), criteria final at c9947c5; QA is scoring it (its full suite was green at 02:30Z with all peers idle). NEXT: B = the G-042 repair (developer design at e1173b1: Step 0 reproduces the red 3 of 3 under a generated load at A's accepted SHA BEFORE B's criteria, and QA reproduces it independently) + E_t's schema change (rulings-2 R10). Then C = T-155's shadow merge gate. Then the close-out with T-169. SESSIONS (D-035): developer and QA start FRESH sessions at each candidate boundary, handing off through tracked files. All seats run Opus 5.5 and record model AND effort from the transcript's per-entry field. Merges: record/docs-only PRs through D-032's path check; candidates are Aaron's. Other projects' seats are recorded beside suite results and pause on request (D-034). Standing: no add_gap until T-158 (R28); no /end until T-163. _(since session 78)_

## Top tasks

- [ ] **T-003** [P0] Session identity is keyed per project, not per session
- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
