# Cursor QA driver r4 — QA report (record 210 scoring record 192 r4)

## Verdict: REJECT

The r4 fixture repair itself works: Git 2.55 reaches the attribution rows, the candidate row passes, the `462403d` mutant dies on the seat-new row, and a real failing fixture command remains fatal. The product/template is byte-unchanged.

The dispatch also requires the ordinary candidate harness to exit 0. It did not. Two identical ordinary runs reached the push probes and then failed on the unchanged sanctioned `cmd /c` route with `denial=False moved=False`. Because that explicit observation was not met, this round is rejected even though the r4 delta closes QA 202's bare-HEAD defect.

No CI was requested or run. This is local Windows PowerShell evidence only; no `windows=true`.

## 1. Frozen candidate and environment

- Harness candidate: `0f816bb7ee0a0ff7f76822f06a8907a1c5efa9fa` on `origin/loop/qa-driver-cursor-r2`.
- Product: `d67c5e7044df129d61deba68c489f9f89cdb87fc`.
- Host: Windows 10 19045, Windows PowerShell 5.1, Git 2.55.0.windows.3, Node v24.5.0. Node v22 remains the repository's tested version.
- QA model: GPT-5.6 Sol (`gpt-5.6-sol-medium`). Builder: Composer 2.5.
- The candidate harness hard-codes `C:\Users\melve\Worktrees\sia-infra`; the executed copy changed only that path to the isolated candidate clone. The tracked harness was restored byte-clean before the report commit.

## 2. Harness-only repair

The r4 diff adds `Run-FixtureGit`, routes the fixture seed push and clone through it, and sets the bare repository's symbolic `HEAD` to `refs/heads/seed`. The candidate `-SkipAgent` run exited 0:

```text
ref_other_seat violations= elsewhere=refs/heads/loop/other-seat=<sha>
ref_seat_new violations=refs/heads/loop/seat-new elsewhere=refs/heads/loop/other-seat=<sha> seat_created=<sha>
SKIP_AGENT push rows not run
PASS ref_attribution
SKIP_AGENT_EXIT=0
```

The native-stderr relaxation did not hide a genuine failure. A probe using the candidate's exact wrapper ran `git rev-parse --verify` against a definitely absent ref:

```text
fatal: Needed a single revision
EXPECTED_FAILURE=git fixture failed with exit 128
WRAPPER_PROBE_EXIT=1
```

Thus the wrapper tolerates native stderr only while still enforcing the command's exit code.

## 3. Required mutant

The ordinary attribution portion against `462403d6eb2e4268352de230274d50c222d0b283` reached and failed on the seat-new row, not in setup:

```text
ref_other_seat violations= elsewhere=refs/heads/loop/other-seat=<sha>
ref_seat_new violations= elsewhere=refs/heads/loop/other-seat=<sha>,refs/heads/loop/seat-new=<sha> seat_created=
FAIL ref attribution rows
MUTANT_EXIT=1
```

This closes QA 202's specific setup failure.

## 4. Ordinary candidate harness

The full ordinary candidate harness did not exit 0. It failed identically twice, after both attribution rows and the plain sanctioned push:

```text
ref_seat_new violations=refs/heads/loop/seat-new elsewhere=refs/heads/loop/other-seat=<sha> seat_created=<sha>
push_pass node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-plain denial=False moved=True
push_pass cmd /c "cd . && node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-cd" denial=False moved=False
FAIL push route should pass: cmd /c "cd . && node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-cd"
HARNESS_EXIT=1
```

Run 1 took 49,066 ms; run 2 took 46,852 ms. The r4 patch does not touch push-probe code, and the dispatch says QA 202's other findings are not re-scored unless touched. Nevertheless, score item 2 expressly requires the ordinary harness on `0f816bb` to exit 0, so the repeated later failure makes that item partial and the round rejected.

## 5. Preservation

The required command:

```text
git diff --exit-code d67c5e7 0f816bb -- docs/loops/qa-driver-template-cursor/
PRESERVE_EXIT=0
```

It produced no diff. The product/template is unchanged.

## 6. Build and evidence

- `npm ci; npm run build` in `open-brain/`: exit 0 in 14,123 ms; TypeScript and postbuild passed, stamped `0f816bb`.
- Runtime checks in the evidence file are the local PowerShell harness runs, as dispatched: candidate `-SkipAgent` exit 0 and full ordinary candidate exit 1.
- Evidence: `docs/loops/qa-driver-cursor-r4-qa-report.E_t.json`.
- Candidate-build validation, run from `open-brain/` as `node build/harness/cli.js validate evidence ..\docs\loops\qa-driver-cursor-r4-qa-report.E_t.json`: exit 0.

## 7. Findings

1. **Met — fixture repair.** The valid bare HEAD prevents QA 202's Git 2.55 setup abort.
2. **Met — real failures remain fatal.** `Run-FixtureGit` converted git exit 128 into a thrown fixture failure and process exit 1.
3. **Met — required mutant reaches its row.** `462403d` exits 1 on `ref_seat_new`, with no setup abort.
4. **Blocking — ordinary candidate harness is not green.** Two runs exit 1 on the sanctioned `cmd /c` push route, so the explicit candidate-exit-0 half of score item 2 is unmet.
5. **Met — preservation.** The product/template diff is empty.

## 8. Open for the planner

- The repeated `cmd /c` failure is outside the r4 fixture delta, but the dispatch makes an ordinary exit 0 a scored condition. I therefore rejected rather than treating the candidate-only `-SkipAgent` pass as equivalent.
- A follow-up should inspect the run-9994 stream and driver metadata on this host. The row reports no denial and no moved ref, which distinguishes it from the previously documented denial-parser self-match.

QA-210: REPORT COMPLETE
