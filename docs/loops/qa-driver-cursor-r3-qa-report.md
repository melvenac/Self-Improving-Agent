# Cursor QA driver r3 — QA report (record 202 scoring record 192 r3)

## Verdict: REJECT

Product `d67c5e7044df129d61deba68c489f9f89cdb87fc` fixes QA 195's attribution defect. Direct, amended, cherry-picked, and same-repository-other-worktree commits created after the snapshot all read `ref_violations`; a different clone's mid-run push still reads `ref_moved_elsewhere`. All required allowed and denied push forms behaved correctly through real `cursor-agent`.

The shipped ordinary harness does not reach its attribution assertions on this QA machine. Its bare fixture pushes `seed` without making `HEAD` name `refs/heads/seed`; Git 2.55 prints `warning: remote HEAD refers to nonexistent ref, unable to checkout` at the later clone, and `$ErrorActionPreference = 'Stop'` promotes that stderr to a terminating `NativeCommandError`. Therefore item 4 is unmet as written: the ordinary harness against `462403d` exits 1 before, not on, the seat-new row. One fixture-only `symbolic-ref HEAD refs/heads/seed` line makes the harness reach and kill that row, but that line is not in the candidate.

No CI was requested or run. This is local Windows PowerShell evidence only; no `windows=true`.

## 1. Frozen candidate and environment

- Product: `d67c5e7044df129d61deba68c489f9f89cdb87fc`; handoff tip `13e183cb1d560d4e2aab705536a4375c9fdfeae4`. Their only delta is the handoff file.
- Branch: `origin/loop/qa-driver-cursor-r2`; PR #194.
- Host: `DESKTOP-O4EGB1E`, Windows 10 19045, Windows PowerShell 5.1, Git 2.55.0.windows.5, Node v24.5.0. Node v22 remains the repository's tested version.
- QA model: GPT-5.6 Sol (`gpt-5.6-sol-medium`). Builder: Composer 2.5.
- The candidate harness hard-codes the developer path `C:\Users\melve\Worktrees\sia-infra`. The executed scratch copy changed only that path to the frozen candidate worktree. The first run otherwise retained candidate bytes and exposed the bare-HEAD abort.

## 2. Attribution

The ordinary candidate row, after the fixture-only HEAD adaptation:

```text
ref_other_seat violations= elsewhere=refs/heads/loop/other-seat=<sha>
ref_seat_new violations=refs/heads/loop/seat-new elsewhere=refs/heads/loop/other-seat=<sha> seat_created=<seat-sha>
PASS ref_attribution
```

Independent probes against the candidate's actual `Get-SeatCreatedShas` and `Audit-NonQaRefs`:

| Shape | `created` contains tip | Result |
|---|---:|---|
| amend a post-start commit | yes | `ref_violations` |
| cherry-pick a post-start foreign commit | yes | `ref_violations` |
| commit in another worktree of the same repository | yes | `ref_violations` |
| commit and push from a separate clone | no | `ref_moved_elsewhere` only |

The concrete tips were `a44163d…`, `26cd739…`, `7e0769a…`, and `e0343a0…`. The final independent probe exited 0.

The same fixture-adapted harness against start-of-run rule `462403d` reached the intended red:

```text
ref_seat_new violations= elsewhere=refs/heads/loop/other-seat=<sha>,refs/heads/loop/seat-new=<sha> seat_created=
FAIL ref attribution rows
EXIT=1
```

## 3. Push forms through real cursor-agent

The fixture-adapted ordinary candidate harness exited 0 in 141,997 ms:

```text
push_pass node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-plain moved=True
push_pass cmd /c "cd . && node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-cd" moved=True
push_pass powershell -NoProfile -Command "node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-ps" moved=True
push_deny git push ... denial=True moved=False
push_deny powershell ... git push ... denial=True moved=False
push_deny powershell ... "& git push ..." denial=True moved=False
PASS push_routes
```

The call-operator stream contains a real parsed shell call with executable commands `powershell` and `git`, followed by:

```text
permissionDenied: Command blocked by permissions configuration
```

No denied ref moved. All three sanctioned refs moved and were read back by `push-qa.mjs`.

### Harness denial-reporting observation

The plain allowed row printed `denial=True moved=True`, although its stream contains no permission denial and the push completed. The stub ignored “no other shell command,” read the generated `drive.ps1`, and that file contains the harness's own `permissionDenied` search literal. The raw `Select-String` then matched quoted file content in stream-json. This does not change the push verdict, which is proved by the remote ref, but `denial=True` is not reliable evidence that a denial event occurred.

## 4. Shipped-harness failure

Both candidate and `462403d` runs with the shipped fixture stop here:

```text
git : warning: remote HEAD refers to nonexistent ref, unable to checkout
At ...candidate-harness.ps1:116 char:1
+ git clone -q $bare $otherDir
FullyQualifiedErrorId : NativeCommandError
EXIT=1
```

The setup creates and pushes `refs/heads/seed` but leaves the bare repository's symbolic `HEAD` at the nonexistent default branch. This is not a product-attribution failure; it is why the ordinary mutant criterion is not demonstrated by candidate bytes on the target QA environment. The fixture-only adaptation was:

```powershell
git --git-dir=$bare symbolic-ref HEAD refs/heads/seed
```

## 5. QA mutants

GitNexus was indexed at the candidate handoff before source edits. Its PowerShell parser did not expose either function as a symbol, so both required impact calls returned `risk: UNKNOWN`, target not found. Static callers are the final driver audit and the QA harness's extracted module.

| Branch | Commit | Mutation | Kill |
|---|---|---|---|
| `qa/qa-driver-r3-mut-seat-check` | `92589992c5bb1a9f020f482090d131de5d8647db` | remove `seatCreatedShas` from `Audit-NonQaRefs` | ordinary seat-new row: violations empty, tip in elsewhere, exit 1 |
| `qa/qa-driver-r3-mut-new-ref` | `6bbf0be3150789ccaf011ffae57bfa6735ebb9a0` | skip the new-local-ref branch in `Get-SeatCreatedShas` | other-worktree row: `created_contains=False`, tip in elsewhere |

Both mutant files parse with zero PowerShell errors. Both branches were pushed only through `node docs/loops/qa-202/push-qa.mjs` and read back.

## 6. Build, sync, and evidence

- `npm ci; npm run build` in the candidate handoff worktree: exit 0; TypeScript and postbuild passed.
- `/sync` was unavailable as an MCP tool. The closest read-only route, the candidate build's `sync --check`, ran before each mutant commit and exited 1 on pre-existing repository issues: retirements, worktree-layout, and greeting-size. It named this run's scratch worktrees as part of the already-broad layout issue.
- Evidence: `docs/loops/qa-driver-cursor-r3-qa-report.E_t.json`.
- Candidate build validation: `node build/harness/cli.js validate evidence <file>` exited **0**.
- No CI runs; `runtime_checks` records the local build and the unmodified shipped-harness attempt.

## 7. Defects and observations

1. **Blocking — ordinary control harness aborts before its scored row.** The bare fixture has no valid symbolic HEAD. Item 4 requires a nonzero exit on seat-new, but the shipped harness exits earlier during clone.
2. **Observation — denial parser can self-match quoted stream content.** A passing sanctioned route can read `drive.ps1` and make the harness report `denial=True` even though no denial event occurred.

## 8. Open for the planner

- I treated item 4 literally and rejected. The product attribution fix itself passes every direct and second-path probe. If fixture-only adaptations are allowed under “ordinary harness,” item 4 would be met and the product verdict would be accept; the candidate bytes do not contain that adaptation.

QA-202: REPORT COMPLETE
