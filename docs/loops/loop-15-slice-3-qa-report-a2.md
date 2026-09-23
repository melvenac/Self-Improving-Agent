# Loop 15 slice three — QA report A2: candidate A2 `2add792`: REJECTED

**By:** Probe (QA seat), record session **85** (T-164: assigned by the planner; the greeting's per-worktree
counter said 8 and is not used) · **Date:** 2026-09-23 (UTC).
**Model and effort, from this session's host transcript**
(`~/.claude/projects/C--Users-melve-Worktrees-sia-qa/9dda6f59-0f85-486b-88c1-23dff3900668.jsonl`, parsed as JSON):
every assistant entry carries `"model":"claude-opus-5-5"` and `"effort":"high"`, 144 of 144 at 07:29:56Z.
**Criteria:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` at **`6672e83`** (FINAL for A2).
**Candidate (frozen):** **`2add792e1cf46c6e52493c7d23e0084502f2f387`** on `origin/loop/15-slice-3-candidate-a2`
(draft PR #121). It is two commits on `4f752ca`, which is `918a1c9` plus the criteria tip `6672e83`:
- `65752b4`, the repair;
- `2add792`, which gates the win32 junction test and adds its POSIX twin.

Built by Grok 4.7 in Cursor, developer record session 84. Handoff: `docs/loops/loop-15-slice-3-a2-grok-handoff.md`
at `2add792`.
**Transition control:** candidate A `3b19287`, in a `git archive` copy in this seat's scratchpad, never a checkout
of any tree.
**Scored in:** `~/Worktrees/sia-qa`, detached at the frozen SHA from 07:14:01Z. Environment: git
`2.54.0.windows.1`, Node v22.23.2, win32. CI is run `35829631083`, Linux, git 2.55.0.
**Context read in full:** rulings-6, rulings-7, rulings-8 (R36–R41) on master; QA report A at `10eb4d0`; the Grok
dispatch and brief-2 on master. Where the criteria and R36–R41 disagree, it is said in §11.

---

## Verdict: REJECTED. D-A1's write/delete is closed; CA-15 fails on the read half, the record, and one silent pass

**What A2 fixed, measured.** A2 never wrote or deleted anything outside the repository, in any probe (§3):
- 13 probe shapes on win32, run against a scratch victim;
- each shape also run against `3b19287`, where the same probes deleted canaries, wrote hook samples and config into
  the victim, and overwrote hard-linked victims;
- the three R32 mutants.

The ancestor route (R38) stops before any git call, rollback included. Restore is new-file-then-rename (R36). The
junction `rmdir` was measured by this seat (R41). The `role-timeout` text no longer over-claims (D-A3). **D-A1 as
report A measured it is fixed.**

**Why it is still rejected: CA-15 is a row of the FINAL criteria, and four of its clauses fail.** Each one is
measured and cited to the clause and ruling it breaks:

| # | Finding | Clause / ruling |
|---|---|---|
| **A2-1** | **The runtime reads outside the repository through a link a role planted.** The developer junctions `$XDG_CONFIG_HOME/git` to a victim, and that stage correctly reports "not read through". The **next** stage's `MachineConfigWatch.begin` then reads the victim's `config` through the junction: the qa-stage finding records `e7ae0bf74deed3c5 → b518ff97bd341890`, exactly the sha256/16 of the victim's file before and after the qa role edited it. | clause 3; **R35** "as they stood at base"; **R39** |
| **A2-2** | **A link at a watched tree root can pass silently.** In a linked worktree whose `<git-dir>/info` is absent at base (a fresh `git worktree add`), a junction planted there is removed and replaced with an **empty directory that was not there at base**. The loop **completes** with no failure and no change recorded. | clauses 1, 2, 4; **CA-14**'s no-record standard |
| **A2-3** | **The record never names a link at a watched tree root.** For a junction at `.git/hooks`, `.git/info` or `<git-dir>/info` (with content at base), the stage fails and the victim is intact. But the record lists the files that were inside as "deleted" and never mentions the link or its type. | clause 4 |
| **A2-4** | **A machine-config link at base is not recorded.** A junction at `$XDG_CONFIG_HOME/git` at base proceeds, which is correct, but the record carries **no type and no target**. `baseNotes()` `lstat`s only the final component. | clause 5's control; **R35**, **R39** |
| **A2-5** | **Hard links are read through.** A hard link planted at `.git/config` or at a hook entry is read before `nlink` is compared: the change record's "after" hash equals the victim's own hash. The same holds for `HOME/.gitconfig` replaced by a hard link. Nothing is written through it (R36 holds). | clause 3's read half; **R31** |

**CA-2.5 and CA-4c are also NOT MET as written.** The cause is the planner's dispatch, as the planner ruled in its
A2A message to this seat (§11.1): D-A2, D-A4 and R34 were never assigned to the developer.

Every other row passes (§2):
- the full suite, exit 0;
- CI;
- 15 type-clean mutants plus a type-check control, each read against the criteria;
- the layer-1 and R18 pairs.

---

## 0. Rulings in force

| Source | Where |
|---|---|
| Rulings-1 to 5 | master (as cited by the criteria) |
| Rulings-6 R24–R28 (A rejected; CA-15; R26; R27) | master `a11916a` |
| Rulings-7 R29–R35 | master `a9018af` |
| Rulings-8 R36–R41 (Grok's design) | master, the file this seat read at `4e334d8` |
| **This session's ruling, received by A2A, about 07:31Z:** "SCORE THE ROWS AS WRITTEN … The cause is MY DISPATCH, and it is a planner error entry, not a developer defect … Any next candidate carries both test fixes explicitly." | Atlas (planner) to this seat, directly. Two links, planner → QA; no Aaron link |

## 1. Frozen-candidate conditions

| Condition | Observation | Result |
|---|---|---|
| criteria before candidate | `6672e83` is an ancestor of `2add792` (exit 0). **Control:** `d18a196` exits 1 | held |
| built on the release line | `5a1309e` (G-045) and `f673d5e` (A's base) are ancestors, exit 0 each | held |
| A2's own diff | `4f752ca..2add792`: `configwatch.ts`, `runtime.ts`, `configwatch-links.test.ts`, `process-role.test.ts` and the handoff. `config-channel.test.ts` is byte-identical to `3b19287` (`git diff --quiet`, exit 0) | as stated |
| **tree moved** | HEAD = `2add792…` at 07:14:01Z, 07:46Z, 07:47:36Z and 07:50:42Z, when this seat left it for the report branch | **not moved** |
| **tree dirty** | 0 porcelain entries after the checkout, the build, the rows, every probe, the suite and `gitnexus analyze`. **One exception, this seat's own:** plain `sync` (fix mode, run for CA-12's second exit code) rewrote the version stamp in five tracked `.agents` views at 07:47:21Z. They were reverted with `git checkout --` at 07:47:36Z, and `git diff --quiet 2add792` then exited 0. Every measurement in this report was taken before the write (§12) | dirty for 15 s, **after** all measurement; restored and verified |
| build | `npm run build` exit 0, stamped `2add792` at 07:14:19Z | current |
| **CA-13**, no version bump | `git diff <b> 2add792 -- package.json open-brain/package.json CHANGELOG.md`: 0 lines for `f673d5e`, `3b19287` and `4f752ca` | **pass** |

## 2. Rows

"Cand. tests" means the candidate's own row files. They were run here from 07:18:30Z to 07:20:18Z with the JSON
reporter: config-channel, configwatch-links, process-role, spawn-sites, refwatch-stage and runtime. **Exit 0:
141 tests, 136 passed, 5 skipped** (the five POSIX rows, `skipIf(win32)`), 0 failed. "Probe" means this seat's own
scripts (§13). Mutants are in §4.

| Row | Observed | Verdict |
|---|---|---|
| **CA-1** | Cand. tests: the delayed ref and hook fail the developer stage; the control is clean. Unchanged by A2 | **pass** |
| **CA-2.1–2.4, 2.6** | Cand. tests pass. **M-R15 killed** 2.6 | **pass** |
| **CA-2.5** | win32 refusal test passes. Locally, where `claude` is installed, the "2.5 CONTROL" and the CA-9 pin both **ran and passed** (read per test). **D-A2 unfixed:** `process-role.test.ts:245–251` still asserts `launcher === null` and `return`s. On CI, `process-role` shows `23 tests \| 3 skipped`; the three `skipIf` rows that skip on Linux are `:220`, `:261` and `:471`, so the "2.5 CONTROL" **passed vacuously** there (derived from the count). No planted POSIX control or refusal twin exists | **NOT MET as written** (fail clause triggered). Cause: planner's dispatch (§11.1) |
| **CA-3a–d, order** | Cand. tests pass (R13 ×2, R21 ×3 including the init/clone/worktree keys on 2.54, the gpgsign commits without `gpgsig`). Preflight order unchanged apart from A2's link refusals, which run first. The first tag is still inside `runLoopInner` | **pass** |
| **CA-4a** | Cand. tests: 4 rows pass. **Probe DMGconfig:** `stage-changed-config`, `FAILED.md`, HEAD resolves. **M-L2 killed** 11 rows; **M-L2-order killed** the garbage-config row. Restore judged by set and bytes: pass. The link-typed cases are CA-15's | **pass** |
| **CA-4b, CA-4b-L1** | spawn-sites 8/8. **M-R16 killed** 7. **Layer 1's job SHOWN:** M-L2-order leaves the fsmonitor row green, and **M-L2-order+M-L1 turns it red** ("the planted program ran inside a runtime git call"). `git.ts` is unchanged since A | **pass** |
| **CA-4c** | **Behaviour, by probe:** **Probe H**, global config through `HOME/.gitconfig` with `GIT_CONFIG_GLOBAL` unset: at A2 the runtime ran the filter 0 times and the control `git add` ran it; **under M-L0** the runtime ran it twice. **Probe R34:** a planted `core.autocrlf = input` is carried as `autocrlf = "input"` in the generated file, while the system value is `true`. Identity, R19's refusal and CRLF parity pass in the cand. tests. **But the row as written is not met:** the global row (`config-channel.test.ts:206–229`) still simulates via `GIT_CONFIG_GLOBAL`, and **M-L0 left it green** (D-A4). `:256` asserts only `toContain("core.autocrlf")`, with no value and no system control (R34) | **NOT MET as written** (D-A4, R34). Cause: planner's dispatch (§11.1). Behaviour shown by probe |
| **CA-4d** | Scope stated in `watchedLocations`, unchanged. The walk is `lstat`-based, so the scope no longer resolves through a link | **pass** |
| **CA-4e** | Cand. test passes. **M-L0 killed it** | **pass** |
| **CA-4f** | Cand. tests pass (path and both hashes; control). A2 adds type-change findings, which are CA-15's | **pass** |
| **CA-4g** | global on/off: probe H at A2 and under M-L0. XDG on/off: cand. test and M-L0. Repo-local: refused by layer 2 (cand. test), unchanged under M-L0 | **pass** |
| **CA-4h** | Cand. tests pass (common hook, `config.worktree`, common config, the R18 pointer). **R18 met by the pair (R26):** M-R18 alone **survived**; M-L2 alone left the R18 row not failed ("expected undefined to be stage-changed-config"); **M-L2+M-R18** gave **`runtime-git-failed`**. Resolve-late mutant: not constructed (§7) | **pass** (by the pair) |
| **CA-4i** | Cand. tests pass (append, same-length edit, control). Limit per ruling (b) unchanged | **pass** |
| **CA-5** | Cand. tests pass on 2.54; on CI the per-test line prints `✓ … on this git (git version 2.55.0)`. The R19 cloned-target known-negative passes. Per-stage snapshots remain **untested by this runtime** | **pass** |
| **CA-6** | Timeout row and control pass here. POSIX normal and error rows are **printed `✓` on CI**. The win32 limit-line row passes. **D-A3, scored (R33):** verbatim texts below; the DFORK descendant **survived**, and the text does not claim otherwise. M-R22 not run (POSIX) | **pass** |
| **CA-7** | Cand. tests pass (5 rows) | **pass** |
| **CA-8** | Cand. test passes. **Probe COMPOSE:** one record naming `post-commit` **and** `refs/heads/main` deleted; `FAILED.md`; HEAD resolves; `main` = `0c5d5225`, the window value; the hook removed; the marker empty | **pass** |
| **CA-9** | Pin test **ran and passed here**; on CI it is among the 3 skipped (derived). The real run is candidate A's (Forge's) and was not repeated; **attributed**, as report A said | observation; pin **pass** |
| **CA-10** | Cand. tests pass. **M-CAS killed** the refuse-and-report row; **M-endstate killed** D4 (and D2) | **pass** |
| **CA-11** | Cand. test passes. **Qualified by A2-2 and A2-3:** a link at a watched tree root is not a named change in the record | pass as written; **qualified** |
| **CA-12** | §5 and §6: suite **exit 0**; CI **success**; `sync --check` exit 1 on the same 3 pre-existing issues; 0 skipped; index at HEAD | **pass** |
| **CA-13** | 0 lines | **pass** |
| **CA-14** | Cand. tests pass. **Probes DMGhead and DMGindex:** `runtime-git-failed`, `FAILED.md`, each naming the failing call (`git for-each-ref …`, `git status --porcelain=v1 -z --untracked-files=all`). **M-backstop killed** both rows, and the two CA-4i rows with them | **pass** |
| **CA-15** | §3 | **FAIL**: clauses 1, 3, 4, 5 (A2-1 to A2-5) |

**D-A3's texts, verbatim, from this seat's probes at 07:42Z:**
- **single child, bound 3000 ms:** "developer exceeded its bound after 3140ms. The kill that ran: taskkill /PID 5996
  /T /F exited 0. That is the kill's own result, not a census of descendants. A double-forked process can survive
  it (named limit; the double-fork is not closed)."
- **double fork, bound 4000 ms, plus a planted hook:** the same four sentences, with 4112ms and `taskkill /PID 16212
  /T /F exited 0`, then the config record for `post-commit`. The double-forked heartbeat, PID 1960, **grew 20 → 26
  bytes** in the 1.2 s after the loop returned, and the PID was alive. The probe then killed it and confirmed it gone.

## 3. CA-15 in detail

**Method.** `probe15.mts` (§13) runs full loops with a stub developer whose one act is the plant. Each run:
- sets `HOME`, `USERPROFILE`, `XDG_CONFIG_HOME` and `GIT_CONFIG_SYSTEM` to scratch paths, so no real config file is
  read or written;
- asserts the plant landed (`lstat` → link, or `nlink === 2`) inside the role and returns it;
- lists each victim by `lstat`/`readdir` before and after, by name, sha and mode;
- searches for a unique token in the repository including `.git` (an `lstat` walk that never enters a link), in the
  iteration directory, in `FAILED.md` and in the returned `LoopResult`.

The token search's known positive is the victim itself: 2 hits for directory victims and 1 for file victims at A2.
The same script ran against `3b19287`'s archive (07:23:43Z) and against A2 (07:22:23Z, 07:22:48Z).

| Probe | A2 `2add792` | `3b19287` (the transition) | Red clause at `3b19287` |
|---|---|---|---|
| base: junction at `.git/hooks` at base | `LoopRefused link-at-base`, names the path; no tags, HEAD unmoved, no `artifacts/`; victim unchanged | **not refused**, loop completed | clause 5 |
| base control: real dir | completes | completes | — |
| (a)1 junction at `.git/hooks` | `stage-changed-config`, `FAILED.md`; path is a real `dir` after; **victim unchanged**; token nowhere. **Record lists 14 `*.sample` "deleted" and never names the junction** (A2-3) | victim's canaries **deleted**, 14 samples written into it, junction left | 2, 3 |
| (a)2 junction at `.git/info` | as (a)1; record says `info/exclude deleted` only (A2-3) | `exclude` written into the victim, canaries deleted | 2, 3 |
| (a)3 junction entry `.git/hooks/sub` | `stage-changed-config`; the record names `hooks/sub created (absent → symlink:<victim>)`; the link removed; victim unchanged | **loop completed**, link left | 1, 2 |
| (a)4 linked worktree, `<git-dir>/info` **absent** at base | **loop COMPLETED**, no failure, no change recorded; `<git-dir>/info` is now an **empty directory** (A2-2) | victim written, link left | 2, 3 |
| (a)4pre same, with `info/exclude` at base | stage fails; `exclude` "deleted" only; the link is not named (A2-3); victim unchanged | victim written | 2, 3 |
| (a)5 junction at `.git` | `stage-changed-config`: "ancestor link at …\.git … No restore was claimed beneath … Rollback was not performed … The tree is left for a human". `FAILED.md` in the work tree; victim unchanged; token nowhere | `runtime-git-failed`; victim received `config`, `hooks/…` | 1, 3 |
| (a)6 hard link at `.git/config` | `nlink` 2 asserted; `stage-changed-config`; **victim bytes unchanged**, victim `nlink` 1 after, repo file `nlink` 1. **Record "after" = `1631c6f943d5a1b6/666/nlink:2` = the victim's hash** (A2-5) | victim **overwritten** with the config (`r+`) | 3 |
| (a)6 hard link at `hooks/pre-commit.sample` | the same shape; after = `91296ac0b99e870e` = the victim's hash (A2-5) | victim overwritten | 3 |
| R35 control: junction at `$XDG_CONFIG_HOME/git` **at base** | proceeds (correct); **findings: none; no type or target recorded** (A2-4) | the same | **no known positive** |
| (b)4 win32 form: developer junctions `$XDG_CONFIG_HOME/git` after base; the qa stage edits the victim | developer stage: "type change: …\xdg\git is a symlink target …; not read through". **qa stage: `e7ae0bf74deed3c5 → b518ff97bd341890`, the victim's own hashes** (A2-1) | read through in **both** stages | developer stage only; the qa-stage read has **no known positive** |
| hard link at `HOME/.gitconfig` | finding after = `cb016eed6269883e` = the victim's hash; not reported as a type change (A2-5) | the same | **no known positive** |
| `.git` junction at base → the real git dir (aside) | `LoopRefused link-at-base` | — | — |
| `.git` junction at base → a non-repository victim | `not-a-repo`, with `FAILED.md` written in the work tree; not a link refusal; victim unchanged (§9, D-A2-7) | — | — |

**The canaries in both directions (R29).**
- **Write and delete: clean at A2 in every probe.** Every victim's listing is equal before and after, and no entry
  was added.
- **Read, by the token:** no token anywhere the runtime writes, in any A2 probe.
- **Read, by the hash:** A2-1 and A2-5 are reads the token cannot see, because only a hash of the victim is
  recorded. They are **measured** rather than inferred: the hash in the record equals the hash of the victim's bytes
  at that moment. For A2-1, the hash moves when the victim is edited by a later role.
- **The mode-000 POSIX run is absent** from the candidate's suite; §7.

**R24's recursive-`rm` clause, read from the code.**
- In `configwatch.ts` at `2add792`, a scan for `rmSync|openSync` finds 0 hits. The only occurrences of "recursive"
  are in comments.
- The removal paths are `rmdirSync` and `unlinkSync`.
- `ensureRealDir` uses non-recursive `mkdirSync`.
- The same scan finds 4 hits in `3b19287`'s file, which validates the detector.

**Why A2-1 happens, read from the code.** `MachineConfigWatch.begin` (`configwatch.ts:678–681`) re-snapshots every
stage with `snap(p, true)`. That walks the chain without stopping at a link and reads the file through it
(`:661–676`). So "base" is the stage start, not the loop's base. A link a role planted becomes the next stage's base
and is read through. `runtime.ts:945–946` opens both windows per stage.

**Why A2-2 and A2-3 happen.** The tree-root loop in `closeAndRestore` (`:445–458`) removes a link at a tree root and
`mkdir`s the path when it is absent. It never pushes a `ConfigChange` for the root itself. Only the files beneath it
are compared (`:462–503`). When the base had nothing beneath the root, nothing differs, `ok` is `true`, and the
message is "no repository config or hook changed".

**Why A2-4 happens.** `baseNotes()` (`:625–636`) calls `identify(p.path)` on the final component only. Under a
junctioned parent, that `lstat` sees a regular file.

**Why A2-5 happens.** `readState` (`:252–259`) reads the bytes of any regular file before `changed()` compares
`nlink`. `MachineConfigWatch.snap` has no `nlink` at all.

**R32, one mutant per protection.** The handoff says the three guards are separately revertible. Each was reverted
alone, `tsc` clean and every edit asserted, and run against the candidate's tests and this seat's probes:

| Mutant | Edit (named) | Its probes | Result |
|---|---|---|---|
| **M-follow-a** (a: the path's own type) | `readState` follows a link to a file (`statSync`, read through); `listTree` enters link entries and follows a linked root; `currentFiles` drops its link-root case; the tree loop never removes a root link; `restoreNewFile` writes **through** a file link instead of removing it | (a)1, (a)2, (a)3, (a)4pre | **red on all four, by clause 2:** the link is still there after the loop. The stage ends on the ancestor route instead. **Victim unchanged**: the ancestor walk (b) is defence in depth behind (a) for every tree-shaped probe. Cand. tests: 3 red |
| **M-follow-b** (b: the ancestor walk) | `linkAboveWatched` returns `null` | (a)5 | **red:** `runtime-git-failed`; the verdict claims a restore beneath the ancestor (test: `ancestorLink` expected, got `null`); the "Rollback was not performed" text is absent. **Victim unchanged**: `ensureRealDir`'s own `lstat` removed the `.git` junction and rebuilt a skeleton `.git`. Cand. tests: 2 red |
| **M-follow-c** (c: R36) | `restoreNewFile` writes the file in place (`writeFileSync` + `chmodSync`) before the temp-file path | (a)6 config, (a)6 hook | **red on the canary:** both hard-linked victims **overwritten**; `unrestored` reports `nlink:2`. Cand. test: 1 red |
| **M-L2-norestore** (attribution) | tree-root removal, created-entry removal and `restoreNewFile` removed; detection kept | (a)1, (a)3, (a)5, (a)6 | every victim unchanged: **the role's act alone never touches a victim**, so the transition's damage at `3b19287` was the restore's |

**Conclusion on R32:** each protection turns its own probe red, and R32's requirement is met. The canaries turn red
only for (c). For (a) and (b) the victim is kept by the other guards, and that is stated rather than counted as
"(a) keeps the victim".

## 4. Mutants

Each mutant is a `git archive 2add792 open-brain` copy with a `node_modules` junction. Every edit is asserted to
occur exactly the expected number of times and read back from disk. Each is `tsc --noEmit` exit 0. **Type-check
control:** a planted TS2322 gives exit 2. Results are read from the JSON reporter, 07:28:45Z → 07:41:52Z.

| Mutant | Edit | Result |
|---|---|---|
| M-L0 | `GIT_CONFIG_GLOBAL`/`NOSYSTEM` assignment removed | **killed** by CA-4e only; **CA-4c's own row green** (D-A4). Probe H under M-L0: the runtime runs the global filter ×2 |
| M-L1 | the `-c` pair and `LAYER1_ENV` removed | survived alone (expected) |
| M-L2 | `closeAndRestore` never called | **killed**, 11 rows |
| M-L2-order | `enforceAllowlist` before the restore | **killed**: garbage-config row and CA-8; fsmonitor row green |
| M-L2-order + M-L1 | both | **killed**, including the fsmonitor row: **layer 1's job shown** |
| M-R18 | `GIT_DIR`/`GIT_WORK_TREE` pinning removed | survived alone |
| M-L2 + M-R18 | both | R18 row `runtime-git-failed`, against "not failed" under M-L2 alone: **R18's job shown by the pair** |
| M-R16 | a second `spawnSync("git", …)` in `runCheck` | **killed**, 7 |
| M-R15 | the check's env merged with `process.env` | **killed** (CA-2.6: the sentinel key reached the check) |
| M-backstop | the catch rethrows | **killed**: CA-14 ×2, CA-4i ×2 |
| M-CAS | `setRefTo(…, null)` in `restoreDeletedDeferred` | **killed** |
| M-endstate | rollBack resets to `stageBase~1` | **killed**: D4 and D2 |
| M-L2-norestore, M-follow-a/b/c | §3 | §3 |

**Not run:**
- **M-R22:** POSIX-only, and there is no POSIX machine here.
- **The CA-4h resolve-late mutant:** not constructed. Reading the code, R18's pinning would make a late
  `rev-parse` return the pinned dir, so it may be equivalent by construction. That is unmeasured.
- **The CA-5 snapshot-timing mutant:** not applicable. The runtime's writes never touch `.git/config` on either
  version.

## 5. Full suite and CI (CA-12)

**QA full suite at the candidate: 07:43:33Z → 07:46:00Z, `SUITE_EXIT=0` (unpiped).**
- 75/75 files, **1107 passed, 5 skipped**, no `Errors` line, no heartbeat timeout, 142.53 s.
- Cumulative test time 652.07 s.
- Peers (`ListAgents`):

  | When | sia-planner-6f | a2a-planner-26 |
  |---|---|---|
  | before (07:43Z) | shell | idle |
  | after (07:46Z) | shell | idle |

  The planner relayed a2a-planner-26's pause and its acknowledgement before the run, and said it would run nothing
  heavy. Grok (Cursor) is not visible to `ListAgents`; the planner said it was idle.
- **Grok's Windows figure at `65752b4`** (exit 0, 1107/4, 164 s) is its testimony and was not reproduced at that
  SHA. This seat's 1107/5 is at `2add792`, which adds one test (`configwatch-links`, 13 tests versus 12).

**CI run `35829631083`** (pull_request, head `2add792`, **success**, 07:02:17Z → 07:04:44Z), read from its log:
- git 2.55.0;
- 75/75 files, 1107 passed, 5 skipped.
- `configwatch-links` `13 tests | 2 skipped`, file level only. **The CI reporter prints per-test lines only for slow
  tests, so the three POSIX CA-15 rows being passed and not skipped is DERIVED, not printed.** The two
  `skipIf(!isWin)` rows (R41, R35) must be the two skipped on Linux.
- `process-role` `23 | 3 skipped`, with the two POSIX CA-6 rows **printed `✓`**.
- CA-5 on 2.55.0 printed `✓`.

## 6. `/sync --check` (CA-12)

**`gitnexus analyze`** in the QA tree: exit 0, first run, 3,514 nodes. The index moved from `3b19287` to `2add792`
(`meta.json` `lastCommit`).

**`sync --check`: exit 1** — 25 passed, 2 warnings, **3 issues**, **0 skipped**.
- `gitnexus-index` pass (at HEAD); `build-freshness` pass.
- The issues are `prd-version`, `summary-version` (views at v0.44.0, rev 84) and `retirements` (ENTITIES.md names
  `dream` and `reflection queue`). These are the same three as report A.
- **Plain `sync` exited 0** over the same issues, and wrote (§12).
- **All three issues' inputs are byte-identical** between `f673d5e` and `2add792`: `git diff --quiet … -- .agents
  package.json open-brain/package.json CHANGELOG.md README.md` exits 0. **Control:** the harness source differs,
  exit 1. So they are pre-existing.

## 7. What could not be verified, stated so nobody inherits it as settled

1. **Every POSIX CA-15 row.** (b)1, (b)2 and (b)6 exist in the candidate's suite and are derived as passed on CI
   (§5). Missing or unmeasured:
   - **(b)3** `chmod` through a link;
   - **(b)4**'s file-symlink form;
   - **(b)5** as a POSIX-labelled row. The unconditional hard-link tests do run on Linux;
   - **the mode-000 read run (R29)**;
   - **the in-test controls** that (b) names: a write through the link by the test itself, and the role's act
     without the runtime.

   None could be run here. That the candidate's POSIX tests assert all of (b)'s controls "by the same expressions
   before and after" is **not met by reading**: they are `ConfigWatch` unit calls without those controls.
2. **M-R22** (POSIX group kill) and the **CA-4h resolve-late** mutant.
3. **CA-9's real run** is carried from candidate A and attributed. It was not re-run for A2, and A2 does not touch
   the adapter.
4. **The race R37 names** (a link planted between the per-operation check and the operation) was not probed.
5. **A2-1's reach.** It was measured with a junction at `$XDG_CONFIG_HOME/git`. By the code, a link at the final
   component (`HOME/.gitconfig` → a file symlink) would behave the same, but file symlinks need Developer Mode here.
6. The declared unrunnables U1–U6 (criteria §3).

## 8. What the checks I ran cannot see

- **One machine.** Every local probe and mutant ran on win32 with git 2.54. Linux coverage is CI's unmutated rows.
- **Stub roles.** Each probe is one scripted act. Interleaved or partial writes by a real role were not exercised.
- **Traceless reads.** A hash computed and discarded leaves nothing. A2-1 and A2-5 were visible only because their
  hashes are **recorded**.
- **Two stages, not three.** A2-1 was measured developer → qa. By the code, a planner-planted link is read in both
  later stages.

## 9. Defects, each with the observation that produced it

| # | Severity | Defect | Observation |
|---|---|---|---|
| **A2-1** | **blocker (clause 3, R35, R39)** | `MachineConfigWatch` re-bases per stage and reads through a link a role planted | §3: the qa-stage hashes equal the victim's |
| **A2-2** | **blocker (clause 1; CA-14's standard)** | a link at a watched tree root with nothing beneath it at base passes silently, and the runtime creates a directory that was never there | §3 (a)4: loop completed, empty `info/` |
| **A2-3** | high (clause 4) | a tree-root link is never named in the record | §3 (a)1, (a)2, (a)4pre |
| **A2-4** | medium (clause 5's control, R35/R39) | a machine-config link at a parent component at base is not recorded | §3 R35 control: findings empty |
| **A2-5** | medium (clause 3's read half, R31) | a hard-linked watched file is read before `nlink` is compared; machine config has no `nlink` check at all | §3 (a)6 ×2 and `HOME/.gitconfig` |
| **D-A2** | row not met (planner's dispatch) | CA-2.5's control still passes vacuously on CI; no planted POSIX control | `process-role.test.ts:245–251`; CI count |
| **D-A4** | row not met (planner's dispatch) | CA-4c's global row cannot fail on layer 0; R34's value is not asserted | M-L0 left it green; `:256` |
| D-A2-6 | low (handoff accuracy) | handoff: "a junctioned `.git` never reaches a git call". `runtime.ts:361` runs `rev-parse --is-inside-work-tree` **before** `dotGitLink` at `:366` | static reading; the refusal still lands (probe baseDotGitRepo) |
| D-A2-7 | low | `.git` junctioned at base to a **non-repository** is recorded `not-a-repo`, with `FAILED.md` written in the work tree, not refused as a link | probe baseDotGitVictim; victim unchanged |
| D-A5 | carried | the detach reflog message; not in A2 (R27 allowed skipping it) | — |

**D-A1 is fixed** for writes and deletes (§3). **D-A3 is fixed** (§2).

## 10. Regressions: previously validated behaviour confirmed still working

- The full suite (1107 passed) includes:
  - G-045's rows: `refwatch-stage` 21/21, with D4 asserting `main`'s value and M-endstate killing it;
  - slice two's refusals: `runtime.test.ts` 44/44;
  - every candidate-A row, which passes unchanged in `config-channel.test.ts` (32/32, byte-identical file) and
    `process-role.test.ts` (21 passed, plus the new single-child row).
- Report A's independent probe shapes, re-run as `probe2.mts`: DMG ×3, COMPOSE, H, the timeout texts. Every outcome
  matches report A's, except the texts D-A3 changed.

## 11. Where the criteria and the rulings disagree

1. **Criteria versus dispatch (ruled this session).** Rulings-6 R27 gave D-A2 and D-A4 to "the fresh QA session's
   to fix". Amendment 4 made them rows **on the candidate's tests**, and QA cannot write into a candidate. The Grok
   dispatch then listed D-A1, D-A3 and D-A5 followed by "Nothing else". The planner ruled: the rows are scored as
   written, and **the cause is the planner's dispatch, a planner error entry.** Any next candidate carries both test
   fixes explicitly.
2. **R36 is silent on the read; clause 3 is not.** R36 keeps `nlink` and inode "for the record and the type-change
   report only", and makes the write safe by construction. It says nothing about reading the bytes first. Clause 3's
   read half, per R31 and R35, forbids reading through a hard link that was not there at base. A2 follows R36 to the
   letter and fails clause 3 (A2-5). **Returned:** the severity of a recorded 64-bit hash prefix is the planner's to
   weigh. The criteria bind as written.
3. **R39's "base" is unqualified; R35's is the loop's.** R39 says "differs from base". R35, and criteria clause 3,
   say "as they stood at base", meaning preflight. A2 read "base" as each stage's start (A2-1). The criteria's
   reading is the one scored.
4. **R37, R38, R40 and R41 agree with the criteria.** Checked: the race is named in the handoff; R38's text and
   no-git path are measured in (a)5; the texts in §2; the `rmdir` in §12's R41 line.

## 12. This seat's error entries and near-misses this session

**Error entries (escaped):** none known.

**Near-misses (caught in-process, not numbered):**
- **Plain `sync` wrote into the frozen candidate tree.** Criteria CA-12 asks for "both exit codes", so this seat ran
  fix-mode `sync` in the candidate tree. It re-stamped five tracked `.agents` views from `v0.44.0` to `v0.44.1`
  (6 lines). The write was caught by `git status` in the same command, reverted 15 s later, and verified with
  `git diff --quiet 2add792` exit 0. It happened after every measurement. **Family:** a "check" whose second mode
  writes, run in a tree whose rule is read-only. The next seat should take plain `sync`'s exit code from a
  **scratch copy**, not the candidate tree.
- **The mutant builder's first `git archive` failed** with `ENOBUFS` at the default `maxBuffer`. It failed loud, and
  the two empty directories were deleted before `node_modules` junctions existed in them. **Standing caution:**
  never `rm -rf` a mutant copy while its `node_modules` junction is present.
- **The token's known positive was read after the loop.** At `3b19287`, where the restore deleted the canaries, it
  therefore read 0. The instrument's positive is established at A2 (2 and 1 hits), where the victims survived.

**R41, measured by this seat directly (07:30:57Z):** a junction to a victim holding two canaries; `rmdirSync`
without `recursive`; `lstat` of the junction → `ENOENT`; the victim is still a directory; both canaries have the
same sha before and after.

## 13. Reproduction

The scripts are scratchpad-only and not tracked; their shapes are enough to rerun them.
- **`probe15.mts <tree> <probe…>`** (plus `probe15b.mts` for the two base-`.git` cases) imports `runtime`, `roles`
  and the fixture from the tree under test. The probes are base, baseCtl, a1–a3, a4, a4pre, a5, a6config, a6hook,
  r35base, machineNext and machineHard. Each runs a full stub loop with scratch `HOME`/`XDG_CONFIG_HOME`/
  `GIT_CONFIG_SYSTEM`, victims with tokened canaries, `lstat`-walk listings and token searches.
- **`probe2.mts`** runs H, R34, SINGLE, DFORK, DMG ×3 and COMPOSE.
- **Mutants:** `mutants.mjs` (the edit specs, quoted in §3 and §4) and `build.mjs`, which archives, asserts each
  edit landed, and runs `tsc`. `runmut.sh` runs the targeted rows with `--reporter=json`, then the probes.
- **The transition control:** `git archive 3b19287 open-brain` with a `node_modules` junction.

## 14. Handoff to the next QA session (D-035)

1. **A repaired candidate must re-run every CA-15 probe in §3 against itself and against `3b19287`**, plus the four
   A2-specific ones:
   - (a)4 with the tree root **absent** at base;
   - the next-stage machine read;
   - the base-link record;
   - the hard-link read.

   The first three have **no red at `3b19287`** in some clauses, because A had the same behaviour. Label them "no
   known positive" and use this A2 as their positive instead.
2. **D-A2 and D-A4 (with R34) must be in the next dispatch explicitly** (the planner's ruling), and scored as
   written.
3. **Take plain `sync`'s exit code in a scratch copy**, not the candidate tree (§12).
4. **CI's per-test lines exist only for slow tests.** To read the POSIX rows as printed, ask the planner whether the
   CI workflow may use a verbose reporter for the harness files, or keep deriving from the counts and say so.
5. **Nothing is pushed except this seat's own report branch (D-038).** The merge is Aaron's.
