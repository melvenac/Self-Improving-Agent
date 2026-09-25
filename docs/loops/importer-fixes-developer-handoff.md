# Importer fixes (T-175 + T-180): developer handoff

**By:** Forge (Claude developer seat), record session 101, 2026-09-25. Worktree `~/Worktrees/sia-infra`.
**To:** Atlas (planner), and the QA seat that scores it.
**Brief:** `docs/loops/importer-fixes-brief.md`, which is on `origin/docs/session-100-qa99-dispatch` and was read there.
**Model and effort, from this session's transcript** (`06adbcf5-6bd1-4835-83c0-cd325789dd54.jsonl`): `claude-opus-5-5`, effort `medium`
on every recorded turn.

## 1. Frozen candidate

**`loop/importer-fixes` at `f6b6d44`**, cut from `origin/master` `9bc06e3`. Each push was read back with `ls-remote`.

| Commit | Task | What |
|---|---|---|
| `64901bf` | T-175 | Seeds removed. `verified[]` and `gaps[]` import empty. Report fields renamed `*_seeded` → `*_imported`. The report and CLI still print both counts (0). |
| `bdf9ddb` | T-180 | Staleness detector. The report's first section lists each input as STALE, could not tell, current or not judged. `--commit` refuses on STALE unless `--accept-stale` is passed. Unknown `state import` flags refuse. A2A-Hub fixture added. `retirements.json` historical entry added. |
| `f6b6d44` | T-180 (planner ruling) | Tests only: a could-not-tell line carries its reason, and `--commit` prints the could-not-tell line. |

This handoff is committed on top of `f6b6d44` and touches only this file. CHANGELOG: `## [0.44.3] - Unreleased`.
**There is no version bump and no tag.** The release is Aaron's (D-019).

## 2. How staleness is detected (T-180)

**The signal is the file's own words.** An input's *declared session* is the highest `Session N` (or `Sessions N–M`)
that appears in either of two places:
- its status blockquote: the `>` lines directly under its `# ` title;
- any heading.

That number is compared with the highest `SESSIONS/Session_N.md` (`findLastSession`). A lower number is **STALE**. An
equal or higher one is **current**, and the evidence names the line that declared it.

**Why not git or mtime.** `.agents/` is untracked in worth-it-window-washing, so git history isn't always there. A tree
snapshotted in one commit gives every file the same date, and a checkout or a copy resets mtime.

| Input | Judged? | Why |
|---|---|---|
| `SESSIONS/next-session.md` | yes | imported as the handoff |
| `TASKS/INBOX.md` | yes | imported as tasks |
| `TASKS/task.md` | yes | imported as the objective |
| `SYSTEM/SUMMARY.md` | not judged | not imported as state; `--commit` only cuts it |
| `SYSTEM/DECISIONS.md` | not judged | a dated log of past decisions, not a current-state claim |
| any absent input | not judged | nothing is imported from it |

**"Could not tell"** covers two cases: no marker in the status blockquote or headings, and no `Session_N.md` at all.
It is listed in the report's first section with its reason. It is never counted as current, and `--commit` prints one
line naming those inputs. **It does not block.** The planner accepted this on 2026-09-25 on these grounds: SIA's own
session-54 prose has two unmarked inputs, and a block on every unjudgeable input would make the acknowledgement
reflexive.

**`--commit` judges the inputs on disk again** after the draft validates, and before the snapshot or any write.

### What it cannot see

1. **A marker is a claim, not a measurement.** An input edited in the latest session whose status line was not bumped
   reads STALE (a false positive, and the acknowledgement is the way through). A heading that names a future session
   (`## Plan for Session 15`) makes a stale input read current (a false negative).
2. **Only the status blockquote and the headings are read.** A marker that appears only in body text gives "could not
   tell".
3. **An import run during session N, after `Session_N.md` was created**, flags a handoff written at the end of N−1 as
   STALE, even though that handoff is the one session N started from. The detector does not read the log's `Status:`
   line. A2A-Hub's Session 14 says `Completed`, so its finding is real.
4. **Session numbers are compared, nothing else.** Renumbering, a gap, or a per-worktree counter (T-164) breaks it. So
   does a log not named `Session_N.md`.
5. **`--commit` judges the inputs, not the draft.** An input fixed after `--draft` without re-drafting lets `--commit`
   pass with the old draft content. The report tells the operator to re-run `--draft`, but nothing enforces it.
6. SUMMARY and DECISIONS are never judged.

## 3. Red, then green

| Evidence | Where | Result |
|---|---|---|
| **IF-6 red first.** The new tests alone against master's importer (one file then, split since) | `loop/importer-fixes-redcheck` `e082983` = `origin/master` `9bc06e3` + tests + fixture, no source change. Pushed and read back. | **9 failed / 9**, all on assertions (`expected [V-001…] to deeply equal []`, `expected undefined to be defined`, `expected [Function] to throw`, `expected +0 to be 1`). None on imports or types. |
| Green, the three importer test files | local, `bdf9ddb`, then `f6b6d44` | 18/18 at `bdf9ddb`. 19/19 with `f6b6d44`'s addition (M4/M5 baseline, below). |
| `tests/pipelines/sync/checks.test.ts` after the `retirements.json` edit | local | 102/102 |
| `tsc --noEmit -p .` | local, each commit | exit 0 |
| CI | run `36093008046` on `bdf9ddb` | **QUEUED**, not run: the tcm runners were paused for A2A-Hub's T-003 cutover. Neither a pass nor a fail. `f6b6d44` needs its own run once they resume. |
| Full local suite | see §7 | pending |

**Live run of the built CLI** on a fresh `git archive e0bc3f8` of `~/Projects/A2A-Hub`, in this session's scratchpad
(A2A-Hub's working tree was never touched):
- `--draft` exited 0 and reported `Staleness: 2 stale (.agents/TASKS/INBOX.md, .agents/SESSIONS/next-session.md) · 0
  could not tell · 1 current`. That is both of Relay's findings: next-session at Session 13 and INBOX at Session 11.
- `--commit` exited 1: `2 input(s) predate the latest session (Session 14): … Nothing written`. There was no
  `state.json` and no `archive/`.
- `--commit --accept-stal` exited 1: `unrecognised flag(s) --accept-stal`.
- `--draft --accept-stale` exited 1: it applies only to `--commit`.
- `--commit --accept-stale` exited 0, printing `Imported STALE under --accept-stale: …`.

## 4. Mutants (IF-5)

Each mutant: its edit is asserted to have landed, `tsc --noEmit` runs, then the three importer test files. The source
is restored and its hash compared: `index.ts` `f01e5688a5fc` and `cli.ts` `b2e2410ab606`, both restored. Scripts are in
the session scratchpad (`mutants.cjs`, `mutants2.cjs`), with no shell (`execFileSync` with args arrays).

| Mutant | tsc | Tests turned red |
|---|---|---|
| **M1 seeds restored.** The real `seedVerified`/`seedGaps` code from `9bc06e3`, called again. | 0 | IF-1 ×2 (report/draft; CLI line), plus the existing `state-import.test.ts` draft test through its updated lines 142-143. 3/18. |
| **M2 detector disabled.** The verdict is always `current`. | 0 | IF-2 ×3 (report first section; `--commit` refusal; CLI refusal and acknowledgement). 3/18. |
| **M3 could not tell treated as current** | 0 | IF-4 ×2 (unmarked input; no `Session_N.md`). 2/18. |
| **M4** (ruling) `--commit`'s could-not-tell line removed | 0 | the `--commit` could-not-tell test. 1/19. |
| **M5** (ruling) a could-not-tell report line without its reason | 0 | IF-4's report-line test. 1/19. |

IF-3, the known negative, stays green under every mutant, which is correct for a negative. No mutant targets it.

## 5. Acceptance rows, as this seat reads them. The verdict is QA's.

- **IF-1** `state-import-seeds.test.ts`.
- **IF-2** `state-import-staleness.test.ts`, IF-2 block, against the vendored fixture. The live run in §3 was against the real archive.
- **IF-3** a synthetic project, all three inputs declaring Session 7 with `Session_7.md` present. No finding, and `--commit` proceeds without the acknowledgement.
- **IF-4** unmarked input; no `Session_N.md`; not-judged reasons; the reason on each line; `--commit`'s line.
- **IF-5** §4. **IF-6** §3.
- **IF-7, stated as a deviation, row by row.**
  - `state-import.test.ts` changed at **exactly lines 142-143**, in `64901bf`. Those lines asserted the seed ids
    V-001..V-005 and G-001..G-006, which are the thing T-175 removes. They now assert `[]`. The planner accepted this as
    the intended change. Nothing else in that file changed, and `bdf9ddb`/`f6b6d44` do not touch it.
  - V-009, draft writes only its two files: the existing test's `[DRAFT_REL, REPORT_REL]` new-files assertion is
    unchanged and green.
  - V-009, pre-commit snapshot: the existing byte-complete snapshot test is unchanged and green. The new refusal comes
    **before** the snapshot, and the IF-2 test asserts no `archive/` after a refused commit.
- **IF-8** `/sync --check` at `bdf9ddb`: `26 passed, 2 warnings, 1 issue, 1 skipped`.
  - The one issue is the known ENTITIES.md retirements finding.
  - The warnings are `vault-index-parity` (one Checkpoints note, the G-004 class) and `spec-provenance` (no `specs/`
    in this tree). Neither is one of the two known issues the brief names. Both were present before any change here.
  - The skip is `gitnexus-index`: no index in this tree, which is not a pass.
  - Before `.agents/retirements.json` gained `open-brain/tests/fixtures-import-a2a-hub/` under `historical`, the
    retirements check also named six fixture files for "sia agent mailbox". The planner accepted the entry. It is the
    same class as the other three fixture directories.

## 6. The vendored fixture

`open-brain/tests/fixtures-import-a2a-hub/` holds **only** the importer's inputs from A2A-Hub `e0bc3f8` (`git archive`),
line endings normalised to LF with the content unchanged (checked with `diff` against the archive):

- `.agents/SESSIONS/next-session.md`
- `.agents/SESSIONS/Session_13.md`
- `.agents/SESSIONS/Session_14.md`
- `.agents/SYSTEM/DECISIONS.md`
- `.agents/SYSTEM/SUMMARY.md`
- `.agents/TASKS/INBOX.md`
- `.agents/TASKS/task.md`
- `package.json`, cut to `name` and `version`
- `README.md`, which states the provenance

**No `.env`, key, token or credential file.** A search for dotfiles, `*env*`, `*key*` and `*.pem` found none. A
secret-value pattern (provider key prefixes, `-----BEGIN`, `Bearer …`, `key/token/secret/password = <16+ chars>`) was
first seen to fire on a planted positive (2 hits), then run on the fixture unpiped: grep exit 1, 0 hits. The 24
keyword hits are prose about keys (`apiKeyHash`, `X-Agent-Key`, the *name* `ANTHROPIC_API_KEY`), with no values.
A2A-Hub is a public repository.

## 7. Not verified

- **CI.** Run `36093008046` (`bdf9ddb`) is queued behind the runner pause, and `f6b6d44` has no run. Its runner label
  is unconfirmed, because no job has been picked up.
- **Full local suite.** Atlas approved it on idle peers only. At the first check `a2a-rivet-1b` was busy and
  `sia-planner-ac` was in a shell. The status is recorded in §8 when it has run.
- **worth-it-window-washing** (untracked `.agents/`) was not run. The signal reads content only, so tracking should
  not matter, but that has not been observed.
- **Linux.** Local runs only, all on win32.
- **GitNexus.** `impact` and `detect_changes` ran against the main tree's index (`f673d5e`, behind master), so some
  symbols show as "touched" only because lines shifted (`runDraft`, `takeSnapshot`). Every changed symbol is in
  `state-import/index.ts` and `cli.ts`. Impact was LOW on `buildImportDraft`, `runCommit` and `renderImportReport`.
- **A2A-Hub's import is poor for reasons outside this brief**, seen on the live run: 6 tasks, all done; 106 unparsed
  INBOX lines; `objective NOT found` (its task.md has no `## Current Objective`). INBOX and task formats that differ
  from SIA's parse badly. That matters for adoption and is not T-175 or T-180.

## 8. For the release step

**The importer other projects run is the MAIN checkout's build** (`~/Projects/Self-Improving-Agent`, at `f673d5e`,
which is behind master). Both fixes reach an adoption only once that tree is updated to a master containing them and
rebuilt (T-172). A merge alone changes nothing for anyone running `open-brain state import`.

## 9. Near-miss, by family (not an error entry: caught before it reached anyone)

I scanned the fixture for secrets with `grep … | cut …; echo "rc_grep=$?"` and got `cut`'s 0. That is the
pipe-masks-exit-code family, stored as entry 299. I caught it by re-reading, before reporting, and re-ran unpiped.
**The recall trigger did not fire on that command.** It did fire on the next one, which had no masking pipe, and on
several `> file; echo "rc=$?"` commands that were correct. That fits G-039's stated limit: the element table does not
name `cut` as a trimmer, so the act it exists for went unasked while correct acts were asked.
