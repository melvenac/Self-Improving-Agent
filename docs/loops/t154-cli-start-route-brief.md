# T-154: `/start` works without open-brain: the CLI prints the same briefing `ob_start` does

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key)
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t154-reply.md. Resolve and print that absolute path FIRST (§1), before any test sets a temp HOME.

**By:** Atlas (planner), 2026-10-11, session 168. **Task:** T-154 (P0). **Tag:** `T-154`. **Decision:** D-151.
Aaron typed it to the planner: "Do T154 now. I would say let's do this CLI path." **Size:** MEDIUM.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`. **Base:** `28e41ff6b5c9edcd02ce58939960f454b03aacc1`
(origin/master after #595, T-257). If clark re-pins the base at launch, the launch prompt says so and that SHA wins.

## Why

Aaron's 2026-09-14 acceptance test for the core is: a fresh machine, one command, and `/start` works. Loop 13 (v0.39.0)
proved that the machinery runs with no `better-sqlite3`. Install, build, `sync --check`, `open-brain start` and the
SessionStart hook all exit 0. It also recorded C4 as a failure, because:

1. **`/start` only knows the MCP route.** The three `start.md` copies call `ob_start` and give no other path.
   `ob_start` lives in `server.ts`, and `server.ts` resolves `better-sqlite3` at module load. A memory-free session
   therefore dies before any handler runs, even though `ob_start` never touches the database.
2. **The CLI route prints nothing useful.** `open-brain start` (`open-brain/src/cli.ts:189-215`) still prints
   `State: SUMMARY loaded` / `Inbox: INBOX loaded`. These are booleans, the exact defect Step-Back Part 1 found in
   `ob_start` in September; it was fixed there and never here.
3. **A session cannot find the CLI.** Nothing tells it where the CLI is.

**The fix:**

- The whole `ob_start` report moves out of `server.ts` into a module with no memory imports. `ob_start` and the CLI
  both call that module, so they print the same text.
- The SessionStart hook prints the exact CLI command for this checkout.
- `/start` says: if there are no open-brain tools, run that command and print its briefing.

## The design (planner rulings; do not re-decide)

| Choice | Ruling |
|---|---|
| Where the report lives | New file `open-brain/src/pipelines/session-start/start-report.ts`. It must **not** import `server.ts` or any file in `MEMORY_SIDE` (`open-brain/src/pipelines/sync/checks.ts:2057`). `/sync`'s `module-boundary` check enforces this. |
| What moves | The body of `handleStart` (`server.ts:265-527`), **byte for byte**: everything from `const projectRoot = …` through building `text` with its `Total returned words` suffix. Also the four server-local helpers it uses: `sizesFor` (`server.ts:247`), `versionAdviceFor` (`:542`), `STATE_FILE_LABEL` (`:235`) and `isSeat` (`:1752`). `isSeat` is also used by `handleState` (`server.ts:582`), so export it and import it back into `server.ts`. |
| What stays in `server.ts` | `writeSessionId()` and the MCP wrapping. `handleStart` becomes: `const proven = writeSessionId();` then `const r = await renderStartReport({ projectRoot: resolve(args.project_root ?? "."), proven, servingBuildDir: args.serving_build_dir, stateBudgetLines: args.state_budget_lines });` then `return { content: [{ type: "text", text: r.text }], ...(r.isError ? { isError: true } : {}) };`. The existing `catch` (`ob_start error: …`) stays in `handleStart`. |
| The signature | `export interface StartReportInput { projectRoot: string; proven: { id: string \| null; reason?: string }; servingBuildDir?: string; stateBudgetLines?: number }` / `export interface StartReport { text: string; isError: boolean }` / `export async function renderStartReport(input: StartReportInput): Promise<StartReport>`. Where the moved body read `args.serving_build_dir` and `args.state_budget_lines`, it reads `input.servingBuildDir` and `input.stateBudgetLines`. Where it read `proven` from `writeSessionId()`, it reads `input.proven`. Nothing else in the body changes. |
| The CLI | In `cli.ts`, the `start` branch keeps `parseOrRefuse(COMMAND_SPECS.start, …)` exactly as it is. Then it does `const { renderStartReport } = await import("./pipelines/session-start/start-report.js");` and `const r = await renderStartReport({ projectRoot, proven: { id: null, reason: "CLI start: no MCP server process, so no session is proven (T-154)" } });`, then `console.log(r.text); process.exitCode = r.isError ? 1 : 0;`. The old printing (`cli.ts:197-215`) is deleted. |
| The hook line | In `cli-bootstrap.ts`, directly after the `Project detected: …` line (`:185`), only when `hasAgents`: `lines.push(\`CLI start (no open-brain MCP): node "${cliPath}" start "${cwd}"\`);` where `const cliPath = fileURLToPath(new URL("./cli.js", import.meta.url)).replace(/\\/g, "/");`. Import `fileURLToPath` from `"url"`. Under the build this names `build/cli.js`; under tsx it names `src/cli.js`, and tests assert only the shape (CS-5). |
| `start.md` | Insert the paragraph in §W3 into all three copies, **identically**: `.claude/commands/start.md`, `project-template/.claude/commands/start.md`, `project-template/.cursor/commands/start.md`. Identical text keeps the `cursor-start-parity` and mirror checks green with no edit to `docs/loops/cursor-start-differences.json`. |
| Session id on the CLI route | None is proven. The report's `Session ID:` line reads `Session ID: none — CLI start: …`. Attributed writes still need `ob_set_session` through MCP, and that is out of scope. |

### W3: the paragraph, verbatim

Insert it in each `start.md` directly **after** the paragraph that starts ``Call `ob_start(project_root: "{cwd}")`.``
and **before** the next paragraph. Add a blank line before it and after it:

```markdown
**No open-brain MCP tools in this session** (no `ob_start` in your tool list, or the server failed to start): run the command on the hook's `CLI start (no open-brain MCP):` line with your shell. It prints the same report `ob_start` returns, Briefing block included, from the same code (T-154). Use its output exactly as you would `ob_start`'s, and say in FLAGS that this session has no open-brain tools. If there is no such line in the hook output, say so in FLAGS and stop.
```

### What this changes for other projects (expected, not a defect)

`classifySessionCommand` (`pipelines/bootstrap/index.ts:81`) calls a project's `/start` `OLD` when the file differs
from the template copy. After this merges, every adopted project's greeting shows the OLD `/start` warning until it
reinstalls the command. That is how a template update reaches projects. Do not suppress it.

```text
IMPACT-TARGETS: handleStart isSeat sizesFor versionAdviceFor
```

`renderStartReport` is new. `handleStart`'s callers are the MCP registration (`server.ts:889`) and tests.

**Out of scope, do not touch:**

- `.agents/` (any file)
- `docs/` (any file, including `cursor-start-differences.json`)
- `CHANGELOG.md`, `package.json`, `README.md`
- `scripts/setup.mjs`, `scripts/setup-hooks.mjs`
- every handler in `server.ts` other than `handleStart` (`isSeat` only moves)
- `pipelines/sync/*`
- `state-reader.ts`, `role-files.ts`, `briefing.ts`
- every existing test file

## The existing tests that pin this behaviour (planner-read; all must stay green, unedited)

| Test | What it pins | Expected |
|---|---|---|
| `tests/server.test.ts` `describe("handleStart")` (from line 58) | `ob_start`'s full text: state, drift, session and size blocks. | Green. The move is byte-for-byte. |
| `tests/pipelines/session-start/briefing.test.ts` (whole file, including :608 "every start.md copy says to print the block verbatim") | The briefing, and that all 3 `start.md` copies keep "the serving-build line first, then usage", `## End Briefing` and "verbatim". | Green. §W3 only adds a paragraph. |
| `tests/cli-flags.test.ts` `describe("start")` (:136) | `start --dry-run` and `start <missing dir>` refuse with exit 2 and write nothing. | Green. `parseOrRefuse` is untouched and runs first. |
| `tests/pipelines/bootstrap-fix.test.ts` :379 | The CLI's `start` prints `Project: scratch-proj v0.1.0`. | Green. The report prints the same `Project:` line. |
| `tests/cli-bootstrap.test.ts` | The hook's SESSION_UUID contract and output. | Green. One line is added after `Project detected`. |
| `tests/pipelines/sync/start-parity.test.ts`, `command-parity.test.ts`, `mirror-parity.test.ts`, `module-boundary.test.ts` | The parity and boundary checks, on fixtures. | Green. |
| `tests/pipelines/import-cmds-*.test.ts` | OLD/SIA classification of `/start`. | Green. Tests that copy the template stay `SIA`. |

## 1. Shell, Node and the reply path

PowerShell. Run these first, in this order, and paste the output:

```powershell
$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t154-reply.md"))
"REPLY_PATH=$reply"
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

If `node -v` is not `v22.*`, STOP and write `BLOCKED T-154 node <version>` to `$reply`.

## 2. Start state

Work in a fresh clone under `$env:TEMP`. Never use the main checkout `C:\Users\melve\Projects\Self-Improving-Agent`,
whose build serves every session on this machine.

```powershell
$wt = Join-Path $env:TEMP "t154-wt"
git clone -q https://github.com/melvenac/Self-Improving-Agent.git $wt
Set-Location $wt
git checkout -q -b fix/t154-cli-start-route 28e41ff6b5c9edcd02ce58939960f454b03aacc1
git rev-parse HEAD          # must print 28e41ff6b5c9edcd02ce58939960f454b03aacc1
git status --porcelain      # must print nothing
Set-Location open-brain; npm ci; Set-Location ..
```

Any mismatch: STOP, BLOCKED. **Forbidden:** `git stash`, `reset --hard`, `--force` in any form, rebase, amend, and
`cd` into any other checkout.

## 3. Commits (exactly three, in this order)

1. **Tests first, red.** Create `open-brain/tests/t154-cli-start.test.ts` and `open-brain/tests/fixtures/deny-sqlite.mjs`
   (§4). Commit message: `T-154: tests (red)`. Run the new file. CS-1, CS-2, CS-3, CS-5 and CS-6 must fail at this
   commit; CS-3b and CS-4 may pass. Paste the run.
2. **The move and the CLI.** Add `start-report.ts`, slim `handleStart`, rewrite the CLI `start` branch, and add the hook
   line, per the design table. Commit message: `T-154: ob_start's report moves to a memory-free module; open-brain start prints it; the hook names the CLI`.
3. **The `/start` paragraph.** Insert §W3 into the three `start.md` copies. Commit message: `T-154: /start falls back to the CLI when open-brain tools are absent`.

End every commit message with:

```
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

After each commit, `git status --porcelain` must be empty. At the end, `git log --oneline 28e41ff6..HEAD` must show
exactly 3 lines.

## 4. The new tests: `open-brain/tests/t154-cli-start.test.ts`

**Spawn pattern.** Use the same spawn pattern as `tests/cli-flags.test.ts:21-53`:
`spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env, timeout: 90_000 })`.
Set `env` to `{ ...process.env, HOME: home, USERPROFILE: home }`, where `home` is a fresh `mkdtempSync` directory.

**Fixture.** Each test builds a project under `mkdtempSync(join(tmpdir(), "t154-"))` containing:

- `package.json`: `{"name":"t154-fixture","version":"0.1.0"}`
- `.agents/SYSTEM/` and `.agents/SESSIONS/`
- `.agents/state.json`: a byte copy of `tests/fixtures-state/state.json`

Run `git init -q` in the fixture and commit it once, so the working-tree line has a repository to read. Remove every
temp directory in `afterEach`.

**`tests/fixtures/deny-sqlite.mjs`, exactly:**

```js
// T-154: make better-sqlite3 unresolvable in this process and every child that inherits NODE_OPTIONS.
import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "better-sqlite3" || specifier.startsWith("better-sqlite3/")) {
      throw new Error("T-154 deny: better-sqlite3 is not installed");
    }
    return nextResolve(specifier, context);
  },
});
```

To deny, set `NODE_OPTIONS` in the child env to `--import=${pathToFileURL(denyPath).href}`.

| Row | Setup | Assert |
|---|---|---|
| CS-1 | Fixture; run `start <fixtureDir>`. | Exit 0. stdout contains `## Briefing` and `## End Briefing`. stdout does **not** contain `SUMMARY loaded`. |
| CS-2 | Two fixtures A and B, built identically. Call `handleStart({ project_root: A })` in-process; run the CLI `start B`. | Take the substring from `## Briefing` through `## End Briefing` from both. Replace A's and B's absolute paths with `<ROOT>`, then replace each `Session \d+` with `Session N` and every ISO date with `<DATE>`. The two are equal (`toBe`). |
| CS-3 | Fixture; run the CLI `start <dir>` with the deny hook in `NODE_OPTIONS`. | Exit 0. stdout contains `## End Briefing`. stderr does not contain `T-154 deny`. |
| CS-3b (positive control) | Write `probe.mts` in the temp dir containing ``await import(${JSON.stringify(pathToFileURL(serverTs).href)});``, where `serverTs` is `join(import.meta.dirname, "../src/server.ts")`. Run `[tsxCli, probe.mts]` with the deny hook. | Exit code is non-zero. stderr contains `T-154 deny`. This proves the hook bites, so CS-3 passing means something. |
| CS-4 | Fixture whose `state.json` has `schema_version` set to `999`; run the CLI `start`. | Exit 1. stdout contains `STATE RECORD REFUSED`. |
| CS-5 | Fixture; spawn the hook the way `tests/cli-bootstrap.test.ts:50-57` does, in an isolated HOME with payload `{}`, cwd = fixture. | stdout has exactly one line matching `/^CLI start \(no open-brain MCP\): node "[^"]+\/cli\.js" start "(.+)"$/`. Its capture equals the cwd the hook printed on its `Project detected:` line. |
| CS-6 | Read the three `start.md` copies from the repo root (`resolve(import.meta.dirname, "../..")`). | Each contains the §W3 paragraph exactly once, as a whole line. All three paragraphs are byte-identical after normalising CRLF to LF. |

All timeouts are 120 s per test, with no real sleeps.

## 5. Mutants (edit, run, `git checkout -- <file>`, then confirm a clean tree; never commit one)

| Id | Edit | Expected red |
|---|---|---|
| M1 | `cli.ts` start branch: replace `console.log(r.text);` with `console.log("State: SUMMARY loaded");` | CS-1, CS-2, CS-3 |
| M2 | `start-report.ts`: add `import "../../server.js";` as the first import | CS-3 red (deny). `node build/cli.js sync --check` also reports `module-boundary` as an issue; paste that line. |
| M3 | `cli-bootstrap.ts`: delete the `CLI start (no open-brain MCP)` push | CS-5 |
| M4 | `project-template/.cursor/commands/start.md`: delete the §W3 paragraph | CS-6 |

For each mutant, paste the `t154-cli-start.test.ts` result line.

## 6. Test runs (desktop; never the whole suite)

```powershell
Set-Location (Join-Path $wt "open-brain")
npx tsc --noEmit; "tsc exit $LASTEXITCODE"          # expect 0
npx vitest run tests/t154-cli-start.test.ts tests/server.test.ts tests/cli-flags.test.ts tests/cli-bootstrap.test.ts tests/pipelines/bootstrap-fix.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/sync/start-parity.test.ts tests/pipelines/sync/command-parity.test.ts tests/pipelines/sync/mirror-parity.test.ts tests/pipelines/sync/module-boundary.test.ts --no-file-parallelism --testTimeout=180000
npm run build; "build exit $LASTEXITCODE"            # expect 0
node build/cli.js sync --check 2>&1 | Select-String -Pattern "module-boundary|cursor-start-parity|command-parity|mirror-parity"
```

Cap the wall-clock at 20 minutes. Afterwards, list any leftover node processes; do not kill them.

**Known red on this desktop (environmental; s168, measured at `85e7e1ac` and `378687d5`):**

- `cli-flags` R185-8: a clone under `%TEMP%` defeats its "outside the temp dir" check.
- `briefing.test.ts` QA 263 F4: stale serving build on the machine.
- `server.test.ts` T-236 slice 2.
- `end-fix-*` timeouts under load. R7 is fixed at this base by T-257 (#595).

For **any** red row in an existing file, run the same file at the base and paste both outputs:
`git stash` is forbidden, so use `git worktree add $env:TEMP\t154-base 28e41ff6`, then `npm ci` there. A red that is
also red at the base is not yours. A red that is green at the base is yours: fix it, with at most 2 attempts, then
BLOCKED.

## 7. Scope check, then push

```powershell
git diff --name-only 28e41ff6b5c9edcd02ce58939960f454b03aacc1..HEAD
```

**Allowed, and exactly these:**

- `open-brain/src/pipelines/session-start/start-report.ts`
- `open-brain/src/server.ts`
- `open-brain/src/cli.ts`
- `open-brain/src/cli-bootstrap.ts`
- `open-brain/tests/t154-cli-start.test.ts`
- `open-brain/tests/fixtures/deny-sqlite.mjs`
- `.claude/commands/start.md`
- `project-template/.claude/commands/start.md`
- `project-template/.cursor/commands/start.md`

Any other path: STOP, BLOCKED.

```powershell
git push origin fix/t154-cli-start-route
git ls-remote origin refs/heads/fix/t154-cli-start-route   # must equal git rev-parse HEAD
gh pr create --base master --head fix/t154-cli-start-route --title "T-154: /start works without open-brain (CLI prints ob_start's report)" --body "Brief: docs/loops/t154-cli-start-route-brief.md. D-151."
```

Never force-push. If the push is rejected: STOP, BLOCKED.

## 8. STOP rules

- At most 2 attempts at any one red; then BLOCKED.
- Never edit an existing test to make it pass.
- Never touch a file outside §7's list.
- A STOP still writes the reply.

## 9. Reply (write to `$reply`; the first line is the grammar)

- First line: `READY T-154 <sha40 of HEAD> PR #<n>` or `BLOCKED T-154 <one-line reason>`.
- Then, each with the command shown above its pasted output:
  - `node -v`
  - the start-state proof
  - the `T-154: tests (red)` run
  - each mutant's result line
  - tsc
  - the §6 vitest summary
  - build
  - the `sync --check` lines
  - the §7 name-only diff
  - `ls-remote` and `rev-parse`
  - the PR URL
- Name any HIGH, CRITICAL or UNKNOWN IMPACT-TARGET, and say which tests cover its callers.
- Mark anything not run `NOT RUN`.
