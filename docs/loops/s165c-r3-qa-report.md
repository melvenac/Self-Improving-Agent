# QA 298-r3 report, session-165 batch c: BF-A6 (Windows ACL), non-elevated

**Seat:** SIA QA, record session 165, headless Claude Code (Opus), LAPTOP, non-elevated scheduled task.
**Date:** 2026-10-09.
**Dispatch:** `docs/loops/qa-298r3-s165c-dispatch.md` @ `7cf13a18c8047116263b29f5f6427d0c17105e1a`.
**Under test:** SIA PR #545, `loop/briefing-fix` @ `3ded135d08a52338010c442ae65e33349aff7464`.

```
$ git -C C:/qa-scratch/qa298r3-wt log -1 --format=%H
7cf13a18c8047116263b29f5f6427d0c17105e1a
```

**Verdict: ACCEPT.** S0, P1–P4, A6 and G1 all pass. There is one FINDING about the test script's
privilege preflight (F1 below). It does not change the verdict, because an independent check shows the
session was not elevated.

## Execution note

The harness's permission layer blocked some compound commands, like the S0 two-path `Get-ChildItem` and
`;`-chained PowerShell. Those were run as separate single commands with the same effect. Most commands ran
through Git Bash. That matters for F1.

## S0: listing (nothing touched)

```
$ Get-ChildItem C:/qa-scratch -Directory -Filter 'qa298*' -Name
qa298-pr545
qa298-wt
$ Get-ChildItem C:/qa-tmp -Directory -Filter 'qa298*' -Name
qa298
$ git branch --list "qa/s165c*"     (SIA QA clone)
+ qa/s165c-report
```

These are r1/r2 leftovers. None of r3's three paths (`qa298r3-wt`, `qa298r3-pr545`, `C:/qa-tmp/qa298r3`)
existed, and nothing was removed, moved or reused. **PASS**

## P1

```
$ node -v
v22.23.2
```
**PASS**

## P2

```
$ git ls-remote origin refs/heads/loop/briefing-fix
3ded135d08a52338010c442ae65e33349aff7464	refs/heads/loop/briefing-fix
```
This equals the pin. **PASS**

## P3

```
$ git worktree add --detach C:/qa-scratch/qa298r3-pr545 3ded135d08a52338010c442ae65e33349aff7464
HEAD is now at 3ded135d BRIEFING-FIX r3: vtag, no double v
$ npm --prefix C:/qa-scratch/qa298r3-pr545/open-brain ci
npm warn deprecated prebuild-install@7.1.3: No longer maintained. ...
added 185 packages, and audited 186 packages in 25s
17 vulnerabilities (2 low, 4 moderate, 8 high, 3 critical)
$ npm --prefix C:/qa-scratch/qa298r3-pr545/open-brain run build
> open-brain@0.1.0 prebuild
> open-brain@0.1.0 build
> tsc
> open-brain@0.1.0 postbuild
copied 7 runtime asset file(s) into build/
build stamped 3ded135
```
Both succeeded with no error, and `npm ci` ran once. **PASS**

## P4

```
$ git -C C:/qa-scratch/qa298r3-pr545 log -1 --format=%H
3ded135d08a52338010c442ae65e33349aff7464
```
This equals the pin. **PASS**

## A6: whole output

```
$ cd C:/qa-scratch/qa298r3-wt && powershell -NoProfile -ExecutionPolicy Bypass -File docs/loops/qa-298/bf-a6.ps1 -Cli C:/qa-scratch/qa298r3-pr545/open-brain/build/cli.js -Fixture C:/qa-scratch/qa298r3-pr545/open-brain/tests/fixtures-state/state.json -Root 'C:\qa-tmp\qa298r3'
=== PRIVILEGE PREFLIGHT
/usr/bin/whoami: extra operand '/groups'
Try '/usr/bin/whoami --help' for more information.
/usr/bin/whoami: extra operand '/priv'
Try '/usr/bin/whoami --help' for more information.
privileges OK: no Backup/Restore privilege enabled
=== CASE 1 (P1a): .claude/commands unwritable (deny W) AND a dirty path. Expect the permissions message, NOT 'commit or stash'
--- icacls before:
C:\qa-tmp\qa298r3\repo\.claude\commands BUILTIN\Administrators:(I)(OI)(CI)(F)
                                        NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
                                        BUILTIN\Users:(I)(OI)(CI)(RX)
                                        NT AUTHORITY\Authenticated Users:(I)(M)
                                        NT AUTHORITY\Authenticated Users:(I)(OI)(CI)(IO)(M)

Successfully processed 1 files; Failed processing 0 files
--- icacls during:
C:\qa-tmp\qa298r3\repo\.claude\commands DESKTOP-0GV3HAD\Aaron:(DENY)(W)
                                        BUILTIN\Administrators:(I)(OI)(CI)(F)
                                        NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
                                        BUILTIN\Users:(I)(OI)(CI)(RX)
                                        NT AUTHORITY\Authenticated Users:(I)(M)
                                        NT AUTHORITY\Authenticated Users:(I)(OI)(CI)(IO)(M)

Successfully processed 1 files; Failed processing 0 files
EXIT=1
--- output:
bootstrap install-commands refused: `.claude/commands/` is not writable — fix permissions and try again. Nothing written

CASE1 has 'not writable': True
CASE1 has 'commit or stash': False
--- icacls after (restored):
C:\qa-tmp\qa298r3\repo\.claude\commands BUILTIN\Administrators:(I)(OI)(CI)(F)
                                        NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
                                        BUILTIN\Users:(I)(OI)(CI)(RX)
                                        NT AUTHORITY\Authenticated Users:(I)(M)
                                        NT AUTHORITY\Authenticated Users:(I)(OI)(CI)(IO)(M)

Successfully processed 1 files; Failed processing 0 files
=== CASE 2 (P1b): the dirty file itself unreadable (deny R), directory writable. Expect 'is not readable (permissions)'
--- icacls before:
C:\qa-tmp\qa298r3\repo\stray.txt BUILTIN\Administrators:(I)(F)
                                 NT AUTHORITY\SYSTEM:(I)(F)
                                 BUILTIN\Users:(I)(RX)
                                 NT AUTHORITY\Authenticated Users:(I)(M)

Successfully processed 1 files; Failed processing 0 files
--- icacls during:
C:\qa-tmp\qa298r3\repo\stray.txt DESKTOP-0GV3HAD\Aaron:(DENY)(R)
                                 BUILTIN\Administrators:(I)(F)
                                 NT AUTHORITY\SYSTEM:(I)(F)
                                 BUILTIN\Users:(I)(RX)
                                 NT AUTHORITY\Authenticated Users:(I)(M)

Successfully processed 1 files; Failed processing 0 files
EXIT=1
--- output:
bootstrap install-commands refused: `stray.txt` is not readable (permissions), so git reports it as changed — fix permissions and try again. Nothing written

CASE2 has 'is not readable (permissions)': True
CASE2 has 'commit or stash': False
--- icacls after (restored):
C:\qa-tmp\qa298r3\repo\stray.txt BUILTIN\Administrators:(I)(F)
                                 NT AUTHORITY\SYSTEM:(I)(F)
                                 BUILTIN\Users:(I)(RX)
                                 NT AUTHORITY\Authenticated Users:(I)(M)

Successfully processed 1 files; Failed processing 0 files
=== NOTHING WRITTEN check: .claude/commands lists only keep.txt
keep.txt
=== DONE
EXIT=0
```

- Preflight printed `privileges OK`, with no exit 3. But see F1: the check was vacuous, and the
  independent check below confirms the result.
- CASE 1: `not writable` True, `commit or stash` False.
- CASE 2: `is not readable (permissions)` True, `commit or stash` False.
- Neither `icacls after (restored)` shows a `(DENY)` entry for `DESKTOP-0GV3HAD\Aaron`.
- The final listing is exactly `keep.txt`.

**PASS**

### Independent privilege check (because of F1)

```
$ powershell -NoProfile -Command "C:\Windows\System32\whoami.exe /priv /groups /fo list"
...
Group Name: BUILTIN\Administrators
Attributes: Group used for deny only
...
Group Name: Mandatory Label\Medium Mandatory Level
...
PRIVILEGES INFORMATION
Privilege Name: SeShutdownPrivilege            State: Disabled
Privilege Name: SeChangeNotifyPrivilege        State: Enabled
Privilege Name: SeUndockPrivilege              State: Disabled
Privilege Name: SeIncreaseWorkingSetPrivilege  State: Disabled
Privilege Name: SeTimeZonePrivilege            State: Disabled
```

The token is medium integrity, with Administrators marked deny-only, and it holds neither
SeBackupPrivilege nor SeRestorePrivilege. The session really was non-elevated. Both DENY ACEs also reached
node, which produced the permission refusals.

## G1

```
$ powershell -NoProfile -Command "icacls C:\qa-tmp\qa298r3\repo\.claude\commands; icacls C:\qa-tmp\qa298r3\repo\stray.txt"
C:\qa-tmp\qa298r3\repo\.claude\commands BUILTIN\Administrators:(I)(OI)(CI)(F)
                                        NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
                                        BUILTIN\Users:(I)(OI)(CI)(RX)
                                        NT AUTHORITY\Authenticated Users:(I)(M)
                                        NT AUTHORITY\Authenticated Users:(I)(OI)(CI)(IO)(M)

Successfully processed 1 files; Failed processing 0 files
C:\qa-tmp\qa298r3\repo\stray.txt BUILTIN\Administrators:(I)(F)
                                 NT AUTHORITY\SYSTEM:(I)(F)
                                 BUILTIN\Users:(I)(RX)
                                 NT AUTHORITY\Authenticated Users:(I)(M)

Successfully processed 1 files; Failed processing 0 files
```
There is no `(DENY)` entry for the user, so no `/remove:d` was needed. **PASS**

## Findings

- **F1 (test harness, not PR #545): the `bf-a6.ps1` privilege preflight fails open.** Lines 9–10 call bare
  `whoami`. When the script is launched from Git Bash, `PATH` puts Git's `/usr/bin/whoami` (GNU coreutils)
  ahead of `System32\whoami.exe`. GNU whoami rejects `/groups` and `/priv`, so `$bad` comes back empty and
  the script prints `privileges OK` without checking anything. An elevated run launched the same way would
  pass the preflight as well. Suggested fix: call `"$env:SystemRoot\System32\whoami.exe"` explicitly. The
  script should also STOP if the call fails, or if the output has no `PRIVILEGES INFORMATION` section. In
  this run the independent check above stands in for the preflight.

## Verdict

ACCEPT. S0, P1–P4, A6 and G1 all pass, and A6 ran in a verified non-elevated session.

QA-298: REPORT COMPLETE
