# T-184: `state import --commit` notices an input that changed after `--draft`

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key). Code only. Overnight-safe: ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t184-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-184 (P2). **Tag:** `T-184`. **Size:** SMALL.
**Base:** `10034c5a0328c6a2e44057290ff66ea0edcd4121` (origin/master code; later master commits are docs/records only).
If clark re-pins it at launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: runDraft runCommit (callers: src/cli.ts state import; covered by tests/pipelines/state-import*.test.ts, import-cmds-*.test.ts, bootstrap-fix*.test.ts)
```

## Why

QA 102 PROBE-7: edit an input (`INBOX.md`, `task.md`, `next-session.md`, `SUMMARY.md`, `DECISIONS.md`) after
`--draft`, and `--commit` commits the DRAFT's old content with no word. The staleness check (T-180) judges
session numbers, not bytes, so a fix made after the draft passes silently.

## Ruling (exact names)

All in `open-brain/src/pipelines/state-import/index.ts` unless stated.

1. Constants, next to `DRAFT_REL` / `REPORT_REL` (lines 38-39):
   `export const DRAFT_INPUTS_REL = ".agents/state.draft.inputs.json";` and, next to `ACCEPT_STALE_FLAG` (line 876),
   `export const ACCEPT_CHANGED_FLAG = "--accept-changed";`.
2. `export function hashInputs(root: string): Record<string, string | null>`: for each value of `INPUT_REL` (in key
   order), the key is that relative path and the value is the sha256 hex of `readFileSync(join(root, rel))` (raw
   bytes), or `null` when the file does not exist. Import `createHash` from `node:crypto` if not imported.
3. `runDraft`: after writing the draft and the report, write `DRAFT_INPUTS_REL` as
   `JSON.stringify({ inputs: hashInputs(root) }, null, 2) + "\n"`.
4. `runCommit`: add `acceptChanged?: boolean` to its `opts`. Directly after the `revision !== 0` check and BEFORE
   step 0 (so nothing is written on refusal):
   - read `DRAFT_INPUTS_REL`. If it is missing or does not parse as `{ inputs: Record<string, string|null> }`, set
     `changed = []` and `inputs_unrecorded = true` (no refusal: drafts made before this change, and tests that write
     a draft by hand, have no record).
   - otherwise compare with `hashInputs(root)`; `changed` lists, in `INPUT_REL` order, `"<rel> changed"`,
     `"<rel> added"` (null then, present now) or `"<rel> removed"` (present then, null now).
   - if `changed.length > 0 && opts.acceptChanged !== true`: throw
     `` `${changed.length} input(s) changed since --draft: ${changed.join("; ")}. The draft holds their OLD content. Nothing written. Re-run --draft and review it again, or pass ${ACCEPT_CHANGED_FLAG} to commit the draft as it stands` ``.
5. `CommitResult` gains `accepted_changed: string[]` (the `changed` list when committed under the flag, else `[]`)
   and `inputs_unrecorded: boolean`; return both.
6. Step 5 (the move into the snapshot, line ~1148): move `DRAFT_INPUTS_REL` too: the loop becomes
   `for (const rel of [DRAFT_REL, REPORT_REL, DRAFT_INPUTS_REL])`.
7. `src/cli.ts`:
   - import `ACCEPT_CHANGED_FLAG`; add it to `importFlags` (line ~602);
   - after the `ACCEPT_STALE_FLAG`-without-commit refusal (line ~638), the same refusal for `ACCEPT_CHANGED_FLAG`:
     `` `state import refused: ${ACCEPT_CHANGED_FLAG} applies only to --commit. Nothing written.` ``;
   - pass `acceptChanged: args.includes(ACCEPT_CHANGED_FLAG)` to `runCommit`;
   - after the two `Imported … under ACCEPT_STALE_FLAG` lines print
     `` `Committed the draft over CHANGED inputs under ${ACCEPT_CHANGED_FLAG}: ${r.accepted_changed.join("; ")}` `` when
     non-empty, and `` `No input record for this draft (${DRAFT_INPUTS_REL}): whether an input changed since --draft was not checked` ``
     when `r.inputs_unrecorded`;
   - both usage strings (line ~452 and ~727): `--commit [--accept-stale] [--accept-changed]`.
   No other file under `src/` changes.

## Existing tests (planner-read)

24 test files call `runCommit` or `--commit`; 6 touch the draft file. The planner did not read all 24 row by row,
so step 3 below makes the run itself find them. Expected: a test that writes the draft by hand stays green (no
record, no refusal). A test that runs `--draft`, then EDITS an input, then commits, now refuses, which is this
task's intended behaviour.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t184-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. Fresh clone `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t184-wt")`,
   `Set-Location` into it, `git checkout -q -b fix/t184-draft-inputs 10034c5a0328c6a2e44057290ff66ea0edcd4121`.
   `git rev-parse HEAD` must print that SHA, `git status --porcelain` empty, else STOP, BLOCKED. `npm ci` in `open-brain`.
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout.
3. **Base run** (in `open-brain`, 30-minute cap, paste the summary line and every failing row name):
   `npx vitest run tests/pipelines/state-import tests/pipelines/import-cmds tests/pipelines/bootstrap-fix --no-file-parallelism --testTimeout=180000`
   (vitest treats these as name filters: they select the 33 files whose paths start with them).
4. **Commit 1, `T-184: tests (red)`.** New file `open-brain/tests/pipelines/state-import-t184.test.ts`. Copy the temp
   project fixture from `tests/pipelines/state-import-t248.test.ts` (whatever it uses to build a minimal `.agents/`
   that `runDraft` accepts). Import from `../../src/pipelines/state-import/index.js` as a namespace
   (`import * as imp from …`) so missing exports fail rows, not the file. Rows:
   - **D1:** `runDraft` writes `.agents/state.draft.inputs.json`, and its `inputs` has exactly the five `INPUT_REL`
     paths, each a 64-char hex string or null.
   - **D2:** draft, then append `"\n- [ ] new\n"` to `.agents/TASKS/INBOX.md`, then `runCommit` throws an error that
     contains `.agents/TASKS/INBOX.md changed` and `Nothing written`, and `.agents/state.json` does not exist.
   - **D3:** the same, with `{ acceptChanged: true }`: commits, `accepted_changed` is `[".agents/TASKS/INBOX.md changed"]`,
     `state.json` exists.
   - **D4:** draft, commit with no edit: `accepted_changed` is `[]`, `inputs_unrecorded` is `false`, and the snapshot
     directory holds `state.draft.inputs.json`.
   - **D5:** draft, delete `.agents/state.draft.inputs.json`, commit: succeeds, `inputs_unrecorded` is `true`.
   - **D6:** draft, delete `.agents/SYSTEM/DECISIONS.md` (create it first in the fixture if it has none), commit throws
     with `.agents/SYSTEM/DECISIONS.md removed`.
   - **D7 (CLI):** spawn the CLI as `tests/pipelines/state-import-t248.test.ts` does, with
     `state import --draft --accept-changed <dir>`: exit 1, stderr contains `--accept-changed applies only to --commit`.
   Run the file: D1-D7 red (D5 may pass at base). Paste it.
5. **Commit 2, `T-184: --commit refuses when an input changed after --draft, unless --accept-changed`:** the ruling.
6. End both messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Afterwards
   `git log --oneline 10034c5a..HEAD` shows 2 lines (3 if step 8 applies) and `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t184 file, then step 3's command again (30-minute cap).
8. **Existing rows that newly fail.** For each existing row red in step 7 and green in step 3, read it. If it runs
   `--draft`, then EDITS one of the five inputs, then commits, it now meets the intended refusal: in that row ONLY,
   add `acceptChanged: true` to its `runCommit` options (or `--accept-changed` to its CLI args). Change nothing else
   in it, and commit all of them as ONE commit `T-184: rows that edit an input after --draft now pass --accept-changed`.
   List each such row with the input it edits. Any other newly failing row: STOP, `BLOCKED T-184 <row>`.
9. **Mutants** (edit, run the t184 file only, paste, `git checkout -- <file>`, confirm a clean tree; never commit):
   - M1: in `runCommit`, compare against an empty record (treat every input as unrecorded) → D2 and D6 red.
   - M2: drop `DRAFT_INPUTS_REL` from the step 5 loop → D4 red.
   - M3: remove the `ACCEPT_CHANGED_FLAG` refusal in `cli.ts` → D7 red.
10. `git diff --name-only 10034c5a..HEAD` must show `open-brain/src/cli.ts`,
    `open-brain/src/pipelines/state-import/index.ts`, `open-brain/tests/pipelines/state-import-t184.test.ts`, plus only
    the test files step 8 edited. Anything else: STOP, BLOCKED.
11. `git push origin fix/t184-draft-inputs` (never force). `git ls-remote origin refs/heads/fix/t184-draft-inputs` must
    equal `git rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t184-draft-inputs --title "T-184: --commit refuses when an input changed after --draft" --body "Brief: docs/loops/t184-draft-inputs-brief.md."`.
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Known red on the desktop

`tests/cli-flags*.test.ts` R185-8 and `tests/harness/config-channel.test.ts` CA-4c are environmental; do not run them.
Do not run the full suite. Anything red in step 3 at base is pre-existing: list it, do not fix it.

## Reply

The first line is `READY T-184 <sha40> PR #<n>` or `BLOCKED T-184 <reason>`. Then each command with its output: the
base run, the red run, tsc, the t184 run, the second wide run, step 8's list (or "none"), the mutants, the name-only
diff, `ls-remote` = `rev-parse`, the PR URL and CI. At most 2 attempts at a red. Mark anything not run `NOT RUN`.
Do not merge.
