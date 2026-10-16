# T-235: measure Cursor's hook events for a FAILING Shell call, and whether our injection reaches the model (no code)

Runtime: CC (claude -p, Opus 5.5) driving `cursor-agent`
SEAT: QA PC one-off, NOT the desktop. No hub key. MEASUREMENT ONLY: no clone change, no commit, no PR.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t235f-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-16, session 173. **Task:** T-235 (P1). **Tag:** `T-235-FAIL`. **Size:** SMALL.
**Base:** none needed (the run uses no repo code). **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: none — measurement only; no repository file is changed
```

## Why

No Cursor seat runs the recall trigger today: `~/.cursor/hooks.json` holds `sessionStart` only on both machines, because
`setup.mjs` was not re-run after T-235 P2-5 added `postToolUse` (T-235 note, s173). Aaron will be asked to add that
entry. Before he does, two facts are unmeasured:

1. **Which hook event, if any, a FAILING Cursor Shell call fires.** In Claude Code a failing Bash call fires
   `PostToolUseFailure` and no `PostToolUse` (G-059), so a `PostToolUse`-only registration was blind to failures. P2-5
   (`docs/loops/t235-p2-5-measure.md`) measured only a successful `echo`.
2. **Whether the trigger's output reaches the model under `cursor-agent`.** The trigger prints
   `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"..."}}`. P2-5 (C) left "model surfacing
   under cursor-agent is unverified".

## Rules

- **Do not read, copy or print** `~/.claude.json`, `~/.claude/settings.json`, `~/.cursor/hooks.json`, `~/.cursor/mcp.json`,
  `~/.cursor/cli-config.json`, any `.mcp.json`, `.env` or key file (G-051).
- **Do not touch** `~/.claude/open-brain/`, and **do not change any user-level setting.** The user-level `sessionStart`
  hook will fire on its own when cursor-agent starts; that is expected (P2-5 had the same) and is not part of this
  measurement.
- **NEVER pass `--model` to cursor-agent** (G-055: it persists as the machine's global Cursor default).
- Everything lives under `%TEMP%\t235f\`. Every command the model runs is one this brief names. No real repo is
  touched.
- The reply prints key NAMES, value TYPES and value LENGTHS, plus the exact values this brief asks for. It does not
  print `session_id`, `conversation_id`, `transcript_path` or any path value under the user's home except the scratch
  paths.

## Steps

1. PowerShell:
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t235f-reply.md")); "REPLY_PATH=$reply"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`
   - `node -v` (must be `v22.*`)
   - `cursor-agent --version`
2. Create `%TEMP%\t235f\proj\` (not a git repo) and `%TEMP%\t235f\dump.mjs` (node builtins only). The script:
   - reads stdin as JSON;
   - writes it to `%TEMP%\t235f\out\<n>-<hook_event_name or "noevent">-<tool_name or "notool">.json`, with `n`
     counting from 1 across the whole run (keep the counter in `%TEMP%\t235f\out\counter.txt`);
   - prints to stdout exactly
     `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"[probe-ctx <n>]"}}`;
   - exits 0.
3. `proj\.cursor\hooks.json`:
   - `{"version":1,"hooks":{...}}`, registering
     `"C:/Program Files/nodejs/node.exe" "<%TEMP%\t235f\dump.mjs with forward slashes>"` (each path in double quotes, as
     P2-5's file did);
   - under each of: `postToolUse`, `postToolUseFailure`, `afterShellExecution`. Nothing else.
4. From `proj\`, run each case as its own
   `cursor-agent -p -f --output-format text -- "<prompt>"`
   (the `--` form P2-5 used; no `--model`). The prompt for each case is: `Measurement only. Run exactly this one shell
   command, once: <command>. Do not edit files. Then reply with one line: the exact text of every [probe-ctx N] marker
   you were shown after the command, or NONE.`

   | case | command |
   |---|---|
   | S0 (control) | `echo t235f-ok` |
   | S1 | `exit 3` |
   | S2 | `git show t235f-no-such-ref` |
   | S3 | `Get-Item C:\t235f-no-such-path` |

   **If S0 dumps nothing at all**, cursor-agent may have refused the whole hooks file over an unknown event name. Then
   rewrite `hooks.json` with `postToolUse` only, rerun S0 once, report both attempts, and run S1-S3 with that file.
5. After each case, list the new files in `out\`. Then delete nothing.

## Report (reply)

First line, exactly:
`DONE T-235-FAIL · S0 <events> <ctx> · S1 <events> <ctx> · S2 <events> <ctx> · S3 <events> <ctx>`.
- `<events>` is the `hook_event_name` values dumped for that case, joined with `+`, or `none`.
- `<ctx>` is `seen` if the model's reply line quoted a `[probe-ctx N]` marker, otherwise `NONE`.

Then, for each case:
- the files dumped (names only) and the model's reply line, verbatim;
- per file: `tool_name`; the `tool_input` keys, each with type and length; whether `tool_input.command` equals the
  command exactly;
- the keys of any output/result/error field, each with type and length, plus its first 120 characters verbatim (these
  are the run's own synthetic commands, so they may be printed);
- every other top-level key name.

Then answer:
- (a) Does a failing Shell call (S1-S3) fire `postToolUse`, `postToolUseFailure`, `afterShellExecution`, several, or
  none?
- (b) Where does a failing call's exit code appear in its payload (field name and shape)?
- (c) Did `hookSpecificOutput.additionalContext` reach the model on any event? Name each event where it did and each
  where it did not.
- NOT RUN: anything skipped, and why.

Leave `%TEMP%\t235f\` in place for inspection.
