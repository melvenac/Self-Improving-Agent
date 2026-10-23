# T315P: the build proxy keeps the host's stdio across a rebuild (T-315 proxy slice)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-23, session 174. **Task:** T-315 (D-161). **Tag:** `t315p`. **Size:** MEDIUM (1 new
src file, 6 edits in 2 files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this
brief).

```text
IMPACT-TARGETS: writeSessionId readParentSessionProof handleSetSession (new: createBuildProxy and runBuildProxy in build-proxy.ts; proofParentPid in shared/process-session.ts)
```

## Why

T-315 step 0 (docs/loops/t315-step0.md): Claude Code does not restart a stdio server that exits (10-20: every seat lost
open-brain), `claude -p` cannot reconnect, and ESM re-import does not reload a module graph. So `build-proxy.ts` owns the
host's stdio and runs build/server.js as a child, swapping in a new child (with the host's `initialize` replayed) when the
build stamp changes and nothing is in flight. The child's parent is then the proxy, so `proofParentPid` lets the server
read the host's proof only when OPEN_BRAIN_PROXY_PID is its actual parent. `_recalledKnowledgeIds` (written, never read)
goes. Registering the proxy as the MCP command is NOT in this run (a config change, S2).

## The change, exactly

Files under `docs/loops/t315p/`.
- **`build-proxy.ts`:** copied verbatim, as a new file, to `open-brain/src/build-proxy.ts`.
- **`t315-proxy.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t315-proxy.test.ts`. P1-P9.
- **`edits.txt`:** 6 edits in 2 files: `open-brain/src/shared/process-session.ts` (proofParentPid),
  `open-brain/src/server.ts` (import, writeSessionId, readParentSessionProof, the dead set and its one write).

## Measured before dispatch

QA PC SIM `sim-t315p` (job #63) at `6975e065`: ALL PASS. sha256 prefixes: build-proxy.ts `d43a35ff8867480f`, test file
`b247083ac24511b3`, edits `ef9c290bd26a6e86`, m1 `5f1df1c59a2a7c93`, m2 `4c9bbc3b5a2e5ded`, m3 `d013052feb1120b2`, m4
`2a04ed00ae7cffd9`, m5 `da1f4f74a44ee513`.
- Baseline (the new test file, no source): the five files `1 failed | 4 passed (5)` files, `46 passed (46)` tests; the
  only red file is t315-proxy.test.ts (`Cannot find module '../src/build-proxy.js'`).
- Edits: `APPLIED 6 edits to 2 files`; both tsc runs and the build exit 0; `build/build-proxy.js` exists; the five
  files `55 passed (55)`.
- Step 4's wide run: `188 passed (188)` files, `2132 passed (2132)` tests, no Errors line. `module-boundary [pass]`.
- m1 (proof ignores the proxy-pid check) P7, P9; m2 (swap ignores in-flight) P3 only; m3 (no initialize replay) P2, P5,
  P6; m4 (list_changed without comparing) P5 only; m5 (server proof keeps process.ppid) P9 only.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t003-session-proof`, `t003-r2`, `qa142-t003`, `t048-r3`, `t235-p2-3-cursor-proof` (proof by `process.ppid`) | stay green | With no OPEN_BRAIN_PROXY_PID, proofParentPid returns `process.ppid`. Green in the SIM. |
| `tests/shared/t315-s1.test.ts` (build-watch R1-R6) | stay green | build-watch.ts is untouched. Green in the SIM. |
| everything else in step 4's run | stays green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t315p <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the five files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the five files after step 4 is never an exception.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/t315-proxy.test.ts tests/t003-session-proof.test.ts tests/t003-r2.test.ts tests/t235-p2-3-cursor-proof.test.ts tests/shared/t315-s1.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t315-build-proxy`. HEAD must equal START and the porcelain
   must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard,
   force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`, any
   MCP config, and anything under `docs/`.
3. **Commit 1** (`T315P: rows for the build proxy and its session proof`).
   - `Copy-Item docs/loops/t315p/t315-proxy.test.ts open-brain/tests/t315-proxy.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `46 passed (46)` tests, the only red file
     t315-proxy.test.ts (`Cannot find module '../src/build-proxy.js'`). Paste the summary and the error line.
4. **Commit 2** (`T315P: build proxy keeps the host's stdio across a rebuild; server proof reads the host pid under it (T-315)`).
   - `Copy-Item docs/loops/t315p/build-proxy.ts open-brain/src/build-proxy.ts`.
   - `node docs/loops/t315p/apply.cjs . docs/loops/t315p/edits.txt` prints exactly `APPLIED 6 edits to 2 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0); `Test-Path build/build-proxy.js` is True.
   - Run the five files: `55 passed (55)`.
   - `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix tests/t003-session-proof.test.ts tests/t003-r2.test.ts tests/qa142-t003.test.ts tests/t048-r3.test.ts tests/t235-p2-3-cursor-proof.test.ts tests/t315-proxy.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m5: `node docs/loops/t315p/apply.cjs . docs/loops/t315p/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the five files; paste the `Tests` line and the `x` rows (expected: m1 -> P7,
   P9; m2 -> P3 only; m3 -> P2, P5, P6; m4 -> P5 only; m5 -> P9 only); restore with `git checkout -- open-brain/src`
   (this returns to commit 2) and check the status is empty. After m5, run the five files once more: `55 passed (55)`.
   Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 4 paths: `A open-brain/src/build-proxy.ts`,
   `M open-brain/src/server.ts`, `M open-brain/src/shared/process-session.ts`, `A open-brain/tests/t315-proxy.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t315-build-proxy` must equal HEAD.
   `gh pr create --base master --head feat/t315-build-proxy --title "T315P: build proxy keeps the host's stdio across a rebuild (T-315)" --body "Brief: docs/loops/t315p-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t315p <sha40> PR #<n>` or `BLOCKED t315p <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild` (the server is unchanged for a seat until it runs the proxy). S2, on Aaron's word: point each seat's
open-brain MCP command at `build/build-proxy.js`; every seat reconnects once; then the live check: after the next
`sia-rebuild`, the next tool call reports the new build with no reconnect, `ob_set_session` still proves the session, and
a `claude -p` run across a rebuild keeps open-brain.
