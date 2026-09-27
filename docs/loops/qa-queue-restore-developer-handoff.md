# QA queue head restore — developer handoff (record 185)

**By:** Forge, `cursor-infra`, Composer 2.5. **Branch:** `loop/qa-queue-restore` from `origin/master` (`677c1dd`). **Desktop only:** stub harness under `%TEMP%\qa-queue-guard-harness`. No QA machine, no `%USERPROFILE%\Worktrees\sia-qa`.

## Product change (`docs/loops/qa-queue.ps1`)

1. **Launch `-Checkout`:** `git checkout -f -q --detach`, then read HEAD back against the resolved SHA. Abort the whole queue if checkout did not land.
2. **Per-driver restore (step 3):** same `-f` checkout when `HEAD` drifted; read HEAD back. On mismatch, log `restore_failed.<n>` with wanted/got SHAs and git's first error line, then **abort** (not skip): every remaining item needs the launch tree, so skipping would repeat the failure.
3. **`-f` is safe:** QA seats push report artifacts through `push-qa.mjs` before the report's last line; local untracked copies (the 177 incident) are disposable.

## Harness (`docs/loops/qa-queue-guard-harness.ps1`)

Extended with two-item restore scenarios (`-RestoreOnly`). Stub queue `9996,9997`: driver 9996 moves HEAD to commit B (driver 9997 untracked there) and leaves an untracked `qa-9997/drive.ps1` blocker. Locked case adds `.git/index.lock` so checkout cannot succeed.

## Evidence (desktop, hidden Create, 2026-09-27 local)

### Red — `origin/master` script (`/tmp/qa-queue-old.ps1`), 11:12Z

```
restore_new_untracked_block ... head=35fb3c5... shaA=10b9f184... item2_ran=False run9997=1 exit9997=... exit.9997=0
restore_new_untracked_block_expect item2_on_shaA=False
```

Item 2 launched on the wrong tree (HEAD at B, not launch A). No `restore_failed` line (old script never verified).

### Green — fixed script, 11:15–11:16Z

```
restore_new_untracked_block ... head=a0b3b9c7... shaA=a0b3b9c7... item2_ran=True run9997=1
restore_new_untracked_block_expect item2_on_shaA=True
restore_new_locked_generation ... restore_failed=1 run9997=0
restore_new_locked_generation_expect no_run_and_failed=True
```

Locked log excerpt: `restore_failed.9997=wanted=... got=... error=git : fatal: Unable to create '.../.git/index.lock'` then `abort=restore failed before 9997`.

### Mutant — `loop/qa-queue-restore-mutant` (read-back removed), 11:19–11:20Z

```
restore_new_locked_generation ... restore_failed=0 run9997=1
restore_new_locked_generation_expect no_run_and_failed=False
```

Assertion fails: driver started despite failed restore.

## Copy step after merge

Same as record 160: `git show <sha>:docs/loops/qa-queue.ps1` → `%USERPROFILE%\qa-queue.ps1` on each QA machine.
