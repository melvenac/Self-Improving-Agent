# SIM T170P: the recall trigger reads `MATCH: path:` keys on an Edit or Write call - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 174. **Task:** T-170 part (iii), path keys (P1). **Tag:** `sim-t170p`.
**Authority:** Aaron at the planner's desk, 2026-10-26: "Build the path matcher" (the hook is already registered on
PostToolUse `Edit|Write`).

## What is measured

/end step 2 keys a lesson `MATCH: command|path|error|none`. Command keys (part i) and error keys (part ii, #983) fire;
path keys are "stored and unread" (match-keys.ts header), and `cli-recall-trigger.ts` returns before any lookup for a
tool that is not a shell. Desktop census (read-only, live store, 10-26): 50 lessons carry `MATCH: path:`; under the
parse rule below 46 are usable (4 are prose or too short), 20 are globs, 2 absolute, 4 under `~/`.

The edit (20 edits in 4 files):
- `trigger/match-keys.ts`: `parsePathKey` (the first backticked span, else the text before ` (`; `\` read as `/`; a
  space inside is prose -> null; under 6 characters not counting `*?/` -> null), `pathMatchesKey` (case-insensitive;
  `*`/`?` within a segment, `**` across; `~/` under home; an absolute key matches the whole path; any other key the
  path's tail on a segment boundary), `readTriggerPathKeys`, `matchingPathKeyIds` (longest first).
- `trigger/keys-writer.ts`: the sidecar gains `pathKeys: [{id, glob}]`; the returned counts are unchanged.
- `cli-recall-trigger.ts`: `CLAUDE_CODE_FILE_TOOL_NAMES` (`Edit`, `Write`) and `filePathFromHookPayload`. A file event
  is asked only when its `tool_input.file_path` matches a path key; otherwise the hook returns with no fire row and no
  pending not-asked line. Command keys are not read for a file event.
- `trigger/run.ts`: `filePath` and `pathKeyIds` inputs; a file event derives no bm25 query; each path-key id is
  re-read and re-tested against the file (a stale sidecar costs a miss, never a wrong injection), after error keys and
  before command keys; the fire's query gains `path-match:<ids>`. Seat filter (T-313) and once-per-session apply.

Files under `docs/loops/t170p/`: `t170-iii-path-keys.test.ts` (new file, goes to
`open-brain/tests/trigger/t170-iii-path-keys.test.ts`; P1-P9), `edits.txt`, `m1.txt` (the hook never reads a file
event), `m2.txt` (no segment boundary on a relative key), `m3.txt` (no re-test), `m4.txt` (an unmatched file event
falls through), `m5.txt` (no pathKeys written), `apply.cjs`.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/trigger/t170-iii-path-keys.test.ts tests/trigger/t170-error-keys.test.ts tests/trigger/t170-match-keys.test.ts tests/trigger/hook.test.ts tests/trigger/t313-seat.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of `t170-iii-path-keys.test.ts`, `edits.txt`, `m1.txt` .. `m5.txt` under
   `docs/loops/t170p/`.
c. Baseline: `Copy-Item docs/loops/t170p/t170-iii-path-keys.test.ts open-brain/tests/trigger/t170-iii-path-keys.test.ts`.
   Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t170p/apply.cjs . docs/loops/t170p/edits.txt` (paste output). In
   `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code
   and any error lines.
e. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/trigger tests/setup-hooks.test.ts tests/t235-p2-5-cursor-recall.test.ts tests/t294-small-fixes.test.ts tests/t243-audit-lows.test.ts tests/planner-hook --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts: re-run each such file alone and paste both.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary"` and paste
   every line.
h. Mutants, on the applied tree. Back up the four files the mutants touch once:
   `Copy-Item open-brain/src/trigger/run.ts "$env:TEMP\t170p-run.bak"`,
   `Copy-Item open-brain/src/cli-recall-trigger.ts "$env:TEMP\t170p-hook.bak"`,
   `Copy-Item open-brain/src/trigger/keys-writer.ts "$env:TEMP\t170p-writer.bak"`,
   `Copy-Item open-brain/src/trigger/match-keys.ts "$env:TEMP\t170p-keys.bak"`. For each of m1..m5:
   `node docs/loops/t170p/apply.cjs . docs/loops/t170p/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/trigger/t170-iii-path-keys.test.ts --no-file-parallelism --testTimeout=180000`; paste the
   `Tests` line and every `x` row; restore all four from their backups with `Copy-Item ... -Force`. Never use
   `git checkout` to restore here (it would also remove the fix). After m5's restore, run the five files once more and
   paste the `Tests` line.
i. One extra measurement, on the applied tree, from `open-brain`: print what the product's own `deriveQuery` returns
   for the command strings the hook builds for a file event:
   `npx tsx -e "import('./src/trigger/query.ts').then(m => { for (const c of ['Edit C:\\repo\\convex\\http.ts', 'Write C:/repo/convex/stripe.ts']) console.log(JSON.stringify(c), '->', JSON.stringify(m.deriveQuery(c))) })"`.
   Paste the output (if the inline form fails, write the same two lines to a temp .mts file under $env:TEMP and run it
   with `npx tsx`).

## Predicted

- c: red P1-P8 in t170-iii-path-keys.test.ts (the new functions are not there; the hook ignores Edit); P9 green (a
  guard: an unmatched Write already leaves nothing). Every other file green.
- d: `APPLIED 20 edits to 4 files`; all three exit 0.
- e and h's final run: 0 failed.
- m1 -> P8 only. m2 -> P2 only. m3 -> P7 only. m4 -> P9 only. m5 -> P5 and P8 only.

## Reply

First line: `READY sim-t170p <HEAD sha8> ALL PASS` only if every prediction above held, f has 0 rows red alone, and g
shows `module-boundary [pass]`. Otherwise `READY sim-t170p <HEAD sha8> MISMATCH` and list each step that differed, with
the full assertion message of every red row. Always include step i's output. Every number is pasted output, with its
command.
