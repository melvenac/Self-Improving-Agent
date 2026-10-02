# Forge seat handoff (roll, 2026-10-01)

Written by Forge (sia-forge) at Clark's request before the roll. Nothing is uncommitted; every branch below is pushed. Planner names from the restart: **`atlas-sia`** (SIA) and **`relay-a2a`** (A2A); `clark` is the fallback. SIA master has ruleset 24343321 (PR plus CI test required, direct pushes refused), so work reaches master only through a PR.

## State of my branches (all on origin, none merged by me)

| Branch | SHA | What | Status |
|---|---|---|---|
| `loop/t194-planner-hook` | `71ea3101` | T-194 r7, the planner-seat PreToolUse hook (`open-brain/src/planner-hook/`) | **PAUSED per D-089.** Awaiting QA 246. Hook is NOT registered in any settings file. |
| `loop/t204-machine-lease` | `d5b3623f` | T-204 machine lease, built | Accepted for QA (rev 203). Aaron's re-copy of the merge step is still his. |
| `loop/t202-seat-online` | `965a7c53` | T-202 PLAN ONLY (`docs/loops/t202-plan.md`), no code | Atlas told me to push it; pushed. Not built. |

## T-194 r7 in one paragraph

Full account in `docs/loops/t194-r7-developer-handoff.md`. 1101 tests green, build and tsc exit 0, 139 mutants all killed. **The single uninterrupted mutant pass did not happen** (first attempt killed for low memory; the capped retry ran 35 chunks of 4; 123 kills predate the last fix and 16 were re-run). QA 246 runs all 139 in one pass, runs CI on Linux (never run by me), judges the 61-entry allow-list entry by entry, and checks the refusals beyond the dispatch (env vars, quoted non-ASCII targets).

## Open items

- **Hub post as forge**: my classifier denied it. It is Aaron's hand only; I did not retry. I never had its text recorded in a file, so it needs restating if wanted.
- T-202 build waits on a ruling; T-194 waits on D-089 and QA 246.

## Habits that cost time this session

- Heavy runs (npm ci, full vitest, mutants) need Aaron's approval in the window; a peer relaying approval is not his approval.
- Mutant runs on the QA PC: one vitest worker, chunks of 4, skip under 1.2 GB free; the system reaper kills background jobs under memory pressure, and a kill can leave a mutant applied (`git checkout` the file first).
- Anything a later session must read goes in a tracked file before the A2A exchange ends.

## Update at the second roll (2026-10-02)

- **T-221 is DONE and FROZEN** at `9ab021fd` on `loop/t221-ci-concurrency` (PR #274, not merged by me). It goes to QA 250 with T-222. Handoff: `docs/loops/t221-developer-handoff.md`.
- **Queued for me: T-164/T-211 r2 (D-095).** Its DISPATCH_SHA will be PR #280's merge commit; Atlas (`atlas-sia`) sends it after the roll. Do not start it from this note: wait for the dispatch.
- T-194 stays PAUSED (D-089), at `71ea3101`, awaiting QA 246. The hub post stays with Aaron.
- Reports go to `atlas-sia`; `clark` is the fallback. The `ctx_*` (context-mode) tools were NOT available before the roll; check with ToolSearch "ctx_execute" after the restart and tell Clark yes or no.

## Update at the third roll (2026-10-02; Aaron is testing roll-in-place from his phone)

**Seat:** Forge, checkout `sia-forge`, Claude Sonnet 5.5. Everything below is pushed. Reports go to `atlas-sia`; `clark` is the fallback. **Vitest on the QA PC: single files only unless clark books a slot** (chisel holds the HEAVY slot for mutant runs). I merged nothing; every PR is frozen for QA.

### Delivered this session (all PRs open, none merged by me)

| PR | Branch @ tip | Task | State |
| --- | --- | --- | --- |
| #310 | `loop/t227-ci-hosted` @ `b27d7c70` | T-227 CI on hosted runners, tcm opt-in | live runs done, see Next 2 |
| #309 | `loop/t048-hook-configs-nested` @ `eb721dec` | hook-configs descends matcher groups; `sh -c` is not-checked | stacked on #306 |
| #308 | `loop/t186-summary-bom` @ `65eb9e94` | SUMMARY.md leading BOM | |
| #306 | `loop/t048-sync-counts` @ `d8dc12db` | 18 T-048 sync rows, counts | |
| #305 | `loop/t152-typecheck-tests` @ `84e75618` | typecheck:tests; fixed 36 of 40 errors; 4 remain (B) | waits on #294 |
| #303 | `loop/t176-index-divergence` @ `112a4139` | gitnexus-index both directions | |
| #301 | `loop/t163-closeout-append` @ `11c183e4` | T-163 verified already built; one test | |
| #300 | `loop/t051-skills-contract` @ `5ae7f9f2` | skills contract check | |
| #298 | `loop/t008b-mcp-sources` @ `7b09c5b7` | MCP paths from .mcp.json and plugins | stacked on #295 |
| #295 | `loop/t008-mcp-paths` @ `cc285738` | MCP command paths check | |
| #294 | `loop/t215-maturity-cut` @ `c1fc5ecc` | maturity-lifecycle cut in code | |
| #290 / #289 | `loop/t212-trailer-attribution` @ `1e61ccb2` / `loop/t208-fetch-first` @ `e442b955` | T-212 / T-208 | **QA 254: T-208 REJECT, T-212 ACCEPT, pair REJECT** |

Also done earlier: T-164/T-211 round 2 (`loop/t164-port` @ `892f7644`, `loop/t211-standing-cron` @ `3b0b8188`; QA's r2 report is on `origin/qa/t164-t211-r2-report`, not read by me since). Every handoff is `docs/loops/<task>-developer-handoff.md` on its branch.

### FIRST: QA 254's REJECT of T-208

Report: `origin/qa/t208-t212-report`, `docs/loops/t208-t212-qa-report.md`, section "For the developer (T-208 r2)". Two defects and an edge, in `tree-currency.ts` and `cli-bootstrap.ts` (my files):

1. **A failed fetch rewrites FETCH_HEAD** (git truncates it even on failure), so `readLastFetchAt` returns the FAILED attempt's time. The FAILED line says "a fetch from <that time>", and afterwards `ob_start` and `/sync` print "level with origin/master, compared against the last fetch (<failed time>)" while origin is ahead: T-208's own evidence scenario, now with a fresh timestamp. Fix shape: remember the last SUCCESSFUL fetch time (read it before fetching, or `git fetch --no-write-fetch-head` plus a marker file written only on success in the git common dir) and have `readLastFetchAt` use that.
2. **The cause is the last stderr line**, which is "and the repository exists." for a missing path and for every SSH failure (this repo's origin is SSH). Take the `fatal:` or `ssh:` line, or join the first meaningful lines.
3. Edge: after a failed fetch, a tree that is level on commits but record-behind, or ahead, passes its lines through unqualified ("THE RECORD HERE IS BEHIND although the commits are level...", "Not stale; local work is not yet on master"). The dispatch's literal test is that the word `level` does not appear after the FAILED line.

Then **rebase `loop/t212-trailer-attribution` onto the fixed T-208** (QA accepted T-212, but it carries `e442b955`). Use a new T-208 r2 branch; do not force-push over `loop/t208-fetch-first` without a word from atlas-sia.

### Next, in order

1. T-208 r2 (above), then the T-212 rebase.
2. **#310 head sync:** GitHub had `b27d7c70` on the branch but the PR still reported head `4f4984e3` with no run for the new commit (checked for about 20 minutes). Re-check first (`gh pr view 310 --json headRefOid`; `gh run list --branch loop/t227-ci-hosted`). If still stuck, push one real commit to re-trigger it (I told atlas-sia I would; never an empty commit). The T-227 evidence is complete in `docs/loops/t227-developer-handoff.md`: hosted green run 36985740012 (151 files, 2122 passed, 2m17s) and the tcm dispatch 36985450437, green on tcm-2.
3. **T-188** (`loop/t188-ci-status-hint` @ `9cd531e9`, pushed): the SOURCE is written (`checks-state.ts` `checkCiStatus`: for an auth-looking gh error it runs `git remote get-url origin`; a non-GitHub origin gives a skip "origin <url> is not a GitHub remote"). **No rows yet.** Add: non-GitHub origin plus the `gh auth login` hint gives the remote-named skip; GitHub origin plus a 401 keeps "gh is not authenticated"; a mutant matching only the regex goes red. The existing `unauth` test still holds (the same fake runner answers every command, so the origin lookup fails and the old message stays). Handoff `docs/loops/t188-developer-handoff.md`.
4. **T-184** (`loop/t184-import-hashes` from master, not started): `state import --draft` records a sha256 per input in `state.draft.json`; `--commit` REFUSES when an input changed since the draft, naming the file and both hashes. T-184's note in `.agents/state.json` is about a marker bumped after `--draft` letting a stale draft through unacknowledged and committing the draft's text; it does NOT ask for an accept-the-change flag, so add none. Rows: a changed input is refused; unchanged inputs commit; an older draft with no hashes commits with a stated note, not silently; a mutant comparing sizes goes red. Handoff `docs/loops/t184-developer-handoff.md`.
5. **T-152:** after #294 merges, fix the 4 B errors (`ranking.test.ts` lines 4 and 32, `index-upsert.test.ts:126`, `shadow-strategies.test.ts:33`); then a separate PR adds `npm run typecheck:tests` to CI's test job.
6. Rebase the `checks.ts` PRs (#295, #298, #300, #303, #306, #309) as they merge; #295 and #309 add the same two `node:path` aliases to one import line.

### Rulings and answers received this session (so you do not re-ask)

- An unknown indexed SHA in gitnexus-index stays a **WARN** (an issue would fail /sync in clones missing the object innocently). "Not checked" results stay **warn**, never pass.
- hook-configs: descending into matcher groups is **RULED IN**; `sh -c` and `bash -c` are "not checked: inline shell (-c)" (done in #309).
- `gate.test.ts` `legend`: removal accepted; whether it meant `criteria` goes on the record as a finding, do not change the payload. The extra `hasPriorFailures: true` row in `policies.test.ts` stays (the F5 block already covered true; my earlier "hole" claim was wrong and is corrected in `t152-developer-handoff.md`).
- T-152 split accepted: A and C done (#305), B after #294, CI enforcement last.
- The per-file allowance in the retirements check is a gap in the record (Atlas's).
- T-008 covers the original GitNexus incident on Aaron's desktop (it is in `~/.claude.json` there); this QA PC has no GitNexus.

### Open questions I asked and have no answer to

- Whether to handle more shell wrappers in hook-configs (`cmd /c`, `sh -s`): `cmd` is counted as skipped.
- Whether the GitHub PR-sync lag on #310 resolved itself.

### Watch out

- **Never `git stash`** (shared stack). I use WIP commits.
- **Heredocs through this shell eat backslashes, backticks and quotes**: write scripts and file content with the Write tool, or use the Edit tool. Several scripted edits corrupted text this session.
- Python is not installed. `node -e` is fine for small edits.
- `tsconfig.tests.json` exists only on the T-152 branch; `typecheck:tests` is not in CI.
- Do not merge anything; merging needs Aaron to name the PR.
- `docs/t227-docs-only-probe` and PR #311 were throwaways, already closed and deleted.
