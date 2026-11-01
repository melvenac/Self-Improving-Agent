# T332: open-brain evidence-report, a shadow report-only CLI (T-332)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-31, session 175. **Task:** T-332 (RSI research idea #3, option C of
`docs/loops/t332-measure.md`). **Tag:** `t332`. **Size:** SMALL (`open-brain/src/cli.ts` 2 edits, `cli-spec.ts` 1,
`cli-memory.ts` 1, `tests/shared/cli-args.test.ts` 2; one new module and one new test file). **Base:** the START sha
the launcher names (a master that contains this brief). **Authority:** clark's 10-31 relay of Aaron ("pick up any
downstream work that's available"); SIM `sim-t332` (job #497), ALL PASS.
**THE MERGE WAITS ON AARON's ruling on option C** (`t332-measure.md` section 5). This run ends at READY with an open
PR, and nobody merges it until Aaron rules.

## Why

RSI idea #3 would make a lesson recall-eligible only when it carries an evidence pointer that resolves. The measure
found 13.6% of new entries and 5.8% of trigger injections would pass a strict gate. The most-served entry (49% of
injections) has no pointer at all. A gate now would be a bet with no outcome measure. Option C ships the instrument
instead: a read-only report of which lessons carry a resolving pointer, and which injections a gate would have
withheld. It gates nothing, adds no column, and changes no recall or store path.

## The change, exactly

- **`docs/loops/t332/evidence-report.ts`** goes to `open-brain/src/pipelines/store/evidence-report.ts` (memory side:
  `pipelines/store/` is in MEMORY_SIDE).
  - `extractPointers(text)`, pure: sha, tests/ path, docs/loops/ path, CI run id, PR number, once each.
  - `isEvidenced(pointers, resolver)`, the strict gate: a sha, path or run id that the injected resolver says exists.
    A PR number never counts.
  - `openStoreReadOnly(dbPath)` opens with `{readonly: true, fileMustExist: true}`.
  - `evidenceReport(dbPath, resolver, {asOf, days})`, `renderEvidenceReport(report)` and `gitResolver(repo)`. The
    git resolver uses `git cat-file -e` for shas and `ls-tree --full-tree` for paths. It has no network and no run
    resolver.
- **`docs/loops/t332/t332-evidence-report.test.ts`** goes to `open-brain/tests/pipelines/store/t332-evidence-report.test.ts`.
  Rows E1-E7. The temp stores are built in-test, and the live store is never opened.
- **`docs/loops/t332/edits.txt`:** 6 edits in 4 files, exactly as SIM `sim-t332` measured.
  - **`cli.ts`:** `evidence-report` joins the cli-memory forward's name list, and the usage line is added.
  - **`cli-spec.ts`:** the `evidenceReport` spec (`--db`, `--days`, `--as-of`, `--repo`, all `both`-form values).
  - **`cli-memory.ts`:** the command body. `--days` and `--as-of` are parsed before the store is opened (a refusal
    exits 2). Any error exits 1 with `evidence-report refused: <message>`.
  - **`tests/shared/cli-args.test.ts`:** `evidence-report` is added to the walked-names list and the usage-line table.
    Both pin every command by name.
- The edit adds no dynamic load: the new import is memory to memory, so `DYNAMIC_MEMORY_LOADS` stays at 4.

## Measured before dispatch

SIM `sim-t332` (job #497) at `7f6594ef`: ALL PASS.
- **Red-first:** the file failed to load on the missing module (`Test Files 1 failed (1)`, `Tests no tests`).
- **Edits:** `APPLIED 6 edits to 4 files`; both tsc runs and the build exit 0.
- **New file:** `Tests 7 passed (7)`.
- **Wide run:** 46 files and 662 tests passed, with no re-runs.
- **Sync:** `retirements [pass]`, `module-boundary [pass]` (4 dynamic memory loads).
- **Missing store:** `evidence-report --db <missing>` exits 1 with `evidence-report refused: unable to open database
  file`. No file is created.
- **Mutants:** m1 turns E2, E3 and E6 red, m2 turns E4 red, m3 turns E5 red. The file is green after the restore.
- **Planner re-check:** a dry-apply against origin/master `7f6594ef` printed `APPLIED 6 edits to 4 files`, and m1-m3
  each printed `APPLIED 1 edits to 1 files`. The sha256 prefixes of the `docs/loops/t332/` files equal the SIM's
  step b.

## Existing tests (verdicts)

These files stay green (SIM step e: 46 files, 0 red):
- `tests/shared/cli-args.test.ts`: green WITH its two edits. The walked-names `toEqual` and the usage-line table go
  red without them.
- `tests/t261-s2.test.ts` R1-R4: still exactly 4 dynamic loads.
- `tests/pipelines/store/*`: `store()` and `indexKnowledge` are untouched.
- `tests/t294-small-fixes.test.ts`: trigger-keys goes through the same forward, unchanged.
- `tests/pipelines/sync/*`: module-boundary and retirements.

Any other red existing row: STOP, `BLOCKED t332 <test name>`.

**Exception rule** (T-292, shared QA PC): a red row or a file-level hook timeout alongside `Timeout calling
onTaskUpdate` or a timeout gets up to 3 re-runs of that file alone. Green on any run means paste every run and go on;
red on all 3 means STOP.

**Known flaky under load:** hub-presence, state-import-r4, end-fix-q3, t159-fast-path N3, record-erasure R179,
`tests/pipelines/session-start/latest-brief.test.ts`, `tests/server.test.ts` handleSync `runs sync on project root`,
`tests/shared/state-writer-notes.test.ts` T171-D1.

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b build/t332`. HEAD must equal START and the porcelain must be
   empty. In `open-brain`: `npm ci` (exit code), then `node -e "require('better-sqlite3')"`. On "Could not locate the
   bindings file", run `npm rebuild better-sqlite3` and say so. Run every `apply.cjs` from the CLONE ROOT.
   - **Forbidden:** stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/` (and the live knowledge-v2.db), `scripts/setup.mjs`, `git config`
     writes, any MCP config, `npm install`, and anything under `docs/`.
3. **Apply.** `node docs/loops/t332/apply.cjs . docs/loops/t332/edits.txt` must print exactly
   `APPLIED 6 edits to 4 files`. Then:
   `Copy-Item docs/loops/t332/evidence-report.ts open-brain/src/pipelines/store/evidence-report.ts` and
   `Copy-Item docs/loops/t332/t332-evidence-report.test.ts open-brain/tests/pipelines/store/t332-evidence-report.test.ts`.
   In `open-brain`: `npx tsc --noEmit` (exit 0), `npx tsc -p tsconfig.tests.json --noEmit` (exit 0), `npm run build`
   (exit 0).
4. **New file.** In `open-brain`:
   `npx vitest run tests/pipelines/store/t332-evidence-report.test.ts --no-file-parallelism --testTimeout=180000`.
   Expect `Tests 7 passed (7)`. Red-first was measured in the SIM and is not repeated.
5. **Mutants**, each on the applied tree.
   - Back up once: `Copy-Item open-brain/src/pipelines/store/evidence-report.ts "$env:TEMP\t332-er.bak" -Force`.
   - For each of m1..m3: `node docs/loops/t332/apply.cjs . docs/loops/t332/<m>.txt` must print
     `APPLIED 1 edits to 1 files`. Then `npx tsc --noEmit` (exit 0) and the step-4 command. Paste the `Tests` line and
     the red row names.
   - Restore after each with
     `Copy-Item "$env:TEMP\t332-er.bak" open-brain/src/pipelines/store/evidence-report.ts -Force`. Never use git
     checkout.
   - Predicted: **m1** (a PR number counts) turns E2, E3 and E6 red only. **m2** (no `readonly`) turns E4 red only.
     **m3** (the window start becomes exclusive) turns E5 red only. After m3's restore, the step-4 command shows
     `Tests 7 passed (7)`.
   - A mutant whose red rows differ: STOP, `BLOCKED t332 <m> <rows>`.
6. **Wide run**, in `open-brain`:
   `npx vitest run tests/shared/cli-args.test.ts tests/t261-s2.test.ts tests/pipelines/store tests/t294-small-fixes.test.ts tests/pipelines/sync --no-file-parallelism --testTimeout=180000`
   (40-minute cap). Expect 0 failed, subject to the exception rule. Paste `Test Files`, `Tests` and any `Errors` line,
   plus the full assertion message of any red row.
7. **Sync and the missing-store refusal.** From the clone root:
   - `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`. Paste every
     line; both must be `[pass]`, and module-boundary must say 4 dynamic memory loads.
   - `node open-brain/build/cli.js evidence-report --db "$env:TEMP\no-such-t332.db"`. Paste `$LASTEXITCODE` (must be
     1) and the stderr line (must be `evidence-report refused: unable to open database file`). Then
     `Test-Path "$env:TEMP\no-such-t332.db"` (must be False).
8. **Commit.** One commit, `T332: open-brain evidence-report, a shadow report-only CLI (T-332)`.
   - Stage exactly the 6 paths: `open-brain/src/cli.ts`, `open-brain/src/cli-spec.ts`, `open-brain/src/cli-memory.ts`,
     `open-brain/tests/shared/cli-args.test.ts`, `open-brain/src/pipelines/store/evidence-report.ts` and
     `open-brain/tests/pipelines/store/t332-evidence-report.test.ts`.
   - The message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <START>..HEAD` shows 1 line, and the status is empty (build output is ignored; if anything
     else shows, paste it and STOP).
   - `git diff --name-status <START>..HEAD` shows exactly these 6 lines, 4 M and 2 A:
     `M open-brain/src/cli-memory.ts`, `M open-brain/src/cli-spec.ts`, `M open-brain/src/cli.ts`,
     `A open-brain/src/pipelines/store/evidence-report.ts`,
     `A open-brain/tests/pipelines/store/t332-evidence-report.test.ts`, `M open-brain/tests/shared/cli-args.test.ts`.
9. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/build/t332` must equal HEAD.
   - `gh pr create --base master --head build/t332 --title "T332: open-brain evidence-report, a shadow report-only CLI (T-332)" --body "Brief: docs/loops/t332-brief.md. Shadow only: read-only report, no gate, no schema or recall change. Merge waits on Aaron's ruling on option C."`.
   - Then `gh pr checks <n> --watch --interval 30` (cap 30 min). Paste every check's name and conclusion (CI runs on
     the tcm runners since T-330).

## Reply

- **First line:** `READY t332 <sha40> PR #<n>` or `BLOCKED t332 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge: the merge waits on Aaron.

## After merge (not this run)

`sia-rebuild.sh <mergesha>`. Then a live read-only run on the main build against the REAL store. The report opens it
`readonly` with `fileMustExist`, which E4 and the SIM's step f pin.
- **Run:** from `C:/Users/melve/Projects/Self-Improving-Agent`,
  `node open-brain/build/cli.js evidence-report --as-of 2026-11-01T01:36:24.869Z --days 30 --repo .`. The `--as-of`
  value is the measure's window end.
- **Unchanged store:** the store's sha256 and mtime are the same before and after the run.
- **Compare with `t332-measure.md` (strict column):**
  - entries: 80 of 924 evidenced.
  - new in window: 41 of 302.
  - trigger injections: 84 of 1,441, with 16 of 104 entries evidenced.
  - top withheld: 299 `pipe-to-tail-masks-exit-code` (707).
- **Expected differences, to be reported and not tuned toward:**
  - The CLI resolves shas in one repo, where the measure checked 25, so entries citing other repos' shas drop out.
  - It has no run resolver (3 entries).
  - It matches paths as written or under `open-brain/`; the measure also accepted a suffix match.
  - Entries written after the measure count toward the totals but not toward the window.
- **What's left:** any gate (option B on the trigger path) is Aaron's ruling and waits on T-331's withheld arm.
