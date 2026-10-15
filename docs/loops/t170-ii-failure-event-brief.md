# T-170 part (ii) step 1 (G-059): the recall trigger answers on PostToolUseFailure

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t170ii1-reply.md. A reply path in
the launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-15, session 172. **Task:** T-170 (P1), part (ii) step 1; gap G-059. **Tag:**
`T-170-II-S1`. **Size:** SMALL. **Base:** the dispatch SHA clark names (a master that contains this brief).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: main (open-brain/src/cli-recall-trigger.ts, the script entry: one output line changes; the new outputHookEventName has no callers yet)
```

## Why

`docs/loops/t170-ii/research-reply.md` (A1, OBSERVED on the QA PC) found that a Bash call that exits non-zero fires
`PostToolUseFailure` and **no** `PostToolUse`. The trigger is registered on `PostToolUse` with matcher `Bash` (README.md,
"Register the hooks"; the live `~/.claude/settings.json` has the same entry), so it never runs on a failing command.
The planner confirmed this on the desktop in production: in session 990a713e, 29 of 30 Bash calls have a
`trigger_fires` row, and the missing one is the only call that exited 1. Command keys and the element path are blind
to every failing command (G-059).

Two parts close it. The code must answer the event it was called on: `cli-recall-trigger.ts:226` hard-codes
`hookEventName: "PostToolUse"`. The registration must name the event. The README is the registration's documentation
(setup.mjs does not register the trigger for Claude Code). **The live `~/.claude/settings.json` is NOT changed by this
run.** It changes after the merge, on Aaron's word.

The failure payload carries the same `tool_name`/`tool_input` as PostToolUse (docs: code.claude.com/docs/en/hooks,
PostToolUseFailure), so `shellCommandFromHookPayload` needs no change. Step L observes this live rather than trusting
the docs.

## Ruling (exact)

1. `open-brain/src/cli-recall-trigger.ts`: directly below `shellCommandFromHookPayload`, add
   ```ts
   /**
    * The event name to answer with (G-059). Claude Code fires PostToolUseFailure, not PostToolUse, for a Bash call
    * that exits non-zero; the answer names the event it was called on. Anything else, including Cursor's
    * `postToolUse`, keeps the PostToolUse answer it has always had.
    */
   export function outputHookEventName(payload: Record<string, unknown>): "PostToolUse" | "PostToolUseFailure" {
     return payload.hook_event_name === "PostToolUseFailure" ? "PostToolUseFailure" : "PostToolUse";
   }
   ```
   In `main`, the emitted object's `hookEventName: "PostToolUse",` becomes `hookEventName: outputHookEventName(payload),`.
   Nothing else in src changes.
2. `README.md`, section "**2. Register the hooks**":
   - In the jsonc block, after the `"PostToolUse":` line, add one line with the same command and timeout:
     `    "PostToolUseFailure": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "node \"/abs/path/to/open-brain/build/cli-recall-trigger.js\"", "timeout": 10 }] }]`.
     Put a comma at the end of the `"PostToolUse":` line so the block stays valid jsonc.
   - In the sentence before the block, `` `PostToolUse`, the recall trigger, is not registered by `setup.mjs`; add it by hand: ``
     becomes `` `PostToolUse` and `PostToolUseFailure`, the recall trigger, are not registered by `setup.mjs`; add them by hand: ``.
   - Add a bullet directly after the "**`PostToolUse`, not `PreToolUse`, ...**" bullet:
     `` - **`PostToolUseFailure` as well (G-059).** A Bash call that exits non-zero fires `PostToolUseFailure` and no `PostToolUse`, so without this entry the trigger never sees a failing command. It cannot block either: the tool has already failed. ``

## Rows (commit 1: new file `open-brain/tests/trigger/t170-ii-failure-event.test.ts`)

Copy the harness from `tests/trigger/t170-match-keys.test.ts`: the imports, `ROOT`, `HOOK`, `TSX_CLI`, `SPAWN_TIMEOUT`,
`A_CONTENT`, the `mkdtemp` `beforeEach`/`afterEach`, `seed`, and describe H's `runHook` and `pendingLines`. Import
`writeTriggerKeys` and `triggerKeysPath` statically. **Do NOT import `cli-recall-trigger` in this file.** It calls
`main()` at module load (its last lines), so every row here goes through the spawned hook.

`fail(command, session)` = `{ session_id: session, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash',
tool_input: { command }, error: 'Exit code 128\nfatal: invalid object name', is_interrupt: false, duration_ms: 12 }`.

- **F1** Seed `{ a: A_CONTENT }` and write the sidecar with `writeTriggerKeys(db, triggerKeysPath(dbPath))`. Run the
  hook on `fail('git show nosuchref:src/a.ts', 'f1')` with `KNOWLEDGE_V2_DB` and `RECALL_TRIGGER_LOG` in the temp dir.
  Expect exit 0, `hookSpecificOutput.hookEventName === 'PostToolUseFailure'`, and `additionalContext` containing
  `[stored knowledge ${A}`.
- **F2** The same as F1, but with `hook_event_name: 'PostToolUse'` and no `error`/`is_interrupt`. Expect
  `hookEventName === 'PostToolUse'`.
- **F4** No sidecar, seed `{ a: A_CONTENT }`, `fail('ls -la', 'f4')`. Expect exit 0, stdout `''`, and
  `pendingLines(dbPath)` length 1 (the T-159 fast path holds on the failure event).
- **F5** Read `README.md` at `path.join(REPO, 'README.md')`, with `\r\n` turned into `\n`. Let `h` = the index of
  `**2. Register the hooks**`, `o` = the index of "```jsonc" searched from `h`, and `c` = the index of "\n```" searched
  from `o + 1`. All three must be `>= 0`. The slice `o..c` contains `"PostToolUseFailure": [{ "matcher": "Bash"`, and
  the line holding it also contains `cli-recall-trigger.js`.
- **F3** The same as F1, but with `hook_event_name: 'postToolUseFailure'` (lower-case p). Expect
  `hookEventName === 'PostToolUse'`.
- **F6** The same as F1, but with the `hook_event_name` key deleted from the payload. Expect
  `hookEventName === 'PostToolUse'`.

**Expected at commit 1 (the base):** F1 and F5 RED; F2, F3, F4 and F6 green (the base answers PostToolUse to
everything, and its fast path does not look at the event).

## Existing tests (verdicts)

The planner's grep of `hookEventName` and `hook_event_name` under `open-brain/tests` at eb737de9 found these:

- `tests/trigger/hook.test.ts:161`: a `PostToolUse` payload (line 78) expects `hookEventName` `'PostToolUse'`.
  Stays green.
- `tests/t235-p2-5-cursor-recall.test.ts:80`: a Cursor `postToolUse` payload (line 39) expects `'PostToolUse'`.
  Stays green: the rule matches `PostToolUseFailure` exactly, case included.
- `tests/trigger/t159-fast-path.test.ts` (payloads at lines 41 and 47) and `tests/trigger/t170-match-keys.test.ts` stay
  green unchanged.

**No existing test changes.** Any other red row: STOP, `BLOCKED T-170-II-S1 <test name>`.

## Steps

1. PowerShell:
   `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t170ii1-reply.md")); "REPLY_PATH=$reply"`, then
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`; otherwise STOP).
2. Fresh clone into `(Join-Path $env:TEMP "t170ii1-wt")` unless the launcher named one.
   - `git checkout -q -b fix/t170-ii-failure-event <base>`.
   - Check that `rev-parse HEAD` equals the base, that porcelain is empty, and that
     `git ls-tree --name-only HEAD docs/loops/t170-ii-failure-event-brief.md` prints the path.
   - `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. On "Could not locate the bindings file",
     run `npm rebuild better-sqlite3` and say so.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into another checkout,
     `npm run test:heavy`, killing any process by name, any read or write of `~/.claude/open-brain/`, and any edit of
     any real `settings.json`.
3. **Commit 1, `T-170-II-S1: rows for the PostToolUseFailure answer and registration`:** the new test file only.
   `$env:NO_COLOR='1'`; in `open-brain`, run
   `npx vitest run tests/trigger/t170-ii-failure-event.test.ts --no-file-parallelism --testTimeout=180000`.
   Exactly F1 and F5 must be red.
4. **Commit 2, `T-170-II-S1: the recall trigger answers PostToolUseFailure, and the README registers it (G-059)`:**
   rulings 1 and 2.
   - Run `npx vitest run tests/trigger tests/t235-p2-5-cursor-recall.test.ts tests/t243-audit-lows.test.ts tests/setup-hooks.test.ts --no-file-parallelism --testTimeout=180000`:
     all green.
   - Then `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), and `npm run build` (exit 0).
5. Both commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline <base>..HEAD` shows 2 lines; porcelain is empty.
6. **Mutants.** For each one:
   - Run `npx vitest run tests/trigger/t170-ii-failure-event.test.ts --no-file-parallelism --testTimeout=180000`.
   - Paste the summary, the `x` rows and the mutant's `git diff` line.
   - Restore with `git checkout -- <file>`. Never commit a mutant.

   The mutants:
   - **M1** `main`'s line back to `hookEventName: "PostToolUse",`. Expect **F1** red.
   - **M2** `outputHookEventName` body →
     `return typeof payload.hook_event_name === "string" ? (payload.hook_event_name as "PostToolUse") : "PostToolUse";`.
     Expect **F3** red (F1, F2 and F6 green).
   - **M3** `outputHookEventName` body →
     `return payload.hook_event_name === "PostToolUse" ? "PostToolUse" : "PostToolUseFailure";`.
     Expect **F6** red (and F3).
   - **M4** README: delete the added `"PostToolUseFailure"` line. Expect **F5** red.
7. **Step L, live, on the QA PC** (after commit 2 and `npm run build`; all scratch under `%TEMP%\t170ii1-live\`):
   - **(a) Store.** Seed a scratch store at `%TEMP%\t170ii1-live\store\knowledge-v2.db` through the clone's build, the
     way `seed()` does it (`build/db-v2.js` `initSchemaV2` + `indexKnowledge`): one entry with `A_CONTENT`. Then run
     `node build/cli.js trigger-keys` with `KNOWLEDGE_V2_DB` set to that store. Paste the
     `1 command key(s)` line.
   - **(b) Project.** Create a scratch project `%TEMP%\t170ii1-live\proj`. It is NOT a git repo. Its
     `.claude\settings.json` registers
     `node "<clone>/open-brain/build/cli-recall-trigger.js"` (forward slashes) on `PostToolUseFailure`, matcher `Bash`,
     timeout 10. Register nothing else.
   - **(c) Run.** In that project, with `KNOWLEDGE_V2_DB` set to the scratch store and `RECALL_TRIGGER_LOG` set to
     `%TEMP%\t170ii1-live\log.txt`, run:
     `claude -p --model sonnet --setting-sources project --strict-mcp-config --no-session-persistence --permission-mode bypassPermissions "Run exactly this Bash command once: git show nosuchref:src/a.ts . Then reply with every line of context you received after that command that contains the words stored knowledge, verbatim, or the single word NONE."`.
     Paste its full output.
   - **(d) Read back.** Paste the scratch store's `trigger_fires` rows (`state`, `query`, `injected_ids`). Paste
     `log.txt`, or say it does not exist.
   - **(e) Base build.** Repeat (a) to (d) with the hook pointing at a build of the BASE: a second fresh clone into
     `(Join-Path $env:TEMP "t170ii1-base")`, checked out at the base, then `npm ci` and `npm run build` in its
     `open-brain`. Use fresh scratch `store2`, `log2.txt` and `proj2`. Report both results side by side.

   **What L decides:**
   - **Head:** expect `[stored knowledge 1` in the model's reply and one `injected` row. If the head shows `NONE` with
     an `injected` row, `additionalContext` on PostToolUseFailure does not reach the model. Report that plainly:
     `READY` still stands, with the first line suffixed `L: NOT DELIVERED`.
   - **Base:** report what it shows. It decides whether ruling 1 is required or only tidy, and is not a STOP either way.
8. `git diff --name-only <base>..HEAD` shows exactly `README.md`, `open-brain/src/cli-recall-trigger.ts` and
   `open-brain/tests/trigger/t170-ii-failure-event.test.ts`.
9. Push and open the PR:
   - `git push origin fix/t170-ii-failure-event` (never force). `ls-remote` must equal `rev-parse HEAD`.
   - `gh pr create --base master --head fix/t170-ii-failure-event --title "T-170-II-S1 (G-059): the recall trigger answers PostToolUseFailure; README registers it" --body "Brief: docs/loops/t170-ii-failure-event-brief.md. Live settings.json registration follows the merge, on Aaron's word."`.
   - `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T-170-II-S1 <sha40> PR #<n> L: <DELIVERED|NOT DELIVERED> base: <DELIVERED|NOT DELIVERED>`
  or `BLOCKED T-170-II-S1 <reason>`.
- **STOP rules:** at most 2 attempts at any one step, never "fix until green". A STOP still writes the reply.
- Then each command with its output. Mark anything not run `NOT RUN`. Do not merge.
