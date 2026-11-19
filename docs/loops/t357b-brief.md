# T357b: the context-efficiency script, with the review's findings fixed (T-357; supersedes PR #1160)

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-19, session 178. **Tasks:** T-357. **Tag:** `t357b`. **Size:** SMALL (two new files,
no existing file edited). **Base:** the START sha the launcher names (a master that contains this brief). This is a
fresh build from master, NOT a commit on top of PR #1160's branch.
**Authority:** Aaron, 2026-11-19, in clark's window ("Yes, fleet-only first"); merge on Atlas's QA ACCEPT and Aaron's
word. No auth, deps, workflows, hooks or settings.

```text
IMPACT-TARGETS: none: no existing symbol is edited
```

`scripts/ctx-metrics.mjs` does not exist at master (PR #1160 is unmerged), so every symbol in it is new.

## Why this supersedes PR #1160 (CAND bc63a40a)

The t357 build was READY and its eighteen mutants went red as predicted. The Opus review (job #1530) REJECTED on two
findings the planner accepts, and listed notes the planner rules on here. `docs/loops/t357-brief.md` still describes
the script, its row and its measured premises; this brief describes only what differs.

- **F1.** `appendRows` appended to a file whose last line had no newline, so the new row was glued to that line. Both
  rows were then unreadable, their seat+week keys were lost, and a later run rewrote a closed week from whatever
  transcripts were left (the review's run: `calls` 6 became 1). That breaks "written once" and "rows outlive the
  transcripts".
- **F2.** A config file holding `null` exited 1 with a stack trace; bad input is exit 2. A `"seats": "abc"` string was
  read as three folders.

## What changes from CAND bc63a40a

Two files are copied in whole, byte for byte: `docs/loops/t357b/ctx-metrics.mjs` to `scripts/ctx-metrics.mjs`, and
`docs/loops/t357b/t357-ctx-metrics.test.ts` to `open-brain/tests/t357-ctx-metrics.test.ts`. Nothing else changes.
The row is unchanged: `schema` 1, the same fields in the same order.

| ruling | change in the script |
|---|---|
| F1 | `appendRows` reads the out file once; when it is not empty and does not end in a newline, the append starts with one. The half line stays where it is, unreadable and alone on its line |
| F2 | new `checkConfig`: the config must be a JSON object; `root`, `out`, `changes` strings if present; `seats`, if present, an object whose values are non-blank strings. A config that fails, cannot be read or is not JSON: exit 2 and ONE stderr line, `ctx-metrics: config <path>: <reason>`, no usage line, no stack |
| N1 | `--note` with `--dry-run` writes nothing (no file, no folder) and prints `WOULD NOTE in <change log>: - <date> <text>; dry run, nothing written`, or `ALREADY NOTED ...` when the line is there. `addNote` takes a fourth argument `dryRun`; the line is built and checked by the new `noteLine` |
| N2 | folders that carry one seat name are ONE seat: one `newSeat()` fed by each folder in config order (`readSeat(dir, seat)`), ids deduplicated across the folders, one set of rows, one log line with the summed file counts. A seat that works in two checkouts has two transcript folders |
| N7 | a seat folder that is a file, or a read that throws (a transcript deleted during the run), is one stderr line `ctx-metrics: seat <name>: cannot read <dir>: <reason>`; the seat counts as missing (exit 1) and the other seats are still written. `feedFile` is exported so a row can call it |
| N8 | `--now` without a zone (`Z` or `+hh:mm`) is exit 2: JavaScript reads such a time in the host's zone |
| NIT | `--date 2026-13-01` prints the `real YYYY-MM-DD` message, not `Invalid time value` |
| N3, N5, N6, N10, N4 | NOT changed. Each is one line under "Known limits" in the script's header |

**Ruled here (the review did not ask):** a seat with ANY folder absent or unreadable writes no row in that run, even
when its other folders were read. A row is written once, so a row built from part of a seat would never be corrected;
the seat waits for the next run and exit 1 says so. The stderr line names the folder to fix in the config.

**Not done:** the review's remark that stdout and stderr print the out, change-log and seat-folder paths, which on the
fleet carry the home path. Those come from the operator's own config and go to the operator's own terminal.

## Rows (`open-brain/tests/t357-ctx-metrics.test.ts`, twenty)

CM-1, 3, 4, 5, 6, 7, 8, 14 are round one's rows unchanged. Widened or new:

| row | what it adds |
|---|---|
| CM-2 | a `now` written with an offset: `+01:00` one hour before the Monday is open, `-05:00` at the Monday is closed |
| CM-9 | F1: a complete last row with no newline (1 written, each row on its own line, rerun writes 0); half an object at the end (2 written, the half line kept alone, rerun writes 0, the three rows readable); an empty file gets no leading newline |
| CM-10 | `2026-13-01` gives the `real YYYY-MM-DD` message; `noteLine`; a dry `addNote` returns true/false and writes nothing, not even the folder |
| CM-11 | the dry run is given an out path in a folder that does not exist: the folder is not created |
| CM-12 | `--now` with no zone is exit 2, one line, nothing written; `--seat a=b=eqseat` reads folder `a=b`; eleven bad configs (`null`, `[]`, a string, a number, not JSON, `seats` a string, an array, a number value, a blank value, `root` a number, `out` an object) each exit 2 with one line that starts `ctx-metrics: config <path>: ` |
| CM-13 | `--note --date 2026-13-01` exit 2; `--note --dry-run` prints the WOULD NOTE line, leaves the change log's bytes, and creates no folder |
| CM-15 | a boundary with no metadata and no call before it adds no size; a tool result sent before a compaction is not booked to the call after it; a window with a turn and no call is not a window sample |
| CM-16 | a window that ends with its file is booked to the week of its last turn (a Sunday call, a Monday turn); a file with a turn and no call has no window |
| CM-17 | one `queued_command` delivery id in two files of a seat is one turn |
| CM-18 | N2: folders `f1` and `f2` named `both`, `f3` named `other`: three rows, `both` counted once per id across the two folders |
| CM-19 | N7: a seat whose "folder" is a file, a seat with one folder read and one absent, and a good seat: exit 1, the two stderr lines exactly, only the good seat's row written; `feedFile` on a file that is not there rejects |
| CM-20 | `weekClosed` and `weekStart` give the UTC answer in a child `node` started with `TZ` set to `Asia/Tokyo`, `America/Los_Angeles` and `UTC` |

CM-20 starts a child process because a test that only runs in the host's zone cannot tell a local-time week from a
UTC one on a UTC host, which is what CI is: the review's `weekClosed` mutant survived there. The child imports the
script by URL and prints four values; it reads and writes no file.

## Existing tests that pin this behaviour (planner read at 6de2663c; rows NOT run)

Same table as `docs/loops/t357-brief.md`, same verdicts: no existing file is edited, no existing test imports the
script. `tests/harness/s4-guards.test.ts` D1b is red until the commit (step 6 comes before step 7 for that reason);
S4-9.2 and S4-5b stay green (twenty plain `it(` rows, no skip, no todo, not the forbidden word).
`tests/harness/checks.test.ts` D4 is red at the base on both hosts (an npm error).

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on, and print the host's zone (`date +%Z` or
   `[TimeZoneInfo]::Local.Id`): two mutant predictions depend on it.
2. **Branch.** In the clone at START: `git checkout -q -b build/t357b`. HEAD must equal START and the porcelain must be
   empty. `git cat-file -e HEAD:scripts/ctx-metrics.mjs` must FAIL (exit 128): if it succeeds, PR #1160 was merged;
   STOP, `BLOCKED t357b base has the script`. In `open-brain`: `npm ci` (exit code), then
   `node -e "require('better-sqlite3')"`; on "Could not locate the bindings file" run `npm rebuild better-sqlite3` and
   say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/` (never run the script without `--root` and `--out` pointing into a temp
     folder), `scripts/setup.mjs`, `git config` writes in the clone, any MCP config, `npm install`, any hook
     registration or `settings*.json`, `package.json`, `.github/`, the repo's `.gitignore` and `.agents/`, anything
     under `docs/`, and the branch `loop/t357`.
3. **Copy.** From the clone root:
   `Copy-Item docs/loops/t357b/ctx-metrics.mjs scripts/ctx-metrics.mjs` and
   `Copy-Item docs/loops/t357b/t357-ctx-metrics.test.ts open-brain/tests/t357-ctx-metrics.test.ts`.
   In `open-brain`: `npx tsc --noEmit` (exit 0) and `npx tsc -p tsconfig.tests.json --noEmit` (exit 0). A type error in
   the new test file: STOP, `BLOCKED t357b typecheck`, with the error lines (the planner could not run tsc).
4. **The twenty rows.** In `open-brain`:
   `npx vitest run tests/t357-ctx-metrics.test.ts tests/setup-hooks.test.ts tests/setup-repo-root.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files` and `Tests`. A red CM row: STOP, `BLOCKED t357b rows <rows>`, with each
   assertion message (expected vs received).
5. **Mutants**, each on the copied tree. Back up `scripts/ctx-metrics.mjs` once (Windows `$env:TEMP\t357b-cm.bak`,
   Linux `/tmp/t357b-cm.bak`) with `Copy-Item` or `cp`. For each `docs/loops/t357b/mN.txt` (m1-m41): apply with
   `node docs/loops/t357b/apply.cjs . docs/loops/t357b/mN.txt` (must print `APPLIED 1 edits to 1 files`), run
   `npx vitest run tests/t357-ctx-metrics.test.ts --no-file-parallelism --testTimeout=180000` in `open-brain`, paste the
   failed rows, restore from the backup (never git checkout: the file is untracked until step 6).
   Predicted red (**simulated** by the planner, see below). m1-m18 are round one's mutants, with the new rows that now
   also catch them:
   - m1 (an open week gets a row): CM-5, CM-6, CM-11, CM-12.
   - m2 (a week closes one millisecond late): CM-2, CM-6, CM-11, CM-20.
   - m3 (call ids not deduplicated): CM-5, CM-7, CM-11, CM-18.
   - m4 (any record with an origin is a typed turn): CM-4.
   - m5 (a tool-result record with text beside it is a typed turn): CM-4.
   - m6 (a drop in context counted as negative growth): CM-5, CM-11.
   - m7 (the previous context kept across a compaction): CM-5, CM-11.
   - m8 (the window not closed at a compaction): CM-5, CM-8, CM-11, CM-15.
   - m9 (`preTokens` ignored): CM-5, CM-8, CM-11, CM-15.
   - m10 (a subagent file's unflagged records counted as main-thread calls): CM-5, CM-11.
   - m11 (a seat+week appended again on a rerun): CM-9, CM-11.
   - m12 (every call counted as a session's first): CM-5, CM-6, CM-7, CM-11, CM-18.
   - m13 (tool-result characters carried over to later calls): CM-5, CM-11.
   - m14 (`<synthetic>` records counted as calls): CM-5, CM-11.
   - m15 (a change-log line added twice): CM-10, CM-13.
   - m16 (an absent seat folder exits 0): CM-12, CM-19.
   - m17 (a turn typed while the model works not counted): CM-4, CM-5, CM-11, CM-17.
   - m18 (a typed turn repeated in a second file counted twice): CM-5, CM-11, CM-17.

   The fixes:
   - m19 (F1: no leading newline): CM-9.
   - m20 (F1: a leading newline for an empty or absent file too): CM-9, CM-11, CM-12.
   - m21 (F2: any JSON value accepted as a config): CM-12.
   - m22 (F2: `seats` values not checked): CM-12.
   - m23 (F2: `root`, `out`, `changes` not checked): CM-12.
   - m24 (N1: a dry `addNote` writes): CM-10, CM-13.
   - m25 (N2: a later folder replaces an earlier one of the same seat): CM-18.
   - m26 (N2: each folder read into a seat of its own): CM-11, CM-12, CM-18, CM-19.
   - m27 (N7: a seat read in part still writes its rows): CM-19.
   - m28 (N7: the folder test dropped; the reason on the stderr line changes): CM-19.
   - m29 (N8: a `--now` with no zone accepted): CM-12.
   - m30 (NIT: the old date test): CM-10, CM-13.

   The review's survivors and two of the planner's:
   - m31 (`weekClosed` in the host's zone): CM-20 on every host; on a host whose zone is not UTC also CM-2, CM-6, CM-11.
   - m32 (`weekStart`'s weekday in the host's zone): CM-20 on every host; on a host west of UTC also CM-1.
   - m33 (`--dry-run` creates the out folder): CM-11.
   - m34 (a size pushed when there is none): CM-15.
   - m35 (a typed turn does not move the window's end): CM-16.
   - m36 (tool-result characters kept across a compaction): CM-15.
   - m37 (`queued_command` not deduplicated by delivery id): CM-17.
   - m38 (a window with a turn and no call counted as a sample): CM-15.
   - m39 (`--seat` split at the first `=`): CM-12.
   - m40 (a file with a turn and no call counted as an open window): CM-16.
   - m41 (`--note --dry-run` writes the change log): CM-13.

   **A mutant with NO red row is a STOP** (`BLOCKED t357b <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, from the clone root,
   `git diff --no-index --quiet docs/loops/t357b/ctx-metrics.mjs scripts/ctx-metrics.mjs` must exit 0, then rerun
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
     `git rev-parse HEAD:docs/loops/t357b/ctx-metrics.mjs`, and `HEAD:open-brain/tests/t357-ctx-metrics.test.ts` the
     same as `HEAD:docs/loops/t357b/t357-ctx-metrics.test.ts`.
7. **Full suite**, on the committed tree, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000`
   (60-minute cap). Expect 0 failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate`
   or a hook timeout is rerun alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole
   `Unhandled Errors` section if any. A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line
   and go on; CI judges it. Any other red row: STOP, `BLOCKED t357b suite <rows>`, with each assertion message.
8. **Run it as a command.** From the clone root, with `T` a new empty temp folder OUTSIDE the clone. Paste each
   command, its output and its exit code:
   - `node scripts/ctx-metrics.mjs` : exit 2; stderr line 1 is
     `ctx-metrics: no seats: pass --config with a "seats" map, or --seat <transcript folder>=<seat name>`.
   - `node scripts/ctx-metrics.mjs --root T --seat nothing=ghost --out T/o.jsonl --now 2026-11-19T12:00:00Z` : exit 1;
     stderr names `seat ghost: no transcript folder`; stdout ends `WROTE 0 row(s) to <T>/o.jsonl`; `T` is still empty.
   - the same with `--now 2026-11-19T12:00:00` : exit 2; stderr is one line,
     `ctx-metrics: --now must be a time with a zone (Z or +hh:mm), got 2026-11-19T12:00:00`.
   - write the four characters `null` into `T/null.json`; `node scripts/ctx-metrics.mjs --config T/null.json --out T/x.jsonl` :
     exit 2; stderr is one line, `ctx-metrics: config T/null.json: it must be a JSON object`; no stack trace.
   - `node scripts/ctx-metrics.mjs --out T/o.jsonl --note "smoke" --date 2026-11-19 --dry-run` : exit 0; stdout
     `WOULD NOTE in <T>/context-changes.md: - 2026-11-19 smoke; dry run, nothing written`; `T` holds `null.json` only.
   - `node scripts/ctx-metrics.mjs --out T/o.jsonl --note "smoke" --date 2026-13-01` : exit 2; stderr
     `ctx-metrics: --date must be a real YYYY-MM-DD date, got "2026-13-01"`.
   - `node scripts/ctx-metrics.mjs --out T/o.jsonl --note "smoke" --date 2026-11-19` : exit 0; stdout
     `NOTED 2026-11-19 in <T>/context-changes.md`; paste that file (4 lines).
   `git status --porcelain` must still be empty.
9. **Push and open the PR**, only on a host that can push. A host that cannot push stops after step 8 and replies
   `HANDBACK t357b <sha40>`; the planner lands the commit. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t357b` must equal HEAD.
   - `gh pr create --base master --head build/t357b --title "T357b: scripts/ctx-metrics.mjs, a weekly context-efficiency row per seat with a dated change log (T-357)" --body "Brief: docs/loops/t357b-brief.md. Supersedes #1160."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Simulated by the planner (desktop, plain `node` v22, no npm, no vitest, no tsc)

- The twenty rows ran green against the drafted script through the same stand-in for vitest as round one
  (`describe`, `it`, `expect` with `toBe`, `toEqual`, `toBeNull`, `toContain`, `toHaveLength`, `toMatch`, `toThrow`)
  under `node --experimental-strip-types`. CM-20's child processes ran for real.
- Each of m1-m41 was applied with `apply.cjs` and gave the red rows listed in step 5, twice: in the desktop's zone (not UTC)
  and with `TZ=UTC` set for the run. The two runs differ only in m31 and m32, as the list says.
- The review's two F1 runs were repeated as commands: a complete last row without a newline, then a later week, then
  a transcript file removed (the cleanup): three readable rows, `0 row(s) written, 3 already recorded`, the 11-09 row
  untouched. Half an object at the end: the half line alone on its line, the new row readable after it, a rerun
  writes 0.
- Step 8's seven commands gave the outputs and exit codes listed (on Windows; the paths differ).
- A missing transcript file makes `readline`'s iterator reject on Node 22 (probed: `REJECTED ENOENT`), so `feedFile`
  needs no error handler of its own; CM-19 pins it.
- **NOT simulated:** `tsc` on the test file under `strict` (the stand-in strips types without checking them); vitest's
  own matchers; Linux (temp paths, a folder named `a=b`, `TZ` in a child); steps 7 and 9.

## Reply

- **First line:** `READY t357b <sha40> PR #<n>`, `HANDBACK t357b <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t357b <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

As `docs/loops/t357-brief.md` says (the config on the desktop, the two `--note` seeds, the first run, clark's
schedule; done = four rows per seat written by four scheduled weekly runs). Also: the planner closes PR #1160 when
this build's PR is open, and a seat that runs in more than one checkout lists every transcript folder under its one
name in the config.
