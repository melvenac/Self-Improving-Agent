# QA 277, session-161 batch e: seven PRs (QA 278 = #427 r3's real-Windows rows)

**By:** Atlas (planner), 2026-10-04, record session 161, after ruling QA 275 (`origin/qa/s161c-report` @ `2dc5f114`)
and QA 276 (`origin/qa/s161d-report` @ `84aef34c`). Plumb launch requested through clark.

**Merge authority:** none pre-approved. An ACCEPT waits for one batch approval from Aaron, through clark.

**Builder model (G-055).** The QA PC's Cursor default was `grok-4.7-high` from about 05:40 CDT, so every PR below
was most likely built by Grok, not composer-2.5. Where the seat named it from `store.db`, the PR body says so. QA is
Opus, so builder ≠ judge holds. Record the stated model per PR in your report; do not read `store.db` yourself.

**Two jobs, one dispatch.**
- **QA 277 on Plumb** (Linux): every row except **[W]**. Prefix `s161e`. Helper `docs/loops/qa-277/push-qa.mjs`.
- **QA 278 on the laptop** (real Windows: Git Bash and PowerShell 5.1): the **[W]** rows plus rows 1 and 4 for #427
  only. Prefix `s161f`. Helper `docs/loops/qa-278/push-qa.mjs`. Take `machine-lease.ps1` **with `-File`** (G-054).

**LIGHT** (both): touched test files, one test file per vitest invocation, mutants on touched files only,
`tsc --noEmit`, `npm run typecheck:tests`, `gh` reads. Nothing against the real home directory or a live record. Set
`npm_config_cache` (and on Windows `TMP`/`TEMP`) under your tmp folder.

**No batch-merge row.** #421, #424 and #436 are waiting for Aaron's merge, so this batch's merge base is still
moving. It comes as an amendment if needed.

**Pinned heads (CI `test` green on each, read by the planner):**

| PR | Task | Head | CI run |
|---|---|---|---|
| #427 | T-235 P2-3 r3: the win32 table load fails closed | `a6d75b5273091d75bbc127826853170fe3ddeb4a` | 37196905886 |
| #441 | G-052: default-path rows (tests only) | `48bf479562296a0f4c717fb91cc0fec92f11ed86` | 37196154799 |
| #442 | G-050: retirements allowlist by line hash | `08fa900211547aade6538792c88feab037ba23f8` | 37196540448 |
| #444 | T-168: suite meta from hub presence and the lease | `a5f118192f3479ad35dd58aebb3d24510f0f24b4` | 37197465284 |
| #445 | T-156: planted positives and near-misses for source scans | `d292747f8ce5e9173edfc71e5feb3f249693b147` | 37197994785 |
| #446 | T-173: deterministic effort policy | `685b9fe931a08f31d59977c90fbbd06cb977588b` | 37198063161 |
| #451 | T-187: `/sync` rebuilds a stale GitNexus index | `1e8cba7c92d3639a17691e03700cd32a84b6711f` | 37199482861 |

## Rows for every PR

1. **Confined.** List the files beyond `origin/master`. Flag any file outside the task.
2. **Red then green.** New or changed test files against master's source (red) and the head (green); quote counts.
3. **Mutants.** Re-run one of the developer's mutants and write one of your own. `tsc --noEmit` on each; confirm the
   edit landed.
4. **CI (read only).** The `test` result and run id above, for the pinned head.

## #427 r3 (narrow: QA 275 and QA 276's F4)

5. `git diff 987901c9 a6d75b52` is limited to the table loader, its callers and their tests.
6. **F4 closed (Linux half).** Inject a failing table loader for each kind (spawn failure, timeout, non-zero exit,
   empty stdout, unparseable JSON, and a single JSON object instead of an array). In each case the hook prints a
   visible `Session proof NOT written: <reason>`, exits 0, and the server's `proveSession` returns `{id: null,
   reason}` and never throws. A mutant that removes the catch goes red.
7. **[W] F4 on real Windows (QA 278).** QA 276's `nops.mjs` repro: with `PATH` reduced so that `powershell.exe`
   cannot spawn, and the fixture host present, from both shells. r3 exits 0 with the visible reason and no proof; the
   server side returns a refusal. Then QA 276's legs C and D (no host) again. Report timings.

## #441 (G-052)

8. `paths.test.ts` pins `knowledgeV2Db`'s default location: QA 257's repoint mutant goes red.
   `vault-pollution.test.ts` exercises `obsidianVaultDir()` with no `vaultDir` and an injected home: a mutant to the
   default resolution goes red.

## #442 (G-050)

9. **Per-line hash.** A new matching line beside an allowed (hashed) line is an issue; a second identical copy of an
   allowed line is an issue (multiset); the T-215 dashboard `success_rate` mutant re-added beside an allowed line is
   caught.
10. **No automatic rehash.** `checkRetirements` and `/sync` never write `retirements.json` (hash before and after).
    The CLI without `--write` changes no file. A mutant that rehashes inside the check goes red.
11. **Migration commit.** The `retirements.json` migration is its own commit; diff it alone and confirm each new
    `line_hashes` entry matches a line in the named file at that commit.
12. Name every hunk outside `checkRetirements` and its helpers (#424 also edits `checks.ts`).

## #444 (T-168)

13. **Census, never idle.** No key, an HTTP failure, an empty roster on both samples, or a body without
    `seat.seatState` records `census unavailable: <reason>`, never idle. Two samples are taken.
14. **D-034.** A foreign `working` seat is recorded and the run continues; `OPEN_BRAIN_CONTROLLED_RERUN=1` refuses on a
    working SIA or waker seat or an unavailable census. A lease `take` exit 10 refuses.
15. **Key resolution** matches `hub-presence.ts` (key dir layout, `KEY_FLOOR`), without importing session-start code.
16. **The default `--owner-pid` is `process.ppid`** (npm, usually). D-119 names the cursor-agent host for Cursor and
    the `claude.exe` session for Claude Code. Rule on it: is a ppid owner safe (its lease dies with npm), or does it
    break D-119? Propose the fix if it breaks it.
17. The meta file carries `vitest.passed`, `failed`, `errors` and `exit_code` separately (G-042). `docs/loops/
    t168-suite-meta.md` holds no key or token.
18. `ci.yml` changes only add the meta writer step and an upload. Nothing else in the workflow changed.

## #445 (T-156)

19. `docs/loops/t156-scan-list.md` lists every source-text scan in `open-brain/tests`. Spot-check it with your own
    grep and report any scan it misses. For each scan the PR edits, a mutant that widens or narrows the pattern goes
    red. Say why `t048-r3`'s fallback scan was listed but not edited.

## #446 (T-173)

20. **Max over targets.** Each repair target contributes its matched rule's level, or the stage base when unmatched;
    effort is the max. R12 (a doc plus an unmatched source file gives high) and mutant M6 red.
21. **No dead option.** `ClaudeAdapterOptions.effort` is gone, or setting it throws; grep every caller.
22. The policy file is zod-validated, and its JSON Schema is drift-checked like the other policies; a missing
    `effort.json` throws and does not spawn.

## #451 (T-187)

23. **Read-back proof.** After an analyze, `lastCommit` must equal HEAD and both SHAs are named; an unchanged
    `lastCommit` or a non-zero exit is an issue. `sync --check` never spawns. No `.gitnexus` is a skip with a reason.
24. **FTS.** A `repair-fts` exit 1 or an FTS profile that is not full is an issue and never a pass.
25. Tests inject the runner: no row runs real `gitnexus`. The `checks.ts` hunk is the single call site.

## Rules (headless Claude Code)

- You are **QA 277** (prefix `s161e`) or **QA 278** (prefix `s161f`); the prompt's first line says which. Push ONLY
  your prefix's `qa/<prefix>-*` branches, only through your helper, run from your `qa27N-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config and key files report only counts, names, paths and hash match/no-match, never values (G-051).
- Commit `docs/loops/<prefix>-qa-report.md` on `qa/<prefix>-report`.
- One verdict per PR with its pinned SHA. The report's last line is exactly `QA-27N: REPORT COMPLETE`.
