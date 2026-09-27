# T-048 round 1 QA report (QA seat, record session 151)

**Candidate:** `7913c5f` on `origin/loop/t048-r1` (handoff `0ec1eba`), stacked on T-179 round 2 `1646567`. Only
what this round adds is scored.
**Machine:** DESKTOP-0GV3HAD (the laptop). User `Aaron`, Node v22.23.2, git 2.55.0.windows.3.
**Launch:** headless, through `docs/loops/qa-151/drive.ps1`. The driver started at 2026-09-27T03:32:31Z with the checkout
at `88377ff` and 4 untracked files, which were the earlier QA reports and were left alone. The driver's
`defender_exclusions` line is empty, so the Defender exclusion of `C:\qa-tmp` could not be confirmed from here.
**Elevation: this process runs ELEVATED.** It has High Mandatory Level, local Administrators, and **`SeBackupPrivilege`
ENABLED** (`whoami /priv`), along with SeRestore, SeTakeOwnership and SeSecurity. This matters for check 1: see the
table there.
**Not used:** `/start`, the MCP server, `gitnexus`, `/end`. No live `state.json` was written: `.agents/state.json` in
each scratch tree hashes the same before and after `sync --check`, and the QA checkout's `git status` is unchanged.
**Scratch:** `C:\qa-scratch\t048\` holds the worktrees `base` (1646567), `cand` and `mut` (7913c5f), `qat`, `qred`,
`qma`, `qmb` and `report`, plus `rc`, a `git clone --shared` of this repository at 7913c5f. Probes and mutants used
TEMP=`C:\qa-tmp`. The one full-suite control run used the default TEMP.

## Verdict

**PASS, with three defects and a test gap. None of the defects is a false pass.**

On real unreadable paths on this machine, all five checks name the path as an ISSUE whenever the path cannot actually
be read. That covers an icacls deny (EPERM), a share-None hold (EBUSY), a directory where a tracked file was (EISDIR)
and a tracked file deleted from the working tree (ENOENT), each on files and on directories. The base passes or
crashes on the same inputs.

I found nothing that reads as a pass when it should not. `sync --check` on this repository's own tree gives the same
verdicts at both commits and leaves the tree untouched. The widened scan finds a retired name planted in each of the 7
new extensions, which the base misses.

The defects are about what the output SHOWS, not about the verdict:

- **D1.** An unreadable path hides a real finding. `module-boundary` and `template-personal-names` return on the first
  unreadable path, so a real crossing or a real personal name is not named at all. In the same input, the base named
  the personal name. `retirements` lists unreadable paths first and cuts at six, so a real finding falls into
  "+N more".
- **D2.** A PARTIAL fallback walk that also has a finding drops its label, so the message says neither FALLBACK nor
  PARTIAL.
- **D3.** `template-personal-names` states what it walked and excluded ("37 file(s) read; excluded: none …"), but only
  in its CheckResult. Its pass has no `report: true`, so the statement never reaches `/sync`'s output, in the CLI or in
  `ob_sync`.

**The test gap:** 4 of my 8 mutants survive the developer's 14 rows (Q2, Q3, Q4 and Q5). All 8 die against my rows
locally. On tcm I sent P1, Q2, Q3, Q4 and Q5, and each was killed (CI section).

## 1. The five checks on REAL unreadable paths, with and without `SeBackupPrivilege`

**Mechanisms.** I used three in the scratch clone `rc`:

- `icacls <path> /deny *<my SID>:(RD)`, on files (read data) and directories (list).
- `[IO.File]::Open(p,'Open','Read','None')` held by a PowerShell process (`hold.ps1`).
- A directory put where a tracked file was.

**The privilege toggle:** `nopriv.ps1` disables `SeBackupPrivilege` in its own token with `AdjustTokenPrivileges`, then
runs node as a child, which inherits the disabled privilege. `whoami /priv` inside it prints `Disabled`. `priv.ps1` is
the same launch path with the privilege left as inherited (`Enabled`). `see.mjs` asks whether each process can read
each path. `five.mjs` runs the three check functions from a given build (`base` or `cand`) against the tree.

| Mechanism | Privilege ENABLED (this seat as launched) | Privilege DISABLED |
|---|---|---|
| icacls deny, file and directory | **READABLE.** Every denied path read through, so all checks read the content, and the base and the candidate agree (`a1-acl.out`) | EPERM on every path |
| share-None hold, file | **READABLE**, as QA 138 §5 found (`b-hold.out`) | EBUSY |
| directory where a tracked file was | EISDIR: both states see it (`c-dir-for-file.out`) | EISDIR |
| tracked file deleted, not staged | ENOENT: both states (`d-unstaged-delete.out`) | ENOENT |

**So the seat as launched could NOT see the ACL or share-None class at all.** With the privilege enabled, the checks
really do read those files, and passing is correct there, because the content was read. Every ACL and EBUSY result
below comes from the privilege-disabled runs. A seat or a developer running unelevated is in the "disabled" column.

**Results, privilege disabled** (`a1-acl.out`, `b-hold.out`, `a3-cli.out`):

| Check (audit row) | Real input | `1646567` (base) | `7913c5f` (candidate) |
|---|---|---|---|
| retirements (SILENT 1), git path | denied `README.md`, `open-brain/src/relocate.ts`, `project-template/README.md` | **silent**: the message names only the ENTITIES finding; the 3 files are not mentioned | issue: `unreadable: README.md (EPERM); unreadable: open-brain/src/relocate.ts (EPERM); unreadable: project-template/README.md (EPERM); …ENTITIES…` |
| retirements, share None | 3 held files | silent | `unreadable: docs/hoh_jev.md (EBUSY)` and the others, all 3 |
| retirements, dir for file | `docs/hoh_jev.md/` | silent | `unreadable: docs/hoh_jev.md (EISDIR)` |
| walkTracked fallback (SILENT 26) | git forced to fail (`GIT_DIR` → nowhere), denied `.claude/commands/` and `docs/loops/` | **pass**: `0 unexpected across 238 live files` (it was 245 readable, so 7 files dropped silently) | issue: `2 path(s) could not be read, so the scan is partial (listed by a filesystem walk — FALLBACK, git ls-files failed …, PARTIAL: 2 path(s) unreadable …): unreadable: .claude/commands/ (EPERM); unreadable: docs/loops/ (EPERM)` (`h-fallback-partial.out`) |
| module-boundary (SILENT 2) | denied `trigger/` dir and `relocate.ts` | **THREW** `EPERM … relocate.ts` (addition (b)) | issue: `2 unreadable path(s) under open-brain/src …: trigger/ (EPERM), relocate.ts (EPERM)` |
| module-boundary, share None | held `relocate.ts` | THREW EBUSY | issue naming `relocate.ts (EBUSY)` |
| template-personal-names (SILENT 3) | denied `.cursor/` dir and `README.md` | **pass**: `No personal names in project-template/` | issue: `project-template/.cursor/ (EPERM), project-template/README.md (EPERM)` |
| template, share None | held `.claude/rules/backend.md` | pass | issue naming it `(EBUSY)` |

**Through the real CLI** (`node <build>/cli.js sync --check` in `rc`, privilege disabled, `a3-cli.out`):

- The candidate prints all three checks as ISSUES naming the paths: 20 passed, 4 issues. With the privilege enabled,
  the same tree gives 22 passed, 2 issues.
- The base **crashes the whole `/sync`** at `checkModuleBoundary` (EPERM, stack trace, exit 1), and no results are
  printed.
- My first CLI run denied `README.md`, and both builds then crashed earlier, in `syncReadmeVersion` (`a2-cli.out`).
  That check is outside this round.

**Historical and allowed-referrer edges** (`a1-acl.out`, `a2-acl-allowed.out`, `h-fallback-partial.out`):

- An unreadable **historical** file (`CHANGELOG.md`) is not named on the git path, which is correct by rule: historical
  files are never read, and the pass counts them (`historical: 392 (by rule)`).
- An unreadable **historical directory** on the fallback walk (`docs/loops/`) IS named, and it makes the walk PARTIAL,
  because the walk records it before the historical filter runs. That errs loud. See O3.
- An unreadable **allowed referrer** (`scripts/setup-hooks.mjs`) crashes the check on both builds. See check 5 (c).

## 2. Nothing new reads as a pass

- **An unreadable path is an ISSUE naming it, in all five:** yes, for EPERM, EBUSY, EISDIR, ENOENT and a throw with no
  code. The no-code case gives `(error)` (my code rows).
- **Each pass states what it walked and excluded:**
  - `retirements`: `0 unexpected across 247 live files read (listed by git ls-files); excluded by extension (…): (no extension) 4; historical: 392 (by rule)` (`e-pass-git.out`).
    - I recomputed it independently from `git ls-files` and the record's `historical`: 643 tracked, 392 historical,
      251 live, which is `.md 59`, `.ts 165`, `.json 14`, `.mjs 7`, `.yml 2` and `(none) 4`. So 247 scanned and 4
      excluded, which matches.
    - The four "(no extension)" files are `.gitignore`, `.gitattributes`, `.gitnexusrc` and `project-template/gitignore`.
      A dotfile counts as no extension.
    - The exclusion counts cover live files only. On this tree the `.diff`, `.out` and `.txt` files are all historical,
      so they appear only in "historical: 392".
  - `module-boundary`: `73 file(s), 52 core; excluded 8 non-.ts file(s)`. It skips no directories, so there is nothing
    else to state.
  - `template-personal-names`: `37 file(s) read; excluded: none (node_modules, .git would be skipped …)`, but only in
    the CheckResult. **It is not printed by `/sync`** (D3).
- **The fallback says FALLBACK, and PARTIAL when a path was unreadable:** yes, when the check has no finding (`g-fallback.out`, `h-fallback-partial.out`):
  - `listed by a filesystem walk — FALLBACK, git ls-files failed — not a git repo, or git unavailable, skipped 1 build/dependency dir(s) with no .gitignore to ask: .git/`
  - `… FALLBACK, git ls-files listed nothing, …`
  - `…, PARTIAL: 2 path(s) unreadable, …`

  **When there is also a finding, the label is dropped entirely** (D2): see `control.out` under `GIT_DIR`, which has
  no "FALLBACK" in it. A small wording point: `.git/` is called a "build/dependency dir".

**Edges attacked:**

| Edge | Result |
|---|---|
| `git ls-files` failing (`GIT_DIR` pointed at nothing) | base: silent walk, `0 unexpected across 245 live files`. Candidate: `FALLBACK, git ls-files failed`, pass, 247 files |
| `git ls-files` listing nothing (`GIT_INDEX_FILE` pointed at nothing: exit 0, 0 lines), the developer's addition (d) | base: silent walk. Candidate: `FALLBACK, git ls-files listed nothing` |
| unreadable AND historical | git path: not named, correct by rule. Fallback: a historical dir is named as PARTIAL (O3) |
| unreadable AND an allowed referrer | **crash**, on both builds (check 5 (c)) |
| several unreadable paths alongside real findings | **D1.** Six denied files plus the ENTITIES finding give `unreadable: ×6; +2 more`, so the ENTITIES retired names are not shown. A template file with "Clark" plus ONE unreadable template file gives only the unreadable message, and the base named "Clark". A planted core→memory import plus one unreadable `.ts` gives only the unreadable message (`i-unreadable-plus-findings.out`, `i-plants-readable.out`). **The cut-off matters, but so does the early return: in two of the checks a single unreadable path is enough to hide the finding.** |
| a tracked file deleted but not staged | **new:** `unreadable: docs/hoh_jev.md (ENOENT)`, an issue. The base was silent. See O1 |

## 3. The widened retirements scan

- **This tree:** the widened list adds exactly 2 live files, `.github/workflows/ci.yml` and
  `project-template/.agents/examples/e2e.yml`, so 245 → 247 files. There is no new finding, which confirms the
  developer's report. All 21 `.sh`, 6 `.ps1` and 10 `.mts` tracked files are historical.
- **Planted:** I staged a new file in `rc` for each of `.sh .ps1 .yml .yaml .toml .mts .cts`, each naming
  `knowledge-mcp` (`f-widened-plant.out`).
  - **The base passes:** `0 unexpected across 245 live files`.
  - **The candidate finds all 7:** it shows six and `+1 more`.
- **Counted by extension:** I staged `.txt ×1` and `.bat ×2`, each naming `knowledge-mcp`. The candidate passes with
  `excluded by extension (…): (no extension) 4, .bat 2, .txt 1` (`f2-excluded-count.out`). The counts are right, and
  the exclusion is stated, not silent. A retired name in a `.bat`, `.cmd` or `.py` would still pass (O4).

## 4. Preserve

- **Verdicts:** `sync --check` in each worktree, on its own tree, gives the same result at `1646567` and `7913c5f`:
  23 passed, 3 warnings, 2 issues, 4 skipped, exit 1 on both.
  - `retirements` is an **issue on both, with identical text naming `.agents/SYSTEM/ENTITIES.md`** (dream,
    reflection queue).
  - The only differences are:
    - `module-boundary` gains `; excluded 8 non-.ts file(s), not modules in the graph`;
    - `build-freshness` shows each build's own HEAD;
    - `record-erasure` walks 835 or 837 commits;
    - `merge-markers` counts 642 or 643 files, for the added test file (`sync-check-own-tree-*.out`).
- **Read-only:** I compared the state before and after a second `sync --check` in each worktree. `git status
  --porcelain --ignored` is identical (2 lines), a sha1 over every tracked file's content is identical, and
  `.agents/state.json`'s hash is identical.

## 5. The developer's audit additions

- **(a) The "binary" catch never fires: CONFIRMED** (`a-binary.out`). I made a 4 KiB `project-template/qa151-logo.png`
  with 15 NUL bytes and 2045 U+FFFD after decoding, containing ` Aaron `.
  - **The base FLAGS it** (`project-template/qa151-logo.png ("Aaron")`). So the base's catch did not fire on a binary,
    and the binary was decoded and scanned.
  - The candidate does the same. A nameless binary is counted as read (37 → 38).
- **(b) SILENT 2 used to CRASH: CONFIRMED on real errors.** The base's `checkModuleBoundary` threw `EPERM` and, in
  another run, `EBUSY` on `relocate.ts`, and the whole `sync --check` exited 1 with a stack trace and no results.
- **(c) The allowed_referrers read has no try: CONFIRMED, and it is a CRASH, not a false pass.** With
  `scripts/setup-hooks.mjs` (an allowed referrer of R-006) denied:
  - Both builds throw `EPERM … setup-hooks.mjs` from `checkRetirements`, at `checks.js:1055` on the candidate.
  - The whole `sync --check` exits 1 with a stack trace and prints no results (`c-allowed-referrer-cli.out`).
  - It is loud, so no one reads it as a pass. But one unreadable referrer takes down every other check's report too.
    Still open, as the developer said.

## 6. Mutants

I wrote 7 mutants and re-ran P1. `mutants-qa151.cjs` makes an exact-string replace in `checks.ts` (it must match once),
rebuilds, runs the rows, and runs a real-path probe against `rc`.

- **The probe:** privilege disabled, with denies on `docs/hoh_jev.md`, `relocate.ts`,
  `project-template/.claude/rules/backend.md`, `project-template/.cursor/` and `.claude/commands/`, plus a staged
  `.yml` plant.
- **The control** (unmutated) is in `evidence/mut/control.out`.

| # | Mutant | Developer's 14 rows | QA rows (`t048-qa151-real`, `-codes`) | Real probe vs control |
|---|---|---|---|---|
| P1 | retirements read `catch { continue }` (re-run) | **killed**: 1 row, SILENT 1 | killed: 4 code rows (and on Linux the chmod row) | the 3 `unreadable:` entries vanish |
| Q1 | SILENT 1: unreadable paths make it an issue but are not named | killed (3 rows) | killed (8) | the 3 entries vanish |
| Q2 | SILENT 20: `SCANNED_EXT` loses `yml\|yaml\|toml` | **SURVIVED** | killed (`.yml`, `.yaml`, `.toml` rows) | the `.yml` plant's finding vanishes |
| Q3 | SILENT 26/(d): an empty `git ls-files` listing is trusted | **SURVIVED** | killed (2 rows) | **false green:** `0 unexpected across 0 live files read (listed by git ls-files)` |
| Q4 | SILENT 2: records an unreadable `.ts` only if the code is EACCES | **SURVIVED** | killed (4 code rows) | **false green:** module-boundary `[pass]` with `relocate.ts` EPERM |
| Q5 | SILENT 3: any error but EACCES is treated as a "binary" | **SURVIVED** | killed (4 code rows) | `backend.md (EPERM)` vanishes |
| Q6 | SILENT 26: the walk's unreadable paths reach the label but not the verdict | killed (2) | killed (4) | `.claude/commands/`, `.cursor/` vanish |
| Q7 | SILENT 3: an unreadable dot-directory is not reported | killed (1) | killed (4) | `.cursor/` vanishes |

- **Why Q4 and Q5 survive:** the developer's mock throws only EACCES. This machine's kernel says EPERM for an ACL deny,
  EBUSY for a hold and EISDIR for a directory where a file was. A filter on EACCES passes all 14 rows and drops every
  real Windows denial.
- **Linux does not close this gap:** chmod 000 also gives EACCES there.
- **What closes it:** rows that throw the other codes.

Evidence: `evidence/mut/mutants-qa151.out` (the developer's rows plus the probes) and `mutants-qa151-qarows.out` (my
rows).

- **P2–P13 were not re-run.** Only P1 was re-run, as the dispatch asked.
- **A first pass of the driver lost backslashes** in the Q2 and Q7 find strings. Q2 was reported "not applied", and Q7
  applied a no-op. Both were fixed with `String.raw` and re-run (`q2-q7.out`). The table shows the corrected runs.

## CI

**The developer's three runs, which I re-read per test from `gh run view --log`:**

| Run | Ref | Runner | Per test |
|---|---|---|---|
| 36286042335 | `loop/t048-r1-red` `a061f72` | tcm-1 | **13 failed \| 1308 passed \| 2 skipped (1323)**. 86 of 87 files passed, and every FAIL line is in `t048-unreadable.test.ts`: all rows except the preserve row. The SILENT 1 row failed at `:79`, the pre-fix version that denied all three ops |
| 36286037658 | `loop/t048-r1` `b93e927` | tcm-1 | **1321 passed \| 2 skipped, 0 failed**, 87/87 files. `t048-unreadable.test.ts` 14/14 |
| 36286040025 | `loop/t048-r1-mut-p1` `ec67acd` | **tcm-2** | **1 failed \| 1320 passed \| 2 skipped**. The one failure is the SILENT 1 row at `:83` |

All three are `workflow_dispatch` runs on tcm, not local runs, and they agree with the developer's corrected table.
The runner user is not root: the workflow's egress self-check prints `denied: /opt/doorctl`.

**QA runs:** 4 of the 6 allowed (2 unused), all on tcm, `hosted=false windows=false`, pushed through `push-qa.mjs` and read back.

| Run | Ref | Runner | Result |
|---|---|---|---|
| **36292817248** | `qa/t048-r1-tests` `d5a32d9` (the candidate plus QA rows) | tcm-1 | **success: 1362 passed \| 2 skipped (1364)**, 89/89 files. 1362 = 1321 + my 41 rows. The 2 skips are the same 2 as the developer's green run, so **the 6 real chmod-000 rows RAN and passed on Linux as non-root**: real kernel EACCES in all five checks |
| **36292818725** | `qa/t048-r1-tests-red` `eae611c` (plus the defect rows) | tcm-1 | **4 failed \| 1362 passed \| 2 skipped**. The 4 are exactly the D1 ×3 and D2 rows, each on its own assertion (`defects.test.ts:70, 82, 95, 110`) |
| **36292820170** | `qa/t048-r1-mut-a` `917b844` (P1 + Q4 + Q5) | tcm-1 | **14 failed \| 1348 passed \| 2 skipped**: the developer's SILENT 1 row (P1), my real chmod SILENT 1 row (P1), and 12 code rows (4 for each of P1, Q4 and Q5). **My real chmod rows for the module-boundary and template FILE reads stayed GREEN under Q4 and Q5,** because Linux says EACCES, so that confirms Linux does not close the gap |
| **36292821625** | `qa/t048-r1-mut-b` `283807b` (Q2 + Q3) | tcm-2 | **5 failed \| 1357 passed \| 2 skipped**: the `.yml`, `.yaml` and `.toml` rows (Q2) and the 2 empty-listing rows (Q3), exactly |

**Local control:** the full suite on the candidate, in the default TEMP, on this machine: **87/87 files, 1323 passed**.
Exit 1 came from one vitest unhandled error, `[vitest-worker]: Timeout calling "onTaskUpdate"`, an RPC timeout, while
my mutant runs loaded the machine (`full-suite-cand-defaulttemp.out`). In one local mutant run on `qma`,
`ci-status … skips rather than throws` also timed out at 5233ms under the same load. That file is not touched by this
round.

## What could not be verified

- **The ACL and share-None class, as this seat was launched.** With `SeBackupPrivilege` enabled, the elevated process
  reads through both. Every such result above was produced by explicitly disabling the privilege in a child token. I
  did not run a truly unelevated (medium-integrity) process. The disabled-privilege token is still an admin token.
- **The real-kernel rows on Windows.** The six chmod rows skip on Windows. They ran on tcm (36292817248), and the
  Windows side was run by hand (check 1).
- **The developer's P2–P13,** which were not re-run.
- **Defender's exclusion of `C:\qa-tmp`:** the driver's `defender_exclusions` line is empty.
- **`ob_sync` (the MCP tool):** the MCP server was not available. I read D3 from `server.ts:155-160`, which filters on
  `c.report` exactly as the CLI does. I did not run it.

## Defects

- **D1 (moderate): an unreadable path hides a real finding.**
  - **Where:**
    - `checkModuleBoundary` returns at `if (unreadable.length > 0)`, before the graph is built.
    - `checkTemplatePersonalNames` returns before `hits` is reported.
    - `checkRetirements` builds `[...unreadable, ...unexpected, ...stale].slice(0, 6)`.
  - **What it costs:**
    - The verdict stays an issue, so nothing is a false pass.
    - But whoever reads the output learns of the real crossing or leak only after fixing the permissions. For the
      template check that is a regression in what is shown: the base named `("Clark")`, and the candidate does not.
  - **Rows:** `qa/t048-r1-tests-red`, `t048-qa151-defects.test.ts`, 3 rows, red on the candidate.
  - **Suggested fix:** report both, the unreadable paths and the findings, with findings not cut behind unreadables.
- **D2 (minor): a PARTIAL or FALLBACK listing label is dropped when there is also a finding.**
  - **Where:** `checkRetirements` builds `lead` with `listing.label` only when there is no `unexpected`/`stale`.
  - **What it costs:** a PARTIAL walk with a finding says neither FALLBACK nor PARTIAL. The unreadable path is still
    named.
  - **Row:** 1, red.
- **D3 (minor): the template check's pass statement is invisible.** `checkTemplatePersonalNames`'s pass has no
  `report: true`, so `N file(s) read; excluded …` is never printed by `/sync` (`cli.ts:125`, `server.ts:155`). The
  brief says each check's OUTPUT states what it walked. The other two checks print theirs (`report: true`).
- **The test gap (not a code defect): 4 of 8 mutants survive the developer's rows.** Q2 and Q3 have no row, and Q4
  and Q5 are the mock's single error code. My rows on `qa/t048-r1-tests` kill all 8. Merging them, or an equivalent,
  is my recommendation.

**Observations, not defects:**

- **O1:** an unstaged deletion of a tracked file is now `unreadable: <path> (ENOENT)`, an ISSUE. It is loud, and it is
  arguably right, because the index still holds the file. But "unreadable" is the wrong word for "deleted in the
  working tree".
- **O2:** an unreadable `README.md` crashes all of `/sync` in `syncReadmeVersion`, on both builds.
- **O3:** the fallback walk names an unreadable HISTORICAL directory as PARTIAL, while the git path ignores historical
  files. This is inconsistent, but it errs loud.
- **O4:** `.bat`, `.cmd`, `.py`, `.service` and `.timer` stay unscanned. They are counted in the pass, so this is not
  silent.
- **O5:** `merge-markers` (outside this round) went from 643 to 640 files with 3 denied files, and said nothing
  (`a3-cli.out`). It is the same SILENT class, in a check that is not in this round.

## Disagreements with the handoff

- **"Platform limit: none" for the developer's rows.** That is true of where the rows run, but the rows only exercise
  EACCES. The real codes on Windows are EPERM, EBUSY, EISDIR and ENOENT, and Q4 and Q5 show that this matters.
- **"13 of 13 mutants killed."** That is true of the developer's own 13. Of my 8, 4 survive the developer's rows.
- **"No new finding" on this tree:** agreed.
- **"Unreadability is hard to make portably on Windows":** agreed for a test. On a real Windows machine it was easy to
  make, with icacls, a hold, or a directory where a file was, as long as the reading process does not hold an enabled
  `SeBackupPrivilege`.

## Error entries (my own)

- **E1: `matrix.sh` and the first icacls calls failed** on shell quoting: `$USERNAME` was unset in Git Bash, and a
  `\\$pv` escape broke. Nothing ran against a wrong target. I fixed both and re-ran.
- **E2: the mutant driver lost backslashes** (see check 6). One pass reported Q2 "not applied" and ran Q7 as a no-op.
  Both were re-run after the fix.
- **E3: my first commit attempt failed** because this checkout has no git identity. The worktree `qred`'s
  `reset --hard` then discarded the staged defect file, which I re-wrote from the same content. The branches were
  created with the author `QA seat (record 151)`, as prior QA seats did.
- **E4: I ran the full-suite control concurrently with the mutant runs,** so the load produced one RPC timeout (see
  CI).

## Cleanup

- **ACLs:** every deny ACE was removed. `icacls C:\qa-scratch\t048\rc /findsid *<SID> /T` reports "No files with a
  matching SID was found".
- **Holds:** the hold process exited when its sentinel was deleted.
- **Plants:** all plants and `ENTITIES.md` edits in `rc` were reverted, and `git status` is clean.
- **Worktrees:** `C:\qa-scratch\t048\*` are left in place for the planner, and `git worktree remove` clears them. The
  other seats' worktrees under `C:\qa-scratch` (bf145, il138, t003, cand/mut/report) were not touched.

## Reproduction

The scripts and evidence are in `docs/loops/qa-scripts-t048-r1/` on `qa/t048-r1-report`.

```sh
W=C:/qa-scratch/t048
for p in "base 1646567" "cand 7913c5f" "mut 7913c5f"; do set -- $p; git worktree add --detach $W/$1 $2 && (cd $W/$1/open-brain && npm ci && npm run build); done
git clone -q --shared <this repo> $W/rc && git -C $W/rc checkout -q --detach 7913c5f
icacls <rc path> /deny "*<SID>:(RD)"                          # file: read data; directory: list
sh s/matrix.sh C:/qa-scratch/t048/rc "<label>" <rel paths>   # see.mjs + five.mjs, base and cand, priv and nopriv
powershell -File s/hold.ps1 -Sentinel <p> <files...>         # share-None hold, until <p> is deleted
GIT_DIR=<nowhere> / GIT_INDEX_FILE=<nowhere> node s/five.mjs <build> <rc>   # git ls-files fails / lists nothing
(cd $W/mut/open-brain && powershell -File s/nopriv.ps1 s/mutants-qa151.cjs <ev>)   # with the rc denies in place
node s/apply-mut.cjs <tree> P1 Q4 Q5                          # mutant branches
node docs/loops/qa-151/push-qa.mjs qa/t048-r1-<name> ; gh workflow run ci.yml --ref qa/t048-r1-<name> -f hosted=false
icacls <rc path> /remove:d "*<SID>"
```

## Open for the planner

1. **D1, D2 and D3:** fix in this round, or in a round 2? None is a false pass. My recommendation is a small round 2
   before merge for D1 and D3, because they are exactly "prove it looked" and "say what it found". D2 can ride along.
2. **Merge QA's rows** (`t048-qa151-real.test.ts`, `t048-qa151-codes.test.ts`), or ask the developer for equivalents?
   Without the code rows, a filter on EACCES would regress silently on every Windows seat.
3. **(c), the allowed-referrer crash,** is still open by the developer's choice. It crashes all of `/sync`. Which
   round?
4. **The seat's elevation:** this seat ran elevated with `SeBackupPrivilege` enabled, and so, as launched, could not
   see the ACL or EBUSY class. Should the QA launch disable the privilege, or run unelevated, for rounds about
   unreadable paths? The same question was raised in QA 138.
5. **O1:** should an unstaged deletion be "unreadable (ENOENT)", or a separately worded "deleted in the working tree"?

QA-151: REPORT COMPLETE
