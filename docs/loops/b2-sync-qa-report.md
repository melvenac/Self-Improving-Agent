# QA 256, batch B2 (/sync checks): #295, #298, #300, #303, #306, #309, QA report

**By:** QA 256 (Claude Code, Opus 5.5, headless), 2026-10-02, record session 256, on the DESKTOP
(DESKTOP-UGEKR74). **Dispatch:** `docs/loops/qa-256-b2-sync-dispatch.md`. **Job class:** LIGHT. I ran one test
file per vitest invocation, ran mutants on touched files only, and used `gh` for reads only. I did not run the full
suite and made no live Jev call.

- **Dispatch tree:** `git -C ~/qa-scratch/qa256-wt log -1 --format=%H` = `507004147df01ec665ff5970257ee400534720ef`
  (= `origin/master` at fetch).
- **Trees:** `C:/qa-scratch/qa256-pr<N>` (heads), `C:/qa-scratch/qa256-base<N>` (bases, with the head's test files
  copied in), `C:/qa-scratch/qa256-merge` (row 9). Each tree got its own `npm install` because junctions and `npm ci`
  were not permitted. No PR changes `package.json` or the lockfile.
- **Clark's limit:** from `~/.claude` I read only `settings.json`, and only for its key names and hook and plugin
  counts. I did not read `~/.claude.json`. Nothing under `~/.claude/plugins` was read, so row 6's real-install half is
  **not done** (see row 6). Row 9's `sync --check` ran against **fixture homes** (`USERPROFILE`/`HOME` set to
  `C:\qa-tmp\home-*`) for the same reason.

## Verdicts

| PR | task | head | verdict | deciding row |
|---|---|---|---|---|
| #295 | T-008 | `cc285738` | **REJECT** | row 5: a `${...}` or non-string command beside a good one gives **pass** |
| #298 | T-008b | `7b09c5b7` | **REJECT** | row 5: an unparseable `~/.claude/settings.json` gives a silent **pass** (plugins unread) |
| #300 | T-051 | `5ae7f9f2` | **ACCEPT** | rows 1–4 met |
| #303 | T-176 | `112a4139` | **ACCEPT** | rows 1–5 and 8 met |
| #306 | T-048 counts | `d8dc12db` | **REJECT** | row 5: vault-path-refs with an unreadable file beside a clean one gives **pass** |
| #309 | T-048 hook-configs | `eb721dec` | **ACCEPT** (its own diff; it merges only after #306) | rows 1–5 and 7 met |

**Batch: REJECT.** Row 9 merged all six with only the named import-line resolution, but #295, #298 and #306 are not
accepted.

The #295 and #306 rejections apply row 5's "never `pass`" literally to a pass that **names** what it left out. If the
planner rules that a named skip inside a pass is acceptable, those two flip to ACCEPT. #298's finding does not depend
on that ruling, because its pass names nothing.

## Row 1: confined

| PR | files beyond its base |
|---|---|
| #295 (vs master, mb `8b7aa952`) | `checks.ts`, `sync/index.ts`, `tests/.../mcp-command-paths.test.ts`, `docs/loops/t008-developer-handoff.md`, `docs/loops/t008/mutants/absolute-only.diff` |
| #298 (vs #295 `cc285738`) | the same three source/test files, `t008b-developer-handoff.md`, `t008b/mutants/claude-json-only.diff` |
| #300 (vs master, mb `00552846`) | `checks.ts`, `sync/index.ts`, `skills-contract.test.ts`, `t051-developer-handoff.md`, `t051/mutants/skip-no-frontmatter.diff` |
| #303 (vs master, mb `00552846`) | `checks.ts`, `staleness.test.ts`, `t176-developer-handoff.md`, `t176/mutants/one-direction.diff` |
| #306 (vs master, mb `00552846`) | `checks.ts`; tests `checks`, `hook-registration`, `mirror-parity`, `t048-counts-parity` (new), `t048-counts` (new); handoff; 8 mutant diffs |
| #309 (vs #306 `d8dc12db`) | `checks.ts`, `t048-counts.test.ts`, `t048-hook-configs-developer-handoff.md`, `t048-hook-configs/mutants/top-level-only.diff` |

All six are confined to `open-brain/src/pipelines/sync/`, their tests and their own handoff and mutant docs. The
heads equal the pinned SHAs and `gh pr list` headRefOid. The stacks hold: `cc285738` is an ancestor of `7b09c5b7`, and
`d8dc12db` is an ancestor of `eb721dec`.

## Row 2: red then green

For each PR I copied the head's test files into its base tree and ran them there; green is the same files on the head.

| PR | file | red (base source) | green (head) |
|---|---|---|---|
| #295 | mcp-command-paths | **11 failed** / 11 (`checkMcpCommandPaths is not a function` x10, `resolveMcpCommand` x1) | 11 passed |
| #298 | mcp-command-paths | **7 failed**, 12 passed (all 7 in the T-008b block) | 19 passed |
| #300 | skills-contract | **9 failed** / 9 (`checkSkillsContract is not a function`) | 9 passed |
| #303 | staleness | **3 failed**, 16 passed (ahead, diverged, unknown sha) | 19 passed |
| #306 | t048-counts | **6 failed** / 6 | 6 passed |
| #306 | t048-counts-parity | **7 failed** / 7 | 7 passed |
| #306 | checks | **2 failed**, 100 passed | 102 passed |
| #306 | hook-registration | **1 failed**, 6 passed | 7 passed |
| #306 | mirror-parity | **1 failed**, 12 passed | 13 passed |
| #309 | t048-counts | **9 failed**, 4 passed | 13 passed |

#306's red totals 17, matching its handoff. #309's 9/13 is the handoff's 8/12 plus the `sh -c` row added later.

## Row 3: mutants

| PR | QA's own mutant | caught by | developer's mutant re-run |
|---|---|---|---|
| #295 | `exts = []` (no PATHEXT on Windows) | 2 red: row 2 (bare name via PATHEXT), row 4 | `absolute-only`: **4 red**, 7 green (= handoff) |
| #298 | warn cap removed (`if (notChecked.length > 0)` → `if (false)`) | **1 red only**: "an unreadable .mcp.json is 'not checked', not a pass" | `claude-json-only`: **7 red**, 12 green (= handoff) |
| #300 | Skill-cell check dropped (`rows.length !== 1` only) | 1 red: "an INDEX row whose Skill cell is not the directory name" | `skip-no-frontmatter`: **1 red** (row 1) (= handoff) |
| #303 | ahead/behind swapped (`m[2]`/`m[1]`) | 3 red: behind, AHEAD, dead-pin-behind | `one-direction`: **2 red** (ahead, diverged), 17 green (= handoff) |
| #306 | vault-path-refs `scanned === 0` → `scanned < 0` | 1 red in `checks.test.ts` ("exempts records…"); t048-counts 6/6 and parity 7/7 stay green | `hook-configs-zero-is-pass`: **2 red** (t048-counts 1, checks 1) (= handoff) |
| #309 | `-c` detection disabled | 1 red: the `sh -c / bash -c` row | `top-level-only`: **9 red**, 4 green (handoff says 8; the 9th is the later `sh -c` row) |

Every mutant was killed. One note: #298's warn cap is pinned by a single row. The two plugin rows that give
`not checked` have nothing else checkable, so they take the `skip` path and do not exercise it.

## Row 4: CI on the heads (read only)

Every run's `headSha` equals the pinned head, and `test` is **pass** on both runs for all six. `test-windows` was
skipped.

| PR | push run | PR run |
|---|---|---|
| #295 | 36980683831 success | 36980699553 success |
| #298 | 36981113693 success | 36981125352 success |
| #300 | 36981365144 success | 36981372828 success |
| #303 | 36982112075 success | 36982118850 success |
| #306 | 36983763926 success | 36983770989 success |
| #309 | 36984838805 success | 36984843268 success |

## Row 5: "not checked" is never a pass

All inputs are fixtures under `C:/qa-tmp` (probes `probe-mcp.mts`, `probe-mcp-mix.mts`, `probe-gnx.mts`,
`probe-hooks.mts`).

**#295** (`checkMcpCommandPaths`):
- absent `~/.claude.json` → `skip: not checked: …\.claude.json does not exist. This is not a pass.`
- unparseable → `skip: not checked: … could not be read as JSON (Expected property name …). This is not a pass.`
- a directory → `skip: not checked: … (EISDIR …). This is not a pass.`
- only a `${HOME}/bin/x` command → `skip: not checked: no mcpServers entry with a command … Skipped 1: x (global): command uses ${...} expansion, not resolved here. This is not a pass.`
- only `command: [..]` → `skip: … Skipped 1: x (global): no command and no url. This is not a pass.`
- **NOT MET:** a good command plus a `${...}` command → **`pass: 1 MCP server command(s) resolve to a file. Skipped 1: x (global): command uses ${...} expansion, not resolved here.`**
  A good command plus a non-string command → **`pass: … Skipped 1: y (global): no command and no url.`**
  An unparseable command alongside a readable one is a pass. Fix: count non-url skips as not checked, which caps the
  result at `warn`. That is the rule #298 already applies to sources and #309 applies to hook commands.

**#298** (adds `.mcp.json` and plugins). A–E are the same as #295. Then:
- F: an unparseable checkout `.mcp.json` → `warn: 1 … resolve to a file, but not checked: …\.mcp.json could not be read as JSON (…). This is not a full pass.` ✓
- H: an enabled plugin with an unparseable `installed_plugins.json` → `warn: … not checked: plugin thing: enabled, but …installed_plugins.json could not be read as JSON (…), so its install directory is unknown. This is not a full pass.` ✓
- I: an enabled plugin with a garbled `plugin.json` and no `.mcp.json` → `warn: … not checked: plugin thing: …plugin.json could not be read as JSON …` ✓
- K: manifest `mcpServers: "./missing.json"` → `warn: … not checked: plugin thing: …missing.json does not exist.` ✓
- **NOT MET (G):** a good global config and an **unparseable `~/.claude/settings.json`** → **`pass: 1 MCP server command(s) resolve to a file.`**
  `enabled` falls back to `[]` when settings cannot be read, so no plugin is looked at and nothing is said. This is a
  silent pass on an unread source.
- **NOT MET (J):** an enabled plugin with a **garbled `plugin.json`** plus a good root `.mcp.json` → **`pass: 2 … resolve to a file.`**
  The manifest's parse failure is dropped: `if (manifest.ok)` skips it and nothing goes into `notChecked`.
- It inherits #295's mixed `${...}` pass.

**#303** (`checkGitNexusIndex`):
- unknown sha → `warn: not checked: indexed commit 1234567 unknown — it is not present in this repository, so staleness is UNDEFINED, not zero. Reindex. …` ✓
- no `.gitnexus/` → `skip: … not checked … this is not a pass` ✓
- not a git repo → `skip: git unavailable here — index freshness not checked (not a pass)` ✓
- unparseable `meta.json` → `issue: .gitnexus/meta.json unreadable: …`
- no `lastCommit` → `issue: … staleness is undefined; reindex.`

The last two are an `issue`, not a pass, and are unchanged from master.

**#306**:
- hook-configs:
  - absent settings → `warn: settings.json not found` (not a pass).
  - no hooks block → `skip: not checked: no hook command file was read. 0 … of 0 entries. This is not a pass.` ✓
  - unparseable settings.json → **throws** `SyntaxError` (see "Pre-existing").
- hook-registration:
  - unparseable settings → `issue: settings.json is not valid JSON`.
  - no hooks → `skip: not checked: …` ✓
  - only `node` with no script → `skip: not checked: … skipped 1 (… 1 with no recognisable script filename). This is not a pass.` ✓
- **NOT MET:** vault-path-refs with one clean `.md` and an **unreadable** named file (`CLAUDE.md` is a directory, EISDIR) → **`pass: No v1-vault references in docs or commands (1 .md file(s) scanned; not scanned: … 1 unreadable)`**.
  The count is stated but the severity is pass. With *only* the unreadable file it is `skip: not checked: no file was read … 1 unreadable. This is not a pass.` ✓
  Fix: `left.unreadable > 0` caps at `warn`.

**#309** (hook-configs):
- one good plus one unterminated-quote command → `warn: not checked: 1 hook command(s) could not be parsed to a file, so this is not a full pass. 1 … checked; skipped 0; 1 not checked [node "C:/unterminated/x.js (unterminated quote)]; of 2 entries` ✓
- `node` with no script → `warn: not checked: … [node (no script argument after node)]` ✓
- no hooks block → `skip` ✓
- unparseable settings.json still throws (pre-existing; not introduced here).

## Row 6: #298, the plugin layout

- **Fixture chain, confirmed in code and test:**
  - `enabledPlugins` in `~/.claude/settings.json` (only `=== true`);
  - then `~/.claude/plugins/installed_plugins.json` `plugins[key][].installPath`;
  - then `<installPath>/.claude-plugin/plugin.json` `mcpServers`, as an object or a path, and/or `<installPath>/.mcp.json`.

  This is `mcp-command-paths.test.ts` `plugin()` at lines 151–165. Rows: inline missing → issue; root `.mcp.json`;
  unreadable manifest; not in the registry; disabled → not looked at.
- **`${CLAUDE_PLUGIN_ROOT}` is resolved** by literal substitution (`split("${CLAUDE_PLUGIN_ROOT}").join(installPath)`)
  in **`command` only**. `args` and `env` are not substituted, and are never stat'ed. Any other `${...}` is skipped.
  Shown on fixture J: `${CLAUDE_PLUGIN_ROOT}/run.cmd` resolved to the install dir and passed. The developer's test shows
  the absent half named with the resolved path.
- **Real install: NOT DONE.** Clark's rule allows `~/.claude.json` and `~/.claude/settings.json` only, and the
  registry and manifests live under `~/.claude/plugins`. From `settings.json`: `enabledPlugins` has **14 keys, 2 set
  to `true`**: `context-mode@context-mode` and `typesafe@typesafe-ai`.

  The developer's handoff reports only `context-mode` enabled. `typesafe@typesafe-ai` is enabled on this desktop, so a
  real run here would also exercise a second plugin. Whether `installed_plugins.json` and that plugin's manifest follow
  the fixture layout is **unverified by QA**.

## Row 7: #309, real settings

I ran `checkHookConfigs` read-only on this machine's `~/.claude/settings.json` (5 events, 6 matcher groups, 6 hook
entries):

```
hook-configs: pass | 5 hook command file(s) checked; skipped 1 (1 not a command that launches a file); 0 not checked; of 6 entries
```

The same file under #306 gives `skip | 0 hook command file(s) checked; skipped 6 (6 with no command string) of 6
entries`. For comparison, hook-registration gives `pass | 5 script registration(s) counted across 5 event(s);
skipped 1 (0 with no command, 1 with no recognisable script filename)`.

Fixture entries:
- `sh -c "node /nonexistent/never.js && echo hi"` next to a good `node <file>` → `warn: not checked: 1 hook command(s) could not be parsed to a file … [sh -c "node /nonexistent/never.js && echo hi" (inline shell (-c), the script is the string itself)]`.
  It is not checked, and no "missing files" line appears. ✓
- `node "C:\path with spaces\x.js"` (absent) → `issue: Hook commands reference missing files: C:\path with spaces\x.js. 1 … checked`.
  It was stat'ed as **one** path. ✓
- A present quoted path with spaces → `pass … 1 hook command file(s) checked` ✓

## Row 8: #303, fixture repos

| case | result |
|---|---|
| at HEAD | `pass: index is at HEAD (indexed 04d8502, HEAD 04d8502; behind=0 ahead=0; …)` |
| behind 2 | `warn: index is 2 commit(s) behind HEAD, ahead=0 — run analyze (… behind=2 ahead=0 …)` |
| ahead 3 | `warn: index is 3 commit(s) AHEAD of HEAD — HEAD is an ancestor of indexed 17f7dac; … (behind=0 ahead=3 …)` |
| diverged (mb `3844781`, index +2, HEAD +3) | `issue: index diverged from HEAD — 3 commit(s) behind and 2 ahead, merge-base 3844781; neither is an ancestor of the other. Reindex. …` |

The diverged case names both counts and the merge-base. ✓

## Row 9: batch merge

I built a scratch branch `qa/b2-sync-merge` (local, not pushed) from `origin/master` `50700414` and merged with
`--no-ff` in order:

| # | merge commit | result |
|---|---|---|
| #295 | `734b9bdc` | clean |
| #298 | `e10d9af2` | clean |
| #300 | `ebec2b56` | clean |
| #303 | `87b98bf2` | clean |
| #306 | `957f0478` | clean |
| #309 | `19c3585e` | **1 conflict**, `checks.ts`, one hunk at lines 1–5 |

**The only conflict.** The markers wrapped the **`node:fs`** import line (#295's
`accessSync, constants as fsConstants` against #309's unchanged line). The `node:path` line, which both #295 and #309
edited to the identical `join, posix as pathPosix, win32 as pathWin32`, sits next to it and auto-resolved. Git
reported the adjacent edits as one hunk.

I took this to be the named import-line conflict and resolved it as the **union of imported names**: #295's `node:fs`
line, a superset, with `node:path` unchanged. `git show --remerge-diff 19c3585e` shows only that hunk. There were no
other conflicts.

On the merged result (`19c3585e`), one file per invocation:

| file | result |
|---|---|
| mcp-command-paths | 19 passed |
| skills-contract | 9 passed |
| staleness | 19 passed |
| t048-counts | 13 passed |
| t048-counts-parity | 7 passed |
| checks | 102 passed |
| hook-registration | 7 passed |
| mirror-parity | 13 passed |

That is **189 passed, 0 failed**. `tsc --noEmit` exit 0, and `npm run build` printed `build stamped 19c3585`.

I ran `node open-brain/build/cli.js sync --check` in the merge tree with fixture homes. Exit was 1 in every run,
because of `worktree-layout` and `greeting-size` (below).

**Fixture home with config** (`C:\qa-tmp\home-fixture`):
- a missing `gitnexus` command, a url server, an enabled `ghost@qa` plugin with no registry;
- hooks: a good `node` file, a quoted missing path with spaces, and `sh -c`.

```
hook-configs: Hook commands reference missing files: C:\path with spaces\x.js. 2 hook command file(s) checked; skipped 0; 1 not checked [sh -c "node /x.js && echo hi" (inline shell (-c), the script is the string itself)]; of 3 entries
hook-registration: Duplicate hook registrations — PostToolUse: x.js registered 2x. 3 script registration(s) counted across 1 event(s); skipped 0
mcp-command-paths: MCP command path missing — gitnexus: C:\Program Files\nodejs\gitnexus-qa256-absent.cmd not found (global). The server cannot start, so its tools are silently absent. Skipped 1: remote (global): url server, no command to stat. not checked: plugin ghost: enabled, but C:\qa-tmp\home-fixture\.claude\plugins\installed_plugins.json does not exist, so its install directory is unknown.
gitnexus-index [skip]: no .gitnexus/ in this tree — index freshness not checked (the index lives in one checkout; this is not a pass)
command-parity [pass]: 6 shared commands identical to the template (user scope absent — not checked; excepted 1 template-only [bootstrap.md]; 0 non-.md file(s) ignored)
command-tool-names [pass]: 50 tool references across 18 command files (3 of 5 command directories scanned; absent: ~/.claude/commands, ~/.cursor/commands) all resolve to 14 registered tools (…)
command-names [pass]: 48 command references across 22 instruction files (3 of 5 command directories scanned; absent: ~/.claude/commands, ~/.cursor/commands) all resolve to 8 command files or 2 declared host commands (…)
retirements [pass]: 11 retirements …, with 78 (file, retirement) pair(s) not scanned because the file is a declared referrer; …
module-boundary [pass]: core does not import memory (92 file(s), 71 core; excluded 13 non-.ts file(s), …; 50 type-only and 176 package import(s) are not edges). …
Summary: 31 passed, 0 fixed, 2 warnings, 5 issues, 2 skipped
```

The `x.js registered 2x` duplicate is hook-registration's filename-only key matching `x.js` inside the `sh -c`
string. That is the old behaviour, not a new check.

**Empty fixture home:**
- `mcp-command-paths: not checked: C:\qa-tmp\home-empty\.claude.json does not exist. This is not a pass.`
- `hook-configs: settings.json not found` (warn)
- `hook-registration: settings.json not found` (warn)
- Summary `31 passed, 0 fixed, 4 warnings, 2 issues, 3 skipped`.

The CLI does not print passing checks, so I called these from the merged source with the fixture home:
- `skills-contract [pass]: 2 skill(s): directory, SKILL.md name and INDEX.md row agree for each`
- `vault-path-refs [pass]: No v1-vault references in docs or commands (45 .md file(s) scanned; not scanned: 6 non-.md, 0 CHANGELOG.md, 0 skipped directories (…), 3 absent directories, 1 absent named file(s), 0 unreadable)`
- `mirror-parity [pass]: Slash-command mirrors in sync (6 file comparison(s) + the template Cursor set asserted; 2 excepted [bootstrap.md (…), harness-audit.md (…)]; 0 non-.md file(s) ignored; 2 optional pair(s) skipped […])`

**The two issues in every run** are not B2's checks:
- `worktree-layout` names my `qa256-*` scratch worktrees (an artefact of this QA's setup);
- `greeting-size` reports 49303 characters against a 40000 limit, master state.

## Pre-existing, and gaps (not deciding)

- **hook-configs throws on an unparseable `settings.json` and takes `/sync` down.** On the merged build with a garbled
  fixture settings.json, `sync --check` exits 1 with `SyntaxError … at checkHookConfigs (…checks.js:216:27)` and
  prints no report at all. The unguarded `JSON.parse` is on master (`checks.ts:157` at `50700414`). #306 and #309
  rewrote the function around it and kept it. hook-registration already catches the same case.
- **command-tool-names / command-names absent-directory names (#306)** use `d.startsWith(home)`, where `home` is not
  normalised. With a forward-slash `USERPROFILE` (`C:/qa-tmp/home-empty`), `homedir()` returns that spelling, the
  prefix test fails, and the name falls through to `d.slice(projectRoot.length + 1)`. The result is garbage:
  `absent: de/commands, or/commands`. With the native backslash spelling it is correct. This is a robustness note for
  the fallback branch.
- **#298:** the warn cap is pinned by one row only (row 3).
- **#298's handoff saw one enabled plugin.** This desktop has two (`typesafe@typesafe-ai` as well).
- hook-registration counts an entry whose command is garbled (an unterminated quote) as a registration and passes. It
  keys on any `*.js` substring, so it does not parse, and it is outside B2's changes.

## Tooling notes

- I could not use `npm ci`, junctions or inline env prefixes from this seat, so I used `npm install` per tree and a
  `node` wrapper (`C:/qa-tmp/run-sync.mjs`) to set the fixture home.
- I edited own mutants in place and reverted them with `git checkout --`. Every scratch tree was clean afterwards
  (`git status --short` empty).
- No issue or PR was created, edited or commented on. The only push is this report branch, through `push-qa.mjs`.
- Secret scan: see the E_t `notes`.

QA-256: REPORT COMPLETE
