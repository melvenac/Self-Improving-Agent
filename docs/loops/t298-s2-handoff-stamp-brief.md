# T-298 step 2: set_handoff stamps written_rev, and metrics alarms match only real alarm lines

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t298s2-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-16, session 173. **Tasks:** T-298 (P1) item (1) write side, T-299 (P1) review finding.
**Tag:** `T-298-S2`. **Size:** SMALL. **Base:** the dispatch SHA clark names (a master that contains this brief).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: applyOne buildGreetingMetricsRow (state-writer.ts's set_handoff case gains one field; greeting-metrics.ts's ALARM_PATTERNS tightens four regexes)
```

## Why

- **Step 1 (#822, merged 795b3e60) shipped the read side.** `HandoffSchema` accepts an optional `written_rev`, and both
  briefing layouts print `state rev N (handoff +L)` when the reader's own handoff carries it. Nothing writes it yet,
  because an older build rejects an unknown key. This step makes `set_handoff` write it.
- **Dispatch precondition (planner + clark).** This merges only after clark confirms that every process which reads a
  record that `set_handoff` will stamp is at or past 795b3e60:
  - the desktop main build;
  - every seat's open-brain MCP process (`/mcp reconnect`);
  - the QA PC and the laptop.
- **Planner review finding on #822.** Four of the ten metrics alarm patterns are not line-anchored. They are tested
  against the whole report, which includes free text (handoffs in the State block, watch-outs and pick-ups in the
  Briefing). So a handoff that quotes `Handoff MISSING:` would count as that alarm firing. This step anchors all four to
  the lines that only the code prints.

## Rulings (exact)

### R1. `open-brain/src/shared/state-writer.ts`, the `set_handoff` case

In the `entry` object, immediately after `first_rev: ctx.firstRev,`, add:

```ts
        // T-298 step 2: the revision THIS write produces, so the greeting can say how far the record moved after the handoff.
        written_rev: ctx.rev,
```

`ctx.rev` is `before + 1` (state-writer.ts, the `OpContext` built in `applyStateOps`). KEY_ORDER already lists
`written_rev` (#822).

### R2. `open-brain/src/pipelines/session-start/greeting-metrics.ts`, `ALARM_PATTERNS`

Replace exactly these four entries. The other six are already anchored with `^…/m` and do not change.

```ts
  stale_process: /^Build \S+ · STALE PROCESS:/m,
  drift_not_fixed: /(?:^|· )Drift detected \(\d+\):[^\n]*\(not fixed\)/m,
  handoff_missing: /(?:^|· )Handoff MISSING: /m,
  latest_brief_undetermined: /^Latest brief: not determined/m,
```

Why each anchor is safe:
- **stale_process:** the serving line is the report's first line and starts with `Build `.
- **drift_not_fixed:** the briefing prints drift on one line. In the legacy layout it is its own line; in the budgeted
  layout it follows `· ` on the session line. The header's multi-line drift block is not needed, because the briefing
  carries the same fact.
- **handoff_missing:** the notice is its own line in the legacy layout, and follows `· ` on the pick-up line in the
  budgeted layout.
- **latest_brief_undetermined:** the line starts with `Latest brief:` in the header, and in both briefing layouts,
  including the shared `Latest brief … · Skills` line.

## Test file

`open-brain/tests/pipelines/session-start/t298-s2-handoff-stamp.test.ts`. Every row is a plain `it()`. Temp dirs are
removed in a `finally`.

- **H1** (stamp): use the state-writer test's fixture approach (a temp project with a valid `state.json` at revision 7;
  copy the setup `tests/shared/state-writer.test.ts` uses).
  - `applyStateOps(root, { session: 1, expected_revision: 7, session_uuid: "u-1", checkout: "c", ops: [{ op: "set_handoff", seat: "qa", pick_up: "p", watch_out: [], open_questions: [] }] })`
    is ok. The `u-1` handoff has `written_rev` 8 and the record `revision` is 8.
  - A second `applyStateOps` at expected_revision 8 with one `open_task` op (any valid task) is ok. The `u-1` handoff
    still has `written_rev` 8, and the record `revision` is 9.
  - `handoffLagNote(thatHandoff, 9)` returns `"handoff +1"`.
- **H2** (re-stamp): after H1's two writes, a third write that is `set_handoff` again for `u-1` (expected_revision 9)
  leaves `written_rev` 10.
- **H3** (alarms ignore free text): `buildGreetingMetricsRow` (import it and its input type from greeting-metrics.ts)
  with serving `Build 1234567`, no state, previous null, and a report whose lines are:
  ```
  Build 1234567
  - watch: Handoff MISSING: quoted in a watch-out
  - a note saying Drift detected (1): x (not fixed)
  - a quote of Build abc1234 · STALE PROCESS: from a handoff
  pick-up text that mentions Latest brief: not determined (x) mid-line
  ```
  `alarm_streaks` has none of `stale_process`, `drift_not_fixed`, `handoff_missing` or `latest_brief_undetermined`.
- **H4** (alarms still catch the real lines): the same call with serving
  `Build a346e5b · STALE PROCESS: disk has 0dcf8f4 (built x) → /mcp reconnect open-brain` and a report whose lines are:
  ```
  Build a346e5b · STALE PROCESS: disk has 0dcf8f4 (built x) → /mcp reconnect open-brain
  Session 1 — 2026-10-16 · p v1 · state rev 5 · Drift detected (1): x: expected a, got b (not fixed)
  pick-up text · Handoff MISSING: last planner session #3 (u, rev 4) wrote the record, left no handoff; fix: ob_state set_handoff
  Latest brief: not determined (git: boom)
  ```
  `alarm_streaks` deep-equals
  `{ stale_process: 1, drift_not_fixed: 1, handoff_missing: 1, latest_brief_undetermined: 1 }`.
- **H5** (legacy drift line): a report line `Drift detected (2): a: expected 1, got 2 (not fixed); b: expected 3, got 4 (fixed)`
  at the start of a line sets `drift_not_fixed: 1`.

**Expected at commit 1 (the base):** H1, H2 and H3 RED. H4 and H5 GREEN, because the unanchored patterns match those too.

## Existing tests (verdicts)

QA PC SIM, clark 10-16: R1 alone on 795b3e60 gave `1 failed | 1481 passed` across tests/shared, session-start, sync and
server.test.ts.
- **`tests/shared/state-writer.test.ts:504`** ("set_handoff writes THIS session's entry, stamped with its uuid, checkout and
  first-write revision, …") turns RED. In commit 2, its expected object at line 510 gains `written_rev: 8` after
  `first_rev: 8`. Rename the row to `"… stamped with its uuid, checkout, first-write revision and written_rev, …"`.
  **This is the ONLY existing row that changes.**
- `tests/pipelines/session-start/t298-greeting-truth.test.ts` G8 stays green: its serving line is the report's first line
  and starts with `Build `.

Any other red row: STOP, `BLOCKED T-298-S2 <test name>`.

## Steps

1. PowerShell:
   `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t298s2-reply.md")); "REPLY_PATH=$reply"`, then
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`; otherwise STOP).
2. Fresh clone into `(Join-Path $env:TEMP "t298s2-wt")` unless the launcher named one.
   - `git checkout -q -b fix/t298-s2-handoff-stamp <base>`.
   - Check that HEAD equals the base, that `git status --porcelain` is empty, and that
     `git ls-tree --name-only HEAD docs/loops/t298-s2-handoff-stamp-brief.md` prints the path.
   - `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. On "Could not locate the bindings file", run
     `npm rebuild better-sqlite3` and say so.
   - Forbidden, as in the step-1 brief:
     - `git stash`, `reset --hard`, `--force`, rebase and amend;
     - any other checkout;
     - `npm run test:heavy`;
     - killing processes by name;
     - any read or write of the real `~/.claude/open-brain/`;
     - any edit of a real `settings.json` or of `.agents/SYSTEM/greeting.json`.
   - Edit only with the Edit tool or `sed -i` from Git Bash.
3. **Commit 1, `T-298-S2: rows for the written_rev stamp and anchored metrics alarms`:** the test file only.
   - `$env:NO_COLOR='1'`; in `open-brain`, run
     `npx vitest run tests/pipelines/session-start/t298-s2-handoff-stamp.test.ts --no-file-parallelism --testTimeout=180000`.
   - Exactly H1, H2 and H3 are red. Paste the summary and the `x` rows.
4. **Commit 2, `T-298-S2: set_handoff stamps written_rev; metrics alarms match only alarm lines`:** R1, R2, and the one
   existing-test edit.
   - Run `npx vitest run tests/shared tests/pipelines/session-start tests/pipelines/sync tests/server.test.ts --no-file-parallelism --testTimeout=180000`
     (25-minute cap). All green. Paste the `Test Files` and `Tests` lines.
   - `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), and `npm run build` (exit 0).
5. Both commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   `git log --oneline <base>..HEAD` shows 2 lines; status is empty.
6. **Mutants** (sed or Edit; run the new test file; paste the summary, the `x` rows and the diff line; restore with
   `git checkout -- <file>`; status empty; never commit):
   - **M1** state-writer.ts: delete the `written_rev: ctx.rev,` line. Expect **H1 and H2** red.
   - **M2** state-writer.ts: `written_rev: ctx.rev,` becomes `written_rev: ctx.firstRev,`. Expect **H2** red. H1 stays
     green, because the first write's firstRev is 8 too; say so if it differs.
   - **M3** greeting-metrics.ts: `handoff_missing: /(?:^|· )Handoff MISSING: /m,` becomes `handoff_missing: /Handoff MISSING:/,`.
     Expect **H3** red.
   - **M4** greeting-metrics.ts: in `drift_not_fixed`, delete `(?:^|· )`. Expect **H3** red.
7. `git diff --name-only <base>..HEAD` shows exactly:
   - `open-brain/src/pipelines/session-start/greeting-metrics.ts`
   - `open-brain/src/shared/state-writer.ts`
   - `open-brain/tests/pipelines/session-start/t298-s2-handoff-stamp.test.ts`
   - `open-brain/tests/shared/state-writer.test.ts`
8. Push (never force). Check that `git ls-remote origin refs/heads/fix/t298-s2-handoff-stamp` equals HEAD. Then:
   - `gh pr create --base master --head fix/t298-s2-handoff-stamp --title "T-298-S2: set_handoff stamps written_rev; metrics alarms anchored" --body "Brief: docs/loops/t298-s2-handoff-stamp-brief.md. Merge only after clark confirms every serving build and MCP process is at or past 795b3e60."`
   - `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T-298-S2 <sha40> PR #<n>`, or `BLOCKED T-298-S2 <reason>`.
- At most 2 attempts at any step. A STOP still writes the reply. Every number is pasted output with its command shown
  above it. Mark anything not run `NOT RUN`. Do not merge.
