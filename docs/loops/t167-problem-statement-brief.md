# T-167: /start shows what the project is for, and a missing PRD is an ISSUE where /start relies on it

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop one-off (no hub key). Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t167-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-167 (P0). **Tag:** `T-167`. **Size:** SMALL-MEDIUM.
**Base:** `304d56392c8e2fdab33b08a66daae96ece46ab5d` (origin/master; its code equals 399121cd). If clark re-pins it at
launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: syncPrdVersion resolveDocPath renderBriefing renderBudgeted renderStartReport (callers: sync/index.ts, start-report.ts → handleStart / CLI start; covered by tests/pipelines/session-start/*, tests/pipelines/sync/checks.test.ts, tests/server.test.ts)
```

## Why

T-167 (read its note in `.agents/state.json`): the scope layer (PRD, DECISIONS, ENTITIES) is tracked since session 77,
but two items remain, both verified in code at 399121cd: `/sync` reports a missing PRD only as a WARNING
(`pipelines/sync/checks.ts:104`), and nothing in `/start` shows the problem statement. The note rules out a
`project.intent` field, a pointer telling seats to read the PRD, and injecting DECISIONS.md. The fix is to print the
PRD's own first paragraph inside the briefing, which `/start` already prints verbatim.

## Ruling (exact names; all paths under `open-brain/`)

1. **One resolver.** Move `resolveDocPath` (`src/pipelines/sync/checks.ts:88-95`) unchanged into a new
   `src/shared/doc-path.ts`, and re-export it from `checks.ts` (`export { resolveDocPath } from "../../shared/doc-path.js";`)
   so every existing import keeps working.
2. **Greeting flag `briefing_problem`** (default OFF, like the other greeting flags): add it to the key list in the
   comment at `src/pipelines/session-start/greeting-flags.ts:13`, and add `"briefing_problem": true` to SIA's tracked
   `.agents/SYSTEM/greeting.json` (keys stay sorted).
3. **`syncPrdVersion`, PRD not found:** severity `issue` when `greetingFlag(projectRoot, "briefing_problem")` is true,
   with the message `PRD.md not found (.agents/SYSTEM/, docs/, repo root): this checkout has no problem statement, so
   /start cannot show what the project is for. If another checkout has it, it is untracked: add it to the .gitignore
   allowlist.` Otherwise unchanged: `warn`, `PRD.md not found`. (Planner ruling: a repo that has not opted in, such as a
   fresh consumer install, whose bootstrap deliberately creates no PRD, keeps today's result.) The "no version row"
   warning at `:117` and the mismatch issue at `:125` do not change.
4. **`export function describeProblemStatement(projectRoot: string): string`** in `briefing.ts`'s Collectors section.
   It never throws and always returns exactly one line:
   - Resolve the PRD with `resolveDocPath(projectRoot, "PRD.md")`; `<rel>` is its path relative to `projectRoot` with `/`.
   - Read it, remove HTML comments (`<!-- … -->`, across lines) first, then find the line matching
     `^##\s+Problem Statement\s*$`. The section runs to the next line matching `^#{1,2}\s` or the end of the file.
   - Take the section's first paragraph whose first non-space character is not `|` (a table is never the statement):
     its lines up to the next blank line, joined. Clip with the existing private `cut(text, PROBLEM_CLIP)`, where
     `const PROBLEM_CLIP = 300`.
   - Lines: `PROBLEM (<rel>): <text>` · `PROBLEM: not shown (no PRD.md in .agents/SYSTEM/, docs/ or the repo root)` ·
     `PROBLEM: not shown (<rel> has no "## Problem Statement" heading)` ·
     `PROBLEM: not shown (<rel>'s "## Problem Statement" section is empty)` · `PROBLEM: not checked (<error message>)`.
   - The `**Problem Statement:**` field form in `project-template/.agents/SYSTEM/PRD.md` is NOT parsed: it reports the
     "no heading" line, visibly.
5. **Rendering.** `BriefingInput` gains `problem?: string | null`.
   - Default layout: `if (i.problem) out.push("", i.problem);` immediately before `out.push("", "OBJECTIVE");` (`:123`).
   - Budgeted layout (`renderBudgeted`): `if (i.problem) out.push(i.problem);` immediately before the OBJECTIVE push
     (`:223`).
   - With `problem` absent or null both layouts are byte-identical to today.
6. **`BRIEFING_BUDGET` becomes `{ lines: 31, chars: 4400 }`** (`briefing.ts:184`). Planner ruling: the budget is a
   T-236 constant, not Aaron's; the problem statement is the only scope line `/start` carries, and it costs one line and
   at most ~330 characters.
7. **Wiring:** in `src/pipelines/session-start/start-report.ts`, the `renderBriefing({...})` call (`~:247`) passes
   `problem: greetingFlag(projectRoot, "briefing_problem") ? describeProblemStatement(projectRoot) : null`.
8. **Out of scope:** the three `start.md` copies, `sync.md`, `project-template/`, T-191 per-seat profiles, and making the
   template track its PRD. Do not touch them.

## Existing tests (planner-researched; verdicts)

- `tests/pipelines/sync/checks.test.ts:213` "warns when PRD.md is missing": **stays green** (its fixture has no
  greeting.json, so the flag is off and the result is unchanged).
- `tests/pipelines/session-start/briefing-budget.test.ts:231` pins `{ lines: 30, chars: 4096 }`: **update** to the
  ruled budget.
- `briefing-budget.test.ts:263` "every flag on": **update** its input to carry a maximum-length PROBLEM line (a
  300-character statement, so the clipped line), and keep asserting the worst case fits `BRIEFING_BUDGET`.
- `briefing.test.ts` `:454` and the QA 263 F4 MCP row (`~:550`) build fixture projects without greeting.json: **stay
  green**.
- Stay green (field absent, relative assertions, or both sides render the same line): `a2a-byte-identical.test.ts`
  (the A2A golden), `fleet-ae-f5` snapshot, the rest of `briefing.test.ts`, `briefing-budget.test.ts` `:234 :248 :324
  :345 :359`, `focus.test.ts`, `missing-handoff.test.ts`, `standing-budget.test.ts`, `handoff-by-checkout.test.ts`,
  `briefing-fix.test.ts`, fleet-ae-e3/f4/f6/f8, `server.test.ts`, `focus-off`, `t154-cli-start`, `latest-brief`,
  `record-source`, `start-parity`, `sync/index.test.ts`, `repo-root.test.ts`, `cursor-hook-compat.test.ts`.
- **Allowed edit beyond the two named rows:** a row that renders THIS repository's real block (so it now sees
  `briefing_problem: true`) and asserts an exact line list may gain the PROBLEM line, and nothing else. List each such
  row in the reply with old and new. Any other newly failing row: STOP, `BLOCKED T-167 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t167-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t167-wt")`, `Set-Location`
   into it, `git checkout -q -b fix/t167-problem-statement 304d56392c8e2fdab33b08a66daae96ece46ab5d`. `git rev-parse HEAD`
   must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED. `npm ci` in `open-brain`.
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout.
3. **Base run** (in `open-brain`, 30-minute cap; paste the summary line and every failing row's name):
   `npx vitest run tests/pipelines/session-start tests/pipelines/sync tests/server.test.ts tests/t154-cli-start.test.ts tests/pipelines/fleet-ae --no-file-parallelism --testTimeout=180000`.
   Anything red here is pre-existing: list it, do not fix it.
4. **Commit 1, `T-167: tests (red)`.** New file `open-brain/tests/pipelines/session-start/t167-problem.test.ts`, importing
   the modules as namespaces (`import * as b from …`) so a missing export fails rows, not the file. Use temp project
   directories; never write in the clone's `.agents/`.
   - **P1:** no PRD and greeting.json `{"briefing_problem": true}` → `syncPrdVersion` severity `issue` in check and fix
     mode, message contains `no problem statement`; no greeting.json → `warn`, message exactly `PRD.md not found`.
   - **P2:** `describeProblemStatement` on fixtures: (a) a `## Problem Statement` section holding a two-sentence
     paragraph, then a table, then `## Next` → exactly `PROBLEM (.agents/SYSTEM/PRD.md): <the paragraph>`, no `|`;
     (b) a 500-character paragraph → ends with `… (500 chars)`; (c) no PRD, (d) no heading, (e) an empty section → each
     exact `not shown` line; (f) a copy of `project-template/.agents/SYSTEM/PRD.md` → the "no heading" line, and the
     output never contains `FitTrack`; (g) the statement inside `.agents/SYSTEM/` wins over `docs/PRD.md` (the resolver's
     order).
   - **P3:** on THIS repository (resolve the root from the test file) the line starts
     `PROBLEM (.agents/SYSTEM/PRD.md): `, is longer than 60 characters and contains no `|`.
   - **P4:** in both layouts, the PROBLEM line sits immediately above the `OBJECTIVE` line (the default layout keeps one
     blank line before PROBLEM); with `problem` absent or null each layout equals its render without the field.
   - **P5:** `handleStart` on a fixture project with greeting.json `{"briefing_problem": true}` and a fixture PRD → the
     Briefing block contains the PROBLEM line; the same project without the flag → no line starting `PROBLEM`.
   - **P6:** `BRIEFING_BUDGET` equals `{ lines: 31, chars: 4400 }`.
   Run the file: P1-P6 red (P4's "absent" half and P2(c)'s import may already pass; say which). Paste it.
5. **Commit 2, `T-167: the PRD problem statement in the briefing; a missing PRD is an ISSUE where /start shows it`:**
   the ruling, plus the two named row updates in `briefing-budget.test.ts` and any allowed row from the list above.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Then
   `git log --oneline 304d5639..HEAD` shows 2 lines and `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t167 file, then step 3's command again (30-minute cap). Paste
   all three.
8. **Mutants** (edit, run the t167 file only, paste, `git checkout -- <file>`, confirm a clean tree; never commit):
   - M1: the flag-on branch returns `warn` → P1 red.
   - M2: `describeProblemStatement` returns `""` when there is no PRD → P2(c) red.
   - M3: the whole section is taken, table included → P2(a) red.
   - M4: `renderBudgeted` drops `i.problem` → P4 or P5 red.
9. `git diff --name-only 304d5639..HEAD` must show only: `.agents/SYSTEM/greeting.json`,
   `open-brain/src/shared/doc-path.ts`, `open-brain/src/pipelines/sync/checks.ts`,
   `open-brain/src/pipelines/session-start/briefing.ts`, `open-brain/src/pipelines/session-start/start-report.ts`,
   `open-brain/src/pipelines/session-start/greeting-flags.ts`,
   `open-brain/tests/pipelines/session-start/t167-problem.test.ts`,
   `open-brain/tests/pipelines/session-start/briefing-budget.test.ts`, plus the allowed rows you listed. Anything else:
   STOP, BLOCKED.
10. `git push origin fix/t167-problem-statement` (never force). `git ls-remote origin refs/heads/fix/t167-problem-statement`
    must equal `git rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t167-problem-statement --title "T-167: the PRD problem statement in the briefing; a missing PRD is an ISSUE where /start shows it" --body "Brief: docs/loops/t167-problem-statement-brief.md."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Known red on the desktop

`tests/cli-flags*.test.ts` R185-8 is environmental; it is not in this brief's runs. Do not run the full suite.

## Reply

The first line is `READY T-167 <sha40> PR #<n>` or `BLOCKED T-167 <reason>`. Then each command with its output: the base
run, the red run, tsc, the t167 run, the second wide run, the allowed-row list (or "none"), the mutants, the name-only
diff, `ls-remote` = `rev-parse`, the PR URL and CI. At most 2 attempts at a red. Mark anything not run `NOT RUN`. If the
code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
