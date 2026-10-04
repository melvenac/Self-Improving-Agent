# QA 277 report: session-161 batch e (prefix `s161e`), seven PRs

**By:** QA 277, headless Claude Code (Opus 5.5) on Plumb (Linux), record session 161, 2026-10-04.
**Dispatch:** `docs/loops/qa-277-s161e-dispatch.md` at `b5c19fa45228cbe070e0a52fe2e3c2d5615f771a`.
`git -C ~/qa-scratch/qa277-wt log -1 --format=%H` → `b5c19fa45228cbe070e0a52fe2e3c2d5615f771a`.
**Scope:** every row except the **[W]** rows (row 7 goes to QA 278 on Windows). There is no batch-merge row.
**Builder ≠ judge:** QA is Opus. Builder model per PR is recorded below. Every PR commit is co-authored by `Cursor <cursoragent@cursor.com>`, and only #451's body names a model.

## Verdicts

| PR | Task | Pinned head | CI `test` (run) | Verdict |
|---|---|---|---|---|
| #427 | T-235 P2-3 r3 | `a6d75b5273091d75bbc127826853170fe3ddeb4a` | success (37196905886) | **ACCEPT** (Linux half; row 7 is QA 278's) |
| #441 | G-052 | `48bf479562296a0f4c717fb91cc0fec92f11ed86` | success (37196154799) | **ACCEPT** |
| #442 | G-050 | `08fa900211547aade6538792c88feab037ba23f8` | success (37196540448) | **ACCEPT** |
| #444 | T-168 | `a5f118192f3479ad35dd58aebb3d24510f0f24b4` | success (37197465284) | **REJECT** (D-119 owner pid; lease exits 11 and 2 run HEAVY) |
| #445 | T-156 | `d292747f8ce5e9173edfc71e5feb3f249693b147` | success (37197994785) | **REJECT** (scan list misses at least 3 source scans) |
| #446 | T-173 | `685b9fe931a08f31d59977c90fbbd06cb977588b` | success (37198063161) | **ACCEPT** |
| #451 | T-187 | `1e8cba7c92d3639a17691e03700cd32a84b6711f` | success (37199482861) | **ACCEPT** |

## Method

- **Fetch:** `git fetch origin pull/<N>/head`. Every fetched head equals its pin, and `origin/master` = `b5c19fa4`.
- **Trees:** each PR at `~/qa-scratch/qa277-pr<N>`. Each base at `~/qa-scratch/qa277-base<N>` = `origin/master` `b5c19fa4`, which is "master's source" for the red-first rows.
- **Dependencies:** one `npm ci` in `qa277-wt/open-brain`, symlinked into every tree. `better-sqlite3` with FTS5 and `esbuild` load. Node v22.22.1. `TMPDIR=~/qa-tmp` and `npm_config_cache=~/qa-tmp/npm-cache`.
- **LIGHT only:**
  - one vitest file per invocation;
  - `tsc --noEmit` and `npm run typecheck:tests` on each head and each mutant;
  - mutants only on touched files, restored with `git checkout`.
- **Cleanup:** every tree ended with `git status --short` = only `?? open-brain/node_modules`, the symlink.
- **Agents:** the rows ran as seven per-PR subagents, in parallel. I re-checked the two blocking findings (#444 F1, #445 F1) against the source myself.
- **Row 4 (CI):** read with `gh run view <id> --json headSha,conclusion,jobs`. Every run is `pull_request`, its `headSha` equals the pin, `test`=success, `changed`=success and `test-windows`=skipped.
- **Not touched:** no live record, no real knowledge DB, no real hub call, no real `gitnexus`, no real lease, and no `gh` writes.

---

## #427: T-235 P2-3 r3, the win32 table load fails closed @ `a6d75b52`

**Row 1, confined: PASS.**
- 8 files, +644/−14: `docs/loops/t235-p2-3-r2-measure.md`, `src/cli-bootstrap.ts`, `src/server.ts`, `src/shared/process-session.ts`, `tests/fixtures-t003/cursor-agent/versions/e2e-fixture/index.js`, `tests/t003-r2.test.ts`, `tests/t003-session-proof.test.ts`, `tests/t235-p2-3-cursor-proof.test.ts`.
- All 8 are T-235 P2-3.
- `git merge-tree` against master is clean. `server.ts` is the only file both sides changed.

**Row 2, red then green: PASS.**

| Test file | Head (green) | Master source + PR tests (red) |
|---|---|---|
| `t235-p2-3-cursor-proof` | 11/11 | 10 failed / 1 passed |
| `t003-r2` | 9/9 | 1 failed (D5) |
| `t003-session-proof` | 18/18 | 1 failed |

- `tsc` and `typecheck:tests` exit 0 on the head.
- **Narrow red, r3's test file on r2 `987901c9`:** 4 failed / 7 passed. The 3 new r3 rows fail, and so does the e2e row on a 5 s vitest timeout, which looks like load flakiness.

**Row 3, mutants: PASS.** `tsc` exits 0 on each. All results are on `t235-p2-3-cursor-proof`.

| Mutant | Whose | Result |
|---|---|---|
| walk-disabled | developer's | killed, 4 red |
| no-loader-catch | dispatch row 6 | killed, 3 red |
| no-catch-anywhere (r2 shape): the hook exits 1 | own | killed, 3 red |
| array-only | own | killed, 1 red |
| empty-ok | own | killed, 1 red |
| swallow-reason | own | killed, 2 red |

**Row 4, CI:** `test` success, run 37196905886, `headSha` = pin.

**Row 5, r2→r3 diff confined: PASS.** `git diff 987901c9 a6d75b52` touches 3 files, +167/−41:
- `cli-bootstrap.ts`, the caller: `resolveCursorAgentHost` is now inside the existing `try`.
- `process-session.ts`:
  - `parseWin32ProcessTable`;
  - `loadWin32ProcessTable`, with an injectable runner and a catch;
  - `readWin32ProcessTableStdout`;
  - `resolveCursorAgentHost` returning `{pid, reason}`;
  - a `try/catch` around the walk in `proveSession`.
- `t235-p2-3-cursor-proof.test.ts`: 3 rows.

`server.ts` is untouched in r3.

**Row 6, F4 closed on the Linux half: PASS.**
- **What the PR's tests cover:** the loader unit row covers every kind. The hook and `proveSession` rows cover spawn failure only.
- **QA probe for every kind:**
  - Real loader path: `process.platform` forced to `win32`, and a fake `powershell.exe` on `PATH` (or none, for spawn failure).
  - The hook runs under the e2e fixture host.
  - The real `proveSession(…, {cursorWalk:true})` runs in a separate process.

| Kind | Hook output (exit 0, no proof file) | `proveSession` |
|---|---|---|
| spawn failure | `Session proof NOT written: Win32 process table: exit null: spawnSync powershell.exe ENOENT` | `{id:null, reason}`, no throw |
| timeout (fake sleeps 70 s) | `… ETIMEDOUT`; the hook took 64.9 s | `{id:null}` after 60.2 s |
| non-zero exit | `Win32 process table: exit 1: Command failed …` | `{id:null}` |
| empty stdout | `Win32 process table: empty stdout` | `{id:null}` |
| unparseable JSON | `Win32 process table: unparseable JSON (…)` | `{id:null}` |
| single object, not an array | parsed as a 1-row table → `no cursor-agent host process found in the hook's ancestor chain` | `{id:null}` |
| extra: `null` JSON / >1 MiB | `JSON is not an object or array` / `ENOBUFS` | `{id:null}` |
| positive control: real /proc table | `Session proof written … host process <fixture pid>` | n/a |

- **The same probe on r2 `987901c9`:** for spawn failure, non-zero exit, empty stdout and bad JSON, the hook **exits 1 with a stack trace and no proof line**, and `proveSession` **throws**. That is F4, reproduced and then closed by r3.
- **Catch-removal mutants:** red (row 3).

**Row 7 [W]:** not run here. It belongs to QA 278.

**Findings (none blocking):**
- **F1, medium-low.** The `OPEN_BRAIN_PROCESS_TABLE` env seam lives in production code.
  - `json:<table>` forged a table naming a live non-Cursor process (`/bin/bash`) as the host. The hook then wrote `by-pid/<bash pid>.json`.
  - Any other value makes Linux shell out to `powershell.exe`.
  - This adds no new capability, since an agent can already write by-pid. Still, the seam is undocumented. Confine it to tests: the injectable `loadTable` parameter already exists.
- **F2, coverage.** At hook and `proveSession` level, the PR's tests cover spawn failure only. QA's probe covers the other kinds.
- **F3, note.** `maxBuffer` was not raised: more than 1 MiB now fails closed (ENOBUFS) rather than writing a proof. A hung CIM query blocks SessionStart for about 60 s. QA 278 should measure the real JSON size and timings.
- **F4, nit.** The reason reads `exit null:` for spawn failure, timeout and ENOBUFS.

**Builder model:** the body names none. Per G-055, probably grok-4.7-high.

**#427 VERDICT (Linux half): ACCEPT @ `a6d75b5273091d75bbc127826853170fe3ddeb4a`.** The full #427 verdict also needs QA 278's row 7.

---

## #441: G-052, default-path rows (tests only) @ `48bf4795`

**Row 1, confined: PASS.**
- One commit, 2 files, +65/−0: `tests/shared/paths.test.ts` (+25) and `tests/pipelines/sync/vault-pollution.test.ts` (+40).
- No source changes.
- The PR is based on `bbea9698`. The relevant source and setup files are identical between that commit and master.

**Row 2, red then green: PASS. As expected for a tests-only PR, master is green.**
- On master's source, the head's tests pass: `paths` 14 passed, 1 skipped (a Windows-only row); `vault-pollution` 6/6.
- The meaningful red is the mutants in row 3.
- **Contrast:** QA 257's repoint mutant applied to master **survives master's own** `paths.test.ts` (13 passed, 1 skipped). That reproduces the gap this PR closes.
- On the head, `tsc` and `typecheck:tests` exit 0.

**Row 3, mutants: PASS.** All killed, and `tsc` exits 0 on each.

| Mutant | Whose | Change | Result |
|---|---|---|---|
| M1 | QA 257's repoint (named in the body) | `knowledgeV2Db` default → `~/.claude/context-mode/knowledge.db` | `paths` 1 red |
| M2 | own | drop `.claude` | 1 red |
| M3 | own | `Obsidian Vault v2` → `Obsidian Vault` | `vault-pollution` 1 red (VP-6) |
| M4 | own | default `home = process.cwd()` | 1 red |
| M5 | own | `vaultDir ?? obsidianVaultDir(tmpdir())` | 1 red |

**Row 4, CI:** `test` success, run 37196154799.

**Row 8: PASS.**
- **`paths.test.ts`:** clears `KNOWLEDGE_V2_DB`, injects `HOME` and `USERPROFILE` as a mkdtemp folder, and pins the exact path with `toBe`. QA 257's mutant (from `origin/qa/b3-misc-report`) goes red.
- **VP-6:** calls `checkVaultPollution` with no `vaultDir`, an injected home, and `OPEN_BRAIN_VAULT_DIR` deleted. Three default-resolution mutants go red.
- **Real home never touched:** a temporary log line showed VP-6 resolving to `~/qa-tmp/t042-g052-home-*/Obsidian Vault v2`.

**Findings:**
- **F1, note.** VP-6 deletes `VITEST` and `VITEST_WORKER_ID` to get past the real-vault guard, so for the duration of that test only the home injection protects the real vault. The values are restored in `finally`, and the scan only reads. A `home` parameter on `checkVaultPollution` would be safer.
- **F2, note.** The branch is behind master, but none of the relevant files have drifted.

**Builder model:** none named. Probably Grok.

**#441 VERDICT: ACCEPT @ `48bf479562296a0f4c717fb91cc0fec92f11ed86`.**

---

## #442: G-050, retirements allowlist by line hash @ `08fa9002`

**Row 1, confined: PASS.**
- 3 commits: `9336b2ec` (code), `7aa2820b` (migration), `08fa9002` (usage and message).
- 8 files: `.agents/retirements.json`, `src/cli-spec.ts`, `src/cli.ts`, `src/pipelines/sync/checks.ts`, new `src/pipelines/sync/retirements-line-hash.ts`, `tests/pipelines/sync/checks.test.ts`, new `tests/pipelines/sync/retirements-rehash.test.ts`, `tests/pipelines/sync/t048-counts-parity.test.ts`.
- All 8 are in the task.

**Row 2, red then green: PASS.**
- **Head:**
  - `checks` 105/105, `retirements-rehash` 2/2, `t048-counts-parity` 7/7.
  - Also green: `retirements-live` 2/2, `t048-unreadable` 14/14, `t048-r1b` 8/8.
  - `tsc` and `typecheck:tests` exit 0.
- **Master with the tests only:** the import fails to load.
- **Master with the tests plus the new helper, keeping master's `checks.ts`:**
  - `checks` 3 failed / 102 passed: the two G-050 "is an issue" rows and "never writes".
  - `t048-counts-parity` 1 failed.
  - `rehash` 2/2. That is expected, because it exercises only the new module.

**Row 3, mutants: PASS. One gap, which is F1.**
- **M-A, the developer's in-check rehash:** `checks` 3 red. Killed.
- **M-B, own, multiset collapsed to a set:** the **PR suite stays fully green**. QA's row-9 fixtures kill it (3 cases flip from issue to pass).

**Row 4, CI:** `test` success, run 37196540448.

**Row 9, per-line hash: PASS on behaviour.** QA fixtures (`row9.mts`, 10 cases): the head is correct in 10/10 and master is wrong in 8/10.

| Case | Head | Master |
|---|---|---|
| New, different matching line beside an allowed line | issue | pass |
| Identical second copy (multiset) | issue: `duplicate … (2 live, 1 allowed)` | pass |
| Re-indented copy | issue | pass |
| 3 copies present, 2 allowed | issue | pass |
| T-215 `success_rate` line beside an allowed line | issue | pass |
| Allowed line edited in place | issue | pass |

On the live PR tree:
- T-215 line inserted next to allowed `src/lifecycle.ts:56`: issue (`new matching line hash f14e8f88a0c3…`). The same edit on master passes.
- Line 56 duplicated: issue.
- `docs/loops/t215/mutants/dashboard-success-rate.diff` applied as-is: issue.
- Clean tree: pass, 75 referrers checked.

**Row 10, no automatic rehash: PASS.**
- The CLI ran with `HOME` and `KNOWLEDGE_V2_DB` in qa-tmp.
- The `retirements.json` sha256 is unchanged after each of `sync --check`, plain `sync`, `sync --retirements-rehash` (no `--write`, prints "dry run — no file written") and `sync --check --write`, on both a clean and a drifted tree. `git status` stayed clean.
- M-A (rehash inside the check) is red.

**Row 11, migration commit: PASS.**
- `7aa2820b` touches only `.agents/retirements.json` (+378/−75).
- Strip `line_hashes` and the new `$rehash_note` and the record is identical to its parent.
- All 152 entries across 75 referrers were recomputed with the PR's hashing function at that commit, plus an independent recomputation. **152/152 match a line** in the named file, and each list equals what the function produces.
- The hashes also still hold against current master `b5c19fa4`: 0 referrers broken.

**Row 12, hunks outside `checkRetirements`:**
- `checks.ts` L15: the import.
- `checks.ts` L1773: `RetirementRecord.allowed_referrers` gains `line_hashes?: string[]`.
- `cli-spec.ts` L13: the sync spec accepts `--retirements-rehash` and `--write`.
- `cli.ts` L81–85: rehash dispatch before `--history` and `runSync`.
- `cli.ts` L642: the usage line.
- The new module.
- Every other `checks.ts` hunk is inside `checkRetirements`.

**Overlap with #424** (read-only diff, head `b9026d71`):
- Its only `checks.ts` hunk is `CURSOR_COMMAND_SET` at L34–48.
- `git apply --check` onto #442 is clean, and the retirements check still passes.
- None of #424's changed lines match a retirement pattern, so it needs no rehash.

**Findings:**
- **F1, non-blocking, test coverage.** No PR test pins the multiset rule: M-B, with set semantics, passes the PR suite. Add an identical-second-copy row.
- **F2, note.** A referrer with no `line_hashes` whose file still matches is reported as "unexpected". The "run `--retirements-rehash --write`" hint is effectively unreachable.
- **F3, note.** `--write` without `--retirements-rehash` is accepted silently and does nothing.
- **F4, note.** `allowedPairsNotScanned` and its comment are now redundant.

**Builder model:** none named ("Made with Cursor"). Probably Grok.

**#442 VERDICT: ACCEPT @ `08fa900211547aade6538792c88feab037ba23f8`.**

---

## #444: T-168, suite meta from hub presence and the lease @ `a5f11819`

**Row 1, confined: PASS.**
- 2 commits, 8 files, +870/−0: `ci.yml`, `docs/loops/t168-suite-meta.md`, `open-brain/package.json` (the `test:heavy` script), `scripts/write-ci-suite-meta.mjs`, `src/{cli-suite-run,suite-census,suite-run-meta}.ts`, `tests/suite-run-meta.test.ts`.

**Row 2, red then green: PASS.**
- Head: 14/14. `tsc` and `typecheck:tests` exit 0.
- Master: the file fails to load (`Cannot find module '../src/suite-census.js'`). All the source under test is new.

**Row 3, mutants: the developer's mutant is killed, and five of QA's survive.** All mutants are `tsc`-clean.

| Mutant | Whose | Change | Result |
|---|---|---|---|
| M1 | developer's | fall back to top-level `row.state` | red |
| M3 | own | one sample | red |
| M4 | own | lease refusal on `=== 11` | red |
| M8 | own | every working seat counts as busy | red |
| M9 | own | `exit_code` derived from the failed count | red |
| M10 | own | both samples empty treated as available | red |
| M2 | own | controlled rerun does not refuse on an unavailable census | **survives** |
| M5 | own | `!res.ok` check deleted | **survives** |
| M6 | own | `KEY_FLOOR = 0` | **survives** |
| M7 | own | key dir `.a2a` | **survives** |
| M11 | own | CLI passes `leaseExit: 0` | **survives** |

**Row 4, CI:** `test` success, run 37197465284.

**Row 13, census never idle: holds on behaviour, and two inputs are untested.** QA probe with injected fetch:
- **No key** (no path, missing file, a 31-character key): `census unavailable`, 0 fetches.
- **HTTP failure** (403, 500, or 403 with a valid body), ECONNREFUSED, abort, and non-JSON with status 200: unavailable, 2 fetches.
- **Empty on both samples:** `census unavailable: empty roster on both samples (not idle)`.
- **No `seat.seatState`:** `census unavailable: presence body has no seat.seatState`.
- **Second sample:** a working seat seen only in the second sample is caught.
- **Untested:** the HTTP status check and an unavailable census refusing a controlled rerun are not pinned (M5 and M2 survive).

**Row 14, D-034: holds as worded.**
- A foreign working seat is recorded and the run continues.
- With the controlled rerun set:
  - forge working: exit 2;
  - `cursor-infra-waker` working: exit 2;
  - unavailable census: exit 2.
- **Lease exit 10:** exit 2 and `lease_status=held`, and vitest is not run.
- **But** lease exit **11** (malformed, which the helper counts as HELD) and exit **2** (owner unreadable, no lease taken) both **exit 0 and run the suite**. That is F2.

**Row 15, key resolution: holds.**
- **The same as `src/pipelines/session-start/hub-presence.ts`:**
  - `hubIdForUrl`, the `<keyDir>/<hubId>/<name>.key` layout and the `~/.a2a-hub/keys` default;
  - trim and `KEY_FLOOR = 32`;
  - the `X-Agent-Key` header and the presence path.
- **Imports:** only node built-ins and the PR's own modules. Nothing from session-start.
- **Minor differences:** empty `A2A_KEY_DIR` handling, the trailing-slash regex, no `Accept` header, and the seat key name, which is F5.
- **Not pinned:** `KEY_FLOOR` and the layout (M6 and M7 survive).

**Row 16, default `--owner-pid` = `process.ppid`: breaks D-119.**
- **Code:** `cli-suite-run.ts:119`: `const ownerPid = arg("--owner-pid") ?? String(process.ppid);`.
- **Measured** under `npm run test:heavy`: `process.ppid` is the **tsx CLI node process**. Not npm, not cursor-agent, not `claude.exe`.
- **Partly safe:** the owner lives exactly as long as the run, so a crash leaves a `pid_gone` lease that can be reclaimed.
- **Why it breaks D-119** (`docs/loops/qa-launch.md` §"Calling machine-lease.ps1"):
  1. There is no ancestor resolution to the cursor-agent host or the `claude.exe` session, and no fail-closed when none is found. D-119 says no owner means no lease and no HEAVY run.
  2. `take` is not reentrant: a live lease returns 10 to any caller. A seat that holds the lease under D-118/D-119 and then runs `npm run test:heavy` is refused. The only working path is to skip D-119.
  3. The meta records neither `owner_pid` nor the release exit, so the seat cannot `status` or `renew` the lease or report it.
- **Proposed fix:**
  - (a) Resolve the default owner per D-119: walk ancestors with one CIM query, taking the first cursor-agent host, or the `claude.exe` session under Claude Code.
  - (b) If there is no owner and no `--owner-pid`, refuse non-zero with a reason in the meta. Never fall back to `process.ppid`.
  - (c) Refuse on any take exit other than 0, not just 10. On win32, a missing helper refuses unless an explicit opt-out is set.
  - (d) If `status` shows the lease held by the same resolved owner, run without take or release.
  - (e) Record `owner_pid`, `owner_source`, `lease_take_exit` and `lease_release_exit` in the meta.
  - (f) Add tests with injected ancestry: ppid is never chosen, no ancestor refuses, and exits 11 and 2 refuse.

**Row 17, meta fields and doc: PASS, with F3.**
- `vitest.{passed, failed, errors, exit_code}` are separate keys. R7 and the G-042 row pin them, and M9 is red.
- `docs/loops/t168-suite-meta.md` holds no key or token value: only a key path pattern, the hub IP (already in the source) and a redacted roster.

**Row 18, `ci.yml`: PASS.**
- One hunk, +18/−0: the `Write CI suite meta` step (`if: always()`, `GITHUB_TOKEN`) and `Upload suite run meta` (`actions/upload-artifact@v4`).
- Nothing else in the workflow changed.

**Findings:**
- **F1, BLOCKING.** The default `--owner-pid` = `process.ppid`, which is the tsx wrapper. This breaks D-119, as set out in row 16. Re-checked by QA lead against `cli-suite-run.ts:119` and `qa-launch.md:48-51`.
- **F2, BLOCKING, same fix.** The CLI refuses only on take exit 10. Exit 11 (malformed, counted as held) and exit 2 (no lease) run the HEAVY suite. A missing win32 helper runs silently with `lease_status=skipped`. Re-checked: `cli-suite-run.ts:120-161` passes `leaseExit` to `decideSuiteStart`, and only 10 refuses.
- **F3, non-blocking.** `vitest.errors` reads `unhandledErrors`, which the vitest 3.2.4 JSON reporter does not emit, so a real run always records `errors: 0` (a false zero). It should be `null`, or come from another source.
- **F4, non-blocking.** Test gaps: M2, M5, M6, M7 and M11 survive. The CLI fixture path re-implements the census merge, so `readCensus` is never exercised end to end.
- **F5, non-blocking.** The seat and key name default to a hard-coded `cursor-builder`.
- **F6, note.** The CI meta's `concurrent_jobs` is the run's total job count, and its vitest fields are null.
- **F7, note.** A foreign `-waker` also refuses a controlled rerun. That matches the doc but is broader than SIA.
- **F8, note.** "Empty, then HTTP 500" is reported as "empty roster on both samples".

**Builder model:** none named. Probably Grok.

**#444 VERDICT: REJECT @ `a5f118192f3479ad35dd58aebb3d24510f0f24b4`.** Row 16 breaks D-119, and the lease exit handling (F2) runs HEAVY without a lease.

---

## #445: T-156, planted positives and near-misses for source scans @ `d292747f`

**Row 1, confined: PASS.**
- 1 commit, 5 files, +75/−3: `docs/loops/t156-scan-list.md`, `tests/harness/s4-g5-qa.test.ts`, `tests/pipelines/sync/probe-markers.test.ts`, `tests/pipelines/sync/worktree-layout.test.ts`, `tests/t048-r2b.test.ts`.
- No source changes.

**Row 2, red then green: holds for 3 of the 4 edited scans.**
- **Head:** `s4-g5-qa` 22/22, `probe-markers` 5/5, `worktree-layout` 6/6, `t048-r2b` 7/7. `tsc` and `typecheck:tests` exit 0.
- **On master's source:** the same counts. That is expected for a tests-only PR.
- **Red-first with a source mutant in base:** the calls to `checkWorktreeLayout`, `checkProbeMarkers` and `formatScoreCategoryLine(cat)` were commented out.
  - PR's `probe-markers`: 1 red. PR's `worktree-layout`: 1 red. **PR's `t048-r2b`: still 7/7 green** (F2).
  - Master's tests stay green on the same mutant, which is the false pass the PR fixes for 2 of the 3 scans.
- **s4-g5-qa:** M1 on base with master's test is green. With the PR's test it is 2 red.

**Row 3, mutants: every widen and narrow pattern mutant is red.** `tsc` exits 0 on each.

| Mutant | Scan | Change | Result |
|---|---|---|---|
| M1 | `threshold-scan` | widen: drop the `//` strip | 2 red |
| M2 | `threshold-scan` | narrow: `\d+\.\d\d+` | 2 red |
| M3 | `probe-markers` | widen | 1 red |
| M4 | `probe-markers` | narrow | 1 red |
| M5 | `worktree-layout` | widen | 1 red |
| M6 | `worktree-layout` | narrow | 1 red |
| M7 | `t048-r2b` | widen | 1 red |
| M8 | `t048-r2b` | narrow | 1 red |
| M9 (own, source) | `t048-r2b` | `// console.log(formatScoreCategoryLine(cat));` | **survives**: the import on `cli.ts:13` still matches |
| M11 (own, source) | `probe-markers` | `/* checks.push(checkProbeMarkers(...)); */` | **survives**: the guard skips `//` and `*` but not `/*` |

**Row 4, CI:** `test` success, run 37197994785.

**Row 19, the scan list: FAILS on completeness.**
- **Source scans missing from `docs/loops/t156-scan-list.md`, none with a planted pair** (re-checked by QA lead):
  - `open-brain/tests/harness/shadow-merge.test.ts:314-339` (CC-0, CC-19): reads `src/harness/runtime.ts`, `schema.ts`, `declared.ts` and `cli.ts`, and asserts with `toContain` / `not.toContain`.
  - `open-brain/tests/t048-r2b.test.ts:194-205` (D4): reads `src/pipelines/session-end/invocation-logger.ts`. This is in a file the PR edited, and the list cites only `:98`.
  - `open-brain/tests/pipelines/bootstrap-fix-r4.test.ts:137-143` (R-BF-21): `git grep OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK -- open-brain/src`, absence only.
- **Scans that have a pair but are unlisted:**
  - `harness/checks.test.ts:141-160` (shell scan over `src/harness`, pairs at `:124-138`);
  - `harness/s4-g2-key.test.ts:236-241`.
- **Borderline (they read repo markdown, not code):** `briefing.test.ts:589-601`, `no-standing-cron.test.ts:65-73`, `start-legend.test.ts:15-31`, `start-parity.test.ts:74+`. The list should rule on whether markdown counts as source.
- **Why `t048-r3`'s fallback was not edited:** the scan at `t048-r3.test.ts:116` runs only when `handleRecall` is missing. `src/server.ts:902` exports it. QA mutant M10 throws inside that branch, and `t048-r3` stays 5/5 green, so the branch is dead in the suite. The stated reason holds.

**Findings:**
- **F1, BLOCKING.** The list does not hold "every source-text scan": it misses the three `src` scans above, none of which is in a deferred PR. The acceptance was a named, complete list.
- **F2, non-blocking but substantive.** The edited `t048-r2b` scan cannot tell the call from the import (M9 survives). Match a call on a non-import, non-comment line.
- **F3, note.** The `probe-markers` and `worktree-layout` guards miss a one-line `/* … */` (M11 survives).
- **F4, note.** The list attributes the audit's `checks.test.ts:124` to `pipelines/sync/checks.test.ts` (#442). It is `harness/checks.test.ts`.
- **F5, note.** It should rule explicitly on the markdown scans.

**Builder model:** none named. Probably Grok.

**#445 VERDICT: REJECT @ `d292747f8ce5e9173edfc71e5feb3f249693b147`.** Row 19 fails: the scan list is incomplete.

---

## #446: T-173, deterministic effort policy @ `685b9fe9`

**Row 1, confined: PASS.**
- 1 commit, 9 files, +567/−13: `src/harness/{cli,index,policies,roles}.ts`, `policies/effort.json` (new), `schemas/policy-effort.schema.json` (new), `tests/harness/effort-policy.test.ts` (new), `policies.test.ts` (+1 row), `s4-guards.test.ts`.
- The `s4-guards` edit is required, because S4-5c.1 pinned the list of added policies.

**Row 2, red then green: PASS.**
- **Head:** `effort-policy` 14/14, `policies` 28/28, `s4-guards` 14/14, `process-role` 22 passed, 2 skipped. `tsc` and `typecheck:tests` exit 0.
- **Master:**
  - `effort-policy` 14/14 red;
  - `policies` 1 red (ENOENT schema);
  - `s4-guards` 2 red: S4-5c.1, plus D1b, a side effect of the untracked copied file.

**Row 3, mutants: PASS.** `tsc` exits 0 on each.
- **Developer's M6,** rebuilt because the body does not show the edit: an unmatched target contributes `levels[0]` instead of the stage base. R12 red: `expected 'medium' to be 'high'`.
- **Own Q1,** max turned into min: 2 red (R5, R12).
- **Own Q2,** zod `retry` widened with no schema regeneration: red in both `policies` and `effort-policy`.

**Row 4, CI:** `test` success, run 37198063161.

**Row 20, max over targets: PASS.**
- `chooseEffort`: each target contributes its best matching rule, or the stage base when unmatched. An empty target list contributes the stage base. The result is the maximum on the ladder, and a retry moves one step up.
- R12 (`docs/x.md` + `open-brain/src/foo.ts` gives `high`) is green on the head and red on master.
- M6 and Q1 are red.

**Row 21, no dead option: PASS.**
- `effort?` is removed from `ClaudeAdapterOptions`, along with its push.
- `--effort` is always passed from the policy. An empty value throws (R10).
- **Grep across src, tests and scripts:** the only callers are `process-role.test.ts:316`, R10 and `roles.ts:518`.
- **Type probe:** `claudeAdapter({effort:"low"})` gives TS2353.

**Row 22, zod, drift check, missing file: PASS.**
- **Zod:** `EffortPolicySchema` is strict with a `superRefine`. A failure throws `PolicyUnreadable`.
- **Drift check:**
  - The shared drift `it.each` in `policies.test.ts` now includes effort.
  - `cli.ts schemas --write` on a clean head leaves git clean.
  - Q2 is red.
- **Missing file:** with the real `effort.json` moved away, `ProcessRole("developer")` on the default policies dir throws `PolicyUnreadable: policy file missing`, and the spawn marker is absent. Restored, it spawns. R9 covers this in the suite.

**Findings (notes):**
- **F1.** The policy loads in `execute()`, not `preflight()`. It still never spawns, but it refuses later than it could.
- **F2.** `args` rejects only `""`.
- **F3.** A plain-JS `{effort}` caller is silently ignored. None exists.
- **F4.** The body names mutants M1–M6 but does not show the edits.

**Builder model:** none named. Probably Grok.

**#446 VERDICT: ACCEPT @ `685b9fe931a08f31d59977c90fbbd06cb977588b`.**

---

## #451: T-187, `/sync` rebuilds a stale GitNexus index @ `1e8cba7c`

**Row 1, confined: PASS.**
- 4 files, +445/−2: `checks.ts` (+13/−1), `gitnexus-refresh.ts` (new), `index.ts` (1 line), `gitnexus-refresh.test.ts` (new).

**Row 2, red then green: PASS.**
- Head: 13/13. `tsc` and `typecheck:tests` exit 0.
- Master with the test only: the file fails to load.
- Master with the module added but not wired: 8 failed / 5 passed.

**Row 3, mutants: PASS.** All are `tsc`-clean. Each ran against the PR test file and QA's own temporary file (Q1–Q8, since deleted).

| Mutant | Whose | Change | PR tests | QA file |
|---|---|---|---|---|
| M3 | developer's | non-zero analyze treated as success | R4 red | red |
| A | dispatch | drop `lastCommit === HEAD` | R5 red | red |
| B | dispatch | check mode spawns | R2, R7, R8 red | red |
| C | dispatch | repair-fts exit 1 treated as pass | R6 red | red |
| D | own | plain-mode `ftsProfile` gate removed | R10 red | n/a |
| E | own | `index.ts` always non-check | red on the source-text row only | Q7 red (behavioural) |

**Row 4, CI:** `test` success, run 37199482861.

**Row 23, read-back proof: PASS.**
- **Success** names both SHAs and HEAD: "index rebuilt: lastCommit was X, now Y, HEAD Z".
- **Each of these is an issue naming both SHAs:**
  - non-zero analyze: R4, and Q3 at exit 2;
  - unchanged `lastCommit`: R5;
  - `lastCommit` moved to a commit that is not HEAD: Q2.
- **`--check` never spawns:**
  - R2, R7 and R8 record no runner calls.
  - Q7 used the default runner with `spawnSync` mocked: 0 gitnexus spawns.
  - Q8 shows plain sync does reach the default runner, which was intercepted.
- **No `.gitnexus`:** a skip saying "not a pass" (R1, Q1).

**Row 24, FTS: PASS, with F1.**
- `repair-fts` exit 1 is an issue (R6, Q4).
- A profile of `off` or `none`, or a missing profile under `--check`, is an issue (R10, R7, Q5).

**Row 25, runner injected, single call site: PASS.**
- Every test row injects the runner. The only direct call is `defaultGitNexusRunner(["clean"])`, which refuses before it spawns.
- No other test spawns gitnexus. The plain `runSync` tests use fixtures with no `.gitnexus`.
- The new module's exports are used only by `checks.ts:15` and `:2125`.

**Findings:**
- **F1, non-blocking, for the planner to rule on.** Plain `/sync` passes an index with **no** `ftsProfile` once `repair-fts` exits 0, which R9 asserts. `--check` calls that same index an issue, so the two modes disagree.
- **F2, non-blocking.** `capture()`'s `spawnSync` has no timeout. `ob_sync` defaults to `check_only: false`, so a hung `npx gitnexus` blocks the MCP server. Plain `/sync` at HEAD also runs `analyze --repair-fts` every time, about 38 s.
- **F3, note.** Remove the clean guard and the clean-refusal test would spawn real `npx gitnexus clean`. That is a hazard for anyone running mutants.
- **F4, note.** The PR pins the `index.ts` wiring only by a source-text match. QA's behavioural Q7 confirms it.

**Builder model:** **grok-4.7-high**, stated in the PR body from store.db `modelName` (G-055).

**#451 VERDICT: ACCEPT @ `1e8cba7c92d3639a17691e03700cd32a84b6711f`.**

---

## Summary

- **ACCEPT:** #427 (Linux half), #441, #442, #446, #451.
- **REJECT:** #444 (D-119 owner pid, and lease exits 11 and 2) and #445 (incomplete scan list).
- The batch verdict is **REJECT**, because not all seven PRs pass.
- No merge was done or requested. An ACCEPT still waits on Aaron's batch approval.

QA-277: REPORT COMPLETE
