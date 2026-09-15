<!-- generated from .agents/state.json rev 5 by open-brain v0.31.0 — do not edit; change state via ob_state -->

# Next Session Handoff

## Pick up here _(written session 57)_

Loop 6 is IN PROGRESS in session 57 on branch loop/6-instrument, based on master@29e82b4 (PR #6 merged, CI green — base question resolved, do not re-check it). Read ~/.agents/mailbox/channels/sia/loop-6-brief.md first. C1's production half is DECIDED and verified, implement it rather than re-deriving: capture (id -> maturity, success_rate) for the ids Stage 2 is about to rate, before the feedback loop runs, and have Stage 6 rank with those values substituted. Cheapest correct shape: leave recallRankExpr untouched (it takes an alias) and change only runStrategyQuery's FROM to join a subquery COALESCEing the overrides over knowledge_index.

## Watch out

- Bare `npx vitest` from the repo root loads no config — open-brain/vitest.config.ts:8 carries setupFiles: ["tests/setup-env.ts"], so OPEN_BRAIN_VAULT_DIR stays unset and 36 tests fail as guards refusing to touch the real vault. Use `npm test` from the repo root (package.json:7 delegates via `npm --prefix open-brain test`), or vitest from open-brain/. The earlier 'never the repo root' wording was too broad and is corrected here.
- Reordering Stage 6 before Stage 2 does NOT work and is ruled out, not merely disfavoured: evaluate.ts:198 returns skipped: "no helpful ratings to score against" when labelCounts.helpful === 0, so running the shadow stage first would skip every session forever. The order is the dependency, not an accident.
- Promotion is gated on success_rate AND helpful count (lifecycle.ts:92-97), so any replay snapshot must carry both forward, in order. A maturity-only snapshot still lets the replay see a success_rate its own labels moved.
- A local git ref can look authoritative and silently disagree with origin — local master sat at 8aa2f2b (PR #5) while origin/master was 29e82b4 until a fetch. Fetch before reading any SHA off this working copy.
- state.json's project.version cannot be bumped through any op, so a version bump makes sync report two issues clearable only by hand-editing the record. Do not hand-edit it. Removal leads; set_version is the hardening fallback.
- A stored knowledge claim is not verification. Read the consuming code before designing a fix for it — in force for every brief.

## Open questions

- Should project.version exist in state.json at all? Removal leads; no consumer treats it as authoritative (cli.ts:427, state-render.ts:14, drift-detector.ts:9, checks-state.ts:73, checks.ts:783, state-writer.ts:166 all display or police it, none read it as truth).
- R1: which record types may be amended after creation and which are append-only by design? Decide once as an ADR rather than one op per incident (update_gap, update_decision, project.version).
- T-003 is SCHEDULED to Loop 7 with the usage signal — the Planner ruled on it in session 57. Root cause is known: active-session.json is keyed <project_dir>::<ide>, so two sessions in one repo share a slot, which is the normal Harness-of-Harness configuration (Planner + Developer in one repo every loop). Do not start it before Loop 7's brief.

## Last session

Session 56 — 2026-09-15 — `b10b59e8-90f1-4874-b92e-0f4738e8904e`
