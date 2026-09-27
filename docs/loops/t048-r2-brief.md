# T-048 round 2: session end must tell a missing thing from an unreadable thing (record 150)

**By:** Atlas (planner), record session 146 · 2026-09-27. **To:** Grok 4.7 in Cursor, a FRESH chat (D-035), in
`~/Worktrees/sia-forge`. Transport: A2A-Hub room `k57frxw0ptb8tadmqdwy0khhks8ey006` only, and always with `--session`.
**From:** your own audit, `docs/loops/research/t048-silent-drops.md` on `origin/master`. Round 1 (SILENT 1, 2, 3, 20,
26: the `/sync` checks) went to Forge in `sia-builder` as record 148. **Do not touch those five sites.**

## Scope: five rows, all in the session-end path

| Audit row | Site (the audit's lines, at `7640b93`) | Two different things that read as one |
|---|---|---|
| SILENT 5 | `session-end/index-v2.ts:110` | a recalled id whose `knowledge_index` row is gone, vs. an omitted judgment (`:126`) |
| SILENT 16 | `session-end/index-v2.ts:146` | `Feedback: N` counts an id whose `feedback_log` write threw |
| SILENT 6 | `session-end/invocation-logger.ts:61-81` `readLastInvocationTs` | a corrupt or unreadable log vs. a missing log (all return `null`) |
| SILENT 14 | `session-end/session-summary.ts:61-62` `findSessionDb` | a db that throws on open vs. no db holding the session id |
| SILENT 15 | `session-summary.ts:86/95/98/109` `extractSessionSummary` | open failure, no `session_events`, no `session_meta`, and zero events all read as "Summary: skipped" |

**The planner opened each of these sites on `origin/master` and they match your audit.** They are not changed by
T-179 round 2, but `cli-session-end.ts`, which prints their results, is.

## Why this group, and why now

- **These files are touched by no in-flight branch.** `server.ts` is changed by every in-flight branch, so SILENT 4
  (`ob_recall`) and 9 (`handleEnd`) wait for a later round.
- **Session end writes the record every later measurement reads:** `feedback_log`, the invocation log, the summary.
  Among your 26 rows, these five are where a failed write or an unreadable input leaves the record looking complete.

## Done means

- **Each distinction in the table is a distinct value**, and it reaches the printed session-end line:
  - SILENT 5 names the vanished ids, separately from the omitted judgments;
  - SILENT 16 counts only feedback that was written, and names a failed write;
  - SILENT 6 returns something that is not `null` for a corrupt or unreadable log, and the health score says which;
  - SILENT 14 and 15 say why the summary was skipped.
- **Nothing becomes a crash.** Session end must still finish. The rule is "named", not "thrown".
- **Rows:**
  - a test per distinction that fails at `1646567` and passes after;
  - one mutant per protection (restore the bare `continue`, the empty `catch`, the shared `null`), each killing its
    row;
  - `npx tsc --noEmit -p .` before every push.
- **Preserve:**
  - the `helpful`/`neutral` rating rule, and a missing judgment never becoming a fabricated neutral (INTENDED in your
    audit);
  - the session-end hook's exit behaviour;
  - the INTENDED and SAFE rows.

## Rules

- **Branch** `loop/t048-r2` from **`1646567`** (T-179 round 2's candidate), since `cli-session-end.ts` changes there.
  It merges after T-179 round 2.
- **Read ONLY:** this file, your audit's SILENT 5, 6, 14, 15 and 16 rows, the three files at `1646567`, and
  `cli-session-end.ts` at `1646567`. Size your reads by section; your context is 256k.
- Red first on tcm, per test, at most 6 runs. **No laptop (`windows=true`) CI**: the laptop is running QA.
- Commit checkpoints as you go, and keep a running handoff at `docs/loops/t048-r2-developer-handoff.md`, so a fresh
  chat could resume.
- Push only `loop/t048-r2` and `loop/t048-r2-*`. **Push the handoff before posting to the hub**, and read it back with
  `ls-remote`. Never push master, never force push, never tag. No `/end`. Never write the live `.agents/state.json`.
- Report your model and effort.
