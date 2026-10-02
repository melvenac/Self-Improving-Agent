# QA 263 report: the T-233 batch, a deterministic /start greeting (#343, #344, #345, #346)

**By:** QA 263 (headless Claude Code, Opus 5.5), record session 263, 2026-10-02. **Prefix:** `t233`.
**Dispatch:** `docs/loops/qa-263-dispatch.md`. **Criteria:** `docs/loops/start-greeting-deterministic-brief.md`
(Acceptance, Amendments 1 and 2) and `docs/loops/t233-developer-handoff.md`.
**Dispatch tree:** `~/qa-scratch/qa263-wt` at `3fe3a245fe9b2c34abbd955989208250a45a3cd9`
(`git -C ~/qa-scratch/qa263-wt log -1 --format=%H`). That commit is `8dd0f839` (origin/master `3a3f3e52` + #343 + #346)
plus the dispatch and push helper.

**Worktrees.** Heads: `qa263-pr343` `d010692c`, `qa263-pr344` `8a827092`, `qa263-pr345` `d20d4925`, `qa263-pr346`
`724e31fe`. Bases for the red runs: `qa263-base343` and `qa263-base344` at origin/master `5cd9ed52`; `qa263-base345` at
`8a827092` (#345's PR base); `qa263-base346` at `d20d4925` (#346's PR base). Merge order: `qa263-order` (row 12).
Mutants: `qa263-mut` at the dispatch SHA. One `npm ci` in `qa263-wt/open-brain`; every other tree links that
`node_modules` after a lockfile hash check (all identical).

**Job class LIGHT.** One test file per vitest invocation, every run with `HOME` and `TMPDIR` pointed into `~/qa-tmp`
and `SIA_USAGE_FILE` removed. No full suite. **No live Jev call. No real config file read:** there is no `slots.json`
on this machine (glob over `/home`), so row 3 is checked against the shape the dispatch states, with synthetic values.
No issue or PR was created, commented on or edited; `gh` was used only to read checks and runs. Pushed only
`qa/t233-report`, through `push-qa.mjs`.

## Verdicts

- **#343 (C, brief glob, `d010692c`): ACCEPT.** One test gap, not blocking (F5).
- **#344 (D, standing cron removed, `8a827092`): ACCEPT.**
- **#345 (A, serving-build line, `d20d4925`): ACCEPT.** One wording finding and one test gap, both not blocking (F1, F6).
- **#346 (B, briefing in code, `724e31fe`): ACCEPT.** Three test gaps and one doc nit, all not blocking (F2, F3, F4, F7).
- **Batch: ACCEPT.** Every behaviour the rows name is present and was shown at the heads. The findings are tests that
  do not pin a row the code already meets (my probes pin them) and two stale sentences in start.md.

## Rows

### 1. Briefing is code, verbatim: MET

- **Byte-identical.** `briefing.test.ts` "the block in ob_start's output is exactly renderBriefing's output for the same
  record" passes at #346 and on the merge tree. My probe P2 repeats it **through the MCP tool over stdio** (row 7) and
  gets `toEqual` on the whole block.
- **First line = serving line = ob_start's first line, in all three states.** Not checked and stale: the developer's
  A+B rows. **Level:** not covered by the developer, so my probe P1 calls `handleStart` with a level fixture.
  `block[1]` starts `Serving build: `, contains `is level with origin/master`, and equals the greeting's line 1. Passes.
- **start.md x3.** `.claude/commands/start.md` and `project-template/.claude/commands/start.md` are byte-identical
  (`cmp`). The cursor copy differs only in its known Cursor lines (CallDynamicTool, Hub room). Step 6 in each says to print
  `## Briefing` through `## End Briefing` **verbatim**, then one `FLAGS:` line. With no block, it says so in FLAGS and
  builds nothing. The old assembly template is gone (`{objective text}` absent; tested). Step 2 says "Do not rebuild,
  reorder, summarise or trim it". Doc nit F7 below.

### 2. Serving build (A): MET

- **The build commit, not HEAD.** `serving-build.ts` runs `rev-list --count <build-info commit>..origin/master` in the
  build's grandparent tree. The fixture where HEAD moves past the build names both commits. Mutant
  `a-distance-from-tree-head` is killed (3 rows).
- **Every unreadable shape says `Serving build: not checked (<why>)`.** I read every branch: missing build-info,
  unparseable JSON, no or malformed commit (with the stamp's reason), git cannot read the tree, distance unknown (commit
  not in the tree), and an uncountable distance. Each returns `notChecked(...)`; none returns empty. Six of these have
  rows; the uncountable-distance branch is unreachable in practice.
- **`serving_build_dir` is NOT reachable through the MCP schema. Proven by a call (probe P2).** The probe spawns
  `src/server.ts` under tsx, with a stdio MCP client and the test env (isolated DB, home and state paths).
  - `tools/list`: `ob_start`'s `inputSchema.properties` has `project_root` and does not have `serving_build_dir`.
  - Control: `describeServingBuild(<fixture>)` called directly returns `SERVING BUILD IS STALE: …`.
  - `tools/call ob_start {project_root, serving_build_dir: <that fixture>}` is not an error. Its first line is
    `Serving build: not checked (…build-info.json does not exist…)`, from the running src build, and the text never
    contains `SERVING BUILD IS STALE`. So the key was stripped.
  - My mutant `qa-ab-seam-in-schema` adds the key to the zod shape. It **survives** the developer's files
    (serving-build 10/10, briefing 39/39) and `tests/server.test.ts` (30/30), and is **killed** by P2 (F4).

### 3. Usage (item 4), against the real slots.json shape: MET

- **Shape.** `describeUsage` takes `usageLevel` as a bare string, or an object whose `level` is a string. The 5-hour
  level is the leading `[A-Za-z]+` word of `level`, upper-cased. Numbers come only from numeric `fiveHourPct` and
  `sevenDayPct`. An ISO `fiveHourResetsAt` prints as `resets HH:MMZ`; a bad one is dropped. `weeklyOverride` must be a
  non-blank string. The developer's `realShape` fixture has the dispatch's keys (plus `set`, `note` and `rules`, which
  are ignored), all with synthetic values.
- **Bands.** Below 95 adds nothing (94.9 tested). 95 to 97 holds (`no new QA, tasks or dispatches`) and names the
  override when one is set (96 tested; my P5 tests 97.9). At 98 or above it winds down. **"Even with an override"** has
  no developer row. My probe P4 sets 98, 99 and 100 with `weeklyOverride: "T-233"`: each winds down, and none names
  T-233 or holds. Passes. Mutant `qa-b-override-beats-winddown` (`>= 98 && override === null`) **survives**
  briefing.test.ts 39/39 and is **killed** by P4 (F2).
- **Not checked (D-104/D-106).** Each of these prints `Usage: not checked (<why>)`, by developer row or my P6: absent
  file, malformed JSON, an empty file, `{}`, a number, an array, an unknown word (`PURPLE`, `UNKNOWN`), a blank level, a
  level with a leading number, a relative path, and an unfilled placeholder. No path anywhere is also not checked.
- **The bare-string form works:** `"RED"` gives `Usage: RED + weekly not checked → …` (developer row; also P6 with a
  quoted `usage_file` value).
- **The path is data.** Read from `usage_file:` in `.agents/AGENT.local.md`, then `.agents/AGENT.md` (P4 exercises the
  tracked file when the local one lacks the key), then `SIA_USAGE_FILE`; seat data wins over the env (developer row).
  Grep of `open-brain/src` for `slots.json` and the Windows home path finds no hard-coded usage path.

### 4. resolved_by (item 6): MET

- **Schema.** `OpenQuestionSchema = string | strictObject({text: min 1, resolved_by?: min 1})`. It is used in
  `HandoffSchema` and in the `set_handoff` op. Developer row: `applyStateOps` (dry run) accepts
  `[{text, resolved_by}, "plain"]` and refuses an unknown key or an empty text.
- **Omitted and counted** in the briefing block and in the State block, with `(N resolved, not shown)`. All resolved
  keeps the header and the count. Mutant `b-resolved-still-printed` is killed (4 rows).
- **Rendered views keep them, marked.** `renderNextSession` prints `- <text> _(resolved by <id>)_`. **No developer
  test covers this.** My probe P7 does: `- still open` and `- answered _(resolved by D-1)_` are both present. Mutant
  `qa-b-view-drops-resolved-mark` **survives** briefing.test.ts (39/39) and state-views.test.ts (17/17) and is
  **killed** by P7 (F3).
- Other readers of `open_questions`: `handoff-provenance.ts` casts to `string[]` for typing only, and its `stable()`
  JSON comparison handles objects. `cli.ts` prints only the count. `state-migrate` builds older shapes. None prints
  `[object Object]`.

### 5. Brief glob (C): MET

`BRIEF_NAME = /(^|-)(re)?brief(-amendment-\d+)?\.md$/`, tested against `basename`, under `docs/loops/`. I classified every
path on origin/master under `docs/loops` with "brief" in its name:

- **Kept: 64.** Every `loop-N-brief`, `loop-N-rebrief`, `*-brief-amendment-N` and `*-rebrief-amendment-N` (up to
  `-amendment-12`), every `*-grok-brief`, every `tN-*-brief`, `t201-brief.md` and this loop's own brief.
- **Excluded: 8.** `followups-r165-r167-briefs.md`, `loop-15-slice-3-a2-grok-brief-2.md` (accepted by the planner; not a
  finding), `loop-15-slice-4-brief-draft.md`, `loop-15-slice-4-brief.D_t.json`, two
  `loop-15-slice-4-brief.G_plan.*.json`, `qa-253/brief-dates.mjs` and `research-brief-jev-mcp.md`. These are drafts,
  records, a script, a follow-up list and a research note. No handoff or response is kept.
- 14 fixture rows (6 kept, 8 excluded) pass. Mutant `c-brief-prefix-match` is killed (7 rows); my `qa-c-no-start-anchor`
  is killed by `notabrief.md`; my `qa-c-no-end-anchor` (drops `$`) **survives** (F5).

### 6. No standing cron (D): MET

- `readStandingCron` and `cronProblem` are deleted. ob_start prints no `Standing cron:` line. Step 5b and its FLAGS line
  are gone from both start.md copies, the template `AGENT.md` cron section is gone, and the cursor `claude_only` waiver
  is now `[]`.
- Grep of the merged tree outside `docs/loops`: `Standing cron`, `status_cron`, `readStandingCron`, `CronCreate` appear
  only in the record (`.agents/state.json`, SUMMARY, next-session) and in the new test.
- A seat that still carries `status_cron` (valid or malformed) prints nothing and does not crash: developer rows, and
  my P2 seat file carries `status_cron` through the real MCP call. Mutant `d-cron-line-returns` is killed (3 rows).

### 7. Relay shares the renderer: MET (by test and by call trace)

Relay's /start is the Cursor copy (`project-template/.cursor/commands/start.md`). Its step 2 calls the **same `ob_start`
MCP tool** (via CallDynamicTool), and its step 6 prints the block verbatim. **Call trace:** MCP `tools/call ob_start` →
`server.tool("ob_start", …, async (args) => handleStart(args))` → `handleStart` → `renderBriefing({...})`. There is no
other caller of `renderBriefing` in `src`, and no per-runtime copy. **By test:** probe P2 drives that MCP path end to
end and asserts the returned block `toEqual` `renderBriefing`'s output for the same record. The developer's row checks
the cursor copy's verbatim instruction.

### 8. Mutants: MET

All nine planned mutants apply cleanly to the dispatch tree. Each passes `tsc --noEmit`, was run against its touched
file in one invocation, and was reverted (tree clean after each).

| mutant | file run | result |
| --- | --- | --- |
| `c-brief-prefix-match` | latest-brief | killed, 7 failed / 24 |
| `d-cron-line-returns` | no-standing-cron | killed, 3 failed / 4 |
| `a-distance-from-tree-head` | serving-build | killed, 3 failed / 10 |
| `a-stale-reads-level` | serving-build | killed, 2 failed / 10 |
| `ab-serving-dropped-from-block` | briefing | killed, 6 failed / 39 |
| `b-absent-usage-reads-green` | briefing | killed, 1 failed / 39 |
| `b-ignores-sevendaypct` | briefing | killed, 5 failed / 39 |
| `b-resolved-still-printed` | briefing | killed, 4 failed / 39 |
| `b-watch-out-truncated` | briefing | killed, 1 failed / 39 |

QA's own mutants (diffs in `docs/loops/qa-263/mutants/`, all `tsc` clean):

| part | mutant | developer's files | QA probe |
| --- | --- | --- | --- |
| A | `qa-a-names-wrong-tree` (tree = build/.. instead of build/../..) | **survives** serving-build 10/10, briefing 39/39 | not probed (F1) |
| A+B | `qa-ab-seam-in-schema` | **survives** serving-build, briefing, server.test | killed by P2 |
| B | `qa-b-override-beats-winddown` | **survives** briefing 39/39 | killed by P4 |
| B | `qa-b-view-drops-resolved-mark` | **survives** briefing 39/39, state-views 17/17 | killed by P7 |
| C | `qa-c-no-start-anchor` | killed (notabrief.md) | n/a |
| C | `qa-c-no-end-anchor` | **survives** latest-brief 24/24 | not probed (F5) |

The probes are in `docs/loops/qa-263/qa263-probes.test.ts`, run from `open-brain/tests/qa263/` in the mutant tree:
7/7 pass on the batch code.

### 9. Red then green: MET

The new test files were copied onto base code and run one per invocation:

| file | base | red | head (green) |
| --- | --- | --- | --- |
| latest-brief (C) | `5cd9ed52` | 7 failed / 24: the seven `.md` excluded rows (`.json` was already excluded) | #343 24/24 |
| no-standing-cron (D) | `5cd9ed52` | 4 failed / 4 (the line is printed; start.md carries step 5b) | #344 4/4 |
| serving-build (A) | `5cd9ed52` and `8a827092` | fails to load: `serving-build.js` absent | #345 10/10 |
| briefing (B) | `5cd9ed52` and `d20d4925` | fails to load: `briefing.js` absent | #346 39/39 |
| start-parity (B) | `d20d4925` | 3 failed / 11 (the three start.md copies) | #346 11/11 |

For A and B the red is a load failure, so the mutants above stand in for row-level red.

### 10. Stack integrity: MET

- `git range-diff a48770cb..cd9e0f05 8a827092..d20d4925`: the product commit (`df604ffe` → `4d199386`) differs only in
  `server.ts` import context (`readAgentIdentity, readStandingCron` → `readAgentIdentity`, which is D's change). The
  mutant commit is `=`.
- `git range-diff 8a827092..d8afa9f2 d20d4925..724e31fe`: the product commit differs only in `server.ts` import context
  (the `describeServingBuild` import union). The other three commits are `=`. There are two new commits:
  - `95498211` "A+B integration": `serving` added to `BriefingInput` and pushed first in `renderBriefing`;
    `serving_build_dir` added to `StartArgs` as a test seam; `handleStart` passes one `serving` line to both places;
    the test rows.
  - `724e31fe`: the `ab-serving-dropped-from-block` mutant diff.
- **Nothing else changed.** The seam's absence from the MCP schema is proven in row 2.

### 11. CI (read only): MET

`gh pr checks` plus `gh run view --json headSha`: every run's headSha is the pinned head.

| PR | head | run | changed | test | test-windows |
| --- | --- | --- | --- | --- | --- |
| #343 | `d010692c` | 37069637515 | pass | pass (2m36s) | skipping |
| #344 | `8a827092` | 37069801610 | pass | pass (2m45s) | skipping |
| #345 | `d20d4925` | 37072068944 | pass | pass (2m47s) | skipping |
| #346 | `724e31fe` | 37072269471 | pass | pass (2m54s) | skipping |

All four PRs are open. #345's base is `loop/t233-d-cron` and #346's is `loop/t233-a-serving`; both need retargeting as
their bases merge.

### 12. Merge order: MET, no conflicts

On `qa263-order` (detached at origin/master `3a3f3e52`), `git merge --no-ff` of C `d010692c`, D `8a827092`, A `d20d4925`,
then B `724e31fe`: all four merged clean, with **no conflicts**. `git diff --stat HEAD 3fe3a245` shows only
`docs/loops/qa-263-dispatch.md` and `docs/loops/qa-263/push-qa.mjs`, so the ordered merge's code is the dispatch tree's.
On the ordered merge, one file per invocation:

- latest-brief 24/24, no-standing-cron 4/4, serving-build 10/10, briefing 39/39, start-parity 11/11.
- `tsc --noEmit` exit 0.
- `tsc -p tsconfig.tests.json`: 4 errors, in `recalled-ids.test.ts`, `ranking.test.ts` (2) and
  `shadow-strategies.test.ts`. These files are untouched, and **the same 4 appear on `5cd9ed52`**. They pre-exist.

Each head also passes its own files and `tsc --noEmit`: #343 latest-brief 24/24; #344 no-standing-cron 4/4; #345
serving-build 10/10; #346 briefing 39/39 and start-parity 11/11.

## Findings (none blocking)

- **F1 (A, test gap).** No row asserts **which tree** the serving line names, though the amendment says "tree + commit".
  `qa-a-names-wrong-tree` (it names `<tree>/open-brain`; git still works from the subdirectory) survives every touched
  file. Fix: assert `line` contains the fixture's `tree` path followed by ` at build `.
- **F2 (B, test gap).** "≥98 winds down even with an override" (dispatch row 3, handoff note) has no row.
  `qa-b-override-beats-winddown` survives. The code is right (P4). Fix: add `sevenDayPct: 98, weeklyOverride: "T-233"`
  → contains `wind down`, not `T-233`.
- **F3 (B, test gap).** "The rendered views keep them, marked" has no row. `qa-b-view-drops-resolved-mark` survives
  briefing and state-views. The code is right (P7). Fix: one `renderNextSession` row.
- **F4 (A+B, test gap).** The seam is "deliberately NOT in the tool schema" only by comment. Nothing fails if it is
  added (`qa-ab-seam-in-schema` survives). Fix: a `tools/list` assertion, or P2.
- **F5 (C, test gap, minor).** The `$` anchor is unpinned (`qa-c-no-end-anchor` survives). No path on master is
  affected today. Fix: an excluded row such as `loop-9-brief.md.orig`.
- **F6 (A, wording).** A build that is **ahead of** origin/master (it contains master plus a local commit) prints
  `Serving build: <tree> at build <sha> … is level with origin/master …`. The probe recorded this: "level" is reported
  for `behind == 0` whether or not the build is on master. It is not a staleness miss, which is the guard's purpose. But
  "level" is untrue for a serving tree built from a branch. Suggest a `rev-list --count origin/master..<commit>` check
  and an "ahead by N" wording.
- **F7 (B, doc nit).** `.claude/commands/start.md` (and the template copy) step 2 lists the block as "usage, session
  line, drift, …", without the serving-build line that integration commit `95498211` made the block's first line. Step 5
  still describes the brief as "the newest `*brief*.md`", which C has narrowed. Both are wording only; the block is
  printed verbatim either way.

## Not done, and why

- No live served greeting: the dispatch makes that acceptance after merge and deploy (Amendment 2).
- No full suite (LIGHT); CI's `test` job is green on each head.
- `tests/server.test.ts` was run once, under a mutant only, to check whether it pins the schema. It is not a touched file.

QA-263: REPORT COMPLETE
