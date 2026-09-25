# Loop 15 slice three — QA report A6: candidate A6 `dc35b24`: REJECTED

**By:** Probe (QA seat), record session **94** (T-164: the dispatch assigned it; the greeting's per-worktree counter
said 12 and is not used) · **Date:** 2026-09-24 (UTC).
**Model and effort, from this session's host transcript**
(`~/.claude/projects/C--Users-melve-Worktrees-sia-qa/08650273-2511-4f23-8fbc-6b4796c2a257.jsonl`, parsed as JSON):
every assistant entry carries `"model":"claude-opus-5-5"` and `"effort":"high"` (with `perTurnEffort` `"high"`): 341 of 341 entries, 06:23:17Z → 08:25:27Z, which covers every measurement, probe, mutant, CI run and the suite. The report was written after that read.

**Dispatch:** `docs/loops/loop-15-slice-3-dispatch-qa-a6.md` on master `55255bb`, pointed to by the live planner
(sia-planner-6b, record session 90) by A2A at session start.
**Criteria:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` at **`6672e83`** (FINAL), read with **rulings-9 to
rulings-13** on master. **Rulings-13 R60 amends CA-15 clause 3 for machine-config paths (D-041)**; its table of
touched rows is scored as that table says (§2).
**Candidate (frozen):** **`dc35b24869e77d2b62729d12598fb50e5adcd24b`** on `origin/loop/15-slice-3-candidate-a6`,
five commits on A5 `4c1287f`. The table below is from each commit's `git diff --stat`, and it matches the
dispatch's table row for row:

| Commit | Files | Carries |
|---|---|---|
| `023fcd0` | `config-channel.test.ts` (+10) | R63: "reverted" present after a revert |
| `f77fd4f` | `configwatch.ts` (+/−291), `configwatch-links.test.ts` (+162) | R60, R61, R62 and R63's (b) plants and controls |
| `daac160` | `configwatch.ts` (+6), `configwatch-links.test.ts` (+/−33) | the stow tests' relative targets; `routeEnd` |
| `8ad8728` | `configwatch-links.test.ts` (1 line) | the assertion `toContain(victim)` → `toContain("nlink 2")` |
| `dc35b24` | the handoff | — |

Built by Grok 4.7 in Cursor, developer record session 93 (T-177). Handoff
`docs/loops/loop-15-slice-3-a6-developer-handoff.md` at `dc35b24`, read in full. The accepted deviation (R60–R62 in
one commit) is scored as the dispatch says: **each item by its own mutant** (§4).
**Transition controls:** A5 `4c1287f` and A4 `f9a1aa8`, each a `git archive` copy in this seat's scratchpad with a
`node_modules` junction; **A6 was probed from an archive copy too.** Each copy's `configwatch.ts` was blob-compared to
its SHA: `d94c1b65` (A6), `dde4c480` (A5), `b84b9687` (A4), all equal.
**Scored in:** `~/Worktrees/sia-qa`, detached at the frozen SHA from 06:24:54Z. git `2.54.0.windows.1`, Node
v22.23.2, win32. **Linux:** CI (git 2.55.0), runs this seat dispatched on its own `qa/*` branches under D-040 (§3.2).

---

## Verdict: REJECTED. A5-1 and A4-1 are closed; R61 is not built, and R62's sibling keeps A5-4's false stage failure

**What A6 fixed, measured against the named known positives:**

| Item | At A5 | At A6 | Evidence |
|---|---|---|---|
| **A5-1** (a stow / relative / multi-level base link silently unwatched) | QA 92's eight Linux shapes red; win32 r35anchorEdit no finding | **closed** | QA 92's file (v3, §3.2) on the same CI config: **all eight green at A6** (`35965141320`, `35966082185`), **all eight red at A5** (`35965144366`). win32 r35anchorEdit: one finding, `developer`, `550e79212675ebc3 → 662416b1…`, as at A4 (§3.1) |
| **A4-1** (a swapped final target read) | green | **stays unread** | QA 89's H, J, R, LOOP green at A6, **red at A4** (`35965147612`) in the same run config |
| **A5-4** NEWBETWEEN | fails | **ok** | `probe-r62.mts` NEWBETWEEN: A6 `ok: true`, A5 `ok: false`, A4 `ok: true` (§3.6) |
| **A5-3** (a false "read through" base note) | present | **closed** for the shapes measured | the note says "unwatched: did not resolve" for a dangling link and `machineHardAbsent` (§3.1); "read through that target" appears only where the path is read |
| **A5-5** (R63's positive direction) | M-R59-never survived | **met** | the R63 test; M-R59-never and M-dev-revert (§4) |
| **R60 read half** | — | **holds** | no victim hash and no token in any record: 31 win32 probes at A6, and every Linux probe (§3.1, §3.2). The handle re-check is **present and works** under a deterministic swap inside `open` (§3.3) |
| **R60 `routeChain` rest** | doubled path | **fixed** | the candidate's `routeEnd` test; the developer's `mut-rest` reddens it (`35963368623`); M-dev-rest here |

**Why it is rejected.**

**A6-1 (high): R61 is not built beyond the "unwatched" base note.** R61: *"Every watched path is, at every stage, in
exactly one REPORTED state: read, with its hash; not read, with the reason and its identity facts; unwatched, with
the reason. No path may be absent from the record."* At `dc35b24` the only places a machine-config path's state reaches
the record are `baseNotes()` (`configwatch.ts:999`: a note for a link on the path as written, or for a base state of
`unwatched`) and `compare()` (`:1041`: a finding **only when something changed**). There is no per-stage state. Read
from the code and measured (CI `35965141320`, `35966082185`):
- **R61-UNIT:** four base states, one stage with no act. **Only the dangling link is in the record.** The read path's
  hash is in no record at base or in the stage; a mode-000 file ("not read: unreadable") and a directory ("not read:
  not a file") are **absent entirely**.
- **GITCONFIG-LOOP, the silent consequence in its ordinary form (A5-1's class):** the developer runs a real
  `git config --global user.email …`. git rewrites `~/.gitconfig` by lock-and-rename, so the path now reaches a new
  inode: the developer stage reports `9f3ef5ba17d6b437 → not read: base … ino 326050 …; current … ino 326080 …`. The
  QA role then appends to `~/.gitconfig` in place: **no finding and no entry for the path in the qa stage**, the loop
  completes, `qaHashInRecord: false`. Measured on Linux at A6, A5 and A4 (`35966517077`, `35966526850`,
  `35966536827`) and on win32 at A6.
- **R61-LOOP and HARDLINK-SAME, the same through a hard link:** the developer makes a hard link **elsewhere**
  (`linkSync(~/.gitconfig, <anywhere on the same filesystem>)`). R60's identity includes `nlink`, so the path becomes
  "not read" and **the developer stage reports it once** (`… nlink 1; current … nlink 2`). In the **next** stage the
  QA role appends to `~/.gitconfig` in place, **the same inode as at base**: **no finding, no entry for the path in
  that stage's record**, the loop completes (`status: completed`, `qaHashInRecord: false`). A4 and A5 behave the
  same; **R61 and CA-4f's table entry ("a path that cannot be read is reported, never silent") are what make it a
  failure now.**
- **"Not read" without its reason.** Where a path is not read but its path-identity is unchanged (mode 000, or the
  handle check refusing a swapped file), the finding reads `not read: base P dev D ino I nlink 1; current P dev D ino
  I nlink 1`: **two identical identities and no reason.** The reason (`unreadable`, `handle is a different file`) is
  computed at `:966–981` and never rendered.

**Rows that fail on A6-1:** CA-15 clause 4 as R61 extends it ("every path has a reported state"); CA-4f (the silent
later-stage write); CA-11 (rulings-13 requires "config outside the repository … hashed and reported" **unqualified**).

**A6-2 (medium): R62's sibling keeps A5-4 for a file PRESENT at base.** R62: *"Where either side of a comparison is
unread, the runtime compares the identity facts both sides hold. Equal facts mean no change."* A6 changed `changed()`
(`:431`) as R62 says, **and added a second clause** in `closeAndRestore` (`:719`, `drifted`): a file whose stage-end
snapshot is unread and whose identity differs from the **loop base** is reported as changed **even when the stage's
start and end identities are equal.** `probe-r62.mts` EXISTBETWEEN: `.git/info/refs` present at base; between the
base and the stage it is rewritten by lock-and-rename with **the same bytes** (git's own way of rewriting a file); the
stage touches nothing. A6: `ok: false`, `<common>/info/refs modified (identity:dev 2993778667 ino 19421773396043479
nlink 1; not read → identity:dev 2993778667 ino 19421773396043479 nlink 1; not read)`, **"2 FILE(S) COULD NOT BE PUT
BACK … Recover by hand"**: A5-4's record, word for word. **A4: `ok: true`** (the known negative). A5 fails it too
(QA 92 did not probe this shape). **M-drifted-off** (only the clause removed) makes EXISTBETWEEN and EXISTBETWEEN2 `ok` and turns exactly one candidate test red: R57's, which needs a later stage's in-place write to an unread file to be reported. `drifted` is what keeps that test green, so A6-2 is a trade the candidate made, and the conflict under it is returned (§11.6). **Rows:** R54 as R62 amends it; CA-14 ("no false 'modified'").

**Lower findings** (§9): A6-3 R29's instrument is blind at A6 and its test cannot fail; A6-4 a stage whose start was
not read writes the loop base's hash as "before"; A6-5 a path unreadable at base is written "before: absent"; A6-6 the
handle re-check has no test (dispatch 3(a)); A6-7 the clause-4 type change at the path has no test; A6-8 a new
mid-path link to a different file is recorded without the resolved path or identities; A6-9 R50's protection has no
row at A6 (M-R50 survives every row).

The full suite is green: exit 0, 1126 passed, 21 skipped, with the peers idle before and after (§5). A green suite is not the verdict here: every failure above is in behaviour the candidate's own tests do not reach.

---
## 0. Rulings and authority in force

| Source | Where |
|---|---|
| Rulings-1 to 12 | master, as cited by the criteria and reports A3 to A5 |
| **Rulings-13 R60–R63** and its table of touched rows | master (`loop-15-slice-3-rulings-13.md`); D-041 (record rev 109) |
| The dispatch | `docs/loops/loop-15-slice-3-dispatch-qa-a6.md` on master `55255bb`, pointed to by the live planner (sia-planner-6b) by A2A |
| **CI on this seat's own branches** | **D-040**, standing. Every run is named where it is used |
| **Pushing this seat's own `qa/*` branches** | **D-038**; each push read back with `ls-remote` (§13) |
| Full-suite GO | the planner (sia-planner-6b), A2A, 08:2xZ: 0 of 41 sockets on 3210/4000/5173 at 08:21:25Z; the three A2A-Hub seats reported stopped through Relay (**relayed, not measured by the planner or by me**); the planner idle. This seat's own measurements are in §5 |

## 1. Frozen-candidate conditions

| Condition | Observation | Result |
|---|---|---|
| criteria before candidate | `6672e83` is an ancestor of `dc35b24` (exit 0). **Control:** `d18a196` exits 1 | held |
| built on the release line | A5 `4c1287f` is an ancestor (exit 0) | held |
| A6's own diff | `4c1287f..dc35b24`: `configwatch.ts` (+/−297), `config-channel.test.ts` (+10), `configwatch-links.test.ts` (+155/−), the handoff (+45). Nothing else | as stated in the handoff |
| **tree moved** | HEAD = `dc35b24…` at 06:24:54Z and at every later read (06:25Z build; 08:19Z before `gitnexus analyze`; 08:22:28Z before the suite; 08:25:18Z after it) | **not moved** |
| **tree dirty** | 0 porcelain entries after the checkout and the build, and after every later step (`gitnexus analyze`, `sync --check`, and before and after the suite). Every probe and mutant ran from an archive copy in the scratchpad; every CI branch was built with a temporary index (`mkbranch.sh`) | **clean throughout** |
| build | `npm run build` exit 0 at 06:25:15Z, from `dc35b24` | current |
| **CA-13**, no version bump | `git diff 4c1287f dc35b24 -- package.json open-brain/package.json CHANGELOG.md`: 0 lines | **pass** |

## 2. Rows

"Cand. rows" means the six row files (config-channel, configwatch-links, process-role, spawn-sites, refwatch-stage,
runtime), run in the QA tree 06:28:04Z → 06:30:05Z with the JSON reporter: **exit 0; 176 tests, 155 passed, 21
skipped, 0 failed.** The 21 skips are all `skipIf(win32)`: A5's 16 plus A6's five POSIX tests (R60 × 4, R61). R62 and
R63 ran and passed here. Every POSIX row below is read **as passed** from CI's per-test output, never from a skip.

**Rulings-13's table, scored as it says:**

| Row | A6 must (rulings-13) | Observed | Verdict |
|---|---|---|---|
| **CA-15 clause 3** (machine) | pass as amended: A4-1's shapes not read; stow/XDG/relative/multi-level edits read | A4-1's four shapes not read at A6, red at A4 (§3.2). QA 92's eight A5-1 shapes green at A6, red at A5. win32: 31 probes, no victim hash or token in any record; r35edit and r35anchorEdit hashed (§3.1). The handle re-check refuses a file swapped in inside `open` (§3.3). **Third cases returned** (§11.1, §11.2) | **pass** |
| **CA-15 clause 3** (repository) | pass; the record names the right entry | the gate is unchanged (links at base refused; a planted link differs and fails closed); `routeEnd` names the real file; the developer's `mut-rest` reddens it (`35963368623`); M-dev-rest here is 0 red on win32, where that test skips | **pass** |
| **CA-15 clause 4** | pass, with no false base note | **no false base note** in any shape measured (§3.1). **But R61's "every path has a reported state" is not built** (A6-1): a read path's state is never written; "not read" paths other than links and unresolved ones are absent; a not-read finding carries no reason. The type change at the watched path holds (AT-PATH-SAME, §3.2) but has no test (A6-7) | **FAIL** (A6-1) |
| **CA-15 clause 5** | pass | `base`: `LoopRefused link-at-base`, and `baseCtl` proceeds, identical to A5 and A4 by the structural comparison (§3.1) | **pass** |
| **CA-15 (b)** | pass by R63's letter | (b)1, (b)2, (b)4 and (b)6 each assert their plant (`isSymbolicLink`, with a message) and carry an in-test control (a write through a second link by the test itself changes the victim), read from source at `dc35b24`; all four `✓` on CI `35965141320`. **R29's clause is not evidenced by its instrument** (A6-3) | **pass by R63's letter; R29 scored in §3.4** |
| **CA-4f** | pass; a path that cannot be read is reported, never silent; A5 the known positive for STOW-LOOP | STOW-LOOP green at A6, red at A5. ca4fBase: one finding per path, `developer`, both hashes, nothing restored. **But after an ordinary `git config --global` (lock-and-rename, a new inode) in one stage, a later stage's in-place write to `~/.gitconfig` is SILENT** (GITCONFIG-LOOP, §3.2), and the same after a hard link made elsewhere (R61-LOOP) | **FAIL** (A6-1) |
| **CA-4a** | pass, NEWBETWEEN `ok` | NEWBETWEEN `ok` at A6 (A5 fails). Cand. rows pass. M-L2 kills the four CA-4a rows and M-L2-order the garbage-config row, as at A5 (§4). probe2 DMGconfig identical to A5 | **pass** on the table's must; A6-2 recorded under R54 |
| **CA-11** | pass, **unqualified** | "config outside the repository … role writes hashed and reported" is untrue for the later-stage write in GITCONFIG-LOOP and R61-LOOP | **FAIL as rulings-13 states the row** (A6-1) |
| **CA-14** | pass; no false "modified", no false "read through" | no false "read through" found. **A false "modified", with "COULD NOT BE PUT BACK … Recover by hand"**, for a file present at base, rewritten between stages, untouched in the stage (A6-2). Two claims the runtime did not observe: "before: absent" for a file that existed (A6-5), and a stage's "before" that is the loop base's hash, not the stage's start (A6-4) | **FAIL** (A6-2; A6-4, A6-5) |
| **R35** | pass on both platforms | proceeds; the base note carries type and target (r35base, win32; QA 89's R35 and the candidate's Linux R35 `✓`); r35edit and r35anchorEdit read and hashed; STOW-CTL, ANCHOR-EDIT, VIADIR-EDIT hashed on Linux | **pass** |
| **R50** | pass | baseHard and baseHardCfg complete, identical to A5 and A4 (§3.1) | **pass** |
| **R54** | pass; the two baselines kept; an unread side compares identity facts | **EXISTBETWEEN fails** (A6-2): equal identity facts on both sides of the stage are reported as a change, because A6 compares the stage's end with the **loop** base. And a stage whose start was not read writes the loop base's hash as its "before" (A6-4) | **FAIL** (A6-2, A6-4) |
| **R57** | pass | the repository `begin` gate is unchanged from A5 (`git diff 4c1287f dc35b24` does not touch it). **M-R57** kills R57's test (1 red, that test only), as at A5 | **pass** |

**Every other row, re-run:** 

| Row | Observed | Verdict |
|---|---|---|
| **CA-1** | Cand. rows pass. **M-L2 kills both CA-1 tests** | **pass** |
| **CA-2.1–2.4, 2.6** | Cand. rows pass. **M-R15 kills 2.6** | **pass** |
| **CA-2.5** | Cand. rows pass here: the planted `.cmd` control, its twin and the real-`claude` control run. **M-R51-refuse-cmd** (4 red, incl. the planted control), **M-2.5-refuse-node** (16) and **M-2.5-accept-cmd** (2) each kill it | **pass** |
| **CA-3a–d, order** | Cand. rows pass; preflight untouched by A6 | **pass** |
| **CA-4b, CA-4b-L1** | spawn-sites pass. **M-R16 kills 7.** Under M-L2-order the fsmonitor row is green; under **M-L2-order+M-L1** it is red: layer 1's job shown | **pass** |
| **CA-4c, CA-4e, CA-4g** | Cand. rows pass. **M-L0 turns CA-4c's own row and CA-4e red.** probe2 H: the runtime ran the global filter 0 times (the control's `git add`: once); under M-L0, 4 times. R34 identical to A5. **M-L2 kills** CA-4g's repo-local cell | **pass** |
| **CA-4d** | scope unchanged; **M-L2-norestore kills the CA-4d row** | **pass** |
| **CA-4h** | Cand. rows pass. M-R18 alone survives; **M-L2 + M-R18** 16 red, as at A5: the pair | **pass** (by the pair) |
| **CA-4i** | Cand. rows pass. **M-backstop kills** its rows | **pass** |
| **CA-5** | Cand. rows pass on 2.54; CI prints the 2.55.0 row `✓` (`35963678487`). **M-L2 kills the 2.54 row.** No A5-4 occurrence in any R19 run this session | **pass** |
| **CA-6** | Cand. rows pass; POSIX rows `✓` on CI. probe2 SINGLE and DFORK identical to A5 (the kill sentence, the named limit) | **pass** |
| **CA-7** | Cand. rows pass. **M-2.5-refuse-node** turns them red | **pass** |
| **CA-8** | probe2 COMPOSE identical to A5: one record naming the created `post-commit` and the deleted `refs/heads/main`. **M-L2, M-L2-order and M-endstate each kill it** | **pass** |
| **CA-9** | the pin test ran here; the real run is candidate A's (**attributed**, as in reports A to A5) | observation; pin **pass** |
| **CA-10** | **M-CAS** (1) and **M-endstate** (5) kill their rows | **pass** |
| **CA-12** | §5 and §6 | **pass** |
| **CA-13** | 0 lines | **pass** |

## 3. Detail

### 3.1 The loop probes on win32, three trees

`probe15-a5.mts` (QA 92's, unchanged; 31 probes) against archive copies of A6, A5 and A4: A6 06:30:29Z → 06:31:42Z,
A5 → 06:32:55Z, A4 → 06:34:10Z; each exit 0, empty stderr.

**The comparison instrument, and how it was validated.** My first comparator parsed the table rows by their first
space; every row starts with two spaces, so every row parsed to one empty key, and every probe compared
`undefined === undefined`: **31 of 31 "equal", including the known difference.** I caught it on the known positive
(QA 92's r35anchorEdit, A5 ≠ A4) and replaced it with `shape.mjs`: temp suffixes, tokens and 16-hex hashes normalised,
then status, code, stage, config verdicts, machine findings (stage, scope, before/after shape) and findings text
compared, with a count of probes compared. **Validated first:** A5 vs A4 differs on 5 probes **including
r35anchorEdit**, as QA 92 measured.

| Pair | Probes that differ (of 31) |
|---|---|
| A5 vs A4 (the known positive) | r35chainJ, baseHardEdit, r54Revert, r35anchor, **r35anchorEdit** |
| A6 vs A4 | machineNext, machineHard, machineHardAbsent, r35chainJ, r35chainH, baseHardEdit, r54Twice, r54Revert, machineReplace, r35anchor |
| A6 vs A5 | the same ten, with **r35anchorEdit** in place of baseHardEdit |

Every difference is in the **text** of a machine finding (A6's new `not read: base … current …` form) or a base note,
read one by one (`mf.mjs`). **Verdict fields are identical in all three trees for every probe:** the refusals, (a)1–(a)6,
the victims, the tokens, and `victimHashesInRecord` / `victimHashInRecord` / `newFileHashesInRecord` all false.
What the texts show:
- **r35anchorEdit** (A5-1 on win32): A6 `550e79212675ebc3 → 662416b1d11e30ec` in `developer`, as A4; A5 nothing.
- **machineHardAbsent** (R61): A6 adds the base note `… git/config unwatched: did not resolve.`; A5 and A4 have none.
- **r54Twice, qa stage:** A6 `93e46ce8d0363b87 → not read: …`; A5 and A4 `unread → identity change …`. At the qa
  stage's start the file was the developer's replacement, not read. A6's "before" is the **loop base's** hash (A6-4).
- **r54Revert, qa stage:** A6 **`93e46ce8d0363b87 → 93e46ce8d0363b87`**, a reported change whose two sides are equal;
  A5 `unread → 93e46ce8d0363b87` (A6-4).
- **machineNext:** A6 `before: 550e7921…` (the base hash), where A5 and A4 wrote `type:dir`.

### 3.2 On CI's Linux: this seat's probe branches

Four probe files, never for merge and without a PR: QA 89's (blob `b51e9cf8`, unchanged); **QA 92's v3** (the two
route prints made optional, because A6 removed `recordChain`; the diff is those two lines plus a header line, and
nothing else, since QA 92's ANCHOR-EDIT and VIADIR-EDIT would otherwise throw a `TypeError` before their hash assertion
and read as a behaviour failure); and two new files of this seat's: `qa94-a6-probe.test.ts` (POSIX) and
`qa94-handle.test.ts` (both platforms, §3.3).

| Branch | Base | Runs |
|---|---|---|
| `qa/loop-15-slice-3-a6-probe` | A6 | `35965141320` (v1): 6 failed, 1164 passed. `35966082185` (v2, + AT-PATH-SAME): 6 failed, 1165 passed. `35966517077` (v3, + GITCONFIG-LOOP): 7 failed, 1165 passed. **Every failure is in this seat's two files or QA 89's R29 control; every candidate test `✓`** |
| `qa/loop-15-slice-3-a6-probe-on-a5` | A5 | `35965144366`: 16 failed; `35966526850` (v3): 17 failed. QA 92's eight all red |
| `qa/loop-15-slice-3-a6-probe-on-a4` | A4 | `35965147612`: 14 failed; `35966536827` (v3): 15 failed. QA 89's H/J/R/LOOP and QA 92's STOW-H and ABS2 red |

Per test (`×` red, `✓` green), read from the logs with ANSI stripped (`cilog.sh`):

| Test | A4 | A5 | **A6** | Printed at A6 |
|---|---|---|---|---|
| QA 89 A4-1 H / J / R / LOOP | **×** | ✓ | **✓** | not in the record |
| QA 89 CONTROL / B3 / R35 | ✓ | ✓ | **✓** | — |
| **QA 89 R29 row shape** | ✓ | ✓ | **×** | its **known-positive control** fails: a base file made mode 000 in the stage is recorded `not read: base P … ino 326133 nlink 1; current P … ino 326133 nlink 1`, without "unreadable" (A6-3) |
| QA 92 STOW-CTL, XDGDIR-CTL, XDGFILE-CTL, ANCHOR-EDIT, VIADIR-EDIT | ✓ | **×** | **✓** | the edit's hash in the record |
| QA 92 STOW-LOOP (CA-4f through `runLoop`) | ✓ | **×** | **✓** | one finding, `developer`, both hashes |
| QA 92 STOW-H, XDGDIR-H | × / ✓ | **×** | **✓** | not read, reported |
| QA 92 DOWN-CTL, ABS2 | ✓ / × | ✓ | **✓** | — |
| **TRADE-SAME**: a new link mid-path (`$XDG/git` → `git-real`) to the SAME base file; edit in place | × | × | **✓** | read and hashed (D-041's allowed trade). A4 and A5 report a type change and do not read |
| **TRADE-DIFF**: a new link mid-path to a DIFFERENT file | × | × | **×** (my assertion) | not read, reported, **but** as `type change: …/git is a symlink target …/tdiff-outside; not read through`: neither the resolved file nor either identity (A6-8) |
| **REPOINT**: the stow link repointed to an outside file | × | × | **✓** | `not read: base …/rp-dot/gitconfig dev 2049 ino 326052 nlink 1; current …/rp-victim dev 2049 ino 326054 nlink 1` (A5 and A4 name only the victim) |
| **AT-PATH-SAME**: a symlink planted AT `~/.gitconfig` leading to the same base file | — | — | **✓** | `type change: … is a symlink target …/real-gitconfig; not read through` |
| **HARDLINK-SAME**: a hard link to the base file made elsewhere; the next stage appends in place | × | × | **×** | developer: `not read: … nlink 1; current … nlink 2`; **qa: `[]`** |
| **REUSE**: the base file deleted and a new file created | read | read | **read** | ext4 returned the base ino on the **first** attempt; the new file's bytes are read and hashed as `before → after` (§11.2) |
| **UNREAD-BASE**: mode 000 at base, then made readable and edited | "unreadable →" | "unreadable →" | **×** | **`before: "absent"`** for a file that existed (A6-5); no base note |
| **R61-UNIT**: read / dangling / mode 000 / directory; a stage with no act | × | × | **×** | present in the record: **only the dangling path** |
| **R61-LOOP**: `runLoop`; a hard link elsewhere in `developer`, an append in `qa` | × | × | **×** | `status: completed`; findings only in `developer`; the qa write absent |
| **GITCONFIG-LOOP**: `git config --global` in `developer` (new inode), an append in `qa` | × | × | **×** | developer: `9f3ef5ba17d6b437 → not read: base … ino 326050 …; current … ino 326080 …`; **qa: none**; `qaHashInRecord: false` |
| HANDLE-SWAP / SEAM-CONTROL / NO-SEAM CONTROL | seam n/a | seam n/a | **✓ ✓ ✓** | §3.3 |

The A6 candidate's own POSIX tests are **`✓` in every A6 run**: R60 × 4, R61, R55 × 4, R58 (b)3, R58 R29, R52 (b)4,
(b)1, (b)2, (b)6, the Linux R35 row, and CA-6's two POSIX rows.

### 3.3 Dispatch 3(a): the handle re-check

**The developer's "handle" mutant does not test the re-check.** `3c12e2f`, read by diff against `dc35b24`, adds
`let rejectHandle = false; rejectHandle = true;` and ORs it into the condition: **every** handle is rejected, so every
read stops. Its five reds (`35963360666`: R55 CONTROL, R59, both R60 in-place edits, CA-4f) are reads that stopped
happening. The planner's suspicion is right.

**The narrow mutant, `M-handle-narrow`:** `if (!st.isFile() || st.dev !== dev || st.ino !== ino ||
Number(st.nlink) !== nlink)` → `if (!st.isFile())`. The open and the read are kept; only the identity comparison on the
handle is gone. `tsc --noEmit` exit 0 (the type-check control, a planted TS2322, exits 2).
- **win32:** the 176 candidate rows, **0 red** (06:37:07Z → 06:39:07Z).
- **Linux:** `qa/loop-15-slice-3-a6-mut-handle-narrow` (`89c6f0c`, A6 + the mutant + the four probe files), CI
  **`35965570136`**: 7 failed, **all this seat's** (A6's six baseline reds plus HANDLE-SWAP). **Every candidate test
  `✓`.**

**So the re-check is untested by the candidate (A6-6), and a deterministic test is possible.** `qa94-handle.test.ts`
wraps `node:fs`'s `openSync` with `vi.mock` (hoisted state; the real `openSync` is called after the seam). On the first
open of the watched path, after `observe()`'s `realpath` and `stat` have matched the base identity, the seam renames a
different file over the path and then performs the real open. No symlink is needed, so it runs on win32 too.

| Test | A6 (win32, 06:36Z) | A6 (Linux) | M-handle-narrow |
|---|---|---|---|
| **HANDLE-SWAP**: the seam fires once; the path now holds the victim with a new inode | victim hash **not** in the record | ✓ | **× — the victim's hash is in the record** |
| **SEAM-CONTROL**: the seam writes the SAME file in place | the edit **is** hashed | ✓ | ✓ |
| **NO-SEAM CONTROL**: the same swap before `compare()` | caught by the object test | ✓ | ✓ |

What HANDLE-SWAP's record says at A6: `not read: base P dev 2993778667 ino 52354345671189082 nlink 1; current P dev
2993778667 ino 52354345671189082 nlink 1`. **The two identities are the same and no reason is given**: the current
identity is the path's `stat` taken before the swap, and the reason `handle is a different file` (`:978`) is never
rendered (A6-1's third bullet). **R37's narrowed limit holds as stated:** the racing role made the runtime open a
different file, and the runtime did not read it.

### 3.4 Dispatch 3(b) and R29: what the record can still show

**3(b), `8ad8728`.** The R60 "different file through a stow link" test plants a **hard link** at the stow target
(`unlink target; link victim target`). For a hard link, `realpath` names the target path; the OS has no second path to
give. The record at A6 is `not read: base <target> dev D ino I1 nlink 1; current <target> dev D ino I2 nlink 2`: the
resolved path on both sides and both identities. **That meets R60's "the resolved path and the identity"**, and a
reader can see the file at that path became a different inode with a second name (`find -inum` names it). The
assertion was weakened honestly: `toContain(victim)` could not be met by any implementation. What it no longer checks:
that the **base** identity differs from the current one; `"nlink 2"` alone would pass a record that printed only the
current side. For a **symlink** swap, REPOINT (§3.2) shows A6 names both paths.

**R29 (CA-15 (b), mode-000).** The criteria's instrument: *"A runtime read through the link would then surface as an
error, and the record carries none."* At A6 a not-read finding never carries its hash or reason (`compare()`, `:1067–
1086`, renders `type change`, `unwatched` or `not read: base … current …`), so **"unreadable" can no longer appear in
any machine finding, whether or not a read was attempted.**
- **QA 89's known-positive control** (a base file made mode 000 during the stage) is red at A6 on CI (`35965141320`)
  and green at A5 (`35965144366`).
- **M-R29-attempt6** (both gates removed, so the read through the planted link **is attempted**, and fails `EACCES`):
  CI **`35965774257`**: the candidate's **R58 R29 test stays `✓`**, as does QA 89's planted-link assertion. The mutant
  is otherwise live: 26 red, including R43–R45, R49 × 3, R52 (b)4, R55 × 3 and R59.

**R29's behaviour holds by the code path** (static reading, labelled): a link planted at the path returns `type change`
at `:966` before any open, and a different file returns at `:971`. **Its test cannot fail, and its instrument is
blind** (A6-3).

### 3.5 Dispatch 3(c): D-041's trade in both directions, and third cases

- **Same file through a new link: read.** TRADE-SAME (a new mid-path directory link): read and hashed at A6; A4 and A5
  refuse it. That is the trade, as recorded.
- **Different file through a new link: not read, and reported.** TRADE-DIFF, REPOINT, HANDLE-SWAP, NO-SEAM, QA 92's
  STOW-H and XDGDIR-H, QA 89's H/J/R/LOOP: no victim hash in any record. The record names both resolutions for a
  repoint (REPOINT) and a hard-link swap (§3.4), but not for a new mid-path link (A6-8).
- **Third case 1: the same file whose link count changes.** R60 puts `nlink` in the identity. A hard link to the base
  file made **anywhere on the same filesystem** (the repository included) makes the path "a different file" for the
  rest of the loop, although the object and the path are untouched. The ordinary form does not need a hard link:
  `git config --global` rewrites the file by lock-and-rename, so after any `git config --global` the path is a
  different **inode** (GITCONFIG-LOOP). Either way a later stage's in-place write is silent (A6-1). D-041's "a new link
  to the same file may be read" holds for symlinks; for a hard link to the same object, the trade runs the other way.
  Returned (§11.1).
- **Third case 2: a different file with the base file's identity.** REUSE: `unlink` the base file, create a new one:
  ext4 gave back the same `ino` on the first attempt (`nlink` 1, same `dev`), and A6 read and hashed the new file's
  bytes. **By R60's definition this is "the base file"**, so it is scored as a criterion question (§11.2), not against
  the candidate. What it can expose is exactly what an in-place write of the same bytes exposes, which CA-4f already
  hashes; the record calls a replacement an edit.

### 3.6 R62 and A5-4: `probe-r62.mts`

`ConfigWatch` directly, a fixture repository, each case in its own repository, 06:44:10Z → 06:44:17Z:

| Case | A6 | A5 | A4 |
|---|---|---|---|
| **NEWBETWEEN** (QA 92's A5-4 positive): absent at base, written before `begin`, untouched | **`ok`** | `ok: false`, modified, unrestored 2 | `ok` |
| **EXISTBETWEEN**: present at base; lock-and-rename, **same bytes**, before `begin`; untouched | **`ok: false`**, modified, **unrestored 2** | `ok: false`, same | **`ok`** |
| **EXISTBETWEEN2**: the same with different bytes (a change **before** this stage) | **`ok: false`**, unrestored 2 | `ok: false` | `ok` |
| CONTROL-NEW: absent at base, created during the stage | created | created | created |
| CONTROL-EXIST: present at base, rewritten during the stage | modified | modified | modified |

A6's EXISTBETWEEN record: `1 repository config/hook file(s) changed during the developer stage: <common>/info/refs
modified (identity:dev 2993778667 ino 19421773396043479 nlink 1; not read → identity:dev 2993778667 ino
19421773396043479 nlink 1; not read). … 2 FILE(S) COULD NOT BE PUT BACK: …\info\refs (snapshot was file; not
followed); …\info\refs (read back 000a1ab1404b4d35/666/nlink:1, expected identity:… not read).`

**The cause, read from the code:** `closeAndRestore` (`:716–723`) computes `drifted`: the stage-end snapshot is
unread **and** its identity differs from the **loop base's** chain. It reports the path when `changed(b, a) || drifted`.
For EXISTBETWEEN, `changed()` is false (R62 is met there), and `drifted` is true. **M-drifted-off** (the clause removed; `tsc` 0) makes EXISTBETWEEN and EXISTBETWEEN2 `ok`, keeps both controls reporting, and turns **one** candidate test red: R57's (`configwatch-links.test.ts:900`, `expected '{"ok":true,"stage":"qa",…' to contain 'not read'`). That test plants a hard link at `.git/config` **between** stages and edits the victim in place **during** the qa stage; only `drifted` reports it. §11.6.

**Reachability.** Rulings-12 called R57's path "reachable only through U3". QA 92 saw A5-4 once in the CA-5 R19 test
from an unidentified writer of `.git/info/refs`. EXISTBETWEEN is the same writer landing on a file that was already
there at base. The writer is still not identified.

### 3.7 R63 and R61 by the code path

- **R63:** the new test (`config-channel.test.ts:326`) asserts "The offending paths were reverted." is **present** after
  a revert that ran, and that the plant is gone. M-R59-never and M-dev-revert: §4. (b)1, (b)2, (b)4 and (b)6: §2.
- **R61 by the code path:** at `dc35b24` the per-path state (`MachineSnap.state` and `.reason`, `:860–876`) is
  consulted in two places: `baseNotes()` (`:999–1017`, only `willRead` for a link's wording, and `unwatched` for a
  non-link) and `compare()` (`:1041–1088`, which `continue`s when nothing changed). `runtime.ts` renders
  `machine_config_paths` (the list of paths, `:642`) and the findings, and nothing else about machine state.
- **R60 by the code path:** the machine side calls no route walk. `observe()` (`:909`) uses `lexicalPaths` only to
  `lstat` the path as written (for `viaLink` and the base notes). The only machine-side byte read is
  `readFileSync(fd)` at `:980`, after the handle check at `:976–979`. The repository side's only byte read is
  `readState` (`:427`). No recursive remove. One stale doc comment at `:989` still names the removed
  `resolutionMismatch`.

## 4. Mutants

Each local mutant is a `git archive dc35b24 open-brain` copy with a `node_modules` junction (`build6.mjs`).
- **Applicability is checked against A6's blobs before archiving.** QA 92's file holds 41 array specs (plus
  M-R51-refuse-cmd@a3, pinned to A3). **35 apply as written; six machine-side specs no longer apply** because A6 removed their text: M-R46-basenotes, M-R49-machine,
  M-R49-both, M-R54, M-R55-realpath and M-R59-read. Each has an A6 equivalent below, or is covered by a developer
  mutant. M-R51-refuse-cmd@a3 is not rebased; M-R50+agrees (superseded at A5 by -v2) and M-typecheck-control (built
  only, as the control) are not in the table.
- Every edit was asserted to occur the expected number of times and read back. **Every counted mutant is
  `tsc --noEmit` exit 0**; the type-check control (a planted TS2322) exits 2. **M-follow-a** failed `tsc`
  (TS2300: A6 already imports `statSync`, and QA 92's import edit duplicated it). It was **not counted**, and it was
  rebuilt as **M-follow-a6** with that one edit dropped and every behavioural edit kept.
- Results were read from the JSON reporter over the six row files **plus `qa94-handle.test.ts`** (179 tests), run
  sequentially 06:37:07Z → 08:09:58Z, then M-follow-a6 and M-drifted-off 08:11:48Z → 08:15:53Z, nothing else beside them (one exception, §12). **No run printed
  an unhandled error.**
- Five mutants ran on CI, where the rows they aim at are POSIX-only (§3.2–§3.4).

**A6's own protections, one mutant each** (the developer's six were rebuilt here from their diffs against `dc35b24`,
and their CI runs re-read per test):

| Mutant | Edit | Red, win32 (of 179) | CI (Linux) | What it shows |
|---|---|---|---|---|
| **M-dev-object** (`8dbb6c3`) | `if (!same) return … "different file"` removed | **7** (R44, R45, R43, R49 × 3, R59) + NO-SEAM | `35963349906`: 11, incl. R55 × 3 and R60 different-file; `35965774257` (with the type change also removed): 26 | the object test; it reverts what it claims |
| **M-dev-handle** (`3c12e2f`) | `rejectHandle = true`: **every** handle rejected | 2 (CA-4f, R59) + SEAM-CONTROL | `35963360666`: 5, all reads that stopped | **not the handle re-check** (§3.3) |
| **M-handle-narrow** (this seat) | only the identity comparison on the handle removed | **0** + HANDLE-SWAP | `35965570136`: **every candidate test `✓`**; HANDLE-SWAP red | **the re-check is untested by the candidate (A6-6)** |
| M-dev-rest (`62b16ef`) | `routeChain`'s cumulative `rest` back | 0 (the test is POSIX) | `35963368623`: 1, `routeEnd` | reverts R60's repository fix |
| M-dev-unwatched (`f2e3498`) | the base note says "read through" whatever the state | 0 (POSIX) | `35963376352`: 1, R61 | reverts R61's **base-note** half only; R61's other states were never built (A6-1) |
| M-dev-identity (`beddeac`) | `changed()` treats either unread side as a change | **1**: R62 | `35963384988`: 1 | reverts R62's `changed()` |
| M-dev-revert (`3902557`) | "reverted" never printed | **1**: R63 | `35963392393`: 1 | R63 |
| **M-R59-never** (QA 92's) | the same | **1**: R63 (it **survived** at A5) | — | A5-5 closed |
| **M-drifted-off** (this seat) | the `drifted` clause removed | **1**: R57 | — | EXISTBETWEEN `ok` without it: **`drifted` is A6-2's cause, and R57's test depends on it** (§11.6) |
| **M-R29-attempt6** (this seat) | the type change and the object test removed: the read through a planted link **is attempted** | — | `35965774257`: 26 red; **R58 R29 `✓`** | R29's test cannot fail (A6-3) |
| **M-typechange6** (this seat) | the clause-4 type change at the path removed | **0** | `35965783081`, `35966084640`: **every candidate test `✓`**; AT-PATH-SAME red | untested (A6-7) |

**A6 equivalents of the specs A6 removed:**

| Mutant | Edit | Red (win32) | At A5, for the removed original |
|---|---|---|---|
| M-R46-basenotes6 | no base notes | **1**: R46 parent-component note | M-R46-basenotes: 1 |
| M-R54-6 | read/read attribution against the loop base, not the stage's start | **1**: CA-4f's row | M-R54: 3 |
| M-R59-read6 | a path read at the stage's end but not at its start is written up as "not read" | **1**: R59 read half | M-R59-read: 1 |
| M-dev-object | (the machine gate) | 7 | M-R49-machine: 7 |

**QA 92's carried set, rebuilt at A6** (each against its A5 count in report A5 §4):

| Mutant | Red at A6 | At A5 | Note |
|---|---|---|---|
| M-L0 | **2** (CA-4c own row, CA-4e) | 2 | probe2 H under M-L0: 4 runs inside the runtime (0 at A6), as at A5 |
| M-L1 | 0 | 1 (unexplained at A5) | as at A4 |
| M-L2 | **16** | 16 | — |
| M-L2-order | **4** | 4 | — |
| M-L2-order + M-L1 | **7** | 7 | layer 1's job shown, as at A5 |
| M-R18 | 0: survives alone | 0 | — |
| M-L2 + M-R18 | 16 | 16 | the pair, as at A5 |
| M-R16 | **7** | 7 | — |
| M-R15 | **1** (CA-2.6) | 1 | — |
| M-backstop | **4** | 4 | — |
| M-CAS | **1** | 1 | — |
| M-endstate | **5** | 5 | — |
| M-L2-norestore | 19 | 20 | A5's +1 was the unexplained gate-log red; A4 was 19 |
| M-follow-a6 | **6** ((a) × 3, R45, R46 × 2); probes a1, a2, a3, a4pre: the link left, the victims unchanged, as at A5 | 6 (M-follow-a) | M-follow-a itself did not type-check at A6 |
| M-follow-b | **2** | 2 | — |
| M-follow-c | **3** | 3 | — |
| M-R44 | **2** | 2 | — |
| M-R45 / -record / -mkdir | **1** each | 1 each | — |
| M-R46-root | **1** | 1 | — |
| M-R43-repo | **1** (R57) | 2 | A5's second red was unexplained, single run |
| M-R49-repo | **2** | 2 | — |
| M-R49-repo + M-R43-repo | **3** | 3 | — |
| **M-R50** | **0** | 1 | **survives every row and both of its probes (baseHard, baseHardCfg).** At A5 it was killed only by A5's own false "changed" on an unread side. **baseHardEdit kills it at A6:** unmutated, the role's in-place edit to a hook hard-linked at base fails `stage-changed-config`; under M-R50, **the loop completes with the hook edited** (A6-9) |
| M-R50 + agrees-v2 | **0** | 1 | the same |
| M-R51-refuse-cmd | **4**, incl. the 2.5 planted control | 5 | A4 was 4 |
| M-2.5-refuse-node | **16** | 16 | — |
| M-2.5-accept-cmd | **2** | 2 | — |
| M-R55-route | 0 | 0 on win32 | at A6 `routeChain` is repository-only, where a planted link already differs from base by type; the mutant is equivalent there. R55's machine-side job is M-dev-object's |
| M-R57 | **1** (R57) | 1 | — |
| M-R59-revert | **1** | 1 | — |

**Not run:** M-R22 (POSIX-only; no POSIX machine here); the CA-4h resolve-late mutant; the CA-5 snapshot-timing
mutant. As in reports A2 to A5.


## 5. Full suite and CI (CA-12)

**QA full suite at the candidate: 08:22:35Z → 08:25:11Z, `SUITE_EXIT=0`, captured unpiped (`npx vitest run > file;
SUITE_EXIT=$?`), from `~/Worktrees/sia-qa/open-brain` at `dc35b24`.**
- `Test Files  75 passed (75)`, **`Tests  1126 passed | 21 skipped (1147)`**; 0 matches for `Unhandled|onTaskUpdate`;
  duration 152.96 s. The total, 1147, equals CI's on the head (`35963678487`: 1141 passed, 6 skipped).
- **Quiet machine (G-042):** the planner's GO and what it rests on are in §0. This seat's own measurements: 0 of 46
  listening sockets on 3210/4000/5173 at 08:20:57Z and 08:22:28Z; this seat's last local run finished at 08:17:52Z, and
  nothing of mine ran during the suite.
- Peers (`ListAgents`), read by this seat:

  | When | sia-planner-6b | a2a-planner-6c (Relay) | a2a-rivet-63 | a2a-qa-5f |
  |---|---|---|---|---|
  | 08:21Z (before the GO) | idle | idle | idle | idle |
  | 08:22Z (the GO's tail) | **busy** | idle | idle | idle |
  | 08:22:28Z (before, re-read) | idle | idle | idle | idle |
  | 08:25:18Z (after) | idle | idle | idle | idle |

  The planner's one `busy` read came as its GO message arrived; I waited for an idle read before starting.
- **G-042 did not appear.** The worktree is recorded: `~/Worktrees/sia-qa`.

**CI on the candidate's exact head** exists: `35963678487` on `dc35b24`, success, re-read per test by this seat: 1141
passed, 6 skipped, git 2.55.0. The developer's seven other runs were re-read per test and match the dispatch's table
(§4). Every A6 candidate test is also `✓` in this seat's three A6 probe runs (§3.2).

## 6. `/sync --check` (CA-12)

- **`gitnexus analyze`** in the QA tree, 08:19:15Z: exit 0 on the first run. `meta.json` `lastCommit` = `dc35b24…`,
  `indexedAt` 08:19:52Z, read from the file.
- **`sync --check` in the QA tree: exit 1**: `25 passed, 0 fixed, 2 warnings, 3 issues, 0 skipped`.
  - `gitnexus-index` passed ("index is at HEAD (indexed dc35b24 …)"); `build-freshness` passed ("build matches HEAD
    dc35b24").
  - The issues are `prd-version`, `summary-version` (views at rev 84, v0.44.0) and `retirements` (ENTITIES.md names
    `dream` and `reflection queue`): the same three as reports A to A5.
  - **All three issues' inputs are byte-identical** between `4c1287f` and `dc35b24`: `git diff --quiet … -- .agents
    package.json open-brain/package.json CHANGELOG.md README.md` exits 0. **Control:** `open-brain/src/harness`
    differs, exit 1.
  - The warnings are `vault-index-parity` (one Checkpoints note) and `spec-provenance` (no `specs/`).
- **Plain `sync`, in a scratch clone** (`git clone --no-hardlinks` of the QA repository, detached at `dc35b24`, `npm
  ci` and its own build, `plainsync6.sh`): `sync --check` there **exit 1** (23 passed, 2 warnings, 3 issues, 2
  skipped); plain `sync` **exit 0**, "23 passed, **2 fixed**, 2 warnings, **1 issues**, 2 skipped", rewriting five
  tracked `.agents` files in the clone. The two skips are the clone's: `gitnexus-index` ("no .gitnexus/ in this
  tree") and `ci-status` ("gh is not authenticated"). **The QA tree was never written** (0 porcelain entries after).

## 7. What could not be verified, stated so nobody inherits it as settled

1. **The writer of `.git/info/refs`** (A5-4's natural occurrence, and A6-2's). Not identified; A6-2 is shown at unit
   level only.
2. **HARDLINK-SAME on win32.** Measured on Linux CI only (its file is `skipIf(win32)`). By the code the same path is
   taken on NTFS. GITCONFIG-LOOP, the ordinary form, **was** run on win32 at A6 (08:17Z): the qa write silent there too.
3. **Inode reuse on NTFS or tmpfs.** Measured on CI's ext4 only (first attempt). tmpfs does not reuse inode numbers
   the same way; NTFS was not tried.
4. **M-R22** and the **CA-4h resolve-late** mutant: not constructed, as in reports A2 to A5.
5. **CA-9's real run** is carried from candidate A and attributed.
6. **The race R37 names, beyond the handle:** the window between `realpath` and `stat` inside `observe()` (`:942–943`,
   two lookups) was not probed. The handle check makes it harmless for reads; for the record it can make "current"
   name something other than what was opened, which HANDLE-SWAP shows in its benign form.
7. **The declared unrunnables U1–U6** (criteria §3).
8. **CA-11's table in the candidate's output** was not re-read line by line at A6; A6 does not touch `runtime.ts`.

## 8. What the checks I ran cannot see

- **One win32 machine, and CI's Linux** for the POSIX rows and five mutant branches. The carried mutants ran on win32
  only, where the candidate's POSIX tests skip.
- **Stub roles, one act each.** The third cases were found by reading `observe()` for what its identity cannot tell
  apart; other shapes may exist that neither the reading nor the probes reached.
- **Traceless reads.** A read whose result is discarded is visible only by the code path (§3.7).
- **The seam (§3.3) tests the handle check through `openSync`.** A candidate that opened by another call would not be
  seen by it; the test is specific to this implementation, which is why it is offered as a test to add, not as a row.

## 9. Defects, each with the observation that produced it

| # | Severity | Defect | Observation |
|---|---|---|---|
| **A6-1** | **high** (CA-15 clause 4 as R61 extends it; CA-4f; CA-11) | R61 is not built beyond the "unwatched" base note. A read path's state is never written; "not read" paths other than links and unresolved ones never appear; a not-read finding carries no reason. **Its silent consequence:** once a machine-config path's identity changes in one stage (an ordinary `git config --global`, or a hard link made anywhere), a later stage's in-place write to it produces **no finding and no entry**, and the loop completes | CI R61-UNIT (only the dangling path present), R61-LOOP and GITCONFIG-LOOP (qa write absent; A4, A5 the same), HANDLE-SWAP and QA 89's R29 control (two identical identities, no reason); code path §3.7 |
| **A6-2** | **medium** (R54 as R62 amends it; CA-14) | `closeAndRestore`'s `drifted` clause reports a file whose stage-start and stage-end identities are equal as `modified`, because its identity differs from the loop base; the stage fails with "COULD NOT BE PUT BACK … Recover by hand" | `probe-r62.mts` EXISTBETWEEN and EXISTBETWEEN2: A6 and A5 fail, A4 `ok` (§3.6). **M-drifted-off makes both `ok`** and reddens R57's own test (§3.6, §11.6) |
| **A6-3** | **medium** (CA-15 (b) R29; R58) | R29's instrument is blind at A6 and its test cannot fail: "unreadable" can no longer reach a machine finding | QA 89's control red at A6, green at A5; **M-R29-attempt6** (the read attempted) leaves R58 R29 `✓` (`35965774257`) |
| **A6-4** | low (R54; CA-14) | a stage whose start was not read writes the **loop base's** hash as "before" | r54Twice qa `93e46ce8… → not read …`; r54Revert qa **`93e46ce8… → 93e46ce8…`** (A5: `unread → …`) |
| **A6-5** | low (CA-14; R61) | a path unreadable at base, later made readable and edited, is written `before: "absent"`; no base note names it | UNREAD-BASE on CI; A5 and A4 write `unreadable` |
| **A6-6** | low (test; dispatch 3(a)) | R60's handle re-check has no test that fails without it; the developer's handle mutant rejects every handle | M-handle-narrow: 0 of 176 win32 rows red, every candidate test `✓` on Linux (`35965570136`); HANDLE-SWAP red under it (§3.3) |
| **A6-7** | low (test; clause 4) | the type change for a link planted **at** the watched path has no test that fails without it | M-typechange6 (`90f2322`/`2f466ba`): every candidate test `✓` (`35965783081`, `35966084640`); AT-PATH-SAME red under it, `✓` at A6 |
| **A6-8** | low (R60's record) | a new **mid-path** link to a different file is recorded as `type change: <link> is a symlink target <dir>`, without the resolved file or either identity | TRADE-DIFF on CI |
| **A6-9** | low (test; R50) | R50's protection (a repository file hard-linked at base is **read**, so an in-place edit to it is seen) has no row that fails without it at A6 | **M-R50** survives all 179 rows and both of its probes; at A5 it was killed only by A5's false "changed". **baseHardEdit kills it:** unmutated, `stage-changed-config` on the edited hook; under M-R50 the loop **completes with the hook edited** (`watchedEqualsBase: false`, every config verdict `ok`) |
| D-A2-7 | low (carried) | a `.git` junctioned at base to a non-repository is recorded `not-a-repo` | baseDotGitRepo, unchanged from A5 (§3.1) |
| D-A5 | carried | — | — |

## 10. Regressions: previously validated behaviour confirmed still working

- The six candidate row files at A6 (155 passed, 0 failed), CI on the head (`35963678487`, re-read: 1141 passed, 6
  skipped) and this seat's full suite (1126 passed, exit 0). They include G-045's rows, slice two's refusals and every candidate-A row.
- All 31 of the win32 CA-15 probes: verdict fields identical to A5 and A4 (§3.1).
- Report A5's non-link probes, `probe2.mts` H, R34, SINGLE, DFORK, DMGconfig, DMGhead, DMGindex and COMPOSE, at A6 08:16Z: **identical to A5** after normalising paths, PIDs and hashes. `probe-r57.mts` and `probe-r59.mts`: A6 NEWBETWEEN `ok` (A5 fails, A4 `ok`); r59 SNEAKY/CFGONLY/BOTH identical to A5 in both directions (A4 prints "reverted" on CFGONLY).
- Every carried mutant that still applies kills at A6 what it killed at A5 (§4), **except M-R50 and M-R50+agrees-v2**,
  which survive every row at A6 (A6-9).
- **Regressions by the rows:** A6-5 (`before: "absent"` where A5 wrote `unreadable`) and A6-3 (QA 89's R29 control,
  green at A5). A6-4 changes A5's honest `unread` into the loop base's hash.

## 11. Where the criteria, the rulings and the candidate disagree (returned, not scored)

1. **`nlink` in R60's identity.** With `nlink` in it, the same object is "a different file" when a link count changes
   (a hard link made anywhere), and the path is not read for the rest of the loop, although nothing about what the
   runtime would read has changed. With `ino` alone, a lock-and-rename is still a different file. **Returned:** whether
   `nlink` belongs in the read gate's identity, given R50 (a hard link at base is read). Either way, A6-1 stands: R61
   requires the not-read path to be reported at every stage.
2. **Identity is not a file's identity over time.** `(type, dev, ino, nlink)` names a file at one instant. On ext4 a
   deleted file's inode number was handed to the next file created, on the first attempt, and A6 read it as the base
   file. It exposes nothing an in-place write would not, and CA-4f hashes those; the record calls a replacement an
   edit. **Returned:** whether R60 should add a generation (`birthtime` where the platform has it, or `ctime` with
   `ino`), or accept the case and name it as a limit.
3. **R61's "at every stage".** I scored it literally: every watched path, in every stage's record, in exactly one
   state. If the planner meant "the base state, plus every change", A6-1's first bullet narrows, and its silent
   consequence (GITCONFIG-LOOP) still fails CA-4f's "never silent".
4. **R29's instrument needs replacing.** It depends on the record carrying the failed read, which A6's record never
   does. The seam in §3.3 gives a direct instrument: fail the test if `openSync` is ever called on the victim's path.
   Offered for the next criteria amendment.
5. **CA-4f's "both hashes" for a lock-and-rename write.** R49/R60 make a rewritten file "a different file", so
   `git config --global`, the ordinary way a role writes global config, is reported without its after-hash
   (GITCONFIG-LOOP: `9f3ef5ba… → not read: …`). This is as ruled and is not scored; it is named because it is the
   **common** case of CA-4f's write, not an edge.
6. **R62 against R57's own test: an in-place write to an UNREAD repository file.** R62 says equal identity facts on
   an unread side mean no change. An in-place write keeps the inode, so it is invisible to that comparison. The
   candidate's R57 test (`configwatch-links.test.ts:900`) plants a hard link at `.git/config` between stages and has
   the qa stage write the victim in place; it requires the qa stage to say "not read". A6 meets it only through
   `drifted` ("differs from the loop base"), which also fires when nothing happened in the stage (A6-2). **Removing
   `drifted` (M-drifted-off) makes EXISTBETWEEN `ok` and turns R57's test red.** The two cannot both hold by identity
   alone. **Returned:** which one the next ruling keeps, or whether an unread file whose identity already differs from
   the base at a stage's start should be reported **once, as its state** (R61's "not read, with the reason and its
   identity facts"), rather than as a change in every later stage.

## 12. This seat's error entries and near-misses this session

**Error entries (escaped):** none known. The interim A2A message to the planner (06:50Z) said the direction was REJECT
on R61 and an R62 sibling, and listed the findings then in hand. It is superseded by this report; it did not yet carry
GITCONFIG-LOOP (which widens A6-1's trigger to an ordinary `git config --global`), the mutants or the suite.

**Near-misses (caught in-process, not numbered):**
- **A vacuous comparator** (§3.1): 31 of 31 "equal" from rows that all parsed to one empty key. Caught on the known
  positive before any result was used.
- **A pipe masked a push's exit code:** `git push … | grep -v '^remote'; echo push=$?` printed `push=1` (grep, no line)
  for three pushes that succeeded. The end state was read with `ls-remote` in the same command, which showed each new
  SHA. The recall trigger surfaced entry 299 beside it.
- **Concurrent load:** `probe-r62.mts` (unit level, 7 s, 06:44:10–17Z) ran inside M-L1's row window (06:42:19–06:44:23Z).
  M-L1 went green, and load can only produce false reds, so its result stands; nothing else ran beside a mutant.
- **My own correction to §4's spec count was wrong by one** ("42 … 36"); a recount from `mutants-a5.mjs` against A6's
  blobs gives 41 array specs, 35 applicable. Fixed before commit.
- **`mkqa92v3.mjs` reported "old left 2"** after a replacement whose new text contains the old expression inside a guard.
  Checked by counting the guard (2) and by `diff` (5 lines), not trusted either way.

## 13. Reproduction

The scripts are tracked at **`docs/loops/qa-scripts-a6/`** on this branch, byte-identical to the copies that ran,
with a README. QA 92's set is at `docs/loops/qa-scripts-a5/`; the ones reused here unchanged are named in that README.

| Branch (pushed under D-038, read back) | Head | What |
|---|---|---|
| `qa/loop-15-slice-3-a6-probe` | `01fe317` (v3; v1 `6e53e4e`, v2 `3d462ba`) | A6 + QA 89 + QA 92 v3 + `qa94-a6-probe` + `qa94-handle` |
| `qa/loop-15-slice-3-a6-probe-on-a5` | `a1e9743` (v1 `5db11e3`) | the same files on A5 |
| `qa/loop-15-slice-3-a6-probe-on-a4` | `6311eb0` (v1 `82a30ec`) | the same files on A4 |
| `qa/loop-15-slice-3-a6-mut-handle-narrow` | `89c6f0c` | + M-handle-narrow |
| `qa/loop-15-slice-3-a6-m-r29-attempt6` | `ebb6f7c` | + M-R29-attempt6 |
| `qa/loop-15-slice-3-a6-m-typechange6` | `2f466ba` (v1 `90f2322`) | + M-typechange6 |

- **A6-1 in three lines (Linux or win32, `runLoop`):** `HOME/.gitconfig` a plain file; the developer runs `git config
  --global user.email x`; the qa role appends to `~/.gitconfig`. The qa stage's record has no finding for the path.
- **A6-2 in three lines (`ConfigWatch`, any platform):** `.git/info/refs` present; `captureBase()`; write
  `info/refs.lock` with the same bytes and rename it over `info/refs`; `begin`; `closeAndRestore()` → `ok: false`.

## 14. Handoff to the next QA session (D-035)

1. **Known positives:** for A6-1, **A6 `dc35b24`** by GITCONFIG-LOOP, R61-LOOP and R61-UNIT (A4 and A5 are red on them
   too: they are positives for the class, not negatives). For A6-2, **A6 and A5** by `probe-r62.mts` EXISTBETWEEN, with
   **A4 the known negative**. For A5-1 and A4-1, A5 and A4 remain the positives (§3.2).
2. **Run QA 89's R29 control beside any R29 row.** At A6 it is the only thing that shows the R29 instrument is blind.
3. **Use the seam** (`qa94-handle.test.ts`) for any candidate that keeps a handle check; it reddens only under the
   narrow mutant.
4. **Probe identity over time, not only at an instant:** lock-and-rename, a hard link made elsewhere, and delete +
   create (inode reuse). Each moves R60's identity differently.
5. **Carried mutants rebuild at A6 with unchanged counts where they apply**; six machine-side specs no longer apply
   and have A6 equivalents in `mutants-a6.mjs`.
6. **Plain `sync` only in a scratch clone. Run nothing beside a mutant's rows.**
7. **Nothing is pushed except this seat's own branches (D-038); the merge is Aaron's.**

