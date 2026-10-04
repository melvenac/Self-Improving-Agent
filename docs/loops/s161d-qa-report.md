# QA 276 (s161d): #427 r2's walk on real Windows

**Seat:** QA, headless Claude Code on Opus, record session 161. **Machine: the laptop (DESKTOP-0GV3HAD)**, Windows
10 Pro 19045, Windows PowerShell 5.1.19041.6456, Git Bash (MINGW64), node v22.23.2 at `C:\Program Files\nodejs\node.exe`.
2026-10-04. Dispatch: `docs/loops/qa-276-s161d-dispatch.md`.

**Worktree:** `git -C C:/qa-scratch/qa276-wt log -1 --format=%H` = `b20d574fc575761ba5493ad2ce0033707570517c`
(the DISPATCH_SHA).

**Candidate:** `C:/qa-scratch/qa276-pr427` @ `987901c9`. Also a second copy at `C:/qa-scratch/qa276-cursor-agent-pr427`
@ `987901c9` for row 4, and an r1 baseline at `C:/qa-scratch/qa276-r1base` @ `270b550b` for row 5. Each was built
with `npm ci` and `npm run build` in `open-brain`, all exit 0.

## Environment notes

- **Machine lease:** `machine-lease.ps1` was run from `%USERPROFILE%` with `-File`. `take -OwnerPid 55488` (the
  claude.exe running this job) returned `lease=taken`, exit 0, and at the end `release` returned `lease=released`,
  exit 0.
- **TMP/TEMP were NOT set by the launcher this time either.** Both were `C:\Users\Aaron\AppData\Local\Temp` in the
  session. Every driver set `TMP=TEMP=C:\qa-tmp` and `npm_config_cache=C:\qa-tmp\npm-cache` in the child
  environment.
- **The PowerShell tool was refused again.** The permission layer rejected `$(...)` and script blocks, as it did
  for QA 274. So the PowerShell legs ran as **`powershell.exe -NoProfile -NonInteractive -Command ...` (5.1),
  spawned from node drivers**, and the drivers were launched from Git Bash. The Git Bash legs ran as
  `C:\Program Files\Git\bin\bash.exe -c ...`. Each row names the shell that ran the command under test. The drivers
  are in `C:\qa-tmp\qa276\` and are not committed.
- **Scratch homes** (each contains a space): `C:\qa-tmp\qa276 home r3`, `… r4`, `… r4b`, `… r5`, `… r1base`,
  `… tests`, `… nops r1`, `… nops r2`. Each hook run had these set inside the scratch home: `HOME`,
  `USERPROFILE`, `OPEN_BRAIN_ACTIVE_SESSION`, `KNOWLEDGE_V2_DB`, the vault, score and shadow paths, `A2A_KEY_DIR`
  and `LOCALAPPDATA`. Every `CLAUDE*` variable was removed.
- **Real files**, sha256 before vs after with no content read: `~/.claude/settings.json` **match**.
  `~/.cursor/hooks.json`, `~/.cursor/mcp.json` and `~/.claude/.mcp.json` are **absent** on this laptop, before and
  after.

## Row 1: Confined and pinned (Git Bash)

`git fetch origin refs/pull/427/head`: the fetched head is **`987901c9cb43f3dd3a31b9e22fec164edd9769dd`**, and
`gh pr view 427` shows the same `headRefOid`, OPEN, `loop/t235-p2-3` into master. There is one commit after
`270b550b`: `987901c9 T-235 P2-3 r2: fix cursor-agent host pid walk and match rules.`

`git diff --stat 270b550b 987901c9`:

| File | Change |
|---|---|
| `docs/loops/t235-p2-3-r2-measure.md` | +28 (new) |
| `open-brain/src/cli-bootstrap.ts` | 1 line: `findCursorAgentHostPid(process.pid)` → `(process.ppid)` |
| `open-brain/src/shared/process-session.ts` | +68/−8: `isCursorAgentHostCommandLine`, `loadWin32ProcessTable`, and the walk now uses a table |
| `open-brain/tests/fixtures-t003/cursor-agent-host.cjs` → `cursor-agent/versions/e2e-fixture/index.js` | renamed, CJS → ESM (+6/−5) |
| `open-brain/tests/t003-session-proof.test.ts` | +13 |
| `open-brain/tests/t235-p2-3-cursor-proof.test.ts` | +117/−6 |

All the files are in T-235 P2-3. **Row 1: PASS.**

## Row 2: CI, read only (Git Bash, `gh run view`)

Run **37189839577**: `headSha` = `987901c9cb43f3dd3a31b9e22fec164edd9769dd`, event `pull_request`, branch
`loop/t235-p2-3`. Jobs: `changed` succeeded; **`test` succeeded** (08:43:32Z to 08:46:38Z, with Typecheck, Typecheck
tests and Test all green); **`test-windows` was skipped**. The run concluded `success`. As at r1, this report is the
only Windows evidence for this head. **Row 2: PASS.**

## Row 3: The new walk on real Windows, both shells

The fixture is `tests/fixtures-t003/cursor-agent/versions/e2e-fixture/index.js`. The hook is
`open-brain/build/cli-bootstrap.js`. Each payload carried `session_id`, `cwd`, `workspace_roots` (a scratch project)
and `cursor_version`. The by-pid directory is `C:\qa-tmp\qa276 home r3\by-pid` (`byPidDir(slot)`).

| Leg | Shell running the chain | Chain | Result |
|---|---|---|---|
| A | PowerShell 5.1 | `Get-Content payload -Raw \| & node <fixture> -- <boot> --ide cursor` | exit 0, 1.8 s. Host 46680. `Session proof written: … for cursor-agent host process 46680.` `by-pid/46680.json` has session_id ✓ (equals the payload), claude_pid 46680 ✓, ide `cursor` ✓, `proc_start=win:…` ✓ |
| B | Git Bash | `node <fixture> -- <boot> < payload` (**no `--ide`**, `cursor_version` only) | exit 0, 1.4 s. Host 54096. `by-pid/54096.json` correct on all four fields |
| C | PowerShell 5.1 | `… \| & node <boot> --ide cursor`, no fixture | exit 0, 1.7 s. `Session proof NOT written: no cursor-agent host process found in the hook's ancestor chain, …`. **No file added** (listing empty before and after) |
| D | Git Bash | as C | exit 0, 0.9 s. The same visible reason, **no file added** |
| E | PowerShell 5.1 | fixture → `probe.mjs`, which calls the real build's `findCursorAgentHostPid`, `proveSession` and `processStartTime` | `walk(ppid)=41812` (the host) in **684 ms**. `proveSession(cursorWalk)`, with the probe as a wrapper parent: refused (`41812.json absent`) before the proof; after the probe spawned the real hook, **`{"id":"f17e3a9b…","pid":41812}`**. **Without `cursorWalk`: id=null**, so the Claude path is unchanged. The proof's `proc_start` equals `processStartTime(host)` while the host is alive: **true** |
| F | Git Bash | as E | the same outcome: host 54500, walk 688 ms, proven after the proof write, null without `cursorWalk`, and `proc_start` matches |

**Row 3: PASS.** On r2, the walk finds the fixture host from both shells. The proof is `by-pid/<hostPid>.json`
with the right four fields. With no host there is a visible reason and no file.

## Row 4: F2 on Windows

The tree is reached through **`C:/qa-scratch/qa276-cursor-agent-pr427`**, so every hook command line contains
`cursor-agent`.

- **No host** (legs C and D from that tree, run twice each): PowerShell 5.1 exit 0 and Git Bash exit 0, both with
  `Session proof NOT written: no cursor-agent host process found …`, and **no file** in by-pid. **NO proof is
  written.** At r1 this case returned the hook's own pid.
- **r1's self-match repro, re-run against r2** (Git Bash, `C:\qa-tmp\qa276\cursor-agent-named-dir\selfprobe.mjs`,
  importing the r2 build): `isCursorAgentHostCommandLine(own argv)=false`,
  `findCursorAgentHostPid(self, inclusive)=null`, and `findCursorAgentHostPid(ppid)=null`. At r1 the second call
  returned self.
- **With a host** (legs A and B from that tree). A preload counter logged the pid of each process that spawned
  `powershell.exe`, which identifies the hook itself:

  | Shell | Hook pid | Host pid | Proof file |
  |---|---|---|---|
  | PowerShell 5.1 | 55248 | 50416 | `by-pid/50416.json`, claude_pid 50416 |
  | Git Bash | 57220 | 53560 | `by-pid/53560.json`, claude_pid 53560 |

  **The proof is for the host's pid, never the hook's.** No file named after a hook pid exists.

**Row 4: PASS. F2 is fixed on Windows.**

## Row 5: F3 timing

**Wall time** is for the whole chain, including the shell start and the fixture host's node start. Each figure is
one run. Measured on this laptop, all three runs per cell in one sitting:

| Case | r2 `987901c9` | r1 `270b550b` (same laptop, same driver) | QA 274 r1 (desktop) |
|---|---|---|---|
| PowerShell 5.1, host nearby (leg A) | 1925 / 2041 / 1943 ms | 2430 / 2424 / 2455 ms | 2–4 s |
| PowerShell 5.1, no host, walk to the root (leg C) | **1446 / 1394 / 1392 ms** | **8050 / 7999 / 8211 ms** | 7–9 s |
| Git Bash, host nearby (leg B) | 1543 / 1486 / 1495 ms | (not run) | 2.3 s |
| Git Bash, no host (leg D) | 1023 / 1183 / 1052 ms | (not run) | 8.5 s |

With no host, the walk went from about 8 s to about 1.4 s on the same machine. It no longer depends on how far the
walk climbs.

**The CIM query the code runs.** `loadWin32ProcessTable` in `process-session.ts` runs:

`powershell.exe -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress"`

There is **no `-Filter`**: it fetches the whole process table once (60 s timeout, `windowsHide`) and walks it in
memory. It runs only on win32, and only when the default `readProcessParent` is in use, so the injected readers in
the tests do not trigger it.

**Spawns per SessionStart, counted** (the preload counter wrapped `execFileSync` and `spawnSync` in the hook):

- **Host found: 2 `powershell.exe` spawns.** The CIM table (about 800 ms) **plus**
  `(Get-Process -Id <host>).StartTime.ToFileTimeUtc()` from `processStartTime` (about 450 ms).
- **No host: 1 spawn**, the CIM table (about 800 ms).

So the walk itself is one spawn, which is what F3 asked for. The proof write adds a second, for the start time. That
second spawn existed at r1 too, so it is not a regression. CreationDate is in the same CIM row and could remove it,
but the server would have to compute `proc_start` the same way. Noted, not a finding. The server-side walk
(`proveSession` with `cursorWalk`) also uses one table spawn per call, then `processStartTime(host)`.

**Row 5: PASS.**

## Row 6: The matcher against a real install

cursor-agent **is installed**, at `C:\Users\Aaron\AppData\Local\cursor-agent\`. That folder holds
`cursor-agent.cmd`, `cursor-agent.ps1`, `agent.cmd`, `agent.ps1` and `versions\`. There are runnable version
directories (with `node.exe` and `index.js`) for `2026.09.26-dd393fe`, `2026.09.28-64d2043`, `2026.10.01-e373342`
and `dist-package`. The rest of `versions\` is `.zip` entries. **No cursor-agent process was running** (0 command
lines contain `cursor-agent`, QA's own excluded), and no Cursor.exe was running. So the shape below comes from the
install. Nothing was run.

- `cursor-agent.cmd` → `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy
  Bypass -File "%SCRIPT_DIR%\cursor-agent.ps1" %*`
- `cursor-agent.ps1` line 65: `& "$scriptPath\versions\$versionName\node.exe" "$scriptPath\versions\$versionName\index.js" $args`.
  Line 39 is a fallback for when the script sits beside its own `node.exe`, that is, inside a version directory:
  `& "$scriptPath\node.exe" "$scriptPath\index.js" $args`.
- So the host is `…\AppData\Local\cursor-agent\versions\<ver>\node.exe …\cursor-agent\versions\<ver>\index.js …`. This
  is the same shape the r2 measure doc recorded on the QA PC.
- `isCursorAgentHostCommandLine` was run against this shape for every version directory, unquoted, quoted (as
  PowerShell's `&` may pass it) and with forward slashes: **true in every form**. The line-39 fallback also resolves
  to `…\versions\<ver>\index.js`, which matches. The nearest ancestor that matches is the `node.exe index.js`
  process, below the `.ps1`/`.cmd` wrappers, which the matcher also accepts.

**Row 6: PASS.** The matcher would match this install's host process. This was checked against the install's
launch scripts, not against a live process.

## The touched test files (one run each, scratch HOME, PowerShell not involved: vitest from a node driver)

- `tests/t235-p2-3-cursor-proof.test.ts`: **8 passed**, exit 0. That includes the e2e fixture-host test, which runs
  the real Win32 table walk.
- `tests/t003-session-proof.test.ts`: **18 passed**, exit 0.

## Findings

**F4 (#427 r2, significant, CONFIRMED on Windows, a regression from r1).** The new `loadWin32ProcessTable` has no
error handling. `findCursorAgentHostPid` calls it before the walk, and in `cli-bootstrap.ts:126` that call sits
**outside** the `try` (which starts at line 134). So if the CIM query cannot run, the hook does not refuse with a
reason: it **crashes**. At r1, `readProcessParent` caught every failure and returned null.

Reproduced in `C:\qa-tmp\qa276\nops.mjs`, with `PATH` reduced to the node directory so that `powershell.exe` cannot
be spawned, and the fixture host present:

| Build | How launched | Result |
|---|---|---|
| r1 `270b550b` | direct spawn and Git Bash | exit 0, `Session proof NOT written: no cursor-agent host process found …` |
| **r2 `987901c9`** | direct spawn and Git Bash | **exit 1**: `Error: spawnSync powershell.exe ENOENT at loadWin32ProcessTable … at findCursorAgentHostPid`, a 32-line stack trace and **no proof line** |
| r1, server side | `proveSession(…, {cursorWalk:true})` | `{"id":null,"reason":"no cursor-agent host ancestor …"}` |
| **r2, server side** | the same | **throws** `ENOENT spawnSync powershell.exe` |

- **Other triggers, found by reading the code and not run:** the 60 s timeout; a CIM or WMI failure. If
  `Get-CimInstance` fails without a terminating error, stdout is empty and `JSON.parse("")` throws. A nonzero
  PowerShell exit also throws.
- **What breaks:** the whole Cursor SessionStart hook, not just the proof. Everything bootstrap prints after the
  proof is lost.
- **What does not break:** attribution still fails closed. No proof is written, and on the server side an
  exception replaces the refusal reason. Still, this contradicts this file's own rule that session start never
  fails (`cli-bootstrap.ts:266`) and row 3's requirement of a *visible* "not written" reason.
- **Fix:** wrap the table load (or `findCursorAgentHostPid`'s win32 branch) so that a failure returns null with a
  reason, as r1's per-pid reader did. A test should inject a failing table loader.

**Observations, not findings:**

- `test-windows` was skipped on CI for this head (row 2), so the Windows walk has no CI coverage.
- A host found costs 2 PowerShell spawns per SessionStart (see row 5).
- The `.cmd` and `.ps1`+`powershell` matcher rules also accept wrapper processes. Today the nearest match is always
  the `node.exe index.js` process below them (row 6), so this has no effect.

## Verdict (#427 r2, Windows rows 1–6)

| PR | Pinned head | Rows | Verdict |
|---|---|---|---|
| #427 | `987901c9cb43f3dd3a31b9e22fec164edd9769dd` | 1 PASS, 2 PASS, 3 PASS, 4 PASS (F2 fixed), 5 PASS (F3 fixed: one CIM spawn for the walk, about 8 s → 1.4 s with no host), 6 PASS (install shape matches) | **REJECT** |

**Why REJECT when every row passes:** r2's rewrite turned a fail-closed refusal into an uncaught crash of the Cursor
SessionStart hook, and a throw from the server's `proveSession`, whenever the single CIM query fails (F4). That was
reproduced on this laptop, and it is a regression from r1. The fix is small and local (a catch that returns null
with a reason, plus one test). After it, rows 3 and 4 need only a re-run of legs C/D and the F4 repro. The planner
may overrule this to ACCEPT with F4 as a follow-up. The rows themselves are clean.

QA-276: REPORT COMPLETE
