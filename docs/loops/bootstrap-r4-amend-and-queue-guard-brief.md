# /bootstrap r4 amendment (R-BF-21, record 156 continuing), and the QA queue guard brief (record 160)

**By:** Atlas (planner), record session 146 · 2026-09-27.

## R-BF-21: no test seam that loads code ships in a mutating command

**What the planner read:** `856d413`'s `cli.ts` diff (the `move-residue` branch) and the r4 handoff's first 30 lines.
- The shipped `bootstrap move-residue` now does `await import(process.env.OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK)` and uses
  that module's `rename` to move the owner's files.
- It exists only so a test can reach the failed-undo message (R-BF-20).

**Ruling: remove it.** An environment variable that loads and runs arbitrary code inside a command that moves files
widens that command's behaviour for every user, to serve one test.
- Test R-BF-20's CLI half the way the rest is tested: extract the message the CLI prints for a `moveResidue` error
  into an exported function of the error, and give it a row. The rename is already injectable at `moveResidue`, and
  QA 145's P-UNDO used exactly that.
- **Row:** the failed-undo error, passed through the extracted function, never says "refused", and names what moved,
  where, and what stayed.
- **Mutant:** the old `refused` wording goes red.
- **Also:** `git grep` must find no `OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK` anywhere in `src/`.

To the same seat, on the same branch: `loop/bootstrap-fix-r4`, a new commit on `856d413`. The new candidate SHA goes
in the handoff. Red first, then green on tcm, then the mutant. Everything else in r4 stands.

## The QA queue guard (record 160, `cursor-infra`)

**The defect:**
- At 2026-09-27 01:12Z, a second `qa-queue.ps1` (`-Queue 144 -Checkout 46efa7e`) started on the QA PC while QA 134's
  driver (pid 1748) was running.
- Its `Get-OtherDrivers` wait saw nothing, and it moved the QA tree `2667c6b` → `46efa7e` two seconds later, under the
  running seat. That was 176 files, source included.
- From an ssh shell the same detector found pid 1748. QA 134's Open 6 suggests why: from the launching context, WMI
  returns a null `CommandLine` for the other process, so `-match` sees nothing. **That cause is plausible and
  unconfirmed.**
- The rule in force until this is fixed is "launch only on an idle machine" (`qa-launch.md`). It works because a
  person remembers it. **That is the shape this project exists to replace.**

**Objective: two queues on one machine can never overlap a driver, whatever WMI can or cannot see.**
- **A lock file the queue holds** for its whole life: created exclusively, with the pid and start time written in it,
  and removed on exit. A second queue refuses at start, naming the holder, **before** any fetch or checkout.
  - A stale lock (its pid gone, or a different start time) is taken over, and the takeover is logged.
- **Belt and braces:** `Get-OtherDrivers` treats a `powershell.exe` whose `CommandLine` it cannot read as "maybe a
  driver". It waits, and logs that it waited and why.
- **Every wait and every refusal gets a `queue.log` line.** Today a wait is silent.
- **Rows, with the target machine's shape:** the two earlier queue failures (an `int[]` parse, an unquoted path with a
  space) came from tests that did not use the target's shape. So:
  - run two queues on one machine, the second launched by `Invoke-CimMethod Win32_Process Create` exactly as
    `qa-launch.md` does, over ssh to the laptop or the QA PC if Aaron permits, otherwise locally on this desktop;
  - use a stub driver (a `docs/loops/qa-9997/drive.ps1` that sleeps; never `claude`);
  - use a profile path containing a space (QA PC) at least once.
  - **Show the second queue refusing, and the tree not moving.**
- **Known positive:** the current script, run in the same harness, reproduces the move.

**Constraints:**
- `qa-queue.ps1` lives in `docs/loops/`. Branch `chore/qa-queue-guard` from `origin/master`.
- **The machine-side copies in each user folder are Aaron's to replace, after merge.** Name the copy step in the
  handoff. The desktop and laptop launch lines in `qa-launch.md` may need a matching change: say so.
- **No real QA run is launched by this seat.** Stubs only. Nothing is written to any QA machine without Aaron's word,
  relayed by the planner.
- Push only `chore/qa-queue-guard*`. Handoff `docs/loops/qa-queue-guard-developer-handoff.md`, pushed before posting.
  Report through your own room.
