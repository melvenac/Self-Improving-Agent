# T-008b: MCP command paths from `.mcp.json` and enabled plugins, developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t008b-mcp-sources`, stacked on `loop/t008-mcp-paths` `cc285738` (PR #295; merge that first). Not merged; one PR (base is the T-008 branch).

## Plugin layout, determined from disk (not guessed)

On this machine: `~/.claude/settings.json` has `enabledPlugins` (`{"context-mode@context-mode": true}`); `~/.claude/plugins/installed_plugins.json` (`version: 2`) maps each key to `[{ scope, installPath, ... }]`; under `installPath` the manifest is `.claude-plugin/plugin.json` and for `context-mode` it declares `mcpServers` inline, with an absolute `command` (`C:/Program Files/nodejs/node.exe`). The plugin directory also carries `.mcp.json.example` files, which Claude Code does not read, and I ignore them. A root `.mcp.json` and an `mcpServers` given as a path are handled too, from the documented plugin shape, but no plugin on this machine uses either; they are covered by fixtures only.

## What changed

`checkMcpCommandPaths(home, env, projectRoot)` (`projectRoot` is new; `sync/index.ts` passes `options.projectRoot`). Sources, each finding named by source:

- `global` and `project <path>`: `~/.claude.json` (unchanged).
- `.mcp.json`: the repo-root file of the checkout /sync runs in. Absent says nothing; present and unreadable is "not checked".
- `plugin <name>`: every plugin set to `true` in `enabledPlugins`; install path from `installed_plugins.json`; servers from the manifest's `mcpServers` (object, or a path under the install directory) and from a root `.mcp.json`. `${CLAUDE_PLUGIN_ROOT}` is replaced by the install directory; any other `${...}` is skipped with the reason. A plugin set to `false` is not looked at.

Result rules: a missing command is an **issue** naming server, command and source. A source that exists but cannot be read (the global config, `.mcp.json`, a plugin manifest, an enabled plugin missing from `installed_plugins.json`) is listed as `not checked: <cause>` and caps the result at **warn** ("not a full pass"); with nothing checkable at all it is **skip**. A pass needs every source that exists to have been read.

## Rows (`tests/pipelines/sync/mcp-command-paths.test.ts`, now 19 tests; fixtures only)

- a missing command in `.mcp.json` is an issue naming `.mcp.json`; an absent `.mcp.json` is silent, a good one passes; an unreadable one is `not checked` and warn;
- a plugin server with a missing command (inline in the manifest) is an issue naming `plugin thing`; a plugin's root `.mcp.json` is read and `${CLAUDE_PLUGIN_ROOT}` resolves (one present command passes, one absent is named with the resolved path);
- an enabled plugin whose manifest cannot be read is `not checked` and not a pass; an enabled plugin missing from `installed_plugins.json` is `not checked`;
- a disabled plugin with a missing command is not checked (result skip, no mention of it);
- the 11 T-008 rows are unchanged and still green.

## Evidence

- **Red** (the 19-test file against `cc285738`'s source): 7 failed, 12 passed (the 12 are T-008's rows plus the cases that need nothing new). **Green:** 19 passed. `tsc --noEmit` 0. `tests/pipelines/sync`: all pass (run after the change).
- **Mutant** `docs/loops/t008b/mutants/claude-json-only.diff` (the `.mcp.json` and plugin branches are disabled, so only `~/.claude.json` is read): `tsc --noEmit` 0; **red on 7**, all in the T-008b block; the T-008 rows stay green, as they should.
- **Real run, read-only** (`checkMcpCommandPaths(undefined, {}, <this checkout>)`, nothing written):

  ```
  { "name": "mcp-command-paths", "severity": "pass", "message": "2 MCP server command(s) resolve to a file." }
  ```

  The two are `open-brain` (global) and `context-mode` (plugin), so the plugin path is now exercised on real data. This checkout has no `.mcp.json`. GitNexus is in none of the sources this check reads; it is registered somewhere else (probably its own CLI config or an MCP host entry I did not find), so the original incident is **still not covered on this machine**. I did not search further.

## Open

- Where does this machine's GitNexus registration live? If it is not `~/.claude.json`, `.mcp.json` or an enabled plugin, the check cannot see it.
- `warn` for "some source not checked": if /sync should treat that as a failure instead, it is a one-word change in the final branches of the function.
