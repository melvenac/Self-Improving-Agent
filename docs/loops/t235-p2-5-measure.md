# T-235 P2-5 — live measure + double-fire check

**Date:** 2026-10-04. **Seat:** cursor-builder, QA PC. **CLI:** cursor-agent 2026.10.01-e373342. **Shell:** PowerShell.

## (A) postToolUse shell tool_name

Scratch: `C:\Users\Aaron Melven\scratch\t235-p25-measure` (project `.cursor/hooks.json` → `p25-posttooluse-measure.mjs`).

Command:

```powershell
Set-Location C:\Users\Aaron Melven\scratch\t235-p25-measure
cursor-agent -p -f --output-format text -- "P25 measure only. Run exactly one shell command: echo P25_SHELL_TOOL_NAME_TEST. Do not edit files. Say DONE."
```

Observed `postToolUse` row (keys + measured fields only):

```json
{"hook_event_name":"postToolUse","session_id":"2564043c-7e01-461b-b0dc-f365996968b0","tool_name":"Shell","tool_input_keys":["command","cwd","timeout"],"has_command":true}
```

**Allowlist in code:** `Shell` only (no `ShellTool` or other names observed).

## (B) double-fire (imported Claude PostToolUse/Bash before Cursor registration)

Same run, `session_id` `2564043c-7e01-461b-b0dc-f365996968b0`:

| Check | Result |
|-------|--------|
| `trigger_fires` rows for session (Node 22, readonly DB) | **0** |
| `recall-trigger.log` line count before → after | **9 → 9** |

Imported CC Bash trigger did **not** fire on Cursor `Shell` postToolUse. **Not BLOCKED** for P2-7 sequencing.

## (C) injection vs wiring

Automated run did not prove the Cursor host surfaces `hookSpecificOutput.additionalContext` to the model. Vitest on `cli-recall-trigger` with a Cursor-shaped `Shell` payload shows the same stdout JSON as Bash when policy injects. **PR conclusion:** hook fires and can emit additionalContext; **model surfacing under cursor-agent is unverified** in this slice (row 4 = fires + logs; injection to the model TBD).
