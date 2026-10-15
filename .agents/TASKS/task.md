<!-- generated from .agents/state.json rev 480 by open-brain v0.45.0 — do not edit; change state via ob_state -->

# Current Focus

## Objective

D-145 (Aaron 10-11): SIA loop at normal pace, usage restrictions off; work the backlog by priority (P0 first). 10-13 (Aaron, clark's window, 08:53 CDT): max parallel until the weekly reset at 00:00: every code-only brief goes to clark as soon as it is pinned; runs end at READY + PR; merges still need Aaron's word. QA PC OFF since ~14:3x CDT 10-13 for a RAM upgrade (Aaron's call, told via Relay for clark; no ETA): code-only runs and Opus reviews go to the desktop and the laptop meanwhile; its wakers restart at v1.22.13 on clark's word (SIA GO given, s170). Pending Aaron: T-194 approval mechanics (a)/(b)/(c); planner recommends (c) now, (b) later. _(since session 170)_

## Top tasks

- [ ] **T-160** [P0] Hub transport: make silence unambiguous (push or long-poll), a Stop-hook seat wake, per-agent keys
- [ ] **T-194** [P0] Planner seat hook: a tracked PreToolUse hook mechanically refuses the planner's out-of-boundary acts (source/tests/hooks/build writes, hand edits to rendered views, git merge/push/tag without per-occasion authority), fails closed, and names the rule it enforces
- [ ] **T-196** [P0] The hub procedure is tracked knowledge: each seat's hub room and hub-talk invocation in a tracked data file beside .agents/SYSTEM/worktree-seats.json; a short 'Talking to Cursor seats' section in planner.md (printed in full at /start) pointing at it; a tracked alwaysApply .cursor/rules hub rule; and Cursor's /start joins the seat's room and reads unread atlas turns before proposing anything
- [~] **T-168** [P1] 'Run the full suite alone' must become a check: assert peer idleness before the run and refuse or flag when a peer is busy
- [~] **T-170** [P1] Memory is LOOKUP by default and INJECTION only on a deterministic match against the act; fix the WRITE side first, so every stored lesson carries the key (command pattern, path or error string) that would have caught the mistake
