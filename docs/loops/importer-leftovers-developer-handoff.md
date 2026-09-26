# Importer leftovers (R4-4, R4-5, O7, O14): developer handoff

**By:** Forge (developer), record session **131**, 2026-09-26, in `~/Worktrees/sia-builder`. **To:** Atlas (planner).
**Brief:** `docs/loops/importer-r4-leftovers-brief.md` (on `origin/docs/session-100-qa99-dispatch`). **Rulings:**
`docs/loops/importer-fixes-r4-rulings-qa122.md`. **QA source:** QA 122's report on `origin/qa/importer-fixes-r4-report`
(`36c29d5`).

**Model and effort, from this session's transcript**
(`~/.claude/projects/C--Users-melve-Worktrees-sia-builder/6a780747-50d0-4d56-bdba-a1d048c18b52.jsonl`):
`"model":"claude-opus-5-5"` and `"effort":"medium"`. I counted both over the transcript's records when the session
opened (18 of 18 each) and again before this commit (199 of 199 each, no other value).

## 1. Base, and what is on the branch

- **Built on T-179: `origin/loop/t179-merge` at `f618b73`**, as the brief says. Branch `loop/importer-leftovers`.
- **`loop/t179-r2` is not on origin** (`git ls-remote` at 08:09Z and 08:30Z shows nothing), so nothing is merged in yet.
  When it is frozen, merge its tip in (never rebase); `state-import/` should not conflict, because round 2 does not touch
  it.

| Commit | Author | What | `git diff --stat <c>~1 <c>` |
|---|---|---|---|
| `350c0c0` | QA seat (record 122), cherry-picked from `aff7135` | QA 122's D11 test, the known positive, unchanged | `state-import-qa122.test.ts` \| 92 +; 1 file, 92 insertions |
| `463d470` | Forge | R4-4, R4-5 and O7 byte tests, red on `f618b73` | `state-import-leftovers.test.ts` \| 214 +; 1 file, 214 insertions |
| `ec6b3ce` | Forge | **the fix** | `cli.ts` \| 6 +-; `state-import/index.ts` \| 99 +++---; 2 files, 92 insertions, 13 deletions |
| `3875c2d` | Forge | two assertions that mutants M5 and M9 needed | `state-import-leftovers.test.ts` \| 8 +-; 1 file, 7 insertions, 1 deletion |
| `e222124` | Forge | O7's ordering moved into `markersOldestFirst`, with a direct test, because M13 survived on both filesystems (§5) | `state-import/index.ts` \| 14 ++-; `state-import-leftovers.test.ts` \| 8 +-; 2 files, 19 insertions, 3 deletions |
| this commit | Forge | this handoff, the mutant script, and evidence | docs only |

**The candidate is `e222124`.** The commit after it adds only `docs/loops/`.

## 2. What changed, per item

**R4-4 (D11)**, in `decodeText` and `detectStaleness`:
- **UTF-32LE's mark (`FF FE 00 00`) is tested before UTF-16LE's (`FF FE`).** The input is filed `unreadable` with the
  evidence `starts with a UTF-32LE byte-order mark (FF FE 00 00): the importer reads UTF-8, UTF-16 and Windows-1252,
  not UTF-32…`. UTF-32BE (`00 00 FE FF`) needs no test, because it is NUL bytes to the UTF-8 path, as before.
- **The NUL check is on both UTF-16 BOM paths** (`withBomCheck`). A U+0000 in the decoded text files the input
  `unreadable`: `has a UTF-16LE byte-order mark, but the text it gives holds N NUL character(s), the first at byte B:
  the mark does not match the bytes…`. B is counted in the file: 2 bytes of mark, then 2 per character.
- **A judged input with no readable `# ` title is `unreadable`**: `has no readable \`# \` title (it is empty | its
  encoding is not one the importer reads, UTF-7 among them), so its words cannot be read`. The line test is the same
  as `declaredSession`'s (`startsWith("# ")`). This covers UTF-7, a BOM over bytes of another encoding with no NUL,
  and O12's zero bytes.
- `COULD_NOT_TELL.unreadable.what` now says all three causes. The draft's CLI line said `cannot be read (NUL bytes)`
  for every unreadable input, which is false for UTF-7 and for an empty file. It now says `(NUL bytes, UTF-32, or no
  readable \`# \` title; the report says which)`. **No probe checks that line.** probes-r4's `refuseLines` rewrites it
  for display only, so its printed text differs from QA 122's run, and its PASS count does not.

**R4-5 (D12):** a not-judged input with unreadable bytes gets them appended to its not-judged line, in the report's
first section. DECISIONS.md also gets `decisions_unreadable` (`{evidence, imported, not_imported}`) in `ImportReport`
and in `CommitResult`. `describeDecisionsUnreadable` gives the three lines that the report, `--draft`'s stdout and
`--commit`'s stdout all print:
- `.agents/SYSTEM/DECISIONS.md contains 88 NUL byte(s), the first at byte 86, … It is not judged, so it does not block
  --commit: it is imported as far as it reads.`
- `ADRs imported: ADR-1`
- `ADRs NOT imported (headings found once the NUL bytes are removed; the unreadable bytes may hold more): ADR-2`

"Not imported" means the ADR headings that `importDecisions` finds in the text with its U+0000s removed and that
were not imported. That recovers the ASCII of a UTF-16 tail, such as PS 5.1's `>>` writes. **Its limit is printed with
it:** a heading in non-ASCII, or in bytes that do not decode, is not found. It does not block, as R4-5 rules.

**O7:** with two or more markers, the refusal puts them oldest first (`markersOldestFirst`: the names end in the date,
so name order is date order) and reads `Restore .agents/ by hand from <oldest>/ (the oldest; it holds the originals from before the first failed
--commit); <newer>/ holds the tree as a later run found it, then delete <m1> and <m2>. Nothing written…`. **One marker
reads byte for byte as before.** QA 111's probes-r3 parses that sentence to follow the way out, and its IF-19 rows
pass (§5).

**O14:** `InputStaleness` is now a union. Its `could_not_tell` arm REQUIRES `could_not_tell: CouldNotTell`, and
`blocksCommit` reads `COULD_NOT_TELL[i.could_not_tell]` with no `!== undefined` guard. Either way a reason goes missing
is now a compile error (M15, M16).

## 3. Red first

| Where | Run | Result |
|---|---|---|
| NTFS, `f618b73` + the tests (`463d470`) | `evidence/red-local-f618b73.out` | **10 failed / 11 passed** of 21 in `state-import-leftovers`. Every failure is an `AssertionError` on the defect: 6 on `expected 'could_not_tell/no_declared_session' \| 'stale' to be 'could_not_tell/unreadable'`, the UTF-7 refusal on `to throw`, the 2 R4-5 rows on the report and stdout regex, and O7 on the refusal text. The 11 green are the guards. |
| **tcm**, `463d470` on `loop/importer-leftovers-red` | **`36229195715`** (`tcm-2`), `evidence/ci-36229195715-red.txt` | failure, as intended: **12 failed / 1298 passed / 2 skipped (1312)**. The 12 are my 10 plus QA 122's 2 D11 rows (UTF-32LE, UTF-7). There are 19 `AssertionError` lines and no other error type. The other 84 test files pass. |

## 4. Green

| Where | Run | Result |
|---|---|---|
| NTFS, `ec6b3ce`, the 10 importer files | `evidence/importer-files-ec6b3ce.out` | **112 of 112**, 10 files, vitest exit 0. |
| **tcm**, `ec6b3ce` on `loop/importer-leftovers` | **`36229390124`** (`tcm-2`), `evidence/ci-36229390124-green.txt` | **success: 86 of 86 files, 1310 passed, 2 skipped (1312)**, `npx tsc --noEmit` step included. |
| NTFS, `e222124`, `state-import-leftovers` | local | 22 of 22. |
| NTFS, `e222124`, the 10 importer files | `evidence/importer-files-e222124.out` | **113 of 113**, 10 files, vitest exit 0. |
| **tcm**, `e222124` on `loop/importer-leftovers` | **`36230714062`** (`tcm-2`), `evidence/ci-36230714062-final.txt` | **success: 86 of 86 files, 1311 passed, 2 skipped (1313)**. |
| `npx tsc --noEmit -p .` | `ec6b3ce`, `3875c2d`, `e222124` | exit 0. |

**The full suite was not run locally**, as the brief says. tcm ran it at `ec6b3ce`.

**`sync --check` at `463d470` (built): 21 passed, 3 issues, 4 warnings, 4 skipped. All 3 issues are the base's, not
this change's:** `retirements` (ENTITIES.md names `dream` and `reflection queue`), `mirror-parity` (the `end.md`/`sync.md`
template copies), and **`state-schema`: this branch's CLI is T-179's schema v3, and the record here is v2.** That last
one is expected on a T-179 base before the record is migrated, and it belongs to T-179's merge, not to this task.

## 5. Mutants, one per protection

Script: `docs/loops/dev-scripts-importer-leftovers/mutants-leftovers.cjs`, run from `open-brain/` at **`e222124`**,
08:34:40Z–08:40:28Z, alone on the machine. It uses no shell. Each edit must match exactly once, `tsc` runs on every
mutant, and the source is restored and its sha256 checked afterwards (`src/ clean` at the end). Each mutant's `git
diff` and the whole console (`mutants-leftovers.out`, which lists every red test) are in `evidence/mutants/`. vitest
covers the 10 importer files, 113 tests.

| Mutant | Protection removed | Result at `e222124` (red of 113) |
|---|---|---|
| M1-utf32-first | R4-4: UTF-32LE tested before UTF-16LE | **killed**, 1 (the UTF-32LE row: the NUL check still catches the shape, but the evidence no longer says UTF-32) |
| M2-le-bom-nul | R4-4: NUL check, UTF-16LE BOM path | **killed**, 1 |
| M3-be-bom-nul | R4-4: NUL check, UTF-16BE BOM path | **killed**, 1 |
| M4-no-title | R4-4: no readable `# ` title is unreadable | **killed**, 5 (UTF-7, zero bytes, the lying BOM, the UTF-7 refusal, QA 122's UTF-7 row) |
| M5-not-judged-line | R4-5: the not-judged line names the bytes | **killed**, 1 |
| M6-report-block | R4-5: the report's Decisions block | **killed**, 1 |
| M7-draft-source | R4-5: the draft computes `decisions_unreadable` | **killed**, 2 |
| M8-commit-output | R4-5: `--commit`'s stdout | **killed**, 1 |
| M9-draft-output | R4-5: `--draft`'s stdout | **killed**, 1 |
| M10-no-nul-strip | R4-5: not-imported found without removing NULs | **killed**, 2 |
| M11-no-filter | R4-5: not-imported excludes the imported | **killed**, 2 |
| M12-o7-reversed | O7: oldest first, reversed | **killed**, 2 |
| M13-o7-unsorted | O7: the sort itself | **killed**, 1 (see below) |
| M14-o7-one-marker-text | O7: the two-marker sentence | **killed**, 2 |
| M15-o14-optional | O14: the reason optional again | **killed by tsc**: `TS2538: Type 'undefined' cannot be used as an index type` at `blocksCommit` |
| M16-o14-producer | O14: a producer leaves the reason out | **killed by tsc**: `TS2345` at the no-title producer |

**16 of 16 killed, at `e222124`.**

**M13 SURVIVED the first run, at `3875c2d` (08:20:20Z–08:27:08Z, 15 of 16), and that is why `e222124` exists.** With
the sort inline in `refuseHalfRestored`, removing it left all 112 tests green on NTFS. I then ran it on tcm
(`loop/importer-leftovers-m13`, `3b5a191`, marked NOT a candidate, run **`36229998699`**, `tcm-1`): **success, 1310
passed**. It survived there too. Both filesystems listed the archive directory in name order, so no test through the
directory could tell whether a sort was there. `e222124` moves the order into `markersOldestFirst(names)` and tests it
with names given out of order. The first run's console is not kept in `evidence/`; this paragraph and the tcm run are
its record.

**M5 and M9 needed `3875c2d`.** Before it, the report named DECISIONS.md's NUL bytes in two places, and nothing asserted
on the draft door's stdout, so I expected both mutants to survive. **I did not run them before `3875c2d` to confirm
that.** The two assertions sit inside tests that were already red on the base, so these mutants are their only proof.

## 6. QA's probes on my tip

The scripts were extracted with `git cat-file -p` and checked with `git hash-object`: QA 111's `probes-r3.mjs`
(`b3ecab0`) and QA 122's `probes-r4.mjs` (`d475c7b`). They ran against a scratch worktree at `e222124`, built with
`tsc`, with `node_modules` junctioned to this tree's. The run was 08:40:49Z–08:43:24Z, after the mutant chain had ended.
The same three runs at `3875c2d` (08:27Z–08:31Z) gave the same counts (17/4 with the same ids, 12 then the same EBUSY crash, 16/0); the evidence kept is `e222124`'s.

**probes-r3 (byte-exact): 17 passed, 4 failed, 21 checks. The same 17/4 as QA 122 at `78a7d13`.** My PASS/FAIL ids,
diffed against QA 122's `evidence/probes-r3-78a7d13.out`, are identical. Each FAIL, from my output:

| FAIL row | What fails at `e222124` | Ruling that changed it |
|---|---|---|
| `R3-2 class: utf8 then PS 5.1 >>` | 0 STALE / 3 could not tell (`25 NUL byte(s), the first at byte 103`); bare `--commit` exit 1, no `state.json` | **R3-2**'s NUL case, kept by **R4-1** (block, do not judge) |
| `R3-2 class: utf8-bom then PS 5.1 >>` | the same shape | the same |
| `R3-2 class: cp1252 then PS 5.1 >>` | the same shape | the same |
| `R3-2 class: UTF-8 with one stray NUL at the end` | 0 / 3 (`1 NUL byte(s), the first at byte 102`), exit 1 | the same |

The IF-19 rows, which parse the one-marker refusal to follow the way out, **pass**. So O7 did not change the sentence
they parse.

**probes-r4 (byte-exact): it did not finish. It CRASHED in QA's own instrument, not in the importer.** After IF-21's
12 rows (**12 PASS**) and the nine "other shapes" notes, its "held open" section holds INBOX.md with
`FileShare.None`. The script's `tree()` then calls `readFileSync` on that file and throws `EBUSY` (`probes-r4.mjs:45`,
from `:182`). **On this PC, Node 22.23.2's `readFileSync` cannot read a file held with share `None`. On QA 122's PC it
could (their O13).** Two machines disagree, and O13's "a hold cannot make the importer's read fail" is therefore not
true everywhere. The byte-exact run gives 12 passed, 0 failed, no SUMMARY line (`evidence/probes-r4-e222124.out`).

**probes-r4 minus that one hold** (`evidence/probes-r4-noNone.diff`, one line removed, NOT byte-exact): **16 passed,
0 failed**, which matches QA 122's candidate (`evidence/probes-r4-noNone-e222124.out`):
- **IF-21, 12 of 12**: NUL counts and first bytes as QA's (25 at 110/113/104, 1 at 109, 100 at 1, 100 at 0).
- **IF-22, 4 of 4**: `no_session_log`, `no_declared_session`, +13 and +1 each commit with a bare `--commit`. That is
  IF-10 through the CLI.
- **The other shapes, now each judged as it reads:** a UTF-8 BOM then UTF-16LE, all NULs, **zero bytes**, **UTF-32LE**,
  UTF-32BE and **UTF-7** are each `could_not_tell/unreadable`, and a bare `--commit` exits 1, stale and current. At
  `78a7d13` the bold three committed. Zero bytes then `>>`, and UTF-16LE with a BOM then `Add-Content` or `>>`, are
  STALE or current, as at `78a7d13`.
- **Held open:** `Truncate`/`Write`/share `Read` (an `Out-File` in progress, the 0-byte read of O12) is now
  **`unreadable`: bare `--commit` exit 1, tree identical, no `state.json`.** At `78a7d13` it was `no_declared_session`,
  and QA saw it reach the render and fail twice (EPERM, then rollback EBUSY). `Open`/`Write`/share `ReadWrite` is
  STALE, exit 1, identical, as before.
- **DECISIONS.md (D12):** size 263, 88 NULs, first at 86. The not-judged line now ends `It contains 88 NUL byte(s), the
  first at byte 86, …`. A bare `--commit` exits 0 and `state.json` has `["ADR-1"]`. It does not block, as R4-5 rules,
  and the naming is asserted in the tests (the probe prints only 200 characters of stdout).

**Not run:** the share=`None` hold against the importer itself. What the importer does when its OWN read fails with
EBUSY (the `readText` path) is untested on this candidate, and it is now reachable on at least one Windows PC.

## 7. Open, and for the planner

1. **M13:** closed by `e222124` (§5).
2. **O13 does not hold on this PC** (§6). An unreadable READ is reachable here. `readText` throwing EBUSY in
   `buildImportDraft` would fail the draft loudly rather than open, but that is from reading the code, not from a run.
   It is a candidate follow-up, not part of this brief.
3. **The no-title rule is new behaviour for adopting projects.** A real INBOX.md, task.md or next-session.md whose
   first heading is `##`, or which has no heading, now blocks a bare `--commit` as unreadable, and the refusal names
   it. That is what R4-4 rules, and **T-181's co-op-mailer import will meet it if its files are shaped that way.** The
   way out is `--accept-stale`, or adding the title.
4. **`loop/t179-r2`**: not yet on origin, so it is not merged in (§1).
5. **Scratch left behind on purpose:** the worktree `…/scratchpad/tip` (at `e222124`, detached; its local M13 commit
   `3b5a191` is on origin as the mutant branch) and the probe directories. `git worktree remove` clears them.

## 8. Branches pushed (each read back with `ls-remote`)

- `loop/importer-leftovers-red` → `463d470` (red CI)
- `loop/importer-leftovers` → `e222124` (the candidate), then this handoff commit on top of it. That commit's SHA is in the message to Atlas, read back from origin.
- `loop/importer-leftovers-m13` → `3b5a191` (mutant, not a candidate)

No `/end`, as dispatched.
