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

## 4. Record 192 r4 (harness only, QA 202)

QA 202 rejected r3 evidence only: on Git 2.55 the bare fixture lacked `HEAD → refs/heads/seed`, so `git clone` warned and `ErrorActionPreference=Stop` aborted before attribution rows.

**Harness fix:** after seed push, `git --git-dir=$bare symbolic-ref HEAD refs/heads/seed`; `Run-FixtureGit` wraps fixture git calls with `Continue` so native stderr warnings are not fatal (exit code still checked).

Product unchanged (`d67c5e7`).

```text
# candidate -SkipAgent
ref_seat_new violations=refs/heads/loop/seat-new ...
PASS ref_attribution
exit=0

# -DriveRef 462403d -SkipAgent
ref_seat_new violations= elsewhere=...,refs/heads/loop/seat-new=...
FAIL ref attribution rows
exit=1
```

## 5. Record 192 r5 (QA 210)

QA 210 rejected `0f816bb` because the ordinary harness on the laptop exited 1 twice on `cmd /c "cd . && node …/push-qa.mjs qa/zz-probe-cd"` with `denial=False moved=False`. The plain `node` route on that host moved. This is the launch route, not the laptop's credentials, PATH, or cwd, and not the `cli.json` pattern.

`cursor-agent.ps1` forwards `$args` to `node.exe`. PowerShell 5.1 drops embedded double quotes on that hop, so the agent receives `cmd /c cd . && node …`. Its shell then splits on `&&`. On this desktop a saved run (`qa-driver-cursor-r2-16096`, 2026-09-28T21:14Z) shows the drive script still held the quotes, the user message did not, the first shell call failed ("PowerShell parsing `&&`"), and the model re-quoted and the ref moved. The laptop model did not repair it, so the ref never moved and nothing was a permission denial. Local argv proof: `& node script.js -p $prompt` yields `["-p","cmd /c cd",".","&&","echo","hi"]`.

**Fix (harness only):** `qa-driver-cursor-r2-launch.ps1` starts that node with `ProcessStartInfo` argument quoting. The 9994 row fails if the user event does not contain the quoted command (`prompt_quotes_stripped`), so a model retry cannot hide the strip. Product template unchanged.

Ordinary harness, this desktop, no flags, exit 0:

```text
push_pass node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-plain denial=False moved=True
push_pass cmd /c "cd . && node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-cd" denial=False moved=True
prompt_quotes_kept=True
push_pass powershell -NoProfile -Command "node … push-qa.mjs qa/zz-probe-ps" denial=False moved=True
push_deny git push … denial=True moved=False blocked=True
push_deny powershell … git push … denial=True moved=False blocked=True
push_deny powershell … "& git push …" denial=True moved=False blocked=True
PASS ref_attribution
PASS push_routes
exit=0
```

The shell stdout for that `cmd /c` row included `push-qa: pushed and read back: qa/zz-probe-cd`.

## 6. Record 192 r6 (QA 218)

QA 218 rejected `bbfb724`. The harness route kept quotes. The product `docs/loops/qa-driver-template-cursor/drive.ps1` still launched `cursor-agent.ps1` with `& $ps @agentArgs` and `-File $agent -p $prompt`. `Prompt-WithStops` appends `stops.txt`, whose quoted span is `"Open for the planner"`. On the laptop the first user event had lost those quotes.

`Invoke-Agent` now starts cursor-agent's node with the same `ProcessStartInfo` quoting as r5, including `--resume` when a session id is present. Completion, the resume cap of 3, refusal and denial handling, and the `drive.meta` keys are unchanged.

Rows, this desktop `DESKTOP-UGEKR74` only. None of these were run on the laptop.

(a) `docs/loops/qa-driver-cursor-r6-quote.ps1` runs the template with `-MaxContinuations 0` and requires the first user event to contain that quoted span.

Red, `-Rev bbfb724` (the r5 template), exit 1:

```text
quoted_span="Open for the planner"
drive_exit=0
FAIL template_quotes_stripped
user_has_quotes=False
```

Green, the template in this tree, exit 0:

```text
quoted_span="Open for the planner"
drive=...\docs\loops\qa-driver-template-cursor\drive.ps1
drive_exit=0
template_quotes_kept=True
```

(b) `loop/qa-driver-cursor-r6-mutant-splat` `69e5231bb67990e24371326f9dc9cd904a52e280` restores `& $ps @agentArgs`. Same script, this desktop, exit 1:

```text
drive=...\qa-driver-template-cursor\drive.ps1
drive_exit=0
FAIL template_quotes_stripped
user_has_quotes=False
```

(c) `node docs/loops/qa-driver-copy.mjs --harness cursor --model composer-2.5-fast 9991 ...` exit 0. The copy contains `ProcessStartInfo`, `composer-2.5-fast`, `qa-9991`, and `--resume`, and does not contain `& $ps @agentArgs`. PowerShell parsed it (`PARSE_OK`). The throwaway `docs/loops/qa-9991/` was deleted and is not in the commit.

## 7. After merge

Template via `qa-driver-copy.mjs` only. `qa-queue.ps1` unchanged.
