# QA 294 (s164g) report: #516 FLEET-AE

**VERDICT: REJECT** — PR #516 at pinned head `1bc4d20dc15cb4271428bc6879e4de414cec47e1` (CI 37784203945, `test` green).

**Blocking finding:** the generated `.mdc` header names a SHA that is **not** the source blob SHA. It names
`2d74077c035433e79572fe9b39c6240f6137b3f0`. `git rev-parse 1bc4d20d:.agents/roles/developer.md` is
`c613be4d898d67daf24d46137fbc69ed996fc890`. The header SHA is the git-blob hash of the *extracted section text*, which
is not an object in the repository (`git cat-file -t 2d74077c…` gives `fatal: could not get object info`). Row 3 fails as
written. Everything else passes, and one test gap (QA mutant m4) is listed below.

- **QA:** QA 294, record session 164, prefix `s164g`. Headless Claude Code (Opus) on the laptop (Windows 10, Node v22.23.2).
- **Dispatch:** `docs/loops/qa-294-s164g-dispatch.md` at DISPATCH_SHA `7c2d034d598c65b621d926537549649a884e4e3b`.
- **`git -C C:/qa-scratch/qa294-wt log -1 --format=%H`** → `7c2d034d598c65b621d926537549649a884e4e3b`.
- **PR head check:** `gh pr view 516` → `headRefOid 1bc4d20dc15cb4271428bc6879e4de414cec47e1`. Checked at the start and
  again before the report was written. It equals the pin. Base: master; merge-base `3ccfeaef0d053dcd3f36287818e01481ab51c994`.
- **Trees:** `C:/qa-scratch/qa294-wt` (dispatch, master; also the report branch), `C:/qa-scratch/qa294-pr516` (head),
  `C:/qa-scratch/qa294-m1..m4` (QA mutants), `C:/qa-scratch/qa294-w7 crlf` (row 7 clone, path with a space).
- **Environment:** every command ran through `C:/qa-tmp/run.mjs`. It sets `TEMP`/`TMP`/`TMPDIR`, `HOME`/`USERPROFILE`,
  `KNOWLEDGE_V2_DB`, `OPEN_BRAIN_DATA_DIR`, `npm_config_cache` and `LOCALAPPDATA` under `C:/qa-tmp/env`, and `CLAUDE_PID`
  is unset. No live record, real DB, real data dir, vault or settings file was read or written. No Jev call was made,
  and no key was printed.
- **Narrow:** one test file per vitest run, mutants on touched product files only, `tsc --noEmit` = 0, and
  `npm run typecheck:tests` = 0 on the head. No full suite was run.

## Row 1: Confined — PASS

`git diff --stat origin/master...1bc4d20d` lists 22 files:

| File | Allowed by |
|---|---|
| `.agents/SYSTEM/hub-partner-seats.json` | named |
| `.cursor/rules/developer-building-checks.mdc` | `.cursor/rules/` |
| `CHANGELOG.md` | named |
| `open-brain/src/pipelines/session-start/briefing.ts` | `open-brain/src` |
| `open-brain/src/pipelines/sync/developer-building-checks.ts` (new) | `open-brain/src` |
| `open-brain/src/pipelines/sync/index.ts` | `open-brain/src` |
| `open-brain/src/scripts/gen-cursor-rules-cli.ts` (new) | `open-brain/src` |
| `open-brain/src/server.ts` | `open-brain/src` |
| `open-brain/src/shared/state-schema.ts` | `open-brain/src` |
| `open-brain/src/shared/state-writer.ts` | `open-brain/src` |
| `open-brain/tests/pipelines/__snapshots__/fleet-ae-f5.test.ts.snap` | tests |
| `open-brain/tests/pipelines/fleet-ae-{a4,f1..f9}.test.ts` (10 files) | tests |
| `scripts/gen-cursor-rules.mjs` (new) | `scripts/` |

`git diff --name-only origin/master...1bc4d20d -- .agents/state.json` is empty, so `state.json` is untouched. On master's
record (blob `db929b4e…`) `grep -c '"standing"'` = 0, so no decision is tagged `standing`.

## Row 2: Mutant runs — PASS

Each mutant branch is one commit whose parent is `1bc4d20d` and which touches only a product file. Each CI run is
`failure` on the mutant SHA, with exactly 2 failed tests, and both are the rows that the mutant targets:

| Branch @ SHA | Run | Failing tests (from `--log-failed`) |
|---|---|---|
| `loop/fleet-ae-mut-1` @ `9c16d5f0` (`issue`→`warn`) | 37784365983 | `fleet-ae-f2 > editing the section without regenerating makes sync FAIL…`; `fleet-ae-f8 > cursor-rules-current fails when the .mdc drifts (mut-1…)`. `expected 'warn' to be 'issue'` |
| `loop/fleet-ae-mut-2` @ `c457c3a8` (`.slice(0, 5)`) | 37784370489 | `fleet-ae-f6 > 40 standing decisions all render…` (`expected […] to have a length of 40 but got 5`); `fleet-ae-f8 > STANDING RULES lists every standing decision (mut-2…)` (`expected 5 to be 15`) |
| `loop/fleet-ae-mut-3` @ `c79f1a74` (invent a decision) | 37784375859 | `fleet-ae-f7 > set_standing on an unknown id refuses and writes nothing`; `fleet-ae-f8 > set_standing refuses unknown decision ids (mut-3…)` |

The head run 37784203945 is `success` on `1bc4d20d`. My own run on the head, one file per run: a4, f1–f7 and f9 each
`1 passed`, f8 `3 passed`, all exit 0, and `git status` was clean afterwards.

## Row 3: A, re-derived — FAIL (header SHA); the rest passes

Run on `qa294-pr516`:

- `node scripts/gen-cursor-rules.mjs` → `unchanged …developer-building-checks.mdc`, exit 0. A second run gives the same
  result. `git status --porcelain` is empty after both runs.
- **Body equals the section:** I extracted it independently (from the `## Building checks` line up to the next `## `
  line, `## Machine lease on shared QA machines (T-204, D-119, G-054)`, then normalised to LF). The section is 1931 bytes,
  the `.mdc` body after the header comment is 1931 bytes, and the two are `equal: true`.
- `alwaysApply: true` is present (1 line).
- **The header names the path, but not the right SHA.** The header reads
  `<!-- generated from .agents/roles/developer.md @ 2d74077c035433e79572fe9b39c6240f6137b3f0 — run: node scripts/gen-cursor-rules.mjs -->`.

  | | SHA |
  |---|---|
  | `git rev-parse 1bc4d20d:.agents/roles/developer.md` (the dispatch's "correct blob SHA") | `c613be4d898d67daf24d46137fbc69ed996fc890` |
  | `git hash-object` of the extracted section | `2d74077c035433e79572fe9b39c6240f6137b3f0` |
  | header | `2d74077c035433e79572fe9b39c6240f6137b3f0` |

  The cause is `expectedDeveloperBuildingChecksMdc`, which computes `gitBlobSha(section)` rather than the file's blob.
  `git cat-file -t 2d74077c…` gives `fatal: git cat-file: could not get object info`, while `c613be4d` gives `blob`. So
  the header says "from developer.md @ X", and X cannot be resolved with git. A reader trying to trace the rule back to
  its source revision has nothing to look up. No test asserts the header SHA.
  **Decision for the planner:** if the header is switched to the file blob, any edit *outside* the section also makes
  `cursor-rules-current` FAIL until the file is regenerated. My control run showed that today an outside edit passes
  (see below). Two fixes would work: hash the file and accept regenerating on any `developer.md` edit, or keep the
  section hash and relabel the header as "section sha", which needs the dispatch row and the A1 wording to change. As
  written, the row fails.

**Real `/sync` (`node open-brain/build/cli.js sync --check`; the documented flag is `--check`, not `--check-only`).** This
checkout has 2 issues before any edit: `template-personal-names` and `worktree-layout`, which is this machine's many QA
worktrees. So exit is 1 throughout. The measure is `cursor-rules-current` moving in and out of ISSUES, which takes the
issue count between 2 and 3.

| Step | Result |
|---|---|
| clean head | `2 issues`; `cursor-rules-current` not among them |
| one word edited in the section (`Use a real fixture.` → `fixtures.`) | `3 issues`: `cursor-rules-current: .cursor/rules/developer-building-checks.mdc is out of date with .agents/roles/developer.md — run node scripts/gen-cursor-rules.mjs` |
| `node scripts/gen-cursor-rules.mjs` (`wrote …`) then sync | `2 issues`; passes again |
| `.mdc` deleted | `3 issues`: `cursor-rules-current: .cursor/rules/developer-building-checks.mdc missing — run node scripts/gen-cursor-rules.mjs` |
| control: edit outside the section (a different `##` heading) | `2 issues`; passes |
| control: only the header SHA in the `.mdc` hand-edited | `3 issues`: out of date. The check compares the whole file. |

The edited files were restored with `git checkout --` afterwards, and the tree ended clean.

## Row 4: A3 and A4 — PASS

- **A3:** `hub-partner-seats.json` `requiredBlock` = `{"path":".agents/roles/developer.md","heading":"Building checks"}`.
  I resolved it independently. `## Building checks` occurs once, the resolved text is 1931 bytes, the `.mdc` body is
  1931 bytes, and they are `equal: true`.
- **A4:** the real hook `open-brain/build/cli-bootstrap.js` was run on a temp git checkout at `C:/qa-tmp/a4-repo`, with
  AGENT.md `role: developer` and the head's `developer.md` and `shared.md`, and with the payload
  `{"cwd":"C:/qa-tmp/a4-repo","session_id":"qa294-a4","hook_event_name":"SessionStart"}` on stdin. Exit was 0. Output:
  ```
  Agent: Builder (developer) — partner: Atlas
  Role knowledge loaded (2 of 2):
    .agents/roles/developer.md @ cf92282 2026-10-08
    .agents/roles/shared.md @ cf92282 2026-10-08
  ```
  As a control, I changed the role to `planner`, which gives `.agents/roles/planner.md — ABSENT (planner)` and a
  `ROLE FILE MISSING` line. So the output depends on the role, not on a constant.

## Row 5: E through the real MCP path — PASS

I used the MCP SDK `Client` with `StdioClientTransport` against `node open-brain/build/server.js`, built from the head.
The temp project was `C:/qa-tmp/e-proj`, which holds a copy of `open-brain/tests/fixtures-state/state.json` (rev 7, D-001..D-006,
and one developer handoff with 3 watch_out and 2 open_questions). `ob_set_session` refused because there is no
SessionStart proof under the redirected HOME. `add_decision` and `set_standing` do not need a session, and
both said so with `NOTE: no registered session…`.

- `add_decision {standing:true}` → rev 7→8, `add_decision D-007`, `NOTE: add_decision D-007: standing true`.
- `set_standing D-002 true` → rev 8→9, `NOTE: set_standing D-002: standing false → true`. On disk, both rows carry keys
  `["id","title","date","note","standing"]`.
- `ob_start`: WATCH OUT at line 102, STANDING RULES at 107, OPEN QUESTIONS at 111, so it sits **between** them. Newest first:
  ```
  STANDING RULES
  - D-007 — QA294 standing via add_decision
  - D-002 — Loop 2 is read side only
  ```
- `set_standing D-007 false` → rev 9→10, `standing true → false`. The next `ob_start` lists only `- D-002 — …`, and the D-007 row's keys are back to
  `["id","title","date","note"]`.
- 40 more standing decisions in one `add_decision` batch (D-008..D-047) → `ob_start` shows 41 bullets, 40 of them bulk.
  The first is `- D-047 — QA294 bulk standing 40` and the last is `- D-002 — …`. It is still between the two sections, with no cap.
- `set_standing D-999` → `isError`: `ob_state refused: ops[0] (set_standing): unknown decision D-999`,
  `Revision: 11 (unchanged)`, `Nothing written.` I measured the revision at 11 before and 11 after, and the file's sha256
  `fc5c222dd6c0f5c4…` was the same before and after.
- Atomicity, extra: `[set_standing D-001 true, set_standing D-998 true]` → `isError`, revision 11→11, bytes unchanged.

## Row 6: Backward compatibility — PASS

The record was `git show origin/master:.agents/state.json` (blob `db929b4e6f75cd6348904fac50ec9c54da2c7c00`, 699725 bytes,
rev 354, 0 `standing`), copied twice into `C:/qa-tmp`. It was never the live file, and all three copies' sha256 were
unchanged afterwards (`50fbb99354ab30d0…`). Each server was built from its own tree (master `7c2d034`, head `1bc4d20`) and
ran `ob_start` through MCP stdio on a fresh, identical temp project. Both outputs are 539 lines. Full diff:
```
1c1
< Build 7c2d034 · current
---
> Build 1bc4d20 · STALE: 6 code commits behind, ahead by 1 → ask Aaron to update
12c12
< Session ID: none — no session proof for this server's parent process 85124 (C:\qa-tmp\env\home\.claude\open-brain\by-pid\85124.json absent: …)
---
> Session ID: none — no session proof for this server's parent process 89424 (C:\qa-tmp\env\home\.claude\open-brain\by-pid\89424.json absent: …)
126c126
< Build 7c2d034 · current
---
> Build 1bc4d20 · STALE: 6 code commits behind, ahead by 1 → ask Aaron to update
540c540
< Total returned words: 6720 (~10745 tokens)
---
> Total returned words: 6744 (~10772 tokens)
```
The build line differs, and appears twice: once in the header and once as the first `## Briefing` line. The other two
differences follow from the build line or the process: the PID in the no-proof line is per process, and the word count
follows from the longer build line. `STANDING RULES` does not appear in the head's output. Apart from the build line,
the `## Briefing` block (from line 125) is identical.

## Row 7: Windows — PASS

`git clone -c core.autocrlf=true` of the head was made into **`C:/qa-scratch/qa294-w7 crlf`** (a path with a space),
followed by `npm ci` and a build in that tree.
- The repo's `.gitattributes` pins `.agents/roles/developer.md` to `eol: lf` (T-151), so even under `autocrlf=true` the
  checkout is LF (0 CRLF lines). To test the real condition, I then **forced CRLF on disk** for `developer.md` (121 CRLF
  lines).
- The generator ran from the spaced path: `unchanged C:\qa-scratch\qa294-w7 crlf\.cursor\rules\developer-building-checks.mdc`,
  exit 0, twice. After the `.mdc` was deleted, regenerating from the CRLF source gave bytes **identical** to the committed
  LF-tree `.mdc` (`true`, 2178 bytes).
- `/sync --check` twice with the CRLF `developer.md` gave `33 passed … 1 issues` both times. The one issue is
  `template-personal-names`, and `cursor-rules-current` is absent from ISSUES. I then forced the `.mdc` itself to CRLF and
  ran it twice more, with the same result. The generator still reports `unchanged`. There is no flap.
- F9 (`fleet-ae-f9.test.ts`) also passes on the head, at `1 passed`.

## Row 8: QA mutants — every requested mutant is killed; one extra probe (m4) survives

Each is one commit on `1bc4d20d`, touching a product file only, and pushed through `push-qa.mjs` with a read-back. One
vitest run per fleet-ae test file:

| Mutant | Branch @ SHA | Edit | Red test (the only red) |
|---|---|---|---|
| (a) one line too many | `qa/s164g-m1` @ `e5c1fdb2f8eb6f051a9c402930eb62312659bfae` | `extractBuildingChecksSection` keeps the next `## ` heading line | `fleet-ae-f1 > a second run is a no-op and the .mdc body equals the Building checks section`: `expected true to be false` |
| (b) `add_decision` ignores `standing` | `qa/s164g-m2` @ `e06aa9d30993312044ce128d5e53398d0d4e5749` | row built without `standing` | `fleet-ae-f4 > add_decision {standing:true} and set_standing render under STANDING RULES…`: `expected 'Serving build: …' to contain 'STANDING RULES'` |
| (c) oldest first | `qa/s164g-m3` @ `4ba7e38046bfb05739080ee5b126af220540bb7a` | `.reverse()` removed | `fleet-ae-f6 > 40 standing decisions all render in STANDING RULES`: `expected '- D-100 — Standing rule 0' to contain 'D-139'` |
| (d) extra probe: placement | `qa/s164g-m4` @ `8e37593fdd84d801d98b167e6c3f3806cad1ea8b` | `standingRulesLines` pushed *above* WATCH OUT | **none: a4, f1–f9 all green**, `tsc` ok. Through MCP: STANDING RULES at line 102, WATCH OUT at 106, `between: false` |

On (a): the dispatch's other form, "copies the heading line too", does not apply. The implementation deliberately
includes `## Building checks` in the body, and row 3 confirmed it is byte-equal to the section with the heading. Only
"one line too many" is a real defect, and F1 kills it.

## Findings

1. **BLOCKING: the header SHA is not the source blob SHA** (row 3, A1). See row 3. The file is
   `open-brain/src/pipelines/sync/developer-building-checks.ts` in `expectedDeveloperBuildingChecksMdc`
   (`gitBlobSha(section)`). Nothing in the repo resolves the SHA, and no test pins it.
2. **Test gap: placement is unasserted (E3).** QA mutant m4 moves STANDING RULES above WATCH OUT and survives every
   fleet-ae test. F4 checks only that the text is present, and F6/F8 only count bullets. Today's product puts the section in
   the right place, which I verified by hand in row 5. Recommend a row that asserts index(WATCH OUT) < index(STANDING RULES) <
   index(OPEN QUESTIONS).
3. **Non-blocking test hygiene: tests write into the checkout they run in.** F1 calls `writeDeveloperBuildingChecksMdc(ROOT)`
   on the repo itself. Under mutant (a), the red run **left `.cursor/rules/developer-building-checks.mdc` modified** in
   `qa294-m1` (`git status`: ` M`). F2 rewrites the real `developer.md`, and restores it in `afterEach`. F8's first test
   appends to the real `.mdc` and restores it only *after* its `expect`, so on red it leaves the file dirty. The building
   checks say "Use a real fixture"; a temp checkout, as F9 already uses, avoids it.

## Unsandboxed commands

Unsandboxed commands: none.

## Pushed branches

`qa/s164g-m1`, `qa/s164g-m2`, `qa/s164g-m3`, `qa/s164g-m4` (listed above), and `qa/s164g-report` (this file). No issue or
PR was created, commented on or edited.

QA-294: REPORT COMPLETE
