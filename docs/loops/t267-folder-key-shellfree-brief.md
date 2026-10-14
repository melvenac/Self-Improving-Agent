# T-267: the transcript folder name follows Claude Code's own rule (skills-audit works on a home with a space), and git runs without a shell

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t267-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-267 (P1). **Tag:** `T-267`. **Size:** SMALL.
**Base:** `6d8accd9fa9ab1ba1e3e8e381cd425c6476b5e95` (origin/master; its code equals 399121cd). If clark re-pins it at
launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: deriveProjectKey discoverSessionUuid auditSkills runHealthChecks (callers: session-start/index.ts, start-report.ts, skills-audit via cli.ts; covered by tests/pipelines/session-start/session-discovery.test.ts, tests/t262-*.test.ts, tests/t003-r2.test.ts, tests/qa142-t003.test.ts, tests/t048-*.test.ts)
```

## Why

Two planner-researched defects at 399121cd, one PR.

**B (the one that bites).** `deriveProjectKey` (`open-brain/src/pipelines/session-start/session-discovery.ts:6-11`) maps
a project path to its `~/.claude/projects/<folder>` name by replacing only `:\`, `:/` and slashes. Claude Code replaces
EVERY non-alphanumeric character with `-`: its own binary (2.1.296) contains `e.replace(/[^a-zA-Z0-9]/g,"-")`, and all
141 transcript folders on the desktop match that rule (ignoring drive-letter case), while the old rule misses
`…\smoke hookonly` → `…-smoke-hookonly`. On the QA PC the home is `C:\Users\Aaron Melven`
(`docs/loops/t199-port-developer-handoff.md:66` shows the folder `C--Users-Aaron-Melven-worktrees-sia-builder`), so
`open-brain skills-audit` (`skills-audit/index.ts:196` → `cli.ts:327`) finds no folder and throws for EVERY seat there:
the D-152 skills audit at `/end` cannot run on that machine.

**A (hardening).** `open-brain/src/pipelines/session-start/health-checks.ts:34` runs
``execSync(`git -C "${vaultPath}" log -1 --format=%ct`)``: the vault path (from `OPEN_BRAIN_VAULT_DIR` when set) is
interpolated into a SHELL string. Measured on the desktop: cmd expands `%VAR%` inside it, and a trailing backslash
escapes the closing quote. `pipelines/sync/checks.ts:2011` is the only other `execSync` in `src` (a constant string).

## Ruling (exact)

1. **B:** `deriveProjectKey` returns `projectPath.replace(/[^a-zA-Z0-9]/g, "-")` (no `+`, no trim, no lowercasing: `C:\`
   stays `C--`; callers keep their case-insensitive comparison). Leave `skills-audit/index.ts:35` (Cursor's own rule)
   alone. Out of scope: names longer than 200 characters (Claude Code hashes those), 8.3 short paths, and a
   `CLAUDE_CONFIG_DIR` override; name them in the reply.
2. **A:** `health-checks.ts` imports `execFileSync` from `node:child_process`, and `:34` becomes
   `execFileSync("git", ["-C", vaultPath, "log", "-1", "--format=%ct"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim()`
   (update the comment above it). `checks.ts:2011` becomes
   `execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "buffer", stdio: ["ignore", "pipe", "ignore"] })`, and
   `execSync` leaves its import. No `.ts` file under `open-brain/src` imports `execSync` afterwards.
3. **Out of scope:** `cli-suite-run.ts:243`'s `spawnSync("npx", …, { shell: true })` (T-168 is changing that file; a
   follow-up), and every other spawn.

## Existing tests (planner-researched; verdicts)

- Stay green: `tests/pipelines/session-start/session-discovery.test.ts:8,13,30,41,46,56` (same output for their inputs);
  `tests/t262-skills-audit.test.ts` (SA-1…SA-10, SC-3), `tests/t262-part2.test.ts:38`, `tests/t003-r2.test.ts:92-99`,
  `tests/qa142-t003.test.ts:47-49`, `tests/pipelines/session-start/index.test.ts:51-53` (they compute the folder with
  `deriveProjectKey` itself, so they pass under either rule); `tests/t048-zero-case.test.ts:45`,
  `tests/t048-dropped-counts.test.ts:103` (the test vault has no `.git`); `tests/pipelines/sync/t048-unreadable.test.ts:114,126`
  (the `checks.ts:2011` equivalence); `tests/harness/checks.test.ts:97-150`, `tests/harness/spawn-sites.test.ts:100`.
- Any other newly failing row: STOP, `BLOCKED T-267 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t267-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t267-wt")`, `Set-Location`
   into it, `git checkout -q -b fix/t267-folder-key-shellfree 6d8accd9fa9ab1ba1e3e8e381cd425c6476b5e95`. HEAD must print
   that SHA and the tree must be clean, else STOP, BLOCKED. `npm ci` in `open-brain`. **Forbidden:** `git stash`,
   `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout.
3. **Base run** (in `open-brain`, 30-minute cap):
   `npx vitest run tests/pipelines/session-start/session-discovery.test.ts tests/t262-skills-audit.test.ts tests/t262-part2.test.ts tests/t003-r2.test.ts tests/qa142-t003.test.ts tests/pipelines/session-start/index.test.ts tests/t048-zero-case.test.ts tests/t048-dropped-counts.test.ts tests/pipelines/sync/t048-unreadable.test.ts tests/harness/checks.test.ts tests/harness/spawn-sites.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row.
4. **Commit 1, `T-267: tests (red)`.** New file `open-brain/tests/t267-folder-key-shellfree.test.ts` (namespace imports).
   Expected folder names are written as LITERALS (never computed with `deriveProjectKey`).
   - **B1 (table):** `C:\Users\Aaron Melven\Worktrees\sia-qa` → `C--Users-Aaron-Melven-Worktrees-sia-qa`;
     `C:\Users\melve\.claude` → `C--Users-melve--claude`; `C:\p\my.app_v2` → `C--p-my-app-v2`;
     `c:\Users\melve\Worktrees\sia--qa` → `c--Users-melve-Worktrees-sia--qa`; `/home/aaron/my project` → `-home-aaron-my-project`.
   - **B2:** a temp home holding the literal folder `C--Users-Aaron-Melven-Worktrees-sia-qa/<uuid>.jsonl` →
     `discoverSessionUuid("C:\\Users\\Aaron Melven\\Worktrees\\sia-qa", home)` returns that uuid.
   - **B3:** the same fixture → `auditSkills({ projectDir: "C:\\Users\\Aaron Melven\\Worktrees\\sia-qa", home, seat: "qa" })`
     does not throw and its session is that uuid (with `seat` passed, `projectDir` is only a string, so this runs on Linux
     CI too).
   - **H1 (control, green before and after):** a temp vault git repo whose only commit has `GIT_COMMITTER_DATE` in 2001
     (create it with `execFileSync`, `-c commit.gpgsign=false`, a user name and email) → `runHealthChecks` returns a
     backup warning matching `/last backed up \d+h ago/`; a fresh commit → none. Set `OPEN_BRAIN_VAULT_DIR` and RESTORE it
     by assignment afterwards (never `delete`; `tests/setup-env.ts:53-70`).
   - **H2:** the same 2001 vault in a folder named `vault %OB_T% $OB_T`, with `process.env.OB_T = "decoy"` → the backup
     warning appears (only a literal, shell-free path reaches that repo).
   - **H3:** on Windows the vault path with a trailing `\`; on POSIX a folder name containing `"` → the warning appears.
   - **H4 (static):** no `.ts` file under `open-brain/src` imports `execSync` (strip comments first, as
     `tests/harness/checks.test.ts:121` does), with a planted positive proving the scan can fire.
   Run the file: B1 (except the `sia--qa` row), B2, B3, H2, H3, H4 red; H1 green. Paste it.
5. **Commit 2, `T-267: the transcript folder follows Claude Code's rule; git runs without a shell`:** the ruling.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 6d8accd9..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t267 file, then step 3's command again. Paste all three.
8. **Mutants** (edit, run the t267 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - M1: `/[^a-zA-Z0-9]+/g` → the `sia--qa` row red. M2: `/\W/g` → the `my.app_v2` row red.
   - M3: append `.replace(/^-+|-+$/g, "")` → the POSIX row red. M4: `health-checks.ts` back to the `execSync` template →
     H2, H3, H4 red. M5: `execFileSync(…, { shell: true })` → H2 red.
9. `git diff --name-only 6d8accd9..HEAD` must show only
   `open-brain/src/pipelines/session-start/session-discovery.ts`, `open-brain/src/pipelines/session-start/health-checks.ts`,
   `open-brain/src/pipelines/sync/checks.ts`, `open-brain/tests/t267-folder-key-shellfree.test.ts`. Anything else: STOP,
   BLOCKED.
10. `git push origin fix/t267-folder-key-shellfree` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t267-folder-key-shellfree --title "T-267: the transcript folder follows Claude Code's rule (skills-audit on a home with a space); git runs without a shell" --body "Brief: docs/loops/t267-folder-key-shellfree-brief.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-267 <sha40> PR #<n>` or `BLOCKED T-267 <reason>`. Then each command with its output: base
run, red run, tsc, the t267 run, the second run, the mutants, the name-only diff, `ls-remote` = `rev-parse`, the PR URL
and CI, and the out-of-scope list. At most 2 attempts at a red. Mark anything not run `NOT RUN`. If the code differs
from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
