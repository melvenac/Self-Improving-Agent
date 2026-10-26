# SIM T295S1: the MCP server stops registering ob_score and ob_feedback - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 174. **Task:** T-295 S1 (P2). **Tag:** `sim-t295s1`. **Authority:** Aaron at
the planner's desk, 2026-10-26: "Cut 14 to 10" (keep the 8 protocol tools plus ob_forget and ob_store_chunk; cut ob_score
and ob_feedback; move ob_stats and ob_list to the CLI). S1 is the two cuts; S2 moves ob_stats and ob_list.

## What is measured

- `ob_score` duplicates `ob_sync` with `score: true`; its history view is `cli.js sync --history`.
- `ob_feedback` records one helpful/harmful/neutral rating; `ob_end`'s `entry_ratings` records the same per-entry
  ratings (server.ts `handleEnd` -> `entryRatings`). The transcript census (s171) found no ob_feedback call since 09-26.
- The edit (10 edits in 6 files): `open-brain/src/server.ts` drops the two `server.tool(...)` registrations; the
  exported `handleScore` and `handleFeedback` stay (t048-r3 and t003-r2 call them directly). The command files that
  named `ob_score` (`.claude/commands/sync.md` and its `project-template` mirror, kept identical;
  `project-template/.cursor/commands/sync.md`) point at `ob_sync` and `cli.js sync --history` instead, so /sync's
  `command-tool-names` check stays clean. `CLAUDE.md` and `README.md` say 12 tools.

Files under `docs/loops/t295s1/`: `t295-s1-tool-cut.test.ts` (new file, goes to `open-brain/tests/t295-s1-tool-cut.test.ts`;
R1 tools/list over stdio, R2 command-tool-names), `edits.txt`, `m1.txt` (ob_feedback registered again), `m2.txt` (sync.md
names ob_score again), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The four files" means, from `open-brain`:
`npx vitest run tests/t295-s1-tool-cut.test.ts tests/t048-r3.test.ts tests/t003-r2.test.ts tests/pipelines/sync/checks.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t295s1/`.
c. Baseline: `Copy-Item docs/loops/t295s1/t295-s1-tool-cut.test.ts open-brain/tests/t295-s1-tool-cut.test.ts`. Run the
   four files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
d. From the clone root `node docs/loops/t295s1/apply.cjs . docs/loops/t295s1/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines. From the clone root: `Compare-Object (Get-Content .claude/commands/sync.md) (Get-Content project-template/.claude/commands/sync.md)`
   (expect no output).
e. Run the four files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/server.test.ts tests/pipelines tests/t315-proxy.test.ts tests/t048-r3.test.ts tests/t003-r2.test.ts tests/t295-s1-tool-cut.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes). Paste the `Test Files`, `Tests` and any
   `Errors` lines and every `x` row. Red rows alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run
   each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync --check 2>&1 | Select-String -Pattern "command-tool-names|mirror-parity|module-boundary"`
   and paste every line. (The `~/.claude/commands` copies on this machine are outside the clone; a line naming one of
   them is environment, not the change. Say which files a line names.)
h. Mutants, on the applied tree. Back up once: `Copy-Item open-brain/src/server.ts "$env:TEMP\t295-server.bak"`,
   `Copy-Item .claude/commands/sync.md "$env:TEMP\t295-sync.bak"`. For each of m1, m2:
   `node docs/loops/t295s1/apply.cjs . docs/loops/t295s1/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/t295-s1-tool-cut.test.ts --no-file-parallelism --testTimeout=180000`; paste the `Tests` line and
   every `x` row; restore both from their backups with `Copy-Item ... -Force`. After m2's restore, run the four files once
   more and paste the `Tests` line.

## Predicted

- c: red R1 only (tools/list still has ob_score and ob_feedback); R2 green (both tools are still registered, so the
  docs that name them resolve). Every other row green.
- d: `APPLIED 10 edits to 6 files`; all three exit 0; Compare-Object prints nothing.
- e and h's final run: 0 failed.
- g: `command-tool-names [pass]` unless a `~/.claude` or `~/.cursor` copy on this machine names a cut tool (say so);
  `mirror-parity` not failing on sync.md; `module-boundary [pass]`.
- m1 -> R1 only. m2 -> R2 only.

## Reply

First line: `READY sim-t295s1 <HEAD sha8> ALL PASS` only if every prediction held and f has 0 rows red alone. Otherwise
`READY sim-t295s1 <HEAD sha8> MISMATCH` and list each step that differed, with the full assertion message of every red
row. Every number is pasted output, with its command.
