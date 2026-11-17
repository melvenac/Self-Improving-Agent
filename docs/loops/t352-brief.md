# T352: the greeting-metrics row's budget_chars counts the printed pick-up, so a long pick-up no longer reads as over budget (T-352)

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-17, session 178. **Tasks:** T-352. **Tag:** `t352`. **Size:** SMALL (three source
files, one new test file). **Base:** the START sha the launcher names (a master that contains this brief; drafted
against `224b79ded315e8c06c96629d1c16a0bae3721036`).
**Authority:** the backlog (D-145); merge on Atlas's QA ACCEPT, sent to clark. No auth, deps, workflows or hooks.

```text
IMPACT-TARGETS: renderBriefing (session-start/briefing.ts), renderBudgeted (session-start/briefing.ts), BRIEFING_BUDGET (session-start/briefing.ts), buildGreetingMetricsRow (session-start/greeting-metrics.ts), renderStartReport (session-start/start-report.ts)
```

`BRIEFING_BUDGET` keeps its value; only its doc comment changes.

## What changes

`docs/loops/t352/edits.txt`, 10 edits in 3 files, plus one new test file copied in. No new row field, no schema bump
(`GREETING_METRICS_SCHEMA` stays 1), no dashboard change, no hook registration, no settings, no new dependency.

The problem: since PR #1133 (T-344) the budgeted briefing prints the reader's pick-up whole (cut only past 4000
characters) and `BRIEFING_BUDGET.chars` (4400) is measured WITHOUT it. `buildGreetingMetricsRow` still writes
`greeting_chars` = the whole block beside `budget_chars` = 4400. The dashboard marks a greeting "does not fit" when
`greeting_chars > budget_chars` (the task note says so; the dashboard is not in this repo), so a correct briefing with
a long pick-up reads red.

The ruling (planner; do not redesign): `greeting_chars` stays the true size of the whole block. With the budgeted
layout on, `budget_chars` becomes 4400 PLUS the number of characters of the printed pick-up that the budget excludes,
so `greeting_chars <= budget_chars` is true exactly when the briefing without its pick-up is within 4400. With the
layout off it stays null.

**What the budget excludes (read at the base).** The T-344 rows measure `lines.join("\n").length - pickUp.length`,
where `pickUp` is the pick-up TEXT as printed: whitespace flattened and, past 4000, cut with its `(N chars)` suffix.
That is `renderBudgeted`'s local `pickUp` when the reader has a handoff with a non-empty pick-up. The notes that ride
the same line (`Handoff MISSING`, `Already in origin/...`, `MAYBE SHIPPED`) are counted, and so are the stand-in lines
`(nothing recorded)` and `none ...`.

**The renderer hands the number over; the metrics code does not re-derive it.** Re-deriving would be inexact:
`buildGreetingMetricsRow` picks the reader's handoff with `ownHandoff(handoffs, role, handoffCheckout(root))`, while
`renderStartReport` gives the briefing a different `ownCheckout` for a role-none checkout and `renderBudgeted` also
passes `notASeat`. And parsing the block would have to tell the pick-up from the notes joined to it. So:

- **`session-start/briefing.ts`, new `BriefingPrinted { pickUpPrintedChars: number }`**, and a new optional second
  parameter `printed?: BriefingPrinted` on `renderBriefing`, passed to `renderBudgeted`. The returned lines are
  unchanged in both layouts.
- **`renderBudgeted`:** when `printed` is given and the reader's own handoff has a non-empty pick-up, sets
  `printed.pickUpPrintedChars = pickUp.length`, on the line before the pick-up line is pushed. Otherwise it leaves the
  caller's 0. The legacy layout never sets it.
- **`session-start/greeting-metrics.ts`:** `GreetingMetricsInput` gains optional `pickUpPrintedChars?: number` (optional
  because four existing test files build this input without it; absent is 0). The row line becomes
  `budget_chars: input.budget ? BRIEFING_BUDGET.chars + (input.pickUpPrintedChars ?? 0) : null`.
- **`session-start/start-report.ts` `renderStartReport`:** declares `const printed = { pickUpPrintedChars: 0 }` before
  the record branch, passes it to `renderBriefing`, and passes `printed.pickUpPrintedChars` to `recordGreetingMetrics`.
  With no valid record the briefing is not rendered and the count stays 0.

## Existing tests that pin this behaviour (planner read at 224b79de; rows NOT run)

No existing row asserts a `budget_chars` value. `git grep -n -E "budget_chars|greeting_chars" 224b79de -- open-brain/tests`
has one hit, the key-order list in t298-greeting-truth G8. **No existing row turns red.**

| file / row | verdict |
|---|---|
| `tests/pipelines/session-start/t298-greeting-truth.test.ts` G8 (the row's keys in order, `budget: false`) | stays green: no key is added or moved, and budget off is still null |
| same file G9, G10, G11 (`recordGreetingMetrics` with an input that has no `pickUpPrintedChars`), T336-1 | stay green: the field is optional |
| same file G12 (`handleStart` with `greeting_metrics` on, budget off; asserts one row, `schema` 1) | stays green |
| same file G2-G4, and every other one-argument `renderBriefing(...)` call in the suite | stay green: the second parameter is optional and the lines are unchanged |
| `tests/pipelines/session-start/t298-s2-handoff-stamp.test.ts`, `t324-s1-greeting-fields.test.ts`, `t327-objective-stale.test.ts` (each builds a `GreetingMetricsInput` without the new field) | stay green, and still typecheck |
| `tests/pipelines/session-start/briefing-budget.test.ts`, all rows, including "the budget constants are the brief's" (4400) and T344-1 to T344-5 | stay green: `BRIEFING_BUDGET` and the rendered lines are unchanged |
| `tests/pipelines/session-start/briefing.test.ts` ("the block in ob_start's output is exactly renderBriefing's output", QA 263 F4) | stay green: the block is unchanged |
| `tests/pipelines/session-start/a2a-byte-identical.test.ts` (legacy layout golden) | stays green |
| `tests/t314-start-read-only.test.ts` R3 (a read-only start writes no row) | stays green |
| `tests/server.test.ts` "briefing_budget ON prints the budgeted block through ob_start" | stays green |
| `tests/pipelines/sync/module-boundary.test.ts` | stays green: no import is added |
| `tests/pipelines/sync/retirements-live.test.ts` | unaffected: `.agents/retirements.json` pins no line in the three edited files |

New rows, all in the new file `open-brain/tests/pipelines/session-start/t352-budget-chars.test.ts`:

- **T352-1** budgeted, 1500-character pick-up: `pickUpPrintedChars` 1500, `budget_chars` 5900, `greeting_chars` equals
  the block's length and is `<= budget_chars`; with both notes riding the line the count is still 1500.
- **T352-2** budgeted with nothing to exclude (empty pick-up, reader with no handoff, unresolved seat, field absent):
  `budget_chars` exactly 4400.
- **T352-3** budget off: null; the legacy layout sets nothing; a count handed in is not used.
- **T352-4** the red stays real: 3000-character pick-up, everything else padded to exactly 4400 gives 7400 and 7400
  (fits); padded to 4401 gives 7401 against 7400 (over).
- **T352-5** the count is the PRINTED length: a 5000-character pick-up cut at the cap counts 4014 (`budget_chars` 8414);
  a 35-character pick-up with a blank line and a run of spaces counts its flat 31 (4431).
- **T352-6** through `handleStart`: a budgeted start writes `budget_chars` 5900 and `greeting_chars` equal to the block
  in the returned text; a start with the budget off writes null.

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t352`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), then `node -e "require('better-sqlite3')"`; on "Could not locate the
   bindings file" run `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`,
     any hook registration or `settings*.json`, `package.json`, `.github/`, and anything under `docs/`.
3. **Apply.** `node docs/loops/t352/apply.cjs . docs/loops/t352/edits.txt` must print exactly
   `APPLIED 10 edits to 3 files`. Then, from the clone root:
   `Copy-Item docs/loops/t352/t352-budget-chars.test.ts open-brain/tests/pipelines/session-start/t352-budget-chars.test.ts`.
   In `open-brain`: `npx tsc --noEmit` (exit 0), `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build`
   (exit 0).
4. **The eleven files.** In `open-brain`:
   `npx vitest run tests/pipelines/session-start/t352-budget-chars.test.ts tests/pipelines/session-start/t298-greeting-truth.test.ts tests/pipelines/session-start/t298-s2-handoff-stamp.test.ts tests/pipelines/session-start/t324-s1-greeting-fields.test.ts tests/pipelines/session-start/t327-objective-stale.test.ts tests/pipelines/session-start/briefing-budget.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/session-start/a2a-byte-identical.test.ts tests/t314-start-read-only.test.ts tests/server.test.ts tests/pipelines/sync/module-boundary.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files` and `Tests`. A red row here: STOP, `BLOCKED t352 rows <rows>`, with each assertion
   message (expected vs received). The output carries non-ASCII characters: paste it as printed, and if you filter it
   use `grep -a`.
5. **Mutants**, each on the applied tree. Back up once from the clone root (Windows `$env:TEMP`, Linux `/tmp`):
   `open-brain/src/pipelines/session-start/briefing.ts` -> `t352-br.bak`,
   `open-brain/src/pipelines/session-start/greeting-metrics.ts` -> `t352-gm.bak`,
   `open-brain/src/pipelines/session-start/start-report.ts` -> `t352-sr.bak`. Use `Copy-Item` or `cp`, never
   `Get-Content | Set-Content` (it mangles the files' non-ASCII characters).
   For each `docs/loops/t352/mN.txt` (m1-m7): apply (must print `APPLIED 1 edits to 1 files`), run
   `npx vitest run tests/pipelines/session-start/t352-budget-chars.test.ts --no-file-parallelism --testTimeout=180000`
   in `open-brain`, paste the failed rows, restore that file from its backup (never git checkout).
   Predicted red (NOT simulated):
   - m1 (the addition dropped, back to plain 4400, `greeting-metrics.ts`): T352-1, T352-4, T352-5, T352-6.
   - m2 (the sum written even when the budget is off, `greeting-metrics.ts`): T352-3, T352-6.
   - m3 (the stored pick-up's length where the printed length is right, `briefing.ts`): T352-5.
   - m4 (off by one, `+ 1`, `greeting-metrics.ts`): T352-1, T352-2, T352-4, T352-5, T352-6.
   - m5 (`renderStartReport` hands the row 0, `start-report.ts`): T352-6.
   - m6 (the `(nothing recorded)` stand-in counted as pick-up text, `briefing.ts`): T352-2.
   - m7 (`renderBriefing` does not pass `printed` on, `briefing.ts`): T352-1, T352-4, T352-5, T352-6.

   **A mutant with NO red row is a STOP** (`BLOCKED t352 <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on; CI judges it. Any other
   red row: STOP, `BLOCKED t352 suite <rows>`, with each assertion message. (Most likely source if one appears: a test
   that compares a whole greeting-metrics row of a budgeted start, or a harness guard on the new test file.)
7. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | grep -a -E "module-boundary|retirements"`
   (Windows: `Select-String -Pattern "module-boundary|retirements"`). Paste every line; both must be `[pass]`.
8. **Commit.** One commit, `T352: budget_chars counts the printed pick-up, so a long pick-up is not over budget (T-352)`.
   - Stage exactly the 4 paths: `open-brain/src/pipelines/session-start/briefing.ts`,
     `open-brain/src/pipelines/session-start/greeting-metrics.ts`,
     `open-brain/src/pipelines/session-start/start-report.ts`,
     `open-brain/tests/pipelines/session-start/t352-budget-chars.test.ts`.
   - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars
     (Forge, melvenac@gmail.com).
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 4 paths: the three source files `M`, the test file `A`.
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t352 <sha40>`; the planner lands the commit with `job.mjs land`. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t352` must equal HEAD.
   - `gh pr create --base master --head build/t352 --title "T352: budget_chars counts the printed pick-up, so a long pick-up is not over budget (T-352)" --body "Brief: docs/loops/t352-brief.md."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t352 <sha40> PR #<n>`, `HANDBACK t352 <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t352 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Name any HIGH, CRITICAL or UNKNOWN impact target from the launcher's prompt and say
  which rows cover its callers. Do not merge.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`, then Aaron reconnects open-brain (the row is written by the MCP server process). Live
check, read-only: after the next `/start` of a budgeted seat whose pick-up is longer than a few hundred characters, the
newest row of `~/.claude/open-brain/greeting-metrics.jsonl` for that checkout has `budget_chars` = 4400 + the length of
the line printed under `PICK UP HERE` (less any note joined to it), and `greeting_chars <= budget_chars`. A seat with
no handoff has `budget_chars` 4400. Rows written before the rebuild keep 4400 and can still read red on the dashboard.

- **Not changed, by the ruling:** the dashboard's comparison, the row's fields and `GREETING_METRICS_SCHEMA`. A reader
  of old and new rows cannot tell from a row alone which rule wrote its `budget_chars`, except that a value other than
  4400 or null is the new rule.
