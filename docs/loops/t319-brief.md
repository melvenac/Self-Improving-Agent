# T319: retire domains.json (D-162)

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC job runner, NOT the desktop. No hub key. Code + config. Ends at READY with a PR, no merge.
REPLY: the absolute reply path the launcher names. Print it FIRST.

**By:** Atlas (planner), 2026-10-21, session 174. **Task:** T-319 (P2; D-162, Aaron 10-20: "retire domains.json").
**Tag:** `T319`. **Size:** SMALL (11 edits in 11 files, 1 file deleted, 1 test row changed). **Base:** the START sha the
launcher names (a master that contains this brief).

```text
IMPACT-TARGETS: describeReadsOwed computeScore (reads-owed.ts no longer lists domains.json; score.ts coverage is always unscoped)
```

## Why

`.agents/SYSTEM/domains.json` was half-retired: /start step 4 and READS OWED named it and the health score read it,
but /bootstrap never created it, so every adopted project lacked it (G-063, from Maker S71 and Prism S8). Aaron
retired it (D-162). Nothing in the briefing used the tags.

## The change, exactly

All files are under `docs/loops/t319/`.
- **`tests.txt`:** 1 edit in `open-brain/tests/pipelines/session-start/briefing-fix.test.ts`: BF-R1 now asserts a repo
  that still carries domains.json is NOT owed a read of it.
- **`edits.txt`:** 11 exact-once edits in 11 files: /start step 4 in `.claude/commands/start.md`,
  `project-template/.claude/commands/start.md`, `project-template/.cursor/commands/start.md`; the "Domain tags" row in
  `.claude/commands/harness-audit.md` and `project-template/.cursor/commands/harness-audit.md`;
  `open-brain/src/pipelines/session-start/reads-owed.ts`; `open-brain/src/pipelines/sync/score.ts` (coverage is always
  unscoped, as it already was for every project without the file); `.gitignore` (the allowlist line);
  `CLAUDE.md` and `.agents/SYSTEM/RULES.md` (the tracked-file lists); `.agents/retirements.json` (the skill-scan
  retirement's allowed referrer that WAS the file).
- **Delete** `.agents/SYSTEM/domains.json` with `git rm`.

## Measured before dispatch

QA PC SIM `sim-t319` (job #22) at `dc2d4f96`. sha256 prefixes: tests `fca0c34095603ee8`, edits `e33b3b208932d133`,
m1 `2addc4ec2561f9fa`.
- tests.txt: `APPLIED 1 edits to 1 files`; briefing-fix.test.ts `1 failed | 20 passed (21)`: BF-R1 red.
- edits.txt: `APPLIED 11 edits to 11 files`; `git rm` exit 0. Both tsc runs and the build exit 0.
- Step 4's run: `177 passed (177)` files, `2046 passed (2046)` tests, 0 red rows; one T-292 `Timeout calling
  "onTaskUpdate"` error.
- `open-brain sync`: `retirements [pass]: ... 74 allowed referrers all present`. No check names domains.json.
- m1 (domains.json back in the reads-owed list): BF-R1 red.

## Existing tests (verdicts)

| Test | Verdict | Why |
|---|---|---|
| `briefing-fix.test.ts` BF-R1 | changed by `tests.txt` | It pinned the retired behaviour. |
| `tests/pipelines/sync/scorer.test.ts` | stays green | It scores plain numbers; no file is read. Green in the SIM. |
| everything else in step 4's run | stays green | Green in the SIM. |

Any other red existing row means STOP and report `BLOCKED T319 <test name>`. Exceptions, from T-292 load on the shared
QA PC: T-292's `Timeout calling onTaskUpdate` error with every test green: paste it and go on. Red rows only in files
other than `briefing-fix.test.ts`, with that error or a hook timeout: re-run each such file alone; green alone means
paste both runs and go on, red alone means STOP. A red `briefing-fix.test.ts` row after step 4 is never an exception.

## Steps

1. **Shell.** PowerShell: `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`; `node -v` must print `v22.*`.
2. **Branch.** In the clone at START: `git checkout -q -b chore/t319-retire-domains`. HEAD must equal START and the
   porcelain must be empty. In `open-brain`: `npm ci`. Run every `apply.cjs` from the CLONE ROOT. Forbidden: stash,
   reset --hard, force, rebase, amend, other checkouts, test:heavy, `vitest -u`, killing processes by name, the real
   `~/.claude/`, and anything under `docs/`.
3. **Commit 1** (`T319: BF-R1 pins that domains.json is not owed`).
   - `node docs/loops/t319/apply.cjs . docs/loops/t319/tests.txt` prints exactly `APPLIED 1 edits to 1 files`.
   - `$env:NO_COLOR='1'`; in `open-brain`:
     `npx vitest run tests/pipelines/session-start/briefing-fix.test.ts --no-file-parallelism --testTimeout=180000`.
   - Expect `1 failed | 20 passed (21)`: BF-R1 red. Paste the summary and the `x` row.
4. **Commit 2** (`T319: retire domains.json from /start, READS OWED, the score and the template (D-162)`).
   - `node docs/loops/t319/apply.cjs . docs/loops/t319/edits.txt` prints exactly `APPLIED 11 edits to 11 files`.
   - `git rm -q .agents/SYSTEM/domains.json`.
   - In `open-brain`: `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), then
     `npm run build` (exit 0).
   - `npx vitest run tests/shared tests/server.test.ts tests/pipelines tests/end-fix --no-file-parallelism --testTimeout=180000`
     (40-minute cap; run it in the foreground or with a timeout of at least 40 minutes). Expect 0 failed, 177 files,
     2046 tests. Paste the `Test Files`, `Tests` and any `Errors` lines.
   - From the clone root: `node open-brain/build/cli.js sync 2>&1 | Select-String -Pattern "retirements"`. Paste the
     line; it must say `[pass]`.
5. **Check the commits.** Both messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
   `git log --oneline <START>..HEAD` shows 2 lines; the status is empty.
6. **Mutant**, on the COMMITTED fix: `node docs/loops/t319/apply.cjs . docs/loops/t319/m1.txt` prints
   `APPLIED 1 edits to 1 files`; run the briefing-fix file; paste the `x` rows (expected: BF-R1); restore with
   `git checkout -- open-brain/src` (this returns to commit 2) and re-run it: `21 passed (21)`. Never commit the mutant.
7. **Check the diff.** `git diff --name-status <START>..HEAD` shows exactly 13 paths: the 11 edited files, `M` for
   `open-brain/tests/pipelines/session-start/briefing-fix.test.ts`, and `D .agents/SYSTEM/domains.json`.
8. **Push and open the PR.** Push, never force; `git ls-remote origin refs/heads/chore/t319-retire-domains` must equal
   HEAD. `gh pr create --base master --head chore/t319-retire-domains --title "T319: retire domains.json (D-162)" --body "Brief: docs/loops/t319-brief.md."`.
   Then `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T319 <sha40> PR #<n>` or `BLOCKED T319 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output, with its command.
  Mark anything not run `NOT RUN`. Do not merge.

## After merge (not this run)

`sia-rebuild`. Each project's own `.claude/commands/start.md` changes only when `open-brain bootstrap install-commands`
runs there. A project that still has a domains.json keeps the file; nothing reads it.
