# QA 106 scripts: importer fixes round 2 (candidate `aba35de`)

Everything here ran on the QA PC `DESKTOP-O4EGB1E`, headless, with `TEMP`=`TMP`=`C:\qa-tmp` (Defender-excluded) and
all scratch work under `C:\qa-scratch` (Defender-excluded). The one full suite ran with the default temp, the 8.3
path `C:\Users\AARONM~1\AppData\Local\Temp` (the Defender-on control). The report is
`docs/loops/importer-fixes-r2-qa-report.md`.

| Script | What it does |
|---|---|
| `probes-r2.mjs <worktree> <scratch>` | Round 2's protections through the BUILT CLI, by class: R2-1 in 17 encoding shapes (11 byte shapes built in Node, 6 written by Windows PowerShell 5.1 itself), SUMMARY.md in 5 shapes; R2-2 at +13, +1, 0 and -1 sessions; R2-3's induced failures (read-only INBOX.md, `--force-snapshot`, a junction inside `.agents/`, and **the rollback itself failing**, induced by a PowerShell handle on SUMMARY.md shared for read only), then the operator's re-run path; R2-4's token matrix (60 runs: `-x`, `x`, a second project, a missing directory, in every order relative to the flag and the named directory, for `--draft` and `--commit`, standing in another drafted project) and edges. Run it against the candidate and round 1 with the same arguments. |
| `probe-existing-snapshot.mjs <worktree> <scratch>` | D6: a `--commit` refused because today's snapshot already exists, and whether that snapshot survives the refusal. |
| `mutants-r2.mjs <candidate> <out>` | IF-13: QA 102's M1–M16 (M3 and M7 re-anchored), the round-2 protections N1–N17 rebuilt from the handoff (plus N13b, run separately with `ONLY=N13b` after N13 survived), four rollback mutants R1–R4, and one equivalent mutant E1. All five importer test files. `ONLY=M6,N1` runs a subset. |
| `procs.ps1` | The node/claude/powershell processes and the CPU load, for the full suite's before/after record. Call it with a forward-slash path from bash (E5 in the report). |

QA 102's `probes.mjs`, `mutants.mjs` and `fidelity.mjs` were run **unchanged**, copied with `git show` into files
whose `git hash-object` matches the tracked blobs (`a23d5d6`, `bda4593`, `71dfd82`). They are not copied here; they
are on `origin/qa/importer-fixes-report` in `docs/loops/qa-scripts-importer/`.

`evidence/` holds the raw output of every run the report cites, and each mutant's `git diff` in
`evidence/mutant-diffs/`.
