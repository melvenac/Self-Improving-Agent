# T325: bootstrap polish from the T-241 re-run (T-325)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-325 (P3). **Tag:** `t325`. **Size:** SMALL (9 edits in
5 files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief and the SIM's
base `881b1a2a`). **Authority:** D-145 (work the backlog by priority) and D-163 (planner launches and merges on its own
QA ACCEPT); the findings are QA PC job #194's (docs/loops/t241-frogger-rerun-report.md).

```text
IMPACT-TARGETS: resolveRecordSource (record-source.ts: one branch's line text; unreadableCause unchanged)
```

## Why

The T-241 frogger re-run graded bootstrap FIXED 13/15 and logged wording problems. This slice fixes the ones with a
small, deterministic fix:
- **F11:** `state import --draft` printed `Project: <name>` with no source when the name came from package.json. It
  now prints `Project: <name> (from package.json)`; the folder and --name cases are unchanged.
- **N3:** two stdout hint lines in the draft summary: one when any INBOX line was unparsed, one when inputs could not
  be judged because there is no `SESSIONS/Session_N.md`.
- **N5:** with no upstream ref, /start's record-source line said `origin/master unreadable: ...`. A ref that does not
  exist is not unreadable: the line now says `origin/master does not exist in this checkout (...)`. The other
  unreadable causes keep their wording; `unreadableCause` is unchanged.
- **N1, N2, N6 (doc only):** `project-template/.claude/commands/bootstrap.md` steps 2.1, 4 and 5 gain one prose line
  each (residue shows untracked until step 3; match the file's line endings when appending; replace a placeholder that
  names a document the project does not have).
- **T-295 leftover (comment only):** `lifecycle.ts`'s Maturity comment names `open-brain list`, not `ob_list`.

Deferred: N4 (a fresh /start reads like faults) spans three renderers and is a design question; N7 and N8 were run
artifacts.

## The change, exactly

Files under `docs/loops/t325/`.
- **`t325-bootstrap-polish.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/pipelines/t325-bootstrap-polish.test.ts`. P1-P3 spawn `state import --draft` through tsx on
  copies of `tests/fixtures-import`; P4 calls `resolveRecordSource` on a fresh git repo with no remote.
- **`edits.txt`:** 9 edits in 5 files: `open-brain/src/cli.ts` (3: F11, both N3 hints),
  `open-brain/src/pipelines/session-start/record-source.ts` (1: N5),
  `open-brain/tests/pipelines/session-start/record-source.test.ts` (1: RM-3's no-remote row),
  `open-brain/src/lifecycle.ts` (1: comment), `project-template/.claude/commands/bootstrap.md` (3: prose).
  RM-3's row edit goes in commit 2 with the code: it pins the old `origin/master unreadable: ...` text, which is
  correct until the N5 edit lands and wrong after it, so the row and the behaviour change in the same commit. RM-3 is
  green in commit 1 and green again after commit 2.

## Measured before dispatch

QA PC SIM `sim-t325` (job #208) at `881b1a2a`: ALL PASS. The anchors were re-checked on origin/master `881b1a2a` (none
of the 5 files changed since): `APPLIED 9 edits to 5 files`.
- Baseline (five files, the new test only): `1 failed | 4 passed (5)` files, `4 failed | 52 passed (56)` tests; red
  P1, P2, P3, P4 only; RM-3 green.
- Apply: `APPLIED 9 edits to 5 files`; both tsc runs and `npm run build` exit 0; five files `56 passed (56)`.
- Wide run: `Test Files 158 passed (158)`, `Tests 1733 passed (1733)`, no Errors line, no re-runs.
- sync: `module-boundary [pass]`, `retirements [pass]`, `command-tool-names [pass]`. `mirror-parity` was not a pass:
  it named only live<->template differences (the QA PC's home-directory `~\.claude` / `~\.cursor` copies), no
  repo<->template difference. Environment, not this change.
- Live look: `Project: self-improving-agent (from package.json)` and both hint lines printed.
- m1 -> P1; m2 -> P2; m3 -> P3; m4 -> P4 and RM-3 "no origin remote".

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `record-source.test.ts` RM-3 "no origin remote" | edited in commit 2 | It pinned `origin/master unreadable: ...`; it now pins the new line and that `unreadable` is absent. Green in the SIM. |
| `record-source.test.ts`, every other row | stays green | The other causes still go through `unreadable(...)`. |
| `upstream-ref.test.ts` UR-7 | stays green | Its clone has origin/main; the line never says `does not exist`. |
| `state-import-t248.test.ts` NM-5 | stays green | The --name case is unchanged. |
| `bootstrap-fix.test.ts` (Project rows, "bootstrap.md's order") | stays green | They read /start's header; the doc edits add prose only, no command or code fence. |
| `bootstrap-fix-r3.test.ts` "step 2.2 names the empty commit" | stays green | Step 2.2 untouched. |
| `state-import-staleness.test.ts`, `state-import-r2.test.ts` | stays green | The Staleness and Tasks lines are unchanged; the hints are new lines. |
| `hub-presence.test.ts`, `state-import-r4.test.ts`, `end-fix-q3.test.ts` | known flaky under load | Timeouts on the shared QA PC in SIMs #134/#143, green alone. See the exception rule. |

Any other red existing row means STOP and report `BLOCKED t325 <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in
files other than the five files, with that error or a timeout: re-run each such file alone up to 3 times; green on any
run alone means paste every run and go on, red on all 3 means STOP.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/pipelines/t325-bootstrap-polish.test.ts tests/pipelines/session-start/record-source.test.ts tests/pipelines/state-import-t248.test.ts tests/pipelines/state-import-staleness.test.ts tests/pipelines/bootstrap-fix.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git merge-base --is-ancestor 881b1a2a HEAD` must exit 0. Then
   `git checkout -q -b feat/t325-bootstrap-polish`. HEAD must equal START and the porcelain must be empty. In
   `open-brain`: `npm ci`, then `node -e "require('better-sqlite3')"` (on "Could not locate the bindings file":
   `npm rebuild better-sqlite3` and say so). Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard,
   force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`
   (including `knowledge-v2.db` and `~/.claude/commands`), any MCP config, and anything under `docs/`.
3. **Commit 1** (`T325: rows for the bootstrap polish`).
   - `Copy-Item docs/loops/t325/t325-bootstrap-polish.test.ts open-brain/tests/pipelines/t325-bootstrap-polish.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `4 failed | 52 passed (56)` tests, red only P1, P2,
     P3 and P4. Paste the summary and each `x` row. Commit the test file.
4. **Commit 2** (`T325: bootstrap polish from the T-241 re-run (T-325)`).
   - From the clone root: `node docs/loops/t325/apply.cjs . docs/loops/t325/edits.txt` prints exactly
     `APPLIED 9 edits to 5 files`.
   - In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (each exit 0).
   - Run the five files: `56 passed (56)`.
   - `npx vitest run tests/pipelines tests/t154-cli-start.test.ts tests/t314-start-read-only.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait).
     Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root:
     `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements|mirror-parity|command-tool-names"`.
     `module-boundary`, `retirements` and `command-tool-names` must show `[pass]`. A `mirror-parity` line that names
     only live<->template differences (the QA PC's home-directory `~\.claude` / `~\.cursor` copies) is ENVIRONMENT:
     paste it, say so and go on. A `mirror-parity` line that names a repo<->template difference is a STOP:
     `BLOCKED t325 mirror-parity <file>`.
   - Commit the five edited files.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m4: `node docs/loops/t325/apply.cjs . docs/loops/t325/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run
   `npx vitest run tests/pipelines/t325-bootstrap-polish.test.ts tests/pipelines/session-start/record-source.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> P1; m2 -> P2; m3 -> P3; m4 -> P4 and RM-3 "no origin
   remote"); restore with `git checkout -- open-brain` and check the status is empty. After m4, run the five files once
   more: `56 passed (56)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 6 paths:
   `M open-brain/src/cli.ts`, `M open-brain/src/lifecycle.ts`,
   `M open-brain/src/pipelines/session-start/record-source.ts`,
   `A open-brain/tests/pipelines/t325-bootstrap-polish.test.ts`,
   `M open-brain/tests/pipelines/session-start/record-source.test.ts`,
   `M project-template/.claude/commands/bootstrap.md`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t325-bootstrap-polish` must
   equal HEAD. `gh pr create --base master --head feat/t325-bootstrap-polish --title "T325: bootstrap polish from the T-241 re-run (T-325)" --body "Brief: docs/loops/t325-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min; if it first says no checks reported, wait 60 s and retry
   once). Paste the `test` conclusion.

## Reply

- **First line:** `READY t325 <sha40> PR #<n>` or `BLOCKED t325 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command; any
  other sha in the reply is 8 characters. Mark anything not run `NOT RUN`. Do not merge.

## After merge (desktop, not this run)

1. sia-rebuild on the main checkout.
2. Re-copy `project-template/.claude/commands/bootstrap.md` to `~/.claude/commands/bootstrap.md` on the desktop and
   check the bytes match the merge commit.
3. Ask clark to re-copy the same file to the QA PC's `~/.claude/commands/bootstrap.md`.
4. Live check: `node <main>/open-brain/build/cli.js state import --draft <a temp copy of tests/fixtures-import>` prints
   `Project: ... (from package.json)` and the hint lines.
