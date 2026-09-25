# Infra: set up desktop-o4egb1e as SIA's dedicated QA machine (brief for the developer seat)

**By:** Atlas (planner), record session 90 · 2026-09-24. **To:** Forge in `~/Worktrees/sia-infra`, record session 97
(same session, a second job).

## Why

- QA's local measurement needs a quiet machine (G-042). Today every A2A-Hub seat on this PC stops for it, for over an
  hour.
- Aaron wants QA moved to his other PC, so nobody stops: "can we offload qa measurement to that computer? … I don't
  like stopping for and hour 20 minutes."
- Then, answering the planner's "shall I have the infra Forge session do the setup now?": "yes".
- A second machine also gives G-042 its missing control: this code, on a different machine, measured quietly.

## The machine (surveyed by the planner over SSH, 2026-09-24)

- **Name:** `desktop-o4egb1e`, Tailscale `100.73.250.101`, Windows 10 (10.0.19045).
- **Hardware:** i5-3570, 4 cores, 7.9 GB RAM, 394 GB free on C:.
- **SSH:** `ssh -l "Aaron Melven" 100.73.250.101`. Key auth with this PC's `~/.ssh/id_ed25519`. The firewall allows the
  tailnet (100.64.0.0/10) only. The default shell is `cmd`, so wrap PowerShell as
  `powershell -NoProfile -Command "…"`.
- **Present:** Claude Code (`C:\Users\Aaron Melven\.local\bin\claude.exe`, not on SSH's PATH) and Tailscale.
- **Missing:** git, node, npm and gh.

## The work

1. **Install over SSH:**
   - Git for Windows;
   - Node **22 LTS** (the project tests on 22; do not take 24);
   - the GitHub CLI.

   Prefer the vendors' official installers or `winget`. Note that `winget` often fails in a non-interactive SSH
   session; if it does, use the MSI/EXE installers silently. Verify each by running its `--version` over a fresh SSH
   connection.
2. **GitHub auth for gh:** `gh auth login` needs Aaron's browser or a token. **Do not copy this PC's token.** If it
   needs him, stop and tell the planner exactly what he must do on that PC.
3. **Clone** `melvenac/Self-Improving-Agent` to `C:\Users\Aaron Melven\Worktrees\sia-qa` (a plain clone, not a
   worktree), detached at `origin/master`. Keep line endings as the repo's `.gitattributes` gives them, and check
   that `git status` is clean after the clone. Then build `open-brain` (`npm ci`, `npm run build`). `better-sqlite3`
   may need a prebuilt binary or build tools; record what it took.
4. **Make `/start` work for a Claude session there,** or record precisely why it can't (this is T-154's question on a
   real stranger's machine):
   - the open-brain MCP server registered for that user;
   - the SessionStart hook pointing at THAT machine's build;
   - a `.agents/AGENT.local.md` naming the seat `Probe`, role `qa`.
5. **Prove the driving mode:** run Claude Code there non-interactively over SSH (for example
   `claude -p "<prompt>" --output-format stream-json`, with an explicit `--permission-mode` the planner can read
   back). A trivial prompt is enough, one that reports `git rev-parse HEAD` in the clone. Record whether it is logged
   in, the exact command line, how output returns, and how a long run is detached and polled later.
6. **Baseline:** the full suite ONCE there, on `origin/master`, with nothing else running on that PC. Output to a
   file, the exit code captured unpiped, test counts, any `onTaskUpdate`/Unhandled lines, and the wall time. This is
   G-042's second-machine measurement. Report it as observation, not as a cause.

## Aaron's view into that PC (no install needed)

- **No VS Code is installed on `desktop-o4egb1e`.** Aaron, 2026-09-24: "yes, that's great", agreeing with the
  planner's plan.
- To watch or step in, Aaron uses **VS Code on his own PC with the Remote-SSH extension**, connecting as host
  `100.73.250.101`, user `Aaron Melven`.
- On the first connect, Remote-SSH installs its own server under
  `C:\Users\Aaron Melven\.vscode-server` on that PC. **That is expected, not an intrusion.** Leave it alone.
- Say in the handoff whether Remote-SSH needs anything from the SSH setup. It uses the same `sshd` and key. On a
  Windows host it may need its `remote.SSH.remotePlatform` set to `windows`, which is Aaron's setting on his own
  PC, not a change on the QA machine.

## Rules

- **Touch nothing else on that PC.** Uninstall nothing, and change no other settings.
- **This PC:** nothing here changes. QA 96 is mid-measurement here now. **Do not run anything heavy on THIS machine
  until the planner says QA 96's window is over.** Your SSH commands are fine.
- On a refusal, a denied command, or anything that needs Aaron: stop and tell the planner.
- **Hand back** `docs/loops/infra-qa-machine-handoff.md` on your branch `chore/qa-machine`. Cover:
  - what was installed, with versions and paths;
  - the auth state;
  - the `/start` result;
  - the driving command;
  - the baseline numbers;
  - how to undo each step;
  - model and effort.
