# BRIEFING-FIX review (grok-sia-review), verbatim

Room [atlas, grok-sia-review] k57c639j4wkyp3y3vhfxxytn1s8fsdx6, job turn 43 (atlas), replies REVIEW 1/2 and 2/2. Committed verbatim by Atlas (planner, s165) per D-127. Head reviewed: loop/briefing-fix@19cb1e5f5157dacafdac9c71bb06a1ac71e5377a (PR #545).

```text
--- grok-sia-review ---
REVIEW 1/2 19cb1e5
Blind review of PR #545, loop/briefing-fix at 19cb1e5f5157dacafdac9c71bb06a1ac71e5377a, base 83185df3. Linux box, token-free scratch clone. `node --version` gives v22.23.3.
I re-ran the planner's checks on the box: 14 §6 files 167/167 (Test Files 14 passed, EXIT=0); `npx tsc --noEmit` EXIT=0.

FINDINGS
F1 [major] open-brain/src/server.ts:413 at 19cb1e5
claim: describeFleet gets the record's project name ("self-improving-agent"). Fleet seats are keyed by the short name ("SIA" in the brief's own example, W4). So for this repo the seats line is always empty.
evidence: `const projectName = sj.data.project.name;` (server.ts:413). `fleet: describeFleet(projectName, process.env, startNow),` (server.ts:439). .agents/state.json:5 `"name": "self-improving-agent"`. fleet.ts:49 `.filter((s) => s.project.toLowerCase() === want)`. A real ob_start with seats whose project is "SIA"/"sia" (R3 below) printed `Seats (self-improving-agent): none in fleet.json` and `... · seats  (verified 10-09 09:00 CDT)`.
scenario: Live SIA ob_start never lists atlas-sia or cursor-infra, which was clark §2's whole point. BF-F1 passes because the test hands in "SIA" directly. Fix: map the project to the fleet key, or match either name, and add a test through handleStart.

F2 [major] open-brain/src/pipelines/session-start/fleet.ts:41 at 19cb1e5
claim: Only missing or invalid JSON is handled. Valid JSON of the wrong shape throws, and that throw fails the whole ob_start. The brief says "The briefing still renders, and nothing throws".
evidence: `return { ok: true, data: JSON.parse(text) as FleetJson };` (no shape check). fleet.ts:49 `s.project.toLowerCase()`. On the box: FLEET_JSON containing `null` gives `THROWS: Cannot read properties of null (reading 'seats')`. `{"seats":[{"name":"a"}]}` gives `THROWS: Cannot read properties of undefined (reading 'toLowerCase')`. server.ts:521-523 then turns it into `ob_start error: ...` with isError.
scenario: A half-edited fleet.json, or a seat without "project", stops every seat's session start. Fix: wrap describeFleet in try/catch with an "unavailable (<path>: invalid shape)" line, and guard non-string fields.

F3 [minor] open-brain/src/pipelines/session-start/briefing.ts:308 at 19cb1e5
claim: Budgeted layout without SEATS: READS OWED is pushed after the Skills line, not on the line after `Latest brief:`. W3 says "READS OWED goes on the next line either way".
evidence: `if (seats !== null && i.latestBrief) out.push(`${i.latestBrief} · ${i.skills}`); else { if (i.latestBrief) out.push(i.latestBrief); out.push(i.skills); } if (i.readsOwed) out.push(i.readsOwed);` (lines 303-308)
scenario: In a budgeted repo with no seats data, the order is Latest brief / Skills / READS OWED. No test covers placement: `grep -n readsOwed tests/pipelines/session-start/briefing-fix.test.ts` finds nothing, so the W3 plumbing is untested in both layouts.

F4 [minor] open-brain/tests/pipelines/briefing-fix-sync.test.ts:31 at 19cb1e5
claim: BF-N4 is weak. The "fixture value" is computed by the same gitBlobSha the product calls, so it is tautological. The no-git property is only a source-text regex. PATH is never emptied.
evidence: `const fixtureSha = gitBlobSha(section);` `expect(src).not.toMatch(/execFileSync\(\s*["']git["']/);`
scenario: A spawn through any other helper (spawnSync, a wrapper) passes the test. A gitBlobSha regression passes too, because both sides change together. See the behavioural answer below: a PATH-emptied variant with a FIXED sha does pass at the head and does go red on mutant 7. Suggest adopting it.

F5 [nit] open-brain/src/pipelines/session-start/fleet.ts:108 at 19cb1e5
claim: An empty seat list, or every name cut, leaves a double space: `seats  (verified …)` / `seats  +40 more (verified …)`.
evidence: `budget = `${budgetCore}${names.join(", ")}${more}${suffix}`;` with budgetCore ending `· seats `. Seen in the R3 budgeted output.
scenario: Cosmetic. Print `seats none` when the list is empty.

F6 [nit] open-brain/src/pipelines/session-start/fleet.ts:92 at 19cb1e5
claim: The dashboard URL always gets a "/" appended, so a fleet.json URL that already ends in "/" prints "//".
evidence: `` `Hub: v${hubV} ${hubUrl} · Dashboard: v${dashV} ${dashUrl}/` ``
scenario: Cosmetic. Append the slash only when it is missing.

F7 [nit] open-brain/src/pipelines/bootstrap/index.ts:346 at 19cb1e5
claim: The write probe uses flag "wx" with a pid-named file. A leftover probe (crash between write and unlink, or pid reuse) makes a writable directory report "not writable".
evidence: `writeFileSync(probe, "", { flag: "wx" });`
scenario: Rare false refusal. Removing a stale probe first, or using a random suffix, avoids it.

BF-N4 BEHAVIOURAL ANSWER: yes. I used a scratch test file (deleted afterward) that sets process.env.PATH="" in-process and expects a FIXED sha, 2d74077c035433e79572fe9b39c6240f6137b3f0 (from real `git hash-object --stdin` on the section; it matches the .mdc header). Commands and output:
$ npx vitest run tests/pipelines/zz-n4-path.test.ts   (head)
 ✓ tests/pipelines/zz-n4-path.test.ts (1 test) 6ms
      Tests  1 passed (1)
$ (with mutant 7 applied) npx vitest run tests/pipelines/zz-n4-path.test.ts
   × N4 behavioural: PATH emptied 11ms
     → spawnSync git ENOENT
      Tests  1 failed (1)

--- grok-sia-review ---
REVIEW 2/2 19cb1e5
ROWS
R1 (BF-A1) $ git diff --name-only 83185df3..19cb1e5f
.cursor/rules/developer-building-checks.mdc
open-brain/src/pipelines/bootstrap/index.ts
open-brain/src/pipelines/session-start/briefing.ts
open-brain/src/pipelines/session-start/fleet.ts
open-brain/src/pipelines/session-start/latest-brief.ts
open-brain/src/pipelines/session-start/reads-owed.ts
open-brain/src/pipelines/sync/developer-building-checks.ts
open-brain/src/server.ts
open-brain/tests/fixtures-state/a2a-1c200b41-render.golden.txt
open-brain/tests/pipelines/__snapshots__/fleet-ae-f5.test.ts.snap
open-brain/tests/pipelines/briefing-fix-install.test.ts
open-brain/tests/pipelines/briefing-fix-sync.test.ts
open-brain/tests/pipelines/fleet-ae-f1.test.ts
open-brain/tests/pipelines/fleet-ae-f8.test.ts
open-brain/tests/pipelines/fleet-ae-f9.test.ts
open-brain/tests/pipelines/session-start/briefing-fix.test.ts
open-brain/tests/pipelines/session-start/briefing.test.ts
Result: every file is on the §9 list (the three start.md files were left untouched, which §9 allows). PASS.

R2 (BF-A5). Each mutant was edited on the scratch head, then I ran `npx vitest run <file> --testTimeout=20000` and restored with git checkout (`git status --porcelain` empty afterwards).
M1 BRIEFING_START set back to the long string. briefing-fix.test.ts: RED "BF-H1: plain ## Briefing header > legacy and budgeted layouts open with ## Briefing". AssertionError: expected '## Briefing (print everything down to…' to be '## Briefing' // Object.is equality. Tests 1 failed | 13 passed (14)
M2 USAGE_STALE_MINUTES = 100000. briefing-fix.test.ts: RED "BF-U2: stale set appends STALE with minutes". AssertionError: expected false to be true // Object.is equality. BF-U3 also red. Tests 2 failed
M3 source b (the collectHandoffPaths loop) removed. briefing-fix.test.ts: RED "BF-R2: handoff paths appear in source order, de-duplicated". AssertionError: expected -1 to be greater than 16. BF-R4 also red. Tests 2 failed | 12 passed (14)
M4 `${stale ?? ""}` removed from the header and the verifiedSuffix. briefing-fix.test.ts: RED "BF-F3: verifiedAt 25h old appends STALE in both layouts". AssertionError: expected '## Fleet (fleet.json, verified 10-07 …' to contain ' · STALE (verified '. Tests 1 failed | 13 passed (14)
M5 createdCopies unlink loop removed. briefing-fix-install.test.ts: RED "BF-P2: created absent copy is removed when a later rename fails". AssertionError: expected true to be false // Object.is equality. Tests 1 failed | 2 passed (3)
M6 preflightWrite(root) moved below the dirty-tree block. briefing-fix-install.test.ts: RED "BF-P1a: preflight refusal wins over dirty-tree commit message". AssertionError: expected 'uncommitted change outside the import…' to match /not writable/. Tests 1 failed | 2 passed (3)
M7 `const sha = execFileSync("git", ["hash-object", "--stdin"], { input: section, encoding: "utf8" }).trim();` plus its import. briefing-fix-sync.test.ts: RED "BF-N4: … matches gitBlobSha in process (no git hash-object)". AssertionError: expected 'import { execFileSync } from "node:ch…' not to match /execFileSync\(\s*["']git["']/. It is red only through the source regex (F4). Tests 1 failed (1)
None stay GREEN.

R3 (BF-A2, Linux). In the scratch copy: `npm ci` (exit 0) and `npm run build` (exit 0, "build stamped 19cb1e5").
DEVIATION: `node open-brain/build/cli.js start` prints no briefing at all; its whole output is the Session Start/Project/Session log/State/Inbox lines. The briefing exists only in ob_start (server.ts handleStart). So I ran a real ob_start: an MCP stdio client spawning `node open-brain/build/server.js` and calling ob_start with project_root set to a temp clone of the head. Env: HOME and KNOWLEDGE_V2_DB in tmp, FLEET_JSON pointing at a tmp fixture (verifiedAt 1h old; seats with project "SIA", "sia" and "X"), SIA_USAGE_FILE pointing at a fresh fixture (set 5 min old) or a stale one (set 60 min old). greeting.json briefing_budget was set false and then true.
--- briefing_budget=false, stale fixture (full block):
## Briefing
Build 19cb1e5 · ahead by 3 (unmerged local commits)
Usage: GREEN (5h 18%, resets 10-09 12:35 CDT; week 45% WELL AHEAD) → dispatches open · STALE (set 10-09 09:35 CDT, 60 min ago)
Session 166 — 2026-10-09 · self-improving-agent v0.45.0 · state rev 364
Drift: none

OBJECTIVE
s164/D-130: SIA is frozen at 'Makerspace migration proven'. Next: the Makerspace import (docs/loops/makerspace-import-brief.md; Maker lists the 17 uncommitted files first, routed via clark under SG-1), then BRIEFING-FIX. Parked: #437, #425, Jev cal 2. Every Cursor brief passes ~/Worktrees/cursor-brief-checklist.md. (since session 165)

NEXT
- [P0] T-022 Replace-on-write for `state` facts
- [P0] T-024 Rewrite the two genuine `obsolete-reference` hits
- [P0] T-031 Add agent attribution to sessions
41 active (12 P0, 14 P1, 13 P2, 2 P3); 85 done. Backlog order, not a decision: the pick-up below rules what starts.

## Fleet (fleet.json, verified 10-09 09:00 CDT)
Coordinator: clark · questions and Aaron's decisions go to clark
Hub: v1.21.0 <fixture-hub-url> · Dashboard: v1.15.0 <fixture-dash-url>/
Seats (self-improving-agent): none in fleet.json

PICK UP HERE
none recorded for this checkout (developer, proj)

STANDING RULES

BROKEN (44 gaps open; newest G-058)

Working tree: 1 uncommitted: .agents/SYSTEM/greeting.json
Latest brief: docs/loops/briefing-fix-brief.md (2026-10-09)
READS OWED (3): docs/loops/briefing-fix-brief.md · .agents/AGENT.md · .agents/SYSTEM/domains.json
Skills: self-improving-agent-gotchas, self-improving-agent-guide
## End Briefing
(STANDING RULES/BROKEN bullet lines omitted for size)
--- briefing_budget=false, fresh fixture: diff vs stale is line 3 only:
3c3
< Usage: GREEN (5h 18%, resets 10-09 12:35 CDT; week 45% WELL AHEAD) → dispatches open
---
> Usage: GREEN (5h 18%, resets 10-09 12:35 CDT; week 45% WELL AHEAD) → dispatches open · STALE (set 10-09 09:35 CDT, 60 min ago)
--- briefing_budget=true, stale fixture (full block):
## Briefing
Build 19cb1e5 · ahead by 3 (unmerged local commits)
Usage: GREEN (5h 18%, resets 10-09 12:35 CDT; week 45% WELL AHEAD) → dispatches open · STALE (set 10-09 09:35 CDT, 60 min ago)
Session 166 — 2026-10-09 · self-improving-agent v0.45.0 · state rev 364 · Drift: none
OBJECTIVE
s164/D-130: SIA is frozen at 'Makerspace migration proven'. Next: the Makerspace import (docs/loops/makerspace-import-brief.md; Maker lists the 17 uncommitted files first, routed via clark under SG-1), then BRIEFING-FIX. Parked: #437, #425, Jev cal 2. Every Cursor brief passes ~/Worktrees/cursor-brief-checklist.md. (since session 165)
SEATS: planner — claude-code sonnet desktop · builder T-235 cursor composer-2.5 qa-pc · forge T-200 cursor composer-2.5 qa-pc · infra — cursor composer-2.5 qa-pc · qa — claude-code sonnet qa-pc · research — claude-code sonnet desktop
FLEET: coordinator clark · hub v1.21.0 · dashboard v1.15.0 · seats  (verified 10-09 09:00 CDT)
PICK UP HERE · FOCUS: seat unknown for checkout proj
none recorded for this checkout (developer, proj)
STANDING RULES (20): D-140 D-137 D-135 D-130 D-127 D-126 D-123 D-120 D-119 D-118 D-117 D-113 D-091 D-069 D-065 D-062 D-061 D-055 D-031 D-029
Gaps: 44 open (newest G-058)
Working tree: clean
Latest brief: docs/loops/briefing-fix-brief.md (2026-10-09) · Skills: self-improving-agent-gotchas, self-improving-agent-guide
READS OWED (3): docs/loops/briefing-fix-brief.md · .agents/AGENT.md · .agents/SYSTEM/domains.json
## End Briefing
--- briefing_budget=true, fresh fixture: diff vs stale:
3c3
< Usage: GREEN (5h 18%, resets 10-09 12:35 CDT; week 45% WELL AHEAD) → dispatches open
---
> Usage: GREEN (5h 18%, resets 10-09 12:35 CDT; week 45% WELL AHEAD) → dispatches open · STALE (set 10-09 09:35 CDT, 60 min ago)
R3 result: the first line is exactly "## Briefing" in all 4 runs. STALE appears only with the stale fixture. READS OWED is on the line right after Latest brief (budgeted: after the shared "Latest brief · Skills" line). Fleet sits before PICK UP HERE in legacy and after SEATS in budgeted. PASS on every stated expectation, but the seats are empty because of F1.

R4 (BF-A3) $ git diff --numstat 83185df3..19cb1e5f -- open-brain/tests/fixtures-state open-brain/tests/pipelines/__snapshots__
4	4	open-brain/tests/fixtures-state/a2a-1c200b41-render.golden.txt
1	1	open-brain/tests/pipelines/__snapshots__/fleet-ae-f5.test.ts.snap
In both diffs every changed line is `-## Briefing (print everything down to the End Briefing line verbatim, then FLAGS)` / `+## Briefing`. PASS.

R5 (BF-A4) $ grep -o "section-sha [0-9a-f]* (git hash-object[^)]*)" .cursor/rules/developer-building-checks.mdc
section-sha 2d74077c035433e79572fe9b39c6240f6137b3f0 (git hash-object of the extracted section: trailing whitespace trimmed, one final LF)
$ node open-brain/build/cli.js sync --check   (exit 1)
ISSUES:
  template-personal-names: Template ships personal names — ... project-template/.cursor/commands/harness-audit.md ("Aaron") ...
Summary: 33 passed, 0 fixed, 4 warnings, 1 issues, 7 skipped
cursor-rules-current is not in ISSUES. It is printed directly as {"name":"cursor-rules-current","severity":"pass","message":".cursor/rules/developer-building-checks.mdc matches .agents/roles/developer.md"}. PASS. The exit 1 comes from template-personal-names, a file this PR does not touch.

R6 code review
- chicagoStamp: 2026-01-15T06:05Z gives "01-15 00:05 CST" (the 24→00 case), 2026-10-09T04:30Z gives "10-08 23:30 CDT". Across the DST fold, 11-01T06:30Z gives "01:30 CDT" and 07:30Z gives "01:30 CST". Correct.
- STALE: reason A is `mins > 45` with floored minutes, B is reset <= now, joined "; " with A first. A missing or unparseable set adds nothing. The STOP branch carries the suffix. Correct.
- READS OWED: order is brief, then handoff (pick_up, watch-outs, questions), then the AGENT/AGENT.local/domains files. De-duplicated by a Set, existence checked, cap 6 plus " · +K more". The same-day `>=` rule is correct. Placement is F3.
- FLEET cap: the loop includes " +K more" and the suffix in the 200 limit and cuts whole names from the right. The verified/STALE suffix is never cut. Correct apart from F5. Robustness: F2. Project key: F1.
- installCommands: P1 preflight now runs before the dirty check (line 423 vs 425). The readable() test happens before the stash message. P2 removes createdCopies before restoring renames. Correct. Nit F7.

looked: chicagoStamp/usage STALE — found nothing
looked: READS OWED (reads-owed.ts, latest-brief.ts refactor) — F3
looked: fleet.ts — F2, F5, F6
looked: server.ts plumbing — F1
looked: bootstrap P1/P2 — F7
looked: developer-building-checks N1/N4 and .mdc — found nothing
looked: tests quality (BF-* rows, mutants) — F3, F4
looked: security (paths, spawn, probe files) — found nothing beyond F7
time spent: ~35 min
SUMMARY: 0 blocking, 2 major (F1, F2), 2 minor (F3, F4), 3 nit (F5-F7). Mutants 1-7 all RED. R1 PASS, R3 PASS as specified (via ob_start, since cli start renders no briefing), R4 PASS, R5 PASS. BF-N4 PATH-emptied variant passes at head and kills M7.


```
