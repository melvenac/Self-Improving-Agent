# SIM T325: bootstrap polish from the T-241 frogger re-run - measure before the build brief

Runtime: CC (claude -p, Sonnet). SEAT: QA PC job runner. No hub key. NO commits, NO push, NO PR. Ends at a reply.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-325 (P3). **Tag:** `sim-t325`. **Base:** the START sha the
launcher names (origin/master `247c8a96` or later, containing this file). **Authority:** D-145 (work the backlog by
priority); the findings are QA PC job #194's (docs/loops/t241-frogger-rerun-report.md).

```text
IMPACT-TARGETS: resolveRecordSource (record-source.ts: one branch's line text; unreadableCause unchanged)
```

## What is measured

The T-241 re-run graded bootstrap FIXED 13/15 and logged wording problems. This slice fixes the ones with a small,
deterministic fix:
- **F11:** `state import --draft` prints `Project: <name>` with no source when the name came from package.json (the
  folder and --name cases already say theirs). It now prints `Project: <name> (from package.json)`.
- **N3:** the draft's `unparsed lines N` and `N could not tell` were unexplained in stdout. Two hint lines: one when
  any INBOX line was unparsed, one when inputs could not be judged because there is no `SESSIONS/Session_N.md`.
- **N5:** with no upstream ref, /start printed `record source: LOCAL (origin/master unreadable: origin/master does not
  exist ...)` next to `Tree currency: NOT CHECKED`. A ref that does not exist is not unreadable: the line now reads
  `record source: LOCAL (origin/master does not exist in this checkout (no remote, or nothing fetched)). Rendering
  this tree's own record; there is no origin/master to compare it with.` The other unreadable causes (no state.json
  at the ref, a parse failure, a schema skew) keep their wording. `unreadableCause` is unchanged.
- **N1, N2, N6 (bootstrap.md, doc only, no rows):** step 2.1 says the moved residue shows as untracked until step 3
  merges the gitignore; step 4 says to match the file's line endings when appending; step 5 says to replace or delete
  a placeholder that names a document the project does not have (a PRD).
- **T-295 leftover (comment only):** `lifecycle.ts`'s Maturity comment names `open-brain list`, not `ob_list`.

**Deferred, with reasons:** N4 (a fresh /start reads like faults: legacy handoff, READS OWED AGENT.md, seat = folder
name) spans the handoff, reads-owed and seat renderers; each part is a separate design question, not a wording
fix. N7 and N8 were run artifacts, not SIA findings.

Files under `docs/loops/t325/`:
- `t325-bootstrap-polish.test.ts`: new file, goes to `open-brain/tests/pipelines/t325-bootstrap-polish.test.ts`.
  P1-P3 spawn `state import --draft` through tsx on copies of `tests/fixtures-import` (one with `Session_54.md`
  removed); P4 calls `resolveRecordSource` on a fresh git repo with no remote.
- `edits.txt`: 9 edits in 5 files: `open-brain/src/cli.ts` (3: F11, both N3 hints), `open-brain/src/pipelines/
  session-start/record-source.ts` (1: N5), `open-brain/tests/pipelines/session-start/record-source.test.ts` (1: RM-3's
  no-remote row), `open-brain/src/lifecycle.ts` (1: comment), `project-template/.claude/commands/bootstrap.md` (3).
- `m1.txt`..`m4.txt` (mutants), `apply.cjs`.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `record-source.test.ts` RM-3 "no origin remote" | edited in d | It pinned `origin/master unreadable: ...`; it now pins the new line and that `unreadable` is absent. |
| `record-source.test.ts`, every other row | stays green | The other causes still go through `unreadable(...)`. |
| `upstream-ref.test.ts` UR-7 | stays green | Its clone has origin/main; the line never says `does not exist`. |
| `state-import-t248.test.ts` NM-5 | stays green | `toContain("Project: ... given with --name")`: the flag case is unchanged. |
| `bootstrap-fix.test.ts` `Project: scratch-proj v0.1.0` rows | stays green | They read /start's State header, not the draft summary. |
| `bootstrap-fix.test.ts` "bootstrap.md's order" | stays green | The doc edits add prose only, no command or code fence. |
| `bootstrap-fix-r3.test.ts` "step 2.2 names the empty commit" | stays green | Step 2.2 untouched. |
| `state-import-staleness.test.ts`, `state-import-r2.test.ts` | stays green | The Staleness and Tasks lines are unchanged; the hints are new lines. |

## Steps

You are in a fresh clone detached at the launcher's START sha. Use PowerShell. Run every apply.cjs from the CLONE ROOT.
`$env:NO_COLOR='1'` throughout. "The five files" means, from `open-brain`:
`npx vitest run tests/pipelines/t325-bootstrap-polish.test.ts tests/pipelines/session-start/record-source.test.ts tests/pipelines/state-import-t248.test.ts tests/pipelines/state-import-staleness.test.ts tests/pipelines/bootstrap-fix.test.ts --no-file-parallelism --testTimeout=180000`.

a. `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`. Print HEAD and
   `git status --porcelain` (must be empty). In `open-brain`: `npm ci`.
b. Print the sha256 (first 16 hex) of every file under `docs/loops/t325/`.
c. Baseline: `Copy-Item docs/loops/t325/t325-bootstrap-polish.test.ts open-brain/tests/pipelines/t325-bootstrap-polish.test.ts`.
   Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its file and assertion message.
d. From the clone root `node docs/loops/t325/apply.cjs . docs/loops/t325/edits.txt` (paste output). In `open-brain`:
   `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build`. Paste each exit code and any error
   lines.
e. Run the five files. Paste the `Test Files` and `Tests` lines and every `x` row with its assertion message.
f. `npx vitest run tests/pipelines tests/t154-cli-start.test.ts tests/t314-start-read-only.test.ts --no-file-parallelism --testTimeout=180000`
   (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait). Paste
   the `Test Files`, `Tests` and any `Errors` lines and every `x` row with its file and the assertion message. Red rows
   alongside T-292's `Timeout calling onTaskUpdate` or hook timeouts (known flaky: hub-presence, state-import-r4,
   end-fix-q3): re-run each such file alone up to 3 times and paste every run.
g. From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements|mirror-parity|command-tool-names"`
   and paste every line. A `mirror-parity` or `command-tool-names` line that names only `~\.claude` or `~\.cursor`
   copies is environment, not this change: say so and go on.
h. Live look: in a temp copy of `open-brain/tests/fixtures-import` with `.agents/SESSIONS/Session_54.md` deleted, run
   `node <clone>/open-brain/build/cli.js state import --draft <copy>` and paste the `Project:`, `Staleness:`, `Tasks:`
   lines and the two hint lines. Delete the copy.
i. Mutants, on the applied tree. Back up once:
   `Copy-Item open-brain/src/cli.ts "$env:TEMP\t325-cli.bak"` and
   `Copy-Item open-brain/src/pipelines/session-start/record-source.ts "$env:TEMP\t325-rs.bak"`. For each of m1..m4:
   `node docs/loops/t325/apply.cjs . docs/loops/t325/<m>.txt` (paste output); run ONLY
   `npx vitest run tests/pipelines/t325-bootstrap-polish.test.ts tests/pipelines/session-start/record-source.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and every `x` row; restore BOTH files from the backups with `Copy-Item ... -Force`. Never use
   `git checkout` to restore here. After m4's restore, run the five files once more and paste the `Tests` line.

## Predicted

- c: red P1, P2, P3, P4 in t325-bootstrap-polish.test.ts only; every other row green (RM-3 included).
- d: `APPLIED 9 edits to 5 files`; all three exit 0.
- e, f and i's final run: 0 failed.
- g: `module-boundary [pass]`, `retirements [pass]`.
- h: `Project: self-improving-agent (from package.json)`; a `could not tell` count above 0 and the
  `"could not tell" is expected here` line; the `Unparsed lines are INBOX text` line.
- m1 -> P1. m2 -> P2. m3 -> P3. m4 -> P4 and RM-3 "no origin remote".

## Reply

First line: `READY sim-t325 <HEAD sha8> ALL PASS` only if every prediction held, f has 0 rows red alone, and g shows
`module-boundary [pass]` and `retirements [pass]`. Otherwise `READY sim-t325 <HEAD sha8> MISMATCH` and list each step
that differed, with the full assertion message of every red row. Every number is pasted output, with its command.

## After merge (not this run)

sia-rebuild; re-copy `project-template/.claude/commands/bootstrap.md` to `~/.claude/commands/bootstrap.md` on the
desktop (and ask clark for the QA PC copy).
