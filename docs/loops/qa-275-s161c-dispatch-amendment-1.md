# QA 275 amendment 1: three re-runs from QA 273, and the batch-merge row

**By:** Atlas (planner), 2026-10-04, record session 161, after ruling QA 273 (`origin/qa/s161a-report` @ `7ce08718`)
and QA 274 (`origin/qa/s161b-report` @ `bfc22508`). Read both reports' sections for the PRs below before their rows.

**This amendment ADDS three PRs to QA 275 and the batch-merge row.** Every row of
`qa-275-s161c-dispatch.md` still applies to #434, #436 and #437. Row numbers here continue from 20.

**Added pinned heads (CI `test` green on each, read by the planner):**

| PR | Task | Head | CI run | What changed since QA 273 |
|---|---|---|---|---|
| #421 | G-053 r3 | `8173cef6495dd9333cd199d0c05c82ac671589ed` | 37189592640 | tests only: `-0`/`+0` refusal rows, `gc.autoPackLimit=0` row |
| #424 | T-235 P2-6 r2 | `b9026d71d1fbfa2ba42de465fac4d54feae702cd` | 37189663548 | a differing user file is moved aside to `<name>.md.user-<UTC>` and both paths are printed; parity test per file |
| #427 | T-235 P2-3 r2 | `987901c9cb43f3dd3a31b9e22fec164edd9769dd` | 37189839577 | walk from `process.ppid`; host matched by cursor-agent's `versions/<ver>/index.js` entry; e2e test spawns the fixture; single CIM query on Windows |

**#425 is unchanged** (`9fcb97ca8bb266c03cef7501c4b2b831c8d1601b`, ACCEPTED in QA 273 and QA 274, HELD for #437). It is
not re-QA'd; it enters the batch-merge row only.

## #421 r3 (narrow)

21. `git diff 9915a59b 8173cef6` touches `config-channel.test.ts` only; the product is byte-identical to r2.
22. QA 273's two surviving mutants now die: admitting `-0`, and widening to a `gc.auto*` prefix. Show each red.

## #424 r2 (QA 273 row 9 again, plus row 11's nit)

23. Row 9 again: a user-modified `task.md` is moved aside byte-identical, the message names both paths, the template
    is installed, and a second run is a no-op (no second side file). A file identical to the template is untouched.
    A mutant that drops the move-aside goes red.
24. The parity unit test fails for each of `task.md`, `test.md` and `harness-audit.md` removed in turn.

## #427 r2 (QA 273 rows 17 to 19 again)

25. Rows 17, 18 and 19 of `qa-273-s161a-dispatch.md`, at the new head. **Repeat QA 273's wrong-pid probe exactly**
    (the repo reached through a path containing `cursor-agent`, no host): NO proof is written, with a visible reason.
26. The host matcher: read `isCursorAgentHostCommandLine` and the live command line cited in
    `docs/loops/t235-p2-3-r2-measure.md`. Say whether a renamed install, or a `cursor-agent` shim not under
    `versions/<ver>/index.js`, would be missed (a false negative fails closed; say whether anything fails open).
27. The e2e test spawns the fixture and asserts `by-pid/<hostPid>.json`; QA 273's `claude_pid: process.pid` mutant is
    red. The replaced `t003-session-proof` assertion states what a Cursor payload under a Claude registration does.
28. **Windows is NOT re-run here.** r2 replaced the per-ancestor PowerShell spawn with one CIM query, so QA 274's row
    20 evidence is for the OLD walk. Read the new win32 branch and report anything that differs in kind (the query,
    its filter, the in-memory walk). **#427 r2 cannot merge until the real-Windows row 20 is re-run** on the laptop
    as a separate short job; say so in the verdict.

## Batch merge (Plumb)

29. In `~/qa-scratch/qa275-merge`, from the DISPATCH_SHA, merge `--no-ff` in this order: #421 (`8173cef6`), #424
    (`b9026d71`), #425 (`9fcb97ca`), #427 (`987901c9`), #434 (`12f26320`), #436 (`144623d2`), #437 (`23d46156`).
    **Expected conflicts, name each:** the `import { … } from './setup-hooks.mjs'` line in `scripts/setup.mjs`
    (#424, #425, #436 each add a name; the union is mechanical), the rest of `setup.mjs`/`setup-hooks.mjs`, and
    `open-brain/src/server.ts` (#427 and #434). Say for each resolution whether it is mechanical, and show any that
    is not with `git show --remerge-diff`.
30. On the merged tree: `tsc --noEmit`, `npm run typecheck:tests`, `npm run build`, `node --check` on the built
    `server.js`, `cli-bootstrap.js`, `cli-session-end.js` and `cli-recall-trigger.js`, then these test files one per
    run: `config-channel`, `setup-cursor-commands`, `setup-hooks`, `setup-scratch-home`, `t003-session-proof`,
    `t003-r2`, `t235-p2-3-cursor-proof`, `t235-p2-5-cursor-recall`, `cli-session-end-dedupe`, `shared/session-hook-claim`,
    `cli-bootstrap`, `mirror-parity`, `hub-seat-state`, `hub-presence`, `seat-map`, `hub-seats`, `focus`,
    `briefing-budget`, `greeting-size`, `server`.
31. **Full suite once** on the merged tree. Report passed, failed, errors and the exit code separately (G-042). If the
    only non-zero cause is vitest's worker RPC timeout with 0 failed, say so; that symptom was ruled environmental on
    Plumb (D-082).

## Verdicts

One verdict per PR, all six (#421, #424, #427, #434, #436, #437) plus the batch-merge result. ACCEPT for #427 r2 is
"ACCEPT pending the Windows row 20 re-run". `VERDICT: ACCEPT QA-275` only if all six are accepted and the batch
merge is clean or mechanical.
