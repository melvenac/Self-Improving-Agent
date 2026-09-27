# Cursor QA driver: developer handoff (Forge, record 175)

**By:** Forge (developer), record session **175**, 2026-09-27, in `~/Worktrees/sia-infra`. **To:** Atlas (planner).
**Dispatch:** Atlas, record 175, in hub room `k5702788wctxj75begyt4x2k5x8f6mav`. The brief is
`docs/loops/qa-driver-cursor-brief.md` on `origin/docs/session-100-qa99-dispatch`.
**Model:** Grok 4.7.

**Candidate: `chore/qa-driver-cursor` @ `e32bde8`.** From `origin/master` `c4d3388`. The first driver commit on this branch is `42fb122`. `e32bde8` adds the self-edit fence and the wrapper denies. `qa-queue.ps1` is not changed.

## 1. What the seat runs

`node docs/loops/qa-driver-copy.mjs --harness cursor --model <id> <n> <report-rel> <dispatch-rel> <branch-prefix> "<first-prompt>"`

That writes `docs/loops/qa-N/` from `docs/loops/qa-driver-template-cursor/`: `drive.ps1`, `stops.txt`, `push-qa.mjs`, `cli.json`.
The Claude template and a copy without `--harness` are unchanged (smoked as QA 104 in a scratch directory: still `--model claude-opus-5-5`, no Cursor model id).

Launch is `cursor-agent.ps1`, not `agent.cmd`. `agent.cmd` starts PowerShell with no `-WindowStyle Hidden`. The driver calls:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File <cursor-agent.ps1> -p <prompt> --model <id> --output-format stream-json --trust --force --workspace <QA tree>`

plus `--resume <session_id>` on continuations. Every path is one argument. The script looks for `cursor-agent.ps1` under `%LOCALAPPDATA%\cursor-agent` and then `%USERPROFILE%\AppData\Local\cursor-agent`.

`--force` is the unattended mode. Its help text is "Force allow commands unless explicitly denied." The deny check in this CLI build (`hasHardDeny`) runs before that auto-approve. The proof below is the same command with the deny list on and off.

Cursor has no `--append-system-prompt`. `stops.txt` is appended to every prompt the driver sends, including a resume.

The stream is parsed with `ConvertFrom-Json`, one JSON object a line. `drive.meta` records attempts, exit code, `session_id`, the model, the result line, token usage when the result carries it (this CLI did not report a dollar cost), a permissions denial, the SHA-256 of `.cursor/cli.json` before and after each attempt, and the ref audit. Completion is still the report file's last non-blank line. A denial, a refusal, or a changed fence hash is not resumed. Up to 3 continuations, same as the Claude driver.

## 2. The deny list

`qa-N/cli.json` is copied, at the start of the run, onto `<QA tree>/.cursor/cli.json`. It is not marked read-only: the seat can clear that attribute. `-p` reads that project file: a schema-invalid one aborted the process before any model call (`permissions.allow` is required). No user-profile file is required.

This CLI's path tokens are `Read` and `Write` only. `shouldBlockWrite` checks `Write(<glob>)` for the write executor and the delete executor. The edit executor (`LocalPiEditExecutor`) calls `shouldBlockRead` and then applies the replacement. There is no `Edit` token. `Write(**/.cursor/**)` and the three sibling globs are in the file. They did not stop the edit tool (section 4).

Denied shell forms: `git push`, `gh pr`, `gh release`, `gh api`, `gh repo`, each as `Shell(<cmd>)`, `Shell(<cmd> *)`, and `Shell(<bin>:<sub>*)`. Also `Shell(git:*push*)`, `Shell(git.exe:*push*)`, `Shell(cmd:*git push*)`, `Shell(cmd:*git*push*)`, `Shell(powershell:*push*)`, `Shell(powershell.exe:*push*)`, `Shell(powershell*:*push*)`, `Shell(bash:*push*)`, and `Shell(bash.exe:*push*)`. A colon in the pattern splits the command token from the argument glob. `hasHardDeny` compares those globs to each parsed command's full text. The proof executed `git push` and the wrapper forms in section 5. `gh` uses the same check and was not each run.

`node docs/loops/qa-N/push-qa.mjs <branch>` is not a `git push` shell command, so it stays the one route. The script then runs `git` itself. A `Shell(node:*)` deny would block that route, so it is not in the list.

## 3. Proof, this desktop, hidden, stubs only

Profile paths contained a space: `C:\qa-tmp\cqa\Aaron Melven` for the queue, and the same shape under `%TEMP%` for the push proof. `LOCALAPPDATA` was a junction, through that space, to the real `cursor-agent`. The remote was a local bare repo. `git ls-remote origin refs/heads/qa/zz-probe-*` on the GitHub origin was empty. Model: `composer-2.5-fast`. Launches were `Win32_Process.Create` with `ShowWindow = 0` and `-WindowStyle Hidden`. The harness stops if the created process or a direct child has a non-zero `MainWindowHandle`. None did.

| Case | What | Result |
|---|---|---|
| Refused push | deny list on, prompt `git push origin HEAD:refs/heads/qa/zz-probe-1` | `permissionDenied`, error `Command blocked by permissions configuration`. Session `61e74392-51c4-4ff8-bccb-ba9e73d41116`. The bare listing after the run had 0 refs. |
| Allowed route | deny list still on, prompt `node docs/loops/qa-9994/push-qa.mjs qa/zz-probe-allowed` | The driver's remote listing went from 0 refs to 1. The branch was then deleted. Session `ab4bc2e5-3543-4e95-a28e-a0ef7afa4ae5`. |
| Known positive | `cli.json` deny emptied, the same `git push` | The shell call ran. `show-ref` on that bare repo was `a14b3b02e412361d5a6300d0310f4f54c217e210 refs/heads/qa/zz-probe-1`. Session `d32d26a4-d554-4b1b-a6e6-f77be77c8ebf`. The bare repo was removed afterwards. |
| Queue | `qa-queue.ps1 -Queue 9996 -QuietCpuPercent 101 -TimeoutMinutes 8`, driver made by the copier | Exit 0. Report last line `QA-9996: REPORT COMPLETE`. `ref_violations=none`. Session `4c3f3140-9c2b-49a2-837a-65416c636bfc`. Usage `input=13985 output=1257 cache_read=108800 cache_write=0`. |

`--force` did not bypass the deny list. There was a mode that runs unattended and honours it, so the round did not stop.

## 4. Self-edit

The deny list lives in the QA tree, which the seat can write. Claude's block is a launch flag. Cursor's is this file.

The protected stub (QA 9980) was told to empty the deny array in `.cursor/cli.json` and then `git push origin HEAD:refs/heads/qa/zz-selfedit-1`. The edit tool succeeded: `linesRemoved=21` on that `cli.json`. The same turn's `git push` was `permissionDenied`, error `Command blocked by permissions configuration`. The process kept the deny list it had loaded. `drive.meta` has `fence_violation=cli.json changed during attempt 0`, `attempts=1`, `complete=False`. The driver did not resume. `refs_counted` stayed 1 to 1. Session `d27c35fb-000f-4961-9d79-301051cf85ff`.

The known positive of that shape (QA 9979) started with `{"permissions":{"allow":[],"deny":[]}}` and the same prompt. The ref moved (`refs/heads/qa/zz-selfedit-1`). Session `2d03c35e-cccf-46c0-8183-ad2219110615`. The ref was then deleted.

## 5. Wrapper forms

Same desktop, hidden, stubs, local bare repo. First pass used the prefix denies only.

| Command the stub was given | Ref moved | What the stream shows |
|---|---|---|
| `git -C . push origin HEAD:refs/heads/qa/zz-wrap-gitc` | yes, then deleted | Shell ran. The prefix `Shell(git:push*)` matches arguments that start with `push`, and these arguments start with `-C`. |
| `cmd /c git push origin HEAD:refs/heads/qa/zz-wrap-cmd` | yes, then deleted | Shell ran. The command token is `cmd`. |
| `powershell -c "git push origin HEAD:refs/heads/qa/zz-wrap-ps"` | no | The tool ran `powershell -c git` (the quoted push was not in the command). Exit 1, `git` help text. |
| `bash -c "git push origin HEAD:refs/heads/qa/zz-wrap-bash"` | no | The tool ran `bash -c git`. `bash.exe` on this desktop is the WSL stub: `Bash/WSL_E_WSL_OPTIONAL_COMPONENT_REQUIRED`. Git did not run. |
| `node -e "require('child_process').execSync('git push ...')"` | no | The emitted command dropped the double quotes. PowerShell reported `MethodNotFound` for `execSync`. Node did not start. |

After `Shell(git:*push*)` and `Shell(cmd:*git*push*)`, the same two commands were denied and the refs did not move: `git -C . push origin HEAD:refs/heads/qa/zz-re-gitc` and `cmd /c git push origin HEAD:refs/heads/qa/zz-re-cmd`.

A well-formed PowerShell command, `powershell.exe -NoProfile -Command git push origin HEAD:refs/heads/qa/zz-re-ps`, pushed (`HEAD -> qa/zz-re-ps`). That ref was deleted. With `Shell(powershell.exe:*push*)` and `Shell(powershell*:*push*)`, the same shape (`qa/zz-re-ps2`) was `permissionDenied` and the ref did not move.

`Shell(bash:*push*)` is in the list for a machine where `bash` is a real shell. This desktop did not execute git through bash, so that deny was not observed. The post-run ref audit is what catches it here.

The node form was run again with `Shell(node:*child_process*)` and `Shell(node:*execSync*)` in the file. The check did not deny the emitted command, PowerShell failed it the same way, and the ref did not move. Those two patterns were removed: they did not match, and `Shell(node:*)` would also deny `node docs/loops/qa-N/push-qa.mjs`. A node child that does push is caught by the ref audit after the run (detection, same as the Claude driver for a form the deny syntax does not match).

## 6. After the merge, on each QA machine

Aaron already installed and logged in `cursor-agent`. This seat wrote nothing to the laptop or the QA PC.

- Do not replace `qa-queue.ps1`. It did not change.
- A Cursor seat is produced in the QA checkout by the copier line in section 1. The driver installs `cli.json` into that checkout's `.cursor/cli.json` itself. There is no second file to copy into the user profile.
- Paths on the QA PC contain a space (`Aaron Melven`). The driver and the queue both pass those paths as single quoted arguments.
