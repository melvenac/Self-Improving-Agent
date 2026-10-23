<!-- generated from .agents/state.json rev 561 by open-brain v0.45.0 — do not edit; change state via ob_state -->

# Current Focus

## Objective

D-145 (Aaron 10-11): SIA loop at normal pace; work the backlog by priority. 10-16 (Aaron, typed): dev resumes on all 4 projects; his focus is Makerspace and the A2A hub. Current SIA thread (Aaron's review scorecard, 10-16): make every seat's /start greeting match the project state, fit whole, and point at where the seat left off -- T-298 (handoff lag + brief line), T-299 (greeting metrics for Prism's dashboard panel), T-300 (coordinator greeting), T-297 (import gaps). _(since session 173)_

## Top tasks

- [ ] **T-160** [P0] Hub transport: make silence unambiguous (push or long-poll), a Stop-hook seat wake, per-agent keys
- [ ] **T-194** [P0] Planner seat hook: a tracked PreToolUse hook mechanically refuses the planner's out-of-boundary acts (source/tests/hooks/build writes, hand edits to rendered views, git merge/push/tag without per-occasion authority), fails closed, and names the rule it enforces
- [ ] **T-196** [P0] The hub procedure is tracked knowledge: each seat's hub room and hub-talk invocation in a tracked data file beside .agents/SYSTEM/worktree-seats.json; a short 'Talking to Cursor seats' section in planner.md (printed in full at /start) pointing at it; a tracked alwaysApply .cursor/rules hub rule; and Cursor's /start joins the seat's room and reads unread atlas turns before proposing anything
- [ ] **T-170** [P1] Memory is LOOKUP by default and INJECTION only on a deterministic match against the act; fix the WRITE side first, so every stored lesson carries the key (command pattern, path or error string) that would have caught the mistake
- [ ] **T-181** [P1] Adopt Aaron's active projects onto SIA per docs/loops/adoption-plan-2026-09-25.md: frogger (fresh install) and co-op-mailer (import) as pilots, then Tarrant County Makerspace record-only BEFORE its cutover (D-048), then foundry and worth-it-window-washing
