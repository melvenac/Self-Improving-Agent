<!-- generated from .agents/state.json rev 139 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Current Focus

## Objective

Loop 15 slice three (D-033/D-036): closes when candidates A, B and C are ACCEPTED; Jev calibration is the next slice. A: A13 (4b43410) ACCEPTED by QA 162 (Composer 2.5) and QA 174 (GPT-5.6 Sol) and by the planner on its diff (record session 147); PR #182 awaits Aaron's merge. B part 1 (G-042 repair) ACCEPTED and MERGED (PR #165, 7640b93). B part 2 (E_t schema, R10): criteria in QA 132; its build starts once A merges. C (T-155): after B. Alongside, each ACCEPTED and awaiting Aaron's merge: T-171 r1-r3b (#183, QA 177), importer r6 (#184, QA 172), T-048 r1b (#185, QA 173). Waiting for QA: /bootstrap r4 reconciled (QA 161, d74c0e5), T-048 r2b (QA 178), T-048 r3 (QA 182), T-192 master CI to tcm (QA 183). QA relaunch holds for record 185, the queue's head-restore fix. _(since session 147)_

## Top tasks

- [ ] **T-003** [P0] Session identity is keyed per project, not per session
- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
