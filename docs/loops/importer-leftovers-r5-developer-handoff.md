# Importer leftovers round 5: developer handoff and RESUME note (Forge, record 147)

**By:** Forge (developer), record session 147, 2026-09-26/27, in `~/Worktrees/sia-infra`. Claude session
`b0b2d80e-fa59-4b42-bea9-e72c90741b54`. **To:** Atlas (planner), and to a Cursor seat that continues cold.
**Stopped at Atlas's word** (A2A, record 146: Claude usage at 90%, developer work moves to Cursor).

**Model and effort, from this session's transcript** (`~/.claude/projects/C--Users-melve-Worktrees-sia-infra/
b0b2d80e-….jsonl`): `"model":"claude-opus-5-5"` and `"effort":"medium"`, **124 of 124** each, counted before this
commit.

**Guard:** the session began with `/clear`. The only T-171 content in context was the git-status snapshot.

**Continuation (same record, 147):** a Cursor seat in this worktree. This checkout's local number is **12** (T-164); conversation `cceaef19-9f2d-46ec-9ee8-13f18ea9c13b`. Model: Grok 4.7. This continuation has no Claude effort field. The code was already `e2f202b`. This pass is tcm CI, the probes, and `/sync --check`.

**Brief:** `docs/loops/importer-leftovers-rulings-qa138.md` on `origin/docs/session-100-qa99-dispatch` @ `1eb882c`.

## State: rulings done. tcm, probes, and `/sync --check` are in this note

| Commit | What |
|---|---|
| `f5754ed` | tests only, red first (the `src/` is d500730's) |
| `e2f202b` | **the candidate**: the fix |
| `65cdf9c` | the resume note, before tcm |
| this commit | the run ids, the probe outputs, this update |

Branched from `origin/loop/importer-leftovers-r2` @ `cba0e14` (the handoff commit on `d500730`; `src/` identical).

| Ruling | Done | Red at d500730's src | Green |
|---|---|---|---|
| R5-1 heading rule `/^#{1,6}( \|$)/`; wording by decode path | yes | yes | yes |
| R5-2 odd-length FE FF filed unreadable, never thrown | yes | yes (RangeError) | yes |
| R5-3 EBUSY: "…: another program holds this file open; close it and re-run" | yes | yes | yes |
| R5-4 explicit 30 s timeouts | yes | n/a | yes |
| O-e "every snapshot" / "today's" (one line) | yes | yes | yes |
| D3 | recorded, not fixed, as ruled | | |

**Local runs (this PC, Windows, not tcm), from the Claude half:** `tests/pipelines/state-import*` + `tree-currency`: **red 34 of 161** with the
committed tests on d500730's `src/` (`evidence/red-f5754ed-src-d500730.vitest.json`; every red row is a ruled change);
**green 161 of 161** on the fix (`evidence/green.vitest.json`, working tree equal to `e2f202b`). `npx tsc --noEmit -p .`
exit 0 on `e2f202b`.

## tcm CI (2 runs; `test-windows` skipped on both; `windows` left at its default)

Dispatches were `gh workflow run CI --ref <branch>` with no `windows` input. Each run lists a `test-windows` job and that job's conclusion is **skipped**. Both `test` jobs ran on machine `tcm`. Read per test from the logs (`evidence/ci-36286942468-red.txt`, `evidence/ci-36286944274-green.txt`). `onTaskUpdate` / `Unhandled`: 0 lines in each. The Typecheck step (`npx tsc --noEmit`) ran before Test on both; the red run reached Test, and the green run's job succeeded.

| Run | Branch @ SHA | Runner | Result |
|---|---|---|---|
| **`36286942468`** | `loop/importer-leftovers-r5-red` @ **`c3b89d2`** | `tcm-2` | **failure, as intended.** `c3b89d2` is `d500730` plus QA 138's `state-import-qa138.test.ts` and nothing else. Test Files **1 failed \| 88 passed (89)**. Tests **3 failed \| 1340 passed \| 2 skipped (1345)**. |
| **`36286944274`** | `loop/importer-leftovers-r5-green` @ **`e2f202b`** | `tcm-1` | **success.** Test Files **91 passed (91)**. Tests **1368 passed \| 2 skipped (1370)**. The 25 tests and 2 files above the red run are `state-import-r5` (22) and `state-import-ebusy` (3). |

The 2 skips on both runs are the ones the parents name: `record-erasure`'s real-history row and `paths.test.ts`'s.

**Red, the 3 failures, all in `state-import-qa138.test.ts` (10 tests \| 3 failed).** The other 7 in that file passed (the odd-length fixture, Q4's four rows, Q5, Q6):

| Row | Assertion |
|---|---|
| D1, judged INBOX.md filed unreadable, not thrown | `RangeError [ERR_INVALID_BUFFER_SIZE]` from `decodeText` (`index.ts:133`); Buffer size must be a multiple of 16-bits |
| D1, a not-judged DECISIONS.md does not stop the draft | the same `RangeError`; `expected [Function] to not throw` |
| D2, a valid UTF-8 `##` next-session.md is not blamed on its encoding | evidence starts "has no readable `# ` title (its encod…" and matched `/encoding is not one the importer reads/` |

Every other file is ✓, including `state-import-leftovers` (22), `state-import-r4` (22), `state-import-qa122` (4), and `tree-currency` (13).

**Green, the candidate's own files:** `state-import-qa138` 10 ✓, `state-import-r5` 22 ✓, `state-import-ebusy` 3 ✓, `state-import-leftovers` 22 ✓, `tree-currency` 13 ✓. No × line in the log.

## Probes on `e2f202b`

QA 111's `probes-r3.mjs` (`b3ecab0`) and QA 122's `probes-r4.mjs` (`d475c7b`), extracted with `git cat-file -p` and checked with `git hash-object`: both matched. A detached worktree at `e2f202b`, `node_modules` junctioned to this tree's, `npm run build` stamped `e2f202b` at `2026-09-27T01:55:59.774Z`. The noNone diff was applied with `patch` and the re-derived `diff` is byte-identical to `dev-scripts-importer-leftovers/evidence/probes-r4-noNone.diff` (84 bytes). One at a time, 01:56:35Z–01:59:28Z, then `probes-r4` again at 02:03:25Z–02:04:10Z so its stderr is in the file.

| Run | Result | Output |
|---|---|---|
| probes-r3 | **17 passed, 4 failed; exit 1** | `evidence/probes-r3-e2f202b.out` |
| probes-r4, byte-exact | **the same crash** at `probes-r4.mjs:45` `tree()`: `EBUSY` open `held-held-None-Open\.agents\TASKS\INBOX.md`; exit 1 | `evidence/probes-r4-e2f202b.out` |
| probes-r4, the one-line hold removed | **16 passed, 0 failed; exit 0** | `evidence/probes-r4-noNone-e2f202b.out` |

The four FAIL rows are the same four as at `d500730`: the three `R3-2 class` `>>` rows (could not tell, bare `--commit` refuses) and `UTF-8 with one stray NUL` (`0 / 3 / 0`, exit 1). **IF-21 is 12 of 12** on both r4 runs (`could_not_tell/unreadable`, bare `--commit` exit 1). **IF-22 is 4 of 4** on the noNone run; the byte-exact run dies in the share=`None` hold before it, as at `d500730`. `**STALE**` counts match the `d500730` outputs (r3: 9, r4: 3).

Compared to `dev-scripts-importer-leftovers-r2/evidence/probes-*-d500730.out` with scratch paths and content hashes masked, the remaining text changes are the ruled wording: "no readable `# ` title" becomes "no heading line" (and the draft sentence names an odd-length UTF-16BE file), and the two-marker refusal says **every snapshot** / **today's**. Some sliced lines also show more of the same sentence, because this scratch path is shorter than the Claude half's and the probe cuts on length. `another program holds this file open` does not appear in these outputs; the probe's EBUSY lines are still Node's message, cut before that clause. R5-3's sentence is the `state-import-ebusy` rows on the green run.

## `/sync --check` at `65cdf9c` (this checkout, before this commit)

**22 passed, 4 issues, 4 warnings, 1 skipped.** The issues:

- `retirements`: ENTITIES.md still names `dream` and `reflection queue` (the one both parents name).
- `build-freshness`: this checkout's build is stamped `b371176`, HEAD was `65cdf9c`. The probe worktree was stamped `e2f202b`; this checkout was not rebuilt.
- `mirror-parity`: live↔template `end.md` (`.claude` and `.cursor`) and `.cursor/sync.md`.
- `greeting-size`: 46770 characters, over the 40000 limit (state render 24965, role files 21198, tree and seat 605).

`state-schema` passed (schema v2, rev 131). `merge-markers`: 0 in 769 tracked files. `gitnexus-index` skipped: no `.gitnexus/` in this tree. Warning `ci-status`: master `36a33bc` conclusion failure. Warning `command-parity`: user-scope `end.md`.

**Mutants:** `dev-scripts-importer-leftovers-r5/mutants-r5.cjs`, **11 of 11 killed** (`evidence/mutants/`): the three
the brief names (old `# `-only rule R5M1; throwing BE decode R5M2; old encoding wording R5M3), plus UTF-16 and 1252
wording, 7 hashes, bare `#`, EBUSY raw, O-e singular, and the leftovers' M4/M16 ported. **The leftovers' own 16 on
this tree:** 14 killed, M4 and M16 REFUSED because their find text is the line R5-1 replaced; ported as R5M10/R5M11,
both killed (`evidence/mutants-leftovers/`).

The resume note's three items are the tcm, probe, and `/sync --check` sections above. Two dispatches, under the cap of six.

## What the brief does not say

- **Changed wording breaks old assertions, by design.** Four leftovers rows and QA 138's Q4 row matched "has no
  readable `# ` title"; they now match "has no heading line". QA's file is committed with that one regex changed.
- **`declaredSession` reads the status blockquote only under a `# ` title** (unchanged). So a `##`-only INBOX.md
  with `> Session 6` is judged `no_declared_session` (does not block); it is `stale` only if a heading names the
  session. QA's D2 shape names it in the heading, so it is judged. Not ruled; left as is.
- **Still blocked, as the ruling's literal words say:** `#<TAB>Title`, an indented `  # Title`, setext, and a leading
  U+FEFF, now worded "has no heading line" with no encoding claim. UTF-7 is valid UTF-8 bytes, so it too gets no
  encoding claim (still blocked).
- **R5-4 widened:** tree-currency's BEHIND row (6.7 s) and two other rows timed out here, not only DIVERGED, so the
  whole `describe` block has the timeout. **17 more CLI-spawning rows** in `state-import-r2/r4/seeds/staleness`
  have no explicit timeout (some ran 4–7 s and passed); not ruled, not touched.
- **R5-2 on the session log:** it no longer throws; its date and uuid fall back as a NUL session log's do, and
  nothing reports it unreadable. There is no slot for that in the report.
- **R5-3 is tested by mocking `node:fs`** (`state-import-ebusy.test.ts`): a real hold is not reproducible on tcm, and
  on Windows it depends on `SeBackupPrivilege` (O-a).
- **GitNexus has no index of this checkout** (only the main tree, `sia-forge`, `sia-qa`). Impact was found by grep:
  `state-import/index.ts` and its tests only.

Scratch only. SIA's live `.agents/state.json` was not written. No `/end`. Pushed `loop/importer-leftovers-r5` and the two pointer branches `loop/importer-leftovers-r5-red` (`c3b89d2`) and `loop/importer-leftovers-r5-green` (`e2f202b`).
