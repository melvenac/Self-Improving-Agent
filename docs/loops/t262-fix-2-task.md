# T-262 fix 2: no personal names in the shipped end.md, true Cursor wording, the stray doc comment

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key). Docs, one comment move and one new test file. Overnight-safe: ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t262-fix-2-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-262. **Tag:** `T-262-fix-2`. **Size:** TINY.
**Base:** `10034c5a0328c6a2e44057290ff66ea0edcd4121` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none — prose in four command files, one doc comment moved (no code token changes), one new test file
```

## Why

1. `/sync` reports the ISSUE `template-personal-names` at base. #617 (T-262 part 2) wrote
   `for clark to take to Aaron` into `project-template/.claude/commands/end.md:35` and
   `project-template/.cursor/commands/end.md:38` (and the live twin `.claude/commands/end.md:35`, which a test requires
   to equal the template copy). `project-template/.cursor/commands/harness-audit.md:101` has said `after Aaron approves`
   since before #617. The template ships to strangers; the check `checkTemplatePersonalNames`
   (`open-brain/src/pipelines/sync/checks.ts:811`, regex `/\b(Aaron|Clark|melve)\b/i`) is the rule.
2. `project-template/.cursor/commands/end.md:43-45` says a skipped audit "is named in the next greeting
   (`SKILLS AUDIT NOT RUN`)". Under Cursor no SessionEnd hook runs on our machines (T-245: A4 not testable), so nothing
   names it. The sentence is untrue under Cursor.
3. `open-brain/src/pipelines/skills-audit/index.ts:153`: the comment
   `/** Throws an Error whose message is the CLI's stderr line when there is nothing to read. */` sits above
   `interface TranscriptFile`. It describes `auditSkills` (line 180, which throws at :210, :217, :221).

## Exact edits

- `.claude/commands/end.md` line 35 AND `project-template/.claude/commands/end.md` line 35 AND
  `project-template/.cursor/commands/end.md` line 38: replace `for clark to take to Aaron` with
  `for the coordinator to take to the user`. Nothing else on those lines changes.
- `project-template/.cursor/commands/end.md` lines 44-45: replace the sentence
  `A session that skips this step is named in the next` + newline + `` greeting (`SKILLS AUDIT NOT RUN`). `` with
  `Under Cursor no SessionEnd hook runs, so nothing names a session that skips this step: run it every time.`
  (keep `command exits 1, report its stderr line instead.` on line 44 before it, and rewrap to at most 120 columns).
- `project-template/.cursor/commands/harness-audit.md` line 101: `after Aaron approves` → `after the user approves`.
- `open-brain/src/pipelines/skills-audit/index.ts`: delete line 153 (the `/** Throws …` comment), and insert the same
  line, unchanged, directly above `export function auditSkills(opts: AuditOptions): AuditReport {`.

## Existing tests that pin this (planner-read, with verdicts)

- `tests/t262-part2.test.ts` "D-1 step 1b is in all three end.md files": requires the step-1b heading and
  `Skills audit: {n} hits` in all three, `.claude` live == template, and `skills-audit --runtime cursor [--seat <name>]`
  in the Cursor copy. The edits keep all of these. **Green, unedited.**
- `tests/pipelines/sync/checks.test.ts` "checkTemplatePersonalNames" (line ~674): uses temp dirs. **Green, unedited.**
- `tests/pipelines/sync/mirror-parity.test.ts` and `tests/pipelines/sync/command-parity.test.ts`: run them; they must
  stay green. If either compares a file you edited against an unedited twin, STOP, BLOCKED with the row name.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t262-fix-2-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. Fresh clone `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t262f2-wt")`,
   `Set-Location` into it, `git checkout -q -b fix/t262-template-names 10034c5a0328c6a2e44057290ff66ea0edcd4121`.
   `git rev-parse HEAD` must print that SHA, `git status --porcelain` empty, else STOP, BLOCKED. `npm ci` in `open-brain`.
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout.
3. **Commit 1, `T-262 fix 2: tests (red)`.** New file `open-brain/tests/t262-fix-2.test.ts` with
   `const repoRoot = join(import.meta.dirname, "../..");` and a `read(rel)` helper (`readFileSync(join(repoRoot, rel), "utf8")`):
   - **N1:** `checkTemplatePersonalNames(repoRoot).severity` is `"pass"` (import from `../src/pipelines/sync/checks.js`).
   - **N2:** none of the three end.md files matches `/\bclark\b/i`, and each contains `for the coordinator to take to the user`.
   - **N3:** the Cursor copy does not contain `named in the next` and contains `Under Cursor no SessionEnd hook runs`.
   - **N4:** in `src/pipelines/skills-audit/index.ts` (read relative to `open-brain`), the line directly above
     `export function auditSkills(` starts with `/** Throws an Error`, and the line directly above
     `interface TranscriptFile {` does not contain `Throws`.
   Run it (step 6's vitest line, this file only): N1-N4 red. Paste it.
4. **Commit 2, `T-262 fix 2: the shipped end.md names no one, the Cursor copy stops promising a hook, the doc comment sits on auditSkills`:**
   the exact edits above.
5. End both messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Afterwards
   `git log --oneline 10034c5a..HEAD` shows 2 lines and `git status --porcelain` is empty.
6. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), then
   `npx vitest run tests/t262-fix-2.test.ts tests/t262-part2.test.ts tests/pipelines/sync/checks.test.ts tests/pipelines/sync/mirror-parity.test.ts tests/pipelines/sync/command-parity.test.ts --no-file-parallelism --testTimeout=180000`
   with a 15-minute cap. All green. Then `node build/cli.js sync --check` is NOT run (the build is not rebuilt); instead
   paste `npx tsx src/cli.ts sync --check 2>&1 | Select-String "template-personal-names"`: it must not say `[issue]`.
7. **Mutants** (edit, rerun the t262-fix-2 file only, paste, `git checkout -- <file>`, confirm a clean tree; never commit):
   - M1: put `Aaron` back in `project-template/.cursor/commands/harness-audit.md:101` → N1 red.
   - M2: put the old two-line sentence back in the Cursor end.md → N3 red.
8. `git diff --name-only 10034c5a..HEAD` must show exactly: `.claude/commands/end.md`,
   `open-brain/src/pipelines/skills-audit/index.ts`, `open-brain/tests/t262-fix-2.test.ts`,
   `project-template/.claude/commands/end.md`, `project-template/.cursor/commands/end.md`,
   `project-template/.cursor/commands/harness-audit.md`. Anything else: STOP, BLOCKED.
9. `git push origin fix/t262-template-names` (never force). `git ls-remote origin refs/heads/fix/t262-template-names`
   must equal `git rev-parse HEAD`. Then
   `gh pr create --base master --head fix/t262-template-names --title "T-262 fix 2: template end.md names no one; Cursor wording; doc comment" --body "Brief: docs/loops/t262-fix-2-task.md."`.
   Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Not in scope

The user-level copies (`~/.claude/commands/end.md`, `~/.cursor/commands/*`) are clark's to recopy after merge. Do not
touch anything under the user's home.

## Reply

The first line is `READY T-262-fix-2 <sha40> PR #<n>` or `BLOCKED T-262-fix-2 <reason>`. Then each command with its
output. At most 2 attempts at a red. Mark anything not run `NOT RUN`. Do not merge.
