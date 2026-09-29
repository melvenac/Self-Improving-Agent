# Candidate C r3 (T-155 shadow merge gate) — QA report

## Verdict

**ACCEPT.** Product `20c2dfd21fd53cd548ce9a0c8b27d99e45b0e410` closes QA 212's sole blocking defect:
every candidate, criteria, merged, and replacement SHA is refused in the function and CLI unless it is exactly 40
lowercase hexadecimal characters, before any artifact or ledger write. An independent probe made 40 malformed-input
attempts across those boundaries; all refused and wrote nothing. The candidate and frozen base are both green on tcm,
the developer SHA mutant and one QA SHA mutant are red, and every row QA 212 scored `met` remains met.

Criteria: `23ebd866255e918bcfd3fdea09af51712bda81e1`; §8 and §9 override §1. Candidate base:
`d1e86740bd68827979cfbd5757034f849c38ad41`. Red: `3854b2fc1dde9336cfb4b265b0461f2f053580e2`.
Branch tip/handoff: `5f7c9a03dc9bf979aa28bfc27f701de0523f04e6`.

## Acceptance rows

| Row | Status | Evidence |
|---|---|---|
| CC-0 | met | The 11-file diff is limited to the gate, policy/schema, CLI, sync registration, procedure, handoffs, and tests. `schema.ts`, `declared.ts`, and `runtime.ts` are unchanged. No test was deleted and no skip/todo conditional was added. |
| CC-1 | partial | Strict merge-policy/schema and drift test exist; optional gates and fail-closed flags are present. `merge.json` still does not state that `runtime_checks` and `E_t.acceptance` are required inputs as CC-1.2 requires. |
| CC-2 | partial | The exported type has exactly three outcomes and tests exercise all three, with reasons on non-merge outcomes. CC-2.2's named fixture files remain absent. |
| CC-3 | met | Valid evidence with matching SHA, green checks, shown and attributed met rows, and optional absent gates returns `would-merge`. |
| CC-4 | met | Tests assert all five causes: unmet, in-scope not_evaluated, partial, failed check, and required gate reject. |
| CC-5 | partial | Tests assert 5.1–5.5. Code handles 5.6, but the required skipped-live-gate fixture/assertion remains absent. |
| CC-6 | met | The §9 per-candidate path and deterministic input summaries hold. Direct and CLI probes refused `bad`, 39-char, 41-char, and uppercase forms for candidate and criteria SHAs before writes; a valid SHA still wrote and read back. |
| CC-7 | met | A second prepare is refused and the test compares complete bytes before/after. |
| CC-8 | met | Decide refuses without an artifact; ledger time is forced strictly after `written_at`; prepare cannot overwrite before or after decide. |
| CC-9 | met | Merged decisions record action, reachable merge SHA, loop, candidate, and disagreement; malformed candidate and merged SHAs refuse before the ledger. |
| CC-10 | met | Decline and replacement are tested; bare or malformed replacement SHAs refuse in both CLI and function before the ledger. |
| CC-11 | met | Summary derives all counts from ledger text and prints the required zero-disagreement disclaimer. |
| CC-12 | met | Undefined writes `disagreed:null` and is excluded from evaluated. |
| CC-13 | partial | Empty lines, missing hashes, changed committed lines, and hash recomputation are implemented and the sync check runs. The check still does not enumerate verdict artifacts to detect one with no matching ledger line, as CC-13.2 requires. |
| CC-14 | met | Pending is checked first and returns `undefined`. |
| CC-15 | met | `parseDeclared` supplies separate unrunnable/out-of-scope arrays; excluded rows do not block and the arrays remain separate in the artifact. |
| CC-16 | met | In-scope not_evaluated blocks, declared ids are excluded, and absent declarations leave rows in scope. |
| CC-17 | partial | Attributed met rows count and are named in reasons. The explicitly required all-attributed fixture remains absent. |
| CC-18 | met | Shape, loop/SHA matching, criteria failure, human-seat paths, and unreadable evidence are supported; unreadable evidence writes immutable `undefined`. |
| CC-19 | met | `shadow-verdict prepare` is the only merge point; `runLoop` remains unchanged and the tracked procedure places prepare in the human merge step. |
| CC-20 | met | Help and success paths exist; unknown flags, invalid gate modes, and malformed SHA flags refuse. |
| CC-21 | cut | Cut by §8 P2 and declared out of scope; not scored. |
| CC-22 | met | Candidate tcm is green: 132 files, 1839 passed, 6 skipped. Base is green: 131 files, 1810 passed, 6 skipped. No candidate failure is new. |
| CC-29 | met | Human-seat artifacts and the ledger are under `docs/loops/shadow-merge/`; `git check-ignore` reports the default paths unignored. |
| CC-30 | met | The tracked procedure gives pre-merge prepare and post-merge decide steps; fixture tests refuse unreachable merged SHAs, and r3 refuses malformed merged SHAs before git lookup. |

### Declared rows (reported, not scored)

- Unrunnable: CC-23 live prepare/merge/decide; CC-24 production disagreement evidence; CC-25 historical recovery.
- Out of scope: CC-26 docs-only merges; CC-27 alternate harness; CC-28 Jev calibration; CC-21 backfill (cut).

## Mutants

Three mutant branches were dispatched on tcm, including two independent `qa/c-r3-mut-*` branches:

| Mutant | SHA | Run | Result |
|---|---|---:|---|
| Developer: accept any string as a SHA | `5b9eb09a055b8a5d5bfa97c2573f7eb81a38807c` | [36503874374](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36503874374) | killed: 3 failed, 1836 passed, 6 skipped |
| QA: remove prepare's criteria-SHA validation | `79472daed560b21ab487b7b71085e194b767ebc8` | [36504362637](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36504362637) | killed: 1 failed, 1838 passed, 6 skipped |
| QA: accept a present but incorrect ledger `line_hash` | `fd6c3109c278ee03cbd9ca1b281355aa2861c7f6` | [36504366574](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36504366574) | **survived**: 132 files, 1839 passed, 6 skipped |

The survivor is a coverage finding, not an observed product failure: the shipped implementation recomputes and compares
the hash, but no test isolates a non-empty incorrect hash. The existing CC-13 test combines `"abc"` with an empty line
and asserts the empty-line message, then separately asserts missing/committed-line changes.

GitNexus MCP was unavailable. A fresh CLI analysis wrapper in the frozen candidate worktree printed only its banner and
made no progress for nearly three minutes, versus this repository's recorded ~47-second analysis, so that wrapper was
stopped; its backend child subsequently completed and registered the exact `20c2dfd` index. Impact then reported
`isLowerHexSha` **HIGH** (2 direct callers, 4 affected processes: prepare, decide, CLI command, and CLI main) and
`checkShadowMergeLedger` LOW (1 direct caller, 2 affected sync processes). The changes were isolated `NOT FOR MERGE`
mutants, not product edits. Pre-commit `detect-changes` could not select the report checkout because multiple repositories
share the same index label; the report diff is two new docs files and maps to no product symbol.

## CI

Exactly six `ci.yml` workflow-dispatch runs were used, the dispatch cap. All ran on tcm; every Windows job was skipped
and no `windows=true` dispatch was made.

| Purpose | Run | Head SHA | Conclusion |
|---|---:|---|---|
| frozen base/full suite | [36503866082](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36503866082) | `d1e86740bd68827979cfbd5757034f849c38ad41` | success: 131 files, 1810 passed, 6 skipped |
| r3 red | [36503869283](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36503869283) | `3854b2fc1dde9336cfb4b265b0461f2f053580e2` | failure: 1 file / 3 tests failed; 131 files / 1836 tests passed, 6 skipped |
| candidate/full green | [36503871940](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36503871940) | `20c2dfd21fd53cd548ce9a0c8b27d99e45b0e410` | success: 132 files, 1839 passed, 6 skipped |
| developer SHA mutant | [36503874374](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36503874374) | `5b9eb09a055b8a5d5bfa97c2573f7eb81a38807c` | failure: 1 file / 3 tests failed |
| QA criteria-SHA mutant | [36504362637](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36504362637) | `79472daed560b21ab487b7b71085e194b767ebc8` | failure: 1 file / 1 test failed |
| QA ledger-hash mutant | [36504366574](https://github.com/melvenac/Self-Improving-Agent/actions/runs/36504366574) | `fd6c3109c278ee03cbd9ca1b281355aa2861c7f6` | success: 132 files, 1839 passed, 6 skipped |

Local candidate `npm run build`, `npm run typecheck`, and the 62 gate/spawn/policy tests each exited 0. The independent
direct/CLI SHA probe exited 0 with `checked: 40, failures: []`.

## Defects and coverage

1. **C-212-1 / blocker / CC-6: closed.** All four SHA input classes named by the dispatch refuse malformed values in
   both function and CLI before any write. The red run, two killed SHA mutants, candidate green run, and independent
   probe agree.
2. **C-212-2 / major / CC-13: remains partial.** The sync check walks ledger lines only; it does not enumerate verdict
   files to detect an artifact with no matching ledger line.
3. **C-213-1 / test coverage / CC-13:** the invalid-nonempty-`line_hash` QA mutant survives the full suite. Product
   behavior is correct by source inspection; the isolated assertion is absent.
4. **Previously reported criteria-test gaps remain:** CC-1.2 (policy names required evidence inputs), CC-2.2 (named
   fixture files), CC-5.6 (required live gate skipped), and CC-17 (all-attributed fixture).

Every scored row has at least some asserting evidence when CC-22's tcm run is counted. Distinctive required clauses
still lacking an automated assertion are CC-1.2, CC-2.2, CC-5.6, CC-8.1 (direct no-artifact decide assertion),
CC-11.3 (CLI reads the ledger), CC-13.1 (present but incorrect hash in isolation), CC-13.2 (unmatched verdict-file
scan), CC-15.2 (unrunnable exclusion), CC-17 (all-attributed fixture), and CC-29 (ignore check). QA 212's missing
negative CC-6 assertion is now closed.

All five QA 204 repairs remain closed: artifact path/input summaries, replacement SHA refusal, ledger integrity,
unreadable evidence, and strict flags/gate mode. No row QA 204 or QA 212 scored `met` regressed.

## Open for the planner

No open question blocks acceptance. The surviving ledger-hash mutant should become a focused assertion when CC-13.2's
artifact enumeration is repaired; it does not change this r3 verdict.

## Evidence file

`docs/loops/loop-15-slice-3-c-r3-qa-report.E_t.json` carries one acceptance entry for every scored/cut row, the exact
40-character product SHA, and candidate tcm runtime checks. Against the candidate build,
`node build/harness/cli.js validate evidence <file>` exited **0**.

Pre-commit `node build/cli.js sync --check` exited **1** with 28 passes, 3 existing issues (retirements,
registered-worktree layout, and greeting size), 2 warnings, and 2 skips. Its `shadow-merge-ledger` check passed the
absent-ledger first-use case; build freshness matched `20c2dfd`.

## Model

QA seat: GPT-5.6 Sol (`gpt-5.6-sol-medium`), record 213. Criteria author was Composer 2.5; candidate builder was
Grok 4.7.

QA-213: REPORT COMPLETE
