# T-276: a session without Remote Control is attributed by its own uuid, and is told to write that trailer

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop (Aaron, 2026-10-13: the desktop's CPU is at 100%, so no npm, vitest,
tsc or build runs there). No hub key. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t276-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-276 (P2). **Tag:** `T-276`. **Size:** MEDIUM.
**Base:** `7d9215b250513ccd7bc4c06728d436834c5664b2` (origin/master: #688 merged, after #678, #673 and #685). If clark re-pins it at
launch, that SHA wins. Below, `<BASE>` means this 40-char SHA.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: handleEnd renderStartReport sessionIdsFromTranscript (server.ts handleEnd: one preamble line; start-report.ts renderStartReport: two session-block lines; sessionIdsFromTranscript itself is UNCHANGED, but its two callers in cli-session-end.ts move to the new sessionTrailerIds. cli-session-end.ts's checks are module-level code with no symbol. New: sessionTrailerIds, structuralTrailerNote, TrailerIds, TrailerIdSource in shared/handoff-guard.ts; describeCommitTrailer in session-start/transcript-check.ts)
```

## Why

T-276 (read its note). A commit is attributed to a session only by its `Claude-Session:` trailer (T-212), and the
guards learn which ids that trailer may carry from the session's transcript: `sessionIdsFromTranscript`
(`shared/handoff-guard.ts`) reads the `cse_<X>` of the `bridge-session` records in the first 256 KB. Claude Code writes
those records, and adds `Claude-Session: https://claude.ai/code/session_<X>` to commit messages, **only for a Remote
Control session**. A seat without Remote Control (Prism, every headless one-off) has no bridge id and gets no trailer,
so its commits count as UNATTRIBUTED and the SessionEnd checks say they could not run. `server.ts endSessionWindow`
already falls back to the session's own uuid when there is no bridge id; `cli-session-end.ts` does not, in either
check. And nothing tells such a seat what to write, so the fallback alone would still match nothing.

Planner measurements, first-hand, on real transcripts (positions and counts only):
- **Remote Control from the start (5 of 5):** the first `bridge-session` record is at line 3 or 4, before the first
  user line, so at `/start` a Remote Control session's head already holds its bridge id.
- **No Remote Control (Prism's session 1 and two headless one-offs):** 0 bridge records, and record 0 carries
  `"sessionId"` equal to the transcript's own uuid (10 of 10 transcripts checked, both kinds).
- **Remote Control switched on mid-session (1 home-directory session):** the first bridge record is at line 369,
  byte ~838,000, past the 256 KB head. `sessionIdsFromTranscript` returns `[]` for it today.
- **git:** `--format=%(trailers:key=Claude-Session,valueonly,separator=%x20)` reads a bare-uuid trailer
  (`Claude-Session: <uuid>`), the URL form, and both together (space-joined), so `scanSessionWork`'s
  `trailer.includes(id)` matches a uuid id with no change.
- A prototype of the helper below gave: Remote Control sessions → `bridge` (3-7 ms, head only); no Remote Control →
  `session` (20-132 ms, whole file of 0.5-6 MB); the mid-session case → `bridge` with both ids (107 ms); a uuid the
  transcript does not name → never `session`.

## Ruling (exact)

Line numbers are from a merged view of the four train PRs on 88b2c8d4; follow the quoted text if they shifted.

### R1. `open-brain/src/shared/handoff-guard.ts`: the helper and the note (after `sessionIdsFromTranscript`, ~:122)

`sessionIdsFromTranscript` is **unchanged**. Add, below it:

```ts
/** T-276: where a session's trailer ids came from. */
export type TrailerIdSource = "bridge" | "session" | "none";

export interface TrailerIds {
  ids: string[];
  source: TrailerIdSource;
}

const TRANSCRIPT_HEAD_BYTES = 256 * 1024;
const BRIDGE_ID_RE = /"bridgeSessionId"\s*:\s*"cse_([A-Za-z0-9]+)"/g;
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function readTranscriptHead(path: string): string | null {
  try {
    const fd = openSync(path, "r");
    try {
      const buf = Buffer.alloc(TRANSCRIPT_HEAD_BYTES);
      const n = readSync(fd, buf, 0, buf.length, 0);
      return buf.subarray(0, n).toString("utf8");
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

/**
 * T-276: the ids this session's `Claude-Session:` trailer can carry. A Remote Control session's trailer is
 * `https://claude.ai/code/session_<X>`, read as its bridge ids. A session without Remote Control gets no trailer from
 * Claude Code, so ob_start tells it to end each commit with `Claude-Session: <uuid>`, and its own uuid counts when a
 * record in its transcript names it. The head is read first; the whole file only when the head holds no bridge id,
 * because Remote Control can be switched on mid-session (one measured transcript's first bridge record sat past byte
 * 830,000).
 */
export function sessionTrailerIds(path: unknown, sessionUuid: string): TrailerIds {
  if (typeof path !== "string" || !path || !existsSync(path)) return { ids: [], source: "none" };
  const head = readTranscriptHead(path);
  if (head === null) return { ids: [], source: "none" };
  const bridgeIds = (text: string): string[] => [...new Set([...text.matchAll(BRIDGE_ID_RE)].map((m) => m[1]!))];
  let text = head;
  let bridge = bridgeIds(head);
  if (bridge.length === 0) {
    try {
      text = readFileSync(path, "utf8");
    } catch {
      return { ids: [], source: "none" };
    }
    bridge = bridgeIds(text);
  }
  const namesSelf = sessionUuid !== "" && new RegExp(`"sessionId"\\s*:\\s*"${escapeRegExp(sessionUuid)}"`).test(text);
  if (bridge.length > 0) return { ids: namesSelf ? [...bridge, sessionUuid] : bridge, source: "bridge" };
  return namesSelf ? { ids: [sessionUuid], source: "session" } : { ids: [], source: "none" };
}

/** T-276: appended to an UNATTRIBUTED count when the session's trailer ids are its own uuid only (no Remote Control). */
export function structuralTrailerNote(sessionUuid: string): string {
  return `; this session has no Remote Control id, so Claude Code adds no trailer to its commits: end each one with the line Claude-Session: ${sessionUuid}`;
}
```

The file already imports `existsSync, openSync, readSync, closeSync, readFileSync` from `node:fs`. Add none it lacks.

### R2. `open-brain/src/cli-session-end.ts`: both checks use the helper

- **Import (~:28):** add `sessionTrailerIds, structuralTrailerNote`, and REMOVE `sessionIdsFromTranscript`, which has
  no caller left in this file.
- **T179-2 handoff check (~:115-137):** before `const check = checkSessionHandoff(`, add
  `const trailer = sessionTrailerIds(hookPayload.transcript_path, id);`, and pass `trailer.ids` as the third argument
  in place of `sessionIdsFromTranscript(hookPayload.transcript_path)`. The `unPart` string becomes
  `` `; ${check.unattributed} commit(s) in the window carry no Claude-Session trailer: UNATTRIBUTED, not counted for any seat${trailer.source === "session" ? structuralTrailerNote(id) : ""}` ``.
- **E4 work-after-end (~:150):** `const transcriptIds = sessionIdsFromTranscript(hookPayload.transcript_path);`
  becomes `const trailer = sessionTrailerIds(hookPayload.transcript_path, id);` then
  `const transcriptIds = trailer.ids;`. Between the `else if (work.commits > 0) { … and record updated … }` branch
  and the final `else` (`work-after-end check: no commits after ob_end`), add:
  ```ts
  } else if (work.unattributed > 0) {
    console.log(`[session-end] work-after-end check: no attributed commits after ob_end; ${work.unattributed} commit(s) after ob_end carry no Claude-Session trailer (UNATTRIBUTED)${trailer.source === "session" ? structuralTrailerNote(id) : ""}`);
  ```
  Without it, the fallback would print "no commits after ob_end" for a seat whose after-end commit has no trailer,
  which is the false negative `end-fix-r3-pins.test.ts` R2 exists to prevent.

### R3. `open-brain/src/server.ts`: `endSessionWindow` UNCHANGED; `handleEnd`'s UNATTRIBUTED line names the cause

`endSessionWindow` (~:363-369) stays exactly as it is. Its fallback
`if (sessionIds.length === 0 && sessionId) sessionIds = [sessionId];` is already right, and this brief does not
touch it. In `handleEnd` (~:421-425), the block becomes:

```ts
if (evaluation.work.unattributed > 0) {
  // T-276: endSessionWindow fell back to the session's own uuid, so its transcript carried no Remote Control id.
  const noRemoteControl = sessionIds.length === 1 && sessionIds[0] === endedId;
  preamble.push(
    `${evaluation.work.unattributed} commit(s) in the window carry no Claude-Session trailer (UNATTRIBUTED, not counted)${noRemoteControl ? structuralTrailerNote(endedId) : ""}`,
  );
}
```

Add `structuralTrailerNote` to the existing `./shared/handoff-guard.js` import (~:40). `describeRecordNotUpdated` and
`describeWorkAfterEnd` (`shared/end-record-guard.ts`) are **unchanged**.

### R4. The writing side: one ob_start line, outside the Briefing

- **`open-brain/src/pipelines/session-start/transcript-check.ts`:** add
  `import { sessionTrailerIds, type TrailerIds } from "../../shared/handoff-guard.js";`, and below
  `describeTranscript`:
  ```ts
  /**
   * T-276: a proven session whose transcript names it but carries no Remote Control id gets no Claude-Session trailer
   * from Claude Code, so /end cannot attribute its commits. One line saying what to write; null otherwise (unproven, no
   * transcript path, a Remote Control session, or a transcript that does not name the session).
   */
  export function describeCommitTrailer(
    proven: ProvenSession,
    trailerIds: (path: unknown, sessionUuid: string) => TrailerIds = sessionTrailerIds,
  ): string | null {
    if (proven.id === null || !proven.transcriptPath) return null;
    if (trailerIds(proven.transcriptPath, proven.id).source !== "session") return null;
    return `COMMIT TRAILER: this session has no Remote Control id, so Claude Code adds no Claude-Session trailer to its commits and /end cannot attribute them. End every commit message in this session with the line: Claude-Session: ${proven.id} (T-276).`;
  }
  ```
- **`open-brain/src/pipelines/session-start/start-report.ts`:** import `describeCommitTrailer` beside
  `describeTranscript` (~:17). Below `const transcript = describeTranscript(proven);` (~:109), add
  `const commitTrailer = describeCommitTrailer(proven);`. In BOTH session-block branches, right after
  `if (transcript) lines.push(transcript);` (~:168 and ~:172), add `if (commitTrailer) lines.push(commitTrailer);`.
  **Do not** pass it to `renderBriefing`: the Briefing stays byte-identical. The line is for the agent reading
  ob_start's output, not the human, and the budgeted layout has no spare line (T-281).

Scope: exactly these five src files plus one new test file. `shared/end-record-guard.ts`, `briefing.ts`,
`process-session.ts` and `sessionIdsFromTranscript` do not change.

## Existing tests (planner-read in the merged view; verdicts)

- `open-brain/tests/shared/handoff-guard.test.ts`: every row **stays green**. `sessionIdsFromTranscript` is
  unchanged. The hook row (~:242) uses a bridge transcript. "UNKNOWN … when the transcript carries no session id"
  calls `checkSessionHandoff` with `[]` directly.
- `open-brain/tests/end-fix-r3-pins.test.ts`: **R2 stays green.** Its transcript is only `{"timestamp":…}`, which
  names no session, so `sessionTrailerIds` returns `none` and E4 still prints NOT RUN. R5, R7 and the
  unreadable-state row **stay green**.
- `open-brain/tests/end-fix-r4-pins.test.ts` (S1a-S1d, S2), `end-fix-q6.test.ts`, `end-fix-q8.test.ts`,
  `end-fix-q10.test.ts`, `end-fix-q12.test.ts`, `end-fix-r2-pins.test.ts`: **stay green**. Their transcripts come
  from `end-fix.harness.ts writeTranscript` (a bridge record, no `sessionId`), so the ids stay `[ME]` and no note is
  added. Q8 matches `/UNATTRIBUTED/` only.
- `open-brain/tests/pipelines/session-start/t161-transcript.test.ts`: **stays green.** P4's "existing transcript" row
  writes `{}` (names no session, so no COMMIT TRAILER line) and asserts only that NO TRANSCRIPT is absent.
- `open-brain/tests/t003-session-proof.test.ts`, `open-brain/tests/t262-part2.test.ts` (its records carry no
  `sessionId`): **stay green**.
- `open-brain/tests/pipelines/sync/module-boundary.test.ts`: **stays green** (`transcript-check.ts` →
  `shared/handoff-guard.ts` is core → core).
- `open-brain/tests/pipelines/sync/retirements-live.test.ts`: **stays green**. `server.ts` and `cli-session-end.ts`
  have line-hash pins in `.agents/retirements.json`, and no pinned line is edited. Run it anyway.
- Any other newly failing row: STOP, `BLOCKED T-276 <row>`.

## New test file: `open-brain/tests/t276-session-trailer.test.ts`

Use **namespace imports** for the changed modules (`import * as hg from "../src/shared/handoff-guard.js"`,
`import * as tc from "../src/pipelines/session-start/transcript-check.js"`, `import * as sr from
"../src/pipelines/session-start/start-report.js"`), so a missing export fails its rows, not the file. Reuse
`./end-fix.harness.js` (`ME`, `ME_TRAILER`, `SESSION_UUID` as `U`, `START`, `DURING`, `commitAt`, `initOldLayoutRepo`,
`initScratchDb`, `proveSessionWithTranscript`, `cleanupProof`, `touchNextSession`, `writeTranscript`, `text`,
`git`), with the beforeEach/afterEach of `end-fix-r3-pins.test.ts`. Spawn the hook exactly as that file does
(`process.execPath`, tsx's `cli.mjs`, `src/cli-session-end.ts`, `CLAUDE_PROJECT_DIR`). For C2, copy T-161's
`vi.mock` of `hub-presence.js` and its P4 `fixture()` and `split()` helpers. `OTHER_UUID = "00000276-0000-4000-8000-000000000002"`.

Transcript writers, in the file:
- `rc(dir)`: `{"timestamp":"${START}","sessionId":"${U}"}` + `\n` + `{"type":"bridge-session","bridgeSessionId":"cse_${ME}"}` + `\n`.
- `nonRc(dir, uuid = U)`: `{"timestamp":"${START}","sessionId":"${uuid}"}` + `\n` + `{"type":"user","sessionId":"${uuid}"}` + `\n`.
- `lateBridge(dir)`: line 1 `{"timestamp":"${START}","sessionId":"${U}","pad":"<"x".repeat(300000)>"}`, line 2 the
  bridge record (so the 256 KB head ends inside line 1).

Rows (expected at commit 1: RED = fails before the src commit; GREEN = passes already):
- **A1 (RED):** `hg.sessionTrailerIds(rc(dir), U)` equals `{ ids: [ME, U], source: "bridge" }`;
  `hg.sessionTrailerIds(writeTranscript(dir), U)` equals `{ ids: [ME], source: "bridge" }`.
- **A2 (RED):** `hg.sessionTrailerIds(nonRc(dir), U)` equals `{ ids: [U], source: "session" }`.
- **A3 (RED):** `{ ids: [], source: "none" }` for each: `nonRc(dir, OTHER_UUID)` with `U`; `nonRc(dir)` with `""`; a
  path that does not exist; `undefined`.
- **A4 (RED):** `hg.sessionTrailerIds(lateBridge(dir), U)` equals `{ ids: [ME, U], source: "bridge" }`, and
  `hg.sessionIdsFromTranscript(<same file>)` equals `[]` (the head-only reader is unchanged).
- **B1 (GREEN):** in `initOldLayoutRepo(dir)`, three commits at `DURING`: trailer `Claude-Session: ${U}`, trailer
  `ME_TRAILER`, and no trailer (`null`). `scanSessionWork(dir, START, [U])` (from `../src/shared/end-record-guard.js`)
  gives `commits` 1, `unattributed` 1. `scanSessionWork(dir, START, [ME, U])` gives `commits` 2, `unattributed` 1.
  Both trailer forms count, with no change to the matcher.
- **C1 (RED):** `tc.describeCommitTrailer`: `{ id: null, reason: "x" }` → null; `{ id: U, pid: 1 }` → null; with
  `transcriptPath: rc(dir)` → null; with `transcriptPath: nonRc(dir)` → exactly
  `COMMIT TRAILER: this session has no Remote Control id, so Claude Code adds no Claude-Session trailer to its commits and /end cannot attribute them. End every commit message in this session with the line: Claude-Session: ${U} (T-276).`;
  with `transcriptPath: nonRc(dir, OTHER_UUID)` → null; with a path that does not exist → null.
- **C2 (RED):** `sr.renderStartReport({ projectRoot: fixture(), proven: { id: U, pid: 4242, transcriptPath: nonRc(tmpDir) }, callerLabel: "T276" })`:
  in the header, the line right after the `Session ID:` line is C1's exact line, and the Briefing block (`split`)
  contains no line starting `COMMIT TRAILER`. With `transcriptPath: rc(tmpDir)`, `r.text` does not contain
  `COMMIT TRAILER`.
- **D1 (RED):** mirror `handoff-guard.test.ts`'s hook row (~:242): `.agents/SESSIONS`, base on master, `loop/x`, one
  commit at `DURING` with trailer `Claude-Session: ${U}`. Transcript `nonRc(dir)`, payload `{ session_id: U, … }`.
  stdout contains `HANDOFF MISSING: session ${U} committed 1 commit(s) on loop/x` and not `handoff check NOT RUN`.
- **D2 (RED):** as D1, but the commit has no trailer. stdout contains
  `[session-end] handoff check: no handoff or record update for this session; 1 commit(s) in the window carry no Claude-Session trailer: UNATTRIBUTED, not counted for any seat; this session has no Remote Control id, so Claude Code adds no trailer to its commits: end each one with the line Claude-Session: ${U}`.
- **D3 (GREEN):** as D2, but the transcript is `rc(dir)`. stdout contains
  `UNATTRIBUTED, not counted for any seat` and does not contain `no Remote Control id`.
- **E1 (RED):** mirror `end-fix-r4-pins.test.ts`'s old-layout flow. `initOldLayoutRepo`, transcript `nonRc(dir)`,
  `proveSessionWithTranscript(dir, tr)`, `touchNextSession(dir, DURING)`,
  `handleEnd({ project_root: resolve(dir), session_id: U, dry_run: false, session_summary: "s" })`, stamp from
  `readObEndStamp`, then one commit at stamp + 2000 ms with trailer `Claude-Session: ${U}`. Then the hook with
  `{ session_id: U, transcript_path: tr }`: stdout contains `WORK AFTER /end NOT RECORDED: 1 commit(s)` and not
  `work-after-end check NOT RUN`.
- **E2 (RED):** as E1, but the after-end commit has no trailer. stdout contains
  `[session-end] work-after-end check: no attributed commits after ob_end; 1 commit(s) after ob_end carry no Claude-Session trailer (UNATTRIBUTED); this session has no Remote Control id, so Claude Code adds no trailer to its commits: end each one with the line Claude-Session: ${U}`
  and not `work-after-end check: no commits after ob_end`.
- **F1 (RED):** `initOldLayoutRepo`, transcript `nonRc(dir)`, prove it, two commits at `DURING` (trailer
  `Claude-Session: ${U}`; no trailer), `touchNextSession(dir, DURING)`, then
  `handleEnd({ project_root: dir, session_id: U, dry_run: true })`. The text contains
  `1 commit(s) in the window carry no Claude-Session trailer (UNATTRIBUTED, not counted); this session has no Remote Control id, so Claude Code adds no trailer to its commits: end each one with the line Claude-Session: ${U}`.
- **F2 (GREEN):** as F1, with transcript `writeTranscript(dir)` and the first commit's trailer `ME_TRAILER`. The text
  contains `(UNATTRIBUTED, not counted)` and does not contain `no Remote Control id`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t276-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.** Work in the fresh clone the launcher named. If it named none, run
   `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t276-wt")` and
   `Set-Location` into it. Then `git checkout -q -b fix/t276-session-trailer <BASE>`. `git rev-parse HEAD` must print
   `<BASE>`, and `git status --porcelain` must be empty. Prerequisites:
   `git merge-base --is-ancestor 5a9443abf19bd73fd9e535342b4b1a78a4e7be38 HEAD` (T-161, #688) and
   `git merge-base --is-ancestor 4474f06212f335f462f36c27b93ffb0104199296 HEAD` (T-159, #678) must each exit 0, and
   `git cat-file -e HEAD:open-brain/src/pipelines/session-start/transcript-check.ts` must exit 0. Any failure: STOP,
   `BLOCKED T-276 base lacks <which>`. Run `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. If
   that prints "Could not locate the bindings file", run `npm rebuild better-sqlite3`, re-check, and say so.
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name, and any edit outside the six files below except a mutant
   (step 7), always reverted.
3. **Baseline at `<BASE>`, before any edit.** In `open-brain`:
   `npx vitest run tests/shared/handoff-guard.test.ts tests/end-fix-r3-pins.test.ts tests/end-fix-r4-pins.test.ts tests/end-fix-q6.test.ts tests/end-fix-q8.test.ts tests/end-fix-q10.test.ts tests/end-fix-q12.test.ts tests/end-fix-r2-pins.test.ts tests/pipelines/session-start/t161-transcript.test.ts tests/t003-session-proof.test.ts tests/t262-part2.test.ts tests/pipelines/sync/module-boundary.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`
   (wall-clock cap 20 min). All green, so paste the summary lines. Any red here was already at the base: paste it,
   and treat that row as known red in step 6.
4. **Commit 1, `T-276: failing tests: a session without Remote Control is attributed by its own uuid`:** the new test
   file only. Run `npx vitest run tests/t276-session-trailer.test.ts --no-file-parallelism --testTimeout=180000`.
   RED: exactly A1, A2, A3, A4, C1, C2, D1, D2, E1, E2, F1. GREEN: B1, D3, F2. Paste it. Any other split: STOP,
   `BLOCKED T-276 commit-1 split <row>`.
5. **Commit 2, `T-276: attribute a session without Remote Control by its own uuid, and tell it to write that trailer`:**
   R1-R4 in `open-brain/src/shared/handoff-guard.ts`, `open-brain/src/cli-session-end.ts`, `open-brain/src/server.ts`,
   `open-brain/src/pipelines/session-start/transcript-check.ts` and `open-brain/src/pipelines/session-start/start-report.ts`.
   Re-run step 3's command with `tests/t276-session-trailer.test.ts` added: all green. Paste it. Then
   `npx tsc --noEmit` exits 0; paste it. At most 2 fix attempts on a red row, then STOP, `BLOCKED T-276 <row>`.
6. Each commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline <BASE>..HEAD` shows 2 lines, and `git status --porcelain` is empty.
7. **Mutants** (edit, run the named file(s), paste, `git checkout -- <file>`, clean tree; never commit):
   - M1 `handoff-guard.ts`: `return namesSelf ? { ids: [sessionUuid], source: "session" } : { ids: [], source: "none" };` → `return { ids: [], source: "none" };` → A2, C1, C2, D1, D2, E1, E2 red.
   - M2 `handoff-guard.ts`: delete the whole `if (bridge.length === 0) { … }` block → A4 red (A2 stays green).
   - M3 `handoff-guard.ts`: `const namesSelf = sessionUuid !== "" && new RegExp(…).test(text);` → `const namesSelf = sessionUuid !== "";` → A3 red, AND `tests/end-fix-r3-pins.test.ts` R2 red (run both files).
   - M4 `cli-session-end.ts` (T179-2): the third argument `trailer.ids` → `trailer.source === "bridge" ? trailer.ids : []` → D1, D2 red.
   - M5 `cli-session-end.ts` (E4): `const transcriptIds = trailer.ids;` → `const transcriptIds = trailer.source === "bridge" ? trailer.ids : [];` → E1, E2 red.
   - M6 `cli-session-end.ts` (E4): delete the `else if (work.unattributed > 0) { … }` branch → E2 red.
   - M7 `server.ts`: `${noRemoteControl ? structuralTrailerNote(endedId) : ""}` → `${""}` → F1 red.
   - M8 `start-report.ts`: delete both `if (commitTrailer) lines.push(commitTrailer);` lines → C2 red.
   - M9 `transcript-check.ts`: `.source !== "session") return null;` → `.source === "bridge") return null;` → C1 red.
8. `git diff --name-only <BASE>..HEAD` must show exactly those five src files and
   `open-brain/tests/t276-session-trailer.test.ts`. Anything else: STOP, BLOCKED.
9. `git push origin fix/t276-session-trailer` (never force). `git ls-remote origin refs/heads/fix/t276-session-trailer`
   must equal `git rev-parse HEAD`. If the push is rejected: STOP. Then
   `gh pr create --base master --head fix/t276-session-trailer --title "T-276: attribute a session without Remote Control by its own uuid" --body "Brief: docs/loops/t276-non-rc-session-trailer-brief.md."`
   Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-276 <sha40> PR #<n>` or `BLOCKED T-276 <reason>`. Then each command with its output: node
-v, the start-state proofs, the baseline, commit 1's split, the final run, tsc, the nine mutants, the name-only diff,
`ls-remote` = `rev-parse`, the PR URL and CI. Name any HIGH, CRITICAL or UNKNOWN impact target from the launcher's
block, and say which rows cover its callers. **Paste test output with `grep -a`, or without grep.** Mark anything not
run `NOT RUN`. If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do
not merge.
