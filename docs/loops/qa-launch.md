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

**Success looks like** `ReturnValue : 0` plus a `ProcessId`. Then the planner reads
`%USERPROFILE%\sia-qa-queue\queue.log` over ssh, and it must show `start=queue=<N,M>` and `run.<N>=started`.

**The QA PC line's quoting** was checked on 2026-09-27 by a dry run through all three shells (Git Bash, the remote cmd,
PowerShell) with `Write-Output` in place of `Invoke-CimMethod`. The `CommandLine` arrived byte for byte.
