# T162A: rematch adds a first MATCH key to an unkeyed lesson (T-162 slice A)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-26, session 175. **Task:** T-162 slice A (P2). **Tag:** `t162a`. **Size:** SMALL (7
edits in 4 files, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief and
T-322's merge `ea3dd365`). **Authority:** D-145 (work the backlog by priority) and D-163 (planner launches and merges
on its own QA ACCEPT); the slice is the planner's T-162 proposal recorded at rev 589.

```text
IMPACT-TARGETS: rematch, runMemoryCommand (pipelines/store/rematch.ts gains an add path; cli-memory.ts's rematch branch prints it)
```

## Why

T-162: lessons 292 (mutation-testing-verify-the-mutation-landed) and 604 (a-mutant-that-does-not-type-check-is-not-a-
valid-mutant) were stored before D-155 and have NO `MATCH:` line, so the recall trigger can never inject them. T-322's
`rematch` refuses a note with 0 MATCH lines (row K4f), so there is no supported way to key them without `ob_forget`,
which loses their counts.

After this slice, `rematch --id <n> --match <value>`:
- **adds** one `MATCH: <value>` line when the note AND the indexed content both have exactly 0 MATCH lines (`added:
  true`, `before: null`), keeping the note's own line ending and every other byte, then re-indexes through
  `indexKnowledge` (counters, recall_count, last_recalled_at, created_at and the id kept), and the CLI refreshes the
  trigger key sidecar, exactly as the rewrite path does;
- places the line as the LAST line of the body, or, when the note has a `## Log` line, at the end of the current value
  before the log (the log holds what is no longer true; a state row's index is its current value only, T-022);
- **refuses** `--match none` on a 0-line lesson (it is already lookup-only; nothing to add);
- **refuses** a note and an index that disagree (one line against none, either way), and 2+ lines in either, as today;
- keeps T-322's rewrite path byte-for-byte (rows K1-K6, C1-C3).

## The change, exactly

Files under `docs/loops/t162a/`.
- **`t162a-rematch-add.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t162a-rematch-add.test.ts`.
  A1-A7 (module), C4 (CLI through tsx with `KNOWLEDGE_V2_DB` on a temp store).
- **`edits.txt`:** 7 edits in 4 files: `open-brain/src/pipelines/store/rematch.ts` (header, the result type gains
  `added` and a nullable `before`, `matchLines` + `appendMatchLine` replace `oneMatchLine`, the body),
  `open-brain/src/cli-memory.ts` (the rematch branch prints `added: "<line>"` / `would add (dry run, nothing
  written)`), `open-brain/src/cli.ts` (usage text only; flags unchanged), `open-brain/tests/t322-rematch.test.ts` (K4f's
  title only). The K4f title edit goes in commit 2 with the code: its old title says a 0-line note refuses, which is
  only true of `--match none` once the add path exists, so the title changes in the same commit as the behaviour. Its
  assertion is unchanged and stays green in both commits.

## Measured before dispatch

QA PC SIM `sim-t162a` (job #202) at `549aee5c`: ALL PASS. The anchors were re-checked on master `549aee5c` (none of the
4 files changed since): `APPLIED 7 edits to 4 files`.
- Baseline (five files, the new test only): `1 failed | 4 passed (5)` files, `8 failed | 133 passed (141)` tests; all
  8 t162a rows red (A1-A4, A7 `ok: false` from "has 0 MATCH: line(s)"; A5 lacks "they disagree"; A6 lacks "already
  lookup-only"; C4 exits 1 with `rematch refused`); the other four files green, K4f included.
- Apply: `APPLIED 7 edits to 4 files`; both tsc runs and `npm run build` exit 0; five files `141 passed (141)`.
- Wide run: `Test Files 79 passed (79)`, `Tests 1115 passed (1115)`, no Errors line, no timeouts.
- `retirements [pass]`, `module-boundary [pass]` (4 dynamic memory loads).
- m1 -> A1, A3, A4, C4; m2 -> A4; m3 -> A3; m4 -> A5; m5 -> A6; m6 -> A7.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `t322-rematch.test.ts` K4f (seeds 0 lines, runs `none`) | title edited in commit 2; stays green | `none` on 0 lines still refuses; the message keeps "has 0 MATCH: line(s)". Green in the SIM. |
| `t322-rematch.test.ts` K4b (2 lines) | stays green | Refused by the 2+ check; the message keeps "has 2 MATCH: line(s)". |
| `t322-rematch.test.ts` K1-K3, K4a, K4c-K4e, K5, K6, C1-C3 | stay green | The rewrite path is unchanged; `added: false` is an extra key under `toMatchObject`. |
| `tests/shared/cli-args.test.ts` (LINES table, `rematch` usage) | stays green | Only the description text changes; flags unchanged. |
| `tests/t261-s2.test.ts` R1-R4 | stays green | Memory side; no new import. |
| `tests/trigger/t170-match-keys.test.ts` | stays green | `writeTriggerKeys` and `parseCommandKey` unchanged. |
| `hub-presence.test.ts`, `state-import-r4.test.ts`, `end-fix-q3.test.ts` | known flaky under load | Timeouts on the shared QA PC in SIMs #134/#143, green alone. See the exception rule. |

Any other red existing row means STOP and report `BLOCKED t162a <test name>`. Exceptions, from T-292 load on the
shared QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in
files other than the five files, with that error or a timeout: re-run each such file alone up to 3 times; green on any
run alone means paste every run and go on, red on all 3 means STOP.

## Steps

"The five files" means, from `open-brain`:
`npx vitest run tests/t162a-rematch-add.test.ts tests/t322-rematch.test.ts tests/shared/cli-args.test.ts tests/t261-s2.test.ts tests/trigger/t170-match-keys.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git merge-base --is-ancestor ea3dd365 HEAD` must exit 0. Then
   `git checkout -q -b feat/t162a-rematch-add`. HEAD must equal START and the porcelain must be empty. In `open-brain`:
   `npm ci`, then `node -e "require('better-sqlite3')"` (on "Could not locate the bindings file":
   `npm rebuild better-sqlite3` and say so). Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash, reset --hard,
   force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real `~/.claude/`
   (including `knowledge-v2.db`), any MCP config, and anything under `docs/`.
3. **Commit 1** (`T162A: rows for rematch adding a first MATCH key`).
   - `Copy-Item docs/loops/t162a/t162a-rematch-add.test.ts open-brain/tests/t162a-rematch-add.test.ts`.
   - Run the five files. Expect `1 failed | 4 passed (5)` files and `8 failed | 133 passed (141)` tests, red only the 8
     rows of t162a-rematch-add.test.ts. Paste the summary and each `x` row. Commit the test file.
4. **Commit 2** (`T162A: rematch adds a first MATCH key to an unkeyed lesson (T-162 slice A)`).
   - From the clone root: `node docs/loops/t162a/apply.cjs . docs/loops/t162a/edits.txt` prints exactly
     `APPLIED 7 edits to 4 files`.
   - In `open-brain`: `npx tsc --noEmit`, `npx tsc -p tsconfig.tests.json --noEmit`, `npm run build` (each exit 0).
   - Run the five files: `141 passed (141)`.
   - `npx vitest run tests/shared tests/trigger tests/pipelines/sync tests/server.test.ts tests/t261-s2.test.ts tests/t294-small-fixes.test.ts tests/t322-rematch.test.ts tests/t162a-rematch-add.test.ts --no-file-parallelism --testTimeout=180000`
     (40-minute cap; foreground with a tool timeout of at least 40 minutes, or background to a log file and wait).
     Expect 0 failed, subject to the exception rule. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "module-boundary|retirements"`;
     both must show `[pass]`.
   - Commit the four edited files.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutants**, on the COMMITTED fix, for each of m1..m6: `node docs/loops/t162a/apply.cjs . docs/loops/t162a/<m>.txt`
   prints `APPLIED 1 edits to 1 files`; run
   `npx vitest run tests/t162a-rematch-add.test.ts --no-file-parallelism --testTimeout=180000`;
   paste the `Tests` line and the `x` rows (expected: m1 -> A1, A3, A4, C4; m2 -> A4; m3 -> A3; m4 -> A5; m5 -> A6;
   m6 -> A7); restore with `git checkout -- open-brain` and check the status is empty. After m6, run the five files once
   more: `141 passed (141)`. Never commit a mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 5 paths:
   `M open-brain/src/cli-memory.ts`, `M open-brain/src/cli.ts`, `M open-brain/src/pipelines/store/rematch.ts`,
   `A open-brain/tests/t162a-rematch-add.test.ts`, `M open-brain/tests/t322-rematch.test.ts`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/feat/t162a-rematch-add` must equal
   HEAD. `gh pr create --base master --head feat/t162a-rematch-add --title "T162A: rematch adds a first MATCH key to an unkeyed lesson (T-162 slice A)" --body "Brief: docs/loops/t162a-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t162a <sha40> PR #<n>` or `BLOCKED t162a <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (desktop, not this run)

1. sia-rebuild on the main checkout.
2. `node <main>/open-brain/build/cli.js rematch --id 292 --match "<key>" --dry-run` and the same for 604. The two keys
   are PLANNER PICKS AT MERGE (T-162 note: the mutant-apply act); expect each to name the entry and the line it would
   add, and to write nothing.
3. The real runs, without `--dry-run`.
4. `node <main>/open-brain/build/cli.js trigger-keys` and confirm 292 and 604 now appear in
   `recall-trigger-keys.json`'s command keys, with helpful and recall_count unchanged in `knowledge_index`.
