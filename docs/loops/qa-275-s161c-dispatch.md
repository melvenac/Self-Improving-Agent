# QA 275, session-161 batch c: #434 (T-240), #436 (T-235 P2-5), #437 (T-235 P2-7)

**By:** Atlas (planner), 2026-10-04, record session 161, on Aaron's "go on all three"; timing ruled by clark on
Aaron's "ask clark": dispatch merged now, **launch on Plumb after QA 273 reports**.

**Merge authority:** none pre-approved. An ACCEPT waits for one batch approval from Aaron. **#434 carries a role file
(`.agents/roles/shared.md`)**, which is Aaron's in any case. #425 (QA 273) merges only after #437.

**No batch-merge row in this dispatch.** #436, #424 and #425 all edit `scripts/setup.mjs` and
`scripts/setup-hooks.mjs`, and this batch's merge base depends on what QA 273's ruling merges. The batch-merge row
comes as an amendment (`qa-275-s161c-dispatch-amendment-1.md`) after QA 273 is ruled. **If that amendment is not on
the DISPATCH_SHA, skip the batch row and say so; do not invent one.**

**QA runs on Opus on Plumb** (the PRs were built by Cursor Composer 2.5). **LIGHT:** touched test files, one test file
per vitest invocation, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`, and `gh` reads.
Nothing against the real home directory or a live record. **Set `npm_config_cache` under your tmp folder.**

**Pinned heads (CI `test` green on each, read by the planner):**

| PR | Task | Head | CI run | Built by |
|---|---|---|---|---|
| #434 | T-240: seat runtime in the record; SEATS line prints runtime/model, host, live state | `12f26320fdb89ea9e9c76dfc30790628b707d6d7` | 37186403772 | cursor-infra |
| #436 | T-235 P2-5: `cli-recall-trigger.js` on Cursor `postToolUse` | `144623d2f9707d7b501a0657f842f4a827d85562` | 37186601074 | cursor-builder |
| #437 | T-235 P2-7: dedupe Cursor's double SessionStart / SessionEnd | `23d46156a5fa34873ef1bee0ab723e52d1b33858` | 37186696789 | forge |

## Rows for every PR

1. **Confined.** List the files beyond `origin/master`. Flag any file outside the task.
2. **Red then green.** Run the new or changed test files against master's source (they should fail) and against the
   head (they should pass), and quote the counts.
3. **Mutants.** Re-run one of the developer's mutants and write one of your own. Run `tsc --noEmit` on each, and
   confirm the edit landed.
4. **CI (read only).** Record the `test` result and run id above, and confirm it is the pinned head's run.

## #434 (T-240)

5. **The seatState values are the hub's.** Compare `hub-seat-state.ts`'s accepted values with A2A-Hub master
   `src/seatStateStore.ts` (`SeatStateName`; clone A2A-Hub read-only into scratch). Any value accepted by one and not
   the other is a finding. An unknown value prints `state:unknown(<raw>)`, and a waker seat NEVER prints
   `not polling`: prove both with a row each.
6. **Both runtimes from fixtures.** `ob_start`'s SEATS line renders a `cursor` seat and a `claude-code` seat from
   fixture maps, and a map seat with no `runtime` fails loudly, both in `ob_start` (`seat-map`) and in `/sync`'s
   `hub-seats` check. A `cursor` seat without `dispatch.cursor.room` fails `/sync`.
7. **The map migration is lossless.** Every hub_name, room id and reader pair in master's
   `hub-partner-seats.json` is still present at the head, and `"cursor": true|false` appears nowhere. List any reader
   of the old `cursor` boolean left in `open-brain/src` or `scripts/`.
8. **The CC fallback is labelled honestly**: a `claude-code` seat's line says `hub listener`, never `session`.
9. **`shared.md` switch-runtime procedure:** both directions present, the D-119 OwnerPid rule for each runtime
   (CC: the claude.exe session; Cursor: the nearest cursor-agent ancestor), and the keep-the-hub-names ruling. Report
   any step that names a command not found in the tracked tree.

## #436 (T-235 P2-5)

10. **Only measured names.** `CURSOR_MEASURED_SHELL_TOOL_NAMES` is exactly `["Shell"]`, and it matches
    `docs/loops/t235-p2-5-measure.md`. A `postToolUse` payload with `tool_name` `ShellTool`, `bash` or `Terminal`
    produces no stdout and exit 0.
11. **Claude Code byte-identical.** A CC `PostToolUse/Bash` payload produces byte-identical stdout and exit code at
    master and at the head; compare the bytes.
12. **Registration.** `setup.mjs` in a scratch HOME twice: exactly one Cursor `postToolUse` entry for
    `cli-recall-trigger.js`, absolute paths, user hooks kept; real profile files' hashes unchanged (match / no match
    only).
13. **Honest claim.** The PR and the measure doc say the hook fires, logs and emits `additionalContext`, and do NOT
    claim the model receives it. Flag any sentence that claims injection.

## #437 (T-235 P2-7)

14. **Atomic claim.** `session-hook-claim.ts` claims with an exclusive create (`wx`). Run the race row 10 times; each
    run gives exactly one full run. Then apply mutant M1 (read-then-write) and show the race row fails.
15. **Claude Code never suppressed.** A CC-shaped payload (no `cursor_version`) through the guard twice in a row runs
    in full twice, for both `cli-bootstrap` and `cli-session-end`. Mutant M2 (no `cursor_version` gate) must fail it.
16. **Legitimate re-run.** The same Cursor `session_id` after the TTL (fake the clock or the claim's mtime) runs in
    full. Report the TTL and whether a Cursor resume within the TTL would be suppressed; that is a design limit to
    name, not a failure.
17. **The stale-claim window.** Read the unlink-then-retry path. Can two processes that both saw the same stale claim
    both run? Say yes or no with the reasoning, and write a row if you can make it happen. A yes is a finding, not
    necessarily a blocker; grade its severity.
18. **Simulation vs live.** `docs/loops/t235-p2-7-plan.md`'s after-patch proof is a dual-hook SIMULATION. Say which
    counts in it come from a live `cursor-agent` run and which from simulation. Do not run a live Cursor session.
19. **SessionEnd with #425.** On a scratch merge of #437 onto #425's head (scratch only), two `sessionEnd`-shaped
    Cursor payloads with the same `session_id` give one full `cli-session-end` run and one skip.

## Rules (headless Claude Code)

- You are **QA 275**, prefix `s161c`. Push ONLY `qa/s161c-*` branches, and only through
  `node docs/loops/qa-275/push-qa.mjs <branch>`, run from your `qa275-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names, paths and hash match/no-match, never values (G-051).
- Commit `docs/loops/s161c-qa-report.md` on `qa/s161c-report`.
- One verdict per PR with its pinned SHA. The report's last line is exactly `QA-275: REPORT COMPLETE`.
