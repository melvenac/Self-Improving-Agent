# T-185 round 2: developer handoff (record session 121)

**By:** Forge (developer), record session 121 · 2026-09-26. **Model:** `claude-opus-5-5`. **Effort, as read from this
session's transcript:** `"effort":"high"` on all 138 transcript entries that carry the field (03:25:44Z to 03:38:23Z,
all after the `/clear`). **Medium was asked and high is what ran.** That is the same result as importer round 4.

**Brief:** `docs/loops/t185-rulings-qa120.md` "Round 2" and "Brief (record 121)", on
`origin/docs/session-100-qa99-dispatch`. **Branch:** `loop/t185-r2` from `origin/loop/t185-cli-flags` `6e50cf8`.
**Candidate: `b8958a0`.**

## 1. Commits

| SHA | What |
|---|---|
| `4dbbe55` | **Red first** (also pushed as `loop/t185-r2-redcheck`). Tests only: the typographic-dash parser rows, QA 120's em-dash migrate row, four migrate all-or-nothing rows and one both-valid control, the own-line usage check, QA 120's three DB-not-created rows, and the three argument-guard rows. The guard's argument loop is **deliberately left out** of this commit so that its rows are red. |
| `9b36ef0` | **R185-5, first half.** `parseArgs` treats a token that starts with U+2010–U+2015, U+2212, U+FE58, U+FE63 or U+FF0D as an unrecognised flag. The error names it: `unrecognised flag "—dry-run" (a typographic dash, not "-").` A value flag no longer takes such a token as its value. This commit also changes one test assertion (§2, row V). |
| `dba2fa8` | **R185-5, second half, and a doc fix for R185-6.** `state migrate` runs a dry-run pass over every named file (exists, parses, migrates and validates) before it writes any. If any file is refused, none is written, each file that was not refused prints `not written: another named file was refused`, and stderr says `nothing was written for any named file`. The top-level usage line for `state migrate` now names `[--last-session-seat <seat>]`. The own-line check found that gap on its first run (§2). |
| `b8958a0` | **R185-8.** `inScratch(cwd, args)` also refuses any argument that resolves to an **existing** path outside the OS temp dir, compared by realpath. Its comment now claims only that. It does not look at paths the CLI derives for itself (the project root it walks up to, or the DB from the environment). The fixtures keep those inside the scratch dir, not the guard. |

**Not done (not ruled):** QA's Open 3 (`--ide` value), N1 and N3. N4 is fixed by R185-5: `sync —check` now refuses as a
flag, not as a directory.

## 2. Red first, read per test

**The run:** `36215093112`, `loop/t185-r2-redcheck` `4dbbe55`, tcm-1. The result was a failure: **Test Files 2 failed /
71 passed (73). Tests 20 failed / 1100 passed / 1 skipped (1121).** `onTaskUpdate`/`Unhandled`: 0 lines. **Every
failure is one of my new rows, and I saw nothing failing outside the two T-185 files.** A local run of the two files
gave the same 20.

| Rows | Why each was red (the assertion that failed) |
|---|---|
| 10 × `U+xxxx … refuses as a flag, on an 'any' command and a 'directory' one` | `expected a refusal … expected true to be false`: `state migrate` accepted the token as a positional |
| V: `is not taken as a value flag's value` | Refusal expected, and `--seat —dry-run` parsed **ok**, with the dash token as the seat |
| `every flag state migrate declares is documented on its own usage line` | `state migrate declares --last-session-seat`: the top usage line did not name it. **This is a real documentation gap, found by the new check.** It is not the known positive; see §3, M1 |
| `state migrate —dry-run … byte-identical` | `expected 1 to be 2`: the file was migrated, and the em dash was taken as a missing second file (D1) |
| 4 × `state migrate with <a missing file named after / named first / not JSON / not a state record> writes none of the files` | `expected '{"schema_version": 2 …' to contain '"schema_version": 1'`: the valid file **was** migrated, next to a refusal that said "nothing was written for those" |
| 3 × `inScratch … refuses before anything spawns` (the filesystem root, a file outside, `..`) | `expected [Function] to throw`: the guard looked only at the cwd. Every spawn in this block is `state show`, which is read-only, so the red run harmed nothing |

**Green at the base, as expected:** QA's three DB-not-created rows. The candidate was already correct (QA's D3). Their
positive is QA's mutant, M2. The both-valid migrate control and the "inside the temp dir still passes" guard row are
also green at the base. They check that the fix does not over-refuse.

**Row V's assertion changed after the red run, in `9b36ef0`.** The red-run version expected `--seat needs a value`. The
parser reports unknown flags before value problems, so the fixed code refuses with `unrecognised flag "—dry-run" (a
typographic dash…)` instead. The row now asserts that text. It is still red at the base for the same reason: the
parse is **ok** there. M4 kills it.

## 3. Green, and the mutants

**Green:** run `36215373898`, `loop/t185-r2` `b8958a0` (the log's fetch line shows `+b8958a0…`), tcm-1. The result was
**success. Test Files 73 passed (73). Tests 1120 passed / 1 skipped (1121).** `cli-flags` 33 ✓ and `cli-args` 53 ✓.
`onTaskUpdate`/`Unhandled`: 0 lines. Locally, the two files are also green: 33 and 53.

**The mutants:** each is one change off `b8958a0`, `tsc --noEmit -p .` clean, pushed and read back. All were
dispatched on tcm, and each log's fetch line shows the mutant's SHA. `onTaskUpdate`/`Unhandled` is 0 in every run.

| # | Protection | Mutant | Branch / SHA | Run, runner | Failing rows | Result |
|---|---|---|---|---|---|---|
| M1 | R185-6, **the known positive** | QA's `fa77c58`, cherry-picked: `sync` declares `--dry-run` | `loop/t185-r2-mut-sync-declares-dry-run` `905bfdd` | `36215375393`, tcm-1 | **1**: `every flag sync declares is documented on its own usage line` | **killed** (it survived `9473b0d` in QA's `36212775645`) |
| M2 | R185-7, **the known positive** | QA's `ba19f19`, cherry-picked: relocate parses after `openV2Database` | `loop/t185-r2-mut-db-before-parse` `c5c1e24` | `36215377167`, tcm-2 | **2**: both relocate DB-not-created rows. The topics row stays green, as expected: the mutant moves relocate only | **killed** (it survived `9473b0d` in QA's `36212582133`) |
| M3 | R185-5, the token | The dash check removed from the token loop | `loop/t185-r2-mut-no-dash` `2f8372c` | `36215379177`, tcm-2 | **12**: the 10 dash rows, row V, and the em-dash migrate row | **killed** |
| M4 | R185-5, a value flag | A value flag takes a dash token as its value again (`next.startsWith("-")`) | `loop/t185-r2-mut-dash-as-value` `2d5c125` | `36215380590`, tcm-1 | **1**: row V | **killed** |
| M5 | R185-5, the shape | `state migrate` writes each file as it checks it (`migrate(f, dryRun)` in the check pass) | `loop/t185-r2-mut-migrate-writes-first` `473cc85` | `36215381999`, tcm-1 | **4**: all four "writes none of the files" rows | **killed** |
| M6 | R185-8 | `inScratch` looks at the cwd only (the argument throw disabled) | `loop/t185-r2-mut-guard-cwd-only` `ce05011` | `36215383521`, tcm-2 | **3**: the root, the outside file, and `..` | **killed** |
| M7 | R185-6, the check itself | **The own-line match widened back to the whole text**, stacked on M1 | `loop/t185-r2-mut-whole-text` `13bab90` | `36215384959`, tcm-2 | **0**: success, 1120 passed / 1 skipped | **survives, as it should.** This is the round-1 check, and it cannot see M1. With the match widened, `sync --dry-run` gets through again. So what kills M1 is the own-line match and nothing else |

M7 is stacked because the widening alone changes nothing on a correct tip. It needs a declaration that only the whole
text documents, and M1 is that declaration.

## 4. QA 120's own scripts on the new tip

- **`qa120-t185.test.ts`**, copied into `open-brain/tests/` at `b8958a0` and removed afterwards (never committed):
  **9/9 pass, exit 0.** The em-dash row was red at `9473b0d` (D1) and is now green. The other 8 are unchanged.
- **`probes.mjs`**: not run by me. It needs a built scratch clone per QA's README. The rows I expect to change are the
  em-dash migrate row (now exit 2, `refuse2`, file unchanged) and any directory command given a dash token (N4: now
  named as a flag). The top-level usage text also gains `[--last-session-seat <seat>]`. As far as I can see, no probe
  captures the usage text.
- **`qa120-inscratch.test.ts`** carries its own verbatim copy of the **old** `inScratch`, so its A3 still records the
  bypass. That row is the one R185-8 changes. The equivalent attacks against the new guard are the three rows in §2.

## 5. What I did not do, and why

- **No full local suite** (the planner's ruling). The two T-185 files and QA's file were run locally, one at a time.
- **GitNexus `impact`** was not run. The index lives in one checkout and is skipped in this worktree. `parseArgs`'
  callers were found by grep instead: `cli.ts` `parseOrRefuse`, the two test files, and QA's `doc-invocations.mjs`.
- **`tsc --noEmit -p .`** covers `src/` only (T-152). It was clean on every branch before every push. The test files
  are not type-checked.
- **`/sync`** was not run before these commits. This checkout's build is stale (built from `78a7d13`), and the
  commits touch only `open-brain/src`, the tests, and this document. The versions are unchanged, and no CHANGELOG
  entry was made: the planner rules on versioning at merge.
- **Residual on migrate:** the check and the write are separate passes. A file that changes between them is refused at
  write time, and the message then says that the files listed before it WERE written. No test covers that window.

## 6. Branches pushed (each read back with `git ls-remote`)

`loop/t185-r2` `b8958a0` · `loop/t185-r2-redcheck` `4dbbe55` · `loop/t185-r2-mut-sync-declares-dry-run` `905bfdd` ·
`loop/t185-r2-mut-db-before-parse` `c5c1e24` · `loop/t185-r2-mut-no-dash` `2f8372c` · `loop/t185-r2-mut-dash-as-value`
`2d5c125` · `loop/t185-r2-mut-migrate-writes-first` `473cc85` · `loop/t185-r2-mut-guard-cwd-only` `ce05011` ·
`loop/t185-r2-mut-whole-text` `13bab90`. Nothing else was pushed. No master, no force, and no `/end` (T-163).
