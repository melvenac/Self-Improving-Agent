> Copied verbatim by the planner (s172) from clark's desktop copy of the QA PC reply. In transit, `…` became `.` in the pasted script (body line 349 below), so the paste does not run as written; see T-170's note. Nothing else is changed.

T-170-II RESEARCH - DONE
MODEL: claude-opus-5-5 (Opus 5.5) for this run; the A1 payload-capture child was `claude -p --model sonnet` (Claude Code 2.1.296)
BASE: 94a577bab2a33635b33f435b6292526d476b84ba
A1: path = tool_input.file_path (Read/Edit/Write; NotebookEdit notebook_path, Glob/Grep path) on Pre/PostToolUse, always absolute; a FAILING Bash fires PostToolUseFailure (field `error`, first line `Exit code N`), NOT PostToolUse, so today's trigger never sees it � A3: 1,399 tool calls / 60 sessions; Bash 60.8%, PowerShell 16.1%; path calls 100% absolute (0 relative, 0 `~`); Bash results with an error signal 4.0%; Bash result length p50 797 / p95 8,892 chars � SCRIPT: proven yes � B: b1/b2/b3/b4 p50 59.3 / 168.4 / 169.1 / 171.2 ms

Reply file: `C:\Users\Aaron Melven\AppData\Local\Temp\t170ii-research-reply.md` (8.3 form: `C:\Users\AARONM~1\AppData\Local\Temp\t170ii-research-reply.md`).
Script: `C:\Users\Aaron Melven\AppData\Local\Temp\t170ii-overfire.mjs` (also pasted in full below).
Nothing was written inside the clone (`git status --porcelain` is empty after the run). No commit, push, PR, or hub post. The live DB was not touched.

---

## Checkout

- OBSERVED (`cd open-brain && npm ci && npm run build && node -e "require('better-sqlite3')"`): 185 packages, `build stamped 94a577b`, `binding ok`. No rebuild was needed.
- OBSERVED (`node -v`): v22.23.3. Machine: QA PC, Intel Core i5-14500, 20 logical CPUs, 32 GB, Windows 10 Pro 10.0.19045. The machine is shared with other runs, and CPU load read 12% at the end of part B.
- No test suite was run.

---

## Part A1 - events and fields

### How the payloads were captured, including one deviation

- **Deviation, disclosed.** The brief asks for the capture under a scratch HOME. OBSERVED: `USERPROFILE=HOME=<scratch> claude -p "say hi"` returns `Not logged in � Please run /login` with exit 1. Claude Code's credentials live under the real profile, and G-051 forbids copying them.
  - I ran the capture child with the real profile for auth only, isolated as follows: `--setting-sources project` (no user settings, so none of the QA PC's own hooks or plugins load), `--strict-mcp-config` (no MCP servers, so no open-brain server writing a sidecar), `--no-session-persistence` (no transcript written to the real `~/.claude/projects`), `--permission-mode bypassPermissions`, and `KNOWLEDGE_V2_DB` pointed at a scratch path.
  - The only hooks loaded were the scratch project's `.claude/settings.json` (`%TEMP%\t170ii\proj`).
  - That settings file registered one logging hook (`%TEMP%\t170ii\log-hook.cjs`, which appends stdin to `payloads.jsonl`) on `PreToolUse`, `PostToolUse` and `PostToolUseFailure` with matcher `*`, plus `PostToolBatch`.
  - The prompt asked for, in order: Read `sample.txt`, Edit it, Write `new.txt`, Glob `*.txt`, Grep `gamma`, Bash `ls does-not-exist-t170` (fails with exit 2), Bash `echo ok-t170`, and Bash `node -e "console.error('E_T170_SYNTH port 4321'); process.exit(3)"` (exit 3). The result was 24 payloads.

### Fields seen in a live payload

All OBSERVED from `%TEMP%\t170ii\payloads.jsonl`. Values are printed only where they are scratch values.

- **Common fields on every tool event:** `session_id, transcript_path, cwd, prompt_id, permission_mode, effort, hook_event_name, tool_name, tool_use_id`. Post events add `duration_ms`. `transcript_path` is present even under `--no-session-persistence`.
- **(a) Paths**

| tool | event(s) seen | `tool_input` keys | path value |
|---|---|---|---|
| Read | PreToolUse, PostToolUse | `file_path` | absolute, backslashes, e.g. `C:\Users\Aaron Melven\AppData\Local\Temp\t170ii\proj\sample.txt` |
| Edit | PreToolUse, PostToolUse | `file_path, old_string, new_string, replace_all` | absolute, backslashes |
| Write | PreToolUse, PostToolUse | `file_path, content` | absolute, backslashes |
| Glob | PreToolUse, PostToolUse | `pattern` (no `path` given this time) | - |
| Grep | PreToolUse, PostToolUse | `pattern, path` | `path` absolute |
| NotebookEdit | not exercised | READ only: `notebook_path` | - |

  - `tool_response` also carries the path: Read `{type, file{filePath,.}}`, Edit and Write `{filePath, .}`, Glob `{filenames[], .}`, Grep `{mode, filenames[], .}`.
- **(b) Errors**
  - A Bash call that exits **0** fires `PostToolUse` with `tool_response = {stdout, stderr, interrupted, isImage, noOutputExpected}`. The observed values were `stdout:"ok-t170"` and `stderr:""`. There is **no exit-status field**.
  - A Bash call that exits **non-zero** fires **`PostToolUseFailure` and no `PostToolUse` at all**. It has no `tool_response`. It has top-level `error` (OBSERVED `"Exit code 2\nls: cannot access 'does-not-exist-t170': No such file or directory"` and `"Exit code 3\nE_T170_SYNTH port 4321"`), plus `is_interrupt: false` and `duration_ms`.
  - So stderr text reaches the hook inside `error`, after the `Exit code N` line.
  - `PostToolBatch` fires once per batch with `tool_calls[{tool_name, tool_input, tool_use_id, tool_response}]`. For a failed Bash, its `tool_response` is the same `Exit code N.` string; for a successful one, it is the stdout text.

### Consequence for the existing trigger

This is OBSERVED in the payloads plus READ in `open-brain/src/cli-recall-trigger.ts:75`. The trigger is registered on `PostToolUse` and handles `tool_name === "Bash"`. **It never runs on a Bash command that exits non-zero.** So the T-170 command keys and the element path are blind to every failing command today. G-039's `. | tail; echo $?` still exits 0, so the element path itself is unaffected.

### READ in the docs

All from https://code.claude.com/docs/en/hooks, fetched 2026-10-15.

- PostToolUse: "Runs immediately after a tool completes successfully."
- PostToolUseFailure: it "Runs when a tool that started executing fails". It does not fire for validation rejections or permission denials. Input is the same `tool_name`/`tool_input`, plus `error`, `is_interrupt` and `duration_ms`. For Bash and PowerShell, "a command that ran and exited produces a first line `Exit code N`, then any output . with stdout and stderr interleaved". Long strings are middle-truncated around `... [N characters truncated] ...`. "treat the rest of the string as display text, not a stable format".
- PostToolUseFailure decision control: it accepts `hookSpecificOutput.additionalContext`. **This is READ only, not observed:** my logging hook emitted nothing.
- PostToolUse decision control: Bash output shape is `stdout, stderr, interrupted, isImage`.
- PreToolUse decision control: `additionalContext` is accepted next to `permissionDecision`.
- PreToolUse: the event does not fire for `@`-mentioned files, which are inserted without a Read call.
- Tool input reference, Read/Glob/Grep tables: `file_path`, `pattern`, `path`, `glob`.
- PostToolBatch: fires once per batch.

### Cursor

- READ `cli-recall-trigger.ts:62-67`: `CURSOR_MEASURED_SHELL_TOOL_NAMES = {"Shell"}`, measured live by T-235 P2-5 (2026-10-04, cursor-agent 2026.10.01-e373342).
- READ `scripts/setup-hooks.mjs:137-158`: the trigger is registered on Cursor `postToolUse`.
- READ `tests/t235-p2-5-cursor-recall.test.ts:37-51`.
- Cursor's file-path events, their field names, and any failure event are **UNMEASURED**. cursor-agent was not run.

---

## Part A2 - dropped by amendment 1

---

## Part A3 - over-fire

### (a) Aggregates from the QA PC's newest 60 transcripts

OBSERVED with `node %TEMP%\t170ii\aggregates.mjs`, which walks `~/.claude/projects` recursively and keeps the newest 60 `.jsonl` by mtime. It prints aggregates only.

- **Corpus:** 60 transcripts out of 274, 60 sessions, mtimes 2026-10-14 to 2026-10-15. There are no subagent files among the 60. This run's own transcript is one of them.
- **Tool calls:** 1,399 in total.

| tool | calls | share |
|---|---:|---:|
| Bash | 850 | 60.8% |
| PowerShell | 225 | 16.1% |
| Edit | 129 | 9.2% |
| Write | 115 | 8.2% |
| Read | 56 | 4.0% |
| ctx_execute (MCP) | 9 | 0.6% |
| ToolSearch | 4 | 0.3% |
| Grep | 3 | 0.2% |
| TaskStop, WebSearch, WebFetch | 2 each | 0.1% each |
| ctx_fetch_and_index, ctx_search | 1 each | 0.1% each |

- **Path shapes** (Read/Edit/Write/NotebookEdit, 300 calls): repo-relative **0 (0.0%)**, home-relative `~` **0 (0.0%)**, absolute **300 (100%)**. Of the absolute paths, 173 (57.7%) were under the line's `cwd` and 127 (42.3%) were outside it (other worktrees, %TEMP%, home).
- **Error signal on Bash results** (848 results out of 850 calls):

| signal | results | share |
|---|---:|---:|
| `tool_result.is_error` true (the field is present on all 848) | 33 | 3.9% |
| text starts `Exit code N` | 32 | 3.8% |
| `toolUseResult` is a string (the failure form) | 33 | - |
| `toolUseResult.stderr` non-empty | 1 | 0.1% |
| `toolUseResult.returnCodeInterpretation` present | 29 | - |
| `interrupted` true | 0 | - |
| any of these | 34 | 4.0% |

  - The fields that exist are: on `tool_result`, `is_error` and `content`. On a success `toolUseResult`, `stdout, stderr, interrupted, isImage`, plus optional `noOutputExpected, returnCodeInterpretation, gitOperation, bashEditDiff, persistedOutputPath, backgroundTaskId, timedOutAfterMs`.
  - **There is no exit-code field in the transcript.** A non-zero exit appears only as `is_error` plus the `Exit code N` first line.
  - stderr is almost never separate: Claude Code interleaves it into the result.
- **Bash result text length:** p50 797, p95 8,892, max 28,935 chars.

### (b) The script

`%TEMP%\t170ii-overfire.mjs`, pasted in full below.

- Usage: `node t170ii-overfire.mjs <keys.json> <transcripts-dir> [--newest 60] [--locate]`.
- It reads only `match` from each `{id, key, title, match}` entry.
- It prints, per rule: the fire rate over all tool calls, the rate over eligible calls, the rate under the once-per-session-per-key cap, keys with a hit, and the top 5 keys by id.
- `--locate` adds `id file:line` per hit.
- It never prints key or transcript text.

Two interpretation choices that the planner may overrule (each is one line in the script):

1. **r1's "suffix match" is segment-aligned:** the key must match whole trailing segments (`(^|/)key$`), so `x.ts` does not fire on `ax.ts`. A raw character suffix would over-fire on short keys. `**` is treated as single-segment, because the brief defines only `*`.
2. **r2's text is the Bash `tool_result.content`**, which is what the model saw. That is the transcript's equivalent of the hook's `error` / `stdout` (see A4).

### (c) Proof on synthetic keys

`%TEMP%\t170ii\synthetic-keys.json` was written by this run, with 7 entries:

| id | type | key | expected |
|---|---|---|---|
| 9001 | path, exact | `t170ii/proj/sample.txt` | fires |
| 9002 | path, glob plus commentary | `` `t170ii/proj/*.txt` (and any rule on the scratch project) `` | fires |
| 9003 | path, glob | `t170ii/proj/never-*.md` | does not fire |
| 9004 | error, variable part | `` `E_T170_SYNTH port <port> refused` `` | fires |
| 9005 | error | `` `Q_ABSENT_T170 <n> nowhere` `` | does not fire |
| 9006 | command | - | ignored |
| 9007 | error | `` `E <x> 1` `` | too short, unusable |

The A1 child had no transcript (`--no-session-persistence`), so this run produced the hit material itself, in its own transcript, from the same scratch project:
- a Read of `%TEMP%\t170ii\proj\sample.txt`;
- a Bash `node -e` that exited 4 printing `E_T170_SYNTH port 4002 refused` (the port is random).

OBSERVED (`node t170ii-overfire.mjs t170ii/synthetic-keys.json "$USERPROFILE/.claude/projects" --newest 60 --locate`):

```
transcripts read: 60 of 273 (newest 60); tool calls: 1399; path-bearing: 300; Bash: 844
keys: 7 in file; path usable 3 (unusable ids: none); error usable 2 (unusable ids: 9007); other type 1; no MATCH line 0
r1 path suffix: fires on 1 calls = 0.07% of all tool calls, 0.33% of path-bearing; once-per-session-per-key: 1 = 0.07%; keys with a hit: 2/3
r1 top 5 by hits: id 9001: 1, id 9002: 1
r2 error fragments: fires on 1 results = 0.07% of all tool calls, 0.12% of Bash; once-per-session-per-key: 1 = 0.07%; keys with a hit: 1/2
r2 top 5 by hits: id 9004: 1
r1 id=9001 d3f4777b-d4c6-4146-a604-1a272250a5fe.jsonl:154
r1 id=9002 d3f4777b-d4c6-4146-a604-1a272250a5fe.jsonl:154
r2 id=9004 d3f4777b-d4c6-4146-a604-1a272250a5fe.jsonl:162
```

- **Fires:** 9001 and 9002 hit the Read at line 154. 9004 hits the failed-Bash result at line 162. The `<port>` wildcard matched `4002`.
- **Does not fire:** 9003 and 9005 hit nothing.
- **Also correct:** 9004 did **not** fire on the earlier outputs carrying `E_T170_SYNTH port 4321` without `refused`, because the fragments must all match in order.
- I checked the located lines independently, OBSERVED: line 154 is a `tool_use` Read whose `file_path` ends `sample.txt`. Line 162 is a `tool_result` with `is_error: true` whose content matches `E_T170_SYNTH port \d+ refused`.
- The tool-call totals differ between runs (Bash 844 here, 850 in A3(a)) because this run's own transcript grew between them.
- **The 0.07% rates are synthetic and say nothing about the real keys.**
- The limit stands as the brief states it: these are QA PC sessions from two days of one-off runs, not the desktop seats that wrote the keys. A zero on the real keys means "not seen on this machine", not "never fires". The planner should run the script on the desktop's own `~/.claude/projects`.

---

## Part A4 - recommendation

**Path keys.**
- **Events:** `PreToolUse` on `Edit|Write|NotebookEdit`, because the lesson must land BEFORE the edit; after the edit it is a correction, not a warning. `PostToolUse` on `Read` is enough, since a read is harmless and the reminder lands beside the content.
  - READ in docs: `PreToolUse` accepts `additionalContext`, and nothing has to be blocked, so ruling 2 (never block) still holds.
  - OBSERVED: `PreToolUse` carries the same `tool_input.file_path` as `PostToolUse`.
- **Field:** `tool_input.file_path` (`notebook_path` for NotebookEdit). Optionally `Grep`'s `tool_input.path` and `Glob`'s `path`. They are rare here (3 Grep calls, 0 Glob out of 1,399) and are directory-ish, so leave them out of v1.
- **Rule:** r1, a segment-aligned suffix on the normalised absolute path.
  - OBSERVED: 100% of tool paths are absolute, Windows ones with backslashes and a drive letter, so normalisation (backslash to `/`, case-fold on win32, `~` expanded on the KEY side) is required, not optional.
  - A repo-relative key then fires in every worktree of the repo (42% of paths here were outside `cwd`), which is what you want.
- **Cap:** the once-per-session cap fits, and is needed: Edit plus Write are 17.4% of calls, and the same file is edited repeatedly within a session.
- **Sidecar:** `recall-trigger-keys.json` must carry a `kind` per entry (`command|path|error`) and, for paths, the normalised pattern (or its segments), not `fragments`.
- **Compatibility hazard (READ `src/trigger/match-keys.ts:93-98`):** `readTriggerKeys` returns `[]` for the WHOLE file if ANY entry lacks a `fragments` array. A new writer that adds path entries without `fragments` would silently switch off command keys in any hook build still running the old reader. So either write path and error keys to a separate sidecar or a separate array key, or ship the reader change first.
- **Re-test on the asked path:** `run.ts:126` re-tests only `parseCommandKey(row.content)`, so a path re-test needs its own parser there.
- **Writer:** `keys-writer.ts:26` skips everything but `MATCH: command:` today.
- **Fast path:** the Pre/Post path hook must stay on T-159's fast path. It is a different `tool_name`, so `shellCommandFromHookPayload` returns null today (`cli-recall-trigger.ts:73-84`).

**Error keys.**
- **Events:** `PostToolUseFailure` (matcher `Bash`, and see PowerShell below) on field `error`, which is first line `Exit code N` then stdout and stderr interleaved, middle-truncated when long. Also `PostToolUse`/Bash on `tool_response.stdout + "\n" + tool_response.stderr` for an error printed by a command that still exits 0 (`| tail`, `|| true`, scripts that print and return 0).
  - OBSERVED: a failing Bash fires only `PostToolUseFailure`, so a PostToolUse-only hook misses every non-zero exit.
  - OBSERVED: separate stderr was non-empty in 1 of 848 transcript results, so do not key on `stderr` alone.
- **Rule:** r2 (`commandMatchesKey` fragments in order, `<.>`/`...` wildcards) over that text. It is case-sensitive and whitespace-collapsed, the same as command keys. Strip the `Exit code N` first line before matching, or let keys include it.
- **Size:** result text p50 is 797 chars and p95 8.9 KB. Matching is a few `indexOf` calls, so cost is negligible next to the 40 ms node spawn (see B).
- **PreToolUse is not applicable:** an error does not exist before the act.
- **Cap:** once per session per key fits. A repeated failure in a loop should not re-inject.
- **Sidecar:** the same `kind` field. Error entries carry `fragments` exactly as command entries do, which keeps the old reader valid only if they live under a separate array; see the hazard above.
- **`additionalContext` on PostToolUseFailure is READ in the docs, UNOBSERVED.** The first build step should observe that it reaches the model.

**PowerShell, which the brief did not ask about.** OBSERVED: 16.1% of this machine's tool calls are `PowerShell`. The trigger handles only `Bash` and Cursor `Shell`, so command, error and element keys never see PowerShell calls. The docs give it the same `Exit code N` failure shape (READ PostToolUseFailure). Its PostToolUse `tool_response` shape is UNMEASURED.

**What would change this recommendation once r1/r2 run on the real keys:**
1. **r1 fire rate (raw) above about 5% of tool calls, or one key above about 1%.** That would mean path keys name hot files (e.g. a top-level config). Then restrict to `PreToolUse` on Edit/Write only and drop the Read leg.
2. **r1 near 0% on the desktop transcripts.** Then the path keys name files the seats no longer touch, and a rewrite pass is worth more than a hook.
3. **r2 fires on a meaningful share of successful (exit-0) Bash results.** Keep the `PostToolUse` stdout leg. If almost all r2 hits are on `is_error` results, ship `PostToolUseFailure` only; it is the cheaper, smaller surface.
4. **Many keys in the script's "unusable" lists** (an error key under 6 chars, a path key that is only wildcards). Then a human rewrite comes before any build.
5. **The capped rate much lower than the raw rate.** That confirms the once-per-session cap is load-bearing for the new key kinds.

---

## Part B - hook latency (T-170 follow-up 4)

All OBSERVED with `node %TEMP%\t170ii\b\latency.mjs`.

- **Scratch environment:** `HOME = USERPROFILE = %TEMP%\t170ii\b\home`, `KNOWLEDGE_V2_DB = <that>\.claude\open-brain\knowledge-v2.db`, with `RECALL_TRIGGER_LOG` and `TRIGGER_POLICY_DIR` unset, so the shipped policy applied (floor 8.0, max 1, deadline 2000 ms).
- **Store:** seeded through the build the way `tests/trigger/t170-match-keys.test.ts` `seed()` does it, i.e. `build/db-v2.js` `initSchemaV2` and `indexKnowledge`. It holds:
  - id 1, a lesson with `MATCH: command: \`git show <ref>:<path>\``;
  - id 2, a PIPESTATUS/tail-exit-code lesson;
  - 300 unrelated fillers, so bm25 clears the floor. id 2 scored 20.62 against the floor of 8.0.
- **Sidecar:** `node build/cli.js trigger-keys`, i.e. the build's own `writeTriggerKeys`, gave `1 command key(s), 0 unusable`.
- **Timing:** `spawnSync(node, [build/cli-recall-trigger.js])` with a synthetic `PostToolUse`/Bash payload on stdin, wall clock spawn to exit with `process.hrtime`. 33 runs per class, the first 3 discarded.
- **Attribution:** the code reads **`payload.session_id`** (`cli-recall-trigger.ts:133`) and nothing else: no proof file, and no session row needed. A payload without it is dropped and logged. Every run carried a `session_id`.
- **Which path each run took** was read back from the scratch store's `trigger_fires` (asked path) or `recall-trigger-pending.jsonl` (not-asked path) after every run.
- **Health:** all 132 runs exited 0 with empty stderr. The hook log file was never created, so no failure and no deadline overrun.

| class | command | path actually taken (all 33 runs) | p50 ms | p95 ms | max ms |
|---|---|---|---:|---:|---:|
| b1 not-asked (T-159) | `ls -la` | not-asked: +1 pending line per run (+33 total), 0 `trigger_fires` rows, nothing emitted | 59.3 | 63.2 | 63.7 |
| b2 first key match | `git show HEAD:src/x.ts`, fresh session per run | `injected`, query `match:1`, ids `[1]`, emitted `[stored knowledge 1]` | 168.4 | 179.0 | 191.4 |
| b3 same command, same session (cap) | same, session `b3-session` primed once before timing | `silent`, query `match:1`, ids `[]`, nothing emitted; session rows = 1 injected + 33 silent | 169.1 | 179.0 | 181.9 |
| b4 element path | `npx vitest run 2>&1 \| tail -8; echo $?`, fresh session per run | `injected`, query `"tail" "exit" "code"`, ids `[2]` | 171.2 | 182.1 | 185.6 |

- **b4's element** is `ELEMENTS[1]`, "a $? read of a pipeline whose last stage is a trimmer" (`isUnsafeStatusRead`, `src/trigger/query.ts:242-266`). Correction to the brief: `src/trigger/policies/` holds only the policy JSON and its schema. The elements live in `query.ts`.
- **Baseline, OBSERVED:** a bare `node -e ""` spawn took p50 40.4, p95 45.7, max 46.8 ms on the same machine. So the not-asked fast path costs about 19 ms over node startup. The asked path, whether keyed, capped or element, costs about 128 ms over it: the better-sqlite3, db-v2, zod and run.js imports plus two connections.
- **b3 (capped) costs the same as b2:** the cap is decided after the store is opened, so a capped repeat pays the full asked-path price.
- **Implications for part (ii), as inference:**
  - Path and error kinds must keep the sidecar prefilter, so that a non-matching Read, Edit or failure stays at about 60 ms.
  - A `PreToolUse` path hook adds that cost before every Edit or Write starts: about 60 ms when no key matches and about 170 ms on a match.
  - All classes are well inside the 2,000 ms deadline.

---

## Script - `t170ii-overfire.mjs` (run unchanged)

```js
#!/usr/bin/env node
// t170ii-overfire.mjs - T-170 part (ii), amendment 1, A3(b). Node builtins only.
//
// usage: node t170ii-overfire.mjs <keys.json> <transcripts-dir> [--newest 60] [--locate]
//
// <keys.json>  an array (or {keys: [...]}) of {id, key, title, match}. `match` is the lesson's MATCH line,
//              e.g. "MATCH: path: src/x.ts" or "error: `EADDRINUSE <port>`" (the "MATCH:" prefix is optional).
//              Only `match` is read; `key` and `title` are ignored and never printed.
// <dir>        searched recursively for *.jsonl Claude Code transcripts; the newest N by mtime are read.
// --locate     also print, per hit, the key id, the transcript file NAME (no directory) and the 1-based line of
//              the transcript holding the tool call (r1) or the tool result (r2). Never any text.
//
// It prints ids, counts and rates only: never key text, never transcript text.
//
// r1  path keys. Tool paths: Read/Edit/Write `file_path`, NotebookEdit `notebook_path`. Both the key and the tool
//     path are normalised: backslashes to "/", a leading "~" expanded to the home directory, a relative tool path
//     resolved against the transcript line's `cwd`, case-folded on win32. The key fires when it matches a SUFFIX of
//     the path aligned on a "/" boundary (key "x.ts" fires on "src/x.ts", not on "src/ax.ts"); `*` matches within
//     one segment (`[^/]*`), so `**` is also single-segment here. A key with a backticked span uses the span;
//     otherwise text from the first " (" on is commentary and is cut (the same cut parseCommandKey makes).
// r2  error keys, as commandMatchesKey (open-brain/src/trigger/match-keys.ts) applied to the text of each Bash
//     tool_result: the key is parsed as parseCommandKey parses a command key (backticked span, else cut at " (";
//     `<...>`, `.` and `...` are wildcards; under 6 non-space chars is unusable), and fires when every fragment
//     occurs in the result text in order, case-sensitive, whitespace runs collapsed to one space.
//
// Rates are reported per tool call (the brief's denominator: every tool_use in the transcripts read) and per
// eligible call (path-bearing calls for r1, Bash calls for r2), raw and under a once-per-session-per-key cap
// (the T-170 loop's cap: a keyed entry is injected at most once per session; a transcript file is one session).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const argv = process.argv.slice(2);
const positional = [];
let newest = 60;
let locate = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--newest") newest = Number(argv[++i]);
  else if (argv[i] === "--locate") locate = true;
  else positional.push(argv[i]);
}
if (positional.length !== 2 || !Number.isInteger(newest) || newest < 1) {
  console.error("usage: node t170ii-overfire.mjs <keys.json> <transcripts-dir> [--newest 60] [--locate]");
  process.exit(2);
}
const [keysFile, transcriptsDir] = positional;
const WIN = process.platform === "win32";
const HOME = os.homedir();

// ---------- keys ----------

const rawKeys = JSON.parse(fs.readFileSync(keysFile, "utf8"));
const entries = Array.isArray(rawKeys) ? rawKeys : rawKeys.keys;
if (!Array.isArray(entries)) throw new Error("keys file: expected an array or {keys: [...]}");

/** {type, text} from a MATCH line, or null. */
function splitMatch(match) {
  if (typeof match !== "string") return null;
  const line = match.split(/\r?\n/).find((l) => /^\s*(MATCH:\s*)?(path|error|command|none)\s*:/i.test(l));
  if (line === undefined) return null;
  const m = /^\s*(?:MATCH:\s*)?(path|error|command|none)\s*:\s*(.*)$/i.exec(line);
  return { type: m[1].toLowerCase(), text: m[2] };
}

/** parseCommandKey's span-or-cut step. */
function keyBody(text) {
  const span = /`([^`]+)`/.exec(text);
  if (span) return span[1];
  const paren = text.indexOf(" (");
  return paren === -1 ? text : text.slice(0, paren);
}

function normPath(p, cwd) {
  let s = p.trim().replace(/\\/g, "/");
  if (s === "~" || s.startsWith("~/")) s = HOME.replace(/\\/g, "/") + s.slice(1);
  const isAbs = /^[A-Za-z]:\//.test(s) || s.startsWith("/");
  if (!isAbs && cwd) s = cwd.replace(/\\/g, "/").replace(/\/+$/, "") + "/" + s.replace(/^\.\//, "");
  s = s.replace(/\/+/g, "/");
  return WIN ? s.toLowerCase() : s;
}

function pathKeyRegex(text) {
  let k = keyBody(text).trim().replace(/\\/g, "/");
  if (k === "~" || k.startsWith("~/")) k = HOME.replace(/\\/g, "/") + k.slice(1);
  k = k.replace(/^\.\//, "").replace(/\/+/g, "/").replace(/\/$/, "");
  if (WIN) k = k.toLowerCase();
  if (k.replace(/[*/\s]/g, "").length === 0) return null;
  const body = k.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*");
  return new RegExp(`(^|/)${body}$`);
}

/** parseCommandKey, applied to an error key's text. */
function errorFragments(text) {
  const fragments = keyBody(text)
    .split(/<[^>]*>|.|\.\.\./)
    .map((f) => f.replace(/\s+/g, " ").trim())
    .filter((f) => f !== "");
  return fragments.join("").replace(/\s/g, "").length < 6 ? null : fragments;
}

/** commandMatchesKey, verbatim in behaviour. */
function fragmentsMatch(fragments, text) {
  const c = text.replace(/\s+/g, " ");
  let from = 0;
  for (const f of fragments) {
    const at = c.indexOf(f, from);
    if (at === -1) return false;
    from = at + f.length;
  }
  return true;
}

const pathKeys = [];
const errorKeys = [];
const skipped = { other_type: 0, no_match_line: 0, path_unusable: [], error_unusable: [] };
for (const e of entries) {
  const sm = splitMatch(e?.match);
  if (!sm) { skipped.no_match_line++; continue; }
  if (sm.type === "path") {
    const re = pathKeyRegex(sm.text);
    if (re) pathKeys.push({ id: e.id, re }); else skipped.path_unusable.push(e.id);
  } else if (sm.type === "error") {
    const fr = errorFragments(sm.text);
    if (fr) errorKeys.push({ id: e.id, fragments: fr }); else skipped.error_unusable.push(e.id);
  } else skipped.other_type++;
}

// ---------- transcripts ----------

const files = [];
(function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".jsonl")) files.push({ p, mtime: fs.statSync(p).mtimeMs });
  }
})(transcriptsDir);
files.sort((a, b) => b.mtime - a.mtime);
const chosen = files.slice(0, newest);

const resultText = (content) =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n")
      : "";

let toolCalls = 0, pathCalls = 0, bashCalls = 0;
const r1 = { fires: 0, firesCapped: 0, hits: new Map(), locs: [] };
const r2 = { fires: 0, firesCapped: 0, hits: new Map(), locs: [] };
const PATH_TOOLS = { Read: "file_path", Edit: "file_path", Write: "file_path", NotebookEdit: "notebook_path" };

for (const { p } of chosen) {
  const name = path.basename(p);
  const bashIds = new Set();
  const seen1 = new Set(), seen2 = new Set();
  const lines = fs.readFileSync(p, "utf8").split("\n");
  for (let n = 0; n < lines.length; n++) {
    if (!lines[n]) continue;
    let o;
    try { o = JSON.parse(lines[n]); } catch { continue; }
    const content = o?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b?.type === "tool_use") {
        toolCalls++;
        if (b.name === "Bash") { bashCalls++; bashIds.add(b.id); }
        const field = PATH_TOOLS[b.name];
        const raw = field ? b.input?.[field] : undefined;
        if (typeof raw !== "string" || raw === "") continue;
        pathCalls++;
        const np = normPath(raw, o.cwd);
        const ids = pathKeys.filter((k) => k.re.test(np)).map((k) => k.id);
        if (ids.length) r1.fires++;
        if (ids.some((id) => !seen1.has(id))) r1.firesCapped++;
        for (const id of ids) {
          seen1.add(id);
          r1.hits.set(id, (r1.hits.get(id) ?? 0) + 1);
          if (locate) r1.locs.push(`r1 id=${id} ${name}:${n + 1}`);
        }
      } else if (b?.type === "tool_result" && bashIds.has(b.tool_use_id)) {
        const text = resultText(b.content);
        const ids = errorKeys.filter((k) => fragmentsMatch(k.fragments, text)).map((k) => k.id);
        if (ids.length) r2.fires++;
        if (ids.some((id) => !seen2.has(id))) r2.firesCapped++;
        for (const id of ids) {
          seen2.add(id);
          r2.hits.set(id, (r2.hits.get(id) ?? 0) + 1);
          if (locate) r2.locs.push(`r2 id=${id} ${name}:${n + 1}`);
        }
      }
    }
  }
}

// ---------- report ----------

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(2)}%` : "n/a");
const top5 = (m) =>
  [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 5).map(([id, c]) => `id ${id}: ${c}`).join(", ") || "none";

console.log(`transcripts read: ${chosen.length} of ${files.length} (newest ${newest}); tool calls: ${toolCalls}; path-bearing: ${pathCalls}; Bash: ${bashCalls}`);
console.log(`keys: ${entries.length} in file; path usable ${pathKeys.length} (unusable ids: ${skipped.path_unusable.join(",") || "none"}); error usable ${errorKeys.length} (unusable ids: ${skipped.error_unusable.join(",") || "none"}); other type ${skipped.other_type}; no MATCH line ${skipped.no_match_line}`);
console.log(`r1 path suffix: fires on ${r1.fires} calls = ${pct(r1.fires, toolCalls)} of all tool calls, ${pct(r1.fires, pathCalls)} of path-bearing; once-per-session-per-key: ${r1.firesCapped} = ${pct(r1.firesCapped, toolCalls)}; keys with a hit: ${r1.hits.size}/${pathKeys.length}`);
console.log(`r1 top 5 by hits: ${top5(r1.hits)}`);
console.log(`r2 error fragments: fires on ${r2.fires} results = ${pct(r2.fires, toolCalls)} of all tool calls, ${pct(r2.fires, bashCalls)} of Bash; once-per-session-per-key: ${r2.firesCapped} = ${pct(r2.firesCapped, toolCalls)}; keys with a hit: ${r2.hits.size}/${errorKeys.length}`);
console.log(`r2 top 5 by hits: ${top5(r2.hits)}`);
if (locate) for (const l of [...r1.locs, ...r2.locs]) console.log(l);
```

**Notes for the planner running it:**
- If the real export's `match` field holds only the text after `MATCH: path:`, without the type prefix, every entry lands in "no MATCH line". Prefix it, or tell me the shape and I will adjust one regex.
- Running it from Git Bash on Windows is fine. I found that this host's tool layer collapses `\\` inside inline `node -e` and heredoc text, so pass the script as a file, never inline.

## Files this run created (all outside the clone)

- `%TEMP%\t170ii-overfire.mjs`
- `%TEMP%\t170ii-research-reply.md`
- `%TEMP%\t170ii\`: `log-hook.cjs`, `payloads.jsonl`, `proj\` (the scratch project), `probe.mjs`, `aggregates.mjs`, `synthetic-keys.json`, `b\latency.mjs`, `b\home\` (the scratch store, sidecar and pending file), and `home\` (empty; the refused scratch-HOME login attempt).

