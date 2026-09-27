# QA queue guard — developer handoff (record 160)

**By:** Forge, `cursor-infra`, Grok 4.7. **Branch:** `chore/qa-queue-guard` from `origin/master` (`36a33bc`). No real QA run. Nothing was written to the QA PC, the laptop, or this desktop's live copy.

## Candidate

The lock and the harness are commit `c6fb300`. Hidden `Create` is `1fc03d0` plus the handoff commit after it. `qa-launch.md` is not on this branch.

`docs/loops/qa-queue.ps1` holds `%USERPROFILE%\sia-qa-queue\queue.lock` for the life of the queue.

- Created exclusively (`FileMode.CreateNew`), with this process's pid and start time in the file. The handle stays open so another process cannot delete it. On exit the file is removed only if it still names this pid and this start time.
- A second queue logs `refuse=` naming the holder's pid and start, and exits before any fetch or checkout.
- A stale lock (that pid is gone, or the pid is alive with a different start time) is taken over and logged as `takeover=`. If the file cannot be removed, the queue refuses instead of overlapping a holder it cannot see. A pid whose start time cannot be read counts as live.
- `Get-OtherDrivers` treats a `powershell.exe` whose `CommandLine` is null or blank as `commandline_unreadable` and waits. Every wait and every refusal is a `queue.log` line. A single hit is kept as a collection, so one driver is not dropped by reading `.Count` on an unwrapped return.

## Rows

Harness: `docs/loops/qa-queue-guard-harness.ps1`, on this desktop. The second queue (and the first) is started with `Invoke-CimMethod Win32_Process Create`, the full `powershell.exe` path, and `CurrentDirectory`, which is the desktop line in `qa-launch.md`. The command prefixes `cmd /c set USERPROFILE=<temp>\Aaron Melven` because `Win32_Process.Create` has no environment block and a parent env var is not inherited. That is what puts a space in the profile path without touching `C:\Users\melve\Worktrees\sia-qa`. The driver is `docs/loops/qa-9997/drive.ps1` and it only sleeps. `C:\Users\melve\qa-queue.ps1` and `C:\Users\melve\sia-qa-queue\queue.log` were not modified (mtime 2026-09-26 20:38 and 20:39).

| Row | Result |
| --- | --- |
| Live lock (harness pid, real start time) | Refused. Tree not moved (`generation.txt` stayed `B`, no `head=` line). Lock file kept. `refuse=... reason=held` |
| Same pid, start `1999-01-01T00:00:00.0000000Z` | `takeover=... reason=start_changed` |
| Dead pid `2147483646`, then a second Create while the stub was in its sleep | First queue: `takeover=... reason=pid_gone`, then the stub started (the driver path contains `Aaron Melven`, so the quoted `-File` path held). Second queue's only new line: `refuse=... reason=held`. Driver pid still alive, `HEAD` still the first checkout, `generation.txt` still `A` |
| Known positive: `origin/master`'s script, same harness | The second queue moved the tree under the live stub. Its log went `start=` then `head=<the other sha>` inside the same second, and the driver process was still alive. From this shell that stub's `CommandLine` was not null and it matched the driver regex. The pre-lock script moved the tree anyway. |

`-SelfTest` (no lock, no git, no driver) passed: a `drive.ps1` path, a forward-slash path, null, empty, and blank `CommandLine`, the queue script itself ignored, and this process excluded. `powershell -NoProfile -ExecutionPolicy Bypass -File docs\loops\qa-queue.ps1 -Queue 9997 -SelfTest`

## Copy step, after merge

The queue runs from the user-folder copy, because `-Checkout` moves the checkout. On each machine, after this is on master, write the file the way `qa-launch.md` already says, through `cmd /c`:

`git show <sha>:docs/loops/qa-queue.ps1` into `%USERPROFILE%\qa-queue.ps1`

Until that copy, the bytes on the machines are still the ones that moved the tree.

## Hidden launch

The first harness runs used `Win32_Process Create` without a startup object, so `cmd.exe` windows opened on this desktop (seven of them, from 23:39 local). That was wrong while Aaron is here.

Every Create in the harness now passes `Win32_ProcessStartup` with `ShowWindow` 0, and the powershell that `cmd` starts uses `-WindowStyle Hidden`. The harness refuses the run if that process or its child has a non-zero `MainWindowHandle`. A one-process probe (sleep 8s, then killed) reported `cmd.exe`, `conhost.exe`, and `powershell.exe` all with `MainWindowHandle` 0. The harness was then run again and the same three rows passed, including the known positive.

## Watch-out

Any `powershell.exe` whose `CommandLine` is null or blank is treated as maybe a driver (this process is excluded). That wait is logged (`wait=` ... `commandline_unreadable`). On `-Checkout` it blocks until `StartWaitMinutes` (default 480) and then refuses to move the tree. Before each driver it blocks until `QuietWaitMinutes` (default 120) and then skips that driver.

## Hidden launch line for qa-launch.md

`qa-launch.md` stays the planner's file. It is not edited on this branch.

The Create shape below was tested on this desktop: `ShowWindow` 0, `-WindowStyle Hidden`, full `powershell.exe` path. A sleep probe reported `cmd.exe`, `conhost.exe`, and `powershell.exe` all with `MainWindowHandle` 0. The harness uses that same Create and aborts if a handle is non-zero; the hidden re-run passed the rows above. The `\$` is for the Git bash `!` runner so `$si` reaches PowerShell.

Desktop line (this shape was tested; the real `C:\Users\melve\qa-queue.ps1` was not launched):

```
! powershell -NoProfile -Command "\$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}; Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Users\melve\qa-queue.ps1 -Queue <N,M> -Checkout <sha>'; CurrentDirectory='C:\Users\melve'; ProcessStartupInformation=\$si}"
```

Same startup for the other two machines, not executed here:

```
! ssh -i C:/Users/melve/.ssh/id_ed25519 aaron@100.110.244.10 "powershell -NoProfile -Command \"\$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}; Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine='powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Users\Aaron\qa-queue.ps1 -Queue <N,M> -Checkout <sha>'; ProcessStartupInformation=\$si}\""
```

```
! ssh -i C:/Users/melve/.ssh/id_ed25519 -l "Aaron Melven" 100.73.250.101 "powershell -NoProfile -Command \"\$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}; Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine='powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Users\AARONM~1\qa-queue.ps1 -Queue <N,M> -Checkout <sha>'; ProcessStartupInformation=\$si}\""
```

`/sync` on this checkout reports pre-existing issues (retired names in `ENTITIES.md`, a stale local build from `b371176`, greeting size). None of them are this diff. No `.gitnexus/` in this worktree. No `/end`. No `state.json` write.
