# T344: the budgeted briefing prints the pick-up whole, says when it capped a list, and does not split a fact (T-344, T-312)

Runtime: CC (claude -p, Opus)
SEAT: job runner (Lenovo or QA PC), NOT the desktop. No hub key. Code. Ends at READY with a PR, or HANDBACK; no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-17, session 178. **Tasks:** T-344, T-312. **Tag:** `t344`. **Size:** SMALL (one source
file, six test files). **Base:** the START sha the launcher names (a master that contains this brief).
**Authority:** the backlog (D-145); merge on Atlas's QA ACCEPT, sent to clark. No auth, deps, workflows or hooks.

```text
IMPACT-TARGETS: renderBudgeted (session-start/briefing.ts), BRIEFING_BUDGET (session-start/briefing.ts)
```

One brief for two tasks because both change `renderBudgeted`; two briefs would have adjacent hunks.
`BRIEFING_BUDGET` keeps its value; only its doc comment changes.

## What changes

`docs/loops/t344/edits.txt`, 28 edits in 7 files. No new file. Only the budgeted layout (`budget: true`,
greeting.json `briefing_budget`) changes. `renderBriefing`'s legacy layout is not touched and stays byte-identical.

- **T-344 (d), the pick-up prints whole.** In the budgeted layout the pick-up (whitespace flattened to one line, as
  today) prints whole up to `PICK_UP_SAFETY_CHARS` (new, 4000). It is the one line a rolled session needs, and the
  legacy layout already prints 3-4 KB pick-ups whole. Past 4000 it is cut by `cutSentence` (new): the text ends after
  its last whole sentence inside the cap (`.`, `;`, `!` or `?` followed by a space; `1. ` and `12. ` are list markers
  and do not count), provided that sentence ends in the second half of the cap, otherwise the cut is `cutWord`'s. The
  `... (N chars)` suffix is unchanged.
- **The notes no longer take from the pick-up.** `Already in origin/... ` (T-302) and `MAYBE SHIPPED` (T-316 S2)
  still ride the pick-up line with their own text; `noteRoom` is removed.
- **`BRIEFING_BUDGET` stays `{ lines: 31, chars: 4400 }` and is measured on the briefing EXCLUDING the pick-up text.**
  The constant's comment says so, and the worst-case rows subtract the pick-up they planted. Predicted every-flag
  worst case without the pick-up: 4152 (the last recorded 4396, less the 260-character cut pick-up, plus 16 for the
  three header totals), so no bump.
- **T-312 (a), header totals.** When a capped list hides items, its header carries the total: `WATCH OUT (4):`,
  `WAITING ON AARON (5):`, `OPEN QUESTIONS (6):`. A list that fits keeps today's header (`WATCH OUT`,
  `WAITING ON AARON:`, `OPEN QUESTIONS`). The `+N more: state.json ...` line is unchanged.
- **T-312 (b), `shownWatch` (new).** Past the cap (`HANDOFF_CAPS.watchOuts`, 3), a watch-out that carries `expires`
  (a date or a session number) is kept before one that does not; the kept items print in the record's order. At or
  under the cap nothing is reordered.
- **T-312 (c).** With no unresolved question owned by aaron in any current handoff, the briefing prints one line,
  `WAITING ON AARON: none`, where the section would be. "Owned by aaron" is unchanged: `questionOwner(q)` lowercased
  equals `aaron` and `questionResolvedBy(q)` is null, over `newestHandoffPerInstance(state.handoffs)`.
- **T-344 (e), `cutWord` (new).** A cut NEXT title (the 100-character one), watch-out or question backs off to the last
  space within `CUT_BACKOFF` (24) characters of the cap, so a word or a date is not split. A token longer than that is
  cut at the cap, exactly as today. `cut` itself is unchanged and still serves the drift line, the objective, the
  `[done]` title (36) and the PROBLEM line.

## Existing tests that pin this behaviour (planner read at e7405958; string functions simulated standalone, rows NOT run)

| file / row | verdict |
|---|---|
| t316-s2 R7 (`"P".repeat(400 - room)... (1000 chars)`, total length equal to `before`) | turns red, new value: the line is `"P".repeat(1000)`, then MERGED, then NOTE, joined by the middle dot; total length is `before` + 3 + `NOTE.length`; line count still equal. Title reworded |
| t302-merged-citations M6 (`withIt.length <= without.length`) | turns red, new value: `without` is `"x".repeat(1500)`; `withIt.length` is `without.length + 3 + NOTE.length`. Title reworded |
| briefing-budget WORST CASE (plain) | turns red (2399-character pick-up now whole), new value: the line after `PICK UP HERE` is the whole pick-up, and `chars` is measured without it |
| briefing-budget WORST CASE with the T-199 notice | turns red, new value: `chars` measured without the pick-up text |
| briefing-budget WORST CASE with EVERY flag | turns red, new value: the text contains `OWN ` plus the whole pick-up; `chars` (and the `T302-WORST` line it prints) is measured without it; predicted 4152 |
| briefing-budget "an SIA-shaped record" (1000-character pick-up) | edited so the measure is explicit: the pick-up prints whole and is not counted. It may have stayed green uncounted; not measured |
| briefing-budget A2A's real record x4 (own pick-up 738 characters for qa, 1.2 to 1.9 KB for planner) | turns red for planner (likely) and qa (possibly), new value: the pick-up line carries no `(N chars)` suffix, and `chars` is measured without it; a `none ...` line is counted |
| missing-handoff "the budget still holds..." x3 (2400-character pick-up) | turn red, new value: `chars` less the pick-up's 2399; the first also asserts the line starts with the whole pick-up. Titles kept |
| focus.test B1 worst case | turns red, new value: the text contains the whole pick-up on its own line, and `text.length` less 2399 is within the budget. `B1-MEASURE` still prints the full length |
| briefing-budget "WORST CASE keeps the facts..." (bare header list) | turns red, new value: `WATCH OUT (17):`, `WAITING ON AARON (8):`, `OPEN QUESTIONS (8):` |
| briefing-budget "omits the section when nothing is waiting..." and "reads each seat's CURRENT handoff only..." | would stay green vacuously; edited, new value: the lines starting `WAITING ON AARON` are exactly `["WAITING ON AARON: none"]`. First title reworded |
| briefing-budget `section()` helper | edited: finds a header that carries a total and stops at `WAITING ON AARON: none`. Without it every WATCH OUT row would gain the `none` line |
| handoff-by-checkout R1/R2, R4, R5 budgeted layout (`section()` over HEADS) | would turn red (the `none` line lands in the PICK UP or WATCH OUT section): helper regex edited to stop at it; expected values unchanged |
| briefing-budget "the budget constants are the brief's", t167-problem "BRIEFING_BUDGET is { lines: 31, chars: 4400 }" | stay green: the value is unchanged |
| briefing-budget (a) expiry rows, "seventeen long watch-outs", "cut and expired share one note line", (e) "lists unresolved...", "shown once", "past two...", (d) rows, "a cut line says how long the text was" (no space within 24 of the cap), "OFF is the original layout" | stay green with the helper edit |
| t302 M5, t316-s2 R6, missing-handoff HO-4 line-count and `indexOf("PICK UP HERE") + 1` rows (short pick-ups) | stay green |
| handoff-by-checkout ob_start rows, standing-budget, t161-transcript, t298 G3, s173h, briefing-fix BF-F5/F8, t309 D1-D4 | stay green |
| server.test "briefing_budget ON prints the budgeted block" (`length <= 30`) | stays green (one more line on a short block); in the full suite, not in step 4 |
| a2a-byte-identical, fleet-ae-f5 snapshot, fleet-ae-e3, fleet-ae-f8, briefing.test.ts (all legacy layout) | unaffected |

New rows, all in `tests/pipelines/session-start/briefing-budget.test.ts`, in a new describe placed before "(d) NEXT only
when...": T312-1 (totals on three headers, bare when the list fits), T312-2 (an expiring item is never the hidden one),
T312-3 (`WAITING ON AARON: none`, also for a reader with no handoff; absent in the legacy layout), T344-1 (a
545-character pick-up prints whole, alone and with both notes riding the line; a 4250-character one ends after its
twelfth sentence with `(4250 chars)`), T344-2 (a watch-out, a question in both sections and a NEXT title back off to a
space).

## Steps

1. **Shell.** Windows host: PowerShell, `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `$env:NO_COLOR='1'`.
   Linux host: bash, `export NO_COLOR=1`, and use `cp` where a step says `Copy-Item` (backups under `/tmp`). Either way
   `node -v` must print `v22.*`. Say which host you are on.
2. **Branch.** In the clone at START: `git checkout -q -b build/t344`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), then `node -e "require('better-sqlite3')"`; on "Could not locate the
   bindings file" run `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config, `npm install`,
     and anything under `docs/`.
3. **Apply.** `node docs/loops/t344/apply.cjs . docs/loops/t344/edits.txt` must print exactly
   `APPLIED 28 edits to 7 files`. In `open-brain`: `npx tsc --noEmit` (exit 0),
   `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build` (exit 0).
4. **The twelve files.** In `open-brain`:
   `npx vitest run tests/pipelines/session-start/briefing-budget.test.ts tests/pipelines/session-start/t167-problem.test.ts tests/pipelines/session-start/handoff-by-checkout.test.ts tests/pipelines/session-start/missing-handoff.test.ts tests/pipelines/session-start/t302-merged-citations.test.ts tests/pipelines/sync/t316-s2.test.ts tests/pipelines/session-start/focus.test.ts tests/pipelines/session-start/standing-budget.test.ts tests/pipelines/session-start/t309-done-objective.test.ts tests/pipelines/session-start/t161-transcript.test.ts tests/pipelines/session-start/a2a-byte-identical.test.ts tests/s173h.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files`, `Tests`, and the two measure lines the run prints: `T302-WORST lines=... chars=...`
   (now without the pick-up text; predicted 4152) and `B1-MEASURE ... lines ... chars` (the full text). A red row here:
   STOP, `BLOCKED t344 rows <rows>`, with each assertion message (expected vs received). The output carries non-ASCII
   characters: paste it as printed, and if you filter it use `grep -a`.
5. **Mutants**, each on the applied tree. Back up once from the clone root (Windows `$env:TEMP`, Linux `/tmp`):
   `open-brain/src/pipelines/session-start/briefing.ts` -> `t344-br.bak`. Use `Copy-Item` or `cp`, never
   `Get-Content | Set-Content` (it mangles the file's non-ASCII characters).
   For each `docs/loops/t344/mN.txt` (m1-m7): apply (must print `APPLIED 1 edits to 1 files`), run step 4's command,
   paste the failed rows, restore the file from its backup (never git checkout). Predicted red (NOT simulated):
   m1 (a, no WATCH OUT total) T312-1 and "WORST CASE keeps the facts"; m2 (b, first three kept) T312-2; m3 (c, no
   `none` line) T312-3, "prints `WAITING ON AARON: none`..." and "reads each seat's CURRENT handoff only"; m4 (d, the
   4000 cap back at the old 400) T344-1, t302 M6, t316-s2 R7, the plain and every-flag briefing-budget WORST CASE rows, the
   SIA-shaped row, A2A's real record for planner and qa, the first missing-handoff budget row and focus B1; m5 (e, the
   watch-out cut blind) T344-2; m6 (e, the back-off unbounded) "a cut line says how long the text was" and t309 D3;
   m7 (d, past 4000 the cut is blind) T344-1.
   **A mutant with NO red row is a STOP** (`BLOCKED t344 <m> survives`). Other differences from the prediction are not
   a STOP: paste the rows and go on; the planner rules. After the last restore, rerun step 4: 0 failed.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap). Expect 0
   failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout is rerun
   alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors` section if any.
   A red `tests/harness/checks.test.ts` D4 is not a STOP: paste its last stderr line and go on; CI judges it. Any other
   red row: STOP, `BLOCKED t344 suite <rows>`, with each assertion message. (Most likely source if one appears: a test
   that renders the budgeted block with no question owned by aaron and reads a fixed line position or line count, now
   one line longer for `WAITING ON AARON: none`; a test that measures a budgeted block holding a pick-up longer than
   400 characters; or a test that reads this repo's own record through `ob_start`, since `.agents/SYSTEM/greeting.json`
   has `briefing_budget` on.)
7. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | grep -a -E "module-boundary|retirements"`
   (Windows: `Select-String -Pattern "module-boundary|retirements"`). Paste every line; both must be `[pass]`.
8. **Commit.** One commit, `T344: budgeted briefing prints the pick-up whole and totals its capped lists (T-344, T-312)`.
   - Stage exactly the 7 paths: `open-brain/src/pipelines/session-start/briefing.ts`,
     `open-brain/tests/pipelines/session-start/briefing-budget.test.ts`,
     `open-brain/tests/pipelines/session-start/handoff-by-checkout.test.ts`,
     `open-brain/tests/pipelines/session-start/missing-handoff.test.ts`,
     `open-brain/tests/pipelines/session-start/t302-merged-citations.test.ts`,
     `open-brain/tests/pipelines/sync/t316-s2.test.ts`,
     `open-brain/tests/pipelines/session-start/focus.test.ts`.
   - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - No git identity on the host and `git config` writes forbidden: commit with GIT_AUTHOR_*/GIT_COMMITTER_* env vars
     (Forge, melvenac@gmail.com).
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows those 7 paths, all `M`.
9. **Push and open the PR**, only on a host that can push. A host that cannot push (the Lenovo, read-only token) stops
   after step 8 and replies `HANDBACK t344 <sha40>`; the planner lands the commit with `job.mjs land`. Do not try to push there.
   - Push, never force. `git ls-remote origin refs/heads/build/t344` must equal HEAD.
   - `gh pr create --base master --head build/t344 --title "T344: budgeted briefing prints the pick-up whole and totals its capped lists (T-344, T-312)" --body "Brief: docs/loops/t344-brief.md."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t344 <sha40> PR #<n>`, `HANDBACK t344 <sha40>` (no-push host, steps 1-8 all passed) or
  `BLOCKED t344 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge. Name any HIGH, CRITICAL or UNKNOWN impact target from the launcher's
  prompt and say which rows cover its callers.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`. Live checks, read-only, on the next `/start` of a budgeted seat: (1) a pick-up longer than
400 characters prints whole, with no `(N chars)` suffix; (2) a seat with more than three watch-outs prints
`WATCH OUT (N):` and shows its expiring item; (3) a seat with nothing waiting prints `WAITING ON AARON: none`.

- **greeting-metrics is left as it is.** It writes `greeting_chars` and `greeting_bytes` from the FULL briefing text,
  pick-up included, beside `budget_chars` 4400 (`greeting-metrics.ts`). The dashboard reads those, so its ratio can now
  pass 4400 for a seat with a long pick-up. That is the pick-up, not a budget failure; changing what the row writes or
  how the dashboard scores it is a separate task.
- **Follow-up, wording:** the three `start.md` copies (`.claude/commands/start.md`,
  `project-template/.claude/commands/start.md`, `project-template/.cursor/commands/start.md`) say "WATCH OUT is every
  item the previous session wrote down". In the budgeted layout it is at most three, with the total on the header. A
  later change rewords them; they are not touched in this run.
