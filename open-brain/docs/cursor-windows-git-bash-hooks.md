# Cursor + Git Bash: PowerShell hook wrapper fail-closes every tool

**Filed:** 2026-08-13 from FluidNC Session 2 (Cursor Composer, not an SIA session).
**Corrected:** 2026-09-01 (Session 53) from Probe Session 51 evidence — see [Correction](#correction-2026-08-13-probe-session-51).
**Status:** **No working remedy that preserves Git Bash.** The bash-bridge workaround was
tested and does not intercept hook execution. The only known fix is switching the agent
shell to PowerShell, which is a trade, not a repair.
**Do not treat CHANGELOG v0.8.x "use PowerShell" as a clean fix.** Its *mechanism* is
correct; its implied remedy costs you every bash-shaped agent command.

## Symptom

Every Cursor agent `Shell` (and MCP that goes through the same hook runner) is rejected:

```
--: eval: line 1: syntax error near unexpected token `&'
--: eval: line 1: `$OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -LiteralPath 'C:\Users\melve\AppData\Local\Temp\cursor-hooks-XXXX\payload.json' -Raw | & { $input | node "…hook…" }'
```

`--:` is bash `$0`. Cursor writes a PowerShell stdin feeder, then `eval`s it in Git Bash.
Parse dies on `&` / `$OutputEncoding` **before the hook script starts**. Cursor fail-closes
the tool call.

Observed in FluidNC Session 2: `git`, `mv`, `ctx_execute`, and `ob_set_session` path all
blocked. Session UUID was `"none"`. `/end` ran only because MCP `open-brain` sometimes
got through; Shell never did.

Three hooks fire and each independently blocks:

| Hook | Source |
|---|---|
| `~/.claude/hooks/log-git-ops.mjs` | `~/.claude/settings.json` PreToolUse / Bash |
| `~/.claude/hooks/gitnexus/gitnexus-hook.cjs` | same |
| `context-mode/…/hooks/pretooluse.mjs` | Claude plugin hooks.json |

This matches CHANGELOG: **Cursor also executes `~/.claude/settings.json` hooks.**

## Correction (2026-08-13, Probe Session 51)

> This section supersedes the original "Workaround landed" claim. The probe ran **after**
> this document was first written and was never folded back in until 2026-09-01.
> Recorded as knowledge entry **398** (`cursor-hooks-bypass-bash-bridge`), which
> supersedes the workaround half of entry **397**.

**The bridge does not work, and the reason is structural — not a bug in the bridge.**

Cursor evals PreToolUse hooks in a Git Bash that is **not** the terminal
`automationProfile`. Wiring `bash-bridge.cmd` as the Git Bash / automation profile
therefore never intercepts hook execution: **the bridge's detector never sees the
payload.** Profile wiring is not a hook fix, and no amount of improving the detector
changes that — it is not on the path.

Also established by the probe:

- Three hooks fired on a plain `echo` *and* on `git commit` (log-git-ops, gitnexus,
  context-mode pretooluse). **`log-git-ops`'s `if: Bash(git *)` did not filter** — it
  runs on non-git commands too, so the blast radius is every Shell call, not just git.
- **SessionStart failed to refresh the SIA `::cursor` slot** — still `7ad51ea2` from
  2026-07-28. Consistent with the hook never executing.
- Defect 1 (`%*` argument forwarding in `bash-bridge.cmd`) is a **separate** agent-Shell
  pipe issue and cannot be tested at all until hooks stop fail-closing. It is not the
  reason the bridge failed.

The bridge files are still on disk at `~/.cursor/hooks/bash-bridge.{mjs,cmd}` but are
**inert** for hook purposes. They have not been removed, only demoted to "does not
address the stated problem."

## What we already knew (and what the trade actually is)

CHANGELOG (v0.8.x Notes):

> Cursor hooks require PowerShell as the shell on Windows. Cursor wraps hook commands
> in PowerShell syntax; with bash configured as the default shell the wrapper dies on
> `&` before reaching node, and SessionStart fails silently.

The **mechanism** is right, and switching the default shell to PowerShell does genuinely
make hooks fire (independently confirmed — knowledge entry **324**). What the note omits
is the cost: Aaron's agent shell is Git Bash on purpose, and forcing PowerShell fixes
hooks by breaking every bash-shaped agent command. That is a trade to be made
deliberately, not a remedy to be applied silently.

As of this correction, **the trade is the only known working option.** The bridge was the
attempt to avoid it, and it failed.

Forum (same bug, Cursor-owned):

- https://forum.cursor.com/t/hook-processing-fails-on-windows-with-git-bash-terminal/146808
- https://forum.cursor.com/t/project-level-hooks-fail-on-windows-with-git-bash-due-to-powershell-injection/148131

## Decisions — resolved and open

Resolved by Probe Session 51:

1. ~~**Does the bridge actually work** after reload?~~ → **No.** Cursor's hook eval does
   not go through the terminal automation profile. Closed.
2. ~~**Should `setup.mjs` install it?**~~ → **No.** Do not install a fake bash via
   `setup.mjs` (`registerCursorHooks()`, `scripts/setup.mjs:285`). It would ship a
   machine-local shim that does not fix the problem it claims to fix. Closed.

Still open:

3. **`/sync` detector.** Original framing ("Git Bash + Cursor hooks + no bridge → warn")
   is dead with the bridge. Correct framing: *Git Bash default + Cursor hooks present →
   warn that hooks will fail-closed, and state the PowerShell trade explicitly.* There is
   no remedy to point at, so the warning must not imply one. Same class as
   `checkHookRegistration`.
4. **Fail-open vs fail-closed.** A hook that never starts should not block the tool. We
   cannot change Cursor's fail-closed behaviour, but we can stop importing Claude
   PreToolUse hooks into Cursor if they cannot run. This is now the highest-value item —
   it is the only lever on our side of the boundary.
5. **SessionStart UUID on Cursor** still depends on the hook executing. FluidNC Session 2
   had `session_id: none` and `ob_set_session` refused; Probe Session 51 confirmed the
   `::cursor` slot never refreshed. Re-verify `active-session.json` only under a
   configuration where hooks demonstrably run.
6. **CHANGELOG note.** Line 386 still reads "Cursor hooks require PowerShell as the shell
   on Windows" with no mention of the cost. Left unamended deliberately — it is a
   historical release note and the record of what was believed at v0.8.x. This document
   is the current answer; if the note is ever revised, it should gain the trade, not lose
   the mechanism.

## Related code

- `scripts/setup.mjs:285` → `registerCursorHooks()` — must **not** grow bridge installation
- `open-brain/src/shared/active-session.ts` — Cursor also runs Claude settings hooks
- `open-brain/src/cli-bootstrap.ts` — cwd is `~/.cursor`, not the workspace
- `open-brain/tests/active-session.test.ts`

## Related knowledge

- **397** `cursor-git-bash-powershell-hook-wrapper` — original diagnosis; symptom and
  mechanism still valid, workaround half superseded
- **398** `cursor-hooks-bypass-bash-bridge` — the correction recorded here
- **324** `collaborator-side-note-deserves-headline-scrutiny` — how this bug was found;
  the decisive clue arrived labelled "out of scope"
