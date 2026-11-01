READY sim-t331on 70a79e05 MEASURED 11 red row(s)

Reply path: C:\Users\Aaron Melven\Worktrees\sim-t331on-reply.md

## Steps
- a: node v22.23.3; HEAD 70a79e0569b4a34dae066239db3f288765103a15; status empty; npm ci exit 0.
- b: sha256[:16] apply.cjs e85dca45527bbf28; edits.txt 437e1b40f4cc7910.
- c: baseline `Tests 5 passed (5)`.
- d: `APPLIED 2 edits to 2 files`; build exit 0; write-schema ran, `git diff --stat` on the schema.json is empty (only recall-trigger.json and t331 test modified).
- e: `Test Files 6 failed | 23 passed (29)`, `Tests 11 failed | 273 passed (284)`. Re-run alone: every red file stayed red with the same counts (cursor 2 failed/5, hook 4/12, no-network 1/3, error-keys 1/8, powershell 2/6, match-keys 1/23). Deterministic, not T-292 flake. t331 W3 green.
- f: `git grep -n -e "loadPolicy()" -e "recall-trigger.json" -- open-brain/tests` hits only floor.test.ts (95-239), hook.test.ts (187,188,282,284), no-network.test.ts:142, t331-withheld-arm.test.ts:76. All already run in e; nothing extra to run. (Not found by grep but red: t235-p2-5-cursor, t170-error-keys, t170-ii-powershell, t170-match-keys - they spawn the hook, which reads the shipped file.)
- h: full run exit 1: `Test Files 6 failed | 348 passed | 7 skipped (361)`, `Tests 11 failed | 4904 passed | 75 skipped (4990)`, `Errors 1 error` (Unhandled Errors section; I did not capture its text before deleting the log). The 11 red rows are identical to e; no red row outside e.
- i: final `git status --porcelain`: ` M open-brain/src/trigger/policies/recall-trigger.json`, ` M open-brain/tests/trigger/t331-withheld-arm.test.ts`. Nothing committed.

## Red rows
Ids are INFERRED from seed order in a fresh DB (autoincrement), not read from a run: 598 fillers then the entry = 599; single-entry seeds = 1. Draw = step g command on `<uuid>:<id>`. All < 0.5 so withheld.

| file | row | uuid | id | draw | asserting line |
|---|---|---|---|---|---|
| t235-p2-5-cursor-recall.test.ts | Cursor Shell payload runs the trigger | 2564043c-7e01-461b-b0dc-f365996968b0 | 599 | 0.3825 | :77 `const emitted = JSON.parse(result.stdout) as {` (stdout empty) |
| same | Bash payload byte-identical path still injects | same | 599 | 0.3825 | :87 `expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).toContain("PIPESTATUS");` |
| trigger/hook.test.ts | A5 POSITIVE at scale | aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee | 599 | 0.1123 | :157 `const emitted = JSON.parse(result.stdout) as {` |
| same | A5 POLICY FILE let 299 through | same | 599 | 0.1123 | :193 `expect((await runHook(postToolUse(G039_COMMAND))).stdout.trim()).not.toBe('');` |
| same | A5 fire recorded | same | 599 | 0.1123 | :232 `expect(byState.injected).toBeGreaterThanOrEqual(2);` (received undefined) |
| same | A6 POSITIVE CONTROL | same | 599 | 0.1123 | :322 `expect(result.stdout).toContain('additionalContext');` |
| trigger/no-network.test.ts | A11 THE CLAIM | no-net00-0000-0000-0000-000000000000 | 1 | 0.1836 | :147 `expect(outcome.state).toBe('injected');` (got 'silent') |
| trigger/t170-error-keys.test.ts | K7 hook PowerShell failure | k7 | 1 | 0.0480 | :145 `const out = JSON.parse(r.stdout) as {...}` |
| trigger/t170-ii-powershell.test.ts | W1 | w1 | 1 | 0.3648 | :95 `const { A, out } = await keyedRun(ps(..., 'w1', 'PostToolUseFailure'));` |
| same | W2 | w2 | 1 | 0.1084 | :101 `const { A, out } = await keyedRun(ps(..., 'w2', 'PostToolUse'));` |
| trigger/t170-match-keys.test.ts | H1 sidecar key injects | h1 | 1 | 0.3359 | :247 `const out = JSON.parse(r.stdout) as {...}` |

Assertion messages: most are `SyntaxError: Unexpected end of JSON input` (empty hook stdout); hook.test.ts A5 policy-file row `expected '' not to be ''`; A6 `expected '' to contain 'additionalContext'`; A5 fire row `actual value must be number or bigint, received "undefined"`; no-network `expected 'silent' to be 'injected'`.

Control: unaffected hook rows use other sessions (e.g. k8 0.5014, k6 0.9788 are >= 0.5 and stay green).
Note: the sim deleted its scratch logs; the clone is otherwise left as edited.
