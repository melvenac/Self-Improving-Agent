# T295S2: ob_list and ob_stats leave the MCP server for the CLI (T-295 S2)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-295 S2 (P2). **Tag:** `t295s2`. **Size:** MEDIUM (17 edits
in 12 files, 2 new files). **Base:** the START sha the launcher names (a master that contains this brief, T-295 S1 #1003
and T-322 #1014). **Authority:** Aaron at the planner's desk, 2026-10-26: "Cut 14 to 10" (keep the 8 protocol tools plus
ob_forget and ob_store_chunk; cut ob_score and ob_feedback; move ob_stats and ob_list to the CLI). S1 (#1003) made the two
cuts; S2 moves ob_stats and ob_list.

```text
IMPACT-TARGETS: runMemoryCommand (cli-memory.ts gains two branches); the server.ts registrations are inline, no symbol
```

## Why

`ob_list` and `ob_stats` were called 1 and 2 times in a month of transcripts (s171 census); their output is a report for a
person, not a step an agent takes. S2 makes them `open-brain list [--limit <n>] [--project <dir>]` and `open-brain stats`,
printing what the tools printed, and the server registers 10 tools.

## The change, exactly

Files under `docs/loops/t295s2/`. **This build uses `edits-r2.txt` and `m5-r2.txt`, not the SIM's `edits.txt` and
`m5.txt`** (see "Delta from the SIM").
- **`knowledge-report.ts`:** copied verbatim, as a new file, to `open-brain/src/pipelines/store/knowledge-report.ts` (the
  ob_list and ob_stats bodies, returning text; memory side, so checks.ts and DYNAMIC_MEMORY_LOADS do not change).
- **`t295-s2-cli-report.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t295-s2-cli-report.test.ts`.
  C1-C4 run the real CLI against a temp store named by `KNOWLEDGE_V2_DB`.
- **`edits-r2.txt`:** 17 edits in 12 files. server.ts drops `statSync` from its fs import, plus both registrations.
  `cli-spec.ts` gains the two specs. `cli.ts` gets the forward and two usage lines. `cli-memory.ts` gets the `list` and
  `stats` branches (`list` refuses a `--limit` that is not a positive integer with exit 2, before it opens the store).
  `tests/shared/cli-args.test.ts` adds `list` and `stats` to its two pinned command lists. `tests/t295-s1-tool-cut.test.ts`
  makes R1's list the ten. `.agents/retirements.json` moves four R-011 line hashes from the server.ts referrer to a new
  `knowledge-report.ts` referrer (the lines move verbatim). `CLAUDE.md` and `README.md` say 10 tools and name the CLI
  forms. The three `start.md` copies' monthly maintenance names `node open-brain/build/cli.js list`.
- **Mutants:** `m1.txt` (list ignores `--limit`), `m2.txt` (server.ts registers ob_stats again), `m3.txt`
  (`.claude/commands/start.md` names ob_list again), `m4.txt` (list's `--limit` check removed), `m5-r2.txt` (cli.ts stops
  forwarding `stats`).

## Delta from the SIM

T-322 (#1014, merged ea3dd365 after the SIM ran) added `rematch` to two of the SIM's anchors: cli.ts's memory-forward line
(`... || command === "topics" || command === "rematch") {`) and cli-args.test.ts's sorted command list. `edits-r2.txt` is
`edits.txt` with exactly those two edits re-anchored. The result is the SIM's, plus `rematch` already in place:
`... "topics" || command === "rematch" || command === "list" || command === "stats") {`, and the sorted list carries
`"rematch"` between `"relocate"` and `"scrub-trigger-fires"`. `m5-r2.txt` is m5 on the same moved line. The other 15
edits and m1-m4 are byte-identical to the SIM's. Checked on a scratch copy of origin/master ea3dd365: `APPLIED 17 edits to
12 files`, and each mutant `APPLIED 1 edits to 1 files` on the applied tree. No other file the edits touch changed since
the SIM's base (8f8e1ebd), and no test T-322 or T-324 S2 added pins the command list.

## Measured before dispatch

QA PC SIM `sim-t295s2` (job #146) at `fd40ea11` (before T-322), ruled PASS:
- Baseline (six files, new test only): `1 failed | 5 passed (6)` files, `4 failed | 100 passed (104)`; red C1-C4 only.
- Apply: `APPLIED 17 edits to 12 files`; both tsc and `npm run build` exit 0; start.md matches the template copy; six
  files `110 passed (110)`.
- Wide run `176 passed (176)` files, `2085 passed (2085)`, with T-292's `Timeout calling onTaskUpdate` error, 0 `x` rows.
- `module-boundary [pass]` (4 dynamic memory loads); `retirements [pass]` (75 referrers by line_hashes, 0 unexpected).
- The one MISMATCH, step g: `command-tool-names` and `mirror-parity` FAILED on stale user-level copies OUTSIDE the clone
  (`C:\Users\Aaron Melven\.claude\commands` and `.cursor\commands` named `ob_list`/`ob_score` and differed from the
  template). The clone's own copies were clean. clark re-copied those dirs from master 8328ecb1 afterwards, so ob_score
  is gone there, but their `start.md` still names `ob_list` (master's does until THIS PR merges).
- Live look on a temp store: `stats` printed `## Knowledge Stats`, `Total entries: 0`, the temp path, the censuses and
  `Schema: code v6, database v6`; `list --limit 3` printed `No stored knowledge entries yet.`
- m1 -> C1, m2 -> R1, m3 -> R2, m4 -> C4, m5 -> C3.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/t295-s1-tool-cut.test.ts` R1 | edited in commit 2 (ten) | Its list loses ob_list and ob_stats; m2 proves it still guards. |
| `tests/t295-s1-tool-cut.test.ts` R2 | stays green | The three start.md copies stop naming ob_list; m3 proves it. |
| `tests/shared/cli-args.test.ts` (sorted command list; LINES) | edited in commit 2 | Both pinned lists gain `list` and `stats`; the new specs turn them red otherwise. |
| `tests/t261-s2.test.ts` R1 (exactly 4 dynamic loads) | stays green | knowledge-report.ts loads from cli-memory.ts, memory side. |
| `tests/pipelines/sync/retirements-live.test.ts` | stays green | The four hashes follow their lines. |
| `tests/t315-proxy.test.ts` (`ob_stats` as a tool name) | stays green | An opaque name sent to a fake child; it never reaches server.ts. |
| `tests/t322-rematch.test.ts` C1-C3 (spawn the CLI) | stays green | rematch's branch and forward are untouched; only `list`/`stats` join the line. |
| `src/lifecycle.ts:52` comment naming `ob_list` | not edited | A comment; no check reads it. Records follow-up. |

Any other red existing row means STOP and report `BLOCKED t295s2 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files other
than the six files, with that error or a timeout: re-run each such file alone up to 3 times; green on any run alone means
paste every run and go on, red on all 3 means STOP. Known flaky under load (seen this week, green alone):
`hub-presence.test.ts`, `state-import-r4.test.ts`, `end-fix-q3.test.ts`.

## Steps

"The six files" means, from `open-brain`:
`npx vitest run tests/t295-s2-cli-report.test.ts tests/t295-s1-tool-cut.test.ts tests/shared/cli-args.test.ts tests/t261-s2.test.ts tests/pipelines/sync/retirements-live.test.ts tests/t315-proxy.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t295s2-cli-report`. HEAD must equal START and the porcelain
   must be empty. `git merge-base --is-ancestor ea3dd36521373e91b8d6c997986c1dae3678b7db HEAD` must exit 0 (START contains
   T-322); if not, STOP: `BLOCKED t295s2 START lacks #1014`. In `open-brain`: `npm ci`, then
   `node -e "require('better-sqlite3')"` (on a bindings error run `npm rebuild better-sqlite3` and say so). Run every
   `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy,
   `vitest -u`, killing processes by name, the real `~/.claude/` (and its knowledge store), any MCP config, and anything
   under `docs/`.
3. **Commit 1** (`T295S2: rows for the list and stats CLI commands`).
   - `Copy-Item docs/loops/t295s2/t295-s2-cli-report.test.ts open-brain/tests/t295-s2-cli-report.test.ts`.
   - Run the six files. Expect `1 failed | 5 passed (6)` files and red C1-C4 only (the SIM's `4 failed | 100 passed (104)`
     was at fd40ea11; a different passing total from T-322's spec is fine, a different red set is not). Paste the summary
     and each `x` row. Commit the test file.
4. **Commit 2** (`T295S2: ob_list and ob_stats move from the MCP server to the CLI (T-295 S2)`).
   - `Copy-Item docs/loops/t295s2/knowledge-report.ts open-brain/src/pipelines/store/knowledge-report.ts`.
   - From the clone root: `node docs/loops/t295s2/apply.cjs . docs/loops/t295s2/edits-r2.txt` prints exactly
     `APPLIED 17 edits to 12 files`. NOT `edits.txt`: its two moved anchors fail on this base.
   - In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (each exit 0). From the
     clone root: `Compare-Object (Get-Content .claude/commands/start.md) (Get-Content project-template/.claude/commands/start.md)`
     prints nothing.
   - Run the six files: 0 failed.
   - `npx vitest run tests/server.test.ts tests/pipelines tests/shared tests/t315-proxy.test.ts tests/t261-s2.test.ts tests/t295-s1-tool-cut.test.ts tests/t295-s2-cli-report.test.ts tests/t322-rematch.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait). Expect
     0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync --check 2>&1 | Select-String -Pattern "command-tool-names|mirror-parity|module-boundary|retirements"`;
     paste every line. Must show `module-boundary [pass]` with `4 dynamic memory load(s)` and `retirements [pass]` with 0
     unexpected. `command-tool-names` / `mirror-parity` lines that name ONLY files under `C:\Users\Aaron Melven\.claude\`
     or `\.cursor\` (expected: their `start.md` still names `ob_list` until this merges and the copies are refreshed) are
     environment: say which files and go on. A line naming any file in the clone means STOP.
   - Commit `open-brain/src/pipelines/store/knowledge-report.ts` and the 12 edited files.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Live look**, from the clone root, against a temp store (never the real one):
   `$env:KNOWLEDGE_V2_DB = "$env:TEMP\t295s2-live.db"`; `node open-brain/build/cli.js stats`;
   `node open-brain/build/cli.js list --limit 3`; `node open-brain/build/cli.js list --limit x; "exit $LASTEXITCODE"`; then
   `Remove-Item Env:KNOWLEDGE_V2_DB` and delete `$env:TEMP\t295s2-live.db*`. Paste all output (expected: `## Knowledge Stats`
   with `Total entries: 0` and a `Schema:` line; `No stored knowledge entries yet.`; `list refused` and `exit 2`).
7. **Mutants**, on the COMMITTED fix: for each of m1, m2, m3, m4 (`docs/loops/t295s2/<m>.txt`) and m5
   (`docs/loops/t295s2/m5-r2.txt`): `node docs/loops/t295s2/apply.cjs . <file>` prints `APPLIED 1 edits to 1 files`; run
   `npx vitest run tests/t295-s2-cli-report.test.ts tests/t295-s1-tool-cut.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> C1; m2 -> R1; m3 -> R2; m4 -> C4; m5 -> C3; each only that
   row); restore with `git checkout -- open-brain .claude` and check the status is empty. After m5, run the six files once
   more: 0 failed. Never commit a mutant.
8. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 14 paths:
   `M .agents/retirements.json`, `M .claude/commands/start.md`, `M CLAUDE.md`, `M README.md`,
   `M open-brain/src/cli-memory.ts`, `M open-brain/src/cli-spec.ts`, `M open-brain/src/cli.ts`,
   `A open-brain/src/pipelines/store/knowledge-report.ts`, `M open-brain/src/server.ts`,
   `M open-brain/tests/shared/cli-args.test.ts`, `M open-brain/tests/t295-s1-tool-cut.test.ts`,
   `A open-brain/tests/t295-s2-cli-report.test.ts`, `M project-template/.claude/commands/start.md`,
   `M project-template/.cursor/commands/start.md`.
9. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t295s2-cli-report` must equal HEAD.
   `gh pr create --base master --head feat/t295s2-cli-report --title "T295S2: ob_list and ob_stats move from the MCP server to the CLI (T-295 S2)" --body "Brief: docs/loops/t295s2-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t295s2 <sha40> PR #<n>` or `BLOCKED t295s2 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

sia-rebuild on the main checkout. Re-copy `start.md` from master to `~/.claude/commands/` and (the cursor template's) to
`~/.cursor/commands/` on the desktop, and ask clark to do the same on the QA PC (then command-tool-names is clean there).
Live check: `node <main>/open-brain/build/cli.js stats` and `list --limit 3` against the real store print what the tools
printed; a seat's open-brain tool list drops to 10 after its next call through the build proxy (if it does not, `/mcp`
reconnect open-brain). Records follow-up: `src/lifecycle.ts:52` comment, `.agents/SYSTEM/PRD.md:54` and `TESTING.md:17`
still list the old tools.
