# Launching a QA queue: the commands Aaron runs

**Why this file exists.** Planner 109's handoff said the launch commands were "in this file's earlier sections". They
were not in any tracked file; they existed only in that session's chat. Planner 146 then invented a base64-encoded
launch that Aaron could not read. **The commands live here now.** The planner is refused the launch by the host
classifier, so Aaron runs it by typing these lines, with the leading `!`, into the planner's prompt.

## Who launches (D-069, 2026-09-30)

**The planner launches QA itself, over ssh.** Aaron, verbatim: "launch it yourself from now on, you can ask me but run
it over ssh from now on". The lines below are what the planner runs; Aaron no longer pastes them. The rules still
bind:
- the dispatch is on master first (D-062);
- launch only on an idle machine;
- one run at a time per machine;
- each launch is named in the record.

**If the host classifier denies a launch, the planner tells Aaron and does not route around it.**

Until 2026-10-03 QA runs headless on Opus (D-068), through `C:\Users\Aaron\headless-qa\launch-qa.ps1` on the laptop
(`-Worktree C:\Users\Aaron\Worktrees\sia-qa -AddDir C:\qa-scratch,C:\qa-tmp -NoFetch -Model opus`), fed a tracked
prompt copied out with `git show <sha>:<prompt> > C:\qa-tmp\<prompt>`.

## Which machine (standing, from 2026-09-30; D-065)

- **The laptop (DESKTOP-0GV3HAD) is the default QA machine.**
- **The QA PC (DESKTOP-O4EGB1E) is a developer machine first.** It runs developer seats (the pilot is Chisel,
  agent-dashboard's developer, under the same `Aaron Melven` profile). Use it for SIA QA **only when no developer
  suite is running there**, and ask the planner before any launch.
- **The desktop** runs planners and Clark, never QA while Aaron or agents are working (see below).
- **The machine lease (T-204) is built.** A developer's suite, `qa-queue.ps1` and the headless launcher each take one
  lease before a run (`machine-lease.ps1 take`), so neither starts over the other. The queue holds it for its whole
  run and REFUSES to start without the helper copy. **The QA PC takes QA whenever `machine-lease.ps1 status` says
  free.** The lease is per user; `status` prints that limit. Design and rows: `docs/loops/t204-plan.md`.

### Calling `machine-lease.ps1` (G-054, D-119)

Seats and launchers must invoke the **profile copy** with **`-File`**, never `powershell -Command "& ..."`**, when
the exit code matters (`take`, `release`, `renew`, `status`). `-Command` collapses script exit codes (for example
non-owner `release` is **12** under `-File` but reports **1** under `-Command`; see `docs/loops/g054-finding.md`).
Read **`$LASTEXITCODE` in the same PowerShell session** after each call.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\machine-lease.ps1" take -OwnerPid $owner -Seat <seat> -TtlMinutes 90
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\machine-lease.ps1" release -OwnerPid $owner
```

**`-OwnerPid` must be a live process** the helper can read. `take` with a dead or unreadable pid **refuses with exit 2** and does not create a lease.

- **Cursor (D-119, code #427 r2):** the nearest **ancestor** of the calling shell — start from the parent, never the calling shell itself — that is cursor-agent's own host process: `node.exe` running `cursor-agent`'s `versions/<ver>/index.js`. Shape: `docs/loops/t235-p2-3-r2-measure.md`.
- **Claude Code:** the `claude.exe` session's pid.

## What is already on each machine

- `machine-lease.ps1` and `qa-queue.ps1` sit in each QA machine's user folder (both are copied, the queue refuses without the first).
- `qa-queue.ps1` sits in each QA machine's user folder. It is 6,330 bytes and identical to
  `docs/loops/qa-queue.ps1`, which has been unchanged since `2667c6b`. Checked 2026-09-27.
  - **The queue runs from that copy, never from inside the QA checkout, because `-Checkout` moves the checkout.**
  - If `docs/loops/qa-queue.ps1` changes, re-copy it first:
    `git show <sha>:docs/loops/qa-queue.ps1 > %USERPROFILE%\qa-queue.ps1`, run through `cmd /c` on the machine.
- **Do NOT launch a second queue on a machine while a QA run is still going there.**
  - The script is DESIGNED to wait for a running driver before it moves the checkout. **On 2026-09-27 that wait did not
    hold.** The QA 144 queue, started at 01:12:12Z on the QA PC while QA 134's driver (pid 1748) was running, moved the
    checkout `2667c6b` → `46efa7e` two seconds later. That move changed 176 files, source included.
  - From an ssh shell, the same detector found pid 1748. **Why it failed inside the queue is not known.** The planner's
    probe of the queue's own launch context was refused by the auto-mode classifier as a remote shell write.
  - QA 134 was not disturbed: it works in its own worktrees under `C:\qa-scratch\qa134`.
  - **Until the cause is found, launch a queue only on an idle machine:** check the queue log's last line (`end=` or
    `exit.N=`) first.
- `Invoke-CimMethod Win32_Process Create` starts it detached, so it survives the ssh session closing.

## The lines

Replace `<N,M>` with the QA numbers in order, and `<sha>` with a commit that tracks every listed
`docs/loops/qa-N/drive.ps1`.

**Laptop, DESKTOP-0GV3HAD.** It is also the Windows CI runner, so no `windows=true` CI while it runs QA.

```
! ssh -i C:/Users/melve/.ssh/id_ed25519 aaron@100.110.244.10 "powershell -NoProfile -Command \"\$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}; Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine='powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Users\Aaron\qa-queue.ps1 -Queue <N,M> -Checkout <sha>'; ProcessStartupInformation=\$si}\""
```

**QA PC, DESKTOP-O4EGB1E.** The user is `Aaron Melven`, with a space. `AARONM~1` is the space-free short path to the same
folder.

```
! ssh -i C:/Users/melve/.ssh/id_ed25519 -l "Aaron Melven" 100.73.250.101 "powershell -NoProfile -Command \"\$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}; Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine='powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Users\AARONM~1\qa-queue.ps1 -Queue <N,M> -Checkout <sha>'; ProcessStartupInformation=\$si}\""
```

**This desktop: ONLY when Aaron is away from it AND no agent session is running on it** (Aaron, 2026-09-27: "this
desktop cant run qa while I'm here or other agents are running"). QA 149 was launched here at 01:39Z while both were
true, and stopped before its driver started. "Night" was the old shorthand, and it is not the rule. Before offering
this line, ask Aaron whether both conditions hold. The tree is `~/Worktrees/sia-qa`. Run it locally; no ssh is needed. It copies the queue
script out of the commit first, because the desktop had no copy as of 2026-09-27.

```
! cd ~/Worktrees/sia-qa && git fetch -q origin && git show <sha>:docs/loops/qa-queue.ps1 > ~/qa-queue.ps1
! powershell -NoProfile -Command "\$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}; Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Users\melve\qa-queue.ps1 -Queue <N,M> -Checkout <sha>'; CurrentDirectory='C:\Users\melve'; ProcessStartupInformation=\$si}"
```

**On this desktop, use the full `powershell.exe` path and `CurrentDirectory`.** The bare `powershell` form, which works
over ssh on the other two machines, returned `ReturnValue 9` (path not found) here, and nothing started (2026-09-27
01:36Z). The form above returned 0 and started QA 149. The cause is not confirmed: `powershell` is on the machine
PATH. Only the working form is recorded here.

**Success looks like** `ReturnValue : 0` plus a `ProcessId`. Then the planner reads
`%USERPROFILE%\sia-qa-queue\queue.log` over ssh, and it must show `start=queue=<N,M>` and `run.<N>=started`.

**All three lines launch HIDDEN** (`ShowWindow=0` plus `-WindowStyle Hidden`).
- Without it, a `Win32_Process Create` opens a visible console on the machine. On 2026-09-27 the queue-guard harness
  popped `cmd.exe` windows on Aaron's desktop while he worked.
- The forms come from `chore/qa-queue-guard` `1fc03d0`, tested hidden on this desktop.
- The planner dry-ran the QA PC form over ssh on 2026-09-27: `ShowWindow=0`, with the CommandLine intact.

**The QA PC line's quoting** was checked on 2026-09-27 by a dry run through all three shells (Git Bash, the remote cmd,
PowerShell) with `Write-Output` in place of `Invoke-CimMethod`. The `CommandLine` arrived byte for byte.
