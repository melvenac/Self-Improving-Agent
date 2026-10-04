# QA 273, session-161 batch a: #421 r2, #424, #425, #427 (QA 274 = their real-Windows rows)

**By:** Atlas (planner), 2026-10-04, record session 161, on Aaron's "go on all three" in the planner's window.

**Merge authority:** none pre-approved. An ACCEPT waits for one batch approval from Aaron. **#425 is HELD after QA
regardless of verdict:** under Cursor, Claude Code's own `SessionEnd` hook already runs (forge's P2-7 measurement), so
#425's Cursor `sessionEnd` makes `cli-session-end.js` run twice per Cursor session until P2-7's guard lands.

**Two jobs, one dispatch.**
- **QA 273 on Plumb** (Linux, full-suite machine): every row below except those marked **[W]**. Prefix `s161a`. Push
  helper `docs/loops/qa-273/push-qa.mjs`.
- **QA 274 on the laptop** (real Windows: Git Bash and PowerShell 5.1): the **[W]** rows only, plus rows 1 and 4 for
  context. Prefix `s161b`. Push helper `docs/loops/qa-274/push-qa.mjs`. Take `machine-lease.ps1` for the run.

**QA runs on Opus** (the PRs were built by Cursor Composer 2.5). **LIGHT:** touched test files, one test file per vitest
invocation, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`, and `gh` reads. No full suite
unless a row says so, and nothing against the real home directory or a live record. **Set `npm_config_cache` under your
tmp folder.**

**Master at dispatch:** the DISPATCH_SHA on the prompt's first line. Under D-117 each head is BEHIND; QA the pinned SHAs.

**Pinned heads (CI `test` green on each):**

| PR | Task | Head | CI run | Built by |
|---|---|---|---|---|
| #421 | G-053 r2: config-channel flake; `gc.auto` admitted as exactly raw `0` | `9915a59baad67d9e29a415adec0a931b335c1cba` | 37183028599 | cursor-infra |
| #424 | T-235 P2-6: Cursor `task`, `test`, `harness-audit` commands | `12c289264e433bb306f55e212193a7a2448c2eca` | 37180101429 | cursor-infra |
| #425 | T-235 P2-4: `cli-session-end.js` on Cursor `sessionEnd` via setup.mjs | `9fcb97ca8bb266c03cef7501c4b2b831c8d1601b` | 37180118545 | forge |
| #427 | T-235 P2-3: Cursor session proof (T-003) by cursor-agent ancestor walk | `270b550b97ada09f50c256f381e4ec26ff98782a` | 37180595977 | cursor-builder |

## Rows for every PR

1. **Confined.** List the files beyond `origin/master`. Flag any file outside the task.
2. **Red then green.** Run the new or changed test files against master's source (they should fail) and against the
   head (they should pass), and quote the counts.
3. **Mutants.** Re-run one of the developer's mutants and write one of your own. Run `tsc --noEmit` on each, and
   confirm the edit landed.
4. **CI (read only).** Record the `test` result and run id above, and confirm it is the pinned head's run.

## #421 r2 (G-053): NARROW, row 10 of QA 272 only

QA 272 (report `origin/qa/s160f-report` @ `d562eca0`) accepted every #421 row except row 10. r2 is one commit,
`9915a59b`, on top of `82aeb3da`. Re-check only:

5. **The trim is gone.** `gc.auto` is admitted only when the raw value is exactly `0`. Each of `" 0"`, `"\t0"`,
   `"0 "`, `"0\n"`, `"00"`, `"0x"`, `"1"` and `"-0"` is refused, and each has a row. Read the regex and the code
   path in `configwatch.ts` yourself; do not rely on the test names.
6. **Nothing else is admitted.** No other `gc.*` key (`gc.autoDetach`, `gc.autoPackLimit`, `gc.pruneExpire`, ...),
   `info/` is still watched, and the rest of `SAFE_LOCAL_KEYS` is unchanged from `82aeb3da` (diff it).
7. **No flake.** `config-channel.test.ts` 5 times in a row at the head; report each count.
8. **QA 272's nit:** `makeRepo`'s JSDoc placement in `fixture.ts`. Report it; it does not block.

## #424 (T-235 P2-6)

9. **Install is idempotent and bounded.** `copyCursorSlashCommands` into a scratch HOME twice: the first run installs
   exactly the `CURSOR_COMMAND_SET` files, the second changes nothing (compare hashes), and it never overwrites a
   user-modified file with the same name without saying so. Report what it does in that case.
10. **The commands are honest for Cursor.** Read the three new `.cursor/commands/*.md` against their Claude Code
    originals (`.claude/commands/`). List every difference. Each must be a documented tool-call difference, not a
    dropped step. Flag any step the Cursor copy silently omits.
11. **`checks.ts` / mirror-parity** fails when any one of the three is removed, not only `task.md`.

## #425 (T-235 P2-4)

12. **Scratch HOME only.** Run `setup-scratch-home.test.ts` and confirm the real profile's `~/.cursor/hooks.json` and
    `~/.claude/settings.json` hashes are unchanged before and after (report hashes as match / no match, never content).
13. **Idempotent, user hooks kept, absolute command.** Two `setup.mjs` runs give one `sessionEnd` entry. A
    user-defined `sessionEnd` hook survives. The command uses an absolute node path and an absolute
    `cli-session-end.js` path that exist after build.
14. **Claude Code byte-identical.** `withSessionHooks` output is unchanged against master for the same input.
15. **[W] Real Windows:** the same two-run check under a scratch `USERPROFILE` on Windows, and the quoting of a path
    with a space (use a scratch dir containing a space). Report the exact command string written.
16. **Double run (observation, not a gate for QA):** state whether, with Claude Code's `SessionEnd` registered in
    `~/.claude/settings.json`, a Cursor session would now reach `cli-session-end.js` twice. Read the code; do not run
    a live Cursor session. This is why the merge is held.

## #427 (T-235 P2-3)

17. **The walk.** With `--ide cursor` or a `cursor_version` payload, SessionStart writes `by-pid/<pid>.json` for the
    nearest `cursor-agent` ancestor, using the same match as D-118a's lease owner. Read both matchers and say whether
    they are the same function or two copies; two copies is a finding.
18. **Claude Code unchanged.** A Claude Code payload (no `cursor_version`, no `--ide cursor`) produces the same proof
    file as master, byte for byte, and `server.ts` takes the direct-parent path first exactly as master does.
19. **Fails closed.** No `cursor-agent` ancestor: no proof written and a visible reason, never a proof for the wrong
    pid. `ob_set_session` with a claim other than the proven id is refused (T-003 rule).
20. **[W] Real Windows walk:** run the fixture (`tests/fixtures-t003/cursor-agent-host.cjs`) on Windows and confirm
    the ancestor walk finds it through PowerShell's process tree (and through Git Bash), not only through the Linux
    `/proc` path. Report which process API the walk uses on Windows.

## Batch merge row (QA 273 only)

21. In `~/qa-scratch/qa273-merge`, start from the DISPATCH_SHA and merge #421, #424, #425, #427 in that order. **#424
    and #425 both edit `scripts/setup.mjs` and `scripts/setup-hooks.mjs`; expect a conflict there and name it.**
    Resolve it in scratch only and say whether the resolution is mechanical. Then run `tsc --noEmit`,
    `npm run typecheck:tests`, and these files one per run: `config-channel`, `setup-cursor-commands`,
    `setup-hooks`, `setup-scratch-home`, `t003-session-proof`, `t003-r2`, `t235-p2-3-cursor-proof`, `mirror-parity`,
    `server`. Also run `node --check` on the built `server.js` and `cli-bootstrap.js`.
22. **Full suite once** on the merged tree (Plumb only): report passed, failed and the exit code separately (G-042).

## Rules (headless Claude Code)

- You are **QA 273** (prefix `s161a`) or **QA 274** (prefix `s161b`); the prompt's first line says which. Push ONLY
  your prefix's `qa/<prefix>-*` branches, and only through your helper, run from your `qa27N-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names, paths and hash match/no-match, never values (G-051).
- Commit `docs/loops/<prefix>-qa-report.md` on `qa/<prefix>-report`.
- One verdict per PR with its pinned SHA. The report's last line is exactly `QA-27N: REPORT COMPLETE`.
