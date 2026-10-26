# SIM T295S2: ob_list and ob_stats leave the MCP server for the CLI - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-295 S2 (P2). **Tag:** `sim-t295s2`. **Authority:** Aaron at
the planner's desk, 2026-10-26: "Cut 14 to 10" (keep the 8 protocol tools plus ob_forget and ob_store_chunk; cut ob_score
and ob_feedback; move ob_stats and ob_list to the CLI). S1 (#1003) was the two cuts; S2 moves ob_stats and ob_list.
**Base:** START must contain #1003 (T-295 S1): every anchor below is on that tree (measured at `8f8e1ebd`, its head).

```text
IMPACT-TARGETS: runMemoryCommand (cli-memory.ts gains two branches); the server.ts registrations are inline, no symbol
```

## What is measured

- `ob_list` and `ob_stats` were called 1 and 2 times in a month of transcripts (s171 census); their output is a report
  for a person, not a step an agent takes. S2 makes them `open-brain list [--limit <n>] [--project <dir>]` and
  `open-brain stats`, printing what the tools printed.
- The bodies move verbatim to a new memory-side module, `open-brain/src/pipelines/store/knowledge-report.ts`
  (`pipelines/store/` is already in MEMORY_SIDE, so checks.ts does not change), which returns the text. Only three things
  differ: the returns, the database path (the caller's), and the schema line, read with `checkSchemaSkew` on the opened
  store. The server-instance "Session proof" line is dropped, because a CLI run has no server process to prove. The CLI
  branches live in `cli-memory.ts`, behind cli.ts's existing forward, so DYNAMIC_MEMORY_LOADS stays at 4.
- `.agents/retirements.json`: four R-011 lines (the maturity-distribution select, two census/review-queue obituary
  comments) move with the body. Their line hashes move from the server.ts referrer to a new
  `knowledge-report.ts` referrer. Moving them verbatim keeps the hashes valid (checked on a scratch copy: 0 stale,
  0 unexpected on both paths).
- The edit: 17 edits in 12 files. server.ts drops `statSync` from its fs import, plus both registrations. Two specs go in
  `cli-spec.ts`. `cli.ts` gets the forward and two usage lines. `cli-memory.ts` gets the `list` and `stats` branches;
  `list` refuses a `--limit` that is not a positive integer with exit 2, before it opens the store. Two edits in
  `tests/shared/cli-args.test.ts` add `list` and `stats` to its two pinned command lists. Two edits in
  `tests/t295-s1-tool-cut.test.ts` make R1's list the ten. One edit in `retirements.json`. `CLAUDE.md` and `README.md`
  say 10 tools and name the CLI forms. The three `start.md` copies' monthly maintenance names
  `node open-brain/build/cli.js list`, so `command-tool-names` stays clean.

Files under `docs/loops/t295s2/`:
- `t295-s2-cli-report.test.ts`: a new file, copied to `open-brain/tests/t295-s2-cli-report.test.ts`. Rows C1-C4 run the real CLI against a temp store named by `KNOWLEDGE_V2_DB`.
- `knowledge-report.ts`: a new file, copied to `open-brain/src/pipelines/store/knowledge-report.ts`.
- `edits.txt`.
- `m1.txt`: list ignores `--limit`.
- `m2.txt`: server.ts registers ob_stats again.
- `m3.txt`: `.claude/commands/start.md` names ob_list again.
- `m4.txt`: list's `--limit` check is removed.
- `m5.txt`: cli.ts stops forwarding `stats`.
- `apply.cjs`: a copy of S1's.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/t295-s1-tool-cut.test.ts` R1 | edited (ten) | Its list loses ob_list and ob_stats; m2 proves it still guards. |
| `tests/t295-s1-tool-cut.test.ts` R2 | stays green | The three start.md copies stop naming ob_list; m3 proves it. |
| `tests/shared/cli-args.test.ts` (sorted command list; LINES) | edited | Both pinned lists gain `list` and `stats`; the usage lines document exactly `--limit`, `--project`. |
| `tests/t261-s2.test.ts` R1 (exactly 4 dynamic loads) | stays green | knowledge-report.ts is loaded from cli-memory.ts, memory side; core's crossings are unchanged. |
| `tests/pipelines/sync/retirements-live.test.ts` | stays green | The four hashes follow their lines. |
| `tests/t315-proxy.test.ts` (`ob_stats` as a tool name) | stays green | An opaque name sent to a fake child; it never reaches server.ts. |
| `src/lifecycle.ts:52` comment naming `ob_list` | not edited | A comment; no check reads it. Left for a later docs pass. |

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The six files" means, from `open-brain`:
`npx vitest run tests/t295-s2-cli-report.test.ts tests/t295-s1-tool-cut.test.ts tests/shared/cli-args.test.ts tests/t261-s2.test.ts tests/pipelines/sync/retirements-live.test.ts tests/t315-proxy.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). `git merge-base --is-ancestor 8f8e1ebde132f8589e530b0c4fe34eb3c0495ffc HEAD`
   must exit 0 (START contains #1003); if not, STOP: `READY sim-t295s2 <sha8> MISMATCH START lacks #1003`. In
   `open-brain`: `npm ci`, then `node -e "require('better-sqlite3')"` (on a bindings error run `npm rebuild better-sqlite3`
   and say so).
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t295s2/`.
c. Baseline: `Copy-Item docs/loops/t295s2/t295-s2-cli-report.test.ts open-brain/tests/t295-s2-cli-report.test.ts`. Run the
   six files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
d. `New-Item -ItemType Directory -Force open-brain/src/pipelines/store | Out-Null`;
   `Copy-Item docs/loops/t295s2/knowledge-report.ts open-brain/src/pipelines/store/knowledge-report.ts`. From the clone
   root `node docs/loops/t295s2/apply.cjs . docs/loops/t295s2/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines. From the clone root: `Compare-Object (Get-Content .claude/commands/start.md) (Get-Content project-template/.claude/commands/start.md)`
   (expect no output).
e. Run the six files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/server.test.ts tests/pipelines tests/shared tests/t315-proxy.test.ts tests/t261-s2.test.ts tests/t295-s1-tool-cut.test.ts tests/t295-s2-cli-report.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes). Paste the `Test Files`, `Tests` and any
   `Errors` lines and every `x` row with its file. Red rows alongside T-292's `Timeout calling onTaskUpdate` or a
   timeout: re-run each such file alone up to 3 times and paste every run.
g. From the clone root: `node open-brain/build/cli.js sync --check 2>&1 | Select-String -Pattern "command-tool-names|mirror-parity|module-boundary|retirements"`
   and paste every line. (`~/.claude/commands` and `~/.cursor/commands` on this machine are outside the clone; a
   `command-tool-names` line naming one of them is environment, not the change. Say which files a line names.)
h. Live look, from the clone root, against a temp store (never the real one):
   `$env:KNOWLEDGE_V2_DB = "$env:TEMP\t295s2-live.db"`; `node open-brain/build/cli.js stats`; `node open-brain/build/cli.js list --limit 3`;
   `node open-brain/build/cli.js list --limit x; "exit $LASTEXITCODE"`; then `Remove-Item Env:KNOWLEDGE_V2_DB` and delete
   `$env:TEMP\t295s2-live.db*`. Paste all output.
i. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/pipelines/store/knowledge-report.ts "$env:TEMP\t295s2-kr.bak"`,
   `Copy-Item open-brain/src/server.ts "$env:TEMP\t295s2-server.bak"`,
   `Copy-Item .claude/commands/start.md "$env:TEMP\t295s2-start.bak"`,
   `Copy-Item open-brain/src/cli-memory.ts "$env:TEMP\t295s2-clim.bak"`,
   `Copy-Item open-brain/src/cli.ts "$env:TEMP\t295s2-cli.bak"`. For each of m1..m5:
   `node docs/loops/t295s2/apply.cjs . docs/loops/t295s2/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/t295-s2-cli-report.test.ts tests/t295-s1-tool-cut.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and every `x` row; restore all five from their backups with `Copy-Item ... -Force`. Never use
   `git checkout` to restore here. After m5's restore, run the six files once more and paste the `Tests` line.

## Predicted

- c: `1 failed | 5 passed (6)` files; red C1-C4 only (cli.ts has no `list` or `stats`, so it prints usage and exits 1).
  Every other row green.
- d: `APPLIED 17 edits to 12 files`; all three exit 0; Compare-Object prints nothing.
- e and i's final run: 0 failed.
- g: `command-tool-names [pass]` unless a `~/.claude` or `~/.cursor` copy on this machine still names a moved tool (say
  which); `mirror-parity` not failing on start.md; `module-boundary [pass]` with `4 dynamic memory load(s)`;
  `retirements [pass]` with 0 unexpected.
- h: stats prints `## Knowledge Stats`, `Total entries: 0`, the temp path and a `Schema: code vN, database vN` line;
  list prints `No stored knowledge entries yet.`; `--limit x` prints `list refused` and `exit 2`.
- m1 -> C1. m2 -> R1. m3 -> R2. m4 -> C4. m5 -> C3. Each only that row.

## Reply

First line: `READY sim-t295s2 <HEAD sha8> ALL PASS` only if every prediction held and f has 0 rows red on every run
alone. Otherwise `READY sim-t295s2 <HEAD sha8> MISMATCH` and list each step that differed, with the full assertion
message of every red row. Every number is pasted output, with its command.

## After merge (not this run; for the build brief)

sia-rebuild; re-copy `start.md` to `~/.claude/commands/` and `~/.cursor/commands/` (and sync.md if S1's re-copy has not
happened); `/mcp reconnect open-brain` in the live seats (tools/list drops to 10).
