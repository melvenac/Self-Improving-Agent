# T-283: the heavy suite's vitest arguments carry no path (an absolute --outputFile splits on a space under shell:true)

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t283-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-283 (P2). **Tag:** `T-283`. **Size:** SMALL.
**Base:** `88b2c8d40645e9508a291bbb34c4e2c8d9badfc4` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: main (open-brain/src/cli-suite-run.ts: only the vitest spawn in its last branch; new module open-brain/src/suite-vitest.ts exporting suiteVitestArgs and SUITE_VITEST_REPORT; covered by tests/t283-suite-vitest-args.test.ts, tests/suite-run-meta.test.ts, tests/t168-owner-wired.test.ts)
```

## Why

T-283 (read its note). `open-brain/src/cli-suite-run.ts:244-251` at the base:

```ts
        const jsonOut = join(process.cwd(), "suite-vitest.json");
        const r = spawnSync("npx", ["vitest", "run", "--reporter=json", "--outputFile", jsonOut], {
          encoding: "utf8",
          shell: true,
          cwd: process.cwd(),
        });
        vitestExit = r.status ?? 1;
        if (existsSync(jsonOut)) counts = vitestCountsFromJson(JSON.parse(readFileSync(jsonOut, "utf8")));
```

Under `shell: true`, Node joins the arguments with spaces and quotes none of them. From a cwd that holds a space,
`--outputFile` receives only the text before the first space, and the rest arrive as separate arguments, which vitest
reads as test-file filters (`vitest run [...filters]`). `existsSync(jsonOut)` is then false, `counts` stays null, and
`suite-run-meta.json` records no counts. The QA PC's home is `C:\Users\Aaron Melven`, and `npm run test:heavy` runs
there (the owed T-168 and T-268 live checks).

**Planner-run proof** (Node v22.23.2, the exact spawn shape, a fake `npx.cmd` first on PATH that prints the argv it
receives, cwd `<tmp>\dir with space`):
- today: `["vitest","run","--reporter=json","--outputFile","<tmp>\\dir","with","space\\suite-vitest.json"]`
- the fix (a relative name): `["vitest","run","--reporter=json","--outputFile","suite-vitest.json"]`
- without a shell, `spawnSync("npx", …)` fails with ENOENT, and `spawnSync("npx.cmd", …)` with EINVAL (Node refuses a
  `.cmd` without a shell since CVE-2024-27980). **So `shell: true` stays.**

The relative name lands exactly at `jsonOut`:
- vitest 3.2.4 (the lock's version) resolves `--outputFile` against `config.root`.
  `JsonReporter.writeReport` does `resolve(this.ctx.config.root, outputFile)`.
- `open-brain/vitest.config.ts` sets `root: "."`, which is the cwd.
- The spawn's `cwd` is `process.cwd()`.

## Ruling (exact)

**Why a new module and a new test file:** T-269 is already launched tonight. It edits `cli-suite-run.ts` line 22 (the
`suite-census.js` import) and `:200`. It also edits `tests/suite-run-meta.test.ts`: the `presence()` helper, plus rows at
the end of its last describe. Line 23's import, or a describe appended at the end of that test file, would touch lines
adjacent to T-269's hunks, so the second of the two PRs to merge would conflict. This brief keeps clear of all of them.

1. **New file `open-brain/src/suite-vitest.ts`** (no imports), exactly:
   ```ts
   /** The heavy suite's vitest JSON report, written in the suite's cwd (T-283). Not the SUITE_VITEST_JSON env var, which names a test fixture. */
   export const SUITE_VITEST_REPORT = "suite-vitest.json";

   /**
    * T-283: the arguments for `npx vitest` in cli-suite-run.ts, which runs under shell:true (Windows reaches npx.cmd only
    * through a shell). Node joins shell arguments with spaces and quotes none of them, so no element may hold a path: an
    * absolute --outputFile split on a cwd with a space (the QA PC's home). vitest resolves --outputFile against
    * config.root, which vitest.config.ts sets to the cwd.
    */
   export function suiteVitestArgs(): string[] {
     return ["vitest", "run", "--reporter=json", "--outputFile", SUITE_VITEST_REPORT];
   }
   ```
2. **`open-brain/src/cli-suite-run.ts`:**
   - Lines 22 and 23 stay unchanged. Add one line directly after line 30 (`} from "./suite-owner.js";`):
     `import { SUITE_VITEST_REPORT, suiteVitestArgs } from "./suite-vitest.js";`.
   - Lines 244-245 become exactly:
     ```ts
             // T-283: shell:true joins arguments unquoted, so the report name is relative; jsonOut stays absolute for the read.
             const jsonOut = join(process.cwd(), SUITE_VITEST_REPORT);
             const r = spawnSync("npx", suiteVitestArgs(), {
     ```
   - Lines 246-251 stay unchanged: `encoding: "utf8"`, `shell: true`, `cwd: process.cwd()`, the status and the read.
3. **Nothing else changes.** Out of scope: replacing npx with `process.execPath` plus vitest's own entry (a spawn with no
   shell), and Node 24's DEP0190 warning for arguments with `shell: true` (Node 22 is the tested version).

## Existing tests (planner-read at 88b2c8d4; verdicts)

- `tests/suite-run-meta.test.ts`: every existing row **stays green**. Its CLI rows set the `SUITE_VITEST_JSON` env var (lines 168,
  342, 378, 418, 444 and 454) or refuse before vitest, so none of them reaches the npx branch.
- `tests/t168-owner-wired.test.ts`: **stays green**. It sets the `SUITE_VITEST_JSON` env var at :59 and `SUITE_DRY_RUN` at :104.
- `tests/t268-owner-session-proof.test.ts` and `tests/t270-table-control-chars.test.ts`: **stay green**. The
  `cli-suite-run.ts` text there is a process-table command line, not a spawn.
- No test at the base names `suite-vitest.json` or `--outputFile` (git grep over `open-brain/tests` finds none), so no
  test depends on the absolute path. Neither edited src file is pinned in `.agents/retirements.json`.
- Any other newly failing row: STOP, `BLOCKED T-283 <row>`.

## New rows

They go in a NEW file `open-brain/tests/t283-suite-vitest-args.test.ts`, in one
`describe("T-283 the vitest arguments carry no path", …)`. It imports `SUITE_VITEST_REPORT` and `suiteVitestArgs` from
`../src/suite-vitest.js`, and the vitest and node built-ins it needs. Do not edit `tests/suite-run-meta.test.ts`.
- **P1:** `expect(suiteVitestArgs()).toEqual(["vitest", "run", "--reporter=json", "--outputFile", "suite-vitest.json"])`
  and `expect(SUITE_VITEST_REPORT).toBe("suite-vitest.json")`.
- **P2:** for every element `a` of `suiteVitestArgs()`, `a.includes(process.cwd())` is false and `/[\\/ ]/.test(a)`
  is false.
- **P3 (the call site uses it):** read
  `const src = readFileSync(join(import.meta.dirname, "../src/cli-suite-run.ts"), "utf8")`. Then:
  - `src.split('spawnSync("npx", suiteVitestArgs(), {').length - 1` is 1;
  - `src` contains `const jsonOut = join(process.cwd(), SUITE_VITEST_REPORT);`;
  - `src` does not contain `"--outputFile", jsonOut`.
- **P4 (the mechanism, win32 only):** `it.skipIf(process.platform !== "win32")`.
  1. **Fixture:**
     - `const root = mkdtempSync(join(tmpdir(), "t283-"))`, with `cwd = join(root, "dir with space")` created by
       `mkdirSync`;
     - `join(root, "argv.cjs")` = `console.log(JSON.stringify(process.argv.slice(2)));\n`;
     - `join(root, "bin", "npx.cmd")` = `` `@"${process.execPath}" "${join(root, "argv.cjs")}" %*\r\n` ``.
  2. **Environment:** `const env = { ...process.env }`. Find its PATH key case-insensitively
     (`Object.keys(env).find((k) => k.toUpperCase() === "PATH")`) and prefix that value with `join(root, "bin") + ";"`.
  3. **The fixed shape:** `spawnSync("npx", suiteVitestArgs(), { encoding: "utf8", shell: true, cwd, env })`, then
     `JSON.parse(r.stdout.trim())` equals `suiteVitestArgs()`.
  4. **Control, in the same row:** the round-1 shape
     `["vitest", "run", "--reporter=json", "--outputFile", join(cwd, SUITE_VITEST_REPORT)]` with the same options gives a
     parsed argv whose length is greater than 5, and whose element 4 is not `join(cwd, SUITE_VITEST_REPORT)`. This pins
     the reason. Do not assert an exact length: the QA PC's temp path holds one more space.
  5. **Cleanup:** finish with `rmSync(root, { recursive: true, force: true })`.

## Steps

1. **Node and the reply path.** PowerShell:
   `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t283-reply.md")); "REPLY_PATH=$reply"`, then
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.**
   - Work in the fresh clone the launcher named. If it named none, run
     `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t283-wt")` and
     `Set-Location` into it.
   - Then run `git checkout -q -b fix/t283-suite-json-path 88b2c8d40645e9508a291bbb34c4e2c8d9badfc4`.
     `git rev-parse HEAD` must print that SHA, and `git status --porcelain` must be empty, else STOP, BLOCKED.
   - Run `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. If that fails, run
     `npm rebuild better-sqlite3` and say so.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout, killing any
     process by name, `npm run test:heavy`, and running `src/cli-suite-run.ts` for real (it takes the machine lease).
     Edit nothing under `open-brain/src` except rulings 1 and 2, and the mutants in step 6, which are always reverted.
3. **Commit 1, `T-283: tests (red)`:** rows P1 to P4 and the import. In `open-brain`, with a 10-minute cap, run
   `npx vitest run tests/t283-suite-vitest-args.test.ts tests/suite-run-meta.test.ts tests/t168-owner-wired.test.ts tests/t268-owner-session-proof.test.ts tests/t270-table-control-chars.test.ts --no-file-parallelism --testTimeout=180000`.
   P1, P2 and P3 fail, P4 fails on win32, and every existing row passes. vitest's import transform makes a missing
   export `undefined` at the call. If the whole file fails to load instead, paste that and say so: it still counts as
   red, provided step 4 turns every row green. Paste the run.
4. **Commit 2, `T-283: the heavy suite's vitest arguments carry no path (a relative --outputFile under shell:true)`:**
   rulings 1 and 2. Run step 3's command again: all green. Then run `npx tsc --noEmit`, which must exit 0. Paste both.
5. **Commit messages.** End both with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline 88b2c8d4..HEAD` shows 2 lines, and `git status --porcelain` is empty.
6. **Mutants.** Edit, run `tests/t283-suite-vitest-args.test.ts` only, paste the failing rows, `git checkout -- <file>`,
   and check the tree is clean. Never commit a mutant.
   - **MU1** (`src/suite-vitest.ts`, in `suiteVitestArgs`): `"--outputFile", SUITE_VITEST_REPORT]` becomes
     `"--outputFile", process.cwd() + "\\" + SUITE_VITEST_REPORT]`. P1 and P2 go red.
   - **MU2** (`src/cli-suite-run.ts`): `spawnSync("npx", suiteVitestArgs(), {` becomes
     `spawnSync("npx", ["vitest", "run", "--reporter=json", "--outputFile", jsonOut], {`. P3 goes red.
7. **Scope.** `git diff --name-only 88b2c8d4..HEAD` must show exactly `open-brain/src/cli-suite-run.ts`,
   `open-brain/src/suite-vitest.ts` and `open-brain/tests/t283-suite-vitest-args.test.ts`. Anything else: STOP, BLOCKED.
8. **Push and PR.** `git push origin fix/t283-suite-json-path` (never force). `ls-remote` must equal `rev-parse HEAD`.
   Then run
   `gh pr create --base master --head fix/t283-suite-json-path --title "T-283: the heavy suite's vitest arguments carry no path" --body "Brief: docs/loops/t283-suite-json-path-space-brief.md. Code PR."`.
   Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion. P4 is skipped
   on Linux CI, so the local win32 run in step 4 is its evidence.

## Reply

- **First line:** `READY T-283 <sha40> PR #<n>` or `BLOCKED T-283 <reason>`.
- **Then each command with its output:** the red run, the green run, tsc, both mutants, the name-only diff,
  `ls-remote` = `rev-parse`, the PR URL and CI.
- **Pasting:** paste test output with `grep -a`, or without grep. Mark anything not run `NOT RUN`.
- **Limits:** at most 2 attempts at a red.
- If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
