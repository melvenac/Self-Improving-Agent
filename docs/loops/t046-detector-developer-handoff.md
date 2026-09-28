# T-046 detector — developer handoff

**Seat:** Forge, Grok 4.7, worktree `C:\Users\melve\Worktrees\sia-forge`, branch `loop/t046-detector`.
**Base:** `origin/master` `bf33fe4`. **Brief:** record 194 in `docs/loops/session-147-dispatches.md` (`76342aa` on `origin/docs/session-100-qa99-dispatch`).
**Product:** `3af41f52e3881f6289d4f88ab03600a39e7c33c0`. **Red:** `1296e60e18900d350527cd222580c737c55c7c8b` on `loop/t046-detector-red`.
**PR:** https://github.com/melvenac/Self-Improving-Agent/pull/192
**No `/end`.** The live `.agents/state.json` was not written. Nothing under `~/.claude` or `~/.cursor` was edited.

## What changed

`/sync` check `cursor-hook-compat` in `open-brain/src/pipelines/sync/cursor-hook-compat.ts`, called from `runSync`.

- It parses `~/.claude/plugins/installed_plugins.json` (JSON.parse, not a text search). For each install's `installPath` it parses `hooks/hooks.json`.
- A non-empty `hooks.PreToolUse` array is an entry. The letters PreToolUse in a description or in another event's matcher are not. An empty array is not an entry.
- That entry is an **issue** only when Cursor CLI is installed (`%LOCALAPPDATA%\cursor-agent` exists). The message names the plugin id, the version, the matchers, T-046, and one remedy: remove those PreToolUse entries. It also states the limit: the check reads config, not whether Cursor runs the hook.
- No registry file, or no `cursor-agent`: a **skip** that says why, and the message says it is not a pass.
- A registry or a `hooks.json` that is not JSON is an **issue**, not a pass.
- `runSync` takes an optional `home` and `localAppData` so tests pass a fixture. Omitted, those are `os.homedir()` and `LOCALAPPDATA`. The tests never read the real profile (G-044).

GitNexus in this worktree is hundreds of commits behind. The caller was found by search: `runSync` in `open-brain/src/pipelines/sync/index.ts`. `ob_sync` and the CLI call `runSync`.

## tcm

Four runs, no `windows=true`. This handoff commit is a fifth: it is pushed to the same PR and is not dispatched again.

- **Green** `36359225675` success. `loop/t046-detector` @ `3af41f5`. Test Files 131 passed. Tests **1806 passed | 6 skipped (1812)**. https://github.com/melvenac/Self-Improving-Agent/actions/runs/36359225675
- **Red** `36359225141` failure. `loop/t046-detector-red` @ `1296e60`. Tests **7 failed | 1799 passed | 6 skipped (1812)**. Six rows: `no check: Cannot find module .../cursor-hook-compat.js`. The seventh: `cursor-hook-compat is not in runSync`. https://github.com/melvenac/Self-Improving-Agent/actions/runs/36359225141
- **mut-ignore** `36359226699` failure. `loop/t046-detector-mut-ignore` @ `5adbe0ac71b0bbfc4d1cb50cfa66dfa0ebee0409`. `preToolUseMatchers` returns null. **2 failed | 1804 passed | 6 skipped.** Both detection rows got `pass` where they expect `issue` (the named row, and the runSync row that feeds it a fixture PreToolUse). https://github.com/melvenac/Self-Improving-Agent/actions/runs/36359226699
- **mut-nocursor** `36359228066` failure. `loop/t046-detector-mut-nocursor` @ `d31cac0c21ccbc8adfacc369ba74f392f26d5e74`. The missing-`cursor-agent` result is `pass`. **1 failed | 1805 passed | 6 skipped.** The row expected `skip` and received `pass`. https://github.com/melvenac/Self-Improving-Agent/actions/runs/36359228066

Mutant branches are not in this history and are not for merge.

Local, before the product commit: the same 7 rows failed (`no check`, and the wiring row not in `runSync`). After it: 7 passed. `npx tsc --noEmit -p .` exit 0 before each push. `/sync` (`ob_sync`, check only) at `bf33fe4` reported pre-existing issues only (retirements, build-freshness, mirror-parity, greeting-size).
