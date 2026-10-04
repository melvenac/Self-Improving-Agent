# QA 274 (s161b): real-Windows rows for #425 and #427

**Seat:** QA, headless Claude Code on Opus, record session 161. **Machine: the DESKTOP (DESKTOP-UGEKR74)**, not
the laptop (Clark's launch note). Windows 10 Pro 19045, Windows PowerShell 5.1.19041.6456 (Desktop edition),
Git Bash (MINGW64), node v22.23.2 at `C:\Program Files\nodejs\node.exe`. 2026-10-04, finished ~08:10Z.
**No machine lease:** the desktop has none, so the lease step was skipped.

**Worktree:** `git -C C:/qa-scratch/qa274-wt log -1 --format=%H` = `0565c51ff97bac036cd4cac18bfa4ce4e1b2729d`
(the DISPATCH_SHA). `origin/master` had moved to `3bcd7d72` by fetch time; the pinned heads were QA'd as dispatched.
**Scope:** rows 1, 4, 15 and 20 only, for #425 and #427 (per the QA 274 prompt). Dispatch:
`docs/loops/qa-273-s161a-dispatch.md`.

## Environment notes (read before the rows)

- **TMP/TEMP were NOT set by the launcher:** both were `C:\Users\melve\AppData\Local\Temp` in the session. Every
  driver set `TMP=TEMP=C:\qa-tmp` and `npm_config_cache=C:\qa-tmp\npm-cache` explicitly in the child environment.
- **The PowerShell tool was unusable in this headless session:** the permission layer refused every PowerShell
  command, `node --version` included. So the PowerShell legs ran as **`powershell.exe -NoProfile -Command ...`
  (5.1) spawned from a node driver**, and the driver itself was launched from Git Bash. The Git Bash legs ran as
  `C:\Program Files\Git\bin\bash.exe -c ...` from the same drivers. Each row below names which shell ran the
  command under test. The drivers are in `C:\qa-tmp\qa274\` (not committed).
- Scratch homes: `C:\qa-tmp\qa274 home ps` (contains a space), `C:\qa-tmp\qa274-home-bash`,
  `C:\qa-tmp\qa274 home 427` (contains a space). No real settings file, record or DB was written; see the hashes
  under each row.
- Candidate worktrees: `C:/qa-scratch/qa274-pr425` @ `9fcb97ca`, `C:/qa-scratch/qa274-pr425 sp` @ `9fcb97ca`
  (a second copy, so the repo path itself has a space), `C:/qa-scratch/qa274-pr427` @ `270b550b`.

## Row 1: Confined (Git Bash, `git diff --stat <DISPATCH_SHA>...<head>`)

Both PR heads were fetched as `refs/pull/N/head`. Each equals its pinned SHA, and `gh pr view` still shows that SHA
as the open head.

**#425** `9fcb97ca` (one commit beyond merge-base `71b2b924`): `scripts/setup-hooks.mjs` (+28),
`scripts/setup.mjs` (+13/-6), `open-brain/tests/setup-hooks.test.ts` (+58), `open-brain/tests/setup-scratch-home.test.ts`
(+84, new). **All four files are in the task.** No file outside T-235 P2-4.

**#427** `270b550b` (one commit beyond merge-base `f8dc13a5`): `open-brain/src/cli-bootstrap.ts`,
`open-brain/src/server.ts`, `open-brain/src/shared/process-session.ts`,
`open-brain/tests/fixtures-t003/cursor-agent-host.cjs` (new), `open-brain/tests/t003-r2.test.ts` (1 line),
`open-brain/tests/t003-session-proof.test.ts` (-2, a removed comment pair), `open-brain/tests/t235-p2-3-cursor-proof.test.ts`
(new). **All in the task.** Not a finding, just noted: `process-session.ts` loses the two-line D2 comment that
explained *why* JSON `null` is refused in the Claude path. The check itself is kept.

**Row 1: PASS (#425), PASS (#427).**

## Row 4: CI, read only (Git Bash, `gh run view`)

| PR | Run | headSha | event | `test` | `test-windows` | conclusion |
|---|---|---|---|---|---|---|
| #425 | 37180118545 | `9fcb97ca8bb266c03cef7501c4b2b831c8d1601b` | pull_request (`loop/t235-p2-4`) | success | **skipped** | success |
| #427 | 37180595977 | `270b550b97ada09f50c256f381e4ec26ff98782a` | pull_request (`loop/t235-p2-3`) | success | **skipped** | success |

Each run belongs to its pinned head. **`test-windows` was skipped on both**, so rows 15 and 20 below are the only
Windows evidence these heads have.

**Row 4: PASS (#425), PASS (#427).**

## Row 15 [W]: #425 on real Windows

### 15a: two `setup.mjs` runs under a scratch USERPROFILE, **PowerShell 5.1**

`powershell.exe -NoProfile -Command "node scripts/setup.mjs"` with cwd `C:/qa-scratch/qa274-pr425`,
`USERPROFILE=HOME=C:\qa-tmp\qa274 home ps` (**a space**), plus a scratch `OPEN_BRAIN_VAULT_DIR` and `KNOWLEDGE_V2_DB`.
Before the runs, the scratch `hooks.json` was seeded with a user hook (`echo user-session-end`), a stale bare-node
`cli-session-end.js` sessionEnd entry, and a stale bare-node sessionStart entry.

- Run 1: exit 0. `Upgraded 1 stale Cursor sessionEnd hook entry(ies)` and `Cursor sessionEnd hook registered`.
- Run 2: exit 0. `Cursor sessionEnd hook already configured`. Every other step says already/skipped.
- `hooks.json` sha256 after run 1 = after run 2 = `2028da0f…ae23f`: **byte-identical**.
- sessionEnd after run 2: **2 entries**, the user's `echo user-session-end` (**kept**) and exactly **one**
  `cli-session-end.js` entry.
- **Exact command string written:**
  `"C:/Program Files/nodejs/node.exe" "C:/qa-scratch/qa274-pr425/open-brain/build/cli-session-end.js"`
  Both paths are absolute and both exist after the build. The node path contains a space.

### 15b: the same, **Git Bash**, with the repo path itself containing a space

`bash.exe -c "node scripts/setup.mjs"` with cwd `C:/qa-scratch/qa274-pr425 sp`, `USERPROFILE=HOME=C:\qa-tmp\qa274-home-bash`.
The results match 15a: exit 0 on both runs, `hooks.json` byte-identical across the two runs (`e2be8e77…49d4`), one
`cli-session-end.js` entry, and the user hook kept.
- **Exact command string written:**
  `"C:/Program Files/nodejs/node.exe" "C:/qa-scratch/qa274-pr425 sp/open-brain/build/cli-session-end.js"`
  Both paths have a space, both are quoted, and both are absolute and exist.

**Real profile, both legs:** `~/.cursor/hooks.json`, `~/.cursor/mcp.json`, `~/.claude/settings.json`,
`~/.claude/.mcp.json`: **match / match / match / match** (sha256 before vs after, no content read).

### 15c: does the written command execute? (probe script at a spaced path, the same string shape)

The string was built by #425's own `withCursorSessionEndHook`, pointed at a probe script
`C:/qa-tmp/qa274 probe/cli-session-end.js` that prints its argv:
`"C:/Program Files/nodejs/node.exe" "C:/qa-tmp/qa274 probe/cli-session-end.js"`

| Shell | How the string was run | Result |
|---|---|---|
| cmd.exe | `cmd /d /s /c "<string>"` | exit 0, **ran**, argv[1] intact |
| Git Bash | `bash -c '<string>'` | exit 0, **ran** |
| PowerShell 5.1 | `-Command <string>` verbatim | **exit 1, did not run**: parse error at the second quoted token |
| PowerShell 5.1 | `-Command "& " + <string>` | exit 0, ran |
| PowerShell 5.1, Cursor's documented feeder | `Get-Content … -Raw \| & { $input \| <string> }` | **exit 1, did not run**: "Expressions are only allowed as the first element of a pipeline." |
| the same feeder | with `& <string>` | exit 0, ran |
| the same feeder | `node "<spaced path>"` (bare-node shape) | exit 0, ran |

**F1 (#425, significant, PLAUSIBLE, not observed live).** The `"<node>" "<script>"` shape is correct for cmd and
for bash. **In PowerShell, a command that starts with a quoted string is an expression, not a call.** It parses
only with a `&` prefix. `open-brain/docs/cursor-windows-git-bash-hooks.md` records that Cursor runs a hook as
`Get-Content … -Raw | & { $input | <hook command> }`. With #425's string inside that wrapper, the hook **fails to
parse before `cli-session-end.js` starts**. If Cursor on Windows runs hooks in PowerShell (the P2-2 measurement's
seat shell was PowerShell), the new sessionEnd entry would never run on Windows, and nothing would report it.

- I did not run Cursor, so I cannot say which shell Cursor's hook runner uses today. That doc dates from 2026-08.
- **Not introduced by #425:** master's `withCursorSessionHook` already writes the same shape for `sessionStart`. The
  same question therefore applies to the existing Windows sessionStart hook.
- **"It was there before" does not lower the severity.** The planner should rule on it. One live Cursor-on-Windows
  `sessionEnd` firing would settle it, and so would writing `& "<node>" "<script>"` if Cursor's runner is PowerShell.
- #425 is HELD anyway (P2-7). F1 is a second reason to check before merging.

**Row 15: PASS as specified** (two-run idempotence, scratch USERPROFILE, a quoted path with a space, the exact
string reported). **F1 is open** for the planner.

## Row 20 [W]: #427's ancestor walk on real Windows

**Process API on Windows:** `readProcessParent(pid)` spawns
`powershell.exe -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process -Filter 'ProcessId=<pid>' …"`,
**one PowerShell process per ancestor step**, and reads `ProcessId`, `ParentProcessId` and `CommandLine` (WMI/CIM).
It does not use `/proc` or `ps`; those branches are for linux and others only. Because the walk uses Windows-native
parent pids, it works the same whether the hook was launched from PowerShell or from Git Bash.

The build was `npm ci` plus `npm run build` in `C:/qa-scratch/qa274-pr427/open-brain`, both exit 0. Scratch
`HOME=USERPROFILE=C:\qa-tmp\qa274 home 427` (a space). `OPEN_BRAIN_ACTIVE_SESSION`, `KNOWLEDGE_V2_DB`, the vault,
score and shadow paths all pointed under it. `CLAUDE_PID` was removed from the environment. The payload carried
`session_id`, `workspace_roots` (a scratch project) and `cursor_version`.

| Leg | Shell running the chain | Chain | Result |
|---|---|---|---|
| A | PowerShell 5.1 | `Get-Content payload \| node cursor-agent-host.cjs -- cli-bootstrap.js --ide cursor` | exit 0, 4.4 s. Host pid 16404. `Session proof written … for cursor-agent host process 16404`. `by-pid/16404.json` has session_id ✓, claude_pid 16404 ✓, ide cursor ✓, `proc_start=win:…` ✓ |
| B | Git Bash | `node cursor-agent-host.cjs -- cli-bootstrap.js < payload` (**no `--ide`; `cursor_version` only**) | exit 0, 2.3 s. Host 9284, proof `by-pid/9284.json` correct on all four fields |
| C | PowerShell 5.1 | `cli-bootstrap.js --ide cursor` with no fixture | exit 0, 7.4 s. `Session proof NOT written: no cursor-agent host process found in the hook's ancestor chain…` No file added |
| D | Git Bash | the same as C | exit 0, 8.5 s. The same visible reason, no file added (the by-pid listing was identical before and after C and D) |
| E | PowerShell 5.1 | fixture → probe calling the real `readProcessParent` / `findCursorAgentHostPid` / `proveSession` | trace: `probe 18992 → ppid 10176 (cursor-agent-host.cjs) ⇐ match`, walk 3.0 s. `proveSession(cursorWalk)` from the probe as a wrapper parent: refused (absent) before a proof existed, `{"id":"eeee…","pid":10176}` after. **Without `cursorWalk`: id=null**, i.e. the Claude path is unchanged |
| F | Git Bash | the same as E | the same outcome: host 19076, walk 2.9 s, proven after the proof write, null without `cursorWalk` |

Real `~/.claude/settings.json` and `~/.cursor/hooks.json`: **match / match**. The live DB and the active-session
slot were not hashed: planner sessions on this machine write them, so their hash is not this run's instrument.
Instead: the scratch slot exists after the run, which shows the bootstrap wrote into scratch.

**F2 (#427, low, CONFIRMED on Windows).** `cli-bootstrap` calls `findCursorAgentHostPid(process.pid)`, and the walk
tests the **hook's own command line first**. If the hook's path contains `cursor-agent` (for example SIA cloned
into a directory named like that), the walk returns the hook's own short-lived pid.
- Reproduced with `C:\qa-tmp\qa274\cursor-agent-named-dir\selfprobe.mjs`: `findCursorAgentHostPid(self) = self`.
- A proof would then be written for the wrong pid. That is the literal case row 19 says must never happen.
- The server would still refuse: it walks to the real host and finds no file there. So this fails closed rather
  than attributing to the wrong session.
- A fix would start the walk at `process.ppid` or match the `cursor-agent` executable rather than any substring.
  Not a gate for the rows I own.

**F3 (#427, observation).** Each ancestor step costs one `powershell.exe` spawn of about 1 s. SessionStart therefore
takes 2–4 s with a host nearby and 7–9 s when there is no host (the walk climbs to the root). The server pays the
same cost on the first `cursorWalk` lookup. The file's header says the proof is written first "before anything
slow". This walk is now the slow part. One CIM query for all processes, walked in memory, would cost one spawn.

**Row 20: PASS.** The walk finds the fixture host through the Windows process tree from both PowerShell 5.1 and Git
Bash, the proof lands for the right pid, and with no host it fails closed with a visible reason.

## Verdicts (rows 1, 4, 15, 20 only)

| PR | Pinned head | Verdict | Open |
|---|---|---|---|
| #425 | `9fcb97ca8bb266c03cef7501c4b2b831c8d1601b` | **ACCEPT** (rows 1, 4, 15) | **F1**: PowerShell cannot parse the quoted-exe hook string; needs a live Cursor-on-Windows check or a `&` prefix before merge. Already HELD for P2-7 |
| #427 | `270b550b97ada09f50c256f381e4ec26ff98782a` | **ACCEPT** (rows 1, 4, 20) | F2 (self-match, fails closed), F3 (latency) |

QA-274: REPORT COMPLETE
