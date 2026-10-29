# SIM T261Y: move `yaml` to dependencies (open-brain) - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-29, session 175. **Task:** T-261 (P3), its small separable item. **Tag:** `sim-t261y`.
**Authority:** deps are an SG-1 exclusion. Aaron ruled 2026-10-29 (AskUserQuestion in the planner's window, question
"Move `yaml` to dependencies?"): "Move it (Recommended)".

## What is measured

`open-brain/src/planner-hook/prfiles.ts:4` does `import { parse as parseYaml } from "yaml";` at run time, but
`open-brain/package.json` lists `yaml` (`^2.9.1`, locked 2.9.1, no dependencies of its own) under devDependencies. A
production install (`npm ci --omit=dev`) leaves it out, and the planner hook then fails to load. The change moves the
one line from devDependencies to dependencies (same range) and regenerates the lockfile with npm, never by hand.

Devdependency import audit (planner, `git grep` over open-brain/src at the base): `@types/better-sqlite3`,
`@types/node`, `tsx`, `typescript`, `vitest`: no import in src. `yaml`: prfiles.ts only. So `yaml` is the only
devDependency used at run time. (`better-sqlite3` is an optionalDependency and is installed by `--omit=dev`.)

Files under `docs/loops/t261y/`: `edits.txt` (2 edits in open-brain/package.json), `apply.cjs`. No test file and
no mutants: this is a manifest change with no logic; the measurement in step d/f is the test.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`; `npm -v`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci` (exit code), `npm run build` (exit code).
b. Print the sha256 (first 16 hex) of `docs/loops/t261y/edits.txt` and `docs/loops/t261y/apply.cjs`.
c. Helper for the production probe (used in d and f). From the clone root, as a function:
   ```
   function Probe($tag) {
     $p = "$env:TEMP\t261y-$tag"; if (Test-Path $p) { Remove-Item -Recurse -Force $p }
     New-Item -ItemType Directory $p | Out-Null
     Copy-Item open-brain/package.json, open-brain/package-lock.json $p
     Copy-Item -Recurse open-brain/build "$p/build"
     Push-Location $p; npm ci --omit=dev 2>&1 | Select-Object -Last 3; "npm ci exit $LASTEXITCODE"
     "yaml dir: $(Test-Path node_modules/yaml)"
     node -e "import('./build/planner-hook/prfiles.js').then(()=>console.log('PROBE ok'),e=>console.log('PROBE FAIL',e.code,e.message.split('\n')[0]))"
     Pop-Location
   }
   ```
d. Baseline probe: `Probe before`. Paste its output.
e. Apply: `node docs/loops/t261y/apply.cjs . docs/loops/t261y/edits.txt` (paste output). In `open-brain`:
   `npm install --package-lock-only` (exit code). From the clone root paste `git diff --stat` and
   `git diff open-brain/package-lock.json` in full. Then in `open-brain`: `npm ci` (exit code), `npx tsc --noEmit`,
   `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (exit codes).
f. After probe: `Probe after`. Paste its output.
g. In `open-brain`:
   `npx vitest run tests/planner-hook tests/pipelines/sync --no-file-parallelism --testTimeout=180000` (30-minute cap).
   Paste the `Test Files`, `Tests` and any `Errors` lines and every `x` row with its assertion message. A red row from
   the known-flaky list, or beside T-292's `Timeout calling onTaskUpdate`: re-run that file alone up to 3 times and
   paste each. Known flaky under load: hub-presence, state-import-r4, end-fix-q3, t159-fast-path N3, record-erasure
   R179, `tests/pipelines/session-start/latest-brief.test.ts` (hook timeout), `tests/server.test.ts` handleSync,
   `tests/shared/state-writer-notes.test.ts` T171-D1.
h. From the clone root: `node open-brain/build/cli.js sync` and paste every line matching
   `version|package|dependenc|retirements|module-boundary`.
i. Final `git status --porcelain`.

## Predicted

- a: npm ci and build exit 0.
- d: `npm ci exit 0`, `yaml dir: False`, `PROBE FAIL ERR_MODULE_NOT_FOUND Cannot find package 'yaml' ...`.
- e: `APPLIED 2 edits to 1 files`. `git diff --stat`: 2 files, `open-brain/package.json` and
  `open-brain/package-lock.json`, small. The lockfile diff touches only the root `packages[""]` entry (yaml moves from
  `devDependencies` to `dependencies`) and `node_modules/yaml` (its `"dev": true` line removed). No version changes,
  no other package entry changes (another package's optional peer reference to `yaml` stays as is). All exit codes 0.
  If ANY other lockfile entry changes, say so and STOP after pasting the diff.
- f: `npm ci exit 0`, `yaml dir: True`, `PROBE ok`.
- g: all green (or known-flaky only, green alone).
- h: no FAIL line; retirements and module-boundary pass.
- i: `M open-brain/package.json`, `M open-brain/package-lock.json` only.

## Reply format

First line: `READY sim-t261y <START sha8> ALL PASS` when every prediction held, else `READY sim-t261y <START sha8> MISMATCH`
followed by a "Differed from the prediction" section first. Then a-i in order, pasted outputs only.
