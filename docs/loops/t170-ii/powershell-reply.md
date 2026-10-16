# T-170-II-PS reply (G-060 measurement), copied verbatim

**Provenance:** the QA PC one-off run by clark (task Clark-T170-II-PS, Opus driver, sonnet probes, claude 2.1.296) on the brief `docs/loops/t170-ii-powershell-measure-brief.md` at 8cc4710e. Clark copied the reply to the desktop as `%TEMP%\t170ii2-reply.md` (88 lines); the planner copied it here unchanged on 2026-10-15, session 172. The `·` separators in the first line arrived as U+FFFD (an encoding loss in transit, not in the measurement). **Planner ruling: ACCEPTED** (see G-060 and the T-170 note, rev 498).

---

DONE T-170-II-PS � P1 PostToolUse PowerShell ctx: seen � P2 PostToolUseFailure PowerShell ctx: seen � P3 PostToolUseFailure PowerShell ctx: seen � P4 PostToolUseFailure PowerShell ctx: seen � B0 PostToolUseFailure Bash ctx: seen

# T-170-II-PS reply (QA PC one-off, measurement only)

- `node -v`: v22.23.3
- `claude --version`: 2.1.296 (Claude Code)
- Reply path: `C:\Users\Aaron Melven\AppData\Local\Temp\t170ii2-reply.md` (%TEMP% = `C:\Users\AARONM~1\AppData\Local\Temp`)
- Scratch: `C:\Users\Aaron Melven\AppData\Local\Temp\t170ii2\` (`dump.mjs`, `proj\.claude\settings.json`, `out\`). Left in place.
- settings.json: `node "C:/Users/Aaron Melven/AppData/Local/Temp/t170ii2/dump.mjs"`, timeout 10, under PostToolUse and
  PostToolUseFailure, matcher `PowerShell|Bash`. Nothing else.
- Each case: `claude -p "<prompt>" --model sonnet --setting-sources project --allowedTools PowerShell,Bash --output-format text`
  run from `proj\`, with the brief's prompt text. All exited 0. The PowerShell tool was offered in `-p` mode.
- Each case fired exactly one hook event and dumped one file.

Every file has the same other top-level keys: `session_id` (string/36), `transcript_path` (string/135), `cwd` (string/53),
`prompt_id` (string/36), `permission_mode` (string, "default"), `effort` (object, `{"level":"medium"}`),
`hook_event_name`, `tool_use_id` (string/30), `duration_ms` (number). PostToolUseFailure files also have
`is_interrupt` (boolean, false). PostToolUse has no `is_interrupt`, and PostToolUseFailure has no `tool_response`.

## P1 `Write-Output t170ii2-ok`
- Dumped: `1-PostToolUse-PowerShell.json`
- Model reply: `[probe-ctx 1]`
- `tool_name`: `PowerShell`
- `tool_input`: `command` string/23. No `description` key on this call. `tool_input.command` equals the command exactly: **yes**
- `tool_response`: `stdout` string/10 (`"t170ii2-ok"`), `stderr` string/0, `interrupted` boolean (false), `isImage` boolean (false).
  This is the same key set as Bash's tool_response.
- Other keys: the common set above (`hook_event_name` = "PostToolUse", `duration_ms` 319).

## P2 `exit 3`
- Dumped: `2-PostToolUseFailure-PowerShell.json`
- Model reply: `[probe-ctx 2]`
- `tool_name`: `PowerShell`
- `tool_input`: `command` string/6, `description` string/10. Exact: **yes**
- `error` (string/11): `Exit code 3`
- Other keys: the common set plus `is_interrupt` (false). `duration_ms` 326.

## P3 `git show t170ii2-no-such-ref`
- Dumped: `3-PostToolUseFailure-PowerShell.json`
- Model reply: `[probe-ctx 3]`
- `tool_name`: `PowerShell`
- `tool_input`: `command` string/28, `description` string/33. Exact: **yes**
- `error` (string/82, full text): `Exit code 128\nfatal: not a git repository (or any of the parent directories): .git`
  (proj is not a git repo, so git failed with "not a git repository" before it looked up the ref. Either way, this is a
  native command exiting non-zero.)
- Other keys: the common set plus `is_interrupt`. `duration_ms` 339.

## P4 `Get-Item C:\t170ii2-no-such-path`
- Dumped: `4-PostToolUseFailure-PowerShell.json`
- Model reply: `[probe-ctx 4]`
- `tool_name`: `PowerShell`
- `tool_input`: `command` string/32, `description` string/25. Exact: **yes** (checked by char codes; the single backslash
  is preserved).
- `error` (string/469), first 120 chars verbatim (JSON-escaped):
  `"Exit code 1\nGet-Item : Cannot find path 'C:\\t170ii2-no-such-path' because it does not exist.\r\nAt line:1 char:302\r\n+ ... "`
  The rest of the error is the standard PowerShell error record: a caret line, then `CategoryInfo : ObjectNotFound: ...
  [Get-Item], ItemNotFoundException` and `FullyQualifiedErrorId : PathNotFound,Microsoft.PowerShell.Commands.GetItemCommand`.
  The echoed source line shows that CC wraps the user command in a preamble: `+ ... dering = 'PlainText' } catch {} } }; Get-Item C:\t170ii2-no-such-path`.
  That is why the error reports `char:302`, not char 1.
- Other keys: the common set plus `is_interrupt`. `duration_ms` 392.

## B0 (control, Bash) `false`
- Dumped: `5-PostToolUseFailure-Bash.json`
- Model reply: `[probe-ctx 5]`
- `tool_name`: `Bash`
- `tool_input`: `command` string/5, `description` string/21. Exact: **yes**
- `error` (string/11): `Exit code 1`
- Other keys: the common set plus `is_interrupt`. `duration_ms` 4192.

## Answers
- **(a)** P4 (a cmdlet error with no explicit exit code) fires **PostToolUseFailure**, not PostToolUse. The tool turns
  the non-terminating cmdlet error into a non-zero exit: `error` starts `Exit code 1`. Only one cmdlet-error case
  (Get-Item, path not found) was measured. A cmdlet error *followed by* a later successful statement, where `$?`/exit
  status could reset, was not tested.
- **(b)** **Yes**, the shape is the same as Bash: `Exit code N` then `\n` then output (P2 `Exit code 3` alone, the same
  as B0's `Exit code 1` alone; P3 `Exit code 128\n<stderr>`). Differences:
  1. The output after the header uses **CRLF** line endings inside the PowerShell error text (`...does not exist.\r\nAt line:1 char:302\r\n`).
     The separator after `Exit code N` is a bare `\n`.
  2. Cmdlet errors carry the multi-line PowerShell error-record format (`At line:1 char:302`, `+ ...` source echo, `~~~`
     caret line, `+ CategoryInfo`, `+ FullyQualifiedErrorId`). So the text is long (469 chars for one Get-Item).
  3. The source echo leaks part of CC's wrapper preamble (`dering = 'PlainText' } catch {} } };`), and `char:N` refers
     to the wrapped script, not the user's command. Any key built from error text should strip or normalise those lines.
  4. `tool_input` usually carries a `description` key alongside `command`, on PowerShell and on Bash alike (absent on P1).
- **(c)** **Yes**, on both events. The model reported the exact marker each time: PostToolUse (P1 `[probe-ctx 1]`) and
  PostToolUseFailure (P2-P4 `[probe-ctx 2..4]`, B0 `[probe-ctx 5]`). In every case `hookEventName` was set to the
  payload's `hook_event_name`.
- **NOT RUN:** nothing was skipped. One caveat on P3: the scratch proj is not a git repo (per the brief), so git exited 128
  with "not a git repository" rather than an unknown-revision error. It is still a native command exiting non-zero.

