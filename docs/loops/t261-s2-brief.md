# T261-S2: the memory subcommands leave the core CLI (T-261 step 2)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t261-s2-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-19, session 173. **Task:** T-261 (core/memory split; Aaron, 10-19: "go ahead").
**Tag:** `T261-S2`. **Size:** MEDIUM (3 src files changed with 6 edits, 1 src file added; 1 new test file).
**Base:** the dispatch SHA Atlas names. It must contain the T261-S1 merge (`DYNAMIC_MEMORY_LOADS` in
`open-brain/src/pipelines/sync/checks.ts`) and this brief. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: parseOrRefuse DYNAMIC_MEMORY_LOADS MEMORY_SIDE (cli.ts forwards relocate, scrub-trigger-fires, trigger-keys and topics to the new memory-side cli-memory.ts)
```

## Why

Step 0 found that `relocate`, `scrub-trigger-fires`, `trigger-keys` and `topics` are memory commands living in the
core CLI. Between them they make 5 of the 8 `DYNAMIC_MEMORY_LOADS` crossings that T261-S1 listed. Step 2 moves their
bodies, verbatim, into a new memory-side `src/cli-memory.ts`. `cli.ts` forwards the same four names through one
dynamic import.

- **Unchanged for anyone running the commands:** the names, flags, usage text, output and exit codes.
- **The allowlist** goes from 8 entries to 4: `sync`'s two optional loads, `db-v2.ts` for `sync --score`, and
  `cli.ts -> cli-memory.ts`.
- **`parseOrRefuse` (T-185)** moves from `cli.ts` to `shared/cli-args.ts`, verbatim and exported, so both CLIs share
  one copy.

The edits were generated from the T261-S1-patched source by a script, so the 174-line moved block matches the source
byte for byte. Out of scope: an `open-brain memory <cmd>` spelling, a separate bin, the physical package split (step
3) and the `yaml` declaration.

## The change, exactly

All files are under `docs/loops/t261-s2/`.

- **`edits.txt`:** 6 exact-once replacements in 3 files:
  1. `open-brain/src/cli.ts`: the `cli-args` import becomes `import { parseOrRefuse }`.
  2. `open-brain/src/cli.ts`: the local `parseOrRefuse` and its doc comment become one pointer comment.
  3. `open-brain/src/cli.ts`: lines `relocate` … end of `topics` (174 lines) become a 4-line forward.
  4. `open-brain/src/shared/cli-args.ts`: gains the exported `parseOrRefuse`, verbatim, above `parseArgs`.
  5. `open-brain/src/pipelines/sync/checks.ts`: `MEMORY_SIDE` gains `cli-memory.ts`.
  6. `open-brain/src/pipelines/sync/checks.ts`: `DYNAMIC_MEMORY_LOADS` shrinks to its 4 entries.
- **`s1-row.txt`:** 2 exact edits to `open-brain/tests/pipelines/sync/t261-s1.test.ts` (R5: 8 becomes 4).
- **`cli-memory.ts`:** copied verbatim, as a new file, to `open-brain/src/cli-memory.ts`. It exports
  `runMemoryCommand(args)`, which holds the four bodies unchanged and indented one level.
- **`t261-s2.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t261-s2.test.ts`.
  - R1: this repository passes the boundary check with exactly 4 allowed dynamic loads.
  - R2: `cli-memory.ts` is on the memory side.
  - R3: `cli.ts` no longer holds the four bodies, and it imports `./cli-memory.js`.
  - R4 (guard): `topics --aply` still exits 2 with "topics refused", through the forward.

## Measured before dispatch

QA PC SIM T261-S2 by clark at `d631bba2` (master `87a3b564` plus these files, with T261-S1's edits applied first)
used these exact files. sha256 prefixes:

| File | sha256 prefix |
|---|---|
| edits | `d3163bbf5b5f7524` |
| cli-memory.ts | `1397c43f0b157b19` |
| test | `51f7b0a968bff963` |
| m1 | `8d918d716d53a7e7` |
| m2 | `2c18ba40a5d6c9ce` |

- The new file on the S1 base: `3 failed | 1 passed (4)`. R1-R3 red, R4 green.
- Apply: `APPLIED 6 edits to 3 files`. Both tsc runs and the build exit 0.
- The step 4 run: `59 passed (59)` files, `949 passed (949)` tests, with no Errors line.
- `node open-brain/build/cli.js sync .`: `module-boundary [pass]` with `157 file(s), 125 core` and `4 dynamic memory
  load(s) allowed by DYNAMIC_MEMORY_LOADS`.
- `node open-brain/build/cli.js topics --aply`: exit 2, `topics refused: unrecognised flag "--aply". … Nothing was run.`
- Mutants, each on the patched tree:

  | Mutant | What it does | Red rows |
  |---|---|---|
  | m1 | drops `topics` from the forward | R4 |
  | m2 | leaves `cli-memory.ts` off the memory side | R1, R2 |

## Existing tests (verdicts)

These spawn `tsx src/cli.ts <command>` and now pass through the forward. All were green in the SIM.

| Test | Verdict | Why |
|---|---|---|
| `tests/cli-flags.test.ts` (relocate/topics `--aply` refusals; refusals before the DB is created) | stays green | Same parse, same messages, same exit 2; the forward imports nothing before parsing. |
| `tests/audit-fix-a1-r7-scrub.test.ts`, `tests/audit-fix-a1-r8-scrub.test.ts` | stay green | `scrub-trigger-fires` body unchanged, exit 2 on an empty `--db`. |
| `tests/t249-worktree-identity.test.ts` (`relocate --worktrees`) | stays green | Body unchanged. |
| `tests/t294-small-fixes.test.ts` K1, K1b (`trigger-keys`) | stay green | "trigger-keys refused" / exit 2, "no store at" / exit 1, unchanged. |
| `tests/shared/cli-args.test.ts` (usage lines match `COMMAND_SPECS`) | stays green | Usage text and `cli-spec.ts` untouched. |
| `tests/pipelines/sync/t261-s1.test.ts` R5 ("8 dynamic memory load(s)") | **edited by this run, see step 4** | The count is now 4. This is the one existing row the change moves. |
| `tests/pipelines/sync/module-boundary.test.ts`, the rest of `tests/pipelines/sync`, `tests/shared`, `tests/server.test.ts` | stay green | Green in the SIM. |

**The t261-s1 R5 row:** the SIM ran before S1 merged, so it did not carry that file. In this run, step 4 applies
`docs/loops/t261-s2/s1-row.txt`, 2 exact edits that change that row's title and expected count from 8 to 4. Nothing
else in that file changes.

Any other red existing row means STOP and report `BLOCKED T261-S2 <test name>`. The one exception is T-292's
`Timeout calling onTaskUpdate` error when every test passed: paste it and go on.

## Steps

1. **Shell.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t261-s2-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`. Otherwise STOP.
2. **Clone and install.**
   - Make a fresh clone into `(Join-Path $env:TEMP "t261-s2-wt")`, unless the launcher named one.
   - Run `git checkout -q -b fix/t261-s2-cli-memory <base>`. HEAD must equal the base, and the porcelain must be
     empty.
   - `git grep -c "DYNAMIC_MEMORY_LOADS" <base> -- open-brain/src/pipelines/sync/checks.ts` must be non-zero.
     Otherwise STOP with `BLOCKED T261-S2 base lacks T261-S1`.
   - In `open-brain`, run `npm ci`, then the better-sqlite3 probe.
   - Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/open-brain/`, `~/.claude/commands/`, and anything under `docs/`.
3. **Commit 1** (`T261-S2: rows for the memory subcommands leaving the core CLI`). It holds the new test file only.
   - Run `Copy-Item docs/loops/t261-s2/t261-s2.test.ts open-brain/tests/`.
   - Run `$env:NO_COLOR='1'`. Then, in `open-brain`, run
     `npx vitest run tests/t261-s2.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `3 failed | 1 passed (4)`. Paste the summary and the `x` rows.
4. **Commit 2** (`T261-S2: relocate, scrub-trigger-fires, trigger-keys and topics move to the memory-side cli-memory.ts (T-261)`).
   - From the clone root, `node docs/loops/t261-s2/apply.cjs . docs/loops/t261-s2/edits.txt` must print exactly
     `APPLIED 6 edits to 3 files`.
   - Run `Copy-Item docs/loops/t261-s2/cli-memory.ts open-brain/src/`.
   - `node docs/loops/t261-s2/apply.cjs . docs/loops/t261-s2/s1-row.txt` must print exactly
     `APPLIED 2 edits to 1 files`. It changes t261-s1 R5's title and expected count from 8 to 4, nothing else.
   - Run `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - Run `npx vitest run tests/t261-s2.test.ts tests/pipelines/sync tests/shared tests/server.test.ts tests/cli-flags.test.ts tests/audit-fix-a1-r7-scrub.test.ts tests/audit-fix-a1-r8-scrub.test.ts tests/t249-worktree-identity.test.ts tests/t294-small-fixes.test.ts --no-file-parallelism --testTimeout=180000`
     (25-minute cap). Expect 0 failed, with about 956 tests: the SIM's 949 plus t261-s1's 7. Paste the
     `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root, `node open-brain/build/cli.js sync .`: paste the `module-boundary` line. Expect `[pass]`
     with `4 dynamic memory load(s) allowed by DYNAMIC_MEMORY_LOADS`.
   - `node open-brain/build/cli.js topics --aply`: paste the exit code and stderr. Expect 2 and `topics refused`.
5. **Check the commits.**
   - Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines.
   - The status is empty.
6. **Mutants.** Do this on the committed fix, for each of `m1.txt` and `m2.txt`:
   - Run `node docs/loops/t261-s2/apply.cjs . docs/loops/t261-s2/<mN>`. It prints `APPLIED 1 edits to 1 files`.
   - Run `tests/t261-s2.test.ts`. Paste the summary and the `x` rows.
   - Restore with `git checkout -- open-brain/src`. The status must be empty.
   - Never commit a mutant.
   - Expected red rows: m1 R4 · m2 R1, R2.
7. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/cli-memory.ts`
   - `open-brain/src/cli.ts`
   - `open-brain/src/pipelines/sync/checks.ts`
   - `open-brain/src/shared/cli-args.ts`
   - `open-brain/tests/pipelines/sync/t261-s1.test.ts`
   - `open-brain/tests/t261-s2.test.ts`
8. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/fix/t261-s2-cli-memory` must equal HEAD.
   - Run `gh pr create --base master --head fix/t261-s2-cli-memory --title "T261-S2: the memory subcommands leave the core CLI (T-261)" --body "Brief: docs/loops/t261-s2-brief.md."`.
   - Then run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T261-S2 <sha40> PR #<n>` or `BLOCKED T261-S2 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.

## After merge (not this run)

REBUILT. `/sync` prints `module-boundary [pass]` with 4 allowed loads, and `open-brain topics`, `relocate`,
`trigger-keys` and `scrub-trigger-fires` behave as before. Step 3, the physical package split, waits for Aaron's call
(step 0's "Open for Aaron").
