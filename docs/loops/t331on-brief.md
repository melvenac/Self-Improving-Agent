# T331-ON: turn the recall trigger's withheld arm on at 0.5 (T-331)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-01, session 175. **Task:** T-331. **Tag:** `t331on`. **Size:** SMALL (one policy
value, one test setup block, two test-line edits; no src code). **Base:** the START sha the launcher names (a master
that contains this brief). **Authority:** Aaron, 11-01, AskUserQuestion in clark's window: "Yes, turn it on
(Recommended)". He named no value; 0.5 is the research figure. Merge on Atlas's QA ACCEPT, sent to clark.

```text
IMPACT-TARGETS: loadPolicy (trigger/policy.ts), runTrigger (trigger/run.ts) - behaviour only; no src code changes
```

## What changes

`docs/loops/t331on/build-edits.txt`, 5 edits in 4 files:

- **`open-brain/src/trigger/policies/recall-trigger.json`:** `withhold_fraction` 0 -> 0.5. About half of all would-be
  injections are now withheld, drawn by `withholdDraw(sessionUuid, ids)` and logged as silent fires carrying
  `withheld:<ids>`. The schema file does not change: a value is not a schema change.
- **`open-brain/tests/trigger/t331-withheld-arm.test.ts`:** W3 is re-pinned from 0 to 0.5 (title and assertion).
- **`open-brain/tests/setup-env.ts`:** writes the shipped policy with `withhold_fraction: 0` to a temp dir and sets
  `TRIGGER_POLICY_DIR` to it. The hook CLI reads that variable before the shipped file
  (`cli-recall-trigger.ts:224`), so every spawned hook in the suite has the arm OFF. In-process `loadPolicy()` ignores
  the variable, so W3 still reads 0.5, and a test that passes its own `TRIGGER_POLICY_DIR` (hook.test.ts:192, :289) still
  wins.
- **`open-brain/tests/trigger/no-network.test.ts`:** A11 calls `runTrigger` in-process with `loadPolicy()`; it now
  spreads `withhold_fraction: 0` (its session draws 0.1836, below 0.5).

## Existing tests that pin this behaviour (measured by SIM job 613, docs/loops/t331on-sim.md)

With only the policy and W3 edits, 11 rows in 6 files went red, every one a session whose draw is below 0.5. Each
stayed red when its file was rerun alone, and nothing else in the full suite went red:

| file | rows | how it reads the policy | fixed by |
|---|---|---|---|
| tests/t235-p2-5-cursor-recall.test.ts | 2 | spawns the hook | setup-env |
| tests/trigger/hook.test.ts | 4 (A5 x3, A6) | spawns the hook | setup-env |
| tests/trigger/t170-error-keys.test.ts | 1 (K7) | spawns the hook | setup-env |
| tests/trigger/t170-ii-powershell.test.ts | 2 (W1, W2) | spawns the hook | setup-env |
| tests/trigger/t170-match-keys.test.ts | 1 (H1) | spawns the hook | setup-env |
| tests/trigger/no-network.test.ts | 1 (A11) | in-process loadPolicy() | the no-network edit |

Every one of these spawns passes `{ ...process.env, ... }`, so the variable reaches it. Rows were green on master at
fraction 0, so the predicted result is all green.

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b build/t331on`. HEAD must equal START and the porcelain must
   be empty. In `open-brain`: `npm ci` (exit code). Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/`, `scripts/setup.mjs`, `git config` writes, any MCP config,
     `npm install`, hand-editing the schema file, and anything under `docs/`.
3. **Apply.** `node docs/loops/t331on/apply.cjs . docs/loops/t331on/build-edits.txt` must print exactly
   `APPLIED 5 edits to 4 files`. In `open-brain`: `npx tsc --noEmit` (exit 0),
   `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build` (exit 0).
4. **Schema unchanged.** In `open-brain`: `npx tsx src/trigger/write-schema.ts` (paste its line); from the clone root
   `git diff --exit-code open-brain/src/trigger/policies/recall-trigger.schema.json` must exit 0. Not 0: STOP,
   `BLOCKED t331on schema`, paste the diff.
5. **The 6 files.** In `open-brain`:
   `npx vitest run tests/t235-p2-5-cursor-recall.test.ts tests/trigger/hook.test.ts tests/trigger/t170-error-keys.test.ts tests/trigger/t170-ii-powershell.test.ts tests/trigger/t170-match-keys.test.ts tests/trigger/no-network.test.ts tests/trigger/t331-withheld-arm.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect 0 failed. Paste `Test Files` and `Tests`.
6. **Mutants**, each on the applied tree.
   - Back up once: `Copy-Item open-brain/tests/setup-env.ts "$env:TEMP\t331on-setup.bak" -Force` and
     `Copy-Item open-brain/tests/trigger/no-network.test.ts "$env:TEMP\t331on-nonet.bak" -Force`.
   - **m1** (`docs/loops/t331on/m1.txt`, drops the variable): must print `APPLIED 1 edits to 1 files`; tsc -p
     tsconfig.tests.json exit 0; run the step-5 command. Predicted: `Tests 10 failed`, the 10 spawned-hook rows in the
     table (2 t235, 4 hook, 1 K7, 2 powershell, 1 H1), and A11 green. Restore setup-env.ts from its backup.
   - **m2** (`docs/loops/t331on/m2.txt`, drops the no-network pin): same checks. Predicted: `Tests 1 failed`, A11 only.
     Restore no-network.test.ts from its backup.
   - Restore with Copy-Item, never git checkout. After both restores, rerun step 5: 0 failed.
   - Red rows that differ from a prediction: STOP, `BLOCKED t331on <m> <rows>`, with each row's assertion message.
7. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap).
   Expect 0 failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook timeout
   is rerun alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and any `Errors` line. **If an
   `Errors` line appears, paste the whole `Unhandled Errors` section verbatim** (the SIM saw `Errors 1 error` and lost
   its text). An Errors line alone is not a STOP; report it.
8. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`.
   Paste every line; both must be `[pass]`.
9. **Commit.** One commit, `T331: turn the recall trigger's withheld arm on at 0.5 (T-331)`.
   - Stage exactly the 4 paths: `open-brain/src/trigger/policies/recall-trigger.json`, `open-brain/tests/setup-env.ts`,
     `open-brain/tests/trigger/no-network.test.ts` and `open-brain/tests/trigger/t331-withheld-arm.test.ts`.
   - The message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <START>..HEAD` shows 1 line and the status is empty (if anything else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows exactly those 4 paths, each `M`.
10. **Push and open the PR.**
    - Push, never force. `git ls-remote origin refs/heads/build/t331on` must equal HEAD.
    - `gh pr create --base master --head build/t331on --title "T331: turn the recall trigger's withheld arm on at 0.5 (T-331)" --body "Brief: docs/loops/t331on-brief.md. Aaron 11-01: turn it on."`.
    - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion.

## Reply

- **First line:** `READY t331on <sha40> PR #<n>` or `BLOCKED t331on <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`. Live check on the main build, against a COPY of the store:
- `loadPolicy()` from `open-brain/build/trigger/policy.js` returns `withhold_fraction: 0.5`.
- `runTrigger` with the G-039 command under two session uuids, one whose draw for the matched ids is below 0.5 and
  one at or above: the first returns `state: 'silent'` with `withheldIds`, the second `state: 'injected'`.
- Then the live store's `trigger_fires` starts carrying `withheld:` rows; Prism's per-arm count reads them.
