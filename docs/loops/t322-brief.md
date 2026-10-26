# T322: `open-brain rematch` rewrites a stored lesson's MATCH: line in place (T-322)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-322 (P2). **Tag:** `t322`. **Size:** SMALL (6 edits in
4 files, 1 new source file, 1 new test file). **Base:** the START sha the launcher names (a master that contains this
brief). **Authority:** Aaron at the planner's desk, 2026-10-26 (s174, transcript 0bbb03c4): lesson 751 is lookup-only
("751 lookup-only"); T-322 is the supported path to make it so without losing its counts.

```text
IMPACT-TARGETS: runMemoryCommand, COMMAND_SPECS (cli-memory.ts gains a branch; cli-spec.ts gains an entry; new file pipelines/store/rematch.ts)
```

## Why

There is no supported way to change an existing lesson's `MATCH:` line. `ob_store` refuses a repeated event key (only
a recorded `state` replaces in place), and `ob_forget` plus a fresh store loses the row's ratings and recall history:
`feedback_log` and `recall_log` point at the id and have no foreign key. Lesson 751 has helpful 29 and recall_count 38.

`open-brain rematch --id <n> --match <none|command: <key>|path: <glob>|error: <text>> [--dry-run]`:
- refuses a value that is not one of the four kinds, an id with no row, an archived row, a missing note, and a note or
  indexed content without exactly one `MATCH:` line, and writes nothing on any refusal (exit 1, `rematch refused: ...`);
- rewrites that one line in the vault note (every other byte kept, CRLF included), then re-indexes the row through
  `indexKnowledge`, whose ON CONFLICT(key) update keeps the id, the three counters, `recall_count`,
  `last_recalled_at` and `created_at`;
- then rewrites the trigger key sidecar with the existing `writeTriggerKeys` (the same call `trigger-keys` makes);
- reports `unchanged` and writes nothing when the line already holds the value; `--dry-run` writes nothing.

Memory side throughout: `pipelines/store/` is already MEMORY_SIDE, the CLI branch is in `cli-memory.ts`, and `cli.ts`
only adds the name to its existing memory forward, so `t261-s2` R1's "4 dynamic memory load(s)" holds.

## The change, exactly

Files under `docs/loops/t322/`.
- **`t322-rematch.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t322-rematch.test.ts`. K1-K6 (module,
  K4a-K4f the refusals), C1-C3 (CLI through tsx with `KNOWLEDGE_V2_DB` on a temp store).
- **`rematch.ts`:** copied verbatim, as a new file, to `open-brain/src/pipelines/store/rematch.ts`.
- **`edits.txt`:** 6 edits in 4 files: `open-brain/src/cli.ts` (the memory forward line gains `rematch`; one usage line
  after `relocate`'s), `open-brain/src/cli-spec.ts` (the `rematch` spec after `triggerKeys`),
  `open-brain/src/cli-memory.ts` (the `rematch` branch, before `topics`), `open-brain/tests/shared/cli-args.test.ts`
  (the pinned sorted command list and the LINES table gain `rematch`). The test edit goes in commit 2 with the code:
  the new spec entry turns both pinned lists red the moment it exists, so the lists must change in the same commit.

## Measured before dispatch

QA PC SIM `sim-t322` (job #144) at `35e23b4a`: ALL PASS. The anchors were re-checked on master `43a9ec5f` (after the
T-284, T-295 S1 and T-324 S1 merges): `APPLIED 6 edits to 4 files`, and none of the 4 files changed since `35e23b4a`.
- Baseline (five files, the new test only): `1 failed | 4 passed (5)` files, `14 failed | 117 passed (131)` tests; all
  14 t322 rows red (K1-K6 `rm.rematch is not a function`; C1, C3 on the exit status; C2 on the missing
  `rematch refused`); the other four files green.
- Apply: `APPLIED 6 edits to 4 files`; both tsc runs and `npm run build` exit 0; five files `134 passed (134)`.
- Wide run: `Test Files 78 passed (78)`, `Tests 1101 passed (1101)`, no Errors line.
- `retirements [pass]`, `module-boundary [pass]` (4 dynamic memory loads).
- m1 -> K1, C1; m2 -> K2; m3 -> K4b; m4 -> K5; m5 -> K4d; m6 -> C1.
- The live 751 dry run could not be measured there (the QA PC store has no row 751): it is an after-merge desktop check.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/shared/cli-args.test.ts` "walks at least the fifteen commands" and "names a usage line for every command it declares" | edited in commit 2 | Both pinned lists gain `rematch`. Green in the SIM. |
| `tests/shared/cli-args.test.ts`, every other row | stays green | Additive spec entry. |
| `tests/t261-s2.test.ts` R1-R4 | stays green | Memory side; no new core-to-memory load. |
| `tests/t294-small-fixes.test.ts` (trigger-keys K1/K1b) | stays green | `trigger-keys` branch unchanged. |
| `tests/trigger/t170-match-keys.test.ts` | stays green | `writeTriggerKeys` and `parseCommandKey` unchanged. |
| `tests/pipelines/sync/retirements-live.test.ts` | stays green | No edited file is an allowed referrer; the new files carry no retired term. |
| `hub-presence.test.ts`, `state-import-r4.test.ts`, `end-fix-q3.test.ts` | known flaky under load | Timeouts on the shared QA PC in SIMs #134/#143, green alone. See the exception rule. |

Any other red existing row means STOP and report `BLOCKED t322 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than the five files, with that error or a timeout: re-run each such file alone up to 3 times; green on any run
alone means paste every run and go on, red on all 3 means STOP.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/t322-rematch.test.ts tests/shared/cli-args.test.ts tests/t261-s2.test.ts tests/t294-small-fixes.test.ts tests/trigger/t170-match-keys.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b feat/t322-rematch`. HEAD must equal START and the porcelain
   must be empty. In `open-brain`: `npm ci`, then `node -e "require('better-sqlite3')"` (on "Could not locate the
   bindings file": `npm rebuild better-sqlite3` and say so). Run every `apply.cjs` from the CLONE ROOT. Forbidden:
   stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the
   real `~/.claude/` (including `knowledge-v2.db`), any MCP config, and anything under `docs/`.
3. **Commit 1** (`T322: rows for open-brain rematch`).
   - `Copy-Item docs/loops/t322/t322-rematch.test.ts open-brain/tests/t322-rematch.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `14 failed | 117 passed (131)` tests, red only the 14
     rows of t322-rematch.test.ts. Paste the summary and each `x` row. Commit the test file.
4. **Commit 2** (`T322: open-brain rematch rewrites a lesson's MATCH: line in place (T-322)`).
   - `Copy-Item docs/loops/t322/rematch.ts open-brain/src/pipelines/store/rematch.ts`. From the clone root:
     `node docs/loops/t322/apply.cjs . docs/loops/t322/edits.txt` prints exactly `APPLIED 6 edits to 4 files`.
   - In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (each exit 0).
   - Run the five files: `134 passed (134)`.
   - `npx vitest run tests/shared tests/trigger tests/pipelines/sync tests/server.test.ts tests/t261-s2.test.ts tests/t294-small-fixes.test.ts tests/t322-rematch.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait).
     Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`;
     both must show `[pass]`.
   - Commit `open-brain/src/pipelines/store/rematch.ts` and the four edited files.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m6: `node docs/loops/t322/apply.cjs . docs/loops/t322/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run
   `npx vitest run tests/t322-rematch.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> K1, C1; m2 -> K2; m3 -> K4b; m4 -> K5; m5 -> K4d;
   m6 -> C1); restore with `git checkout -- open-brain` and check the status is empty. After m6, run the five files once
   more: `134 passed (134)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 6 paths:
   `M open-brain/src/cli-memory.ts`, `M open-brain/src/cli-spec.ts`, `M open-brain/src/cli.ts`,
   `A open-brain/src/pipelines/store/rematch.ts`, `M open-brain/tests/shared/cli-args.test.ts`,
   `A open-brain/tests/t322-rematch.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t322-rematch` must equal HEAD.
   `gh pr create --base master --head feat/t322-rematch --title "T322: open-brain rematch rewrites a lesson's MATCH: line in place (T-322)" --body "Brief: docs/loops/t322-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t322 <sha40> PR #<n>` or `BLOCKED t322 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

On the desktop: sia-rebuild on the main checkout. Then, with the main build:
1. `node <main>/open-brain/build/cli.js rematch --id 751 --match none --dry-run`: expect it to name entry 751 and the
   line it would write, and to write nothing.
2. The real run: `node <main>/open-brain/build/cli.js rematch --id 751 --match none`.
3. `node <main>/open-brain/build/cli.js trigger-keys` and confirm 751 is no longer in the sidecar's command keys; its
   helpful (29) and recall_count (38) are unchanged in `knowledge_index`.

Overlap with T-295 S2 (in SIM as #146): its `cli.ts` memory forward line and `cli-args.test.ts`'s sorted command list
conflict with this change mechanically, whichever merges second. The resolution: the forward line carries both sets
of names, and the list stays sorted with `list`, `rematch`, `stats` in place.
