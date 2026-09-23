# QA scripts behind report A3 (Loop 15 slice three), tracked so the next QA session can rerun them

**By:** Probe (QA seat), record session 87, 2026-09-23. These are the scripts that produced
`docs/loops/loop-15-slice-3-qa-report-a3.md` (merged at `9c8176f`), **byte-identical to the copies that ran**
(`git hash-object` compared against the scratchpad originals before commit). They were not edited afterwards,
so the paths below are hard-coded exactly as they ran.

**Why they are tracked.** Reports A and A2 kept their scripts scratchpad-only and described their shapes. This
session found session 85's scripts still on disk by chance, and reused them. A roll to a fresh session must not
depend on that.

## Before you run anything

1. **Hard-coded paths.** `S` (this session's scratchpad) and `REPO` (`C:/Users/melve/Worktrees/sia-qa`) are set
   in `archive.mjs`, `build.mjs` and `runmut.sh`. Copy the directory to your own scratchpad and edit those
   constants. **Never run the probes inside a checkout.** Every probe creates its victims, repos and scratch
   `HOME` under `os.tmpdir()`.
2. **Never `rm -rf` an archive or mutant copy while its `node_modules` junction exists.** Remove the junction
   first with a non-recursive `rmdirSync`, then delete the copy (report A3 §12, report A2 §12).
3. **`tar -C` needs forward slashes on this machine.** `archive.mjs` and `build.mjs` already split backslashes.
4. **Write every edit through a tool, not a shell quoting layer.** Report A3 §12 records `sed` eating a
   backslash.

## Files

| File | What it does | Report A3 section |
|---|---|---|
| `archive.mjs <label> <sha>` | `git archive <sha> open-brain` into `arch/<label>`, junctions `node_modules` from the QA tree | header, §3 |
| `probe15.mts <open-brain tree> <probe…>` | CA-15 loop probes. It is session 85's `probe15b.mts` plus **machineHardAbsent, r35chainJ, r35chainH, baseHard** (session 87); machineHard also gains a qa-stage victim edit | §3 |
| `probe2.mts <open-brain tree> <probe…>` | session 85's non-link probes: H, R34, SINGLE, DFORK, DMGconfig/head/index, COMPOSE | §2, §10 |
| `mutants-a3.mjs` | mutant edit specs against A3 `5010199`: the §4 set, A2's M-follow-a/b/c re-derived for A3's text, and one per A3 protection (M-R43-repo/machine, M-R44, M-R45 ×3, M-R46-root/basenotes, M-2.5 ×2) | §3, §4 |
| `build.mjs <mutant>` | archives `5010199`, applies a mutant's edits, **asserts each landed and reads it back**, and runs `tsc --noEmit` | §4 |
| `runmut.sh <mutant…>` | the six candidate row files with `--reporter=json`, then each mutant's probes | §4 |
| `tab15.mjs <label…>`, `tabmut.mjs <mutant…>` | summarise `p15-<label>.json` and `mut/<mutant>.*` | — |

Run the probes with `node <QA tree>/open-brain/node_modules/tsx/dist/cli.mjs probe15.mts <tree> <probes>`.

## For the next candidate (A4)

- **Rebase the mutant specs.** `build.mjs` pins `SHA = 5010199…`, and the `find` strings are A3's text. The
  builder refuses any edit whose `find` count is wrong, so a stale spec fails loudly. Re-derive it; do not
  loosen the count.
- **The known positives.** For A3-1, A3-2 and A3-3, **A3 `5010199` is the positive**. Its `victimHashInRecord`
  reads `true` for machineHardAbsent, r35chainJ and r35chainH, and baseHard fails at the planner stage. The
  same expression reads `false` at A3 for machineHard and machineNext. For the A2 defects, **A2 `2add792`** is
  the positive (report A3 §3).
- **A repair that stops recording the hash but still reads the file would pass these probes** (report A3 §8,
  traceless reads). Check a repair of A3-1 and A3-2 by the code path as well as by the record.
