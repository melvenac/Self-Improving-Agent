# SIM T333: evidence-report across repos, and the opt-in run resolver - check every prediction before the brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-11-04, session 177. **Task:** T-333. **Tag:** `sim-t333`. **Base:** the START sha the
launcher names (the `sim/t333` commit: origin/master plus `docs/loops/t333/` and this file).

```text
IMPACT-TARGETS: gitResolver, evidenceReport (pipelines/store/evidence-report.ts) - unchanged; new exports only, plus the CLI branch
```

## What is measured

`docs/loops/t333/edits.txt` (4 edits, 3 files) adds `reposUnder`, `repoSetResolver`, `renderResolverScope` and
`ghRunResolver` to `pipelines/store/evidence-report.ts`, and two flags to `evidence-report`: `--repos-under <dir>` and
`--runs-repo <owner/name>`. `gitResolver`, `evidenceReport` and `renderEvidenceReport` do not change.
`docs/loops/t333/t333-evidence-repos.test.ts` is a new file, rows R1-R7. **A red row that differs from a prediction is
a result, not a failure of the run: report it and carry on.**

## Steps

You are in a fresh clone detached at START. PowerShell. Run apply.cjs from the CLONE ROOT. `$env:NO_COLOR='1'`
throughout. **Forbidden:** stash, reset --hard, force, rebase, `vitest -u`, killing processes by name, the real
`~/.claude/`, `git config` writes, `npm install`, test:heavy.

1. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. In `open-brain`: `npm ci`, then
   `node -e "require('better-sqlite3')"`. On "Could not locate the bindings file": `npm rebuild better-sqlite3`, say so.
2. `node docs/loops/t333/apply.cjs . docs/loops/t333/edits.txt` must print `APPLIED 4 edits to 3 files`.
   `Copy-Item docs/loops/t333/t333-evidence-repos.test.ts open-brain/tests/pipelines/store/t333-evidence-repos.test.ts`.
3. In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code.
4. **The two files.** In `open-brain`:
   `npx vitest run tests/pipelines/store/t333-evidence-repos.test.ts tests/pipelines/store/t332-evidence-report.test.ts tests/shared/cli-args.test.ts --no-file-parallelism --testTimeout=180000`.
   Predicted: 0 failed. Paste `Test Files`, `Tests`, and each failed row's assertion message.
5. **Mutants.** Back up once: `Copy-Item open-brain/src/pipelines/store/evidence-report.ts "$env:TEMP\t333-er.bak" -Force`.
   For each, from the clone root: apply (must print `APPLIED 1 edits to 1 files`), then in `open-brain`
   `npx vitest run tests/pipelines/store/t333-evidence-repos.test.ts --no-file-parallelism --testTimeout=180000`,
   paste the failed row names, then restore with Copy-Item from the backup (never git checkout).

   | mutant | what it does | predicted red |
   |---|---|---|
   | m1 | exact match instead of prefix | R2 only |
   | m2 | keeps every object type, not only commits | R2 only |
   | m3 | searches only the first repo for a sha | R2, R7 |
   | m4 | any gh failure reads as not found | R6 only |
   | m5 | an unreadable repo is dropped without being named | R4 only |

   After the last restore, rerun the step 4 command: predicted 0 failed.
6. **Full suite**, in `open-brain`: `npx vitest run --no-file-parallelism --testTimeout=180000` (60-minute cap).
   Predicted 0 failed, subject to T-292's flake rule: a red row alongside `Timeout calling onTaskUpdate` or a hook
   timeout is rerun alone up to 3 times, pasting every run. Paste `Test Files`, `Tests`, and the whole `Unhandled Errors`
   section if there is one.
7. **Sync.** From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`.
   Paste every line; both are predicted `[pass]`.
8. **Timing.** In `open-brain`, read-only, on this clone:
   `npx tsx -e "import('./src/pipelines/store/evidence-report.ts').then(m=>{const t=Date.now();const s=m.repoSetResolver([process.cwd()+'/..']);console.log(s.repos.length,s.skipped.length,Date.now()-t,'ms')})"`.
   Paste the line.

## Reply

First line: `SIM sim-t333 DONE` or `BLOCKED sim-t333 <reason>`. Then one section per step. Every number is pasted output
with its command. Mark anything not run `NOT RUN`. At most 2 attempts at any step.
