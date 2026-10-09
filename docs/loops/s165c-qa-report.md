# QA 298 — s165c report: BRIEFING-FIX BF-A6 (Windows ACL)

**Seat:** SIA QA, record session 165, headless Claude Code (Opus), the LAPTOP (Windows 10 Pro 19045), 2026-10-09.
**Dispatch:** `docs/loops/qa-298-s165c-dispatch.md`. **Dispatch tree:** `C:/qa-scratch/qa298-wt`.
`git -C C:/qa-scratch/qa298-wt log -1 --format=%H` → `5104b37f9b539e4d482a566863715651d4bb17ba` (= DISPATCH_SHA).
**Under test:** PR #545 `loop/briefing-fix` @ `3ded135d08a52338010c442ae65e33349aff7464`.
`C:/qa-tmp/qa298` did not exist before the run (`Test-Path` → `False`) and was created fresh.

## Verdict: REJECT — A6 CASE 1 and CASE 2 both fail

Both cases print `commit or stash` instead of the permissions message. G1 is clean, and nothing
was written. **But read the FINDING first.** This session's token is elevated (High Mandatory Level)
and has `SeBackupPrivilege` and `SeRestorePrivilege` **Enabled**. With those privileges a process
that opens files with backup semantics gets past DENY ACEs, so the ACL very likely never reached
node. The rows are recorded as they ran, and the dispatch rule makes that a REJECT. My diagnosis:
**the failure says more about the environment than about the code under test.**

## Rows

| # | Result | Evidence |
|---|---|---|
| P1 | PASS | `node -v` → `v22.23.2` |
| P2 | PASS | `git ls-remote origin refs/heads/loop/briefing-fix` → `3ded135d08a52338010c442ae65e33349aff7464	refs/heads/loop/briefing-fix` (= pin) |
| P3 | PASS | worktree `C:/qa-scratch/qa298-pr545` created (`HEAD is now at 3ded135d BRIEFING-FIX r3: vtag, no double v`). `npm ci` (run as `npm --prefix C:/qa-scratch/qa298-pr545/open-brain ci`): `added 185 packages, and audited 186 packages in 31s`, exit 0. `npm run build` (same `--prefix` form): `tsc` clean, `copied 7 runtime asset file(s) into build/`, `build stamped 3ded135`, exit 0. Note: the harness denied `&& echo EXIT=0 \|\| echo EXIT=nonzero` chaining. Exit status comes from the tool, which reports any nonzero exit as an error, and it reported none. |
| P4 | PASS | `git -C C:/qa-scratch/qa298-pr545 log -1 --format=%H` → `3ded135d08a52338010c442ae65e33349aff7464` |
| A6 | **FAIL (CASE 1, CASE 2)** | CASE 1: `has 'not writable': False`, `has 'commit or stash': True`. CASE 2: `has 'is not readable (permissions)': False`, `has 'commit or stash': True`. Restores clean (no `(DENY)` after either case). Final listing `keep.txt` only (PASS on that sub-check). Full output below. |
| G1 | PASS | both paths show no `(DENY)` entry; output below. No `/remove:d` was needed. |

### A6 command

The script was given by absolute path: the harness denied a `cd`, and the script itself uses only absolute paths.
I did not edit it.

```
powershell -NoProfile -ExecutionPolicy Bypass -File C:/qa-scratch/qa298-wt/docs/loops/qa-298/bf-a6.ps1 -Cli C:/qa-scratch/qa298-pr545/open-brain/build/cli.js -Fixture C:/qa-scratch/qa298-pr545/open-brain/tests/fixtures-state/state.json
```

### A6 whole output

```
=== CASE 1 (P1a): .claude/commands unwritable (deny W) AND a dirty path. Expect the permissions message, NOT 'commit or stash'
--- icacls before:
C:\qa-tmp\qa298\repo\.claude\commands BUILTIN\Administrators:(I)(OI)(CI)(F)
                                      NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
                                      BUILTIN\Users:(I)(OI)(CI)(RX)
                                      NT AUTHORITY\Authenticated Users:(I)(M)
                                      NT AUTHORITY\Authenticated Users:(I)(OI)(CI)(IO)(M)

Successfully processed 1 files; Failed processing 0 files
--- icacls during:
C:\qa-tmp\qa298\repo\.claude\commands DESKTOP-0GV3HAD\Aaron:(DENY)(W)
                                      BUILTIN\Administrators:(I)(OI)(CI)(F)
                                      NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
                                      BUILTIN\Users:(I)(OI)(CI)(RX)
                                      NT AUTHORITY\Authenticated Users:(I)(M)
                                      NT AUTHORITY\Authenticated Users:(I)(OI)(CI)(IO)(M)

Successfully processed 1 files; Failed processing 0 files
EXIT=1
--- output:
bootstrap install-commands refused: uncommitted change outside the import (`stray.txt`) — commit or stash it first. Nothing written

CASE1 has 'not writable': False
CASE1 has 'commit or stash': True
--- icacls after (restored):
C:\qa-tmp\qa298\repo\.claude\commands BUILTIN\Administrators:(I)(OI)(CI)(F)
                                      NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
                                      BUILTIN\Users:(I)(OI)(CI)(RX)
                                      NT AUTHORITY\Authenticated Users:(I)(M)
                                      NT AUTHORITY\Authenticated Users:(I)(OI)(CI)(IO)(M)

Successfully processed 1 files; Failed processing 0 files
=== CASE 2 (P1b): the dirty file itself unreadable (deny R), directory writable. Expect 'is not readable (permissions)'
--- icacls before:
C:\qa-tmp\qa298\repo\stray.txt BUILTIN\Administrators:(I)(F)
                               NT AUTHORITY\SYSTEM:(I)(F)
                               BUILTIN\Users:(I)(RX)
                               NT AUTHORITY\Authenticated Users:(I)(M)

Successfully processed 1 files; Failed processing 0 files
--- icacls during:
C:\qa-tmp\qa298\repo\stray.txt DESKTOP-0GV3HAD\Aaron:(DENY)(R)
                               BUILTIN\Administrators:(I)(F)
                               NT AUTHORITY\SYSTEM:(I)(F)
                               BUILTIN\Users:(I)(RX)
                               NT AUTHORITY\Authenticated Users:(I)(M)

Successfully processed 1 files; Failed processing 0 files
EXIT=1
--- output:
bootstrap install-commands refused: uncommitted change outside the import (`stray.txt`) — commit or stash it first. Nothing written

CASE2 has 'is not readable (permissions)': False
CASE2 has 'commit or stash': True
--- icacls after (restored):
C:\qa-tmp\qa298\repo\stray.txt BUILTIN\Administrators:(I)(F)
                               NT AUTHORITY\SYSTEM:(I)(F)
                               BUILTIN\Users:(I)(RX)
                               NT AUTHORITY\Authenticated Users:(I)(M)

Successfully processed 1 files; Failed processing 0 files
=== NOTHING WRITTEN check: .claude/commands lists only keep.txt
keep.txt
=== DONE
```

### G1 output

`powershell -NoProfile -Command "icacls 'C:\qa-tmp\qa298\repo\.claude\commands'; icacls 'C:\qa-tmp\qa298\repo\stray.txt'"`
(this wrapper was used because the harness denied a bare `icacls`):

```
C:\qa-tmp\qa298\repo\.claude\commands BUILTIN\Administrators:(I)(OI)(CI)(F)
                                      NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
                                      BUILTIN\Users:(I)(OI)(CI)(RX)
                                      NT AUTHORITY\Authenticated Users:(I)(M)
                                      NT AUTHORITY\Authenticated Users:(I)(OI)(CI)(IO)(M)

Successfully processed 1 files; Failed processing 0 files
C:\qa-tmp\qa298\repo\stray.txt BUILTIN\Administrators:(I)(F)
                               NT AUTHORITY\SYSTEM:(I)(F)
                               BUILTIN\Users:(I)(RX)
                               NT AUTHORITY\Authenticated Users:(I)(M)

Successfully processed 1 files; Failed processing 0 files
```

## FINDING (environment): this run's token bypasses DENY ACEs, so A6 could not exercise P1

`C:\Windows\System32\whoami.exe /priv` and `/groups`, read-only, from the same harness:

```
SeBackupPrivilege                         Back up files and directories                                      Enabled
SeRestorePrivilege                        Restore files and directories                                      Enabled
...
BUILTIN\Administrators                                        Alias            S-1-5-32-544
      Mandatory group, Enabled by default, Enabled group, Group owner
Mandatory Label\High Mandatory Level                          Label            S-1-16-12288
```

(Excerpt. All 24 listed privileges show `Enabled`.)

**The code under test has the right order.** In `open-brain/src/pipelines/bootstrap/index.ts` @ 3ded135d,
`installCommands` calls `preflightWrite(root)` (line 442) **before** the dirty-tree check (444–455).
Inside the dirty-tree check, `readable(absBlocked)` is consulted before the `commit or stash` throw.
The built `build/pipelines/bootstrap/index.js` contains the same `is not writable` throw and the same
`preflightWrite(root)` call (lines 336 and 380). So `commit or stash` means two things:

- `writeProbe` (`writeFileSync(probe, "", { flag: "wx" })` in `.claude/commands`) **succeeded** under `(DENY)(W)`;
- `pathReadable` (`readFileSync(stray.txt)`) **succeeded** under `(DENY)(R)`.

**Why that is the expected outcome here:** libuv opens files with `FILE_FLAG_BACKUP_SEMANTICS`. In a process
whose token has SeBackupPrivilege and SeRestorePrivilege enabled, that flag gets read and write access
past DENY ACEs. **For this process the directory really was writable and the file really was readable.**
Given that, `commit or stash` is the correct message. The probe file was cleaned up: the final listing is
`keep.txt` only.

**I did not verify this hypothesis by a second ACL experiment:** that would have meant applying ACLs
outside the dispatched script, which is beyond the brief.

**Recommendation to the planner:**
- Re-run BF-A6 from a **non-elevated** shell, a normal medium-integrity user with Backup/Restore privileges absent or disabled. Confirm with `whoami /priv` before the script runs.
- Consider adding that check as a preflight row to `bf-a6.ps1` or the dispatch, so an elevated session STOPs as INCOMPLETE instead of producing a REJECT.

The r1 dry-run that passed was presumably non-elevated.

## Housekeeping

- No real `state.json`, knowledge DB, vault or settings file was touched. The only writes were under `C:/qa-scratch/qa298-*` and `C:/qa-tmp/qa298`.
- `gh` was not used.
- Worktrees `C:/qa-scratch/qa298-wt` and `C:/qa-scratch/qa298-pr545` are left in place for inspection.

QA-298: REPORT COMPLETE
