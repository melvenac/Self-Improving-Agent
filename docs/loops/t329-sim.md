# SIM T329: a fresh /start does not read like faults (N4) - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-28, session 175. **Task:** T-329 (P2; N4 of `docs/loops/t241-frogger-rerun-report.md`,
deferred by T-325 as a design question, ruled here). **Tag:** `sim-t329`. **Base:** the START sha the launcher names
(origin/master `bbc29e8d` or later, containing this file). **Authority:** D-145 (work the backlog by priority).

```text
IMPACT-TARGETS: formatScanCounts (scan-counts.ts; caller start-report.ts:194), renderState (state-render.ts; the own-handoff
header only), describeReadsOwed (reads-owed.ts; caller start-report.ts:283)
```

## What is measured

The T-241 re-run's first `/start` on a clean fresh install printed four lines that read like faults (N4):
`Your handoff - developer [legacy], session 0:` over an empty `pick up:`, `Session logs unreadable: not searched (...)`,
`Transcript directories unreadable: 0`, and `READS OWED (1): .agents/AGENT.md`. None was a fault. Planner rulings:

1. **Scan counts** (`scan-counts.ts`): zero reads `Session logs: all readable` / `Transcript directories: all readable`;
   a scan that did not run reads `Session logs: not searched yet (<reason>)` / `Transcript directories: not scanned yet
   (<reason>)`. Both lines stay printed (absence stays visible, T-048's invariant); a count above zero is unchanged.
2. **Empty imported handoff** (`state-render.ts`): the handoff `importHandoff` writes when there is nothing to import
   (`checkout` null, `pick_up` empty, no watch-outs or questions, `loop_state` null or all empty) renders as one line,
   `Your handoff: none yet (fresh record)`. A legacy entry with ANY content renders exactly as before.
3. **First session** (`reads-owed.ts`): when the record has no earlier session of this checkout (`prevDate === null`
   with a known session number and checkout), the label is `READS FIRST (N): ...`. Knowable from existing inputs: a
   fresh import writes its one session row with `checkout: null` (state-import/index.ts:886), so a new checkout's first
   session finds no earlier row. An unknown session number or checkout keeps `READS OWED`. `READS OWED: none` is unchanged.
4. Seat shown as the folder name: no change (ruled out of scope).

**Not keyed by any alarm:** greeting-metrics.ts ALARM_PATTERNS (11 ids) match none of these strings (checked on base).
Out of scope, seen while measuring: the briefing's PICK UP HERE line for the same empty handoff (briefing.ts) is not
changed here.

Files under `docs/loops/t329/`:
- `t329-fresh-start.test.ts`: new file, goes to `open-brain/tests/pipelines/t329-fresh-start.test.ts`. Rows F1-F5.
- `edits.txt`: 15 edits in 7 files. Source (6 edits, 3 files): `scan-counts.ts` (doc comment + the two lines),
  `state-render.ts` (the `isEmptyImportedHandoff` helper + the own-handoff branch), `reads-owed.ts` (`firstSession` +
  the label). Existing tests that pin the old text (9 edits, 4 files), listed below.
- `m1.txt` (zero count back to `unreadable: 0`), `m2.txt` (emptiness ignores `pick_up`), `m3.txt` (`firstSession`
  ignores an unknown session/checkout), `apply.cjs` (same applier as t328).

Planner pre-check (desktop, text only, no code run): `apply.cjs` on base copies of the 7 files printed
`APPLIED 15 edits to 7 files`; m1, m2, m3 each `APPLIED 1 edits to 1 files` on the edited copies.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t048-zero-case.test.ts` DC-4z/DC-5z line 57 (zero form) | CHANGES in edits.txt | Pins `Session logs unreadable: 0`; now `all readable`. Lines 58-62 (non-zero, `not searched`/`not scanned` contains, not-equal) stay green unedited. |
| `server.test.ts` T-230 (lines 107-108) | CHANGES in edits.txt | Pins `\nSession logs unreadable: 0\n` in handleStart output. |
| `briefing-fix.test.ts` BF-R4 (line 250) | CHANGES in edits.txt | `sessions: []`, so a first session: `READS FIRST (8):`. |
| `briefing-fix.test.ts` BF-R5 (line 266) | CHANGES in edits.txt | `sessions: []`: `^READS FIRST`. |
| `briefing-fix.test.ts` BF-R1, BF-R2, BF-R3, BF-F8 | stays green | R1 checks paths only; R2 has an earlier sia-forge row (OWED); R3 is `none`; F8 passes its own strings. |
| `g062-reads-owed.test.ts` O1 (67-69), O2 (77) | CHANGES in edits.txt | `bare([])`, a first session: the `(N)` forms read `READS FIRST`. O2's `READS OWED: none (2 written by this seat)` unchanged. |
| `g062-reads-owed.test.ts` O5 helper (line 124) | CHANGES in edits.txt | The fixture checkout has no earlier row, so the off-case line is `READS FIRST (1): ...`; the finder matches `^READS (OWED|FIRST)`. |
| `briefing.test.ts` T-233 rows (477, 597) | stays green | Expected value is computed by calling `describeReadsOwed` itself. |
| `handoff-by-checkout.test.ts` line 145 (`[legacy], session`) | stays green | Its legacy entry carries watch-outs and questions. |
| `state-render.test.ts` (86, 117, 132; T183-3 real record) | stays green | Fixture handoffs have content; the real record has 0 empty legacy handoffs of 14 (checked on base). |
| `t296-state-compact`, `t304-role-none-handoff`, `greeting-size` | stays green | Their own handoffs have content or a checkout. |

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The seven files" means, from `open-brain`:
`npx vitest run tests/pipelines/t329-fresh-start.test.ts tests/t048-zero-case.test.ts tests/server.test.ts tests/pipelines/session-start/briefing-fix.test.ts tests/pipelines/session-start/g062-reads-owed.test.ts tests/pipelines/session-start/state-render.test.ts tests/pipelines/session-start/handoff-by-checkout.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t329/`.
c. Baseline: `Copy-Item docs/loops/t329/t329-fresh-start.test.ts open-brain/tests/pipelines/t329-fresh-start.test.ts`.
   Run the seven files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t329/apply.cjs . docs/loops/t329/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the seven files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines tests/t154-cli-start.test.ts tests/server.test.ts tests/t048-zero-case.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait). Paste
   the `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts (known flaky: hub-presence, state-import-r4,
   end-fix-q3, t159-fast-path N3, record-erasure R179, session-start/latest-brief, server.test handleSync at ~5 s):
   re-run each such file alone up to 3 times and paste every run.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements|mirror-parity|command-tool-names"`
   and paste every line. A `mirror-parity` or `command-tool-names` line that names only `~\.claude` or `~\.cursor`
   copies is environment, not this change: say so and go on.
h. Mutants, on the applied tree. Back up once:
   `New-Item -ItemType Directory -Force "$env:TEMP\t329-bak" | Out-Null; Copy-Item open-brain/src/pipelines/session-start/scan-counts.ts,open-brain/src/pipelines/session-start/state-render.ts,open-brain/src/pipelines/session-start/reads-owed.ts "$env:TEMP\t329-bak\" -Force`.
   For each of m1..m3: `node docs/loops/t329/apply.cjs . docs/loops/t329/<m>.txt` (paste output); in `open-brain` run
   `npx tsc --noEmit` (paste exit code), then ONLY
   `npx vitest run tests/pipelines/t329-fresh-start.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and every `x` row; restore with
   `Copy-Item "$env:TEMP\t329-bak\*" open-brain/src/pipelines/session-start/ -Force`. Never use `git checkout` to
   restore here. After m3's restore, run the seven files once more and paste the `Tests` line.

## Predicted

- c: red F1, F2, F3, F5 in t329-fresh-start.test.ts only (F4 is a green pin: a legacy handoff with content renders as
  today); every row in the other six files green.
- d: `APPLIED 15 edits to 7 files`; all three exit 0.
- e, f and h's final run: 0 failed.
- g: `module-boundary [pass]`, `retirements [pass]`.
- h: each mutant tsc exit 0. m1 -> F1. m2 -> F4. m3 -> F5.

## Reply

First line: `READY sim-t329 <HEAD sha8> ALL PASS` only if every prediction held, f has 0 rows red alone, and g shows
`module-boundary [pass]` and `retirements [pass]`. Otherwise `READY sim-t329 <HEAD sha8> MISMATCH` and list each step
that differed, with the full assertion message of every red row. Every number is pasted output, with its command.

## After merge (not this run)

sia-rebuild. The next adoption's first `/start` shows `Your handoff: none yet (fresh record)`, `Session logs: all
readable` (or `not searched yet`), and `READS FIRST (N)`. The start.md copies and role files that describe the READS
OWED line by name are prose and are not pinned; a follow-up may mention READS FIRST there.
