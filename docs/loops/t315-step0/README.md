# T-315 step 0: what a running Claude Code session does when the open-brain server changes under it

**By:** Atlas, 2026-10-20, session 173. **Task:** T-315 (D-161, Aaron: "Open-brain auto-reconnect: yes").

## Read-only findings (server.ts at master, SDK 1.29.0)

- **Reloading in place is blocked.**
  - `import(url + "?v=" + commit)` re-evaluates only the root module; its static imports come from Node's ESM module
    map, so old code keeps running underneath. Nothing is ever unloaded.
  - `server.ts` builds its own `McpServer` and registers 14 tools as an import side effect.
  - The open better-sqlite3 handle (`_v2db`) and the native addon (cached by path, locked on Windows) cannot be swapped
    inside one process.
- **The SDK can change tools live.** `RegisteredTool.update/remove` and `sendToolListChanged()` exist
  (`dist/esm/server/mcp.js:618-647, 765`), and the server advertises `tools.listChanged: true`.
- **Little state lives only in the process.** There is no in-memory session registration since T-003: every write
  re-proves the session from `process.ppid`. The DB handle opens lazily. There are no timers or `process.on`
  handlers.
- **The serving-build line already detects the change.** `describeServingBuild()` re-reads `build-info.json` and
  prints `STALE PROCESS`.

## The two designs, and what decides between them

- **(B) Exit on a new build; the host restarts the server.** This is by far the simplest, and it avoids every reload
  blocker. It only works if Claude Code respawns a stdio server that exits by itself. If it does not, the tools go
  dead for the rest of the session, which is worse than a stale build.
- **(C) Proxy.** A small, stable launcher owns the host's stdio and forwards `tools/list` and `tools/call` to a child
  `server.js` from the current build. On a build change it ends the child (which releases the addon lock), starts a
  new one, and sends `tools/list_changed`.
  - This needs the host to honour `list_changed` only when tool schemas change.
  - The session proof walks `process.ppid`, which becomes the launcher, so it must walk one level higher.

**Unknown, measured by the probe:**
1. Does Claude Code respawn a stdio MCP server that exits?
2. Does it honour `notifications/tools/list_changed`?

## The probe

`probe-server.mjs` is a toy MCP server.
- In `exit` mode, `probe_ping` answers, then the process exits.
- In `listchanged` mode, calling `probe_a` registers `probe_b` after connect, which makes the SDK send
  `list_changed`.

Every start and call is written to a log, so a respawn shows as a second `START` line with a new pid.
