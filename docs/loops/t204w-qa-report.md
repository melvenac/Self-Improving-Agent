# QA 271 report: #404 (T-204 machine lease), rows 14, 15 and 16, on WINDOWS

**By:** QA 271 (headless Claude Code, Opus 5.5), record session 160, DESKTOP-UGEKR74 (user melve), 2026-10-04 ~02:15Z.
**Dispatch tree:** `qa271-wt` at `db8ef4e6a131408b84c779b7dd1cbdf375906100` (`git -C C:/qa-scratch/qa271-wt log -1 --format=%H`).
**Candidate:** #404 pinned `5add91379641ef211f98b2f79d1551c0090821eb`, worktree `C:/qa-scratch/qa271-pr404`. `ls-remote`
read `refs/pull/404/head` = `5add9137` at start and again at end. origin/master = `0bc93353` at start and end.

## Verdict for #404: INCOMPLETE

**Rows 14, 15 and 16 were NOT RUN.** This headless session's permission layer refuses every way of executing
PowerShell, so none of the harness, the mutants or the crash-release probe could run. These are the attempts, each
refused before it ran, with nothing executed:

| Route | Refusal |
|---|---|
| PowerShell tool, `& C:\qa-scratch\qa271-mut\run.ps1 ...` | "contains multiple operations ... requires approval" |
| PowerShell tool, `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...run.ps1 ...` | "Command spawns a nested PowerShell process which cannot be validated" |
| Bash tool, `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...run.ps1 ...` | "This command requires approval" |

`node` was allowed, so `child_process` could have spawned `powershell.exe`. **I did not do that.** It would have
routed around a permission gate that had just refused the same action, and in a `-p` job nobody can approve it.
**For the next run:** launch with a permission mode or an allow rule that admits `powershell.exe -File` on
`C:\qa-scratch\qa271-*` (or the next job's equivalent), or have the planner rule that the node route is allowed.

QA 269 could not run these rows on Linux, and QA 271 could not run them on Windows. **No QA run has executed the
harness yet.** The only evidence for rows 14 to 16 is still the developer's own handoff.

## What was established (static; nothing executed)

- **Safety, start and end:** `C:\Users\melve\machine-lease` was ABSENT at the start and at the end. Checked with
  `node fs.existsSync`, with controls: `C:/Users/melve/Projects` and `Desktop` read `true`, and a made-up name read
  `false`. The real lease folder was never touched. No queue was run and nothing under `~/.claude` was read.
- **Row 14 inputs, prepared:** master's queue, from `git show origin/master:docs/loops/qa-queue.ps1` (master
  `0bc93353`), is at `C:/qa-scratch/qa271-mut/master-qa-queue.ps1`. The runner `C:/qa-scratch/qa271-mut/run.ps1` points
  `USERPROFILE`, `HOME`, `TEMP`, `TMP` and `TMPDIR` at fresh `C:\qa-tmp\qa271-*` folders, then calls the candidate's
  harness. **It never ran.**
- **Row 15, mutant edits confirmed landed** (each diffed against the candidate with `git diff --no-index`):
  - `nonatomic`: `machine-lease.ps1` from `loop/t204-mut-nonatomic` @ `a486cf76`. Against `5add9137` it is 1 file,
    +2/−1: a check-then-`WriteAllText($LeasePath)` before the atomic move. `grep -c "WriteAllText(.LeasePath"` = 1.
  - `nostart`: `machine-lease.ps1` from `loop/t204-mut-nostart` @ `1f1a6f63`. Against `5add9137` it is 1 file,
    +1/−1: the `pid_reused` line is blanked. `grep -c pid_reused` = 0 (the candidate has 1).
  - QA mutant `queue-skiplease`: the candidate's `qa-queue.ps1` with line 276 `Acquire-MachineLease` replaced by
    `# QA271-MUTANT: lease call skipped`. The diff is that one line. **Prediction, unexecuted:** it should kill
    `new.R8` (the driver runs under a held lease) and `new.R8c` (no "helper missing" refusal), and leave `R8b`, the
    R9 rows and every lease row passing. `R8b` should still pass: with no lease taken there is none to release, and
    the release is guarded by `$script:LeaseHeld`. This matches the developer's `noleasecall` claim (R8 and R8c), but
    it has not been shown.
- **Row 16:** no probe was written or run.

## Gaps

- **G1 (blocking):** rows 14, 15 and 16 are unexecuted on any QA host. #404 still has no independent run of its
  harness.
- **G2 (record):** `t204-developer-handoff.md` says the three mutant branches are "local ... **not pushed**". In fact
  `ls-remote` shows `loop/t204-mut-nonatomic` (`a486cf76`), `-nostart` (`1f1a6f63`) and `-noleasecall` (`88094f1f`)
  on origin. They are parented on `081a5e74`, not on the pinned head, but their `machine-lease.ps1` differs from
  `5add9137` only in the mutant lines. This is harmless, but the handoff is wrong about it.
- **G3 (procedure):** the dispatch's LIGHT job assumed this seat can execute PowerShell. The headless launch on the
  desktop does not grant that.

## Scratch footprint

Created only `C:/qa-scratch/qa271-wt`, `C:/qa-scratch/qa271-pr404`, `C:/qa-scratch/qa271-mut` and
`C:/qa-tmp/qa271-prof`, `C:/qa-tmp/qa271-temp` (empty). No process was started besides git and node one-shots.

QA-271: REPORT COMPLETE
