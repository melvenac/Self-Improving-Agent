# Cursor QA driver r2 — developer handoff (record 192)

**By:** Forge, `cursor-infra`, Composer 2.5. **Branch:** `loop/qa-driver-cursor-r2` from `origin/master` (`bf33fe4`). **Desktop only:** harness `docs/loops/qa-driver-cursor-r2-harness.ps1` under `C:\qa-tmp\qa-driver-cursor-r2`, hidden `Win32_Process.Create`, local bare origin. No QA machine, no `%USERPROFILE%\Worktrees\sia-qa`.

## 1. Push-route refusal (QA 178)

**Cause:** record-175 wrapper denies `Shell(powershell*:*push*)` (and siblings for `powershell`, `bash`, `cmd`) match the **argument glob** against the full shell command text. The seat ran `powershell … node docs/loops/qa-178/push-qa.mjs …`. The path segment `push-qa.mjs` contains `push`, so `*push*` matched even though the command is not `git push`.

**Fix (`docs/loops/qa-driver-template-cursor/cli.json`):** narrow those four wrapper patterns from `*push*` to `*git push*` (space before `push`, so `push-qa` no longer matches). Direct `Shell(git push)`, `Shell(git:*push*)`, and `Shell(cmd:*git*push*)` denies are unchanged.

**Limit:** a seat that runs `powershell -c "node -e \"execSync('git push …')\""` is still caught by the post-run ref audit if the push succeeds; the deny list does not add `Shell(node:*)` (that would block the sanctioned `node …/push-qa.mjs` route).

## 2. Ref-audit attribution

**Rule:** at run start the driver records `known_commits_at_start` (`git rev-list --all`). After the run, any non-`qa/` ref that moved on origin is:

- `ref_violations` when the remote tip SHA was already in that set (this seat could have produced it), or
- `ref_moved_elsewhere` when the SHA was not (another seat pushed a commit this tree never had).

`drive.meta` logs `ref_audit_limit` with that sentence. `ref_violations` and `ref_moved_elsewhere` are separate keys.

**Limit:** attribution uses SHAs known at **run start**, not a post-run fetch of objects the seat never fetched; a seat that `git fetch`es mid-run and then pushes a foreign commit could still look like a violation. The QA protocol forbids planner pushes during an in-flight run.

## 3. Evidence (desktop, hidden, 2026-09-27 ~23:58Z)

Harness: `powershell -File docs/loops/qa-driver-cursor-r2-harness.ps1` with `-OldCliJson docs/loops/qa-178/cli.json`.

### Red — old `cli.json` (QA 178 copy), powershell wrapper on sanctioned route

```
push_red_old_cli powershell -NoProfile -Command "node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-red" denial=True moved=False
```

### Green — fixed `cli.json`

```
ref_other_seat violations= elsewhere=refs/heads/loop/other-seat=<sha>
ref_seat_outside_qa violations=refs/heads/loop/local-violation elsewhere=refs/heads/loop/other-seat=<sha>
push_pass node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-plain denial=False moved=True
push_pass powershell -NoProfile -Command "node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-ps" denial=False moved=True
push_deny git push origin HEAD:refs/heads/qa/zz-deny-git denial=True moved=False blocked=True
push_deny powershell -NoProfile -Command git push origin HEAD:refs/heads/qa/zz-deny-ps denial=True moved=False blocked=True
PASS ref_attribution
PASS push_routes
```

### Mutant — `loop/qa-driver-cursor-r2-mutant` (attribution removed; all non-qa moves → `ref_violations`)

Harness `-SkipAgent -MutantRef`:

```
ref_other_seat_mutant violations=refs/heads/loop/other-seat
PASS ref_attribution_mutant
```

(Old product would falsely blame the seat for the other-seat ref.)

## 4. After merge

- Template only: `qa-driver-copy.mjs` copies `docs/loops/qa-driver-template-cursor/` on the next Cursor QA generation. Existing per-QA `cli.json` copies (e.g. `qa-178/`) are not rewritten by this branch; the next copier run picks up the fix.
- `qa-queue.ps1` unchanged.
- No writes to QA machines.
