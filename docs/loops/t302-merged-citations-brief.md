# T-302: the greeting says when commits the handoff cites are already in the upstream branch

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t302-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-16, session 173. **Task:** T-302 (P1). **Tag:** `T-302`. **Size:** SMALL to MEDIUM.
- **The edits:** one new src file plus edits to three src files and one existing test, all given verbatim.
- **Base:** the dispatch SHA clark names, which is a master that contains this brief.
- **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: renderBriefing renderBudgeted renderStartReport (briefing.ts gains an optional input on both layouts; start-report.ts wires it behind greeting.json merged_citations; new handoff-merged.ts)
```

## Why

- **The incident.** Maker's S68 /start (2026-10-17 03:01:33Z) still said "FOUR PRs READY … waiting on Aaron's ONE merge word". WAITING ON AARON still asked for the merge.
- **The truth.** Makerspace #129-#132 had merged at 02:57:55-02:58:14Z.
- **The data was there.** The seat's own fetch, at 03:01:31Z, already held the merges. All four heads (429d521e, 033afb5e, e3086cac, 6a0daf85) were ancestors of origin/main. Scorecard rows 1 (state match) and 7 (waiting-on-Aaron true) FAILED on a fact that was already on disk.
- **The fix.** Name the SHAs the reader's OWN handoff cites that the upstream ref already contains. This is local git only, with no network:
  - **Scanned:** the pick-up, watch-outs, UNRESOLVED questions and `loop_state.open_prs[]` ref/note.
  - **Skipped:** all-digit tokens, which are dates and numbers, not SHAs.
  - **Limits:** at most 24 tokens are checked and 4 are shown, then `(+N)`.
  - **Lower bound:** a squash or rebase merge leaves the cited head outside the branch, so it is not caught. A SHA that was already merged when the handoff was written is named too. The line says "already in", never "merged since".
- **Opt-in.** It is gated by greeting.json `merged_citations`, default OFF, like every greeting flag, so other repos render byte-identically.

## The change, exactly

All files are under `docs/loops/t302/`:
- `handoff-merged.ts` → `open-brain/src/pipelines/session-start/handoff-merged.ts` (new, verbatim).
- `edits.txt`: 7 exact-once replacements over `briefing.ts`, `start-report.ts` and `greeting-flags.ts` in `open-brain/src/pipelines/session-start/`. Apply with `apply.cjs`.
- `budget-edit.txt`: 4 replacements in `open-brain/tests/pipelines/session-start/briefing-budget.test.ts`. This is the **one allowed existing-test edit**:
  - The EVERY-flag worst-case row gains the longest merged line (83 chars).
  - Its pick-up assertion becomes `endsWith(\` · ${notice} · ${MERGED_MAX}\`)`.
  - It logs `T302-WORST lines=… chars=…`.
- `t302-merged-citations.test.ts` → `open-brain/tests/pipelines/session-start/` (new, verbatim).

How the line is shown:
- **Legacy layout:** the line prints on its own after the pick-up (and after the missing-handoff notice).
- **Budgeted layout:** the line is appended to the pick-up line after the missing-handoff notice. Its length plus 3 is taken out of the pick-up's 400-char cap, so neither the line count nor the char total grows.

## Measured before dispatch (QA PC SIMs by clark at 2cf9a50d)

- **SIM T302 (first draft).** The worst case came to 4501 chars, 101 over 4400. The note was shortened and its room is now paid out of the pick-up cap.
  - A test that cited 8-char prefixes was flaky: a fresh SHA's prefix is all digits about 2% of the time, and the scan skips those by design.
  - Every row now cites full SHAs.
- **SIM T302-2 (these exact files).** Hashes:

  | File | sha256 prefix |
  |---|---|
  | `edits.txt` | `b4847e99e21ef134` |
  | `budget-edit.txt` | `e6a547828bcc494c` |
  | `handoff-merged.ts` | `df089d7bf5e5b4e3` |
  | test file | `9eb41df9e8ac7114` |

  Results:
  - **New file on the unpatched base:** a file-level failure (the module is absent), 0 tests.
  - **After apply:** tsc 0, tests tsc 0. `tests/pipelines/session-start` plus `tests/server.test.ts`: 43 files, `666 passed`. `T302-WORST lines=31 chars=4395`.
  - **Mutants:**

    | Mutant | Red rows |
    |---|---|
    | m1 | M1, M2 |
    | m2 | M3 |
    | m3 | M3 |
    | m4 | M5 budgeted, M6 |
    | m5 | M4 |
    | m6 | M6 |

## Existing tests (verdicts)

- **Changed:** only `briefing-budget.test.ts`'s EVERY-flag worst-case row, through `budget-edit.txt`.
- **Unchanged:** everything else in `tests/pipelines/session-start` and `tests/server.test.ts` (the T-199 missing-handoff rows, a2a-byte-identical, t298 G2-G12, focus, handoff-by-checkout).
- **Any other red row:** STOP and reply `BLOCKED T-302 <test name>`.

## Steps

1. **Environment.** In PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t302-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` must print `v22.*`; otherwise STOP.
2. **Clone.** Make a fresh clone into `(Join-Path $env:TEMP "t302-wt")`, unless the launcher named one.
   - Run `git checkout -q -b fix/t302-merged-citations <base>`.
   - Check that HEAD equals the base, the porcelain is empty, and `git ls-tree --name-only HEAD docs/loops/t302/edits.txt` prints the path.
   - In `open-brain`, run `npm ci`, then `node -e "require('better-sqlite3')"`. If that fails with "Could not locate the bindings file", run `npm rebuild better-sqlite3` and say so.
   - Forbidden:
     - `git stash`, `reset --hard`, `--force`, rebase, amend, and any other checkout;
     - `npm run test:heavy`;
     - killing processes by name;
     - any read or write of the real `~/.claude/open-brain/`;
     - editing a real `settings.json`, any `greeting.json`, or anything under `docs/`.
3. **Commit 1**, message `T-302: rows for SHAs the handoff cites that the upstream contains`:
   - Run `Copy-Item docs/loops/t302/t302-merged-citations.test.ts open-brain/tests/pipelines/session-start/`. The commit holds that file only.
   - Set `$env:NO_COLOR='1'`. In `open-brain`, run `npx vitest run tests/pipelines/session-start/t302-merged-citations.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect a file-level failure (cannot import handoff-merged.js). Paste the summary.
4. **Commit 2**, message `T-302: the greeting names cited SHAs already in the upstream branch (opt-in merged_citations)`:
   - Run `Copy-Item docs/loops/t302/handoff-merged.ts open-brain/src/pipelines/session-start/`.
   - From the clone root, run `node docs/loops/t302/apply.cjs . docs/loops/t302/edits.txt`. It must print exactly `APPLIED 7 edits to 3 files`.
   - Then run `node docs/loops/t302/apply.cjs . docs/loops/t302/budget-edit.txt`. It must print exactly `APPLIED 4 edits to 1 files`. Anything else: STOP.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` both exit 0, and `npm run build` exits 0.
   - Run `npx vitest run tests/pipelines/session-start tests/server.test.ts --no-file-parallelism --testTimeout=180000` (25-minute cap). Expect `666 passed`. Paste the `Test Files` and `Tests` lines and the `T302-WORST` line.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. `git log --oneline <base>..HEAD` shows 2 lines, and status is empty.
6. **Mutants.** For each of `docs/loops/t302/m1.txt` … `m6.txt`:
   - Run `node docs/loops/t302/apply.cjs . <mN>`; it prints `APPLIED 1 edits to 1 files`.
   - Run the new test file. Paste the summary and the `x` rows.
   - Restore with `git checkout -- open-brain/src/pipelines/session-start/handoff-merged.ts open-brain/src/pipelines/session-start/briefing.ts`. Status must be empty.

   Never commit a mutant. Expected red rows:

   | Mutant | Red rows |
   |---|---|
   | M1 | M1, M2 |
   | M2 | M3 |
   | M3 | M3 |
   | M4 | M5 budgeted, M6 |
   | M5 | M4 |
   | M6 | M6 |
7. **Check the diff.** `git diff --name-only <base>..HEAD` shows exactly these 6 paths:
   - `open-brain/src/pipelines/session-start/briefing.ts`
   - `open-brain/src/pipelines/session-start/greeting-flags.ts`
   - `open-brain/src/pipelines/session-start/handoff-merged.ts`
   - `open-brain/src/pipelines/session-start/start-report.ts`
   - `open-brain/tests/pipelines/session-start/briefing-budget.test.ts`
   - `open-brain/tests/pipelines/session-start/t302-merged-citations.test.ts`
8. **Push and open the PR.**
   - Push, never with force. Check that `git ls-remote origin refs/heads/fix/t302-merged-citations` equals HEAD.
   - Run `gh pr create --base master --head fix/t302-merged-citations --title "T-302: the greeting names cited SHAs already in the upstream branch" --body "Brief: docs/loops/t302-merged-citations-brief.md. Opt-in (greeting.json merged_citations)."`.
   - Run `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T-302 <sha40> PR #<n>`, or `BLOCKED T-302 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command shown
  above it. Mark anything not run `NOT RUN`. Do not merge.
