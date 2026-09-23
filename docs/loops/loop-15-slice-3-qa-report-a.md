# Loop 15 slice three — QA report A: candidate A `3b19287`: REJECTED

**By:** Probe (QA seat, record session **79**; the greeting's per-worktree counter is not used, per `T-164`)
· **Date:** 2026-09-23 (UTC) · **Model:** Opus 5.5 (`claude-opus-5-5[1m]`).

**Effort** is read from this session's host transcript
(`~/.claude/projects/C--Users-melve-Worktrees-sia-qa/67f7e61b-4ad8-4c39-a922-ff5a79e2ec3c.jsonl`, the per-entry
`effort` field). The settings file is not the instrument here: `modelSettings."claude-opus-5-5".effortLevel` says
`high`, and `high` never appears in this session's record. The transcript shows two runs:

| Run | From | To |
|---|---|---|
| `medium` | 2026-09-22T23:50:58Z | 2026-09-23T01:02:20Z |
| `max` | 2026-09-23T01:02:27Z | onward |

This seat's tracked commits, by commit time:

| Effort | Commits |
|---|---|
| **medium** | `76c728a` (QA report 1, 00:07:51Z); criteria `770bcb9` (00:31:38Z), `ce8e6a1` (00:32:47Z), `96738a8` (01:00:37Z) |
| **max** | `b14c0ad`, `847fc35`, `d627d8c`, `c9947c5`, and this report |

**Criteria:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` at **`c9947c5`**.
**Candidate (frozen):** **`3b19287111b07ee61100adc9d5a6bbb0e1b5cf10`**. The developer handoff is at `918a1c9`, a
docs-only child, blob `0450a56b`.
**Scored in:** `~/Worktrees/sia-qa`, checked out detached at the frozen SHA from 02:29:00Z to 02:49:13Z.
Environment: git `2.54.0.windows.1`, Node v22.23.2, win32. CI is run `35810513171` on Linux, git 2.55.0.

---

## Verdict: REJECTED — one blocker, everything else passes

**Blocker D-A1:** layer 2's restore follows a planted directory junction out of the repository. It **deletes
files outside the repository and writes files there**, leaves the role's link in place, and records "Every file
was put back by bytes before any git call read the repository".
- Measured against a scratch directory only.
- Attributed to the runtime's restore by a mutant with the restore removed: with that mutant, the canary files
  survive.
- It fails CA-4a's restore requirement in substance.
- It contradicts the candidate's own stated property ("a real role runs, and it cannot execute code in the
  runtime or leave without a record"): the runtime **itself** becomes the destructive actor, on a role's
  one-line act.
- Details are in §3.

**Everything else measured passes, with named caveats:**
- every other CA row;
- the QA full suite, exit 0;
- CI;
- 13 valid mutants, each killed where the criteria require it;
- the two shown defence-in-depth jobs (layer 1 and R18);
- 9 independent probes.

Per the planner, **the repair is a new candidate SHA from a fresh developer session**. §13 is a **proposed criteria
row (CA-15)** on the watched paths' type, for the next QA session to finalise and the planner to rule on.

---

## 0. Rulings in force, each cited to its tracked file

| Source | Where | Blob |
|---|---|---|
| Brief | `loop-15-slice-3-brief.md` | |
| Rulings-1 R5 (A's scope) | on master | |
| Rulings-2 R7–R13 | on master | |
| Rulings-3 R14–R21 | master `c5c0b2e` | `dde14219` |
| Rulings-4 (R19 "needs"; R21's named list; R22 narrowed on win32 by ruling (b); T-174) | `origin/docs/slice-3-rulings-4` at `d18a196` | `76c868ff` |

**Aaron's two rulings, relayed by the planner at about 02:40Z** (two links: Aaron → planner → this seat):
1. **Fresh QA and developer sessions at each candidate boundary.** This seat writes its report and handoff as
   tracked files, then stops.
2. **The split.** Candidate B is the G-042 repair plus `E_t`'s schema change (R10). Candidate C is T-155.
   **G-042 attribution is B's**, not A's.

---

## 1. Frozen-candidate conditions

| Condition | Observation | Result |
|---|---|---|
| criteria before candidate | each of `770bcb9`, `ce8e6a1`, `96738a8`, `b14c0ad`, `847fc35`, `d627d8c`, `c9947c5` is an ancestor of `3b19287` (`merge-base --is-ancestor` exit 0 each). **Control:** `d18a196`, not in its history, exits 1 | held |
| G-045 release head | `5a1309e` is an ancestor | held |
| handoff commit | `918a1c9` = `3b19287` plus `docs/loops/loop-15-slice-3-candidate-a-developer-handoff.md` only | held |
| **tree moved** | HEAD = `3b19287…` at 02:29:00Z and at 02:49:13Z | **not moved** |
| **tree dirty** | 0 porcelain entries after the checkout, the build, the suite, `gitnexus analyze`, `/sync` and every probe. `git diff --quiet 3b19287` exit 0 at 02:49:13Z. Every mutant ran in a separate `git archive` copy | **not dirty** |
| build | `npm run build` exit 0, stamped `3b19287` | current |
| CA-13, no version bump | `git diff f673d5e 3b19287 -- package.json open-brain/package.json CHANGELOG.md` = 0 lines | **pass** |

---

## 2. Rows: required, observed, where, when, verdict

"Cand. tests" means the candidate's own row files. They were run here at 02:36:02Z→02:37:55Z with the JSON
reporter: **exit 0, 127 tests, 125 passed, 2 skipped** (the two POSIX CA-6 rows, `skipIf(win32)`), 0 failed.
"Probe" means this seat's own scripts (§14). Every mutant is in §4.

| Row | Required (short) | Observed | Verdict |
|---|---|---|---|
| **CA-1** | windows close after the process EXITS; attributed to the stage that wrote | Cand. tests: a role sleeps 2 s, then writes a ref and plants a hook → fails **the developer stage** on both; the control is clean. Code path: `runStage` awaits `role.execute` (runtime.ts:1000–1012) before `closeAndRestore` (:1027) | **pass** |
| **CA-2.1–2.3** | constructed env; key absent; the transition visible | Cand. tests: the key, the sentinel and a non-allowlisted name are absent; the allowlisted name is present; `CHILD_SESSION` absent; `FORCE…=1` present | **pass** |
| **CA-2.4** | argv byte-for-byte; no shell; over-limit fails closed | Cand. test `PROBE = ["^caret","$HOME","back\\slash","a space",'dq"uote',"new\nline","trailing\\"]` (test:180) arrives byte-for-byte through a planted JS-entry `.cmd` resolved to `[node, entry]`. The prompt goes on **stdin**, absent from argv, so the over-limit clause is unreachable by construction | **pass** |
| **CA-2.5** | unresolvable shim refused before any tag, named, no shell; controls | Cand. tests (win32): two planted `.cmd` forms are refused `role-unresolvable`, naming the path, with no tag, no `artifacts/`, and marker absent. Control: the real `claude.cmd` resolves to native `…\bin\claude.exe`, **ran here**. **Defect D-A2:** on CI the same control passes vacuously | **pass** (D-A2) |
| **CA-2.6 (R15)** | checks get a constructed env | Cand. test: no key or sentinel, `CI` present, layer-0/1 env present, no `GIT_DIR`. **M-R15 killed it** | **pass** |
| **CA-3a/b** | refused before any tag | Cand. tests assert no tags, no commit, no `artifacts/`; the remote refusal states the explicit-URL limit; the controls proceed | **pass** |
| **CA-3c (R13)** | includes refused by name, each form | Cand. tests: `include.path` and `includeIf.gitdir:…path` are refused. **Probe INCWT:** `include.path` in a linked worktree's `config.worktree` → `LoopRefused` naming `include.path (in …\.git\worktrees\wt\config.worktree)`; the control (removed) completes | **pass** |
| **CA-3d (R21)** | default-deny; the named list with reasons; the gpgsign premise verified | `SAFE_LOCAL_KEYS` (configwatch.ts:394–402) = the measured init/clone keys plus the ruled six, each with a `why`. Cand. tests: `filter.x.clean` and `core.sshCommand` refused and named; init/clone/worktree keys pass on the running git (2.54 here, 2.55 on CI). **Probe GPG:** control `git -c gpg.program=<marker> commit` without `--no-gpg-sign` → exit 128 and 1 marker line (the key is live); the runtime loop on the same `commit.gpgsign=true` target made **3 commits, 0 with `gpgsig`** | **pass** |
| **CA-3 order** | all four refusals before any tag | `preflightConfig`/`preflightUnderPin` run in `runLoop` (runtime.ts:384–385) before `runLoopInner` (:391). The first tag is written inside it (:880) | **pass** |
| **CA-4a** | planted hook or monitor refused, never run, restored by **set and bytes**; garbage config and v99 → `stage-changed-config` with a record; M-L2-order red | Cand. tests: all 4 rows pass. **Probe DMG config:** `stage-changed-config`, `FAILED.md`, HEAD resolves. **M-L2 killed** the 4 rows. **M-L2-order killed** the garbage-config row. `closeAndRestore` is file I/O only, with a read-back (configwatch.ts:211–266). **BUT D-A1:** with a junction at `.git/hooks`, the restore deletes and writes **outside the repository** and leaves the link. The file set and bytes "match" only because they are read through the link | **FAIL (D-A1)** |
| **CA-4b (R16, R17), CA-4b-L1** | one spawn site (AST, validated both ways); layer 1 in env; layer 1's job shown | Cand. tests: exactly one site, `git.ts:spawnGit`; planted positives in every API form incl. multi-line are found. **M-R16** (a real second site) **killed** it. Layer 1 as `-c` and as `GIT_CONFIG_COUNT` (git.ts:78–111, :189). **Layer 1's job SHOWN:** M-L2-order leaves the `fsmonitor` row green, and **M-L2-order+M-L1 turns it red**: "the planted program ran inside a runtime git call". **[mine] note:** inside the checks, role code runs by design, so R17 there is consistency and not a boundary. The boundary is R15 | **pass** |
| **CA-4c (R7, R19)** | layer 0 discriminates; the generated file is allowlist-only; identity; R19 refusal by tracked attribute; CRLF parity | Cand. tests pass. **M-L0 was killed via CA-4e, not via CA-4c's own row.** That row simulates global config with `GIT_CONFIG_GLOBAL`, which `runtimeGitEnv` strips as a redirect with or without layer 0 (test:206–211), so it stayed green under M-L0: **D-A4**. **Probe H (global config through `HOME/.gitconfig`):** the candidate does **not** run the filter; **M-L0 does** (`global-home:`). **Probe CRLF:** on a clone under machine config (`core.autocrlf=true`) with no `.gitattributes`, the runtime commits the CRLF save `i/lf`, equal to the machine's own git twin (`i/lf`), and the untouched tracked file stays clean. At v0.44.1 plus R7 alone this read ` M` and `i/crlf` | **pass** (D-A4) |
| **CA-4d** | scope stated; each kind detected | Cand. test passes (`watchedLocations`). **Affected by D-A1:** the stated paths are resolved through links, so the scope silently becomes a link's target | pass as written; **affected by D-A1** |
| **CA-4e (R11)** | XDG: no run with layer 0, run without | Cand. test passes on 2.54 and on CI 2.55. **M-L0 killed it** | **pass** |
| **CA-4f (R8)** | report-only hashing of global, XDG and system; nothing restored | Cand. tests pass (path plus both hashes; the control has no finding). **Probe SYSPATH:** the derived system path `C:\Program Files\Git\etc\gitconfig` **equals** git's own `--show-origin`. Change detection on the **real** file is not probed (U4) | **pass** |
| **CA-4g (R9)** | six cells, measured | global: layer 0 on → no run (probe H), off → run (probe H under M-L0). XDG: on → no run (cand. test), off → run (M-L0 kills CA-4e). Repo-local: on → refused by layer 2, no run (cand. test); off (M-L0) → the same, since the row stayed green under M-L0 | **pass** |
| **CA-4h (R12, R18)** | common dir and `config.worktree` watched; the pointer cannot redirect; **M-R18 turns the row red** | Cand. tests pass (common hook, `config.worktree` key, common config, the R18 pointer). Forge's hidden-pointer `EPERM` restore defect was found by this row and fixed (handoff §5.1). **M-R18 alone SURVIVED**, because layer 2 restores the pointer before any git call. **The pair shows R18's job:** M-L2 alone → the loop **completed**, with pinning keeping it home; M-L2+M-R18 → `runtime-git-failed`, after following the redirect | **partial**: the clause "M-R18 turns this row red" is **not met as written**. R18 is defence in depth with a shown job, the same shape as layer 1, and is **returned** (§13) |
| **CA-4i (R20)** | byte-compare before every call; same-length edit; limit stated per (b) | Cand. tests pass (append → `runtime-git-refused` naming the file, the filter never ran; same-length edit caught; control completes). Limit: closed on POSIX (CA-6 POSIX rows pass on CI); **open on the win32 normal-exit path** and on the win32 timeout path for double-forked descendants (CA-6) | **pass** |
| **CA-5 (R4, R19)** | clean stub loop on both git versions; R19 target | Cand. tests pass on 2.54 and on **CI 2.55.0**, where the log shows `✓ … on this git (git version 2.55.0), and the runtime's own writes never touch .git/config`, plus the R19 target. Per-stage snapshots are **untested by this runtime**: its writes never touch `.git/config` on either version | **pass** |
| **CA-6 (P4, R22 per (b))** | timeout kills the tree (PID and heartbeat); POSIX group kill on every path (CI); win32 limit line; double-fork measured | Timeout row passes here, with the control. **POSIX normal and error rows PASSED on CI Linux**, read from the log as `✓`, not skipped. The win32 limit-line row passes. **[mine] DFORK, reported and not scored:** on the win32 **timeout** path a double-forked heartbeat **survived**. Kill note `taskkill /PID 992 /T /F exited 0`; the heartbeat grew 21→29 bytes after the loop; PID 17600 alive (cleaned up after, `ESRCH`). **Defect D-A3:** the `role-timeout` reason says "killed with its process tree" unconditionally. M-R22 not run (POSIX-only) | **pass** (limit measured; D-A3) |
| **CA-7** | `R_t` schema, retry, disagreement, non-zero exit, never trusted | Cand. tests pass (missing, garbage or invalid → capped retry, `FAILED.md`, exit ≠ 0; mismatch in both directions → findings; exit 3 → a finding; the done-gate reads the measured diffstat; control) | **pass** |
| **CA-8 (P2)** | deleted branch plus hook compose | Cand. test passes. **Probe COMPOSE:** one record naming `post-commit` **and** `refs/heads/main` deleted, `FAILED.md`, HEAD resolves, `main` = window value, hook removed, marker empty | **pass** |
| **CA-9 (P7)** | the first real run is an observation; pin test passed locally and skipped with a reason on CI | Pin test: **ran and passed here** (`it.skipIf(findOnPath null)`); on CI it is among the 3 skipped. **The real run is Forge's (02:12:43Z→02:13:13Z, on Aaron's word in Forge's session); its artefacts are in Forge's scratchpad, and this seat did NOT inspect them.** A4b's evidence is therefore **attributed**. T-161 data point, Forge's: Claude Code sets `CHILD_SESSION=1` on its own tool subprocesses, and the role session, launched without it, wrote a transcript | observation; pin test **pass** |
| **CA-10** | zero-oid CAS; D4 asserts the value | Cand. tests pass. **M-CAS killed** the refuse-and-report row. **M-endstate** (rollBack resets to `stageBase~1`) **killed D4**, so the value assertion can fail on the end state | **pass** |
| **CA-11** | channel table and F11 in the loop's output | Cand. test passes. **Qualified by D-A1:** the hooks/config channel's "probed" status does not cover link-typed watched paths | pass as written |
| **CA-12** | full suite (peers recorded); CI run id; `/sync --check` after analyze, 0 skipped | §5 and §6: suite **exit 0**; CI `35810513171` **success**; `/sync --check` exit 1 on **3 pre-existing issues**, whose inputs are byte-identical to the base; 0 skipped; index at HEAD | **pass** |
| **CA-13** | no version bump | 0 lines | **pass** |
| **CA-14 (R14)** | backstop: any git failure after a role → a record naming the call, and no claimed repair | Cand. tests pass. **Probe DMG, the same probe that measured v0.44.1:** garbage `.git/HEAD` → `runtime-git-failed`, `FAILED.md` names `git for-each-ref …` and says "a RECORD, not a repair", HEAD **still** unresolvable. Garbage `.git/index` → `runtime-git-failed` naming `git status --porcelain=v1 -z --untracked-files=all`. At v0.44.1, **both crashed with no `LoopResult` and no `FAILED.md`** (criteria §7.1). **M-backstop killed** both rows | **pass** |

---

## 3. The blocker, D-A1: the restore follows a link out of the repository

**Measured 2026-09-23T02:44:11Z by `probeJ.mts`, against a scratch "victim" directory holding two canary
files. No real directory was ever targeted.**

| Scenario | Role act, a stub developer | Runtime outcome | Victim directory after |
|---|---|---|---|
| **CONTROL** | an ordinary planted `.git/hooks/post-commit` | `stage-changed-config`, restored | untouched: 2 canaries, 0 new files |
| **JUNCTION** | rename `.git/hooks` → `hooks.orig`; `symlinkSync(victim, ".git/hooks", "junction")` (no admin on win32) | `stage-changed-config`. Message: "16 repository config/hook file(s) changed … **Every file was put back by bytes before any git call read the repository**" | **both canaries DELETED; 14 `*.sample` hooks WRITTEN into it; `.git/hooks` still the role's junction** |
| JUNCTION under **M-L2-norestore** (detection kept, restore removed; tsc 0) | the same | `stage-changed-config` | **untouched**. So the runtime's restore is the actor |
| FILE SYMLINK `.git/config` → victim file | `symlinkSync(target, ".git/config", "file")` | planting failed (`EPERM`, no Developer Mode) | untouched. **POSIX is UNMEASURED:** unprivileged symlinks exist there, and `writeBack` opens `r+` **through** the link, which predicts the target is overwritten with the config's bytes |

**The mechanism, read from the code:** every path and tree root layer 2 watches is resolved **through links**:
- `listTree` walks a root with `statSync` and `readdirSync`;
- `readState` uses `statSync` and `readFileSync`;
- `writeBack` uses `openSync(path, "r+")`;
- `rmSync(path)` removes the "created" entries (configwatch.ts:93–106, 147–176, 211–246).

A link at a watched root therefore turns the "restore" into writes and deletions in the link's target.

**Why it decides the verdict:**
- The runtime deletes files outside the repository on a role's one-line act. Layer 2 is new in candidate A, and
  this behaviour arrives with it. Whether v0.44.1's ref restore can be led through links was **not probed**.
- A model-backed role can produce this by mistake or under prompt injection.
- The record claims a restore that did not happen: `.git/hooks` is still the role's link, and outside files are
  gone. That is the "record that claims a repair it did not perform" standard in CA-14.

**The criteria gap is this seat's, and owned:** CA-4a judged the file **set** and the **bytes**, not the
watched roots' **type**. By the letter, set and bytes "match" through the junction. §13 proposes the row that
closes the gap.

**Fix shape (the developer's to design, stated only so the next criteria can test it):**
- an `lstat`-based walk, where a link at a watched path or root is itself a change;
- the restore removes the link and recreates the original entry;
- nothing is read, written or deleted outside the repository.

The same class covers `.git/info`, `<common>/config`, `config.worktree` and the `.git` pointer.

---

## 4. Mutants

Each mutant is a `git archive` copy of `3b19287`, with every edit asserted to land exactly the expected number of
times. Each was `tsc --noEmit` exit 0. **Type-check control:** a planted TS2322 gives exit 2; removed, exit 0.
Results were read from the JSON reporter.

| Mutant | Edit | Targeted rows | Result |
|---|---|---|---|
| M-L0 | layer 0 removed | CA-4c/4e/4g | **killed** by CA-4e. CA-4c's own row stayed green (D-A4). Probe H shows the global path running under M-L0 |
| M-L1 | the `-c` pair and the env pair removed | CA-4a ×4, CA-2.6 | **survived** alone (expected; see L2-order) |
| M-L2 | config window removed | CA-4a ×4 | **killed** (4) |
| M-L2-order | a git read (`enforceAllowlist`) placed before the restore | CA-4a | **killed** (garbage config); the fsmonitor row green |
| M-L2-order + M-L1 | both | CA-4a | **killed** (fsmonitor row too): **layer 1's job shown** |
| M-R18 | pinning removed | CA-4h R18 | **survived** alone |
| M-L2 vs M-L2+M-R18 | the pair | CA-4h R18 | completed **vs** `runtime-git-failed`: **R18's job shown** when layer 2 is absent |
| M-R16 | a real second `spawnSync("git",…)` in `checks.ts` | spawn-sites | **killed** (7 red) |
| M-R15 | checks inherit the parent env | CA-2.6 | **killed** |
| M-backstop | the backstop rethrows | CA-14 ×2 | **killed** (2). The first attempt narrowed `err` (TS2358) and was **discarded, not counted** |
| M-CAS | no compare-and-swap | CA-10.1 | **killed** |
| M-endstate | rollBack resets to `stageBase~1` | D4 | **killed** |
| M-L2-norestore | restore removed, detection kept | the D-A1 junction probe | the attribution control: canaries survive |

**Not run:**
- **M-R22:** POSIX-only, and there is no POSIX machine to run a mutant on. CI ran the unmutated rows.
- **The CA-4h resolve-late mutant:** not constructed.
- **The CA-5 snapshot-timing mutant:** not applicable (§2 CA-5).

**My builder's own defect, disclosed:** insertion edits failed the landing assertion (old text inside new) on the
first batch. Three mutants did not build. The assertion was fixed and they were rebuilt, and nothing was counted
from the failed builds.

---

## 5. Full suite and CI (CA-12)

**QA full suite at the candidate: 02:30:48Z → 02:33:00Z, `SUITE_EXIT=0` (unpiped).**
- 74/74 files, **1096 passed, 2 skipped**, no `Errors` line, no heartbeat timeout, 129.10 s.
- Cumulative test time 593.63 s, against 425.57 s at `5759008`: A adds **~168 s of self-load**.
- Peers (`ListAgents`):

  | When | worktrees-82 | sia-forge-8c | sia-planner-ff |
  |---|---|---|---|
  | before | idle (by its own message, its `npm ci` and vitest had finished, exit 0) | idle | **busy** |
  | after | idle | idle | idle |

- worktrees-82 is the A2A-Hub planner seat. The provenance is its own messages relayed by the planner; Aaron's
  assignment of it is unconfirmed.

**Forge's two runs, which are its testimony** (handoff §6):
- run 1 exit **1**, with G-042's signature, while worktrees-82 was **busy** (this seat's listing at ~02:14:48Z);
- run 2 exit **0**.

**On G-042:** vitest's worker RPC timeout is birpc's `DEFAULT_TIMEOUT = 6e4`
(`node_modules/vitest/dist/chunks/index.B521nVV-.js:3`). That is read from the code, not run. Forge measured the
worst event-loop block at ~5 s, so the error needs the **main** process's reply to be ≥~55 s late: load, either
external or the suite's own. One quiet green does not separate those. **Per Aaron's split this attribution is
candidate B's**, and is not scored here.

**CI run `35810513171`** (pull_request on PR #112, head `918a1c9` = `3b19287` + docs), **success**, read from its log:
- git 2.55.0;
- 74/74 files, 1095 passed, 3 skipped, no Errors line;
- the POSIX CA-6 rows are `✓`;
- the CA-5 row on 2.55.0 is `✓`.

The 3 skipped in `process-role.test.ts` are exactly the three `skipIf` rows: `2.5 (win32)`, the win32
normal-exit row, and the `claude --help` pin.

## 6. `/sync --check` (CA-12)

`gitnexus analyze` in the QA tree:
- first run exit **1**: `FTS index 'file_fts' is inconsistent … missing during delete`, **T-055 again**;
- second run exit 0, with an automatic full rebuild (3,449 nodes), which is G-043's recorded behaviour.

`sync --check`:
- **exit 1**: 25 passed, 2 warnings, **3 issues**, **0 skipped**;
- `gitnexus-index` pass (at HEAD), `build-freshness` pass;
- the issues are `prd-version`, `summary-version` (views at v0.44.0, rev 84) and `retirements` (ENTITIES.md names
  `dream` and `reflection queue`).

**All three issues' inputs are byte-identical** between the base `f673d5e` and the candidate (`git diff --quiet …
-- .agents package.json open-brain/package.json CHANGELOG.md README.md` exit 0). **Control:** the harness source
differs, exit 1. So they are pre-existing, and the candidate does not own them.

---

## 7. What could not be verified, stated so nobody inherits it as settled

1. **D-A1's POSIX file-symlink variant** (overwriting a link target through `writeBack`) is **predicted from the
   code, not measured**. Creating the symlink fails with `EPERM` here, and no POSIX machine ran it.
2. **M-R22** (POSIX group kill) as a mutant: no POSIX machine to run it on.
3. **The CA-4h resolve-late mutant:** not constructed.
4. **CA-9's real-run artefacts** (Forge's `result.json`, the role transcript): not inspected by this seat, so A4b's
   evidence is **attributed**.
5. **G-042's cause** (external versus the suite's own load): not separated, and moved to candidate B by Aaron's
   split.
6. **The declared unrunnables** (criteria §3): U1 network egress; U2 writes outside the repository other than the
   deliverable; U3 escaped descendants; U4 the **real** machine config files; U5 role output quality; U6 argv
   parsing inside the native `claude.exe`.
7. **Change detection on the real system config file.** Only the derivation of its path was checked against git's
   report.

## 8. What the checks I ran cannot see

- **One machine.** Every local probe ran on win32 with git 2.54. Linux coverage is CI's unmutated rows only.
- **Stub roles.** The metadata-damage, compose, gpg, CRLF and junction probes use stub roles with one scripted act.
  A real role's partial or interleaved writes were not exercised.
- **Races.** R20's compare-then-call window and any race between a stage's last write and the window's close were
  not probed.
- **Only one link probe.** The junction probe covered `.git/hooks` only. `.git/info`, `<common>/config`,
  `config.worktree` and the `.git` pointer as link-typed paths are **inferred by class**, not measured.
- **CA-4c's global-scope test cannot fail on layer 0** (D-A4). The evidence for layer 0 in the global scope is
  probe H and M-L0's kill of CA-4e.

## 9. Defects, each with the observation that produced it

| # | Severity | Defect | Observation |
|---|---|---|---|
| **D-A1** | **blocker** | layer 2's restore follows links out of the repository, deleting and writing there and leaving the link | §3 |
| D-A2 | low (test) | `process-role.test.ts:245–251` "2.5 CONTROL": its comment says "Stated, not passed", but the body asserts `launcher === null` and `return`s, so vitest reports **passed** wherever `claude` is absent. Its neighbour at :261 uses `it.skipIf` correctly | on CI, `process-role` shows 22 tests, 3 skipped, which are exactly the three `skipIf` rows, so by count this row **passed** on CI (derived, not printed) |
| D-A3 | low (record text) | the `role-timeout` reason says "was killed with its process tree (…). Every window was still closed and restored." unconditionally (runtime.ts:1061–1062) | DFORK: a double-forked descendant survived the win32 timeout kill while the note said `taskkill … exited 0` |
| D-A4 | low (test) | CA-4c's global-scope row simulates global config via `GIT_CONFIG_GLOBAL`, which the runtime strips as a redirect regardless of layer 0, so the row cannot fail when layer 0 is removed (test:206–211) | M-L0 left it green; probe H via `HOME/.gitconfig` separates the two cases |
| D-A5 | low (instrument, outside the candidate) | `open-brain detach`'s refusal says the commits "would be reachable only through the reflog" without checking other refs | at this seat's detach after `c9947c5` was pushed, it said so while a local branch and an origin branch both held all seven commits (read back with `rev-parse` and `ls-remote`) |

## 10. Regressions: previously validated behaviour confirmed still working

- **The full suite** (1096 passed) includes G-045's rows: `refwatch-stage` 21 passed, with D4 now asserting
  `main`'s **value**. It also includes slice two's refusals in `runtime.test.ts` (44 passed): the write allowlist,
  the frozen candidate, the schema cap, exit-codes-only, and the ref watch.
- **This seat's v0.44.1 probe** (`probe.mts`) was re-run in `probeA.mts` form for the DMG rows. The runtime now
  records where it crashed, and its positive control (`refs/anything`) still fails cleanly with
  `stage-changed-ref` and `FAILED.md`.

## 11. Findings that fail no row

- **Recall trigger:** entry 299 was injected after many of this session's Bash calls, each time after the exit
  code had already been captured correctly. PostToolUse lands **after** the act, so it can change what a seat
  concludes but not what it does. Rated neutral each time.

## 12. This seat's error entries and near-misses this session (accepted by the planner in rulings-3 as classified)

**Error entries (escaped):**
- **E1:** told the planner "PRD.md is local-only", which is false.
- **E2:** report 1 says "five" trigger injections; it was six by the time it was committed.
- **E3:** told Aaron at /start that the role files were "loaded". Only their names had been read.
- **E4:** report 1 §1 generalises "PS 5.1 decodes git's UTF-8 as ANSI". Forge's session read the file intact, so the
  variable is the console encoding.
- **E5:** criteria `96738a8`'s CA-4b single-line scan pattern would have missed two real sites, and its "Both
  refusals" wording was stale.

**Near-misses (caught in-process, not numbered):**
- a `grep -c $'\r'` that counted lines, not carriage returns;
- a heredoc plus Windows-Python quoting that turned `\n` into a real CRLF inside a TypeScript literal, repaired by a
  file-based script with a parse check shown to fail first;
- the mutant builder's insertion assertion (§4);
- the first M-backstop, which was type-invalid and discarded.

## 13. PROPOSED criteria amendment, for the next QA session to finalise and the planner to rule on

**CA-15 [proposed]: the watched paths' TYPE.** A link (symlink or directory junction) at any path or tree root
that layer 2 watches is itself a **change**. Watched paths: `<common>/config`, `<git-dir>/config.worktree`,
`<common>/config.worktree`, `<common>/hooks`, `<common>/info`, the worktree's `info/`, and the `.git` pointer.

**Pass:**
- the stage fails `stage-changed-config`;
- the link is **removed** and the original entry recreated from the snapshot;
- **nothing outside the repository is read, written or deleted**;
- the record says what happened.

**Probes:**
- (a) **a directory junction at `.git/hooks` and at `.git/info`** to a scratch victim directory with canary files,
  on win32. The canaries survive, no new file appears in the victim, and the watched root is a real directory
  again afterwards;
- (b) **a POSIX symlink at `.git/config`** (and at `.git/hooks`) to a victim file or directory, **run on CI's
  Linux** where no privilege is needed, read from the run log as passed and not skipped. The victim's bytes are
  unchanged;
- (c) **the attribution mutant** (restore removed, detection kept). It must leave the victim untouched too, which
  shows the probe discriminates the runtime's restore from the role's act.

**Also returned:**
- **CA-4h's clause "M-R18 turns this row red" is not met as written.** R18 is defence in depth whose job shows only
  when layer 2 is absent (the M-L2 versus M-L2+M-R18 pair). This seat recommends the same treatment as layer 1
  (CA-4b-L1): a row built on the pair, or "redundant by construction" stated. **The ruling is the planner's.**
- **D-A4's test fix:** simulate global config via `HOME/.gitconfig`, not `GIT_CONFIG_GLOBAL`. This is a developer
  change to a test; the criteria need no new text.

## 14. Reproduction

The scripts are scratchpad-only and not tracked. Their shapes are enough to rerun them:
- **`probeA.mts`** imports `runtime`, `roles` and `configwatch` from the candidate tree, and Forge's `fixture.ts`
  and `candidate-a-fixture.ts` for **mechanics only**. It runs stub loops with one scripted act per scenario (DMG,
  POS, COMPOSE, GPG, CRLF, INCWT, SYSPATH, DFORK) and reads every observable with its own `spawnSync("git")`.
- **`probeJ.mts`** is the junction and symlink probe against a scratch victim directory with canary files.
- **`probeH.mts`** runs global config through a scratch `HOME/.gitconfig`, against the candidate and against M-L0.
- **Mutants:** `git archive 3b19287 open-brain` with a `node_modules` junction. Each edit is asserted to land
  exactly n times (insertions by the count of the new text), then `tsc --noEmit`, then vitest with
  `--reporter=json` on the targeted rows.

## 15. Handoff to the fresh QA session (D-035)

1. **Read this report, the criteria at `c9947c5`, and rulings-1 to 4 first.** Then write the CA-15 amendment
   (§13) as a new commit citing `c9947c5`, **before** the repaired candidate exists, and get the planner's ruling
   on CA-15 and on CA-4h's M-R18 clause.
2. **The repaired candidate re-runs every row**, not only CA-4a and CA-15. The restore change touches layer 2,
   which CA-4a/b/d/h/i, CA-5, CA-8 and CA-11 all depend on.
3. **Re-use the shapes in §14.** In particular, run the junction probe (a) against the new SHA **and** its
   attribution mutant. Get the POSIX symlink probe (b) into a test that runs on CI.
4. **Carry forward the defects the next candidate might not fix:** D-A2, D-A3, D-A4. Check each and report it,
   whatever the outcome.
5. **CI is pull_request-only.** Ask the planner for a PR on the new candidate branch at once, so the Linux rows
   exist when scoring starts.
6. **Nothing is pushed from this seat without Aaron's word in its own session.** Every push is a branch tip.
