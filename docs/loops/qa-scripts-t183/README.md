# QA 114 (T-183, the greeting size): scripts and evidence

Report: `docs/loops/t183-qa-report.md`. All scripts are Node ESM, with no dependencies beyond a built `open-brain`.
Scratch trees used by this seat (none are tracked):

| Path | At | Built |
|---|---|---|
| `C:\qa-scratch\qa114\cand` | `0f0e7ad` (candidate code) | yes |
| `C:\qa-scratch\qa114\base` | `48acaa8` (base) | yes |
| `C:\qa-scratch\qa114\mut` | `0f0e7ad`, mutated then restored per mutant | node_modules only |
| `C:\qa-scratch\qa114\mutii` | `origin/loop/t183-mut-ii-verbatim` (`b4f777f`) | yes (node_modules junctioned to cand) |

| Script | What it does |
|---|---|
| `verbatim-revisions.mjs <cand-ob> <base-ob> <repo>` | Renders EVERY `state.json` git holds (all refs) with the candidate and the base renderer, for each seat and the unresolved reader. Checks own handoff verbatim, everything outside Verified/Gaps identical to base, every gap and verified line whole-or-marked, the newest-10 + reopened rule, and the exact omission line. |
| `greeting-live.mjs <ob> <root> <seat> [--dump f]` | Calls the built `handleStart` (what `ob_start` runs) in a scratch root as a given seat (writes `.agents/AGENT.local.md` there), and `composeGreeting` / `checkGreetingSize` from the same build. Reports live vs composed length, the uncounted lines, and whether each role file is whole in the live text. Deletes the session log the call creates. |
| `omission-command.mjs <root>` | Runs the omission line's command exactly as printed, from the root, and checks every omitted verified claim is in its output byte-identical; also plain `state show`; asserts nothing was written. |
| `clip-edges.mjs <ob>` | `clip()` on named edge cases, plus a seeded 200,000-case fuzz of the never-silent invariant. |
| `clip-lengths.mjs <ob> <state.json>` | How much of each real gap / newest-10 verified claim survives the clip. |
| `mutants-t183.mjs <wt> [id...]` | The developer's four mutants (taken from their branches) and this seat's own (q1..q20), each tsc-checked and run per test (vitest JSON reporter); restores and asserts the tree clean. |
| `apply-survivors.mjs <wt> [--without-q20]` | Applies the locally surviving mutants together, for one full-suite CI run on tcm. |

## Reproduce

```sh
git worktree add --detach C:/qa-scratch/qa114/cand 0f0e7ad && (cd C:/qa-scratch/qa114/cand/open-brain && npm ci && npm run build)
git worktree add --detach C:/qa-scratch/qa114/base 48acaa8 && (cd C:/qa-scratch/qa114/base/open-brain && npm ci && npm run build)
git worktree add --detach C:/qa-scratch/qa114/mut 0f0e7ad && (cd C:/qa-scratch/qa114/mut/open-brain && npm ci)
S=docs/loops/qa-scripts-t183
node $S/verbatim-revisions.mjs C:/qa-scratch/qa114/cand/open-brain C:/qa-scratch/qa114/base/open-brain .
for s in developer qa planner; do node $S/greeting-live.mjs C:/qa-scratch/qa114/cand/open-brain C:/qa-scratch/qa114/cand $s; done
for s in developer qa planner; do node $S/greeting-live.mjs C:/qa-scratch/qa114/base/open-brain C:/qa-scratch/qa114/base $s; done
node $S/omission-command.mjs C:/qa-scratch/qa114/cand
node $S/clip-edges.mjs C:/qa-scratch/qa114/cand/open-brain
node $S/mutants-t183.mjs C:/qa-scratch/qa114/mut
```

`evidence/` holds each script's output as run by this seat (`mutants-run1.json` is the first 21-mutant pass,
`mutants-run2.json` the four added after it).
