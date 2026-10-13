# T-270: the Win32 process table parses when a command line holds a raw control character

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off (no hub key). Windows host required (the live reproduction needs Windows PowerShell 5.1). Code
only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t270-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST. The QA PC's home folder has a space in it: quote
every path.

**By:** Atlas (planner), 2026-10-13, session 169. **Task:** T-270 (P1). **Tag:** `T-270`. **Size:** SMALL.
**Base:** `ff9492d61287e5a78ab455dc27bf7b11c413e133` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: parseWin32ProcessTable loadWin32ProcessTable (shared/process-session.ts) (callers: liveOwnerProbe in suite-owner.ts, resolveCursorAgentHost in process-session.ts; covered by tests/t235-p2-3-cursor-proof.test.ts, tests/t168-owner-wired.test.ts, tests/t268-owner-session-proof.test.ts)
```

## Why (planner, first-hand on the desktop, 2026-10-13 ~18:36Z)

T-268's live check refused with `Win32 process table: unparseable JSON (Bad control character in string literal in
JSON at position 130167)`. The loader's own command (`process-session.ts:206`,
`Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress`)
reproduced it: a raw `0x1A` sat inside the `CommandLine` strings of two `bash.exe` processes that belonged to ANOTHER
Claude Code session. Windows PowerShell 5.1's `ConvertTo-Json` leaves that character unescaped, and `JSON.parse`
rejects it. While any such process exists on the machine, both callers fail closed:
- `liveOwnerProbe` (`suite-owner.ts:147`): every `test:heavy` on the machine.
- `resolveCursorAgentHost` (`process-session.ts:278`): the SessionStart proof of every Cursor seat.

## Ruling (exact; paths under `open-brain/`)

1. **`src/shared/process-session.ts`, `parseWin32ProcessTable` only.** After `raw.trim()` and the empty check, replace
   EVERY character U+0000 to U+001F with a single space, then `JSON.parse` the result. Spaces are valid JSON whitespace
   between tokens, and inside a string they keep a command line's tokens apart: `isClaudeExeCommandLine`
   (`suite-owner.ts:48`) needs whitespace, a quote or the end of the line after `claude.exe`, so DELETING the character
   would break the match. Add a two-line comment citing T-270. Everything else is unchanged: the error texts, the
   object-or-array handling, `loadWin32ProcessTable`, the PowerShell command and every caller.
2. JSON that is still invalid after the replacement still returns `Win32 process table: unparseable JSON (…)`.

## Existing tests (planner-read at ff9492d6; verdicts)

- `tests/t235-p2-3-cursor-proof.test.ts` ~:220-243, the failure loop: spawn ETIMEDOUT, exit status 1, `" "` and `"{"`
  stay failures. **Stays green.** The single-object parse right after it (pid 9) **stays green.**
- Same file, "r4 a spawn failure with status null…" and "r3 proveSession returns id null…": **stay green.**
- `tests/t168-owner-wired.test.ts` N5b (~:163-171): the thrown error still names `Win32 process table:`. **Stays green.**
- `tests/t268-owner-session-proof.test.ts` (S1-S10) and `tests/suite-run-meta.test.ts`: injected tables. **Stay green.**
- No file this brief touches appears in `.agents/retirements.json`.
- Any other newly failing row: STOP, `BLOCKED T-270 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t270-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. **Start state.** Work in the fresh clone the launcher named. If it named none, run
   `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t270-wt")` and `Set-Location`
   into it. Then `git checkout -q -b fix/t270-table-control-chars ff9492d61287e5a78ab455dc27bf7b11c413e133`.
   `git rev-parse HEAD` must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED. Run `npm ci`
   in `open-brain`. **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout,
   `npm run test:heavy`, `docs/loops/machine-lease.ps1`, and stopping any process except the one pid step 4 records.
3. **Base run** (in `open-brain`):
   `npx vitest run tests/t235-p2-3-cursor-proof.test.ts tests/t168-owner-wired.test.ts tests/t268-owner-session-proof.test.ts tests/suite-run-meta.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row.
4. **Live reproduction at base** (no edits yet). From `open-brain`, start a sleeper whose command line holds a raw
   0x1A and RECORD its pid:
   `node -e "const c=require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},180000)','t270' + String.fromCharCode(26) + 'marker'],{detached:true,stdio:'ignore'});console.log(c.pid);c.unref()"`.
   Then run the loader at base:
   `npx tsx -e "import('./src/shared/process-session.ts').then(m=>{const r=m.loadWin32ProcessTable();console.log(r.ok?'ok '+r.table.size:'FAIL '+r.reason.slice(0,120))})"`.
   It must print `FAIL Win32 process table: unparseable JSON (Bad control character…`. Then stop the sleeper with
   `Stop-Process -Id <that pid>` and no other selector. If base prints `ok`, the reproduction did not take: say
   `NOT REPRODUCED`, give the sleeper's CommandLine char codes around the marker, stop it, and continue.
5. **Commit 1, `T-270: tests (red)`.** New file `open-brain/tests/t270-table-control-chars.test.ts` (namespace imports
   of `../src/shared/process-session.js` and `../src/suite-owner.js`). Build each payload with `JSON.stringify` and then
   put the RAW character into the string (for example `.replace("\\u001a", "\u001a")`), and assert the raw character is
   present before parsing:
   - **C1:** one row whose CommandLine holds a raw 0x1A → `ok: true`, the row present, ppid kept.
   - **C2:** raw 0x00, 0x07 and 0x1B in three rows' CommandLines → `ok: true`, all three rows present.
   - **C3:** an array of three rows where only the middle one holds 0x1A → all three rows present, ppids intact.
   - **C4:** pretty-printed JSON (real newlines and tab indentation between tokens) → `ok: true` (no regression).
   - **C5:** `[{"ProcessId": 1,}]` (still invalid) → `ok: false`, reason starts `Win32 process table: unparseable JSON`.
   - **C6:** `owner.liveOwnerProbe(10, () => ps.parseWin32ProcessTable(<payload>))` whose chain 10 → 20 → 30 reaches a
     `…\claude.exe --print` row at 30, while an unrelated row holds 0x1A → `{ pid: 30, source: "claude.exe" }`.
   - **C7:** `ps.resolveCursorAgentHost(10, undefined, () => ps.parseWin32ProcessTable(<payload>))` whose chain reaches a
     `…\cursor-agent\versions\1.0\index.js` row, while an unrelated row holds 0x1A → that row's pid.
   - **C8:** one row `C:\x\claude.exe<0x1A>--print` → parses, and `owner.isClaudeExeCommandLine(row.commandLine)` is true.
   Run the file: C1-C3 and C6-C8 red, C4 and C5 green. Paste it.
6. **Commit 2, `T-270: the Win32 process table survives a raw control character in a command line`:** the ruling.
7. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline ff9492d6..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
8. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0); the t270 file (8 passed); step 3's command again. Paste all
   three. Then repeat step 4 on the branch: start a NEW sleeper with the same command and record its pid, run the
   same loader line (it must now print `ok <n>`), and stop that sleeper by its recorded pid. Paste all three lines.
9. **Mutants** (edit `open-brain/src/shared/process-session.ts`, run the t270 file only, paste,
   `git checkout -- open-brain/src/shared/process-session.ts`, `git status --porcelain` empty; never commit):
   - M1: no replacement → C1, C2, C3, C6, C7 and C8 red.
   - M2: replace only 0x1A → C2 red.
   - M3: delete the characters instead of replacing them with a space → C8 red.
10. `git diff --name-only ff9492d6..HEAD` must show only `open-brain/src/shared/process-session.ts` and
    `open-brain/tests/t270-table-control-chars.test.ts`. Anything else: STOP, BLOCKED.
11. `git push origin fix/t270-table-control-chars` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t270-table-control-chars --title "T-270: the Win32 process table survives a raw control character in a command line" --body "Brief: docs/loops/t270-table-control-chars-brief.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-270 <sha40> PR #<n>` or `BLOCKED T-270 <reason>`. Then each command with its output: base
run, the step-4 reproduction (the sleeper's pid and the FAIL line), red run, tsc, the t270 run, the second run, the
step-8 loader line and the Stop-Process line, the mutants, the name-only diff, `ls-remote` = `rev-parse`, the PR URL and
CI. At most 2 attempts at a red. Mark anything not run `NOT RUN`. If the code differs from a line this brief quotes,
follow the ruling's intent and say what differed. Do not merge.
