# sia-infra developer handoff: record session 160 (Claude Code, seat Infra)

**By:** sia-infra, Claude Code (Opus 5.5), session uuid `114ff62b-0003-4ec5-b77e-329f86aee646`, 2026-10-03. **Planner:** atlas-sia (native SendMessage, D-029). Rolled at Aaron's word ("Ready to roll?" → finish #401's retarget first, then roll).

## Pick up here

**Nothing is uncommitted or unpushed.** No assignment is open: take the next dispatch from atlas-sia. Every PR below is frozen for QA; push to none of them unless atlas asks (for example a master merge after a conflict).

| PR | Task | Branch | Frozen head | CI | State |
|---|---|---|---|---|---|
| #397 | T-237 pollAgeMs null, r2 (QA 268 F1: the presence bound is the longest form) | `loop/t237-pollage-null` | `9ea9f54a` | run 37166239875 (green) | in QA 269 |
| #401 | T-236 (c) FOCUS + SEATS | `loop/t236c-focus` | `c3ee949b` (master bbc2acbf merged, **retargeted onto master**, 14 files, (c) only) | run 37166318026 (green) | in QA 269; gh reported BEHIND master at roll time (master moved after the merge), not DIRTY |
| #376 | T-203 seat by checkout | `loop/t203-port` | `c02f822f` | run 37118253465 | QA 266 ACCEPT; needs Aaron's merge |
| #387 | T-232 summary once (test-only) | `loop/t232-summary-once` | `9d1ed0c5` | run 37117818217 | awaiting QA |

Merged this session: #371 (T-152), #378 (T-230), #382 (T-232), #391 (T-236 slice 1, closes T-183). The T-236 (c) plan is `docs/loops/t236c-plan.md` on `docs/t236c-plan` (`1493d0a2`); atlas ruled on it, and whether that branch is merged is atlas's call.

**#401 and builder's #402 both touch `renderBudgeted`'s pick-up area. Whichever merges second resolves it.** Agreed placement (atlas-ruled): builder's T-199 notice is appended to the pick-up BODY line in the budgeted layout (net 0 lines). My FOCUS shares the PICK UP header line; SEATS sits before it; brief and skills share a line when SEATS shows. Worst case with (c) on: 30 lines, 3,704 chars (B1).

## Watch out

- **`serializeState` writes only the keys in `KEY_ORDER` (state-schema.ts).** A schema field missing from that list is silently dropped on write, and the write still reports success. Atlas is opening it as its own task. Until then, any new record field goes into `KEY_ORDER` with a row that reads it back from disk.
- **A mutant script that restores with `git checkout -- <file>` restores HEAD.** Commit the fix before mutating, or the restore wipes the uncommitted product (it happened to me on T-232 and was caught before the push). Assert `tsc` 0 on every mutant: a literal `\n` inside a shell-quoted replacement broke three of mine, so they were not counted.
- **Two sessions answer to "sia-builder" in ListAgents.** Reply to the exact `from=` address a message came from.
- **Don't `rm -rf` a Windows junction from Git Bash without checking the target afterwards.** Mine was a scratch `node_modules` junction; the target survived (`tsc` and tests ran), but verify every time.

## Open questions

- Builder's explicit yes on the T-199 placement never reached me (the bridge route reports nothing back). Atlas accepted the placement pending it.
