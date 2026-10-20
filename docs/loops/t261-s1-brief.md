# T261-S1: the module-boundary check sees dynamic imports (T-261 step 1)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t261-s1-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-19, session 173. **Task:** T-261 (core/memory split; Aaron, 10-19: "go ahead").
**Tag:** `T261-S1`. **Size:** SMALL (1 src file, 9 edits; 1 new test file). **Base:** the dispatch SHA clark names (a
master that contains this brief). **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: checkModuleBoundary MEMORY_SIDE (checks.ts: literal import() is an edge; DYNAMIC_MEMORY_LOADS allowlist; 5 files reclassified)
```

## Why

Step 0 (`docs/loops/t261-core-split-step0.md`) measured the boundary at `c3b5ceec`. It found three things:

1. **The check matches static `import … from` only.** `cli.ts` (core) reaches memory through 10 dynamic
   `import()` calls in 5 subcommands, 8 distinct crossings in all, and none of them is visible to the check.
2. **Five files are filed as core but used only by memory.** Memory imports each of `lifecycle.ts`, `shared/fts.ts`,
   `shared/vault-path-segment.ts`, `shared/yaml-frontmatter.ts` and `shared/content-guard.ts`; no core file does.
3. A core package would have to export what memory imports from core. Finding 2 shrinks that set from 24 files to 19.

**Fix:**
- A literal `import("…")` specifier becomes an edge.
- Core may cross into memory through one only when `importer -> target` is listed in a new `DYNAMIC_MEMORY_LOADS`.
  The list starts as the 8 crossings that exist, so this repo stays green, and a new crossing goes red until it is
  listed on purpose.
- The 5 files join `MEMORY_SIDE`.
- The pass message counts the allowed loads, and the LIMIT text names what is still invisible: a computed specifier.

**No run-time behaviour changes.** Only `/sync`'s `module-boundary` result and its message change.

Out of scope: moving the memory subcommands out of `cli.ts` (step 2), and the `yaml` dependency declaration (it
changes `package-lock.json`; later step).

## The change, exactly

All files are under `docs/loops/t261-s1/`.

- **`edits.txt`:** 9 exact-once replacements in `open-brain/src/pipelines/sync/checks.ts`:
  1. `MEMORY_SIDE` gains the 5 files.
  2. `DYNAMIC_MEMORY_LOADS` is added after `isMemorySide`.
  3. A fourth limit is added to the doc comment.
  4. The relative-specifier resolution moves into a `resolveSpec` closure, unchanged.
  5. The static loop calls `resolveSpec`, then scans for dynamic imports.
  6. The violation loop collects dynamic loads, and an unlisted one is a violation.
  7. The pass and issue messages carry the count and the new LIMIT wording.
  8-9. The two LIMIT strings.
- **`t261-s1.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/pipelines/sync/t261-s1.test.ts`.
  - R1: an unlisted dynamic import of a memory module is an issue naming it.
  - R2: an unlisted dynamic import of `better-sqlite3` is an issue naming it.
  - R3: a listed load passes and is counted.
  - R4: an unresolved dynamic relative import refuses, as a static one does.
  - R5: this repository passes with exactly 8 allowed loads.
  - R6: the 5 files are on the memory side.
  - R7 (guard): a memory file may load memory dynamically.

## Measured before dispatch

QA PC SIM T261-S1 by clark at `dfae3e3a` (master `2ac36f81` plus these files) used these exact files. sha256
prefixes:

| File | sha256 prefix |
|---|---|
| edits | `1d7284653a521c4d` |
| test | `ab747e7a150d1a01` |
| m1 | `d0f6913d8313ced2` |
| m2 | `d899fe272ada0f87` |
| m3 | `b7f958daa4f5fa85` |

- The new file on the unpatched base: `6 failed | 1 passed (7)`. R1-R6 red, R7 green.
- Apply: `APPLIED 9 edits to 1 files`. Both tsc runs and the build exit 0.
- The step 4 run: `54 passed (54)` files, `873 passed (873)` tests, with no Errors line.
- `node open-brain/build/cli.js sync .` printed `module-boundary [pass]` with `156 file(s), 125 core` and `8 dynamic
  memory load(s) allowed by DYNAMIC_MEMORY_LOADS`.
- Mutants, each on the patched tree:

  | Mutant | What it does | Red rows |
  |---|---|---|
  | m1 | drops dynamic relative edges | R1, R3, R5 |
  | m2 | ignores the allowlist | R3, R5 |
  | m3 | puts `lifecycle.ts` back on the core side | R6 |

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/pipelines/sync/module-boundary.test.ts` | stays green | Its fixtures have no dynamic imports. "this repository's own source" passes. `LIMIT:` and "load-time native resolution" are still in the message. Green in the SIM. |
| `tests/pipelines/sync/t048-counts-parity.test.ts` | stays green | "1 type-only and 3 package import(s) are not edges" is unchanged; the count is appended after it. Green in the SIM. |
| `tests/pipelines/sync/t048-r1b.test.ts`, `t048-unreadable.test.ts` | stay green | Fixture trees without dynamic imports. Green in the SIM. |
| the rest of `tests/pipelines/sync`, `tests/shared`, `tests/server.test.ts` | stay green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED T261-S1 <test name>`. The one exception is T-292's
`Timeout calling onTaskUpdate` error when every test passed: paste it and go on.

## Steps

1. **Shell.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t261-s1-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`. Otherwise STOP.
2. **Clone and install.**
   - Make a fresh clone into `(Join-Path $env:TEMP "t261-s1-wt")`, unless the launcher named one.
   - Run `git checkout -q -b fix/t261-s1-dynamic-boundary <base>`. HEAD must equal the base, and the porcelain must be
     empty.
   - In `open-brain`, run `npm ci`, then the better-sqlite3 probe.
   - Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing
     processes by name, the real `~/.claude/open-brain/`, `~/.claude/commands/`, and anything under `docs/`.
3. **Commit 1** (`T261-S1: rows for dynamic imports in the module-boundary check`). It holds the test file only.
   - Run `Copy-Item docs/loops/t261-s1/t261-s1.test.ts open-brain/tests/pipelines/sync/`.
   - Run `$env:NO_COLOR='1'`. Then, in `open-brain`, run
     `npx vitest run tests/pipelines/sync/t261-s1.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `6 failed | 1 passed (7)`. Paste the summary and the `x` rows.
4. **Commit 2** (`T261-S1: the module-boundary check sees dynamic imports; 5 memory-only files reclassified (T-261)`).
   - From the clone root, `node docs/loops/t261-s1/apply.cjs . docs/loops/t261-s1/edits.txt` must print exactly
     `APPLIED 9 edits to 1 files`.
   - Run `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then `npm run build` (exit 0).
   - Run `npx vitest run tests/pipelines/sync tests/shared tests/server.test.ts --no-file-parallelism --testTimeout=180000`
     (25-minute cap). Expect `873 passed` (more only if the base added tests: then paste the count and the base's new
     test files). Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root, `node open-brain/build/cli.js sync .`: paste the `module-boundary` line. Expect `[pass]`
     with `8 dynamic memory load(s) allowed by DYNAMIC_MEMORY_LOADS`.
5. **Check the commits.**
   - Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   - `git log --oneline <base>..HEAD` shows 2 lines.
   - The status is empty.
6. **Mutants.** Do this on the committed fix, for each of `m1.txt`, `m2.txt` and `m3.txt`:
   - Run `node docs/loops/t261-s1/apply.cjs . docs/loops/t261-s1/<mN>`. It prints `APPLIED 1 edits to 1 files`.
   - Run the new test file. Paste the summary and the `x` rows.
   - Restore with `git checkout -- open-brain/src`. The status must be empty.
   - Never commit a mutant.
   - Expected red rows: m1 R1, R3, R5 · m2 R3, R5 · m3 R6.
7. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/pipelines/sync/checks.ts`
   - `open-brain/tests/pipelines/sync/t261-s1.test.ts`
8. **Push and open the PR.**
   - Push, never force. `git ls-remote origin refs/heads/fix/t261-s1-dynamic-boundary` must equal HEAD.
   - Run `gh pr create --base master --head fix/t261-s1-dynamic-boundary --title "T261-S1: the module-boundary check sees dynamic imports (T-261)" --body "Brief: docs/loops/t261-s1-brief.md."`.
   - Then run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T261-S1 <sha40> PR #<n>` or `BLOCKED T261-S1 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply.
- Every number is pasted output, with its command shown above it. Mark anything not run `NOT RUN`.
- Do not merge.

## After merge (not this run)

REBUILT. `/sync` in the main checkout prints `module-boundary [pass]` with the 8 allowed loads. Step 2 moves
`relocate`, `scrub-trigger-fires`, `trigger-keys` and `topics` behind a memory entry point and shrinks
`DYNAMIC_MEMORY_LOADS` to `sync`'s two optional loads.
