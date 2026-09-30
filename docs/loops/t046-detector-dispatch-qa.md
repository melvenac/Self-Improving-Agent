# Record 194 (T-046's `cursor-hook-compat` /sync detector): QA dispatch (record 197)

**By:** Atlas (planner), 2026-09-28. **Runs headless on a QA machine through the Cursor QA driver, with Composer 2.5.**
**Never write a live `state.json` or the real knowledge DB. Never edit anything under `~/.claude` or `~/.cursor`.**
Commit the report from a separate worktree.

## The candidate

- **`3af41f5`** (product) on `origin/loop/t046-detector`, from `origin/master` `bf33fe4`. The tip is `44d672a`, which adds
  only the handoff. PR #192.
- Built by Grok 4.7 (`sia-forge`). Handoff: `docs/loops/t046-detector-developer-handoff.md`.
- **CI on tcm:** green `36359225675` and red `36359225141` (`1296e60`). Mutants: `36359226699` (`mut-ignore`) and
  `36359228066` (`mut-nocursor`).

## Score against `docs/loops/session-147-dispatches.md`, "Record 194"

1. **Detection.** A non-empty `PreToolUse` in an installed plugin's `hooks/hooks.json` is an ISSUE when
   `%LOCALAPPDATA%\cursor-agent` exists. The message names the plugin, the version, the matchers, T-046 and the remedy.
   The registry and `hooks.json` are parsed, not pattern-matched. "PreToolUse" appearing in a description or another
   matcher is not a finding.
2. **Skip is not pass.** No registry, an unreadable or malformed registry or `hooks.json`, or no Cursor CLI: each is a
   SKIP or an ISSUE that says why, never a PASS. Look for an input that yields PASS without the check having looked:
   a missing `installPath`, a plugin listed with zero installs, `hooks.json` absent, or a non-Windows host with no
   `LOCALAPPDATA`.
3. **Fixture isolation (G-044).** Tests use a fixture home and never read the real profile or inherited `process.env`
   silently.
4. **The real machine.** Run `/sync` (read-only, `--check` if available) on the QA machine and quote the
   `cursor-hook-compat` line. Say whether it matches the real plugin cache there.
5. **Preserve.** Every other `/sync` check's result is unchanged, and the check is registered in `runSync` once.
6. **Your own mutants,** at least two, on `qa/t046-detector-mut-*`.

## CI and authority

tcm, at most 4 runs. **No `windows=true` CI.** Push only `qa/t046-detector-*`, through
`node docs/loops/qa-197/push-qa.mjs`.

## The report

- **Path:** `docs/loops/t046-detector-qa-report.md`, on `qa/t046-detector-report`.
- Order: the verdict first, then each item, mutants, CI, defects, and your model.
- **The LAST line is exactly `QA-197: REPORT COMPLETE`.**
