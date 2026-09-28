# Cursor QA driver r2 — developer handoff (record 192)

**By:** Forge, `cursor-infra`, Composer 2.5. **Branch:** `loop/qa-driver-cursor-r2` from `origin/master` (`bf33fe4`). **Desktop only:** harness `docs/loops/qa-driver-cursor-r2-harness.ps1`, hidden `Win32_Process.Create`, local bare origin under `C:\qa-tmp\qa-driver-cursor-r2-<pid>`. No QA machine, no `%USERPROFILE%\Worktrees\sia-qa`.

## 1. Push-route refusal (QA 178)

**Cause:** record-175 wrapper denies `Shell(powershell*:*push*)` (and siblings for `powershell`, `bash`, `cmd`) match the **argument glob** against the full shell command text. The seat ran `powershell … node docs/loops/qa-178/push-qa.mjs …`. The path segment `push-qa.mjs` contains `push`, so `*push*` matched even though the command is not `git push`.

**Fix (`docs/loops/qa-driver-template-cursor/cli.json`):** narrow those four wrapper patterns from `*push*` to `*git push*`. Direct `Shell(git push)`, `Shell(git:*push*)`, and `Shell(cmd:*git*push*)` denies are unchanged.

### What decides denial=True/False

**Real cursor-agent**, not a harness glob re-implementation. `Invoke-PushProbe` copies the test `cli.json` into the stub tree's `.cursor/cli.json`, then runs headless:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File cursor-agent.ps1 -p <prompt> --model composer-2.5 --output-format stream-json --trust --force --workspace <stub tree>`

The harness reads `run-0.jsonl` for `permissionDenied` and checks the bare remote for ref movement. Example from `push_red` (old `qa-178/cli.json`, session `b64479fb-32a2-4234-ac64-2c8444f2a619`):

```
"permissionDenied":{"command":"powershell -NoProfile -Command node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-red","error":"Command blocked by permissions configuration"}
```

Ref-attribution rows do **not** use cursor-agent; they load `Read-Refs` / `Compare-Refs` / `Audit-NonQaRefs` from the product `drive.ps1` at the requested git ref (`-DriveRef`).

## 2. Ref-audit attribution

**Rule:** at run start the driver records `known_commits_at_start` (`git rev-list --all`). After the run, any non-`qa/` ref that moved on origin is `ref_violations` when the remote tip SHA was already in that set, else `ref_moved_elsewhere`. `drive.meta` logs `ref_audit_limit`.

**Limit:** SHAs known at run start only; mid-run `git fetch` of foreign objects is out of scope. QA protocol forbids planner pushes during an in-flight run.

## 3. Evidence (desktop, hidden, 2026-09-28 ~00:10Z)

Harness loads product `drive.ps1` via `-DriveRef` (or workspace copy when omitted).

### Red — pre-fix attribution (`-DriveRef bf33fe4 -SkipAgent`)

```
ref_other_seat violations=refs/heads/loop/other-seat elsewhere=
FAIL ref attribution rows
exit=1
```

### Mutant — `e385f0d` product, ordinary harness (`-DriveRef e385f0d -SkipAgent`, no flags)

```
ref_other_seat violations=refs/heads/loop/other-seat elsewhere=
FAIL ref attribution rows
exit=1
```

### Green — candidate `drive.ps1` (`-SkipAgent`)

```
ref_other_seat violations= elsewhere=refs/heads/loop/other-seat=<sha>
ref_seat_outside_qa violations=refs/heads/loop/local-violation elsewhere=refs/heads/loop/other-seat=<sha>
PASS ref_attribution
exit=0
```

### Push routes — real cursor-agent (`-OldCliJson docs/loops/qa-178/cli.json`)

```
push_red_old_cli powershell … push-qa.mjs … denial=True moved=False
push_pass node …/push-qa.mjs … denial=False moved=True
push_pass powershell … push-qa.mjs … denial=False moved=True
push_deny git push … denial=True blocked=True
push_deny powershell … git push … denial=True blocked=True
PASS push_routes
exit=0
```

## 4. After merge

Template only via `qa-driver-copy.mjs`. `qa-queue.ps1` unchanged. No writes to QA machines.
