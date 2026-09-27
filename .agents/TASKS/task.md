<!-- generated from .agents/state.json rev 134 by open-brain v0.44.2 — do not edit; change state via ob_state -->

# Current Focus

## Objective

Loop 15 slice three (D-033/D-036): closes when candidates A, B and C are ACCEPTED; Jev calibration is the next slice. A: A11 (ef2a8a7) REJECTED narrowly by QA 130 on R85's whole-file search (rulings-20); A12 = R90-R94, a small round, Grok record 143. B part 1 (G-042 repair) ACCEPTED by QA 129 and MERGED (PR #165, 7640b93). B part 2 (E_t schema, R10): criteria in QA 132; build waits for A to merge. C (T-155): after B. Alongside: T-179 round 2 (1646567, QA 134) migrates the live record at merge; stacked on it: /bootstrap fix (round 3 building), importer leftovers (QA 138), T-003 (QA 142 queued), T-171 (QA 144 queued). _(since session 109)_

## Top tasks

- [ ] **T-003** [P0] Session identity is keyed per project, not per session
- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
