# statebuf: T-171 r3b reads a state.json over 1 MiB (master CI red since rev 577)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code (tests only). Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-25, session 174. **Authority:** Aaron at the planner's desk, 2026-10-25: "One-line
test fix". **Tag:** `statebuf`. **Size:** TINY (1 edit in 1 test file). **Base:** the START sha the launcher names.

```text
IMPACT-TARGETS: none (test file only)
```

## Why

`.agents/state.json` on master is 1,049,575 bytes at rev 577, over execFileSync's default maxBuffer (1,048,576).
`tests/shared/state-schema.test.ts` "T-171 r3b: origin/master's real state.json parses" reads it with
`git show` and no maxBuffer, so it throws `spawnSync git ENOBUFS`. Master CI has been red since 5ff6387b (run
40217477960 on #983 shows the same row). The production readers already set a buffer
(handoff-provenance.ts 16 MB, git-read.ts maxBytes); this test is the only unbuffered `git show` of the record.

## The change, exactly

`docs/loops/statebuf/edits.txt`: 1 edit in `open-brain/tests/shared/state-schema.test.ts`: the `show` helper gains
`maxBuffer: 16 * 1024 * 1024` and a one-line comment. Nothing under `open-brain/src` changes.

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
   `$env:NO_COLOR='1'`.
2. **Branch.** In the clone at START: `git checkout -q -b fix/statebuf-maxbuffer`. HEAD must equal START and the
   porcelain must be empty. `git fetch origin master` (the row reads origin/master). In `open-brain`: `npm ci`.
   Forbidden: stash, reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by
   name, the real `~/.claude/`, any MCP config, and anything under `docs/`.
3. **Baseline.** In `open-brain`: `npx vitest run tests/shared/state-schema.test.ts --no-file-parallelism`.
   Expect exactly 1 failed row, T-171 r3b, with `ENOBUFS`. Paste the `Tests` line and the `x` row with its error line.
   (If it is green, `git cat-file -s origin/master:.agents/state.json` and paste it; STOP only if under 1048576.)
4. **Commit** (`statebuf: T-171 r3b reads a state.json over 1 MiB (maxBuffer 16 MB)`).
   - From the CLONE ROOT: `node docs/loops/statebuf/apply.cjs . docs/loops/statebuf/edits.txt` prints exactly
     `APPLIED 1 edits to 1 files`.
   - In `open-brain`: `npx tsc -p tsconfig.tests.json --noEmit` (exit 0).
   - `npx vitest run tests/shared/state-schema.test.ts --no-file-parallelism`: 0 failed. Paste the `Tests` line.
   - The message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. `git log --oneline
     <START>..HEAD` shows 1 line; `git diff --name-status <START>..HEAD` shows exactly
     `M open-brain/tests/shared/state-schema.test.ts`; the status is empty.
5. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/fix/statebuf-maxbuffer` must equal
   HEAD. `gh pr create --base master --head fix/statebuf-maxbuffer --title "statebuf: T-171 r3b reads a state.json over 1 MiB" --body "Brief: docs/loops/statebuf-brief.md. Master CI red since 5ff6387b (ENOBUFS)."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion. A red `test` with any row
   other than T-171 r3b: paste the row; do not retry.

## Reply

- **First line:** `READY statebuf <sha40> PR #<n>` or `BLOCKED statebuf <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.
