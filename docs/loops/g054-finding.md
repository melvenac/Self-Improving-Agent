# G-054 finding: machine-lease `release` exit code vs caller

**Seat:** cursor-infra (QA PC / Aaron desktop), session 160, 2026-10-04. **Gap:** G-054 in `.agents/state.json`.
**Script under test:** `docs/loops/machine-lease.ps1` at master (Assert-Owner `exit 12` on non-owner release, line 165).

## Reproduction (scratch `USERPROFILE` only)

Never touched the real `%USERPROFILE%\machine-lease\`.

1. Copy `docs/loops/machine-lease.ps1` into a temp profile directory and set `USERPROFILE` to that directory.
2. Resolve **owner** pid per D-119: nearest ancestor of the repro shell whose `CommandLine` contains `cursor-agent` (this run: **6088**).
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

Update **qa-launch.md** and planner **D-119 dispatch** text to state this explicitly when those files are next edited for lease work; this finding does not change `machine-lease.ps1`.
