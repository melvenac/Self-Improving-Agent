# T-048 hook-configs: descend into matcher groups and stat each command, developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Branch:** `loop/t048-hook-configs-nested`, stacked on `loop/t048-sync-counts` `d8dc12db` (PR #306; merge that first). **Dispatch:** atlas-sia, session 157, the behaviour change ruled in. Not merged; one PR, base is the #306 branch.

## What changed (`checkHookConfigs`, `sync/checks.ts`)

- **Walk:** `settings.json` hooks, event, matcher group, `hooks[]`, `command`. A flat entry that itself carries a `command` (the shape the older fixtures use) is still read as a hook.
- **Parse the command as a shell would for its first words** (`splitHookCommand`): single and double quotes group and are removed, whitespace separates, and a backslash is LITERAL (these are Windows paths); only `\"` inside double quotes escapes. An unterminated quote is unparseable.
- **Pick the file** (`hookCommandTarget`): leading `NAME=value` words are environment prefixes and are skipped. Head `node`, `bash` or `sh` (also as a quoted path to `node.exe`): the first non-flag argument is the script. Head `npx`: through `tsx`, the next argument is the script; `npx <package>` runs a package, not a file. Any other head that is a path: the head itself is the file. A bare head (`echo`, `python`): not a file this check can stat, counted as skipped. The script must be an absolute path.
- **`not checked: <command>`, never a pass:** an unterminated quote; no script argument; a relative path (the run directory is unknown); a path using `$`, `%`, a backtick or `~`; only environment prefixes; `npx` of a package. Each is listed with its reason, and any of them makes the result a **warn** (`not a full pass`). A missing script is an **issue** naming the path.
- Counts (from #306) are kept and extended: `N hook command file(s) checked; skipped M (...); K not checked [command (reason); ...]; of E entries`.

## Rows (`tests/pipelines/sync/t048-counts.test.ts`, 12 tests; the hook-configs block rewritten; real files on disk, one path with a space)

nested groups pass with the right counts; a missing script behind a group is an issue naming it; a quoted path with spaces is one argument (found, and named when absent); a quoted `node.exe` head stats the script after it, and a non-node path head is itself stat'ed (found or named); environment prefixes and node flags are skipped; `npx tsx <script>` is stat'ed and `npx some-package` is not checked; five unparseable commands each give a warn naming the command and the reason; the legacy flat shape and bare commands are counted as skipped; nothing readable is a skip.

## Evidence

- **Red** (the file against `d8dc12db`'s `checks.ts`, i.e. the flat reader): **8 failed**, 4 passed. **Green:** 12 passed; `checks.test.ts` 102, `hook-registration.test.ts` 7, `t048-counts-parity.test.ts` 7, all passing, one file per invocation (the QA PC hold). `tsc --noEmit` 0.
- **Mutant** `docs/loops/t048-hook-configs/mutants/top-level-only.diff` (matcher groups are not descended into; `tsc --noEmit` 0): **red on 8**, the same eight; the four non-nested rows stay green.
- **Real run, read-only**, this PC's `~/.claude/settings.json` (4 entries, the quoted `node "..."` form and `"C:/Program Files/nodejs/node.exe" "...mjs"`):

  ```
  hook-configs  pass  All hook command files exist: 4 hook command file(s) checked; skipped 0; 0 not checked; of 4 entries
  ```

  In #306 the same file read 0 of 4 and was a skip; it now stats all four.

## Notes

- This branch adds `posix as pathPosix, win32 as pathWin32` to the `node:path` import in `checks.ts`. #295 (T-008) adds the same two aliases to the same line, so whichever merges second has a trivial import-line conflict, not a behaviour one.
- `sh -c` / `bash -c` (added on the planner's ruling): `-c` (also `-lc` and similar) makes the next word an inline script, so the command is `not checked: inline shell (-c)`, a warn, never a missing-script FAIL. Row: four inline-shell forms warn and none says "missing files"; `bash <script file>` without `-c` is still stat'ed. Against the previous source that row is red (the quoted string was read as a script and reported missing). `cmd /c` is still counted as a skipped bare head.
- Not run: the full suite or a real `/sync` report.
