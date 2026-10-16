# T-235-FAIL reply (Cursor hook events for a failing Shell call), copied verbatim

**Provenance:** QA PC one-off run by clark on the brief docs/loops/t235-cursor-failure-measure-brief.md at cb1090ab (CC Opus driving cursor-agent 2026.10.14-941492e). Clark copied the reply to the desktop as ~/Worktrees/t235f-reply.md; the planner copied it here unchanged on 2026-10-16, session 173. The separators in the first line arrived as U+FFFD (an encoding loss in transit, not in the measurement). **Planner ruling: ACCEPTED** (see G-061 and the T-235 note). Planner check of the BOM finding: both open-brain hook entry points trim stdin before JSON.parse (cli-recall-trigger.ts:116, cli-bootstrap.ts:45), and String.prototype.trim strips U+FEFF (checked in node), so the trigger is not affected.

---

DONE T-235-FAIL � S0 afterShellExecution+postToolUse seen � S1 afterShellExecution+postToolUseFailure NONE � S2 afterShellExecution+postToolUseFailure NONE � S3 afterShellExecution+postToolUse seen

READY. REPLY_PATH=C:\Users\Aaron Melven\AppData\Local\Temp\t235f-reply.md

Host: QA PC. node v22.23.3. cursor-agent 2026.10.14-941492e (payload `model` = "composer-2.5"; no `--model` passed).
Scratch: `%TEMP%\t235f\` (proj\.cursor\hooks.json, dump.mjs, out\, plus inspect.mjs, a read-only key/type/length
printer I added). Nothing deleted. No repo file changed, no commit, no PR.

## Deviation you need to know: Cursor's hook stdin starts with a UTF-8 BOM

S0 attempt 1 dumped two files but both were named `noevent-notool`: `JSON.parse` failed on stdin because cursor-agent
on Windows **prefixes the hook payload with U+FEFF**. dump.mjs saved the raw text under `_unparsed` and still printed
the probe line, so the S0 attempt-1 hook output was emitted normally. I added one line to dump.mjs that strips a leading
BOM, then reran S0 as S0b (both attempts reported below). S1-S3 used the fixed script. The hooks.json was never changed;
the "S0 dumps nothing" fallback (postToolUse only) **did not trigger**, because all three event names were accepted.
**For the real trigger:** any Cursor hook that does a plain `JSON.parse(stdin)` will fail on Windows unless it strips
the BOM first. Check open-brain's trigger for this before Aaron adds the entry.

## Shared shape (identical across every case)

All files have these top-level keys (only the names are printed for ids, paths and email):
- **afterShellExecution**: `conversation_id` (string/36), `generation_id` (string/36), `model` (string/12),
  `command` (string), `output` (string), `duration` (number), `sandbox` (boolean, false), `tool_use_id` (string/36),
  `session_id` (string/36), `hook_event_name`, `cursor_version` (string/18), `workspace_roots` (array/1, scratch proj),
  `user_email` (string/18), `transcript_path` (string/187). **No `tool_name`, no `tool_input`, no exit code.**
- **postToolUse**: `conversation_id`, `generation_id`, `model`, `tool_name`, `tool_input`, `tool_output`, `duration`,
  `tool_use_id`, `cwd` (string/0, ""), `session_id`, `hook_event_name`, `cursor_version`, `workspace_roots`,
  `user_email`, `transcript_path`.
- **postToolUseFailure**: `conversation_id`, `generation_id`, `model`, `tool_name`, `tool_input`, `error_message`,
  `failure_type`, `duration`, `tool_use_id`, `is_interrupt`, `cwd` (string/0, ""), `session_id`, `hook_event_name`,
  `cursor_version`, `workspace_roots`, `user_email`, `transcript_path`. **No `tool_output`.**
- `tool_input` is always 3 keys: `command` (string), `cwd` (string/0, ""), `timeout` (number/5, 30000).
- Within one case the afterShellExecution file and the postToolUse/Failure file share the same `tool_use_id` and
  `duration`. afterShellExecution always fires first (lower n).

## S0 (control): `echo t235f-ok`

Attempt 1 (BOM-unparsed dumps): `1-noevent-notool.json`, `2-noevent-notool.json`. Model reply: `[probe-ctx 2]`
- 1  afterShellExecution (recovered after stripping BOM). `command` string/13 = command exactly: yes. `output`
  string/10 = `"t235f-ok\r\n"`.
- 2  postToolUse. tool_name `Shell`. tool_input.command string/13, equals command exactly: yes. `tool_output`
  string/38, a JSON-encoded string with keys `output` (string/10) and `exitCode` (number): `{"output":"t235f-ok\r\n","exitCode":0}`.

Attempt 2 (S0b, fixed dump.mjs): `3-afterShellExecution-notool.json`, `4-postToolUse-Shell.json`. Model reply: `[probe-ctx 4]`
- 3  same as 1. 4  same as 2 (`exitCode` 0, number).

## S1: `exit 3`

Files: `5-afterShellExecution-notool.json`, `6-postToolUseFailure-Shell.json`. Model reply: `NONE`
- 5 afterShellExecution: `command` string/6, equals command exactly: yes. `output` string/0 = `""`.
- 6 postToolUseFailure: tool_name `Shell`. tool_input.command string/6, equals exactly: yes.
  `error_message` string/31 = `Command failed with exit code 3`. `failure_type` string/5 = `error`.
  `is_interrupt` boolean = false.

## S2: `git show t235f-no-such-ref`

Files: `7-afterShellExecution-notool.json`, `8-postToolUseFailure-Shell.json`. Model reply: `NONE`
- 7 afterShellExecution: `command` string/26, equals exactly: yes. `output` string/69 =
  `fatal: not a git repository (or any of the parent directories): .git\n` (proj is not a git repo, as the brief set up).
- 8 postToolUseFailure: tool_name `Shell`. tool_input.command string/26, equals exactly: yes.
  `error_message` string/68 = `fatal: not a git repository (or any of the parent directories): .git`
  (the stderr text, **not** "exit code 128": no exit code anywhere in this payload). `failure_type` string/5 = `error`.
  `is_interrupt` = false.

## S3: `Get-Item C:\t235f-no-such-path`

Files: `9-afterShellExecution-notool.json`, `10-postToolUse-Shell.json`. Model reply, verbatim:
`NONE - wait, I was shown `[probe-ctx 10]` in a system reminder after the command, so the answer is: `[probe-ctx 10]``
(counted as `seen`).
- 9 afterShellExecution: `command` string/30, equals exactly: yes. `output` string/457, first 120:
  `Get-Item : Cannot find path 'C:\t235f-no-such-path' because it does not exist.\r\nAt C:\Users\Aaron Melven\AppData\Local\T`
  (the path continues `...Temp\ps-script-<uuid>.ps1:7 char:1`: Cursor runs Shell commands from a temp .ps1 wrapper).
- 10 **postToolUse** (not Failure): tool_name `Shell`. tool_input.command string/30, equals exactly: yes.
  `tool_output` string/506, JSON with keys `output` (string/457) and `exitCode` (number) = **0**.
- Get-Item's not-found is a non-terminating PowerShell error, so the wrapper exits 0 and Cursor counts the call as a
  success. S3 is a failure in its text only, not to Cursor.

## Answers

- **(a)** Every Shell call fires `afterShellExecution`. In addition, a call that exits non-zero (S1, S2) fires
  **`postToolUseFailure` and no `postToolUse`**: the same split as Claude Code's G-059. A call that exits 0 fires
  `postToolUse` even when it printed an error (S3, PowerShell non-terminating error). A postToolUse-only registration is
  blind to S1/S2-type failures.
- **(b)** The exit code is structured only on success: `postToolUse.tool_output` is a **JSON-encoded string**
  `{"output":<string>,"exitCode":<number>}`. On failure, `postToolUseFailure` has no numeric exit code field. You get
  `error_message` (string) plus `failure_type` ("error") and `is_interrupt` (false). For `exit 3` the string is
  `"Command failed with exit code 3"` (the code is only in the text). For `git show` it is git's stderr line, so the code
  (128) is absent entirely. `afterShellExecution` never carries an exit code (`command`, `output`, `sandbox`, `duration` only).
- **(c)** Yes, on **`postToolUse` only**: S0 attempt 1 (`[probe-ctx 2]`), S0b (`[probe-ctx 4]`) and S3
  (`[probe-ctx 10]`). The model said a system reminder delivered it. It did **not** reach the model from
  `afterShellExecution` (n = 1, 3, 5, 7, 9: never quoted, including in cases where postToolUse's marker was quoted) or
  from `postToolUseFailure` (n = 6, 8: S1 and S2 both replied NONE). Caveat: every hook printed
  `hookEventName:"PostToolUse"`. This run cannot tell whether postToolUseFailure ignores additionalContext entirely or
  would accept it under a matching `hookEventName` / a different output shape. That is a separate one-line measurement.
- **NOT RUN:** the postToolUse-only fallback rerun (its condition, S0 dumping nothing, did not occur). Nothing else was
  skipped. One deviation: the BOM-strip line added to dump.mjs after S0 attempt 1 (above). Values not printed by rule:
  `session_id`, `conversation_id`, `generation_id`, `transcript_path`, `user_email` (names, types and lengths only).

