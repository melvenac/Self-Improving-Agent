# T304: a role-none checkout gets its own checkout's handoff (T-304)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-304 (P3). **Tag:** `t304`. **Size:** SMALL-MEDIUM (13
edits in 4 src files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: ownHandoff renderBriefing renderState renderStartReport
```

## Why

A checkout that declares `role: none` (NOT_A_SEAT: the main checkout, a one-agent bootstrap project, a coordinator)
resolves no seat, and `ownHandoff()` returned null for a null seat, so its greeting never had a PICK UP, even for a
handoff its own checkout wrote. Planner ruling (recommended default, noted for Aaron): the READ side only. A role-none
reader gets the newest handoff written FROM its own checkout, by any seat; with no checkout known it gets none; an
unresolved reader (no identity at all) is unchanged. start-report.ts gives a role-none reader its checkout even with
`handoff_by_checkout` off. The schema, set_handoff and SeatName are unchanged; reads-owed and greeting-metrics keep their
null-seat behaviour.

## The change, exactly

Files under `docs/loops/t304/`.
- **`t304-role-none-handoff.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/pipelines/session-start/t304-role-none-handoff.test.ts`. H1-H3, H4a, H4b, H5.
- **`edits.txt`:** 13 edits in 4 files: `shared/state-schema.ts` (`newestFromCheckout`; `ownHandoff`'s `notASeat`
  parameter), `session-start/briefing.ts` (`notASeat` input; both call sites), `session-start/state-render.ts` (`notASeat`
  option; the call; the UNRESOLVED header only when nothing is found), `session-start/start-report.ts` (imports; the
  role-none checkout fallback; passes `notASeat` to the state block, the briefing and the merged-citations lookup).

## Measured before dispatch

QA PC SIM `sim-t304` round 2 (job #110) at `d245676a`: every step matched except m2's prediction, which was incomplete:
m2 (any checkout matches) also reds H4a, because H4a's fixture holds a newer handoff from another checkout and m2 picks
it (`expected 'T304-OTHER-MARKER' to be 'T304-OWN-MARKER'`). Ruled expected. (Round 1, job #103, did not load the test
file: the fixture's planner handoff lacked loop_state; fixed.) No file under `open-brain/` changed between `d245676a`
and this brief's base except by the T-309 and T-314 merges, which touch briefing.ts and start-report.ts in regions the
13 edits do not anchor on; step 4's `APPLIED 13 edits to 4 files` is the check.
- Baseline (the new test file, no source): `1 failed | 3 passed (4)` files, `3 failed | 118 passed (121)` tests; the
  red rows are H1, H4a and H4b.
- Edit: `APPLIED 13 edits to 4 files`; both tsc runs and the build exit 0; the four files `121 passed (121)`.
- Step 4's wide run: `152 passed (152)` files, `1740 passed (1740)` tests, `Errors 1 error` = T-292's
  `Timeout calling "onTaskUpdate"` with no red row. `module-boundary [pass]`.
- m1 (the flag ignored) H1, H4a and H4b; m2 (any checkout matches) H1, H4a and H5; m3 (no checkout fallback) H4a and
  H4b; m4 (the UNRESOLVED header kept) H4b.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `state-render.test.ts` "says the reader's seat is unresolved", `briefing.test.ts` seat-null rows, the A2A golden | stay green | Their readers are unresolved, not role none, so nothing changes. Green in the SIM. |
| `handoff-by-checkout.test.ts`, `server.test.ts`, `tests/pipelines` | stay green | Seated readers are untouched. Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED t304 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the four files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the four files after step 4 is never an exception: re-run
the four files once; if the row is green on that run AND the row is a timeout (not an assertion), paste both and go on,
else STOP.

## Steps

"The four files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/t304-role-none-handoff.test.ts tests/pipelines/session-start/state-render.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/session-start/handoff-by-checkout.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t304-role-none-handoff`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T304: rows for a role-none checkout's own handoff`).
   - `Copy-Item docs/loops/t304/t304-role-none-handoff.test.ts open-brain/tests/pipelines/session-start/t304-role-none-handoff.test.ts`.
   - Run the four files. Expect `1 failed | 3 passed (4)` files and `3 failed | 118 passed (121)` tests, the red rows H1,
     H4a and H4b in t304-role-none-handoff.test.ts. Paste the summary and each `x` row.
4. **Commit 2** (`T304: a role-none checkout gets the newest handoff written from it (T-304)`).
   - `node docs/loops/t304/apply.cjs . docs/loops/t304/edits.txt` prints exactly `APPLIED 13 edits to 4 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the four files: `121 passed (121)`.
   - `npx vitest run tests/pipelines tests/server.test.ts tests/t154-cli-start.test.ts tests/t249-worktree-identity.test.ts tests/t251-role-stubs.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default; if your tool cannot hold 40 minutes, run it in the background logging to a file and wait for it). Expect
     0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m4: `node docs/loops/t304/apply.cjs . docs/loops/t304/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the four files; paste the `Tests` line and the `x` rows (expected: m1 -> H1,
   H4a and H4b; m2 -> H1, H4a and H5; m3 -> H4a and H4b; m4 -> H4b only); restore with `git checkout -- open-brain/src`
   (this returns to commit 2) and check the status is empty. After m4, run the four files once more: `121 passed (121)`.
   Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 5 paths:
   `M open-brain/src/pipelines/session-start/briefing.ts`, `M open-brain/src/pipelines/session-start/start-report.ts`,
   `M open-brain/src/pipelines/session-start/state-render.ts`, `M open-brain/src/shared/state-schema.ts`,
   `A open-brain/tests/pipelines/session-start/t304-role-none-handoff.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t304-role-none-handoff` must equal
   HEAD. `gh pr create --base master --head feat/t304-role-none-handoff --title "T304: a role-none checkout gets the newest handoff written from it (T-304)" --body "Brief: docs/loops/t304-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t304 <sha40> PR #<n>` or `BLOCKED t304 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`. Live check: `node <main>/open-brain/build/cli.js start --read-only <a role-none checkout>` whose checkout
wrote a handoff prints it as PICK UP instead of `none: this reader's seat is unresolved`.
