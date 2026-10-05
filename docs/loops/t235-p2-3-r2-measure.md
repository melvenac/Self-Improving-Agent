# T-235 P2-3 r2 — host pid + Win32 walk timing

**Date:** 2026-10-04. **Seat:** cursor-builder, QA PC.

## Live cursor-agent host command line (match target)

cursor-agent **2026.10.01-e373342** (via `%LOCALAPPDATA%\cursor-agent\cursor-agent.cmd` → `cursor-agent.ps1` → `versions\<ver>\node.exe` + `index.js`):

```
…\AppData\Local\cursor-agent\versions\2026.10.01-e373342\node.exe …\cursor-agent\versions\2026.10.01-e373342\index.js …
```

`isCursorAgentHostCommandLine` matches `\cursor-agent\versions\<ver>\index.js` (and unix `/cursor-agent/versions/…/index.js`), not arbitrary `cursor-agent` substrings in repo paths.

## F3 latency (Win32 ancestor walk)

Measured on QA PC walking from `process.ppid` (~6 ancestors):

| Approach | ms (rounded) |
|----------|----------------|
| One `Get-CimInstance Win32_Process` per ancestor (pre-r2) | ~2100 |
| One `Get-CimInstance Win32_Process` for full table, walk in memory (r2) | ~650 |

Hook SessionStart uses the single-table walk via `findCursorAgentHostPid` on win32.

## D5

`--ide cursor` with a payload **without** `cursor_version` writes **no** proof (`t003-r2.test.ts` D5 row unchanged).
