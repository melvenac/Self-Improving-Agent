# T-296 step 2: an opt-in compact State block (`state_compact`), default off

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t296s2-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-16, session 173. **Task:** T-296 (P1), part (3). **Tag:** `T-296-S2`. **Size:** SMALL.
**Base:** the dispatch SHA clark names (a master that contains this brief). **Checklist:**
`~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: renderState renderHandoffs composeGreeting renderStartReport (state-render.ts gains an opt-in branch in three places; start-report.ts and checks.ts each pass one new option; every existing caller passes nothing new, so the default output is byte-identical)
```

## Why

`ob_start` returns a `## State` block and then the Briefing. On 10-16 the State block was about 11.4 KB of SIA's
16.5 KB return. The planner ruled (T-296 note, rev 501) that most of it is NOT duplication. The budgeted Briefing
clips the pick-up to 400 chars, shows 3 watch-outs and 2 open questions, and has no loop state, so the full text of
those lives only in the State block and stays.

Three sections ARE surplus to a starting session, about 5 KB together:
- the 10 newest verified claims;
- the newest 10 open gaps (the Briefing already prints the count and the newest id);
- one provenance line plus one pick-up line per OTHER seat's handoff.

This step adds a per-repo opt-in, `state_compact` in `.agents/SYSTEM/greeting.json`, that turns each of the three
into one line. It follows T-236's convention: **default OFF, so a repo without the key, A2A included, renders
byte-identically.** The planner opts SIA in later, by a records change after the merge, not in this run.

## Ruling (exact)

1. `open-brain/src/pipelines/session-start/state-render.ts`:
   - In `RenderStateOptions`, after the `ownCheckout?: string;` member, add:
     ```ts
       /**
        * T-296 (3), OPT-IN per repo (greeting.json `state_compact`), default OFF. Set: Verified prints only reopened claims
        * plus one count line, Gaps prints one count line, and other seats' handoffs are one line in all. The reader's own
        * handoff, the tasks, the objective and the decisions line are unchanged. The full text stays in state.json.
        */
       compact?: boolean;
     ```
   - **Verified.** The block from the comment line `// Verified is append-ordered like decisions, so the newest are the last`
     down to and including the closing `}` of `if (omitted > 0) { ... }` is wrapped as the `else` branch of:
     ```ts
       if (options.compact === true) {
         // T-296 (3): only reopened claims (a warning, whatever the age), then one line for the rest.
         const reopened = state.verified.filter((v) => v.status === "reopened");
         for (const v of reopened) {
           lines.push(`  ${v.id} — ${clip(v.claim, VERIFIED_CLIP, `verified[${v.id}]`)} (${v.evidence.length} evidence) [REOPENED]`);
         }
         const rest = state.verified.length - reopened.length;
         if (rest > 0) {
           lines.push(`  … ${rest} claim(s) not shown (newest ${state.verified[state.verified.length - 1]!.id}); all of them: ${VERIFIED_FULL_TEXT}`);
         }
       } else {
         // ...the existing block, unchanged...
       }
     ```
     The existing `if (state.verified.length === 0)` line (it pushes `  (none)`) stays after the if/else, unchanged.
   - **Gaps.** The existing `for (const g of openGaps.slice(0, GAPS_SHOWN)) { ... }` loop and the
     `if (openGaps.length > GAPS_SHOWN) { ... }` block after it become the `else` branch of:
     ```ts
       if (options.compact === true) {
         // T-296 (3): one line; the budgeted Briefing already prints the count and the newest id.
         if (openGaps.length > 0) lines.push(`  newest ${openGaps[0]!.id}; all ${openGaps.length} open: state.json gaps[]`);
       } else {
         // ...the existing loop and count block, unchanged...
       }
     ```
     The `// D-100: ...` comment stays above the `else` branch's loop. The existing `if (openGaps.length === 0)` line
     (it pushes `  (none)`) stays after the if/else, unchanged.
   - **Other handoffs**, in `renderHandoffs`. Inside `if (others.length > 0) { ... }`, its three existing statements (the
     `Other handoffs (newest per seat and checkout; ...)` push and the `for` loop) become the `else` branch of:
     ```ts
         if (options.compact === true) {
           lines.push(`\nOther handoffs (${others.length}): ${others.map((h) => `${h.seat}${instanceLabel(h, byCheckout)} (session ${h.session})`).join(" · ")}: state.json handoffs[]`);
         } else {
           // ...the existing push and for loop, unchanged...
         }
     ```
   - Nothing else in this file changes.
2. `open-brain/src/pipelines/session-start/start-report.ts`: in the `renderState(sj.data, result.state.version, { ... })`
   call, after `ownCheckout,` add `compact: greetingFlag(projectRoot, "state_compact"),`. `greetingFlag` is already
   imported. Nothing else changes.
3. `open-brain/src/pipelines/sync/checks.ts`, `composeGreeting`: in its `renderState(data, version, { ... })` call,
   after `projectRoot,` add `compact: greetingFlag(projectRoot, "state_compact"),`. `greetingFlag` is already imported
   (line 20). Nothing else changes.
4. `open-brain/src/pipelines/session-start/greeting-flags.ts`, the header comment line that starts ` * Keys:` becomes:
   ` * Keys: briefing_budget, briefing_focus, briefing_problem, handoff_by_checkout, handoff_caps, missing_handoff, role_docs_by_sha, state_compact. Keep them sorted in the tracked file.`
   (`briefing_focus` was missing from the list.)

## Rows (commit 1: new file `open-brain/tests/pipelines/session-start/t296-state-compact.test.ts`)

Imports:
- `describe, it, expect` from `vitest`;
- `cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync` from `node:fs`;
- `join` from `node:path`, and `tmpdir` from `node:os`;
- `renderState` from `../../../src/pipelines/session-start/state-render.js`;
- `handleStart` from `../../../src/server.js`;
- `composeGreeting` from `../../../src/pipelines/sync/checks.js`;
- `type State` from `../../../src/shared/state-schema.js`.

Fixtures, copied verbatim:
- `base`: the `const state: State = { ... } as unknown as State;` object from
  `tests/pipelines/session-start/state-render.test.ts` lines 19-61, renamed `base`.
- `manyVerified`: the 15-claim generator from that file's lines 225-231, where V-002 is `reopened`.
- `gap` and `many`: the helpers from its lines 471-481, with `state` replaced by `base`.
- `e`: the handoff helper from its lines 127-129.
- `qa`: `{ seat: "qa", session: 110, pick_up: "words from sia-qa", watch_out: [], open_questions: [], loop_state: null, session_uuid: "u-sia-qa", checkout: "sia-qa" }`.
- `proseProject` and `getText`: from `tests/pipelines/fleet-ae-f4.test.ts` lines 11-28. Keep the path to the repo's
  `.agents/roles/developer.md` correct for the new file's depth: `join(import.meta.dirname, "../../../..", ".agents/roles/developer.md")`.
- `const stateFixture = join(import.meta.dirname, "../../fixtures-state/state.json");`. It holds 8 verified claims,
  V-006 `reopened`, and 5 open gaps.

`const V = /^ {2}V-\d+ — /` and `const G = /^ {2}G-\d+ — /`.

The rows:
- **C1** `out = renderState({ ...base, verified: manyVerified } as unknown as State, "x", { compact: true })`.
  - `out.join("\n")` contains `Verified (15):`.
  - `out` contains `"  V-002 — claim 2 (0 evidence) [REOPENED]"`.
  - `out` contains `"  … 14 claim(s) not shown (newest V-015); all of them: node open-brain/build/cli.js state show --json"`.
  - `out.filter((l) => V.test(l))` has length 1.
- **C2** `out = renderState(many(40, 3), "x", { compact: true })`.
  - The text contains `Gaps (40):`.
  - `out` contains `"  newest G-040; all 40 open: state.json gaps[]"`.
  - `out.filter((l) => G.test(l))` has length 0.
- **C3** `s = { ...base, handoffs: [e(107, "sia-forge"), qa, e(118, "sia-builder")] } as unknown as State`, and
  `text = renderState(s, "x", { seat: "developer", compact: true }).join("\n")`. `text`:
  - contains `Your handoff — developer [sia-builder], session 118:`;
  - contains `words from sia-builder`;
  - contains `Other handoffs (2): developer [sia-forge] (session 107) · qa [sia-qa] (session 110): state.json handoffs[]`
    (others keep the record's order);
  - contains neither `words from sia-forge` nor `words from sia-qa`.
- **C4** (the default is unchanged). For each of the three inputs, with their options minus `compact`:
  - the inputs are C1's state, `many(40, 3)` and C3's state (`{ seat: "developer" }`);
  - `renderState(s, "x", opts)` must equal `renderState(s, "x", { ...opts, compact: false })` (`toEqual`);
  - C1's default render must contain `"  V-015 — claim 15 (0 evidence)"`.
- **C5** (the reader's own handoff is untouched). With C3's state, render with `{ seat: "developer", compact: true }`
  and `{ seat: "developer" }`. In each, take the lines from the one that starts with `"\nYour handoff"` up to (not
  including) the one that starts with `"\nOther handoffs"`. The two slices are equal and non-empty.
- **C6** (`ob_start` wiring).
  - Make two temp dirs (`mkdtempSync(join(tmpdir(), "t296s2-"))`). In each, run `proseProject(dir)` and
    `cpSync(stateFixture, join(dir, ".agents", "state.json"))`.
  - In the second only, write `.agents/SYSTEM/greeting.json` = `{"state_compact":true}\n`.
  - `off = getText(await handleStart({ project_root: dir1 }))` and `on = getText(await handleStart({ project_root: dir2 }))`.
  - `off.split("\n").filter((l) => V.test(l)).length` is greater than 1, and `off` does not contain `claim(s) not shown (newest`.
  - `on` contains `claim(s) not shown (newest V-008)`, and `on.split("\n").filter((l) => V.test(l))` has length 1
    (V-006 [REOPENED]).
  - `rmSync` both dirs in a `finally`.
- **C7** (the size check composes what `ob_start` returns). In a fresh temp dir set up as C6's flagged one,
  `composeGreeting(dir, "0.45.0")!.text` contains `claim(s) not shown (newest V-008)`. `rmSync` in a `finally`.

Give C6 and C7 a 120000 ms timeout.

**Expected at commit 1 (the base):** C1, C2, C3, C6 and C7 RED; C4 and C5 green (the base ignores `compact`).

## Existing tests (verdicts)

Every existing caller passes no `compact`, so every existing render is byte-identical. The planner grepped `renderState`
under `open-brain/tests` at 053b854d:

- `tests/pipelines/session-start/state-render.test.ts` (45 rows), `a2a-byte-identical.test.ts` (the golden at
  `tests/fixtures-state/a2a-1c200b41-render.golden.txt`), `handoff-by-checkout.test.ts`, `briefing.test.ts`,
  `record-source.test.ts`, `role-docs-by-sha.test.ts`, `tests/pipelines/sync/greeting-size.test.ts` and
  `tests/helpers/role-source.ts`: all stay green, unchanged.
- No test pins the `* Keys:` comment in greeting-flags.ts.

**No existing test changes.** Any other red row: STOP, `BLOCKED T-296-S2 <test name>`.

## Steps

1. PowerShell:
   `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t296s2-reply.md")); "REPLY_PATH=$reply"`, then
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`; otherwise STOP).
2. Fresh clone into `(Join-Path $env:TEMP "t296s2-wt")` unless the launcher named one.
   - `git checkout -q -b fix/t296-state-compact <base>`.
   - Check that `git rev-parse HEAD` equals the base, that `git status --porcelain` is empty, and that
     `git ls-tree --name-only HEAD docs/loops/t296-state-compact-brief.md` prints the path.
   - `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. On "Could not locate the bindings file",
     run `npm rebuild better-sqlite3` and say so.
   - **Forbidden:**
     - `git stash`, `reset --hard`, `--force`, rebase and amend;
     - `cd` into another checkout;
     - `npm run test:heavy`;
     - killing any process by name;
     - any read or write of `~/.claude/open-brain/`;
     - any edit of any real `settings.json` or of this repo's `.agents/SYSTEM/greeting.json`.
   - **Edit files with the Edit tool or `sed -i` from Git Bash, never PowerShell `Get-Content | Set-Content`**: it
     mangles the `—` and `…` these files carry.
3. **Commit 1, `T-296-S2: rows for the opt-in compact State block`:** the test file only. `$env:NO_COLOR='1'`; in
   `open-brain`, run
   `npx vitest run tests/pipelines/session-start/t296-state-compact.test.ts --no-file-parallelism --testTimeout=180000`.
   Exactly C1, C2, C3, C6 and C7 must be red. Paste the summary and the `x` rows.
4. **Commit 2, `T-296-S2: state_compact turns verified, gaps and other handoffs into one line each (opt-in, default off)`:**
   rulings 1 to 4.
   - Run `npx vitest run tests/pipelines/session-start tests/pipelines/sync/greeting-size.test.ts tests/pipelines/fleet-ae-f4.test.ts --no-file-parallelism --testTimeout=180000`
     with a 25-minute wall-clock cap. All green. Paste the `Test Files` and `Tests` lines.
   - Then `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), and `npm run build` (exit 0).
5. Both commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline <base>..HEAD` shows 2 lines; `git status --porcelain` is empty.
6. **Mutants**, each made with `sed -i` or the Edit tool. For each one:
   - Run `npx vitest run tests/pipelines/session-start/t296-state-compact.test.ts --no-file-parallelism --testTimeout=180000`.
   - Paste the summary, the `x` rows and the mutant's `git diff` line.
   - Restore with `git checkout -- <file>` and check that `git status --porcelain` is empty. Never commit a mutant.

   The mutants:
   - **M1** state-render.ts, the Verified branch's condition `if (options.compact === true) {` becomes `if (false) {`.
     Expect **C1, C6 and C7** red.
   - **M2** start-report.ts: delete the added `compact: greetingFlag(projectRoot, "state_compact"),` line. Expect **C6**
     red, and only C6.
   - **M3** checks.ts: delete the added `compact: greetingFlag(projectRoot, "state_compact"),` line. Expect **C7** red,
     and only C7.
   - **M4** state-render.ts, in the compact Other-handoffs line, `.join(" · ")` becomes `.join(", ")`. Expect **C3** red
     (it has two other handoffs).
   - **M5** state-render.ts, the compact gaps line, `openGaps[0]!.id` becomes `openGaps[openGaps.length - 1]!.id`.
     Expect **C2** red.
7. `git diff --name-only <base>..HEAD` shows exactly these five files:
   - `open-brain/src/pipelines/session-start/greeting-flags.ts`
   - `open-brain/src/pipelines/session-start/start-report.ts`
   - `open-brain/src/pipelines/session-start/state-render.ts`
   - `open-brain/src/pipelines/sync/checks.ts`
   - `open-brain/tests/pipelines/session-start/t296-state-compact.test.ts`
8. Push and open the PR:
   - `git push origin fix/t296-state-compact` (never force). `git ls-remote origin refs/heads/fix/t296-state-compact`
     must equal `git rev-parse HEAD`. If the push is rejected, STOP.
   - `gh pr create --base master --head fix/t296-state-compact --title "T-296-S2: opt-in compact State block (state_compact, default off)" --body "Brief: docs/loops/t296-state-compact-brief.md. Default off: no repo's /start changes until it opts in."`.
   - `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## Reply

- **First line:** `READY T-296-S2 <sha40> PR #<n>`, or `BLOCKED T-296-S2 <reason>`.
- **STOP rules:** at most 2 attempts at any one step, never "fix until green". A STOP still writes the reply.
- Then each command with its output. Every number is pasted output, with the command shown above it. Mark anything
  not run `NOT RUN`. Do not merge.
