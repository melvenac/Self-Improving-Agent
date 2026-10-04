# QA 278 (s161f): #427 r3 on real Windows (rows 1, 4 and 7)

**Seat:** QA, headless Claude Code on Opus, record session 161. **Machine: the laptop (DESKTOP-0GV3HAD)**, Windows
10 Pro 19045, Windows PowerShell 5.1.19041.6456, Git Bash (MINGW64), node v22.23.2 at `C:\Program Files\nodejs\node.exe`.
2026-10-04. Dispatch: `docs/loops/qa-277-s161e-dispatch.md` (QA 278 = rows 1 and 4 for #427, and row 7).

**Worktree:** `git -C C:/qa-scratch/qa278-wt log -1 --format=%H` = `b5c19fa45228cbe070e0a52fe2e3c2d5615f771a`
(the DISPATCH_SHA).

**Candidate:** `C:/qa-scratch/qa278-pr427` @ `a6d75b52` (r3). Control: `C:/qa-scratch/qa278-r2base` @ `987901c9` (r2,
QA 276's head). Each was built with `npm ci` and `npm run build` in `open-brain`, all exit 0.

## Environment notes

- **Machine lease:** `machine-lease.ps1` run with **`-File`** (through `powershell.exe -NoProfile -ExecutionPolicy
  Bypass -File`). `take -OwnerPid 60388` (the claude.exe running this job) returned `lease=taken owner=qa pid=60388`,
  exit 0. At the end `release` returned `lease=released`, exit 0.
- **TMP/TEMP were NOT set by the launcher, a third time.** Both were `C:\Users\Aaron\AppData\Local\Temp` in the
  session. Every driver set `TMP=TEMP=C:\qa-tmp` and `npm_config_cache=C:\qa-tmp\npm-cache` in the child env.
- **Shells.** As for QA 276, the PowerShell legs ran as `powershell.exe -NoProfile -NonInteractive -Command …`
  (5.1), spawned from node drivers that were launched from Git Bash. The Git Bash legs ran as
  `C:\Program Files\Git\bin\bash.exe -c …`. Each row names the shell that ran the command under test. Drivers are in
  `C:\qa-tmp\qa278\` (`nops.mjs` is QA 276's `nops.mjs` plus a PowerShell 5.1 leg, a proof-file listing and timings;
  `legs.mjs` is QA 276's `legs.mjs` with the home prefix changed). Not committed.
- **Scratch homes** (each contains a space): `C:\qa-tmp\qa278 home nops r3`, `… nops r2`, `… nops r3b`, `… nops r3c`,
  `… r3`, `… r3host`, `… tests`. Each hook run set `HOME`, `USERPROFILE`, `OPEN_BRAIN_ACTIVE_SESSION`,
  `KNOWLEDGE_V2_DB`, the vault, score and shadow paths, `A2A_KEY_DIR` and `LOCALAPPDATA` inside the scratch home;
  every `CLAUDE*` variable and any `OPEN_BRAIN_PROCESS_TABLE` were removed.
- **Real files**, sha256 before vs after, no content read: `~/.claude/settings.json` **match**.
  `~/.cursor/hooks.json`, `~/.cursor/mcp.json` and `~/.claude/.mcp.json` are **absent**, before and after.
- **Builder model:** the PR body does not name one. The r3 commit carries `Co-authored-by: Cursor
  <cursoragent@cursor.com>` and no model. Per the dispatch, most likely Grok (`grok-4.7-high`); not confirmed here.
  QA is Opus, so builder ≠ judge holds.

## Row 1: Confined (Git Bash)

`git fetch origin refs/pull/427/head` → **`a6d75b5273091d75bbc127826853170fe3ddeb4a`**; `gh pr view 427` shows the
same `headRefOid`, OPEN, `loop/t235-p2-3` → master. Merge base with `origin/master` is `f8dc13a5`. Commits beyond
master: `270b550b` (r1), `987901c9` (r2), `a6d75b52` (r3: "a failed Win32 process table does not throw").

`git diff --stat origin/master...a6d75b52`:

| File | Change |
|---|---|
| `docs/loops/t235-p2-3-r2-measure.md` | +28 (new) |
| `open-brain/src/cli-bootstrap.ts` | 28 ± |
| `open-brain/src/server.ts` | 3 ± |
| `open-brain/src/shared/process-session.ts` | 280 ± |
| `open-brain/tests/fixtures-t003/cursor-agent/versions/e2e-fixture/index.js` | +22 (new) |
| `open-brain/tests/t003-r2.test.ts` | 2 ± |
| `open-brain/tests/t003-session-proof.test.ts` | 15 ± |
| `open-brain/tests/t235-p2-3-cursor-proof.test.ts` | +280 (new) |

r3 alone (`987901c9..a6d75b52`) touches only `cli-bootstrap.ts`, `process-session.ts` and
`t235-p2-3-cursor-proof.test.ts` (+167/−41): the table loader, its two callers (the hook and `proveSession`) and
their test. Every file is in T-235 P2-3. **No file outside the task. Row 1: PASS.**

## Row 4: CI, read only (Git Bash, `gh run view`)

Run **37196905886**: `headSha` = `a6d75b5273091d75bbc127826853170fe3ddeb4a`, event `pull_request`, branch
`loop/t235-p2-3`, conclusion `success`. Jobs: `changed` success; **`test` success** (10:54:48Z → 10:57:54Z);
**`test-windows` skipped**. **Row 4: PASS.** As at r1 and r2, this report is the only Windows evidence for the head.

## Row 7: F4 on real Windows

### F4 repro (QA 276's `nops.mjs` method)

`PATH` reduced to `C:\Program Files\nodejs` (and `/usr/bin` inside Git Bash), so `powershell.exe` cannot be
resolved by the hook's `execFileSync`. Each shell leg first checked that: Git Bash `command -v powershell.exe` and
PowerShell `Get-Command powershell.exe` both reported **not on PATH**. The fixture host
(`tests/fixtures-t003/cursor-agent/versions/e2e-fixture/index.js`) is present in every leg (`CURSOR_AGENT_HOST_PID`
was printed each time). The PowerShell leg launched `powershell.exe` by full path, then the chain
`Get-Content payload -Raw | & node <fixture> -- <boot> --ide cursor`.

| Build | Shell running the chain | Exit | Wall (3 runs) | Output | Proof file |
|---|---|---|---|---|---|
| **r3** | direct spawn (no shell) | **0** ×3 | 273 / 213 / 240 ms | `Session proof NOT written: Win32 process table: exit null: spawnSync powershell.exe ENOENT, so this session's server will refuse attributed writes.` 4 lines, no stack | none |
| **r3** | Git Bash | **0** ×3 | 332 / 256 / 295 ms | the same visible reason | none |
| **r3** | PowerShell 5.1 | **0** ×3 | 4055 (cold) / 1340 / 1439 ms | the same visible reason | none |
| **r3** | server side: `proveSession(…, {cursorWalk:true})`, PATH reduced | 0 ×3 | 3 ms | **returned** `{"id":null,"reason":"Win32 process table: exit null: spawnSync powershell.exe ENOENT"}` | n/a |
| r2 (control) | direct spawn | **1** | 291 ms | `Error: spawnSync powershell.exe ENOENT at loadWin32ProcessTable … at findCursorAgentHostPid`, 32 lines, no proof line | none |
| r2 (control) | Git Bash | **1** | 328 ms | the same crash, 33 lines | none |
| r2 (control) | PowerShell 5.1 | **1** | 1643 ms | the same crash, 33 lines | none |
| r2 (control) | server side | — | — | **THREW** `ENOENT spawnSync powershell.exe ENOENT` | n/a |

The r2 control reproduces QA 276's F4 on the same laptop, from all three launches, and r3 closes it from all three:
exit 0, one visible `Session proof NOT written: <reason>` line, no proof file, and the server side returns a refusal
instead of throwing.

### Legs C and D again (no host, normal PATH, r3)

| Leg | Shell | Exit | Wall | Output | Proof file |
|---|---|---|---|---|---|
| C | PowerShell 5.1 | 0 ×3 | 1202 / 1229 / 1254 ms | `Session proof NOT written: no cursor-agent host process found in the hook's ancestor chain, …` | none (listing empty) |
| D | Git Bash | 0 ×3 | 922 / 912 / 911 ms | the same | none |

Compared with QA 276 on r2 (same laptop): C 1446 / 1394 / 1392 ms, D 1023 / 1183 / 1052 ms. No regression: r3's
no-host path is the same one CIM spawn.

### Control: with a host and a working PATH (r3, not required by the row)

So that "no proof" above is not just "proofs are broken": legs A (PowerShell 5.1) and B (Git Bash), twice each,
all exit 0 and wrote `by-pid/<hostPid>.json` with `session_id` equal to the payload, `claude_pid` equal to the
fixture host's pid and `ide=cursor`. Wall times: A 1678 / 1685 ms, B 1343 / 1341 ms (QA 276 on r2: A ~1.9–2.0 s,
B ~1.5 s).

### Touched test file on Windows (node driver, scratch HOME)

`tests/t235-p2-3-cursor-proof.test.ts`: **11 passed** (r2 had 8), exit 0, 12.6 s.

**Row 7: PASS. F4 is closed on real Windows.**

## Observations (not findings)

- **O1, cosmetic.** On a spawn failure `execFileSync`'s error has `status: null`, and `loadWin32ProcessTable`'s check
  (`status !== undefined && status !== 0`) lets `null` through, so the reason reads `exit null: spawnSync
  powershell.exe ENOENT`. There was no exit; `status != null` would print the plain spawn error. Wording only; the
  behaviour is correct.
- **O2, for the planner.** r3 adds a test seam to production code: `OPEN_BRAIN_PROCESS_TABLE` (`throw:*`, `empty`,
  `bad-json`, `json:<table>`). When set, it also turns the table walk on for non-win32 platforms. `json:` lets
  whoever controls the hook's environment supply the whole process table, and so name any live pid as the
  cursor-agent host. `processStartTime` then reads that pid's real start time, and the hook writes a proof for it.
  Anyone who controls that environment can already do a lot, so this is not a finding. Still, a forged-table input
  in shipped code goes against "attribution fails closed". Injecting `loadTable` (already a parameter of
  `resolveCursorAgentHost`) would serve the tests without it. Not verified beyond reading the diff; out of this
  seat's rows (QA 277's row 6 covers the injection).
- `test-windows` was skipped on CI for this head (row 4), so the Windows walk still has no CI coverage.

## Verdict (#427 r3, QA 278's rows)

| PR | Pinned head | Rows | Verdict |
|---|---|---|---|
| #427 | `a6d75b5273091d75bbc127826853170fe3ddeb4a` | 1 PASS (confined), 4 PASS (CI `test` green, run 37196905886), 7 PASS (F4 closed from direct spawn, Git Bash and PowerShell 5.1; server returns `{id:null, reason}`; legs C/D exit 0 with a visible reason and no proof, ~1.2 s / ~0.9 s) | **ACCEPT** |

This verdict covers the Windows half only. The Linux rows (2, 3, 5, 6) are QA 277's.

QA-278: REPORT COMPLETE
