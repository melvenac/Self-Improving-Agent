# T261y: yaml moves to open-brain's dependencies, so a production install loads the planner hook (T-261)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-29, session 175. **Task:** T-261, its small yaml item (P3). **Tag:** `t261y`.
**Size:** SMALL (open-brain/package.json, 2 edits; package-lock.json regenerated). **Base:** the START sha the launcher
names (a master that contains this brief). **Authority:** Aaron, 2026-10-29, AskUserQuestion in the planner's window:
"Move it (Recommended)". Dependencies are an SG-1 exclusion; this ruling is the authority. Merge under D-163 (Atlas's
QA ACCEPT).

## Why

`open-brain/src/planner-hook/prfiles.ts:4` imports `yaml` at run time, but package.json lists `yaml` under
devDependencies. A production install (`npm ci --omit=dev`) leaves it out and the planner hook fails to load. The QA PC
SIM measured exactly that: `PROBE FAIL ERR_MODULE_NOT_FOUND Cannot find package 'yaml'`. `yaml` is the only
devDependency imported in src (`@types/*`, `tsx`, `typescript`, `vitest` are not; `better-sqlite3` is an
optionalDependency, which `--omit=dev` installs). The change moves `yaml` (same range `^2.9.1`, locked 2.9.1, no
dependencies of its own) into dependencies.

## The change, exactly

- **`docs/loops/t261y/edits.txt`:** 2 edits in `open-brain/package.json` (yaml out of devDependencies, into
  dependencies).
- **`open-brain/package-lock.json`:** REGENERATED, never hand-edited, with npm 11.19.0 (see below).

## Measured before dispatch

QA PC SIM `sim-t261y` (job #382) at `896803e0`: MISMATCH, on the lockfile tool only.
- Probe BEFORE the change: `npm ci exit 0`, `yaml dir: False`,
  `PROBE FAIL ERR_MODULE_NOT_FOUND Cannot find package 'yaml' imported from ...\build\planner-hook\prfiles.js`, as
  predicted.
- `edits.txt`: `APPLIED 2 edits to 1 files`; the package.json diff was exactly the yaml move.
- `npm install --package-lock-only` with the QA PC's npm 10.9.9 produced the two predicted lockfile hunks
  (`packages[""]` yaml move; `node_modules/yaml` loses `"dev": true`) AND removed the `"libc": [...]` arrays from 13
  `node_modules/@rollup/rollup-linux-*` optional entries. No versions changed. The committed lockfile was written by a
  newer npm that records `libc`; the desktop's npm is 11.19.0.
- Ruling (planner): regenerate with `npx -y npm@11.19.0`, so the lockfile diff is only the yaml move.

## Existing tests (verdicts)

No test pins package.json's dependency lists; `tests/planner-hook` and `tests/pipelines/sync` (sync checks the
package and version) must stay green. Any other red existing row means STOP and report `BLOCKED t261y <test name>`.
Exceptions, from T-292 load on the shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green:
paste it and go on. Red rows or file-level hook timeouts with that error or a timeout: re-run each such file alone up to
3 times; green on any run alone means paste every run and go on, red on all 3 means STOP. Known flaky under load:
hub-presence, state-import-r4, end-fix-q3, t159-fast-path N3, record-erasure R179,
`tests/pipelines/session-start/latest-brief.test.ts` (hook timeout, T-292 signature), `tests/server.test.ts` handleSync
`runs sync on project root` (5 s default timeout), `tests/shared/state-writer-notes.test.ts` T171-D1.

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`;
   `npm -v` (paste). `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b build/t261y`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), `npm run build` (exit code). Run every `apply.cjs` from the CLONE
   ROOT. Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
   processes by name, the real `~/.claude/`, running `scripts/setup.mjs`, `git config` writes, any MCP config,
   hand-editing package-lock.json, any `npm install <pkg>`, and anything under `docs/`.
3. **Probe helper** (used in step 6), from the clone root, as a function:
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
4. **The edit and the lockfile.**
   - From the clone root: `node docs/loops/t261y/apply.cjs . docs/loops/t261y/edits.txt` prints exactly
     `APPLIED 2 edits to 1 files`.
   - In `open-brain`: `npx -y npm@11.19.0 -v` (paste; must print `11.19.0`), then
     `npx -y npm@11.19.0 install --package-lock-only` (exit code).
   - From the clone root paste `git diff --stat` and `git diff open-brain/package-lock.json` in full.
   - **Predicted lockfile diff:** exactly the `packages[""]` hunk(s) moving `"yaml": "^2.9.1"` from devDependencies to
     dependencies, and the `node_modules/yaml` hunk removing `"dev": true` (2-3 hunks, nothing else). **ANY other hunk
     (a `libc` removal, a version, an integrity, a new or removed entry): STOP, paste the full diff, push nothing,
     reply `BLOCKED t261y lockfile <summary>`.**
5. **Build and check** (normal npm), in `open-brain`: `npm ci` (exit 0), `npm run build` (exit 0),
   `npx tsc --noEmit` (exit 0), `npx tsc -p tsconfig.tests.json --noEmit` (exit 0).
6. **Production probe.** From the clone root: `Probe after`. Expect `npm ci exit 0`, `yaml dir: True`, `PROBE ok`.
   Anything else: STOP, `BLOCKED t261y probe`.
7. **Wide run**, in `open-brain`:
   `npx vitest run tests/planner-hook tests/pipelines/sync --no-file-parallelism --testTimeout=180000` (30-minute cap).
   Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines and the full
   assertion message of any red row.
8. **Sync.** From the clone root: `node open-brain/build/cli.js sync`; paste every line matching
   `version|package|dependenc|retirements|module-boundary`. Any of them `[fail]`: STOP.
9. **Commit** (one commit, `T261y: yaml is a runtime dependency of open-brain (planner hook) (T-261)`): stage exactly
   `open-brain/package.json` and `open-brain/package-lock.json`. The message ends with
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. `git log --oneline <START>..HEAD` shows 1 line; the
   status is empty (the build output is ignored; if anything else shows, paste it and STOP).
10. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 2 paths:
    `M open-brain/package-lock.json`, `M open-brain/package.json`.
11. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/build/t261y` must equal HEAD.
    `gh pr create --base master --head build/t261y --title "T261y: yaml is a runtime dependency of open-brain (T-261)" --body "Brief: docs/loops/t261y-brief.md."`.
    Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

No mutants: a manifest-only change; the production probe (before FAIL in the SIM, after `PROBE ok` here) is the test.

## Reply

- **First line:** `READY t261y <sha40> PR #<n>` or `BLOCKED t261y <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

The main checkout needs `npm install` (never `npm ci`: running MCP servers lock better_sqlite3.node), then
sia-rebuild. Live check: the main checkout's `node_modules/yaml` is present and `npm ls yaml --omit=dev` lists it.
