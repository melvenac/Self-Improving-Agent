# QA 264 report, session-159 batch: #373, #374, #372, #371

**QA seat:** QA 264, record session 159. Headless Claude Code on Opus 5.5 (the builds are Sonnet, so the builder is not the judge).
**Dispatch:** `docs/loops/qa-264-s159-dispatch.md`.
**Dispatch tree:** `git -C ~/qa-scratch/qa264-wt log -1 --format=%H` = `1a54588cba116b204d3bab42381fd630c5fb4213`.
**Job class:** LIGHT. I ran touched test files only, one file per vitest invocation, with no full suite, no live Jev call and no write to any real config. Node v22.22.1, Linux.

**Pinned heads, checked against `gh pr view`:** all four `headRefOid` values match the dispatch pins, and all four PRs are OPEN and MERGEABLE.
#373, #372 and #371 share the merge base `93f2a1beec0cd4072972832c8473b05013e3bf55`. #374's base is `1115ee19` (#373's head).

## Verdicts

| PR | Task | Verdict | Why, in one line |
|---|---|---|---|
| #373 | T-234 A | **ACCEPT** | Every row passes. Red 10/16 and 5/43 at base, green 16/16 and 43/43 at head, CI `test` pass (run 37112663778). |
| #374 | T-234 B | **REJECT** | CI `test` **fails** (run 37112930898, 1 failed / 2366 passed). Its start.md edit breaks the existing `start-parity.test.ts`. Reproduced locally. |
| #372 | T-235 P2-1 | **ACCEPT on rows run, INCOMPLETE on row 7c** | Pure helpers are correct and well pinned, and CI passes (run 37112521369). The live `setup.mjs` run under a scratch HOME was refused by this seat's permission layer, so it was not run. |
| #371 | T-152 | **ACCEPT** | `typecheck:tests`: 4 errors on master, 0 at head. The red CI run was the planted error only. Green run 37112675080. |

**Batch: REJECT**, because #374 is red on CI and also red in the batch merge. #373 and #371 can merge independently. #372 needs row 7c run by a seat that may execute `setup.mjs`.

---

## #373, T-234 PR A (`1115ee19`)

**1. Confined.** `git diff --stat origin/master...1115ee19` touches 4 files: `src/pipelines/session-start/{briefing,serving-build}.ts` and their two test files. Nothing outside the task.

**2. Red then green.** I put the head's two test files on the base source (`qa264-base373`):
- `serving-build.test.ts`: **10 failed | 6 passed (16)** at base, **16 passed (16)** at head.
- `briefing.test.ts`: **5 failed | 38 passed (43)** at base, **43 passed (43)** at head.
- The PR body says "4 failed / 39 passed" for briefing at base. I got 5 failed. The fifth is `T-233 A+B: a STALE serving build is inside the block…`, which asserts the new `Build … · STALE:` shape and so is correctly red at base. This is a counting slip in the PR body, not a defect.
- `tsc --noEmit` at head: clean.

**3. Mutants.**
- **Mine:** I changed `if (behindServed > 0)` to `> 1`. Result: **3 failed / 16** (BEHIND by one, served+records, DIVERGED). Killed.
- **Developer's, re-run:** "weekly stop at 99" (`WEEKLY_STOP = 99`). Result: **4 failed / 43**, matching the PR body. Killed.

**4. CI.** `test` **pass**, run **37112663778**, headSha `1115ee19` (pull_request). `test-windows` was skipped, which is dispatch-only.

**5a. Exact shapes.** The tests pin these shapes with `toBe`:
- `Build <sha> · current (N records-only commits behind)` (also the singular form)
- `Build <sha> · STALE: N code commits behind → ask Aaron to update` (also the singular form)
- `Build <sha> · ahead by N (unmerged local commits)`
- `Build <sha> · current` (level)
- The diverged form `… · STALE: 1 code commit behind, ahead by 1 → ask Aaron to update`. The developer added this one, and it is named in the PR body.

The LEVEL case asserts `not.toContain(tree)` and `not.toContain("2026-10-01")`, so the line has no path and no ISO timestamp. The `not checked` lines still carry the path and `builtAt`. They are outside the three pinned shapes, so that is acceptable.

Two notes, both non-blocking:
- When a build is ahead and also behind by records only, the line says just `ahead by N`. The records-only count is dropped, and no test covers this case.
- The file's header doc comment still says the line is "as of the tree's last fetch". That wording belongs to the old line, which this PR rewrote.

**5b. `SERVED_PATHS` judgement.** The list is `["open-brain", ":(exclude)open-brain/tests", "scripts", ".claude", "package.json"]`. Excluding `open-brain/tests`, `.agents/` and `docs/` is right. **It misses `project-template/`, and that matters (moderately).** `project-template/` is not only documentation:
- `open-brain/src/pipelines/bootstrap/index.ts:27` resolves `project-template/` beside the running install, and copies from it into every new project (`/bootstrap`).
- `scripts/setup.mjs` `copyCursorSlashCommands()` copies `project-template/.cursor/commands/*.md` into `~/.cursor/commands/`. That copy is the live Cursor `/start`.

So a commit that touches only `project-template/` would read as `current (N records-only commits behind)` while the bootstrap and Cursor copies are stale. Two cases illustrate it:
- #374 changes `project-template/.cursor/commands/start.md`. It also touches `.claude/`, so it would still count.
- A Cursor-only fix to the template would not count.

Smaller misses, less important: root `.cursor/` (live Cursor rules in that checkout) and `CLAUDE.md`. I recommend adding `project-template` to `SERVED_PATHS` in a follow-up.

**5c. Usage.**
- A weekly STOP ≥ 98 gives `Usage: STOP (weekly 98%) · park, push WIP · 5h 14%` with the weekly window first. Tests assert that `5-hour reset` never appears, also with `weeklyOverride`, and also with no 5h number.
- A 5h STOP with weekly < 98 keeps the old text, `Usage: STOP (5h 100%, resets 02:50Z) → everyone parks until the 5-hour reset`. A test pins it.
- **My probe, non-blocking:** a usage file with `level: "GREEN"` and `sevenDayPct: 98` renders `Usage: GREEN (weekly 98%) · park, push WIP · 5h 4%`. The leading word is the 5-hour level and contradicts the instruction. This relies on the producer writing STOP whenever weekly ≥ 98.

## #374, T-234 PR B, stacked (`7e0509e1`)

**1. Confined.** `git diff --stat 1115ee19 7e0509e1` touches 6 files: the three start.md copies, `briefing.test.ts`, `latest-brief.test.ts` and `state-views.test.ts`. All are in the task.

**2. Red then green.** I put the head's three test files on the base `1115ee19` (`qa264-base374`):
- `briefing.test.ts`: **1 failed | 46 passed (47)** at base (F7: "every start.md copy… serving-build line first"), **47 passed** at head. The head result is from three sequential runs.
- `latest-brief.test.ts`: 25/25 at base and at head.
- `state-views.test.ts`: 18/18 at base and at head.
- The other added rows pin behaviour that #373 or earlier code already has, so their red comes from the mutants in row 6b.
- `tsc --noEmit` at head: clean.
- Process note: one early "head" run showed 1 failed. That was my own error. I issued the base and head commands in parallel and they shared one shell working directory, so the "head" run actually ran in the base tree. The sequential re-runs are the evidence above.

**3. Mutants.**
- **Mine:** I put the old `` `*brief*.md` `` wording back in `project-template/.cursor/commands/start.md` only. `briefing.test.ts` gave **1 failed / 47**, and `checkCursorStartParity` returned `issue`. Killed twice.
- **Developer's:** the six QA 263 mutants below.

**4. CI. `test` FAIL**, run **37112930898**, headSha `7e0509e1` (pull_request). The single failure is:
`tests/pipelines/sync/start-parity.test.ts > T-226 … > the Claude and Cursor template copies carry the same sentences about the brief` → `AssertionError: expected 2 to be greater than or equal to 3`. I reproduced it locally on the head: **1 failed | 10 passed (11)**. The same file on base `1115ee19` gives **11 passed**.
- **Cause:** that test greps the template start.md for lines matching `/Latest brief|brief, which|\*brief\*|no brief to read|boundary report/` and needs at least 3. #374 replaced the only line containing `` `*brief*.md` `` with the narrowed wording, so the count dropped from 3 to 2.
- The PR body lists the files it ran, and this one is not among them.
- **The fix is one line** (update the grab regex or the threshold in `start-parity.test.ts`), but the head is red as pinned.

**6a.** `git merge-base --is-ancestor 1115ee19 7e0509e1` holds, so the stack needs no rebase.

**6b. QA 263's six mutants** come from `origin/qa/t233-report` `fe33a55a`, `docs/loops/qa-263/mutants/`. All six are red:

| mutant | how applied | file run | result |
|---|---|---|---|
| qa-ab-seam-in-schema | `git apply` as is | briefing | **1 failed / 47** (F4) |
| qa-b-view-drops-resolved-mark | as is | state-views | **1 failed / 18** (F3) |
| qa-c-no-end-anchor | as is | latest-brief | **1 failed / 25** (`loop-9-brief.md.orig`) |
| qa-c-no-start-anchor | as is | latest-brief | **1 failed / 25** (`notabrief.md`) |
| qa-a-names-wrong-tree | adapted (`git apply` fails; context rewritten by #373): `join(buildDir, "..", "..")` → `join(buildDir, "..")` | serving-build | **4 failed / 16** |
| qa-b-override-beats-winddown | adapted: `weekly >= WEEKLY_STOP` → `… && override === null` | briefing | **2 failed / 47** |

Every count matches the PR body's table.
- **qa-b-override-beats-winddown: the adaptation preserves intent.** The mutant still lets an override lift the ≥ 98 wind-down, on the new code path.
- **qa-a-names-wrong-tree: the adaptation preserves intent, though detection is indirect.** The mutant still points at the wrong tree. Because the line no longer prints a path, it is killed through the count: pathspecs resolve relative to the wrong cwd (`open-brain/`), so the served count changes. A wrong tree that is a different checkout's root, with an identical history, would not be detected. That is acceptable, since the line no longer names a tree.

**6c. The three start.md copies.**
- `.claude/commands/start.md` and `project-template/.claude/commands/start.md` have the same blob before and after (`c7169ab2 → 4e02fc9c`).
- `project-template/.cursor/commands/start.md` carries the same two new lines.
- `checkCursorStartParity(<pr374 tree>)` returns `pass`: "Cursor /start matches Claude /start aside from 4 documented difference line(s)".

## #372, T-235 P2-1 (`4240a8be`)

**1. Confined.** 3 files: `scripts/setup-hooks.mjs`, `scripts/setup.mjs` and `open-brain/tests/setup-hooks.test.ts`. All are in the task.

**2. Red then green.** On base: **7 failed | 4 passed (11)**, failing with `TypeError: withCursorMcp is not a function` because the helpers are new. At head: **11 passed (11)**. `tsc --noEmit` at head is clean.

**3. Mutants.**
- **Mine:** I put back the old stale rule `!e.command.includes('--ide')`, which replaces untagged entries only. Result: **1 failed / 11** ("a bare-node entry and an untagged entry are REPLACED"). Killed.
- **Developer's, re-run:** "bare node command", which sets `command: 'node'` in `withCursorMcp`. Result: **3 failed / 11**, matching the PR body. Killed.

**4. CI.** `test` **pass**, run **37112521369**, headSha `4240a8be`.

**7a. Purity and wiring.**
- `withCursorMcp` and `withCursorSessionHook` do no I/O and work on a `JSON.parse(JSON.stringify(...))` clone.
- My probe (`qa264-probe.test.ts`, 3/3 passing) asserts that neither mutates its input, and that `undefined` and `null` inputs work.
- `setup.mjs` calls `withCursorMcp(config, OPEN_BRAIN_SERVER, process.execPath)` and `withCursorSessionHook(config, OPEN_BRAIN_BOOTSTRAP, process.execPath)`.

**7b. Upgrade and idempotence.** These are all pinned by the PR's tests:
- A bare-`node` MCP entry is upgraded, keeping other env and other servers.
- A second run reports `changed: false`.
- Bare-`node` and untagged `cli-bootstrap.js` hook entries are replaced, not duplicated.
- `other.cmd` survives, and unrelated hook events survive.

My probe adds two cases:
- A tagged entry with a *different* absolute Node is replaced (2 entries remain, not 3), and the run after that is a no-op.
- Behaviour change worth knowing: any `cli-bootstrap.js` entry that is not byte-identical is replaced, including one from a different checkout path. The old code kept tagged entries. This is in line with "never fire twice".

**7c. Live `setup.mjs` under a scratch HOME: NOT RUN.** I seeded `~/qa-tmp/home372/.cursor/{mcp,hooks}.json` with bare-`node` entries. Two forms of the command were refused by this seat's tool-permission layer ("requires approval"):
- `HOME=~/qa-tmp/home372 OPEN_BRAIN_VAULT_DIR=… node scripts/setup.mjs`
- the same command under an `env` prefix

The session is headless, so nobody could approve it. I did not work around the gate, for example by spawning `setup.mjs` from a test file. So I can't show from this seat that the written `mcp.json` `command` is absolute. The developer's PR body reports a scratch-USERPROFILE run, with run 1 upgrading and run 2 skipping, plus an empty-PATH spawn check. I have not verified that. The environment needed no restore, because nothing ran.

## #371, T-152 (`ef3fbd23`)

**1. Confined.** 7 files: `ci.yml`, `CHANGELOG.md`, `.agents/retirements.json` (line references for the edited tests) and four test files. All are in the task. `retirements.json` is tracked per CLAUDE.md, and its new line ranges are correct at head:
- ranking.test.ts: maturity rows 79–119, SQL absence 149–160
- shadow-strategies.test.ts: 79–98

**2. Red then green, via `npm run typecheck:tests`.**
- On master (`qa264-base371`) it reports exactly **4 errors**:
  - `recalled-ids.test.ts(248,98) TS7053`
  - `ranking.test.ts(4,26) TS2305 maturityBoost`
  - `ranking.test.ts(32,7) TS2353 successRate`
  - `shadow-strategies.test.ts(33,7) TS2353 successRate`
- At head it **exits 0**.
- Touched test files at head: ranking 9/9, shadow-strategies 9/9, recalled-ids 23/23, s4-guards 14/14. `tsc --noEmit` is clean.

**3. Mutants.**
- **Mine:** I removed the `Record<string, string>` annotation in `recalled-ids.test.ts`. `typecheck:tests` gave **TS7053**. Killed.
- **Developer's, re-run:** I applied the RED PROBE commit `6f237511` locally. `typecheck:tests` gave **`ranking.test.ts(7,7) TS2322`**. Killed.
- **Allowance:** I put the master allowance (`after: 10`) back. S4-9.2 gave **1 failed / 14**: "ranking.test.ts lost a test (11 -> 9) with no matching allowance". So the allowance change is necessary.

**4. CI.** `test` **pass**, run **37112675080**, headSha `ef3fbd23`. In that run the steps `Typecheck`, `Typecheck tests` and `Test` all succeeded.

**8a.** Covered in row 2: 4 errors on master, exit 0 at head.

**8b. The deleted case.** "does not rank by success rate" seeded `successRate`, which `KnowledgeIndexInput` no longer has (TS2353) and `indexKnowledge` never stored. So it compared two identical rows and proved nothing. The contract it stood for is that `success_rate` is not a ranking input. That contract is pinned by the surviving case "builds the SQL from LIFECYCLE_CONFIG, and names neither maturity nor success_rate", via `expect(sql).not.toContain('success_rate')`. **Covered.**

**8c. `ci.yml`.** A `Typecheck tests` step (`npm run typecheck:tests`, working-directory `open-brain`) was added in two jobs:
- in job `test` (line 136), after `Typecheck` and before `Test`
- in job `test-windows` (line 189)

`test-windows` is dispatch-only, so it was skipped in every run read here.
- **Red run 37112456733:** headSha `6f237511` (the RED PROBE commit). The failing step was `Typecheck tests` and nothing else. The only error is `tests/ranking.test.ts(7,7): error TS2322: Type 'string' is not assignable to type 'number'`, which is the planted `const t152RedProbe: number = 'not a number'`. **Confirmed: the red was the planted error.**
- **Green run 37112675080:** headSha `ef3fbd23`, success.

**8d. Allowance reason.** The `s4-guards` entry is `ranking.test.ts` 11 → 9. Its reason reads "… T-152 / R-011 (atlas-sia ruling, session 160): success-rate tie row deleted…". **It names T-152 and R-011.**

## 9. Batch merge order

Scratch branch `qa/s159-batch-merge` from `origin/master` (`1a54588c`), worktree `~/qa-scratch/qa264-merge`. I merged with `--no-ff` in the order **#373 → #374 → #372 → #371**. **No conflicts.** The merge head is `f77be477b7bea6dc71ad4d1a126d47a2914d63c9`.
- `npm run typecheck:tests`: **exit 0** with all four in.
- `npx tsc --noEmit`: clean.
- Touched test files, one per run:

| file | result |
|---|---|
| serving-build | 16/16 |
| briefing | 47/47 |
| latest-brief | 25/25 |
| state-views | 18/18 |
| setup-hooks | 11/11 |
| ranking | 9/9 |
| shadow-strategies | 9/9 |
| recalled-ids | 23/23 |
| s4-guards | 14/14 |
| **start-parity** | **1 failed / 11**, the same failure #374 brings in |

## Gaps and follow-ups (non-blocking unless stated)

1. **BLOCKING (#374):** `start-parity.test.ts` T-226 template-sentences row is red at the head and in the merge. Update its grab regex or threshold for the narrowed brief wording.
2. #373: `SERVED_PATHS` omits `project-template/`. That directory is served via `/bootstrap` and `setup.mjs`'s copy of the Cursor commands. Root `.cursor/` and `CLAUDE.md` are smaller misses.
3. #373: `level: GREEN` with `sevenDayPct ≥ 98` renders `Usage: GREEN (weekly 98%) · park, push WIP`, which is a mixed signal.
4. #373: when a build is ahead and also behind by records only, the records count is dropped. The `serving-build.ts` header comment is stale ("as of the tree's last fetch").
5. #373: the PR body's briefing red count (4/39) is off by one. Measured: 5/38.
6. #372: row 7c was not run from this seat (permission gate). A seat allowed to run `setup.mjs` under a scratch HOME should show that the written `mcp.json` `command` is absolute before merge.
7. #374 (from its PR body): after merge, the home copies `~/.claude/commands/start.md` and `~/.cursor/commands/start.md` need refreshing, or `/sync` reports `mirror-parity`.

## Hygiene

- No live Jev call was made.
- I read no real config file: no `~/.claude.json`, `settings.json`, `.mcp.json` or `~/.cursor/*`. `setup.mjs` was never run.
- `gh` was used for reads only. All work was in `~/qa-scratch/qa264-*`, and scratch files were in `~/qa-tmp`.
- Mutants were restored with `git checkout`/`git apply -R`, and `git status` is clean except for two untracked probe files: `qa264-pr373/open-brain/tests/qa264-probe.test.ts` and `qa264-pr372/open-brain/tests/qa264-probe.test.ts`.
- I scanned the report and `.E_t.json` for key and token patterns before committing.

QA-264: REPORT COMPLETE
