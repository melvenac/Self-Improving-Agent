# QA 260, B2 round 2 (/sync checks re-check): #295, #298, #306, #309, QA report

**By:** QA 260 (Claude Code, Opus 5.5, headless), 2026-10-02, record session 260, on Linux (`/home/agents`).
**Dispatch:** `docs/loops/qa-260-b2r2-dispatch.md`. **Job class:** LIGHT. I ran one test file per vitest invocation,
put mutants on touched files only, and used `gh` for reads only. I did not run the full suite and made no live Jev call.

- **Dispatch tree:** `git -C ~/qa-scratch/qa260-wt log -1 --format=%H` = `64a70651ae8da217dac3280cced3d8eb617cad3e`.
- **Trees:** `~/qa-scratch/qa260-pr<N>` (pinned heads), `~/qa-scratch/qa260-base<N>` (previous-round heads
  `cc285738`, `7b09c5b7`, `d8dc12db`, `eb721dec`, with the new head's changed test file copied in), and
  `~/qa-scratch/qa260-merge` (row 7, local branch `qa/b2r2-sync-merge`, not pushed). Each tree had its own
  `npm ci --prefix` run, which completed with install scripts not run. No PR changes `package.json` or the lockfile.
- **Probes** (outside the repo, under `~/qa-tmp/qa260/`): `probe-mcp.mts` (19 fixture homes), `probe-hooks.mts`
  (12 hook-configs fixtures, 4 vault-path-refs fixtures), `probe-real.mts` and `real-counts.mjs` (row 6, redacted).
- **Heads verified:** `origin/loop/t008-mcp-paths` = `7312a292`, `origin/loop/t008b-mcp-sources` = `7afd7f1b`,
  `origin/loop/t048-sync-counts` = `3f30e825`, `origin/loop/t048-hook-configs-nested` = `f1c2a338`. They match the
  pinned SHAs and `gh pr list` headRefOid. The stacks hold: `7312a292` is an ancestor of `7afd7f1b`, and `3f30e825`
  is an ancestor of `f1c2a338`. #298's base is `loop/t008-mcp-paths` and #309's base is `loop/t048-sync-counts`.
- **Confined:** each PR's own diff (`origin/master...head` for #295 and #306, `7312a292..7afd7f1b` for #298 and `3f30e825..f1c2a338` for #309)
  touches only `open-brain/src/pipelines/sync/{checks,index}.ts`, the sync tests, and the PR's own handoff and mutant docs.

## Verdicts

| PR | task | head | verdict | deciding row |
|---|---|---|---|---|
| #295 | T-008 | `7312a292` | **REJECT** | rule under test: a **non-object** (or `null`) `mcpServers` entry beside a good one gives a silent **pass**, unnamed |
| #298 | T-008b | `7afd7f1b` | **REJECT** | row 2: an absent `settings.json` gives PASS, but the skip is **not named** in the message. It also inherits #295's non-object finding. |
| #306 | T-048 counts | `3f30e825` | **ACCEPT** | rows 1, 3, 4, 5 and 7 met |
| #309 | T-048 hook-configs | `f1c2a338` | **ACCEPT** (its own diff; it merges only after #306) | rows 1–5 and 7 met |

**Batch: REJECT.** Row 7 merged all four with only the named import-line resolution, and every touched test and
`tsc` are green. But #295 and #298 are not accepted.

**QA 256's five failing fixtures all pass now** (row 1). Both rejections are new findings against the round-2 rule
text in the dispatch:

- **#295.** The dispatch lists "a non-object entry" under *not checked, gives WARN* with no hook-only qualifier.
  `checkMcpCommandPaths` does `if (!def || typeof def !== "object") continue;`, so the entry is neither counted nor
  named. If the planner scopes "a non-object entry" to **hook** entries only, #295 flips to ACCEPT.
- **#298.** Row 2 says the named skips "all give PASS, **with the skip named in the message**". An absent
  `~/.claude/settings.json` gives `pass: 1 MCP server command(s) resolve to a file.` and says nothing about settings.
  The developer's handoff chose this deliberately ("an ABSENT one enables nothing and stays quiet"). The severity is
  right; only the naming is missing, so the fix is one line in the message. If the planner rules that an absent
  `settings.json` needs no mention, #298 still carries the non-object finding, so it flips only if both are waived.

## Row 1: QA 256's failing fixtures on the new heads

All inputs are fixtures under `~/qa-tmp` (`probe-mcp.mts`, `probe-hooks.mts`). The good command is an executable
file in the fixture, and `PATH` is pinned to a nonexistent dir.

| PR | fixture | result | |
|---|---|---|---|
| #295 | good + `${HOME}/bin/x` | `warn: 1 MCP server command(s) resolve to a file, but 1 not checked. Not checked 1: x (global): command uses ${...} expansion, not resolved here. This is not a full pass.` | ✓ |
| #295 | good + `command: ["node","x"]` | `warn: … but 1 not checked. Not checked 1: y (global): no command and no url. This is not a full pass.` | ✓ |
| #295 | good + `{type:"stdio"}` / good + `command: ""` | `warn` ("no command and no url") both | ✓ |
| #298 | G: good global + unparseable `settings.json` | `warn: 1 … resolve to a file, but not checked: <T>/home/.claude/settings.json could not be read as JSON (Expected property name …): settings unreadable, plugins not examined. This is not a full pass.` | ✓ |
| #298 | G': `settings.json` is a directory (EISDIR) | `warn: … (EISDIR …): settings unreadable, plugins not examined. …` | ✓ |
| #298 | J: enabled plugin, garbled `plugin.json`, good root `.mcp.json` (`${CLAUDE_PLUGIN_ROOT}/run`) | `warn: 2 … resolve to a file, but not checked: plugin thing: <T>/plug/.claude-plugin/plugin.json could not be read as JSON (…). This is not a full pass.` | ✓ |
| #298 | same, manifest ABSENT | `pass: 2 MCP server command(s) resolve to a file.` (absent manifest is normal) | ✓ |
| #298 | #295's mixed rows | all `warn`, with #298's wording `but not checked: x (global): …` | ✓ |
| #306 | vault-path-refs: clean `scripts/ok.md` + `CLAUDE.md` as a directory | `warn: No v1-vault references found, but 1 path(s) were unreadable and not checked: this is not a full pass. 1 .md file(s) scanned; … 1 unreadable` | ✓ |
| #306 | vault-path-refs: only the unreadable file | `skip: not checked: no file was read. … 1 unreadable. This is not a pass.` | ✓ |
| #306 | vault-path-refs: clean + `scripts` is a file (unreadable root dir) | `warn: … 1 unreadable` | ✓ |
| #306 | hook-configs: unparseable `settings.json` | `issue: settings.json is not valid JSON`, **no throw** | ✓ |
| #306 | hook-configs: BOM + valid JSON | parses (no issue) | ✓ |
| #309 | hook-configs: unparseable `settings.json` | `issue: settings.json is not valid JSON`, no throw | ✓ |

The same results hold on the row-7 merge (`40db0b5b`): every probe case gives the same severity there.

## Row 2: the named-skip side

| PR | fixture (each beside a good entry) | result | |
|---|---|---|---|
| #295, #298 | url server | `pass: 1 MCP server command(s) resolve to a file. Skipped 1: u (global): url server, no command to stat.` | ✓ |
| #298 | **absent** `~/.claude/settings.json` | `pass: 1 MCP server command(s) resolve to a file.`: **PASS, but the skip is not named** | **✗** |
| #298 | `settings.json` = `{}` / BOM + `{}` | `pass` (settings read; nothing enabled) | ✓ |
| #309 | bare `echo hi` | `pass: All hook command files exist: 1 hook command file(s) checked; skipped 1 (1 not a command that launches a file); 0 not checked; of 2 entries` | ✓ |
| #309 | `{type:"prompt", prompt:…}` | `pass: … skipped 1 (1 prompt hook, no command); 0 not checked; of 2 entries` | ✓ |
| #309 | `{type:"agent", prompt:…}` | `pass: … skipped 1 (1 agent hook, no command); …` | ✓ |

The not-checked side on #309, each beside a good entry, all give `warn: not checked: 1 hook command(s) could not be
parsed to a file …`:

- `{type:"command"}` → `1 not checked [{"type":"command"} (entry has no command string)]`
- untyped `{timeout:5}` → `[{"timeout":5} (entry has no command string)]`
- `{type:5}` (non-string type) → treated as untyped
- `42` inside a matcher group's `hooks` → `[42 (entry is not an object)]`
- `"str"` as a flat event entry → `["str" (entry is not an object)]`

**Typed-hook mutant that warns again goes red:** the developer's `typed-hook-malformed.diff` (`… && Date.now() < 0`)
on #309 gives **1 failed | 19 passed**. The failure is "B2: a typed non-command hook (prompt, agent) is a NAMED SKIP
inside a passing result", and my probe then gives `warn … [{"type":"prompt","prompt":"p"} (entry has no command string)]`
for both typed fixtures. Reverted.

**The rule under test, non-object entry, on the MCP side (#295, #298): NOT MET.**

| fixture | #295 | #298 |
|---|---|---|
| good + `"s": "npx something"` | `pass: 1 MCP server command(s) resolve to a file.` | same |
| good + `"s": null` | `pass: 1 MCP server command(s) resolve to a file.` | same |

The entry is dropped by `if (!def || typeof def !== "object") continue;` (`checks.ts`, in the server loop). It is
neither counted nor named, so this is a silent pass on an input that was not examined.

## Row 3: red then green

Each head's changed test file was run against the previous round's source (copied into `qa260-base<N>`), then on the head.

| PR | file | red (previous head) | green (new head) |
|---|---|---|---|
| #295 | mcp-command-paths | `cc285738`: **4 failed** \| 11 passed (15): `${...}` beside good, non-string beside good, no command/no url beside good, missing command outranks warn | 15 passed |
| #298 | mcp-command-paths | `7b09c5b7`: **6 failed** \| 21 passed (27): #295's 4 + G + J | 27 passed |
| #306 | t048-counts | `d8dc12db`: **2 failed** \| 8 passed (10): hook-configs unparseable → ISSUE no throw; vault unreadable beside clean → WARN | 10 passed |
| #309 | t048-counts | `eb721dec`: **5 failed** \| 15 passed (20): malformed entry WARN; typed non-command NAMED SKIP; command-type no command WARN; + #306's 2 | 20 passed |

The developer's handoff says #295 has 23 tests and #309 has 17. The files hold 15 and 20. The handoff predates r3/r4
and #298's merge of the two `notChecked` arrays. This is a doc count only.

## Row 4: mutants

Each mutant was applied in the head tree, its test file was run, and the mutant was reverted with
`git checkout -- open-brain/src`. Each tree was clean afterwards.

| PR | QA's own mutant | result | developer's mutant | result |
|---|---|---|---|---|
| #295 | "no command and no url" goes to `skipped` instead of `notChecked` | **2 red** (non-string beside good; no command/no url beside good) | `notchecked-passes` (`if (false && …)`) | **3 red** (= handoff) |
| #298 | absent settings counted as not checked (`if (!settings.ok)`) | **10 red**, including "an ABSENT ~/.claude/settings.json enables nothing and stays a pass" | `settings-silent` | **1 red** (G) (= handoff) |
| #306 | hook-configs unparseable severity `issue` → `warn` | **1 red** ("an unparseable settings.json is an ISSUE, and does not throw") | `vault-unreadable-passes` | **1 red** (vault unreadable beside clean: `expected 'pass' to be 'warn'`) |
| #309 | bare head (`other`) goes to `notChecked` (warns again) | **2 red** ("a bare echo is a named SKIP inside a passing result…", "nothing readable at all is 'not checked'") | `any-type-skips` (`type:"command"` without command skipped) | **2 red** (malformed entry WARN; command-type no command WARN) |

Plus `typed-hook-malformed` on #309 (row 2): **1 red**. Every mutant was killed.

## Row 5: CI on each head (read only)

`gh pr checks <n>`:

```
#295  changed pass 6s  | test pass 2m47s | test-windows skipping   run 37006673986
#298  changed pass 5s  | test pass 2m41s | test-windows skipping   run 37007008347
#306  changed pass 7s  | test pass 2m44s | test-windows skipping   run 37007461710
#309  changed pass 6s  | test pass 2m13s | test-windows skipping   run 37009727374
```

`gh run view`: each run is `pull_request`, `success`, and its `headSha` equals the pinned head (`7312a292…`,
`7afd7f1b…`, `3f30e825…`, `f1c2a338…`). `test-windows` was skipped on all four.

## Row 6: real config, read-only

I ran `checkHookConfigs` (#309 head) on `~/.claude/settings.json` and `checkMcpCommandPaths` (#298 head) on this
machine's home, with the #298 checkout as `projectRoot`. Output was redacted: bracketed command lists and quoted
strings are stripped, and home is shown as `~`.

```
hook-configs: skip | not checked: no hook command file was read. 0 hook command file(s) checked; skipped 0; 0 not checked; of 0 entries. This is not a pass.
mcp-command-paths: skip | not checked: no mcpServers entry with a command in ~/.claude.json. This is not a pass.
```

Inputs, as key names and counts only (`real-counts.mjs`):

- `settings.json` keys: `tui, theme, agentPushNotifEnabled, statusLine`. It has 0 hook events and `enabledPlugins`
  with 0 keys.
- `~/.claude.json`: global `mcpServers` 0, `projects` 2, project `mcpServers` 0.
- `installed_plugins.json` is absent, and the checkout has no `.mcp.json`.

Both SKIPs are correct for these inputs, but **this machine's real config exercises nothing**. There are no hooks,
no MCP servers and no plugins. QA 256's desktop run (5 events, 6 entries, 2 enabled plugins) stays the only
real-config evidence for hook descent, and the plugin chain against a real install is still unverified.

## Row 7: batch merge

Local scratch branch `qa/b2r2-sync-merge` from `origin/master` `a30fa359` (not pushed), `--no-ff`, in order:

| # | merge commit | result |
|---|---|---|
| #295 | `916338ed` | clean |
| #298 | `f85ae64f` | clean |
| #306 | `cab03f0f` | clean |
| #309 | `40db0b5b` | **1 conflict**, `checks.ts`, one hunk at lines 1–5 |

**The only conflict.** As in QA 256, the markers wrapped the **`node:fs`** line: #295's
`statSync, accessSync, constants as fsConstants` against #309's `statSync`. The `node:path` line, which #295 and #309
both edited to the identical `join, posix as pathPosix, win32 as pathWin32`, sits beside it and auto-resolved. I took
this as the named import-line conflict. I resolved ONLY that hunk, by taking the union of imported names (#295's
`node:fs` line, a superset), and left `node:path` unchanged. `git show --remerge-diff 40db0b5b` shows only that hunk:
4 lines removed, 0 added. No markers remain.

On the merge (`40db0b5b`), one file per invocation:

| file | result |
|---|---|
| checks | 102 passed |
| hook-registration | 7 passed |
| mcp-command-paths | 27 passed |
| mirror-parity | 13 passed |
| t048-counts-parity | 7 passed |
| t048-counts | 20 passed |

That is **176 passed, 0 failed**, and `npx tsc --noEmit` exits **0**.

## Gaps and further findings (not deciding)

1. **Containers of the wrong type are dropped silently** (every head, and the merge). Each of these gives `pass`
   with nothing named:
   - hook-configs: an event value that is not an array (`hooks.Other: {x:1}`) beside a good hook. This is pre-existing
     (`if (!Array.isArray(eventList)) continue;`, unchanged from master) and not added by #306 or #309.
   - mcp-command-paths: a project's `mcpServers: "oops"`, or a checkout `.mcp.json` that is `[1,2]`, beside a good
     server (`asMcpServers` returns `{}`).

   The dispatch enumerates *entries*, not containers, so I did not decide on these. Under "any input that was not
   checked caps at WARN" they are the same class as the #295 finding. The planner may want one ruling for all of them.
2. **#298: an absent `~/.claude.json` beside a good checkout `.mcp.json` gives WARN** (`not checked: … .claude.json
   does not exist`). An absent `settings.json`, by contrast, is a quiet pass. This is conservative, not a violation,
   but the two absences are treated differently.
3. **#309: a not-checked hook entry is printed whole** (`JSON.stringify(hook)`) in the message. On a real config, an
   entry with no command but an `env` or `prompt` field would echo those values into `/sync` output. Fixture values
   only here.
4. **Row 6's real run exercised nothing** on this machine (see row 6).
5. The developer handoff's test counts (#295 "23", #309 "17") are stale against the files (15, 20).

## Verdict lines

- #295 T-008 `7312a292`: **REJECT**. A non-object or `null` `mcpServers` entry beside a good one gives a silent pass.
- #298 T-008b `7afd7f1b`: **REJECT**. Row 2: an absent `settings.json` gives PASS without naming the skip. It also
  inherits #295's finding.
- #306 T-048 counts `3f30e825`: **ACCEPT**.
- #309 T-048 hook-configs `f1c2a338`: **ACCEPT** (on its own diff; it merges only after #306).
- Batch (#295, #298, #306, #309): **REJECT**. Merge mechanics are clean, but two candidates are rejected. This batch is
  not under the overnight pre-approval, so any merge waits for Aaron.

QA-260: REPORT COMPLETE
