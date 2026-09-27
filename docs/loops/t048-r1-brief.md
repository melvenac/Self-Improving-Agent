# T-048 round 1: `/sync`'s own checks must prove they looked (record 148)

**By:** Atlas (planner), record session 146 · 2026-09-27. **From:** Grok's audit `docs/loops/research/t048-silent-drops.md`
(record 139, merged in #166). The audit found 26 SILENT row-drops in `open-brain/src`, and every row is labelled READ.
**The planner read the audit, not the code at those sites.** The developer reads each site before fixing it, and
reports any row that does not match the audit.

## Why these five first

The audit ranks by what reaches the user. **A false green on a commit gate outranks a lost diagnostic,** and `/sync`
is the gate every seat runs before every commit. The five rows below are the `/sync` checks that can pass on a tree
they did not fully read. That is "absent ≠ zero", the invariant the project wrote down first, broken inside the
instrument that enforces it.

| Audit row | Check | The false green |
|---|---|---|
| SILENT 1 | `checkRetirements` (`checks.ts:1078`) | An unreadable file is `continue`d and still counted in "N live files" |
| SILENT 20 | `listScannableFiles` (`checks.ts:1145`) | A retired name in a tracked `.sh`, `.yml` or `.toml` is never scanned or counted |
| SILENT 26 | `walkTracked` fallback (`checks.ts:1154/1160`) | When `git ls-files` fails, a partial walk looks like a full one |
| SILENT 2 | `checkModuleBoundary` (`checks.ts:1240`) | An unreadable subdirectory looks like a directory with no core files |
| SILENT 3 | `checkTemplatePersonalNames` (`checks.ts:382/392`) | An unreadable prose file shares a swallow with a binary, so it reads as "no personal names" |

Line numbers are the audit's, at `7640b93`. They will have moved.

## The objective, and what "done" means

**Each of the five checks either reads everything it claims to have read, or does not pass.**
- An unreadable file or directory is an **ISSUE naming the path**, never a skip.
- Each check's output states what it walked (the count) and **what it excluded, and why**. For SILENT 20 that is the
  count by extension. Whether to widen the extension list is the developer's call; the count is not optional.
- The `walkTracked` fallback says in its output that it is the fallback, and it says when the walk was partial.
- **Rows:** a test per check with an unreadable input, failing at the base and passing after. Unreadability is hard
  to make portably on Windows, so the developer chooses the mechanism (an injectable fs, a directory where a file is
  expected, or chmod on Linux CI). **State each row's platform limit in the test and in the handoff.** A row that can
  only go red on Linux is acceptable if it says so.
- **Mutants:** put back each `catch { continue }` / `return`, and the matching row goes red.

## Preserve

- Every check's verdict on this repo's own clean tree is unchanged, except where it now correctly reports something
  it could not see before. Report any such new finding **as a finding**, and do not fix it in this round.
- `checkRetirements`' readable path, which QA and Grok both saw fire on `.agents/SYSTEM/ENTITIES.md`.
- `sync --check` stays read-only.

## Out of scope

SILENT 4–19 and 21–25. They are ranked, and they go to later rounds. SAFE and INTENDED rows are not touched.

## Brief

- **To:** a fresh Claude developer session (D-035) in `~/Worktrees/sia-builder`. **Branch** `loop/t048-r1` from
  `1646567` (T-179 round 2's candidate), because every in-flight branch changes `checks.ts` through T-179 round 2.
  It merges after T-179 round 2.
- **Read ONLY:** this file, the audit's SILENT 1, 2, 3, 20 and 26 rows, and the five functions at `1646567`.
- **Red first on tcm**, per test. Run `npx tsc --noEmit -p .` before every push. At most 6 tcm runs. **No laptop
  (`windows=true`) CI**: the laptop is running QA.
- Scratch only. Push only `loop/t048-r1` and `loop/t048-r1-*`. **Push the handoff BEFORE messaging atlas.** Report
  your effort from the transcript. No `/end`.
