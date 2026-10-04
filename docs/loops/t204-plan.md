# T-204 plan: the machine lease (Forge, session 1 of this worktree; approved by Atlas, planner 150)

Approved 2026-09-30 with three rulings: per-user lease location is fine but `status` must print the limit; the
launcher REFUSES (does not wait) when the lease is held; the branch is `loop/t204-machine-lease`. This file exists
because A2A carries no memory.

## Design

1. **One helper**, `docs/loops/machine-lease.ps1`: `take | release | renew | status`. Machine-agnostic, no host names.
   Copied to `%USERPROFILE%\machine-lease.ps1` the way `qa-queue.ps1` is; never run from inside a checkout.
2. **Lease file** `%USERPROFILE%\machine-lease\lease.json`: `owner_seat, session, pid, pid_start, started, expires`.
   Per user: SIA QA and the developer seats share one profile on each machine (`Aaron Melven` on the QA PC, `Aaron`
   on the laptop). **The limit** (two Windows users on one machine would not see each other's lease) is printed by
   `status`.
3. **Atomic take**: write the whole JSON to a temp file in the same folder, then `File.Move` it onto `lease.json`
   without overwrite. Exactly one taker wins; a reader never sees a half-written file.
4. **Owner pid** is a long-lived process passed with `-OwnerPid` (the helper's own pid is never recorded, it exits at
   once). The queue passes its own `$PID`; a developer their session or shell pid; a detached launcher the pid of the
   job it created.
5. **Stale** = expired, OR pid gone, OR pid exists with a different creation time (PID reuse). An uninspectable pid
   counts as live. Reclaiming a stale lease is serialised by a named mutex and re-verified under it.
6. **Fail closed**: unreadable, empty, malformed or field-missing is HELD (exit 11, cause named), never ignored or
   deleted.
7. Exit codes: 0 ok, 10 held by a live owner, 11 held but unreadable/malformed, 12 release/renew by a non-owner, 2 usage.
8. **Caller (G-054):** every seat, launcher and wrapper must run the profile copy with
   `powershell -NoProfile -ExecutionPolicy Bypass -File %USERPROFILE%\machine-lease.ps1 ...`, not
   `powershell -Command "& ..."`. `-Command` does not preserve script exit codes (non-owner `release` is 12 under
   `-File` but 1 under `-Command`). Read `$LASTEXITCODE` in the same session. `take` with a dead `-OwnerPid` exits **2**
   (usage: not a running process).

## qa-queue.ps1

- After `Acquire-QueueLock`, before the `-Checkout` wait: take the lease through the machine copy
  (`-Seat qa-queue`, TTL = `TimeoutMinutes x items + 30`, wait `-LeaseWaitMinutes`, default 120). Held past the wait:
  log `abort=QA PC busy: ...` and exit 1; it never runs anyway. Helper copy missing: refuse. Released in `finally`.
- After each run: log `complete.N=True|False (<reason>)|missing (<why>)` from `drive.meta`'s `complete=` line
  (reason from `refusal=`, `denial=`, `stopped=`, `incomplete_after_*`); `done_marker.N` now carries the verdict and
  never stands alone; a usage-limit or refusal line in `run-*.err` is logged as `refusal_err.N` (QA 231's lesson).
- Not done, deliberately: the plan's item 10 (lease classification in the queue's `-SelfTest`). The classification
  lives in the helper, and the harness exercises it with real processes instead.

## Rows (all in `docs/loops/machine-lease-harness.ps1`)

R0 take on a free machine. R1 held live lease refused, owner named; R1b `status` names owner and the per-user limit.
R2 pid gone reclaimed. R3 reused pid reclaimed. R4 expired lease with a live pid reclaimed. R5 six real processes on a
start barrier, exactly one winner, N rounds. R6 malformed / empty / missing-field blocks with a named cause and the file
untouched. R7 release by a non-owner refused; R7b by the owner works. R8 held lease: the queue logs `QA PC busy`, names
the owner, starts no driver; R8b free lease: it runs, holds, and releases; R8c helper copy missing: it refuses. R9 a
`complete=False` meta logs `complete.N=False (refusal=refusal)`; R9b no bare `done_marker.N=True`; R9c a usage-limit
line in `run-1.err` is named; R9d no `complete=` line logs `missing`. R10 both scripts parse; the queue's own
`-SelfTest` still passes. Queue rows also run against the pre-T-204 queue and must be RED there.

Mutants (own branches `loop/t204-mut-*`, never in the candidate's history): non-atomic take (check-then-write) loses
R5; ignoring the pid creation time loses R3; dropping the lease call from the queue loses R8.

## launch-qa.ps1 (Clark's file, on the laptop; not changed by T-204)

The launcher exits at once, so it cannot own a lease, and it must refuse BEFORE it creates the job while the job's pid
does not exist yet. So it is TWO calls and **no release**:

1. Before creating the process, as itself (exit 10 or 11 means refuse: print the owner lines and exit nonzero):

       powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\machine-lease.ps1" take -OwnerPid $PID -Seat qa-headless -Session <log name> -TtlMinutes <job ceiling>

2. Right after `Win32_Process Create` returns the claude pid, hand the lease over, then print the pid and exit:

       powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\machine-lease.ps1" renew -OwnerPid $PID -NewOwnerPid <claude pid> -TtlMinutes <job ceiling>

(`renew` gained `-NewOwnerPid` for this.) Between the two calls the launcher's own pid holds the lease, so there is no
window with nothing holding it. The lease is reclaimed by the pid-gone rule when claude exits, including a crash, so
no wrapper and no release exist to be skipped. Rows R7c and R7d exercise the handover and the reclaim.

## What Aaron does after merge

Per machine (laptop, QA PC, and the desktop if it ever runs QA), through `cmd /c`:
`git show <merge-sha>:docs/loops/qa-queue.ps1 > %USERPROFILE%\qa-queue.ps1` and
`git show <merge-sha>:docs/loops/machine-lease.ps1 > %USERPROFILE%\machine-lease.ps1`. Forgetting the second copy is a
loud queue refusal, not a silent skip.
