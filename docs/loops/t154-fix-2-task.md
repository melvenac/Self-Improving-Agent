# T-154 fix 2: PowerShell's typographic single quotes in the hook line

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: desktop one-off (no hub key)
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t154-fix-2-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), session 168, 2026-10-11. **Task:** T-154. **Tag:** `T-154-fix-2`. **Parent:**
`docs/loops/t154-fix-1-task.md`. Every rule there holds unless this file changes it. **Re-check:** CC Opus at
`f0da2c65`, VERDICT CHANGES. Reply at `C:\Users\melve\AppData\Local\Temp\t154-recheck-reply.md`, finding 1.
**Size:** TINY.

**Start:** branch `fix/t154-cli-start-route` at `f0da2c65279e17b4901a5300d9bec9554e75ddc0` (PR #602's head). Add new
commits on top. Never rebase, amend, `reset` in any form, or force-push.

```text
IMPACT-TARGETS: none — one condition in cli-bootstrap.ts's top-level script, no named symbol
```

## The finding and the ruling

At `open-brain/src/cli-bootstrap.ts:189` the single-quote check matches only ASCII `'` (U+0027). PowerShell also
treats U+2018, U+2019, U+201A and U+201B as single-quote delimiters. So a cwd like `…\t154 o’brien` (U+2019) gets a
runnable start line, and PowerShell rejects that line with a ParserError.

**Ruling:** in that check, replace `p.includes("'")` with `/['\u2018\u2019\u201A\u201B]/.test(p)`. Change nothing
else: the "unavailable" text stays the same. The re-check marked F1 and F3 RESOLVED and F2 fixed for every other
input, so this condition is all that changes.

## Commits (exactly two)

1. **`T-154 fix 2: tests (red)`**: in `open-brain/tests/t154-cli-start.test.ts`, add **CS-5d**. It follows CS-5c
   exactly, but the fixture directory is named `t154 o\u2019brien` (write it with the `\u2019` escape in the TS
   source). The hook prints exactly one line starting `CLI start (no open-brain MCP): unavailable — a path contains a single quote:`
   and no line starting `CLI start (no open-brain MCP): node`. Run the file and paste the result: CS-5d red, every
   other test green.
2. **`T-154 fix 2: the hook line also refuses PowerShell's typographic single quotes`**: the one-line change. Do not
   edit the test file in this commit.

End both commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. After each commit,
`git status --porcelain` is empty. `git log --oneline f0da2c65..HEAD` shows exactly 2 lines.

## Mutant (edit, run, `git checkout -- <file>`, confirm the tree is clean; never commit)

- **F2-M3:** put back `p.includes("'")`. CS-5d must go red and CS-5c must stay green.

## Runs

- `npx tsc --noEmit` → 0
- `npx vitest run tests/t154-cli-start.test.ts tests/cli-bootstrap.test.ts --no-file-parallelism --testTimeout=180000` → all green
- `npm run build` → 0

Paste each one with its command shown above it.

## Scope, push, reply

- `git diff --name-only f0da2c65..HEAD` must show exactly `open-brain/src/cli-bootstrap.ts` and `open-brain/tests/t154-cli-start.test.ts`.
- Push with `git push origin fix/t154-cli-start-route`. `git ls-remote origin refs/heads/fix/t154-cli-start-route` must equal `git rev-parse HEAD`.
- If the push is rejected: STOP, `BLOCKED T-154-fix-2 push rejected`.
- The reply's **first line** is `READY T-154-fix-2 <sha40> PR #602` or `BLOCKED T-154-fix-2 <reason>`. Write `REPLY_PATH=…` after it, never before.
