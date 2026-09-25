# QA 102 scripts: importer fixes (T-175, T-180), candidate `f6b6d44`

These are the scripts behind `docs/loops/importer-fixes-qa-report.md`. They are all Node, use no shell
(`execFileSync`/`spawnSync` with argument arrays), and write only under the scratch directory you give them.
The one exception is `mutants.mjs`, which edits the candidate worktree's two source files and restores them
by hash.

| Script | Dispatch step | What it does | Run it as |
|---|---|---|---|
| `fidelity.mjs` | 3 | Compares the fixture's 7 `.agents` files with A2A-Hub `e0bc3f8`, **git blob against git blob**, so neither side goes through a checkout's EOL conversion. It also checks the fixture's file list and its cut-down `package.json`. | `node fidelity.mjs <sia-repo> <a2a-hub-clone>` |
| `secrets.mjs` | 4 | Plants one positive per pattern (11) and a prose negative, **refuses to scan** unless every plant fires and the prose gives 0, then scans the target and lists suspicious file names. | `node secrets.mjs <dir>` |
| `probes.mjs` | 2, 5 | Re-runs IF-1 to IF-4 and the V-009 parts of IF-7 against the **built** CLI (`open-brain/build/cli.js`). It then runs the dispatch's five probes and seven more. The IF-2 run is on a fresh `git archive e0bc3f8` of the real A2A-Hub, not the vendored fixture. | `node probes.mjs <candidate-worktree> <a2a-hub-clone> <scratch>` |
| `mutants.mjs` | 6 | Runs 16 mutants, one per protection: the developer's M1 to M5 rebuilt from the handoff's descriptions, plus 11 more. Each edit must match an exact number of times or the mutant is VOID. It saves `git diff` per mutant, runs `tsc --noEmit` and the three importer test files (JSON reporter), restores the source, and checks the hashes and `git status`. | `node mutants.mjs <candidate-worktree> <out-dir>` |

Pointing `probes.mjs` at a build of master (`9bc06e3`) is how the report separates regressions from
behaviour that predates the candidate. That run's output is `evidence/probes-master.out`.

## Setup used

- Candidate: `git worktree add --detach <scratch>/cand f6b6d44`, then `npm ci && npm run build` in `open-brain`.
- Master for comparison: the same at `9bc06e3`.
- A2A-Hub: `git clone --no-checkout https://github.com/melvenac/A2A-Hub.git`, read only with `git cat-file` and
  `git archive`.
- Node v22.23.3, npm 10.9.9, win32, `DESKTOP-O4EGB1E`.

## evidence/

The raw output of each run the report cites: `probes.out`, `probes-master.out`, `mutants.out`, `mutant-diffs/M*.diff`,
`fidelity.out`, `secrets.out`, `sync-plain.out`, `if6-redcheck-e082983.out`, `if6-candidate-tests-on-master.out`,
`full-suite-f6b6d44.out`, which has the summary lines, the exit code and the process listings, and
`ci-36095908990.log`, CI's log with the ANSI codes stripped.
