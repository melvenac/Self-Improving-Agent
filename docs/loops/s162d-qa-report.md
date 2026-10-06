# QA 283 report: session-162 batch d (prefix `s162d`), #466 r2 (T-025) and #468 (HUBROOM-GUARD) (Plumb, Linux)

**By:** QA 283, record session 162. Headless Claude Code (Opus) on Plumb (Linux, uid 1002, Node v22.22.1).
**Dispatch:** `docs/loops/qa-283-s162d-dispatch.md`. **Dispatch tree:** `git -C ~/qa-scratch/qa283-wt log -1 --format=%H`
= `3fc0af14810ddad77f5647b681ce68fc5fb89546` (the DISPATCH_SHA). `origin/master` at fetch = `3fc0af14`.

## Verdicts

| PR | Task | Pinned head | Verdict | Summary |
|---|---|---|---|---|
| #466 | T-025 r2 | `b4ad38a3573e923b10c4e89d1fc023c710cc0d5a` | **ACCEPT** | Rows 1–6 pass. QA 282 F1 is fixed: an `Experiences/` that cannot be stat'd is now a refusal on a real filesystem, and r1's `existsSync` mutant goes red. The new test file is red against r1 on exactly the three new behaviours. Two Low findings and some Info items do not block. |
| #468 | HUBROOM-GUARD | `004500e62784e3228b5f8fb2f4aef371c5e8843a` | **ACCEPT** (with finding K1) | Rows 1, 2, 8 and 9 pass. Row 7: all four named rewordings go **red in all three copies**, but **0 of my 3 own rewordings** are caught, and only 1 of the dispatch's 3 examples. **Ruling: materially better than #457**, so this is a finding and not a reject. See K1. |

**Overall: ACCEPT.** Both PRs change `open-brain/src`, so each merge needs Aaron's word.

## Method and environment

- **Trees** (all detached):
  - `qa283-wt`: the dispatch tree, which holds only this report.
  - `qa283-pr466` (`b4ad38a3`), `qa283-prev466` (`bc9c22b2`, QA 282's REJECT head) and `qa283-pr468` (`004500e6`).
  - `qa283-master` (`3fc0af14`): used for the row-5 parser comparison and as the base for the hub-seats check.
  - `qa283-merge`: a local octopus merge commit `40a83273` = master `3fc0af14` + #466 + #468. It merged with no conflicts and lives in local objects only; nothing was pushed.
  - **No head drift:** `git fetch origin pull/466/head pull/468/head` returned exactly the pinned SHAs. Both PRs have merge-base `ecbfb169`.
  - #468 has no previous QA'd head, so no `qa283-prev468` exists. Red-first for #468 is the plant rows below.
- **Environment.** `TMPDIR=~/qa-tmp` and `npm_config_cache=~/qa-tmp/npm-cache` were set for every npm, tsc, vitest and tsx run. The permission layer refuses inline `VAR=…`, so every run went through node drivers in `~/qa-tmp/qa283/` that pass `env` to `spawnSync`: `run.mjs`, `vt.mjs`, `tsc.mjs`, `mut.mjs`, `redfirst.mjs`.
  - `npm ci` ran once, in `qa283-pr466/open-brain`. The lockfile is unchanged across both PRs and master. The other trees symlink `node_modules` to that install. npm's install-scripts gate skipped the esbuild and better-sqlite3 postinstalls, and none of the files under test needed them.
  - QA's own probe fixtures went under `~/qa-tmp/qa283/` and were removed afterwards. Modes were restored first.
- **LIGHT.**
  - One test file per vitest invocation, and no full suite.
  - Mutants went on touched files only. Every `src` mutant was checked with `tsc --noEmit`, and all were exit 0. Doc plants are marked n/a.
  - Every mutant was restored with `git checkout --`, and the driver checked after each one that the tree was clean.
  - No Windows rows.
- **Not touched.** No live `.agents/state.json`, knowledge DB, vault (this machine has none), settings file, Jev call or hub call. `gh` was used read-only (`run list`, `run view`, `pr view`). No subagents: every row is my own run.

## Every PR

### Row 1: Confined. PASS for both

- **#466** `git diff bc9c22b2 b4ad38a3` (1 commit, `b4ad38a3`) touches 4 files, +117 −3:
  - `src/pipelines/sync/checks.ts` (the frontmatter check)
  - `src/shared/parse-frontmatter.ts` (the shared parser)
  - `tests/vault-writer.test.ts` (+7, one BOM row)
  - `tests/pipelines/sync/experience-frontmatter.test.ts` (+65)

  Nothing else changed.
- **#468** `git diff origin/master...004500e6` (1 commit) touches 3 files:
  - `open-brain/src/pipelines/sync/hub-room-guard.ts` (new, 98 lines)
  - `open-brain/tests/pipelines/sync/hub-talk-exit-codes.test.ts` (+39 −6)
  - `.agents/SYSTEM/hub-partner-seats.json` (exactly one line removed: `"wait": "--wait --wait-timeout 3500",`)

  Nothing else changed.

### Row 2: CI (read only). PASS for both

| PR | Run | Event / headSha | `test` | `changed` | `test-windows` |
|---|---|---|---|---|---|
| #466 | `37418161844` | pull_request, `b4ad38a3…` | **success** | success | skipped |
| #468 | `37414624315` | pull_request, `004500e6…` | **success** | success | skipped |

**Local results at the heads:**
- #466: `experience-frontmatter.test.ts` **13/13**, `vault-writer.test.ts` **22/22**, `vault-archive.test.ts` **6/6**.
- #468: `hub-talk-exit-codes.test.ts` **11/11**, `hub-seats.test.ts` **8/8**.
- `tsc --noEmit` and `npm run typecheck:tests` exit 0 at both heads.

## #466 r2: ACCEPT

### Row 3: fails closed (F1). PASS

**Real-filesystem probe.** `checkExperienceFrontmatter` was called from each tree on scratch vaults under `~/qa-tmp` (uid 1002, not root). Every fixture holds a two-token note (`type: foo bar`) unless the case says otherwise.

| Case | Head `b4ad38a3` | r1 `bc9c22b2` |
|---|---|---|
| A. Known positive, readable | issue: `1 … invalid type … (type must be one token)` | issue |
| **B. Vault mode 0644, so `Experiences/` exists but cannot be stat'd (EACCES)** | **issue**: `… could not be read …: Experiences (EACCES). Walked 0 readable note(s). This is not a pass.` | **pass, `Walked 0`** (QA 282 F1 reproduced) |
| C. `Experiences/` mode 000 (stats, cannot be listed) | **issue**, EACCES, "This is not a pass" | issue |
| C2. `Experiences/` mode 0311 (searchable, not listable) | **issue**, EACCES | issue |
| D. One note mode 000, beside a good note | **issue**: `Experiences/p/two.md (EACCES). Walked 1 readable note(s). This is not a pass.` | issue |
| E. Absent vault (ENOENT) | **skip**: `not checked: no readable vault at … (ENOENT) … This is not a pass.` | skip |
| F. Vault present, `Experiences/` absent (ENOENT) | **skip**: `not checked: Experiences/ is absent (ENOENT) … This is not a pass.` | pass, `Walked 0` (QA 282 O3, now fixed) |
| G. Readable, empty `Experiences/` | **pass**: `Walked 0 experience note(s) under Experiences/; …` | pass |
| H. `Experiences` is a file | **issue**, ENOTDIR | issue |
| I. Symlinked note pointing to a two-token note | **issue**, walked (QA 282 case G, fixed) | pass, `Walked 0` |
| J. **Symlinked subfolder** holding a two-token note | **pass, `Walked 0`** (see H1) | pass |
| K. Dangling symlinked note | issue, ENOENT | (not walked) |
| L. The vault dir itself is mode 000 | **skip**, EACCES, "This is not a pass" (see H3) | skip |

- **EPERM** cannot be produced on this filesystem without root. It is covered by the PR's injected-`stat` row, which runs EACCES and EPERM in turn. Under the head code, any stat code other than ENOENT goes to `unreadable`.

**Mutants** (`experience-frontmatter.test.ts`):

| Mutant | tsc | Result |
|---|---|---|
| **M3a: r1's `existsSync(expRoot)` put back** in place of the stat/ENOENT block | 0 | **red, 2/13**: the EACCES/EPERM row (`expected '1 experience note(s) with invalid typ…' to contain 'EACCES'`) and the Experiences-absent skip row |
| M3b: every stat error treated as absent (skip) | 0 | **red**: EACCES row, `expected 'skip' to be 'issue'` |
| M3c: a stat error other than ENOENT returns an empty scan, with no `unreadable` entry | 0 | **red**: EACCES row. Severity was still `issue`, through the `!experiencesListed` backstop. Only the code was missing from the message. |
| M3d: absent `Experiences/` reported as pass | 0 | **red** (skip row) |
| M3f: a root `readdir` failure is not recorded | 0 | **red** ("cannot be listed" row) |
| M3g: an unreadable note is skipped silently | 0 | **red** |
| M3h: an absent vault is reported as pass | 0 | **red** (QA 282 O1, now pinned) |
| M3e: drop the `!experiencesListed` refusal | 0 | **green** (H2, Info) |
| M3i: symlinked notes not walked (r1's `isFile()` only) | 0 | **green** (H1) |

**Red-first control.** I copied the head's `experience-frontmatter.test.ts` into the r1 tree and ran it against r1 source. It went **red 3/13**, on exactly the new rows:
- the EACCES/EPERM row (`… to contain 'EACCES'`);
- the Experiences-absent skip row (`expected 'pass' to be 'skip'`);
- the BOM row (`expected 'pass' to be 'issue'`).

The other 10 rows pass on r1.

### Row 4: QA 282's notes. PASS

| Mutant | tsc | Result |
|---|---|---|
| M4a: a non-string `type` returns null (number or list accepted) | 0 | **red**: "reports non-string type values as issues", `expected 'pass' to be 'issue'` |
| M4a2: accept any value (`experienceTypeViolation` always null) | 0 | **red, 3/13** (R4, non-string, BOM) |
| M4b: drop the BOM strip (`stripLeadingBom` returns `raw`) | 0 | **red** in `experience-frontmatter` (BOM row) **and** in `vault-writer.test.ts` (`parses frontmatter when the file starts with a UTF-8 BOM`, `expected undefined to be 'pattern'`) |

Probe cases M (`type: 42`, `type: [a, b]`: issue, "type is not a string") and N/O (BOM + LF, BOM + CRLF two-token note: issue) agree on real files.

### Row 5: the deliberate vault-writer change. PASS

- **The PR says so.** The #466 body (r2 section) reads: "**BOM:** `parseFrontmatter` strips a leading UTF-8 BOM before parsing; vault-writer and the sync check now read `type` from BOM-prefixed notes (intentional behaviour change for BOM files)."
  - Info: the body's inline code is garbled in the stored text. Backticks were turned into backslashes, and some characters were eaten (`\eaddir\`, `\ault-writer.test.ts\`). The sentence is still readable.
- **A new vault-writer test covers it**: `vault-writer.test.ts` "parses frontmatter when the file starts with a UTF-8 BOM". It is red on r1 (red-first copy) and red under M4b.
- **Fixture comparison.** I compared master's parser (`vault-writer.ts` at `3fc0af14`) against the head's shared parser and the head's `vault-writer` re-export, on 22 fixtures. **20 of 22 are identical across all three; the only 2 that differ are the BOM-prefixed ones.**
  - Identical: LF, **CRLF**, **no frontmatter** (`{}`), **empty frontmatter** `---\n---` (`{}`), blank-line frontmatter, **value with a colon** (`url: https://example.com:8080/a`, `title: a: b: c`), **list value** `[a, b , c]` and `[]`, numbers, negative numbers, `1.2.3`, empty value, two-token value, YAML block list, unterminated, duplicate key, leading space, mixed EOL, BOM mid-file, double BOM, and BOM followed by text.
  - Differ: **BOM + LF** (master `{}`, head `{"type":"foo bar"}`) and **BOM + CRLF** (master `{}`, head `{"type":"pattern"}`).
  - A double BOM still yields `{}`, because only one BOM is stripped. That is the stated intent.
- **Blast radius of the change.** `git grep parseFrontmatter` finds no production consumer of `vault-writer`'s export other than the re-export itself. `checks.ts` imports the shared module, and `open-brain/scripts/dashboard.mjs` has its own private `parseFrontmatter`. So outside tests, the change reaches only the new check.

### Row 6: R1 to R5 still hold. PASS

| | Mutant | tsc | Result |
|---|---|---|---|
| R1 | count+1 in the pass message | 0 | **red** (R1 and the new Walked-0 row) |
| R1 | walk the whole vault (Summaries too) | 0 | **red, 8/13** |
| R2 | absent `type` is an issue | 0 | **red** (R1, R2) |
| R4 | empty `type` passes | 0 | **red** (R4) |
| R4 | two tokens pass | 0 | **red** (R4, BOM row) |
| R4 | findings ignored | 0 | **red, 3/13** |
| **R5** | **closed list enforced in production** (`gotcha/pattern/decision/fix/optimization`) | 0 | **red, 3/13** (R1, R3, R5) |

### #466 findings

- **H1, Low (non-blocking).** A **symlinked subfolder** under `Experiences/` is silently not walked. For a symlink, `Dirent.isDirectory()` is false and the name does not end `.md`. So a two-token note inside it gives `pass, Walked 0` (probe J).
  - The symlinked-*note* case that QA 282 reported is fixed (probe I), but its fix is **unpinned**: M3i (r1's `isFile()` only) stays green.
  - Fix: `stat` symlink entries and branch on the target type, or count them in `unreadable`. Add a test for each case.
- **H2, Info.** The `!scan.experiencesListed` refusal cannot be reached from a real filesystem, because every non-listing path already lands in `unreadable` (probes B, C, C2, H). It is a backstop, and it did turn M3c into `issue`. Removing it (M3e) stays green, because no test isolates it.
- **H3, Low / for the planner.** A vault directory that exists but is unreadable (EACCES, probe L) is a **skip**, not a refusal. The message names the code and says "This is not a pass", so it is never a clean pass. Row 3 rules only on ENOENT for skips. Whether vault-level EACCES should be an issue is the planner's call.
- **H4, Info.** The PR body's inline code is garbled (row 5).
- QA 282's O1 (unpinned skip and non-string rows) and O3 (absent `Experiences/` passed with `Walked 0`) are resolved. QA 282's O2 (the `LEGACY_CLOSED_EXPERIENCE_TYPES` export used only by tests) is unchanged.

## #468 HUBROOM-GUARD: ACCEPT (with finding K1)

**What the guard does** (`hub-room-guard.ts`):
1. It requires that the count of `--wait` in a copy equals the count of the exit-2 sentence.
2. It splits each copy into sentences on `.`, `;` or a newline outside backticks.
3. It forbids `` `wait` `` followed by `suffix|key|line`, and any `wait[-_]?timeout`.
4. It flags a sentence that names a hub invocation (`hub-talk`, `talk line` or `` `talk` ``) and also contains `wait|waits|waiting|listen|listening|block|blocking|poll|polling`, unless the sentence is allowlisted or contains `never`, `does not` or `do not` anywhere.

It is applied to both `hub-room.mdc` copies and to `start.md`'s `### Hub room` section.

### Row 7: the rewordings are caught. PASS as worded, with finding K1

**Method.** Each line was planted in the tracked files, and the test file was run once per plant:
- **mdc:** the line goes after "Post when the work is done, not a bare acknowledgement." in **both** `hub-room.mdc` copies, so the identity row is not the reason for red.
- **start.md:** the line goes at the end of the Hub-room line **and** in its `cursor_only` twin in `docs/loops/cursor-start-differences.json`, so the parity row is not the reason for red.

  On my first run without the JSON twin, the parity row went red for every start.md plant, caught or not. So that first run did not count, and every result below includes the twin.

Every red below fails **only** the row "tracked hub copies pass the sentence guard (HUBROOM-GUARD)", 1 of 11.

| Line | Text | mdc | start.md |
|---|---|---|---|
| QA 281 R1 = PR R1 | "After posting, run hub-talk --wait for the next atlas turn." | **red** | **red** |
| QA 281 R2 = PR R2 | "When the post succeeds, run the `talk` line again with `--wait` and handle the next atlas turn in this run." | **red** | **red** |
| QA 281 R3 = PR R3 | "Then keep listening: append the seat file's `wait` suffix to the talk line and act on what it prints before you end the turn." | **red** | **red** |
| QA 281 R4 = PR R4 | "After posting, run the talk line with --wait --wait-timeout 3500." | **red** | **red** |
| **Own-1** | "After you post, run hub-talk with `--inbox` again and repeat until atlas has replied, then act on the reply before ending this turn." | **green: missed** | **green: missed** |
| **Own-2** | "Stay in this run after posting: rerun the talk line every minute until the next atlas turn is printed." | **green: missed** | **green: missed** |
| **Own-3** | "Do not end the turn after posting, wait for hub-talk to print the next atlas turn and act on it." | **green: missed** | **green: missed** |
| Dispatch e.g. 1 | "Listen on the room until atlas answers." | green: missed | green: missed |
| Dispatch e.g. 2 | "Block on hub-talk for the next message." | **red** | **red** |
| Dispatch e.g. 3 | "Keep polling the room before ending." | green: missed | green: missed |

The PR's table is QA 281's R1–R4 verbatim, so the dispatch's "QA 281's rewordings and the four in the PR's table" are the same four lines.

**More misses** (from a direct `hubRoomGuardViolations` probe; each was also missed when planted in both copies):
- **split across sentences:** "After posting, run hub-talk with `--inbox` once more. Wait for what it prints and act on it."
- **inflections outside the regex:** "the talk line listens for atlas; the seat polls it …" (`listens`, `polls`, `blocks` and `awaits` are not matched)
- `await`: "After posting, await the next atlas turn from hub-talk in this run."
- **`never` elsewhere in the sentence:** "Run hub-talk again and wait for atlas, never ending the turn before it answers."

**Ruling: materially better than #457. ACCEPT, with K1 as a non-blocking finding.**
- #457 caught **1 of 4** named rewordings, in `hub-room.mdc` only, and **0 of 4** in `start.md`, which had no `--wait` guard at all (QA 281 row 9).
- #468 catches **4 of 4 in all three copies**, and it covers `start.md`.
- The `--wait` rule is now **structural**. Any `--wait` outside the exit-2 sentence is red however it is worded, and so is any reference to the seat file's `wait` key. Those are the two concrete ways a seat would actually run a foreground wait.
- What still gets through is prose that describes looping or holding the turn without naming `--wait`. A vocabulary check cannot close that completely.

**K1, Medium (non-blocking).** The verb ban is weaker than QA 281's proposal in three ways:
- **(a) The negation exemption is sentence-wide and was widened.** QA 281 proposed exempting a sentence only when `never` or `does not` is its *main verb*. The guard exempts any sentence that contains `never`, `does not` **or `do not` anywhere**. So Own-3 ("**Do not** end the turn after posting, **wait** for **hub-talk** …") is an explicit in-turn wait that passes *because of* its negation.
- **(b) The verb regex misses `listens`, `polls`, `blocks` and `await(s)`**, as well as synonyms such as "repeat until", "rerun … until" and "stay in this run".
- **(c) The hub term and the verb must share one sentence**, so splitting them across two sentences evades the check.

Cheap fixes: scope the negation to a clause that has the negator immediately before the verb, and drop `do not`; widen the regex to `\b(a?wait|listen|block|poll)\w*\b`; add an "until … atlas / next turn / replied" pattern. Plant Own-1 to Own-3 as positives.

### Row 8: no false alarms. PASS

- **The tracked files as they are are green:** the guard row passes at the head and at the merge, and a direct probe returns `[]` for both copies.
- **Each sentence on its own, through `hubRoomGuardViolations`, also returns `[]`:**
  - the exit-2 sentence: "Exit 2 comes only from --wait, which a seat with a waker does not run; if you see it, end the turn.";
  - the whole exit-3 retry text;
  - "Never block on hub-talk waiting for the next atlas turn in this run — the waker starts …";
  - `start.md`'s "…then end this turn; never block on hub-talk waiting …";
  - "run the `talk` line with `--inbox` before other work";
  - "If hub-talk exits 3, wait `retry-after` seconds and run the talk line again."
- **Mutants** (`hub-talk-exit-codes.test.ts`):

| Mutant (`hub-room-guard.ts`) | tsc | Result |
|---|---|---|
| **M8a: the exit-2 sentence is no longer counted** (the `--wait` allowlist removed) | 0 | **red on the real files**: `.cursor/rules/hub-room.mdc: expected [ Array(1) ] to deeply equal []` |
| M8f: the whole sentence allowlist **and** the negation exemption removed | 0 | **red on the real files** (the never-block sentence) |
| M8j: the `start.md` section extractor returns `""` | 0 | **red** (`R1 start: expected [] to not deeply equal []`) |
| M8b: the exit-2 phrase dropped from `sentenceIsAllowlisted` | 0 | **green** (K2) |
| M8c: the never-block phrase dropped from the allowlist | 0 | green (K2; the sentence is still exempt through `never`) |
| M8d: the exit-3 retry phrase dropped from the allowlist | 0 | green (K2) |
| M8e: the negation exemption removed | 0 | green (K2; the never-block sentence is still allowlisted) |
| M8g: the verb ban disabled entirely | 0 | **green** (K2) |
| M8h: the `--wait` count check disabled | 0 | **green** (K2) |
| M8i: the seat-file `wait` check disabled | 0 | **green** (K2) |

- **Row 8's named mutant is red.** The effective allowlist for the exit-2 sentence is the count, and M8a removes it. The sentence-level entry for the same phrase (M8b) is **dead code**: the exit-2 phrase contains `;` and ends in `.`, so the splitter never yields it whole. The split gives `["Exit 2 comes only from --wait, which a seat with a waker does not run", "if you see it, end the turn"]`.

**K2, Low (non-blocking).** The three checks have no positive of their own. R1–R4 each trip two checks, so any one check can be deleted while the suite stays green (M8g, M8h, M8i).
- Example: with M8h, a `--wait` in a sentence that names no hub term ("Then run the inbox command with --wait.") would pass.
- Also, the exit-2 and exit-3 sentence allowlist entries are dead or redundant (M8b, M8d), and the never-block entry and the negation exemption mask each other (M8c, M8e).
- Fix: add one positive per check that only that check catches, and drop the dead allowlist entries, or match the exit-2 phrase before splitting.

### Row 9: G2, the `wait` key. PASS

- **My grep:**
  - over `open-brain/src`: `hub-partner-seats|\.wait\b|\[["']wait["']\]|["']wait["']`;
  - over `scripts/`, `.cursor/` and `project-template/`: the same pattern plus `` `wait` `` and `wait_`;
  - and `git grep -E '\bwait\b'` over all four, excluding `.md`.
- **What it found:**
  - The readers of `hub-partner-seats.json` in `src` are `focus.ts`, `hub-presence.ts`, `seat-map.ts` and `hub-seats.ts`. None of them reads a top-level `wait`. The only `\bwait\b` hits in `src` are two comments in `hub-presence.ts` about A2A's "wait-poll" presence.
  - `scripts/` has no hits.
  - In `.cursor/` and `project-template/`, the hits are only the prose of the rule files: the exit codes and "Turn-end and wait".
  - No test reads the key either; `open-brain/tests` has none.
  - **Removing it is safe.** At the head, the JSON has no `wait` text at all.
- **`/sync`'s hub-seats check** (`checkHubSeats(projectRoot)`, called directly) returns **pass** on master, at the #468 head and at the batch merge: `hub-partner-seats.json matches worktree-seats.json and the readers map ob_start reads (3 cursor runtime(s): builder, forge, infra; 3 claude-code: planner, qa, research); 0 seat names ignored`. `hub-seats.test.ts` is 8/8 at the head and 13/13 at the merge.
- I did not run `sync --check` end to end. The direct call is the same check, and it avoids the unrelated machine-specific issues QA 282 saw.

### #468 other notes

- **K3, Info.** The test's `plantStartHub` writes into `lines[at + 1]`, which is the **blank line** after `### Hub room`, not the Hub-room line itself. The plant still falls inside the extracted section, so the R1–R4 start.md rows are valid.
- **K4, Info.** #468 adds an import line to `hub-talk-exit-codes.test.ts`, so the `docs/loops/t156-scan-list.md:38` citation `:10-40` drifts by one more line. No test reads that file.
- The guard lives in `src/pipelines/sync/` but is called only by the test. It is not wired into `/sync`. That is fine as scoped.

## Batch merge

`qa283-merge` (`40a83273` = master `3fc0af14` + #466 + #468, octopus, no conflicts):
- `tsc --noEmit` exit 0, `typecheck:tests` exit 0;
- `experience-frontmatter` **13/13**, `vault-writer` **22/22**, `vault-archive` **6/6**, `hub-talk-exit-codes` **11/11**, `hub-seats` **13/13**;
- `checkHubSeats` **pass**.

## Tree state at the end

- **Clean:** `qa283-pr466`, `qa283-prev466`, `qa283-pr468`, `qa283-master` and `qa283-merge` show only `?? open-brain/node_modules` (the symlink). `qa283-pr466`'s own install shows nothing.
- `qa283-wt` holds only this report, on `qa/s162d-report`.
- The QA clone (`~/work/qa-242`) is on `master` with a clean status. It shows "behind" only because Setup's fetch moved its remote refs.

## Findings summary

| # | PR | Severity | Finding |
|---|---|---|---|
| H1 | #466 | Low | A symlinked subfolder under `Experiences/` is skipped silently (`pass, Walked 0`). The symlinked-note fix is unpinned (M3i green). |
| H2 | #466 | Info | The `!experiencesListed` refusal is unreachable on a real filesystem. It is a backstop, untested (M3e green). |
| H3 | #466 | Low / planner | An existing but unreadable vault (EACCES) is a skip, not a refusal. It is never a clean pass. |
| H4 | #466 | Info | The PR body's inline code is garbled. The vault-writer BOM change is still stated. |
| K1 | #468 | **Medium** (non-blocking) | The verb ban misses 3 of 3 of my rewordings and 2 of the dispatch's 3 examples. The negation exemption is sentence-wide and includes `do not`, so "Do not end the turn …, wait for hub-talk …" passes. Inflections, `await`, and split sentences also evade it. |
| K2 | #468 | Low | No check has its own positive, so any one of the three can be removed while the suite stays green. The sentence-level exit-2 and exit-3 allowlist entries are dead or redundant. |
| K3 | #468 | Info | `plantStartHub` plants into the blank line after the heading. |
| K4 | #468 | Info | The t156 scan-list citation for `hub-talk-exit-codes` drifts again. |

**#466 r2 `b4ad38a3573e923b10c4e89d1fc023c710cc0d5a`: ACCEPT. #468 `004500e62784e3228b5f8fb2f4aef371c5e8843a`: ACCEPT
(K1 recorded). Overall: ACCEPT.**

QA-283: REPORT COMPLETE
