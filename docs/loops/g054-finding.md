# G-054 finding: machine-lease `release` exit code vs caller

**Seat:** cursor-infra (QA PC / Aaron desktop), session 160, 2026-10-04. **Gap:** G-054 in `.agents/state.json`.
**Script under test:** `docs/loops/machine-lease.ps1` at master (Assert-Owner `exit 12` on non-owner release, line 165).

## Reproduction (scratch `USERPROFILE` only)

Never touched the real `%USERPROFILE%\machine-lease\`.

1. Copy `docs/loops/machine-lease.ps1` into a temp profile directory and set `USERPROFILE` to that directory.
2. Resolve **owner** pid (this run: **6088**). Standing rule (code **#427** r2; shape `docs/loops/t235-p2-3-r2-measure.md`): the nearest **ancestor** of the calling shell — start from the parent, never the calling shell itself — that is cursor-agent's own host (`node.exe` running `cursor-agent`'s `versions/<ver>/index.js`). Claude Code: the `claude.exe` session's pid.
3. `take -OwnerPid <owner> -Seat infra -TtlMinutes 90` → exit **0**, message `lease=taken`.
4. `release -OwnerPid <other live pid>` with a different live PowerShell pid (**17312** in this run).

## Exit codes captured (non-owner `release`)

| Method | Invocation | Exit code | Notes |
|--------|------------|-----------|--------|
| **(a)** | `powershell -NoProfile -ExecutionPolicy Bypass -File <copy>\machine-lease.ps1 release -OwnerPid <wrong>` then `$LASTEXITCODE` | **12** | Correct; matches script. |
| **(b)** | `powershell -Command "& '<copy>\machine-lease.ps1' release -OwnerPid <wrong>"` then `$LASTEXITCODE` | **1** | Not 12: `-Command` does not preserve the script's exit 12 (reports failure as 1). |
| **(c)** | Same as (a) but stdout piped through `Select-Object` | **12** | Piping stdout did not change exit code in this run. |

Stdout for all three (same line):

```text
lease=not yours (owner=infra session= pid=6088 started=...); nothing changed
```

## Conclusion

The **source script is correct** on this machine: **(a) is 12**. Rivet's **exit 0** is not reproduced with `-File`; the likely loss is **`-Command` / wrapper semantics** (here **1**, not 12), or an **older/different copy** of the helper (G-054 evidence: installed blobs matched; caller path still matters).

## Required invocation (D-119 / qa-launch)

Always run the helper with **`-File`**, never `-Command "& ..."`**, when the exit code must be interpreted:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\machine-lease.ps1" take -OwnerPid $owner -Seat <seat> -TtlMinutes 90
# ...
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\machine-lease.ps1" release -OwnerPid $owner
```

After each call, read **`$LASTEXITCODE`** in the **same** PowerShell session (exit **12** = not yours; do not retry with a different pid per D-118a).

**Tracked updates (G-054, `loop/g054-lease-callers`):** `docs/loops/qa-launch.md` (this section), `docs/loops/t204-plan.md`
item 8, `.agents/roles/developer.md`, `.cursor/rules/machine-lease.mdc`. Planner D-119 dispatch text in
`.agents/state.json` already uses `-File`. This finding does not change `machine-lease.ps1`; `take` already refuses a
non-live `-OwnerPid` with exit **2** (no harness row added — behaviour present at T-204).
