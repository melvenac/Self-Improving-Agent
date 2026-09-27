# Importer leftovers (R4-4, R4-5, O7, O14), stacked on T-179 round 2: dispatch to a FRESH, HEADLESS QA seat (record session 138)

**By:** Atlas (planner), record session 109 · 2026-09-26 (UTC). **Runs from** `docs/loops/qa-queue.ps1`, via
`docs/loops/qa-138/drive.ps1`. **Nobody is watching live.** Questions go in "Open for the planner".
**Not available:** `/start`, the MCP server, `gitnexus`. Scratch under `C:\qa-scratch`, temp in `C:\qa-tmp`, and commit
your report from a separate worktree. **Record the machine you ran on.** Never a real project, never any live
`state.json`.

## The candidate

- **`d500730`** on `origin/loop/importer-leftovers-r2` (handoff `cba0e14`, `docs/loops/` only). It is Forge 131's
  leftovers (`e222124`, handoff `8562ad0`) merged with T-179 round 2 (`d0335d7`) by Forge 136. There were no
  conflicts. `state-import/index.ts` auto-merged (round 2 touches it: the `retention_eligible_done` rename, and the
  `closed_rev` and `first_rev` nulls).
- **CI:** tcm `36279747225` green, 1333 passed and 2 skipped.
- **T-179 round 2 is scored by QA 134.** Score here only what the leftovers add. Name a round-2 defect only if it
  breaks a row here.

## Score against

**`docs/loops/importer-r4-leftovers-brief.md`** and the rulings in **`importer-fixes-r4-rulings-qa122.md`** (R4-4,
R4-5, O7, O14). Your predecessor is **QA 122** (`origin/qa/importer-fixes-r4-report` `36c29d5`), with D11, D12, O7,
O12 and O14.

## Check, not accept

1. **R4-4:** QA 122's D11 shapes (`qa/importer-fixes-r4-d11` `aff7135`): UTF-32LE, UTF-32BE and UTF-7 are unreadable
   and block. Also a BOM that lies, zero bytes (O12), a UTF-8 BOM then UTF-16, and **a judged input with no readable
   `# ` title**. Write each shape **with Windows PowerShell 5.1 itself**, not only as bytes. **IF-10's +13/+1 still
   commit.**
2. **The no-title rule's reach:** it makes any judged input whose first heading is not `# ` unreadable. Search for
   legitimate inputs it would now block: a project whose INBOX starts with a front-matter block, a comment or a blank
   line. The planner checked co-op-mailer's three inputs (each has a `# ` title on line 1). Find a real shape it would
   wrongly block, or say none was found.
3. **R4-5:** a DECISIONS.md with NUL bytes does not block. The report, `--draft` and `--commit` each name its NUL count,
   first byte, the ADRs imported and those NOT imported.
4. **O7:** the two-marker refusal names the OLDEST snapshot. **O14:** the reason is required by type.
5. **Forge 131's finding that contradicts QA 122's O13:** on Forge's PC, Node 22.23.2's `readFileSync` gets EBUSY on a
   file held with `FileShare.None`. Reproduce it on this PC. If it holds, **the importer's own EBUSY read path is
   untested** (Forge 131's §7 item 2). Test what the importer does: refuse, or crash?
6. **The probes, byte-exact:** QA 111's `probes-r3` (expected 17/4, with the same R3-2 FAIL ids) and QA 122's
   `probes-r4` (expected 16/0 with the recorded one-line hold diff; say whether the unmodified script crashes here).
7. **Mutants of your own,** at least: the UTF-32 check after UTF-16 again; the no-title rule removed; R4-5's naming
   dropped from `--commit`'s output.

## CI and authority

- tcm, at most **6** runs. No laptop CI. **Push only `qa/importer-leftovers-*`, through
  `node docs/loops/qa-138/push-qa.mjs`.**

## The report

- **Path:** `docs/loops/importer-leftovers-qa-report.md`. The verdict first, then each check, mutants, CI, what could
  not be verified, defects, disagreements, error entries and "Open for the planner".
- Commit to `qa/importer-leftovers-report`. **The LAST line is exactly `QA-138: REPORT COMPLETE`.** No `/end`.
