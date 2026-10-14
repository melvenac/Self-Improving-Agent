# T-276 amendment 1: the Opus review's CHANGES (ob_end reads trailer ids like the hook; two untested branches)

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop. No hub key. Code. Ends at READY with PR #710 updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t276-r2-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-276 (P2). **Tag:** `T-276`. **Size:** SMALL.
**Branch:** `fix/t276-session-trailer` at `1d855c87dfd15e3eac778aba2f87d1f0cb90b60a` (PR #710, round 1). If clark
re-pins it at launch, that SHA wins. **Master to merge:** the dispatch SHA clark names (master moves during tonight's
train: #701 and #708 both edit `server.ts`); if he names none, `git rev-parse origin/master` after the fetch.
**The brief's rulings stand** (`docs/loops/t276-non-rc-session-trailer-brief.md`) except where this changes them; R3's
"`endSessionWindow` UNCHANGED" is REVERSED by ruling 1 below. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: endSessionWindow handleEnd (open-brain/src/server.ts); covered by tests/t276-session-trailer.test.ts F1-F3 and tests/end-fix-*.test.ts
```

## Why

The Opus second review of #710 (VERDICT: CHANGES, `~/Worktrees/t276-review-reply.md`, outside the repo) found the src
diff matches R1-R4 to the character, and three defects the planner accepts:
- **F1.** `endSessionWindow` (`server.ts:363-369`) reads trailer ids with the head-only `sessionIdsFromTranscript`.
  For a session whose first bridge record is past the 256 KiB head (Remote Control switched on mid-session; one measured
  transcript's was past byte 830,000), it falls back to `[endedId]`, and `noRemoteControl` is true. ob_end then tells a
  Remote Control session it has no Remote Control id, while the SessionEnd hook, reading the same transcript with
  `sessionTrailerIds`, takes the `bridge` path and prints no note. The two surfaces give opposite verdicts; the `:422`
  comment is false for that case. R3 froze `endSessionWindow`: that ruling was wrong, and this reverses it.
- **F2.** `cli-session-end.ts:183` (the E4 note gate): mutant MX1 (note unconditional) survives. E2 has no Remote
  Control counterpart.
- **F3.** `start-report.ts:175` (the COMMIT TRAILER push in the `skippedReason` branch): mutant MX2 (line deleted)
  survives. C2's fixture always has `.agents/SESSIONS/`.

The review's nits N1-N4 are NOT in this round (N3 goes to a later task).

## Ruling (exact)

1. **`open-brain/src/server.ts`, `endSessionWindow`** becomes:
   ```ts
   function endSessionWindow(projectRoot: string, sessionId: string): { since: string | null; sessionIds: string[]; trailerSource: TrailerIdSource } {
     const proof = readParentSessionProof();
     const since = proof?.transcript_path ? sessionStartFromTranscript(proof.transcript_path) : null;
     // T-276 r2: the same reader as the SessionEnd hook, so a bridge record past the transcript's head is found and
     // ob_end and the hook agree on whether this session has a Remote Control id.
     const trailer = sessionTrailerIds(proof?.transcript_path, sessionId);
     const sessionIds = trailer.ids.length > 0 ? trailer.ids : sessionId ? [sessionId] : [];
     return { since, sessionIds, trailerSource: trailer.source };
   }
   ```
   - The import from `./shared/handoff-guard.js` (`:40`): add `sessionTrailerIds` and `type TrailerIdSource`; remove
     `sessionIdsFromTranscript` if no caller is left in server.ts (check with grep; say which).
   - At the call site (`:390`), destructure `trailerSource` too.
   - In `handleEnd`'s UNATTRIBUTED block, replace the two lines
     `// T-276: endSessionWindow fell back to the session's own uuid, so its transcript carried no Remote Control id.` and
     `const noRemoteControl = sessionIds.length === 1 && sessionIds[0] === endedId;` with:
     ```ts
             // T-276: the transcript names this session and carries no Remote Control id (sessionTrailerIds, as the hook reads it).
             const noRemoteControl = trailerSource === "session";
     ```
   Nothing else in server.ts changes. `sessionIdsFromTranscript` itself (handoff-guard.ts) stays unchanged.
2. **No other src file changes.**

## New rows (commit 1, `open-brain/tests/t276-session-trailer.test.ts`; use the file's own helpers)

Inside `describe("T-276: session trailer ids", ...)`:

```ts
  it("F3 (r2): a late-bridge Remote Control session's ob_end UNATTRIBUTED line has no note, as the hook says", async () => {
    initOldLayoutRepo(dir);
    proveSessionWithTranscript(dir, lateBridge(dir));
    commitAt(dir, DURING, "src/a.ts", "url trailer", ME_TRAILER);
    commitAt(dir, DURING, "src/b.ts", "no trailer", null);
    touchNextSession(dir, DURING);
    const body = text(await handleEnd({ project_root: dir, session_id: U, dry_run: true }));
    expect(body).toContain("1 commit(s) in the window carry no Claude-Session trailer (UNATTRIBUTED, not counted)");
    expect(body).not.toContain("no Remote Control id");
  });

  it("E3 (r2): work after ob_end with no trailer in a Remote Control session is UNATTRIBUTED with no note", async () => {
    initOldLayoutRepo(dir);
    const tr = rc(dir);
    proveSessionWithTranscript(dir, tr);
    touchNextSession(dir, DURING);
    const abs = resolve(dir);
    await handleEnd({ project_root: abs, session_id: U, dry_run: false, session_summary: "s" });
    const stampAt = readObEndStamp(abs)?.ob_end_at;
    expect(stampAt).toBeTruthy();
    commitAt(dir, new Date(Date.parse(stampAt!) + 2000).toISOString(), "src/after.ts", "after ob_end", null);
    const out = hook(dir, { session_id: U, transcript_path: tr });
    expect(out).toContain("[session-end] work-after-end check: no attributed commits after ob_end; 1 commit(s) after ob_end carry no Claude-Session trailer (UNATTRIBUTED)");
    expect(out).not.toContain("no Remote Control id");
  });
```

Inside `describe("C2: renderStartReport prints COMMIT TRAILER in the header, not the Briefing", ...)`, after its row:

```ts
  it("C3 (r2): the log-skipped branch (no .agents/SESSIONS/) also prints COMMIT TRAILER right after Session ID", async () => {
    const tmpDir = tmp("t276-tx-");
    const dir = fixture();
    rmSync(join(dir, ".agents", "SESSIONS"), { recursive: true, force: true });
    const r = await sr.renderStartReport({
      projectRoot: dir,
      proven: { id: U, pid: 4242, transcriptPath: nonRc(tmpDir) },
      callerLabel: "T276",
    } as Parameters<typeof sr.renderStartReport>[0]);
    const { header } = split(r.text);
    const at = header.findIndex((l) => l.startsWith("Session ID:"));
    expect(at).toBeGreaterThan(-1);
    expect(header[at + 1]).toBe(COMMIT_TRAILER_LINE);
  });
```

Import `rmSync` from `node:fs` if the file lacks it. The fixture commits no file under `.agents/SESSIONS/` (git keeps no
empty directory), so removing the directory leaves the tree clean; if the start report refuses for any other reason,
STOP, BLOCKED with its text.

**Expected at commit 1 (round 1's src):** F3 (r2) RED (the note appears); E3 (r2) GREEN (round 1's gate is correct,
the row pins it against MX1); C3 (r2) GREEN (round 1's push is correct, the row pins it against MX2). Every other row
green. Any other outcome: STOP, BLOCKED.

## Existing tests (verdicts)

- Every t276 row (A1-A4, B1, C1, C2, D1-D3, E1, E2, F1, F2): **stays green**. F1's non-Remote-Control transcript
  gives `source: "session"`; F2's `writeTranscript` has its bridge record in the head, so `source: "bridge"`.
- `tests/end-fix-*.test.ts`, `tests/t003-session-proof.test.ts`, `tests/t262-part2.test.ts`: **stay green**. For a
  bridge-in-head transcript, `sessionIds` gains the session's own uuid when a record names it. That only adds an id a
  commit's trailer can match, so no existing commit changes from attributed to not. A newly failing row here: STOP,
  `BLOCKED T-276 <row>`, with the output: it means an existing contract depended on the old ids.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t276-r2-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. **Start state.** Fresh clone into `(Join-Path $env:TEMP "t276-r2-wt")` unless the launcher named one.
   `git checkout -q -b fix/t276-session-trailer origin/fix/t276-session-trailer`; `rev-parse HEAD` must print
   `1d855c87dfd15e3eac778aba2f87d1f0cb90b60a` and porcelain must be empty, else BLOCKED. `npm ci` in `open-brain`, then
   `node -e "require('better-sqlite3')"` (else `npm rebuild better-sqlite3`, say so).
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name.
3. **Commit 1, `T-276 r2: rows for the Opus review (F3 late bridge on ob_end, E3, C3)`:** the three rows. In
   `open-brain`: `npx vitest run tests/t276-session-trailer.test.ts --no-file-parallelism --testTimeout=180000`. Exactly
   F3 (r2) red. Paste.
4. **Commit 2, `T-276 r2: ob_end reads trailer ids with sessionTrailerIds, as the hook does`:** ruling 1. Run step 3's
   command (all green), then the brief's wider list:
   `npx vitest run tests/t276-session-trailer.test.ts tests/shared/handoff-guard.test.ts tests/end-fix-r3-pins.test.ts tests/end-fix-r4-pins.test.ts tests/end-fix-q6.test.ts tests/end-fix-q8.test.ts tests/end-fix-q10.test.ts tests/end-fix-q12.test.ts tests/end-fix-r2-pins.test.ts tests/pipelines/session-start/t161-transcript.test.ts tests/t003-session-proof.test.ts tests/t262-part2.test.ts tests/pipelines/sync/module-boundary.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`
   and `npx tsc --noEmit` (exit 0). Paste both.
5. **Commit 3, the merge:** `git merge --no-ff <master to merge> -m "T-276 r2: merge master <sha7>"`. A conflict in
   `server.ts` is possible (tonight's #701 adds a `keyHeldBy` block in `handleStore`, #708 changes the ob_state
   description line; neither touches `endSessionWindow` or `handleEnd`): resolve by keeping BOTH sides' lines exactly,
   and paste the resolved hunk. Any conflict outside server.ts, or one that touches `endSessionWindow`/`handleEnd`:
   STOP, BLOCKED. Re-run step 4's wider list and tsc after the merge. Paste.
6. End every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the merge: a second `-m`).
   `git log --oneline 1d855c87..HEAD --first-parent` shows 3 lines; porcelain empty.
7. **Mutants** (edit, run the t276 file only, paste the failing rows, `git checkout -- <file>`, porcelain empty; never
   commit one):
   - **MX1** `cli-session-end.ts`: the E4 line's `${trailer.source === "session" ? structuralTrailerNote(id) : ""}` →
     `${structuralTrailerNote(id)}`. Expect E3 (r2) red.
   - **MX2** `start-report.ts`: delete the `if (commitTrailer) lines.push(commitTrailer);` in the `skippedReason`
     branch only. Expect C3 (r2) red.
   - **MX6** `server.ts`: `trailerSource === "session"` → `sessionIds.length === 1 && sessionIds[0] === endedId`.
     Expect F3 (r2) red.
   - **MX7** `server.ts`: `endSessionWindow`'s `sessionTrailerIds(...)` → `{ ids: proof?.transcript_path ? sessionIdsFromTranscript(proof.transcript_path) : [], source: "none" as const }`
     (re-add the import for the mutant). Expect F1 red (the note disappears) and F3 (r2) unaffected or red; paste.
8. `git diff --name-only <master to merge> HEAD` shows exactly round 1's six files (the five src files plus
   `open-brain/tests/t276-session-trailer.test.ts`). Anything else: STOP, BLOCKED.
9. `git push origin fix/t276-session-trailer` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr view 710 --json mergeable,mergeStateStatus` not CONFLICTING; `gh pr checks 710 --watch --interval 30`
   (cap 20 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-276 <sha40> PR #710` or `BLOCKED T-276 <reason>`.
- Then each command with its output. Mark anything not run `NOT RUN`. Name the server.ts import result (ruling 1). Do
  not merge.
