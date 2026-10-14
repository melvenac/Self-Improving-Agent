# T-172 amendment 2: the Opus review's findings (lockfile restore, V2 opens a database, backup names, hidden changes, six mutants)

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with PR #676 updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t172-r3-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-172 (P1). **Tag:** `T-172`. **Size:** MEDIUM.
**Branch:** `feat/t172-main-rebuild` at `778048db4566fc94406fd8d0f65859e38516dced` (PR #676, round 2).
**Master to merge:** the dispatch SHA clark names at launch: master with this amendment on it. If clark names none, use
`git rev-parse origin/master` after the clone's fetch, and paste it.
- Planner-checked: 778048db merges CLEAN into 6fa4b592 (`merge-check.sh`).
- None of #673, #685 or #688, which merge tonight, touches a file of this PR. #688 changes none of the four
  process-session.ts exports this module imports.
**The brief's and amendment 1's rulings stand** except where this amendment changes them:
`docs/loops/t172-main-rebuild-brief.md`, `docs/loops/t172-main-rebuild-brief-amendment-1.md`.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: mainRebuild liveSessions cause backupTime (open-brain/src/pipelines/main-rebuild/index.ts on PR #676's branch; cause is renamed runCause and exported; new export v2Args; covered by tests/pipelines/main-rebuild.test.ts)
```

## Why

Round 2 was READY at 778048db. Opus's second review came back **CHANGES**, and the planner rules every finding
**ACCEPTED**:
- **F1 (HIGH).** Master's `open-brain/package-lock.json` carries 13 `"libc"` blocks, which newer npm writes. The planner
  counted them at 6fa4b592. Node 22's npm 10.9.8 strips them, so any `npm install` in `open-brain` dirties the lock.
  - The success path exits 0 but leaves ` M open-brain/package-lock.json`, and the next run refuses at refusal 2.
  - A failure after the install cannot check out the old HEAD over the dirty lock. That is exit 4, with HEAD on the
    NEW sha and a half-emitted build that serves every session.
  - The printed by-hand recipe fails the same way.
- **F2 (MEDIUM).** better-sqlite3 loads `better_sqlite3.node` lazily, in the `Database` constructor, and `server.ts`
  opens its DB lazily. So V2's `import server.js` never loads the binding, and a broken binding passes V2 and V3.
- **F3 (MEDIUM).** `backupTime()` of a name that is not `<7>-<UTC>` sorts above every timestamp, so pruning keeps
  `README.txt` and deletes the real backups.
- **F4 (LOW).** `git status` cannot see a tracked file flagged `--skip-worktree` or `--assume-unchanged`. The review
  rebuilt a build stamped a595cf9 that carried a local edit.
- **F5 (tests).** Six mutants (MA-MF) survive.
- **Nits taken:**
  - the failure cause names the real error, not npm's banner;
  - an explicit `<sha>` that V3 calls STALE is what the operator asked for, so it exits 0, not 5;
  - the exported function refuses a dash-led positional;
  - RECONNECT mirrors the server's check that a proof's file name is its `claude_pid`.
- **Nits ruled NO CHANGE:**
  - `label7(undefined)` printing `origin/master` in refusals 2 and 3 is right, because the sha is resolved only after
    the fetch;
  - the dry run's "Nothing was changed" after a pruning fetch;
  - the Cursor wording of `/mcp reconnect`.
- `cli.ts:419`'s path resolution is covered by the planner's post-merge live check. The review also ran it for real.

## Ruling (exact; every change is in `open-brain/src/pipelines/main-rebuild/index.ts` unless named)

1. **F1, the tracked manifests are put back after every install.** Add the helper inside `mainRebuild`:
   ```ts
   // F1 (T-172 r3): npm 10.9.8 strips the "libc" fields newer npm writes, so any install dirties the tracked lock.
   const MANIFESTS = ["open-brain/package.json", "open-brain/package-lock.json"];
   const cleanManifests = (): Run => git(["checkout", "-q", "--", ...MANIFESTS]);
   ```
   a. **Step 3:** right after `npm(["install"], ob)` returns, call `cleanManifests()` BEFORE checking the install's
      status. If the install failed, throw its `StepFailure("npm install", …)` as today. If the install succeeded and
      `cleanManifests()` fails, throw `new StepFailure("npm install", \`could not put back the tracked manifests: ${runCause(c)}\`)`.
   b. **The restore:** its FIRST act, before the checkout of the old HEAD, is
      `const c0 = cleanManifests(); if (c0.status !== 0 || c0.error) throw new Error(\`git checkout -- open-brain/package*.json: ${runCause(c0)}\`);`.
      After the restore's own `npm(["install"], ob)` succeeds, call `cleanManifests()` again, with the same throw.
   c. **The by-hand recipe** in the RESTORE FAILED line becomes, exactly:
      `By hand: git checkout -- open-brain/package.json open-brain/package-lock.json; git checkout ${oldBranch ?? \`--detach ${oldHead}\`}; copy ${backup} to open-brain/build. Tell Aaron.`
2. **F2, V2 opens a database through the build's own dependency.** Export
   ```ts
   /** V2's child: import the new server.js, then construct a Database through the build's own dependency (better-sqlite3
    *  loads its native binding in the constructor, not on import; T-172 r3, F2). */
   export function v2Args(serverUrl: string): string[] {
     const u = JSON.stringify(serverUrl);
     return ["--input-type=module", "-e", `import ${u}; import { createRequire } from "node:module"; const Database = createRequire(${u})("better-sqlite3"); new Database(":memory:").close();`];
   }
   ```
   V2 calls `deps.node(v2Args(serverUrl), ob)`. The step label becomes `V2 (import server.js, open a database)`. Replace the
   two-line comment above V2 with
   `// V2: a fresh process imports the server AND opens an in-memory database: the binding loads in the constructor.`
   `v2Args`'s text holds no `import(`, so R10 stays as it is.
3. **F3, only backup names are pruned.**
   `const BACKUP_NAME = /^[0-9a-f]{7}-\d{8}T\d{9}Z$/;` at module level beside `BACKUPS_DIR`. The prune's filter becomes
   `.filter((n) => n !== basename(backup) && BACKUP_NAME.test(n))`. Nothing else in the backups directory is read,
   counted or deleted.
4. **F4, refusal 2b.** Directly after refusal 2's block:
   ```ts
   // 2b. A flag that hides a tracked file's changes from git status (T-172 r3, F4).
   const flags = git(["ls-files", "-v"]);
   if (flags.status !== 0 || flags.error) return refuse(`git ls-files failed (${runCause(flags)}).`);
   const hidden = flags.stdout
     .split(/\r?\n/)
     .filter((l) => /^(S|[a-z]) /.test(l))
     .map((l) => `${l.slice(2)} (${l[0] === "S" ? "skip-worktree" : l[0] === "s" ? "skip-worktree, assume-unchanged" : "assume-unchanged"})`);
   if (hidden.length > 0) {
     return refuse(
       `git hides changes to ${hidden.length} tracked file(s), so the build could be stamped ${label7(target)} while carrying changes that are not in it: ${hidden.join(", ")}. Clear the flag with git update-index --no-skip-worktree or --no-assume-unchanged.`,
     );
   }
   ```
5. **Nit, the cause names the real error.** Replace `cause` with an exported `runCause`, and rename every call site:
   ```ts
   const CAUSE_MAX = 300;
   /** The first line naming an error (stdout first: tsc writes its errors there, and npm's own "npm error" lines go to
    *  stderr), joined to the next line when it ends with ":" (git names the blocking file there). Else the first line. */
   function errorLine(s: string): string {
     const ls = s.split(/\r?\n/).map((l) => l.trim());
     const i = ls.findIndex((l) => /\berror\b/i.test(l));
     if (i < 0) return "";
     const next = ls.slice(i + 1).find((l) => l !== "");
     return ls[i]!.endsWith(":") && next !== undefined ? `${ls[i]} ${next}` : ls[i]!;
   }
   export function runCause(r: Run): string {
     const c = r.error ?? (errorLine(r.stdout) || errorLine(r.stderr) || firstLine(r.stderr) || firstLine(r.stdout) || `exit ${r.status}`);
     return c.length > CAUSE_MAX ? `${c.slice(0, CAUSE_MAX - 1)}…` : c;
   }
   ```
6. **Nit, an explicit `<sha>` that V3 calls STALE exits 0.** In the success block:
   - `target !== undefined`: push `REBUILT: serving build ${sha7} as asked · ${verdict.codeCommits} code commit(s) behind ${SERVING_UPSTREAM} (fetch ${fetchTime}).`
   - `target === undefined`: the round-2 line, unchanged.
   - The return's exit code becomes `verdict.kind === "stale" && target === undefined ? 5 : 0`.
7. **Nit, a dash-led positional.** Right after the "at most one `<sha>`" check:
   `if (target !== undefined && target.startsWith("-")) return refuse(\`"${target}" is not a commit: a <sha> never starts with "-".\`, 2);`
   (`target` is declared just above. Move its declaration up if needed.)
8. **Nit, a proof's file name is its pid.** In `liveSessions`, directly after the `typeof` check:
   `if (Number(n.slice(0, -".json".length)) !== proof.claude_pid) continue;`.

## Existing tests (planner-read at 778048db; verdicts)

- `R6 "STALE after the build: keep it, exit 5"` passes `positionals: [f.c3]`, so it **turns red in commit 1**. Its new
  expectations: exit 0, and the text contains `REBUILT: serving build ${f.c3.slice(0, 7)} as asked · 2 code commit(s) behind origin/master (fetch `.
  Rename it `"STALE after the build with an explicit <sha>: keep it, exit 0"`.
- Every other row in `tests/pipelines/main-rebuild.test.ts` (R1-R10, the classifier table, usage) **stays green**. R7's
  `[["install"], ["run", "build"], ["install"]]` holds, because `cleanManifests` is a git call, not npm.
- `tests/harness/s4-guards.test.ts`, `tests/cli-flags.test.ts`, `tests/shared/cli-args.test.ts`: **stay green**
  (untouched).
- Any other newly failing row: STOP, `BLOCKED T-172 <row>`.

## New rows (all in `open-brain/tests/pipelines/main-rebuild.test.ts`; RED or GREEN = their state at 778048db)

**Changes to `fakes()`** (add the options, keep every default):
- `lockRewrite?: boolean`: on `["install"]`, rewrite `join(cwd, "package-lock.json")` as
  `JSON.stringify(JSON.parse(<its text>)) + "\n"` (a minified lock, which stands in for npm 10 stripping `libc`).
- `installExit?: number`: `["install"]` returns that status, after any `lockRewrite`, with stderr
  `npm error code ERESOLVE`.
- `BuildMode` gains `"tamper-backup-exit-1"`: on `["run","build"]`, for every directory under `backupsDir(tree)`,
  overwrite its `build-info.json` with `{"commit":"0000000000000000000000000000000000000000"}`, then return
  `{ status: 1, stdout: "", stderr: "error TS2322: junk" }`.
- `v2Fail?: string`: the fake node returns `{ status: 1, stdout: "", stderr: <v2Fail> }` for a call whose joined args
  include `better-sqlite3` and not `serving-build`.

**F1.** Build at C1, `<sha>` C3, so install runs.
- **F1-a RED:** `lockRewrite`. Exit 0. `git status --porcelain` in `f.main` is empty. The lock bytes equal
  `git show HEAD:open-brain/package-lock.json`.
- **F1-b RED:** `lockRewrite` plus `build: "junk-exit-1"`, main detached at C2 first. Exit **3**, not 4. HEAD is C2,
  `git status --porcelain` is empty, and `build/` is byte-equal to the original.
- **F1-c RED:** `lockRewrite` plus `installExit: 1`, main detached at C2 first. Exit 3. The text contains
  `main-rebuild FAILED at npm install: npm error code ERESOLVE`. HEAD is C2 and the tree is clean.

**F2.** Uses the REAL node runner, `mr.defaultDeps().node`. Fixture: a temp `ob` directory holding:
- `package.json` = `{"type":"module"}`, so `build/server.js` loads as ESM, as the real open-brain's does;
- `build/server.js` = `export {};\n`;
- `node_modules/better-sqlite3/package.json` = `{"name":"better-sqlite3","main":"index.js"}`, which has no `type`, so
  the package is CommonJS;
- `node_modules/better-sqlite3/index.js`:
  `const fs = require("node:fs"), path = require("node:path"); module.exports = class Database { constructor() { if (fs.existsSync(path.join(__dirname, "FAIL"))) throw new Error("Could not locate the bindings file"); } close() {} };`

"`FAIL` present" below means an empty file at `node_modules/better-sqlite3/FAIL`.
- **V2-a RED:** `node(mr.v2Args(pathToFileURL(join(ob, "build", "server.js")).href), ob)` gives status 0.
- **V2-b RED:** the same call with `FAIL` present gives status not 0, and stderr contains
  `Could not locate the bindings file`.
- **V2-c GREEN (pins the reason):** with `FAIL` present, round 2's import-only args
  `["--input-type=module", "-e", \`import ${JSON.stringify(url)};\`]` give status **0**.
- **R6 addition RED:** in the happy-path row, also
  `expect(fk.nodeCalls.some((a) => a.join(" ").includes('new Database(":memory:")'))).toBe(true)`.

**F3 RED.** Before the run, create these under `backupsDir(f.main)`:
- the directories `aaaaaaa-20261010T120000000Z`, `bbbbbbb-20261011T120000000Z`, `ccccccc-20261012T120000000Z`,
  `manual-keep` and `x-1999`;
- the file `README.txt`.

Then run the happy path (build C1, `<sha>` C3). Afterwards the directory's entries, as a Set, are exactly
`README.txt`, `manual-keep`, `x-1999`, `bbbbbbb-20261011T120000000Z`, `ccccccc-20261012T120000000Z` and
`${f.c1.slice(0, 7)}-20261013T120000000Z`.

**F4 RED.** Each case gives exit 1, no backup directory, and `npmCalls` equal to `[]`:
- **F4-a:** `git update-index --skip-worktree open-brain/src/a.ts`, then append `// local edit\n` to it. The text
  contains `open-brain/src/a.ts (skip-worktree)`.
- **F4-b:** `git update-index --assume-unchanged open-brain/package.json`, then append ` \n`. The text contains
  `open-brain/package.json (assume-unchanged)`.

**MA GREEN.** `git checkout -q -B master <C2>` in `f.main`, build C1, `build: "junk-exit-1"`. Exit 3.
`git symbolic-ref --short HEAD` prints `master`, and `rev-parse HEAD` is C2.

**MB GREEN.** Every proof is live, by its start time, and each pid has its own tree in the table:
- 101 has a child `node C:/x/open-brain/build/server.js`;
- 105 has only a child `node C:/x/other-tool.js`;
- 106 has a child `cmd.exe /c x`, whose own child is `node C:/x/open-brain/build/server.js`.

Exactly two RECONNECT rows: pid 101 and pid 106.

**MC RED.** `deps.git` wraps the real runner. It returns
`{ status: 1, stdout: "", stderr: "error: simulated restore failure" }` for a call whose `args[0]` is `checkout` and
whose last arg equals C2. Main detached at C2, build C1, `build: "junk-exit-1"`. Exit 4. The text contains
`RESTORE FAILED: git checkout ${c2.slice(0, 7)}: error: simulated restore failure` and
`By hand: git checkout -- open-brain/package.json open-brain/package-lock.json; git checkout --detach ${f.c2}; copy `.

**MD GREEN.** `build: "tamper-backup-exit-1"`, main detached at C2, build C1. Exit 4. The text contains
`the restored stamp is 0000000, not ${f.c1.slice(0, 7)}`.

**ME GREEN.** `table: null`. Proof 101 is live, and the table is unreadable, so it has no server child. Exactly one row,
pid 101, and the text contains `(the process table could not be read, so every live proof is listed)`.

**MF RED.** `v2Fail: "Error: Could not locate the bindings file"`, main detached at C2, build C1. Exit 3. The text
contains `main-rebuild FAILED at V2 (import server.js, open a database): Error: Could not locate the bindings file`. HEAD
is C2, and `build/` is byte-equal.

**N-cause RED.** `it.each` over `mr.runCause`:

| Input | Expected |
|---|---|
| stdout `> open-brain@0.1.0-u prebuild\n> node x\n\nsrc/x.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.\n`, stderr `npm error Lifecycle script \`build\` failed with error:\nnpm error code 2\n` | `src/x.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.` |
| stderr `error: Your local changes to the following files would be overwritten by checkout:\n\topen-brain/package-lock.json\nPlease commit your changes or stash them before you switch branches.\nAborting\n` | `error: Your local changes to the following files would be overwritten by checkout: open-brain/package-lock.json` |
| `error: "spawnSync npm ETIMEDOUT"`, plus any streams | `spawnSync npm ETIMEDOUT` |
| status 3, both streams empty | `exit 3` |
| stdout `plain first line\nsecond` | `plain first line` |
| stderr `error ` followed by 400 `x` characters | 300 characters long, ending with `…` |

**N-stale.** The renamed R6 row above is RED. A new row, **GREEN**: the same fake STALE V3 with `positionals: []`. Exit
5, and the text contains `REBUILT ${f.c3.slice(0, 7)}, but origin/master now has 2 code commits past it: run main-rebuild again.`.

**N-dash RED.** `positionals: ["--upload-pack=evil"]`. Exit 2. The text contains
`"--upload-pack=evil" is not a commit: a <sha> never starts with "-".` and `npmCalls` equals `[]`.

**N-pid RED.** A live proof `101.json`, plus `107.json` holding the same bytes (`claude_pid` 101). Exactly one
RECONNECT row.

## Steps

1. **Node and the reply path.** PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t172-r3-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.**
   - Work in the fresh clone the launcher named. If it named none, run
     `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t172-r3-wt")` and
     `Set-Location` into it.
   - Run `git checkout -q -b feat/t172-main-rebuild origin/feat/t172-main-rebuild`. `git rev-parse HEAD` must print
     `778048db4566fc94406fd8d0f65859e38516dced`, and `git status --porcelain` must be empty, else STOP, BLOCKED.
   - Run `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. If that fails, run
     `npm rebuild better-sqlite3` and say so.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
     `npm run test:heavy`, killing any process by name, and running `main-rebuild` against any real checkout.
3. **Commit 1, `T-172 r3: tests for the Opus review's findings`:** the fakes changes, every new row, and the renamed R6
   row. In `open-brain`, run
   `npx vitest run tests/pipelines/main-rebuild.test.ts --no-file-parallelism --testTimeout=180000`. Exactly the rows
   marked RED fail, and every other row passes. Any other outcome: STOP, BLOCKED. Paste the run.
4. **Commit 2, `T-172 r3: lockfile put back after every install, V2 opens a database, only backup names pruned, hidden changes refused, causes name the error`:**
   rulings 1-8. Run step 3's command again (all green) and paste it.
5. **Commit 3, the merge:** `git merge --no-ff <master to merge> -m "T-172 r3: merge master <sha7>"`. No conflict is
   expected; any conflict means STOP, `BLOCKED T-172 <file>`. Paste `git diff --name-only --diff-filter=U` (empty).
6. **Commit messages:** end every one with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (for the merge, a
   second `-m`). `git log --oneline 778048db..HEAD --first-parent` shows 3 lines, and `git status --porcelain` is empty.
7. **Runs**, in `open-brain`: `npx tsc --noEmit` (exit 0), then
   `npx vitest run tests/pipelines/main-rebuild.test.ts tests/harness/s4-guards.test.ts tests/cli-flags.test.ts tests/shared tests/pipelines/sync/staleness.test.ts tests/pipelines/session-start/serving-build.test.ts tests/pipelines/session-start/stale-process.test.ts tests/pipelines/detach.test.ts tests/harness/spawn-sites.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`
   (30-minute cap; `cli-flags*` R185-8 is environmental on the desktop: prove it at 778048db if it fails). Paste both.
8. **Mutants.** Edit `src/pipelines/main-rebuild/index.ts`, run the main-rebuild file only, and paste the failing row
   names. Then `git checkout -- open-brain/src/pipelines/main-rebuild/index.ts` and check `git status --porcelain` is
   empty. Never commit a mutant. Each must turn the named rows red:

   | Mutant | Edit | Rows that go red |
   |---|---|---|
   | M8 | delete step 3's `cleanManifests()` | F1-a |
   | M9 | delete the restore's first `cleanManifests()` and its throw | F1-c |
   | M10 | `v2Args` returns round 2's import-only args | V2-b and the R6 addition |
   | M11 | drop `&& BACKUP_NAME.test(n)` | F3 |
   | M12 | delete the 2b block | F4-a and F4-b |
   | MA | `oldBranch !== null ? ["checkout","-q",oldBranch] :` → `false ? [] :` | MA |
   | MB | delete `if (!runsServer(proof.claude_pid)) continue;` | MB |
   | MC | the restore failure's `exitCode: 4` → `3` | MC |
   | MD | the restored-stamp check → `void back7;` | MD |
   | ME | `if (table === null) return true` → `return false` | ME |
   | MF | V2's throw → `void v2;` | MF |
   | M13 | `runCause` without the two `errorLine` calls | N-cause |
   | M14 | the exit code back to `verdict.kind === "stale" ? 5 : 0` | the renamed R6 row |
   | M15 | delete ruling 7's refusal | N-dash |
   | M16 | delete ruling 8's line | N-pid |
9. **Scope.** `git diff --name-only <master to merge> HEAD` must show exactly round 2's 9 files: the 8 of round 1 plus
   `open-brain/tests/harness/s4-guards.test.ts`. Anything else: STOP, BLOCKED.
10. **Push and CI.** `git push origin feat/t172-main-rebuild` (never force). `ls-remote` must equal `rev-parse HEAD`.
    `gh pr view 676 --json mergeable,mergeStateStatus` must not say CONFLICTING. Wait for CI
    (`gh pr checks 676 --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

- **First line:** `READY T-172 <sha40> PR #676` or `BLOCKED T-172 <reason>`.
- **Then each command with its output:** the red run (with the RED and GREEN rows named), the green run, the merge's
  conflict list, tsc, step 7's run, the sixteen mutants, the name-only diff, `ls-remote` = `rev-parse`, mergeability
  and CI.
- **Pasting:** paste test output with `grep -a`, or without grep. Mark anything not run `NOT RUN`.
- **Limits:** at most 2 attempts at the red.
- If the code differs from a line this amendment quotes, follow the ruling's intent and say what differed. Do not merge.
