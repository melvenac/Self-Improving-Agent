# T-281: T-161's follow-ups: a Cursor proof's transcript path is withheld, the budgeted briefing carries a short note, the log-skipped push gets its row

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop. Aaron, 2026-10-13: the desktop's CPU is at 100%, so no npm, vitest, tsc
or build runs there. No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t281-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-281 (P2). **Tag:** `T-281`. **Size:** SMALL.
**Base:** `7d9215b250513ccd7bc4c06728d436834c5664b2` (origin/master: #688, T-161, merged). If clark re-pins it at launch, that SHA
wins. Below, `<BASE>` means that 40-char SHA.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: proveSessionAtKey proveSessionClaude renderBudgeted (open-brain/src/shared/process-session.ts, open-brain/src/pipelines/session-start/briefing.ts; reached through proveSession and renderBriefing; new: provenTranscriptPath, TRANSCRIPT_BUDGET_NOTE; covered by tests/pipelines/session-start/t161-transcript.test.ts, tests/pipelines/session-start/briefing-budget.test.ts, tests/t003-session-proof.test.ts, tests/t235-p2-3-cursor-proof.test.ts)
```

## Why

T-281 (read its note). The Opus second review of T-161 (#688 at 5a9443ab, verdict ACCEPT) left three items:
- **F1, budget.** With T-161's NO TRANSCRIPT line set, the budgeted worst case is **32 lines / 4670 chars** against
  `BRIEFING_BUDGET` = 31 / 4400 (`briefing.ts:200`). The review measured it by adding `transcript` to
  `briefing-budget.test.ts`'s "WORST CASE with EVERY flag on" row. Nothing at runtime cuts the briefing; it just grows.
- **F2, Cursor.** `proveSessionAtKey` (`process-session.ts:354`) passes a Cursor proof's `transcript_path` through.
  Nobody has observed whether Cursor's `agent-transcripts/<uuid>/<uuid>.jsonl` exists at the session's first tool call.
  If Cursor writes it only when a turn ends, every Cursor seat's first `/start` prints NO TRANSCRIPT falsely. That
  spread is also untested.
- **F3, a test gap.** The push in `start-report.ts`'s log-skipped branch (`:172`) is untested: a mutant deleting it
  survived.

**Read by the planner in the merged view.** That is master b7bf4c06 plus #688 (5a9443ab), built with
`git merge-tree --write-tree`. The four files this brief edits are byte-identical there to #688's head, so every line
number below is #688's.

**Why the Cursor fix covers BOTH proof returns, not just `proveSessionAtKey`:**
- `proveSession` (`process-session.ts:398-403`) tries the direct-parent read, `proveSessionClaude`, FIRST, even with
  `cursorWalk`.
- The SessionStart hook writes a Cursor proof keyed at the cursor-agent host's pid, with `ide: "cursor"` and the
  payload's `transcript_path` (`cli-bootstrap.ts:149-156`).
- So when the host is the MCP server's direct parent, the Cursor proof comes back through `proveSessionClaude`'s return
  (`:384`). A fix inside `proveSessionAtKey` alone leaves that path raising the false alarm; mutant M3 below shows the row
  that catches it.

The helper this brief adds sits at about `:309`, about 95 lines after T-279's Win32 process-table read (`:150-215`), so
the two briefs' hunks do not touch.

**Why the budgeted layout gets a short fixed note, not the whole line:** the line is about 350 characters at a real
path. Appended to an existing line, the way `missingHandoff` is, it still costs those characters: 4670 > 4400. The full
line stays where it already is in the start report's header, right after `Session ID:` (`start-report.ts:168` and
`:172`, unchanged), so nothing is lost.

A scratch run of exactly this src change, on a clone at 5a9443ab whose four files are the same bytes, passed
`briefing-budget.test.ts` 33/33 with the worst-case row carrying the line. The planner's fork ran it before the CPU rule.
So the note fits in 31 lines / 4400 chars. Step 4's red run re-measures the breach (`32 lines`) at `<BASE>`.

## Ruling (exact; paths under `open-brain/`)

1. **`src/shared/process-session.ts`.** Insert this directly after the `ProveSessionOptions` type, which ends at `:308`
   with `};`, and before `function proveSessionAtKey(`:
   ```ts
   /**
    * T-281: the proof's transcript path for describeTranscript (T-161), or nothing. A Cursor proof's path is withheld: whether
    * Cursor's agent-transcripts/<uuid>/<uuid>.jsonl exists at a session's first tool call has never been observed, and if
    * Cursor writes it only when a turn ends, every Cursor seat's /start would print a false NO TRANSCRIPT. Pass it through for
    * Cursor only after one live Cursor /start shows the file exists when ob_start runs.
    */
   function provenTranscriptPath(proof: Partial<ProcessSessionProof>): { transcriptPath?: string } {
     if (proof.ide === "cursor") return {};
     return typeof proof.transcript_path === "string" && proof.transcript_path ? { transcriptPath: proof.transcript_path } : {};
   }
   ```
   Then make both success returns use it:
   - `:354` becomes `  return { id: proof.session_id, pid: keyPid, ...provenTranscriptPath(proof) };`
   - `:384` becomes `  return { id: proof.session_id, pid: parentPid, ...provenTranscriptPath(proof) };`

   Nothing else in the file changes.
2. **`src/pipelines/session-start/briefing.ts`.**
   - **`missingHandoff`'s doc comment (`:50-54`).** `exactly at its cap), so it is APPENDED` becomes
     `exactly at its cap, and T-281 keeps it there), so it is APPENDED`.
   - **`transcript`'s doc comment (`:58-61`).** Its body becomes exactly:
     ```
      * T-161: describeTranscript()'s line, when the proven session has no transcript on disk. The legacy layout prints it on its own
      * line after the serving line and oldStartCommand. The budgeted layout has no spare line and too few spare chars for it, so it
      * appends TRANSCRIPT_BUDGET_NOTE to the session line instead (T-281); the full line stays in the start report's header, under
      * `Session ID:`. Null or absent prints nothing, so every other render is byte-identical.
     ```
   - **After `export const BRIEFING_BUDGET = { lines: 31, chars: 4400 } as const;` (`:200`),** add:
     ```ts
     /**
      * T-281: what the budgeted layout prints for T-161's NO TRANSCRIPT line, appended to the session line. The full line, with the
      * session id, the path and the advice, is in the start report's header under `Session ID:`.
      */
     export const TRANSCRIPT_BUDGET_NOTE = "NO TRANSCRIPT (T-161): /end cannot see this session";
     ```
   - **In `renderBudgeted`:**
     - Delete `  if (i.transcript) out.push(i.transcript);` (`:231`).
     - Replace the session-line push (`:238`),
       `` out.push(`${session} — ${i.date} · ${s.project.name} v${i.version} · state rev ${s.revision} · ${drift}`); ``, with:
       ```ts
         const sessionLine = `${session} — ${i.date} · ${s.project.name} v${i.version} · state rev ${s.revision} · ${drift}`;
         // T-281: T-161's line rides the session line as a fixed note, so an alarm state costs no line and stays inside the char cap.
         out.push(i.transcript ? `${sessionLine} · ${TRANSCRIPT_BUDGET_NOTE}` : sessionLine);
       ```
   - The legacy layout (`renderBriefing`, `:125`) is unchanged.
3. **Do NOT edit** `src/pipelines/session-start/start-report.ts` or `src/pipelines/session-start/transcript-check.ts`.
   T-276, launched tonight, edits both. Mutant M6 edits `start-report.ts` temporarily and is always reverted.
4. **Out of scope:**
   - F4, the id-null guard at `transcript-check.ts:12`: an equivalent mutant, which the review calls not a defect.
   - The live Cursor `/start` proof, which is a planner act. When it shows the file exists at the first tool call, a
     later change passes the path through for Cursor.
   - The "Relaunching is the first thing to try" wording.

## New and changed rows (commit 1)

**A. `tests/pipelines/session-start/t161-transcript.test.ts`**

A1. **P3.** Replace the whole `for (const budget of [false, true]) { … }` block (`:115-138`) with this block.
It drops the redundant casts, as the review's nit asks, because the field is typed:
```ts
  it("default: the line comes right after the serving line", () => {
    const lines = b.renderBriefing(input({ transcript: LINE }));
    const at = lines.indexOf(SERVING);
    expect(at).toBeGreaterThan(-1);
    expect(lines[at + 1]).toBe(LINE);
    expect(lines.filter((l) => l === LINE)).toHaveLength(1);
  });

  it("default: with oldStartCommand set too, the line comes right after it", () => {
    const lines = b.renderBriefing(input({ oldStartCommand: OLD, transcript: LINE }));
    const at = lines.indexOf(SERVING);
    expect(lines.slice(at, at + 3)).toEqual([SERVING, OLD, LINE]);
  });

  it("budgeted (T-281): no line of its own; the session line ends with TRANSCRIPT_BUDGET_NOTE, and the line count is unchanged", () => {
    const without = b.renderBriefing(input({ budget: true }));
    const lines = b.renderBriefing(input({ budget: true, transcript: LINE }));
    expect(b.TRANSCRIPT_BUDGET_NOTE).toBe("NO TRANSCRIPT (T-161): /end cannot see this session");
    expect(lines).toHaveLength(without.length);
    expect(lines.some((l) => l.includes("NO TRANSCRIPT: session"))).toBe(false);
    const at = without.findIndex((l) => l.startsWith("Session 161 — "));
    expect(at).toBeGreaterThan(-1);
    expect(lines[at]).toBe(`${without[at]} · ${b.TRANSCRIPT_BUDGET_NOTE}`);
    expect(lines.filter((l) => l.includes("NO TRANSCRIPT"))).toHaveLength(1);
  });

  it("budgeted (T-281): with oldStartCommand set too, the lines above the session line are unchanged and the note still rides it", () => {
    const lines = b.renderBriefing(input({ budget: true, oldStartCommand: OLD, transcript: LINE }));
    const at = lines.indexOf(SERVING);
    expect(lines.slice(at, at + 3)).toEqual([SERVING, OLD, "Usage: GREEN → dispatches open"]);
    expect(lines[at + 3]!.startsWith("Session 161 — ")).toBe(true);
    expect(lines[at + 3]!.endsWith(` · ${b.TRANSCRIPT_BUDGET_NOTE}`)).toBe(true);
  });

  for (const budget of [false, true]) {
    const layout = budget ? "budgeted" : "default";

    it(`${layout}: transcript absent or null renders exactly as without the field`, () => {
      const without = b.renderBriefing(input({ budget }));
      expect(b.renderBriefing(input({ budget, transcript: null }))).toEqual(without);
      expect(b.renderBriefing(input({ budget, transcript: undefined }))).toEqual(without);
      expect(without.some((l) => l.startsWith("NO TRANSCRIPT"))).toBe(false);
    });
  }
```

A2. **P4.** In both existing rows, replace `} as Parameters<typeof sr.renderStartReport>[0]);` with `});`, which drops
the same nit. Then add this row after "an existing transcript: NO TRANSCRIPT appears nowhere", inside the P4 describe:
```ts
  it("T-281: the log-skipped branch (no .agents/SESSIONS/) prints NO TRANSCRIPT right after Session ID, and in the Briefing", async () => {
    const dir = fixture();
    rmSync(join(dir, ".agents", "SESSIONS"), { recursive: true, force: true });
    const missing = join(tmp("t161-tx-"), "gone.jsonl");
    const r = await sr.renderStartReport({
      projectRoot: dir,
      proven: { id: SELF, pid: 4242, transcriptPath: missing },
      callerLabel: "T161",
    });
    const { header, briefing } = split(r.text);
    expect(header).toContain("Session log: no .agents/SESSIONS/ dir — log not created");
    const at = header.findIndex((l) => l.startsWith("Session ID:"));
    expect(at).toBeGreaterThan(-1);
    expect(header[at + 1]).toBe(ruled(SELF, missing));
    expect(briefing).toContain(ruled(SELF, missing));
  });
```
The `skippedReason` text is `pipelines/session-start/index.ts:33`. The fixture commits no `.agents/SESSIONS` (git keeps no
empty directory), so removing it leaves the tree clean.

A3. **A new describe at the end of the file:**
```ts
describe("T-281 C: an ide:cursor proof's transcript_path is withheld until a live Cursor /start proves the file", () => {
  const CURSOR_TX = "C:/t/agent-transcripts/x/x.jsonl";
  const HOST_CMD = String.raw`C:\AppData\Local\cursor-agent\versions\2026.10.01-e373342\node.exe C:\AppData\Local\cursor-agent\versions\2026.10.01-e373342\index.js`;

  it("C1: the direct-parent read gives exactly { id, pid } for an ide:cursor proof, with or without cursorWalk", () => {
    const d = tmp();
    writeFileSync(join(d, "4242.json"), JSON.stringify({ session_id: SELF, claude_pid: 4242, proc_start: "s", ide: "cursor", transcript_path: CURSOR_TX }));
    expect(ps.proveSession(d, 4242, "s")).toStrictEqual({ id: SELF, pid: 4242 });
    expect(ps.proveSession(d, 4242, "s", { cursorWalk: true, readParent: () => null })).toStrictEqual({ id: SELF, pid: 4242 });
  });

  it("C2: the cursor-agent host walk gives exactly { id, pid } for an ide:cursor proof that carries transcript_path", () => {
    const host = process.ppid;
    const wrapper = process.pid;
    const hostStart = ps.processStartTime(host);
    expect(hostStart).not.toBeNull();
    const chain: Record<number, ps.ProcessParentInfo> = {
      [wrapper]: { pid: wrapper, ppid: host, commandLine: "powershell.exe wrapper" },
      [host]: { pid: host, ppid: 1, commandLine: HOST_CMD },
    };
    const d = tmp();
    ps.writeProcessSession(d, { session_id: SELF, claude_pid: host, proc_start: hostStart!, ide: "cursor", written_at: "", transcript_path: CURSOR_TX });
    expect(ps.proveSession(d, wrapper, ps.processStartTime(wrapper), { cursorWalk: true, readParent: (p) => chain[p] ?? null })).toStrictEqual({ id: SELF, pid: host });
  });

  it("C3: an ide:claude proof still carries its transcript_path", () => {
    const d = tmp();
    writeFileSync(join(d, "4242.json"), JSON.stringify({ session_id: SELF, claude_pid: 4242, proc_start: "s", ide: "claude", transcript_path: "C:/t/x.jsonl" }));
    expect(ps.proveSession(d, 4242, "s")).toStrictEqual({ id: SELF, pid: 4242, transcriptPath: "C:/t/x.jsonl" });
  });
});
```
C2 follows the t235 harness. An injected `readParent` is not the default, so `resolveCursorAgentHost` walks the fake
chain and loads no Win32 table (`process-session.ts:278-279`). `HOST_CMD` matches `isCursorAgentHostCommandLine`
(`:143`). `processStartTime` reads the real start time of the vitest parent and worker, on Windows and on Linux CI
(`:69-95`).

**B. `tests/pipelines/session-start/briefing-budget.test.ts`, the "WORST CASE with EVERY flag on …" row (`:263-325`)**
- In the title, `a clipped T-167 PROBLEM line)` becomes
  `a clipped T-167 PROBLEM line + T-161's NO TRANSCRIPT, T-281)`.
- After the `problem:` entry (`:313`), add:
  ```ts
        // T-281: T-161's line at a long real-shaped path. The budgeted layout carries only a fixed note for it, on the session line.
        transcript: `NO TRANSCRIPT: session 00000000-0000-4000-8000-000000000000 has no transcript at C:/Users/someone/.claude/projects/C--Users-someone-Worktrees-sia-builder/00000000-0000-4000-8000-000000000000.jsonl, so /end's transcript checks, the handoff guard and the recall census cannot see it (T-161). Relaunching is the first thing to try; the cause is unknown.`,
  ```
- AFTER the row's two existing budget asserts (`:323-324`), never before them, add:
  ```ts
      // T-281: the note rides the session line, and the full line is not in the Briefing.
      expect(lines.find((l) => l.startsWith("Session 160 — "))!.endsWith(" · NO TRANSCRIPT (T-161): /end cannot see this session")).toBe(true);
      expect(lines.join("\n")).not.toContain("NO TRANSCRIPT: session");
  ```
  This order is deliberate: at `<BASE>` the row must fail on the LINE count, `32 lines: expected 32 to be less than or
  equal to 31`, which re-measures the review's F1.

## Existing tests (planner-read in the merged view; verdicts)

| Test | Verdict |
|---|---|
| `t161-transcript.test.ts` P1 (3 rows) | **Stay green**. Their proofs carry no `ide`, so the path passes through. |
| `t161-transcript.test.ts` P2 (4 rows) | **Stay green** (untouched). |
| `t161-transcript.test.ts` P3, the loop's two `budgeted:` rows ("the line comes right after the serving line", "with oldStartCommand set too") | **Replaced** by the two T-281 budgeted rows. The `default:` rows keep their assertions, and the absent/null rows stay as they are, without the casts. |
| `t161-transcript.test.ts` P4 (2 rows) | **Stay green**. The fixture has no `greeting.json`, so the legacy layout prints the full line. |
| `briefing-budget.test.ts` | **Every other row stays green.** The worst-case row is red at `<BASE>` (32 lines) and green after commit 2. |
| `missing-handoff.test.ts` (HO-4 and the handleStart rows), `focus.test.ts` (`:217` reads BRIEFING_BUDGET), `a2a-byte-identical.test.ts` | **Stay green**: none sets `transcript`. |
| `t003-session-proof.test.ts` `:342` (`{ id: SELF, pid: CLAUDE, transcriptPath: "C:/t/x.jsonl" }`, an `ide: "claude"` proof) and `:285` | **Stay green.** |
| `t003-session-proof.test.ts` "A7 in ONE checkout" and "two sessions in ONE checkout" | **Stay green.** They spawn real servers under a 60 s timeout, and both timed out on the desktop at 100% CPU (s170): environmental. If either is red, re-run that file alone once. If it is still red, prove it at `<BASE>` and paste both runs. |
| `t235-p2-3-cursor-proof.test.ts` `:134`, `:157`, `:182` (`toEqual({ id: SELF, pid: host })`) | **Stay green**. Their Cursor proofs carry no `transcript_path`. |
| `qa142-t003.test.ts`, `t154-cli-start.test.ts` | **Stay green**. They read `.id` and `.reason`, or pass `id: null`. |
| `tests/pipelines/sync/retirements-live.test.ts` | **Stays green**. No line of the two src files is pinned in `.agents/retirements.json`, but run it anyway. |

Any other newly failing row: STOP, `BLOCKED T-281 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t281-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.**
   - Work in the fresh clone the launcher named. If it named none, run
     `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t281-wt")` and
     `Set-Location` into it.
   - Run `git checkout -q -b fix/t281-t161-followups <BASE>`. `git rev-parse HEAD` must print `<BASE>`, and
     `git status --porcelain` must be empty.
   - Prerequisites: `git merge-base --is-ancestor 5a9443abf19bd73fd9e535342b4b1a78a4e7be38 HEAD` must exit 0 (T-161 is
     in), and `git cat-file -e HEAD:open-brain/src/pipelines/session-start/transcript-check.ts` must exit 0. Any failure:
     STOP, `BLOCKED T-281 base lacks <which>`.
   - In `open-brain`, run `npm ci`, then `node -e "require('better-sqlite3')"`. If that prints "Could not locate the
     bindings file", run `npm rebuild better-sqlite3`, re-check, and say so.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout,
     `npm run test:heavy`, killing any process by name, and any edit outside the four files in step 8, except a mutant
     (step 7), which is always reverted.
3. **Base run, before any edit.** In `open-brain`, with a 20-minute wall-clock cap:
   `npx vitest run tests/pipelines/session-start/t161-transcript.test.ts tests/pipelines/session-start/briefing-budget.test.ts tests/pipelines/session-start/missing-handoff.test.ts tests/pipelines/session-start/focus.test.ts tests/pipelines/session-start/a2a-byte-identical.test.ts tests/t003-session-proof.test.ts tests/t235-p2-3-cursor-proof.test.ts tests/qa142-t003.test.ts tests/t154-cli-start.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`.
   All green; paste the summary. For any red, apply the t003 rule in the table above and treat that row as known red.
4. **Commit 1, `T-281: failing tests: a Cursor proof keeps no transcript path, the budgeted briefing's note, the log-skipped push`:**
   rows A1-A3 and B. Run
   `npx vitest run tests/pipelines/session-start/t161-transcript.test.ts tests/pipelines/session-start/briefing-budget.test.ts --no-file-parallelism --testTimeout=180000`.
   - **RED, exactly these five:**
     - "budgeted (T-281): no line of its own; …" (`TRANSCRIPT_BUDGET_NOTE` is undefined);
     - "budgeted (T-281): with oldStartCommand set too, …";
     - C1;
     - C2;
     - the briefing-budget worst-case row, failing on `32 lines: expected 32 to be less than or equal to 31`.
   - **GREEN:** every other row, including the new log-skipped P4 row (it pins code that already works; M6 shows it
     bites) and C3.
   - Paste the run. Any other split: STOP, `BLOCKED T-281 commit-1 split <row>`.
5. **Commit 2, `T-281: withhold a Cursor proof's transcript path; the budgeted briefing carries T-161's line as a note on the session line`:**
   rulings 1 and 2. Re-run step 3's command (all green) and paste it. Then run `npx tsc --noEmit` (exit 0) and paste it.
   You have at most 2 fix attempts on a red row, then STOP, `BLOCKED T-281 <row>`.
6. Each commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline <BASE>..HEAD` shows 2 lines, and `git status --porcelain` is empty.
7. **Mutants.** For each: edit, run the named file(s) with step 4's flags, paste the failing row names, then
   `git checkout -- <file>` and check the tree is clean. Never commit a mutant.

   | Mutant | File | Edit | Rows that go red |
   |---|---|---|---|
   | M1 | `process-session.ts` | delete `if (proof.ide === "cursor") return {};` | C1, C2 |
   | M2 | `process-session.ts` | `if (proof.ide === "cursor")` → `if (proof.ide !== "claude")` | P1 "a proof with transcript_path gives { id, pid, transcriptPath }" (its proof has no `ide`) |
   | M3 | `process-session.ts` | `:384`'s return back to `...(typeof proof.transcript_path === "string" && proof.transcript_path ? { transcriptPath: proof.transcript_path } : {})` | C1 (this is why both returns use the helper) |
   | M4 | `briefing.ts` | the new push → `out.push(sessionLine); if (i.transcript) out.push(i.transcript);` | both T-281 budgeted P3 rows, and the briefing-budget worst-case row |
   | M5 | `briefing.ts` | `${TRANSCRIPT_BUDGET_NOTE}` in the push → `${i.transcript}` | both T-281 budgeted P3 rows, and the briefing-budget worst-case row (on chars) |
   | M6 | `start-report.ts`, never committed (ruling 3) | `:172` `    if (transcript) lines.push(transcript);` → `    // MUT` | the T-281 log-skipped P4 row |
8. `git diff --name-only <BASE>..HEAD` must show exactly these files. Anything else: STOP, BLOCKED.
   - `open-brain/src/pipelines/session-start/briefing.ts`
   - `open-brain/src/shared/process-session.ts`
   - `open-brain/tests/pipelines/session-start/briefing-budget.test.ts`
   - `open-brain/tests/pipelines/session-start/t161-transcript.test.ts`
9. **Push and PR.**
   - `git push origin fix/t281-t161-followups` (never force). `git ls-remote origin refs/heads/fix/t281-t161-followups`
     must equal `git rev-parse HEAD`. If the push is rejected, STOP.
   - Then run
     `gh pr create --base master --head fix/t281-t161-followups --title "T-281: T-161 follow-ups: a Cursor proof's transcript path is withheld, the budgeted briefing's note" --body "Brief: docs/loops/t281-t161-followups-brief.md. Code PR (src)."`
   - Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

- **First line:** `READY T-281 <sha40> PR #<n>` or `BLOCKED T-281 <reason>`.
- **Then each command with its output:** `node -v`, the start-state proofs, the base run, commit 1's split, the final
  run, tsc, the six mutants, the name-only diff, `ls-remote` = `rev-parse`, the PR URL and CI.
- **GitNexus:** name any HIGH, CRITICAL or UNKNOWN impact target from the launcher's block, and say which rows cover its
  callers:
  - `proveSessionAtKey` and `proveSessionClaude` are covered by P1, C1-C3, t003 and t235;
  - `renderBudgeted` by the P3 budgeted rows and briefing-budget.
- **Pasting:** paste test output with `grep -a`, or without grep. Mark anything not run `NOT RUN`.
- If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
