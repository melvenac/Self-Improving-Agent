# T-315 step 0: what an in-process reload must carry, and which shape survives it

**By:** Atlas (planner), 2026-10-23, session 174. **Task:** T-315 (D-161). **Read-only:** measured at origin/master
`57de4833` with `git show` and the Claude Code docs; nothing was run against a live server.

## Why a second attempt

The first attempt (#885) let the server exit when the build changed and assumed Claude Code would respawn it. That
assumption was false. Claude Code respawned none of the six servers, and every seat lost open-brain until a
`/mcp reconnect`. The revert went in as #896. A headless `claude -p` cannot reconnect at all: Maker's prod release lost
open-brain at the 10-20 08:18 rebuild. Any design that ends the stdio connection fails the same way.

## Measured

1. **What server.ts holds at module level.** server.ts reaches 100 of the 160 files in `open-brain/src`, counting
   static and dynamic imports. Across those 100 files, the module-level mutable state is:
   - `_v2db` (server.ts:79): the DB handle, opened lazily. A new instance can reopen it.
   - `_schemaSkew` (server.ts:80): the result of the schema check. It is recomputed on open.
   - `_parentStart` (server.ts:150): the parent pid and its start time, a cache. It is recomputed from `process.ppid`.
   - `opShapeCache` (shared/state-writer.ts:126): a cache.
   - `_recalledKnowledgeIds` (server.ts:177): written at :901 and **read nowhere**. It is dead.
   - The other matches are constant `ReadonlySet`s.

   **Session registration is not in memory.** Every attributed write re-proves the session from the per-pid proof file
   keyed by `process.ppid` (`writeSessionId`, server.ts:151). So a fresh instance loses nothing, **provided its
   `process.ppid` is still the claude process.**
2. **ESM cache-busting does not reload the build.** Re-importing `build/server.js?v=<commit>` gives a fresh copy of
   that one module only. Its relative imports (`./db-v2.js`, and the 99 others) resolve against the URL without the
   query, so the old instances in the module cache are reused. The D-161 candidate's "re-import the handler module"
   step would serve a new server.ts over the old handlers and pipelines. Reloading in-process would need a bundled
   single-file build or a separate build directory per commit.
3. **Claude Code, per its docs** (code.claude.com/docs/en/mcp; no stdio-specific wording; read through a guide agent's
   search snippets):
   - A stdio server that exits is not restarted. Only HTTP/SSE servers get retries. This agrees with what we saw on
     10-20.
   - `notifications/tools/list_changed` is documented as honoured: the tool list is re-fetched, including under `-p`.
     Open issues (#13646, #62844, #79826) report stale lists, so this is **unverified here**.
   - `claude -p` has no mid-run reconnect. The SDK's `reconnectMcpServer()` is not available to the CLI.

## Recommended shape: a stable stdio proxy

A small launcher (`build-proxy.js`, registered as the MCP command in place of `build/server.js`):
- Owns the stdio connection to Claude Code and never exits on a rebuild.
- Spawns the real server as a child over a pipe and forwards JSON-RPC both ways.
- Before forwarding each request, reads `build/build-info.json`. If the commit changed and nothing is in flight, it
  does the following:
  1. Spawns a new child.
  2. Replays the `initialize` request and the `initialized` notification it stored from the host.
  3. Swaps the new child in, then kills the old one.
  4. Sends `tools/list_changed` to the host only if the new `tools/list` differs.

Why this shape:
- The host's connection never drops, so it covers `claude -p` and Cursor (T-235) the same way.
- A fresh process reloads every module and the native addon cleanly, which fixes finding 2.
- No state is lost, per finding 1.

**The one load-bearing change** is session proof. The child's `process.ppid` is the proxy, not claude, so every
attributed write would refuse. Fix:
- The proxy sets `OPEN_BRAIN_PROXY_PID=<its own pid>` and `OPEN_BRAIN_HOST_PID=<its process.ppid>` in the child's
  environment.
- `writeSessionId` uses `OPEN_BRAIN_HOST_PID` **only when** `process.ppid === Number(OPEN_BRAIN_PROXY_PID)`.

A variable inherited from elsewhere (the CLAUDE_PID failure, T-003 0b) cannot pass that check.

Rejected:
- **Exit and respawn (#885):** the host never respawns.
- **ESM re-import:** see finding 2.
- **Versioned build directories:** `sia-rebuild`, the Build line and every test that resolves `build/` would all
  change, and the old directories would need cleanup.

## Slices, if approved

- **S1:** the proxy, its env-checked proof path, and rows:
  - a fake host drives initialize and a tool call through the proxy;
  - build-info changes between calls;
  - the next call is served by a new child pid;
  - session proof still passes;
  - an inherited `OPEN_BRAIN_HOST_PID` without the matching proxy pid is refused;
  - no swap happens while a request is in flight.

  Mutants:
  - the proof check that ignores the proxy pid;
  - a swap that ignores in-flight requests;
  - a missing `initialize` replay.
- **S2:** register the proxy as the MCP command. This is a config change in each seat's MCP config and needs Aaron's
  word. Then run the live check from the acceptance criteria:
  - after `sia-rebuild`, the next tool call reports the new build on the Build line, with no reconnect;
  - a headless `claude -p` run across a rebuild keeps open-brain.

  Every seat reconnects once to pick the proxy up, and never again after that.
- Delete `_recalledKnowledgeIds`, in S1 or as a separate one-line change.
