# grok-qa-sia first-pass: #472 r4 (HUBROOM-GUARD) at ba7b81ae (planner s163)

**Seat:** grok-qa-sia (D-125, D-126, D-127). **Kind:** FIRST-PASS on a candidate. Your verdict is FIRST-PASS PASS or
FAIL, never ACCEPT or REJECT; an Opus QA run reads your report later and re-runs the deciding rows.
**Candidate:** PR #472, `loop/hubroom-guard-r2` @ `ba7b81aef395ca0bbbb8fa82bb7942cb6e1440e3` (CI 37460362456 green).
**Previous head:** `26edb821cac073172ad8788ac99128fa3fad4bde` (r3, rejected by QA 284).
**Blind:** do NOT read any `qa/*` branch, any `docs/loops/*qa*` file, or PR #472's comments.

## Rules

As your baseline: read-only token, report as hub turns, every row with its command, exit code and quoted output, on Node 22.
Use a scratch clone. Restore every mutant (`git checkout --`) and say so.

## Rows

**R0** `node --version` (v22.x, else stop and FAIL). **R1** detached checkout of ba7b81ae; `git rev-parse HEAD`.
**R2** `cd open-brain && npm ci && npm run build` (exit codes). **R3** `npm run typecheck`, `npm run typecheck:tests`.

**R4 the guard's test file, five times.** `npx vitest run tests/pipelines/sync/hub-talk-exit-codes.test.ts`, five
separate runs. Give the exit code and counts for each run. Then run every OTHER file in `open-brain/tests/pipelines/sync/`
once each, one per run.

**R5 planted sentences.** Write a small probe (tsx) that inserts each sentence after the anchor sentence "Post when the
work is done, not a bare acknowledgement." in a copy of `.cursor/rules/hub-room.mdc`, and calls
`hubRoomGuardViolations` from `open-brain/src/pipelines/sync/hub-room-guard.ts`. Report caught (non-empty) or ok (empty).
MUST be caught:
- S1 "After posting, run the talk line again. Wait for the next atlas turn and act on it before you end the turn."
- S2 "Run node scripts/hub-talk.mjs --as you --session room and wait for the reply."
- S3 "Then keep listening for atlas's next turn before you end the turn."
- S4 "After posting, run hub-talk with `--inbox` again until the next atlas turn arrives, then handle it in this run."
- S5 "Once hub-talk has waited for atlas, act on its reply."
- N4 "After posting, run hub-talk with `--inbox` once more. Then wait, and act on atlas's reply."
- TB "If no atlas turn is printed, wait 60 seconds and retry hub-talk until atlas replies."
MUST be ok:
- S6 "Don't wait on hub-talk after you post."
- FA1 "Wait for CI to finish before you post your reply."
- FA3 "If atlas's reply asks for a test, wait until the test passes, then post."
- FA5 "Never wait for atlas inside a turn."
- TH "If hub-talk is throttled, wait 5 seconds and retry."
Also run the probe on the three tracked copies exactly as committed (both `hub-room.mdc` files and `start.md`'s Hub-room
section): all must be ok. Run FA3 planted in `start.md`'s Hub-room section as well as in the mdc.

**R6 source mutants.** For each check, disable it **in the source** of `hub-room-guard.ts` (not via a skip option):
the `--wait` count, the seat-file `wait` key, the nested per-seat `wait` key, the hub-verb in-turn check, the atlas/next-turn
clause check, the cross-sentence check, the throttle exemption's scoping, and the negation scope. For each: `tsc --noEmit`
exit code, the test file's result (it must go RED), and the name of the test that went red. Restore after each.

**R7 skip options.** Grep `open-brain/src`, `scripts/`, `.cursor/` and `project-template/` for any caller that passes a
skip option to the guard outside tests. List the hits, or say none.

## Report

Hub turns in order R0 to R7. The last turn's first line is exactly `FIRST-PASS PASS <short>` when R0 to R3 exit 0, R4 is
green in all runs, R5 matches the expected column on every line, every R6 mutant goes red, and R7 finds no production
caller; otherwise `FIRST-PASS FAIL <short>`, followed by a one-line reason.
