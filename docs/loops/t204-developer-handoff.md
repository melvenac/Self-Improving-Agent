# T-204 developer handoff (Forge, QA PC DESKTOP-O4EGB1E)

Branch `loop/t204-machine-lease`, from master `066ed8ca`. Design, rows, launcher lines and Aaron's copy step are in
`docs/loops/t204-plan.md`; this file is the evidence and what is not covered.

## Evidence (this tree, Windows PowerShell 5.1, Sonnet 5.5)

`powershell -File docs/loops/machine-lease-harness.ps1 -Lease docs/loops/machine-lease.ps1 -Queue docs/loops/qa-queue.ps1 -OldQueue <master's qa-queue.ps1> -Rounds 20`

- Candidate: **24 rows pass, 0 fail.** Run against master's `qa-queue.ps1` (`-OldQueue`): **all 7 queue rows FAIL**
  (R8, R8b, R8c, R9, R9b, R9c, R9d), each for the reason it names. R8 old: `run.9997=started` with a live lease held.
  R9b old: a bare `done_marker.9997=True`, the QA 231 shape.
- Mutants, local branches off the candidate, **not pushed**, each kills exactly the row it names (30 / 10 / 10 rounds):
  - `loop/t204-mut-nonatomic` (check-then-write take): **R5 fails**, 30 of 30 rounds had 6 winners.
  - `loop/t204-mut-nostart` (ignores pid creation time): **R3 fails** (code 10, held).
  - `loop/t204-mut-noleasecall` (queue never takes it): **R8 and R8c fail**.
- `/sync`: 2 issues, both pre-existing and not in these files (`ENTITIES.md` names retired `dream` / `reflection queue`;
  greeting 49,650 chars over the 40,000 limit). No `.gitnexus`, no `open-brain/build` in this tree.

## Not covered, said plainly

- **The `open-brain` vitest suite was not run.** This change touches no TypeScript; the tree has no build.
- **Nothing was run on the laptop or against real `claude`.** The stub driver never runs claude. `launch-qa.ps1` is
  Clark's file on the laptop and unchanged; the two-call form in the plan is a specification, not tested against it.
- The race row (R5) shows the atomic take is exclusive across six real processes; it cannot prove exclusivity, only
  fail to find a violation. The reclaim path is serialised by a named mutex that no row races directly.
- `qa-queue.ps1`'s `-SelfTest` gained no lease checks (the plan's item 10 was dropped: classification lives in the helper).
- The lease is per user. `status` prints the limit.

## Aaron, after merge (each machine, through `cmd /c`)

    git show <merge-sha>:docs/loops/qa-queue.ps1 > %USERPROFILE%\qa-queue.ps1
    git show <merge-sha>:docs/loops/machine-lease.ps1 > %USERPROFILE%\machine-lease.ps1

Copy both. A missing helper makes the queue refuse (`refuse=machine lease helper missing`).

## Harness footprint

The harness points `USERPROFILE` at `%TEMP%\t204-harness\Aaron Melven` for its own process and restores it. Under a
changed profile PowerShell dropped a `Microsoft\Windows\PowerShell\ModuleAnalysisCache` into the working directory;
I deleted it. If it appears untracked after a run, delete it.
