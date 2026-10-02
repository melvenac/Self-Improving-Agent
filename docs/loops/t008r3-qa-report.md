# QA 262: #295 and #298 round 3, the narrow re-check (T-008, T-008b), QA report

**By:** QA 262 (Claude Code, Opus 5.5, headless), 2026-10-02, record session 262, on Linux (`/home/agents`).
**Dispatch:** `docs/loops/qa-262-r3-dispatch.md`. **Job class:** LIGHT. I ran one test file per vitest invocation,
put mutants on touched files only, and used `gh` for reads only. I did not run the full suite and made no live Jev call.

- **Dispatch tree:** `git -C ~/qa-scratch/qa262-wt log -1 --format=%H` = `e940571bb8f730320e5dce6dc850fbb1b96f879d`.
- **Trees:** `~/qa-scratch/qa262-pr295` (`931998db`), `qa262-pr298` (`3b485b7c`), `qa262-base295` (`7312a292`),
  `qa262-base298` (`7afd7f1b`). Each base tree has the new head's `mcp-command-paths.test.ts` copied in. The batch merge
  was done in `qa262-merge` (local branch `qa/t008r3-merge`, which I did not push). Each tree had its own
  `npm ci --ignore-scripts` run. No PR changes `package.json` or the lockfile.
- **Probes** (outside the repo, under `~/qa-tmp/qa262/`):
  - `probe-mcp.mts`: QA 260's 19 fixture homes, kept verbatim, plus 19 round-3 fixtures prefixed `r3-`.
  - `probe-real.mts` and `real-counts.mjs` (row 7, redacted).
- **Heads verified:** `origin/loop/t008-mcp-paths` = `931998db`, `origin/loop/t008b-mcp-sources` = `3b485b7c`,
  `origin/loop/t048-sync-counts` = `3f30e825`, `origin/loop/t048-hook-configs-nested` = `f1c2a338`.
  - All four match the pinned SHAs and `gh pr list` headRefOid.
  - #295's base is `master` and #298's base is `loop/t008-mcp-paths`.
  - `931998db` is an ancestor of `3b485b7c`. #295's first commit sits on `a30fa359`.
- **Master moved:** it is now `e940571b`, not `a30fa359`. `git diff --stat a30fa359 e940571b -- open-brain` is empty,
  so nothing under `open-brain/` changed.

## Verdicts

| PR | task | head | verdict | deciding rows |
|---|---|---|---|---|
| #295 | T-008 | `931998db` | **ACCEPT** | rows 1–6 and 8 met |
| #298 | T-008b | `3b485b7c` | **ACCEPT** | rows 1–6 and 8 met |

**Batch merge (#295, #298, #306, #309): mechanics clean.** There is one import-line hunk, resolved by union. The 6
touched sync test files give 179 passed, and `tsc --noEmit` exits 0. Per the dispatch, this re-check is **not**
under Aaron's overnight pre-approval, so any merge waits for his word.

Both QA 260 findings are fixed, as D-106 rules:

- A non-object or `null` entry is now WARN and is named by its key in **every** source: global, project, checkout
  `.mcp.json` and plugin.
- An absent `settings.json` is PASS, and the message ends with the required note.

## Row 1: QA 260's failing fixtures

The good command is an executable file in the fixture, and `PATH` is pinned to a nonexistent dir. In the global-scope
`r3-` rows `settings.json` is present (`{}`), so #298 adds no absence note to them.

**#295 (`931998db`):**

| fixture (beside a good entry) | result | |
|---|---|---|
| `broken: null` | `warn: 1 MCP server command(s) resolve to a file, but 1 not checked. Not checked 1: broken (global): entry is not an object. This is not a full pass.` | ✓ |
| `broken: "npx something"` | same `warn`, `broken (global): entry is not an object` | ✓ |
| `broken: 7` | same `warn`, `broken (global): entry is not an object` | ✓ |
| extra: `true`, `0`, `""` | same `warn`, named | ✓ |
| extra: `["x"]` (array: `typeof` is object) | `warn … broken (global): no command and no url` | ✓ (WARN and named; different reason) |
| extra: `null` in a project's `mcpServers` | `warn … broken (project /p): entry is not an object` | ✓ |
| extra: `null` alone (no good entry) | `skip: not checked: … Not checked 1: broken (global): entry is not an object. This is not a pass.` | ✓ |

**#298 (`3b485b7c`):** null, string, number, `true`, `0` and `""` all give the same `warn`, with #298's wording
`but not checked: broken (global): entry is not an object.`. D-106 says "every source", so I also probed the
sources that only #298 reads:

| fixture (beside a good entry) | result | |
|---|---|---|
| `broken: 7` in the checkout `.mcp.json` | `warn … not checked: broken (.mcp.json): entry is not an object.` | ✓ |
| `broken: "x"` in an enabled plugin's `.mcp.json` | `warn: 2 … but not checked: broken (plugin thing): entry is not an object.` | ✓ |
| `null` in a project's `mcpServers` | `warn … broken (project /p): entry is not an object` | ✓ |

**#298, the absent `settings.json` side:**

| fixture | result | |
|---|---|---|
| **absent** `~/.claude/settings.json` + good | `pass: 1 MCP server command(s) resolve to a file. Skipped: settings.json absent: no plugins enabled, none examined.` The message **ends with** the required text. | ✓ |
| absent + url server + good | `pass: … Skipped 1: u (global): url server, no command to stat. Skipped: settings.json absent: no plugins enabled, none examined.` (ends with it) | ✓ |
| present `{}` + good | `pass: 1 MCP server command(s) resolve to a file.` (no note) | ✓ |
| present `{"enabledPlugins":{}}` + good | `pass: …` (no note) | ✓ |
| present BOM + `{}` / present `null` + good | `pass: …` (no note) | ✓ |
| unparseable / directory `settings.json` | `warn … settings unreadable, plugins not examined …` (no absence note) | ✓ |

## Row 2: everything QA 260 accepted still holds

I re-ran QA 260's `probe-mcp.mts` cases unchanged on both new heads, and compared them with the previous heads
`7312a292` and `7afd7f1b`. **Every QA 260-accepted fixture keeps its severity.**

| PR | fixture | new head | |
|---|---|---|---|
| #295 | good + `${HOME}/bin/x` | `warn … Not checked 1: x (global): command uses ${...} expansion, not resolved here.` | ✓ |
| #295 | good + `command: ["node","x"]` / `{type:"stdio"}` / `command: ""` | `warn` ("no command and no url") all three | ✓ |
| #295, #298 | url server named | `pass … Skipped 1: u (global): url server, no command to stat.` | ✓ |
| #298 | G: unparseable `settings.json` | `warn … could not be read as JSON (…): settings unreadable, plugins not examined.` | ✓ |
| #298 | G': `settings.json` is a directory | `warn … (EISDIR …): settings unreadable, plugins not examined.` | ✓ |
| #298 | J: garbled `plugin.json` beside good root `.mcp.json` | `warn: 2 … not checked: plugin thing: …/plugin.json could not be read as JSON (…)` | ✓ |
| #298 | same, manifest ABSENT | `pass: 2 MCP server command(s) resolve to a file.` | ✓ |
| #298 | `settings.json` = `{}` / BOM + `{}` | `pass: 1 MCP server command(s) resolve to a file.` | ✓ |
| #298 | #295's mixed rows | `warn`, with `but not checked: x (global): …` | ✓ |

**Finding R2-a (change, explained, not deciding).** On #298, every QA 260 fixture that has **no**
`settings.json` now has `Skipped: settings.json absent: no plugins enabled, none examined.` appended. That covers the
mixed `${...}`, non-string, no-command and empty-command rows, the url row, `good-only`, the unparseable checkout
`.mcp.json` row and the absent `~/.claude.json` row.

- Severity is unchanged in every case.
- This is exactly the D-106 change. It reaches the WARN path as well as the PASS path, because the note is appended
  to both returns.
- No other text changed between the old and new heads.

## Row 3: red then green

I ran each new head's `mcp-command-paths.test.ts` against the previous head's `checks.ts`. To do that I copied the
test file into `qa262-base<N>`.

| PR | red (previous head) | green (new head) |
|---|---|---|
| #295 | `7312a292`: **1 failed** \| 15 passed (16). Failing: "QA 260: a NON-OBJECT or null mcpServers entry beside a good one is WARN, and names the server key" (`expected 'pass' to be 'warn'`) | `931998db`: 16 passed |
| #298 | `7afd7f1b`: **3 failed** \| 27 passed (30). Failing: #295's non-object row; "an ABSENT ~/.claude/settings.json enables nothing and stays a pass, with the skip NAMED"; "B2 r3 (QA 260): a non-object mcpServers entry is WARN here too, with the #298 wording" | `3b485b7c`: 30 passed |

**Note R3-a.** #298's fourth new row, "a PRESENT settings.json does not carry the absent-skip note", passes on the
previous head too. It is a negative guard, and the old code adds no note at all, so it cannot go red there. My
row-4 mutant A shows that it does kill an always-on note. I record this as a note, not a failure. The dispatch says
"the new rows fail against each previous head", and a guard row cannot.

The probe also shows red then green, on top of the tests: all six non-object fixtures and both absence fixtures give
`pass` on the previous heads (see row 2's comparison).

## Row 4: mutants

Each mutant was applied in the head tree. I ran its test file and then reverted with `git checkout -- open-brain/src`.
`git status --porcelain` is empty in both trees afterwards.

| PR | mutant | result |
|---|---|---|
| #295 | dev `nonobject-dropped.diff` (drop the `notChecked.push`) | **1 red** (the non-object row) — killed |
| #295 | QA: a non-object entry goes to `skipped` instead of `notChecked` (named, but a pass) | **1 red** (`… Skipped 1: broken (global): entry is not an object.: expected 'pass' to be 'warn'`) — killed |
| #298 | dev `absent-unnamed.diff` (drop `${absentNote}` from the pass return) | **1 red** ("an ABSENT … with the skip NAMED") — killed |
| #298 | QA A: `const settingsAbsent = true;` (note on every run) | **1 red** ("a PRESENT settings.json does not carry the absent-skip note") — killed |
| #298 | QA B: `const settingsAbsent = !settings.ok;` (an unreadable settings.json is also called "absent") | **0 red, 30 passed — SURVIVED** |

**Finding R4-a (test gap, not deciding).** Under mutant B, an unparseable `settings.json` gives a WARN that says both
"settings unreadable, plugins not examined" and "settings.json absent". The severity stays correct (WARN), so the
D-106 rule is not broken. But no test pins that unreadable settings carry **no** absence note. On the real head my
probe shows the G and G' messages carry no note (row 1), so the behaviour is right today and simply not pinned.

## Row 5: rebase integrity

**#295:** `git range-diff 7312a292...931998db`

- Rows 1–23 are master commits (`11c183e4` … `4ef528a8`). They are rebase context: the new base is `a30fa359`, and
  `cd7a1521~1` = `a30fa359`.
- `ae01665f = cd7a1521`, `d49deeed = 749e8935`, `7312a292 = d6f9d870`: all three are **identical** (`=`).
- New: `9955358b` (r3 fix and test) and `931998db` (r3 mutant diff). These are round 3's commits.

**#298:** `git range-diff 7312a292..7afd7f1b 931998db..3b485b7c`

- `1d02c78b ! 7ad5601b` (T-008b, first commit). The only delta is in context lines, where #295's r3 change now
  appears: `if (!def || typeof def !== "object") continue;` became the r3 block with its comment. This is rebase
  context from the new #295 base. Nothing of #298's own changes.
- `caa5192d = ea5f1b08` and `7afd7f1b = ab67c71e` are identical.
- New: `441d1a12` (r3 fix and tests) and `3b485b7c` (r3 mutant diff).

**Nothing else changed.** Round 3's source changes are:

- #295: 5 lines in `checks.ts`, plus one test of 9 lines.
- #298: 2 consts and 3 message suffixes in `checks.ts`. Its test changes are a wording update to #295's row plus 3 rows.
- The two mutant diffs.

## Row 6: CI on each head (read only)

`gh pr checks <n>`:

```
#295  changed pass 5s  | test pass 2m42s | test-windows skipping   run 37039012145
#298  changed pass 7s  | test pass 2m2s  | test-windows skipping   run 37039129218
```

`gh run view`: both runs are `pull_request` and `completed`/`success`. Each `headSha` equals the pinned head
(`931998db3b57…`, `3b485b7c6e91…`). `test-windows` was skipped on both.

## Row 7: real config, read-only

I ran `checkMcpCommandPaths` from each head on this machine's home, with the head's own checkout as `projectRoot`.
Output was redacted, with home shown as `~`:

```
mcp-command-paths (qa262-pr295): skip | not checked: no mcpServers entry with a command in ~/.claude.json. This is not a pass.
mcp-command-paths (qa262-pr298): skip | not checked: no mcpServers entry with a command in ~/.claude.json. This is not a pass.
```

Inputs, as key names and counts only (`real-counts.mjs`):

- `settings.json` keys: `tui, theme, agentPushNotifEnabled, statusLine`. `enabledPlugins` has 0 keys.
- `~/.claude.json`: global `mcpServers` 0, `projects` 2, project `mcpServers` 0.
- `installed_plugins.json` is absent, and the checkout has no `.mcp.json`.

SKIP is correct for these inputs. As in QA 260, **this machine's real config exercises nothing**, because there are
no MCP servers and no plugins. `settings.json` is present here, so the absence note correctly does not appear (it
would only show on a pass anyway).

## Row 8: merge order

Local scratch branch `qa/t008r3-merge` from `origin/master` `e940571b` (not pushed), `--no-ff`, in order:

| # | head | merge commit | result |
|---|---|---|---|
| #295 | `931998db` | `9eff6dc7` | clean |
| #298 | `3b485b7c` | `91a43479` | clean |
| #306 | `3f30e825` | `6e1c8022` | clean (`checks.ts`, `checks.test.ts` auto-merged) |
| #309 | `f1c2a338` | `3413e4f2` | **1 conflict**, `checks.ts`, one hunk at lines 1–5 |

**The only conflict, and how I resolved it.** As in QA 256 and QA 260, the conflict markers wrap the **`node:fs`**
line, not the `node:path` line the dispatch names.

- The two sides of the `node:fs` line: #295's `statSync, accessSync, constants as fsConstants` against #309's
  `statSync`.
- The adjacent `node:path` line (`join, posix as pathPosix, win32 as pathWin32`) is identical on both sides and
  auto-resolved.
- This is the same import-line conflict the dispatch means. I resolved ONLY that hunk, by taking the union of the
  imported names. #295's `node:fs` line is a superset of #309's, so the union is #295's line.
- `git show --remerge-diff 3413e4f2` shows only that hunk: 4 lines removed, 0 added. No markers remain under
  `open-brain/src`.

On the merge (`3413e4f2`), one file per invocation. These are the 6 test files the batch touches, per
`git diff --name-only e940571b HEAD -- open-brain/tests`:

| file | result |
|---|---|
| checks | 102 passed |
| hook-registration | 7 passed |
| mcp-command-paths | 30 passed |
| mirror-parity | 13 passed |
| t048-counts-parity | 7 passed |
| t048-counts | 20 passed |

That is **179 passed, 0 failed**, and `npx tsc --noEmit` exits **0** with no output.

- **Environment note.** The first `checks` run gave 12 failed, all `Could not locate the bindings file`: the
  `better-sqlite3` native binding had not been built, because of `npm ci --ignore-scripts`. After
  `npm rebuild better-sqlite3` in the merge tree's own `node_modules`, the run gave 102/102. This was an environment
  cause, not code.
- **Probe on the merge:** `probe-mcp.mts` gives output identical to #298's head on all 38 fixtures.
- **A run I discarded:** my first vitest attempt used `npx --prefix … --root …`. Vitest resolved its root to the QA
  clone, found no test files, and exited 1 without writing anything. Every later run was started from inside the
  scratch tree.

## Gaps and further findings (not deciding)

1. **R2-a:** the absence note now also shows on WARN results and on fixtures QA 260 recorded without it. The severity
   is unchanged, and this is the D-106 change (row 2).
2. **R4-a:** QA mutant B (`settingsAbsent = !settings.ok`) survives. No test pins that an *unreadable* `settings.json`
   gets no "absent" note. Today's behaviour is right, and one assertion on the G test would pin it.
3. **The absence note appears only on PASS and WARN results.** An ISSUE (a missing command) and a SKIP (url-only, or
   no command) with no `settings.json` say nothing about settings. D-106 asks for the note on PASS only, so this
   meets the ruling. I record it in case the planner wants it on every result.
4. **Wrong-type containers are still dropped silently.** I carried this forward from QA 260 gap 1. A project's
   `mcpServers: "oops"` and a checkout `.mcp.json` of `[1,2]`, each beside a good server, still give `pass`. D-106
   rules on *entries*, and the round-3 fix covers entries in every source. Containers are not entries, so this is not
   deciding.
5. **An array entry (`["x"]`) is reported as "no command and no url", not "entry is not an object".** It is still
   WARN and named, so this is a wording point only.
6. **#298 row R3-a:** the present-settings guard row cannot go red on the previous head (row 3).
7. **Row 7's real run exercised nothing** on this machine. There are no MCP servers and no plugins.
8. **The dispatch names the wrong import line.** It says `node:path`, but the conflicting line is `node:fs`, the same
   as in QA 260 (row 8).

## Verdict lines

- #295 T-008 `931998db`: **ACCEPT**. Null, string and number entries beside a good one each give WARN and name the
  key. Red on `7312a292` and green on the head. Both mutants were killed. The rebase is clean, and CI is green.
- #298 T-008b `3b485b7c`: **ACCEPT**.
  - An absent `settings.json` gives PASS, and the message ends with
    `Skipped: settings.json absent: no plugins enabled, none examined.`. A present one carries no note.
  - A non-object entry gives WARN in every source.
  - Red on `7afd7f1b` and green on the head. The developer's mutant and QA mutant A were killed; QA mutant B survived (gap 2).
  - The rebase is clean, and CI is green.
- Batch merge (#295, #298, #306, #309): mechanics clean (one import-line hunk, by union). 179 touched tests pass and
  `tsc` passes. **Not under the overnight pre-approval: any merge waits for Aaron's word.**

QA-262: REPORT COMPLETE
