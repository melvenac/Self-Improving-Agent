# Launching a QA queue: the commands Aaron runs

**Why this file exists.** Planner 109's handoff said the launch commands were "in this file's earlier sections". They
were not in any tracked file; they existed only in that session's chat. Planner 146 then invented a base64-encoded
launch that Aaron could not read. **The commands live here now.** The planner is refused the launch by the host
classifier, so Aaron runs it by typing these lines, with the leading `!`, into the planner's prompt.

## What is already on each machine

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
! ssh -i C:/Users/melve/.ssh/id_ed25519 aaron@100.110.244.10 "powershell -NoProfile -Command Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine='powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\Aaron\qa-queue.ps1 -Queue <N,M> -Checkout <sha>'}"
```

**QA PC, DESKTOP-O4EGB1E.** The user is `Aaron Melven`, with a space. `AARONM~1` is the space-free short path to the same
folder.

```
! ssh -i C:/Users/melve/.ssh/id_ed25519 -l "Aaron Melven" 100.73.250.101 "powershell -NoProfile -Command Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine='powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\AARONM~1\qa-queue.ps1 -Queue <N,M> -Checkout <sha>'}"
```

**This desktop: ONLY when Aaron is away from it AND no agent session is running on it** (Aaron, 2026-09-27: "this
desktop cant run qa while I'm here or other agents are running"). QA 149 was launched here at 01:39Z while both were
true, and stopped before its driver started. "Night" was the old shorthand, and it is not the rule. Before offering
this line, ask Aaron whether both conditions hold. The tree is `~/Worktrees/sia-qa`. Run it locally; no ssh is needed. It copies the queue
script out of the commit first, because the desktop had no copy as of 2026-09-27.

```
! cd ~/Worktrees/sia-qa && git fetch -q origin && git show <sha>:docs/loops/qa-queue.ps1 > ~/qa-queue.ps1
! powershell -NoProfile -Command "Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\melve\qa-queue.ps1 -Queue <N,M> -Checkout <sha>'; CurrentDirectory='C:\Users\melve'}"
```

**On this desktop, use the full `powershell.exe` path and `CurrentDirectory`.** The bare `powershell` form, which works
over ssh on the other two machines, returned `ReturnValue 9` (path not found) here, and nothing started (2026-09-27
01:36Z). The form above returned 0 and started QA 149. The cause is not confirmed: `powershell` is on the machine
PATH. Only the working form is recorded here.

**Success looks like** `ReturnValue : 0` plus a `ProcessId`. Then the planner reads
`%USERPROFILE%\sia-qa-queue\queue.log` over ssh, and it must show `start=queue=<N,M>` and `run.<N>=started`.

**The QA PC line's quoting** was checked on 2026-09-27 by a dry run through all three shells (Git Bash, the remote cmd,
PowerShell) with `Write-Output` in place of `Invoke-CimMethod`. The `CommandLine` arrived byte for byte.
