# Loop 15 slice three — QA report A11: candidate A11 `bbf9d07` (product `ef2a8a7`): REJECTED, on R85 alone

**By:** the QA seat, record session **130** (the dispatch assigned it) · **Date:** 2026-09-26/27 (UTC).
**Where:** the QA PC `desktop-o4egb1e`, in `C:\Users\Aaron Melven\Worktrees\sia-qa`, launched headless by
`docs/loops/qa-130/drive.ps1` from `docs/loops/qa-queue.ps1`. Nobody watched the run and the planner could not be reached.
Every question I would have asked is in **§15, Open for the planner**, with what I did instead.
**Model and effort:** the driver launched `--model claude-opus-5-5 --effort high`, and the transcript agrees (§0.1).

**Dispatch:** `docs/loops/loop-15-slice-3-dispatch-qa-a11.md` at the QA tree's HEAD `2667c6b` (`drive.meta`
`head=2667c6ba…`). **Rulings:** `docs/loops/loop-15-slice-3-rulings-19.md` (R83–R88), R85b as the dispatch quotes it
(hub turn 155), and rulings-18 readings 1, 5 and 6 and R82. **Predecessor:** QA 108's report
(`origin/qa/loop-15-slice-3-a10-report` `d352af3`, byte-identical to the untracked copy in this tree), read in full.

**Candidate (frozen):** **`bbf9d07e81a6ebbc9363586c79b846dfdc4980da`** on `origin/loop/15-slice-3-candidate-a11`, the
same in the driver's `refs-before.txt` (23:18Z) and by `ls-remote` during the run. Product tree `ef2a8a7`; `bbf9d07`
adds only the handoff. Built by Grok 4.7 in Cursor, developer record 115, on A10 `4b7a5ae`. I read the handoff at
`bbf9d07` in full.

**Scored on:** win32 (Windows 10 Pro 19045), Node v22.23.3 (the same PC and git as QA 108). This session can make file and
directory symlinks, junctions and hard links on win32, and cannot make a file unreadable to itself there. Every EACCES
shape is therefore Linux: CI on this seat's own `qa/loop-15-slice-3-a11-*` branches, **all on tcm** (`Machine name:
'tcm'`, runners `tcm-1` and `tcm-2`, git 2.43.0), **7 of the 8 allowed runs used** (§5.2). **Temps (T-190):** probes and
mutants ran with `TEMP`=`TMP`=`C:\qa-tmp`; the one full suite ran with the driver's default temp (§5.1). `drive.meta`
lists `C:\qa-scratch` and `C:\qa-tmp` as Defender exclusions.

---

## Verdict: REJECTED, on R85 alone. Every behavioural ruling holds: R83, R84, R86, R87 and R88 pass, and so does R85b as ruled. Every positive QA 108 measured on A10 now passes, on win32 and on tcm, and there are no regressions. But R85 made the whole-file search "the deliverable", and the handoff's list misses two sides. One of them was added by A11's own R83 commit: the repository side prints `unreadable (EACCES); type file dev null ino null nlink 0 size 0 mtimeNs 0` for a path whose `lstat` failed, and records a path it cannot see as `created`

**What A11 fixed, measured against QA 108's named known positives** (tcm run 1 `36279688475`, and win32):

| QA 108 item | At A10 | At A11 | Evidence |
|---|---|---|---|
| **A10-1a** (a planted hook in a 0600 hooks dir passes a completed loop) | completed, 29 git calls | **closed** | Q108-IDENTIFY-NOSEARCH-PLANT `✓` (tcm), the developer's R83-NOSEARCH-PLANT `✓`; mine: Q130-R83-SUBDIR-NOSEARCH-PLANT and -DOTGIT-NOSEARCH fail `stage-changed-config` with **0 git calls after the role** |
| **A10-1b** (a user's hook deleted by the restore) | `pre-commit` deleted | **closed** | Q108-BEGIN-NOSEARCH-THEN-EDIT `✓`. The loop is now refused at the planner stage's open (R88): `config-watch-unestablished`, `unreadable: …/hooks/pre-commit (EACCES)`, and the role never runs (Q130-R88-NOSEARCH-AT-OPEN: the hook's bytes are unchanged) |
| **A10-1c** (present hooks recorded `deleted → absent`) | `deleted` | **closed** | Q108-IDENTIFY-NOSEARCH-KEEP `✓` (`modified`, `unreadable (EACCES)`) |
| **A10-2** (R82's stop only for a read stage start) | loop continues | **closed** | Q108-R82-ABSENT-THEN-EACCES, -LOOP, -NOTAFILE-, -TWONAME- `✓`; control `✓`; mine Q130-R84-DANGLING-THEN-EACCES `✓` |
| **A10-3** (bare `absent` for a failed `lstat` at the stage start) | `absent` | **closed** | QA 104's R73-PARENT-EACCES `✓` (healed against QA 108's run 1) |
| **A10-4** (`unobservable (<code>)` alone) | alone | **closed as QA 108 measured it** | Q108-R79-FILE000-ALONE `✓` (tcm), -ELOOP-ALONE `✓` (win32 and tcm). **But the same shape under a directory link at base drops the file's facts: A11-2** |
| **A10-5** (zeroed facts on an ancestor link's current side) | zeroed | **closed** | Q108-R79-ANCESTOR-ZEROED, -TYPECHANGE-ZEROED `✓` (win32 and tcm): `…; absent (ENOENT)` |
| **A10-6** (an ancestor link's type-change text has no link facts) | missing | **closed for the ruled shape** | the developer's R86 row `✓` (tcm); my win32 junction copy `✓`; Q108-R80-ANCESTOR-JUNCTION-TEXT prints `hasLinkIno: true` on both platforms. **The absent → ancestor-link text still has none: A11-3** |
| **A10-7** (R72's call site has no killing test) | 0 kills | **closed** | `q108-r72-callsite` (the developer's `mut-r87-callsite`, the same line byte for byte) kills R87-EQUAL-REPORTED and R87-UNCHANGED-SILENT on win32 (locally) and on tcm (`36222008162`, re-read) |
| **§11.3 / R88** (a read failure at the open) | `ok: true` | **closed** | R88-EACCES-AT-OPEN `✓` (tcm); mine: a 3 GiB hook at the open is refused with `(ERR_FS_FILE_TOO_LARGE)`, win32 and tcm; a deliberate not-read at the open is **not** refused (Q130-R88-NOTREAD-IS-NOT-A-FAILURE) |

**Why it is rejected.**

**A11-1 (medium; R85's search, R79 "a placeholder never pretends", CA-15 clause 4): the repository side's record of a
contained `lstat` failure prints zeroed facts and an invented type, and names a path it could not see as `created`.**
- R83 added `unreadableIdentity(id)` (`configwatch.ts:459`), built from `fileState(id, …)` of the FAILED identity: `kind:
  "file"`, `dev null`, `ino null`, `nlink 0`, `size 0`, `mtimeNs 0`. `stateHash` (`:520`) prints any state with a
  `readError` as `${readError}; type file dev … mtimeNs …`. So a path whose `lstat` failed reads:
  `unreadable (EACCES); type file dev null ino null nlink 0 size 0 mtimeNs 0`.
- **Measured on tcm (`36279688475`):**
  - Q130-R85-REPO-UNREADABLE-ZEROED (the NOSEARCH-PLANT shape): `created (absent → unreadable (EACCES); type file dev null
    ino null nlink 0 size 0 mtimeNs 0)`. The same text is printed in every EACCES shape of mine
    (Q130-R83-SUBDIR-NOSEARCH-PLANT, -DOTGIT-NOSEARCH). The developer's R83 rows go through the same line and assert only
    `toContain("unreadable (EACCES)")`.
  - Q130-R83-DOTGIT-NOSEARCH (`.git` made 0600 after a plant): besides `config modified (… → unreadable (EACCES); type file
    dev null …)`, **`<common>/config.worktree created (absent → unreadable (EACCES); type file dev null …)`**. That file
    was absent at the open and cannot be seen at close. The record says a regular file of size 0 was created, and the
    unrestored note says `(a other was created; not removed recursively)`.
- **Every stage in these shapes fails `stage-changed-config` and stops before git**, so nothing is accepted on the text.
  The defect is the record, which is what R85 is about.
- **Why medium, and why it rejects:** R85 names this class's third round (A9-4, A9-6, A10-3/4/5) and rules "Search the
  whole of `configwatch.ts` for any other side built from a bare word or zeroed facts … the search is the deliverable".
  The handoff's search lists `stateHash(null)`, `baseText`, `stageBefore`, `currentSide`, `linkSide` and R85b's
  `unobservableSide`, and not this line, which A11's own R83 commit made reachable. At A10 an `lstat` failure
  here was `null` (A10-1); at A11 it is zeros. A10-3 (a bare `absent` for the same failure on the machine side) was scored
  medium.
- **Known negative:** `FIX-q130` adds one line at `:520` (`if (s.readError && s.dev === null) return
  \`${s.readError}; no facts: lstat failed\``, with the two fixes below). On tcm it **heals Q130-R85-REPO-UNREADABLE-ZEROED
  and kills nothing** (`36279953134` against `36279688475`); on win32 it kills nothing in 412 rows (§4).

**Lower** (§9):
- **A11-2 (low; R85 bullet 2, "`unobservable (<code>)` carries the facts `observe()` has"; R85b's "where observe HAS an
  lstat, it prints those real facts"):** when the watched file sits under a **directory link present at base** (the XDG
  `git` dir as a dotfiles link, R35's supported shape), is read at the stage start and made 000 by the role,
  `unobservableSide` (`:1305`) returns the link's text alone. `observe()` had `stat`ed the file (dev, ino, size, mtime), and
  the text drops those facts. That is A10-4's shape through a link.
  - Measured (Q130-R85-VIA-FILE000, tcm): `after: unobservable (EACCES); link: type symlink dev 66306 ino 4859374 … readlink
    …/vf-target`. The file's `ino 4859373` is absent. The stage fails `machine-config-unobservable`.
  - Known negative: `FIX-q130`'s `resolves to: <facts>` when `dev` is set heals it, 0 kills.
  - Scored low because the text is not alone (it carries the link's facts), as A10-6, its mirror image, was low.
- **A11-3 (low; R86 read with R79; §15 Q2):** an ancestor link planted where the loop base was **absent** prints
  `absent → symlink target …; not read through; <resolved facts>` and **not the link's `lstat`**. R86 fixed the
  type-change branch (`:1371`), and the `absent →` branch (`:1370`) calls `currentSide` alone. For a link AT the path, both
  branches print the link's facts (`linkSide`). So the ancestor case is not "labelled as for a link at the path" in this
  branch.
  - Measured on win32 (junction) and tcm (Q130-R86-ABSENT-ANCESTOR-LINK).
  - `FIX-q130` heals it, 0 kills.
  - Also Q108-R79-ANCESTOR-ZEROED's own text at A11: `absent → symlink target …; not read through; absent (ENOENT)`, no
    link facts.
- **A11-4 (cosmetic, A10-8's family):** a directory put where `.git/config` was is recorded `deleted (… → absent)`,
  because `readState` returns `null` for kind `dir` (the handoff's `:479` answer, which I accept as behaviour; §3.1). The stage fails
  and stops before git (Q130-R83-DIR-AT-CONFIG, win32 `EPERM` and tcm `EISDIR` on the restore's rename). The unrestored
  note for a created path that cannot be `lstat`ed reads `a other was created`.
- **Test gaps (not defects in the product; §4):** after R85b no developer row pins A10-4's shape (facts printed when
  `stat` succeeded). My `q130-r85-factsdrop` is killed only by QA 108's Q108-R79-FILE000-ALONE (`36279958422`). No
  developer row pins R88 for an `lstat` failure at the open: `q130-r88-lstat` is killed only by my two rows
  (`36279965058`). The handoff says R85b's link branches have no row: `q130-r85b-via` is killed only by my
  Q130-R85-VIA-TARGET000 (`36280189650`).

**The full suite at `bbf9d07`, with the default temp (the Defender-on control): `SUITE_EXIT=0`, 83 files passed and 7 skipped, 1155 passed, 70 skipped (1225), 0 unhandled** (§5.1). The total equals CI's on the candidate (`36229579888`: 1 failed (CA-9), 1219 passed, 5 skipped (1225)).
**Merge with master: NOT clean.** `git merge-tree --write-tree origin/master bbf9d07` exits 1 with **one content conflict,
`.github/workflows/ci.yml`** (A's `npm test -- --reporter=verbose`, from A9's `7b6312a`, against master's new
`test-windows` job, which rewrote the lines next to it). Every other path merges cleanly, and master's changes since `9bc06e3` touch no
file under `open-brain/src/harness` or `open-brain/tests/harness` (§1).

---

## 0. Rulings and authority in force

| Source | Where |
|---|---|
| **Rulings-19** R83–R88 | `docs/loops/loop-15-slice-3-rulings-19.md` in the QA tree at `2667c6b` |
| **R85b** (hub turn 155) | the dispatch's quotation: "when observe has no lstat facts, the text says so and prints no zeros; where observe HAS an lstat, it prints those real facts" |
| **Rulings-18** readings 1, 5, 6 and R82 (with turns 94 and 107) | `docs/loops/loop-15-slice-3-rulings-18.md` at `2667c6b` |
| QA 108's report and probes | `d352af3`; probes from `origin/qa/loop-15-slice-3-a10-probe2` (`2e029d7`) |
| The dispatch | `loop-15-slice-3-dispatch-qa-a11.md` at `2667c6b` |
| **CI on this seat's own branches** | tcm, at most 8 runs; **7 used** (§5.2) |
| **Pushing** | only `qa/loop-15-slice-3-a11-*`, only through `node docs/loops/qa-130/push-qa.mjs <branch>`; every push read back by the script |

### 0.1 Model and effort

- **The session's init line** (`%USERPROFILE%/sia-qa130/run-0.jsonl`, parsed as JSON by `effort11.mjs`): `model:
  "claude-opus-5-5"`, session `430d1f97-528d-454f-9cef-76a2f0b880b7`, `permissionMode: "dontAsk"`, Claude Code `2.1.282`.
  The init line has no effort field; it carries `per_turn_effort_active`.
- **The process command line** (`wmic`, at the start): `claude.exe -p "…" --model claude-opus-5-5 --effort high
  --permission-mode dontAsk …`.
- **The host transcript** (`~/.claude/projects/C--Users-Aaron-Melven-Worktrees-sia-qa/430d1f97-….jsonl`, parsed as JSON):
  **208 of 208 assistant entries** carry `model: "claude-opus-5-5"`, `effort: "high"`, `perTurnEffort: "high"`,
  **23:18:27Z → 00:23:30Z**. That span covers every measurement, mutant, CI dispatch and the suite. The turns after it
  (writing the report, the commit and the push) are not in the count.

## 1. Frozen-candidate conditions

| Condition | Observation | Result |
|---|---|---|
| built on A10 | `4b7a5ae` is an ancestor of `bbf9d07`; every commit in `4b7a5ae..bbf9d07` has one parent (9 of 9) | held |
| **the commit table** | `git diff --stat` on each of the 8 commits: `0cf7933` (cw +14, r83 +160), `6fa7cea` (+15 −2, +100), `a5f3715` (+17 −4, +130), `adb20a4` (+31 −1, +41), `ff637a2` (+83, test only), `0f42cc8` (cw +25 −2, runtime +5 −4, +60), `143b9b1` (handoff +107), `ef2a8a7` (cw +8 −1, r85 test +6 −2); `bbf9d07` (handoff +13 −6) | **matches the handoff's table** |
| A11's whole diff | `4b7a5ae..bbf9d07` (`--numstat`): `configwatch.ts` +97 −8, `runtime.ts` +4 −1, six new test files (r83 160, r84 100, r85 134, r86 41, r87 83, r88 60), the handoff. **No test file that existed at A10 changed** (the handoff: "through R88, none"; R85b's change is inside A11's own r85 file) | as the handoff says |
| QA 104's probes in the tree | `qa104-a9-probe2` `14b8fa47`, `-probe3` `6f11b34b`: the same blobs at `4b7a5ae` and `bbf9d07` | byte-identical |
| **tree moved** | `bbf9d07…` in `refs-before.txt` (23:18Z) and by `ls-remote` during the run | **not moved** |
| **merge with today's `origin/master` (`aae0dce`)** | `git merge-tree --write-tree origin/master bbf9d07`: **exit 1, one conflict, `.github/workflows/ci.yml`** (stages `d24030a`/`1c0fbf3`/`f0619a5`). A's side is `7b6312a` (A9 era: `npm test -- --reporter=verbose`); master's is `607fa87`, `9f7206d`, `b3baba4` (the opt-in `test-windows` job, added right after the Test step). `git diff --name-only 9bc06e3 origin/master`: 173 paths, 30 outside `docs/` and `.agents/` (`ci.yml`, `CHANGELOG.md`, `cli.ts`, `pipelines/state-import`, `pipelines/sync`, their tests, …), **0 under `harness/`** | **does NOT merge cleanly**; the conflict is mechanical (keep both edits). The handoff records the drift and that no merge was made |
| **QA tree** | detached at `2667c6b` throughout; its porcelain entries at the start were the 13 driver copies (`porcelain_lines=13`). The candidate was examined in archive copies (`C:/qa-scratch/qa130/arch/`), mutant copies (`mut11/`) and a worktree (`wt-a11`); CI commits were built with a temporary index | clean |
| build | `npm ci`, `npm run build`, `npx tsc --noEmit -p .` exit 0 in `wt-a11`; 0 porcelain entries after | current |
| **CA-13**, no version bump | `git diff 9bc06e3 bbf9d07 -- package.json open-brain/package.json CHANGELOG.md`: empty | **pass** |
| the candidate's own CI | `36229579888` on `bbf9d07` (tcm-2): 1 failed (CA-9) \| 1219 passed \| 5 skipped (1225) | as the handoff says |

## 2. Rows, and each ruling scored

**Win32 rows** (the BASELINE, A11 archive copy, JSON reporter, 23:32:54–23:35:08Z):
- **What ran:** A10's config row files, A11's six (r83–r88), `process-role`, `spawn-sites`, `refwatch-stage`, `runtime`,
  QA 104's probe2 and probe3, the carried QA 89–104 probes, QA 108's three files and mine.
- **412 tests: 265 passed, 139 skipped, 8 failed, 0 unhandled.**
- **The 8 reds:** my Q130-R86-ABSENT-ANCESTOR-LINK (A11-3), and 7 carried assertions QA 108 already listed as obsolete:
  QA 99's R69-GITCONFIG-FIRST, R70-HANDLE-FACTS and R71-BASE-LABEL; QA 96's TRADE-LOCKRENAME, R65-FACTS and
  HANDLE-NLINK-BASE; QA 94's NO-SEAM CONTROL.
- **Against QA 108's A10 baseline, test by test** (`cmpbase.mjs`): 381 tests ran at both. **378 have the same status,
  and 3 changed, all from failed to passed:** Q108-R79-ANCESTOR-ZEROED, -ANCESTOR-TYPECHANGE-ZEROED and -ELOOP-ALONE
  (A10-4 and A10-5).

**tcm run 1** (`36279688475`, tcm-1, the same file set plus the full suite):
- **18 failed | 1361 passed | 5 skipped (1384).** Every candidate test is `✓` except CA-9.
- **Against QA 108's run 1** (`36200429242`): **11 healed** (A10-1a, A10-1c, A10-2 ×4, A10-3, A10-4 ×2, A10-5 ×2), and
  **3 killed, all mine** (A11-1, A11-2, A11-3).
- QA 108's BEGIN-NOSEARCH-THEN-EDIT (probe 2; red at A10 in its run 7) is `✓`.
- **The 14 carried reds fail with byte-identical messages at A10 and A11**, once inode numbers, hashes and temp paths
  are normalised.

| Ruling | A11 must | Observed | Verdict |
|---|---|---|---|
| **R83** | a contained failure is carried through every consumer as `unreadable (<code>)`, never `null`. (a) A plant in a hooks dir that lists but cannot be searched fails the stage. (b) A path unreadable at begin is never "created" and never removed. (c) Never `deleted → absent`. Every consumer named | **Consumers:** the three named (`readState :478`, `begin :714`, `readForCompare :735`) each carry kind `other`+code as `unreadableIdentity`; my search finds no other conversion (§3.1). **(a)** Q108-IDENTIFY-NOSEARCH-PLANT, R83-NOSEARCH-PLANT, Q130-R83-SUBDIR-NOSEARCH-PLANT and -DOTGIT-NOSEARCH `✓`, 0 git calls after the role. **(b)** Q108-BEGIN-NOSEARCH-THEN-EDIT, R83-BEGIN-UNSEARCHABLE, R83-BEGIN-DIFF and Q130-R88-NOSEARCH-AT-OPEN `✓`: the loop is refused at the open, and the hook is untouched. **(c)** Q108-IDENTIFY-NOSEARCH-KEEP `✓` (`modified`). **The record's text is A11-1** | **pass** on behaviour; the text is scored under R85 |
| **R84** | observed at the start (read, absent with a code, not a file, two names, a deliberate not-read) and unobservable at close fails `machine-config-unobservable`; already unobservable at the start stays `changed: false` | QA 108's four A10-2 rows and its control `✓` (tcm); the developer's three `✓`. Mine: a dangling link at the start, then HOME 000, gives `unobservableCode: EACCES` `✓` | **pass** |
| **R85** | a failed `lstat` at the start prints its code, never `absent`. `unobservable (<code>)` carries the facts `observe()` has, and a link side its `linkSide`. An ancestor link's current side names ENOENT, with no zeros. **And the whole-file search, listed** | The three named bullets are met: R73-PARENT-EACCES (A10-3), Q108-R79-FILE000-ALONE and -ELOOP-ALONE (A10-4), Q108-R79-ANCESTOR-* (A10-5) `✓`. **The search missed two sides:** the repository side's text for a failed `lstat` (A11-1, medium, new in A11) and a file's facts under a directory link at base (A11-2, low) | **FAIL** (A11-1; A11-2) |
| **R85b** | a realpath failure with no `lstat` prints no zeros and says so; a link at the path, or a parent link, prints its `lstat` | R85-UNOBSERVABLE-FACTS `✓` (`no facts: realpath failed`). Mine `✓`: Q130-R85-VIA-TARGET000 (a parent link whose target dir is 000: the link's `lstat`, no zeros), -LINK-TARGET000 (`link: … does not resolve (EACCES)`), -ELOOP-LABEL (win32 and tcm), and R84-DANGLING's text | **pass** as ruled. Its second clause, read with R85, is A11-2 |
| **R86** | an ancestor link's type-change text carries the link's `lstat`, labelled as for a link at the path | R86-ANCESTOR-LINK-FACTS `✓` (tcm). Mine on win32 (junction) and tcm `✓`: `current link: type symlink dev … ino <link> … readlink …; <resolved> type file … ino <target>`. **Not in the `absent →` branch: A11-3** | **pass** (A11-3 low, §15 Q2) |
| **R87** | a `runLoop`-level test that `q108-r72-callsite` turns red | R87-EQUAL-REPORTED and -UNCHANGED-SILENT stub `compare`, as R80 allowed. `q108-r72-callsite` kills both on win32 and on tcm (`36222008162`); my `q130-r87-either` kills -UNCHANGED-SILENT | **pass** |
| **R88** | a read failure at the window's open refuses the stage `config-watch-unestablished` | R88-EACCES-AT-OPEN `✓` (tcm). Mine: `ERR_FS_FILE_TOO_LARGE` at the open is refused and named (win32 and tcm); an `lstat` failure at the open is refused (tcm); a deliberate not-read at the open is NOT refused (win32 and tcm) | **pass** |
| rulings-18 reading 1 (red first with the developer's own tests) | | every red run the handoff cites, re-read: each is red on the named rows for the reason the handoff gives (§5.2). R87 has no red on the product by design (the call site already existed), so its red is the mutant | held |
| rulings-18 reading 5 (never absent) | | held on the machine side. On the repository side the state is never `null` for a failed `lstat` (R83), but the TEXT pretends (A11-1) | held; A11-1 is text |
| rulings-18 reading 6 (begin is not close) | | an unlisted directory at the open still refuses `config-watch-unestablished` (Q130-R83-227, unit: hooks and info unlisted; config and config.worktree read failures) | held |
| **R82** (machine side, ENOENT precision) | | QA 108's win32 junction/ENOENT shapes (XDG-JUNCTION-EMPTY, -DANGLING-JUNCTION, HOME-RENAMED, PARENT-IS-FILE) `✓` on win32 and tcm; never `machine-config-unobservable` | held |

## 3. Detail

### 3.1 R83: the consumers, read one by one, and my own search

**The handoff's three consumers**, read in the diff at `bbf9d07`:
- `readState :478`: `if (id.kind === "other" && id.code) return unreadableIdentity(id);`, placed before `kind !== "file"`.
- `begin :714`: the same conversion in the resolution-diff branch.
- `readForCompare :735`: the same branch at close.

Each was killed separately by the developer's mutants on tcm (re-read, §5.2). `q130-r83-beginonly` turns off the
`readState` conversion at the open only. R83-BEGIN-UNSEARCHABLE, Q108-BEGIN-NOSEARCH, Q130-R88-NOSEARCH-AT-OPEN and
Q130-R83-227 all kill it (`36280195963`).

**My search of `configwatch.ts`** looked for any site that turns an identity or a read result into `null`, or builds a
side from a bare word or zeroed facts. It covered every `identify(` call, every `return null`, and every `kind !==` or
`=== null` over identities:

| Site | What it does with kind `other`+code | Verdict |
|---|---|---|
| `linkAncestor :152`, `dotGitLink :170`, `assertNoAncestor` | not a link. Everything beneath an unsearchable ancestor also fails `lstat`, and every restore write there fails `EACCES` → `unrestored` → stop | fails closed |
| `listTree :185` | `unlisted: <dir> (<code>)` | correct |
| `repositoryLinksAtBase :227` (**the handoff's answer**) | the tree is skipped with no note | **the answer holds, measured.** Q130-R83-227 (`.git` 0600) gives `links: []`. `begin` then has `unlisted: …/hooks (EACCES)` and `…/info (EACCES)`, plus `unreadable: …/config (EACCES)` and `…/config.worktree (EACCES)`, so the stage is refused before the role (`36279688475`). The only code I can produce on a tree root is EACCES from an unsearchable `.git`, and that fails every path under it too |
| `resolutionComp :258` | keeps kind `other` and drops the code. It is only compared, so a change is a diff and goes to the consumers above | correct |
| `readState :478/:479`, `begin :714/:715`, `readForCompare :735/:736` | `unreadableIdentity`. Kind `dir` and a code-less `other` (a FIFO) still become `null` | **The handoff's `kind: dir` answer holds as behaviour.** A directory that replaces a file is a change; the stage fails and stops before git (Q108-STOP-CONFIG-NONEMPTY-DIR, -HOOK-DIR, Q130-R83-DIR-AT-CONFIG; win32 and tcm). A directory under `hooks/` is walked by `listTree`, so its files are watched. **Its record text is false (`deleted → absent`): A11-4** |
| `ensureRealDir :564`, `restoreNewFile :586–:610` | throws on `other` → `unrestored` | fails closed |
| `begin`'s `treeAtBase :690` | records kind `other` with no code | printed only as `before` when a link later replaces the tree root (`:788`). An `lstat`-failed tree root refuses the open, so only a code-less `other` reaches it. Not scored |
| `closeAndRestore :779` | a tree root that is `other` is not a link; its files go through `listTree` (unlisted) | correct |
| `closeAndRestore :832–:836` (a created path) | `a other was created; not removed recursively` → `unrestored` → stop | fails closed; the wording is A11-4 |
| `stateHash :520` | `${readError}; type file dev null … mtimeNs 0` for a failed `lstat` | **A11-1** |
| machine `observe :1053`, `:1068`, `baseNotes :1234` | a lexical `other` is not a link; `realpath` then fails with its code → `errno` | correct |

**R83 (b), read with R88.**
- At A11, a hooks directory that is unsearchable when the loop starts is refused at the planner stage's open (R88:
  `unreadable: …/pre-commit (EACCES)`), so the begin record is never used. R83-BEGIN-UNSEARCHABLE and
  Q108-BEGIN-NOSEARCH-THEN-EDIT therefore pass by refusal.
- They still pin the begin consumer, because the `readState` conversion is what feeds the refusal. With
  `q130-r83-beginonly` (the conversion off at the open) the loop runs, and the user's hook is deleted again. Both rows are
  red on tcm (`36280195963`).

### 3.2 R84

| Shape | tcm (`36279688475`) |
|---|---|
| QA 108 R82-ABSENT-THEN-EACCES (unit) and -LOOP | `unobservableCode: EACCES`; the loop fails `machine-config-unobservable` `✓` |
| QA 108 R82-NOTAFILE-, -TWONAME-THEN-EACCES | `EACCES` `✓` |
| QA 108 R82-UNREADABLE-AT-START-CONTROL | `changed: false`, no code `✓` |
| mine: R84-DANGLING-THEN-EACCES (a dangling link at the start, then HOME 000) | `before: absent (ENOENT); type symlink dev 66306 ino 4859373 …`, `after: unobservable (EACCES); no facts: realpath failed`, code `EACCES` `✓` |

**Mutants:**
- The developer's `r84-read` and `r84-env`, re-read on tcm. `r84-env` also reddens R72 and R73, as the handoff says.
- **Mine, `q130-r84-absence`:** an absence observed at the start is treated as not observed, while a non-file and two
  names still count as observed.
  - It kills R84-ABSENT-THEN-EACCES, Q108-R82-ABSENT-THEN-EACCES and -LOOP, and Q130-R84-DANGLING.
  - R84-NOT-A-FILE and QA 108's NOTAFILE/TWONAME stay green (`36280201933`).
  - So turn 107's absence clause is pinned on its own.

### 3.3 R85 and R85b, the texts

From tcm run 1 unless marked win32.

| Shape | Text at A11 | R85 / R85b |
|---|---|---|
| QA 104's R73-PARENT-EACCES: HOME 000 across the stage boundary | `before` names `EACCES` (A10: `absent`) | met |
| Q108-R79-FILE000-ALONE: a read `~/.gitconfig` made 000 | `unobservable (EACCES); type file dev … ino <its ino> …` | met |
| Q108-R79-ELOOP-ALONE, Q130-R85-ELOOP-LABEL (win32 and tcm) | `unobservable (ELOOP); link: type symlink dev … ino <link> … readlink …; does not resolve (ELOOP)` | met |
| R85-UNOBSERVABLE-FACTS (HOME 000; no `lstat`) | `unobservable (EACCES); no facts: realpath failed` | met (R85b) |
| Q130-R85-VIA-TARGET000: a parent link at base, its target dir made 000 | `unobservable (EACCES); link: type symlink dev 66306 ino 4859378 … readlink …/vt-target` | met (R85b) |
| Q130-R85-LINK-TARGET000: a link at the path, the dir it points into made 000 | `unobservable (EACCES); link: type symlink … ino 4859151 … readlink …/lt-dir/real; does not resolve (EACCES)` | met |
| **Q130-R85-VIA-FILE000**: a parent link at base, the file made 000 | `unobservable (EACCES); link: type symlink dev 66306 ino 4859374 …`; the file's `ino 4859373` is missing | **A11-2** |
| Q108-R79-ANCESTOR-ZEROED (win32 and tcm) | `absent → symlink target …; not read through; absent (ENOENT)` | met for zeros; no link facts (A11-3) |
| Q108-R79-ANCESTOR-TYPECHANGE-ZEROED | `…; current link: type symlink … ino <link> …; absent (ENOENT)` | met |
| **Repository side**, every contained `lstat` failure | `unreadable (EACCES); type file dev null ino null nlink 0 size 0 mtimeNs 0` | **A11-1** |

**My own whole-file list of sides built from a bare word, or missing facts the runtime has** (R85's deliverable, redone):
1. `stateHash`, for a state with `readError` whose `lstat` failed: zeros and `type file` (**A11-1**).
2. `stateHash(null)` prints `absent` for a real absence **and** for a directory or a code-less `other` at the path
   (**A11-4**). The handoff lists it as "a real absence".
3. `closeAndRestore :836` prints `a other was created` for a path whose `lstat` failed (**A11-4**).
4. `unobservableSide :1305`: a parent link with `dev` set drops the file's facts (**A11-2**).
5. The `absent →` ancestor-link branch (`:1370`) prints no link facts (**A11-3**).
6. `stageBefore :1323` returns `opened.reason` alone when the path did not resolve. With an ancestor link at the stage
   start, the link's `lstat` (now in `viaDev…`) is not printed. By reading only, not measured; the same family as A11-3.
7. The stable label at `:1363`, for an unresolved non-link, omits a parent link's facts. By reading only; the row is
   `changed: false`.
8. `observe`'s `unresolved()`: when `realpath` fails but `lstat` of a non-link succeeded, the `lstat` facts are dropped,
   and the text would say `no facts: realpath failed`. By reading only. I found no shape that reaches it, because on
   Linux `lstat` and `realpath` need the same search permissions.

The handoff's list names `stateHash(null)`, the tree root `before: "absent"` at `:788`, `baseText`, `hashOf(null)`,
`stageBefore`, `currentSide`, `linkSide`, an open's `ENOENT` and `unobservableSide`. Each item is described correctly,
except that item 2 above is not only a real absence.

### 3.4 R86

- **The developer's R86-ANCESTOR-LINK-FACTS** is `✓` on tcm.
- **On win32** the candidate's row skips, so I ran my own copy with a junction (Q130-R86-ANCESTOR-JUNCTION). It is `✓`:
  `current link: type symlink dev 978646150 ino 20547673300849730 … readlink …\r86w-other; …\r86w-other\config type file
  … ino 26177172835062849 …`.
- **QA 108's R80-ANCESTOR-JUNCTION-TEXT** prints `hasLinkIno: true`, `hasTargetIno: true` and `hasLinkLabel: true` on
  both platforms.
- **Mutants:** `dev-r86-link` kills my win32 copy locally. `q130-r86-label` (the label printed with the resolved file's
  dev and ino) kills my copy and QA 108's R79-ANCESTOR-TYPECHANGE-ZEROED on win32.
- **A11-3:** the `absent →` branch.

### 3.5 R87

- **How the rows work:** R87's two rows stub `MachineConfigWatch.prototype.compare` to return an equal-text changed
  finding and an unequal unchanged one, then run `runLoop`. That is R80's "a constructed equal-text changed finding if no
  filesystem act produces one", at the call site.
- **`q108-r72-callsite`** is QA 108's mutant, and the same line as the developer's `mut-r87-callsite`. **It kills both rows
  on win32**; at A10 it killed nothing in 381 rows. It also kills both on tcm (`36222008162`, re-read).
- **Mine:** `q130-r87-either` (report when changed OR the texts differ) kills R87-UNCHANGED-SILENT.
- R72-EQUAL-TEXT (the test of the helper) stays.

### 3.6 R88

| Shape | Result |
|---|---|
| R88-EACCES-AT-OPEN (the developer's, tcm) | `✓` |
| Q130-R88-TOOLARGE-AT-OPEN: a hook already 3 GiB (win32 and tcm) | `config-watch-unestablished`, `unreadable: …/hooks/pre-commit (ERR_FS_FILE_TOO_LARGE). The role did not run.` |
| Q130-R88-NOSEARCH-AT-OPEN: hooks 0600 when the loop opens (tcm) | refused at the planner stage, `unreadable: …/pre-commit (EACCES)`, `roleRan: false`, the hook's bytes unchanged |
| Q130-R88-NOTREAD-IS-NOT-A-FAILURE (unit, win32 and tcm): a hook replaced since the loop base | `readFailuresAtOpen() = []`: a deliberate not-read is not refused |
| QA 108's READSTATE-TOOLARGE-AT-BEGIN (unit) | the ConfigWatch verdict still says `ok: true` with "Read failures: unreadable (ERR_FS_FILE_TOO_LARGE)". The refusal belongs to `runLoop` and comes before the role, so no loop reaches that verdict (§11.4) |

**Mutants:**
- `dev-r88-open` removes the runtime check. It kills R88-EACCES-AT-OPEN (tcm, re-read) and my TOOLARGE row on win32, the
  only R88 row that runs there.
- `q130-r88-lstat` leaves an `lstat` failure at the open unrefused. It kills only my two rows (`36279965058`), so **no
  developer row pins that half of R88** (§9).

### 3.7 QA 108's §14 item 2 (the obsolete set, adopted by rulings-19): each re-read in its new form

Each is red at A11 with the same message as at A10 (§2). The protection is read from the row's printed line, on tcm run 1
unless marked win32:

| Probe | Red because | The protection in the new form |
|---|---|---|
| QA 99 R69-GITCONFIG-FIRST | `before` is `absent (ENOENT)` (R79), not `absent` | **holds**: developer `absent (ENOENT) → 5c5060e1… type file … ino 4859443`; qa `5c5060e1… → 6973e43c…`, same ino, both read |
| QA 99 R70-HANDLE-FACTS | expects "handle is a different file", which R80 forbids for a gained name | **holds**: `the object gained a name inside open; not read; type file … ino 4859263 nlink 2 …` |
| QA 99 R71-BASE-LABEL | its regex looks for `not read: base` (R80's label is `loop base`) | **holds**: `not read: loop base … ino 4859404 nlink 1 …; current … ino 4859405 nlink 2 …`; 4859404 is the loop base's ino |
| QA 96 TRADE-LOCKRENAME | compares `before === <hash>` (R78) | **holds**: `a73dffdf… type file … ino 4859214 …` → `c35076c7… type file … ino 4859217 …`, both read |
| QA 104 R72-UNREADABLE-LOOP | the developer's `chmod 0200` now fails the developer stage (R82), so the qa append never happens | **superseded, and better at A11**: `failure: machine-config-unobservable`, `after: unobservable (EACCES); type file dev 66306 ino 4859373 nlink 1 size 23 …` (A10 printed the code alone) |
| QA 89 R29 row shape | its control expects `unreadable`; R82 prints `unobservable (EACCES)` | **holds**: the control is `unobservable (EACCES); type file … ino 4859478 …`, and the planted link is not read (`type change …; current link: … resolves to: …`) |
| QA 99 R71-UNREADABLE-START, -AT-BASE | `toBe("unreadable")` (R79) | **replaced** by Q108-R71-UNREADABLE-START-R79 and -AT-BASE-R79, both `✓` on tcm (`unreadable; stage start type file …`) |
| still obsolete: QA 89 A4-1 R; QA 94 TRADE-SAME, NO-SEAM CONTROL (win32 and tcm); QA 92 STOW-LOOP; QA 96 R65-FACTS, HANDLE-NLINK-BASE (win32 and tcm) | as at A9 and A10 | unchanged. For example, STOW-LOOP reports the write (`d89a0ce9… → b653c39f…`) and counts 3 findings; TRADE-SAME's type change carries the link's and the file's facts |

## 4. Mutants

**How the local (win32) mutants were built and run:**
- Each mutant is a `git archive bbf9d07 open-brain` copy, with a `node_modules` junction to `wt-a11`'s (`build11.mjs`).
- Each edit's count was asserted against A11's blob before archiving, then asserted to land and read back. **Every build
  is `tsc --noEmit` exit 0.**
- The rows are §2's (412 tests, JSON reporter), compared against the BASELINE. A "kill" is a test red under the mutant
  and not red at BASELINE.
- Sequential, 23:32:54Z → 00:17:10Z, 22 runs. **No run printed an unhandled error.**
- The probe files' SHA-256s were recorded before the batch and re-checked after: 15 of 15 OK.
- The developer's mutants are rebuilt on A11 from their branch diffs. Each branch is one commit on the SHA the handoff
  names, changing the one line it describes (§5.2).

| Mutant | Edit | Kills (win32) | tcm | What it shows |
|---|---|---|---|---|
| dev `readstate` | `readState`'s conversion removed | 0 (POSIX rows) | dev `36206587305`: R83-BEGIN-UNSEARCHABLE | R83 at `readState` |
| dev `begin` | `begin`'s diff-branch conversion removed | 0 | dev `36206655901`: R83-BEGIN-DIFF | R83 at `begin` |
| dev `readforcompare` | `readForCompare`'s removed | 0 | dev `36206621733`: NOSEARCH-PLANT, -KEEP | R83 at close |
| dev `r84-read` | observed = read | 0 | dev `36207340877`: 2 | R84 |
| dev `r84-env` | observed = always | 0 | dev `36207497348`: R84-ALREADY + R72, R73 | R84's environment clause |
| dev `r85-absent` | bare `absent` at the start | 0 | dev `36212897040`: R85-START-LSTAT | R85 bullet 1 |
| dev `r85-ancestor` | zeroed current side | **2**: Q108-R79-ANCESTOR-ZEROED, -TYPECHANGE-ZEROED | dev `36212963405`: 2 | R85 bullet 3, on win32 by QA 108's rows |
| dev `r85-facts` (rebased: the side dropped) | `unobservable (<code>)` alone | **2**: Q108-R79-ELOOP-ALONE, Q130-R85-ELOOP-LABEL | dev `36212932192`: 1 | R85 bullet 2 |
| dev `r85b-zeros` | zeros when `dev` is null | 0 | dev `36229376868`: R85-UNOBSERVABLE-FACTS | R85b |
| dev `r86-link` | no link text in the type change | **1**: Q130-R86-ANCESTOR-JUNCTION | dev `36221237060`: 1 | R86, on win32 only by mine |
| **`q108-r72-callsite`** (= dev `r87-callsite`) | `if (f.before === f.after) continue;` | **2: R87-EQUAL-REPORTED, R87-UNCHANGED-SILENT** | dev `36222008162`: 2 | **R87; A10-7 closed** |
| dev `r88-open` | the open's read-failure check removed | **1**: Q130-R88-TOOLARGE-AT-OPEN | dev `36224104646`: 1 | R88, on win32 only by mine |
| **`q130-r83-beginonly`** | `readState`'s conversion at close only, not at the open | 0 | **`36280195963`: 4**: R83-BEGIN-UNSEARCHABLE, Q108-BEGIN-NOSEARCH, Q130-R88-NOSEARCH-AT-OPEN, Q130-R83-227 | R83 at the open, which feeds R88 |
| **`q130-r84-absence`** | an absence at the start not observed | 0 | **`36280201933`: 4**: R84-ABSENT, Q108-R82-ABSENT ×2, Q130-R84-DANGLING | turn 107's clause alone |
| **`q130-r85-factsdrop`** | `unobservableSide` never prints facts | 0 | **`36279958422`: 1, Q108-R79-FILE000-ALONE only** | **test gap:** after R85b, no developer row pins A10-4's shape |
| **`q130-r85-linkside`** | a link at the path loses `linkSide` in the unobservable side | **1**: Q130-R85-ELOOP-LABEL. Q108-ELOOP-ALONE survives: the ino is still printed, only without its label | — | R85's "a link side carries its linkSide" |
| **`q130-r85b-via`** | a parent link's `lstat` not printed when realpath fails | 0 | **`36280189650`: 1, Q130-R85-VIA-TARGET000 only** | R85b's parent-link branch; **no developer row** (the handoff says so) |
| **`q130-r86-label`** | the link label printed with the resolved file's dev/ino | **2**: Q130-R86-ANCESTOR-JUNCTION, Q108-R79-ANCESTOR-TYPECHANGE-ZEROED | — | R86's facts are the link's |
| **`q130-r87-either`** | report when changed OR the texts differ | **1**: R87-UNCHANGED-SILENT | — | R87 |
| **`q130-r88-lstat`** | an `lstat` failure at the open not refused | 0 | **`36279965058`: 2, mine only** | **test gap:** R88's `lstat` half has no developer row |
| **FIX-q130** (known negative) | A11-1, A11-2 and A11-3 fixed (three edits) | **0 kills**, heals Q130-R86-ABSENT-ANCESTOR-LINK | **`36279953134`: 0 kills, heals 3** | each defect's row sees exactly its line |

**The mutant cut:** the layer mutants and the earlier ones (A10's R77–R82 set and before) were not re-run. A11 touches
only `configwatch.ts`'s R83–R88 lines and `runtime.ts`'s open check, and the rows for the rest ran unmutated and pass
(win32 BASELINE, tcm run 1).

## 5. Full suite and CI

### 5.1 The full suite

**00:19:23Z → 00:22:56Z, `SUITE_EXIT=0`, captured unpiped (`suite11.sh`).**
- **Where:** `C:/qa-scratch/qa130/wt-a11/open-brain`, a detached worktree at `bbf9d07`, after `npm ci`, `npm run build`
  and `tsc --noEmit` (each exit 0). 0 porcelain entries before and after; HEAD `bbf9d07` after.
- **The Defender-on control (T-190):** `TEMP`=`TMP`=`C:\Users\AARONM~1\AppData\Local\Temp` (the driver's
  `QA_DEFAULT_TEMP`).
- **Result:** `Test Files 83 passed | 7 skipped (90)`, **`Tests 1155 passed | 70 skipped (1225)`**, duration 200.57 s,
  0 matches for `Unhandled|onTaskUpdate`. **The total, 1225, equals CI's** on the candidate (`36229579888`).
- **The 70 skips** are win32 skips of POSIX-only rows and the real-`claude` rows. A11 adds 13 (57 at A10): the r83 (4), r84 (3), r85 (4), r86 (1) and r88 (1) rows, which is also why 5 more files skip.
- **Processes** (`tasklist /V`, CSV, before and after): 226 and 217.
  - Of claude, node, git and Cursor, only this session's `claude.exe` (PID 13100) was present, before and after. **No
    `node.exe`, no `git.exe`, no `Cursor.exe`.**
  - The mutant batch had finished at 00:17:10, and nothing of mine ran beside the suite.
  - **Defender** (`MsMpEng.exe`, PID 3352) used **4 min 32 s of CPU during the 3 min 33 s suite** (8:25:03 → 8:29:35),
    so it was scanning, as the control intends.

### 5.2 CI

- **The candidate's own head:** `36229579888` on `bbf9d07` (tcm-2): 1 failed (CA-9) | 1219 passed | 5 skipped (1225).
- **The developer's runs, every one the handoff cites, re-read per test** (`cidev11.sh`):
  - R83: `36206389362` (red, head `3dbe5c7`), `36206544020` (green, `0cf7933`), mutants `36206587305`, `36206621733`,
    `36206655901`.
  - R84: `36207028035`, `36207220360`, `36207340877`, `36207497348`.
  - R85: `36210115789` (the red the handoff does not count), `36211775483`, `36212486384`, `36212897040`, `36212932192`,
    `36212963405`.
  - R86: `36213535226`, `36221235174`, `36221237060`. R87: `36222006907`, `36222008162`.
  - R88: `36223778379`, `36224103396`, `36224104646`. R85b: `36229056199`, `36229232046`, `36229376868`.
  - **Each run's head is the SHA the handoff names, and its reds are exactly the rows the handoff lists** (plus CA-9).
  - The red runs are cumulative: each red-check branch also carries the earlier rulings' rows red, because each is cut on
    the tree before those fixes. All on tcm.
- **The developer's `mut-*` branches:**
  - There are 12. Each is one commit on the SHA the handoff names (`0cf7933` ×3, `6fa7cea` ×2, `a5f3715` ×3, `adb20a4`,
    `ff637a2`, `0f42cc8`, `ef2a8a7`).
  - Each changes one source file, and each change is the one edit described.
  - `mut-r87-callsite` is `if (f.before === f.after) continue;`, QA 108's line byte for byte.
- **This seat's runs**, each dispatched with `gh workflow run CI --ref <branch>`, all on tcm with git 2.43.0:

| # | Branch (`qa/loop-15-slice-3-a11-…`) | Head | Run | Runner | Tests | What it shows |
|---|---|---|---|---|---|---|
| 1 | `probe` | `5564ef6` = A11 + 15 probe files (carried, QA 108's three, mine) | **`36279688475`** | tcm-1 | 18 failed \| 1361 \| 5 (1384) | the base. Every candidate test `✓` but CA-9; 11 healed and 3 new reds against QA 108's run 1 |
| 2 | `fix-q130` | `0cb509f` = 1 + FIX-q130 | `36279953134` | tcm-2 | 15 \| 1364 \| 5 | heals A11-1, -2 and -3; **0 kills** |
| 3 | `m-r85-factsdrop` | `e2cd6cc` | `36279958422` | tcm-1 | 19 \| 1360 \| 5 | 1 kill: Q108-R79-FILE000-ALONE |
| 4 | `m-r88-lstat` | `5761f3a` | `36279965058` | tcm-2 | 20 \| 1359 \| 5 | 2 kills, both mine |
| 5 | `m-r85b-via` | `5bbc4c0` | `36280189650` | tcm-1 | 19 \| 1360 \| 5 | 1 kill: Q130-R85-VIA-TARGET000 |
| 6 | `m-r83-beginonly` | `b3bdfc9` | `36280195963` | tcm-2 | 22 \| 1357 \| 5 | 4 kills |
| 7 | `m-r84-absence` | `efcbff5` | `36280201933` | tcm-2 | 22 \| 1357 \| 5 | 4 kills |

**Budget: 7 of 8 used.** Each mutant or FIX branch differs from run 1's only in its one source file (`git diff --stat
5564ef6`: one file each).

## 6. `/sync`

This dispatch did not ask for it, and I did not run it. `gitnexus` is not on this PC.

## 7. What could not be verified, stated so nobody inherits it as settled

1. **Every EACCES shape is Linux-only** (tcm). This session cannot make a file unreadable to itself on win32. So A11-1
   and A11-2 are measured on tcm only; A11-3 and A11-4 are measured on both platforms.
2. **CA-9** is red on every tcm run (T-182), as the dispatch says. I did not re-run it on this PC.
3. **Sites 6–8 of §3.3's list** are by reading only.
4. **A win32 `realpath` failure with a successful `lstat`** (site 8, the `unresolved()` branch) was not produced.
5. **The layer mutants** were not re-run (§4's cut). Neither was `/sync --check` after `gitnexus analyze`.
6. **The merge** was checked with `merge-tree` only. I did not resolve the conflict, and I did not run the suite on a
   merged tree.

## 8. What the checks I ran cannot see

- **Two platforms only:** one win32 machine and tcm's Linux. The local mutants ran on win32, where the POSIX rows skip.
  For those rows the kill evidence is the developer's tcm runs (re-read) and my six mutant and FIX runs.
- **Stub roles and unit windows.** The shapes are the ones the rulings name, the ones I found by reading each consumer
  and each line that builds a side, and QA 108's.
- **Permission shapes** are mode bits only (0600, 0000); no ACLs and no `chattr`.
- **The `spawnSync` spy** counts only git calls started through `spawnSync`. `git.ts` starts every git call that way.

## 9. Defects, each with the observation that produced it

| # | Severity | Defect | Observation |
|---|---|---|---|
| **A11-1** | **medium** (R85's whole-file search; R79 "never pretends"; CA-15 clause 4) | the repository side prints a contained `lstat` failure as `unreadable (<code>); type file dev null ino null nlink 0 size 0 mtimeNs 0` (`stateHash :520` over `unreadableIdentity :459`). It also records a path that was absent at the open, and cannot be seen at close, as a `created` file. New in A11's R83 commit, and not in the handoff's R85 list | Q130-R85-REPO-UNREADABLE-ZEROED, Q130-R83-DOTGIT-NOSEARCH (`config.worktree created`), -SUBDIR-NOSEARCH-PLANT (tcm `36279688475`). FIX heals it, 0 kills (`36279953134`) |
| A11-2 | low (R85 bullet 2; R85b clause 2) | under a directory link at base, a read file made 000 prints the link's `lstat` but not the file's facts, which `observe` has (`unobservableSide :1305`) | Q130-R85-VIA-FILE000 (tcm). FIX heals it, 0 kills |
| A11-3 | low (R86 with R79; §15 Q2) | an ancestor link planted where the loop base was absent prints no link `lstat` (`:1370`) | Q130-R86-ABSENT-ANCESTOR-LINK (win32, tcm); the text of QA 108's R79-ANCESTOR-ZEROED. FIX heals it, 0 kills (tcm and win32) |
| A11-4 | cosmetic (A10-8's family) | a directory at `.git/config` is recorded `deleted → absent`, and a created path that cannot be `lstat`ed is noted `a other was created` | Q130-R83-DIR-AT-CONFIG, Q108-STOP-CONFIG-NONEMPTY-DIR (win32, tcm) |
| A11-T1 | test gap | after R85b, no developer row pins A10-4's shape (facts when `stat` succeeded) | `q130-r85-factsdrop` is killed only by QA 108's FILE000-ALONE |
| A11-T2 | test gap | no developer row pins R88 for an `lstat` failure at the open | `q130-r88-lstat` is killed only by mine |
| A11-T3 | test gap (declared by the handoff) | R85b's parent-link branch | `q130-r85b-via` is killed only by mine |
| carried | — | the rest of A10-8 (FIFO `deleted → absent`, "0 … changed: .", Q108-BOTH's reason); §11.7 (repository read records without dev/ino); §11.4 and §11.6 (win32 platform limits) | recorded by rulings-19; not in A11 |

## 10. Regressions: previously validated behaviour confirmed still working

- **Unmutated rows.** On win32, 265 passed; the 8 reds are my A11-3 row and the 7 carried assertions already known to be
  obsolete. **378 of the 381 tests QA 108 ran at A10 have the same status, and the other 3 went from red to green.** On
  tcm every candidate test is `✓` except CA-9, and the 14 carried reds fail with the same messages as at A10.
- **Everything QA 108 found closed stays closed:**
  - A9-1 to A9-6: QA 104's probe2 and probe3, in the tree, are `✓`.
  - R77.4's stop before git: 0 git calls after the role in every stop shape of QA 108's and mine.
  - R78 and R80's words.
  - R82's ENOENT precision, on win32 (the four junction and ENOENT shapes) and on tcm.
  - The old path: QA 108's seven hard-link and symlink shapes are `✓` on win32 and tcm.
- **Rulings-18 readings 1, 5 and 6, and R82:** held (§2).
- **QA 108's obsolete set (§14 item 2):** every protection holds in its new form (§3.7).
- **Regressions: none found.** R88 changes one behaviour on purpose. A repository with an unreadable hook, or with a hooks
  directory the runtime cannot search, now has every loop refused at the open; at A10 such a loop ran.

## 11. Where the criteria, the rulings and the candidate disagree (returned, not scored)

1. **R85b says "lstat", but A11-2's missing facts come from `stat` of the resolved file.** I scored A11-2 under R85's
   bullet 2 ("the facts `observe()` has"), which covers them, and scored it low.
2. **R86 says "type-change text".** The `absent →` branch is the other text for a planted link, and for a link AT the
   path both branches carry the link's facts. A11-3 reads R86's "labelled as for a link at the path" as covering it.
3. **The handoff's R85 list calls `stateHash(null)` "a real absence".** It is also what a directory or a FIFO at the path
   prints (A11-4). The planner accepted the `kind: dir` answer as behaviour, and I agree with it as behaviour.
4. **R88 lives in `runLoop`, not in the ConfigWatch verdict.** A window closed at unit level with a read failure at its
   open still says `ok: true` (QA 108's READSTATE-TOOLARGE-AT-BEGIN). No loop reaches that verdict, because the refusal
   comes first.
5. **The base.** Rulings-19 said to re-check the base at dispatch and to merge first if anything outside `docs/` and
   `.agents/` had changed. The handoff says the drift arrived during A11 and no merge was made. At this dispatch,
   `merge-tree` shows a real conflict in `ci.yml`.
6. **CA-9 and tcm** (T-182), as before.

## 12. This seat's error entries and near-misses this session

**Error entries (escaped):** none known.

**Near-misses (caught in-process, not numbered):**
- **My first win32 baseline used the JSON reporter, which does not keep the probes' printed lines.** I re-ran the three
  probe files with the default reporter (`q130-a11-win-1.out`) to read them. The first JSON baseline is kept as
  `BASELINE0`.
- **I added Q130-R85-ELOOP-LABEL after `BASELINE0`**, so that `q130-r85-linkside` could be killed on win32. It went in
  before any CI commit and before the mutant batch; the final BASELINE and every CI branch carry it (README).
- **A sentence in my draft verdict** said the developer's R83 rows' records carry A11-1's text. I had not printed those
  records, so I rewrote the sentence to what I measured: my rows print the text, and the developer's rows go through the
  same line but assert only the code.
- **The harness blocked a `sleep` I used before reading a background log.** I waited on the task's completion instead.

## 13. Reproduction

The scripts are tracked at **`docs/loops/qa-scripts-a11/`** on this seat's report branch, byte-identical to the copies
that ran, with a README.

| Branch (pushed with `push-qa.mjs`, read back) | Head | What |
|---|---|---|
| `qa/loop-15-slice-3-a11-probe` | `5564ef6` | A11 + QA 89–104's probes + QA 108's three + `qa130-a11-probe.test.ts` |
| `qa/loop-15-slice-3-a11-fix-q130` | `0cb509f` | + FIX-q130 (A11-1, -2, -3) |
| `qa/loop-15-slice-3-a11-m-r85-factsdrop` | `e2cd6cc` | + my R85 mutant |
| `qa/loop-15-slice-3-a11-m-r88-lstat` | `5761f3a` | + my R88 mutant |
| `qa/loop-15-slice-3-a11-m-r85b-via` | `5bbc4c0` | + my R85b mutant |
| `qa/loop-15-slice-3-a11-m-r83-beginonly` | `b3bdfc9` | + my R83 mutant |
| `qa/loop-15-slice-3-a11-m-r84-absence` | `efcbff5` | + my R84 mutant |
| `qa/loop-15-slice-3-a11-report` | this commit | this report and `docs/loops/qa-scripts-a11/` |

**A11-1 in four steps (Linux, not root):**
1. Start with a repository whose `.git/hooks` is empty.
2. The developer role writes `.git/hooks/post-checkout` and runs `chmod 600 .git/hooks`.
3. The stage fails `stage-changed-config` and stops before git, which is correct.
4. Its record reads `post-checkout created (absent → unreadable (EACCES); type file dev null ino null nlink 0 size 0
   mtimeNs 0)`.

## 14. Handoff to the next QA session

1. **Known positives.** On A11 `bbf9d07`:
   - A11-1: Q130-R85-REPO-UNREADABLE-ZEROED, and the text of -DOTGIT-NOSEARCH (Linux).
   - A11-2: Q130-R85-VIA-FILE000 (Linux).
   - A11-3: Q130-R86-ABSENT-ANCESTOR-LINK (win32 and Linux).
   - **Known negative:** `FIX-q130` (`36279953134`; 0 kills on win32 too).
2. **Obsolete probe assertions:** QA 108's §14 item 2 list, unchanged, and every one re-read in §3.7. Nothing new became
   obsolete at A11.
3. **The test gaps A11-T1 to T3** are covered only by QA probes: QA 108's FILE000-ALONE, my R88-NOSEARCH-AT-OPEN and
   R83-227, and my VIA-TARGET000. Carry them until the candidate has its own rows.
4. **This PC** can make file and directory symlinks, junctions and hard links, but not unreadable files, so every EACCES
   shape needs CI. `C:\qa-scratch` and `C:\qa-tmp` are Defender exclusions, and the one suite ran with the default temp.
5. **The spy** (`gitAfterRole`) and the `roleRan` flag in `qa130-a11-probe.test.ts` measure "no git after the role" and
   "the role never ran".
6. **The `ci.yml` conflict** will still be there for the next candidate unless someone merges master first.

## 15. Open for the planner

None of these blocked the rest of the work; each item says what I did instead.

1. **Does R85's search cover the repository side's text?** I read "the whole of `configwatch.ts`" as yes, which makes
   A11-1 a missed side and the verdict REJECTED. **If the planner rules the repository side out of R85, A11 passes every
   ruling, and my verdict would be ACCEPT**, with A11-1 to A11-4 and the three test gaps as follow-ups. The fix is local:
   `FIX-q130` heals all three defect rows and kills nothing.
2. **R86 and the `absent →` branch (A11-3):** is an ancestor link planted where the loop base was absent in R86's scope?
   I scored it low and in scope.
3. **A11-2's severity**, and whether R85b's "lstat" should read "the facts observe has". I scored it low.
4. **The `ci.yml` conflict with master:** should the next candidate merge master first (R76's form)? The resolution keeps
   both edits.
5. **The test gaps (A11-T1 to T3):** should the next candidate adopt rows for them, or should they stay QA probes?
6. **1 of the 8 CI runs is unused.**

**Dispatch items, each done or written up:**
- The merge check against today's `origin/master` (§1).
- R83–R88 and R85b, each scored with evidence (§2, §3), and rulings-18 readings 1, 5 and 6 and R82 (§2).
- QA 108's probes re-run byte-exact: each positive A10 failed now passes (§2, §10), and its §14 item 2 list is re-read
  in the new form (§3.7).
- The consumer list and the R85 search checked, not accepted, including the `kind: dir` and `:227` answers (§3.1, §3.3).
- The mutants: the developer's (re-read and rebuilt), `q108-r72-callsite` (it kills both R87 rows), and mine, at least
  one per ruling (§4).
- The full suite, once (§5.1). CI on tcm, 7 of 8 runs (§5.2). Model and effort (§0.1).
- No `/end` (T-163).

QA-130: REPORT COMPLETE
