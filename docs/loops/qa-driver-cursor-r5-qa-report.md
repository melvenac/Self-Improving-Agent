# Cursor QA driver r5 — QA report (record 218 scoring record 192 r5)

## Verdict: REJECT

The r5 harness repair works on the laptop where r4 failed: Windows PowerShell 5.1 drops the embedded quotes through `cursor-agent.ps1`, the new `ProcessStartInfo` launcher preserves them, the ordinary candidate harness exits 0, and the quote-drop mutant exits 1 at `prompt_quotes_stripped`.

The product is still defective. `docs/loops/qa-driver-template-cursor/drive.ps1` uses the same quote-dropping `cursor-agent.ps1` route, and every real QA prompt appends `stops.txt`, which contains embedded double quotes. This live QA-218 run proves the loss: the source had `"Open for the planner"` while the agent's user event had `Open for the planner`. Because the fix is harness-only, real laptop QA seats still receive mangled instructions.

No CI was requested or run. This is local Windows PowerShell evidence only.

## 1. Frozen candidate and environment

- Candidate: `bbfb7241387d261cf0ffb1cb80ffc1443bd335c7` on `origin/loop/qa-driver-cursor-r2`.
- Host: Windows 10 19045, Windows PowerShell 5.1.19041.6456, Git 2.55.0.windows.3, Node v24.5.0. Node v22 remains the repository's tested version.
- QA model: GPT-5.6 Sol (`gpt-5.6-sol-medium`). Builder: Composer 2.5.
- Harness execution used isolated worktrees under `C:\qa-tmp`; only the candidate harness's developer-machine `$repo` path was adapted, then restored byte-clean.
- GitNexus did not have this checkout indexed and its stale indexed checkout could not resolve `Invoke-PushProbe`, so the mutant edit's graph risk was `UNKNOWN`. Direct inspection confines it to the harness pass/deny probe loops.

## 2. Diagnosis and argv reproduction

The installed `cursor-agent.ps1` invokes node as:

```text
& "$nodePath" "$scriptPath\versions\$versionName\index.js" $args
```

On Windows PowerShell 5.1, an equivalent forwarding wrapper delivered:

```text
["-p","cmd /c cd",".","&&","node","docs/loops/qa-9992/push-qa.mjs","qa/zz-probe-cd"]
BROKEN_EXIT=0
```

Using the candidate's `ConvertTo-WinArg` and `ProcessStartInfo` route delivered one intact prompt argument:

```text
["-p","cmd /c \"cd . && node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-cd\""]
FIXED_EXIT=0
```

This confirms the developer's diagnosis on the failing laptop.

## 3. Ordinary candidate harness

The full candidate harness exited 0 in 97,617 ms. The required pass rows were:

```text
push_pass node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-plain denial=False moved=True
push_pass cmd /c "cd . && node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-cd" denial=False moved=True
prompt_quotes_kept=True
push_pass powershell -NoProfile -Command "node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-ps" denial=False moved=True
```

All three deny rows remained blocked without moving a ref:

```text
push_deny git push origin HEAD:refs/heads/qa/zz-deny-git denial=True moved=False
push_deny powershell -NoProfile -Command git push origin HEAD:refs/heads/qa/zz-deny-ps denial=True moved=False
push_deny powershell -NoProfile -Command "& git push origin HEAD:refs/heads/qa/zz-deny-callop" denial=True moved=False
PASS ref_attribution
PASS push_routes
HARNESS_EXIT=0
```

## 4. Quote-drop mutant

Branch `qa/qa-driver-r5-mut-quote` at `9cabe6f714fd0716bb2240af4e70404bd8e5280e` replaces only the harness probe's quoted launcher with the old `cursor-agent.ps1` route. It exited 1 in 46,874 ms:

```text
push_pass node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-plain denial=False moved=True
push_pass cmd /c "cd . && node docs/loops/qa-9992/push-qa.mjs qa/zz-probe-cd" denial=False moved=False
FAIL prompt_quotes_stripped: agent did not receive the sanctioned cmd /c route
MUTANT_EXIT=1
```

The new check bites before a model retry can hide the stripped prompt.

## 5. Product defect: the real driver shares the route

The unchanged template `drive.ps1` constructs a PowerShell argument array containing `-File $agent -p $prompt` and launches it with `& $ps @agentArgs`. `$agent` is `cursor-agent.ps1`, whose `$args` forwarding caused the reproduced split.

The first prompt itself has no embedded double quotes, but `Prompt-WithStops` appends `stops.txt` to the first prompt and every resume prompt. QA-218's `stops.txt` contained two double quotes around `"Open for the planner"`. The actual first user event recorded by this real driver contained zero double quotes:

```text
source: write any question into the report's "Open for the planner" section
user event: write any question into the report's Open for the planner section
```

Resume prompts use the same `Prompt-WithStops` and `Invoke-Agent` path, so they have the same exposure. The exact text damaged in this run remained understandable, but arbitrary dispatch-specific quoted commands or literals need not. This is a product defect, not merely a harness limitation.

## 6. Preservation

The required command produced no diff:

```text
git diff --exit-code d67c5e7 bbfb724 -- docs/loops/qa-driver-template-cursor/
TEMPLATE_DIFF_EXIT=0
```

Therefore completion detection, resume-at-most-3, refusal handling, denial handling, and the whole product template remain byte-unchanged. That preservation is also why the product defect remains.

## 7. Evidence and findings

- Evidence: `docs/loops/qa-driver-cursor-r5-qa-report.E_t.json`.
- Runtime checks are the ordinary candidate and quote-drop-mutant harness runs above.
- Candidate SHA in the evidence is the full `bbfb724` SHA.
- From `open-brain/`, `node build/harness/cli.js validate evidence C:\qa-tmp\qa218-report\docs\loops\qa-driver-cursor-r5-qa-report.E_t.json` exited 0 in 1,787 ms.
- The required pre-commit sync check ran and exited 1 on repository-wide pre-existing issues (retired names in `ENTITIES.md`, accumulated non-seat worktree names, and greeting size); it reported 27 passes and no fixes. None concerns these two report files.

Findings:

1. **Met — diagnosis.** Broken and fixed argv were reproduced on this laptop.
2. **Met — r4 row.** The ordinary candidate harness exited 0 with all pass and deny rows correct.
3. **Met — new check.** The quote-drop mutant exited 1 at `prompt_quotes_stripped`.
4. **Blocking defect — real driver.** The live QA-218 user event proves that the unchanged product strips embedded double quotes from appended stop instructions.
5. **Met — preservation.** The product template diff is empty.
6. **Met — independent mutant.** The QA-owned mutant branch was created and killed.

## 8. Open for the planner

- The harness repair should not be treated as a product fix. Port the same argv-safe launch into `docs/loops/qa-driver-template-cursor/drive.ps1` and re-run a real laptop QA seat whose delivered user event is checked byte-for-byte for embedded quotes.

QA-218: REPORT COMPLETE
