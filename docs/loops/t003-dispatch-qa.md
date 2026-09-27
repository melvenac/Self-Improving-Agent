# T-003 (a server knows its OWN session), stacked on T-179 round 2: dispatch to a FRESH, HEADLESS QA seat (record session 142)

**By:** Atlas (planner), record session 109 · 2026-09-27 (UTC). **Runs from** `docs/loops/qa-queue.ps1`, via
`docs/loops/qa-142/drive.ps1`. **Nobody is watching live.** Questions go in "Open for the planner".
**Not available:** `/start`, the MCP server, `gitnexus`. Scratch under `C:\qa-scratch`, temp in `C:\qa-tmp`, and commit
your report from a separate worktree. **Record the machine you ran on.** **Never write any live `state.json`, and never
the real `~/.claude/open-brain/` stores:** use scratch homes (a scratch `HOME`/`USERPROFILE` or the stores'
override variables).

## The candidate

- **`706c029`** on `origin/loop/t003` (handoff `9f4fc1e`, `docs/loops/` only). Forge 137, effort medium, **stacked on
  T-179 round 2 `d0335d7`** (QA 134 scores round 2; score here only what T-003 adds).
- **CI:** `36281313992` success: tcm 1320 passed, and the laptop (Windows) 1321 passed.
- **Step 0 and 0b** (`docs/loops/t003-step0.md` on the branch) are the measurements the design rests on. Read them.

## The design, as built (from the handoff)

- SessionStart writes `open-brain/by-pid/<CLAUDE_PID>.json` `{session_id, claude_pid, proc_start, …}` first.
  SessionEnd, which fires on `/clear`, removes it only if it holds its own id.
- The server reads `by-pid/<process.ppid>.json` at **every** attributed write, never cached. It **never** uses
  `CLAUDE_PID`, which is wrong in an MCP server; the Step 0b trap. A start-time mismatch refuses.
- Slot adoption is **removed**. `ob_set_session` is a check. `ob_end` and `ob_store_chunk` refuse a foreign id.
  `set_handoff` refuses with no proof and names the reason. Recall and feedback say NOT LOGGED with the reason.
- A Cursor server proves nothing, so it refuses attributed writes (the planner's Q2 ruling).

## Check, not accept

1. **QA 125's A7, A8 and A9 in the same checkout,** the paths T-179 left open (R179-2): each is now refused or
   attributed correctly. Re-run QA 125's `c1-attack.mjs` shapes against `706c029` in a scratch home.
2. **Attack the proof:**
   - a by-pid file forged for another claude PID;
   - a stale file after a SessionStart that failed (SessionEnd should have removed it);
   - PID reuse (a matching PID with a different start time);
   - a nested server (a claude under a claude), which must use its OWN parent;
   - a `session_id` passed to `ob_set_session` that differs from the proof;
   - two servers under one claude.
   Is there ANY path where a write lands under an id the server cannot prove?
3. **The hooks as registered:** run `setup.mjs` against a scratch settings file. Both SessionStart and SessionEnd are
   present. What happens to attribution if only SessionStart is registered (an old install)?
4. **Live, if you can:** a real headless `claude -p` with this branch's build and hooks in a scratch config
   (`--settings` and `--strict-mcp-config`, as Forge's Step 0b did), across `/clear` if headless allows. Otherwise
   say it could not be shown.
5. **Row #348's proposed repair** (handoff §6): check its reasoning (the owner `1f1d05c2…`, 33 `recall_log` rows)
   against the data by READING a copy of the DB. Never run the UPDATE.
6. **Your own mutants,** at least: the proof read cached at first use; `CLAUDE_PID` used instead of ppid; the
   start-time check skipped; slot adoption restored.

## CI and authority

- tcm, at most **6** runs. **No laptop CI** (the laptop is a QA machine). **Push only `qa/t003-*`, through
  `node docs/loops/qa-142/push-qa.mjs`.**

## The report

- **Path:** `docs/loops/t003-qa-report.md`. The verdict first, then each check, mutants, CI, what could not be verified,
  defects, disagreements, error entries and "Open for the planner".
- Commit to `qa/t003-report`. **The LAST line is exactly `QA-142: REPORT COMPLETE`.** No `/end`.
