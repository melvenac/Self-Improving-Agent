# QA 290 report: session-164 batch c (prefix `s164c`), #498 IMPORT-CMDS and #499 T-247 pins (Plumb, Linux, headless Claude Code on Opus)

**By:** QA 290, record session 164, 2026-10-07. **Dispatch:** `docs/loops/qa-290-s164c-dispatch.md` at
`0743d87a9c9bd482487f38479095752c665c94ef`.

## Verdicts

| PR | Pinned head | Verdict | Blocking | Other findings |
|---|---|---|---|---|
| #498 IMPORT-CMDS | `fee2bb50639fc78ba79ba91ced657042f599158e` | **REJECT** | **L1 (High)**: `/bootstrap` as written cannot reach a clean `Bootstrap SIA` commit. Step 7b always refuses, because step 7 leaves the tree dirty. **L2 (Medium)**: the read-only refusal writes an empty archive dir and prints a raw `EACCES` | L3 (Medium): CRLF normalisation in `SIA` detection is right but unpinned. L4 (Low-Medium): I4 as briefed (re-run on I3) refuses with exit 1. L5 (Low): mutant 7(c) is equivalent through `ob_start`. L6 (Low): two wiring files outside the dispatch's file list |
| #499 T-247 | `433c503b8317f36d99e40ed093218dad65ecc29e` | **REJECT** | **J1 (Medium)**: row 10. `writeSummary` writes `date: "2026-13-01"`, which the dispatch names as an input that must be refused. The guard is a shape regex, not a date check | J2 (Low): the test named "pins secure_delete=ON" pins VACUUM, not the pragma. J3 (Low): cosmetic |

Both PRs touch `open-brain/src`, so merging either is Aaron's decision. Each fix is small: see the end of each PR's section.

## Method and environment

- **Machine:** **Plumb** (Linux, host `vps.tarrantcountymakerspace.com`, user `agents`), Node v22.22.1, npm 11.21.0. The
  launcher chose Plumb. `/home/melvenac/builds/BUILDING` is **absent** (`test -e` → absent).
- **The Windows rows did not run:** row 8 (CRLF, spaced path, `core.autocrlf=true` template) and row 11 (H2 byte test on
  Windows) were not run on Windows. For row 8 I ran a Linux stand-in (below), which uses git's own `core.autocrlf=true`
  conversion. It is information, not a substitute for the Windows run.
- **Dispatch file name:** the launch prompt (and the tracked `qa-290-headless-prompt.md`) says to follow
  `docs/loops/qa-289-s164c-dispatch.md`. That file does not exist. I followed `docs/loops/qa-290-s164c-dispatch.md`,
  the only `s164c` dispatch, which names QA 290 and this push helper.
- **Setup:** `git -C ~/qa-scratch/qa290-wt log -1 --format=%H` = `0743d87a9c9bd482487f38479095752c665c94ef`.
  - The worktrees are detached under `~/qa-scratch/`: `qa290-wt` (dispatch SHA), `qa290-pr498` (`fee2bb50`), `qa290-pr499`
    (`433c503b`), `qa290-merge` (the batch merge, local `ee0518d6`), and `qa290-crlf` (`fee2bb50` checked out with
    `-c core.autocrlf=true`, row 8).
  - The QA clone itself was not checked out, reset or edited.
- **Pins:** `gh pr view` gives #498 head `fee2bb50…` (OPEN, `loop/import-cmds`) and #499 head `433c503b…` (OPEN,
  `loop/t247-pins`). Both equal the pins.
- **Env:** the shell's permission layer refused `source`, env-var prefixes and `$` expansion. As in QA 288, every
  command therefore went through `~/qa-tmp/qa290/run.mjs`.
  - It sets `TEMP`/`TMP`/`TMPDIR`=`~/qa-tmp/qa290/tmp`, `KNOWLEDGE_V2_DB=~/qa-tmp/qa290/kv2.db`,
    `OPEN_BRAIN_VAULT_DIR=~/qa-tmp/qa290/vault` and the npm cache under `~/qa-tmp/qa290`.
  - With `--home`, it also sets `HOME` to `~/qa-tmp/qa290/home`. The `ob_start` drivers ran that way. Afterwards the
    temp HOME was still empty, and no `kv2.db` was created.
- **Drivers**, in `~/qa-tmp/qa290/` and not committed:
  - `vt.mjs`: one vitest run per file, with an optional mutant restored in a `finally` and `git status` printed.
  - `withmut.mjs`: the same, for an arbitrary command.
  - `ci.mjs`: read-only `gh run view`.
  - `h1probe.mts`, `row456.mts` (+ `row456.out`), `probe7c.mts`, `probe8.mts`.
  - `git status --short` was empty after every mutant.
- **Never touched:** a live `state.json`, the real knowledge DB, a real vault, any settings file. There was no Jev call,
  and no key was printed. `gh` was used only to read. **No hub room was read.**
- **Narrow:** one test file per vitest run, mutants on touched files only, `tsc --noEmit`, `npm run typecheck:tests`.
  There was no full suite.
- **Unsandboxed commands: none.**

## Rows 1–3 (every PR)

### Row 1: confined. #499 PASS. #498 PASS with a note (L6)

- **#499** `git diff origin/master...433c503b`: `CHANGELOG.md`, `open-brain/src/scrub-trigger-fires.ts`,
  `open-brain/src/vault-writer.ts`, `open-brain/tests/pipelines/sync/hub-talk-exit-codes.test.ts`,
  `open-brain/tests/t247-pins-scrub.test.ts` (new), `open-brain/tests/vault-writer.test.ts`. All are in scope.
- **#498** `git diff origin/master...fee2bb50`:
  - **In the list:**
    - the bootstrap pipeline (`src/pipelines/bootstrap/index.ts`);
    - the CLI spec (`src/cli-spec.ts`);
    - the session-start render (`src/pipelines/session-start/briefing.ts`);
    - the tests: `tests/pipelines/import-cmds-harness.ts`, `import-cmds-i1…i9.test.ts`, `tests/shared/cli-args.test.ts`;
    - `project-template/.claude/commands/bootstrap.md`;
    - `CHANGELOG.md`.
  - **Outside the dispatch's list, both wiring only (L6):**
    - `src/cli.ts` (+21/−1): the `install-commands` branch, the `commands:` line in `check`, the help line and the
      "expected …" message. Nothing else changes.
    - `src/server.ts` (+2): one import and `oldStartCommand: oldStartCommandWarning(projectRoot)` in the
      `renderBriefing` call.
    - C2 and C4 cannot be delivered without these. The brief's own list says "cli-bootstrap", and `cli-bootstrap.ts` (the
      SessionStart hook) is not touched.

### Row 2: mutant runs. PASS (each red run fails only on its own rows)

| Run | Branch, head, parent | Mutant (one commit, verified) | Red tests (and nothing else) |
|---|---|---|---|
| 37643767212 | `loop/import-cmds` `fee2bb50` | the head | `test` **success** (`test-windows` skipped) |
| 37644218347 | `import-cmds-mut-1` `276de00d`, parent `759fe100` | the record gate in `installCommands` removed | `i2` "refuses without a record and writes nothing" (expected 0 to be 1), `i9` M1 |
| 37644223289 | `import-cmds-mut-2` `762cb144`, parent `759fe100` | `classifySessionCommand` returns `SIA` for any file | `i1`, `i3`, `i7`, `i8`, `i9` M2 and M3: 6 rows, all on OLD-vs-SIA |
| 37644228713 | `import-cmds-mut-3` `f566d48b`, parent `759fe100` | the `oldStartCommand` wiring removed from `server.ts` | `i7`, `i9` M3 |
| 37643480418 | `loop/t247-pins` `433c503b` | the head | `test` **success** (`test-windows` skipped) |
| 37643942123 | `t247-mut-h1` `b7d54bd3`, parent `433c503b` | `assertPathUnderDir` a no-op | `vault-writer` "T-247 H1: joinUnderVaultDir … (pins assertPathUnderDir)" only |
| 37643947033 | `t247-mut-h2` `427cb5b9`, parent `433c503b` | `applyScrubDbPragmas` a no-op | `t247-pins-scrub` "sets secure_delete ON …" only (the byte test stays green: J2) |
| 37643951488 | `t247-mut-g1` `8b1237ca`, parent `433c503b` | `clauseNegatesHubWaitAct(sentence, sentence)` | `hub-talk-exit-codes` "T-247 G1: NEG1 …" only |

`git diff 759fe100 fee2bb50` = `open-brain/tests/shared/cli-args.test.ts` only, as the dispatch states.

### Row 3: batch merge. PASS

- `0743d87a` + `--no-ff` merge of `fee2bb50`, then of `433c503b`: **no conflicts** (CHANGELOG included). The local merge
  HEAD is `ee0518d6`.
- `npm ci`, then `tsc --noEmit` **OK** and `npm run typecheck:tests` **OK**.
- One vitest run per touched file, all green:

| File | Result |
|---|---|
| `import-cmds-i1`…`i8` | 1/1 each |
| `import-cmds-i9` | 3/3 |
| `cli-args` | 71/71 |
| `vault-writer` | 24/24 |
| `t247-pins-scrub` | 2/2 |
| `hub-talk-exit-codes` | 20/20 |

- The same files are green on each PR head alone. Both heads also pass `tsc --noEmit` and `typecheck:tests`.

## #498 IMPORT-CMDS (rows 4–8): REJECT

### Row 4: I1–I8 re-derived on repos I built (`row456.mts`). PASS for I1, I2, I3, I5, I6, I7; I4 see L4

- **The fixture** is a project built from scratch: `makerspace-demo`, git root, the template's `.gitignore`, one
  commit "The project before SIA". It has:
  - `.agents/TASKS/{INBOX,task}.md` with P0–P3 headings and 4 tasks, `SYSTEM/SUMMARY.md`, `SESSIONS/next-session.md`
    and `Session_3.md`;
  - an old `.claude/commands/start.md` and `end.md`;
  - `.claude/commands/other.md` and `.claude/settings.local.json`.
- I drove the real CLI (`tsx src/cli.ts`) from the project root, and the real `handleStart`.
- **I1:** `bootstrap check` →
  - `.agents/:  PRE-STATE — TASKS/ with no state.json (the import path)`
  - `commands:  start.md OLD; end.md OLD; task.md absent; sync.md absent`
  - `Next: … Run \`state import --draft\`. After \`state import --commit\`, run \`bootstrap install-commands\`.` **PASS**
- **I2:** `install-commands` before the import → exit 1, `refused: .agents/TASKS/ exists with no state.json — run \`state
  import --commit\` first. Nothing written`. Snapshot diff: **NONE**. **PASS**
- **Import:** `state import --draft` (Validates: yes, Tasks: 4), then `state import --commit` (exit 0, state.json at
  revision 0, 4 views rendered). Afterwards, `git status`: ` M` next-session.md, SUMMARY.md, INBOX.md, task.md and
  `?? .agents/state.json`.
- **I5:** each of these gives exit 1, `refused: N uncommitted change(s) — commit or stash first. Nothing written`, with a
  snapshot diff of NONE. **PASS**
  - (a) straight after `--commit` (5 changes);
  - (b) an untracked `scratch.txt`;
  - (c) a modified tracked `README.md`.
- **I7 (before):** `handleStart` on the imported record with the old `start.md` → the briefing contains
  `OLD /start in this project: run bootstrap install-commands`, exactly once. **PASS**
- **I3:** after a git commit of the record, `install-commands` → exit 0:
  - `Archive: .agents/archive/pre-bootstrap-commands-2026-10-07/`, then `start.md: OLD -> SIA`, `end.md: OLD -> SIA`,
    `task.md: absent -> SIA`, `sync.md: absent -> SIA`.
  - The four files are **byte-identical** to the template.
  - The archive holds exactly `start.md` and `end.md`, with the old text.
  - The archive is ignored (`.gitignore:17:/.agents/*`).
  - Afterwards `check` reads `start.md SIA; end.md SIA; task.md SIA; sync.md SIA`. **PASS**
- **I6:** `other.md` and `settings.local.json` are byte-unchanged. The snapshot diff names only the four commands and
  the archive. **PASS**
- **I7 (after):** the line is gone. **PASS**
- **I4:** after the install is committed, a re-run gives exit 0, `SIA -> SIA (unchanged)` ×4, and a diff of NONE.
  **PASS.** A re-run **straight after I3**, before that commit, refuses: see **L4**.
- **I8:** Windows did not run. For the Linux stand-in, see row 8.

### Row 5: `/bootstrap` as written. FAIL, **L1 (High)**

I followed `project-template/.claude/commands/bootstrap.md` on a fresh copy of the same pre-state fixture:

1. **Step 1** `check` → PRE-STATE, so skip to step 6. The `commands:` line lists OLD/OLD/absent/absent.
2. **Step 6** `state import --draft` → Validates: yes.
3. **Step 7** `state import --commit` → exit 0.
4. **Step 7b** `install-commands` → **exit 1**,
   `refused: 5 uncommitted change(s) — commit or stash first. Nothing written`.
5. **Step 8** `git status --short --untracked-files=all` lists the record and its four views. **No commands are
   installed**, and `/start` still runs the old protocol after the `Bootstrap SIA` commit. That is the gap the brief
   exists to close.

- **The cause:** `state import --commit` writes `state.json` and re-renders four tracked views but makes no git
  commit (`runCommit`, `state-import/index.ts:1047`). Step 7b says "install SIA's copies **after** the owner has
  committed the record. The tree must be clean". On the import path the tree is never clean at that point. Nothing in
  the text tells the agent or owner to `git commit` between 7 and 7b.
- The PR's tests hide this. `importCommit()` in `import-cmds-harness.ts` adds a `git commit -m "import record"` that the
  document does not contain. I7 also adds a `commitWorkingTree`.
- **The workaround** (the owner git-commits the record before 7b, not in the text) gives **two** SIA commits:
  - `record`: state.json + the four views;
  - `Bootstrap SIA`: only `M .claude/commands/{start,end}.md` and `A .claude/commands/{sync,task}.md`.
- In that case step 8's `git status` lists exactly the four command files. **None of them are on step 8's list**, which
  names step 3's tracked files (step 3 never runs on this path), `state.json`, `next-session.md` and `CLAUDE.md`. Step 8
  then says "If anything else appears, stop and ask the owner".
- **So no reading of the text yields one clean `Bootstrap SIA` commit.** Taken literally, the commands are never
  installed. With the workaround, there are two commits and step 8 stops. The developer's flag is confirmed:
  installing the commands leaves files step 8 does not name.
- **Fix:**
  - **Either** let `install-commands` accept a tree whose only changes are the import's own outputs (`state.json` + the
    four views), which keeps 7b before step 8;
  - **or** move 7b after step 8, with its own commit.
  - In both cases, add the four `.claude/commands/*.md` to step 8's list for the import path, and say that step 3's
    list is empty there.
  - Add a test that runs `--commit` → `install-commands` with **no** git commit in between.

### Row 6: refusals. 6a–6c PASS; 6d FAIL, **L2 (Medium)**

| Case | Output | Exit | Writes |
|---|---|---|---|
| a. fresh install (git, no `.agents/`) | `refused: .agents/ is absent, not a bootstrapped record — nothing written` | 1 | none |
| a′. scaffolded, not imported | `refused: .agents/ is scaffolded, not a bootstrapped record — nothing written` | 1 | none |
| b. `state.json` = `not json` / `{}` / empty (committed) | `refused: .agents/ is not-a-record, not a bootstrapped record — nothing written` (all three) | 1 | none |
| c. outside a repository (valid record, `.git` removed, no repo above `~/qa-tmp`) | `refused: not a git repository — nothing written` | 1 | none |
| **d. read-only `.claude/commands/` (0555), valid committed record** | `refused: EACCES: permission denied, rename '…/.claude/commands/start.md' -> '…/.agents/archive/pre-bootstrap-commands-2026-10-07/start.md'` | 1 | **`+ .agents/archive/pre-bootstrap-commands-2026-10-07/` (empty dir)** |

- **L2 (Medium):** case d fails two parts of the row, "writes nothing" and "with a reason".
  - `installCommands` creates the archive dir before its first rename, and nothing removes it when the rename throws.
  - The message is the raw errno, not a reason that names the fix.
  - After write permission was restored, the next run archived into `pre-bootstrap-commands-2026-10-07-2/` and left the
    empty first dir behind.
  - The leftover is local and ignored, so `git status` stays clean.
- **Partial writes:** a failure **after** a rename (for example `copyFileSync` failing on the new file) would leave an
  `OLD` file archived and nothing in its place. Nothing rolls that back. I could not produce that order with a
  permission bit on Linux, so this is a reading of the code, not an observation.
- **Fix:**
  - Preflight write access to `.claude/commands/` and to the archive parent before any write. Refuse with a sentence
    such as "`.claude/commands/` is not writable — nothing written".
  - Remove the archive dir on failure, and roll back any rename already done.

### Row 7: my mutants (`vt.mjs`, each on `fee2bb50`, each `import-cmds-i1…i9` run once, restored)

| Mutant | Red tests | Verdict |
|---|---|---|
| (a) OLD deleted, not archived (the `rename` dropped; `copyFileSync` overwrites) | `i3` "installs four commands, archives two OLD files …", `i4` "is a no-op with exit 0 …" | caught |
| (b) `SIA` detection by raw bytes (`readFileSync(dest).equals(readFileSync(tmpl))` in `classifySessionCommand`) | **none**: i1–i9 all green | **L3** |
| (c1) the C4 line on a project without a record (the `isStateRecord` gate in `oldStartCommandWarning` removed) | **none** | equivalent through `ob_start` (L5) |
| (c2) the C4 line whenever the record is valid (classification ignored) | `i7`, `i8` | caught |

- **(b) Which is right? Normalising, as the code does.**
  - I showed it on Linux with git's own conversion (`probe8.mts`; see row 8). After a `core.autocrlf=true`
    re-checkout of a project's committed SIA commands, the files are CRLF on disk (`start` 152 CR bytes).
  - At head: `check` reads all four `SIA`, there is no C4 line, and a re-run is `SIA -> SIA (unchanged)` with a clean
    tree.
  - Under mutant (b): all four read `OLD`, `Next:` says to run install-commands, the C4 line fires, and every
    `install-commands` archives the SIA files and rewrites them as LF (`git status` shows 4 ` M`), **every time**.
  - The import path never scaffolds the template's `.gitattributes`, and that file covers only `.agents/` anyway. So
    any Windows project clone with `core.autocrlf=true` is in this case.
  - The brief's "byte-identical to the template" is the wrong wording for detection. It is right for what install
    *writes* (I3 confirms that).
- **L3 (Medium):** nothing pins the normalisation. I8 writes CRLF only into the OLD files, which are OLD either way.
  - **Fix:** a test that commits the installed commands in an `autocrlf=true` repo, re-checks them out (or writes
    them CRLF), and expects `SIA`, with no C4 line.
- **(c1):** `server.ts:394` renders the briefing (and calls `oldStartCommandWarning`) only when `sj.present && sj.valid`.
  - `probe7c.mts` under (c1): `oldStartCommandWarning()` returns the line for `.agents` none, pre-state and `{}`, but
    the `ob_start` briefing has it in **none** of them (it does not at head either).
  - So the C4 line cannot print on a fresh-install project through `ob_start` today. The gate inside the helper is
    belt-and-braces with no test.
  - **L5 (Low):** a unit row `oldStartCommandWarning(freshDir) === null` would pin it.

### Row 8: Windows. NOT RUN (Plumb). Linux stand-in, information only

- **The template with `core.autocrlf=true`:** `git -c core.autocrlf=true worktree add … fee2bb50` → the four
  `project-template/.claude/commands/*.md` have **0 CR bytes**, byte-identical to the LF tree. The repo's
  `.gitattributes` (`eol: lf`, `text: set` on these paths) wins.
  - So a CRLF template checkout does not occur from a git checkout, and the installed copy cannot read as `OLD`
    against itself through the template side.
  - Windows would need to confirm this, as would a template obtained any other way (zip, copy).
- **A spaced path with CRLF old files:**
  - The project is `…/probe8 spaced XXXX/my project`, with `core.autocrlf=true` and CRLF old `start.md`/`end.md`.
  - **I1:** `check` lists `OLD`.
  - **I3:** install → 4 × `-> SIA`.
  - **I7:** the line appears before the install and is gone after it.
  - The CRLF re-checkout case is in row 7(b) above. **Windows not run.**

### #498 findings

| ID | Severity | Finding |
|---|---|---|
| **L1** | **High** | `/bootstrap` as written: step 7's `--commit` leaves 5 uncommitted changes, so step 7b always refuses and the commands are never installed. The workaround (an unwritten git commit) gives two commits, and step 8's list does not name the four command files. The harness's `importCommit` git-commits the record, which masks this |
| **L2** | **Medium** | `install-commands` with a read-only `.claude/commands/`: a raw `EACCES` message, an empty archive dir left behind (the next run uses `-2`), and no rollback of a rename if a later step fails |
| L3 | Medium | CRLF-normalised `SIA` detection is correct (a raw-bytes mutant makes a CRLF re-checkout read OLD and reinstall forever) but no test pins it |
| L4 | Low-Medium | I4 as briefed ("re-run on I3 → no-op, exit 0") refuses with exit 1 (`4 uncommitted change(s)`), because the dirty check runs before the all-SIA check. `i4` commits first. Checking all-`SIA` first, so that it is a no-op, would match the brief |
| L5 | Low | Mutant 7(c1) is equivalent through `ob_start` (the briefing needs a valid record). The helper's own gate is unpinned |
| L6 | Low | `cli.ts` and `server.ts` are outside the dispatch's file list. Both are minimal wiring that C2 and C4 require |

## #499 T-247 (rows 9–11): REJECT

### Row 9: each pin fails for its own reason. PASS

The mutants were re-applied on `433c503b` with `vt.mjs`, each run against the file it targets, and restored:

| QA 288 mutant | Red test (only) |
|---|---|
| (b) `assertPathUnderDir` returns at once | `vault-writer` "T-247 H1: joinUnderVaultDir keeps summary files under Summaries (pins assertPathUnderDir)", 1/24 red |
| (g) `db.pragma("secure_delete = ON")` removed from `applyScrubDbPragmas` | `t247-pins-scrub` "sets secure_delete ON during a non-dry scrub run", 1/2 red |
| (g′) the call `applyScrubDbPragmas(db)` removed from `runScrubTriggerFires` | the same row, 1/2 red |
| clause → sentence widening (`clauseNegatesHubWaitAct(sentence, sentence)` in `guardedClauseViolation`) | `hub-talk-exit-codes` "T-247 G1: NEG1 stays a violation …", 1/20 red |

- The H1 date test throws at the new regex, before `assertPathUnderDir`, so it does not pin (b). The
  `joinUnderVaultDir(summariesDir, "..", "..", "escaped.md")` row does, because `joinUnderVaultDir` has no segment
  check.
- **J2 (Low):** "rerun after kill … clears planted secret bytes (**pins secure_delete=ON**)" stays green under (g).
  - With **VACUUM removed** (`db.exec("VACUUM")` → no-op), it goes red.
  - So it pins VACUUM, not the pragma. Its simulated "kill" is a clean `db.close()`, which checkpoints and removes the
    -wal, so the WAL window QA 288 measured is never exercised.
  - The pragma is pinned only by the spy test, which checks that the call was made, not its effect. That covers the
    H2 mutant as written. The byte test's name should say what it pins.

### Row 10: H1's new guard. FAIL on one named input, **J1 (Medium)**

`h1probe.mts`, `writeSummary` on a fresh temp vault for each date:

| `date` | Result | `Summaries/` created |
|---|---|---|
| `../x` | `VaultPathRefusal: summary date must be YYYY-MM-DD, got "../x"` | no |
| **`2026-13-01`** | **written: `Summaries/2026-13-01-proj.md`** | yes |
| `2026-10-07T00:00` | `VaultPathRefusal …` | no |
| `""` | `VaultPathRefusal …` | no |
| `2026-00-00` (extra) | written | yes |
| `2026-02-31` (extra) | written | yes |
| `" 2026-10-07"`, `"2026-10-07\n"` (extra) | `VaultPathRefusal` (JS `$` without `m` does not match before `\n`) | no |
| today's ISO date (the real caller's `new Date().toISOString().slice(0, 10)`) | written: `Summaries/2026-10-07-proj.md` | yes |

- **J1 (Medium):** `SUMMARY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/` checks the shape only. The dispatch names `2026-13-01` as
  an input that must be refused, and it is written.
- There is no traversal: every shape-valid date is digits and dashes, and nothing landed outside the vault. So H1's
  security purpose is met, but the named acceptance row fails.
- The only caller (`session-end/index-v2.ts:107`) passes an ISO date, so nothing is wrong in production today.
- **Fix:** also require a real calendar date, for example
  `new Date(\`${d}T00:00:00Z\`).toISOString().slice(0, 10) === d`, and add `2026-13-01` and `2026-02-31` to the test.

### Row 11: H2's byte test on Windows. NOT RUN (Plumb)

- On Linux, the byte test is **green with the pragma removed** (row 9 (g): 1 passed of 2, the spy row red). That
  confirms the developer's Linux statement.
- It goes red only when VACUUM is removed (J2). The Windows result is not available from this run.

### #499 findings

| ID | Severity | Finding |
|---|---|---|
| **J1** | **Medium** | `writeSummary` accepts `2026-13-01` (also `2026-00-00`, `2026-02-31`). Row 10 names it as an input that must be refused |
| J2 | Low | The test titled "pins secure_delete=ON" pins VACUUM: green without the pragma, red without VACUUM. The "kill" is a clean close |
| J3 | Low | Cosmetic: `SUMMARY_DATE_RE` is declared between two `import` statements in `vault-writer.ts`; `vault-writer.test.ts` imports from `"fs"` twice |

## Findings summary

| ID | PR | Severity | One line |
|---|---|---|---|
| L1 | #498 | **High** | `/bootstrap` as written: 7b always refuses after step 7, and step 8's list does not name the installed commands. There is no path to one clean `Bootstrap SIA` commit |
| L2 | #498 | Medium | Read-only `.claude/commands/`: a raw `EACCES`, an empty archive dir left behind, no rollback |
| L3 | #498 | Medium | CRLF-normalised detection is right but unpinned (raw bytes → endless reinstall on `autocrlf=true` clones) |
| J1 | #499 | Medium | `writeSummary` writes `date: "2026-13-01"`; the guard is shape-only |
| L4 | #498 | Low-Medium | Re-run straight after an install refuses (exit 1) instead of a no-op |
| L5 | #498 | Low | 7(c1) is equivalent through `ob_start`; the helper's gate is unpinned |
| L6 | #498 | Low | `cli.ts` and `server.ts` wiring are outside the dispatch's file list |
| J2 | #499 | Low | The "secure_delete" byte test pins VACUUM |
| J3 | #499 | Low | Cosmetic import order and a duplicate import |

Rows not run: 8 and 11 on Windows (this ran on Plumb). Both need a laptop run.

QA-290: REPORT COMPLETE
