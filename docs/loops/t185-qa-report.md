# T-185 QA report (record session 120): an unrecognised CLI flag refuses

**By:** the QA seat, record session 120, running headless on the QA PC `DESKTOP-O4EGB1E` · 2026-09-26 (UTC).
**Dispatch:** `docs/loops/t185-dispatch-qa.md` at `9208dde`. **Candidate:** code `9473b0d` on `origin/loop/t185-cli-flags`,
with the handoff at `6e50cf8` (the diff after `9473b0d` is `docs/loops/t185-developer-handoff.md` only, confirmed).
**Model and effort:** Claude Opus 5.5 (`claude-opus-5-5`), effort **high**. Both come from this process's command line
(`claude.exe -p … --model claude-opus-5-5 --effort high --permission-mode dontAsk …`), read with `Get-CimInstance
Win32_Process`. Session `ee00d1de-2835-4f36-9921-05c6bc53af24` (from this session's task-output path). It was the only
`claude` process on the PC at the start.

## Verdict

**ACCEPT T-185 at `9473b0d`, with two defects to fix in a short test-and-code round (D1, D2) and two test gaps (D3,
D4).** None of them is a regression. On every command in the brief's table, every typo the developer tried and every
typo I tried refuses with exit 2, names the token, and leaves the target byte-identical. The one exception is D1.

- **D1 (medium, code): `state migrate --seat developer —dry-run state.json` migrates the file for real.** An em dash
  (U+2014, which autocorrect and pasted docs produce) does not start with `-`. The helper therefore takes it as a
  positional, and `state migrate`'s positionals are `any`, so `—dry-run` becomes a second file. That file is refused
  as missing, and the real file is migrated anyway. The exit code is 1 and the message ends `nothing was written for
  those`, which is true only of the missing file. The directory commands are safe from the same token, because the
  directory check refuses it (exit 2).
- **D2 (medium, test gap): a flag declared on the wrong command passes every test.** I added `--dry-run` to `sync`'s
  declaration. It is documented, but only for `detach` and `state migrate`. All 61 tests in the three relevant files
  still pass locally. On tcm the **whole suite passes**: run `36212775645` (tcm-2), 1088 passed / 1 skipped. With that mutant, `sync --dry-run` **runs the fixing
  sync**: exit 0 and the README rewritten. The reverse check ("every declared flag is documented") searches the whole
  usage text, not the command's own line.
- **D3 (low, test gap): "parsed before the database is opened" has no test.** `relocate`'s parse moved below
  `openV2Database` survives the developer's suite, locally and on tcm (run `36212582133`: success, 1088 passed). The candidate itself behaves
  correctly: no DB file is created on a refusal.
- **D4 (low, test harness): `inScratch()` checks only the cwd.** None of the 20 committed rows can reach the real
  checkout, so the dispatch's concern holds for the tests as written. But the guard does not look at positionals.
  A test in the same style that passes an absolute path outside the temp dir ran a fixing sync on it (shown on a
  stand-in project).

## T185-1: the shared rule, the directory check, the parser list

| Claim (handoff §2–§3) | Checked how | Result |
|---|---|---|
| A shared helper (`src/shared/cli-args.ts`), not a reuse of R2-4, because R2-4 is not on master | Read `8af41dd`'s `state import` section: `args.slice(2).find((a) => !a.startsWith("--"))`, with no unknown-flag check | **Holds** |
| Any `-` token that is not declared refuses with exit 2, names the token, and lists the flags | 75 probes (below), at both the candidate and the base | **Holds** for every `-`/`--` token |
| Parsed before any import, DB open or file read | Read every call site. Probes: relocate/topics/backfill refusals create **no DB file** (at the base, all three created one) | **Holds**. It is untested for relocate and topics (D3). |
| A missing directory refuses, and no walk-up happens from a path that does not exist. An existing one still walks up. | Probes `sync no-such-dir`, `start no-such-dir`, `detach no-such-dir`, `sync package.json` (a file), `sync . ..` | **Holds**: all exit 2, nothing changed. At the base, `sync no-such-dir` **rewrote the fixture README** and `detach no-such-dir` **moved HEAD**. |
| `state import`'s section is untouched | `git diff 8af41dd 9473b0d -- open-brain/src/cli.ts` touches the `sync` through `state show` sections only. `state-import/` has no diff. | **Holds** |
| Exit codes: 2 is the new refusal, and the old refusals stay at 1 | Probes: `state migrate` with no `--seat` and a missing file still exit 1 | **Holds** |
| **Parser list** (the deliverable) | `git grep -E "process\.argv\|\bargv\b\|parseArgs\("` over every tracked file except docs, `*.md`, `state.json` and the lockfile | **Same 5 argv sites** as the handoff: `cli.ts`, `harness/cli.ts`, `backfill-success-rate.mjs`, `cli-bootstrap.ts` and `server.ts` (`argv[1]` only). `cli-session-end.ts` and `cli-recall-trigger.ts` have none. Nothing at the repo root, in `project-template/` or in `.github/`. The harness CLI refuses `schemas --bogus`, `schemas -h`, `run --bogus` and `run -dry-run …` with exit 2 (probed). **The list is complete.** |

## T185-2: the tests

- `tests/cli-flags.test.ts` (20 e2e) and `tests/shared/cli-args.test.ts` (34) cover what the brief asks for. That is a
  `-x` and a misspelled `--x` for each mutating command, exit 2 first, the token, `Accepted flags:`, and a byte
  snapshot (for detach, also `symbolic-ref`, `HEAD` and `porcelain`), plus premise rows. The walk over declared flags
  and the usage-text cross-check are there.
- **Red first, re-verified from the logs** (I did not take the handoff's word for it):

| Run | Ref / SHA | Runner | Result (read from the log) |
|---|---|---|---|
| Red 1 `36209560043` | `loop/t185-redcheck` `905789b` | tcm-2 | failure. `cli-flags` has 16 FAIL rows, and they match the handoff's list. Test Files 1 failed / 71 passed. |
| Red 2 `36209870776` | `loop/t185-redcheck` `598988e` | tcm-2 | failure. 17 FAIL rows, adding the backfill row. |
| Green `36209923825` | `loop/t185-cli-flags` `9473b0d` | tcm-2 | success. Test Files 73 passed. **Tests 1088 passed, 1 skipped (1089).** `cli-flags` 20 ✓ and `cli-args` 34 ✓. `onTaskUpdate`/`Unhandled`: 0 lines. |

- **Independent red at the base (my probes, `8af41dd`):** 64 of 74 non-INFO probes fail. The failures are real harm,
  not wrong exit codes: the fixture README was rewritten by every `sync` typo (including `--help`, `-h`, `—check`,
  `--check=1`, `-`, `--` and `no-such-dir`), and a session log was created by `start --dry-run`, `--dry_run`,
  `--check=1` and `. --dry-run`. **HEAD moved** for every `detach` typo. `state.json` was migrated by every `migrate`
  typo, and a DB was created by every relocate/topics/backfill typo.
- **Gaps:** D2, D3 and D4 above, and N1 below.

## My own typos (the dispatch's list, and more)

The probe is `probes.mjs`. Each probe gets a fresh fixture and a byte snapshot of the **whole** target, `.git/`
included, taken before any git command runs. All state (DB, vault, slot, score history, shadow log, HOME) is
redirected to scratch. **Candidate: 75 probes, 73 PASS, 1 FAIL (D1), 1 INFO.** Every control changed its fixture,
which proves the fixtures would show harm.

| Token | sync | start | detach | state migrate | state show / relocate / topics / backfill |
|---|---|---|---|---|---|
| `--dry_run` | 2 ✓ | 2 ✓ | 2 ✓ | 2 ✓ | |
| `—dry-run` / `—check` / `—json` / `—apply` (em dash) | 2 ✓ (directory check) | 2 ✓ (directory check) | 2 ✓ (directory check) | **1, FILE MIGRATED (D1)** | 2 ✓ / 2 ✓ (`takes no positional`) / 2 ✓ / 2 ✓ |
| `–check` (en dash) | 2 ✓ | | | | |
| `-n` | 2 ✓ | 2 ✓ | 2 ✓ | 2 ✓ | |
| `--check=1` / `--dry-run=1` / `--force=1` | 2 ✓ | 2 ✓ | 2 ✓ / 2 ✓ | 2 ✓ | |
| a flag after the positional (`. --chek`, `. -dry-run`, `<f> --dry-rn`) | 2 ✓ | 2 ✓ | 2 ✓ | 2 ✓ | |
| a flag twice (`--check --check`, `--dry-run --dry-run`) | accepted, check-only, no change ✓ | | accepted, dry run, no change ✓ | accepted, dry run, no change ✓ | backfill `--apply --apply` is accepted (INFO) |
| a value flag twice (`--seat developer --seat developer`) | | | | 2 ✓ (`given more than once`) | |
| `--seat=developer` (space-only flag) | | | | 2 ✓ | |
| `--seat -dry-run` (a dash token as the value) | | | | 2 ✓ (`needs a value`) | |
| a bare `-` | 2 ✓ | 2 ✓ | 2 ✓ | 2 ✓ | 2 ✓ (show, backfill) |
| `--` | 2 ✓ | | | | |
| `-dry-run` with fetch allowed | | | 2 ✓, no `FETCH_HEAD` | | |

For an em dash on a directory command, the refusal reads `"—dry-run" is not an existing directory`, not `unrecognised
flag`. It names the token but does not list the flags. That is acceptable, and the D1 fix below would improve it.

## Rulings checks

- **R185-1 (`cli-bootstrap` does not refuse): the reasoning HOLDS, with one qualification.** The probe is
  `bootstrap-probe.mjs`: 7 invocations × 2 payload shapes, run against a scratch project and slot. Every run exits 0,
  and base and candidate give identical tables (the file is unchanged). **An unknown flag changes nothing written**:
  `--idee cursor`, `--verbose`, `-ide cursor` and a bare `--ide` all key the slot `::claude`, exactly as the
  no-argument Claude Code registration does. With a Cursor-shaped payload (`cursor_version`), every variant writes
  `::cursor`. **The qualification:** `detectIde` overrides the flag **only when the payload carries
  `cursor_version`**. For a Claude-shaped payload the flag's *value* is used unvalidated, so `--ide cursr` writes a
  slot keyed `::cursr`. That is a value typo, not an unknown flag, and it only happens through a hand-edited
  registration (`setup.mjs` writes `--ide cursor` verbatim). It is outside T-185, and I note it rather than calling
  it a defect.
- **R185-2 (`--help`/`-h` refuse): the old behaviour is VERIFIED at `8af41dd`, in a scratch clone.** `sync --help`
  and `sync -h` exited 0 and **rewrote the fixture's README** (`**Latest: v0.0.1**` became `v1.2.3`): the fixing sync
  ran. At the candidate both exit 2 and nothing is touched. Refusing is strictly safer.
- **R185-3 (malformed values exit 2): accepted and seen.** `relocate --from` (no value), `topics --min 3`,
  `--seat=developer`, `--seat -dry-run` and `--seat` given twice all exit 2. At the base, these exited 0 or 1, and
  `--seat developer --seat developer` migrated.
- **R185-4 (the merge with importer round 3): NO CONFLICT.** In the scratch clone `C:\qa-scratch\t185-merge`, from
  detached `9473b0d`, I ran `git merge --no-commit --no-ff origin/loop/importer-fixes-r3` (**`00244d3`**, merge base
  `9bc06e3`). It printed `Auto-merging open-brain/src/cli.ts` and `Automatic merge went well`, with 0 unmerged paths
  and 0 conflict markers in `cli.ts` (+43/−6 staged against `9473b0d`, 46 files overall). On the merged tree,
  `npx tsc --noEmit -p .` exited 0, the two T-185 test files passed **54/54**, and `tests/pipelines/state-import*`
  passed **60/60**. Then `git merge --abort` exited 0, and HEAD was back at `9473b0d`. Nothing was pushed.
- **The `retirements` ISSUE** (`ENTITIES.md names dream … reflection queue`) is the same at `8af41dd` and `9473b0d`
  (`sync --check` in both scratch clones, read-only, porcelain 0 before and after). It is **pre-existing**. The other
  differences between the two runs are environmental: `ci-status` read `master 8af41dd conclusion: failure` in one
  run and `gh is not authenticated` in the other, seconds apart. The file counts differ because of the new files.

## Documented invocations and hooks

- **Every documented invocation still parses.** `doc-invocations.mjs` used `git grep` over **all** tracked files
  (docs/loops included, which is wider than the developer's search) and found 32 distinct `cli.js <sub>` /
  `open-brain <sub>` forms. Each one was parsed with the candidate's own `parseArgs` and `COMMAND_SPECS`.
  - Every real invocation parses. That covers `sync`, `sync --check`, `sync --score`, `sync [--check] [--score]`,
    `detach`, `start`, `state show [--json]`, `state migrate …`, `topics [--min=<n>] [--apply]`, and `relocate
    --from … --to … [--apply]`, which I checked by hand because the script cut it at a quote.
  - I also checked `detach --dry-run --no-fetch`, `detach --force --no-fetch`, `state migrate --seat qa
    --last-session-seat developer --keep-revision f`, `sync --score --json`, `sync --history` and `relocate
    --from=a --to=b` directly. All parse.
  - The only refusals are `sync --check-only` and `sync --help`. **Both are in `.agents/state.json`'s records of this
    very bug**, so they should refuse. There are also prose false positives such as `start exit 0`.
  - `state import` is out of scope.
  - Also covered: `.claude/commands` (only `start.md:172`, `cli.js sync --score`), `project-template/` (the same
    line), `.github/workflows/ci.yml` (no CLI call) and `setup.mjs` (hooks only).
- **The hooks are unaffected.**
  - `git diff 8af41dd 9473b0d` is empty for `cli-bootstrap.ts`, `cli-session-end.ts`, `cli-recall-trigger.ts`,
    `server.ts` and `harness/`.
  - Only `cli.ts` and `cli-spec.ts` import the new modules.
  - `hooks-probe.mjs` ran all three built hooks as registered, against a scratch project, DB and vault. The
    SessionStart, SessionEnd and PostToolUse(Bash) hooks all exit 0, and their output is byte-identical at base and
    candidate. SessionEnd reached its rating stage (`Nothing rated: no recall_log rows`) and did not skip.
  - **One correction to the dispatch's premise:** `setup.mjs` registers **only** SessionStart. Claude Code's entry
    has no arguments (`setup.mjs:151`), and Cursor's has `--ide cursor` (`:288`). SessionEnd and the recall trigger
    are registered by hand, with no arguments, as `README.md:115-117` shows. This PC's `~/.claude/settings.json` has
    no hooks at all.

## `inScratch()`: can a test spawn against the real checkout?

`qa120-inscratch.test.ts` reuses `inScratch` and `cli` verbatim from `cli-flags.test.ts`. The target is a stand-in
project, `C:\qa-scratch\t185-victim`, which is **outside** the temp dir and is never the real repository:

| Attack | Result |
|---|---|
| A1: the cwd is the stand-in | **Refused** by `inScratch` before any spawn |
| A2: the cwd is a junction inside `C:\qa-tmp` that points at the stand-in | **Refused**: `realpathSync` sees through the junction |
| A3: the cwd is inside the temp dir and the stand-in's absolute path is the positional (`cli(cwd, "sync", VICTIM)`) | **NOT refused.** Exit 0, and the stand-in's README was rewritten to `v1.2.3` by a fixing sync (D4) |

**For the 20 committed rows**, every positional is either relative (`no-such-dir` or a token) or a file inside the
scratch root. Every fixture cwd is a project root (`package.json` beside `.agents/SYSTEM/`), so a walk-up stops inside
the fixture. **No committed row can reach the real checkout on a failure.** That also holds at every mutant. The
mutants change source, not tests, so each row's cwd and positionals stay inside a fixture whose root stops the
walk-up. At the walk-up mutant, the nearest ancestor of `no-such-dir` is the fixture itself.

The residual risk needs **two** things together: a temp dir that sits *inside* a project checkout, and a fixture that
is not a root. On tcm the fixtures are under `/tmp` (`/tmp/t185-cli-lPgfKh` in run `36212578864`'s log), which is
outside the runner's `_work/`. The cwd=`root` rows are `state show`,
`relocate`, `topics` and `migrate`. Of these, `state show` is read-only, relocate and topics use the env DB, and
migrate names its file.

## Mutants

**The developer's four:** all are one line off `9473b0d` (diff read). All four runs completed as failures, with the
failing rows exactly as the handoff lists them: no-refusal 21 (tcm-1), detach-widened 2 (tcm-1), no-dir-check 5
(tcm-2), undeclared-read-silent 1 (tcm-1). **Killed.**

**Mine** (branches off `9473b0d`, each `tsc --noEmit` clean, pushed with `push-qa.mjs` and read back):

| Mutant | Branch / SHA | Local (the two T-185 files) | tcm run | Result |
|---|---|---|---|---|
| **A single-dash token is accepted** (ignored) | `qa/t185-mut-single-dash` `dad8023` | 9 failed / 54 | `36212578864`, tcm-1: failure, **9 failed** / 1079 passed / 1 skipped. The same 9 rows: sync `-check`/`-h`, start/detach/migrate `-dry-run`, state show `-json`, and 3 helper rows | **killed** |
| **A missing directory walks up** to its nearest existing ancestor | `qa/t185-mut-walkup` `2ac19e7` | 5 failed (the sync, start and detach missing-dir rows; the helper's missing-dir and file-not-a-dir rows) | `36212580448`, tcm-2: failure, **5 failed** / 1083 passed / 1 skipped. The same 5 rows | **killed** |
| relocate parses **after** `openV2Database` | `qa/t185-mut-db-before-parse` `ba19f19` | **54/54 pass**. My `qa120-t185.test.ts` kills it (the 2 relocate rows) | `36212582133`, tcm-2: **success**, 1088 passed / 1 skipped (1089) | **survives the developer's suite (D3)** |
| sync **declares `--dry-run`** (a flag documented for other commands) | `qa/t185-mut-sync-declares-dry-run` `fa77c58` | **61/61 pass** (the two files plus `repo-root.test.ts`). `sync --dry-run` then ran the fixing sync | `36212775645`, tcm-2: **success**, 1088 passed / 1 skipped (1089) | **survives (D2)** |
| (local only) detach **reads** `opts.has("--dry-rn")` | not pushed | 75/75 pass (the two files plus `detach.test.ts` and `repo-root.test.ts`) | n/a | survives, but **loud**: the throw fires before `detachToUpstream` is called, so every `detach` exits 1 with a stack trace rather than acting (N1) |

**QA test rows on the candidate:** `qa/t185-qa-tests` `a96ed1f` (candidate plus `qa120-t185.test.ts`, 9 rows). Locally,
8 pass and **1 fails: the em-dash migrate row (D1)**, as expected. On tcm, run `36212583640` (tcm-2, `a96ed1f`) was a
failure: **1 failed** (that row only) / 1096 passed / 1 skipped (1098), with Test Files 1 failed / 73 passed. **D1
reproduces on Linux too.**

## The full suite, and CI

- **The one local full suite** (the Defender-on control) ran at `9473b0d` in the scratch clone `C:\qa-scratch\t185`,
  with `TEMP`=`TMP`=`C:\Users\AARONM~1\AppData\Local\Temp` (the default, taken from `QA_DEFAULT_TEMP`). It ran from
  02:43:51Z to 02:46:26Z (2m35s). **Test Files 73 passed (73). Tests 1089 passed (1089). rc=0.** Locally there are
  0 skips, where CI's run skips 1. `FAIL`/`×`/`Unhandled`/`onTaskUpdate`: 0 lines. The scratch tree's porcelain was 0
  afterwards.
- **CI:** the runner is the self-hosted **tcm** (`runs-on: [self-hosted, linux, tcm]` for dispatches, `ci.yml:23`).
  The runner names were read from each log (tcm-1/tcm-2). **I used 5 of the 6 runs**: `36212578864`, `36212580448`,
  `36212582133`, `36212583640` and `36212775645`. Every run is a `workflow_dispatch` on a `qa/t185-*` ref.
  `test-windows` was skipped, because it is opt-in and was not requested.

- **Before committing** (the `/sync` stand-in, since `/sync` and `ob_sync` are unavailable here), I ran the
  candidate build's `sync --check` read-only on this QA tree at `9208dde`. It reported 24 passed and 2 ISSUES. The
  first is `retirements` (pre-existing, as above). The second is `build-freshness`: **this tree's own**
  `open-brain/build` was made from `5f3c898`. That is environmental and was not used by any check in this report.
  I did not rebuild it. `detect_changes` could not run, because GitNexus is not available. The commit adds only
  `docs/loops/t185-qa-report.md` and `docs/loops/qa-scripts-t185/`.

## What could not be verified

- **Windows CI.** `test-windows` is opt-in and not part of this dispatch. Windows is covered by the local full suite
  and all probes, which ran on win32.
- **The real hook registrations on Aaron's machine.** This PC's `~/.claude/settings.json` has no hooks, so the hooks
  ran as `README.md`/`setup.mjs` describe them, not as any live install has them.
- **Cursor's real payload.** The `cursor_version` key is taken from the code's own comments. I did not observe a
  live Cursor payload.
- **CA-9 on tcm (T-182).** I saw no failure outside T-185's files in any run I read, and I claim nothing further.

## Defects

| # | Severity | What | Reproduce | Suggested fix |
|---|---|---|---|---|
| **D1** | medium | `state migrate --seat <s> —dry-run <file>` migrates `<file>` for real: exit 1, and the message says `nothing was written for those`. The same happens for any Unicode dash lookalike on a command with `any` positionals. Not a regression (the base does the same), but it is a hole in T-150's rule for the one command that mutates on a typo. | `probes.mjs` row `qa: state migrate --seat developer —dry-run <f>`; `qa120-t185.test.ts` last row | In `parseArgs`, treat a token starting with U+2010–U+2015, U+2212, U+FE58, U+FE63 or U+FF0D as an unrecognised flag ("a typographic dash"). Separately, have `state migrate` check that every named file exists and parses **before writing any** of them. |
| **D2** | medium | The "every declared flag is documented" check searches the whole usage text, so a command can declare another command's flag and pass every test. With `sync` declaring `--dry-run`, `sync --dry-run` runs the fixing sync. | `qa/t185-mut-sync-declares-dry-run` | Match each declared flag against **its own command's** usage line, which the documented→declared direction already isolates. |
| **D3** | low | "Parsed before the database is opened" has no test for relocate/topics. The candidate is correct. | `qa/t185-mut-db-before-parse` survives; `qa120-t185.test.ts` rows 1–3 | Adopt the three DB-not-created rows (a per-test `KNOWLEDGE_V2_DB`, and assert the file is absent). |
| **D4** | low | `inScratch` checks the cwd only. The file's comment ("refuses to spawn anywhere else") claims more than the guard does. | `qa120-inscratch.test.ts` A3, against a stand-in | Also refuse any argument that resolves to an existing path outside `TMP`, or narrow the comment. |

**Notes, not defects:**
- **N1:** a code-side read typo survives the tests but fails loud.
- **N2:** `--ide <value>` is unvalidated (R185-1 above).
- **N3:** backfill accepts `--apply --apply`, which is harmless.
- **N4:** the em-dash refusal on the directory commands names the token as a directory, not as a flag.

## Disagreements

- **With the dispatch:** the "SessionEnd and the recall trigger run as `setup.mjs` registers them" premise. `setup.mjs`
  does not register those two. I tested them as `README.md` registers them.
- **With the handoff:** §3 describes `cli-bootstrap`'s flag as one the payload's IDE detection "overrides". That is
  true only for a payload carrying `cursor_version` (R185-1 above). The conclusion, not to refuse, still stands.
- **With the handoff:** §4 says the walk over declared flags means "a declaration typo cannot lock a flag out". That
  is true for lock-out. The reverse, a declaration that *admits* a flag it should not, is D2.

## My error entries

1. **R185-4, first attempt:** the scratch clone's `origin` was the local clone it came from, so
   `origin/loop/importer-fixes-r3` did not resolve and `git merge` exited 128. I re-pointed `origin` at GitHub,
   fetched, and then merged. No merge happened in the failed attempt.
2. **The hook probe's first two runs proved nothing.** SessionEnd printed `v2 DB not found, skipping`, then `v2 vault
   not found, skipping`, so an exit 0 there was a skip, not a run. I added a schema-initialised scratch DB and vault,
   and SessionEnd then reached its rating stage.
3. **`doc-invocations.mjs` cut invocations at a quote.** It reported `relocate --from` as refused. The real text,
   `--from "<old path>" --to "<new path>" [--apply]`, parses, which I checked by hand. Its prose-stopping heuristics
   also yield false positives (`start exit 0`). I read every non-parsing row by hand.
4. **Git Bash's `cmd //c mklink /J`** mangled the backslashes. I used PowerShell's `New-Item -ItemType Junction`
   instead.
5. **My first grep of a CI log for `Tests` lines found nothing**, because `gh run view --log` writes ANSI escapes as
   literal `^[[…m`. I re-grepped with those stripped.
6. A stray `cp` of a non-existent path inside a loop printed an error. It had no effect.

## Reproduction

The QA PC's scratch layout:

- `C:\qa-scratch\t185` is the candidate and `t185-base` is the base.
- `t185-merge` was used for R185-4, `t185-mut` for the mutants, `t185-attack` for the `inScratch` attacks, and
  `t185-victim` is the stand-in project.
- Probe outputs are in `C:\qa-scratch\t185-probes\`, and are copied into `docs/loops/qa-scripts-t185/out/`.

```
git clone <repo> C:\qa-scratch\t185 && cd C:\qa-scratch\t185 && git checkout 9473b0d && cd open-brain && npm ci && npm run build
git clone C:\qa-scratch\t185 C:\qa-scratch\t185-base && cd C:\qa-scratch\t185-base && git checkout 8af41dd && cd open-brain && npm ci && npm run build
node docs/loops/qa-scripts-t185/probes.mjs C:\qa-scratch\t185 cand      # 75 probes: 73 PASS, 1 FAIL (D1), 1 INFO
node docs/loops/qa-scripts-t185/probes.mjs C:\qa-scratch\t185-base base # 10 PASS (controls/accepted), 64 FAIL, 1 INFO
node docs/loops/qa-scripts-t185/bootstrap-probe.mjs <tree>; node docs/loops/qa-scripts-t185/hooks-probe.mjs <tree>
node docs/loops/qa-scripts-t185/doc-invocations.mjs C:\qa-scratch\t185
# R185-4: in a scratch clone at 9473b0d: git merge --no-commit --no-ff origin/loop/importer-fixes-r3; npx tsc --noEmit; git merge --abort
# Mutants: gh run list --workflow ci.yml, branches qa/t185-mut-*, qa/t185-qa-tests
```

## Open for the planner

1. **D1 and D2: fix them in a round 2 before merging, or merge T-185 and file both as a task?** My recommendation is a
   short round 2. D1 is the one remaining typo that mutates on the one command it protects, and D2 is the kind of
   test hole that lets the original bug come back through a declaration. Both are small. Nothing else in this report
   depends on the answer.
2. **D3 and D4:** adopt `qa120-t185.test.ts`'s DB rows and harden `inScratch`, in the same round or later. This is
   low priority.
3. **R185-1's qualification:** should `cli-bootstrap` validate the `--ide` **value** against the known IDEs? This is
   outside T-185, and I raise it only because the ruling's reasoning leans on `detectIde`.

QA-120: REPORT COMPLETE
