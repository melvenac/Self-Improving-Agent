# T314: `open-brain start --read-only` writes nothing a real start reads (T-314)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-314 (P3). **Tag:** `t314`. **Size:** SMALL (11 edits in 6
files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: sessionStart renderStartReport
```

## Why

Seats run `node <main>/open-brain/build/cli.js start <dir>` as a read-only check, and each run created a session log,
taking the next session number (twice on one evening, s173). With this change `start --read-only` prints the report
and writes no session log, no role-read record (`.agents/role-reads.local.json`) and no greeting-metrics row. Without
the flag nothing changes.

## The change, exactly

Files under `docs/loops/t314/`.
- **`t314-start-read-only.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t314-start-read-only.test.ts`.
  R1-R5.
- **`edits.txt`:** 11 edits in 6 files: `cli-spec.ts` (start declares `--read-only`), `cli.ts` (parse it, pass
  `readOnly`, and the usage line `start [--read-only]`), `session-start/types.ts` (`noLog`), `session-start/index.ts`
  (no log when `noLog`), `session-start/start-report.ts` (`readOnly` input; no role reads, no metrics row), and
  `tests/shared/cli-args.test.ts` ("a command with no flags says so" used `COMMAND_SPECS.start`, which now has a flag,
  so it uses a bare spec).

## Measured before dispatch

QA PC SIM `sim-t314` (job #101) at `1ff73934`, with the first 10 edits: every step matched except two, both ruled.
(1) `tests/shared/cli-args.test.ts` "every flag start declares is documented on its own usage line" was red alone:
`start declares --read-only: expected [] to include '--read-only'`. The 11th edit (the usage line) is the fix; it was
checked to apply, not run. (2) m3 (metrics written anyway) reds R3 AND R5, not R3 only: R5's CLI run also asserts no
metrics row, so R5 catches it too (prediction error, ruled expected). No file under `open-brain/` changed between
`1ff73934` and this brief's base.
- Baseline (the new test file, no source): `1 failed | 3 passed (4)` files, `4 failed | 107 passed (111)` tests; the red
  rows are R1, R2, R3 and R5.
- 10 edits: both tsc runs and the build exit 0; the four files `1 failed | 110 passed (111)`, the one red row being the
  usage-line row above. Wide run `1 failed | 67 passed (68)` files, `1 failed | 1045 passed (1046)` tests, the same row,
  plus T-292's `Timeout calling "onTaskUpdate"` error. `module-boundary [pass]`; the live probe printed
  `Session log: not created: read-only start (--read-only)`.
- m1 R1 and R5; m2 R2; m3 R3 and R5; m4 R5 (each plus the usage-line row, which the 11th edit removes).

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/shared/cli-args.test.ts` "a command with no flags says so" | changed | Edit 10 points it at a bare spec; the row's claim is unchanged. |
| `tests/shared/cli-args.test.ts` usage-line rows for `start` | stay green with edit 11 | The line documents exactly the declared flag. |
| `t154-cli-start`, `role-docs-by-sha`, `tests/pipelines/session-start`, `server.test.ts` | stay green | Without the flag nothing changes. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t314 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the four files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the four files after step 4 is never an exception.

## Steps

"The four files" means, from `open-brain`:
`npx vitest run tests/t314-start-read-only.test.ts tests/shared/cli-args.test.ts tests/t154-cli-start.test.ts tests/pipelines/session-start/role-docs-by-sha.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t314-start-read-only`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T314: rows for a read-only start that writes nothing`).
   - `Copy-Item docs/loops/t314/t314-start-read-only.test.ts open-brain/tests/t314-start-read-only.test.ts`.
   - Run the four files. Expect `1 failed | 3 passed (4)` files and `4 failed | 107 passed (111)` tests, the red rows
     R1, R2, R3 and R5 in t314-start-read-only.test.ts. Paste the summary and each `x` row.
4. **Commit 2** (`T314: open-brain start --read-only writes no log, role read or metrics row (T-314)`).
   - `node docs/loops/t314/apply.cjs . docs/loops/t314/edits.txt` prints exactly `APPLIED 11 edits to 6 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the four files: `111 passed (111)`.
   - `npx vitest run tests/pipelines/session-start tests/shared tests/t154-cli-start.test.ts tests/server.test.ts tests/cli-bootstrap.test.ts tests/pipelines/sync/start-parity.test.ts tests/t314-start-read-only.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`)
     and `node open-brain/build/cli.js start --read-only . | Select-String -Pattern "Session log:"`. Paste both, then
     `git status --porcelain` (must be empty: the probe wrote nothing).
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m4: `node docs/loops/t314/apply.cjs . docs/loops/t314/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the four files; paste the `Tests` line and the `x` rows (expected: m1 -> R1
   and R5; m2 -> R2 only; m3 -> R3 and R5; m4 -> R5 only); restore with `git checkout -- open-brain/src` (this returns
   to commit 2) and check the status is empty. After m4, run the four files once more: `111 passed (111)`. Never commit
   a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 7 paths: `M open-brain/src/cli-spec.ts`,
   `M open-brain/src/cli.ts`, `M open-brain/src/pipelines/session-start/index.ts`,
   `M open-brain/src/pipelines/session-start/start-report.ts`, `M open-brain/src/pipelines/session-start/types.ts`,
   `M open-brain/tests/shared/cli-args.test.ts`, `A open-brain/tests/t314-start-read-only.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t314-start-read-only` must equal
   HEAD. `gh pr create --base master --head feat/t314-start-read-only --title "T314: open-brain start --read-only writes nothing a real start reads (T-314)" --body "Brief: docs/loops/t314-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t314 <sha40> PR #<n>` or `BLOCKED t314 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`. Live check: `node <main>/open-brain/build/cli.js start --read-only <checkout>` leaves
`.agents/SESSIONS` and `.agents/role-reads.local.json` unchanged. Then atlas-ops' live-check notes name the flag.
