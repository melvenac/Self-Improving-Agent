# T170P: the recall trigger reads `MATCH: path:` keys on an Edit or Write call (T-170 part iii)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 174. **Task:** T-170 part (iii) (P1). **Tag:** `t170p`. **Size:** MEDIUM
(20 edits in 4 src files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this
brief). **Authority:** Aaron at the planner's desk, 2026-10-26: "Build the path matcher".

```text
IMPACT-TARGETS: writeTriggerKeys runTrigger shellCommandFromHookPayload matchingErrorKeyIds
```

## Why

/end keys a lesson `MATCH: command|path|error|none`. Command keys and error keys (#983) fire; path keys were "stored and
unread", and the hook returned before any lookup for a tool that is not a shell. 50 live lessons carry a path key (46
usable under this parse rule). The hook is already registered on PostToolUse `Edit|Write` (clark, 10-26), so this
change is what makes those lessons reachable. An Edit or Write whose file matches no key leaves nothing behind.

## The change, exactly

Files under `docs/loops/t170p/`.
- **`t170-iii-path-keys.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/trigger/t170-iii-path-keys.test.ts`. P1-P9.
- **`edits.txt`:** 20 edits in 4 files: `trigger/match-keys.ts` (`parsePathKey`, `pathMatchesKey`,
  `readTriggerPathKeys`, `matchingPathKeyIds`, the header line), `trigger/keys-writer.ts` (`pathKeys` in the sidecar;
  counts unchanged), `trigger/run.ts` (`filePath`/`pathKeyIds` inputs; no bm25 query for a file event; the path-key
  re-test loop after error keys; `path-match:` in the query), `cli-recall-trigger.ts` (`CLAUDE_CODE_FILE_TOOL_NAMES`,
  `filePathFromHookPayload`, the early return for an unmatched file event, the new `runTrigger` arguments placed first
  so T-313 S6's pinned `policy, keyIds, seat })` text survives).

## Measured before dispatch

QA PC SIM `sim-t170p` (job #126) at `e3de944a`: ALL PASS, every prediction held.
- Baseline (the new test file, no source): five files `1 failed | 4 passed (5)`, `8 failed | 50 passed (58)`; red P1-P8,
  P9 green (a guard).
- Edit: `APPLIED 20 edits to 4 files`; both tsc runs and the build exit 0; five files `58 passed (58)`.
- Wide run (`tests/trigger` + the five extra files + `tests/planner-hook`): `36 passed (36)` files, `1336 passed (1336)`.
  `module-boundary [pass]`.
- m1 (the hook never reads a file event) P8; m2 (no segment boundary) P2; m3 (no re-test) P7; m4 (an unmatched file
  event falls through) P9; m5 (no pathKeys written) P5 and P8.
- `deriveQuery("Edit C:\repo\convex\http.ts")` and `deriveQuery("Write C:/repo/convex/stripe.ts")` both return `""`.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `trigger/hook.test.ts` "ignores a tool that is not Bash" (`Read`) | stays green | `Read` is not a file tool here. Green in the SIM. |
| `trigger/t170-match-keys.test.ts` W1 (`MATCH: path:` content, counts `{written:1, unusable:1}`) | stays green | Counts stay the command keys'; W1 checks `keys` only. Green in the SIM. |
| `trigger/t170-error-keys.test.ts`, `t313-seat.test.ts`, `t159-fast-path.test.ts` | stay green | Shell paths unchanged. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t170p <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the five files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the five files after step 4 is never an exception: re-run
the five files once; if the row is green on that run AND the row is a timeout (not an assertion), paste both and go
on, else STOP.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/trigger/t170-iii-path-keys.test.ts tests/trigger/t170-error-keys.test.ts tests/trigger/t170-match-keys.test.ts tests/trigger/hook.test.ts tests/trigger/t313-seat.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t170p-path-keys`. HEAD must equal START and the porcelain
   must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard,
   force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`, any
   MCP config, and anything under `docs/`.
3. **Commit 1** (`T170P: rows for path keys on an Edit or Write call`).
   - `Copy-Item docs/loops/t170p/t170-iii-path-keys.test.ts open-brain/tests/trigger/t170-iii-path-keys.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `8 failed | 50 passed (58)` tests, the red rows P1-P8
     in t170-iii-path-keys.test.ts. Paste the summary and each `x` row.
4. **Commit 2** (`T170P: the recall trigger reads MATCH: path: keys on an Edit or Write call (T-170 part iii)`).
   - `node docs/loops/t170p/apply.cjs . docs/loops/t170p/edits.txt` prints exactly `APPLIED 20 edits to 4 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the five files: `58 passed (58)`.
   - `npx vitest run tests/pipelines tests/trigger tests/server.test.ts tests/setup-hooks.test.ts tests/t235-p2-5-cursor-recall.test.ts tests/t294-small-fixes.test.ts tests/t243-audit-lows.test.ts tests/planner-hook --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute default;
     if your tool cannot hold 40 minutes, run it in the background logging to a file and wait for it). Expect 0 failed.
     Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m5: `node docs/loops/t170p/apply.cjs . docs/loops/t170p/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run
   `npx vitest run tests/trigger/t170-iii-path-keys.test.ts --no-file-parallelism --testTimeout=180000`; paste the
   `Tests` line and the `x` rows (expected: m1 -> P8; m2 -> P2; m3 -> P7; m4 -> P9; m5 -> P5 and P8); restore with
   `git checkout -- open-brain/src` (this returns to commit 2) and check the status is empty. After m5, run the five
   files once more: `58 passed (58)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 5 paths:
   `M open-brain/src/cli-recall-trigger.ts`, `M open-brain/src/trigger/keys-writer.ts`,
   `M open-brain/src/trigger/match-keys.ts`, `M open-brain/src/trigger/run.ts`,
   `A open-brain/tests/trigger/t170-iii-path-keys.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t170p-path-keys` must equal HEAD.
   `gh pr create --base master --head feat/t170p-path-keys --title "T170P: the recall trigger reads MATCH: path: keys on an Edit or Write call (T-170 part iii)" --body "Brief: docs/loops/t170p-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t170p <sha40> PR #<n>` or `BLOCKED t170p <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`, then `node <main>/open-brain/build/cli.js trigger-keys` (the sidecar gains `pathKeys`, expect about 46).
Live check: an Edit to a file under a keyed path (e.g. a `docs/loops/*brief*.md` file) injects that lesson once per
session; an Edit elsewhere leaves no `trigger_fires` row.
