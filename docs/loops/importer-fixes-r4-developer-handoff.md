# Importer fixes, round 4: developer handoff

**By:** Forge (Claude developer seat), **record session 116** (the greeting's local number was 2; T-164), 2026-09-26 UTC
(local date 2026-09-25, so the CLI's `today` was 2026-09-25 throughout). Worktree `~/Worktrees/sia-builder`.
**To:** Atlas (planner), and the QA seat that scores it.
**Brief:** `docs/loops/importer-fixes-round-4-brief.md`, read on `origin/docs/session-100-qa99-dispatch` (`0ef74cc`; the
brief's own last commit there is `7a9468d`). QA 111's report was read on `origin/qa/importer-fixes-r3-report` `5abe44f`:
the header, Verdict, both row tables, What could not be verified, Defects, Disagreements, Open for the planner and
Reproduction. Probes, Mutants and Full suite were not read as prose; their scripts were run instead (§5). Round 3's
brief §2 was read on the same docs branch.
**Model and effort, read from this session's transcript** (`6c2dffdd-d4db-4b6c-8906-7e3b12016c26.jsonl`, 286 assistant
records when counted at 03:1xZ): `claude-opus-5-5` on 286 of 286, and `effort="high"` / `perTurnEffort="high"` on 286 of
286. **This disagrees with the dispatch,** which said "Effort: medium". The transcript is the source D-047 names, so the
number here is *high*; the disagreement is Aaron's or the planner's to explain, not mine to resolve.
**Process record:** `/start` ran first and its 609-line result was read in full. `git switch -c … origin/…` set the new
branch to track `origin/loop/importer-fixes-r3`; the upstream was removed before any push, and every push named its
refspec and was read back with `ls-remote`.

## 0. What to read first

- **I broke one of QA 111's scripts and caught it by running it.** O10's sentence first went between "then delete
  <marker>." and "Nothing written" (`4b88f5d`). `probes-r3.mjs` follows the way out by matching exactly that span, so it
  printed a NOTE and **silently skipped two IF-19 checks** (19 checks instead of 21; the run's SUMMARY still read
  "15 passed, 4 failed", with no FAIL for the missing two). Evidence: `evidence/qa111-probes-r3-4b88f5d.out`, line 63.
  Fixed at `fa91ca3` by moving the sentence after "Nothing written", guarded at `4c07246` by a test of the parsed shape,
  and a mutant (O10-order) restores my first placement and is red. At `78a7d13` all 21 checks run.
- **QA 106's N5 cannot see a test in `state-import-r4.test.ts`.** `mutants-r2.mjs:19` runs a fixed list of five files.
  With the R4-2 test only in the new file, N5 run byte-exact still survived 0/44. `78a7d13` adds the same refusal test
  to `state-import-r2.test.ts`, beside the test that killed N5 before round 3; N5 byte-exact is now red 1/45.
- **R4-1 rewrote the line QA 106's M7, M8 and M9 anchor on**, so they are VOID against this candidate. Their
  successors, the same edits on the new line, are M7-r4, M8-r4 and M9-r4 in my script, and all three are red (§4).
- **A current project is blocked too** when a judged input cannot be read. At `063662b` a UTF-16-no-BOM input that
  declares the latest session committed; now it refuses. That is the ruling ("an input the importer cannot read
  BLOCKS"), and it shows in QA 106's `probes-r2` row `utf16le-nobom` (`current: … bare --commit exit 1`).

## 1. Frozen candidate

**`78a7d13`** on `loop/importer-fixes-r4`, branched from `origin/loop/importer-fixes-r3` `00244d3` (round 3's candidate
`063662b` plus its handoff). This handoff, the mutant script and its evidence are committed on top and touch only
`docs/loops/`.

| Commit | Item | `git diff --stat` of the commit itself |
|---|---|---|
| `8da95f9` | IF-21 to IF-24 tests (R4-1, R4-2, R4-3, O8, O10) | `state-import-r4.test.ts` +257 |
| `4b88f5d` | R4-1 (D8), O8, O10 | `cli.ts` 5 (+4 −1); `state-import/index.ts` 68 (+55 −13) |
| `4c07246` | guard: the half-restored way out parses as QA 111's probe reads it | `state-import-r4.test.ts` +8 |
| `fa91ca3` | O10's sentence moved after "Nothing written" | `state-import/index.ts` 2 (+1 −1) |
| `78a7d13` | R4-2's test also in `state-import-r2.test.ts`, for N5 | `state-import-r2.test.ts` +12 |

**The redcheck:** `loop/importer-fixes-r4-redcheck` = **`94704f4`**, three test-only commits on `063662b` (`61f483d`,
`930588b`, `94704f4`; `git diff --stat 063662b 94704f4`: 2 files, +277). Its test files are identical to `78a7d13`'s
(`git diff 94704f4 78a7d13 -- open-brain/tests` is empty).

## 2. R4-1: every could-not-tell reason, and which block (IF-22)

The verdict stays "could not tell" for all four (R3-2). What R4-1 changes is the consequence, and it is one table in
the code, `COULD_NOT_TELL` (`index.ts:457-462`), read by one function, `blocksCommit` (`:468`). Each verdict carries
its reason in a new field, `could_not_tell`, set where the verdict is made:

| Reason | Set at | Blocks bare `--commit`? | Why |
|---|---|---|---|
| `unreadable`: the input contains NUL bytes | `:535` (the only source of `undecodable` is `:143`) | **yes**, until `--accept-stale` | its words cannot be read, so it might be stale and nothing else can say |
| `no_session_log`: no `SESSIONS/Session_N.md` | `:539` | no | read, but there is nothing to compare with |
| `no_declared_session`: names no `Session N` | `:544` | no | read, and says nothing about its session |
| `ahead_of_latest`: declares a session past the latest log | `:551` | no | read, and both numbers are named (IF-10's +13 and +1) |

These are all four places `detectStaleness` pushes `could_not_tell`. SUMMARY.md and DECISIONS.md are "not judged" and
never get a verdict; SUMMARY.md's NUL case has its own refusal (R4-2).

**Where the consequence shows:** `runCommit` refuses at `:866` when any input is STALE or blocks, naming each unreadable
file, its NUL count and first offset, and `--accept-stale` (the stale-only message is byte-identical to round 3's). The
reason string is built at `:153` (`nulReason`), with the offset counted in the file, BOM included. The report's first
section says `--commit` refuses while an input cannot be read (`:703`); the CLI's `--draft` summary says so
(`cli.ts:481-482`), and `--commit --accept-stale` prints `Imported UNREADABLE under --accept-stale: …` (`cli.ts:495`),
from a new `CommitResult.accepted_unreadable`.

**O8** (one line): `:875` now reads "`.agents/SYSTEM/SUMMARY.md contains N NUL byte(s)…`", not "is contains".
**O10** (one sentence): the half-restored refusal (`:786`) ends "Nothing written. Keep a copy of the snapshot until the
re-run completes: that re-run needs --force-snapshot, which deletes it on success".
**O7 was not fixed.** It is not one line: which snapshot holds every original when there are two markers is a question
(QA says the newest; the first failed commit's snapshot is the older one), and I did not answer it by editing a message.

## 3. Rows

CI is tcm throughout (`ci.yml`, `workflow_dispatch`, `hosted=false`). Every run below was read per test, and each
checkout's `git log -1` matched the SHA named. onTaskUpdate / Unhandled: 0 in every run.

| Row | Red | Green | Mutants (all red, §4) |
|---|---|---|---|
| **IF-21** | redcheck `94704f4`, run `36212605596` (tcm-2): the six shapes each fail on `expected +0 to be 1` — D8 itself, the bare `--commit` exiting 0 | `78a7d13`, run `36212603856` (tcm-1): 1108 passed, 1 skipped (1109) | R41-block, R41-reason, R41-refusal, M7-r4, M8-r4, M9-r4 |
| **IF-22** | same run: `unreadable (NUL bytes): blocks` (`expected [Function] to throw`) and the reason-key test. The three non-blocking reasons and IF-10's +13/+1 are **green at `063662b` by design** (guards) | same | R41-scope (reddens all five guards, plus PROBE-2 and two older commit tests) |
| **IF-23** | green at `063662b` by design (the candidate already refused) | same | R42-Q20: red on both copies of the test and on O8. **QA 106's N5 byte-exact: red 1/45.** **QA 111's Q20 byte-exact: red 3/83** |
| **IF-24** | green at `063662b` by design | same | **QA 111's Q1 and Q17 byte-exact: red 1/83 each.** Mine, the same edits: Q1 red 1, Q17 red 2 on tcm (the second is an r3 test, on Linux only) |
| **IF-25** | — | QA 106's and QA 111's scripts, §5 | M7-r4, M8-r4, M9-r4 replace the three VOID |

**The redcheck's 12 reds, all `AssertionError`** (`36212605596`): the six IF-21 shapes, the in-process refusal, the
draft's report and CLI line, `unreadable (NUL bytes): blocks`, the reason-key test, O8 and O10. The other importer
files are all green there. Before the last two test commits, the same 12 were red at `61f483d` (`36209480006`) and at
`930588b` (`36211131353`).

**An earlier redcheck read red for the wrong reason, and was rewritten before it counted.** In my first ordering the
IF-21 rows failed on the new evidence wording before they reached the D8 assertion, and the three IF-22 guards failed
on the new field. Both were reordered (D8 asserted first; the reason key in a test of its own) before anything was
pushed.

## 4. Mutants

The script is `docs/loops/dev-scripts-importer-r4/mutants-r4.cjs` (round 3's method: each edit must match its stated
count and land; `tsc --noEmit -p .` must exit 0; the importer test files run through vitest's JSON reporter; the source
is restored and hashed after each). `--apply <id>` writes one mutant, which is how each tcm branch was made. Local
results at `78a7d13` are in `evidence/local-78a7d13/mutants-r4.out`, with each mutant's diff beside it. `tsc` exited 0
on all 13. The source was restored after each (its git blob equals HEAD's, `4a76862`).

| Mutant | Protection | Local (of 83) | tcm branch, head | tcm run: failed tests |
|---|---|---|---|---|
| R41-block | an unreadable input blocks | 9 | `-mut-r41-block` `7eff9d9` | `36212620419`: 9 |
| R41-scope | only `unreadable` blocks | 9 | `-mut-r41-scope` `7046cf0` | `36212625387`: 9 (6 are the mutant's own refusal thrown into tests that expect a commit) |
| R41-reason | the NUL verdict carries its reason | 10 | `-mut-r41-reason` `34f0eca` | `36212621898`: 10 |
| R41-refusal | `runCommit` counts unreadable inputs | 8 | `-mut-r41-refusal` `e485b99` | `36212623619`: 8 |
| R42-Q20 | `:875` refuses a NUL SUMMARY.md (= Q20 = N5) | 3 | `-mut-r42-q20` `a4d170b` | `36212626961`: 3 |
| Q1 | a marker from any day refuses | 1 | `-mut-q1` `1fd749b` | `36212617586`: 1 |
| Q17 | `--draft` reads the marker before `state.json` | 1 | `-mut-q17` `60f72ae` | `36212619095`: 2 (+ an r3 test; Linux keeps `state.json`, as round 3 found) |
| O8 | "contains", not "is contains" | 1 | `-mut-o8` `caf483d` | `36212615939`: 1 |
| O10 | the keep-a-copy sentence | 1 | `-mut-o10` `ad85cad` | `36212612721`: 1 |
| O10-order | the sentence after "Nothing written" | 1 | `-mut-o10-order` `4e79e89` | `36212614288`: 1 |
| M7-r4 | QA 106's M7 on R4-1's line (refusal before the snapshot) | 13 | `-mut-m7-r4` `68ead49` | `36212607378`: 13 |
| M8-r4 | QA 106's M8 on R4-1's line (re-judge and refuse) | 14 | `-mut-m8-r4` `13ad7e4` | `36212608997`: 14 |
| M9-r4 | QA 106's M9 on R4-1's line (`--accept-stale` proceeds) | 14 | `-mut-m9-r4` `3712c7d` | `36212610870`: 14 (5 are `Error`: the mutant refuses `--accept-stale`) |

Branch names are `loop/importer-fixes-r4-mut-<id>`. Each head is one commit on `78a7d13`'s tree and one file off it
(`git diff --stat 78a7d13 <head>`: 1 file). Ten branches reached that head by fast-forward from their first pushes on
`4b88f5d` and `fa91ca3`; the first-round runs are in §8. Per-test lists: `evidence/ci-78a7d13.txt`.

**One local red was a flake, not the mutant.** R41-reason's first local run at `4b88f5d` also reddened
`state-import-atomic` "failing while writing state.json…" on `EPERM … rename … state.import-report.md`. Run alone it
was 10, not 11, with the atomic test green (`evidence/local-4b88f5d-mutants-r4.out`,
`evidence/local-4b88f5d-R41-reason-rerun.out`). This is round 3's §4 Windows rename EPERM, on a box with other work
running. tcm never showed it.

## 5. QA 106's and QA 111's scripts, byte-exact (IF-25)

Extracted with `git cat-file` and checked with `git hash-object`: `probes-r2.mjs` `bf970cc`,
`probe-existing-snapshot.mjs` `e015912`, `mutants-r2.mjs` `70e129d`, `probes-r3.mjs` `b3ecab0`, `mutants-r3-qa.mjs`
`50cabf3`. Run on this box against this worktree built at `78a7d13` (`build-info.json` commit `78a7d13`).

| Script | Result at `78a7d13` | QA 111's at `063662b` | Rows R4-1 changes |
|---|---|---|---|
| `probes-r2.mjs` | **24 passed, 1 failed** | 24 / 1 | `IF-9 utf16le-nobom` (see below) |
| `probe-existing-snapshot.mjs` | `STILL EXISTS` twice | the same | — |
| `probes-r3.mjs` | **17 passed, 4 failed**; all 21 checks run | 17 / 4 | the four R3-2 NUL rows (see below) |
| `mutants-r3-qa.mjs` | Q1 red 1, Q17 red 1, Q20 red 3; Q3, Q8, Q10, Q13, Q16, Q18 red; **Q6, Q15, Q19 survive** | Q1, Q17, Q6, Q15, Q19 survive; Q20 not counted (tsc) | none |
| `mutants-r2.mjs` | **N5 red 1/45**; every other non-VOID id red; E1 0 (equivalent) | N5 0/44 | **M7, M8, M9 VOID** (R4-1 rewrote their anchor; successors in §4). N9, N13, N13b, N14, R3 VOID as at QA 111 (round 3) |

**Each FAIL, and the ruling that changed its expectation.** All five check "all STALE **and** bare `--commit`
refuses". R3-2 kept "could not tell" as the verdict for the NUL case and R4-1 keeps it (R4-1: "it stays the verdict.
What changes is the verdict's CONSEQUENCE"), so the first half cannot pass. The second half now holds in every one:
- `probes-r2` `IF-9 utf16le-nobom`: stale project, bare `--commit` exit 1, writes nothing, `--accept-stale` exit 0; the
  current project also exits 1 (§0). At `063662b` both committed.
- `probes-r3` `utf8 then PS 5.1 >>`, `utf8-bom then PS 5.1 >>`, `cp1252 then PS 5.1 >>`: 0 stale / 3 could not tell,
  bare `--commit` exit 1, no `state.json`, for the stale and the current project alike.
- `probes-r3` `UTF-8 with one stray NUL at the end`: bare `--commit` exit 1 (`063662b`: exit 0).

**Q6, Q15 and Q19 survive, as they did at `063662b`.** The brief did not require Q6 or Q15, and I did not add them.
QA 111's D10 prose names four survivors; its own `evidence/qa-mutants/mutants-r3-qa.out` shows five, Q19 among them.
So Q19 is not a round-4 loss, but the report's count is one short.

## 6. Existing tests whose assertions changed

**None.** From `063662b` to `78a7d13`, `git diff --numstat -- open-brain/tests` is `12 0` for `state-import-r2.test.ts`
and `265 0` for `state-import-r4.test.ts`: insertions only. The r2 addition is a new test (R4-2, §0), not a change to
one.

## 7. Not verified

- **The full suite locally:** not run, by the brief (the box is never quiet). tcm ran it on every SHA above. The importer
  files alone ran locally at `78a7d13`: 83 of 83 (`evidence/importer-files-78a7d13.json`).
- **GitNexus `impact` and `detect_changes`:** not answerable. This worktree has no index; the main checkout's index does
  not contain `detectStaleness` or `withCheck` ("Target not found") and finds no callers for `runCommit`, which the CLI
  reaches through a dynamic `import()`. By text search, `runDraft`, `runCommit` and `blocksCommit` are reached only
  from `cli.ts:422` and the importer tests.
- **`/sync`** ran before the first commits and again at `78a7d13` before this one: both 25 passed, 1 issue, 3
  warnings, 1 skipped. The issue is the known ENTITIES.md retirements finding (QA 111's IF-8); the warnings are
  `vault-index-parity`, `spec-provenance` and `ci-status` (master `8af41dd`, then `95fb704`, concluded failure; not
  this branch). `gitnexus-index` skipped: no index in this tree. `build-freshness` passed at `78a7d13`.
- **UTF-16BE with no BOM** is tested as bytes (IF-21), not as something a real Windows tool wrote.
- **O6, O9, O5:** out of round 4 by the brief. O6 and the driver change for O5 are for tasks; O9 is noted for T-181.
- **A real adopting project** written with PS 5.1's `>>` was not tried; the known positive is QA 111's evidence bytes,
  embedded in the test verbatim (their sizes and first-NUL offsets are asserted against the evidence file).

## 8. Errors and near-misses (mine)

- **E1 (escaped to a pushed candidate, caught by me before hand-back):** the O10 placement that made QA 111's probe skip
  two IF-19 checks (§0). It was pushed at `4b88f5d`, and every instrument I had was green on it: the candidate on tcm
  (`36209483627`), my nine mutants all red (`36209910191`…`36209923910`), because no test read the refusal's shape.
  Found only by running QA's script and reading its NOTE lines, not its SUMMARY line.
- **E2 (escaped to a pushed candidate, caught by me):** R4-2's test lived only where QA 106's N5 cannot run it, so the
  brief's "turn N5 red" was not met at `4b88f5d` or `fa91ca3`. Found by running `mutants-r2.mjs` byte-exact.
- **Near-miss:** my first redcheck ordering was red for the wrong reason on nine rows (§3); caught before any push.
- **Near-miss:** my first in-process test used the UTF-16LE shape while asserting one NUL byte; caught before the first
  run.
- **Superseded runs,** for the record: `4b88f5d` candidate `36209483627` (success, 1106 + 1 skipped), redcheck `61f483d`
  `36209480006` (12 AssertionError); `fa91ca3` candidate `36211129582` (success, 1107 + 1 skipped), redcheck `930588b`
  `36211131353` (12 AssertionError), and ten mutant runs `36211133340`…`36211149965`, all red.
- **Cleanup:** my first `npm ci && npm run build` redirected its logs to `~/Worktrees/npmci.log` and `build.log`, outside
  the repo. Both were read and deleted.

## 9. Branches pushed (all read back with `ls-remote`)

`loop/importer-fixes-r4` (`78a7d13`, then this handoff on top), `loop/importer-fixes-r4-redcheck` (`94704f4`), and the
13 `loop/importer-fixes-r4-mut-*` branches in §4. Nothing else. No `/end` (T-163).
