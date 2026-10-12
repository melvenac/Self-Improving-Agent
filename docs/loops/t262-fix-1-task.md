# T-262 part 1, fix 1: two test rows that let mutants survive

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key)
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t262-fix-1-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), session 168, 2026-10-12. **Task:** T-262. **Tag:** `T-262-1-fix-1`. **Parent:**
`docs/loops/t262-skills-audit-extractor-brief.md`; every rule there holds unless this file changes it (shell, Node 22,
forbidden git, known reds, single-process vitest). **Size:** TINY.

**Start:** branch `feat/t262-skills-audit` at `e3e76df7e663458a201aef75ee31ea0568b85a1a` (PR #610's head), in a fresh
clone under `$env:TEMP` (`git clone`, `git checkout -q feat/t262-skills-audit`, `git rev-parse HEAD` must print that
SHA, `npm ci` in `open-brain`). Add one commit on top. Never rebase, amend, `reset` in any form, or force-push.

```text
IMPACT-TARGETS: none — test file only
```

## Planner ruling on the reply (`%TEMP%\t262-reply.md`)

**ACCEPT** the build, with all four reported deviations:

1. The `cli-args` sort position is correct; the brief was wrong.
2. Skipping a segment that is only an assignment matches the planner's prototype; W3 left the rule out.
3. Throwing for the no-transcript cases is fine.
4. Skipping blank lines matches the prototype.

The planner read the module at `e3e76df7` and ran it on its own 5 real transcripts: 201 shell calls, 20 rows, and a
`scripts called:` line listing 7 of atlas-ops' scripts. **Two rows are too weak:** mutants M4 and M6 survived. This
task fixes only those two rows.

## The one commit: `T-262-1 fix 1: SA-9 and a new SA-3b kill the recursion and substring mutants`

Edit only `open-brain/tests/t262-skills-audit.test.ts`:

- **SA-9:** name the subagent file `aaaaaaaa-0000-4000-8000-000000000009.jsonl`, a UUID name, still under
  `<uuid1>/subagents/`. It keeps `git push` ×3, and the assertion is unchanged: only `git log` has a row. That way
  the name filter cannot hide a recursive read.
- **SA-3b (new, directly after SA-3):** an ops directory with `scripts/foo.sh`, and session 1 holding
  `bash C:/s/xfoo.sh a` ×3. Assert: the row `bash xfoo.sh` has status `by-hand`, and `scriptsCalled` equals `[]`.

End the commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Afterwards
`git status --porcelain` is empty, and `git log --oneline e3e76df7..HEAD` shows exactly 1 line.

## Mutants (in `open-brain/src/pipelines/skills-audit/index.ts`: edit, run the test file, `git checkout -- <file>`, confirm a clean tree; never commit)

- **M4:** list `.jsonl` files recursively (`readdirSync(transcriptDir, { withFileTypes: true, recursive: true })`, then
  build each path from `e.parentPath`), keeping the `UUID_FILE` name filter. **SA-9 must go red.**
- **M6:** in `statusOf`, replace `scriptNames.has(words[words.length - 1])` with
  `[...scriptNames].some((s) => words[words.length - 1].includes(s))`. **SA-3b must go red.**

Paste each result line.

## Runs

- `npx vitest run tests/t262-skills-audit.test.ts --no-file-parallelism --testTimeout=180000` → 31 passed
- `npx tsc --noEmit` → 0

Paste each one with its command shown above it.

## Scope, push, reply

- `git diff --name-only e3e76df7..HEAD` must show exactly `open-brain/tests/t262-skills-audit.test.ts`.
- `git push origin feat/t262-skills-audit`. Then `git ls-remote origin refs/heads/feat/t262-skills-audit` must equal
  `git rev-parse HEAD`. If the push is rejected: STOP, `BLOCKED T-262-1-fix-1 push rejected`.
- The reply's **first line** is `READY T-262-1-fix-1 <sha40> PR #610` or `BLOCKED T-262-1-fix-1 <reason>`. Mark
  anything not run `NOT RUN`.
