# T-275: ob_state reopens a closed gap (`reopen_gap`), as it already reopens a task or a verified claim

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t275-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-275 (P2). **Tag:** `T-275`. **Size:** SMALL.
**Base:** `2534856ee0392a22848698477f62774bdbf19a82` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: applyOne applyStateOps OpSchema (open-brain/src/shared/state-writer.ts; callers: ob_state in server.ts and the CLI state commands; covered by tests/shared/state-writer.test.ts, tests/server.test.ts)
```

## Why

T-275 (read its note): when G-001 recurred in agent-dashboard, its planner had to record the recurrence as a NEW gap,
G-002, because a closed gap cannot be reopened. `update_gap` has no `status` field and there is no `reopen_gap`, while
`reopen_task` and `reopen_verified` both exist. A recurrence filed under a new id splits one problem's history across
two ids, and the closed id stays cited in tracked files (V-071, T-158).

## Ruling (exact; paths under `open-brain/`)

1. **`src/shared/state-writer.ts`:**
   a. `OpSchema` gains, right after `close_gap`:
      `z.strictObject({ op: z.literal("reopen_gap"), id: z.string(), evidence: z.string().min(1) }),`
   b. `applyOne` gains `case "reopen_gap"`, right after `case "close_gap"`, with a one-line comment
      `// T-275: a recurrence reopens the same gap instead of filing a new id (as reopen_task does for a task).`
      - The gap is not found: refuse `unknown gap <id>`.
      - `g.status !== "closed"`: refuse `gap <id> is not closed; nothing to reopen`.
      - Otherwise push the note `reopen_gap <id>: status open (was closed session <closed_session>, rev <closed_rev>)`
        BEFORE clearing, then set `g.status = "open"`, `g.closed_session = null`, `g.closed_rev = null`, and
        `g.evidence = \`${g.evidence}${NOTE_JOIN}s${session} reopened: ${op.evidence}\``. Return `{ ok: true, id: g.id }`.
2. **`src/server.ts`:** in the `ob_state` description (the line beginning `"Write .agents/state.json through typed
   operations (`), the op list gains `reopen_gap` right after `close_gap`. Nothing else in server.ts changes. Its lines
   pinned by R-002, R-004 and R-011 stay byte for byte (the description line is not pinned: planner-checked by hash).
3. **`tests/shared/state-writer.test.ts`**, four new rows beside TG-1, each with TG-1's setup (`git init` and an empty
   commit in `root` first):
   - **RG1:** `close_gap` G-001, then `reopen_gap` G-001 with evidence `recurred`. It is applied as
     `{ op: "reopen_gap", id: "G-001" }`; the gap matches `{ status: "open", closed_session: null, closed_rev: null }`;
     its evidence ends with `` ` — s${SESSION} reopened: recurred` ``; a note contains `reopen_gap G-001` and the old
     closed session and rev; `SUMMARY.md` lists `Gap G-001:` again.
   - **RG2:** `reopen_gap` on an open gap (G-002) is refused with `/gap G-002 is not closed/`; `G-404` with
     `/unknown gap G-404/`; an empty evidence with `/^ops\[0\] invalid at evidence: /`.
   - **RG3:** after RG1's reopen, `close_gap` G-001 succeeds again and stamps the new session and revision.
   - **RG4:** read `src/server.ts` as text; the line containing `Write .agents/state.json through typed operations`
     contains `reopen_gap`.
4. **Out of scope:** T-271 (listing every invalid field), any change to `update_gap`, `close_gap` or the views.

## Existing tests (planner-read at 2534856e; verdicts)

- `tests/shared/state-writer.test.ts`: TG-1 (`close_gap` keeps a tombstone; a second close is refused
  `/already closed/`), the `reopen_task` row (R1), the `reopen_verified` row (V2) and the T-171 retired-field rows:
  **stay green.**
- `tests/server.test.ts`: **stays green** (only the description text changes).
- `.agents/retirements.json` pins lines in both src files (R-002, R-004 and R-011 in server.ts; R-007 in
  state-writer.ts). None of those lines changes, so `tests/pipelines/sync/retirements-live.test.ts` **stays green**.
  Run it: it is the row that local runs missed for T-022 and T-243.
- Any other newly failing row: STOP, `BLOCKED T-275 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t275-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.** Work in the fresh clone the launcher named. If it named none, run
   `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t275-wt")` and
   `Set-Location` into it. Then `git checkout -q -b feat/t275-reopen-gap 2534856ee0392a22848698477f62774bdbf19a82`.
   `git rev-parse HEAD` must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED. Run
   `npm ci` in `open-brain`. **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other
   checkout, `npm run test:heavy`, and writing any `.agents/state.json` outside a test's temp directory.
3. **Base run** (in `open-brain`):
   `npx vitest run tests/shared/state-writer.test.ts tests/server.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row.
4. **Commit 1, `T-275: tests (red)`:** ruling 3's rows. Run the state-writer file: RG1, RG3 and RG4 red. In RG2, the
   unknown-op refusal may already match one assertion and not another: paste which. Paste the run.
5. **Commit 2, `T-275: ob_state reopens a closed gap (reopen_gap)`:** rulings 1 and 2.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline 2534856e..HEAD` shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), then step 3's command again. Paste both.
8. **Mutants** (edit, run the state-writer file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - M1 `g.closed_rev = null` dropped → RG1. M2 the not-closed refusal dropped → RG2.
   - M3 the evidence append dropped → RG1. M4 `.min(1)` dropped from the op's evidence → RG2.
   - M5 `reopen_gap` dropped from the server.ts description → RG4.
9. `git diff --name-only 2534856e..HEAD` must show only `open-brain/src/shared/state-writer.ts`,
   `open-brain/src/server.ts` and `open-brain/tests/shared/state-writer.test.ts`. Anything else: STOP, BLOCKED.
10. `git push origin feat/t275-reopen-gap` (never force). `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head feat/t275-reopen-gap --title "T-275: ob_state reopens a closed gap (reopen_gap)" --body "Brief: docs/loops/t275-reopen-gap-brief.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-275 <sha40> PR #<n>` or `BLOCKED T-275 <reason>`. Then each command with its output: base
run, red run, tsc, the second run, the mutants, the name-only diff, `ls-remote` = `rev-parse`, the PR URL and CI.
**Paste test output with `grep -a`, or without grep.** At most 2 attempts at a red. Mark anything not run `NOT RUN`. If
the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
