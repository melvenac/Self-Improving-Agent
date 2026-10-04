# T-235 Phase 2 — P2-2 hook label re-measurement (+ deferred P2-1 ob_stats)

**Seat:** cursor-builder / sia-builder on QA PC (DESKTOP-O4EGB1E). **Session:** 161, 2026-10-04.
**Shell:** PowerShell. **CLI:** `cursor-agent` 2026.10.01-e373342 (`-p -f` Run A).

## P2-1 deferred — `ob_stats` from this Cursor session (MCP)

`~/.cursor/mcp.json` uses absolute Node:

`command`: `C:\Program Files\nodejs\node.exe` (not bare `node`).

Live MCP call from Composer session (open-brain MCP, `OPEN_BRAIN_IDE=cursor`):

```
## Knowledge Stats
Total entries: 5
Rated entries: 0
Database: C:\Users\Aaron Melven\.claude\open-brain\knowledge-v2.db (3692 KB)

Maturity distribution:
  progenitor: 5

Recall trigger census:
...
Session proof (this server instance): NONE — no session proof for this server's parent process 5164 (... by-pid/5164.json absent ...)
Schema: code v5, database v5
```

**Conclusion:** open-brain loads under Cursor MCP on the QA PC (no NODE_MODULE_VERSION 127/137 failure). T-003 session proof still absent for MCP parent.

## P2-2 — scratch hooks with async stdin logger

**Scratch:** `C:\Users\Aaron Melven\scratch\t235-hooks` (unchanged layout from Phase 1 round 2).
**Logger:** `.cursor/hooks/t235-logger.mjs` — reads stdin with `for await (const chunk of process.stdin)` (same pattern as `cli-bootstrap.ts`), logs `hook_event_name`, `rawBytes`, `payloadKeys` (keys only, no values).

**Run A command:**

```powershell
Set-Location "C:\Users\Aaron Melven\scratch\t235-hooks"
cursor-agent -p -f --output-format text -- "Parity test P2-2 only. In order: run one shell command echo T235_P22_HOOK_TEST; read probe.txt; call MCP open-brain ob_stats with empty arguments. Do not create or edit files. Say DONE when finished."
```

**CLI exit:** 1 after ~3 min (`RetriableError: WritableIterable is closed` after cloud reconnect attempts). Hooks still ran through shell, read, MCP, and **sessionEnd**.

**Log:** `hook-fire.log.jsonl` — 20 lines, all `rawBytes > 0`, `parseError: null`.

| hook_event_name | count | payloadKeys (representative) |
|-----------------|------|------------------------------|
| sessionStart | 1 | `session_id`, `hook_event_name`, `workspace_roots`, `transcript_path`, … |
| beforeShellExecution | 1 | `command`, `cwd`, `sandbox`, `session_id`, … |
| afterShellExecution | 1 | `command`, `output`, `duration`, `session_id`, … |
| beforeReadFile | 1 | `file_path`, `content`, `session_id`, … |
| beforeMCPExecution | 1 | `tool_name`, `tool_input`, `mcp_server_name`, `session_id`, … |
| afterMCPExecution | 1 | `tool_name`, `result_json`, `duration`, `mcp_server_name`, … |
| preToolUse | 3 | `tool_name`, `tool_input`, `tool_use_id`, `session_id`, … |
| postToolUse | 3 | `tool_name`, `tool_input`, `tool_output`, `session_id`, … |
| afterAgentThought | 7 | `text`, `duration_ms`, `session_id`, … |
| sessionEnd | 1 | `reason`, `final_status`, `duration_ms`, `session_id`, … |

**Not observed this run:** `stop`, `postToolUseFailure`, `subagentStart`, `subagentStop`, `preCompact`, `afterAgentResponse`, `afterFileEdit`, `beforeSubmitPrompt`.

### Rows closed for Phase 2 planning

| Audit row | Finding |
|-----------|---------|
| 3 Session end | **`sessionEnd` fires** on cursor-agent exit (even when CLI exits 1 after connection loss). Payload includes `reason`, `final_status`, `session_id`. Global `~/.cursor/hooks.json` still has no `sessionEnd` → **cli-session-end.js not wired** unless we register it. |
| 4 Recall trigger | **`afterShellExecution`** delivers `command` + `session_id` (not PostToolUse/Bash shape). **`postToolUse`** carries `tool_name` + `tool_input` — compatible with `cli-recall-trigger.js` if registered on `postToolUse` and adapted to Cursor payload (`session_id` present). |
| 5 Imported hooks | Many **afterAgentThought** events; global Claude hooks still run alongside project scratch hooks (counts only; no double-count attribution). |

### Interactive session

**Not re-run separately.** Run A ended with a labeled **sessionEnd** after the agent stalled on cloud reconnect; a dedicated interactive quit was not repeated in this dispatch window.

## Fix needed?

**No product fix in this slice** — measurement only. Next ruled items: register `cli-session-end.js` on `sessionEnd` (row 3), register recall on `postToolUse` or rule explicit-only recall (row 4), P2-3 T-003 by-pid (held).
