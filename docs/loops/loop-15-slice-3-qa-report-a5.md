# Loop 15 slice three — QA report A5: candidate A5 `4c1287f`: REJECTED

**By:** Probe (QA seat), record session **92** (T-164: the dispatch assigned it; the greeting's per-worktree
counter said 11 and is not used) · **Date:** 2026-09-24 (UTC).
**Model and effort, from this session's host transcript**
(`~/.claude/projects/C--Users-melve-Worktrees-sia-qa/0a0b5075-ad5c-443e-9891-39b25fa14528.jsonl`, parsed as JSON):
every assistant entry carries `"model":"claude-opus-5-5"`. **Effort is mixed, and here is where each part lies:**
- **`medium`: the first 60 entries, 03:18:44Z → 03:22:58Z.** These covered `/start`, reading the dispatch, the
  criteria, rulings-9 to -12 and report A4, the freeze and the build, and the first read of `configwatch.ts`.
- **`high`: every entry from 03:23:01Z on** (389 of 449 assistant entries at 05:23:24Z). That covers every measurement, probe, mutant, CI
  run and the verdict.

**Criteria:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` at **`6672e83`** (FINAL). That file is not on master; I read
it at that SHA in full, and it is an ancestor of the candidate. It is read with **rulings-9 to rulings-12** on master
(`1657944`), as the dispatch says: R55 sharpens R49's definition, R56 is QA's CA-4f reading, R57 gates the repository
`begin` read, R58 requires tests that can fail, and R59 derives record words from what happened. **Rulings-12's
table of touched rows is scored as that table says** (§2).
**Candidate (frozen):** **`4c1287f4e4b3420909428ba8ce007e03b0daafc5`** on `origin/loop/15-slice-3-candidate-a5`.
It is seven commits on A4 `f9a1aa8`:

| Commit | Carries (read from each commit's file list) |
|---|---|
| `70ec18c` | R55 (`routeChain`), R57 (`captureBase` and the gated `begin`), R59 (both texts, first form), and the R55/R57/R58/R59 tests |
| `c1a8ca3` | handoff only |
| `63a7932` | `snap`'s `reached` compares `realpath` (the in-place-edit fix); drops one redundant `captureBase()` call from the R57 test |
| `5b3a0d1`, `63482c3` | handoff only |
| `845dfaa` | **code and test**: R59's read half re-done (`finding.after = end.hash` replaces stripping the "not read" text) plus its test. The dispatch's table lists this commit as "its own test" only |
| `4c1287f` | handoff only |

Built by Grok 4.7 in Cursor, developer record session 91 (T-177). Handoff:
`docs/loops/loop-15-slice-3-a5-developer-handoff.md` at `4c1287f`, read in full. The accepted deviation (four items in
one commit) is scored as the dispatch says: **each item by its own mutant** (§4).
**Transition controls:** A4 `f9a1aa8` and A3 `5010199`. Each is a `git archive` copy in this seat's scratchpad with a
`node_modules` junction, and **A5 was probed from an archive copy too**. Each copy's `configwatch.ts` was blob-compared
to its SHA: equal for all three; the control (A5 against A4) differs.
**Scored in:** `~/Worktrees/sia-qa`, detached at the frozen SHA from 03:20:22Z. Environment: git `2.54.0.windows.1`,
Node v22.23.2, win32. **Linux:** CI (git 2.55.0), eight runs this seat dispatched on its own `qa/*` branches under
D-040 (§3.2, §5).
**Context read in full:** the dispatch (`loop-15-slice-3-dispatch-qa-a5.md`), rulings-9/10/11/12, the A5 brief, report
A4, the `qa-scripts-a4` README, the criteria at `6672e83`, the A5 handoff, `configwatch.ts` at A5 (all 1133 lines),
A5's source and test diff against `f9a1aa8`, QA 89's probe file, and the six CI runs the developer named.

---

## Verdict: REJECTED. A4-1 is closed; A5-1 is a regression in which machine config is silently not watched

**What A5 fixed, measured:**

| Item | Defect at A4 | At A5 | Evidence |
|---|---|---|---|
| **R55** (A4-1) | a final-position base link's swapped target was read (H, J, R, LOOP) | **closed** | QA 89's probe file on Linux: H, J, R and LOOP are red at A4 in two runs (`35951505065`, `35952430721`), reproducing report A4's hashes `4022c513a10d45d8` and `f119e2e0e8f2b0c8`. They are **green at A5** in two runs (`35951503043`, `35952428545`). The CONTROL is green at both. **M-R55-route** (a final link not followed) turns the candidate's R55 H/J/R **and** QA 89's four shapes red (`35952432885`), which is rulings-12's one-mutant clause. **M-R55-realpath** turns both CONTROLs red (`35952435096`) |
| **R57** | `begin` read every repository file ungated at each stage | **met** | the unit test is red at A4 in the redcheck (`35949006640`, on its own hash assertion) and green at A5; **M-R57** kills it (§4) |
| **R59** "not read" (A4-3) | attribution wrote "not read" after a read | **closed** | r54Revert's qa-stage record: at A4, "identity change … not read" after the file **was** read; at A5, the base hash `93e46ce8d0363b87` it read (§3.1). **M-R59-read** kills its test |
| **R59** "reverted" | printed whatever the list held | **met in both directions** | this seat's `probe-r59` (§3.5): the sentence is present **iff** a revert ran (SNEAKY, BOTH) and absent on a config-only refusal (CFGONLY). A4 is the known positive (it prints the sentence on CFGONLY). **M-R59-revert** restores A4's behaviour. **M-R59-never survives every candidate test** (A5-5): only this seat's probe sees the positive direction |
| **R58** | three of R52's tests could not fail (A4-2) | **met for (b)3, R29 and R35; partial for (b)4** | (b)3 now plants a hook entry, asserts `755` ≠ `644`, the plant, and both controls; red under the developer's `23269d3` (`35949009974`). R29 plants a link to a `000` victim; red on its own `not.toContain("unreadable")` under the developer's gate mutant (`35949011700`) and under this seat's injection-free gate revert (`35952437161`). R35 asserts type and target; red under `4e3a850` (`35949013391`). **(b)4 is unchanged from A4** (A5-2) |

**A4's guards all hold at A5.** All 31 win32 probes (report A4's 29 plus two of this seat's) are identical at A5 and A4
by verdict fields, except the one in A5-1 below. A3 is red where report A4 said it would be. All 33 carried
mutants rebuild at A5 with unchanged counts, and each kills what it killed at A4 (§4).

**Why it is rejected: A5-1, measured on both platforms, with A4 as the known negative.** R55 says the runtime reads a
watched path only if "the object that opening the path would reach" is the base object by the base route. It also
says what stays allowed: "Editing it **in place** keeps both, so it is still read and hashed", and on any difference,
"report it, naming the first entry that differs". CA-4f requires every write to a machine-config path to be reported
with the path and both hashes. A5's route walk (`routeChain`, `configwatch.ts:257–284`) can end at an entry that is
**not the object**. When it does, `snap` (`:974`) finds `reached` false and records the hash as `"unread"` **at base**.
From then on:
- no in-place edit is hashed;
- no swap of the object is reported;
- and nothing in the record says the path was never looked at.

The loop completes green on a role's write to `~/.gitconfig`. There are two mechanisms, each read from the code and
then measured:

| Mechanism | Shape it covers | What the code does |
|---|---|---|
| **(a)** a **relative** link target that climbs out of its own directory | GNU stow's links (`$XDG_CONFIG_HOME/git/config → ../../dotfiles/git/config`), `~/.gitconfig → ../dot/gitconfig`, a relative directory link `$XDG/git → ../dotgit` | `linkTargetAnchor` anchors a relative target at the link's directory; `lexicalPaths` returns **no segments** when `relative(anchor, dest)` starts with `..`; the route stops at the link's directory |
| **(b)** a link with **two or more components after it** | `$XDG_CONFIG_HOME` itself a link (or `~/.config` with the XDG default), an absolute target through a symlinked directory | `rest = paths.slice(i + 1).map((p) => relative(paths[i], p))` is **cumulative** (`["git", "git/config"]`) and all of it is joined, so the route walks `<dest>/git/git/config`. Printed from A5's own `recordChain`: the route ends at **`absent …/real-xdg/git/git`** on win32 and Linux alike (§3.4) |

| Shape (Linux: A5 `35952428545`, A4 `35952430721`; the same probe file) | A4 | A5 |
|---|---|---|
| STOW-CTL: `~/.gitconfig → ../dot/gitconfig`, target edited in place | hashed | **not hashed** (`found: []`) |
| XDGFILE-CTL: stow's nested file, edited in place | hashed | **not hashed** |
| XDGDIR-CTL: `$XDG/git → ../dotgit`, `config` edited in place | hashed | **not hashed** |
| ANCHOR-EDIT: `$XDG_CONFIG_HOME` a symlink (absolute), edited in place | hashed | **not hashed**; route ends `absent …/anc-real-xdg/git/git` |
| VIADIR-EDIT: `~/.gitconfig →` an absolute target through a symlinked dir | hashed | **not hashed**; route ends `absent …/via-real/sub/sub` |
| **STOW-LOOP**: CA-4f's own shape through `runLoop`; the developer appends through a stow `~/.gitconfig` | reported once, in `developer`, both hashes | **the loop completes with no finding for that path**; the append is on disk |
| XDGDIR-H: a hard link swapped in beyond `$XDG/git → ../dotgit` | "identity change … not read" | **silent**: no finding in any stage |
| STOW-H: the stow target swapped for a hard link to an outside file | **read** (A4-1's class) | not read, and **silent** |
| **Controls:** DOWN-CTL (a relative target below its directory), ABS2 (an absolute link to a link) | hashed / read (A4-1) | **hashed / not read and reported** |
| **win32 (no privilege):** r35anchorEdit, `$XDG_CONFIG_HOME` a junction, `git/config` appended in place, through `runLoop` | reported once, both hashes (A4 **and** A3) | **no finding** |

**Clause 3's read half holds**: in none of these shapes are outside bytes read, because `reached` compares `realpath`.
What fails is the other direction the dispatch named: "whether any allowed read (the same object by the same route)
is now suppressed". It is, and the report goes with it. **The base note still says "read through that target, not
refused"** for a path the runtime never reads (A5-3, R59's class).
**Severity: high.** The pass is silent, it is a regression from A4, and it covers ordinary dotfiles layouts, stow and
a symlinked `~/.config`. No write or outside read is involved, which is why this is not scored a blocker.
**Rows that fail on it:** CA-4f; CA-11 (rulings-12 requires it **unqualified**); CA-14 as R59 extends it (A5-3). R55's
letter ("still read and hashed", "report it") fails for these shapes (§2).

**A second defect, A5-4 (medium): R57's gate reports an unchanged file as changed.** A watched repository file that
is **absent at the loop's base** and exists when a stage opens gets an unread snapshot on both sides of the stage.
`changed()` (`:424`) returns true whenever either side is unread. So a file nothing touched during the stage is
reported `modified`, with **identical** identity facts before and after. The stage fails, and the record adds "2
FILE(S) COULD NOT BE PUT BACK … Recover by hand before rerunning" for a file that needed nothing.
- **Deterministic probe** (`probe-r57.mts`): A5 fails it; A4 reports `ok`. The control, the file created **during**
  the stage, is reported at both.
- **Observed once without a probe:** in the candidate's own CA-5 R19 test (a clean stub loop on a fresh clone),
  `.git/info/refs` appeared between the loop's base and the developer stage, from a writer this seat did not identify.
  It did not reproduce in 10 runs alone at A5 or at A4.

R54(2) says a change is measured by `lstat` identity facts where the gate forbids reading, and these facts are
unchanged. Rulings-12 says R57 is reachable only through U3; this occurrence was not a role. **Rows:** R54, and CA-14's
standard for the false "could not be put back".

**Two low findings:**
- **A5-5:** no candidate test asserts R59's positive direction. M-R59-never survives.
- **A5-2:** R58's letter is unmet for (b)4.

Every other row passes (§2), including the full suite: exit 0, 1124 passed, 16 skipped, with the peers idle (§5).

---

## 0. Rulings and authority in force

| Source | Where |
|---|---|
| Rulings-1 to 11 | master (as cited by the criteria and reports A3 and A4) |
| **Rulings-12 R55–R59** and its table of touched rows | master (`loop-15-slice-3-rulings-12.md`) |
| The dispatch | `docs/loops/loop-15-slice-3-dispatch-qa-a5.md` on master (`1657944`), pointed to by the live planner (sia-planner-6b, record session 90) by A2A at session start |
| **CI on this seat's own branches** | **D-040** (record rev 106), standing; relayed in the dispatch. Eight runs, each named in §3.2 and §5 |
| **Pushing this seat's own `qa/*` branches** | **D-038**; each push read back with `ls-remote` |
| Full-suite GO | planner, A2A, 05:16Z, after this seat's own measurements (§5) and its own: 0 of 41 sockets on 3210/4000/5173; Relay told FULL STOP and confirming it by message; the 3d-printers session closed |

## 1. Frozen-candidate conditions

| Condition | Observation | Result |
|---|---|---|
| criteria before candidate | `6672e83` is an ancestor of `4c1287f` (exit 0). **Control:** `d18a196` exits 1 | held |
| built on the release line | `f9a1aa8` (A4), `5010199` (A3), `2add792` (A2) and `3b19287` (A) are ancestors, exit 0 each | held |
| A5's own diff | `f9a1aa8..4c1287f`: `configwatch.ts` (+150/−87), `runtime.ts` (+3/−1), `configwatch-links.test.ts` (+215), `config-channel.test.ts` (+10), the handoff (+67). Nothing else | as stated in the handoff |
| the redcheck is the candidate's tests | `git diff 8bd34aa 4c1287f -- open-brain/tests` is empty; `8bd34aa` is `f9a1aa8` plus tests only | held |
| **tree moved** | HEAD = `4c1287f…` at 03:20:22Z and at every later read, through the suite (05:19:20Z) | **not moved** |
| **tree dirty** | 0 porcelain entries after the checkout, the build, the row files, `gitnexus analyze`, `sync --check` and the suite. Every probe branch was built with a temporary index (`mkbranch.sh`) and never touched this tree. **Plain `sync` ran only in a scratch clone** (§6) | **clean throughout** |
| build | `npm run build` exit 0, stamped `4c1287f` at 03:20:41Z | current |
| **CA-13**, no version bump | `git diff f9a1aa8 4c1287f -- package.json open-brain/package.json CHANGELOG.md`: 0 lines | **pass** |

## 2. Rows

"Cand. tests" means the six row files (config-channel, configwatch-links, process-role, spawn-sites, refwatch-stage,
runtime), run here from 03:36:50Z to 03:38:59Z with the JSON reporter: **exit 0; 169 tests, 153 passed, 16 skipped, 0
failed.** The 16 skips are all `skipIf(win32)`: CA-6's two POSIX rows, CA-15 (b)1, (b)2 and (b)6, the Linux R35 row, A4's
four R52 tests, and **A5's six POSIX tests** (R55 × 4, R58 × 2). The real-`claude` 2.5 control and the CA-9 pin **ran and
passed** here, read per test. "Probe" means this seat's scripts (§13); mutants are in §4.

**Rulings-12's table, scored as it says:**

| Row | A5 must (rulings-12) | Observed | Verdict |
|---|---|---|---|
| **CA-15 clause 3** | pass, with A4 the known positive for A4-1 | A4-1 green at A5, red at A4 (§3.2). No outside bytes read in any win32 or Linux probe, A5-1's shapes included. `begin` gated (R57) | **pass** |
| **CA-15 clause 4** | pass, and show each text's mutant | "not read" is written only on the gate path, and "reverted" only after a revert. Mutants: M-R59-read, M-R59-revert (§4) | **pass** (see CA-14 for A5-3) |
| **CA-15 (b) and R29** | pass, with discriminating tests | (b)3, R29, R35 discriminating by named code mutants, read from CI. (b)4 discriminating by the gate mutants, but R58's plant, in-test-control and named-mutant bullets are unmet for it (A5-2) | **pass on behaviour and discrimination; A5-2 recorded** |
| **CA-15 clause 5** | pass | base: `LoopRefused link-at-base`, no tags, HEAD unmoved, no `artifacts/`; R35 proceeds; unchanged | **pass** |
| **CA-4f** | pass, as R56 reads it; a base target edited in place is still hashed | ca4fBase: three paths, one finding each in `developer`, both hashes 16-hex, nothing restored. r35edit (a junction at `$XDG/git`, edited in place): reported with both hashes. **But STOW-LOOP (Linux) and r35anchorEdit (win32): a role's append through a base link is not reported at all** (A5-1) | **FAIL** (A5-1) |
| **CA-4a** | pass | Cand. tests pass. probe2 DMGconfig: `stage-changed-config`, `FAILED.md`, HEAD resolves. **M-L2 kills** the four CA-4a rows; **M-L2-order kills** the garbage-config row. But the table's "detection … unchanged" is contradicted by A5-4 (an unchanged file detected) | **pass** on its probes and mutants; A5-4 recorded under R54 |
| **CA-11** | pass, **unqualified** | the channel table's "config outside the repository … hashed and reported, not restored" is untrue for A5-1's shapes | **FAIL as rulings-12 states the row** (qualified by A5-1) |
| **CA-14** | pass; no record carries a claim the runtime did not perform | probe2 DMGhead and DMGindex: `runtime-git-failed` and `FAILED.md`, each naming the failing call and saying "This is a RECORD, not a repair". **M-backstop kills both.** But two records carry a claim the runtime did not perform: **the R46 base note reads "read through that target, not refused" for A5-1's links, which are never read (A5-3)**, and **A5-4's "COULD NOT BE PUT BACK … Recover by hand" names a file nothing changed** | **FAIL** (A5-3, low; A5-4) |
| **R35** | pass, and still proceeds | proceeds on both platforms, with the note's type and target (Linux: the candidate's test and QA 89's R35; win32: r35base). "Its target is now on the route" is **not** true for A5-1's shapes | **pass** (the must); A5-1 noted |
| **R50** | pass | baseHard, baseHardCfg complete at A5, `nlink` 2 before and after; fail at `planner` at A3 | **pass** |
| **R54** | pass: the gate at the loop's base, attribution at the stage's start | the gate side holds. For attribution: CA-4f's row and r54Twice/r54Revert/plannerPlant give one finding per change, in its own stage, and **M-R54 kills** CA-4f's row (ca4fBase: each path twice). **But for the repository side, a file that differs from the loop base at a stage's start is attributed as changed in that stage with its identity facts unchanged (A5-4)**: probe-r57 NEWBETWEEN fails at A5 and is `ok` at A4 | **FAIL** (A5-4) |

**Every other row, re-run:**

| Row | Observed | Verdict |
|---|---|---|
| **CA-1** | Cand. tests pass. **M-L2 kills both CA-1 tests.** Unchanged by A5 | **pass** |
| **CA-2.1–2.4, 2.6** | Cand. tests pass. **M-R15 kills 2.6** | **pass** |
| **CA-2.5** | Cand. tests pass locally: the planted `.cmd` control, its twin and the real-`claude` control all run. CI `35952457646`: the planted control `✓`, the real-`claude` control `↓`. **M-R51-refuse-cmd** (5 red, incl. the planted control), **M-2.5-refuse-node** (16) and **M-2.5-accept-cmd** (2) each kill it | **pass** |
| **CA-3a–d, order** | Cand. tests pass; preflight unchanged by A5 | **pass** |
| **CA-4b, CA-4b-L1** | spawn-sites pass. **M-R16 kills 7.** Layer 1's job is shown: under M-L2-order the fsmonitor row is **green**; under **M-L2-order+M-L1** it is **red** | **pass** |
| **CA-4c, CA-4e, CA-4g** | Cand. tests pass. **M-L0 turns CA-4c's own row red, and CA-4e.** probe2 H: the runtime ran the filter 0 times, and the control's `git add` ran it; under M-L0, 4 times. **R34:** the generated file carries `autocrlf = "input"`, and `git config --system` reads `true`. CI prints the rows `✓` on 2.55.0. CA-4g's repo-local cell: **M-L2 kills it** | **pass** |
| **CA-4d** | Scope in `watchedLocations`, unchanged; the walk is `lstat`-based. **M-L2-norestore kills the CA-4d row** | **pass** |
| **CA-4h** | Cand. tests pass. **R18 is met by the pair:** M-R18 alone survives; under M-L2 the R18 row fails "expected undefined to be 'stage-changed-config'"; under **M-L2+M-R18** it fails "expected 'runtime-git-failed' …". The resolve-late mutant was not constructed | **pass** (by the pair) |
| **CA-4i** | Cand. tests pass. **M-backstop kills both CA-4i rows** | **pass** |
| **CA-5** | Cand. tests pass on 2.54; CI prints `✓ … on this git (git version 2.55.0)` (`35952457646`). **M-L2 kills the 2.54 row.** Per-stage snapshots remain **untested by this runtime**. **One occurrence of A5-4 in its R19 row** (during the M-R59-revert run, not reproduced alone) | **pass**, with A5-4 recorded |
| **CA-6** | Cand. tests pass; the POSIX normal and error rows are `✓` on CI `35952457646`. **D-A3, verbatim, from probe2 at A5 (05:11–05:12Z):** SINGLE: "developer exceeded its bound after 3132ms. The kill that ran: taskkill /PID 10384 /T /F exited 0. That is the kill's own result, not a census of descendants. A double-forked process can survive it (named limit; the double-fork is not closed)." DFORK: the same four sentences with 4111ms and PID 18316, then the `post-commit` record. The double-forked heartbeat (PID 4860) **grew 20 → 26 bytes** after the loop with its PID alive; the probe then killed it. The text claims no more than the kill did. M-R22 not run (POSIX) | **pass** |
| **CA-7** | Cand. tests pass (5 rows). **M-2.5-refuse-node** turns all five red | **pass** |
| **CA-8** | Cand. test passes. **probe2 COMPOSE:** one record naming `post-commit` created **and** `refs/heads/main was DELETED during this stage (it pointed at c24947c19dc8)`; `FAILED.md`; HEAD resolves; `main` = `c24947c1…`, the value the record names; the hook removed; the marker empty. **M-L2, M-L2-order and M-endstate each kill it** | **pass** |
| **CA-9** | The pin test **ran and passed here**; on CI it is `↓`. The real run is candidate A's and was not repeated (**attributed**, as in reports A to A4) | observation; pin **pass** |
| **CA-10** | Cand. tests pass. **M-CAS kills** the refuse-and-report row; **M-endstate kills** D4 and D2 | **pass** |
| **CA-12** | §5 and §6: suite **exit 0**, 1124 passed, 16 skipped, peers idle before and after. CI on the head: **success** (`35952457646`). `sync --check`: exit 1 on the same 3 issues, 0 skipped, index and build at HEAD | **pass** |
| **CA-13** | 0 lines | **pass** |
| **CA-15** | §3 | clauses 1, 2, 3, 4, 5: **pass**; the report half is A5-1, scored under CA-4f and CA-11 |

## 3. CA-15 and R55 in detail

### 3.1 The loop probes on win32, three trees

**Method.** `probe15-a5.mts` is report A4's `probe15-a4.mts` byte-for-byte plus two shapes of this seat's, **r35edit**
and **r35anchorEdit** (R55's allowed read through a base junction, CA-4f's shape). Each run sets `HOME`,
`USERPROFILE`, `XDG_CONFIG_HOME` and `GIT_CONFIG_SYSTEM` to scratch paths, asserts the plant inside the role, lists
every victim by `lstat`/`readdir` before and after, and searches a unique token everywhere the runtime writes. A5 ran
03:27:47Z → 03:29:05Z, A4 → 03:30:19Z and A3 → 03:31:44Z; each exited 0 with empty stderr.

**Every one of report A4's 29 probes gives the same verdict fields at A5 as at A4**:
- base refused;
- (a)1 to (a)6 fail `stage-changed-config` with `FAILED.md`, the victims unchanged and the token nowhere;
- the machine probes' victim hashes are in no record;
- baseHard and baseHardCfg complete;
- baseHardEdit leaves the outside file at base plus the role's edit;
- r54Twice and r54Revert give one finding per stage;
- ca4fBase gives one finding per path, in `developer`, with both hashes.

**A3 is red** on machineHardAbsent, r35chainJ, r35chainH, r35anchor (hashes recorded), newHook (hash recorded),
baseHard and baseHardCfg (fail at `planner`, with the exception text), as report A4 found.

| Probe (this seat's) | A5 | A4 | A3 |
|---|---|---|---|
| **r35edit**: `$XDG/git` a junction at base; the developer appends to `$XDG/git/config` | one finding, `developer`, `ce144ddf2ce15745 → 7b779eb938890627` | the same shape | the same shape |
| **r35anchorEdit**: `$XDG_CONFIG_HOME` itself a junction at base; the same append | **no finding** (`byStage: []`); the append is on disk | one finding, `550e79212675ebc3 → 6cd44ed6629a006e` | one finding |

**R59 read half (A4-3), from r54Revert's record:** the qa stage puts the original `~/.gitconfig` back.
- **A4:** `unread → identity change: dev … ino 16888498605627086 nlink 1; not read`. The file was read, and the record
  says it was not.
- **A5:** `unread → 93e46ce8d0363b87`, the base file's hash, which is what was read.

### 3.2 On CI's Linux: this seat's probe branches

**Probe file** `open-brain/tests/harness/qa92-a5-probe.test.ts` (10 tests, all `skipIf(win32)`; it loads here as 10
skipped). Each test asserts its own plant and prints a `QA92-…` line. It ran **with QA 89's file unchanged** (blob
`b51e9cf8`) on two branches, built with a temporary index and pushed under D-038, each read back with `ls-remote`.
**Never for merge; no PR.**

| Branch | Head | Runs (git 2.55.0) |
|---|---|---|
| `qa/loop-15-slice-3-a5-probe` | `920ba89` (A5 + QA 89 + the probe, v1), then `dfbac1b` (v2 adds ANCHOR-EDIT and VIADIR-EDIT) | `35951503043`: 6 failed, 1144 passed, 6 skipped; `35952428545`: 8 failed, 1144 passed, 6 skipped. **Every failure is in this seat's file; QA 89's eight tests all pass** |
| `qa/loop-15-slice-3-a5-probe-on-a4` | `e27aea5`, then `81b5d51` (the same files on `f9a1aa8`) | `35951505065`: 6 failed, 1135 passed; `35952430721`: 6 failed, 1137 passed. **The failures are QA 89's H, J, R, LOOP and this seat's STOW-H and ABS2** (all A4-1's class) |

Per test, read from the logs with ANSI codes stripped:

| Test | A4 | A5 | Printed at A5 |
|---|---|---|---|
| QA 89 A4-1 CONTROL | `✓` | `✓` | hash expected and found |
| QA 89 A4-1 H / J / R / LOOP | **`×`** (hashes `4022c513a10d45d8`, `f119e2e0e8f2b0c8`) | `✓` | not in the record |
| QA 89 B3 / R29 / R35 | `✓` | `✓` | as report A4 §3.2 |
| **STOW-CTL** | `✓` | **`×`** | `found: []`; base note "read through that target" |
| **STOW-H** | `×` (read: `hv`, `hv2` in the record) | **`×`** | `devFindings: 0, qaFindings: 0` |
| **XDGDIR-CTL** | `✓` | **`×`** | `found: []` |
| **XDGDIR-H** | `✓` ("identity change … not read") | **`×`** | `devFindings: 0` |
| **XDGFILE-CTL** | `✓` | **`×`** | `found: []` |
| DOWN-CTL | `✓` | `✓` | hashed |
| ABS2 | `×` (read through the repointed link) | `✓` | edit hashed; repoint "type change … not read through" |
| **ANCHOR-EDIT** | `✓` | **`×`** | route tail `dir …/anc-real-xdg`, `dir …/git`, **`absent …/git/git`** |
| **VIADIR-EDIT** | `✓` | **`×`** | route tail `dir …/via-real`, `dir …/sub`, **`absent …/sub/sub`** |
| **STOW-LOOP** | `✓` (one finding, `developer`, `d89a0ce984a21cf1 → b653c39f9346e33f`) | **`×`** | `status: completed`, `findings: []`, `targetHasAppend: true` |

### 3.3 R58: the candidate's tests against their rows

| Test | Row asks | At A5 | Shown able to fail by |
|---|---|---|---|
| **R58 (b)3** | a symlink **as an entry inside `.git/hooks`** where the snapshot holds a hook; snapshot mode ≠ victim mode; plant asserted; own controls | plants `hooks/post-commit` at `755` against a `644` victim, and asserts they differ (the values are in the assertion message, printed only on failure). Asserts `isSymbolicLink`, a write through a link, and the plant's own act without the runtime, all in the same test | the developer's `23269d3` (an **injected** `chmod` through the link on restore, not a revert): `35949009974`, 1 failed, this test. The existing (b)3 test from A4 is kept alongside it |
| **R58 R29** | a **link** to a `000` victim; `EACCES` first; fail rather than skip | met | the developer's gate mutant `c9232ad` (`35949011700`) **and** this seat's injection-free `resolutionMismatch → undefined` (`35952437161`): each red **on its own assertion** (`:982`, `not.toContain("unreadable")`, received `"after":"unreadable"`) |
| **R35 (Linux)** | the record carries type and target | met: `type symlink`, `readlink <dot>` | `4e3a850` (the note loses type and target): `35949013391`, red with R46 |
| **R52 (b)4** (file-symlink form) | plant asserted; own control; a named mutant | **unchanged from A4**: no `isSymbolicLink`, no in-test control, and no mutant named in the handoff | the gate mutants: `35949011700` and `35952437161` both red on it. It **can** fail; R58's other bullets are unmet (A5-2) |
| (b)1, (b)2, (b)6 | criteria CA-15 (b): the in-test controls in each (b) test | unchanged from A4; the controls are still the separate `R52 control` test | not re-derived by this seat (A5-2) |
| **R55** CONTROL / H / J / R | the row's shape; the plant; a named mutant | shape: `~/.gitconfig → dot/gitconfig` (relative, downward). The plant is asserted in CONTROL, H and J; **R (rename-over) asserts no plant** | M-R55-route (H, J, R) and M-R55-realpath (CONTROL), both measured on CI (§4) |
| **R57** | the plant; a named mutant | `nlink` 2 asserted | **M-R57** (1 red, this test only, §4); red at A4 on its own hash assertion (`35949006640`). **It does not see A5-4**, whose shape (a file new since base, unchanged in the stage) it never plants |
| **R59** × 2 | — | — | **M-R59-read** and **M-R59-revert** (1 red each, its own test, §4); red at A4 on their own text assertions (`35949006640`). **Neither asserts the positive direction** ("reverted" present when a revert ran): M-R59-never survives (A5-5) |

**On the dispatch's question about R29's mutant** ("decide whether R29's test is shown able to fail by a mutant that
narrow"): **it is.** The protection R29's row tests is the machine-side read gate for a link planted after base, and
there is nothing narrower to revert. A gate revert breaks every test that relies on the gate, so twelve reds is the gate's
footprint, not the mutant's imprecision. What matters is **why** R29's test went red.
- **The developer's mutant** also injects an explicit `"unreadable"` push, which by itself could make the test fail.
- **This seat's revert has no injection**: `resolutionMismatch` returns `undefined`. The test still failed at the same
  line, and its record was `{"before":"type:file","after":"unreadable"}`, produced by `snap`'s own failed read.

### 3.4 R55 by the code path

At `4c1287f` the only byte reads in `configwatch.ts` are:
- `readState` (`:416`);
- `MachineConfigWatch.snap` (`:988`), which is reached only when `reached`, `realpath(last.path) === realpath(p)`.

Every caller after preflight is gated:
- **repository side:** `begin` (`:592`) and `closeAndRestore` → `readForCompare` (`:621`) run `repositoryResolutionDiff`
  against `loopChains`, captured once at `runtime.ts:625` before any stage (R57);
- **machine side:** `begin` and `compare` run `resolutionMismatch` before `snap`.

The post-restore read-back reads the runtime's own renamed-in file. `listTree` does not enter links. There is no
`rmSync` and no recursive remove (R24).

**Looking for A4-1's sibling, as the dispatch asks.** "Whether anything a base link leads to, at any position, is still
outside the compared route."
- **For reads: no.** `reached` compares `realpath`, so a route that does not end at the object never opens it.
- **For the route itself: yes.** Two mechanisms put the object outside the compared route, and both were measured
  (§3.2, §3.1): the relative `..` target and the cumulative `rest`.

What each one does is in the verdict. Printed from A5's own `recordChain` (`route.mts`), on win32:
- **ANCHOR** (`$XDG_CONFIG_HOME` a junction): the route ends at **`absent …\real-xdg\git\git`**; the object is
  `…\real-xdg\git\config`.
- **MID control** (`$XDG/git` a junction): the route ends at `file …\dotgit\config`, the object.

**Why the candidate's own R55 tests could not see it.** All four plant exactly one shape: a relative, downward target
(`dot/gitconfig`) with the link in the final position and nothing after it. Neither mechanism is reachable from that
shape.

**The instrument class.** When the route misses the object, "unread" at base is indistinguishable in the record from
"unchanged". This is rule 11, an instrument that cannot tell "nothing there" from "did not look", in the
component that exists to report machine-config changes.

### 3.5 R59 `rollBack`, both directions

`probe-r59.mts`, one full loop per case:

| Case | A5 | A4 | M-R59-revert | M-R59-never |
|---|---|---|---|---|
| SNEAKY: `src/backdoor.ts` outside the allowlist | `allowlist-violation`; sentence **present**; file gone | present; gone | present; gone | **absent**; gone |
| CFGONLY: `.git/config` appended | `stage-changed-config`; sentence **absent** | **present** (the known positive) | **present** | absent |
| BOTH | `stage-changed-config`; **present**; file gone | present; gone | present; gone | **absent**; gone |

**M-R59-never survives all 169 row tests** (§4). The candidate's only R59 rollBack test asserts the sentence is
**absent** on a config-only refusal, and no candidate test asserts it is **present** after a revert. A runtime that
never says it reverted anything passes every candidate test (A5-5). The behaviour is right at A5; this is the test.

### 3.6 R57 against R54(2): an unchanged file reported as changed (A5-4)

`probe-r57.mts`, `ConfigWatch` directly, with a fixture repository:

| Case | A5 | A4 | M-R57 |
|---|---|---|---|
| **NEWBETWEEN**: `captureBase`; `.git/info/refs` written; `begin("developer")`; nothing; `closeAndRestore` | **`ok: false`**, `info/refs` **modified**, `identity:dev 2993778667 ino 167196136169107439 nlink 1; not read` → the same identity; **`unrestored`: 2** | `ok: true`, no change (A4 has no `captureBase`: its baseline is the window's open) | `ok: false`, **read** at `begin` (a hash in `before`), `not read` at close |
| **CONTROL**: `captureBase`; `begin`; `info/refs` written during the stage | `created` (absent → identity … not read) | `created` | `created` |

The mechanism, read from the code:
1. `begin` (`:593–607`) gives any file whose route differs from `loopChains`, a file absent at base included, a snapshot
   with `unreadIdentity: true`.
2. `readForCompare` (`:621–629`) does the same at close.
3. `changed` (`:424`) returns true when **either** side is `unreadIdentity`, without comparing the identity facts it
   holds.
4. The restore then has no bytes to write ("snapshot was file; not followed"), and `agrees` fails ("read back …,
   expected identity … not read").

The record ends: "2 FILE(S) COULD NOT BE PUT BACK … Recover by hand before rerunning."

**The one natural occurrence** was during the M-R59-revert run (03:50:50–03:53:05Z; that mutant touches only
`rollBack`'s text). In the candidate's own CA-5 R19 test:

> developer was refused, not warned. 1 repository config/hook file(s) changed during the developer stage:
> `<common>/info/refs` modified (identity:dev 2993778667 ino 13229323907405397 nlink 1; not read → identity:dev 2993778667
> ino 13229323907405397 nlink 1; not read). … 2 FILE(S) COULD NOT BE PUT BACK: …\clone\.git\info\refs (snapshot was file;
> not followed); …\clone\.git\info\refs (read back 1a783384ae7d2d80/666/nlink:1, expected identity:… not read). Recover by
> hand before rerunning.

The same test passed 10/10 run alone at A5 and at A4, and in every other run. **Who wrote `info/refs` is not
identified.** The test's own setup (a clone under the machine's config, `remote remove`) was watched for 3 s × 3 runs
and wrote nothing into `.git/info`. A grep of `open-brain/src/harness/` finds no `update-server-info`, `gc.auto` or `maintenance`. That is the harness source
only; git's own background maintenance is not excluded. A4 is
exposed only if the writer lands during a stage; A5 is exposed if it lands at any time after the loop's base.

## 4. Mutants

Each mutant is a `git archive 4c1287f open-brain` copy with a `node_modules` junction.
- Every edit was asserted to occur exactly the expected number of times, and read back from disk.
- **All 39 counted mutants are `tsc --noEmit` exit 0.** That is report A4's 33, rebuilt at A5 with every count unchanged,
  plus A5's six. **Type-check control:** a planted TS2322 gives exit 2.
- Results were read from the JSON reporter over the six row files (169 tests), run sequentially from 03:39:20Z to
  05:06:22Z. No run printed an unhandled error.
- Three mutants ran on CI instead, where the rows are POSIX-only (§3.2): M-R55-route, M-R55-realpath, and the gate mutant
  M-R49-machine.

**A5's own protections, one mutant each:**

| Mutant | Edit | Red tests (win32, of 169) | CI (Linux) | Its probes |
|---|---|---|---|---|
| **M-R55-route** | `routeChain` does not follow a link in the last position (A4's walk) | 0 (its tests are POSIX) | **`35952432885`: R55 H, J, R; QA 89 H, J, R, LOOP**; this seat's STOW-H, XDGDIR-CTL/H, ABS2, ANCHOR-EDIT | r35edit, r35anchorEdit, r35chainJ, r35chainH: as unmutated (the junction shapes are not final-position) |
| **M-R55-realpath** | `reached` compares `path.resolve` (70ec18c's form) | 0 attributable (one load-induced red, §12) | **`35952435096`: R55 CONTROL, QA 89 CONTROL**, DOWN-CTL, ABS2, STOW-CTL, … | **r35edit: no finding** (red on win32); ca4fBase unchanged |
| **M-R57** | `begin` reads when the route differs | **1**: R57 | — | probe-r57 NEWBETWEEN: the file is **read** at `begin` (a hash in `before`) |
| **M-R59-read** | the `end.hash` overwrite removed | **1**: R59 read half | — | **r54Revert: the qa record says "…nlink 1; not read" again** (A4-3 back) |
| **M-R59-revert** | A4's `if (bad.length > 0) revertPaths(…)` | **1**: R59 config-only (plus the CA-5 R19 red, A5-4, not this mutant's) | — | probe-r59: CFGONLY says "reverted" again |
| **M-R59-never** | "reverted" never printed | **0: survives** | — | probe-r59: the sentence is absent on SNEAKY and BOTH, where a revert ran. **No candidate test asserts the positive direction** (§9, A5-5) |
| M-R49-machine (the gate) | `resolutionMismatch` → `undefined` | **7** (R43/R44/R45/R49 machine tests, R59 read) | **`35952437161`: 26**, incl. **R52 (b)4, R58 R29** (own assertion), R55 H/J/R, QA 89 H/J/R/LOOP and R29 | **all 7 machine probes read through** except r35anchor (the doubled route of A5-1 hides even the mutant's read) |

**Report A4's set, re-scored at A5** (each against its report A4 count):

| Mutant | Red at A5 | At A4 | Note |
|---|---|---|---|
| M-L0 | **2** (CA-4c own row, CA-4e) | 2 | probe2 H under M-L0: the global filter ran **4 times inside the runtime** (0 at A5) |
| M-L1 | 1 | 0 | the red is an `ENOENT` on `A_t.gitref`: the loop never reached QA, and its reason is not recorded. **Unexplained; not counted** (§12) |
| M-L2 | **16** | 15 | the extra one is A5's R59 config-only test |
| M-L2-order | **4**, the fsmonitor row **green** | 4 | — |
| M-L2-order + M-L1 | **7**, **including the fsmonitor row**: layer 1's job shown | 7 | — |
| M-R18 | 0: survives alone | 0 | — |
| M-L2 + M-R18 | 16; the R18 row goes from `undefined` (M-L2) to `runtime-git-failed`: the pair | 15 | CA-4h met by the pair |
| M-R16 | **7** | 7 | — |
| M-R15 | **1** (CA-2.6) | 1 | — |
| M-backstop | **4** (CA-14 ×2, CA-4i ×2) | 4 | — |
| M-CAS | **1** | 1 | — |
| M-endstate | **5** | 5 | — |
| M-L2-norestore | 20 | 19 | +1 is the gate-log test (a plain loop that did not reach QA; unexplained, §12). Probes (a)1, (a)3, (a)5, (a)6config: **every victim unchanged** |
| M-follow-a | **6** | 6 | (a)1–(a)3, (a)4pre: the link left; victims unchanged |
| M-follow-b | **2** | 2 | (a)5: `runtime-git-failed` |
| M-follow-c | **3** | 3 | a6config, a6hook: **victims overwritten**; baseHardEdit: the outside file = base bytes |
| M-R44 | 2 | 1 | +1 is A5's R59 read test, which relies on the loop base. machineNext and machineHard: hashes back in the record |
| M-R45 / -record / -mkdir | **1** each | 1 each | a4: as report A4 |
| M-R46-root | **1** | 1 | root not named |
| M-R46-basenotes | **1** | 1 | r35base: no note |
| M-R43-repo | 2 | 0 | it now kills **R57's test**. The other red is `runtime: A5 — refuses to run a loop id whose tags already exist` (unexplained, single run) |
| M-R49-repo | 2 | 1 | + R57's test (R57 shares the repository gate). newHook: the hash in the record |
| M-R49-both | 9 | 2 | the machine gate's tests plus R57 and R59 |
| M-R49-repo + M-R43-repo | 3 | 2 | + R57. a6config, a6hook, hooksReplacedHard: **the victim's hash in the record** |
| M-R54 | 3 | 2 | + R59 read. **ca4fBase: each path twice** |
| M-R50 | **1** | 1 | baseHard, baseHardCfg fail at `planner` |
| M-R50+agrees-v2 | **1** | 1 | baseHardCfg: exception text in the record |
| M-R51-refuse-cmd | 5, incl. the 2.5 planted control | 4 | — |
| M-2.5-refuse-node | **16** | 16 | — |
| M-2.5-accept-cmd | **2** | 2 | — |

**Not run:**
- M-R22 (POSIX-only; no POSIX machine here).
- The CA-4h resolve-late mutant.
- The CA-5 snapshot-timing mutant (the runtime's own writes do not touch `.git/config`).

The developer's R58 code-mutant branches were checked by diff (§3.3):
- `23269d3` **injects** a chmod rather than reverting a guard;
- `c9232ad` removes `compare`'s gate **and** injects an `unreadable` push;
- `4e3a850` drops type and target from the note.

Each turns its named test red, per the CI runs in §5.

## 5. Full suite and CI (CA-12)

**QA full suite at the candidate: 05:15:53Z → 05:19:20Z, `SUITE_EXIT=0`, captured unpiped (`npx vitest run > file;
SUITE_EXIT=$?`), from `~/Worktrees/sia-qa/open-brain` at `4c1287f`.**
- `Test Files  75 passed (75)`, **`Tests  1124 passed | 16 skipped (1140)`**. No `Errors` line; 0 matches for
  `Unhandled|onTaskUpdate`. Duration 204.60 s; cumulative test time 692.19 s.
- The total, 1140, equals CI's on the head. Here the 16 skips are the POSIX `skipIf` rows; on CI the six skips are the
  win32 and real-`claude` rows.
- **The planner's GO, 05:16Z, with its own measurements:**
  - 0 of 41 listening sockets on 3210/4000/5173 (05:15:17Z);
  - Relay (a2a-planner-6c) told FULL STOP, and it confirmed by message;
  - the 3d-printers session closed;
  - the planner idle.

  **This seat's own measurements:** 0 of 41 sockets on those ports at 05:14:55Z; the mutant runner finished at 05:06Z,
  and nothing of mine ran during the suite.
- Peers (`ListAgents`), read by this seat:

  | When | sia-planner-6b | a2a-planner-6c (Relay) |
  |---|---|---|
  | before (05:15Z) | idle | idle |
  | after (05:19Z) | idle | idle |

  The planner's own 05:16Z listing showed Relay "busy", which it read as the tail of the turn that sent its
  confirmation. Both of this seat's reads show it idle.
- **G-042 did not appear.** The worktree is recorded: `~/Worktrees/sia-qa`.

**CI on the candidate's exact head.** No CI run existed on `4c1287f`; the developer's last green run was at `845dfaa`. This seat
pushed the same SHA to its own branch `qa/loop-15-slice-3-a5-head` (D-038, read back) and dispatched CI (D-040): run
**`35952457646`**, success; `Test Files 75 passed (75)`, `Tests 1134 passed | 6 skipped (1140)`; git 2.55.0; 1134 `✓`,
6 `↓`, 0 `×`. The six skips are the win32 R41 and R35 rows, the win32 2.5 refusal, the real-`claude` 2.5 control, CA-9
and the win32 CA-6 limit row. **Printed, not derived:** R55 CONTROL, H, J and R `✓`; R57 `✓`; R59 × 2 `✓`; R58 (b)3
and R29 `✓`; the Linux R35 row `✓`; CA-6 POSIX normal and error `✓`; the 2.5 planted control `✓`.

**The developer's runs, re-read by this seat per test:**

| Run | Head | Read here |
|---|---|---|
| `35947532386` | `70ec18c` | 1 failed (R55 CONTROL), 1132 passed. H, J, R, R57, R58 × 2, R59 `✓` |
| `35949006640` | `8bd34aa` (A5's tests on A4) | 6 failed: R55 H, J, R; R57; R59 × 2. Each is red on its own assertion (the victim's hash; "not read"; "reverted"). R55 CONTROL, R58 × 2 and R35 are `✓` at A4 |
| `35949008244` | `845dfaa` | success, 1134 passed, 6 skipped |
| `35949009974` | `23269d3` (b3 mutant) | 1 failed: R58 (b)3 |
| `35949011700` | `c9232ad` (r29 mutant) | 12 failed, including R58 R29 **and R52 (b)4** |
| `35949013391` | `4e3a850` (r35 mutant) | 2 failed: R35 and R46 baseNotes |

All match the dispatch's table.

## 6. `/sync --check` (CA-12)

- **`gitnexus analyze`** in the QA tree. The first run exited 1 on T-055's incremental failure: `FTS index 'file_fts' is
  inconsistent: document for node offset 298 is missing during delete`. The second run exited 0. `meta.json`
  `lastCommit` = `4c1287f…`, `indexedAt` 05:13:42Z, read from the file.
- **`sync --check` in the QA tree: exit 1**: `25 passed, 0 fixed, 2 warnings, 3 issues, 0 skipped`.
  - `gitnexus-index` passed ("index is at HEAD (indexed 4c1287f …)"); `build-freshness` passed ("build matches HEAD
    4c1287f").
  - The issues are `prd-version`, `summary-version` (views at rev 84, v0.44.0) and `retirements` (ENTITIES.md names
    `dream` and `reflection queue`): the same three as reports A to A4.
  - **All three issues' inputs are byte-identical** between `f9a1aa8` and `4c1287f`: `git diff --quiet … -- .agents
    package.json open-brain/package.json CHANGELOG.md README.md` exits 0. **Control:** `open-brain/src/harness` differs,
    exit 1.
  - The warnings are `vault-index-parity` (one Checkpoints note) and `spec-provenance` (no `specs/`).
- **Plain `sync`, in a scratch clone** (`git clone --no-hardlinks` of the QA repository, detached at `4c1287f`, `npm
  ci` and its own build, `plainsync.sh`):
  - `sync --check` there: **exit 1** (23 passed, 2 warnings, 3 issues, 2 skipped);
  - plain `sync`: **exit 0**, "23 passed, **2 fixed**, 2 warnings, **1 issues**, 2 skipped", rewriting five tracked
    `.agents` files in the clone (`next-session.md`, `PRD.md`, `SUMMARY.md`, `INBOX.md`, `task.md`).

  CA-12's point is reproduced. The two skips are the clone's, read from its output: `gitnexus-index` ("no
  .gitnexus/ in this tree") and `ci-status` ("gh is not authenticated; conclusion: unknown"). **The QA tree was never
  written** (0 porcelain entries after).

## 7. What could not be verified, stated so nobody inherits it as settled

1. **A5-1's full reach.** It was measured for `~/.gitconfig` and the XDG path, on both platforms. By the code, the
   system path behaves the same whenever its route hits either mechanism. So does any absolute link target whose own
   path passes a symlinked directory with two or more components after it (macOS `/var` and `/tmp`; Fedora Atomic's
   `/home → var/home`). Not run.
2. **Links above a machine-config anchor.** The path-as-written walk starts at the anchor (HOME, the XDG base, the
   system config's directory), and R55's "every component of the path as written" could be read to include what is
   above it. A role would need write access to HOME's parent. Not probed; returned in §11.
3. **M-R22**, and the **CA-4h resolve-late** mutant: not constructed, as in reports A2 to A4.
4. **CA-9's real run** is carried from candidate A and attributed.
5. **The race R37 names** (and the compare-then-open limit) was not probed.
6. **The declared unrunnables U1–U6** (criteria §3).
7. **R57 at the loop level.** Rulings-12 says it is reachable only through U3. It is scored as a unit test plus its
   mutant, and A5-4's deterministic probe is unit-level too.
8. **Who wrote `.git/info/refs` in A5-4's one natural occurrence.** Not identified (§3.6). Until it is, how often A5-4
   fires on ordinary loops is unknown: once in roughly 45 runs of that test in this session.
9. **Three single-run reds in carried mutants that record no reason** (§12): M-L1 (`A_t.gitref` ENOENT), M-L2-norestore
   (the gate-log line missing), and M-R43-repo (`refuses to run a loop id whose tags already exist`). Each is a plain
   loop that ended early. They fit A5-4 firing on a plain loop, but **this is not shown**. None was reproduced, and
   none is counted as its mutant's kill.

## 8. What the checks I ran cannot see

- **One win32 machine and CI's unmutated Linux** for everything except three mutant branches on CI (§4). The POSIX-only
  rows' mutants were run on CI only for R55's two protections and the machine gate.
- **Stub roles, one act each.** The shapes added this session were derived by reading `routeChain` first. Other shapes
  may exist that neither the reading nor the probes reached.
- **Traceless reads.** A read whose result is discarded is visible only by the code path (§3.4).

## 9. Defects, each with the observation that produced it

| # | Severity | Defect | Observation |
|---|---|---|---|
| **A5-1** | **high** (CA-4f; R55's allowed read and "report it"; CA-11) — a regression from A4 | the route walk can end at an entry that is not the object: (a) a relative link target that climbs out of its directory; (b) any link with two or more components after it (cumulative `rest`). Then `snap` records "unread" at base, and the path is silently unwatched: no in-place edit is hashed, no swap is reported, and the loop completes | §3.2: Linux A5 `35952428545` against A4 `35952430721`, eight shapes red at A5, seven of them green at A4. §3.1: win32 r35anchorEdit reported at A4 and A3, not at A5. §3.4: the route printed from A5's code |
| **A5-4** | **medium** (R54(2) as R57 keeps it; CA-14) | a watched repository file that is absent at the loop's base and present when a stage opens is snapshotted `unreadIdentity` at both ends, and `changed()` (`:424`) treats either unread side as a change. So a file nothing touched is reported `modified` with identical identity facts, the stage fails, and the record says "2 FILE(S) COULD NOT BE PUT BACK … Recover by hand" | §3.6: probe-r57 NEWBETWEEN fails at A5 and is `ok` at A4. One natural occurrence in the candidate's CA-5 R19 test (`.git/info/refs`, writer unidentified), not reproduced in 10+10 runs alone |
| **A5-5** | low (test quality; R59, R58) | no candidate test asserts that "The offending paths were reverted." is **present** after a revert; the only R59 rollBack test asserts its absence | §4: M-R59-never survives all 169 row tests. The behaviour is right at A5 (§3.5) |
| **A5-2** | low (test quality; R58) | R52 (b)4's test is unchanged from A4: no plant assertion, no in-test control, and no mutant named in the handoff. The (b)1/(b)2/(b)6 tests still carry no in-test controls (A4-2 carried). R55's rename-over test asserts no plant | §3.3. (b)4 is shown able to fail by two gate mutants, so this is the letter of R58, not a vacuous test |
| **A5-3** | low (R59's class; CA-14) | the R46 base note "…; read through that target, not refused." is written for every base link, whether or not the runtime can read through it. It is false for A5-1's shapes | printed in `QA92-STOW-CTL` and `QA92-STOW-LOOP` at A5: the note is present, and the path is never read |
| D-A2-7 | low (carried) | a `.git` junctioned at base to a non-repository is recorded `not-a-repo` | the same at A5 (§3.1) |
| D-A5 | carried | — | — |

**A4-1 and A4-3 are fixed**, R57 is met, R59's rollBack text is right in both directions, and R58 is met for (b)3, R29
and R35.

## 10. Regressions: previously validated behaviour confirmed still working

- The six candidate row files at A5 (153 passed), CI on the head (1134 passed) and this seat's full suite (1124 passed,
  exit 0). They include G-045's rows (`refwatch-stage`), slice two's refusals (`runtime.test.ts`) and every candidate-A
  row (`config-channel.test.ts`).
- All 29 of report A4's win32 CA-15 probes, identical to A4 by verdict fields (§3.1).
- Report A4's non-link probes, re-run at A5 as `probe2.mts`: H, R34, SINGLE, DFORK, DMG × 3 and COMPOSE. Every outcome
  matches report A4's apart from PIDs, timings and hashes.
- Every carried A4 mutant kills at A5 what it killed at A4. Where the count grew, the new red is one of A5's own tests
  (§4).
- **Two regressions by the rows:**
  - **A5-1:** CA-4f's report is lost for two families of base links.
  - **A5-4:** a false stage failure on an unchanged file that is new since the loop's base.

  A4 is the known negative for each.

## 11. Where the criteria, the rulings and the candidate disagree (returned, not scored)

1. **R55's "from the target's own anchor down", for a relative target.** A relative target's natural anchor is the
   link's directory, and a target that climbs out with `..` is not "down" from it. The developer's walk reads the
   phrase literally and records nothing for such a target. R55's first two bullets ("the object that opening the path
   would reach"; "every directory entry the operating system passes through") already cover it, and so does its "what
   stays allowed". **This seat scored the principle, not the phrase.** It is returned in case the next ruling wants the
   phrase to say that a relative target is resolved against the link's directory the way the OS does, `..` included.
2. **The two directions of R55's gate.** It fails closed on reading (`realpath`), and it fails **open on reporting**:
   when the route does not reach the object, the runtime records nothing about the path, at base or later. No row
   names "a machine-config path whose base route does not reach its object" as a condition to report. CA-4f's report
   and R55's "report it" catch it only when something is edited. **Returned:** whether the record should say, at base,
   that such a path is not watched (the rule-11 shape in §3.4).
3. **Links above the machine-config anchor** (§7.2): R49 said "from its anchor down"; R55 says "every component of the
   path as written". **Returned** in case the difference is intended.
4. **R58's scope over the (b) tests.** R58 lists "every R52 item" and, separately, "each (b) test carries its own
   control, in the same test". This seat read the second as covering (b)1/(b)2/(b)6 too, per criteria CA-15 (b)'s control
   bullets, and recorded it in A5-2 **without failing a row on it**, because each row's pass clause is a behaviour and
   the behaviours were measured. **Returned** in case the planner reads R58 as making those bullets the pass condition.
5. **R57 and R54(2) on the repository side, for a file that is new since base.** R57 moved the repository side's read
   baseline to the loop's base, and said attribution keeps its per-stage baseline. At A5 the two are one mechanism: the
   stage-start snapshot of a file that differs from the loop base is unread, so attribution cannot tell "unchanged in
   this stage" from "changed". R54(2)'s words already give the answer (compare `lstat` identity facts where the gate
   forbids reading), and A5-4 is scored on them. **Returned** because rulings-12 called this path "reachable only
   through U3", and this session saw it once from a writer that was not a role.
6. **The dispatch's table** lists `845dfaa` as "R59's read half: its own test"; the commit also carries the code change.
   Recorded, not a defect.

## 12. This seat's error entries and near-misses this session

**Error entries (escaped):** none known. The interim A2A message to the planner (~03:50Z) said "All 31 win32 CA-15
probes … identical to A4 by verdict fields, except r35anchorEdit". That is right, but it was sent before the carried
mutants ran and before A5-4 was found. This report supersedes it.

**Near-misses (caught in-process, not numbered):**
- **Concurrent load from this seat's own probe.** I ran `probe-r59.mts` (four loops) while the mutant runner was
  running M-R55-realpath's rows, and one runtime test went red: "says in the log that the QA scoring gate was NOT
  consulted". Run alone, it passes 3/3 on the mutant and 3/3 on A5. It is **not counted** as M-R55-realpath's kill, and
  nothing else ran beside a mutant after that. It is G-042's lesson again: a seat's own concurrent work is load.
- **Quoting layer:** a `sed` meant to shorten printed paths failed on a backslash in its expression (it failed loud). The
  output file was read directly instead.
- **A misquoted time, caught in the draft:** §3.6 first gave the M-R59-revert run as 04:50Z; the runner's log says
  03:50:50–03:53:05Z.
- **The recall trigger fired entry 299 (pipe-to-tail) four times** beside commands whose exit codes were already
  captured unpiped. Each time I read it and it did not apply.
- **Unexplained reds in three carried mutants** (§7.9). Each was read, run once, and not counted. The same test, M-L2-
  norestore's gate-log line, is the one that went red under my concurrent load above. So "plain loop ended early" has
  now been seen four times in this session, and only one of them has a recorded reason (A5-4's `info/refs`).

## 13. Reproduction

The scripts are tracked at **`docs/loops/qa-scripts-a5/`** on this branch, byte-identical to the copies that ran, with a
README. The Linux probe file is on `qa/loop-15-slice-3-a5-probe` (`dfbac1b`), and on A4 at
`qa/loop-15-slice-3-a5-probe-on-a4` (`81b5d51`).
- **`probe15-a5.mts <tree> <probe…>`**: report A4's `probe15-a4.mts` plus r35edit and r35anchorEdit. `tabcmp.mjs` and
  `rec.mjs` summarise it.
- **`route.mts <tree>`**: prints the route `recordChain` records for an anchor junction and a mid junction.
- **`probe-r59.mts <tree>`**: R59's rollBack text in both directions.
- **`probe-r57.mts <tree>`**: A5-4. **`inforefs.sh`**: this seat's search for a background writer in the R19 test's
  setup (none found).
- **`plainsync.sh`**: plain `sync` in a scratch clone. **`cilog.sh <run-id> [pattern]`**: reads a CI run's per-test
  lines, with ANSI codes stripped.
- **`qa92-a5-probe.test.ts`**: a copy of the Linux probe file as it stands at `dfbac1b` (v2).
- **Mutants:** `mutants-a5.mjs` (report A4's set, re-asserted at A5 by count, plus M-R55-route, M-R55-realpath, M-R57,
  M-R59-read, M-R59-revert and M-R59-never), `build.mjs`, `runmut.sh`, `tabmut-a4.mjs`, `failmsg.mjs`.
- **`mkbranch.sh <base> <msg> <path>=<file>…`**: builds a probe or mutant commit with a temporary index, without touching
  the QA tree.
- **A5-1 in three lines (POSIX):** `HOME/.gitconfig` a symlink to `../dot/gitconfig` at base; in the developer stage,
  append through `~/.gitconfig`; `machineConfigFindings` holds nothing for that path, and the loop completes.
  **On win32:** `$XDG_CONFIG_HOME` a junction at base; append to `$XDG_CONFIG_HOME/git/config`: no finding.

## 14. Handoff to the next QA session (D-035)

1. **Re-run §3.1's probes and both probe files on CI against the next candidate, A5 and A4.** For A5-1, **A5
   `4c1287f` is the known positive** (`35952428545`, and win32 r35anchorEdit), and **A4 is the known negative for seven
   of its eight Linux shapes**. For A4-1, A4 remains the known positive.
2. **Walk the route by hand for every link shape you plant, and print it.** `recordChain` is reachable at run time
   (`route.mts`). A route whose last entry is not `realpath(p)` is the defect class, whatever the record says.
3. **Probe both directions of every gate.** Reads suppressed as well as reads allowed, and **report present** as well as
   bytes absent. A5-1 passes every "not read" assertion.
4. **Carried mutants rebuild at A5 with unchanged counts**; A5's six own mutants are in `mutants-a5.mjs`.
5. **For A5-4, A5 is the known positive by `probe-r57.mts`** (NEWBETWEEN), and A4 is the known negative. Any candidate
   that changes when the repository baseline is taken should run it, and should also find the `info/refs` writer: once
   it is named, A5-4 can be probed at the loop level instead of the unit level.
6. **Plain `sync` only in a scratch clone. Run nothing beside a mutant's rows** (§12).
7. **Nothing is pushed except this seat's own branches (D-038); the merge is Aaron's.**
