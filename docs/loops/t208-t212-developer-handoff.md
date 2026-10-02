# T-208 + T-212: developer handoff

**By:** Forge (developer seat, `sia-forge`, Claude Sonnet 5.5), 2026-10-02. **Dispatch:** `docs/loops/session-157-dev-dispatches.md` (sia-forge section), base `origin/master` `79d1f5d9`. **Job class:** LIGHT (touched test files and `tsc --noEmit` only). Merged nothing; one PR per branch; no issue or comment.

| Branch | Code commit | Notes |
| --- | --- | --- |
| `loop/t208-fetch-first` | `e442b955` | T-208 |
| `loop/t212-trailer-attribution` | `626f7d13` (code) and the tip, which adds this handoff and the mutant diff | stacked on T-208; carries `e442b955` |

Files touched: `pipelines/session-start/tree-currency.ts`, `cli-bootstrap.ts`, `shared/handoff-guard.ts`, plus `cli-session-end.ts` (the one caller of `checkSessionHandoff`; one line, outside the dispatch's file list because the new argument has to be passed there). Nothing in `state-render.ts`.

## T-208: the hook fetches before it judges currency

- `tree-currency.ts`: `fetchOrigin(projectRoot, timeoutMs = 15000)` runs `git fetch --prune origin` with `spawnSync`, a timeout, `SIGKILL` and `GIT_TERMINAL_PROMPT=0`; it never throws and returns `{ ok, at, cause }`. `describeTreeCurrency(root, { fetch })`: on a failed fetch the first line is `fetch FAILED: <cause>; currency is against a fetch from <time>`, and a `current` verdict is replaced by "no difference seen ... as of that old fetch, and not confirmed since", so the word `level` never appears after a failure. Without `fetch` (ob_start, `/sync`) nothing changes, and ob_start's existing line still states the fetch time it compared against.
- `cli-bootstrap.ts`: one call, `describeTreeCurrency(cwd, { fetch: fetchOrigin(cwd) })`, before the currency lines are computed. The hook is registered without a matcher, so startup and resume run this same code. No fetch step went into `/start`.
- Tests `tests/pipelines/session-start/tree-currency-fetch.test.ts`, 7 rows, all on local-path origins (no network), the first six through the real hook entry point:
  - row 1 + 6, startup and resume: origin moved after the last fetch; output has `THIS TREE IS STALE: 1 commit behind origin/master` and no `level with`.
  - row 2: origin URL pointing nowhere; the `fetch FAILED:` line ends with an ISO time (the old fetch), and `level with` is absent.
  - row 3: `remote.origin.uploadpack` pointing at a node script that sleeps; `fetchOrigin(clone, 1500)` returns in under 15 s with `timed out after 1500 ms`, and the lines lead with the FAILED line.
  - row 5 + 6, startup and resume: a branch deleted on the origin is absent from `git branch -r` after the hook ran.
  - a successful fetch leaves the lines as they were.
- **Red** (the same test file against the pre-change `open-brain/src`): 7 failed: rows 1 and 5 for both events (`expected ... to contain 'THIS TREE IS STALE: 1 commit behind o...'`, `expected 'origin/HEAD -> origin/master ...' not to contain 'origin/feature'`), row 2 (no FAILED line), row 3 and the success row (`fetchOrigin is not a function`). **Green:** 7 passed.
- **Row 4, the skip-fetch mutant** (`docs/loops/t208/mutants/skip-fetch.diff`, `fetch: fetchOrigin(cwd)` replaced by `{}`): `tsc --noEmit` 0; red on 5 of 7 (rows 1, 2 and 5, startup and resume as applicable).
- Known limit, stated: `SIGKILL` reaches `git`, not a helper it spawned. In the hang row a fake `upload-pack` outlived the kill by a few seconds on Windows and held the clone directory, so that file's `afterEach` retries removal with an async loop.

## T-212: attribution by the Claude-Session trailer

- `handoff-guard.ts`: `checkSessionHandoff(dir, since, sessionIds)` reads each commit's `Claude-Session` trailer in the window. A trailer containing one of this session's ids counts; a trailer naming another session is ignored; **no trailer is UNATTRIBUTED** (counted in the new `unattributed` field, never for any seat, and a handoff counts only if an attributed commit added it). `sessionIdsFromTranscript(path)` finds the id: the transcript's `bridge-session` line carries `bridgeSessionId: cse_<X>` and the trailer URL is `.../session_<X>` (checked on this session's transcript). With no id the status is `unknown` with a reason, never a pass and never an identity guess.
- `cli-session-end.ts` passes the ids; when nothing is attributed its line says how many loop commits were UNATTRIBUTED.
- Tests (`tests/shared/handoff-guard.test.ts`; 17 passed; the old rows now commit with this session's trailer by default):
  - row 1: two seats share git identity `Aaron Melven`, commits with no trailer: `no-work`, `commits 0`, `unattributed 2`.
  - row 2: a trailer for another session is not counted. Row 3: this session's trailer is counted, mixed with another's and an untrailered one (`commits 1`, `unattributed 1`).
  - Also: another seat's handoff does not cover this session's work; no session id gives `unknown`; the id is read from the `bridge-session` line.
- **Red** (the same file against the pre-change source): 6 failed, row 1 as `expected 'missing' to be 'no-work'` (the blame on this seat), row 2 the same, row 3 `expected 3 to be 1`, plus the handoff-cover, `unknown` and `sessionIdsFromTranscript is not a function` rows. **Green:** 17 passed.
- **Mutant** (`docs/loops/t212/mutants/identity-fallback.diff`: an untrailered commit counts when its author equals `git config user.name`): `tsc --noEmit` 0; **red on row 1 only** (16 passed, 1 failed).
- Consequence to know: a session that commits without the `Claude-Session` trailer, or runs where the transcript has no `bridge-session` line (for example Cursor), is now `unknown` or reported UNATTRIBUTED, not warned about as missing a handoff.

## Runs

`tsc --noEmit` 0. Touched files: `handoff-guard`, `cli-bootstrap`, `tree-currency-fetch`, `tree-currency` (50 passed together); also `tests/pipelines/sync` (26 files) passed once, run before the T-212 change. Not run: the full suite (CI), `/sync` (stale local build here).

## T-221

If #274 is still unmerged, the push and PR runs of each branch may cancel each other; ask atlas-sia to re-run.
