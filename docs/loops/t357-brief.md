# T357: a weekly context-efficiency row per seat, read from Claude Code transcripts, with a dated change log (T-357)

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-19, session 178. **Tasks:** T-357. **Tag:** `t357`. **Size:** SMALL (two new files,
no existing file edited). **Base:** the START sha the launcher names (a master that contains this brief; drafted
against `79271840cad009026c5e93e583a85a7132c37b02`).
**Authority:** Aaron, 2026-11-19, in clark's window ("Yes, fleet-only first"); merge on Atlas's QA ACCEPT and Aaron's
word. No auth, deps, workflows, hooks or settings.

```text
IMPACT-TARGETS: none: no existing symbol is edited
```

## What changes

Two files are copied in, byte for byte. Nothing else in the repository changes: no `open-brain/src`, no CLI command, no
MCP tool, no hook, no `package.json`, no CHANGELOG (a release PR writes that), no README.

1. **`scripts/ctx-metrics.mjs`, new** (from `docs/loops/t357/ctx-metrics.mjs`). A plain Node script with no
   dependency. It streams the transcripts of each seat it is given and appends one row per seat per CLOSED ISO week
   (Monday 00:00 UTC to the next Monday) to a jsonl. The script's header comment defines every field; in short:
   - **Workload:** `calls` (one per message id, main thread), `active_days`, `user_turns` (typed turns only).
   - **Window life** (the question that started this): per window ended by a compaction in the week,
     `win_calls_median`, `win_turns_median`, `win_hours_median`; `windows_open_end` counts windows that ended with their
     file instead (not in the medians: their length is cut short by the session ending, not by the context filling).
   - **H1, a model or window-size change:** `models` (calls per model id), `compactions`, `pre_tokens_median`,
     `pre_tokens_max` (the context size at which the window was compacted) and `post_tokens_median`.
   - **Start cost:** `sessions_started`, `first_call_ctx_median`.
   - **Cost per call:** `growth_median`, `growth_p90` (context added from one call to the next inside a window);
     `tool_result_chars_median`, `tool_result_chars_p90`.
   - **Delegation:** `sidechain_calls`, `sidechain_share` (subagent calls over all calls).
   - **Harness:** `cc_versions` (calls per Claude Code version). Plus `schema` (1), `seat`, `week`, `generated_at`.

   Fixes over clark's first script (`ctx-trend.mjs`, not in this repository): an open week never gets a row; message
   ids are deduplicated across all files of a seat, not per file; medians and p90, not means; windows are measured;
   subagent transcripts are read (they are separate files, see the premises).

   **Written once.** A rerun skips a seat+week already in the out file. Rows therefore outlive the transcripts, which
   Claude Code deletes after its cleanup period. A late record for a closed week does not change its row.

   **Nothing machine-specific is in the script.** A transcript folder's name carries the user's home path
   (`C--Users-<name>-...`), so there is no default seat map: seats come from `--config <file.json>`
   (`{ "root", "out", "changes", "seats": { "<transcript folder>": "<seat name>" } }`) or `--seat <folder>=<name>`.
   Defaults: root `~/.claude/projects`, out `~/.claude/open-brain/context-metrics.jsonl`, change log
   `context-changes.md` beside the out file. A flag wins over the config.
   Exit codes: 0; 1 when a configured seat's folder is absent (the other seats are still written, the absent one is
   named on stderr); 2 for bad input. `--dry-run` prints the rows and writes nothing.

2. **The change log** is `--note "<what changed>" [--date YYYY-MM-DD]`: it appends `- <date> <text>` to
   `context-changes.md` (created with a three-line header), once per identical line. The script carries no seed
   lines: the two seeds (code mode A/B, Claude Code 2.1.329) name this fleet, so the planner adds them with `--note`
   after the merge.

3. **`open-brain/tests/t357-ctx-metrics.test.ts`, new** (from `docs/loops/t357/t357-ctx-metrics.test.ts`): fourteen
   rows, CM-1 to CM-14. It imports the script the way `tests/setup-hooks.test.ts` imports `scripts/setup-hooks.mjs`
   (`@ts-expect-error` on the import), writes every transcript it reads into a temp folder, and removes the folders.

### Where the output lives (ruled)

Outside the repository, under `~/.claude/open-brain/`, beside `greeting-metrics.jsonl`: `context-metrics.jsonl`,
`context-changes.md`, and the fleet's `context-metrics.config.json`. Reasons: the seat map carries the home path; the
rows are measurements of one machine's sessions, not project record; and every worktree of every seat reads the same
file. The cost: one machine, no backup, no review. A later task can copy a snapshot into `docs/` if the numbers are
cited in a decision.

### Not in this brief

- **Scheduling.** The weekly desktop run (after Monday 00:00 UTC, off-peak) is clark's to set up.
- **A reader.** No report, chart or dashboard panel; the jsonl is read with `node -e` or `jq` for now.
- **An `open-brain` CLI command.** Fleet-only first (Aaron's answer). No `/sync` check, no greeting line.
- **Raising `cleanupPeriodDays`.** Open with Aaron through clark.

## Measured premises (planner, on the desktop, read-only, 2026-11-19; counts and field names only)

Eight planner seats' transcript folders, 58 `.jsonl` files, spans 2026-10-16..2026-11-19.

| premise | what was measured |
|---|---|
| A compaction is a `system` record with `subtype: "compact_boundary"` and a `compactMetadata` object | atlas: 16 of 16 carry `trigger`, `preTokens`, `postTokens`, `durationMs`, `cumulativeDroppedTokens` (numbers; trigger `"auto"` on all 16, and on clark's 17). Fleet: 177 compactions |
| `preTokens` equals the last call's context before the boundary | 177 of 177: difference 0 to 2K tokens, median 0. So the fallback in the script (no `preTokens`: the last call's context) is the same quantity |
| **H1 is live:** the size at compaction is not constant | atlas `preTokens` 201K..562K, clark 201K..761K. Dry run of the drafted script, atlas, weeks 10-19 / 10-26 / 11-02 / 11-09: `pre_tokens_median` 320K / 261K / 212K / 245K; `models` is one id in all four |
| The model id is `message.model` on an `assistant` record; `"<synthetic>"` marks a record that is not a model call | atlas: two real ids and 3 synthetic records |
| The Claude Code version is the top-level `version` of a record | atlas: four versions across the span |
| One reply is several `assistant` records with one `message.id` | atlas 6,040 usage records, 3,256 ids; fleet 82,399 records, 44,197 ids. A count of records is about 1.9 times the calls |
| **No message id repeats across two files of a seat** | 0 of 44,197 ids, all eight seats; every file holds one `sessionId` and no `sessionId` is in two files. The "resumed sessions double count" hypothesis is false for this data. The script still deduplicates across files (a set lookup) so a future resume or fork cannot inflate a week |
| The main-thread files hold no sidechain records; subagents are separate files | atlas main files: 0 records with `isSidechain`. Subagent transcripts are `<folder>/<sessionId>/subagents/*.jsonl` (fleet 273 files; in a 40-file sample 12,664 of 16,846 records carry `isSidechain: true`, so the flag is NOT on every record there: the script treats the whole file as sidechain) |
| A typed turn is a `user` record with `origin.kind == "human"` | atlas `user` records with text: human 60, peer 169, task-notification 259, no origin 87 (compact summaries 16, meta 22, older peer messages 27, local-command and bash echoes 22: none typed). clark: human 423, no origin and plain and not meta: 1 |
| A turn typed while the model works is NOT a `user` record | It is an `attachment` record with `attachment.type == "queued_command"` and `attachment.origin.kind == "human"`: clark 95, atlas 6; of those 101, 7 have the same text as a human `user` record (short repeated words). The script counts both shapes |
| 13,256 of atlas's records have no `timestamp` | Title, mode and bridge records, which the script does not read. A wanted record without one takes `attachment.timestamp`, else the file's last seen time |
| Speed | The drafted script, two seats (21 files, 38 subagent files), dry run on the desktop: 4.9 s |

## Existing tests that pin this behaviour (planner read at 79271840; rows NOT run)

No existing file is edited and no existing test imports the new script, so no existing row changes its verdict.

| file / row | verdict |
|---|---|
| `tests/harness/s4-guards.test.ts` D1b (no untracked file under `open-brain/tests`) | **red until the commit**, by design of the guard: step 6 commits BEFORE the full suite in step 7 for this reason (t352 and t353 both tripped it) |
| same file, S4-9.2 (no added skip, todo, skipIf, runIf; no test file loses a test), S4-5b (the forbidden word) | stay green: the new test file has fourteen plain `it(` rows and neither pattern |
| `tests/pipelines/sync/checks.test.ts`, `tests/pipelines/sync/t048-counts.test.ts` (`vault-path-refs` walks `scripts/`) | stay green: both build their own temp `scripts/`; the check reads `.md` files only |
| `tests/setup-hooks.test.ts`, `tests/setup-repo-root.test.ts` (the other tests of a `scripts/*.mjs` module) | stay green: untouched |
| `tests/harness/checks.test.ts` D4 | red at the base on both hosts (an npm error); not this change |

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t357`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), then `node -e "require('better-sqlite3')"`; on "Could not locate the
   bindings file" run `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/` (never run the script without `--root` and `--out` pointing into a temp
     folder), `scripts/setup.mjs`, `git config` writes in the clone, any MCP config, `npm install`, any hook
     registration or `settings*.json`, `package.json`, `.github/`, the repo's `.gitignore` and `.agents/`, and anything
     under `docs/`.
3. **Copy.** From the clone root:
   `Copy-Item docs/loops/t357/ctx-metrics.mjs scripts/ctx-metrics.mjs` and
   `Copy-Item docs/loops/t357/t357-ctx-metrics.test.ts open-brain/tests/t357-ctx-metrics.test.ts`.
   In `open-brain`: `npx tsc --noEmit` (exit 0) and `npx tsc -p tsconfig.tests.json --noEmit` (exit 0). A type error in
   the new test file: STOP, `BLOCKED t357 typecheck`, with the error lines (the planner could not run tsc; see
   "Simulated" below).
4. **The fourteen rows.** In `open-brain`:
   `npx vitest run tests/t357-ctx-metrics.test.ts tests/setup-hooks.test.ts tests/setup-repo-root.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files` and `Tests`. A red CM row: STOP, `BLOCKED t357 rows <rows>`, with each assertion
   message (expected vs received).
5. **Mutants**, each on the copied tree. Back up `scripts/ctx-metrics.mjs` once (Windows `$env:TEMP\t357-cm.bak`,
   Linux `/tmp/t357-cm.bak`) with `Copy-Item` or `cp`. For each `docs/loops/t357/mN.txt` (m1-m18): apply with
   `node docs/loops/t357/apply.cjs . docs/loops/t357/mN.txt` (must print `APPLIED 1 edits to 1 files`), run
   `npx vitest run tests/t357-ctx-metrics.test.ts --no-file-parallelism --testTimeout=180000` in `open-brain`, paste the
   failed rows, restore from the backup (never git checkout: the file is untracked until step 6).
   Predicted red (**simulated** by the planner, see below):
   - m1 (an open week gets a row): CM-5, CM-6, CM-11, CM-12.
   - m2 (a week closes one millisecond late: `<=` to `<`): CM-2, CM-6, CM-11.
   - m3 (call ids not deduplicated): CM-5, CM-7, CM-11.
   - m4 (any record with an origin is a typed turn): CM-4.
   - m5 (a tool-result record with text beside it is a typed turn): CM-4.
   - m6 (a drop in context counted as negative growth): CM-5, CM-11.
   - m7 (the previous context kept across a compaction): CM-5, CM-11.
   - m8 (the window not closed at a compaction): CM-5, CM-8, CM-11.
   - m9 (`preTokens` ignored, the last call's context always used): CM-5, CM-8, CM-11.
   - m10 (a subagent file's unflagged records counted as main-thread calls): CM-5, CM-11.
   - m11 (a seat+week appended again on a rerun): CM-9, CM-11.
   - m12 (every call counted as a session's first): CM-5, CM-6, CM-7, CM-11.
   - m13 (tool-result characters carried over to later calls): CM-5, CM-11.
   - m14 (`<synthetic>` records counted as calls): CM-5, CM-11.
   - m15 (a change-log line added twice): CM-10, CM-13.
   - m16 (an absent seat folder exits 0): CM-12.
   - m17 (a turn typed while the model works not counted): CM-4, CM-5, CM-11.
   - m18 (a typed turn repeated in a second file counted twice): CM-5, CM-11.

   **A mutant with NO red row is a STOP** (`BLOCKED t357 <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, from the clone root,
   `git diff --no-index --quiet docs/loops/t357/ctx-metrics.mjs scripts/ctx-metrics.mjs` must exit 0, then rerun
   step 4: 0 failed.
6. **Commit, BEFORE the full suite.** One commit,
   `T357: scripts/ctx-metrics.mjs, a weekly context-efficiency row per seat with a dated change log (T-357)`.
   - Stage exactly the 2 paths: `scripts/ctx-metrics.mjs`, `open-brain/tests/t357-ctx-metrics.test.ts`.
   - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars,
     the same identity `docs/loops/t353-brief.md` step 8 names.
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 2 paths, both `A`.
   - `git rev-parse HEAD:scripts/ctx-metrics.mjs` must print the same blob id as
     `git rev-parse HEAD:docs/loops/t357/ctx-metrics.mjs`, and `HEAD:open-brain/tests/t357-ctx-metrics.test.ts` the
     same as `HEAD:docs/loops/t357/t357-ctx-metrics.test.ts`.
7. **Full suite**, on the committed tree, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000`
   (60-minute cap). Expect 0 failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate`
   or a hook timeout is rerun alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole
   `Unhandled Errors` section if any. A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line
   and go on; CI judges it. Any other red row: STOP, `BLOCKED t357 suite <rows>`, with each assertion message.
8. **Run it as a command** (the rows call `main()` by import, so only this step proves the file runs when invoked).
   From the clone root, with `T` a new empty temp folder OUTSIDE the clone:
   - `node scripts/ctx-metrics.mjs` : exit code 2; stderr line 1 is
     `ctx-metrics: no seats: pass --config with a "seats" map, or --seat <transcript folder>=<seat name>`.
   - `node scripts/ctx-metrics.mjs --root T --seat nothing=ghost --out T/o.jsonl` : exit code 1; stderr names
     `seat ghost: no transcript folder`; stdout ends `WROTE 0 row(s) to <T>/o.jsonl`; `T/o.jsonl` does not exist.
   - `node scripts/ctx-metrics.mjs --out T/o.jsonl --note "smoke" --date 2026-11-19` : exit code 0; stdout
     `NOTED 2026-11-19 in <T>/context-changes.md`; paste that file (4 lines).
   Paste each command, its output and its exit code. `git status --porcelain` must still be empty.
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t357 <sha40>`; the planner lands the commit. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t357` must equal HEAD.
   - `gh pr create --base master --head build/t357 --title "T357: scripts/ctx-metrics.mjs, a weekly context-efficiency row per seat with a dated change log (T-357)" --body "Brief: docs/loops/t357-brief.md."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Simulated by the planner (desktop, plain `node`, no npm, no vitest, no tsc)

- The fourteen rows ran green against the drafted script through a 30-line stand-in for vitest's `describe`, `it`,
  `expect` (`toBe`, `toEqual`, `toBeNull`, `toContain`, `toHaveLength`, `toMatch`, `toThrow`) under
  `node --experimental-strip-types`. Each of m1-m18 was applied with `apply.cjs` and gave the red rows listed in step 5.
- The script was run as a command on two real seats with `--dry-run` (nothing written): rows for four closed weeks
  each, and no row for the open week of 11-16.
- **NOT simulated:** `tsc` on the test file under `strict` (the stand-in strips types without checking them); vitest's
  own `toEqual` and `toThrow` (the stand-in mirrors them); Linux (temp paths, `fileURLToPath`); steps 7 and 9.

## Reply

- **First line:** `READY t357 <sha40> PR #<n>`, `HANDBACK t357 <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t357 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

No rebuild: nothing under `open-brain/src` changes, and the script runs from any checkout at the merge.

1. The planner writes `~/.claude/open-brain/context-metrics.config.json` on the desktop (the eight seats' transcript
   folders; never committed).
2. Seeds, from a checkout at the merge:
   `node scripts/ctx-metrics.mjs --config <config> --note "code mode A/B on dashboard t139, not adopted" --date 2026-11-19`
   and `... --note "Claude Code 2.1.329 on the QA PC and Lenovo" --date 2026-11-19`.
3. First run: `node scripts/ctx-metrics.mjs --config <config>`. It writes every closed week the transcripts still
   hold (about four per seat on 11-19). The oldest week of that run may be cut short by the transcripts' cleanup: the
   planner adds a `--note` naming it, and it is not used as a "before". **Ruled (planner, 11-19): the task's done line
   means four rows per seat written by four scheduled weekly runs after the merge, not the rows the first run reads
   from history.**
4. clark schedules the weekly run. Live check: the next Monday's run prints `1 row(s) written` per active seat and
   `0` on an immediate rerun.

- **If a field is added later:** bump `SCHEMA`, add the field at the end of the row in `rowsFor`, and update the
  `WEEK_1109` / `WEEK_1102` objects in the test file. Old rows keep `schema: 1`.
