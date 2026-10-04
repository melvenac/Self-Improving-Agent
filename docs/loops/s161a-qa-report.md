# QA 273 (s161a) report: #421 r2, #424, #425, #427 (Plumb, Linux)

**By:** QA 273, record session 161, headless Claude Code on Opus on Plumb (Linux). Nobody watching live.
**Dispatch:** `docs/loops/qa-273-s161a-dispatch.md` at DISPATCH_SHA `0565c51ff97bac036cd4cac18bfa4ce4e1b2729d`.
`git -C ~/qa-scratch/qa273-wt log -1 --format=%H` → `0565c51ff97bac036cd4cac18bfa4ce4e1b2729d`.
Rows marked **[W]** (15, 20) were not run; they belong to QA 274.

## Verdicts

| PR | Pinned head | Verdict | Why, in one line |
|---|---|---|---|
| #421 r2 (G-053) | `9915a59baad67d9e29a415adec0a931b335c1cba` | **REJECT** | The code is right, but row 5 asks for a row per value and `"-0"` has none. Two mutants on exactly what r2 was for both survive: admitting `-0`, and widening to `gc.auto*` (which admits `gc.autoPackLimit=0`). |
| #424 (T-235 P2-6) | `12c289264e433bb306f55e212193a7a2448c2eca` | **REJECT** | Row 9: a user-modified `~/.cursor/commands/task.md` is overwritten without saying so. The new names (`task.md`, `test.md`) are generic, so they are the likeliest to collide with a user's own file. |
| #425 (T-235 P2-4) | `9fcb97ca8bb266c03cef7501c4b2b831c8d1601b` | **ACCEPT**, and still **HELD** per the dispatch | Rows 1–4, 12, 13, 14 pass. Row 16 confirms the double run. Row 15 is [W]. |
| #427 (T-235 P2-3) | `270b550b97ada09f50c256f381e4ec26ff98782a` | **REJECT** | Row 19: a proof is written for the wrong pid (the hook's own) when no `cursor-agent` ancestor exists. The Cursor bootstrap branch has no end-to-end test, so a wrong-pid mutant survives every test file. |

## Method and environment

- Node v22.22.1, npm 11.21.0, git 2.53.0. `TMPDIR=~/qa-tmp` and `npm_config_cache=~/qa-tmp/npm-cache` were set for every
  npm, npx and vitest run, through a small runner (`~/qa-tmp/run.mjs`).
- `npm ci` was run once in `qa273-merge/open-brain`. Every other tree got `node_modules` as a symlink to it, which is
  safe because none of the four PRs, and no base between them, changes `package.json` or `package-lock.json` (diffed).
- Worktrees:
  - `qa273-wt`: the dispatch SHA.
  - `qa273-pr<N>`: each pinned head.
  - `qa273-base<N>`: each PR's merge-base with `origin/master`. 421: `651ac36b`; 424 and 425: `71b2b924`;
    427: `f8dc13a5`.
  - `qa273-merge`: the batch.
- `origin/master` moved after dispatch to `3bcd7d72` (#438, the QA 275 dispatch, docs only). Per D-117 the pinned heads
  were QA'd as they are.
- All four fetched PR heads equal the pinned SHAs.
- **Real profile, G-051** (match / no-match only): `~/.cursor/hooks.json` (absent), `~/.cursor/mcp.json` (absent),
  `~/.claude/settings.json`, `~/.claude.json` and `~/.claude/settings.local.json` (absent). These were hashed before
  any setup run and re-hashed after each `setup.mjs` run, after row 21 and after row 22. **Every comparison: match.**
- No live state, DB, Jev or settings write was made. `gh` was used read-only.

## Rows for every PR

### Row 1: Confined (files beyond `origin/master`, three-dot)

| PR | Commits | Files | Outside the task? |
|---|---|---|---|
| #421 | `82aeb3da`, `9915a59b` | `open-brain/src/harness/configwatch.ts`, `open-brain/tests/harness/config-channel.test.ts`, `open-brain/tests/harness/fixture.ts` | none |
| #424 | `12c28926` | `open-brain/src/pipelines/sync/checks.ts`, `open-brain/tests/setup-cursor-commands.test.ts`, `project-template/.cursor/commands/{harness-audit,task,test}.md`, `scripts/setup-hooks.mjs`, `scripts/setup.mjs` | none |
| #425 | `9fcb97ca` | `open-brain/tests/setup-hooks.test.ts`, `open-brain/tests/setup-scratch-home.test.ts`, `scripts/setup-hooks.mjs`, `scripts/setup.mjs` | none |
| #427 | `270b550b` | `open-brain/src/cli-bootstrap.ts`, `open-brain/src/server.ts`, `open-brain/src/shared/process-session.ts`, `open-brain/tests/fixtures-t003/cursor-agent-host.cjs`, `open-brain/tests/t003-r2.test.ts`, `open-brain/tests/t003-session-proof.test.ts`, `open-brain/tests/t235-p2-3-cursor-proof.test.ts` | none. **Note:** `t003-session-proof.test.ts` *deletes* an assertion (see #427). |

### Row 2: Red then green

The head's test files were checked out onto the base tree and run against the base source, then run at the head.

| PR | File | Base (red) | Head (green) |
|---|---|---|---|
| #421 | `tests/harness/config-channel.test.ts` vs master base `651ac36b` | 36 failed / 7 passed (43). Master refuses `gc.auto` itself, and the fixture now sets it. | 43 passed (43) |
| #421 | same file vs r1 source `82aeb3da` (the narrow red for r2) | 4 failed / 39 passed (43): the four new G-053 r2 rows | 43 passed (43) |
| #424 | `tests/setup-cursor-commands.test.ts` | 3 failed / 1 passed (4): `copyCursorSlashCommands is not a function`, and `task.md` absent | 4 passed (4) |
| #425 | `tests/setup-hooks.test.ts` | 6 failed / 11 passed (17) | 17 passed (17) |
| #425 | `tests/setup-scratch-home.test.ts` | 1 failed (1): no `cli-session-end.js` entry | 1 passed (1) |
| #427 | `tests/t235-p2-3-cursor-proof.test.ts` | 3 failed / 1 passed (4) | 4 passed (4) |
| #427 | `tests/t003-r2.test.ts` | 1 failed / 8 passed (9): the D5 message | 9 passed (9) |
| #427 | `tests/t003-session-proof.test.ts` | 18 passed (18). Not red: the change only *removes* an assertion. | 18 passed (18) |

Also green at the heads:

- #424: `mirror-parity` 13/13 and `setup-hooks` 11/11.
- #427: `server` 35/35.
- `tsc --noEmit` and `npm run typecheck:tests` exit 0 on all four pristine heads.

### Row 3: Mutants

Each mutant was applied in the head's scratch tree. The edit was confirmed with `git diff`, `tsc --noEmit` was run on
it, and the file was restored with `git checkout` afterwards. Every tree was confirmed clean afterwards.

| PR | Mutant | Whose | tsc | Result |
|---|---|---|---|---|
| #421 | `value === "0"` → `value.trim() === "0"` (the r1 trim) | dev's | 0 | **killed**: 2 failed (`no trim`, `trailing newline`) |
| #421 | admit `"-0"` as well as `"0"` | mine | 0 | **SURVIVED**: 43/43 |
| #421 | `key === "gc.auto"` → `key.startsWith("gc.auto")` (admits `gc.autoPackLimit=0`) | mine | 0 | **SURVIVED**: 43/43 |
| #424 | delete the real `project-template/.cursor/commands/task.md` (the dev's mutant, applied to the product) | dev's | 0 | **SURVIVED** at unit level: `setup-cursor-commands` 4/4 and `mirror-parity` 13/13 pass. The dev's test drops `task.md` from a synthetic fixture, not from the real template. My own call to `checkMirrorParity` on the real tree does flag it, so only a live `/sync` would catch it. |
| #424 | remove the `filesIdentical` skip (always copy) | mine | 0 | **killed**: 1 failed (`idempotent`) |
| #425 | `withCursorSessionEndHook` never pushes (the dev's "always configured", applied to the product) | dev's | 0 | **killed**: 5 failed |
| #425 | command uses bare `node` instead of the absolute node path | mine | 0 | **killed**: 3 failed |
| #427 | `proveSession` returns the direct result and never walks (`if (direct.id !== null \|\| options.cursorWalk) return direct;`). The first form I tried, `\|\| true`, failed tsc (narrowing), so it was replaced. | dev's | 0 | **killed**: 2 failed |
| #427 | `cli-bootstrap` Cursor branch writes `claude_pid: process.pid` instead of `hostPid` | mine | 0 | **SURVIVED**: `t235-p2-3-cursor-proof` 4/4, `t003-r2` 9/9, `t003-session-proof` 18/18 |

**Every in-file "mutant:" test is tautological.**

- #421's two "mutant" `it`s assert a regex literal (`/^0/.test("00")`, `/^gc\./.test(...)`) beside the product call.
- #425's "mutant" `it` builds a local `alwaysConfigured` lambda and asserts on it.

Neither mutates the product, so neither is evidence that the suite kills anything. Nit, not blocking.

### Row 4: CI (read only)

| PR | Run | headSha | `test` | `changed` | `test-windows` |
|---|---|---|---|---|---|
| #421 | 37183028599 | `9915a59baad67d9e29a415adec0a931b335c1cba` | success | success | skipped |
| #424 | 37180101429 | `12c289264e433bb306f55e212193a7a2448c2eca` | success | success | skipped |
| #425 | 37180118545 | `9fcb97ca8bb266c03cef7501c4b2b831c8d1601b` | success | success | skipped |
| #427 | 37180595977 | `270b550b97ada09f50c256f381e4ec26ff98782a` | success | success | skipped |

Each run's `headSha` is the pinned head (event `pull_request`).

## #421 r2 (G-053)

**Row 5: the trim is gone. PASS on the code, FAIL on coverage.**

- There is no longer a regex for `gc.auto`: r2 removed the `SAFE_LOCAL_KEYS` entry.
- `isAllowedLocalConfigEntry` (`configwatch.ts:1455`) now short-circuits on any key that starts with `gc.`, to
  `key === "gc.auto" && value === "0"`.
- `unsafeLocalKeys` reads `git config --file <f> --list -z`, splits key and value on the first `\n`, lowercases the
  key, passes the value raw, and no longer calls `.trim()` anywhere.
- I drove a real `git config` through `unsafeLocalKeys` (`~/qa-tmp/probe421.mts`):
  - `"0"` is admitted.
  - `" 0"`, `"\t0"`, `"0 "`, `"0\n"`, `"00"`, `"0x"`, `"1"`, `"-0"` and `"+0"` are **all REFUSED**, with the stored
    value read back equal to the input.
  - `GC.AUTO=0` is admitted, correctly: git normalises the case of section and key names.
- Coverage rows:
  - `" 0"`, `"0 "`, `"\t0"`, `"00"` and `"0x"`: through real config and refusal, in the loop at `config-channel.test.ts:733`.
  - `"0\n"`: a direct function call only (`:747`).
  - `"1"`: the r1 row at `:727`.
  - **`"-0"`: no row anywhere in `open-brain/tests`** (grep). The surviving mutant above proves it.

**Row 6: nothing else is admitted. PASS on the code, FAIL on coverage.**

- `gc.autoDetach`, `gc.autoPackLimit`, `gc.pruneExpire`, `gc.reflogExpire` and `gc.foo.reflogExpire` are all refused
  (probe).
- `info/` is still watched (`configwatch.ts:90-91`, unchanged).
- `SAFE_LOCAL_KEYS` diffed against `82aeb3da`: the only change is the removal of the `gc.auto` line. The other seven
  entries are byte-identical, and three-dot against master the array is unchanged.
- Only `gc.autodetach=1` has a test. The `gc.auto*` prefix mutant survives, so `gc.autoPackLimit=0` would be admitted
  without a red.

**Row 7: no flake. PASS.** `config-channel.test.ts` five times in a row at the head:

| Run | Result | Exit |
|---|---|---|
| 1 | 43/43 | 0 |
| 2 | 43/43 | 0 |
| 3 | 43/43 | 0 |
| 4 | 43/43 | 0 |
| 5 | 43/43 | 0 |

**Row 8: `makeRepo` JSDoc. Fixed in r2.** `disableAutoGc` and its JSDoc now sit after `makeRepo`
(`fixture.ts:132-135`), so `makeRepo`'s JSDoc (`:72-79`) directly precedes `makeRepo` again.

**#421 verdict: REJECT** `9915a59baad67d9e29a415adec0a931b335c1cba`.

- The product is correct. The gate fails because the dispatch requires a row for each value and `-0` has none.
- Fix, which is tests only:
  - Add `"-0"` (and ideally `"+0"`) to the loop at `:733`.
  - Add a refusal row for `gc.autoPackLimit=0` (a *zero* value under another `gc.*` key), which kills the prefix mutant.

## #424 (T-235 P2-6)

**Row 9: install is idempotent and bounded. FAIL on the user-file clause.** Probe `~/qa-tmp/probe424.mjs`, real
template, scratch cursor dir:

- **Run 1:** `{copied:7}`. The files are exactly `checkpoint, end, harness-audit, start, sync, task, test`, which equals
  `CURSOR_COMMAND_SET`, and the template directory holds exactly those seven.
- **Run 2:** `{copied:0}`, with all seven sha256 hashes identical to run 1.
- **User-modified `task.md`:** run 3 returns `{copied:1}`.
  - The user's content is **replaced by the template**.
  - The function prints nothing.
  - `setup.mjs` would log only `✓ 1 Cursor slash command(s) copied → …`. It does not name the file and does not say
    that a user's file was overwritten.
  - A user-only `mine.md` is left alone.
- This is the same semantics as master's `copyFileIfChanged`, so it is not new behaviour. But #424 is what puts
  `task.md` and `test.md` into `~/.cursor/commands/`, and those are names a user plausibly already has, and the row's
  gate is explicit.
- Fix options:
  - Refuse to overwrite a differing file that setup did not write (a hash manifest).
  - Or at least name it: `overwrote ~/.cursor/commands/task.md (was user-modified)`.

**Row 10: the commands are honest for Cursor. PASS.** Each Cursor copy diffed against its `.claude/commands/` original:

- **`task.md`** (vs `project-template/.claude/commands/task.md`, which is identical to the repo-root copy): the body is
  byte-identical. Added: a title line and a `> Cursor Composer: run this inline …` note.
- **`test.md`** (vs the template copy, identical to the repo root): the title gains `(Cursor + SIA)`, and a 2-line
  Cursor note is added. The body is identical.
- **`harness-audit.md`** (vs the repo-root `.claude/commands/harness-audit.md`; the template `.claude` has no copy):
  - The title gains `(Cursor + SIA)`, and a 3-line note documents the host tool difference.
  - Line 16: "use Agent tool with subagent_type=Explore" → "use Task with `subagent_type=explore`", which is a
    documented tool-call difference.
  - One read target is **added**: `project-template/.cursor/commands/`.
  - 103 → 108 lines.
- **No step is dropped or silently omitted in any of the three.**

**Row 11: mirror-parity fails for each of the three. PASS on the product.**

- `checkMirrorParity` loops over the whole `CURSOR_COMMAND_SET` (`checks.ts:1068`).
- I copied the real tree's three command directories to scratch and removed each new file in turn. Result:
  - None removed: `pass`.
  - `task.md` removed: `issue`, "template (.cursor): task.md missing".
  - `test.md` removed: `issue`, same message.
  - `harness-audit.md` removed: `issue`, same message.
- On the real tree with a scratch home, the result is `pass`.
- Coverage nit: the unit test only removes `task.md`, and from a synthetic fixture.

**#424 verdict: REJECT** `12c289264e433bb306f55e212193a7a2448c2eca`, on row 9 only. Rows 1–4, 10 and 11 pass.

## #425 (T-235 P2-4)

**Row 12: scratch HOME only. PASS.**

- `setup-scratch-home.test.ts` at the head: 1/1 (33.8 s).
- Real `~/.cursor/hooks.json` (absent) and `~/.claude/settings.json`: hashes **match** before and after. So do
  `~/.cursor/mcp.json` (absent) and `~/.claude.json`.
- `setup.mjs` writes only under `os.homedir()` and the tree's own `open-brain/build` (read: `main()` at
  `setup.mjs:296`).
- Note: when the real `~/.cursor/hooks.json` is absent, as on Plumb, the test's own real-profile assertion compares
  `null` with `null`.

**Row 13: idempotent, user hooks kept, absolute command. PASS.** I ran `setup.mjs` twice myself
(`~/qa-tmp/probe425.mjs`), under a scratch HOME whose path contains a space (`…/scratch home`), with a user
`sessionEnd` hook and a `stop` hook.

- Run 1:
  - Exit 0.
  - `sessionEnd` = `[{"command":"echo my-user-end-hook"}, {"command":"\"/usr/bin/node\" \"/home/agents/qa-scratch/qa273-pr425/open-brain/build/cli-session-end.js\""}]`.
  - `stop` is kept.
  - Logged: "sessionEnd hook registered".
- Run 2:
  - Exit 0.
  - `hooks.json` is **byte-identical** to run 1.
  - Logged: "sessionEnd hook already configured".
- The exact command written is `"/usr/bin/node" "/home/agents/qa-scratch/qa273-pr425/open-brain/build/cli-session-end.js"`.
  Both paths are absolute and exist after the build.
- Observation: any other `sessionEnd` entry whose command *contains* `cli-session-end.js` is treated as stale and
  replaced. This includes a user's own wrapper around it, and a second checkout's registration. It is the same rule as
  sessionStart. Not blocking.

**Row 14: Claude Code byte-identical. PASS.**

- `withSessionHooks` from base `71b2b924` and from the head was run on four inputs (empty, empty hooks, a stale
  SessionStart, a user SessionEnd).
- Output is identical on 4/4, and the function source text is identical.
- `setup.mjs`'s call site (`:151`) is unchanged.

**Row 15 [W]:** not run (QA 274).

**Row 16: double run (observation).** **Yes**: with Claude Code's `SessionEnd` registered in `~/.claude/settings.json`,
a Cursor session would reach `cli-session-end.js` twice.

- `SESSION_HOOKS` registers `['SessionEnd','cli-session-end.js']` for Claude Code (`setup-hooks.mjs:20`). Per forge's
  P2-7 measurement, Cursor also runs Claude Code's hooks.
- #425 adds a second, Cursor `sessionEnd` entry for the same script.
- `cli-session-end.ts` has no once-per-session guard. Each run does all of the following:
  - The proof removal, a no-op under Cursor because `CLAUDE_PID` is unset.
  - The handoff check, including `recordMissingHandoff`.
  - `sessionEndV2`, with ratings and summary.
- So under Cursor the handoff warning would be recorded twice, and `sessionEndV2` would run twice for one session.
  This is the reason for the hold.

**#425 verdict: ACCEPT** `9fcb97ca8bb266c03cef7501c4b2b831c8d1601b`, **HELD** per the dispatch until P2-7's guard lands.
It is still subject to QA 274's row 15.

## #427 (T-235 P2-3)

**Row 17: the walk. PASS on Linux, with a finding.** Probe `~/qa-tmp/probe427.mts` drove the real `src/cli-bootstrap.ts`
(tsx loader in-process) through `tests/fixtures-t003/cursor-agent-host.cjs`:

| Input | Result |
|---|---|
| `cursor_version` | "Session proof written … for cursor-agent host process 2571637"; `by-pid/2571637.json` with `claude_pid=2571637`, `ide=cursor`. 2571637 is the fixture's own pid, which it printed. |
| `--ide cursor` + `cursor_version` | same, for host 2571657 |
| `--ide cursor` alone, no `cursor_version` | **NOT written** ("cursor payload has no cursor_version (D5)") |

So the row's "with `--ide cursor` **or** a `cursor_version` payload" is not what the code does: `--ide cursor` alone
fails closed and cites D5. That is safe; the planner should confirm it is the intended rule.

**Matchers:**

- In #427 there is **one** function, `findCursorAgentHostPid` (`process-session.ts`, regex `/cursor-agent/i` on the
  command line). Both the hook (`cli-bootstrap.ts:126`) and the server (`proveSession` with `cursorWalk`) call it, so
  it is not two copies.
- D-118a (state `decisions[]` D-119) is **a prose rule with no code**: "nearest ancestor of the shell whose
  CommandLine contains 'cursor-agent', found by walking Win32_Process ParentProcessId". Seats run it by hand, and
  `machine-lease.ps1` only takes `-OwnerPid`.
- So there are two definitions of "the cursor-agent owner": the D-118a prose and this function. They are not two code
  copies, but they also do not share code. **They already differ:** D-118a walks *ancestors of the shell*, while
  `findCursorAgentHostPid(process.pid)` tests the hook's **own** process first. See row 19.
- Finding, not blocking alone: the lease tooling should call this function, or the rule should name it.

**Row 18: Claude Code unchanged. PASS.**

- A Claude payload (`session_id`, no `cursor_version`, no `--ide`, `CLAUDE_PID` = a live pid) through the base
  `f8dc13a5` and the head `cli-bootstrap.ts` produces the same line: "Session proof written … for claude process
  2571499".
- The same file name, `by-pid/2571499.json`, with 182 bytes each, **identical once `written_at` is normalised** (the
  only field that is a timestamp).
- `server.ts`: `cursorWalk` is enabled only when `OPEN_BRAIN_IDE=cursor`. Otherwise `proveSession(dir, parent, start)`
  goes straight to `proveSessionClaude`, which is master's body unchanged, apart from one deleted comment.
- With `cursorWalk`, the direct parent is still tried first.

**Row 19: fails closed. FAIL.**

| Input | Result |
|---|---|
| `cursor_version`, no `cursor-agent` ancestor (also with `--ide`, also with `CLAUDE_PID` set) | NOT written, "no cursor-agent host process found in the hook's ancestor chain …"; no file |
| `ob_set_session` with a claim other than the proven id (`t235-p2-3-cursor-proof` "last SessionStart wins") | refused; passes |

**Wrong pid (confirmed, `~/qa-tmp/probe427b.mts`):**

- Setup:
  - The same head tree, reached through a path containing `cursor-agent` (a symlink
    `…/my-cursor-agent-tools → qa273-pr427`).
  - `--ide cursor`, a `cursor_version` payload.
  - **No `cursor-agent` process anywhere in the ancestry.**
- Result:
  - Output: "Session proof written: session aaaaaaaa-… for cursor-agent host process 2571840".
  - The file written is `by-pid/2571840.json`.
  - 2571840 was **the hook process itself**, and it was gone once the hook exited.
- Cause: `findCursorAgentHostPid(process.pid)` tests the starting pid's own command line, and the hook's command line
  contains its script path.
- In a real Cursor run from such a path, the hook would write its own pid while the server (which walks from its
  *parent*) looks up the real host. Attribution then never works, yet the hook reports "Session proof written".
- This breaks "never a proof for the wrong pid", and it diverges from D-118a's "ancestor".
- Fix:
  - Start the walk at `process.ppid`, or skip `fromPid`.
  - Preferably also match the host by executable or entry script, not by substring anywhere in the command line.

**Coverage gaps, which make the row-19 defect invisible to the suite:**

- `cursor-agent-host.cjs` is **never spawned** by any test. It appears only as a string in a hand-built chain
  (`t235-p2-3-cursor-proof.test.ts:105`), so the Cursor branch of `cli-bootstrap.ts` has no end-to-end test. The
  `claude_pid: process.pid` mutant survives all three files.
- `t003-session-proof.test.ts` **deletes** the Cursor-payload "no proof" assertion and adds no replacement for what a
  Cursor payload now does under a Claude shell. Probe: it now walks, and fails closed with "no cursor-agent host …".
- Observation: under Cursor, `cli-session-end` removes proofs only when `CLAUDE_PID` is set, so a Cursor proof is never
  removed at session end. The next sessionStart overwrites it, and `proc_start` guards against pid reuse. Not
  blocking; worth a line in P2-7.

**Row 20 [W]:** not run (QA 274). The Windows process API used, read from the code for context: `readProcessParent` on
win32 runs `powershell.exe -NoProfile -NonInteractive -Command Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`
once per ancestor, with a 15 s timeout each. Linux reads `/proc/<pid>/stat` and `/proc/<pid>/cmdline`; other platforms
use `ps -o pid=,ppid=,command=`.

**#427 verdict: REJECT** `270b550b97ada09f50c256f381e4ec26ff98782a`, on row 19 (wrong-pid proof). Also needed:

- An end-to-end test that spawns `cursor-agent-host.cjs` and asserts `by-pid/<hostPid>.json` (this kills the wrong-pid
  mutant).
- A replacement assertion for the deleted `t003-session-proof` line.

## Batch merge (row 21)

In `~/qa-scratch/qa273-merge`, from `0565c51f`, `--no-ff` in order (scratch identity `qa273`, nothing pushed):

| Merge | Result |
|---|---|
| #421 | `ebeb15f2`, clean |
| #424 | `2ec704ef`, clean |
| #425 | **CONFLICT in `scripts/setup.mjs`**, one hunk (below). `scripts/setup-hooks.mjs` **auto-merged** with no conflict: #424 adds the `fs`/`createHash` imports and `copyCursorSlashCommands` at the end, #425 adds `withCursorSessionEndHook` before `repoRootFrom`. The `registerCursorHooks` body (#425) and the `installCursorSlashCommands` rename (#424) also auto-merged. Committed as `9dd476ab`. |
| #427 | `d380162c`, clean. **Merged tree = `d380162c1ca26273425172e4d18ab2aa4ca91313`.** |

The conflict hunk is the `import { … } from './setup-hooks.mjs'` line:

- #424 adds `copyCursorSlashCommands`.
- #425 adds `withCursorSessionEndHook`.

**Resolution: mechanical**, the union:
`import { withSessionHooks, withCursorMcp, withCursorSessionHook, withCursorSessionEndHook, repoRootFrom, copyCursorSlashCommands } from './setup-hooks.mjs';`.
`node --check` passes on both scripts, and no conflict markers remain.

| Check on `d380162c` | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `npm run typecheck:tests` | exit 0 |
| `npm run build` | exit 0 |
| `node --check build/server.js` | exit 0 |
| `node --check build/cli-bootstrap.js` | exit 0 |
| `tests/harness/config-channel.test.ts` | 43/43, exit 0 |
| `tests/setup-cursor-commands.test.ts` | 4/4, exit 0 |
| `tests/setup-hooks.test.ts` | 17/17, exit 0 |
| `tests/setup-scratch-home.test.ts` | 1/1, exit 0 |
| `tests/t003-session-proof.test.ts` | 18/18, exit 0 |
| `tests/t003-r2.test.ts` | 9/9, exit 0 |
| `tests/t235-p2-3-cursor-proof.test.ts` | 4/4, exit 0 |
| `tests/pipelines/sync/mirror-parity.test.ts` | 13/13, exit 0 |
| `tests/server.test.ts` | 35/35, exit 0 |

The real profile hashes matched after these runs.

## Full suite (row 22)

`npx vitest run` once in `qa273-merge/open-brain` at `d380162c`. Reported separately (G-042):

| Measure | Result |
|---|---|
| **Test files** | 184 passed (184) |
| **Tests** | **2643 passed, 0 failed**, 5 skipped (2648) |
| **Errors** | **1 unhandled error**: `Error: [vitest-worker]: Timeout calling "onTaskUpdate"` (rpc heartbeat timeout; no test named, no product stack) |
| **Exit code** | **1**, caused by that unhandled error alone |
| **Duration** | 631.88 s wall (tests 1024.98 s summed across workers) |

- That error is the worker-heartbeat symptom `tests/harness/fixture.ts` describes: synchronous spawns blocking the
  worker's event loop under load. vitest warns that it "might cause false positive tests".
- I ran no master-baseline full suite (the dispatch is LIGHT), so I **cannot say** whether master shows it on Plumb.
- No test failed, but the suite **did not exit 0**. The planner should weigh that rather than read it as green.
- The real profile hashes matched after the run.
- Environment note: the run took longer than the tool's 600 s foreground limit, and the harness moved it to the
  background on its own. I did not start it in the background. It was awaited to completion before this report was
  written.

## Findings summary

1. **#427, blocking.** The Cursor proof walk starts at the hook's own pid. When the install path contains
   `cursor-agent` and there is no host, it writes a proof for the wrong (dead) pid and reports success. It also
   diverges from D-118a's "ancestor".
2. **#427, blocking with 1.** No end-to-end test of the Cursor bootstrap branch: the fixture is never spawned, and the
   wrong-pid mutant survives. A Cursor fail-closed assertion was deleted from `t003-session-proof` without replacement.
3. **#424, blocking (row 9).** A user-modified `~/.cursor/commands/<name>.md` is silently overwritten. This was
   pre-existing, but it is now reached by the generic `task.md` and `test.md`.
4. **#421, blocking (row 5).** There is no `-0` row, and no zero-valued other-`gc.*` row; two mutants survive. The code
   is correct, so the fix is tests only.
5. **#425, observation (row 16).** A Cursor session would run `cli-session-end.js` twice, with no guard; hence the hold.
6. **#427, observation.** `--ide cursor` without `cursor_version` writes no proof (D5). The row text says "or"; the
   planner should confirm.
7. **#427, observation.** D-118a's matcher exists only as prose. The two definitions already differ (self versus
   ancestor).
8. **Nits.**
   - The in-file "mutant:" tests in #421 and #425 do not mutate the product.
   - #424's parity test only removes `task.md`.
   - #424's dev mutant on the real template survives at unit level.
   - #425's stale-entry rule replaces any `sessionEnd` command that contains `cli-session-end.js`.
   - #421's QA 272 JSDoc nit is fixed.

QA-273: REPORT COMPLETE
