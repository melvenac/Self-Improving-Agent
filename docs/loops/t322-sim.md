# SIM T322: `open-brain rematch` rewrites a stored lesson's MATCH: line in place - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-322 (P2). **Tag:** `sim-t322`. **Base:** the START sha the
launcher names (origin/master `70a8ddfc` or later, containing this file). **Authority:** Aaron at the planner's desk,
2026-10-26 (s174, transcript 0bbb03c4): lesson 751 is lookup-only ("751 lookup-only"); T-322 is the supported path.

```text
IMPACT-TARGETS: runMemoryCommand, COMMAND_SPECS (cli-memory.ts gains a branch; cli-spec.ts gains an entry; new file pipelines/store/rematch.ts)
```

## What is measured

There is no supported way to change an existing lesson's `MATCH:` line. `ob_store` refuses a repeated event key (only
a recorded `state` replaces in place), and `ob_forget` plus a fresh store loses the row's ratings and recall history:
`feedback_log` and `recall_log` point at the id and have no foreign key. Lesson 751 has helpful 29 and recall_count 38.

`open-brain rematch --id <n> --match <none|command: <key>|path: <glob>|error: <text>> [--dry-run]`:
- refuses a value that is not one of the four kinds, an id with no row, an archived row, a missing note, and a note or
  indexed content without exactly one `MATCH:` line, and writes nothing on any refusal (exit 1, `rematch refused: ...`);
- rewrites that one line in the vault note (every other byte kept, CRLF included), then re-indexes the row through
  `indexKnowledge`, whose ON CONFLICT(key) update keeps the id, the three counters, `recall_count`,
  `last_recalled_at` and `created_at` (db-v2.ts, `indexKnowledge` header);
- then rewrites the trigger key sidecar with the existing `writeTriggerKeys` (the same call `trigger-keys` makes);
- reports `unchanged` and writes nothing when the line already holds the value; `--dry-run` writes nothing.

Memory side throughout: the logic is `pipelines/store/rematch.ts` (under `pipelines/store/`, already MEMORY_SIDE), the
CLI branch is in `cli-memory.ts`, and `cli.ts` only adds the name to its existing memory forward. No new dynamic load
from core, so `t261-s2` R1's "4 dynamic memory load(s)" holds.

Files under `docs/loops/t322/`:
- `rematch.ts`: new file, goes to `open-brain/src/pipelines/store/rematch.ts`.
- `t322-rematch.test.ts`: new file, goes to `open-brain/tests/t322-rematch.test.ts`. K1-K6 (module, K4a-K4f the
  refusals), C1-C3 (CLI through tsx with `KNOWLEDGE_V2_DB` on a temp store).
- `edits.txt`: 6 edits in 4 files: `open-brain/src/cli.ts` (the forward line gains `rematch`; one usage line after
  `relocate`'s), `open-brain/src/cli-spec.ts` (`rematch` spec after `triggerKeys`), `open-brain/src/cli-memory.ts`
  (the `rematch` branch, before `topics`), `open-brain/tests/shared/cli-args.test.ts` (the pinned sorted command list
  and the LINES table gain `rematch`).
- `m1.txt`..`m6.txt` (mutants), `apply.cjs`.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/shared/cli-args.test.ts` "walks at least the fifteen commands" and "names a usage line for every command it declares" | edited in d | Both pinned lists gain `rematch`; the usage line documents exactly `--id`, `--match`, `--dry-run`, which the spec declares. |
| `tests/shared/cli-args.test.ts`, every other row | stays green | Additive spec entry. |
| `tests/t261-s2.test.ts` R1-R4 | stays green | cli-memory.ts and pipelines/store/ are memory side; no new core-to-memory load. |
| `tests/t294-small-fixes.test.ts` (trigger-keys K1/K1b) | stays green | `trigger-keys` branch unchanged. |
| `tests/trigger/t170-match-keys.test.ts` | stays green | `writeTriggerKeys` and `parseCommandKey` unchanged. |
| `tests/pipelines/sync/retirements-live.test.ts` | stays green | No edited file is an allowed referrer; the new files carry no retired term. |

Overlap with T-295 S2 (docs/loops/t295s2/, drafted in parallel): two same-line hunks conflict whichever merges second:
the `cli.ts` forward line and `cli-args.test.ts`'s sorted command list. The resolution is mechanical: the line carries
both sets of names (`|| command === "list" || command === "stats" || command === "rematch"`; the list sorted with
`list`, `rematch`, `stats` in place). The usage line, LINES entry and cli-spec entry were placed away from S2's hunks
(after `relocate` / `triggerKeys`, not after `topics`) so they do not touch. If S2 merges first, the build brief
re-anchors those two edits on the merged text.

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/t322-rematch.test.ts tests/shared/cli-args.test.ts tests/t261-s2.test.ts tests/t294-small-fixes.test.ts tests/trigger/t170-match-keys.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`, then `node -e "require('better-sqlite3')"`
   (on "Could not locate the bindings file": `npm rebuild better-sqlite3` and say so).
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t322/`.
c. Baseline: `Copy-Item docs/loops/t322/t322-rematch.test.ts open-brain/tests/t322-rematch.test.ts`. Run the five
   files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. `Copy-Item docs/loops/t322/rematch.ts open-brain/src/pipelines/store/rematch.ts`. From the clone root
   `node docs/loops/t322/apply.cjs . docs/loops/t322/edits.txt` (paste output). In `open-brain`: `npx tsc --noEmit`,
   `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error lines.
e. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/shared tests/trigger tests/pipelines/sync tests/server.test.ts tests/t261-s2.test.ts tests/t294-small-fixes.test.ts tests/t322-rematch.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, never the 10-minute default). Paste the
   `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or a timeout: re-run each such file alone up to 3 times and paste
   every run. `tests/harness/s4-guards.test.ts` is NOT in this run (D1b is red on any uncommitted new test file in a SIM).
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`
   and paste every line.
h. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/pipelines/store/rematch.ts "$env:TEMP\t322-rm.bak"` and
   `Copy-Item open-brain/src/cli-memory.ts "$env:TEMP\t322-cm.bak"`. For each of m1..m6:
   `node docs/loops/t322/apply.cjs . docs/loops/t322/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/t322-rematch.test.ts --no-file-parallelism --testTimeout=180000`; paste the `Tests` line and
   every `x` row; restore both with `Copy-Item "$env:TEMP\t322-rm.bak" open-brain/src/pipelines/store/rematch.ts -Force`
   and `Copy-Item "$env:TEMP\t322-cm.bak" open-brain/src/cli-memory.ts -Force`. Never use `git checkout` to restore
   here. After m6's restore, run the five files once more and paste the `Tests` line.
i. Live dry run on a COPY, never the real store: `Copy-Item "$env:USERPROFILE\.claude\open-brain\knowledge-v2.db" "$env:TEMP\t322-kv2.db"` if
   that file exists (else write `NOT RUN: no store on this host` and go on). Then
   `$env:KNOWLEDGE_V2_DB="$env:TEMP\t322-kv2.db"; node open-brain/build/cli.js rematch --id 751 --match none --dry-run; Remove-Item Env:KNOWLEDGE_V2_DB`
   and paste the output (any outcome is information; a refusal naming a missing note is expected on a host without
   the vault). Delete the copy afterwards.

## Predicted

- c: in t322-rematch.test.ts all 14 rows red (K1, K2, K3, K4a-K4f, K5, K6: `rm.rematch is not a function`; C1-C3: the
  CLI prints its usage and exits 1, so C1 and C3 fail on the status and C2 on the missing `rematch refused`); every row
  in the other four files green.
- d: `APPLIED 6 edits to 4 files`; all three exit 0.
- e and h's final run: 0 failed.
- f: 0 failed.
- g: `module-boundary [pass]` and `retirements [pass]`.
- m1 (index not rewritten) -> K1 and C1. m2 (row deleted before re-index) -> K2. m3 (2+ MATCH lines accepted) -> K4b.
  m4 (dry run ignored) -> K5. m5 (value not validated) -> K4d. m6 (sidecar not refreshed) -> C1.

## Reply

First line: `READY sim-t322 <HEAD sha8> ALL PASS` only if every prediction held, f has 0 rows red alone, and g shows
both `[pass]`. Otherwise `READY sim-t322 <HEAD sha8> MISMATCH` and list each step that differed, with the full
assertion message of every red row. Every number is pasted output, with its command.

## After the build (not this run)

On the desktop, after merge and rebuild: `node <main>/open-brain/build/cli.js rematch --id 751 --match none`, then
`ob_recall`/the trigger no longer injects 751 on a `skills-audit` call (its `trigger_fires` row shows no inject for it).
