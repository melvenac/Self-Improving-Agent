# Cursor QA driver: developer handoff (Forge, record 175)

**By:** Forge (developer), record session **175**, 2026-09-27, in `~/Worktrees/sia-infra`. **To:** Atlas (planner).
**Dispatch:** Atlas, record 175, in hub room `k5702788wctxj75begyt4x2k5x8f6mav`. The brief is
`docs/loops/qa-driver-cursor-brief.md` on `origin/docs/session-100-qa99-dispatch`.
**Model:** Grok 4.7.

**Candidate: `chore/qa-driver-cursor` @ `42fb122`.** From `origin/master` `c4d3388`.
`qa-queue.ps1` is not changed.

## 1. What the seat runs

`node docs/loops/qa-driver-copy.mjs --harness cursor --model <id> <n> <report-rel> <dispatch-rel> <branch-prefix> "<first-prompt>"`

That writes `docs/loops/qa-N/` from `docs/loops/qa-driver-template-cursor/`: `drive.ps1`, `stops.txt`, `push-qa.mjs`, `cli.json`.
The Claude template and a copy without `--harness` are unchanged (smoked as QA 104 in a scratch directory: still `--model claude-opus-5-5`, no Cursor model id).

Launch is `cursor-agent.ps1`, not `agent.cmd`. `agent.cmd` starts PowerShell with no `-WindowStyle Hidden`. The driver calls:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File <cursor-agent.ps1> -p <prompt> --model <id> --output-format stream-json --trust --force --workspace <QA tree>`

plus `--resume <session_id>` on continuations. Every path is one argument. The script looks for `cursor-agent.ps1` under `%LOCALAPPDATA%\cursor-agent` and then `%USERPROFILE%\AppData\Local\cursor-agent`.

`--force` is the unattended mode. Its help text is "Force allow commands unless explicitly denied." The deny check in this CLI build (`hasHardDeny`) runs before that auto-approve. The proof below is the same command with the deny list on and off.

Cursor has no `--append-system-prompt`. `stops.txt` is appended to every prompt the driver sends, including a resume.

The stream is parsed with `ConvertFrom-Json`, one JSON object a line. `drive.meta` records attempts, exit code, `session_id`, the model, the result line, token usage when the result carries it (this CLI did not report a dollar cost), a permissions denial, and the ref audit. Completion is still the report file's last non-blank line. A denial or a refusal is not resumed. Up to 3 continuations, same as the Claude driver.

## 2. The deny list

`qa-N/cli.json` is copied, at the start of the run, onto `<QA tree>/.cursor/cli.json` and marked read-only. `-p` reads that project file: a schema-invalid one aborted the process before any model call (`permissions.allow` is required). No user-profile file is required.

Denied shell forms: `git push`, `gh pr`, `gh release`, `gh api`, `gh repo`, each as `Shell(<cmd>)`, `Shell(<cmd> *)`, and `Shell(<bin>:<sub>*)`. The proof executed `git push` only. The other four use the same check and were not each run.

`node docs/loops/qa-N/push-qa.mjs <branch>` is not a `git push` shell command, so it stays the one route. The script then runs `git` itself.

## 3. Proof, this desktop, hidden, stubs only

Profile paths contained a space: `C:\qa-tmp\cqa\Aaron Melven` for the queue, and the same shape under `%TEMP%` for the push proof. `LOCALAPPDATA` was a junction, through that space, to the real `cursor-agent`. The remote was a local bare repo. `git ls-remote origin refs/heads/qa/zz-probe-*` on the GitHub origin was empty. Model: `composer-2.5-fast`. Launches were `Win32_Process.Create` with `ShowWindow = 0` and `-WindowStyle Hidden`. The harness stops if the created process or a direct child has a non-zero `MainWindowHandle`. None did.

| Case | What | Result |
|---|---|---|
| Refused push | deny list on, prompt `git push origin HEAD:refs/heads/qa/zz-probe-1` | `permissionDenied`, error `Command blocked by permissions configuration`. Session `61e74392-51c4-4ff8-bccb-ba9e73d41116`. The bare listing after the run had 0 refs. |
| Allowed route | deny list still on, prompt `node docs/loops/qa-9994/push-qa.mjs qa/zz-probe-allowed` | The driver's remote listing went from 0 refs to 1. The branch was then deleted. Session `ab4bc2e5-3543-4e95-a28e-a0ef7afa4ae5`. |
| Known positive | `cli.json` deny emptied, the same `git push` | The shell call ran. `show-ref` on that bare repo was `a14b3b02e412361d5a6300d0310f4f54c217e210 refs/heads/qa/zz-probe-1`. Session `d32d26a4-d554-4b1b-a6e6-f77be77c8ebf`. The bare repo was removed afterwards. |
| Queue | `qa-queue.ps1 -Queue 9996 -QuietCpuPercent 101 -TimeoutMinutes 8`, driver made by the copier | Exit 0. Report last line `QA-9996: REPORT COMPLETE`. `ref_violations=none`. Session `4c3f3140-9c2b-49a2-837a-65416c636bfc`. Usage `input=13985 output=1257 cache_read=108800 cache_write=0`. |

`--force` did not bypass the deny list. There was a mode that runs unattended and honours it, so the round did not stop.

## 4. After the merge, on each QA machine

Aaron already installed and logged in `cursor-agent`. This seat wrote nothing to the laptop or the QA PC.

- Do not replace `qa-queue.ps1`. It did not change.
- A Cursor seat is produced in the QA checkout by the copier line in section 1. The driver installs `cli.json` into that checkout's `.cursor/cli.json` itself. There is no second file to copy into the user profile.
- Paths on the QA PC contain a space (`Aaron Melven`). The driver and the queue both pass those paths as single quoted arguments.
