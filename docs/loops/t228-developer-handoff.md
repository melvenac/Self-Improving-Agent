# T-228: hub-talk exit codes 0 to 3 in every Cursor copy of the wait rule

**By:** Forge (builder, sia-builder), 2026-10-02. **Branch:** `loop/t228-hub-rc3` from `origin/master` `c0c710e4`. **Code SHA to freeze: `e1ffa274a64cc46db791845c7d16fb8d9cf6589e`.** Not merged. Markdown plus one test file and one data file; one vitest file per run, `tsc --noEmit` exit 0.
**Source of the contract:** relay's A2A Loop 13 (A2A-Hub master `8e59f58`, `docs/loops/loop-13-design-ruling.md`), as given in Atlas's dispatch. I did not read the ruling file itself (it is in the A2A-Hub repo, not this one); the wording below is the dispatch's.

## Which files carry the wait sentence (found by `git grep "wait-timeout 3500"`)
Three carry it as instruction text, and all three changed:
1. `project-template/.cursor/commands/start.md`, "Hub room" (line 109 on master). The old line said "run hub-talk with `--wait --wait-timeout 3500`, and again on exit 2". It now says "and act on its exit code (next line)", and a **new line** carries the four codes.
2. `.cursor/rules/hub-room.mdc` (this repo's own always-apply rule).
3. `project-template/.cursor/rules/hub-room.mdc` (the template's copy). Kept **byte-identical** to (2), and a test pins that.
Not changed, on purpose: `.agents/SYSTEM/hub-partner-seats.json` (`"wait": "--wait --wait-timeout 3500"` is a command token, not a sentence), and the historical dispatches and notes under `docs/loops/` that quote the old flags. The Claude Code `start.md` copies have no hub section (`start-parity` lists the Hub room as `cursor_only`), so nothing to mirror there.

## The contract as written
exit 0: a turn was printed, act on it. Exit 1: refused or called wrong, fix the call and do not retry. Exit 2: the window elapsed, wait again. Exit 3: unavailable or throttled; the last stderr line is `[hub-talk] retry status=<code|network> retry-after=<seconds|unknown>`; wait `retry-after` seconds, otherwise back off 5 s doubling to 60 s; after 5 consecutive exit-3 results over 2 minutes with no `retry-after`, stop and report.

## The parity table
`docs/loops/cursor-start-differences.json` `cursor_only` waives **complete lines** only. The reworded Hub-room line and the new codes line are each an entry now (the old line's entry was replaced). That is the only edit to the file, and no entry was added for anything else.

## Evidence
- New `tests/pipelines/sync/hub-talk-exit-codes.test.ts`, 6 rows: each of the three copies carries every part of the contract (16 phrases, case-insensitive, including the stderr line and the backoff numbers); the old two-code wording is gone; the two `.mdc` copies are identical; every `hub-talk` line in the Cursor Hub-room section is a complete line of the `cursor_only` table.
- **Red before: 5 failed | 1 passed (6)** (the identical-copies row passed already). **Green after: 6 passed (6).**
- `start-parity` 11, `command-parity` 9, `mirror-parity` 13, `hub-seats` 5: all passed, each run as its own file.
- **Mutant** (one word appended to the new codes line in the template `start.md`): `start-parity` goes red ("is green on this tree", 1 failed | 10 passed) and so does the new table row (1 failed | 5 passed). Restored.
- `sync --check` from source: 31 passed, 3 warnings, 3 issues, 1 skipped; `command-parity` passes; nothing new.
