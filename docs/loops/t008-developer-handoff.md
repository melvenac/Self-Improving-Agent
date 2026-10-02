# T-008: a /sync validator that stats every MCP command path in `~/.claude.json`, developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t008-mcp-paths` from `origin/master` `8b7aa952`. **Dispatch:** atlas-sia, session 157 (LIGHT). Not merged; one PR.

## What it is

- `open-brain/src/pipelines/sync/checks.ts`, a sibling of `checkHookRegistration`:
  - `checkMcpCommandPaths(home = homedir(), env = {})`, registered in `sync/index.ts` right after `hook-registration` (it takes the same `home` the other home-reading check gets, so tests of `runSync` can pass a fixture).
  - `resolveMcpCommand(command, { pathEnv, pathExt, platform })`: a path (absolute, or any name with a separator) is stat'ed as written; a bare name is searched on PATH; on Windows each PATHEXT extension is tried too, so `npx` finds `npx.cmd`. On other platforms the file must be executable. A directory is not a command.
- Reads `mcpServers` globally and under every `projects[...]`. Results:
  - a missing command: **issue**, `<server>: <command> not found (<scope>)`, with the reason the tools would be silently absent. The same server and command repeated across project scopes is one entry with the scope count.
  - a `url`/http server: listed under "Skipped N" with `url server, no command to stat`; it never turns the result into a pass on its own (a config with only url servers is a **skip**, not a pass).
  - a command using `${...}` expansion: skipped with that reason, not guessed at.
  - an absent or unparseable `~/.claude.json`: **skip**, `not checked: <cause>. This is not a pass.`

## Rows (`tests/pipelines/sync/mcp-command-paths.test.ts`, 11 tests; fixture configs and an injected PATH, never the real ones)

1. The GitNexus case: an absolute path that does not exist gives an issue naming `gitnexus` and the path.
2. A bare name on the injected PATH passes (on Windows through PATHEXT). Also: an absolute path that exists passes.
3. A bare name absent from PATH is an issue naming the server and the command.
4. A url server is skipped with its reason, and does not hide a missing command next to it; only-url config is a skip.
5. A missing config is `not checked`; invalid JSON is `not checked` with the cause.
6. The mutant (below).
Also: per-project scope is checked and named; `${...}` expansion is skipped with its reason; a directory and an empty PATH find nothing.

## Evidence

- **Red** (the same test file against `origin/master`'s source): 11 failed (`checkMcpCommandPaths is not a function` x10, `resolveMcpCommand is not a function`). The function did not exist, so this is red for the right reason only in the sense that nothing could pass. **Green:** 11 passed.
- **Mutant** `docs/loops/t008/mutants/absolute-only.diff` (a bare name is returned unresolved, so only absolute paths are really checked): `tsc --noEmit` 0; **red on 4**: row 3, the bad half of row 4, the per-project row, and the resolve row. Row 2 and the passing rows stay green, as they should.
- **Real machine, read-only** (`checkMcpCommandPaths()` against this PC's `~/.claude.json` and PATH; nothing written):

  ```
  { "name": "mcp-command-paths", "severity": "pass", "message": "1 MCP server command(s) resolve to a file." }
  ```

  That config registers one server globally (`open-brain`) and none per project, so this run proves the pass path on real data and says nothing about the GitNexus failure, which row 1 covers on a fixture. GitNexus and the other tool servers on this machine are not in `~/.claude.json`; the check does not read plugin or `.mcp.json` registrations (out of the stated scope).
- `tests/pipelines/sync`: 24 files, 340 passed. `tsc --noEmit` 0. Not run: the full suite, `/sync` itself (stale local build; the new check has not been seen in a real `/sync` report, only called directly).

## Notes for the planner

- Scope as dispatched: `~/.claude.json` only. Servers declared in a project's `.mcp.json` or by a plugin can disconnect the same way and are not covered; say if that should be a follow-up.
- The check reads the real home when `runSync` is called without `home`, as `cursor-hook-compat` does. A machine with a broken registration will therefore show an issue in any test that runs `runSync` against the real home (none of the 340 does today).
