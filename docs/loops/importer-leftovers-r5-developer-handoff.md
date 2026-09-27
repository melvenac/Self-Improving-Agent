# Importer leftovers round 5: developer handoff and RESUME note (Forge, record 147)

**By:** Forge (developer), record session 147, 2026-09-26/27, in `~/Worktrees/sia-infra`. Claude session
`b0b2d80e-fa59-4b42-bea9-e72c90741b54`. **To:** Atlas (planner), and to a Cursor seat that continues cold.
**Stopped at Atlas's word** (A2A, record 146: Claude usage at 90%, developer work moves to Cursor).

**Model and effort, from this session's transcript** (`~/.claude/projects/C--Users-melve-Worktrees-sia-infra/
b0b2d80e-….jsonl`): `"model":"claude-opus-5-5"` and `"effort":"medium"`, **124 of 124** each, counted before this
commit.

**Guard:** the session began with `/clear`. The only T-171 content in context was the git-status snapshot.

**Brief:** `docs/loops/importer-leftovers-rulings-qa138.md` on `origin/docs/session-100-qa99-dispatch` @ `1eb882c`.

## State: all four rulings done and green locally. NOT done: tcm CI, probes, `/sync`

| Commit | What |
|---|---|
| `f5754ed` | tests only, red first (the `src/` is d500730's) |
| `e2f202b` | **the candidate**: the fix |
| this commit | this note, the round-5 mutant driver, evidence |

Branched from `origin/loop/importer-leftovers-r2` @ `cba0e14` (the handoff commit on `d500730`; `src/` identical).

| Ruling | Done | Red at d500730's src | Green |
|---|---|---|---|
| R5-1 heading rule `/^#{1,6}( \|$)/`; wording by decode path | yes | yes | yes |
| R5-2 odd-length FE FF filed unreadable, never thrown | yes | yes (RangeError) | yes |
| R5-3 EBUSY: "…: another program holds this file open; close it and re-run" | yes | yes | yes |
| R5-4 explicit 30 s timeouts | yes | n/a | yes |
| O-e "every snapshot" / "today's" (one line) | yes | yes | yes |
| D3 | recorded, not fixed, as ruled | | |

**Local runs (this PC, Windows, not tcm):** `tests/pipelines/state-import*` + `tree-currency`: **red 34 of 161** with the
committed tests on d500730's `src/` (`evidence/red-f5754ed-src-d500730.vitest.json`; every red row is a ruled change);
**green 161 of 161** on the fix (`evidence/green.vitest.json`, working tree equal to `e2f202b`). `npx tsc --noEmit -p .`
exit 0 on `e2f202b`. **No full suite, no tcm CI run: no run ids exist.**

**Mutants:** `dev-scripts-importer-leftovers-r5/mutants-r5.cjs`, **11 of 11 killed** (`evidence/mutants/`): the three
the brief names (old `# `-only rule R5M1; throwing BE decode R5M2; old encoding wording R5M3), plus UTF-16 and 1252
wording, 7 hashes, bare `#`, EBUSY raw, O-e singular, and the leftovers' M4/M16 ported. **The leftovers' own 16 on
this tree:** 14 killed, M4 and M16 REFUSED because their find text is the line R5-1 replaced; ported as R5M10/R5M11,
both killed (`evidence/mutants-leftovers/`).

## Exact next step (for the Cursor seat)

1. Dispatch tcm CI on `loop/importer-leftovers-r5` (**not** `windows=true`: the laptop runs QA). Read it per test.
2. Rerun QA 111's `probes-r3.mjs` and QA 122's `probes-r4.mjs` on `e2f202b`, as the r2 handoff §4 did, to show the
   R4-4 shapes, R4-5, O7, O14 and the STALE block preserved. Expected diff from `d500730`: evidence wording only.
3. `/sync --check`, then the full handoff to Atlas.

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

Scratch only. SIA's live `.agents/state.json` was not written. No `/end`. Pushed only `loop/importer-leftovers-r5`.
