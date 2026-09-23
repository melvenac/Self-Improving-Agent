# Loop 15 slice three — QA report A3: candidate A3 `5010199`: REJECTED

**By:** Probe (QA seat), record session **87** (T-164: assigned by the planner; the greeting's per-worktree
counter said 9 and is not used) · **Date:** 2026-09-23 (UTC).
**Model and effort, from this session's host transcript**
(`~/.claude/projects/C--Users-melve-Worktrees-sia-qa/b8f3dd8e-f610-451f-b5d9-4152c3e33f24.jsonl`, parsed as JSON):
every assistant entry carries `"model":"claude-opus-5-5"` and `"effort":"high"`, 237 of 237 at 20:12:58Z.
**Criteria:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` at **`6672e83`** (FINAL), read with
`loop-15-slice-3-rulings-9.md` on master (R42–R48). As rulings-9 says, R43 amends R36 and R44 amends R39. Rows
are scored **as written**.
**Candidate (frozen):** **`50101992e0bd6c79c8f18f0b62f78a459aebee2b`** on `origin/loop/15-slice-3-candidate-a3`
(draft PR #127). It is eight commits on A2 `2add792`, one per item:

| Commit | Item | Files |
|---|---|---|
| `6293e56` | R44 | `configwatch.ts`, `runtime.ts`, `configwatch-links.test.ts` |
| `7df731a` | R45 | `configwatch.ts`, `configwatch-links.test.ts` |
| `a7755ab` | R46 | `configwatch.ts`, `configwatch-links.test.ts` |
| `d333534` | R43 | `configwatch.ts`, `configwatch-links.test.ts` |
| `e801849` | R47, CA-2.5 | `process-role.test.ts` |
| `35326f1` | R47, CA-4c and R34 | `config-channel.test.ts` |
| `7b6312a` | R48 | `.github/workflows/ci.yml` |
| `5010199` | D-A2-6 | the handoff only |

Every commit also touches the handoff. Built by Grok 4.7 in Cursor, developer record session 86. Handoff:
`docs/loops/loop-15-slice-3-a3-developer-handoff.md` at `5010199`, read in full.
**Transition controls:** A2 `2add792` and candidate A `3b19287`. Each is a `git archive` copy in this seat's
scratchpad, with a `node_modules` junction. **A3 itself was also probed from an archive copy**, so the three
trees are measured the same way. Each copy's `configwatch.ts` was blob-compared to its SHA (`git hash-object`
against `git rev-parse <sha>:<path>`): equal for all three. The control is A3 against A2: different.
**Scored in:** `~/Worktrees/sia-qa`, detached at the frozen SHA from 19:02:39Z. Environment: git
`2.54.0.windows.1`, Node v22.23.2, win32. CI is run `35905810998` (Linux, git 2.55.0).
**Context read in full:** rulings-9, the A3 brief and report A2 (all on master `e0fbffb`); the criteria at
`6672e83`; the A3 handoff; and A3's source and test diffs against `2add792`.

---

## Verdict: REJECTED. Every A2 defect is closed, and CA-15 clause 3 still fails on three shapes A3 does not cover

**What A3 fixed, measured.** Each of rulings-9's items was probed at A3 and at both transition SHAs, and each
has its own mutant (§3, §4):

| Item | Defect at A2 | At A3 | Evidence |
|---|---|---|---|
| **R44** | A2-1: the next stage read the victim through a machine-config link planted in the previous stage | **closed** | machineNext: in both stages the record says "type change … not read through", and the victim's before-qa and after-qa hashes are in no record. At A2 both hashes are there |
| **R45** | A2-2: an absent tree root with a junction passed silently and left an empty directory | **closed** | (a)4: `stage-changed-config`, the record says "`<git-dir>/info` created (absent → type:symlink readlink:<victim>)", and the path is **absent** after the loop. At A2 the loop **completed** and left `dir[]` |
| **R46** | A2-3: a tree-root link was never named. A2-4: a parent-component link at base was not recorded | **closed** | (a)1, (a)2, (a)4pre name the root "modified (dir → type:symlink readlink:<victim>)". r35base's finding says "…\xdg\git is a link at base, type symlink, readlink …\dotfiles-git". At A2 neither appears |
| **R43** | A2-5: a hard-linked file was read before `nlink` was compared | **closed for a path that had a file at base** | (a)6 config and hook: "identity:dev … ino … nlink 2; not read", and the victim's hash is in no record. machineHard: "identity change … not read" in both stages. At A2 the victim's hash is the record's "after" |
| **R47** CA-2.5 (D-A2) | the control passed vacuously on CI | **met** | CI prints the planted control `✓` on Linux and the real-`claude` control `↓` (skipped). Both CA-2.5 mutants turn it red here |
| **R47** CA-4c (D-A4), R34 | M-L0 left the global row green; R34's value was not asserted | **met** | M-L0 turns CA-4c's own row red, and CA-4e's. Probe H under M-L0: the runtime ran the filter ×4. The test asserts `input`, and the system control reads `true` here |
| **R48** | per-test lines only for slow tests | **met** | `npm test -- --reporter=verbose`; the diff is one line in `ci.yml`. The CI log prints 1115 `✓` and 6 `↓` lines |
| **D-A2-6** | the handoff over-claimed | **corrected** | `runtime.ts:361` `rev-parse --is-inside-work-tree` precedes `dotGitLink` at `:366`, as the A3 handoff now says |

The A2 guards A3 kept (the restore never writes or deletes outside the repository; ancestor links; rename-over)
still hold. Every victim's listing is equal before and after in every probe at A3, and A2's three R32 mutants
are red again (§3).

**Why it is still rejected.** CA-15 clause 3 says: "After a role has run, no watched path, repository or
machine, is read THROUGH a link, an ancestor link or a hard link that was not there at base." R43 says it
"covers repository watched files **and** machine-config paths". Three probe shapes that this seat added
break it at A3, and each is measured, not inferred. The hash in the record equals the sha256/16 of the
victim's bytes, and it moves when the qa stage edits the victim:

| # | Shape | What happens at A3 | Clause / ruling |
|---|---|---|---|
| **A3-1** | `$XDG_CONFIG_HOME/git/config` is **absent** at base. The developer creates it as a **hard link** (`nlink` 2, asserted) to an outside file | developer stage: `absent → b985ed2371361dd8`. qa stage: `b985ed2371361dd8 → 5482a4749d0da6e9`. These are the victim's own hashes, before and after the qa role edited it. No identity finding | clause 3; **R43** (machine-config paths) |
| **A3-2** | A dotfiles link **at base**, `$XDG_CONFIG_HOME/git` → `dot`, which R35 allows. The developer then plants a link **beyond** it: (J) `dot` renamed aside and junctioned to a victim directory; (H) `dot/config` replaced by a hard link to a victim file | J: `ce144ddf2ce15745 → 520a965e2adea924`, then `→ 8ca35945fe5e2e92` in qa. H: `→ 53fbe767d3f71b56`, then `→ 5eef03e3693556f4`. These are the victim's hashes in both stages. Only the base note is recorded; no type or identity change | clause 3; **R44** ("a link planted in any stage is a change for the rest of the loop, and no later stage reads through it") |

**Neither is a transition** (§3): at `2add792` and `3b19287` all three shapes read the victim the same way.
They are A3's by the clause, not regressions. **Severity is the planner's to weigh.** It is the same class
as A2-5, which report A2 called medium: a 64-bit hash prefix of an outside file is recorded, and nothing is
written. The criteria bind as written, and clause 3 has no severity threshold.

**One more defect, which fails no row as written: A3-3.** The record is false, and the loop cannot run. A
**hard link already at a repository watched file at base** (`.git/hooks/pre-commit.sample`, `nlink` 2 at
base, and nothing in the loop touches it) makes an ordinary stub loop fail at the **planner** stage. The
record reads "modified (identity:dev … nlink 2; not read → 37ccc3441e392403/666/nlink:2)" and "2 FILE(S) COULD
NOT BE PUT BACK: … (snapshot was file; not followed); … (Cannot read properties of null (reading 'equals'))".
Nothing changed, the file was never restorable, and a JavaScript TypeError is printed in the record. At
`2add792` and `3b19287` the same loop completes. **Cause, read from the code:** `ConfigWatch.begin` calls
`readState(f)` with no baseline, so a base file with `nlink` ≠ 1 is snapshotted as `unreadIdentity` with
`bytes: null`. `changed()` then returns true on that flag alone, and `agrees()` dereferences
`now.bytes!.equals`. `repositoryLinksAtBase` does not look at `nlink`, so preflight does not refuse it either.

Every other row passes (§2):
- CI, reproduced from its log;
- the candidate's six row files (exit 0, 145 passed, 5 skipped);
- 26 type-clean mutants and a type-check control;
- the full suite (§5).

CA-15's POSIX sub-items that A3 was not asked to add are listed in §7 as unverified, as in report A2. Rulings-9
does not assign them (§11.2).

---

## 0. Rulings in force

| Source | Where |
|---|---|
| Rulings-1 to 8 | master (as cited by the criteria and report A2 §0) |
| **Rulings-9 R42–R48, D-A2-6** | master `e0fbffb` (merged by PR #125) |
| **The planner's dispatch to this seat** (A2A, received at session start, about 19:00Z): "Score the rows AS WRITTEN … Each CA-15 probe runs against A3, against 3b19287 AND against 2add792, in git archive copies … D-A2 (CA-2.5) and D-A4 (CA-4c, R34) are rows on the candidate this time … Take plain sync's exit code in a SCRATCH COPY" | Atlas (planner) to this seat. One link, planner → QA. No Aaron link |

## 1. Frozen-candidate conditions

| Condition | Observation | Result |
|---|---|---|
| criteria before candidate | `6672e83` is an ancestor of `5010199` (exit 0). **Control:** `d18a196` exits 1 | held |
| built on the release line | `5a1309e` (G-045), `f673d5e` (A's base) and `2add792` (A2) are ancestors, exit 0 each | held |
| A3's own diff | `2add792..5010199`: `configwatch.ts` (+178/−53 across the file set), `runtime.ts` (+3: `machineWatch?.captureBase()` at `:625`, before `baseNotes` and every stage), the three test files, `ci.yml` (1 line), and the handoff. Nothing else | as stated in the handoff |
| **tree moved** | HEAD = `5010199…` at 19:02:39Z, and again at each later read, through the report branch | **not moved** |
| **tree dirty** | 0 porcelain entries after the checkout, the build, the row files, `gitnexus analyze` ×2, `sync --check` and the suite. **Plain `sync` was run in a scratch clone, never here** (§6) | **clean throughout** |
| build | `npm run build` exit 0, stamped `5010199` at 19:02:59Z | current |
| **CA-13**, no version bump | `git diff <b> 5010199 -- package.json open-brain/package.json CHANGELOG.md`: 0 lines for `f673d5e`, `3b19287` and `2add792` | **pass** |

## 2. Rows

"Cand. tests" means the candidate's six row files: config-channel, configwatch-links, process-role,
spawn-sites, refwatch-stage and runtime. They were run here from 19:09:52Z to 19:11:44Z with the JSON reporter:
**exit 0, 150 tests, 145 passed, 5 skipped, 0 failed.** The five skips are the two POSIX CA-6 rows and the
three POSIX CA-15 rows, all `skipIf(win32)`. The real-`claude` 2.5 control and the CA-9 pin both **ran and
passed** here, read per test. "Probe" means this seat's scripts (§13), and mutants are in §4.

| Row | Observed | Verdict |
|---|---|---|
| **CA-1** | Cand. tests pass. **M-L2 kills both CA-1 tests.** Unchanged by A3 | **pass** |
| **CA-2.1–2.4, 2.6** | Cand. tests pass. **M-R15 kills 2.6** | **pass** |
| **CA-2.5** | **D-A2 fixed.** `process-role.test.ts:245` now plants a launcher on every platform and resolves it: form and executable asserted, with a refusal twin in the same test that must name its path. The real-`claude` control is its own `it.skipIf(!findOnPath("claude"))`, with the reason in its title. **CI (run `35905810998`, verbose):** "2.5 CONTROL: a planted launcher is accepted and resolved, and its refusal twin is not" **`✓`**; the real-`claude` control **`↓`**; CA-9 `↓`. **Locally:** all three passed. **M-2.5-refuse-node** (node-entry refused) and **M-2.5-accept-cmd** (a `.cmd` with no target accepted) each turn the planted control red. The POSIX branch's two directions are read from the source: `toBe(true)` on the script, and `toBe(false)` plus `toContain(bad)` on the directory. Both come before any return. **One deviation, returned in §11.1:** the win32 accepted control is a bare `.js`, not "the planted JS-entry shim above" (a `.cmd`). The `.cmd` → node-entry path is exercised on win32 by 2.4's own row (`:182`) | **pass**, with the §11.1 note |
| **CA-3a–d, order** | Cand. tests pass. Preflight order is unchanged apart from the base-link refusals, which run first | **pass** |
| **CA-4a** | Cand. tests pass. **Probe DMGconfig:** `stage-changed-config`, `FAILED.md`, HEAD resolves. **M-L2 kills** the four CA-4a rows; **M-L2-order kills** the garbage-config row | **pass** |
| **CA-4b, CA-4b-L1** | spawn-sites 8/8. **M-R16 kills 7.** **Layer 1's job is shown:** under M-L2-order the fsmonitor row is **green**, and under **M-L2-order+M-L1** it is **red** | **pass** |
| **CA-4c** | **D-A4 fixed.** The global row (`config-channel.test.ts:206–233`) uses `HOME/.gitconfig` under a scratch `HOME`, an empty scratch `XDG_CONFIG_HOME`, and `GIT_CONFIG_GLOBAL` **unset**. Its control is the same `git add` under the same `HOME`, and it writes the marker. **M-L0 turns this row's own test red** ("the global filter ran inside a runtime git call"), and CA-4e's with it. **R34 met:** `:261` asserts `input`, and `:268` shows the system value is not `input`. **Probe R34 here:** the generated file carries `autocrlf = "input"`, and `git config --system` reads `true`. **Probe H:** the runtime ran the filter 0 times, and the control's `git add` ran it; under M-L0, ×4. Identity, R19's refusal and CRLF parity pass in the cand. tests; CI prints the CA-4c rows `✓` on git 2.55.0 | **pass** |
| **CA-4d** | Scope stated in `watchedLocations`, unchanged; the walk is `lstat`-based. **M-L2-norestore kills the CA-4d row** | **pass** |
| **CA-4e** | Cand. test passes. **M-L0 kills it** | **pass** |
| **CA-4f** | Cand. tests pass (path and both hashes; control). A3 changes what a **link** or **identity** change records (CA-15), and a regular-file edit is still hashed: the two CA-4f tests pass, and the developer's R44 green includes them | **pass** |
| **CA-4g** | Global on/off: probe H at A3 and under M-L0. XDG on/off: the cand. test and M-L0. Repo-local: refused by layer 2; **M-L2 kills that row** | **pass** |
| **CA-4h** | Cand. tests pass. **R18 is met by the pair:** M-R18 alone **survives**. Under M-L2 alone the R18 row fails "expected undefined to be 'stage-changed-config'" (the loop stayed home). Under **M-L2+M-R18** it fails "expected 'runtime-git-failed' …": **R18's job, shown by the pair**. Resolve-late mutant: not constructed (§7) | **pass** (by the pair) |
| **CA-4i** | Cand. tests pass. **M-backstop kills both CA-4i rows** | **pass** |
| **CA-5** | Cand. tests pass on 2.54. CI prints `✓ … on this git (git version 2.55.0)`. **M-L2 kills the 2.54 row.** Per-stage snapshots remain **untested by this runtime** | **pass** |
| **CA-6** | Cand. tests pass. POSIX normal and error rows are **`✓` on CI**. **D-A3 still holds, verbatim, from this seat's probes at 20:04Z:** SINGLE: "developer exceeded its bound after 3158ms. The kill that ran: taskkill /PID 17260 /T /F exited 0. That is the kill's own result, not a census of descendants. A double-forked process can survive it (named limit; the double-fork is not closed)." DFORK: the same four sentences with 4167ms and PID 16200, then the `post-commit` record. The double-forked heartbeat, PID 17804, **grew 20 → 25 bytes** in the 1.2 s after the loop, and its PID was alive. The probe then killed it and confirmed it gone. The text claims no more than the kill did. M-R22 not run (POSIX) | **pass** |
| **CA-7** | Cand. tests pass (5 rows) | **pass** |
| **CA-8** | Cand. test passes. **Probe COMPOSE:** one record naming `post-commit` created **and** "refs/heads/main was DELETED during this stage (it pointed at 14be1e588a54)"; `FAILED.md`; HEAD resolves; `main` = `14be1e58…`, the value that record names; the hook removed; the marker empty. **M-L2, M-L2-order and M-endstate each kill it** | **pass** |
| **CA-9** | The pin test **ran and passed here**; on CI it is `↓`, read per test. The real run is candidate A's and was not repeated (**attributed**, as in reports A and A2). A3 does not touch the adapter | observation; pin **pass** |
| **CA-10** | Cand. tests pass. **M-CAS kills** the refuse-and-report row; **M-endstate kills** D4 and D2 | **pass** |
| **CA-11** | Cand. test passes. A2's qualification (A2-2, A2-3) is **lifted**: a tree-root link is now a named change. **New qualification:** the rows "config outside the repository" and "hard links at a watched file" are qualified by A3-1 and A3-2 (a read, not a write) | pass as written; **qualified** |
| **CA-12** | §5 and §6: suite **exit 0**, 1116 passed, 5 skipped, peers idle; CI **success**, read from the run; `sync --check` exit 1 on the same 3 pre-existing issues; 0 skipped; index at HEAD | **pass** |
| **CA-13** | 0 lines | **pass** |
| **CA-14** | Cand. tests pass. **Probes DMGhead and DMGindex:** `runtime-git-failed` and `FAILED.md`, each naming the failing call (`git for-each-ref …`, `git status --porcelain=v1 -z --untracked-files=all`), each saying "This is a RECORD, not a repair". **M-backstop kills both** | **pass** |
| **CA-15** | §3 | **FAIL**: clause 3 (A3-1, A3-2). Clauses 1, 2, 4 and 5 pass on every probe |

## 3. CA-15 in detail

**Method.** `probe15.mts` (§13) is report A2's `probe15b.mts` plus four shapes. It runs full loops with a stub
developer whose one act is the plant (and a stub qa whose one act, where named, is an edit to the victim).
Each run:
- sets `HOME`, `USERPROFILE`, `XDG_CONFIG_HOME` and `GIT_CONFIG_SYSTEM` to scratch paths;
- asserts inside the role that the plant landed (`lstat` → link, or `nlink === 2`);
- lists every victim by `lstat`/`readdir`, before and after;
- searches for a unique token in the repository including `.git` (an `lstat` walk that never enters a link),
  the iteration directory, `FAILED.md` and the returned `LoopResult`.

All three trees ran the same script with the same probe list. The runs were A3 from 19:06:51Z, A2 from
19:07:26Z and A from 19:08:05Z, each exit 0 with empty stderr.

**The token instrument's known positive:** the victim itself, with 2 hits for directory victims and 1 for file
victims, at A3 and A2 in every probe. **At A3 the token is found nowhere the runtime writes, in any probe**
(0 repository hits and not in the `LoopResult`, 14 probes with a victim).

| Probe | A3 `5010199` | A2 `2add792` | A `3b19287` |
|---|---|---|---|
| base: junction at `.git/hooks` at base | `LoopRefused link-at-base`, names the path; no tags, HEAD unmoved, no `artifacts/`; victim unchanged | the same | **not refused**, loop completed |
| base control: a real dir | completes | completes | completes |
| (a)1 junction at `.git/hooks` | `stage-changed-config`, `FAILED.md`; path a real `dir` after; victim unchanged; **record: `<common>/hooks modified (dir → type:symlink readlink:<victim>)`**, then the 14 samples | the same, **root not named** (A2-3) | canaries deleted, junction left |
| (a)2 junction at `.git/info` | as (a)1; **root named** | root not named | canaries deleted, junction left |
| (a)3 junction entry `.git/hooks/sub` | `created (absent → type:symlink readlink:<victim>)`; the link removed (**absent** after); victim unchanged | the same, with A2's `symlink:` wording | **loop completed**, link left |
| **(a)4** linked worktree, `<git-dir>/info` **absent** at base | **`stage-changed-config`**; record `info created (absent → type:symlink readlink:<victim>)`; path **absent** after; victim unchanged | **loop COMPLETED**, nothing recorded, `dir[]` left (**A2-2, the known positive**) | victim written, link left |
| (a)4pre the same, with `info/exclude` at base | fails; **root named** "modified (dir → …)", then `exclude` deleted and restored; `dir[exclude]` after | root not named | victim written |
| (a)5 junction at `.git` | `stage-changed-config`: "ancestor link at …\.git … No restore was claimed beneath the ancestor link"; victim unchanged | the same | `runtime-git-failed`; victim written |
| (a)6 hard link at `.git/config` | `nlink` 2 asserted; `stage-changed-config`; record **"identity:dev 2993778667 ino … nlink 2; not read"**; victim's hash in no record; victim bytes unchanged, `nlink` 1 after | the record's "after" is the victim's hash (**A2-5**) | victim **overwritten** |
| (a)6 hard link at `hooks/pre-commit.sample` | the same shape: "identity … not read" | the victim's hash (A2-5) | victim overwritten |
| R35 control: junction at `$XDG_CONFIG_HOME/git` at base | proceeds (correct); **finding: "…\xdg\git is a link at base, type symlink, readlink …\dotfiles-git; read through that target, not refused."** | no finding (**A2-4**) | no finding |
| (b)4 win32 form, machineNext: a junction at `$XDG_CONFIG_HOME/git` planted in developer, the victim edited in qa | both stages: "type change: …\xdg\git is a symlink target …\victim-xdg; not read through"; **victim hashes h0 and h1 in no record** | h0 and h1 both in the record (**A2-1**) | h0 and h1 both in the record |
| machineHard: `HOME/.gitconfig` → hard link, the victim edited in qa | both stages: "identity change: dev … nlink 2; not read"; victim hashes in no record | both hashes in the record (A2-5) | both in the record |
| **machineHardAbsent (NEW):** `xdg/git/config` **absent** at base → hard link, the victim edited in qa | **victim hashes in the record in both stages: `absent → b985ed23…`, `b985ed23… → 5482a474…`** (**A3-1**) | the same | the same |
| **r35chainJ (NEW):** a base link `xdg/git → dot`, then `dot` junctioned to a victim | **victim hashes in the record in both stages** (**A3-2**) | the same | the same |
| **r35chainH (NEW):** a base link `xdg/git → dot`, then `dot/config` hard-linked to a victim | **victim hashes in the record in both stages** (**A3-2**) | the same | the same |
| **baseHard (NEW):** hard link at `hooks/pre-commit.sample` **at base**, then an ordinary stub loop | **fails at planner**: false "modified" and "2 FILE(S) COULD NOT BE PUT BACK … Cannot read properties of null (reading 'equals')" (**A3-3**); the outside file unchanged | completes | completes |
| `.git` junction at base → the real git dir | `LoopRefused link-at-base` | the same | `dirty-tree` (not a link refusal) |
| `.git` junction at base → a non-repository victim | `not-a-repo`, `FAILED.md` in the work tree; victim unchanged (D-A2-7, carried) | the same | the same |

**Known positives.** The A2-specific probes have no red at `3b19287` in some clauses. For those, A2 is the
positive, as report A2 §14 asked: (a)4 (A2 completed), the next-stage machine read, the base-link record, and
the hard-link read (A2's record carries the victim's hash). Every one is red at A2 and green at A3, **by the
same expressions.** The **four new probes** have no red at either transition SHA. They are **not** counted as
passes. Three of them fail at A3. For those, the instrument's two directions are shown **within A3**: the
same `victimHashInRecord` expression reads **false** for machineHard and machineNext and **true** for
machineHardAbsent, r35chainJ and r35chainH. It also reads true at A2 for machineHard, where A2-5 is known.

**The canaries in both directions (R29).**
- **Write and delete:** clean at A3 in every probe. Every victim's listing is equal before and after, with
  no entry added. This includes the three failing shapes: A3-1 and A3-2 are reads, and nothing is written.
- **Read, by the token:** nowhere, at A3.
- **Read, by the hash:** A3-1 and A3-2, as above. The mode-000 POSIX run is still absent (§7).

**R24's recursive-`rm` clause, read from the code.** `configwatch.ts` at `5010199`: `rmSync` 0 hits,
`openSync` 0; removals are `rmdirSync` and `unlinkSync`. A3 adds no remove call. The detector was validated
on `3b19287` by report A2 (4 hits) and is unchanged.

**Why A3-1 happens, read from the code.** `MachineConfigWatch.identityChange` (`configwatch.ts:683–689`)
returns a change only when the base component **and** the current one are both `file`. For a path absent at
base, `prev.kind` is `absent`, so it returns nothing. `linkChange` sees no link. `begin` (`:763–768`) and
`compare` (`:812`) then call `snap(p, true)`, and `snap` (`:735`) hashes any `file` with **no `nlink`
check.** The repository side does have that check: `readState` refuses `!hadFile && nlink !== 1`
(`:280`). The machine side does not.

**Why A3-2 happens.** `begin` and `compare` compare `chainOf(p.path, true)`, which **stops at the first
link** (`:725`), against a base chain taken with `snap(p, true)` → `chainOf(p, false)`, which walks through
it. So nothing beyond a base link is compared, whether it is a component (J) or the final file's identity
(H), while `snap` then reads the whole path through it.

**R32, one mutant per protection (§4 has the full list).**

| Mutant | Edit | Its probe | Its test | Result |
|---|---|---|---|---|
| **M-follow-a** (A2's guard a) | the lstat guard reverted to link-following, 7 edits (report A2 §3's set, re-derived for A3's text) | (a)1, (a)2, (a)3, (a)4pre: **red on all four by clause 2** (the link is still there; the ancestor route catches it); victim unchanged | 6 red | **killed** |
| **M-follow-b** (A2's guard b) | `linkAboveWatched` returns `null` | (a)5: `runtime-git-failed` "not a git repository"; victim unchanged | 2 red | **killed** |
| **M-follow-c** (A2's guard c, R36) | `restoreNewFile` writes in place | (a)6 config and hook: **victims overwritten** | 3 red | **killed** |
| **M-R44** | `captureBase`'s once-guard removed, so every `begin` re-bases | machineNext: **h0 and h1 back in the record** (A2-1 restored) | R44 red | **killed** |
| **M-R45** (both halves) | the absent-root push suppressed, and `mkdir` whatever the base | (a)4: **loop completed, `dir[]`** (A2-2 restored exactly) | R45 red | **killed** |
| **M-R45-record** | only the absent-root push suppressed | (a)4: **loop completed** with nothing recorded; the path absent | R45 red | **killed** |
| **M-R45-mkdir** | only the `mkdir` restored | (a)4: fails with a record, but **`dir[]` left**, a directory that was never there (clause 2) | R45 red | **killed** |
| **M-R46-root** | a base-directory root is no longer pushed | (a)1, (a)2, (a)4pre: **root not named** | R46 red | **killed** |
| **M-R46-basenotes** | `baseNotes` reads only the final component | r35base: **no base note** (A2-4 restored) | R46 red | **killed** |
| **M-R43-repo** | the identity refusal in `readState` removed | (a)6 ×2: **the victim's hash in the record** | R43 red | **killed** |
| **M-R43-machine** | `identityChange` returns nothing | machineHard: **the victim's hashes in the record** | R43 red | **killed** |
| **M-L2-norestore** (attribution) | tree-root removal, created-entry removal and `restoreNewFile` removed; detection kept | (a)1, (a)3, (a)5, (a)6config: **every victim unchanged**. The role's act alone never touches a victim | 19 red | as report A2 |

Each A3 protection turns its own probe and its own test red, and nothing else. The one-commit-per-item shape
made this direct.

## 4. Mutants

Each mutant is a `git archive 5010199 open-brain` copy with a `node_modules` junction. Every edit was asserted
to occur exactly the expected number of times and read back from disk. **Each counted mutant is `tsc --noEmit`
exit 0.** Type-check control: a planted TS2322 gives exit 2. **Three first drafts were type-invalid** (TS2367
×2 in M-R45 and M-R45-record, TS2339 in M-R43-machine). They were deleted (junction removed first) and
rewritten with non-narrowing guards, and are **not** counted in their first form (§12). Results were read
from the JSON reporter over the six row files, 19:17:30Z → 20:03:19Z, sequentially.

| Mutant | Edit | Result (red tests, of 150) |
|---|---|---|
| M-L0 | `GIT_CONFIG_GLOBAL`/`NOSYSTEM` assignment removed | **killed**, 2: **CA-4c's own row** and CA-4e. Probe H: ×4 |
| M-L1 | the `-c` pair and `LAYER1_ENV` removed | survived alone (expected) |
| M-L2 | `closeAndRestore` never called | **killed**, 15 |
| M-L2-order | `enforceAllowlist` before the restore | **killed**, 4: garbage config, CA-8, (b) rollback, D4. The fsmonitor row stays **green** |
| M-L2-order + M-L1 | both | **killed**, 7, **including the fsmonitor row**: layer 1's job shown |
| M-R18 | `GIT_DIR`/`GIT_WORK_TREE` pinning removed | survived alone |
| M-L2 + M-R18 | both | 15; the R18 row changes from "undefined" to `runtime-git-failed`: the pair |
| M-R16 | a second `spawnSync("git", …)` in `runCheck` | **killed**, 7 |
| M-R15 | the check's env merged with `process.env` | **killed**, 1 (CA-2.6) |
| M-backstop | the catch rethrows | **killed**, 4 (CA-14 ×2, CA-4i ×2) |
| M-CAS | `setRefTo(…, null)` in `restoreDeletedDeferred` | **killed**, 1 |
| M-endstate | rollBack resets to `stageBase~1` | **killed**, 5 (D4, D2, CA-8, two A3/A4 rows) |
| M-2.5-refuse-node | `resolveLauncher` refuses the node-entry form | **killed**, 16, including the 2.5 planted control |
| M-2.5-accept-cmd | a `.cmd` with no shim target accepted as native | **killed**, 2: the 2.5 planted control (its refusal twin) and the win32 2.5 refusal row |
| M-follow-a/b/c, M-R43-repo/machine, M-R44, M-R45 ×3, M-R46 ×2, M-L2-norestore | §3 | §3: every one killed, in its own test and its own probe |

No mutant run printed an unhandled error.

**Not run:**
- **M-R22:** POSIX-only, and there is no POSIX machine here.
- **The CA-4h resolve-late mutant:** not constructed, as in report A2. By the code it may be equivalent under R18.
- **The CA-5 snapshot-timing mutant:** not applicable. The runtime's writes never touch `.git/config`.
- **A mutant for the POSIX branch of CA-2.5:** it cannot run here. Read from the source (§2).

## 5. Full suite and CI (CA-12)

**QA full suite at the candidate: 20:10:02Z → 20:12:32Z, `SUITE_EXIT=0`, captured unpiped (`npx vitest run
> file; echo $?`).**
- `Test Files  75 passed (75)`, **`Tests  1116 passed | 5 skipped (1121)`**. No `Errors` line; 0 matches for
  `Unhandled|onTaskUpdate`. Duration 147.86 s; cumulative test time 684.47 s.
- The count is one more passed and one fewer skipped than CI, because the real-`claude` 2.5 control runs here
  and skips on Linux. The total, 1121, is the same.
- Peers (`ListAgents`):

  | When | a2a-qa-c8 | sia-planner-6f | a2a-planner-26 | a2a-rivet-80 |
  |---|---|---|---|---|
  | before (20:09Z) | idle | idle | idle | idle |
  | after (20:12Z) | idle | idle | idle | idle |

  The planner sent "GO" at about 20:07Z. It said it held A2A-Hub's seats and would be idle until this seat
  reported: "no commands and no listeners". It showed `busy` twice right after that message. This seat
  subscribed to its idle notice and started only once the listing read `idle`. **Grok (Cursor)** is not
  visible to `ListAgents`. The planner's words: "told to stop at hub turn 18 after it froze A3. Its worktree
  is clean at 5010199, with no file modified in the last 15 minutes (checked at 20:07:25Z, read-only)". It
  is recorded as **told to stop; worktree quiet**, not as verified idle.
- **G-042 did not appear** in this run. With every visible peer idle, that fits V-076's reading. It is one run.

**CI run `35905810998`** (pull_request, head `50101992…`, **success**, created 18:55:26Z, updated 18:57:37Z), read
from its log with `gh run view --log` and ANSI codes stripped. No second machine for anything else:
- `git version 2.55.0`;
- `Test Files  75 passed (75)`, `Tests  1115 passed | 6 skipped (1121)`, no `Errors` line, 0 matches for
  `Unhandled|onTaskUpdate`;
- **1115 `✓` lines and 6 `↓` lines, printed per test (R48).** The six skips are: 2.5 (win32) refusal, the
  real-`claude` 2.5 control, CA-9, the win32 CA-6 limit row, R41 and R35. Each is a `skipIf` whose condition
  is true on Linux;
- **CA-15 (b), printed, not derived:** "a symlink at .git/config does not overwrite the victim" `✓`; "CA-15
  (b)2: a directory symlink at .git/hooks is removed via the ENOTDIR fallback and the victim is untouched"
  `✓`; "a symlink at .git does not write the victim and claims no restore" `✓`;
- **CA-2.5:** the planted control `✓`, the real-`claude` control `↓`;
- **CA-6 POSIX** normal and error rows `✓`;
- **CA-5** "on this git (git version 2.55.0)" `✓`;
- the R43–R46 tests all `✓`.

**The planner's account of this run is confirmed** from the log: 75/75, 1115/6/0, the per-test lines as
stated. **Grok's Windows suite** at `5010199` (exit 1, 1116 passed, 5 skipped, one unhandled onTaskUpdate,
with the planner running light commands) is its testimony and was not reproduced. This seat's measurement is
above.

## 6. `/sync --check` (CA-12)

- **`gitnexus analyze`** in the QA tree. The first run exited 1 with **T-055's incremental failure** ("FTS index
  'file_fts' is inconsistent … missing during delete"), and `meta.json` stayed at `2add792`. The second run
  exited 0 (3,536 nodes), and `meta.json` `lastCommit` = `5010199…`. The index was read from `meta.json`, not
  from the exit line.
- **`sync --check` in the QA tree: exit 1**: 25 passed, 2 warnings, **3 issues**, **0 skipped**.
  `gitnexus-index` passed ("indexed 5010199"); `build-freshness` passed ("build matches HEAD 5010199").
- The issues are `prd-version`, `summary-version` (views at v0.44.0, rev 84) and `retirements` (ENTITIES.md names
  `dream` and `reflection queue`), the same three as reports A and A2. **All three issues' inputs are
  byte-identical** between `f673d5e` and `5010199`: `git diff --quiet … -- .agents package.json
  open-brain/package.json CHANGELOG.md README.md` exits 0. **Control:** `open-brain/src/harness` differs, exit 1.
- **Plain `sync`, in a scratch clone** (`git clone --no-hardlinks` of the QA repository, detached at
  `5010199`, its own build), per report A2 §12:
  - `sync --check` there: **exit 1** (23 passed, 2 warnings, 3 issues, 2 skipped);
  - plain `sync`: **exit 0**, "23 passed, 2 fixed, 2 warnings, **1 issues**, 2 skipped". It rewrote five tracked
    `.agents` files in the clone.

  CA-12's point is reproduced: the fix-mode exit reads green over an issue. The two skips are the clone's: it
  has no `.gitnexus/` index, and its origin is a local path. The QA tree was never written.

## 7. What could not be verified, stated so nobody inherits it as settled

1. **CA-15's POSIX sub-items that A3 was not asked to add**, unchanged since report A2 §7.1:
   - **(b)3**, `chmod` through a link;
   - **(b)4**'s file-symlink form;
   - **the mode-000 read run (R29)**;
   - **the in-test controls** (b) names: a write through the link by the test itself, and the role's act
     without the runtime.

   (b)1, (b)2 and (b)6 are **printed `✓` on CI**. (b)5 has no POSIX-labelled row, although the unconditional
   hard-link tests run on Linux. R42 says A3 carries exactly R43–R48, and none of them assigns these (§11.2).
2. **R35's control on Linux.** The R35 test is `skipIf(!isWin)` and prints `↓` on CI. The criteria name "a
   symlink on CI's Linux". The win32 form is measured here, as a probe and a test.
3. **A3-1 and A3-2 on POSIX:** measured on win32 only. By the code the mechanism is platform-independent.
4. **M-R22** and the **CA-4h resolve-late** mutant.
5. **CA-9's real run** is carried from candidate A and attributed.
6. **The race R37 names**, a link planted between the check and the operation, was not probed.
7. The declared unrunnables U1–U6 (criteria §3).
8. **A3-3's reach:** measured for a hook sample. By the code, any repository watched file with `nlink` ≠ 1 at
   base behaves the same, including `.git/config`.

## 8. What the checks I ran cannot see

- **One machine.** Every local probe and mutant ran on win32 with git 2.54. Linux coverage is CI's unmutated
  rows.
- **Stub roles, one act each.** Chains of links deeper than one level beyond a base link, and links planted in
  the planner stage, were not probed. By the code, A3-2's mechanism covers any depth.
- **Traceless reads.** A3-1 and A3-2 are visible only because the runtime **records** the hash. A read that
  computes and discards leaves nothing, and a repair that stops recording the hash without stopping the read
  would pass every probe here. The next seat should check such a repair **by the code path**, as well as by
  the record.
- **The probes I added are this seat's reading of clause 3**, not shapes the criteria enumerate. The
  clause's words cover them. §11.3 returns whether they bind as rows.

## 9. Defects, each with the observation that produced it

| # | Severity | Defect | Observation |
|---|---|---|---|
| **A3-1** | **medium (clause 3; R43)**. Same class as A2-5 | a machine-config path absent at base, replaced by a hard link, is read and its hash recorded | §3 machineHardAbsent: the victim's two hashes in the developer and qa records |
| **A3-2** | **medium (clause 3; R44)** | a link or hard link planted **beyond** a base link (R35's allowed dotfiles case) is read through | §3 r35chainJ, r35chainH |
| **A3-3** | medium (record falsity; fails closed; no row fails as written) | a hard link at a repository watched file **at base** makes every loop fail at the planner stage, with a false "modified" record and a TypeError text | §3 baseHard |
| D-A2-7 | low (carried, R42) | a `.git` junctioned at base to a non-repository is recorded `not-a-repo` | the same at A3 |
| D-A5 | carried (R42) | — | — |

**A2-1, A2-2, A2-3, A2-4 and A2-5 are fixed** as scoped (§3). **D-A2 and D-A4 are fixed** (§2). **D-A2-6 is
corrected.**

## 10. Regressions: previously validated behaviour confirmed still working

- The six candidate row files at A3 (145 passed), and CI's full run (1115 passed). They include G-045's rows
  (`refwatch-stage` 21/21), slice two's refusals (`runtime.test.ts` 44/44), and every candidate-A row
  (`config-channel.test.ts` 32/32).
- Report A2's non-link probes, re-run at A3 as `probe2.mts`: H, R34, SINGLE, DFORK, DMG ×3 and COMPOSE. Every
  outcome matches report A2's, apart from PIDs, timings and hashes.
- Every A2 CA-15 probe outcome that passed at A2 still passes at A3: the base refusal, (a)1–(a)3, (a)5, (a)6
  write safety, and both base-`.git` probes.
- **One behaviour change that is not a regression by any row: A3-3.** A loop that completed at A2 fails at A3.

## 11. Where the criteria, the rulings and the candidate disagree

1. **CA-2.5's win32 form.** The row says: "on win32 it is the planted JS-entry shim above" (the `.cmd` of
   2.4). A3 plants a bare `.js` and resolves it as `node-entry`. The fail clause is not triggered, and the CI
   clause is met. The `.cmd` → node-entry resolution runs on win32 in 2.4's own row. **Returned:** is a bare
   entry an acceptable "planted launcher" for win32? This seat scored the row as a pass, with this note.
2. **R42 versus CA-15 (b)'s full list.** R42 carries exactly R43–R48. The FINAL criteria still name (b)3,
   (b)4 (file symlink), the mode-000 run and the in-test controls. Report A2 listed them as unverified and
   rulings-9 did not rule on them. **Returned:** are they rows for the next candidate, or named limits? §7.1
   carries them, and they are not scored here as a fail.
3. **This seat's four new probes.** They test clause 3's words ("repository **or machine** … a hard link that
   was not there at base") and R43/R44's words directly. They are not in the criteria's probe list, which
   names the shapes that "at least" run. **Returned for a ruling on standing:** do clause-3 failures found by
   unlisted shapes bind? This seat reads the clause as binding on any shape: the probe list says how to show
   the clause, and the clause says what must not happen. That is the reading that produced the REJECTED
   verdict. A narrower reading would pass CA-15, and **every other row passes**.
4. **R43 and the handoff.** The handoff says "`MachineConfigWatch` applies the same comparison and does not
   hash through it". That is true only where a file existed at base. The repository side refuses a new
   `nlink ≠ 1` file; the machine side does not (A3-1).

## 12. This seat's error entries and near-misses this session

**Error entries (escaped):** none known.

**Near-misses (caught in-process, not numbered):**
- **Three type-invalid mutant drafts** (TS2367 ×2, TS2339). They were caught by `tsc` before any run, deleted,
  and rewritten. The narrowing family: an `if (x !== "absent")` guard makes TypeScript reject the literal
  comparison inside the guarded block. This is exactly the watch-out's class.
- **A quoting layer ate a backslash:** a `sed` edit to the archive script turned `/\\/g` into `/\/g`, and the
  script died with a SyntaxError. It failed loud, and the edit was redone with the Edit tool.
- **`tar` rejected backslash paths** (`C\:\\…: Cannot open`) on the first archive. The copy was empty and had no
  junction, and it was deleted before retrying with forward slashes.
- **`gitnexus analyze` exited 1 on its first run** (T-055). The index was checked in `meta.json` after each run,
  so "index at HEAD" rests on the file, not on the second exit code.
- **The recall trigger fired** entry 299 (pipe-to-tail) beside a build command whose exit code was already
  captured unpiped. It was not applicable, and it was read and not acted on. Noted for T-170's question
  (whether an injection changes behaviour): here it did not need to.

## 13. Reproduction

The scripts are scratchpad-only and not tracked; their shapes are enough to rerun them.
- **`archive.mjs <label> <sha>`**: `git archive <sha> open-brain` into a scratch dir, with a `node_modules`
  junction. The `tar -C` path must use forward slashes on this machine.
- **`probe15.mts <tree> <probe…>`**: report A2's `probe15b.mts` plus machineHardAbsent, r35chainJ, r35chainH
  and baseHard; machineHard gains a qa-stage victim edit. The probes were base, baseCtl, a1–a5, a4pre,
  a6config, a6hook, r35base, machineNext, machineHard, machineHardAbsent, r35chainJ, r35chainH, baseHard,
  baseDotGitRepo and baseDotGitVictim. `tab15.mjs` summarises them.
- **`probe2.mts`** (report A2's) runs H, R34, SINGLE, DFORK, DMG ×3 and COMPOSE.
- **Mutants:** `mutants-a3.mjs`, whose edit specs are named in §3 and §4, and `build.mjs`, which archives,
  asserts each edit landed, and runs `tsc`. `runmut.sh` runs the six row files with `--reporter=json`, then
  each mutant's probes; `tabmut.mjs` summarises.
- **A3-1 in three lines:** in a loop with scratch `XDG_CONFIG_HOME`, delete `xdg/git/config` before the loop.
  In the developer stage, `linkSync(victim, xdg/git/config)`. Read `machineConfigFindings`: the victim's
  sha256/16 is the developer stage's "after".

## 14. Handoff to the next QA session (D-035)

1. **Re-run every probe in §3 against the next candidate, A3 and A2**, the four new ones included. For A3-1,
   A3-2 and A3-3, **A3 is the known positive**: all three are red at A3 by the expressions in §3.
2. **A repair for A3-1 and A3-2 should be read by the code path as well as the record** (§8, traceless
   reads). A candidate that stops recording the hash but still reads the file would pass the probes.
3. **A3-3's repair must not become a false negative.** A base hard link is allowed to be read (R43: "not there
   at base"), so the fix is in the snapshot, not in a refusal. Unless the planner rules that preflight refuses
   base hard links. That is a scope question, returned in §11 by implication.
4. **CI now prints every test (R48).** Read the POSIX rows from the log with ANSI codes stripped: the `✓`/`↓`
   lines, not the counts.
5. **Take plain `sync`'s exit code in a scratch clone** (§6's method). **Expect `gitnexus analyze` to need a
   second run** after an incremental update (T-055), and read `meta.json`.
6. **Nothing is pushed except this seat's own report branch (D-038).** The merge is Aaron's.
