# T-154 fix 1: the CC Opus review's three findings on PR #602

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key)
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t154-fix-1-reply.md. Resolve and print that absolute path FIRST, before any test sets a temp HOME.

**By:** Atlas (planner), session 168, 2026-10-11. **Task:** T-154. **Tag:** `T-154-fix-1`. **Parent brief:**
`docs/loops/t154-cli-start-route-brief.md`. Its rules all still hold (forbidden git, the known-red list, never the
whole suite, single-process vitest) except where this file changes them. **Review:** CC Opus at `d67fbe3d`,
VERDICT CHANGES, reply `C:\Users\melve\AppData\Local\Temp\t154-review-reply.md`. Read it first; it has the
failing inputs. **Size:** SMALL.

**Start:** branch `fix/t154-cli-start-route` at `d67fbe3dd656eda9664786e85dddf8c91208f6f6` (PR #602's head). New
commits go on top of it on the same branch. Never rebase, amend, `reset` in any form, or force-push. If commit 1
needs redoing, make a new commit instead.

```text
IMPACT-TARGETS: renderStartReport handleStart
```

## Rulings on the findings (planner; do not re-decide)

| # | Finding | Ruling |
|---|---|---|
| F1 | `start-report.ts:207` hard-codes `callerLabel: "open-brain MCP server"`, so the CLI route names the wrong process (G-033). | **Accept, with the reviewer's fix.** `StartReportInput` gains a REQUIRED field `callerLabel: string`. The `describeHubPresence` call passes `callerLabel: input.callerLabel`. `handleStart` passes `callerLabel: "open-brain MCP server"`; `cli.ts` passes `callerLabel: "open-brain CLI (start)"`. |
| F2 | `cli-bootstrap.ts:188` puts `cwd` raw inside double quotes, so `$name` and the PowerShell backtick expand. | **Accept, with a different fix.** The reviewer's "double any embedded `'`" is literal in PowerShell but **not in bash**, where `'a''b'` is `ab`, so it is not adopted. Instead: normalise BOTH paths with `.replace(/\\/g, "/")`, then single-quote both: `` `CLI start (no open-brain MCP): node '${cliPath}' start '${cwdPath}'` ``. If **either** normalised path contains `'`, print this line instead, with no runnable command: `` `CLI start (no open-brain MCP): unavailable — a path contains a single quote: ${offendingPath}` ``. Inside single quotes `$` and the backtick are literal in both shells, and a drive root prints as `'C:/'`. |
| F3 | The `start.md` paragraph says "Use its output exactly as you would `ob_start`'s", but the CLI never reuses a session log. | **Accept, as a text fix.** The CLI keeps creating a log per run; renderStartReport's behaviour does not change. Replace the paragraph in all three copies with §P below, byte-identical. |
| Nit 3 | `open-brain start ..` passes an unresolved relative path. | **Take it.** In `cli.ts`, pass `projectRoot: resolve(projectRoot)` (import `resolve` from `node:path` if it is not already imported). |
| Nits 1, 2 | `server.test.ts:606` is timing-sensitive; the serving-build wording assumes a server. | **Not taken.** `server.test.ts` is an existing test file, and the wording is cosmetic. |

### §P: the paragraph, verbatim (replaces the current one in all three `start.md` copies)

```markdown
**No open-brain MCP tools in this session** (no `ob_start` in your tool list, or the server failed to start): run the command on the hook's `CLI start (no open-brain MCP):` line with your shell, **once per session**. It prints the same report `ob_start` returns, Briefing block included, from the same code (T-154), with two differences: it proves no session (`Session ID: none — …`), and it creates a new session log on every run instead of reusing one. On a repeat `/start`, reuse the output you already have; a missing reuse note is expected on this route and is not a registration fault. Say in FLAGS that this session has no open-brain tools. If the hook printed no such line, or the line says `unavailable`, say so in FLAGS and stop.
```

The three copies:

- `.claude/commands/start.md`
- `project-template/.claude/commands/start.md`
- `project-template/.cursor/commands/start.md`

## Commits (exactly two)

1. **`T-154 fix 1: tests (red)`**, editing only `open-brain/tests/t154-cli-start.test.ts`:
   - **CS-5:** change the regex to `/^CLI start \(no open-brain MCP\): node '([^']+\/cli\.js)' start '([^']+)'$/`. The second capture must equal the hook's cwd with `\` replaced by `/`.
   - **CS-5b (new):** a fixture directory named `t154 $proj` (a literal dollar sign) with `.agents/`. The hook's line contains `` start '<…>/t154 $proj' `` literally, and no `"` appears in that line.
   - **CS-5c (new):** a fixture directory named `t154 it's` with `.agents/`. The hook prints exactly one line starting `CLI start (no open-brain MCP): unavailable — a path contains a single quote:`, and no line starting `CLI start (no open-brain MCP): node`.
   - **CS-6:** the expected paragraph constant becomes §P.
   - **CS-7 (new):** use `vi.mock("../src/pipelines/session-start/hub-presence.js", …)` to replace `describeHubPresence` with a function that records its `opts` and returns `{ lines: [], sourceRel: null, charCount: 0 }`. Keep every other export of that module, e.g. via `importOriginal`. Call `renderStartReport({ projectRoot: <fixture>, proven: { id: null, reason: "t" }, callerLabel: "T154-LABEL" })` in-process. The recorded `opts.callerLabel` is `"T154-LABEL"`.
   - **CS-7b (new):** read `open-brain/src/cli.ts` and `open-brain/src/server.ts` as text. `cli.ts` contains `callerLabel: "open-brain CLI (start)"`, and `server.ts` contains `callerLabel: "open-brain MCP server"`.

   Run the file and paste the result. CS-5, CS-5b, CS-5c, CS-6, CS-7 and CS-7b must be red; the rest stay green.
   If CS-7's mock cannot be made to work in 2 attempts, write `BLOCKED T-154-fix-1 CS-7 mock` and stop.
2. **`T-154 fix 1: caller label, single-quoted hook line, once-per-session paragraph`**, with the F1, F2, F3 and
   Nit 3 changes. Do not edit the test file in this commit.

End both commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. After each commit
`git status --porcelain` is empty. `git log --oneline d67fbe3d..HEAD` shows exactly 2 lines.

## Mutants (edit, run `t154-cli-start.test.ts`, `git checkout -- <file>`, confirm the tree is clean; never commit)

| Id | Edit | Expected red |
|---|---|---|
| F1-M | `start-report.ts`: pass `callerLabel: "open-brain MCP server"` to `describeHubPresence` instead of `input.callerLabel` | CS-7 |
| F2-M1 | `cli-bootstrap.ts`: quote the cwd with `"` instead of `'` | CS-5, CS-5b |
| F2-M2 | `cli-bootstrap.ts`: remove the single-quote check | CS-5c |
| F3-M | `project-template/.cursor/commands/start.md`: delete `, **once per session**` | CS-6 |

## Runs

Same commands as the parent brief §6: tsc, the same vitest file list plus `t154-cli-start.test.ts`, build, and
`sync --check` filtered. Paste each with the command above it.

## Scope (`git diff --name-only d67fbe3d..HEAD`)

Allowed, and exactly these:

- `open-brain/src/pipelines/session-start/start-report.ts`
- `open-brain/src/server.ts`
- `open-brain/src/cli.ts`
- `open-brain/src/cli-bootstrap.ts`
- `open-brain/tests/t154-cli-start.test.ts`
- `.claude/commands/start.md`
- `project-template/.claude/commands/start.md`
- `project-template/.cursor/commands/start.md`

Any other path: STOP, BLOCKED.

## Push and reply

```powershell
git push origin fix/t154-cli-start-route
git ls-remote origin refs/heads/fix/t154-cli-start-route   # must equal git rev-parse HEAD
```

If the push is rejected (someone moved the branch), STOP with `BLOCKED T-154-fix-1 push rejected`. Do not pull and
merge.

The reply's first line is `READY T-154-fix-1 <sha40> PR #602` or `BLOCKED T-154-fix-1 <reason>`. Then paste, each
with its command shown above it:

- the red run
- each mutant's result line
- tsc
- vitest
- build
- `sync --check`
- the name-only diff
- `ls-remote` and `rev-parse`

Mark anything not run `NOT RUN`.
