# T-170 part (ii), G-060: measure the PowerShell hook payloads (no code)

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. MEASUREMENT ONLY: no clone change, no commit, no PR.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t170ii2-reply.md. A reply path in
the launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-15, session 172. **Task:** T-170 (P1), part (ii); gap G-060. **Tag:** `T-170-II-PS`.
**Size:** SMALL. **Base:** none needed (the run uses no repo code). **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

## Why

The recall trigger acts only on `tool_name` `Bash` (Claude Code) and `Shell` (Cursor), and is registered with matcher
`Bash` (`open-brain/src/cli-recall-trigger.ts:62-84`, `shellCommandFromHookPayload`). In the T-170-II research
(`docs/loops/t170-ii/research-reply.md`, A3(a)), 225 of the 1,399 tool calls (16.1%) in the QA PC's newest 60
transcripts were PowerShell, so command keys, error keys and the element path never see them (G-060). Cursor's
`Shell` was admitted only after a live measurement row (T-235 P2-5). PowerShell needs the same row before any code
changes. Four facts are unmeasured:

1. the PostToolUse payload for a PowerShell call: `tool_name`, the `tool_input` keys (is the command under `command`?);
   the `tool_response` keys;
2. which event a failing PowerShell call fires, and what "failing" means for PowerShell: an `exit N`, a native
   command that exits non-zero, a cmdlet error with no exit code;
3. the `error` field's shape on PostToolUseFailure (Bash gives `Exit code N` plus output);
4. whether `additionalContext` returned from a PowerShell PostToolUse / PostToolUseFailure hook reaches the model,
   when `hookEventName` names the firing event.

## Rules

- Do not read, copy or print `~/.claude.json`, `~/.claude/settings.json`, any `.mcp.json`, `.env` or key file (G-051).
  Do not touch `~/.claude/open-brain/`. Do not change any user-level setting.
- Everything lives under `%TEMP%\t170ii2\`. Every command the model runs is one this brief names. No real repo is
  touched.
- The reply prints key NAMES, value TYPES and value LENGTHS, plus the exact values this brief asks for. It does not
  print `transcript_path` or `session_id` values.

## Steps

1. Print `node -v`, `claude --version`, and the resolved reply path.
2. Create `%TEMP%\t170ii2\proj\` (not a git repo) and `%TEMP%\t170ii2\dump.mjs` (node builtins only). The script
   reads stdin as JSON, writes it to `%TEMP%\t170ii2\out\<n>-<hook_event_name>-<tool_name>.json` (n counting from
   1), and prints to stdout
   `{"hookSpecificOutput":{"hookEventName":<the payload's hook_event_name>,"additionalContext":"[probe-ctx <n>]"}}`.
   It exits 0.
3. `proj\.claude\settings.json` registers `dump.mjs` (as `node "<abs path>"`, timeout 10) under BOTH `PostToolUse` and
   `PostToolUseFailure`, each with matcher `PowerShell|Bash`. Nothing else.
4. From `proj\`, run each case below as its own
   `claude -p "<prompt>" --model sonnet --setting-sources project --allowedTools PowerShell,Bash --output-format text`.
   The prompt for case X is: `Use the PowerShell tool (not Bash) to run exactly this command once: <command>. Then
   reply with one line: the exact text of every [probe-ctx N] marker you were shown after the tool call, or NONE.`
   Case B0 instead uses `the Bash tool`, as a control.

   | case | tool | command |
   |---|---|---|
   | P1 | PowerShell | `Write-Output t170ii2-ok` |
   | P2 | PowerShell | `exit 3` |
   | P3 | PowerShell | `git show t170ii2-no-such-ref` |
   | P4 | PowerShell | `Get-Item C:\t170ii2-no-such-path` |
   | B0 | Bash | `false` |

   If the PowerShell tool is not offered in `-p` mode, say so, give the error, and stop after B0.

## Report (reply)

First line: `DONE T-170-II-PS · P1 <event> <tool_name> <ctx: seen|NONE> · P2 … · P3 … · P4 … · B0 …` (`<event>`
is the `hook_event_name` of each dumped file for that case, or `none` when nothing was dumped).

Then, for each case:
- the dumped files (names only) and the model's reply line, verbatim;
- `tool_name`; the `tool_input` keys, each with type and length; whether `tool_input.command` equals the command
  exactly;
- the `tool_response` keys, each with type and length (PostToolUse), or the `error` field's first 120 characters
  verbatim (PostToolUseFailure). These come from the run's own synthetic commands, so they may be printed;
- every other top-level key name.

Then answer:
- (a) Does P4 (a cmdlet error, no exit code) fire PostToolUse or PostToolUseFailure? If PostToolUse, which
  `tool_response` field (if any) shows the error?
- (b) Is the PowerShell `error` text shaped like Bash's (`Exit code N` then output)? Quote the differences.
- (c) Did `additionalContext` reach the model on each event?
- NOT RUN: anything skipped, and why.

Leave `%TEMP%\t170ii2\` in place for inspection.
