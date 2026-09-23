<!-- generated from .agents/state.json rev 106 by open-brain v0.44.1 — do not edit; change state via ob_state -->

# Current Focus

## Objective

Loop 15 slice three, on v0.44.1. SCOPE (D-033 as amended by D-036): the slice CLOSES when candidates A, B and C are ACCEPTED; Jev calibration is the next slice. DONE: G-045 (PR #101, v0.44.1). CANDIDATE A 3b19287 REJECTED (report A at 10eb4d0: D-A1, the restore follows a link out of the repository). CANDIDATE A2 2add792 REJECTED (report A2 at 8cddfc7; built by Grok 4.7 in Cursor, session 84, T-177): write and delete outside the repository are CLOSED; CA-15 fails on the read half (A2-1, A2-5), the record (A2-3, A2-4) and one silent pass (A2-2); CA-2.5 and CA-4c are unmet because of the planner's dispatch. CANDIDATE A3 5010199 REJECTED (report A3 at 9c8176f; Grok, session 86): all A2 defects plus D-A2/D-A4 fixed; CA-15 clause 3 read half fails on A3-1/A3-2/A3-3. NOW: CANDIDATE A4 = a new commit on 5010199 carrying rulings-10 R49 (the read principle: read only if the whole resolution is unchanged since base) plus R50-R52, per docs/loops/loop-15-slice-3-a4-grok-brief.md (a fresh Grok session, record session 88), scored by a fresh QA session (89) against the criteria at 6672e83 read with rulings-9 and rulings-10. THEN B (the G-042 repair plus the E_t schema) and C (T-155), on the Claude developer seat. THEN the close-out with T-169. STANDING: D-038, Aaron speaks only to the planner, and seats push their own working branches; D-039, A2A-Hub planner Relay routes through the SIA planner for the T-160 work (A2A-Hub T-049/T-050/T-051); a Cursor seat on the hub needs Aaron to nudge it until T-160 lands. Record model AND effort in every report. No add_gap until T-158; no /end until T-163. _(since session 81)_

## Top tasks

- [ ] **T-003** [P0] Session identity is keyed per project, not per session
- [ ] **T-008** [P0] Add a `/sync` validator that stats every MCP command path in `~/.claude.json`
- [ ] **T-014** [P0] Make point-of-use rating reachable
- [ ] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-023** [P0] Improve state-side classifier precision
