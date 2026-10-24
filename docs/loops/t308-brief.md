# T308: /end keys a mistake made in text lookup-only (T-308)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Text change plus one test file. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-24, session 174. **Task:** T-308 (P3). **Tag:** `t308`. **Size:** SMALL (1 sentence in
3 copies of end.md, 1 new test file). **Base:** the START sha the launcher names (a master that contains this brief).

## Why

Two of Maker's s69 lessons were keyed `MATCH: command:` although the mistake was text: a `!` command handed to Aaron,
and a grep written into a brief that another seat runs. The recall trigger reads only this seat's own Bash calls, so
neither can ever fire. Planner ruling (recommended default, noted for Aaron): such lessons are keyed
`none` (lookup only), and end.md step 2 says so. Reading `path:` keys on Write/Edit was weighed and not chosen: a path
key on a brief file would fire on every edit of every brief, which is the over-fire T-170 exists to prevent.

## The change, exactly

Files under `docs/loops/t308/`.
- **`t308-lookup-only.test.ts`:** copied verbatim, as a new file, to `open-brain/tests/t308-lookup-only.test.ts`. L1 x3.
- **`edits.txt`:** 3 edits, one per copy: `.claude/commands/end.md`, `project-template/.claude/commands/end.md`,
  `project-template/.cursor/commands/end.md`. Each adds two lines after `...a key under 6 characters is lookup-only.`

No SIM: the change is text, and the three L1 rows plus the parity rows below are the measurement.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `tests/s173g.test.ts` | stays green | R4 asserts the skills-audit line in each copy with `toContain`; two added lines elsewhere change neither. |
| `tests/pipelines/sync/mirror-parity.test.ts` | stays green | It builds its own temp copies; the three real copies change identically. |

Any other red existing row means STOP and report `BLOCKED t308 <test name>`. A red row beside T-292's
`Timeout calling onTaskUpdate` error: re-run that file alone; green alone means paste both runs and go on.

## Steps

"The three files" means, from `open-brain`:
`npx vitest run tests/t308-lookup-only.test.ts tests/s173g.test.ts tests/pipelines/sync/mirror-parity.test.ts --no-file-parallelism --testTimeout=180000`.

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b chore/t308-lookup-only`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Commit 1** (`T308: rows for the lookup-only rule in every end.md copy`).
   - `Copy-Item docs/loops/t308/t308-lookup-only.test.ts open-brain/tests/t308-lookup-only.test.ts`.
   - Run the three files. Expect `3 failed` tests, all three L1 rows in t308-lookup-only.test.ts, and every other row
     green. Paste the summary and each `x` row.
4. **Commit 2** (`T308: /end keys a mistake made in text lookup-only (T-308)`).
   - `node docs/loops/t308/apply.cjs . docs/loops/t308/edits.txt` prints exactly `APPLIED 3 edits to 3 files`.
   - Run the three files: 0 failed. Paste the `Test Files` and `Tests` lines.
   - In `open-brain`: `npm run build` (exit 0). From the clone root: `node open-brain/build/cli.js sync 2>&1` and paste
     every line that contains `FAIL`, `mirror`, `template` or `end.md` (or `none matched`). Any FAIL naming end.md or a
     template copy means STOP.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutant**, on the COMMITTED fix: in `project-template/.cursor/commands/end.md` only, delete the two added lines
   (from the line starting `A mistake made in TEXT` through the line ending `(T-308).`) with an editor or
   `(Get-Content -Raw <file>) -replace` that you paste. Run the three files: exactly 1 failed, the L1 row for
   `project-template/.cursor/commands/end.md`. Restore with `git checkout -- project-template` and check the status is
   empty. Never commit the mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 4 paths: `M .claude/commands/end.md`,
   `A open-brain/tests/t308-lookup-only.test.ts`, `M project-template/.claude/commands/end.md`,
   `M project-template/.cursor/commands/end.md`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/chore/t308-lookup-only` must equal
   HEAD. `gh pr create --base master --head chore/t308-lookup-only --title "T308: /end keys a mistake made in text lookup-only (T-308)" --body "Brief: docs/loops/t308-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY t308 <sha40> PR #<n>` or `BLOCKED t308 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild` is not needed (no code). Live check: the next /end that stores a text-shaped lesson keys it
`none` (lookup only).
