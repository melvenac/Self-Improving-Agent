<!-- generated from .agents/state.json rev 86 by open-brain v0.44.1 — do not edit; change state via ob_state -->

# Current Focus

## Objective

Loop 15 slice three, RESUMED at session 78 on Aaron's word. The session-77 budget park is lifted: Opus 5.5 was released 2026-09-22 and ALL THREE SEATS RUN ON IT (Aaron: planner and QA are no longer blocked on Fable 5.1, and the developer moves too). This SUPERSEDES the brief's model line ('developer and QA on Opus 5; planner on Fable 5.1'). QA wrote criteria 17c9056 on Opus 5 and scores on Opus 5.5; acceptance rests on the separation between seats, not on the model, but each seat names its model in its first message and in its tracked report, so T-165's later comparison is not confounded. FIRST: QA (Probe, record session 79) scores the G-045 candidate 9ed674c (tip 5759008) against its criteria 17c9056, running the full suite with peer states recorded (T-168). IN PARALLEL: the developer (Forge, record session 80) writes a DESIGN PROPOSAL, with no build, for brief section 3.2 (a real model-backed role through the runtime) and T-155 (the shadow merge gate, built so T-165 can point a shadow developer at it), and runs no suite while QA's is running. Then Jev thresholds against real diffs, and F11 answered before the first green live loop. Dispatch: docs/loops/loop-15-slice-3-dispatch-2.md (section 0: every seat reads PRD.md, README.md and the SIA Step-Back before acting, and states what the slice is for in terms of the problem statement). Version bump per D-031. Standing constraints: no add_gap until T-158 (R28); no /end until T-163. _(since session 78)_

## Top tasks

- [ ] **T-003** [P0] Session identity is keyed per project, not per session
- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
