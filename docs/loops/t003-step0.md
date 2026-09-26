# T-003 Step 0: what a server can know about its own session

**By:** Forge (developer), record session **137**, uuid `02565cad-14c9-4db0-bc2c-970686419ae9`, 2026-09-26.
**Model / effort (read from this session's transcript):** `claude-opus-5-5`, effort `medium`.
**Branch:** `loop/t003` at base `d0335d7` (origin/loop/t179-r2). **No product change.** Brief:
`docs/loops/t003-session-identity-brief.md` (on `origin/docs/session-100-qa99-dispatch`).

All readings are from this machine (win32, Claude Code 2.1.283), this session's own processes, at about
23:32Z. Nothing here was read from another session's files: see *Denied* below.

## The observations

1. **The MCP server survives `/clear` (A9's premise, observed).** This session's open-brain server is PID
   **8832**, parent PID **2500**, created **2026-09-26 05:28:56Z** (Win32_Process). PID 2500 is this
   session's claude process (`CLAUDE_PID=2500` in the tool shell). This worktree's transcripts show that one
   claude process has served **five** sessions by `/clear`: `e5af8b8f` → `a4eee1fe` → `6a780747` →
   `141b2dfd` → `02565cad` (this one, first entry 23:30:21Z). Server 8832 predates all of them but the
   first, and is the only open-brain server whose parent is 2500. **So a server's in-memory registration
   outlives the session that made it**, and QA 125's A9 is a live path, not a handler-only one.
2. **Claude Code publishes the CURRENT session of each claude process at `~/.claude/sessions/<pid>.json`.**
   For PID 2500 it read `sessionId: 02565cad-…` (this session, i.e. already updated past the `/clear`),
   `pid: 2500`, `cwd`, `procStart: "134348741325326178"` (a FILETIME: 2026-09-26 05:28:52Z, the claude
   process's start, so it can reject a reused PID), `updatedAt` current. It is **undocumented host
   internals** (it carries the peer-messaging socket), not an API.
3. **The tool shell's environment carries the current id:** `CLAUDE_CODE_SESSION_ID=02565cad-…`,
   `CLAUDE_PID=2500`, `CLAUDE_CODE_CHILD_SESSION=1`. The shell is spawned per command, so this says what a
   child spawned NOW gets, not what the server got at 05:28Z.
4. **The shared slot is per project, and this worktree's key is written by whichever session started
   last** (`<project_dir>::<ide>`, unchanged since T-003 was filed). Nothing in it names a process.

## The table

| Candidate | Available to the server? | Same across `/mcp reconnect`? | Correct after `/clear`? |
|---|---|---|---|
| Env var at spawn (`CLAUDE_CODE_SESSION_ID`) | **Not measured** (reading the server's environment was denied). | Would be re-read at respawn, so probably. | **No, by observation 1 alone:** a value fixed at spawn in a process that survives `/clear` is the previous session's id. Disqualified whatever its value. |
| Parent process (`process.ppid`) | **Yes** — 8832's parent is 2500, the claude process. Only as long as the MCP command is not wrapped by a shim (`cmd /c`, `npx`); here it is not. | Should be (a reconnect is respawned by the same claude process). **Not observed**: needs `/mcp reconnect open-brain` run in this window. | The PID is stable across `/clear`; the pid alone names the process, not the session. |
| Claude's `~/.claude/sessions/<ppid>.json` | **Yes**, read by me for my own process. | Yes if the parent is unchanged (the file is per process). Not observed. | **Yes: observed** — it held this session's id after five `/clear`s. Ordering of its write vs. the first tool call after `/clear` not measured. |
| Transcript of the parent (`~/.claude/projects/<slug>/<uuid>.jsonl`) | Only by guessing the newest file, which is exactly the per-project race T-003 is about. | — | No: a newest-file rule picks the other session in a shared checkout. **Disqualified.** |
| SessionStart hook (`session_id`, `transcript_path`, `source`) | Knows the id with certainty; today hands it over through the per-project slot, which is the defect. | — | Fires on `/clear` (payload `source`); correct IF it wrote a slot keyed by the claude PID instead of the project. Whether a hook process sees `CLAUDE_PID` is **not measured**. |
| `ob_set_session(argument)` | Yes | — | Only as correct as the model's copy of the hook line; **unchecked today (A7)**. Not proof. |

## Proposed design (not built)

**The session is a property of the claude process, so the key is the process, not the project.**

1. **Proof source:** at each attributed write (not cached), resolve `claudePid = process.ppid`, read
   `~/.claude/sessions/<claudePid>.json`, require `pid === claudePid` and `procStart` equal to that
   process's start time, and take `sessionId`. Any failure — file absent, unparsable, pid or procStart
   mismatch, parent not a claude process — yields **no proven id**, with the reason.
2. **`ob_set_session(id)` becomes a check, not a source**, where a proof source exists: an argument that
   differs from the proven id is **refused** (A7), naming both. Where none exists (Cursor), see the question.
3. **Every attributed write (`writeSessionId`) uses only the proven id.** The slot-adoption path is removed,
   not guarded (A8). After `/clear` the next write reads the new id (A9); the in-memory registration is no
   longer authoritative. `_sessionSelfRegistrations` goes with it.
4. **No proof → refuse attributed writes**, as T-179 refuses unregistered ones, with the reason in the text.
5. The per-project slot survives only as a human-readable hint for `/start`, never as a write key.

**Two things I want ruled before building:**

- **Q1 (dependency).** Step 1 makes attribution depend on an undocumented Claude Code file. The SIA-owned
  alternative: the SessionStart hook writes `~/.claude/open-brain/by-pid/<claudePid>.json` (it fires on
  `/clear` too), and the server reads the entry for its parent. It is ours and documented, but adds a hook
  dependency and a window between `/clear` and the hook's write that I have not measured; Claude's file is
  written by the host itself. **My recommendation: Claude's file as the proof, the SIA slot not built**, with
  a `/sync`-style check that fails loudly if the file's shape changes (fail-closed: attributed writes refuse,
  they never fall back). Also note: the classifier denied me reading OTHER sessions' files in that directory
  as credential exploration. The server reads only its own parent's, but Aaron should know what it touches.
- **Q2 (Cursor).** Cursor has no such file. Under the rule, a Cursor server can prove nothing and would
  refuse attributed writes, which ends Cursor attribution. Accept that, or rule a Cursor-specific proof
  (not measured: what Cursor passes its MCP servers).

## Not measured, and why

- **The server's spawn environment:** reading process 8832's environment block was **denied by the auto-mode
  classifier ("Credential Exploration")**. Not pursued another way.
- **Other claude processes' `~/.claude/sessions/*.json` against their transcripts** (a second and third
  instance of observation 2): **denied** by the same classifier. Observation 2 is therefore **one instance**.
- **`/mcp reconnect`:** a user command; I cannot run it. To measure: Aaron runs `/mcp reconnect open-brain`
  in this window, then I read the new server's parent PID and the file.
- **Whether a hook process sees `CLAUDE_PID`**, and the ordering of the host's file write vs. the first tool
  call after `/clear`.

## Row #348

Not touched. To be written up in the handoff as a one-off repair for Aaron.
