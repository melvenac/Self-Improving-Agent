# Infra: desktop-o4egb1e as SIA's QA machine — developer handoff

**By:** Forge (developer seat), **record session 97** (second job), 2026-09-24, in `~/Worktrees/sia-infra`.
**For:** Atlas (planner), record session 90, and Aaron through the planner (D-038).
**Brief:** `docs/loops/infra-qa-machine-brief.md` (D-045; at the time of writing, in the planner's tree
only), plus the planner's Remote-SSH addition and rulings.
**Model and effort:** Claude Opus 5.5 (1M context), effort **low**.

**Status:** steps 1, 2, 3 and 5 are **done**, and the detached launch is **demonstrated**. Step 4 is
**skipped** by the planner's ruling. **Step 6 ran after Aaron restarted the PC: exit 1, 14 failed and
1020 passed (1034), with no `onTaskUpdate` and no Unhandled lines** (section 6). Nothing heavy ran on
Aaron's main PC.

## Authority, as it was used

- **D-045, quoted in the brief (Aaron to the planner):** "can we offload qa measurement to that computer?
  … I don't like stopping for and hour 20 minutes", then "yes" to the planner's "shall I have the infra
  Forge session do the setup now?".
- **The two logins, relayed by the planner, Aaron verbatim:** "done". That was his answer to `gh auth
  login` plus `gh auth setup-git`, and Claude Code `/login`, which he did in his own terminal to that PC.
- **A host-level stop, NOT cleared.** Step 4's config writes were denied by Claude Code's auto-mode
  classifier ("[Self-Modification]"). I stopped, did not look for another route, and reported it. The
  planner then ruled step 4 skipped (section 4).

## 1. What was installed (step 1), with versions and paths

On desktop-o4egb1e (Windows 10 19045.6466, i5-3570, 4 cores, 7.9 GB), over
`ssh -l "Aaron Melven" 100.73.250.101`. The ssh session is **elevated admin**, so all three installs are
machine-wide.

| Tool | Version | Path | Installer, sha256 (checked against the vendor's published value) |
|---|---|---|---|
| Git for Windows | 2.55.0.windows.5 | `C:\Program Files\Git` | `Git-2.55.0.5-64-bit.exe`, `d065a4e2…94c6` (GitHub release digest) |
| Node.js | **v22.23.3** (npm 10.9.9) | `C:\Program Files\nodejs` | `node-v22.23.3-x64.msi`, `1c0efc84…cb8d` (nodejs.org `SHASUMS256.txt`) |
| GitHub CLI | 2.101.0 | `C:\Program Files\GitHub CLI` | `gh_2.101.0_windows_amd64.msi`, `9ba92256…ef83` (GitHub release digest) |

- **winget was tried first and failed over SSH**, as the brief predicted: `Failed in attempting to update
  the source: winget` and `No packages were found among the working sources`, exit `-1978335217`, for all
  three. The fallback was the vendors' official installers, downloaded on that PC, hash-checked and
  installed silently with exit 0 each. The script is `docs/loops/infra-qa-machine/install2.ps1`.
- **Verified over a fresh, plain ssh session** (`git --version & node --version & npm --version & gh
  --version` in cmd): all four resolve on PATH.
- Every command to that PC goes through cmd, which splits a PowerShell `-Command` string at any `|`
  inside `\"…\"`. So every multi-step PowerShell action was copied over with scp and run as
  `powershell -NoProfile -ExecutionPolicy Bypass -File …`. The scripts sit in `%TEMP%\sia-setup` there,
  and copies are in `docs/loops/infra-qa-machine/`.

## 2. Auth state (step 2)

- **gh:** `gh auth status` shows it logged in to github.com as **melvenac**, token scopes `gist`,
  `read:org`, `repo` and `workflow`, git protocol https, stored in
  `C:\Users\Aaron Melven\AppData\Roaming\GitHub CLI\hosts.yml`. I did not copy any token from Aaron's
  main PC.
- **`gh auth setup-git` had NOT taken effect** after Aaron's run. git's only credential helper was Git
  for Windows' system-wide `manager`, which would try to open a login window and fail over SSH. **I ran
  `gh auth setup-git` myself over ssh.** It is one of the two commands Aaron was asked to run, and it
  writes only his own `~/.gitconfig`; the planner ruled this within his instruction. Read back from
  `C:/Users/Aaron Melven/.gitconfig`: `credential.https://github.com.helper` (and `gist.github.com`) =
  `!'C:\Program Files\GitHub CLI\gh.exe' auth git-credential`. The clone then worked with
  `GIT_TERMINAL_PROMPT=0`.
- **Claude Code:** logged in. `claude -p "Reply with the single word ok" --output-format json` returned
  `ok` on `claude-opus-5-5`. Before Aaron's `/login`, the same command returned `"Not logged in · Please
  run /login"`.

## 3. The clone and the build (step 3)

- **Clone:** `C:\Users\Aaron Melven\Worktrees\sia-qa`, a plain clone, **detached at 6075f6b**, which
  matched `origin/master` by `ls-remote` at the time. `git status --porcelain` is clean.
- **Line endings:** `core.autocrlf=true` is set system-wide by the Git installer, but `.gitattributes`
  wins. `git ls-files --eol` shows 429 files with `w/lf` and **0 with `w/crlf`**. The zero was checked
  against the non-zero lf count from the same instrument, so it is a count and not a pattern that
  matched nothing.
- **Build:** `npm ci` rc 0 and `npm run build` rc 0 in `open-brain`. **`better-sqlite3` took its prebuilt
  binary** (`prebuild-install`), with no compiler or build tools. It loads, and
  `select sqlite_version()` gives **3.51.3**. The only notable npm line was `prebuild-install@7.1.3`
  deprecated.

## 4. `/start` and the Probe seat (step 4): SKIPPED by ruling

**What was attempted and denied.** One batch that would have:
- written `.agents/AGENT.local.md` (`name: Probe`, `role: qa`) into the clone;
- added a SessionStart hook (`node "…/sia-qa/open-brain/build/cli-bootstrap.js"`) to that PC's
  `~/.claude/settings.json`, through a JSON parser, with the original backed up first;
- run `claude mcp add --scope user open-brain -- node
  "C:/Users/Aaron Melven/Worktrees/sia-qa/open-brain/build/server.js"`.

Claude Code's auto-mode classifier denied it: "[Self-Modification]". **None of it ran.** That PC's
`settings.json` is still `{"autoUpdatesChannel": "latest", "theme": "dark"}`, and its `claude mcp list`
shows only the claude.ai connectors.

**The planner's ruling:** skipped, not cleared. A headless QA run is driven by the planner's dispatch: it
reads the dispatch, the criteria and the rulings, runs the tests, and writes only its report. It needs
none of `/start`, open-brain MCP or the SessionStart hook, so that PC's Claude config is not modified.
The seat identity goes in the dispatch prompt instead of `AGENT.local.md`.

**T-154's question, answered on a real stranger's machine, as far as it got:**
- **`/start` is reachable**, because `.claude/commands/start.md` is tracked and arrives with the clone
  (as do `end.md`, `sync.md`, `checkpoint.md`, `harness-audit.md`, `task.md` and `test.md`).
- **The fresh machine has no open-brain MCP server, no SessionStart hook and no
  `~/.claude/open-brain/knowledge-v2.db`.** The first two can only come from writes to that user's
  Claude config. Nothing in the clone installs them, and in an agent-driven setup those writes are what
  the host's classifier stops. That is T-154's "installable by a stranger" gap, observed rather than
  argued.
- **Not tested, because step 4 did not run:** whether `ob_start` works against a store that does not
  exist yet, whether `cli-bootstrap.js` greets correctly without the store, and whether the documented
  `/start` completes.

## 5. The driving mode (step 5)

**The exact command**, run over plain ssh, where the remote shell is cmd:
```
ssh -l "Aaron Melven" 100.73.250.101 'cd /d "%USERPROFILE%\Worktrees\sia-qa" && "%USERPROFILE%\.local\bin\claude.exe" -p "Run git rev-parse HEAD in the current directory and reply with only the SHA." --output-format stream-json --verbose --permission-mode dontAsk --allowedTools "Bash(git rev-parse:*)" --max-turns 4'
```
- **Is it logged in:** yes (section 2).
- **How output returns:** stream-json on ssh's stdout, 8 lines, and the process exit code is 0.
  (`--output-format stream-json` with `-p` needs `--verbose`.) What came back:
  - **The init line reads back:** `permissionMode: "dontAsk"`, `cwd: C:\Users\Aaron Melven\Worktrees\sia-qa`,
    `model: claude-opus-5-5`, `session_id: 642d5e51-…`, and MCP servers = the claude.ai connectors only.
  - **The tool call:** one Bash `git rev-parse HEAD`, which returned `6075f6bd18d741ca7aeae901cab9ad9d282a1896`.
  - **The result line:** `success`, `is_error: false`, 2 turns, $0.118, `permission_denials: []`.
- **`dontAsk` plus `--allowedTools` is the permission shape a QA dispatch should use:** anything not
  listed is denied rather than prompted, and a denial shows up in `permission_denials`.
- **How a long run is detached and polled: DEMONSTRATED with the baseline itself.** Windows' OpenSSH
  server puts a session's processes in a job object that is killed when the session ends, so
  `start /b` does not survive. The method (`launch.ps1` and `baseline.ps1`):
  - launch with `Invoke-CimMethod Win32_Process Create`, which creates the process outside the ssh
    session's job object;
  - the child writes its log, a meta file (start, head, end, exit code, wall time) and a `done` marker
    to `%TEMP%\sia-setup`;
  - a later ssh session polls for the marker and reads the files.

  The observation: the launching ssh session returned `ReturnValue=0 ProcessId=8404` and **exited at
  23:39:33Z**. A fresh ssh session about 20 s later saw 6 node processes running and a meta file with
  `start` and `head` but no `done` marker. Polling every 15 s saw `done` at 23:42:37Z. So the run
  survived its launching session's end.
- **Reading the log back:** `scp` with the user name as the SOURCE failed (`Aaron Melven: invalid user
  name`, and `-o User=…` fails the same way). As a DESTINATION the `"Aaron Melven@host:path"` form works.
  To fetch a file, use `ssh … "type <path>" > local-file`.
- **One quoting hazard:** a Git Bash heredoc turned the `/\\/g` in a JavaScript file into `/\/g`. Write
  files with a tool that takes them verbatim.

## 6. Baseline (step 6): RAN, exit 1

### 6.1 How the PC was made quiet

**The first check found the PC not quiet**, and the brief says "with nothing else running on that PC".
At that check (the `quiet.ps1` and `procs.ps1` scripts):
- CPU 5%, but **free RAM 2.2 GB of 7.9**;
- **a second Windows account, `Members`, has four `claude.exe` processes in its disconnected session 1**:
  an interactive `claude` since 16:55, a `daemon run --origin transient` since 15:15, and a
  `--resume … --fork-session` session plus its `--bg-pty-host` started at 22:14 (PC time);
- **Aaron's own account** has a `claude.exe` (pid 15024, session 0) running since 18:23. It is probably
  the terminal he used for `/login`.

I touched none of them. **Aaron, in my window, verbatim: "I can restart that computer so it's quite. Do
it?"** Before answering I checked, read-only, that nothing would relaunch them: `AutoAdminLogon` is not
set, no scheduled task mentions claude or node, no HKLM Run entry mentions claude, and the `Members`
Startup folder is empty. I told him the restart would end the `Members` Claude sessions, which was his
call. He restarted the PC; it booted at 18:34:28 local time (-05:00).

**After the restart the PC was OFF the tailnet** (`tailscale status`: offline; `tailscale ping`: no
reply) until Aaron logged in. **Likely cause, not verified:** Tailscale's "Run unattended" is off, so on
Windows it connects only for a logged-in user. My read of the setting (`tailscale debug prefs | findstr
unattended`) printed nothing, which is not evidence either way. I gave Aaron the fix
(`tailscale set --unattended`, or the tray setting); whether he applied it is unknown.

**The quiet check before launch:** CPU 1%, 5.04 GB free, **0 node/claude processes**, and the `Members`
sessions gone. **Condition of the measurement:** Aaron's own console session was logged in and active
(since 18:34). Clone at 6075f6b, which `ls-remote` confirmed was still `origin/master` just before
launch; tree clean.

### 6.2 The result (G-042's second-machine measurement)

**What the log and the meta file show** (`baseline.log`, 1074 lines, read back with `ssh "type …"`).
The log is NOT in the repo, because `.gitignore:4` ignores `*.log`. It stays on the QA PC at
`%TEMP%\sia-setup\baseline.log`, next to `baseline.meta`.

| | |
|---|---|
| SHA | 6075f6b (`origin/master`) |
| Launched | 23:39:33Z, detached through WMI |
| **Exit code** | **1**, from `cmd /c "npm test > log 2>&1"`: a redirect, not a pipe |
| Wall time | **177.22 s** by the meta file; vitest's own `Duration 170.45s` (tests 436.74 s summed across workers) |
| Test files | **2 failed, 69 passed (71)** |
| Tests | **14 failed, 1020 passed (1034)** |
| `onTaskUpdate` lines | **0** |
| `Unhandled` lines | **0** |

The instrument was checked: the same log has 296 `✓` lines, so a zero count is a count. The first two
reads of this log produced zeros from a file that did not exist (the scp failure); those zeros were
discarded.

**Failure 1: 13 tests in `tests/cli-bootstrap.test.ts`** (the whole `cli-bootstrap SESSION_UUID contract`
block), each 2.7–3.2 s. Each fails with:
```
Error: Command failed: npx tsx C:\Users\Aaron Melven\Worktrees\sia-qa\open-brain\src\cli-bootstrap.ts
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\Aaron' imported from C:\Users\Aaron Melven\Worktrees\sia-qa\open-brain\
```
- **Observed:** the path reached `tsx` cut at the space in `Aaron Melven`.
- **Read from the code:** `tests/cli-bootstrap.test.ts:41` runs (its `shell` option is at :45, and a
  second spawn has the same option at :68)
  `execFileSync("npx", ["tsx", script], { …, shell: process.platform === "win32" })`. With `shell: true`,
  Node joins the arguments into one command string without quoting them.
- **Inference (consistent with both, not separately tested):** cmd splits the unquoted path at the space.
  This is a test-harness defect that needs a Windows user whose profile path contains a space.
- That is why it has never shown. On Aaron's main PC the profile is `C:\Users\melve`, with no space.
  On Linux CI there is no shell, so the argument array is passed verbatim.
- **Siblings:** a grep for `shell: process.platform === "win32"` in `open-brain` finds only those two call
  sites. The third hit, in `tests/harness/checks.test.ts:126`, is a string fixture, not a spawn.

**Failure 2: 1 test in `tests/shared/paths.test.ts:117`,** `projectDirExists / existsCaseInsensitive >
finds a mixed-case directory through its lowercased canonical path`: `expected false to be true` on
`existsCaseInsensitive(lowered)`.
- **Observed, as a separate check:** the same walk, replicated in `walk.cjs` and run alone over ssh, which
  creates the same kind of temp dir under `C:\Users\Aaron Melven\AppData\Local\Temp`, **succeeds at every
  level** and ends with `existsSync: true`. `%TEMP%` and `os.tmpdir()` are the long form, not an 8.3
  short name; that hypothesis was checked and is FALSE.
- **So the cause is NOT established.** The failure depends on something that differs between the suite's
  run and an isolated run: the WMI launch context, concurrency within the suite, or something else.
- **My attempt to run the diagnostic under the same WMI launch produced no output file.** That was my
  instrument failing (most likely the nested quoting in the WMI command line), not a result.
- **The discriminating next step:** run `npx vitest run tests/shared/paths.test.ts` alone through the WMI
  launcher, and again in a plain ssh session, and compare.

**What this does and does not say about G-042:**
- **Observed:** a quiet, second machine ran the full suite once at 6075f6b with **no `onTaskUpdate` and
  no Unhandled errors**, and failed for two reasons that are not timing.
- **Not inferred:** that G-042 is absent on this machine. It is n=1, and G-042 is load-dependent.
- **A caution for anyone reading exit codes from this machine:** it is red at `origin/master` for
  environment reasons (the space in the profile path). A QA verdict taken here must compare
  against this baseline's 14 known failures rather than expect green. Or the two defects get fixed first:
  the planner's call.

## 7. VS Code Remote-SSH (the planner's addition)

Not tested from Aaron's side. What the SSH setup implies:
- **The remote is Windows, with cmd as its default shell.** On HIS PC, set
  `"remote.SSH.remotePlatform": { "<host alias>": "windows" }`; otherwise Remote-SSH asks on first
  connect.
- **The username contains a space.** An `~/.ssh/config` entry avoids typing it:
  `Host qa-pc` / `HostName 100.73.250.101` / `User "Aaron Melven"`. OpenSSH accepts the quoted value,
  but I have not tried it with his VS Code.
- **Key auth works from this PC's `id_ed25519`.** A different client machine needs its public key
  trusted too. For an administrator account, Windows OpenSSH's default config reads
  `C:\ProgramData\ssh\administrators_authorized_keys`, not the user's own file. That is the default; I
  did not read that PC's `sshd_config`.
- **Remote-SSH will create `C:\Users\Aaron Melven\.vscode-server` on first connect.** That is expected,
  and I have left it alone.

## 8. How to undo each step

On desktop-o4egb1e, in an elevated shell (the ssh session is elevated):
```
:: step 3: the clone and the setup folder
rmdir /s /q "%USERPROFILE%\Worktrees\sia-qa"
rmdir "%USERPROFILE%\Worktrees"                      & :: only if empty; it was created for this
rmdir /s /q "%TEMP%\sia-setup"
:: step 2: auth (Aaron's accounts; the logouts are his call)
git config --global --unset-all credential.https://github.com.helper
git config --global --unset-all credential.https://gist.github.com.helper
gh auth logout --hostname github.com
"%USERPROFILE%\.local\bin\claude.exe"                & :: then /logout (Claude Code was present before; only the login is new)
:: step 1: the three tools
"C:\Program Files\Git\unins000.exe" /VERYSILENT /NORESTART
msiexec /x {8077DB9D-18D9-4DAF-8CA6-B8CAE42EB734} /qn /norestart   & :: Node.js 22.23.3
msiexec /x {05425DD6-E9FE-4AEE-B289-8B61429F042A} /qn /norestart   & :: GitHub CLI 2.101.0
```
(The product codes are read from that PC's Uninstall registry keys.) Step 4 changed nothing, so it
needs no undo. `%TEMP%\sia-setup` still holds the three installers (about 110 MB) and the scripts. It
stays until the baseline has run.

## 9. What was not verified

- **The cause of the `paths.test.ts` failure** (section 6.2): unexplained. The next step is named there.
- **The `cli-bootstrap` cause is inferred** from the error text and the spawn options. No fix was tested.
- **Tailscale "Run unattended"** on that PC (section 6.1).
- **Everything in step 4** (section 4).
- **Remote-SSH from Aaron's side** (section 7).
- **The `Members` sessions:** what they are and why they run are unknown, and they are Aaron's to
  explain.
