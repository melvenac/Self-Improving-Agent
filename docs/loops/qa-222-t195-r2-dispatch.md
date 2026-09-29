# QA 222: record 215 r2 (T-195, a D_t beside every brief, judged by the plan gate)

**Read `docs/loops/qa-222-225-common.md` first.** Prefix `t195-r2`. Report `docs/loops/t195-r2-qa-report.md` on `qa/t195-r2-report`.

## The candidate

- **Code at `647cc74ebb66eae6cd36acc9c09d0804b2972387`** on `origin/loop/t195-dt-plan-gate`. The tip `71810ea` adds only the handoff. The base is `8467cb1`.
- **The brief:** `docs/loops/t194-t195-dispatch.md` §"Record 215", with rows DT-1 to DT-8, plus DT-9a to DT-9d as `docs/loops/t195-dispatch-qa.md` defines them.
- **This is r2.** QA 216 REJECTED `603be51` (`qa/t195-report` `73728dd`). **Read that report first.** Every row it scored `met` must still be met.

## Its four findings must be closed

1. **The full-suite regression.** `tests/harness/spawn-sites.test.ts` (CA-4b/R16) failed because `GATE_RECORD_RE.exec` read as a spawn. Show it green on tcm, and show that the guard's planted positives still bite.
2. **DT-7 is wired.**
   - Forge's shape is `node open-brain/build/harness/cli.js dispatch <brief> --say "..." --repo <root>`: it runs the check, then sends the hub turn only on exit 0.
   - Confirm that a refused check sends nothing. Use the stub transport, and also inspect what the command would send.
   - Score DT-7 `met` only if the send is unreachable without passing the check.
3. **DT-4 never overwrites.** Two records at the same timestamp now produce two files, through an exclusive create. Repeat QA 216's same-timestamp probe.
4. **The DT-7 mutant `b450ad5` must typecheck** and go red on the new DT-7 test.

The developer's mutants are `-mut-threshold` `c5da6ea`, `-mut-pass-on-error` `908167a`, `-mut-dispatch-ok` `b450ad5` and `-mut-dt9-ancestry` `8d919d7`. Re-apply each one to `647cc74`.

**No live Jev call.** The live call is observed later by the planner.
