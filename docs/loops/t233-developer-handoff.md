# T-233 developer handoff (Forge, sia-forge, 2026-10-03): the deterministic /start greeting

Dispatch: atlas-sia, planner session 158 (brief `docs/loops/start-greeting-deterministic-brief.md` + Amendment 1, rescope by A2A). Base `origin/master` a48770cb.
Four PRs, one QA batch. All CI `test` green at the heads below; nothing merged, no tags. One vitest file per run throughout.

| PR | item | branch | head | notes |
| --- | --- | --- | --- | --- |
| #343 | C brief glob | `loop/t233-c-brief-glob` | `d010692c` | independent |
| #344 | D drop the standing cron (D-113) | `loop/t233-d-cron` | `8a827092` | independent; B is stacked on it |
| #345 | A serving-build line (T-172 guard) | `loop/t233-a-serving` | `cd9e0f05` | independent; touches `server.ts` near the top |
| #346 | B briefing in code, `resolved_by`, Usage line | `loop/t233-b-briefing` | `e2711976` | STACKED on #344 (both rewrite `start.md`); PR base is `loop/t233-d-cron`, retarget to master after #344 merges |

Merge order that avoids conflict: #343, #344, #345, then retarget and merge #346. #345 and #346 both edit `server.ts` in different regions; expect an easy rebase if any.

## What each does

- **C:** `BRIEF_NAME = /(^|-)(re)?brief(-amendment-\d+)?\.md$/` in `latest-brief.ts`, exported with `isBrief`. 14 rows (6 kept shapes, 8 excluded). Existing `loop-15-slice-3-a2-grok-brief-2.md` no longer counts as a brief.
- **D:** removed `readStandingCron`, the `Standing cron:` line, `start.md` step 5b and its FLAGS line (project and template copies), the cursor `claude_only` waivers, the template `AGENT.md` cron section, and `standing-cron.test.ts`. `no-standing-cron.test.ts` proves a seat with or without the old keys prints nothing. **Not done and not mine:** the planner's own untracked `AGENT.local.md` may still carry `status_cron` keys; they are read by nothing now.
- **A:** `describeServingBuild()` (new `serving-build.ts`) reads the RUNNING build's `build-info.json`, takes the tree from its location, and compares the BUILD's commit with `origin/master` in that tree as of its last fetch. First line of `ob_start`. Behind: `SERVING BUILD IS STALE: ... N commits behind`; not checked: `Serving build: not checked (<why>)`. Read only: no fetch, no rebuild-or-refuse command.
- **B:** `briefing.ts` `renderBriefing` (pure) plus collectors `describeUsage`, `describeWorkingTree`, `describeSkills`; `ob_start` emits `## Briefing ... ## End Briefing` after the State block. `OpenQuestionSchema` (string, or `{text, resolved_by?}`) in the schema and `set_handoff`; greeting and briefing omit resolved questions and count them; the rendered views keep them, marked. `start.md` x3: print the block verbatim, then FLAGS.

## Things the next reader must know

- **Usage file shape is unverified.** I have not seen a real `slots.json`. Only `usageLevel` (GREEN, AMBER, RED, STOP) is read; no weekly flag. The path comes from `usage_file:` in the seat's `AGENT.local.md`/`AGENT.md`, else `SIA_USAGE_FILE`. Until a seat sets one, its briefing says `Usage: not checked (no usage_file in seat data and no SIA_USAGE_FILE)`. The planner must add the key to each machine's seat data (the main deploy step).
- **A record with an object-form open question does not parse in an older build.** The serving trees must be updated before any seat writes a `resolved_by`.
- **A's first line cannot be seen under test:** the server runs from `src/` there, so the test row for ob_start's first line expects `Serving build: not checked`. The served behaviour (stale/level) is covered through `describeServingBuild(buildDir)` fixtures. The served-greeting check is acceptance, after merge and deploy, by a fresh session.
- **The deploy step is NOT done:** updating every machine's serving tree (desktop, QA PC, laptop) and reading back HEAD plus build SHA is the loop's deploy step, after Aaron's merge.
- **GitNexus `impact` was not run** (no GitNexus tool in this session). Blast radius was read by `git grep` and by running the adjacent test files one at a time: server, bootstrap-fix, qa142-t003, t003-r2, t003-session-proof, tree-currency, record-session-number, latest-brief, state-render, state-schema, state-writer(+notes), state-views, handoff-provenance, checks, start-parity, start-legend, hub-talk-exit-codes.
- **Tooling:** no `python`; `node -e` and heredocs through the shell collapsed backslashes and `\n` several times, so every regex in the source was written with the Edit/Write tools and read back. A mutant must be created with Edit, diffed, then reverted with `git checkout`; commit the product change first.
- **Out of scope per the dispatch:** rebuild-or-refuse command, fast-forwarding seat trees, the dashboard, retiring the `/START AUDIT GAPS` watch-out (planner act after a served greeting passes).

## Mutants and red runs

`docs/loops/t233/mutants/` is split across the PR branches: C `c-brief-prefix-match.diff`; D `d-cron-line-returns.diff`; A `a-distance-from-tree-head.diff`, `a-stale-reads-level.diff`; B `b-resolved-still-printed.diff`, `b-watch-out-truncated.diff`, `b-absent-usage-reads-green.diff`. Each passes `tsc --noEmit` and fails the rows it names (C 7, D 3, A 3 and 2, B 4, 1 and 1). Red against master: C 7 failed; D 4 failed; A and B fail to load (module absent).
