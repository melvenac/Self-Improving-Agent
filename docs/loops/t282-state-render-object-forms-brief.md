# T-282: state-render's T183-3 reads handoff items through the schema accessors (tests only)

Runtime: CC (claude -p, Opus 5.5)
SEAT: a desktop or laptop one-off on any Windows host. No hub key. TESTS ONLY: no file under `open-brain/src` changes,
so SG-1/D-135 merges it on green CI, pinned to the head. Ends at READY with a PR, not a merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t282-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-282 (P2). **Tag:** `T-282`. **Size:** SMALL.
**Base:** `88b2c8d40645e9508a291bbb34c4e2c8d9badfc4` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: renderState splitQuestions questionText questionResolvedBy watchText (read only, no src change; covered by tests/pipelines/session-start/state-render.test.ts)
```

## Why

T-282 (read its note). Records PR #690 (rev 439) failed CI on
`tests/pipelines/session-start/state-render.test.ts`:
`renderState — T183-3 the real record's handoffs are verbatim > renders the planner seat's watch-outs and open questions as whole lines, byte-identical`
reported `expected [...] to include "    - [object Object]"`. The cause is in the row itself, at line 342 at the base:

```ts
for (const w of [...h.watch_out, ...h.open_questions]) expect(lines).toContain(`    - ${w}`);
```

- **What the schema allows.** Open questions may be objects, `{text, resolved_by?, owner?}` (`OpenQuestionSchema`), and
  so may watch-outs, `{text, expires?}` (`WatchOutSchema`). Both are in `src/shared/state-schema.ts`.
- **What the renderer prints.** `renderOneHandoff` in `src/pipelines/session-start/state-render.ts` prints
  `    - ${watchText(w)}` for EVERY watch-out. It has no expiry filter; that belongs to the briefing, not `renderState`.
  It prints each UNRESOLVED question as `    - ${questionText(q)}`. It omits each resolved question and counts it on
  one line, `    (${resolved} resolved, not shown)` (`splitQuestions`, T-233 B).
- **What the test does.** It concatenates the entry itself, so an object prints as `[object Object]`. And because a
  resolved question is never printed, mapping alone would still be wrong for it.
- **The workaround.** Rev 440 landed the handoff only by rewriting its open questions as strings, and that rule stands
  until this merges.

The planner reproduced the failure first-hand at the base: in a scratch clone's record, it made one planner open
question `{text, owner: "aaron"}` and one watch-out `{text, expires: 999}`, and added a `{text, resolved_by}` question.
The unchanged row failed with exactly `expected [ …(95) ] to include '    - [object Object]'`. The ruling below passed
50/50 on that planted record and 50/50 on the real one.

## Ruling (exact)

**`open-brain/tests/pipelines/session-start/state-render.test.ts` only.**

1. **Imports (lines 5-6 at the base).** Replace the two lines with:
   ```ts
   import { newestHandoffPerInstance, newestHandoffForSeat, questionText, questionResolvedBy, watchText } from "../../../src/shared/state-schema.js";
   import type { Handoff, State } from "../../../src/shared/state-schema.js";
   ```
2. **A helper and a synthetic describe.** Insert this block directly ABOVE the T183-3 doc comment, the
   `/**` + ` * T183-3: the render against THIS repository's own record.` lines at 318-319 at the base, which come after
   the R183-1 describe's closing `});`:
   ```ts
   /**
    * T-282: the lines renderOneHandoff prints for one handoff's items, derived through the schema's own accessors. Concatenating
    * an entry printed "    - [object Object]" for every object-form watch-out ({text, expires?}) and open question
    * ({text, owner?, resolved_by?}), and failed CI on records PR #690. A resolved question is omitted and counted (T-233 B).
    */
   function expectItemsVerbatim(lines: string[], h: Handoff): void {
     for (const w of h.watch_out) expect(lines).toContain(`    - ${watchText(w)}`);
     const open = h.open_questions.filter((q) => questionResolvedBy(q) === null);
     for (const q of open) expect(lines).toContain(`    - ${questionText(q)}`);
     const resolved = h.open_questions.length - open.length;
     if (resolved > 0) expect(lines).toContain(`    (${resolved} resolved, not shown)`);
   }

   describe("renderState — T-282 object-form watch-outs and open questions render as their text", () => {
     const h: Handoff = {
       ...state.handoffs[0]!,
       watch_out: ["W-plain", { text: "W-object" }, { text: "W-expires", expires: 999 }],
       open_questions: [
         "Q-plain",
         { text: "Q-object" },
         { text: "Q-owned", owner: "aaron" },
         { text: "Q-resolved", resolved_by: "D-001" },
         { text: "Q-resolved-owned", resolved_by: "PR #1", owner: "aaron" },
       ],
     };
     const lines = renderState({ ...state, handoffs: [h] } as unknown as State, "x", { seat: "developer" });

     it("prints each watch-out and unresolved question as its text, and counts the resolved ones (the shared helper)", () => {
       expectItemsVerbatim(lines, h);
     });

     it("states the same lines literally, so a wrong helper cannot pass", () => {
       for (const t of ["W-plain", "W-object", "W-expires", "Q-plain", "Q-object", "Q-owned"]) expect(lines).toContain(`    - ${t}`);
       expect(lines).toContain("    (2 resolved, not shown)");
       expect(lines).not.toContain("    - Q-resolved");
       expect(lines).not.toContain("    - Q-resolved-owned");
       expect(lines.filter((l) => l.includes("[object Object]"))).toEqual([]);
     });
   });
   ```
   `state` is the file's own fixture at the top. Its one handoff is the developer's, so the reader seat is `developer`.
3. **The T183-3 row (line 342 at the base).** Replace
   `      for (const w of [...h.watch_out, ...h.open_questions]) expect(lines).toContain(`    - ${w}`);` with
   `      expectItemsVerbatim(lines, h);`. Keep its next line (`  pick up:`) as it is.

Change nothing else. In particular, the loop-state row stays as it is: `rulings` and `questions_for_aaron` are
`z.array(z.string())`.

## Existing tests (planner-read at 88b2c8d4; verdicts)

- **Every other row in `state-render.test.ts` stays green.** That is 48 at the base. After the commit there are 50
  (+2, both T-282 rows; the per-seat T183-3 rows depend on the live record's seats, so at a re-pinned base check the
  difference, +2).
- **`tests/pipelines/sync/retirements-live.test.ts`: stays green.** `state-schema.ts` is pinned in
  `.agents/retirements.json`, but it is only imported, never edited. At the base the two files together ran 52 passed.
- **Other tests that read the live record never concatenate handoff items, so they are untouched.**
  - `tests/pipelines/sync/greeting-size.test.ts` and `tests/pipelines/sync/start-legend.test.ts` read the record.
  - `tests/pipelines/session-start/missing-handoff.test.ts` clones it.
  - `briefing-budget.test.ts`, `briefing.test.ts` and `focus.test.ts` use their own object-form fixtures.
- **Any other newly failing row:** STOP, `BLOCKED T-282 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t282-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path` and `node -v`. It must print `v22.*`, else BLOCKED.
2. **Start state.**
   - Work in the fresh clone the launcher named. If it named none, run
     `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t282-wt")` and
     `Set-Location` into it.
   - Run `git checkout -q -b test/t282-state-render-object-forms 88b2c8d40645e9508a291bbb34c4e2c8d9badfc4`.
     `git rev-parse HEAD` must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED.
   - In `open-brain`, run `npm ci`, then `node -e "require('better-sqlite3')"`. If that fails with "Could not locate the
     bindings file", run `npm rebuild better-sqlite3` and say so.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
     `npm run test:heavy`, killing any process by name, and ANY edit under `open-brain/src` except a mutant (step 6),
     which is always reverted.
3. **Before the change**, in `open-brain`:
   `npx vitest run tests/pipelines/session-start/state-render.test.ts --no-file-parallelism --testTimeout=180000`.
   It is green (48 passed at the base). Paste the summary lines.
4. **One commit, `T-282: state-render T183-3 reads handoff items through the schema accessors`:** the ruling's three
   edits. End the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Then run
   `npx vitest run tests/pipelines/session-start/state-render.test.ts tests/pipelines/sync/retirements-live.test.ts --no-file-parallelism --testTimeout=180000`
   (cap 10 min). All green (52 passed at the base). Paste it. Then
   `git log --oneline 88b2c8d4..HEAD` shows 1 line, `git status --porcelain` is empty, and `npx tsc --noEmit` exits 0.
   Paste both.
5. **The live-record path takes object forms (proof; never commit).**
   - Write this file with a single-quoted here-string, then run `node $env:TEMP\t282-plant.mjs .agents\state.json`
     from the clone root:
     ```js
     import { readFileSync, writeFileSync } from "node:fs";
     const p = process.argv[2];
     const s = JSON.parse(readFileSync(p, "utf8"));
     const h = s.handoffs.filter((x) => x.seat === "planner").sort((a, b) => b.session - a.session)[0];
     h.open_questions[0] = { text: h.open_questions[0], owner: "aaron" };
     h.open_questions.push({ text: "T-282 planted resolved question", resolved_by: "D-001" });
     h.watch_out[0] = { text: h.watch_out[0], expires: 999 };
     writeFileSync(p, JSON.stringify(s, null, 2) + "\n");
     console.log(`planted: planner session ${h.session}`);
     ```
   - Run the state-render file alone. It is green. Paste it.
   - Run `git checkout -- .agents/state.json`, then `git status --porcelain`, which must be empty.
   - If the planner handoff has no open question or no watch-out at your base, say so and skip this step (`NOT RUN`
     with the reason).
6. **Mutants** (each one: edit, run the state-render file alone, paste the summary and the failing row names,
   `git checkout -- <file>`, clean tree; never commit). Expected counts at the base are in brackets.
   - **M-1** (test file): replace the five-line body of `expectItemsVerbatim` with
     `  for (const w of [...h.watch_out, ...h.open_questions]) expect(lines).toContain(`    - ${w}`);`. The T-282 helper
     row fails [1 failed, 49 passed]. The T183-3 rows stay green while the record holds strings: that is why the
     synthetic row exists.
   - **M-2** (test file): in the helper, `for (const q of open) expect` → `for (const q of h.open_questions) expect`.
     The helper row fails on `    - Q-resolved` [1 failed, 49 passed].
   - **M-3** (`src/pipelines/session-start/state-render.ts`, `renderOneHandoff`): ``lines.push(`    - ${watchText(w)}`)``
     → ``lines.push(`    - ${w}`)``. Both T-282 rows fail [2 failed, 48 passed].
   - **M-4** (`src/pipelines/session-start/state-render.ts`, `splitQuestions`):
     `if (questionResolvedBy(q) !== null) resolved++;` → `if (false) resolved++;`. Both T-282 rows fail
     [2 failed, 48 passed].
7. **Scope.** `git diff --name-only 88b2c8d4..HEAD` must show only
   `open-brain/tests/pipelines/session-start/state-render.test.ts`. Anything else: STOP, BLOCKED.
8. **Push and PR.**
   - Run `git push origin test/t282-state-render-object-forms` (never force).
     `git ls-remote origin refs/heads/test/t282-state-render-object-forms` must equal `git rev-parse HEAD`. If the
     push is rejected, STOP.
   - Then run
     `gh pr create --base master --head test/t282-state-render-object-forms --title "T-282: state-render T183-3 reads handoff items through the schema accessors" --body "Brief: docs/loops/t282-state-render-object-forms-brief.md. Tests only (no src): SG-1/D-135."`
   - Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.
   - Allow 2 attempts at most for any failing step, then STOP with BLOCKED. Never "fix until green".

## Reply

- The first line is `READY T-282 <sha40> PR #<n>` or `BLOCKED T-282 <reason>`.
- Then give each command with its output: the before run, the commit run, tsc, the planted-record run, the four
  mutants, the name-only diff, `ls-remote` = `rev-parse`, and the PR URL and CI.
- **Paste test output with `grep -a`, or without grep.** Mark anything not run `NOT RUN`.
- If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
