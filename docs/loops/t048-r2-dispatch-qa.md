# T-048 round 2 (session end tells a missing thing from an unreadable thing): dispatch to a FRESH, HEADLESS QA seat (record session 157)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Runs from** `qa-queue.ps1` via `docs/loops/qa-157/drive.ps1`.
**Record the machine, and whether this process runs elevated.** Nobody is watching live. Use `C:\qa-tmp` and
`C:\qa-scratch`. **Never write a live `state.json` or the real knowledge DB:** point `KNOWLEDGE_V2_DB`, `HOME` and
`USERPROFILE` at scratch. Commit the report from a separate worktree.

## The candidate

- **`5b9a403`** on `origin/loop/t048-r2`. The handoff is at `df78b37` (`docs/loops/` only after `5b9a403`).
- Stacked on T-179 round 2 `1646567`. Built by **Grok 4.7 in Cursor**, record 150. It posted under the hub name
  `cursor-builder` by mistake; the seat was `sia-forge`.
- **Brief:** `docs/loops/t048-r2-brief.md`. **The audit:** `docs/loops/research/t048-silent-drops.md`, rows SILENT 5,
  6, 14, 15 and 16.
- **The product diff against `1646567`:**
  - `cli-session-end.ts`;
  - the session end's `index-v2.ts`, `invocation-logger.ts` and `session-summary.ts`;
  - **also `sync/scorer.ts` and `sync/types.ts`**, which the brief did not list. The brief required "the health score
    says which" for SILENT 6, so check that this is all they do.
- **CI on tcm:** red `36291877179` (`38b3211`: 5 rows fail); green `36292013590`. Five mutants, each killing its row:
  - `36292064156`;
  - `36292091960`;
  - `36292109835`;
  - `36292133183`;
  - `36292154461`.

## Check, not accept

1. **Each distinction is a distinct printed value, on real inputs, not only on fixtures.**
   - A recalled id whose `knowledge_index` row is deleted, against an omitted judgment (SILENT 5). **The omitted
     judgment is still never stored as neutral.**
   - A `feedback_log` write that throws (SILENT 16): `Feedback: N` counts only writes that landed.
   - A missing, a corrupt and an unreadable invocation log (SILENT 6), and what the health score reports for each.
   - An unreadable session db against no db holding the session (SILENT 14).
   - All four summary skip causes (SILENT 15). The developer reports that a garbage db file used to THROW
     `SQLITE_NOTADB`: confirm at `1646567`, and confirm it is now a named skip.
2. **Nothing becomes a crash.** Session end must still finish, and the session-end hook must still exit as before. Run
   the built hook in a scratch home.
3. **Preserve:**
   - the `helpful`/`neutral` rule;
   - SAFE and INTENDED rows untouched;
   - `server.ts` NOT edited: verify it, since SILENT 4 and 9 are out of scope.
4. **The scorer and types changes:** check they add no scoring behaviour beyond naming the log state.
5. **Your own mutants,** at least one per SILENT row.

## CI and authority

tcm, at most 6 runs. **No laptop (`windows=true`) CI.** **Push only `qa/t048-r2-*`, through
`node docs/loops/qa-157/push-qa.mjs`.**

## The report

- **Path:** `docs/loops/t048-r2-qa-report.md`.
- Order: the verdict first, then each check, mutants, CI, what could not be verified, defects, disagreements, error
  entries, and "Open for the planner".
- Commit to `qa/t048-r2-report`. **The LAST line is exactly `QA-157: REPORT COMPLETE`.** No `/end`.
