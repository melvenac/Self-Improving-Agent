# T170-ERR: the recall trigger reads `MATCH: error:` keys on a failed shell call (T-170)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-170 part (ii), error keys (P1). **Tag:** `t170err`.
**Size:** MEDIUM (13 edits in 4 src files, 1 new test file). **Base:** the START sha the launcher names (a master that
contains this brief).

```text
IMPACT-TARGETS: runTrigger writeTriggerKeys matchingKeyIds readTriggerKeys
```

## Why

/end keys a lesson `MATCH: command|path|error|none`, and the trigger read only command keys. On 10-24 the live store held
30 lessons keyed `MATCH: error: "..."`; none could fire, although Claude Code hands a failed Bash or PowerShell call's
text to the hook as PostToolUseFailure's `error` field (measured, docs/loops/t170-ii/research-reply.md). With this
change the sidecar carries `errorKeys` beside `keys`; the hook matches them against `error`; `runTrigger` re-reads each
entry and re-tests it (a stale sidecar costs a miss, never a wrong injection), error keys before command keys, and the
fire's query gains `error-match:<ids>`. Seat filtering and once-per-session apply as for command keys.

## The change, exactly

Files under `docs/loops/t170-err/`.
- **`t170-error-keys.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/trigger/t170-error-keys.test.ts`.
  K1-K8.
- **`edits.txt`:** 13 edits in 4 files: `trigger/match-keys.ts` (parseErrorKey, errorMatchesKey, readTriggerErrorKeys,
  matchingErrorKeyIds, header comment), `trigger/keys-writer.ts` (errorKeys in the sidecar; returned counts unchanged),
  `cli-recall-trigger.ts` (match `error`; pass `error` and `errorKeyIds`, placed FIRST in the runTrigger call so the
  existing `policy, keyIds, seat })` text that T-313's S6 row pins is kept), `trigger/run.ts` (the error-key loop).

## Measured before dispatch

QA PC SIM `sim-t170err` (job #107) at `5f60762b`: every row and mutant matched except one existing row, ruled.
`tests/trigger/t313-seat.test.ts` S6 is a source-text row asserting `cli-recall-trigger.ts` contains
`policy, keyIds, seat })`; the SIM's edit appended `, error, errorKeyIds` after `seat`, so it went red. The edit now
puts `error, errorKeyIds` first (`runTrigger({ error, errorKeyIds, db: writeDb, ... keyIds, seat })`); checked to apply
and to keep the pinned text, not run. No file under `open-brain/` changed between `5f60762b` and this brief's base
except by merges that do not touch these 4 files.
- Baseline (the new test file, no source): `1 failed | 3 passed (4)` files, `7 failed | 36 passed (43)` tests; the red
  rows are K1-K7 (K8 green).
- Edit: `APPLIED 13 edits to 4 files`; both tsc runs and the build exit 0; K1-K8 green, S6 red (the ordering above);
  wide run `1 failed | 210 passed (211)`, S6 only, no Errors line. `module-boundary [pass]`.
- m1 (no re-test) K5; m2 (the hook ignores `error`) K7; m3 (no errorKeys written) K3 and K7; m4 (error keys never first)
  K6 (each plus S6, which the reordering removes).

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t313-seat.test.ts` S6 | stays green | The call keeps the literal `policy, keyIds, seat })`. |
| `t170-match-keys.test.ts` W1 | stays green | `writeTriggerKeys` still returns `{ written, unusable }` of command keys and `file.keys` is unchanged. Green in the SIM. |
| `t170-ii-failure-event.test.ts`, `t159-fast-path.test.ts`, the rest of `tests/trigger` | stay green | A payload with no `error`, or an error no key matches, takes the old path. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t170err <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in
files other than the four files below, with that error or a hook timeout: re-run each such file alone; green alone
means paste both runs and go on, red alone means STOP. A red row in the four files after step 4 is never an exception.

## Steps

"The four files" means, from `open-brain`:
`npx vitest run tests/trigger/t170-error-keys.test.ts tests/trigger/t170-match-keys.test.ts tests/trigger/t170-ii-failure-event.test.ts tests/trigger/t313-seat.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t170-error-keys`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T170-ERR: rows for error keys on a failed shell call`).
   - `Copy-Item docs/loops/t170-err/t170-error-keys.test.ts open-brain/tests/trigger/t170-error-keys.test.ts`.
   - Run the four files. Expect `1 failed | 3 passed (4)` files and `7 failed | 36 passed (43)` tests, the red rows
     K1-K7 in t170-error-keys.test.ts. Paste the summary and each `x` row.
4. **Commit 2** (`T170-ERR: the recall trigger reads MATCH: error: keys on a failed shell call (T-170)`).
   - `node docs/loops/t170-err/apply.cjs . docs/loops/t170-err/edits.txt` prints exactly `APPLIED 13 edits to 4 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the four files: `43 passed (43)`.
   - `npx vitest run tests/trigger tests/setup-hooks.test.ts tests/t235-p2-5-cursor-recall.test.ts tests/t294-small-fixes.test.ts tests/t243-audit-lows.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m4: `node docs/loops/t170-err/apply.cjs . docs/loops/t170-err/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the four files; paste the `Tests` line and the `x` rows (expected: m1 -> K5
   only; m2 -> K7 only; m3 -> K3 and K7; m4 -> K6 only); restore with `git checkout -- open-brain/src` (this returns to
   commit 2) and check the status is empty. After m4, run the four files once more: `43 passed (43)`. Never commit a
   mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 5 paths: `M open-brain/src/cli-recall-trigger.ts`,
   `M open-brain/src/trigger/keys-writer.ts`, `M open-brain/src/trigger/match-keys.ts`, `M open-brain/src/trigger/run.ts`,
   `A open-brain/tests/trigger/t170-error-keys.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t170-error-keys` must equal HEAD.
   `gh pr create --base master --head feat/t170-error-keys --title "T170-ERR: the recall trigger reads MATCH: error: keys on a failed shell call (T-170)" --body "Brief: docs/loops/t170-err-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t170err <sha40> PR #<n>` or `BLOCKED t170err <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`, then the sidecar is rewritten at the next /end (or `open-brain trigger-keys`). Live check: the sidecar
`~/.claude/open-brain/recall-trigger-keys.json` carries `errorKeys` (30 expected), and a failing PowerShell call with a
`Variable reference is not valid` parse error injects knowledge 659 (`error-match:659` in trigger_fires).
