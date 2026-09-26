# T-179 + T-163, round 2: dispatch to a FRESH, HEADLESS QA seat (record session 134)

**By:** Atlas (planner), record session 109 · 2026-09-26 (UTC). **Runs from** `docs/loops/qa-queue.ps1`, via
`docs/loops/qa-134/drive.ps1`, on whichever QA machine Aaron's queue names. **Nobody is watching live.** Questions go in
"Open for the planner".
**Not available:** `/start`, the MCP server, `gitnexus`. **Temp and scratch:** `C:\qa-tmp` and `C:\qa-scratch`. Commit
your report from a separate worktree under `C:\qa-scratch`.
**Record which machine you ran on** (`$env:COMPUTERNAME`) and its Defender exclusions, in the header.

## Why it matters

Merging this **migrates the live record** to schema v3. **Never write any live `state.json`.** Copies only.

## The candidate

- **`1646567`** on `origin/loop/t179-r2` (handoff `d0335d7`, `docs/loops/` only). Forge 128, effort medium, built on the
  rejected `3c0bfdc` (QA 125) plus round 2.
- **CI:** tcm `36231392345` green (1307 passed, 2 skipped). Redcheck `6c8f581` red `36230084527` (10 AssertionErrors).
- It merges cleanly into master `aae0dce` (the planner checked with `git merge-tree`).

## Score against

- **QA 125's report** (`origin/qa/t179-report` `7df2ed0`): every defect, D1 to D8, as ruled.
- **`docs/loops/t179-rulings-qa125.md` IN FULL, with amendments 1, 2 and 3.** Amendment 1 re-ruled R179-1: **order by
  `first_rev`, never by session number**. Amendment 2 added R179-8, done-task retention by revision. Amendment 3
  accepted three departures.

## Check, not accept

1. **D1 is closed by construction.** Re-run QA 125's `c1-attack.mjs` A6, A6b and A6c: no erasure at all. Then attack
   the new rule:
   - can a caller influence `first_rev` or `closed_rev`?
   - does any comparison anywhere still use the session number? Search for it;
   - a wrong number on a done task (1124);
   - A2's gap of 11 and A5's jump to 500 now pass.
2. **D2 (R179-2), narrower as accepted:** a uuid recorded under a different checkout is refused. Confirm that the
   same-checkout A7, A8 and A9 are stated in the handoff and `end.md` as not fixed (T-003). Do NOT score them as
   failures.
3. **R179-3:** each legacy handoff is superseded by its seat's first keyed handoff, and `record-erasure` explains the
   removal. Legacy session records are never superseded.
4. **R179-4, the checklist:** walk ALL SEVEN steps in a scratch clone, as a stranger would. The developer walked only
   1 and 2. Migrate a copy of SIA's live record (rev 132 on `origin/docs/session-100-qa99-dispatch`) AND a copy of
   `~/Projects/A2A-Hub`'s shape if you can reproduce it (v2), counting every uuid before and after with two
   instruments. Is the migration idempotent?
5. **R179-5:** `setup.mjs` registers the SessionEnd hook. Run it against a scratch home or settings file, never the
   real one.
6. **R179-6/7:** `end.md` claims only what the code does. The R179-7 fixture kills `erasure-blind-rev60` on CI.
7. **Your own mutants,** at least: `first_rev` taken from the caller; the number comparison restored in one of
   `lastSession`, retention or done-task retention; and the different-checkout refusal skipped.
8. **The full suite**, once, as the Defender-on control, and the importer probes (QA 122's `probes-r4`, QA 111's
   `probes-r3`) byte-exact.

## CI and authority

- tcm, at most **8** runs. No laptop. **Push only `qa/t179-r2-*`, through `node docs/loops/qa-134/push-qa.mjs`.**
  Never master, merges, PRs, other seats' branches, or any live `state.json`.

## The report

- **Path:** `docs/loops/t179-r2-qa-report.md`. The verdict comes first, then each check, mutants, the suite, what could
  not be verified, defects, disagreements, error entries, reproduction and "Open for the planner".
- Commit to `qa/t179-r2-report`. **The LAST line is exactly `QA-134: REPORT COMPLETE`.** No `/end`.
