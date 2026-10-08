# QA 295 (s164h) report: #516 FLEET-AE r2

**VERDICT: ACCEPT** — PR #516 at pinned head `0ac17a7e155ec90b993c2e6084ac52a1a66845fd` (CI 37795146033, `test`
`success`).

QA 294's blocking finding (A1) is fixed. The header now reads as a labelled section hash, not as a file blob. The hash
equals `git hash-object --stdin` of the section, and a test goes red when the generator hashes the whole file. QA 294's
test gap (E3 placement) is also closed: its mutant `qa/s164g-m4`, re-applied on the head, now turns
`fleet-ae-e3-placement` and F8 red. Every row passes. Four non-blocking findings are listed at the end.

- **QA:** QA 295, record session 164, prefix `s164h`. Headless Claude Code (Opus) on the laptop (Windows 10, Node
  v22.23.2).
- **Dispatch:** `docs/loops/qa-295-s164h-dispatch.md` at DISPATCH_SHA `ecdb35d7ce2adc276fdcde2b98eb681a5d7f7409`.
- **`git -C C:/qa-scratch/qa295-wt log -1 --format=%H`** → `ecdb35d7ce2adc276fdcde2b98eb681a5d7f7409`. This equals
  `origin/master`.
- **PR head check:** `gh pr view 516` → `headRefOid 0ac17a7e155ec90b993c2e6084ac52a1a66845fd`, state OPEN, base master.
  I checked it at the start, and again after the mutants were pushed and before this report was written. It equals the
  pin both times.
- **Trees:**
  - `C:/qa-scratch/qa295-wt`: the dispatch tree (master), the master build for row 7, and this report branch.
  - `C:/qa-scratch/qa295-pr516`: the head.
  - `C:/qa-scratch/qa295-clone`: a fresh clone of the head, for row 4.
  - `C:/qa-scratch/qa295-m1..m3`: the QA mutants.
  - `C:/qa-scratch/qa295-w7 crlf`: an `autocrlf=true` clone at a path with a space, for row 7.
- **Environment:** every command ran through `C:/qa-tmp/run295.mjs`, which is QA 294's `run.mjs` with the base moved to
  `C:/qa-tmp/env295`. It sets `TEMP`/`TMP`/`TMPDIR`, `HOME`/`USERPROFILE`, `KNOWLEDGE_V2_DB`, `OPEN_BRAIN_DATA_DIR`,
  `npm_config_cache` and `LOCALAPPDATA` under that base, and it unsets `CLAUDE_PID`. The only reads outside the scratch
  and tmp folders were `git`/`gh` against the repo.
  - No live record, real DB, real data dir, vault or settings file was read or written.
  - No Jev call was made, and no key was printed.
  - Records were taken with `git show` and copied to `C:/qa-tmp` first.
- **Narrow:** one test file per vitest run, mutants on touched product files only. `tsc --noEmit` = 0 and
  `npm run typecheck:tests` = 0 on the head, and `tsc --noEmit` = 0 on each mutant. No full suite was run.
- **Scripts reused from QA 294:**
  - `e-mcp.mjs` → `qa295-e.mjs`. Only the paths changed, so the decision titles it writes still say "QA294".
  - `start-only.mjs` → `qa295-start.mjs`.
  - QA 294's mutant `qa/s164g-m4` @ `8e37593f`.

## Row 1: Confined — PASS

`0ac17a7e` is a single merge commit, with parents r1 `1bc4d20d` and master `5bd23e6b`. There is no non-merge commit in
`1bc4d20d..0ac17a7e --not 5bd23e6b`, so the r2 work is carried in the merge itself. `git diff --name-only 1bc4d20d
0ac17a7e` lists 50 files. 38 of them are master's changes since the merge base `3ccfeaef`. For each of those 38, I
diffed head against master (`git diff 5bd23e6b 0ac17a7e -- <f>`):

- 36 are identical to master.
- `CHANGELOG.md` is master's version plus the FLEET-AE entry (+6/-0; the r2 sentence is part of it).
- `open-brain/src/server.ts` is master's version plus r1's own one-line hunk: the `ob_state` description gains
  `add_decision (optional standing:true), set_standing`. The hunk is byte-identical to r1's `3ccfeaef..1bc4d20d` hunk,
  so it carries no r2 change.

**The 12 files that r2 changed, leaving out master's changes:**

| File | r1 → head |
|---|---|
| `.agents/SYSTEM/hub-partner-seats.json` | −4, `requiredBlock` removed (now identical to master's) |
| `.agents/SYSTEM/required-block.json` | new, `{"path": ".agents/roles/developer.md", "heading": "Building checks"}` |
| `.cursor/rules/developer-building-checks.mdc` | header line only (±1) |
| `.gitignore` | +1 |
| `open-brain/src/pipelines/sync/developer-building-checks.ts` | `gitBlobSha` → `gitHashObjectStdin`; reads `required-block.json`; new header; `parseSectionShaFromMdc` |
| `open-brain/tests/pipelines/fleet-ae-e3-placement.test.ts` | new |
| `open-brain/tests/pipelines/fleet-ae-harness.ts` | new (temp-dir seeding, `expectRepoClean`) |
| `open-brain/tests/pipelines/fleet-ae-f1.test.ts`, `-f2`, `-f3`, `-f8`, `-f9` | rewritten to temp dirs and the r2 rows |

- **`.gitignore`:** exactly one line, `+!/.agents/SYSTEM/required-block.json`, in both r1→head and master→head
  (`numstat 1 0`).
- **`.agents/state.json`:** untouched. The blob is identical in head and master (`21b9ba2e8a556e5c358ff4efad2424c8ef23239b`),
  and `git diff 5bd23e6b 0ac17a7e -- .agents/state.json` is empty.
- **No decision is tagged `standing`.** The head's record (rev 355, 164 decisions) has 0 decisions with a `standing`
  key, and `grep -c '"standing"'` = 0.
- **The PR's whole footprint against master** (`git diff --stat 5bd23e6b...0ac17a7e`) is 25 files. None of them is the
  record.

## Row 2: Mutant runs — PASS

Each branch is one commit whose parent is `0ac17a7e`, and each touches one product file only. Each CI run is
`completed / failure` on the mutant SHA (`test` failure, `changed` success, `test-windows` skipped). The failing tests
come from `gh run view <id> --log-failed`:

| Branch @ SHA | Run | Mutant | Failing tests (the only ones) |
|---|---|---|---|
| `loop/fleet-ae-mut-1` @ `0e8625a7` | 37795197604 | the header hashes `normalizeLf(whole developer.md)` | 1 failed / 239 files passed: `fleet-ae-f1 > a second run is a no-op and the .mdc body equals the Building checks section`. Error: `expected 'c613be4d…' to be '2d74077c…'`. This is the header-pin assertion. |
| `loop/fleet-ae-mut-2` @ `b1ea6294` | 37795401852 | `standingRulesLines` pushed above WATCH OUT, in both `renderBriefing` and `renderBudgeted` | 2 failed: `fleet-ae-e3-placement > index(WATCH OUT) < index(STANDING RULES) < index(OPEN QUESTIONS)` (`expected 21 to be less than 18`); `fleet-ae-f8 > STANDING RULES lists every standing decision (mut-2 …)` (`expected 18 to be greater than 35`) |
| `loop/fleet-ae-mut-3` @ `d7f6a98b` | 37795439942 | `readRequiredBlockConfig` ignores `required-block.json` and reads `hub-partner-seats.json` `requiredBlock` | 1 failed: `fleet-ae-f3 > required-block.json is tracked, resolves to the same section as the .mdc, and hub-partner-seats has no requiredBlock`. Error: `hub-partner-seats.json missing requiredBlock { path, heading }` |

Each red run's failing tests are the rows that its mutant targets. On the head, run 37795146033 is `success` at
`0ac17a7e`. My own runs on the head, one file per run: a4, e3-placement and f1–f9 all exit 0, and `git status` was clean
afterwards.

## Row 3: A1 — PASS

Run on `qa295-pr516`.

**Generator.** `node scripts/gen-cursor-rules.mjs` printed `unchanged …\developer-building-checks.mdc` and exited 0 on
both runs, and `git status --porcelain` was empty. After I deleted the `.mdc` and regenerated it (`wrote …`), the status
was empty again, so the output is byte-identical to the committed file. `alwaysApply: true` is present.

**The header:**

```
<!-- generated from .agents/roles/developer.md, heading "Building checks", section-sha 2d74077c035433e79572fe9b39c6240f6137b3f0 (git hash-object of the extracted section) — run: node scripts/gen-cursor-rules.mjs -->
```

- It names the path, the heading (`heading "Building checks"`), and `section-sha <hash> (git hash-object of the
  extracted section)`.
- **It does not read as a file blob.** There is no `@ <sha>` form, and the hash is labelled as a section hash. For the
  record: `git cat-file -t 2d74077c…` still says `could not get object info`. That is expected now, because the label
  says it is not an object. The file blob is `c613be4d…`, and the header does not equal it.

**The independent hash.** In `C:/qa-tmp/qa295-a1b.mjs` I extracted the section myself: from the line
`## Building checks` (it occurs once) up to the line before the next `## ` line (`## Machine lease on shared QA
machines (T-204, D-119, G-054)`). I normalised to LF, trimmed trailing blank lines, and ended with one LF.

| | value |
|---|---|
| independent section | 1931 bytes, equal to the `.mdc` body (`true`) |
| `git hash-object --stdin` of it | `2d74077c035433e79572fe9b39c6240f6137b3f0` |
| `git hash-object --stdin` of the `.mdc` body after the header | `2d74077c035433e79572fe9b39c6240f6137b3f0` |
| header | `2d74077c035433e79572fe9b39c6240f6137b3f0` |

They are equal. See finding 1: my first, literal extraction kept the one trailing blank line before the next heading.
It was 1932 bytes and hashed to `6dbafd08dd8412f930bbf24a252818c928261545`.

**A test goes red if the generator hashes the whole file.**

- Developer mut-1 (run 37795197604, row 2) turns F1 red.
- My own mutant **m3** hashes the raw whole file, `gitHashObjectStdin(readDeveloperRoleMarkdown(projectRoot))`, with no
  normalisation. Locally it turns `fleet-ae-f1` red, exit 1: `expected 'c613be4d…' to be '2d74077c…'`. F2, F8 and E3
  stay green.

**Real `/sync` (`node open-brain/build/cli.js sync --check`).** The head has 2 issues before any edit:
`template-personal-names`, and `worktree-layout`, which is this machine's ~160 QA worktrees. So the exit is 1
throughout, and the measure is whether `cursor-rules-current` is among the issues.

| Step | Result |
|---|---|
| clean head | `33 passed … 2 issues`; `cursor-rules-current` is not among them |
| edit **outside** the section: a line added under `## Machine lease…` | `33 passed … 2 issues`. **Passes.** (In r1 it already passed; the r2 header did not change that) |
| edit **inside** the section: `**Use a real fixture.**` → `**Use real fixtures.**` | `32 passed … 3 issues`: `cursor-rules-current: .cursor/rules/developer-building-checks.mdc is out of date with .agents/roles/developer.md — run node scripts/gen-cursor-rules.mjs`. **Fails.** |
| `node scripts/gen-cursor-rules.mjs` (`wrote …`), then sync | `33 passed … 2 issues`; passes again |

Restored with `git checkout --`. The tree ended clean.

## Row 4: A3 — PASS

I made a fresh `git clone` of the remote into `C:/qa-scratch/qa295-clone`, fetched `pull/516/head`, and checked out
`0ac17a7e` (detached).

- `git ls-files .agents/SYSTEM/required-block.json` → `.agents/SYSTEM/required-block.json`.
- `git check-ignore -v` on that path → exit 1, so it is not ignored.
- The content is `{"path": ".agents/roles/developer.md", "heading": "Building checks"}`.
- **It resolves to the `.mdc` body.** I resolved it independently from the JSON's `path` and `heading`: the heading
  occurs once, the section is 1931 bytes, the `.mdc` body is 1931 bytes, they are `equal: true`, and the section hash is
  `2d74077c…`. The head's built product, run on the clone, gives
  `requiredBlockSectionText(clone) === buildingChecksSectionFromRoot(clone)` → `true`, and `checkCursorRulesCurrent(clone)`
  → `pass`.
- **`hub-partner-seats.json` has no `requiredBlock`.** `grep -c requiredBlock` = 0. Its top-level keys are
  `description, hub_url, talk, talk_tokens, seats, seatless_checkouts, readers`. The file is byte-identical to master's.
- **SIA's hub-seats `/sync` check still passes.** It reads `hub-seats [pass]: hub-partner-seats.json matches
  worktree-seats.json and the readers map ob_start reads (3 cursor runtime(s): builder, forge, infra; 3 claude-code:
  planner, qa, research); 0 seat names ignored`. It is not in ISSUES, and `checkHubSeats` called directly also gives
  `severity: pass`.

## Row 5: E3 placement — PASS

**QA mutant m1** is `qa/s164g-m4`'s diff applied unchanged on `0ac17a7e`. `briefing.ts` is the same blob (`79462a50`)
in r1 and the head, so it applies cleanly. The branch is `qa/s164h-m1` @ `7769b58958736159e22864de6723403358eb5e15`.

| Test file (one run each) | m1 |
|---|---|
| `fleet-ae-e3-placement.test.ts` | **exit 1**: `index(WATCH OUT) < index(STANDING RULES) < index(OPEN QUESTIONS)`, `expected 21 to be less than 18` |
| `fleet-ae-f8.test.ts` | **exit 1**: `STANDING RULES lists every standing decision (mut-2 …)`, `expected 18 to be greater than 35` |
| `fleet-ae-f1`, `fleet-ae-f2` | exit 0 |

The mutant that survived in QA 294 is now killed by two tests.

**Through the real MCP path.** I used the MCP SDK `Client` with `StdioClientTransport` against `node
open-brain/build/server.js`, on a temp project carrying a copy of `open-brain/tests/fixtures-state/state.json`.

| Build | WATCH OUT | STANDING RULES | OPEN QUESTIONS | between |
|---|---|---|---|---|
| head `0ac17a7e` | line 102 | line 107 | line 111 | **true** |
| m1 `7769b589` | line 106 | line 102 | line 111 | false |

The head's output:

```
WATCH OUT
- The live MCP server stays on the old build until /mcp reconnect open-brain.
- Run vitest from open-brain/, never the repo root (entry 462).
- Re-index GitNexus before detect_changes or hunks land on neighbouring symbols.

STANDING RULES
- D-007 — QA294 standing via add_decision
- D-002 — Loop 2 is read side only

OPEN QUESTIONS
```

After 40 more were added, the section was still between the two, on the head, with 41 bullets.

## Row 6: Hygiene — PASS

Each mutant is one commit on `0ac17a7e`, touches only a product file, and was pushed through `push-qa.mjs` with a
read-back. I ran F1, F2 and F8, one file per run (plus E3), and then `git status --porcelain` in that tree:

| Mutant | Edit | F1 | F2 | F8 | E3 | `git status` after |
|---|---|---|---|---|---|---|
| `qa/s164h-m1` @ `7769b589` | STANDING RULES above WATCH OUT (QA 294 m4) | 0 | 0 | **1** | **1** | clean |
| `qa/s164h-m2` @ `423d14a30ddf168d7328c785b99728663ca3e6b1` | the drift branch of `checkCursorRulesCurrent` returns `warn` | 0 | **1** (`expected 'warn' to be 'issue'`) | **1** (`cursor-rules-current fails when the .mdc drifts…`, `expected 'warn' to be 'issue'`) | 0 | clean |
| `qa/s164h-m3` @ `758344bd2adf6b0a0149e8a36793ad8ecd917c5a` | the header hashes the raw whole file | **1** (`expected 'c613be4d…' to be '2d74077c…'`) | 0 | 0 | 0 | clean |
| head `0ac17a7e` (control) | — | 0 | 0 | 0 | 0 | clean |

F1, F2 and F8 each went red at least once, and no checkout was left dirty. QA 294's finding 3 is fixed: under red, F1
had left the `.mdc` modified. The tests now seed a temp directory through `fleet-ae-harness.ts`, and `afterEach` asserts
that the fleet paths in the repo are clean (`expectRepoClean`).

## Row 7: Regression (short) — PASS

**QA 294 row 5: E through MCP.** One pass on the head, with the same script as row 5:

- `add_decision {standing:true}` → rev 7→8, `add_decision D-007`, `NOTE: add_decision D-007: standing true`.
- `set_standing D-002 true` → rev 8→9, `NOTE: set_standing D-002: standing false → true`. Both rows carry keys
  `["id","title","date","note","standing"]`.
- `ob_start` places the section between WATCH OUT and OPEN QUESTIONS (row 5), newest first.
- `set_standing D-007 false` → rev 9→10, `standing true → false`. The next `ob_start` lists only `- D-002 — …`. D-007's
  keys are back to `["id","title","date","note"]`.
- 40 more in one batch → 41 bullets, from `- D-047 — QA294 bulk standing 40` to `- D-002 — …`. Still between the two
  sections, with no cap.
- `set_standing D-999` → `isError`: `ob_state refused: ops[0] (set_standing): unknown decision D-999`,
  `Revision: 11 (unchanged)`, `Nothing written.` The revision was 11 before and after, and the sha256 was
  `fc5c222dd6c0f5c4…` before and after.
- Atomic `[set_standing D-001 true, set_standing D-998 true]` → `isError`, rev 11→11, bytes unchanged.

**QA 294 row 6: backward compatibility against master's real record copy.**

- **The record:** `git show origin/master:.agents/state.json`, blob `d0d0bd88d34768c14f57e660afb5d72301c32bb5`. It is
  703287 bytes at rev 356, with 0 `standing`.
  - It was copied twice into `C:/qa-tmp` and was never the live file.
  - Both copies' sha256 was `483eb4b5e065540e…` before and after the runs.
  - My first attempt produced an empty record, because Git Bash path conversion mangled the `rev:path` argument. I
    discarded it and reran with `MSYS_NO_PATHCONV=1`. The numbers above are from the rerun.
- **The servers:** each was built from its own tree, master `ecdb35d7` and head `0ac17a7e`. Each ran `ob_start` through
  MCP stdio on a fresh, identical temp project. Both outputs are 538 lines.
- **The full diff:**
  ```
  1c1    < Build ecdb35d · current                 > Build 0ac17a7 · ahead by 2 (unmerged local commits)
  12c12  < … parent process 9572 …                 > … parent process 92492 …
  125c125 < Build ecdb35d · current                > Build 0ac17a7 · ahead by 2 (unmerged local commits)
  539c539 < Total returned words: 6739 (~10804 tokens)   > Total returned words: 6749 (~10819 tokens)
  ```
  The only differences are the build line (twice), the per-process PID, and the word count that follows from the
  longer build line. `STANDING RULES` does not appear in the head's output (count 0).

**QA 294 row 7: Windows CRLF plus a spaced path.** I cloned with `git clone -c core.autocrlf=true` into
**`C:/qa-scratch/qa295-w7 crlf`**, checked out `0ac17a7e`, then ran `npm ci` and a build.

- **Forcing CRLF.** `.gitattributes` pins both `developer.md` and the `.mdc` to `eol: lf`, so the checkout is LF (0
  CRLF lines). I then **forced CRLF on disk** for `developer.md`, which gave 121 CRLF lines.
- **The generator from the spaced path.** It printed `unchanged C:\qa-scratch\qa295-w7 crlf\.cursor\rules\developer-building-checks.mdc`,
  exit 0, twice. After the `.mdc` was deleted, regenerating from the CRLF source gave a file `cmp`-identical to
  `git show HEAD:.cursor/rules/developer-building-checks.mdc` (2263 bytes, `section-sha 2d74077c…`).
- **`/sync --check`.** It ran twice with the CRLF `developer.md`, and twice more with the `.mdc` also forced to CRLF
  (32 CRLF lines). All four runs gave `34 passed … 1 issues`, the issue being `template-personal-names`.
  `cursor-rules-current` was never among the issues. The generator still reports `unchanged`. There is no flap.
- **F9.** F9 failed once, and that was my setup, not the product. My first F9 run happened while the tree's own
  `developer.md` and `.mdc` were still forced to CRLF:
  - F9 reads the repo's `developer.md` and runs `.replace(/\n/g, "\r\n")` on it, so CRLF became `\r\r\n`. The failure
    was `expected '## Building checks\n\n\n\n…' to be '## Building checks\n\n…'`.
  - Its `expectRepoClean` then correctly reported my two edited files.

  After `git checkout --` I reran F9 on the clean spaced tree: `1 passed`, exit 0, and `git status` was empty
  before and after. See finding 3.

## QA mutants (summary)

| Branch | SHA | Edit | Killed by |
|---|---|---|---|
| `qa/s164h-m1` | `7769b58958736159e22864de6723403358eb5e15` | QA 294 m4: STANDING RULES above WATCH OUT | e3-placement, f8 |
| `qa/s164h-m2` | `423d14a30ddf168d7328c785b99728663ca3e6b1` | `cursor-rules-current` drift → `warn` | f2, f8 |
| `qa/s164h-m3` | `758344bd2adf6b0a0149e8a36793ad8ecd917c5a` | header hashes the raw whole `developer.md` | f1 |

## Findings (non-blocking)

1. **The "extracted section" convention is not stated where a reader re-derives it.** The ruling says anyone can
   re-derive the hash by extracting the section and hashing it. The product's extraction trims trailing whitespace and
   ends with one LF: `extractBuildingChecksSection`, `.replace(/\s+$/, "") + "\n"`. A literal extraction "up to the next
   `## ` line" keeps the blank line before that heading. It is 1932 bytes and hashes to `6dbafd08…`, not `2d74077c…`.
   Hashing the `.mdc` body after the header always gives the right value. Suggestion: one line in the dispatch or in the
   header, such as "trailing blank lines trimmed, one final LF". It does not affect `/sync` or the rows.
2. **Two F8 test names do not match the r2 mutants they name.**
   - `cursor-rules-current fails when the .mdc drifts (mut-1 hashes whole file)` asserts drift → `issue`, which is my
     m2's target. It stays green under developer mut-1, which F1 kills.
   - `set_standing refuses unknown decision ids (mut-3 reads hub-partner-seats requiredBlock)` tests `set_standing`. It
     stays green under mut-3, which F3 kills.

   Every mutant is killed by the right row. Only the labels mislead a reader of a red log.
3. **F9 assumes that the repo's own `developer.md` is LF on disk.** It CRLF-ifies the file with `replace(/\n/g, "\r\n")`,
   so a source that is already CRLF becomes `\r\r\n`. The `eol: lf` attribute makes this the real state of every
   checkout, so it is not a product defect. A `normalizeLf` before the replace would make the test independent of that.
4. **`cursor-rules-current` now spawns `git hash-object --stdin`** (`execFileSync("git", …)`) on every `/sync` and every
   generation. If `git` were absent from PATH, the check would report `issue` through its `catch`, not crash. That is
   fail-safe. This is an observation only.

## Unsandboxed commands

Unsandboxed commands: none.

## Pushed branches

`qa/s164h-m1`, `qa/s164h-m2`, `qa/s164h-m3` (listed above), and `qa/s164h-report` (this file). Each was pushed only
through `node docs/loops/qa-295/push-qa.mjs <branch>` from `qa295-wt`, and each read-back matched. No issue or PR was
created, commented on or edited.

QA-295: REPORT COMPLETE
