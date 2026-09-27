# QA scripts behind report A12 (Loop 15 slice three), tracked so the next QA session can rerun them

**By:** the QA seat, record session 149, 2026-09-27, on the QA PC `DESKTOP-O4EGB1E`, headless. These are the scripts
that produced `docs/loops/loop-15-slice-3-qa-report-a12.md`, **byte-identical to the copies that ran** (compared with
`git hash-object` before commit). The scratch directory was `C:/qa-scratch/qa149` (a Defender exclusion, like
`C:/qa-tmp`, per `drive.meta`).

Reused **unchanged**, and not copied here:
- QA 130's `docs/loops/qa-scripts-a11/cmpbase.mjs`;
- QA 130's probe set, taken byte-exact from `origin/qa/loop-15-slice-3-a11-probe` (`5564ef6`): `qa130-a11-probe.test.ts`
  `0628e59c`, QA 108's three, and the carried QA 89–104 probes.

Most scripts here are QA 130's, repointed (paths, SHA, names) and nothing else. Each one's first comment says what it
came from.

## Before you run anything

1. **Hard-coded paths.** `C:/qa-scratch/qa149` and `C:/Users/Aaron Melven/Worktrees/sia-qa` are constants. Repoint them.
2. **`mkbranch12.sh` needs ABSOLUTE source paths.** It sets the git identity per command and writes no git config.
3. **Push only through `node docs/loops/qa-149/push-qa.mjs <branch>`** (QA 149's dispatch).
4. **Never `rm -rf` an archive or mutant copy while its `node_modules` junction exists.** Remove the junction first.
5. **Run nothing beside a mutant batch or the full suite.**
6. **The POSIX rows chmod directories to 0600 and 0000**, and restore them in `finally`/`afterEach`.
7. **This PC runs the seat elevated with `SeBackupPrivilege`.** An ACL cannot deny it `lstat`, so the win32 rows wrap
   `node:fs` (`vi.mock`) for one path. The real EACCES shapes need Linux (tcm).

## Files

| File | What it does |
|---|---|
| `qa149-a12-probe.test.ts` | check 1 on Linux: QA 130's REPO-UNREADABLE-ZEROED, SUBDIR-NOSEARCH-PLANT and DOTGIT-NOSEARCH acts, printing the whole message, `unrestored`, the plant, the git calls after the role (QA 130's spy) and the stored `kind` read back out of `FAILED.md` |
| `qa149-a12-mock.test.ts` | check 1 on every platform, with `lstatSync` wrapped to throw EACCES for one planted path; a present-path control |
| `qa149-a12-probe2.test.ts` | check 6: `baseText` for a loop base whose `realpath` failed (the real chmod shape and a wrapped `realpathSync`), and Q149-MOCK-R90-TEXT, R90's text pinned on every platform |
| `mutants-a12.mjs` | QA 130's three R93 mutants re-applied to `7200e1c` (`q130-r85b-via` adapted: R91's block deleted whole), this seat's `q149-*` mutants, and `FIX-q149` (a known negative) |
| `build12.mjs <mutant>` / `ARCH=<name>` | archive `7200e1c`, apply, assert the count before and after, read back, `tsc --noEmit` |
| `runmut12.sh <mutant…\|BASELINE>` | QA 130's row list, plus `configwatch-a12` and my probe and mock files, with the JSON reporter |
| `runp2.sh <mutant…\|BASELINE>` | probe 2 alone in each tree |
| `tabmut12.mjs [mutant…]` | kills and heals against BASELINE, by test name |
| `cmpmsg.mjs <a.json> <b.json>` | for tests red in both: the first line of the failure, normalised (inodes, hashes, temp paths) |
| `mkbranch12.sh` | the probe, mutant and FIX commits, built with a temporary index; the QA tree is never touched |
| `cilog12.sh`, `cidiff12.sh` | fetch a CI run's log once; kills and heals between two runs, by test name |
| `effort12.mjs` | model and effort, read as JSON from the driver's stream and the host transcript |
| `fills.mjs` | the report's measured fill-ins (placeholders replaced exactly once; it fails if one is missing or left over) |
| `suite12.sh` | the full suite once in the worktree at the frozen SHA, with the default temp and process lists before and after |
