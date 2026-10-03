# QA 264 row 7c (#372, T-235 P2-1): live `setup.mjs` under a scratch HOME — run by the planner

**Why the planner ran it:** QA 264's seat was refused `setup.mjs` by its permission layer and marked #372 INCOMPLETE
on row 7c only (report `qa/s159-batch-report` @ 03065f8e). The row needs a seat allowed to run it; the planner did,
on the desktop, 2026-10-03 ~05:0x CDT, after Caliper QA-021 ended. This is a read-back, not an independent QA verdict.

**Tree:** scratch worktree `C:\qa-scratch\p372-7c\wt` detached at `4240a8beeddde0ef9865a411c571932eb2d9d75d` (#372 head).
**HOME:** `USERPROFILE` and `HOME` = `C:\qa-scratch\p372-7c\home`, `OPEN_BRAIN_VAULT_DIR` inside it; restored in a
`finally` block. Seeded (UTF-8, no BOM): `.cursor/mcp.json` with open-brain `command: "node"` plus an unrelated server
`other`; `.cursor/hooks.json` with a bare-`node` `cli-bootstrap.js --ide cursor` entry plus `echo unrelated`.

**Run 1:**
```
✓ open-brain registered in ~/.cursor/mcp.json (command C:\Program Files\nodejs\node.exe)
✓ Upgraded 1 stale Cursor sessionStart hook entry(ies)
✓ Cursor sessionStart hook registered in ~/.cursor/hooks.json
```
**Run 2:** `· Cursor open-brain MCP already registered — skipped`, `· Cursor sessionStart hook already configured`.

**Written files:** `mcp.json` open-brain `command` = `C:\Program Files\nodejs\node.exe` (absolute); `other` kept as
`{"command":"foo"}`. `hooks.json` sessionStart = `["echo unrelated", "\"C:/Program Files/nodejs/node.exe\"
\"C:/qa-scratch/p372-7c/wt/open-brain/build/cli-bootstrap.js\" --ide cursor"]`: stale entry replaced, unrelated kept,
no duplicate.

**Real config untouched:** SHA-256 of the real `~/.cursor/mcp.json`, `~/.cursor/hooks.json` and
`~/.claude/settings.json` identical before and after. Scratch tree and HOME removed afterwards.

**Row 7c: PASS.** The deploy read-back (real QA PC `cursor-agent -p` calling `ob_stats`) remains the acceptance step
after merge, per the planner's P2-1 ruling.
