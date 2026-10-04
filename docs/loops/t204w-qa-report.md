# QA 271 report, attempt 2: #404 (T-204 machine lease), rows 14, 15 and 16, on WINDOWS

**By:** QA 271 (headless Claude Code, Opus 5.5), record session 160, DESKTOP-UGEKR74 (user melve), 2026-10-04 ~03:35Z to 03:56Z.
**Supersedes:** attempt 1, `qa/t204w-report` @ `f73f6b92` (INCOMPLETE: PowerShell refused by the headless permission
layer). That branch is left as it is. For this attempt Aaron allowed `powershell.exe` and the PowerShell tool for this
job only. PowerShell was started only by the PowerShell tool, never through node.
**Dispatch tree:** `qa271b-wt` at `db8ef4e6a131408b84c779b7dd1cbdf375906100` (`git -C C:/qa-scratch/qa271b-wt log -1 --format=%H`).
**Candidate:** #404 pinned `5add91379641ef211f98b2f79d1551c0090821eb`, worktree `C:/qa-scratch/qa271b-pr404`. `ls-remote`
read `refs/pull/404/head` = `5add9137` at the start and again at the end. origin/master = `dc8ae462` at the start and end.
Attempt 1 read master as `0bc93353`; this attempt took master's queue from `dc8ae462`.

## Verdict for #404: ACCEPT (pinned `5add9137`)

Rows 14, 15 and 16 are all met, on real processes, on Windows. This is the first QA run of the harness. Merge authority
stays with Aaron: the batch approval did not cover #404.

## Environment and safety

- Every harness and probe run was started from the PowerShell tool with `USERPROFILE` and `HOME` set to
  `C:\qa-tmp\qa271b-prof` (row 16: `C:\qa-tmp\qa271b-prof16`), and `TEMP`, `TMP` and `TMPDIR` set to
  `C:\qa-tmp\qa271b-temp`. The harness then moves `USERPROFILE` again, to `%TEMP%\t204-harness\Aaron Melven`.
- `C:\Users\melve\machine-lease` was **ABSENT** at the start (`test -e`) and at the end (`Test-Path` = False). It was
  never touched.
- The real queue was never run. At the end, 0 `powershell.exe` processes with `Start-Sleep -Seconds 900` were left
  running: the harness's `finally` killed its holders, and row 16's child was killed by the probe.
- No live Jev call. `gh` was not used. No issue or PR was touched. Nothing under `~/.claude` was read.

## Row 14: harness (MET)

**a) The candidate on its own** (`-Lease` and `-Queue` from `5add9137`, `-Rounds 20`): **exit 0,
`summary passed=24 failed=0`.** Every row reads `pass`: R0, R1, R1b, R2, R3, R4, R5, R6.malformed, R6.empty,
R6.missing_field, R7, R7b, R7c, R7d, new.R8, new.R8b, new.R8c, new.R9, new.R9b, new.R9c, new.R9d,
R10.parses.machine-lease.ps1, R10.parses.qa-queue.ps1 and R10b.queue_selftest.

**b) With master's queue as `-OldQueue`** (`git show origin/master:docs/loops/qa-queue.ps1`, master `dc8ae462`):
**exit 1, `summary passed=24 failed=7`.** The same 24 rows pass, and **all 7 old-queue rows are RED**:

| Row | Result (abridged) |
|---|---|
| old.R8.held_lease_queue_does_not_run | FAIL `ran=True`: the queue logged `run.9997=started` under a held lease |
| old.R8b.free_lease_queue_runs_and_releases | FAIL: no `complete.9997=True` (the old queue logs `done_marker.9997=True`) |
| old.R8c.missing_helper_refuses | FAIL: ran with no helper, no `helper missing` refusal |
| old.R9.complete_false_named | FAIL: `driver.9997=refusal=refusal`, no `complete.9997=False (refusal=refusal)` |
| old.R9b.no_bare_done_marker_true | FAIL: `done_marker.9997=True` bare |
| old.R9c.err_usage_limit_named | FAIL: no `refusal_err.9997=` line |
| old.R9d.no_complete_line_is_missing | FAIL: no `complete.9997=missing` |

Exit 1 in (b) is the expected result: the harness exits 1 on any failed row, and the old rows are meant to fail.

## Row 15: mutants (MET)

Each edit was confirmed with `git diff --no-index` against the candidate file before its run:

- `nonatomic`: `machine-lease.ps1` from `loop/t204-mut-nonatomic` @ `a486cf76`, 1 file +2/−1. It adds
  `if (-not (Test-Path $LeasePath)) { WriteAllText($LeasePath, ...); exit 0 }` before the atomic move.
- `nostart`: `machine-lease.ps1` from `loop/t204-mut-nostart` @ `1f1a6f63`, 1 file +1/−1. The `pid_reused` line is blanked.
- QA mutant `queue-skiplease`: the candidate's `qa-queue.ps1` with line 276 `Acquire-MachineLease` replaced by
  `# QA271-MUTANT: lease call skipped`. The diff is 1 file, +1/−1.

| Mutant | Exit | Summary | Rows lost |
|---|---|---|---|
| nonatomic (`-Rounds 30`) | 1 | passed=23 failed=1 | **R5 only**: `30 of 30 rounds had != 1 winner (round 0 had 6 winners)` |
| nostart | 1 | passed=23 failed=1 | **R3 only**: `code=10 busy=owner=fixture ... pid=22904`, so the reused pid was treated as live |
| queue-skiplease (QA) | 1 | passed=22 failed=2 | **new.R8** (`ran=True` under a held lease) and **new.R8c** (ran with no helper) |

On "run it 30 times": I ran the race 30 times as 30 R5 rounds (`-Rounds 30`) in one harness run, so that the same run
also shows the mutant losing no other row. It lost all 30 rounds. The candidate won 40 of 40 rounds (20 in each of
row 14's two runs). The `queue-skiplease` result matches attempt 1's prediction and the developer's `noleasecall`
claim. R8b still passes under that mutant, because with no lease taken there is none to release.

## Row 16: crash release (MET)

Probe: `C:/qa-scratch/qa271b-mut/row16.ps1`. A child `powershell.exe` takes the lease with `-OwnerPid $PID`, so its own
pid is the owner, and then sleeps. The probe checks that the lease is held, kills the child with `taskkill /T /F`,
and takes the lease as a new owner. What it printed (the `limit=` text is trimmed):

```
child.pid=24408
child.take: lease=taken owner=crashchild pid=24408
lease.json: {"owner_seat":"crashchild","session":"row16","pid":24408,"pid_start":"2026-10-04T03:54:47.6475793Z",...}
status.before_kill exit=10 :: ... lease=held owner=crashchild session=row16 pid=24408 ...
take.before_kill exit=10 :: busy=owner=crashchild session=row16 pid=24408 ...
child.alive_after_kill=False
status.after_kill exit=0 :: ... lease=free (stale: pid_gone) owner=crashchild session=row16 pid=24408 ...
take.after_kill exit=0 :: takeover=stale lease reason=pid_gone | lease=taken owner=next pid=12240
lease.json.after: {"owner_seat":"next","session":"row16b","pid":12240,"pid_start":"2026-10-04T03:54:47.3781761Z",...}
release exit=0 :: lease=released
```

The lease recorded the child's `pid_start`. While the child was alive, a second taker was refused with exit 10. Once
the child was killed, `status` reported `stale: pid_gone` and the next taker reclaimed the lease, which the probe then
released. The creation-time branch (`pid_reused`) is covered by R3, and `nostart` shows R3 depends on that branch.

## Gaps and observations

- **G2 (record, carried from attempt 1):** `t204-developer-handoff.md` says the three mutant branches are "not pushed",
  but all three are on origin (`a486cf76`, `1f1a6f63`, `88094f1f`). This is harmless.
- **O1 (cosmetic):** git's `LF will be replaced by CRLF` warning, from the harness's stub-tree `git add`, goes to
  stderr. In a `*>` capture it shows up as a `NativeCommandError` block. It did not affect any row or the exit code.
- **O2 (scope):** the harness's per-user limit holds by design and `status` names it. This run did not test a second
  Windows user.
- Attempt 1's G1 and G3 are closed by this run.

## Scratch footprint

Created only `C:/qa-scratch/qa271b-wt`, `C:/qa-scratch/qa271b-pr404` and `C:/qa-scratch/qa271b-mut` (the mutants,
the probe, and logs `row14.log`, `row14-clean.log`, `mut-*.log`, `row16.log`), plus `C:/qa-tmp/qa271b-prof`,
`qa271b-prof16` and `qa271b-temp`. Attempt 1's `qa271-*` folders were left untouched.

QA-271: REPORT COMPLETE
