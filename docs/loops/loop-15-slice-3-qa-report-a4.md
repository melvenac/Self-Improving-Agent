# Loop 15 slice three — QA report A4: candidate A4 `f9a1aa8`: REJECTED

**By:** Probe (QA seat), record session **89** (T-164: assigned by the dispatch; the greeting's per-worktree
counter said 10 and is not used) · **Date:** 2026-09-23 (UTC).
**Model and effort, from this session's host transcript**
(`~/.claude/projects/C--Users-melve-Worktrees-sia-qa/0976dc3d-22f0-4e71-92e3-ba72023cf055.jsonl`, parsed as JSON):
every assistant entry carries `"model":"claude-opus-5-5"` and `"effort":"high"`, 290 of 290 at 23:34:59Z.
**Criteria:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` at **`6672e83`** (FINAL; blob `1551f364`, read at that SHA
in full, since the file is not on master), read with rulings-9, **rulings-10 (R49–R53)** and **rulings-11 (R54)** on
master. As the dispatch says: R49 supersedes R43 and R44 for reads, R54 replaces R44's attribution, R51–R53 answer
report A3 §11, and R53 makes a clause bind on shapes beyond the listed probes. Rows are scored **as written**.
**Candidate (frozen):** **`f9a1aa84209f9d17cac404faeb19e00caf2d3491`** on `origin/loop/15-slice-3-candidate-a4`
(draft PR #130). It is six commits on A3 `5010199`:

| Commit | Item | Files (besides the handoff) |
|---|---|---|
| `9788d32` | R49, the read principle | `configwatch.ts`, `configwatch-links.test.ts` |
| `27c0e63` | R50, a base hard link is part of the base | `configwatch.ts`, `configwatch-links.test.ts` |
| `403296d` | R51, CA-2.5's `.cmd` shim | `process-role.test.ts` |
| `544cf15` | R52, five POSIX tests | `configwatch-links.test.ts` |
| `2db806a` | R54, read gate versus stage attribution | `configwatch.ts`, `configwatch-links.test.ts` |
| `f9a1aa8` | the handoff only | — |

Built by Grok 4.7 in Cursor, developer record session 88 (T-177). Handoff:
`docs/loops/loop-15-slice-3-a4-developer-handoff.md` at `f9a1aa8`, read in full.
**Transition controls:** A3 `5010199`, A2 `2add792` and A `3b19287`. Each is a `git archive` copy in this seat's
scratchpad with a `node_modules` junction; **A4 was probed from an archive copy too**, so the four trees are
measured the same way. Each copy's `configwatch.ts` was blob-compared to its SHA: equal for all four; control, A4
against A3: different.
**Scored in:** `~/Worktrees/sia-qa`, detached at the frozen SHA from 21:53:58Z. Environment: git `2.54.0.windows.1`,
Node v22.23.2, win32. CI: run `35922231710` (A4's head, Linux, git 2.55.0) and **this seat's probe run
`35928008495`** (§3.2).
**Context read in full:** the dispatch (`loop-15-slice-3-dispatch-qa-a4.md`), rulings-9/10/11, the A4 brief, report
A3, the `qa-scripts-a3` README, the criteria at `6672e83`, the A4 handoff, `configwatch.ts` at A4 (all 1069 lines) and
A4's test diff against `5010199`.

---

## Verdict: REJECTED. A3-1, A3-2 and A3-3 are closed; CA-15 clause 3 still fails, on a final-component link at base (A4-1), measured on CI's Linux

**What A4 fixed, measured.** Every rulings-10/11 item was probed at A4 and at the transition SHAs, and each has its
own mutant (§3, §4):

| Item | Defect at A3 | At A4 | Evidence |
|---|---|---|---|
| **R49** machine side | A3-1: an absent-at-base machine path made a hard link was read. A3-2: a link or hard link beyond a base dotfiles link was read | **closed for those shapes** | machineHardAbsent, r35chainJ, r35chainH: the victim's hashes are in no record at A4, and in both stages' records at A3 (**A3 the known positive**, by the same expressions). New sibling **r35anchor** (`$XDG_CONFIG_HOME` itself a link at base): read at A3, not at A4. **M-R49-machine** reverts it: 7 probes read through again |
| **R49** repository side | a hook file absent at base was read when it appeared | **closed** | new probe **newHook**: the hook's hash is in the record at A3, A2 and A, and not at A4 ("created (absent → identity:… nlink 1; not read)"). **M-R49-repo** turns it and its own test red |
| **R50** | A3-3: a base hard link failed every loop with a false "modified" and a TypeError text | **closed** | baseHard (hook sample) and **baseHardCfg** (new: `.git/config`, report A3 §7.8's predicted reach): the loop **completes** at A4; at A3 both fail at `planner`, and baseHardCfg's record carries the exception text. **M-R50** brings the failure back; **M-R50+agrees-v2** brings the exception text back |
| **R51** | CA-2.5's win32 control was a bare `.js` | **met** | `process-role.test.ts:245` plants `planted-launcher.cmd` → `node-entry`, with `resolvedFrom` the `.cmd`. **M-R51-refuse-cmd** (every `.cmd` refused) turns this control red at A4 and **not** at A3: the control now exercises the `.cmd` path. CI prints it `✓` |
| **R52** | five POSIX items not built | **built and `✓` on CI; the behaviour measured right; three of the five tests cannot fail as written** | §3.3: (b)3's mode assertion is non-discriminating on CI (umask `022`, `.git/config` `644`, victim `644`), and it plants at `.git/config`, not a hook entry; the R29 test plants no link; the controls are one separate test; the Linux R35 test does not assert the record. This seat's probe measured each in the row's shape on CI: all pass (A4-2) |
| **R54** | CA-4f's qa stage re-reported a developer-stage change | **met** | CA-4f's own test passes; **M-R54** turns it and the R44 test red. r54Twice / r54Revert / plannerPlant: each change is reported once, in its own stage. ca4fBase (all three paths present at base): one finding each, in `developer`, with both 16-hex hashes; under M-R54, two each |

A3's guards all hold at A4 (write/delete, ancestor, rename-over, R44–R46), and each of A3's mutants reproduces report
A3's result here (§4).

**Why it is still rejected: A4-1, measured.** CA-15 clause 3: "After a role has run, no watched path, repository or
machine, is read THROUGH a link, an ancestor link or a hard link that was not there at base." R49: read only if the
**whole resolution** is unchanged since base, "every component from its anchor down to the file, **and through any
link that was there at base**." At A4, when the **final component** of a machine-config path is a link at base — the
ordinary dotfiles setup `~/.gitconfig → dotfiles/gitconfig`, which R35 allows — the compared chain holds the link's
own identity and never its target's. A role that swaps the target is read through:

| Shape (on CI's Linux, run `35928008495`) | What happens at A4 |
|---|---|
| **H**: the base link's target replaced by a **hard link** to an outside file; qa edits the outside file | the victim's hash `4022c513a10d45d8` is the developer stage's "after", and its qa-edited hash `f119e2e0e8f2b0c8` is the qa stage's "after" |
| **LOOP**: H through `runLoop` | the same (`8ba41b08…`, `ec54bc4e…`); the loop **completes**; the base note names the link |
| **J**: the target's **directory** replaced by a symlink to an outside dir | the victim's hash is the "after" |
| **R**: the target replaced by a new file (rename-over) | the new file's hash is the "after" (R49's final-ino letter) |
| **CONTROL**: the base target edited in place (an allowed read) | its hash is in the record: **the instrument can hit** |

**Cause, read from the code** (`configwatch.ts` at `f9a1aa8`): `componentPaths` (`:784`) is lexical: the anchor, then
each path segment. `resolutionComp` `lstat`s each, so the final entry is the **link's** identity. `resolutionMismatch`
(`:818`) therefore sees no difference when only the target changes, and `snap` (`:918`) then `readFileSync`s the
path, which follows the link (`:928–930`, the `symlink` branch). A directory link at an **intermediate** component is
covered, because `lstat` of the final file resolves through it and the file's own identity is compared; that is why
A3-2's shapes are closed and this one is not.
**Not a transition:** A3 has the same final-component shape by the code; A3's POSIX behaviour was not measured.
**Severity: medium, the same class as A3-1/A3-2** (reports A2 and A3): a 64-bit hash prefix of an outside file is
recorded, and nothing is written. R53: the clause binds on this shape, and clause 3 has no severity threshold.
**Cannot be planted on win32** without Developer Mode (a file symlink is `EPERM` here), so the probe ran on CI.

Every other row passes (§2), including the full suite (§5).

---

## 0. Rulings and authority in force

| Source | Where |
|---|---|
| Rulings-1 to 9 | master (as cited by the criteria and report A3 §0) |
| **Rulings-10 R49–R53** | master (`loop-15-slice-3-rulings-10.md`) |
| **Rulings-11 R54** | master (`loop-15-slice-3-rulings-11.md`) |
| The dispatch | `docs/loops/loop-15-slice-3-dispatch-qa-a4.md` on master (`7c6862e`), pointed to by the live planner (sia-planner-6b, record session 90) by A2A at session start |
| **CI dispatch on this seat's probe branch** | **Aaron → planner:** "yes", planner session (record 90), 2026-09-23 just after 17:19 CDT, to the planner's question "may QA dispatch CI (workflow_dispatch) once on qa/loop-15-slice-3-a4-probe at 9f58fbc". **Planner → QA:** A2A, received ~22:22Z, quoting it. One dispatch, made at 22:22:44Z: run `35928008495`. Later superseded as standing authority by **D-040** (record rev 106; Aaron: "ci should run autonoumously"), relayed by the planner. No run after the first was made |
| Full-suite GO | planner, A2A, 23:31Z, with its own measurements (§5) |

## 1. Frozen-candidate conditions

| Condition | Observation | Result |
|---|---|---|
| criteria before candidate | `6672e83` is an ancestor of `f9a1aa8` (exit 0). **Control:** `d18a196` exits 1 | held |
| built on the release line | `5010199` (A3), `2add792` (A2), `3b19287` (A) are ancestors, exit 0 each | held |
| A4's own diff | `5010199..f9a1aa8`: `configwatch.ts` (+/−353 lines of change), `configwatch-links.test.ts` (+220), `process-role.test.ts` (+24), the handoff (+84). Nothing else | as stated in the handoff |
| **tree moved** | HEAD = `f9a1aa8…` at 21:53:58Z and at every later read, through the suite (23:32:11Z) | **not moved** |
| **tree dirty** | 0 porcelain entries after the checkout, the build, the row files, `gitnexus analyze`, `sync --check` and the suite. **Plain `sync` ran in a scratch clone, never here** (§6) | **clean throughout** |
| build | `npm run build` exit 0, stamped `f9a1aa8` at 21:54:17Z | current |
| **CA-13**, no version bump | `git diff 5010199 f9a1aa8 -- package.json open-brain/package.json CHANGELOG.md`: 0 lines | **pass** |

## 2. Rows

"Cand. tests" means the six row files (config-channel, configwatch-links, process-role, spawn-sites, refwatch-stage,
runtime), run here 22:10:22Z → 22:12:21Z with the JSON reporter: **exit 0, 160 tests, 150 passed, 10 skipped, 0
failed.** The ten skips are all `skipIf(win32)`: CA-6's two POSIX rows, CA-15 (b)1/(b)2/(b)6, the Linux R35 row and
A4's four other R52 tests. The real-`claude` 2.5 control and the CA-9 pin **ran and passed** here, read per test.
"Probe" means this seat's scripts (§13); mutants are in §4.

| Row | Observed | Verdict |
|---|---|---|
| **CA-1** | Cand. tests pass. **M-L2 kills both CA-1 tests.** Unchanged by A4 | **pass** |
| **CA-2.1–2.4, 2.6** | Cand. tests pass. **M-R15 kills 2.6** | **pass** |
| **CA-2.5** | **R51 met.** The win32 planted control is the `.cmd` JS-entry shim the row names, asserted `node-entry`, `executable` = this node, `preArgs` = the `.js`, `resolvedFrom` = the `.cmd`; its refusal twin is refused in the same test. **M-R51-refuse-cmd** kills it at A4 and not at A3 (§4). **M-2.5-refuse-node** (16 red) and **M-2.5-accept-cmd** (2 red, the control's twin and the win32 refusal row) each kill it. **CI (`35922231710`):** the planted control `✓`, the real-`claude` control `↓`. Locally all three ran and passed | **pass** |
| **CA-3a–d, order** | Cand. tests pass. Preflight unchanged by A4 | **pass** |
| **CA-4a** | Cand. tests pass. **Probe DMGconfig:** `stage-changed-config`, `FAILED.md`, HEAD resolves. **M-L2 kills** the four CA-4a rows; **M-L2-order kills** the garbage-config row | **pass** |
| **CA-4b, CA-4b-L1** | spawn-sites pass. **M-R16 kills 7.** **Layer 1's job shown:** under M-L2-order the fsmonitor row is **green**; under **M-L2-order+M-L1** it is **red** ("the planted program ran inside a runtime git call") | **pass** |
| **CA-4c** | Cand. tests pass. **M-L0 turns CA-4c's own row red** ("the global filter ran inside a runtime git call") and CA-4e's. **Probe H:** the runtime ran the filter 0 times and the control's `git add` ran it; under M-L0, ×3. **R34:** the generated file carries `autocrlf = "input"`; `git config --system` reads `true`. CI prints the CA-4c rows `✓` on git 2.55.0 | **pass** |
| **CA-4d** | Scope in `watchedLocations`, unchanged; the walk is `lstat`-based. **M-L2-norestore kills the CA-4d row** | **pass** |
| **CA-4e** | Cand. test passes. **M-L0 kills it** | **pass** |
| **CA-4f** | Cand. tests pass (path, stage `developer`, not restored; control). **M-R54 kills** the main row. **Probe ca4fBase** (all three paths present at base, each appended): one finding per path, in `developer`, both hashes 16-hex, nothing restored, nothing in qa. **Read with R49:** for a path **absent** at base (as in the candidate's own CA-4f test), the "after" is `lstat` facts, not a hash (§11.2) | **pass**, as read with R49 |
| **CA-4g** | Global on/off: probe H at A4 and under M-L0. XDG on/off: the cand. test and M-L0. Repo-local: refused by layer 2; **M-L2 kills that row** | **pass** |
| **CA-4h** | Cand. tests pass. **R18 is met by the pair:** M-R18 alone **survives**; under M-L2 alone the R18 row fails "expected undefined to be 'stage-changed-config'"; under **M-L2+M-R18** it fails "expected 'runtime-git-failed' …". Resolve-late mutant: not constructed (§7) | **pass** (by the pair) |
| **CA-4i** | Cand. tests pass. **M-backstop kills both CA-4i rows** | **pass** |
| **CA-5** | Cand. tests pass on 2.54. CI prints `✓ … on this git (git version 2.55.0)`. **M-L2 kills the 2.54 row.** Per-stage snapshots remain **untested by this runtime** | **pass** |
| **CA-6** | Cand. tests pass; POSIX normal and error rows **`✓` on CI**. **D-A3, verbatim, from this seat's probes at 23:29Z:** SINGLE: "developer exceeded its bound after 3138ms. The kill that ran: taskkill /PID 16108 /T /F exited 0. That is the kill's own result, not a census of descendants. A double-forked process can survive it (named limit; the double-fork is not closed)." DFORK: the same four sentences with 4131ms and PID 15328, then the `post-commit` record. The double-forked heartbeat (PID 2272) **grew 19 → 25 bytes** after the loop with its PID alive; the probe then killed it. The text claims no more than the kill did. M-R22 not run (POSIX) | **pass** |
| **CA-7** | Cand. tests pass (5 rows). M-2.5-refuse-node, which stops every process role, turns all five red | **pass** |
| **CA-8** | Cand. test passes. **Probe COMPOSE:** one record naming `post-commit` created **and** `refs/heads/main was DELETED during this stage (it pointed at 51eea1b1d43b)`; `FAILED.md`; HEAD resolves; `main` = `51eea1b1…`, the value the record names; the hook removed; the marker empty. **M-L2, M-L2-order and M-endstate each kill it** | **pass** |
| **CA-9** | The pin test **ran and passed here**; on CI it is `↓`, read per test. The real run is candidate A's and was not repeated (**attributed**, as in reports A, A2, A3). A4 does not touch the adapter | observation; pin **pass** |
| **CA-10** | Cand. tests pass. **M-CAS kills** the refuse-and-report row; **M-endstate kills** D4 and D2 | **pass** |
| **CA-11** | Cand. test passes. **Qualification:** "config outside the repository" and "link-typed watched paths" are qualified by **A4-1** (a read through a final-component base link's swapped target) | pass as written; **qualified** |
| **CA-12** | §5 and §6: suite **exit 0**, 1121 passed, 10 skipped, peers idle; CI **success**, read from the run; `sync --check` exit 1 on the same 3 pre-existing issues, 0 skipped, index and build at HEAD | **pass** |
| **CA-13** | 0 lines | **pass** |
| **CA-14** | Cand. tests pass. **Probes DMGhead and DMGindex:** `runtime-git-failed` and `FAILED.md`, each naming the failing call (`git for-each-ref …`, `git status --porcelain=v1 -z --untracked-files=all`), each saying "This is a RECORD, not a repair". **M-backstop kills both** | **pass** |
| **CA-15** | §3 | **FAIL**: clause 3 (A4-1). Clauses 1, 2, 4 and 5 pass on every probe |

## 3. CA-15 in detail

### 3.1 The loop probes on win32, four trees

**Method.** `probe15-a4.mts` (§13) is report A3's `probe15.mts` byte-for-byte plus ten shapes added by this seat. It
runs full loops with a stub developer whose one act is the plant, and a stub qa whose one act, where named, is an
edit. Each run sets `HOME`, `USERPROFILE`, `XDG_CONFIG_HOME` and `GIT_CONFIG_SYSTEM` to scratch paths, asserts the plant
inside the role, lists every victim by `lstat`/`readdir` before and after, and searches a unique token in the
repository including `.git` (an `lstat` walk that never enters a link), `FAILED.md` and the `LoopResult`.
A4 ran 22:02:01Z, A3 22:03:07Z, A2 22:04:09Z and A 22:05:15Z, each exit 0 with empty stderr.

**The token's known positive:** the victim itself, 2 hits for directory victims and 1 for file victims at A4, A3 and
A2. **At A4 the token is found nowhere the runtime writes, in any probe.**

| Probe | A4 `f9a1aa8` | A3 `5010199` | A2 `2add792` | A `3b19287` |
|---|---|---|---|---|
| base: junction at `.git/hooks` at base | `LoopRefused link-at-base`; no tags, HEAD unmoved, no `artifacts/`; victim unchanged | the same | the same | **not refused**, completed |
| base control | completes | completes | completes | completes |
| (a)1 junction at `.git/hooks` | `stage-changed-config`, `FAILED.md`; a real `dir` after; victim unchanged; root named "modified (dir → type:symlink readlink:<victim>)" | the same | the same, root not named | canaries deleted, link left |
| (a)2 junction at `.git/info` | as (a)1 | the same | the same | canaries deleted, link left |
| (a)3 junction entry `.git/hooks/sub` | `created (absent → type:symlink …)`, link removed, absent after; victim unchanged | the same | the same | completed, link left |
| (a)4 linked worktree, `<git-dir>/info` absent at base | `stage-changed-config`; absent after; victim unchanged | the same | **completed, `dir[]` left** (A2-2) | victim written |
| (a)4pre, with `info/exclude` at base | fails; root named; `dir[exclude]` after | the same | root not named | victim written |
| (a)5 junction at `.git` | "ancestor link … No restore was claimed beneath the ancestor link"; victim unchanged | the same | the same | `runtime-git-failed`; victim written |
| (a)6 hard link at `.git/config` | `nlink` 2 asserted; "identity:… nlink 2; not read"; victim bytes unchanged, `nlink` 1 after | the same | victim's hash in the record | victim **overwritten** |
| (a)6 hard link at `hooks/pre-commit.sample` | the same shape | the same | victim's hash | overwritten |
| R35 control: junction at `$XDG_CONFIG_HOME/git` at base | proceeds; base note with type and target | the same | no note (A2-4) | no note |
| machineNext | victim hashes in no record | the same | in the record (A2-1) | in the record |
| machineHard | "identity change … not read" both stages; hashes in no record | the same | in the record | in the record |
| **machineHardAbsent** (A3-1) | **hashes in no record** | **in the record (known positive)** | in the record | in the record |
| **r35chainJ** (A3-2) | **hashes in no record** | **in the record (known positive)** | in the record | in the record |
| **r35chainH** (A3-2) | **hashes in no record** | **in the record (known positive)** | in the record | in the record |
| **baseHard** (A3-3) | **completes**; outside file unchanged | **fails at `planner`** (known positive) | completes | completes |
| `.git` junction at base → the real git dir | `LoopRefused link-at-base` | the same | the same | `dirty-tree` |
| `.git` junction at base → a non-repository | `not-a-repo`; victim unchanged (D-A2-7, carried) | the same | the same | the same |
| **newHook** (new, R49 repo) | **hook's hash in no record**; removed | hash in the record | hash in the record | hash in the record |
| **baseHardCfg** (new, R50 at `.git/config`) | **completes**, no exception text | **fails at `planner`, exception text in the record** | completes | completes |
| **baseHardEdit** (new: base hard link at a hook sample, role edits its bytes in place) | `stage-changed-config`; watched file back to base bytes with `nlink` 1; **the outside file holds base + the role's edit** (the runtime did not write it) | fails at `planner` (A3-3) | as A4 | **the outside file = the base bytes: the runtime wrote the snapshot back THROUGH the hard link** |
| **r54Twice** (new: developer hard-links `.gitconfig` to v1, qa re-links to v2) | one finding in developer, one in qa; neither hash recorded | the same | both hashes recorded | both recorded |
| **r54Revert** (new: qa puts the original back) | one each; v1 not recorded | the same | v1 recorded | v1 recorded |
| **machineReplace** (new: `.gitconfig` replaced by a new file, rename-over) | "identity change … not read"; new file's hashes in no record | the same | recorded | recorded |
| **plannerPlant** (new: the plant in the **planner** stage, report A3 §8) | one finding, in planner; victim hashes (3) in no record | the same | all recorded | all recorded |
| **r35anchor** (new: `$XDG_CONFIG_HOME` itself a junction at base; beyond it, `git` junctioned to a victim) | "type change … not read through"; hashes in no record | **recorded** | recorded | recorded |
| **hooksReplacedHard** (new: `.git/hooks` renamed aside, a new real dir whose sample is a hard link to a victim) | detected; victim's hash not recorded; victim unchanged | the same | hash recorded | victim overwritten |
| **ca4fBase** (new: CA-4f with all three paths present at base) | each path once, in developer, both hashes 16-hex; not restored | the same | the same | the same |

**Known positives.** A3-1, A3-2 and A3-3 are red at A3 and green at A4 **by the same expressions**. Of the ten new
shapes, **newHook, r35anchor and baseHardCfg** are red at A3, and **baseHardEdit** is red at A (a write, clause 3) —
each is counted as a transition there. **r54Twice, r54Revert, machineReplace, plannerPlant and hooksReplacedHard**
are red at A2 only (A3 already passes them); **ca4fBase** has no red at any SHA and is **not counted as a
discriminating pass**; it is M-R54's probe (§4), which is where it discriminates.

**The canaries in both directions (R29).** Write and delete: every victim listing is equal before and after at A4 in
every probe. Read, by the token: nowhere at A4. Read, by the hash: clean at A4 on win32 — A4-1 is POSIX-only (§3.2).

### 3.2 On CI's Linux: this seat's probe branch (A4-1 and R52's rows)

Branch **`qa/loop-15-slice-3-a4-probe` = `9f58fbc`**: `f9a1aa8` plus one file,
`open-brain/tests/harness/qa89-a4-probe.test.ts` (8 tests, all `skipIf(win32)`; loaded here as 8 skipped). Pushed
under D-038 and read back with `ls-remote`. **Never for merge; no PR.** Run **`35928008495`** (workflow_dispatch,
22:22:48Z → 22:25:19Z, head `9f58fbc`, git 2.55.0, conclusion failure): **76 files, 4 failed | 1129 passed | 6 skipped
(1139)**; the four failures are all in the probe file; no other test failed; no `Errors` line. Read per test from
the log with ANSI codes stripped; every observation is also printed as a `QA89-…` line:

| Probe test | CI | Printed |
|---|---|---|
| A4-1 CONTROL (base target edited in place) | `✓` | hash `65dcb2c175d6f8c0` expected and found as the "after" |
| A4-1 H | **`×`** | `inRecord: {hv: true, hv2: true}` |
| A4-1 J | **`×`** | `inRecord: true` |
| A4-1 R | **`×`** | `inRecord: true` |
| A4-1 LOOP | **`×`** | status `completed`; `inRecord: {hv: true, hv2: true}`; the base note names the link |
| B3 row shape | `✓` | `umask 22`, `.git/config` mode `644`, hook snapshot `755`, instrument (chmod through a link) sees `true`, victim `644` after, bytes unchanged |
| R29 row shape | `✓` | known positive: a base file made `000` → "unreadable" in the record; a link to a `000` victim → "type change … not read through", no "unreadable" |
| R35 on Linux | `✓` | proceeds; base note with type and target |

### 3.3 R52: the candidate's five POSIX tests, read from the source and from CI

All five print **`✓` on CI** (`35922231710`), passed and not skipped. Read against the rows:

| R52 item | Row asks | The candidate's test | Measured in the row's shape (§3.2) |
|---|---|---|---|
| (b)3 `chmod` through a link | a symlink **as an entry inside `.git/hooks`** where the snapshot recorded a hook; victim `0644`; mode unchanged | plants at **`.git/config`**. The snapshot's mode is `644` on CI, equal to the victim's, so a followed `chmod` would leave the victim `644`: **the mode assertion cannot fail there.** The bytes assertion can (it would catch A's in-place write). No `isSymbolicLink` plant assertion | **pass** (hook entry, snapshot `755`, victim stays `644`) |
| (b)4 file-symlink form | reported as a type change naming the path; not read; victim unchanged | asserts "not read", hash absent, victim unchanged; no plant assertion | not re-probed (the candidate's assertions are discriminating by the hash) |
| R29 mode-000 read run | a **link** to a `000` victim; a read through it would surface as an error; the record carries none; `EACCES` shown first; fails rather than skips | `EACCES` shown first and fails rather than skips: **met**. But **no link is planted**: the watched `.gitconfig` itself is `000` at base, and "the bytes are not recorded" holds because the read **failed** — the flattering direction the row names | **pass** (link planted; no "unreadable"; known positive shows "unreadable") |
| in-test controls | in each (b) test: the plant asserted; a write through the link changes the victim; the role's act without the runtime leaves it unchanged | one **separate** test with its own victims, not the (b) tests' | — |
| R35 on Linux | proceeds **and** the record carries the link's type and target | asserts only that it proceeds | **pass** (record asserted) |

**This is A4-2.** The behaviour R52 asks about is present on Linux, shown by this seat's probe. Three of the five
candidate tests would stay green if it were not.

### 3.4 R49 by the code path (QA report A3 §14.2)

At `f9a1aa8` the only byte reads in `configwatch.ts` are `readState` (`:353`) and `MachineConfigWatch.snap`
(`:930`). Every caller after preflight is gated: `closeAndRestore` → `readForCompare` (`:527`) →
`repositoryResolutionDiff` (`:252`) before `readState`; `begin`/`compare` → `resolutionMismatch` (`:818`) before
`snap`. The post-restore read-back (`:632`) reads the runtime's own renamed-in file. `listTree` does not enter links.
No `rmSync`, no recursive remove (R24). **Two things the code shows that the probes alone would not:**
- **A4-1's mechanism** (the verdict section): the gate compares `lstat` of lexical components, so a final link's
  target is outside the resolution.
- **The record's "not read" is written by attribution, not by the gate.** `compare` (`:973`) reads with `snap` when
  the resolution matches base, and `attributionChange` (`:863`) then reports a component change through
  `mismatchFinding`, whose text says "not read". In **r54Revert**'s qa stage the file is back at its base resolution,
  so it **was** read, and the record says "identity change … not read" (A4-3). The same mechanism is why A4's three
  single-stage R49 machine tests stay green under **M-R49-machine** (§4): the mutant reads, and the record still
  says "not read".

## 4. Mutants

Each mutant is a `git archive f9a1aa8 open-brain` copy with a `node_modules` junction (one is on `5010199`, named).
Every edit was asserted to occur exactly the expected number of times and read back from disk. **Each counted
mutant is `tsc --noEmit` exit 0.** Type-check control: a planted TS2322 gives exit 2. **One first draft was
type-invalid** (M-R50+agrees, TS18047); it was deleted (junction removed first) and rewritten as M-R50+agrees-v2, and
is **not** counted in its first form. Results were read from the JSON reporter over the six row files (160 tests),
22:17:17Z → 23:28:04Z, sequentially; no mutant run printed an unhandled error.

| Mutant | Edit | Red tests (of 160) | Its probes |
|---|---|---|---|
| M-L0 | `GIT_CONFIG_GLOBAL`/`NOSYSTEM` removed | **2**: CA-4c's own row, CA-4e | probe H: filter ×3 inside the runtime |
| M-L1 | the `-c` pair and `LAYER1_ENV` removed | 0: survives alone (expected) | — |
| M-L2 | `closeAndRestore` never called | **15** | — |
| M-L2-order | `enforceAllowlist` before the restore | **4**: garbage config, CA-8, (b) rollback, D4. fsmonitor row **green** | — |
| M-L2-order + M-L1 | both | **7**, **including the fsmonitor row**: layer 1's job shown | — |
| M-R18 | pinning removed | 0: survives alone | — |
| M-L2 + M-R18 | both | 15; the R18 row changes from "undefined" to `runtime-git-failed`: the pair | — |
| M-R16 | a second `spawnSync("git", …)` in `runCheck` | **7** | — |
| M-R15 | the check's env merged with `process.env` | **1** (CA-2.6) | — |
| M-backstop | the catch rethrows | **4** (CA-14 ×2, CA-4i ×2) | — |
| M-CAS | `setRefTo(…, null)` | **1** | — |
| M-endstate | reset to `stageBase~1` | **5** | — |
| M-L2-norestore | restore removed, detection kept | **19** | (a)1, (a)3, (a)5, (a)6config: **every victim unchanged** — the role's act alone never touches a victim |
| M-follow-a | A2's `lstat` guard reverted (7 edits) | **6** | (a)1–(a)3, (a)4pre: **the link left** (clause 2); victims unchanged |
| M-follow-b | `linkAboveWatched` → `null` | **2** | (a)5: `runtime-git-failed` |
| M-follow-c | the restore writes in place | **3** | (a)6config, (a)6hook: **victims overwritten**; **baseHardEdit: the outside file = base bytes** (written through) |
| M-R44 | `captureBase`'s once-guard removed | **1** (R44) | machineNext, machineHard: hashes back in the record |
| M-R45 / -record / -mkdir | as report A3 | **1** each (R45) | (a)4: M-R45 completed with `dir[]` left; -record completed with nothing recorded; -mkdir a record, but `dir[]` left |
| M-R46-root | a base-dir root not pushed | **1** | (a)1, (a)2, (a)4pre: root not named |
| M-R46-basenotes | final component only (re-derived for `recordChain`) | **1** | r35base: no note |
| M-R43-repo | both identity refusals in `readState` removed (re-derived for A4's two lines) | **0: survives alone** | (a)6 ×2, hooksReplacedHard: still not read (R49's gate catches them first) |
| **M-R49-repo** | `repositoryResolutionDiff` returns `null` | **1** (its own test) | **newHook: the hook's hash in the record**; a6config not (R43 still refuses) |
| **M-R49-machine** | `resolutionMismatch` returns `undefined` | **1** (the R44 test). **A4's three R49 machine tests stay green** (§3.4) | **all 7 machine probes read through**: machineHardAbsent, r35chainJ, r35chainH, machineHard, machineNext, r35anchor, machineReplace |
| M-R49-both | both | 2 | newHook, machineHardAbsent, r35chainJ red |
| **M-R49-repo + M-R43-repo** | both repository guards | **2** (R43, R49 repo) | **a6config, a6hook, hooksReplacedHard: the victim's hash in the record** |
| **M-R54** | attribution against the loop base | **2** (CA-4f's main row, R44) | **ca4fBase: each path reported twice (developer and qa)**; r54Twice, plannerPlant unchanged |
| **M-R50** | begin does not read a base hard link | **1** (R50) | baseHard, baseHardCfg: **fail at `planner`** (A3-3 back) |
| **M-R50+agrees-v2** | and `agrees` dereferences null | **1** | baseHardCfg: **the exception text in the record** |
| **M-R51-refuse-cmd** | every `.cmd` refused | **4**, **including the 2.5 planted control** | — |
| M-R51-refuse-cmd **@ A3** | the same edit on `5010199` | 3: **the 2.5 planted control stays green** (A3's bare `.js` never reached the `.cmd` path) | — |
| M-2.5-refuse-node | node-entry refused | **16**, incl. the 2.5 control | — |
| M-2.5-accept-cmd | a `.cmd` with no target accepted | **2**: the control's twin, the win32 refusal row | — |

**One mutant per protection (R32, R49, R54).** Each A4 protection is killed by its own mutant on its own probe:
R49 repository (newHook), R49 machine (7 probes), R54 (ca4fBase and CA-4f's row), R50 (baseHard/baseHardCfg), R51
(the 2.5 control, with the A3 contrast). **R43's repository half is now redundant by construction behind R49** for the
shapes probed: M-R43-repo alone survives, and only the pair reads through the hard link. It is stated, not claimed
as a protection. **M-R49-machine is killed by one candidate test (R44's) and by this seat's probes**, not by the
three tests written for it (A4-2).

**Not run:**
- **M-R22:** POSIX-only, no POSIX machine here.
- **The CA-4h resolve-late mutant:** not constructed, as in reports A2 and A3.
- **The CA-5 snapshot-timing mutant:** not applicable; the runtime's writes never touch `.git/config`.
- **A mutant for A4-1:** none is needed; it is the candidate's own behaviour, measured on CI.

## 5. Full suite and CI (CA-12)

**QA full suite at the candidate: 23:32:11Z → 23:34:45Z, `SUITE_EXIT=0`, captured unpiped (`npx vitest run > file;
SUITE_EXIT=$?`), from `~/Worktrees/sia-qa/open-brain` at `f9a1aa8`.**
- `Test Files  75 passed (75)`, **`Tests  1121 passed | 10 skipped (1131)`**. No `Errors` line; 0 matches for
  `Unhandled|onTaskUpdate`. Duration 149.14 s; cumulative test time 691.58 s.
- The total 1131 equals CI's. Here the ten skips are the POSIX `skipIf` rows; on CI the six skips are the win32
  and real-`claude` rows.
- The planner's GO, 23:31Z, with its own measurements: 0 of 43 listening sockets on 3210/4000/5173 (A2A-Hub stopped),
  the planner idle with nothing running, and one unrelated session in another project, idle.
- Peers (`ListAgents`):

  | When | sia-planner-6b | 3d-printers-f8 (another project) |
  |---|---|---|
  | before (23:32Z) | idle | idle (started 31m ago) |
  | after (23:34Z) | idle | idle (started 34m ago) |

- **G-042 did not appear.** The worktree is recorded as the dispatch asks: **`~/Worktrees/sia-qa`**. The developer's
  two runs in `~/Worktrees/sia-forge` exited 1 on the `onTaskUpdate` heartbeat only (at `2db806a`, with the hub
  stopped) — their testimony, not reproduced. One idle clean run here; the worktree remains a suspect, not a finding.

**CI run `35922231710`** (pull_request, head `f9a1aa84…`, **success**, 21:24:25Z → 21:27:00Z), read from its log with
ANSI codes stripped: `git version 2.55.0`; `Test Files  75 passed (75)`, `Tests  1125 passed | 6 skipped (1131)`; no
`Errors` line; **1125 `✓` and 6 `↓` lines, 0 `×`**. The six skips are the win32 R41 and R35 rows, the win32 2.5
refusal, the real-`claude` 2.5 control, CA-9 and the win32 CA-6 limit row — each a `skipIf` true on Linux.
**Printed, not derived:** CA-15 (b)1, (b)2, (b)6 `✓`; the Linux R35 row `✓`; all four R49 tests and the R50 test `✓`;
**the five R52 tests `✓`**; the 2.5 planted control `✓`; CA-6 POSIX normal and error `✓`; CA-5 "on this git (git
version 2.55.0)" `✓`.

**The developer's full-suite runs** (the handoff's table) are testimony and were not reproduced; this seat's
measurement is above.

## 6. `/sync --check` (CA-12)

- **`gitnexus analyze`** in the QA tree: one run, exit 0; `meta.json` `lastCommit` = `f9a1aa8…`, read from the file.
- **`sync --check` in the QA tree: exit 1**: `25 passed, 0 fixed, 2 warnings, 3 issues, 0 skipped`.
  `gitnexus-index` passed ("index is at HEAD (indexed f9a1aa8 …)"); `build-freshness` passed ("build matches HEAD
  f9a1aa8").
- The issues are `prd-version`, `summary-version` (views at v0.44.0, rev 84) and `retirements` (ENTITIES.md names
  `dream` and `reflection queue`), the same three as reports A, A2 and A3. **All three issues' inputs are
  byte-identical** between `5010199` and `f9a1aa8`: `git diff --quiet … -- .agents package.json open-brain/package.json
  CHANGELOG.md README.md` exits 0. **Control:** `open-brain/src/harness` differs, exit 1.
- **Plain `sync`, in a scratch clone** (`git clone --no-hardlinks` of the QA repository, detached at `f9a1aa8`, its own
  build): `sync --check` there **exit 1** (23 passed, 2 warnings, 3 issues, 2 skipped); plain `sync` **exit 0**, "23
  passed, 2 fixed, 2 warnings, **1 issues**, 2 skipped", rewriting five tracked `.agents` files in the clone. CA-12's
  point is reproduced. The two skips are the clone's (no `.gitnexus/`, a local-path origin). The QA tree was never
  written.

## 7. What could not be verified, stated so nobody inherits it as settled

1. **A4-1 at A3 on POSIX.** "Not a transition" is read from the code (A3 has the same final-component shape). A3's
   POSIX behaviour was not run.
2. **A4-1's full reach.** Measured on `~/.gitconfig` (global). By the code the XDG file and the system file behave the
   same when their final component is a link at base, and so does any chain of links starting there. Not run.
3. **M-R22** and the **CA-4h resolve-late** mutant.
4. **CA-9's real run** is carried from candidate A and attributed.
5. **The race R37 names** (and the handoff's non-atomic compare-then-open limit) was not probed.
6. **The declared unrunnables U1–U6** (criteria §3).
7. **The repository side's R49 baseline between stages** (§11.3): reachable, by the code, only by a process that
   outlives its stage (U3). Not probed.
8. **A4-3 is read from the code**, not observed as a read: the record cannot show a read it hides, and this seat did
   not instrument `readFileSync` in that run.

## 8. What the checks I ran cannot see

- **One machine for everything but §3.2.** Every local probe and mutant ran on win32 with git 2.54. Linux coverage is
  CI's unmutated rows plus the one probe run.
- **Stub roles, one act each.** The added shapes are this seat's reading of clause 3 and R49; the class is
  "anything in the resolution, including through a base link". A4-1 was found by reading the code first. Other
  shapes may exist that neither the code reading nor the probes reached.
- **Traceless reads.** A read whose result is discarded, or hidden behind attribution text (§3.4), is visible only by
  the code path. The probes see hashes in records.

## 9. Defects, each with the observation that produced it

| # | Severity | Defect | Observation |
|---|---|---|---|
| **A4-1** | **medium (clause 3; R49)**, the same class as A3-1/A3-2 | when the **final component** of a machine-config path is a link at base (R35's dotfiles case), the link's **target** is outside the compared resolution; a role that swaps the target (hard link, directory link, rename-over) has the outside file read and its hash recorded | §3.2, CI `35928008495`: H, J, R, LOOP `×` with the victim's hashes as printed; the in-test control `✓` |
| **A4-2** | low (test quality; R52, and M-R49-machine) | three of R52's five candidate tests cannot fail as written on CI: (b)3's mode assertion (snapshot `644` = victim `644`, at `.git/config` not a hook entry), R29 (no link planted; absence caused by `EACCES`), R35-Linux (the record is not asserted); the controls are one separate test. And A4's three R49 machine tests stay green under M-R49-machine | §3.2 (umask `22`, config `644` printed), §3.3, §4 |
| **A4-3** | low (record text; clause 4) | a machine-config finding says "not read" when the runtime **did** read the file: attribution's text is independent of the gate | §3.4: r54Revert's qa stage, by the code at `:973` and `:863`; the same mechanism hides M-R49-machine's reads |
| D-A2-7 | low (carried, R42) | a `.git` junctioned at base to a non-repository is recorded `not-a-repo` | the same at A4 |
| D-A5 | carried (R42) | — | — |

**A3-1, A3-2 and A3-3 are fixed** as scoped (§3.1). **R50, R51 and R54 are met.** **R52's behaviour is present; its
tests are A4-2.**

## 10. Regressions: previously validated behaviour confirmed still working

- The six candidate row files at A4 (150 passed), CI's full run (1125 passed) and this seat's full suite (1121
  passed). They include G-045's rows (`refwatch-stage`), slice two's refusals (`runtime.test.ts`) and every
  candidate-A row (`config-channel.test.ts`).
- Report A3's non-link probes, re-run at A4 as `probe2.mts`: H, R34, SINGLE, DFORK, DMG ×3 and COMPOSE. Every outcome
  matches report A3's apart from PIDs, timings and hashes.
- Every A3 CA-15 probe outcome that passed at A3 still passes at A4, and each of A3's mutants reproduces report A3's
  count here (§4).
- **One behaviour change that is not a regression by any row:** a regular file created in a watched repository tree
  is now recorded as `identity:… not read` instead of by its hash (R49). CA-4a's detection and restore are
  unchanged.

## 11. Where the criteria, the rulings and the candidate disagree

1. **A4-1 and R49's anchor wording.** R49: "every component from its anchor down to the file, **and through any link
   that was there at base**." A4 reads "through" as "`lstat` of the lexical path resolves intermediate links". The
   final link's own target — and that target's components — are not recorded. This seat reads R49 as including them,
   and so does the planner, in its A2A reply to this seat's CI request (told, not a ruling: "'through any link that
   was there at base' includes the final component's target"). **Returned** only in case a ruling wants the chain's shape stated for the next candidate: the anchor
   rule for a link **at** the final component, and whether a link's target chain is walked to its own root.
2. **CA-4f's "both hashes" versus R49 for a path absent at base.** CA-4f requires "the path and both hashes". R49
   says a path absent at base is never read after a role has run, so its "after" is `lstat` facts. The candidate's
   own CA-4f test creates two of its three paths (absent at base), and asserts path and stage, not hashes. This seat
   scored CA-4f **as read with R49** (rulings-10 is read with the criteria), and measured the both-hashes case with all
   three paths present at base (ca4fBase). **Returned** so the next criteria amendment can say it.
3. **R49's "as recorded at preflight" on the repository side.** `ConfigWatch.begin` (`:509`) records the chain **and
   reads every watched file, hard links included (`readState(f, undefined, true)`), at each stage's start**
   (`runtime.ts:948`). So the repository side's R49 baseline is each stage's window open, not the loop's preflight.
   Layer 2 restores at every stage close and a detected change ends the loop, so between stages only a process that
   outlived its stage could make them differ — U3 on win32's normal-exit path, and not POSIX, where the group is
   killed. **Returned, not scored:** is a per-stage repository baseline within R49's letter, or should the read at
   `begin` be gated against the loop's base too?
4. **R52 as "candidate tests".** R52 assigned the POSIX items as tests. The tests exist and pass on CI, and the rows'
   behaviour is present (this seat's probe). This seat did **not** fail CA-15 on A4-2, because each row's pass clause
   is a behaviour and the behaviour was measured; it is reported as a defect so the next candidate's tests can fail.
   **Returned** in case the planner reads R52 as requiring discriminating tests as the pass condition.
5. **Seen, not A4's, pre-existing since `3b19287`:** `rollBack` (`runtime.ts:1019–1021`) returns "The offending paths were
   reverted." whatever its list of paths holds: `if (bad.length > 0)` guards only the `revertPaths` call, read from the
   code. The sentence appears in config-only records such as a6config's; this seat did not check whether that run's
   list was empty. Not a CA-15 channel; recorded because "pre-existing" says when, not whether it matters.

## 12. This seat's error entries and near-misses this session

**Error entries (escaped):** none known.

**Near-misses (caught in-process, not numbered):**
- **One type-invalid mutant draft** (M-R50+agrees, TS18047), caught by `tsc` before any run, deleted and rewritten.
- **Quoting layers, three times:** a `node -e` whose regex backslashes the shell ate (SyntaxError, failed loud; the
  script was written to a file); a `cmd //c mklink /J` that `cmd` parsed as an invalid switch (the junction was made
  from Node instead); an extraction `mv` into a directory that already existed, which nested the scripts one level
  down (caught by the blob check before any script ran).
- **The recall trigger fired entry 299 (pipe-to-tail) three times** beside commands whose exit codes were already
  captured unpiped; each was read and not applicable. T-170's question: here it did not need to change behaviour.

## 13. Reproduction

The scripts are tracked at **`docs/loops/qa-scripts-a4/`** on this branch, byte-identical to the copies that ran,
with a README. The probe test is on `qa/loop-15-slice-3-a4-probe` (`9f58fbc`).
- **`probe15-a4.mts <tree> <probe…>`**: report A3's `probe15.mts` plus newHook, baseHardCfg, baseHardEdit, r54Twice,
  r54Revert, machineReplace, plannerPlant, r35anchor, hooksReplacedHard and ca4fBase. `tabcmp.mjs` and `rec.mjs`
  summarise.
- **`probe2.mts`**: unchanged from report A3.
- **Mutants:** `mutants-a4.mjs` (a `{sha, edits}` entry archives another SHA), `build.mjs` (archives, asserts each
  edit landed, runs `tsc`), `runmut.sh` (the six row files with `--reporter=json`, then each mutant's probes),
  `tabmut-a4.mjs` and `failmsg.mjs` summarise.
- **A4-1 in three lines (POSIX):** `HOME/.gitconfig` a symlink to `dot/gitconfig` at base; in the developer stage,
  replace `dot/gitconfig` with a hard link to an outside file; read `machineConfigFindings`: the outside file's
  sha256/16 is the "after".

## 14. Handoff to the next QA session (D-035)

1. **Re-run every probe in §3.1 against the next candidate, A4 and A3**, and the probe branch's file on CI (D-040
   lets a seat dispatch CI on its own branch). For A4-1, **A4 `f9a1aa8` is the known positive**, measured in
   `35928008495`; the in-test control is the instrument's positive.
2. **Read R49 by the code path**, and look for a sibling of A4-1 before scoring: the resolution must include what a
   base link points at, at any component, including the last. Code first, then a probe.
3. **Hold the candidate's tests to the row's shape** (A4-2): print the value that makes an assertion able to fail
   (for (b)3, the snapshot's mode against the victim's), and plant what the row says to plant.
4. **Mutants reproduce A3's specs with two re-derivations** (M-R46-basenotes, M-R43-repo) and A4's six own; the
   builder refuses a stale `find` count. Expect M-R43-repo to survive alone behind R49.
5. **Plain `sync` only in a scratch clone.** `gitnexus analyze` needed one run this time; read `meta.json` anyway.
6. **Nothing is pushed except this seat's own branches (D-038); the merge is Aaron's.**
