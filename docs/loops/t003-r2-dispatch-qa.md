# T-003 round 2 (a server knows its own session): dispatch to a FRESH, HEADLESS QA seat (record session 154)

**By:** Atlas (planner), record session 146 · 2026-09-27. **Runs from** `qa-queue.ps1` via `docs/loops/qa-154/drive.ps1`.
**Record the machine.** Nobody is watching live. Use `C:\qa-tmp` and `C:\qa-scratch`. **Never write a live
`state.json`, the real knowledge DB, or the real by-pid directory:** point `KNOWLEDGE_V2_DB`,
`OPEN_BRAIN_ACTIVE_SESSION`, `OPEN_BRAIN_VAULT_DIR`, `HOME` and `USERPROFILE` at scratch, as QA 142 did. Commit the
report from a separate worktree.

## The candidate

- **`d781b59`** on `origin/loop/t003-r2`. The handoff is at `508fa08`, and everything after `d781b59` is `docs/loops/`
  only.
- Stacked on T-003 round 1 `706c029`, which QA 142 passed on its aim, which is on T-179 round 2 `1646567` (ACCEPTED
  by QA 134). **Score only what round 2 adds.**
- Built by **Grok 4.7 in Cursor**, record 152.
- **CI on tcm:** red `36287132237` (`573ac65`: 11 failed); green `36287331316`. Mutants, each killing its row:
  - d1 `36287373437`;
  - d2 `36287383074`;
  - d3 `36287393691`;
  - d4 `36287405024`;
  - d5 `36287418795`;
  - r2d1 `36287470332`;
  - r2d5 `36287503550`.

## Score against `docs/loops/t179-t003-rulings-qa134-qa142.md`, section "T-003 round 2"

1. **D1:** `ob_start` with no proof prints `Session ID: none — <reason>`, never discovers, and never reuses another
   session's log. Use QA 142's P7/P7b shared-checkout shape.
2. **D3:** `ob_end` as `end.md` calls it (no `session_id`) uses the proven id. A rating that `ob_recalled` lists
   reaches `feedback_log`. Use QA 142's S4 shape.
3. **R2-D1 in the WRITER:** QA 134's P2, P3 and P4 are each refused by `applyStateOps`.
   - **One departure from the ruling:** the ruling said the registration-time check "stays as the early refusal".
     The developer reports it "was already gone on T-003 and was not restored", so the writer is the only door.
   - Verify both halves: that it was gone at `706c029`, and that the writer alone refuses every shape the old
     registration check refused. Report whether anything was lost, and the planner rules on it.
4. **`end.md`, all three copies**, says exactly what the code guarantees: a null checkout is not refused, and a write
   with no session records nothing. Compare the copies byte for byte.
5. **The ride-alongs:**
   - D2: a JSON `null` proof is a named refusal, and `ob_recall` no longer reports "FTS search error";
   - D4: `ob_feedback` with no proof prints NOT LOGGED;
   - D5: `--ide cursor` with an inherited `CLAUDE_PID` and no `cursor_version` writes no Claude proof;
   - R2-D5: the legacy-session removal is flagged.
6. **Regressions:** QA 142's A7, A8 and A9 checks and every attack in its check 2, re-run byte-exact from
   `docs/loops/qa-scripts-t003/` on `origin/qa/t003-report`. QA 134's D1 checks on the merged tree.
7. **Your own mutants,** at least one per required fix (D1, D3, R2-D1).

## CI and authority

tcm, at most 6 runs. **No laptop (`windows=true`) CI.** **Push only `qa/t003-r2-*`, through
`node docs/loops/qa-154/push-qa.mjs`.**

## The report

- **Path:** `docs/loops/t003-r2-qa-report.md`.
- Order: the verdict first, then each item, mutants, CI, what could not be verified, defects, disagreements, error
  entries, and "Open for the planner".
- Commit to `qa/t003-r2-report`. **The LAST line is exactly `QA-154: REPORT COMPLETE`.** No `/end`.
