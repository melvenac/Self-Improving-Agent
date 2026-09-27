# T-048 round 2b (QA 157's findings, outside server.ts): QA dispatch (record 178)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Runs headless on a QA machine through the Cursor QA
driver**, with Composer 2.5. **Never write a live `state.json` or the real knowledge DB:** point `KNOWLEDGE_V2_DB`,
`HOME` and `USERPROFILE` at scratch. Commit the report from a separate worktree.

## The candidate

- **`822f398`** on `origin/loop/t048-r2b`. The handoff is at `616aec1` (`docs/loops/` only after it).
- Stacked on T-048 r2 `5b9a403`, which QA 157 accepted. **Score only what 2b adds.** `server.ts` must be unchanged:
  verify it.
- Built by Grok 4.7, record 176.
- **CI on tcm:** red `36301987254`; green `36302113612`. Mutants:
  - D1 `36302168161`;
  - `hook-old-lines` `36302204762`;
  - `s6-corrupt-earns-recency` `36302237000`;
  - `s14-skip-over-match` `36302281266`.

## Score against `docs/loops/followups-r165-r167-briefs.md`, "Record 176"

1. **T048-D1, the `cli.ts` half:** `sync --score` prints the invocation-log state. Check it on a missing, a corrupt,
   an unreadable and an empty log.
2. **D2:** a readable db with no `session_meta` says "holds no session".
3. **D3:** QA 157's three survivors are killed. Re-apply QA 157's own mutant branches (`origin/qa/t048-r2-*`) to
   `822f398`, and run them on tcm.
4. **D4:** the comment and type are correct.
5. **D5:** the labels are honest for a zero-byte log, an events table with no rows, and a missing sessions directory.
6. **Preserve:** everything QA 157 accepted. Session end still finishes, and no crash is introduced.
7. **Your own mutants,** at least two.

## CI and authority

tcm, at most 6 runs. **No `windows=true` CI.** Push only `qa/t048-r2b-*`, through `node docs/loops/qa-178/push-qa.mjs`.

## The report

- **Path:** `docs/loops/t048-r2b-qa-report.md`, on `qa/t048-r2b-report`.
- Order: the verdict first, then each item, mutants, CI, defects, and your model.
- **The LAST line is exactly `QA-178: REPORT COMPLETE`.**
