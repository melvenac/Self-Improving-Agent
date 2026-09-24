# Loop 15 slice three — QA report A7: candidate A7 `d223d1d`: REJECTED

**By:** Probe (QA seat), record session **96** (T-164: the dispatch assigned it; the greeting's per-worktree counter
said 13 and is not used) · **Date:** 2026-09-24 (UTC).
**Model and effort, from this session's host transcript**
(`~/.claude/projects/C--Users-melve-Worktrees-sia-qa/07fe8094-75b7-499f-88b2-6bf1761d35a3.jsonl`, parsed as JSON):
every assistant entry carries `"model":"claude-opus-5-5"`, `"effort":"high"` and `perTurnEffort` `"high"`: 262 of 262
entries, 22:17:35Z → 23:49:27Z. That span covers every measurement, mutant, CI run and the suite. The report was
written after that read.

**Dispatch:** `docs/loops/loop-15-slice-3-dispatch-qa-a7.md` on master `d34f545`. The live planner (sia-planner-6b,
record session 90) pointed to it by A2A at session start.
**Criteria:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` at **`6672e83`** (FINAL), read with **rulings-9 to
rulings-14** on master. **D-042 (R67) amends D-041's read gate.** Rulings-14's table of touched rows is scored as that
table says (§2).
**Candidate (frozen):** **`d223d1dbe4247fdc0131cd92bfc14288c52d7cf5`** on `origin/loop/15-slice-3-candidate-a7`, eight
commits on A6 `dc35b24`. I read each commit's `git diff --stat`, and the dispatch's table matches it row for row.
Built by Grok 4.7 in Cursor, developer record session 95 (T-177). I read the handoff
(`docs/loops/loop-15-slice-3-a7-developer-handoff.md` at `d223d1d`) in full.
**Transition control:** A6 `dc35b24`, on Linux CI (a probe branch) and on win32 (a `git archive` copy). The archive
copies' `configwatch.ts` blobs were compared to their SHAs: `e2334c4f` (A7) and `d94c1b65` (A6), both equal.
**Scored in:** `~/Worktrees/sia-qa`, detached at the frozen SHA from 23:43:35Z. git `2.54.0.windows.1`, Node v22.23.2,
win32. **Linux:** CI, on runs this seat dispatched on its own `qa/*` branches under D-040 (§3.2).
- **Runner, for every run in this report:** GitHub-hosted, "Hosted Compute Agent", `Image: ubuntu-24.04`, git 2.55.0.
- **Not tcm.** Every probe branch is built on a candidate commit, and so carries the candidate's `ci.yml`, which
  predates PR #152.
- **Kept that way on purpose.** The planner ruled on 2026-09-24: "do NOT add master's ci.yml… a result shift would be
  confounded" (tcm has git 2.43).

---

## Verdict: REJECTED. A6-1 and A6-2 are closed and D-042's trade holds. But the machine side has no R64 facts, so a later-stage in-place write to an unread machine path is silent

**What A7 fixed, measured against the named known positives:**

| Item | At A6 | At A7 | Evidence |
|---|---|---|---|
| **A6-1**, the ordinary trigger: `git config --global` (lock-and-rename), then an in-place append | qa write silent | **closed** | GITCONFIG-LOOP: qa `8dc399fe… → c63c2e26…` at A7; red at A6 (`36067661629` vs `36067670009`) |
| **A6-1**, the hard-link trigger: a hard link to the base file made elsewhere | qa write silent | **closed** | HARDLINK-SAME and R61-LOOP green at A7, red at A6; the developer's R67 test |
| **A6-1**, R61 literal: every path, every stage | only the dangling path | **met** | R61-UNIT (four states, each present); R65-EVERY-LOOP (3 paths × 3 stages, each exactly once; red at A6) |
| **A6-2** (`drifted`) | EXISTBETWEEN `ok: false` | **closed** | `probe-r62.mts` on win32: EXISTBETWEEN/EXISTBETWEEN2 `ok` at A7, fail at A6. The natural form: probe `a2` at A6 reports `deleted:refs` with 2 unrestored; at A7 it is gone (§3.1) |
| **A6-3** (R29's instrument) | blind | **met** | the seam test; **M-R29-both reddens it** (dispatch 2(a), §3.3) |
| **A6-6** (the handle has no test) | untested | **met** | M-handle-narrow7 = the developer's mut-handle: reddens the seam test and QA 94's HANDLE-SWAP, on win32 and Linux |
| **A6-7** (the at-path type change) | untested | **met, with a note** | mut-type reddens the developer's test, but only because it also relaxes the realpath gate (§4) |
| **A6-8** (TRADE-DIFF's record) | no identities | **met** | TRADE-DIFF names both resolutions and both identities (QA 94's and the developer's tests) |
| **A6-9** (R50 at row level) | M-R50 survives | **met** | M-dev7-r50 reddens R66 R50 (win32 and CI) and the `baseHardEdit` probe (the loop completes with the hook edited) |
| **D-042 trade** (dispatch 2(c)) | — | **holds both ways** | lock-and-rename read with both hashes; a hard link elsewhere does not stop reads; a new two-name file not read (§3.4) |
| **R67 protective direction** (dispatch 2(b)) | — | **load-bearing** | M-R67-nlink: QA 89's A4-1 H and LOOP read the outside file (`36067696859`); on win32 `machineHard` and `r35chainH` read the victim (§3.3) |

**Why it is rejected.**

**A7-1 (high): R64 is built on the repository side only; the machine side compares no size and no mtime, and its
"not read" record carries no facts.**
- `MachineSnap` (`configwatch.ts:863–879`) has no `size` or `mtimeNs`.
- `compare()`'s `sameId` (`:1051–1052`) compares `lexicalKind, resolvedPath, kind, dev, ino, nlink`.
- When a machine path is **not read** at a stage's start and at its end, and those six are equal, `compare()` writes the
  stable entry `not read: <reason>` with `before === after` (`:1069–1077`). `runtime.ts:1064` skips it as "no change".
- So an **in-place write** to an unread machine path during a stage is **silent**: no finding and no line. The loop
  completes.
- R64: "For a side that is not read, attribution compares `lstat` facts … `size` and `mtimeNs` … Any difference is a
  change, reported 'not read' with both sets of facts." R65: "not read, with the reason and the R64 facts".
- The planner read both rulings this way (A2A, 2026-09-24): "R64 is NOT repository-only … a machine-side comparison on
  (kind, dev, ino, nlink) with no facts in the record fails R64 and R65 as written."

**Its ordinary trigger** is a machine with **no `~/.gitconfig` at base**: a fresh machine, a CI runner, a stranger.
1. The developer runs `git config --global user.email …`, which **creates** the file.
2. By R49 (a path absent at base is never read) and R67 condition 1 (no base realpath), the file is **never read**. The
   developer stage reports it with R56's `lstat` facts:
   `absent → not read: base unresolved …; current … ino 326080 nlink 1`.
3. The QA role then appends to `~/.gitconfig` in place. The qa stage's entry is `not read: different file → not read:
   different file`. **No line is written, and `qaHashInRecord: false`.** Measured through `runLoop`:
   - **ABSENT-BASE-LOOP**, on Linux (`36067661629`) and on win32 (`qa96-a7-probe.test.ts`, 22:38Z). The plant
     assertions passed first: the same inode, and the size moved 37 → 70.
   - Red at A6 too (`36067670009`): **A6 is a known positive for the class, not a negative**.

**The same silence through two less ordinary triggers:**
- **TWO-NAME-LATER:** the path is replaced by a new file with a second name, which R67 does not read, and it is
  appended in place later. Linux and win32.
- **WRITEONLY-LATER:** mode `0200` in one stage, which makes the file unreadable but writable, then an append. Linux.

**Rows that fail on A7-1:**
- CA-4f ("never silent", rulings-14's table);
- CA-15 clause 4 as R65 extends it ("not read, with the reason and the R64 facts");
- CA-11 ("config outside the repository … role writes hashed and reported", which is not true for this write);
- the R54/R62/R64 row on the machine side.

**A7-2 (low): A6-4 and A6-5 persist in `compare()`'s "end read, start not read" branch.**
- `:1061–1062` writes `before = base.state === "read" ? base.hash : "absent"`. That is the **loop base**, not the
  stage's start. `:1084` and `:1098` do the same.
- **UNREAD-BASE** (QA 94's; A6-5): a path mode 000 at base, made readable and edited in the stage, is written
  **`before: "absent"`**. That is a file that existed.
- **STAGE-START-UNREAD** (A6-4): at qa's start the path is a two-name file (not read); qa removes the second name
  (read). `before` is **`cdebe5ed52395038`, the loop base's hash**, of a file that was not at the path when the stage
  began.
- Both on Linux; STAGE-START-UNREAD also on win32. R65: "'unreadable' is written when a read failed, never 'absent' …
  A stage whose start was not read shows its stage-start facts as 'before', never the loop base's hash."
- **Row:** CA-15 clause 4 ("with true texts").

**Lower** (§9):
- **A7-3:** R67's handle re-check does not re-check `nlink`. Seam HANDLE-NLINK reads a single-name file that gains a
  second name inside `open`.
- **A7-4:** the repository side's "not read" record prints `dev, ino, nlink` only. An in-place write it correctly calls
  a change is written with two identical sides.
- **A7-5:** QA 92's STOW-LOOP and three win32 probe counters count one finding per path, and R65 broke those counts.
  That is the probes' fault, not the candidate's (§3.2).

**The full suite is green:** exit 0, 1133 passed, 26 skipped, peers idle before and after (§5). As at A6, a green suite
is not the verdict: A7-1 and A7-2 are in behaviour the candidate's tests do not reach.

---

## 0. Rulings and authority in force

| Source | Where |
|---|---|
| Rulings-1 to 13 | master, as cited by the criteria and reports A3 to A6 |
| **Rulings-14 R64–R67** and its table of touched rows | master (`loop-15-slice-3-rulings-14.md`); **D-042** (R67, Aaron, "sounds right") |
| The dispatch | `loop-15-slice-3-dispatch-qa-a7.md` on master `d34f545`, pointed to by sia-planner-6b by A2A |
| **CI on this seat's own branches** | **D-040**, standing. Every run is named where it is used |
| **Pushing this seat's own `qa/*` branches** | **D-038**; each push read back with `ls-remote` (§13) |
| **The local window** | the planner's GO, 22:36Z (A2A): "0 of 41 listening sockets on any hub or QA port … every peer idle". The three A2A-Hub seats were STOPPED (**relayed, not measured by the planner or by me**). The planner ruled the cut (item 3 reduced), and ruled that the CI runners stay GitHub-hosted |
| **A7-1 scored under R64/R65** | the planner's reading, A2A 22:3xZ (quoted in the verdict) |

## 1. Frozen-candidate conditions

| Condition | Observation | Result |
|---|---|---|
| criteria before candidate | `6672e83` is an ancestor of `d223d1d` (exit 0). **Control:** `d18a196` exits 1 | held |
| built on A6 | `dc35b24` is an ancestor (exit 0) | held |
| A7's own diff | `dc35b24..d223d1d`: `configwatch.ts` (+/−62), `runtime.ts` (+1), `config-channel.test.ts` (±11), `configwatch-a7-seam.test.ts` (+118), `configwatch-links.test.ts` (+192/−), the handoff (+57). Nothing else | as the dispatch states |
| **tree moved** | `ls-remote` of the candidate branch = `d223d1d…` at 22:34:29Z. The QA tree's HEAD = `d223d1d…` at 23:43:35Z (checkout) and 23:46:23Z (after the suite); `gitnexus-index` and `build-freshness` both at `d223d1d` at 23:48Z | **not moved** |
| **tree dirty** | 0 porcelain entries before the checkout, after the build, after the suite, after `gitnexus analyze`, after `sync --check`, and after plain sync (which ran in a clone). Every probe and mutant ran from an archive copy in the scratchpad; every CI branch was built with a temporary index (`mkbranch.sh`) | **clean throughout** |
| build | `npm run build` exit 0 at 23:43:41Z, from `d223d1d` | current |
| **CA-13**, no version bump | `git diff dc35b24 d223d1d -- package.json open-brain/package.json CHANGELOG.md`: 0 lines | **pass** |

## 2. Rows

**"Cand. rows"** means the row files run unmutated on win32 in an A7 archive copy, 22:36:18Z → 22:38:26Z, with the
JSON reporter.
- The files: the six row files, the candidate's `configwatch-a7-seam.test.ts`, QA 94's `qa94-handle.test.ts` and this
  seat's `qa96-seam.test.ts`.
- **194 tests: 166 passed, 26 skipped, 2 failed, 0 unhandled.**
- **Both failures are this seat's probes**, and neither is a candidate test:
  - QA 94's NO-SEAM CONTROL, which D-042 flips (a file renamed over the path is now read);
  - HANDLE-NLINK (A7-3).
- The 26 skips are `skipIf(win32)`. Every POSIX row below is read **as passed** from CI's per-test output, never from a
  skip.

**Rulings-14's table, scored as it says:**

| Row | A7 must (rulings-14) | Observed | Verdict |
|---|---|---|---|
| **CA-4f** | the `git config` write reported with both hashes (R67); never silent | GITCONFIG-LOOP: developer `9f3ef5ba… → 8dc399fe…`, qa `8dc399fe… → c63c2e26…`, both hashed. STOW-LOOP's write is hashed in developer (§3.2). ca4fBase: each target once as a change, in developer, with both hashes. **But ABSENT-BASE-LOOP: the qa stage's in-place write is silent** (A7-1), on Linux and win32. R56's `lstat`-facts finding holds for the creation itself | **FAIL** (A7-1) |
| **CA-4a / CA-14** | EXISTBETWEEN and NEWBETWEEN `ok`; R57's in-place write reported | `probe-r62.mts` (win32): NEWBETWEEN, EXISTBETWEEN and EXISTBETWEEN2 `ok` at A7; EXISTBETWEEN fails at A6. R57's test passes (win32 and CI) and is killed by M-dev7-facts. CA-4a's rows pass. M-L2 kills the four CA-4a rows and M-L2-norestore kills 19. **A false "before" text persists (A7-2); it is scored in clause 4**, where rulings-14 puts it. A7-4 is recorded as low | **pass** on the table's must |
| **CA-15 clause 3** | pass as amended: H, J and LOOP unread; R read | QA 89's H, J and LOOP green at A7 (`36067661629`). **R is red at A7, and that is D-042's flip:** its assertion is the old "not read", and its line shows the new file read, `inRecord: true`. win32: 31 loop probes, **no victim hash and no token in any record**, and every victim, token and "in record" field identical to A6 (§3.1). Condition 1 and condition 2 each have their own mutant (§3.3) | **pass** (third cases returned, §11) |
| **CA-15 clause 4** | every path in every stage record, with true texts; the at-path type change tested | every path in every stage: **met** (R61-UNIT, R65-EVERY-LOOP). The type change at the path: tested (mut-type, with a note, §4). **Not met:** the R64 facts in the "not read" record (A7-1: `not read: different file`, with no facts at all); "never absent" and the stage-start "before" (A7-2) | **FAIL** (A7-1, A7-2) |
| **CA-15 (b), R29** | R29 via the seam; it can fail | the candidate's seam test `✓` at A7 on CI; **M-R29-both turns it red** (`36067678957`: `expected '…/home/.gitconfig' not to contain '…/home/.gitconfig'`). QA 89's R29 control is green again at A7 (red at A6): `unreadable` reaches the record | **pass** |
| **CA-11** | unqualified | "config outside the repository … role writes hashed and reported" is untrue for A7-1's later-stage write | **FAIL** (A7-1) |
| **R50** | killed at row level | M-dev7-r50 reddens R66 R50 (win32 1 red; CI `36058625414` re-read) and turns `baseHardEdit` from failed to **completed with the hook edited**. The historical M-R50 (the `preflight` form) survives, as the developer reported: R64's size comparison makes it equivalent (§4) | **pass** |
| **R54, R57, R62 (R64)** | the two baselines kept separate, each shown by its own mutant | **Repository side met:** M-dev7-drifted reddens R64 only; M-dev7-facts reddens R57; M-dev-identity7 reddens R62 and R64; M-R54-7 reddens CA-4f's row and R67's lock-and-rename. **Machine side not built** (A7-1) | **FAIL** (machine side, A7-1) |

**Every other row, re-run.** Each mutant here is from the cut set (§4).

| Row | Observed | Verdict |
|---|---|---|
| **CA-1** | Cand. rows pass. **M-L2 kills both CA-1 tests** | **pass** |
| **CA-2.1–2.6** | Cand. rows pass. **M-2.5-refuse-node** kills 2.1–2.5 and 2.6 (16 red). The real-`claude` 2.5 control and the CA-9 pin are **passed** locally (baseline) and skipped on CI | **pass** |
| **CA-3a–d, order** | Cand. rows pass; preflight is untouched by A7. M-2.5-refuse-node kills CA-3a/3b's row | **pass** |
| **CA-4b** | spawn-sites pass. **M-R16 kills 7.** The CA-4b-L1 pair (M-L2-order ± M-L1) was **not run** (the cut, §7) | **pass** (R16); the L1 pair carried from A6 |
| **CA-4c, CA-4e, CA-4g** | Cand. rows pass. **M-L0 kills CA-4c's own row and CA-4e.** probe2 H on A7 is identical to A6 (runtime 0 runs, control `global-home:`). M-L2 kills CA-4g's repo-local cell | **pass** |
| **CA-4d** | **M-L2-norestore kills the CA-4d row** | **pass** |
| **CA-4h** | Cand. rows pass. M-L2 kills 4 CA-4h rows. The M-L2 ± M-R18 pair was **not run** (§7) | **pass** on the rows; the pair carried from A6 |
| **CA-4i** | Cand. rows pass. M-backstop **not run** (§7) | **pass** on the rows |
| **CA-5** | Cand. rows pass on 2.54. CI prints the 2.55.0 row `✓` (`36060449503`). **M-L2 kills the 2.54 row** | **pass** |
| **CA-6** | Cand. rows pass. CI `36060449503`: both POSIX rows `✓` (normal exit, error exit). probe2 SINGLE and DFORK identical to A6 | **pass** |
| **CA-7** | Cand. rows pass. **M-2.5-refuse-node** turns all five CA-7 rows red | **pass** |
| **CA-8** | probe2 COMPOSE identical to A6. **M-L2 kills CA-8** | **pass** |
| **CA-9** | the pin passed here; the real run is candidate A's (**attributed**, as in reports A to A6) | observation; pin **pass** |
| **CA-10** | **M-CAS kills its row.** M-endstate **not run** (§7) | **pass** on (1); (2) carried from A6 |
| **CA-12** | §5, §6 | **pass** |
| **CA-13** | 0 lines | **pass** |
| **R35** | r35base proceeds with its base note; QA 89's Linux R35 `✓` at A7; r35edit and r35anchorEdit hashed in developer (win32) | **pass** |

## 3. Detail

### 3.1 The loop probes on win32: A7 against A6

QA 92's `probe15-a5.mts` (31 probes) ran against archive copies: A7 at 22:38:51Z → 22:40:08Z, A6 → 22:41:21Z. Each run
exited 0 with empty stderr.

**The instrument:** QA 94's `shape.mjs` compared everything, including machine findings.
- Every probe differs, because R65 now writes an entry for every path in every stage. That is a correct difference,
  and it masks everything else.
- So `shapev.mjs` (§13) drops the findings text and compares only **the machine findings that are changes** (`before
  !== after`), beside every verdict field.
- **Validated by the known difference it had to find:** A6's natural A6-2 in `a2`.

**9 of 31 differ, and none is a victim or token field:**
- **`a2`:** at A6 the developer stage lists `deleted:refs` with **2 unrestored**. That is A6-2 caught happening,
  `.git/info/refs` rewritten by an unidentified writer. At A7 it is absent, with 0 unrestored.
- **`machineNext`, `r35chainJ`, `r35chainH`, `r35anchor`:** the finding text now carries both resolutions and
  identities (R66).
- **`machineReplace`:** A7 reads the replacement file (`newFileHashesInRecord` `written: true, afterQa: true`); A6 does
  not. That is D-042's trade.
- **`ca4fBase`, `r35edit`, `r35anchorEdit`:** the probe's own counters (`…OnceInDeveloper…`) count entries per path,
  and R65's per-stage rows now give each path 3. The change itself is once, in developer, with both hashes (A7-5).

**probe2, `probe-r57.mts` and `probe-r59.mts`** (22:41–22:42Z): H, R34, SINGLE, DFORK, DMGconfig, DMGhead, DMGindex and
COMPOSE are **identical** on A7 and A6 after normalising paths and hashes. r57 NEWBETWEEN is `ok` on both; r59's three
cases say the same on both.

### 3.2 On CI's Linux: this seat's probe branches

**The probe files:**
- QA 89's (unchanged);
- QA 92's v3 (unchanged; blob `99c495bd`, equal to `docs/loops/qa-scripts-a6/`);
- QA 94's `qa94-a6-probe` and `qa94-handle` (unchanged);
- this seat's `qa96-a7-probe.test.ts` and `qa96-seam.test.ts`;
- a batch-2 file, `qa96-b2.test.ts`.

**The branches:**

| Branch | Base | Run | Result |
|---|---|---|---|
| `qa/loop-15-slice-3-a7-probe` | A7 | **`36067661629`** | 12 failed, 1188 passed, 6 skipped. **Every candidate test `✓`**; every failure is a probe (below) |
| `qa/loop-15-slice-3-a7-probe-on-a6` | A6 | **`36067670009`** | 19 failed |
| `qa/loop-15-slice-3-a7-probe2` | A7 | **`36069155320`** | 1 failed (REPO-FACTS), 1154 passed |
| `qa/…-a7-m-r29-both`, `-m-r67-realpath`, `-m-r67-nlink` | A7 + mutant | `36067678957`, `36067688254`, `36067696859` | §3.3 |

Per test, read from the logs with ANSI stripped (`cilog.sh`); `×` red, `✓` green:

| Test | A6 | **A7** | Printed at A7 |
|---|---|---|---|
| GITCONFIG-LOOP (QA 94) | × | **✓** | developer `9f3ef5ba → 8dc399fe`, qa `8dc399fe → c63c2e26`; `qaHashInRecord: true` |
| HARDLINK-SAME, R61-LOOP (QA 94) | × | **✓** | qa `877119e8 → 136a93cd`; R61-LOOP qa `5b878ae9 → 302a3e78` |
| R61-UNIT (QA 94) | × | **✓** | four paths: read hash; `unwatched: did not resolve; not read`; `unreadable`; `not read: not a file` |
| R65-EVERY-LOOP (mine) | × | **✓** | 3 paths × planner/developer/qa, each exactly once; no change line |
| TRADE-LOCKRENAME, TRADE-HARDLINK-ELSEWHERE (mine) | × | **✓** | both hashes / `3eebfd38 → 5f0c048e` |
| TRADE-NEW-TWO-NAME (mine) | ✓ | **✓** | `not read: base … nlink 1; current … ino 326052 nlink 2`; not hashed |
| QA 89 A4-1 H / J / LOOP | ✓ | **✓** | not read |
| **QA 89 A4-1 R** | ✓ | **×** (D-042) | `inRecord: true`: the new file is read, as D-042 intends. The assertion is the old ruling |
| QA 89 R29 row shape | × | **✓** | its control shows `unreadable` again |
| QA 92 STOW-CTL, STOW-H, XDGDIR-*, XDGFILE-CTL, DOWN-CTL, ABS2, ANCHOR-EDIT, VIADIR-EDIT | ✓ | **✓** | — |
| **QA 92 STOW-LOOP** | ✓ | **×** (probe) | `expected 3 to be 1`. The three entries are planner `d89a → d89a`, **developer `d89a → b653`**, qa `b653 → b653`: the write is reported once, with both hashes; R65 adds the two unchanged rows (A7-5) |
| **QA 94 TRADE-SAME** | ✓ | **×** (D-042) | a new mid-path link to the SAME file is **not read** at A7: `type change: …/git is a symlink target …/git-real; not read: base … ino 326051 …; current …/git-real/config … ino 326051`. D-041 allowed the read; R67's condition 1 (same realpath) forbids it. The fail-safe direction, reported with both identities |
| TRADE-DIFF, REPOINT, AT-PATH-SAME, REUSE (QA 94) | TRADE-DIFF × | **✓** | TRADE-DIFF names both resolutions and identities (A6-8 closed) |
| **UNREAD-BASE** (QA 94) | × | **×** | `before: "absent"` (A7-2) |
| **ABSENT-BASE-UNIT, ABSENT-BASE-LOOP, TWO-NAME-LATER, WRITEONLY-LATER** (mine) | × | **×** | qa entry `not read: different file` or `unreadable` on both sides; the in-place write silent (A7-1). Plants asserted: same ino, size moved |
| **R65-FACTS** (mine) | × | **×** | the qa record is `not read: different file` on both sides, with none of ino `326051`, size `35` or mtimeNs present (A7-1) |
| **STAGE-START-UNREAD** (mine) | × | **×** | qa `before: cdebe5ed52395038` = the loop base's hash (A7-2) |
| THIRD-MOVE-IN, THIRD-LINK-UNLINK, BASE-TWO-NAME (mine, observations) | — | ✓ | the moved-in outside file is **read** (§3.4); the base two-name file is read |
| QA 94 HANDLE-SWAP / SEAM-CONTROL | ✓ ✓ | **✓ ✓** | HANDLE-SWAP: `handle is a different file; not read` (the reason is now rendered) |
| **QA 94 NO-SEAM CONTROL** | ✓ | **×** (D-042) | a file renamed over the path before `compare()` is a single-name file at the same realpath: read, `d172da97 → 91a23ab2` |
| **HANDLE-NLINK** (mine) | × | **×** | read, `951430cc → 5c35b68a`, with the handle at `nlink 2` (A7-3) |
| HANDLE-NLINK-BASE, HANDLE-NLINK-CONTROL (mine) | × | **✓** | read |
| **REPO-FACTS** (batch 2) | — | **×** | the change is reported (`ok: false`), but as `identity:dev 2049 ino 326218 nlink 2; not read → identity:dev 2049 ino 326218 nlink 2; not read`; size moved 12 → 22 (A7-4) |
| **REFWATCH-REPEAT** (batch 2) | — | **✓** | 20 of 20 `stage-changed-ref` (§3.5) |

The A7 candidate's own tests are **`✓` in every A7 run** (`36060449503` re-read; `36067661629`; `36069155320`).

### 3.3 Dispatch 2(a) and 2(b): the mutants

- **(a) R29, M-R29-both** (`e7bb2ca`, `36067678957`). The edit removes the at-path type change **and** the
  different-file gate (`if (!same) return …`), so the open of a planted link is attempted. The candidate's
  `R66 R29: the runtime never opens the victim path` goes **red**: `expected '/tmp/a7-seam-…/home/.gitconfig' not to
  contain '/tmp/a7-seam-…/home/.gitconfig'`, which means the runtime opened the planted path. 32 red in all.
  **Either guard alone keeps R29 green:**
  - the developer's mut-type removes the at-path check (`36059922307`: R29 `✓`);
  - M-R67-realpath removes the realpath condition (`36067688254`: R29 `✓`).

  **R29 is protected twice.**
- **(b) R67's protective direction, M-R67-nlink** (`c989f64`, `36067696859`). `nlink === 1` is dropped, so any file at
  the same real path is read.
  - **Red:** QA 89's **A4-1 H** (`the outside file's hash is in the record`, `hv: true, hv2: true`) and **A4-1 LOOP**.
  - **Also red:** QA 92's STOW-H and XDGDIR-H, TRADE-NEW-TWO-NAME, and the developer's R43, R49 (hard link), R55 (hard
    link), R59 and R60 rows.
  - **On win32:** 3 red among the rows (R43, R49, R59), and the loop probes `machineHard` and `r35chainH` put the
    victim's hash in the record (`before: true, afterQa: true`).
- **Condition 1, M-R67-realpath** (`611aa38`, `36067688254`). The realpath comparison is removed from both halves of
  the gate. Red: TRADE-DIFF (QA 94's and the developer's), REPOINT, R44, R45, R49 (directory), R55 (directory), QA 89
  J and QA 92 ABS2.
- **One oddity:** under M-R67-nlink, `refwatch-stage` (ii) failed `stage-changed-config` instead of
  `stage-changed-ref`. That mutant cannot reach the repository watch. See §3.5.

### 3.4 Dispatch 2(c): D-042's trade, both ways, and third cases

- **A lock-and-rename is read:** TRADE-LOCKRENAME, GITCONFIG-LOOP and the developer's R67 test, with both hashes.
- **A hard link made elsewhere does not stop reads:** TRADE-HARDLINK-ELSEWHERE, HARDLINK-SAME, R61-LOOP and
  BASE-TWO-NAME (hard-linked at base).
- **A new two-name file is not read:** TRADE-NEW-TWO-NAME, QA 89's H, and QA 92's STOW-H and XDGDIR-H. M-R67-nlink
  turns them red.
- **Third case 1, an outside file MOVED in (THIRD-MOVE-IN, THIRD-LINK-UNLINK):** `rename(outside, ~/.gitconfig)`, or
  `link` then `unlink`, leaves the outside object at the path with one name.
  - **It is read and hashed, by D-042's letter.** The bytes are ones the role could equally have read and written in
    place, which is the trade's own premise.
  - The outside name is gone, by the role's act, so no canary survives outside to be "read".
  - Returned, not scored (§11.1).
- **Third case 2, the name count changing between the gate and the handle (A7-3):** see §9 and §11.2.
- **Third case 3, D-042 narrows D-041's trade (TRADE-SAME):**
  - A new mid-path link to the **same** file changes the realpath, so it is not read. That is the fail-safe direction,
    reported with both identities.
  - A4-1 R and NO-SEAM, by contrast, are read.
  - **I found no case where R67 reads a byte through a redirection.** Every redirect I tried either changes the
    realpath (TRADE-DIFF, REPOINT, J, TRADE-SAME) or leaves a second name (H, STOW-H, XDGDIR-H, TWO-NAME). Both are
    not read.

### 3.5 The refwatch oddity

In `36067696859` (M-R67-nlink), `refwatch-stage.test.ts` (ii) failed: `expected 'stage-changed-config' to be
'stage-changed-ref'`. That mutant changes only `MachineConfigWatch.observe`, and machine findings never fail a stage.
The same test is `✓` in every other run this session: four probe branches, the candidate head, batch 2 and the local
suite. Batch 2's REFWATCH-REPEAT ran the exact shape 20 times on A7 (`36069155320`): **20 of 20 `stage-changed-ref`**.
**One sighting, not reproduced, cause unknown.** The test prints no reason, so which repository file changed is not
known. It fits A5-4/A6-2's unidentified `.git/info` writer, whose A6 form (`a2`, §3.1) A7's R64 now absorbs when the
file is untouched in the stage. That is inference, not measurement (§7).

## 4. Mutants

**Local, win32.** Each mutant is a `git archive d223d1d open-brain` copy with a `node_modules` junction
(`build7.mjs`).
- Each edit is asserted to occur the expected number of times **against A7's blobs before archiving**, then asserted to
  land and read back.
- **Every counted mutant is `tsc --noEmit` exit 0.** The type-check control, a planted TS2322 in `runtime.ts`, exits 2.
- The rows are those in §2 (194 tests), read with the JSON reporter against the unmutated **BASELINE**. A "kill" is a
  test red under the mutant that is not red at BASELINE.
- Sequential, 22:43:14Z → 23:41:33Z, nothing of mine beside them. **No run printed an unhandled error.**

**Applicability.**
- QA 94's `mutants-a6.mjs` carries 55 specs. **41 apply to A7 as written.**
- 13 do not apply: 7 were already not applicable at A6, and **6 are broken by A7's own edits**. Those 6 get A7
  equivalents (`mutants-a7.mjs`): M-handle-narrow7, M-dev-handle7, M-dev-identity7, M-R54-7, M-follow-a7, and
  M-drifted-off, which is A7 itself and is replaced by the developer's mut-drifted.
- **The developer's eight, rebuilt locally from their diffs, are byte-identical to their branch blobs** (`devcmp7.mjs`:
  8 of 8 `true`), as are my three CI mutants.

**The cut (planner's ruling):** 26 were run: the configwatch mutants that bear on A7, plus one per untouched layer. The
specs not run are listed in §7.

| Mutant | Edit | Kills (win32) | CI (Linux) | What it shows |
|---|---|---|---|---|
| **M-handle-narrow7** (= dev mut-handle) | the handle's dev/ino comparison removed | **2**: the seam's handle test, QA 94 HANDLE-SWAP | `36058592630` re-read: 1 | the handle re-check (A6-6 met) |
| M-dev-handle7 | every handle rejected | 9 (every read row) + 2 healed (NO-SEAM, HANDLE-NLINK) | — | reads stop; not a test of the re-check |
| **M-dev-identity7** | an unread side is always a change | **2**: R62, R64 | — | R62/R64 (repository) |
| **M-R54-7** | read/read attribution against the loop base | **2**: CA-4f's row, R67 lock-and-rename | — | R54(2) |
| **M-dev7-drifted** | `drifted` back | **1**: R64 | `36058556896`: 1 | R64 (A6-2) |
| **M-dev7-facts** | size/mtime out of `changed()` | **1**: R57 (+2 environmental reds, **not counted**, §7) | `36058567322`: 1 | R64's facts (repository) |
| **M-dev7-record** | an unchanged read path not written | **1**: R65 | `36058578477`: 1 | R65's read state |
| **M-dev7-r50** | a byte change ignored when nlink > 1 | **1**: R66 R50; `baseHardEdit` completes | `36058625414`: 1 | R50 at row level (A6-9) |
| **M-dev7-r67** | A6's gate (nlink in identity) | **3**: R67 × 2, HANDLE-NLINK-CONTROL; `machineReplace` new-file hashes gone | `36058640092`: 4 | R67's allowing direction |
| mut-trade | TRADE-DIFF identities dropped | not run locally (POSIX test) | `36058651869`: 1 | A6-8 |
| mut-type | at-path check removed **and** `same` relaxed to `sameObject || …` **and** compare's `typeChange` false | not run locally (POSIX test) | `36059922307`: 1 | **three edits, not one.** The realpath gate alone keeps a link at the path unread, so the at-path check is **redundant for reads**; its own job is the record text. The developer's first two single-edit attempts stayed green for this reason (handoff) |
| **M-R29-both** (mine) | the at-path type change + the different-file gate | not run locally (POSIX) | `36067678957`: seam R29 red | dispatch 2(a) |
| **M-R67-realpath** (mine) | condition 1 removed | not run locally | `36067688254` | condition 1 |
| **M-R67-nlink** (mine) | `nlink === 1` dropped | **3** (R43, R49, R59); probes machineHard, r35chainH read the victim | `36067696859` | dispatch 2(b) |
| M-dev-object | the different-file gate removed | **7**; 6 probes put the victim's hash in the record | — | the object gate |
| M-R59-read6 / M-R46-basenotes6 / M-R57 | as at A6 | **1** each | — | as at A6 |
| M-dev-unwatched / M-dev-rest | as at A6 | 0 (their tests are POSIX) | A6's CI runs | as at A6 |
| **M-R50** (historical, `preflight` false) | — | **0** | — | equivalent at A7: R64 compares size, so the in-place edit is seen anyway (the developer's note, confirmed) |
| M-L2-norestore | restore removed | **19** (CA-4a × 4, CA-4h × 4, CA-4d, CA-15 (a)/(c) …, CA-6's timeout-restore row); probes: victims unchanged | — | as at A6 (19) |
| M-follow-a7 | follow links in the walk and restore | **6** ((a) × 3, R45, R46 × 2); probes: victims unchanged | — | as at A6 (6) |
| M-R43-repo / M-R49-repo | as at A6 | **1** / **2** | — | as at A6 |
| M-L0 | layer 0 off | **2** (CA-4c own row, CA-4e) | — | as at A6 |
| M-L2 | the window removed | **16** | — | as at A6 |
| M-R16 | a second spawn site | **7** | — | as at A6 |
| M-CAS | no compare-and-swap | **1** | — | as at A6 |
| M-2.5-refuse-node | the node shim refused | **16** | — | as at A6 |

**Every carried mutant that was run kills at A7 what it killed at A6.**

## 5. Full suite and CI (CA-12)

**QA full suite at the candidate: 23:43:41Z → 23:46:23Z, `SUITE_EXIT=0`, captured unpiped (`npx vitest run > file;
SUITE_EXIT=$?`), from `~/Worktrees/sia-qa/open-brain` at `d223d1d`.**
- `Test Files  76 passed (76)`, **`Tests  1133 passed | 26 skipped (1159)`**.
- 0 matches for `Unhandled|onTaskUpdate`; duration 159.12 s.
- The total, 1159, equals CI's on the head (`36060449503`: 1153 passed, 6 skipped).

**Peers (`ListAgents`, read by this seat):**

| When | sia-planner-6b | sia-infra-80 | a2a-planner-6c | a2a-rivet-63 | a2a-qa-5f |
|---|---|---|---|---|---|
| 22:36Z (window start) | busy | idle | idle | idle | idle |
| 23:41–23:42Z (after the mutants) | idle | **shell** | idle | idle | idle |
| just before the suite | busy | idle | idle | idle | idle |
| 23:46Z (after the suite) | idle | idle | idle | idle | idle |
| 23:49Z (window end) | idle | idle | idle | idle | idle |

- **sia-infra-80's `shell`:** I held the suite and asked. The planner's answer: "Forge doing remote setup over SSH on
  Aaron's other PC (D-045) … told it to pause". Relayed, not measured by me. It read idle before the suite.
- **The planner's `busy` reads** fell on its own GO turns; it stated it ran nothing during the window.
- **G-042 did not appear.** The worktree is recorded: `~/Worktrees/sia-qa`.

**CI on the candidate's exact head:** `36060449503` on `d223d1d`, success, re-read per test by this seat: 1153 passed,
6 skipped, git 2.55.0, hosted ubuntu-24.04. The developer's redcheck (`36053246665`: 9 failed, the nine the handoff
names) and eight mutant runs were re-read per test and match the dispatch's table (§4).

## 6. `/sync --check` (CA-12)

- **`gitnexus analyze`** in the QA tree:
  - The first run (23:46:48Z) **exit 1**: `FTS index 'file_fts' is inconsistent … missing during delete`. That is
    T-055's incremental failure.
  - The second run (23:47:34Z) **exit 0**: `meta.json` `lastCommit` = `d223d1d…`, `indexedAt` 23:48:11Z, read from the
    file. No clean between the two runs (G-043).
- **`sync --check` in the QA tree: exit 1**: `25 passed, 0 fixed, 2 warnings, 3 issues, 0 skipped`.
  - `gitnexus-index` passed ("index is at HEAD (indexed d223d1d …)"); `build-freshness` passed.
  - The issues are `prd-version`, `summary-version` (views at rev 84, v0.44.0) and `retirements` (ENTITIES.md names
    `dream` and `reflection queue`): the same three as reports A to A6.
  - **All three issues' inputs are byte-identical between `dc35b24` and `d223d1d`:** `git diff --quiet … -- .agents
    package.json open-brain/package.json CHANGELOG.md README.md` exits 0. **Control:** `open-brain/src/harness`
    differs, exit 1.
  - The warnings are `vault-index-parity` (one Checkpoints note) and `spec-provenance` (no `specs/`).
- **Plain `sync`, in a scratch clone** (`plainsync7.sh`): `git clone --no-hardlinks` of the QA repository, detached at
  `d223d1d`, with `npm ci` exit 0 and its own build exit 0.
  - `sync --check` there: **exit 1** (23 passed, 2 warnings, 3 issues, 2 skipped).
  - Plain `sync`: **exit 0**, "23 passed, **2 fixed**, 2 warnings, **1 issues**, 2 skipped". It rewrote five tracked
    `.agents` files in the clone.
  - **The QA tree was never written** (0 porcelain entries after).

## 7. What could not be verified, stated so nobody inherits it as settled

1. **The cut (planner's ruling), specs not run locally:**
   - M-L1; M-L2-order and M-L2-order+M-L1 (CA-4b-L1's pair);
   - M-R18 and M-L2+M-R18 (CA-4h's pair);
   - M-R15, M-backstop, M-endstate;
   - M-follow-b, M-follow-c;
   - M-R44, M-R45, M-R45-record, M-R45-mkdir, M-R46-root, M-R49-repo+M-R43-repo;
   - M-R50+agrees-v2; M-R51-refuse-cmd, M-2.5-accept-cmd;
   - M-R55-route, M-R59-revert, M-R59-never, M-dev-revert;
   - M-typechange6, and M-dev7-trade/M-dev7-type locally (both have CI runs).

   Their rows ran unmutated and pass; their last kills are A6's (report A6 §4). A7 touches `runtime.ts` in one line
   (skipping `before === after` findings) and `configwatch.ts`'s machine side, `changed()` and `readState`'s facts.
2. **The Claude Code binary changed during the window.**
   - `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe` was **absent** at about 22:55Z. Under
     M-dev7-facts, 22:54–22:56Z, the 2.5 real-`claude` control and the CA-9 pin failed with "claude.exe … does not
     exist".
   - A new `claude.exe` is stamped 23:24:51Z and the directory 23:35:39Z, with two `.old.*` copies beside it.
   - **The likeliest cause is Claude Code's own auto-updater** (the planner's reading). Not a seat action anyone knows
     of.
   - The two rows were re-run under the same mutant at 23:49Z: **both passed**. They are **not counted either way**.
   - No other run touched `claude`, except the baseline at 22:36–22:38Z, where both passed.
3. **The writer behind §3.5's refwatch oddity**, and A5-4/A6-2's `.git/info/refs` writer: neither identified.
4. **A7-1's WRITEONLY-LATER on win32** (mode `0200` is POSIX). **HARDLINK-SAME, UNREAD-BASE and the POSIX-only probe
   shapes** were measured on Linux CI only.
5. **M-R22** and the **CA-4h resolve-late** mutant: not constructed, as in reports A2 to A6.
6. **CA-9's real run** is carried from candidate A and attributed.
7. **The declared unrunnables U1–U6** (criteria §3).
8. **tcm:** no run in this report used it (§ header).

## 8. What the checks I ran cannot see

- **One win32 machine, and CI's Linux** (hosted, git 2.55) for the POSIX rows and seven branches. The cut set's
  mutants ran on win32 only, where POSIX tests skip. The CI mutants are this seat's three plus the developer's eight.
- **Stub roles, one act each.** The third cases were found by reading `observe()` and `compare()` for what their facts
  cannot tell apart. Shapes neither the reading nor the probes reached may exist.
- **Traceless reads.** A read whose result is discarded is visible only by the code path. The seam (`openSync`)
  catches opens by this implementation's call, not by any other API.
- **A7-1's severity rests on "ordinary".** A fresh machine with no `~/.gitconfig` is common. An in-place edit of
  `~/.gitconfig` is what a Node or Python write, or most agent file tools, do; `git config` itself uses
  lock-and-rename, which A7 does see (sameId's `ino` changes). I did not measure which tools a real role uses.

## 9. Defects, each with the observation that produced it

| # | Severity | Defect | Observation |
|---|---|---|---|
| **A7-1** | **high** (CA-4f; CA-15 clause 4 as R65 extends it; CA-11; R64 machine side) | R64 is not built on the machine side. `MachineSnap` has no size or mtime, and `sameId` compares (lexicalKind, resolvedPath, kind, dev, ino, nlink). An in-place write to an unread machine path is **silent** (the `before === after` entry is skipped). The "not read" record carries **no facts** (`not read: different file`, `unreadable`) | ABSENT-BASE-LOOP (Linux `36067661629`, win32), ABSENT-BASE-UNIT, TWO-NAME-LATER, WRITEONLY-LATER, R65-FACTS; red at A6 too (`36067670009`). Code: `configwatch.ts:863–879`, `:1051–1052`, `:1069–1077`; `runtime.ts:1064` |
| **A7-2** | low (CA-15 clause 4, R65's true texts) | A6-4 and A6-5 persist: when a stage's start was not read, `before` is the loop base's hash, or `"absent"` for a file unreadable at base | UNREAD-BASE `before: "absent"`; STAGE-START-UNREAD `before: cdebe5ed…` (the loop base). Code `:1061–1062`, `:1084`, `:1098` |
| **A7-3** | low (R67's handle clause) | the handle re-check compares dev/ino with the pre-open `stat` and never `nlink`. A single-name file that gains a second name between the gate and the open is read, where R67 says "the same two conditions are re-checked on the opened handle" | seam HANDLE-NLINK: `pre 1, post 2, read: true`; HANDLE-NLINK-BASE and -CONTROL read as they should. Code `:980`. The consequence is bounded by §3.4's move-in case: the object had no outside name at the gate |
| **A7-4** | low (R64's "both sets of facts", repository side) | `stateHash()` prints `dev, ino, nlink` for an unread side, so a size/mtime change R64 correctly calls a change is written with two identical sides | REPO-FACTS (`36069155320`): `identity:dev 2049 ino 326218 nlink 2; not read` both sides; size 12 → 22 |
| A7-5 | probe (not the candidate) | QA 92's STOW-LOOP and three probe15 counters count one finding per path; R65 makes it three | STOW-LOOP `expected 3 to be 1`, the write once in developer with both hashes |
| D-A2-7 | low (carried) | a `.git` junctioned at base to a non-repository is recorded `not-a-repo` | baseDotGitRepo, unchanged from A6 (§3.1) |
| D-A5 | carried | — | — |

## 10. Regressions: previously validated behaviour confirmed still working

- **Unmutated rows:** 166 passed on win32, and the two failures are this seat's probes. CI on the head (`36060449503`):
  1153 passed. This seat's full suite: 1133 passed, exit 0. They include G-045's rows, slice two's refusals and every
  candidate-A row.
- **The 31 win32 CA-15 probes:** victim, token and "in record" fields identical to A6. The 9 differences are R65/R66
  texts, A6-2's disappearance and D-042's `machineReplace` read (§3.1).
- **probe2** (H, R34, SINGLE, DFORK, DMGconfig, DMGhead, DMGindex, COMPOSE) and **r57/r59** identical to A6.
- **Every carried mutant that was run** kills at A7 what it killed at A6 (§4).
- **Regressions:** none found in behaviour A6 had right. TRADE-SAME (§3.4) is a deliberate narrowing by R67, not a
  regression.

## 11. Where the criteria, the rulings and the candidate disagree (returned, not scored)

1. **An outside file MOVED into the path is read (D-042 as written).** `rename(outside, ~/.gitconfig)`, or `link` then
   `unlink`, gives a single-name file at the same real path, and A7 hashes it. The trade's own premise covers it: the
   role could have read those bytes and written them in place. **Returned:** whether D-042 means to cover a move as
   well as a write. If it does, it may be worth a sentence, so the next QA does not re-find it.
2. **R67's "re-checked on the opened handle": which conditions can a handle carry?**
   - `nlink` can be re-checked with `fstat` (A7-3).
   - The **realpath** cannot be, portably: Linux has `/proc/self/fd`, and win32 has `GetFinalPathNameByHandle`. A7
     re-checks it by object identity with the pre-open `stat`.
   - **Returned:** whether condition 1 on the handle means "the same object the gate saw", which is A7's reading.
3. **A path absent at base, created by the role:** R49/R56 say it is never read (facts only), so CA-4f's "both hashes"
   (R67's rationale) cannot apply to it.
   - That is the case where A7-1 bites hardest: the file's first write is facts only, and its later in-place writes
     are silent.
   - With R64 on the machine side, the later writes would be reported "not read" with changed facts. They would never
     carry hashes.
   - **Returned:** whether a file the role created from nothing may be read once it exists, since no outside bytes
     were ever there. R49 said no before D-041/D-042 existed. Not scored; R56 is followed as written.
4. **mut-type needs three edits to go red** (§4). The at-path type change is redundant for READS behind the realpath
   condition. It is load-bearing only for the record's wording. That is fine by R66's letter. Recorded so "the type
   change is tested" is not read as "the type change protects a read".

## 12. This seat's error entries and near-misses this session

**Error entries (escaped):** none known. The interim A2A message to the planner (22:3xZ) gave the direction REJECT,
with A7-1 and A7-2 as they stand here. Its "R29 protected twice" and "(b) done" are confirmed by §3.3. It is superseded
by this report.

**Near-misses (caught in-process, not numbered):**
- **`mkbranch.sh` with relative source paths** failed five times ("could not open … for reading"). The script runs
  `git -C <repo> hash-object`, which resolves paths against the repository. It failed closed and was caught before any
  push; fixed with absolute paths.
- **The blob check in `win1.sh`** printed empty hashes: the same relative-path class, inside `git -C`. It was re-run by
  hand before any result was used (`e2334c4f`, `d94c1b65`).
- **`shape.mjs` answered a different question:** every probe differed at A7 against A6, because R65 adds rows. A
  comparator that reports 31 of 31 "different" is as blind as one that reports 31 of 31 "equal" (QA 94's near-miss).
  `shapev.mjs` compares changes only, and was checked on the known difference (`a2`).
- **My first mutant tabulation of M-dev7-facts** would have counted the two `claude.exe` reds as kills. The failure
  message named a missing file, and the re-run confirmed it (§7).

## 13. Reproduction

The scripts are tracked at **`docs/loops/qa-scripts-a7/`** on this branch, byte-identical to the copies that ran, with
a README. QA 94's and QA 92's sets (`qa-scripts-a6/`, `qa-scripts-a5/`) are reused where the README says.

| Branch (pushed under D-038, read back) | Head | What |
|---|---|---|
| `qa/loop-15-slice-3-a7-probe` | `cbaf74b` | A7 + QA 89 + QA 92 v3 + QA 94 × 2 + `qa96-a7-probe` + `qa96-seam` |
| `qa/loop-15-slice-3-a7-probe-on-a6` | `a8cd1ec` | the same files on A6 |
| `qa/loop-15-slice-3-a7-probe2` | `a87dfb9` | A7 + `qa96-b2` |
| `qa/loop-15-slice-3-a7-m-r29-both` | `e7bb2ca` | probe set + M-R29-both |
| `qa/loop-15-slice-3-a7-m-r67-realpath` | `611aa38` | probe set + M-R67-realpath |
| `qa/loop-15-slice-3-a7-m-r67-nlink` | `c989f64` | probe set + M-R67-nlink |

**A7-1 in four lines (`runLoop`, Linux or win32):**
1. `HOME` holds no `.gitconfig`.
2. The developer runs `git config --global user.email x`.
3. The qa role appends to `~/.gitconfig`.
4. The qa stage's record for the path is `not read: different file → not read: different file`, and no line is written.

## 14. Handoff to the next QA session (D-035)

1. **Known positives.**
   - **A7-1:** A7 `d223d1d` **and** A6 `dc35b24` by ABSENT-BASE-LOOP, TWO-NAME-LATER, R65-FACTS and WRITEONLY-LATER.
     They are positives for the class; there is no known negative yet.
   - **A7-2:** A7 and A6 by UNREAD-BASE and STAGE-START-UNREAD.
   - **A6-1 and A6-2:** A6 remains the positive.
2. **Several probe assertions are obsolete, and their reds are the probes'.** Under D-042 and R65, QA 89's A4-1 R,
   QA 94's TRADE-SAME and NO-SEAM, and QA 92's STOW-LOOP go red at A7 by their own old assertions. Update them before
   reuse, or read their printed lines, not their `×`.
3. **Compare changes, not rows:** R65 writes every path in every stage. Use `shapev.mjs` and `changes()` (before !==
   after), and validate on a known difference first.
4. **Keep the seams** (`qa94-handle`, `qa96-seam`, the candidate's own) for any candidate with a handle check.
5. **Plain `sync` only in a scratch clone. Run nothing beside a mutant's rows.** Watch for the Claude Code auto-updater
   inside a window (§7.2).
6. **Nothing is pushed except this seat's own branches (D-038); the merge is Aaron's.**
