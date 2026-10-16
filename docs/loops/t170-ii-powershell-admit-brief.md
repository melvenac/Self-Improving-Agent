# T-170 part (ii) step 2 (G-060): the recall trigger admits Claude Code's PowerShell tool

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t170ii3-reply.md. A reply path in
the launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-16, session 173. **Task:** T-170 (P1), part (ii) step 2; gap G-060. **Tag:**
`T-170-II-S2`. **Size:** SMALL. **Base:** the dispatch SHA clark names (a master that contains this brief and #794,
merged at c382f0c9). **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: shellCommandFromHookPayload (open-brain/src/cli-recall-trigger.ts: one condition changes; callers are main in the same file and tests/t235-p2-5-cursor-recall.test.ts)
```

## Why

The recall trigger acts only on `tool_name` `Bash` (Claude Code) and `Shell` (Cursor)
(`open-brain/src/cli-recall-trigger.ts`, `shellCommandFromHookPayload`), and the README registers it with matcher
`Bash`. On the QA PC, 225 of 1,399 tool calls (16.1%) in the newest 60 transcripts were PowerShell
(`docs/loops/t170-ii/research-reply.md`, A3(a)), so command keys and the element path never see them (G-060).

PowerShell was measured live before this brief (`docs/loops/t170-ii/powershell-reply.md`, T-170-II-PS, planner
ACCEPTED, claude 2.1.296). Its payload has Bash's shape:
- `tool_name` `PowerShell`, and `tool_input.command` equals the command exactly;
- the PostToolUse `tool_response` keys are the same as Bash's;
- every failure fires PostToolUseFailure, including a cmdlet error with no `exit`;
- `additionalContext` reached the model on both events when `hookEventName` named the firing event.

#794 (G-059) already answers with the firing event. So the code change is one name, admitted the way
`CURSOR_MEASURED_SHELL_TOOL_NAMES` admits Cursor's `Shell` on a measurement row.

**The live `~/.claude/settings.json` is NOT changed by this run.** Its matcher changes after the merge and rebuild,
on Aaron's word.

**Out of scope (later rulings, do not touch):**
- the element path's bash idioms (`| tail; echo $?`) applied to PowerShell text;
- error keys and the normalisation of PowerShell error records;
- Cursor's tool names.

## Ruling (exact)

1. `open-brain/src/cli-recall-trigger.ts`:
   - Directly below the `CURSOR_MEASURED_SHELL_TOOL_NAMES` declaration (and above the doc comment of
     `shellCommandFromHookPayload`), add:
     ```ts
     /**
      * Shell tool names Claude Code sends on PostToolUse and PostToolUseFailure. `Bash` is the original; `PowerShell` was
      * measured live (T-170-II-PS, G-060, 2026-10-15, QA PC, claude 2.1.296, docs/loops/t170-ii/powershell-reply.md): its
      * payload has Bash's shape and `tool_input.command` is the command exactly. No other names without a new measurement row.
      */
     export const CLAUDE_CODE_MEASURED_SHELL_TOOL_NAMES = new Set<string>(["Bash", "PowerShell"]);
     ```
   - In `shellCommandFromHookPayload`, the line `  if (toolName === "Bash") {` becomes
     `  if (typeof toolName === "string" && CLAUDE_CODE_MEASURED_SHELL_TOOL_NAMES.has(toolName)) {`.
   - Nothing else in `src` changes. `CURSOR_MEASURED_SHELL_TOOL_NAMES` stays exactly as it is.
2. `README.md`, section "**2. Register the hooks**":
   - In the jsonc block, on BOTH the `"PostToolUse":` line and the `"PostToolUseFailure":` line, `"matcher": "Bash"`
     becomes `"matcher": "Bash|PowerShell"`. Nothing else on those lines changes.
   - `Three things about the trigger's registration that are not obvious:` becomes
     `Five things about the trigger's registration that are not obvious:` (the list already has four bullets, and this
     run adds a fifth).
   - Directly after the bullet that starts `` - **`PostToolUseFailure` as well (G-059).** ``, add this bullet:
     `` - **`Bash|PowerShell` (G-060).** On Windows, Claude Code also has a `PowerShell` tool. Its calls carry `tool_input.command` exactly as Bash's do and fire the same two events (measured: `docs/loops/t170-ii/powershell-reply.md`), so the matcher, which is a regex, names both. Without it a PowerShell command never reaches the trigger. ``
3. `open-brain/tests/trigger/t170-ii-failure-event.test.ts` row **F5** (commit 2 only): the needle
   `'"PostToolUseFailure": [{ "matcher": "Bash"'` becomes `'"PostToolUseFailure": [{ "matcher": "Bash|PowerShell"'`.
   Nothing else in that file changes. (Ruling 2 makes the old needle absent, so F5 goes red without this. That is the
   predicted red, not a regression.)

## Rows (commit 1: new file `open-brain/tests/trigger/t170-ii-powershell.test.ts`)

Copy the harness from `tests/trigger/t170-ii-failure-event.test.ts` lines 1-91:
- the imports, `ROOT`, `REPO`, `HOOK`, `TSX_CLI` and `SPAWN_TIMEOUT`;
- `A_CONTENT`, and the `mkdtemp` `beforeEach`/`afterEach` (prefix `t170ii2-`);
- `seed`, `pendingLines`, `runHook`, `HookOut` and `keyedRun`.

**Do NOT import `cli-recall-trigger`** in this file. Every row goes through the spawned hook or reads README.md.

`ps(command, session, event)` returns:
- `{ session_id: session, hook_event_name: event, tool_name: 'PowerShell', tool_input: { command, description: 'probe' }, duration_ms: 12 }`
- plus, when `event === 'PostToolUseFailure'`, `error: 'Exit code 128\nfatal: invalid object name'` and
  `is_interrupt: false`;
- otherwise `tool_response: { stdout: '', stderr: '', interrupted: false, isImage: false }`.

The rows:
- **W1** `keyedRun(ps('git show nosuchref:src/a.ts', 'w1', 'PostToolUseFailure'))`. Expect
  `out.hookSpecificOutput.hookEventName === 'PostToolUseFailure'`, and `additionalContext` contains
  `[stored knowledge ${A}`.
- **W2** `keyedRun(ps('git show nosuchref:src/a.ts', 'w2', 'PostToolUse'))`. Expect `hookEventName === 'PostToolUse'`,
  and `additionalContext` contains `[stored knowledge ${A}`.
- **W3** No sidecar. Seed `{ a: A_CONTENT }` at `dbPath = path.join(dir, 'knowledge-v2.db')`. Run the hook on
  `ps('Get-ChildItem C:\\t170ii2', 'w3', 'PostToolUse')` with `KNOWLEDGE_V2_DB` and `RECALL_TRIGGER_LOG` in the temp
  dir. Expect exit 0, stdout `''`, and `pendingLines(dbPath)` length **1**: a PowerShell call now enters the census as
  a not-asked fire.
- **W4** The same set-up as W1 (seed, sidecar), but the payload's `tool_name` is `'powershell'` (lower case), event
  `'PostToolUseFailure'`. Run with `runHook` directly (not `keyedRun`, which parses stdout). Expect exit 0, stdout
  `''` and `pendingLines(dbPath)` length **0**. Only the exact measured name is admitted.
- **W5** No sidecar. Seed `{ a: A_CONTENT }`. Payload `ps('   ', 'w5', 'PostToolUse')`. Expect exit 0, stdout `''`,
  and `pendingLines(dbPath)` length **0** (a blank command is still dropped).
- **W6** Read `README.md` at `path.join(REPO, 'README.md')`, with `\r\n` turned into `\n`. Find `h`, `o` and `c` as F5
  does (all `>= 0`). In the slice `o..c`, the lines containing `cli-recall-trigger.js` number exactly **2**, and every
  one of them contains `"matcher": "Bash|PowerShell"`.

**Expected at commit 1 (the base):** W1, W2, W3 and W6 RED; W4 and W5 green. The base returns null for
`PowerShell`, so it prints nothing and records nothing.

## Existing tests (verdicts)

The planner checked these with a grep of `tool_name`, `matcher` and `shellCommandFromHookPayload` under
`open-brain/tests` at 9bb55f9b:

- **`tests/trigger/t170-ii-failure-event.test.ts` F5 (line 136): turns RED from ruling 2.** Ruling 3 updates its
  needle in commit 2. F1-F4 and F6 stay green: their payloads are `tool_name: 'Bash'`.
- `tests/trigger/hook.test.ts:212`, "ignores a tool that is not Bash" (`tool_name: 'Read'`): stays green.
- `tests/t235-p2-5-cursor-recall.test.ts:69-71` and `:90-91` (`CURSOR_MEASURED_SHELL_TOOL_NAMES` equals `["Shell"]`;
  `ShellTool` is null): stay green, because the Cursor set is untouched.
- `tests/trigger/t159-fast-path.test.ts`, `tests/trigger/t170-match-keys.test.ts`, `tests/t243-audit-lows.test.ts`
  and `tests/setup-hooks.test.ts`: stay green, unchanged.
- `tests/pipelines/sync/retirements-live.test.ts` scans README.md. It stays green: the new text names no retired
  pattern.
- `tests/planner-hook/*` mention PowerShell, but they test a different module (`src/planner-hook/`), which is not
  touched.

**No other existing test changes.** Any other red row: STOP, `BLOCKED T-170-II-S2 <test name>`.

## Steps

1. PowerShell:
   `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t170ii3-reply.md")); "REPLY_PATH=$reply"`, then
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`; otherwise STOP).
2. Fresh clone into `(Join-Path $env:TEMP "t170ii3-wt")` unless the launcher named one.
   - `git checkout -q -b fix/t170-ii-powershell <base>`.
   - Check that `git rev-parse HEAD` equals the base, that `git status --porcelain` is empty, and that
     `git ls-tree --name-only HEAD docs/loops/t170-ii-powershell-admit-brief.md` prints the path.
   - `git merge-base --is-ancestor c382f0c956174409a69e75ed3d689a61857a21ec HEAD` must exit 0 (#794 is in the base).
     Otherwise STOP.
   - `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. On "Could not locate the bindings file",
     run `npm rebuild better-sqlite3` and say so.
   - **Forbidden:**
     - `git stash`, `reset --hard`, `--force`, rebase and amend;
     - `cd` into another checkout;
     - `npm run test:heavy`;
     - killing any process by name;
     - any read or write of `~/.claude/open-brain/`;
     - any edit of any real `settings.json`.
3. **Commit 1, `T-170-II-S2: rows for the PowerShell tool and its registration`:** the new test file only.
   `$env:NO_COLOR='1'`; in `open-brain`, run
   `npx vitest run tests/trigger/t170-ii-powershell.test.ts --no-file-parallelism --testTimeout=180000`.
   Exactly W1, W2, W3 and W6 must be red. Paste the summary and the `x` rows.
4. **Commit 2, `T-170-II-S2: the recall trigger admits Claude Code's PowerShell tool; README registers Bash|PowerShell (G-060)`:**
   rulings 1, 2 and 3.
   - Run `npx vitest run tests/trigger tests/t235-p2-5-cursor-recall.test.ts tests/t243-audit-lows.test.ts tests/setup-hooks.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`
     with a 20-minute wall-clock cap. All green. Paste the `Test Files` and `Tests` lines.
   - Then `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), and `npm run build` (exit 0).
5. Both commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline <base>..HEAD` shows 2 lines; `git status --porcelain` is empty.
6. **Mutants.** For each one:
   - Run the named file(s) with `--no-file-parallelism --testTimeout=180000`.
   - Paste the summary, the `x` rows and the mutant's `git diff` line.
   - Restore with `git checkout -- <file>` and check that `git status --porcelain` is empty. Never commit a mutant.

   The mutants:
   - **M1** `CLAUDE_CODE_MEASURED_SHELL_TOOL_NAMES = new Set<string>(["Bash"])`. File
     `tests/trigger/t170-ii-powershell.test.ts`. Expect **W1, W2 and W3** red.
   - **M2** The condition from ruling 1 becomes
     `  if (typeof toolName === "string" && [...CLAUDE_CODE_MEASURED_SHELL_TOOL_NAMES].some((n) => n.toLowerCase() === toolName.toLowerCase())) {`.
     File `tests/trigger/t170-ii-powershell.test.ts`. Expect **W4** red, and only W4.
   - **M3** `CLAUDE_CODE_MEASURED_SHELL_TOOL_NAMES = new Set<string>(["PowerShell"])`. File
     `tests/trigger/t170-ii-failure-event.test.ts`. Expect **F1, F2, F3, F4 and F6** red, and F5 green: every
     Bash row goes red, because Bash is now admitted only through this set; F5 reads README.md.
   - **M4** README.md: the `"PostToolUse":` line's matcher back to `"Bash"`. File
     `tests/trigger/t170-ii-powershell.test.ts`. Expect **W6** red.
7. **Step L, live, on the QA PC** (after commit 2 and `npm run build`; all scratch under `%TEMP%\t170ii3-live\`):
   - **(a) Store.** Seed a scratch store at `%TEMP%\t170ii3-live\store\knowledge-v2.db` through the clone's build, the
     way `seed()` does it (`build/db-v2.js` `initSchemaV2` + `indexKnowledge`): one entry with `A_CONTENT`. Then, with
     `KNOWLEDGE_V2_DB` set to that store, run `node build/cli.js trigger-keys`. Paste the `1 command key(s)` line.
   - **(b) Project.** Create a scratch project `%TEMP%\t170ii3-live\proj`. It is NOT a git repo. Its
     `.claude\settings.json` registers `node "<clone>/open-brain/build/cli-recall-trigger.js"` (forward slashes),
     timeout 10, on BOTH `PostToolUse` and `PostToolUseFailure`, each with matcher `Bash|PowerShell`. Register nothing
     else.
   - **(c) Run.** In that project, set `KNOWLEDGE_V2_DB` to the scratch store and `RECALL_TRIGGER_LOG` to
     `%TEMP%\t170ii3-live\log.txt`. Then run:
     `claude -p --model sonnet --setting-sources project --strict-mcp-config --no-session-persistence --allowedTools PowerShell "Use the PowerShell tool (not Bash) to run exactly this command once: git show nosuchref:src/a.ts . Then reply with every line of context you received after that command that contains the words stored knowledge, verbatim, or the single word NONE."`
     Paste its full output. If the PowerShell tool is not offered, paste the error and mark L `NOT RUN`.
   - **(d) Read back.** Paste the scratch store's `trigger_fires` rows (`state`, `query`, `injected_ids`). Paste
     `log.txt`, or say it does not exist.

   **What L decides:** expect `[stored knowledge 1` in the model's reply and one `injected` row. If the reply is
   `NONE` with an `injected` row, report that plainly: `READY` still stands, with the first line suffixed
   `L: NOT DELIVERED`. No base-build comparison is needed: the base returns null for `PowerShell` before any row.
8. `git diff --name-only <base>..HEAD` shows exactly these four files:
   - `README.md`
   - `open-brain/src/cli-recall-trigger.ts`
   - `open-brain/tests/trigger/t170-ii-failure-event.test.ts`
   - `open-brain/tests/trigger/t170-ii-powershell.test.ts`
9. Push and open the PR:
   - `git push origin fix/t170-ii-powershell` (never force). `git ls-remote origin refs/heads/fix/t170-ii-powershell`
     must equal `git rev-parse HEAD`. If the push is rejected, STOP.
   - `gh pr create --base master --head fix/t170-ii-powershell --title "T-170-II-S2 (G-060): the recall trigger admits Claude Code's PowerShell tool; README registers Bash|PowerShell" --body "Brief: docs/loops/t170-ii-powershell-admit-brief.md. The live settings.json matcher changes after the merge and rebuild, on Aaron's word."`.
   - `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T-170-II-S2 <sha40> PR #<n> L: <DELIVERED|NOT DELIVERED|NOT RUN>`, or
  `BLOCKED T-170-II-S2 <reason>`.
- **STOP rules:** at most 2 attempts at any one step, never "fix until green". A STOP still writes the reply.
- Then each command with its output. Every number is pasted output, with the command shown above it. Mark anything
  not run `NOT RUN`. Do not merge.
