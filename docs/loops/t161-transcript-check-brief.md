# T-161: /start says out loud when the session's own transcript does not exist

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t161-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-161 (P1). **Tag:** `T-161`. **Size:** SMALL-MEDIUM.
**Base:** `a5d7dd300131b83e9137cdd87812a5aa08792fb3` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: proveSession renderStartReport renderBriefing (open-brain/src/shared/process-session.ts, open-brain/src/pipelines/session-start/start-report.ts, open-brain/src/pipelines/session-start/briefing.ts; proveSession's caller is writeSessionId in server.ts, under every attributed write; covered by tests/t003-session-proof.test.ts, tests/qa142-t003.test.ts, tests/t154-cli-start.test.ts and the session-start briefing tests)
```

## Why

T-161 (read its note). On 2026-09-20 one launch lost all three Loop 16 seats' transcripts: Claude Code wrote no
`.jsonl` for them, and nothing said so until a later audit. The recorded cause (CLAUDE_CODE_CHILD_SESSION=1) was
falsified in session 77, because five healthy sessions carry the same marker. So a check on the marker would be a
permanent false positive. The discriminating symptom is the file itself: does a transcript exist for THIS session's
own id? The SessionStart hook already stores the payload's `transcript_path` in the session proof
(`cli-bootstrap.ts:155,173`, `ProcessSessionProof.transcript_path`), and `ob_end` already reads it
(`server.ts:363`). `ob_start` does not look. A missing transcript means `/end`'s transcript checks, the handoff guard
and the recall census cannot see the session, so it is worth one loud line, and silence when all is well.

## Ruling (exact; paths under `open-brain/`)

1. **`src/shared/process-session.ts`, `proveSession`:** the success variant of `ProvenSession` becomes
   `{ id: string; pid: number; transcriptPath?: string }`. Both success returns add `transcriptPath` ONLY when the
   proof's `transcript_path` is a non-empty string (a conditional spread, so a proof without one returns exactly
   `{ id, pid }` as today). No other change in this file.
2. **`src/pipelines/session-start/transcript-check.ts`** (new; imports only `node:fs` and the `ProvenSession` type):
   `export function describeTranscript(proven: ProvenSession, exists: (p: string) => boolean = existsSync): string | null`.
   - `proven.id === null`: `null` (the `Session ID:` line already says why).
   - No `transcriptPath`: `null`. Some hosts send none, so it is not checked; say that in a comment.
   - The file exists: `null`. Silence when all is well.
   - The file is missing:
     `NO TRANSCRIPT: session <id> has no transcript at <transcriptPath>, so /end's transcript checks, the handoff guard and the recall census cannot see it (T-161). Relaunching is the first thing to try; the cause is unknown.`
3. **`src/pipelines/session-start/start-report.ts`, `renderStartReport`:** compute
   `const transcript = describeTranscript(proven)` once. When it is non-null, push it right after the `Session ID:`
   line, in both the log-created and the log-skipped branches. Pass it to `renderBriefing` as `transcript`.
4. **`src/pipelines/session-start/briefing.ts`:** `BriefingInput` gains `transcript?: string | null`, with a doc
   comment in the style of `oldStartCommand`'s. Null or absent prints nothing, so every other render is byte-identical.
   In BOTH `renderBriefing` and `renderBudgeted`, push it right after `i.serving` and `i.oldStartCommand`
   (`if (i.transcript) out.push(i.transcript);`), as its own line.
5. **Out of scope:** the CLI `start` (it has no proven session, so nothing is checked); any check at SessionStart
   itself (the file may not exist yet when that hook runs); the cause of the 2026-09-20 loss.

## Existing tests (planner-read at a5d7dd30; verdicts)

- **Red by design, update in commit 1:** `tests/t003-session-proof.test.ts:342`, "SessionStart writes
  by-pid/<CLAUDE_PID>.json…". Its proof carries `transcript_path: "C:/t/x.jsonl"`, so the new expected value is
  `{ id: SELF, pid: CLAUDE, transcriptPath: "C:/t/x.jsonl" }`.
- **Stay green:** `tests/t003-session-proof.test.ts:275-285` (the refusals, and `{ id: SELF, pid: 4242 }` from a proof
  with no transcript_path); `tests/qa142-t003.test.ts` (asserts `.id` and the reason only); `tests/t154-cli-start.test.ts`
  (`proven: { id: null }`); every session-start briefing test, including `a2a-byte-identical.test.ts`,
  `briefing-budget.test.ts`, `briefing.test.ts`, `missing-handoff.test.ts` and `t252-briefing-followups.test.ts`
  (none sets `transcript`).
- No file this brief touches is pinned in `.agents/retirements.json`; run `retirements-live.test.ts` anyway.
- Any other newly failing row: STOP, `BLOCKED T-161 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t161-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.** Work in the fresh clone the launcher named. If it named none, run
   `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t161-wt")` and
   `Set-Location` into it. Then
   `git checkout -q -b feat/t161-transcript-check a5d7dd300131b83e9137cdd87812a5aa08792fb3`. `git rev-parse HEAD`
   must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED.
   Run `npm ci` in `open-brain`. Every test run uses a temp HOME and USERPROFILE. **Forbidden:** `git stash`,
   `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout, `npm run test:heavy`, and reading or
   writing any real session proof under `~/.claude/`.
3. **Base run** (in `open-brain`):
   `npx vitest run tests/t003-session-proof.test.ts tests/qa142-t003.test.ts tests/t154-cli-start.test.ts tests/pipelines/session-start tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row.
4. **Commit 1, `T-161: tests (red)`:** a new file `open-brain/tests/pipelines/session-start/t161-transcript.test.ts`
   (namespace imports), plus the `:342` update:
   - **P1 (proveSession):** a proof with `transcript_path` gives `{ id, pid, transcriptPath }`; without one,
     exactly `{ id, pid }` (`toStrictEqual`); with `""`, no `transcriptPath` key.
   - **P2 (describeTranscript, `exists` injected):** an id-null proven, a proven with no path, and one whose file
     exists each give `null`. A missing file gives the ruled line, containing the id and the path.
   - **P3 (renderBriefing):** with `transcript` set, the line comes right after the serving line in BOTH layouts
     (`budget: true` and not), and right after `oldStartCommand` when that is set too. With it absent, the output is
     identical to a render of the same input without the field.
   - **P4 (renderStartReport):** a temp project (as `t154-cli-start.test.ts` builds one) with
     `proven: { id, pid, transcriptPath: <a missing file in a temp dir> }` puts `NO TRANSCRIPT:` both in the header and
     inside the Briefing block. With `transcriptPath` pointing at an existing temp file, `NO TRANSCRIPT` appears nowhere.
   Run the new file and `t003-session-proof.test.ts`: P1-P4 and `:342` red. Paste it.
5. **Commit 2, `T-161: /start names a missing transcript for the session's own id`:** rulings 1-4.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline a5d7dd30..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0); the t161 file; then step 3's command again. Paste all three.
8. **Mutants** (edit, run the t161 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - M1 `proveSession` never copies `transcript_path` → P1 (and P4).
   - M2 an empty `transcript_path` copied → P1.
   - M3 `describeTranscript` returns `null` for a missing file → P2.
   - M4 `renderStartReport` does not pass `transcript` to `renderBriefing` → P4.
   - M5 the line pushed in `renderBriefing` only, not in `renderBudgeted` → P3.
9. `git diff --name-only a5d7dd30..HEAD` must show only `open-brain/src/shared/process-session.ts`,
   `open-brain/src/pipelines/session-start/transcript-check.ts`, `open-brain/src/pipelines/session-start/start-report.ts`,
   `open-brain/src/pipelines/session-start/briefing.ts`, `open-brain/tests/pipelines/session-start/t161-transcript.test.ts`
   and `open-brain/tests/t003-session-proof.test.ts`. Anything else: STOP, BLOCKED.
10. `git push origin feat/t161-transcript-check` (never force). `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head feat/t161-transcript-check --title "T-161: /start names a missing transcript for the session's own id" --body "Brief: docs/loops/t161-transcript-check-brief.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-161 <sha40> PR #<n>` or `BLOCKED T-161 <reason>`. Then each command with its output: base
run, red run, tsc, the t161 run, the second run, the mutants, the name-only diff, `ls-remote` =
`rev-parse`, the PR URL and CI. **Paste test output with `grep -a`, or without grep.** At most 2 attempts at a red.
Mark anything not run `NOT RUN`. If the code differs from a line this brief quotes, follow the ruling's intent and say
what differed. Do not merge.
