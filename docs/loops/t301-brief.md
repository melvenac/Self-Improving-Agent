# T301: the heavy-suite run prints its owner, lease and census (T-301)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-301 (P3). **Tag:** `t301`. **Size:** SMALL (1 edit in 1
src file, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: decideSuiteStart leaseStatusFromExit (read, unchanged; the edit is inside cli-suite-run.ts main)
```

## Why

`open-brain/src/cli-suite-run.ts` (the T-168 heavy-suite wrapper) prints only `suite seat: ...`; the owner, the lease
take/release and the census reach only suite-run-meta.json (T-168's Cursor half, finding 2). With this change, three
lines print after the meta file is written and before any refusal: `suite owner: pid <n> (<source>)` or
`suite owner: none (<reason>)`; `suite lease: <status> (take exit <n|none>, release exit <n|none>)`;
`suite census: available, busy SIA: <names|none>` or the census's own `census unavailable: ...` reason.

## The change, exactly

Files under `docs/loops/t301/`.
- **`t301-suite-lines.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t301-suite-lines.test.ts`. L1-L5.
- **`edits.txt`:** 1 edit in `open-brain/src/cli-suite-run.ts` (the three lines after `writeFileSync(metaPath, ...)`).

## Measured before dispatch

QA PC SIM `sim-t301-2` (job #89) at `8e7b954f`: ALL PASS (round 1, job #87, mispredicted only L2/L3's exit status: a
census refuses only a controlled rerun; the printed lines matched). No file under `open-brain/` changed between
`8e7b954f` and this brief's base. sha256 prefixes: test file `bf99bf217a220e05`, edits `a56068dc191a65d8`, m1
`964c5186ae8cf2d6`, m2 `2fcd950d5dd05e82`, m3 `2d0cd2e9e3011f73`, m4 `19560962a17b48eb`.
- Baseline (the new test file, no source): the five files `1 failed | 4 passed (5)` files, `5 failed | 53 passed (58)`
  tests; the red rows are L1-L5, all in t301-suite-lines.test.ts.
- Edit: `APPLIED 1 edits to 1 files`; both tsc runs and the build exit 0; the five files `58 passed (58)`.
- Step 4's wide run: `25 passed (25)` files, `396 passed (396)` tests, no Errors line. `module-boundary [pass]`.
- m1 (busy SIA always none) L2 only; m2 (release exit never printed) L1 only; m3 (owner reason dropped) L4 only; m4
  (census reason dropped) L3 only.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `suite-run-meta`, `t168-seat-resolve`, `t168-owner-wired`, `t268-owner-session-proof` | stay green | They assert stdout with `toContain` and the meta file's fields; three added lines change neither. Green in the SIM. |
| `t270-table-control-chars`, `t283-suite-vitest-args`, `tests/shared` | stay green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t301 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the five files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the five files after step 4 is never an exception.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/t301-suite-lines.test.ts tests/suite-run-meta.test.ts tests/t168-seat-resolve.test.ts tests/t168-owner-wired.test.ts tests/t268-owner-session-proof.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t301-suite-lines`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T301: rows for the suite run's owner, lease and census lines`).
   - `Copy-Item docs/loops/t301/t301-suite-lines.test.ts open-brain/tests/t301-suite-lines.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `5 failed | 53 passed (58)` tests, the red rows
     L1-L5 in t301-suite-lines.test.ts. Paste the summary and each `x` row.
4. **Commit 2** (`T301: the suite run prints its owner, lease and census (T-301)`).
   - `node docs/loops/t301/apply.cjs . docs/loops/t301/edits.txt` prints exactly `APPLIED 1 edits to 1 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the five files: `58 passed (58)`.
   - `npx vitest run tests/t301-suite-lines.test.ts tests/suite-run-meta.test.ts tests/t168-seat-resolve.test.ts tests/t168-owner-wired.test.ts tests/t268-owner-session-proof.test.ts tests/t270-table-control-chars.test.ts tests/t283-suite-vitest-args.test.ts tests/shared --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m4: `node docs/loops/t301/apply.cjs . docs/loops/t301/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the five files; paste the `Tests` line and the `x` rows (expected: m1 -> L2
   only; m2 -> L1 only; m3 -> L4 only; m4 -> L3 only); restore with `git checkout -- open-brain/src` (this returns to
   commit 2) and check the status is empty. After m4, run the five files once more: `58 passed (58)`. Never commit a
   mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 2 paths:
   `M open-brain/src/cli-suite-run.ts`, `A open-brain/tests/t301-suite-lines.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t301-suite-lines` must equal HEAD.
   `gh pr create --base master --head feat/t301-suite-lines --title "T301: the suite run prints its owner, lease and census (T-301)" --body "Brief: docs/loops/t301-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t301 <sha40> PR #<n>` or `BLOCKED t301 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`. Live check: the next `npm run test:heavy` (or a `SUITE_DRY_RUN=1` run) prints the three lines after
`suite seat:`.
