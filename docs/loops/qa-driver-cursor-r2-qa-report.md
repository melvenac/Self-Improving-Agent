# Cursor QA driver r2 — QA report (record 195 scoring record 192)

## Verdict: REJECT

Candidate `462403d` fixes the reported other-seat case and the sanctioned route exercised by its harness, but its start-of-run SHA rule has a dangerous false-negative: a QA seat can create a new commit during the run and move a non-`qa/` ref to it; because that SHA was not in `git rev-list --all` at run start, the candidate reports `ref_moved_elsewhere` instead of `ref_violations`. That violates records 192.4 and blocks acceptance.

No CI was requested or run; this is the local PowerShell/Cursor-driver round.

## 1. Push routes

The ordinary candidate harness against the real template `cli.json` and real `cursor-agent` exited 0:

```text
push_pass node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-plain denial=False moved=True
push_pass powershell -NoProfile -Command "node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-ps" denial=False moved=True
push_deny git push origin HEAD:refs/heads/qa/zz-deny-git denial=True moved=False
push_deny powershell -NoProfile -Command git push origin HEAD:refs/heads/qa/zz-deny-ps denial=True moved=False
PASS push_routes
EXIT=0
```

The supplied harness creates `qa/zz-probe-cd` but never puts a `cd . && node .../push-qa.mjs` row in `$passForms`, so its claimed `cd … &&` coverage is not real. I attempted a QA-only real-agent extension for that row plus `git -C . push`, `git.exe push`, and PowerShell `& git push`; the outer QA permissions fence denied the command before that extension started. Per the dispatch, I stopped that line of work. Static review says `git -C . push` is intended to be caught by `Shell(git:*push*)`, and `git.exe push` by `Shell(git.exe:*push*)`; the call-operator form depends on Cursor's executable parsing and remains unproved here. A parser miss would matter because it would permit an unsanctioned raw push.

The narrowing itself is correctly targeted: only wrapper patterns changed from `*push*` to `*git push*`; the direct `git`, `git.exe`, `cmd`, and exact push denies remain.

## 2. Denial source

Confirmed. The product's `Read-Run` parses each stream-json line with `ConvertFrom-Json`, recursively reads the resulting event, and records `permissionDenied` / `Command blocked by permissions configuration`; it does not reproduce the permission glob matcher. The developer harness likewise launches real `cursor-agent` and reads `run-0.jsonl` rather than deciding a match itself.

I ran the direct row. Its stream-json contains a real tool result:

```text
"permissionDenied":{"command":"git push origin HEAD:refs/heads/qa/zz-deny-git",...,"error":"Command blocked by permissions configuration"}
```

The local bare ref did not move.

## 3. Attribution

Candidate `462403d` ordinary harness, no mutant flag:

```text
ref_other_seat violations= elsewhere=refs/heads/loop/other-seat=5aae5c8ed78b182e19937e95189e4f3debc00d71
ref_seat_outside_qa violations=refs/heads/loop/local-violation elsewhere=refs/heads/loop/other-seat=5aae5c8ed78b182e19937e95189e4f3debc00d71
PASS ref_attribution
EXIT=0
```

Developer mutant `e385f0d`, ordinary harness with `-DriveRef e385f0d -SkipAgent` and no expectation-flipping flag:

```text
ref_other_seat violations=refs/heads/loop/other-seat elsewhere=
ref_seat_outside_qa violations=refs/heads/loop/local-violation,refs/heads/loop/other-seat elsewhere=
FAIL ref attribution rows
EXIT=1
```

Baseline `bf33fe4`, ordinary harness with `-DriveRef bf33fe4 -SkipAgent`:

```text
ref_other_seat violations=refs/heads/loop/other-seat elsewhere=
ref_seat_outside_qa violations=refs/heads/loop/local-violation,refs/heads/loop/other-seat elsewhere=
FAIL ref attribution rows
EXIT=1
```

Thus the two required ordinary red controls are genuine nonzero failures, and the candidate handles the developer's two fixed-SHA rows.

## 4. Stated limit and dangerous direction

The implementation snapshots `git rev-list --all` before the agent runs. A mid-run fetch cannot alter that fixed array, so a newly fetched foreign SHA remains unknown and is classified `ref_moved_elsewhere`; the handoff's stated fetch limit is therefore not the demonstrated dangerous path.

There is, however, a direct real-seat path to the dangerous result. The QA seat normally creates report and mutant commits after the snapshot. If it uses an unsanctioned route to move a non-`qa/` ref to one of those new commits, the remote tip is absent from `KnownShasAtStart`. Exercising the candidate's actual `Audit-NonQaRefs` function with that state produced:

```text
seat_new violations= elsewhere=refs/heads/loop/seat-new=bbbbbbbb
```

That is a seat violation reported as `ref_moved_elsewhere`. The implemented test uses the seed SHA for the seat row, so it cannot catch this false-negative.

## 5. Preserve

- `git diff --exit-code 997f2c7..462403d` for template `drive.ps1` and `cli.json` was clean, confirming the product is unchanged after `997f2c7`.
- Relative to `bf33fe4`, completion detection, at-most-three resumes, refusal/denial stop handling, fence handling, and existing `drive.meta` keys are unchanged. The added keys are `known_commits_at_start`, `ref_audit_limit`, and `ref_moved_elsewhere`; `refs_changed` and `ref_violations` remain.
- `qa-driver-copy.mjs --harness cursor` generated all four files from the candidate template. The generated PowerShell parsed without errors, `cli.json` parsed, and replacements for report, marker, model, output directory, and branch prefix were present.
- Read-only `/sync --check` before mutant commits reported the same pre-existing two issues (`retirements`, `greeting-size`), three warnings, and two skips; no candidate-specific sync issue was identified.

## 6. QA mutants

Both mutants were committed and published only through `docs/loops/qa-195/push-qa.mjs`.

### `qa/qa-driver-r2-mut-deny-gap` — `72523b2`

Re-broadens `Shell(powershell:*git push*)` to `Shell(powershell:*push*)`. Real-agent harness result:

```text
push_pass powershell -NoProfile -Command "node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-ps" denial=True moved=False
FAIL push route should pass: powershell -NoProfile -Command "node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-ps"
EXIT=1
```

### `qa/qa-driver-r2-mut-direct-gap` — `209cf0e`

Drops the four direct `git` denial entries while leaving `git.exe` and wrapper entries. Real-agent harness result:

```text
push_deny git push origin HEAD:refs/heads/qa/zz-deny-git denial=False moved=True
push_deny_git_ran=True blocked=False
FAIL git push should stay denied: git push origin HEAD:refs/heads/qa/zz-deny-git
EXIT=1
```

## Defects

1. **Blocking — dangerous attribution false-negative.** `KnownShasAtStart` cannot distinguish another seat's unknown commit from this seat's own new commit. A non-`qa/` ref moved by the QA seat to a post-start commit is mislabeled `ref_moved_elsewhere`. The audit needs provenance that includes commits created locally during the run without letting a mid-run fetch turn foreign commits into seat-owned commits.
2. **Evidence gap — the `cd … &&` acceptance row is absent.** The developer harness creates its branch but never runs the form, and the call-operator/raw-push alternatives are not covered.

## Model

QA model: GPT-5.6 Sol (`gpt-5.6-sol-medium`). Candidate builder: Composer 2.5.

QA-195: REPORT COMPLETE
