# Cursor QA driver r2 — developer handoff (record 192 r3)

**By:** Forge, `cursor-infra`, Composer 2.5. **Branch:** `loop/qa-driver-cursor-r2` from `origin/master` (`bf33fe4`). **Desktop only:** `docs/loops/qa-driver-cursor-r2-harness.ps1`, hidden `Win32_Process.Create`, local bare origin under `C:\qa-tmp\qa-driver-cursor-r2-<pid>`. No QA machine.

## 1. QA 195 rejection (r2) and r3 fix

QA 195 (`462403d`) rejected: a commit created mid-run and pushed to a non-`qa/` ref was classified `ref_moved_elsewhere` because its SHA was absent from `KnownShasAtStart`.

**Fix (`drive.ps1`):** snapshot `head_at_start` and local `refs/heads/*` tips at run start. At audit, `Get-SeatCreatedShas` collects commits on `HEAD..` and on any local branch tip advance (or new local branch since start). `Audit-NonQaRefs` treats `knownAtStart ∪ seatCreated` as seat-owned → `ref_violations`; unknown SHAs → `ref_moved_elsewhere`. Logs `seat_created_shas` and `ref_audit_limit` (mid-run `git fetch` of a foreign object can still look seat-owned if present locally).

## 2. Push routes (real cursor-agent)

`denial=True/False` comes from stream-json `permissionDenied` after headless `cursor-agent.ps1` with the test `cli.json` copied into `.cursor/cli.json`. Not a harness glob re-implementation.

`cd … &&` on this desktop runs through `cmd /c "cd . && node …/push-qa.mjs …"` (PowerShell 5.1 rejects bare `&&`).

## 3. Evidence (desktop, 2026-09-28 ~05:10Z)

Ordinary harness (no flags), product `drive.ps1` from workspace:

```text
ref_other_seat violations= elsewhere=refs/heads/loop/other-seat=<sha>
ref_seat_new violations=refs/heads/loop/seat-new elsewhere=refs/heads/loop/other-seat=<sha> seat_created=<new-sha>
push_pass node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-plain denial=False moved=True
push_pass cmd /c "cd . && node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-cd" denial=False moved=True
push_pass powershell -NoProfile -Command "node … push-qa.mjs qa/zz-probe-ps" denial=False moved=True
push_deny git push … denial=True blocked=True
push_deny powershell … git push … denial=True blocked=True
push_deny powershell … "& git push …" denial=True blocked=True push_deny_git_ran=True
PASS ref_attribution
PASS push_routes
exit=0
```

**Mutant (start-of-run-only rule):** ordinary harness `-DriveRef 462403d -SkipAgent`:

```text
ref_seat_new violations= elsewhere=refs/heads/loop/other-seat=…,refs/heads/loop/seat-new=<new-sha>
FAIL ref attribution rows
exit=1
```

## 4. After merge

Template via `qa-driver-copy.mjs` only. `qa-queue.ps1` unchanged.
