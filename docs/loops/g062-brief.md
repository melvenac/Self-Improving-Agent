# G062: READS OWED leaves out a file this seat wrote (G-062 part a)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-22, session 174. **Gap:** G-062 (a). **Tag:** `g062`. **Size:** SMALL (11 edits in 5
files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: sessionTrailerIds describeReadsOwed renderStartReport (new: ownTrailerIds and newestTrailer in reads-owed.ts; sessionTrailerIds gains an optional headOnly option)
```

## Why

G-062: READS OWED lists a brief the reading seat wrote itself (Atlas S174's greeting listed
docs/loops/t318-s1-brief.md, written in S174), so every session pays a read for nothing and learns to skim the line.
Every commit's git author is Aaron; authorship is the Claude-Session trailer (T-276). Opt-in per repo
(greeting.json `reads_owed_own`, default off); SIA turns it on. Part (b), a brief whose work shipped, is not in this run.

## The change, exactly

Files under `docs/loops/g062/`.
- **`g062-reads-owed.test.ts`:** copied verbatim, as a new file, to
  `open-brain/tests/pipelines/session-start/g062-reads-owed.test.ts`. O1-O5.
- **`edits.txt`:** 11 edits in 5 files: `open-brain/src/shared/handoff-guard.ts` (`headOnly`),
  `open-brain/src/pipelines/session-start/reads-owed.ts` (newestTrailer, ownTrailerIds, the optional ownIds argument),
  `open-brain/src/pipelines/session-start/start-report.ts` (import and the gated call),
  `open-brain/src/pipelines/session-start/greeting-flags.ts` (the key list comment), `.agents/SYSTEM/greeting.json`
  (`"reads_owed_own": true`).

## Measured before dispatch

QA PC SIM `sim-g062` (job #57) at `364b0025`: ALL PASS. sha256 prefixes: edits `d116989e688ad77a`, test file
`153955482b90f0b1`, m1 `e94a8688cfdf6dde`, m2 `48dc3a1b3b05ff0f`, m3 `6a6648025a3bc822`, m4 `164ff4ecbf962128`.
- Baseline (the new test file, no source): the four files `1 failed | 3 passed (4)` files, `5 failed | 58 passed (63)`
  tests; the only red file is g062-reads-owed.test.ts (O1-O5; O3 and O4 `ownTrailerIds is not a function`).
- Edits: `APPLIED 11 edits to 5 files`; both tsc runs and the build exit 0; the four files `63 passed (63)`.
- Step 4's wide run: `187 passed (187)` files, `2107 passed (2107)` tests, no Errors line. `module-boundary [pass]`.
- m1 (own ids ignored) O1, O2, O5 red; m2 (earlier transcript read in full) O4 only; m3 (oldest other session) O3
  only; m4 (no opt-in gate) O5 only.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `briefing-fix.test.ts` BF-R1..R4 (describeReadsOwed) | stay green | They pass 5 arguments; the 6th defaults to none, so nothing is left out. Green in the SIM. |
| `t276-session-trailer.test.ts`, `t161-transcript.test.ts` | stay green | sessionTrailerIds without options reads as before. Green in the SIM. |
| everything else in step 4's run | stays green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED g062 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the four files below, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red row in the four files after step 4 is never an exception.

## Steps

"The four files" means, from `open-brain`:
`npx vitest run tests/pipelines/session-start/g062-reads-owed.test.ts tests/pipelines/session-start/briefing-fix.test.ts tests/pipelines/session-start/t161-transcript.test.ts tests/t276-session-trailer.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/g062-reads-owed-own`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, and anything under `docs/`.
3. **Commit 1** (`G062: rows for READS OWED leaving out a file this seat wrote`).
   - `Copy-Item docs/loops/g062/g062-reads-owed.test.ts open-brain/tests/pipelines/session-start/g062-reads-owed.test.ts`.
   - Run the four files. Expect `1 failed | 3 passed (4)` files and `5 failed | 58 passed (63)` tests, all five red
     rows in g062-reads-owed.test.ts. Paste the summary and the five `x` rows.
4. **Commit 2** (`G062: READS OWED leaves out a file whose newest commit carries this seat's Claude-Session id (G-062)`).
   - `node docs/loops/g062/apply.cjs . docs/loops/g062/edits.txt` prints exactly `APPLIED 11 edits to 5 files`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - Run the four files: `63 passed (63)`.
   - `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix tests/t276-session-trailer.test.ts tests/t317-s1.test.ts tests/t317-s2.test.ts tests/t317-s3.test.ts tests/t318-s2.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground with a tool timeout of at least 40 minutes, never the 10-minute
     default). Expect 0 failed. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` (`[pass]`).
     Paste it.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1, m2, m3, m4: `node docs/loops/g062/apply.cjs . docs/loops/g062/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run the four files; paste the `Tests` line and the `x` rows (expected: m1 ->
   O1, O2, O5; m2 -> O4 only; m3 -> O3 only; m4 -> O5 only); restore with `git checkout -- open-brain/src` (this
   returns to commit 2) and check the status is empty. After m4, run the four files once more: `63 passed (63)`.
   Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 6 paths: `M .agents/SYSTEM/greeting.json`,
   `M open-brain/src/pipelines/session-start/greeting-flags.ts`, `M open-brain/src/pipelines/session-start/reads-owed.ts`,
   `M open-brain/src/pipelines/session-start/start-report.ts`, `M open-brain/src/shared/handoff-guard.ts`,
   `A open-brain/tests/pipelines/session-start/g062-reads-owed.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/g062-reads-owed-own` must equal
   HEAD. `gh pr create --base master --head feat/g062-reads-owed-own --title "G062: READS OWED leaves out a file this seat wrote (G-062)" --body "Brief: docs/loops/g062-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY g062 <sha40> PR #<n>` or `BLOCKED g062 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`; `/mcp reconnect open-brain`; the next Atlas /start in sia-planner should not list a brief Atlas wrote
this session or the last (with none left: `READS OWED: none (<k> written by this seat)`). Part (b): a brief whose work
shipped.
