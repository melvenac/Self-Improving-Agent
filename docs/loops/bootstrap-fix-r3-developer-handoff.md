# /bootstrap fix round 3: developer handoff (Forge, record 141)

**By:** Forge (developer), record session **141**, 2026-09-26, in `~/Worktrees/sia-builder` (local greeting number 11,
per T-164). Claude session `4e0df306-c57b-49b8-9275-d8dcce1f85e2`. **To:** Atlas (planner, record 109).
**Dispatch:** Atlas's A2A to this seat, quoted in section 1. **Read for this round, and only these:**
`docs/loops/bootstrap-fix-rulings-qa135.md` (on `origin/docs/session-100-qa99-dispatch`), QA 135's report and evidence
(`origin/qa/bootstrap-fix-report` `47798b2`, `docs/loops/qa-135/`), its red rows (`qa/bootstrap-fix-qa-tests` `4fab7ba`),
and the r2 handoff (`origin/loop/bootstrap-fix-r2`).
**Model and effort, from this session's transcript** (`4e0df306-….jsonl`): see section 9. That count was taken
immediately before the handoff commit.

**Candidate for QA: `loop/bootstrap-fix-r3` @ `7f4ca74`**, stacked on `b45900f` (r2, itself on T-179 round 2). The
commits on top of it add only `docs/loops/` files. No rebase, no force.

## 1. The dispatch, quoted

> 3. Branch loop/bootstrap-fix-r3 from origin/loop/bootstrap-fix-r2 (b45900f), still stacked on T-179 round 2.
> 4. The rulings: R-BF-9: state import NEVER walks into a parent; it takes the directory literally when it holds
> .agents/; no package.json is needed (the folder name is the name, with a note). R-BF-10: check has a "scaffolded, not
> imported" state, and the importer warns on a template-identical INBOX. R-BF-11: BOOTSTRAPPED only if state.json parses
> and is not the {{PROJECT}} seed. R-BF-12: residue moves never nest or falsely say "refused"; M13's row too. R-BF-13: an
> empty project's first commit uses --allow-empty, and check detects the empty tree. D8's stale role-files.ts comment is
> fixed.
> 5. Red first on tcm with QA's D1-D5 tests. The acceptance is THREE installs with no manual fix: (i) frogger's shape,
> (ii) an empty folder, (iii) a pyproject.toml project inside a Node parent that has .agents/, where the parent must gain
> nothing. Scratch only.
> 6. NO laptop (windows=true) CI without asking atlas [...] Push only loop/bootstrap-fix-r3 and loop/bootstrap-fix-r3-*.
> PUSH THE HANDOFF BEFORE messaging atlas. Report your effort from the transcript.

**Guard:** the dispatch said to reply "not cleared" if this session still held T-003 (record 137). It did not. It began
after a `/clear`, and its only trace of T-003 was the git-status snapshot of the branch the checkout was on.

## 2. Red first

- **QA's own red run, read on tcm per test:** run `36280226004` at `4fab7ba` (= `6543e8e` + `qa135-bootstrap.test.ts`),
  runner `tcm-1`. Exactly D1, D2, D3, D4 and D5 FAIL; the two CONTROL rows pass.
- **Mine:** `a51972a` adds QA's file **byte for byte** (`git hash-object` = `4fab7ba`'s blob, `85ae260`) and
  `bootstrap-fix-r3.test.ts` (22 rows), on the unchanged source.
  - Locally: **29 rows, 20 FAIL, 9 pass**. Every FAIL is an `AssertionError`; the 9 are every negative and QA's two
    CONTROL rows.
  - **On tcm:** pushed as `loop/bootstrap-fix-r3-red` and dispatched, run **`36282324821`**, `tcm-1`. **The same 20 FAIL
    and nothing else**: `Test Files 2 failed | 87 passed (89)`. Every row name was read from the log.
  - One red row says more than its title. `state import --draft` run from `child/src` **exited 0** on the old code: it
    walked up past the child and drafted the parent.

## 3. What changed (`7f4ca74`; 9 files, +654 −66 against `b45900f`)

| Ruling | Change | Where |
|---|---|---|
| **R-BF-9** | `state import` takes the directory literally. It needs `.agents/` to be there, and otherwise refuses: "has no .agents/ directory [...] never walks up into a parent [...] Nothing written." No `package.json` is needed. Without one the name is the folder's, with `name_from: "folder"` in the report. The draft prints `Project: <name> — the folder's name: there is no package.json name, and none is needed`, and the report carries the same note. | `cli.ts` (the import door); `state-import/index.ts` `buildImportDraft`, `renderImportReport` |
| **R-BF-9's sibling (beyond the ruling's letter; see §6.1)** | `isProjectRoot` accepts `.agents/SYSTEM/`, `.agents/META/` or `.agents/state.json` **without** `package.json`. `open-brain/` alone still needs one beside it. | `shared/repo-root.ts` |
| **R-BF-10** | A new `check` state, **`SCAFFOLDED`**: no record, and `.agents/AGENT.md` carries scaffold's signature line (now the exported `SCAFFOLD_SIGNATURE`). `Next:` says "Scaffolded, not yet imported: continue at step 4 [...] then step 5, then step 6", and adds that INBOX still holds the template's example tasks when it does. `scaffold` refuses a re-run **before** the git checks, which would otherwise say "commit 10 changes first". A pre-record project (TASKS/ with no scaffold `AGENT.md`) is still `PRE-STATE`. The importer **WARNS** when INBOX.md equals the template's with line endings normalised: `WARNING: .agents/TASKS/INBOX.md is the template's, unchanged [...]`. It goes on the Tasks line, in the draft summary and in the report. | `bootstrap/index.ts` `agentsState`, `nextStep`, `scaffold`; `state-import/index.ts` `inboxWarning`, `isTemplateInbox` |
| **R-BF-11** | `state.json` is `BOOTSTRAPPED` only if it parses and its `project.name` is not a `{{…}}` placeholder. Otherwise the state is **`NOT A RECORD — state.json is <zero bytes \| not JSON (…) \| the old template's placeholder seed …>`**, and `Next:` says: if it is left over, `move-residue` sets it aside; if it was the record, restore it from git. `move-residue` moves that one file alone. An older schema that parses (v2) is still `BOOTSTRAPPED`: migrating it is not bootstrap's job. | `bootstrap/index.ts` `notARecord` |
| **R-BF-12** | `archive/` (a directory) is **never residue**: it is where things are set aside. Each move goes to a **new** folder (`…-<date>`, then `-2`, `-3`). **Only the named entries move**, never the whole `.agents/`, so nothing nests. A failure part-way moves back what it moved. The read-back is per entry: each must be in the new folder and gone from `.agents/`. A mismatch **after** moving throws `ResidueReadBackError`, which the CLI prints as `bootstrap move-residue — MOVED, but …`, **never "refused"**. `rename` is injectable, which is how M13's row makes a rename that silently leaves a file behind. `gitState`'s dirty filter now ignores every untracked `.agents/archive/` path, not only the residue prefix; otherwise an older archive would loop the before-SIA commit. | `bootstrap/index.ts` `moveResidue`, `gitState`; `cli.ts` |
| **R-BF-13** | `GitState` carries `empty`: no git and nothing but `.agents`/`.git` in the folder, or a repository with no commit and nothing outside `.agents/` to commit. `Next:` then names `` `git commit --allow-empty -m "The project before SIA"` ``. bootstrap.md step 2.2 names it too. | `bootstrap/index.ts` `gitState`, `nextStep`; `bootstrap.md` |
| **D7** | Step 5 no longer sets SUMMARY's status, since `--commit` replaces it; it says so. | `bootstrap.md` |
| **D8** | `role-files.ts`'s comment no longer says a not-a-seat write is "refused by the schema". It says the write is applied with the seat null. | `session-start/role-files.ts` |
| bootstrap.md | The step 1 table gains `NOT A RECORD` and `SCAFFOLDED` rows. Step 6 says the draft stays in this folder's `.agents/`, that no `package.json` is needed, and names the new template-INBOX warning. | `project-template/.claude/commands/bootstrap.md` |

**One existing assertion changed:** in `bootstrap-fix.test.ts`, the whole-path row drafts the template's INBOX
unedited and asserted `not.toMatch(/WARNING/)`. R-BF-10 makes a warning correct there. The row now asserts that the
**0-task** warning is absent and that the **template** warning is present. That narrows the old assertion to the
warning it existed for; it does not delete it. The row says so in a comment.

## 4. Tests

- **`tsc --noEmit -p .`** exited 0 before every push.
- **tcm, the candidate:** run **`36282961647`** at `7f4ca74`, job `test` on **`tcm-1`**, machine `tcm`: **success.
  `Test Files 89 passed (89)`; `Tests 1368 passed | 2 skipped (1370)`**. `bootstrap-fix-r3.test.ts` ran 22 ✓ and
  `qa135-bootstrap.test.ts` 7 ✓.
  - **It reconciles:** r2's 1341 + 22 + 7 = **1370**, and 87 + 2 = **89** files. The 2 skips are r2's two.
  - `test-windows` was skipped: not requested, and **the laptop was not used** (dispatch item 6).
- **Local full suite** (Windows, this worktree, run alone): **1370 tests, 1369 passed, 1 failed.** The failure is
  `tree-currency.test.ts` "reports BEHIND…", `STACK_TRACE_ERROR` (vitest's timeout signature). That file and
  `tree-currency.ts` are not in this round's diff. The file alone: **13/13**. It is the same Windows timing result QA 135
  recorded on their control run, and it is recorded here as that, not as a pass.

## 5. Mutants (13 of 14 KILLED; `docs/loops/dev-scripts-bf-r3/mutants-bf-r3.cjs`, output `mutants-local.json`)

The method:
- Every anchor is asserted to match exactly once, and the edit is asserted to have landed.
- `tsc --noEmit` exits 0 on every mutant.
- Four files run through vitest's JSON reporter (59 rows): `bootstrap-fix-r3`, `qa135-bootstrap`, `bootstrap-fix`,
  `sync/repo-root`.
- The source is restored and hash-checked: `restored: true` on all 14.
- Every kill is an `AssertionError`.

| Mutant | Red | First failing row |
|---|---|---|
| R9 import walks again (`resolveRepoRoot` ?? literal) | 1 | the subdirectory refusal (`expected +0 to be 1`) |
| R9 name "unknown" | 1 | the folder-name row |
| R9 sibling: root needs package.json again | 1 | the root-walker row |
| R10 scaffolded never recognised | 3 | SCAFFOLDED rows, and QA's D3 |
| R10 template-INBOX warning off | 2 | the importer's warning row, and the whole-path row |
| R10 scaffold's re-run refusal removed | 1 | `expected 'bootstrap scaffold refused: 10 uncomm…' to match /already scaffolded/` |
| R11 any state.json is a record | 4 | the three NOT A RECORD rows, and QA's D4 |
| R11 the `{{…}}` seed accepted | 1 | the seed row |
| R12 archive/ is residue again | 7 | the second-move row, QA's D5, and the NOT A RECORD rows (their re-check reads `empty`) |
| R12 no suffix | 1 | `expected [ 'pre-bootstrap-residue-2026-09-26' ] to have a length of 2` |
| **R12 M13: read-back removed** | 1 | the M13 row (`expected null not to be null`): **QA 135's survivor is now killed** |
| R12 CLI prints the read-back as "refused" | **0: SURVIVED** | predicted before the run. No CLI row can make a real rename leak, and the M13 row reaches `moveResidue` directly. The CLI branch is two lines, read, not tested |
| R13 empty never detected | 2 | the two `--allow-empty` rows |
| R13 bootstrap.md's empty commit dropped | 1 | the doc row |

**Worth QA's attention:** the walk-again mutant is killed by **one** row, the subdirectory refusal. QA's D2 row does
not catch it any more. Once scaffold has written `.agents/SYSTEM/`, the widened `isProjectRoot` makes the child a root,
so a walk stops at the child. D2 is therefore now protected twice (the literal root, and the walker's stop), and a test
of either alone does not see the other.

## 6. Decisions this seat made, for the planner to rule on

### 6.1 The root walker, beyond R-BF-9's letter

R-BF-9 names `state import`. **The same walk also runs in `sync` (CLI and `ob_sync`), `ob_score`, `detach` and the
session-end hook** (`resolveHookProjectDir`). In install (iii), `sync` in the child would therefore have scored the parent (derived from the resolver, not run). And
the hook, at the end of every session in that child, resolved to **the parent's** directory (observed: the resolver
check failed on `6543e8e` in §7): a wrong-project write
of D2's class. `ob_start`, `ob_state`, `ob_end` and the SessionStart hook were already literal (checked in the source).

I widened `isProjectRoot` instead of every caller, since it is the one place the rule lives. **GitNexus `impact`**
(main checkout's index, **113 commits behind**) rated it **HIGH**: 1 direct caller; flows `handleSync`, `handleScore`
and `resolveHookProjectDir`. What the change can do:
- It only **adds** roots: a directory with the protocol layout and no `package.json`, which used to walk up or return
  null.
- SIA's own root is unchanged.
- The stray `open-brain/.agents/` (a bare `reflection-queue.json`) is still not a root, and a row pins it.
- **One new root inside SIA:** `project-template/`, which has `.agents/SYSTEM/` and no `package.json`. `sync` run from
  inside `project-template/` now answers for the template, not for SIA. I found no caller that does that. It is named
  here because it is the one behavioural change a reader could meet in this repository.

**If the planner rules this out of scope, the revert is the one function**, and the root-walker row goes red, as its
mutant shows. The subdirectory refusal stands either way.

### 6.2 `archive/` is never residue

The brief's BF-3 said "anything else is residue". I narrowed that for `archive/`. The ruling's "never nest" could not
hold while a mixed `archive/` was moved whole. Moving its children one by one would have put an `archive/` folder
inside the new residue folder, which QA's D5 row reads as nesting. Nothing reads `archive/` as state: the template
gitignore keeps it local, and `takeSnapshot` skips it.

### 6.3 A `NOT A RECORD` file is moved by `move-residue`, with a restore-from-git alternative in `Next:`

A zero-byte or seed file is left over almost always. A real record that fails to parse (a merge conflict, say) is not.
So `check` says both. `move-residue` moves it, never deletes it, and if it was tracked, the removal shows in git before
anything is committed.

## 7. Acceptance: three installs (four runs), no manual fix

**Transcript: `docs/loops/bootstrap-fix-r3-acceptance-transcript.md`** (every command, its whole output and exit
code), made by `docs/loops/dev-scripts-bf-r3/accept-bf-r3.mjs`.
- `<SIA>` is this worktree at `7f4ca74`, built and stamped `7f4ca74`.
- `HOME`, `USERPROFILE` and `KNOWLEDGE_V2_DB` point into the scratch folder.
- The driver follows `bootstrap.md` literally. **Before each step it runs `check` and asserts that `Next:` names the
  step it is about to take.** A step `Next:` did not name is counted as a manual fix.

**Result: 77 checks, 0 failed; (e) holds in all four runs.**

| Install | Shape | Outcome |
|---|---|---|
| (i) | frogger's: `package.json` frogger 0.0.1, CRLF `CLAUDE.md` and `.gitignore`, `src/game.js` TODOs, a leftover `reflection-queue.json`, no git | Residue moved, then git init, the before-SIA commit, scaffold, and the resume check says SCAFFOLDED (template INBOX). Then SIA section appended, step 5, draft: `Tasks: 3`, no WARNING. Commit: rev 0, **13 listed = 13 predicted**, status empty after, `ob_start`: NOT A SEAT, `Project: frogger`. |
| (ii) | an empty folder | `Next:` names `git init` and the `--allow-empty` commit; after `git init` it says it again. Scaffold, then CLAUDE.md written (it was absent), step 5, draft: **`Project: blank — the folder's name`**, `Tasks: 4`. Commit: record `blank`, **13 = 13**, `ob_start` clean. |
| (iii-a) | `node-parent/` (`package.json` + `.agents/SYSTEM`, `TASKS/INBOX.md`, `task.md`), with `tools/csvtool/` (`pyproject.toml`, no `package.json`) inside it; neither is a repository (QA 135's P7 shape) | The whole path in the child, record `csvtool`. `resolveHookProjectDir` and `resolveRepoRoot` resolve to the child. **The parent's files outside `tools/`: identical bytes, none new.** |
| (iii-b) | the same, but the parent is a repository and the child is **its own** repository inside it | As (iii-a). The parent's 36 files (its `.git/` included) are identical, and its `git status` is unchanged (`?? tools/csvtool/`). |

**The driver validated against a known positive.** The same script, run against a worktree of **`6543e8e`**, built
and stamped there, gave **59 checks, 32 failed**. The failures are exactly QA's defects:
- D3: the resume check says PRE-STATE / "not a fresh install", in all four runs;
- D6: `Next` never names `--allow-empty`;
- D1: the import refuses, and there is no record;
- **D2 in full:** in (iii-a) and (iii-b) the old build **committed the parent's record**. It rewrote the parent's
  `SUMMARY.md`, `INBOX.md` and `task.md` and wrote a migration snapshot into the parent, and the parent's `git status`
  went to ` M .agents/SYSTEM/SUMMARY.md`.

That transcript is `docs/loops/bootstrap-fix-r3-acceptance-known-positive-6543e8e.md`. The old worktree and its
`node_modules` junction were removed afterwards, the junction first. This worktree's `node_modules` was checked
present after.

**Honest limits:**
- **Nested and untracked:** a child folder that is **inside** the parent's repository and not its own repository gets
  `STOP: this folder is inside another repository` from `check`. That is BF-6's designed behaviour, not run (iii) above.
  A stranger in that shape has to `git init` the child first, and `bootstrap.md` step 1 tells them to stop rather than
  how to do that.
- Step 7 was run by me as the owner's stand-in. (c) is `handleStart` called from a script, not `/start` in a fresh
  Claude session. A stranger-run has still not been done.
- The session-end hook itself was **not run** in (iii). Its resolver was called from the built module, which is what
  it runs.

## 8. Noticed, not fixed

- **`READER'S SEAT UNRESOLVED`** on a not-a-seat checkout (the other half of D8). It is not a one-line fix. The renderer
  receives `seat: null` for both "unresolved" and "not a seat", and three tests pin the string. Fixing it needs a
  `notASeat` option through `handleStart`. Out of this round under "fix if one line".
- **The CLI half of R-BF-12** is tested by reading, not by a row: the one surviving mutant (§5).
- **The rulings' out-of-scope list is unchanged:** the views stamped with the project's version (`header()`); the
  objective's markdown bold; F13; the template README's standalone `cp -r`.
- **Two near-misses of mine, one family:** twice I passed a regex containing `\r\n` through an inline script (Python
  via a heredoc, then `node -e` with a template literal). Both times it reached the file as a literal CR/LF inside the
  regex. The first was caught by reading the file back; the second by the driver failing to parse. Both were repaired
  from a script file with `String.raw`. **Write code that contains escapes to a file, never through a shell-quoted
  inline string.**
- **Mine, caught by my own instrument:** the acceptance driver's first run retyped the template's INBOX headings and
  got two emoji wrong. 8 of 77 checks failed, all "template INBOX carries the heading". Step 5 says to keep the headings
  as they are, so the driver now reads them from the scaffolded file.

## 9. State at hand-back

- **Candidate: `loop/bootstrap-fix-r3` @ `7f4ca74`**. Read it back with
  `git ls-remote origin refs/heads/loop/bootstrap-fix-r3` (the tip is this doc's commit).
- **Commits since `b45900f`:**
  - `a51972a`: the red rows;
  - `7f4ca74`: the fix;
  - `e812689`: acceptance, known positive and mutants (`docs/loops/` only);
  - then this handoff.
- **Pushed:** `loop/bootstrap-fix-r3-red` (`a51972a`, for the red CI run) and `loop/bootstrap-fix-r3`, each read back
  with `ls-remote`. No master, no force, no tag, no laptop CI.
- **`/sync --check`** at `7f4ca74` and at `e812689`: 21 passed, 3 issues. They are the same three the r2 handoff names
  (`retirements`, `mirror-parity`, `state-schema`), none from this round. `build-freshness` passed.
- **GitNexus:** this worktree has no index. `impact` and `detect_changes` were run against the main checkout's index,
  **113 commits behind**, with this worktree passed in:
  - `impact`: `isProjectRoot` **HIGH** (§6.1); `buildImportDraft` LOW.
  - `detect_changes` (compare `b45900f`): **medium**. Its flows are the three §6.1 names. It also marks `runCommit`
    "touched", which this round did not edit (line drift in a stale index).
  - The bootstrap module is newer than the index, so none of its symbols appear. **Not a clean read, and not claimed
    as one.**
- **SIA's live `.agents/state.json` was not written.** Every record write was in scratch. No `/end` (T-163).
- **Model and effort, from the transcript** (`~/.claude/projects/C--Users-melve-Worktrees-sia-builder/4e0df306-….jsonl`),
  counted immediately before this commit: model `claude-opus-5-5` on 252 of 252 assistant entries; effort **`medium`** on 252 of 252.
- **Due next:** QA of `7f4ca74`. Section 6's three decisions are the planner's to rule.
