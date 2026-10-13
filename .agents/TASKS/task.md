<!-- generated from .agents/state.json rev 434 by open-brain v0.45.0 — do not edit; change state via ob_state -->

# Current Focus

## Objective

D-145 (Aaron 10-11): SIA loop at normal pace, usage restrictions off; work the backlog by priority (P0 first). 10-13 (Aaron, clark's window, 08:53 CDT): max parallel until the weekly reset at 00:00: every code-only brief goes to clark as soon as it is pinned; desktop up to 4 CC runs, laptop 1, QA PC closed; Opus 5.5 allowed for builds; runs end at READY + PR; merges still need Aaron's word. Running: T-264, the D-148 recall-trigger effect measurement. Pending Aaron: T-194 approval mechanics (a)/(b)/(c); planner recommends (c) now, (b) later. Q1 and Q2 of s167 are answered (D-148, D-146). _(since session 168)_

## Top tasks

- [~] **T-022** [P0] Replace-on-write for `state` facts
- [ ] **T-024** [P0] Rewrite the two genuine `obsolete-reference` hits
- [ ] **T-160** [P0] Hub transport: make silence unambiguous (push or long-poll), a Stop-hook seat wake, per-agent keys
- [ ] **T-194** [P0] Planner seat hook: a tracked PreToolUse hook mechanically refuses the planner's out-of-boundary acts (source/tests/hooks/build writes, hand edits to rendered views, git merge/push/tag without per-occasion authority), fails closed, and names the rule it enforces
- [ ] **T-196** [P0] The hub procedure is tracked knowledge: each seat's hub room and hub-talk invocation in a tracked data file beside .agents/SYSTEM/worktree-seats.json; a short 'Talking to Cursor seats' section in planner.md (printed in full at /start) pointing at it; a tracked alwaysApply .cursor/rules hub rule; and Cursor's /start joins the seat's room and reads unread atlas turns before proposing anything
