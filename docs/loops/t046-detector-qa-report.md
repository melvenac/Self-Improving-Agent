# T-046 (`cursor-hook-compat` detector): QA report, record session 197

**By:** the QA seat, record session 197, headless on the QA PC, in `~/Worktrees/sia-qa`, launched by
`docs/loops/qa-197/drive.ps1`. 2026-09-28 UTC (2026-09-27 local).
**Dispatch:** `docs/loops/t046-detector-dispatch-qa.md`. **Scored against:** record 194 in
`docs/loops/session-147-dispatches.md`.
**Candidate:** product `3af41f5` on `origin/loop/t046-detector` (tip `44d672a`, handoff only), base `bf33fe4`.
PR #192. Developer handoff: `docs/loops/t046-detector-developer-handoff.md`.
**Model:** Composer 2.5 (per dispatch).

## Verdict

**ACCEPT.** The `cursor-hook-compat` check detects a non-empty `PreToolUse` in an installed plugin's
`hooks/hooks.json` when Cursor CLI is present, names the plugin, version, matchers, T-046 and the remedy,
parses JSON rather than pattern-matching hook events, skips (never passes) when the registry or Cursor CLI is
absent, uses fixture homes in tests (G-044), is registered once in `runSync`, and leaves every other `/sync`
check's pre-existing outcome unchanged. Developer mutants and both QA mutants are killed by the test suite.
One low finding (D1): registry entries with a missing `installPath`, zero installs, or an absent `hooks.json`
yield **pass** without having read a hook file — acceptable for the incident shape but untested.

## 1. Rows (record 194 criteria)

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | **Detection** | **pass** | `cursor-hook-compat.test.ts` row 1: issue names `context-mode@context-mode`, `1.0.169`, matchers `Bash`/`Read`, `T-046`, remedy text, and LIMIT. Row 2: `PreToolUse` in description or as another event's matcher is **not** a finding (pass). Implementation uses `JSON.parse` + `hooks.PreToolUse` array length, not raw-text search. |
| 2 | **Skip is not pass** | **pass** (with D1 note) | Rows 3–5: no registry → skip + "not a pass"; no `cursor-agent` → skip + "not a pass" (both missing dir and `localAppData: null`); malformed registry or `hooks.json` → issue, never pass. Ad-hoc edge probes (§2): missing `installPath`, `[]` installs, absent `hooks.json` → pass without reading hooks — see D1. |
| 3 | **Fixture isolation (G-044)** | **pass** | Every test calls `fixture()` (temp under `os.tmpdir()`), passes `fx.home` and `fx.local` explicitly. `runSync` wiring row passes `home` and `localAppData` options. No test omits these and falls through to the real profile. |
| 4 | **The real machine** | **pass (skip is correct)** | After rebuild at `44d672a`, `node open-brain/build/cli.js sync --check` on this PC quotes: `cursor-hook-compat [skip]: no plugin registry at ~/.claude/plugins/installed_plugins.json — cursor-hook-compat not checked (not a pass). LIMIT: checks config, not whether Cursor actually runs the hook.` `%LOCALAPPDATA%\cursor-agent` **exists**; `~/.claude/plugins/installed_plugins.json` **does not**. Skip matches the machine: Cursor CLI is installed but there is no plugin cache to scan. |
| 5 | **Preserve** | **pass** | `checkCursorHookCompat` appears once in `runSync` (`index.ts` line 118). `git diff bf33fe4..3af41f5 --name-only`: four files only (`cursor-hook-compat.ts`, `index.ts`, `types.ts`, test). Summary on master (`bf33fe4`, rebuilt): `26 passed, 3 issues, 1 skipped`. On candidate (`44d672a`, rebuilt): `26 passed, 3 issues, 2 skipped` — the extra skip is `cursor-hook-compat`; pre-existing issues (retirements, build-freshness, greeting-size) unchanged. |
| 6 | **QA mutants** | **pass** | Two branches pushed via `push-qa.mjs` (§3). Both killed locally (1 and 2 failing rows respectively). |

## 2. Skip-is-not-pass edge probes (beyond the candidate's tests)

Ad-hoc script on product `3af41f5`, fixture home + `cursor-agent` present:

| Input | Severity | Notes |
|---|---|---|
| Registry entry with no `installPath` | pass | `continue` on line 93 — silent skip |
| Plugin id mapped to `[]` installs | pass | zero iterations |
| `installPath` set but `hooks/hooks.json` absent | pass | `continue` on line 96 |
| One entry without path beside a clean plugin | pass | bad entry skipped |

None of these is covered by a test row. For the 1.0.169 incident shape (valid `installPath`, file present,
non-empty `PreToolUse`) detection is sound. D1 is informational: a malformed registry could report clean.

## 3. Mutants

### Developer (on `loop/t046-detector-mut-*`, tcm)

| Branch | Run | Result | What broke |
|---|---|---|---|
| `loop/t046-detector-mut-ignore` | `36359226699` | **failure** (2 failed) | `preToolUseMatchers` always null — detection and runSync rows expect issue, got pass |
| `loop/t046-detector-mut-nocursor` | `36359228066` | **failure** (1 failed) | missing `cursor-agent` returns pass instead of skip |

### QA (on `qa/t046-detector-mut-*`, local; pushed, no tcm run yet)

| Branch | SHA | Killed locally | Mutation |
|---|---|---|---|
| `qa/t046-detector-mut-skipregistry` | `2abf3aa` | 1 failed / 6 passed | no registry → pass instead of skip |
| `qa/t046-detector-mut-pattern` | `45b25be` | 2 failed / 5 passed | raw-text `"PreToolUse"` match instead of JSON parse — kills parser row and malformed-JSON row |

## 4. CI (tcm)

Developer runs (four, no `windows=true`):

| Run | Branch / SHA | Conclusion | Notes |
|---|---|---|---|
| `36359225675` | `loop/t046-detector` @ `3af41f5` | **success** | 1806 passed, 6 skipped |
| `36359225141` | `loop/t046-detector-red` @ `1296e60` | **failure** | 7 failed (`no check`, not in runSync) — red branch as designed |
| `36359226699` | `mut-ignore` | **failure** | 2 failed — mutant killed |
| `36359228066` | `mut-nocursor` | **failure** | 1 failed — mutant killed |

Local on candidate tip: `cursor-hook-compat.test.ts` **7/7 passed** (18.1s; runSync row ~17.6s).

QA mutant branches were pushed after the developer's four runs; no tcm allocation remains in this dispatch.

## 5. Defects

| ID | Severity | Finding |
|---|---|---|
| D1 | low | Registry entries without a reachable `hooks.json` (missing `installPath`, zero installs, or absent file) yield **pass** without scanning. Not wrong for "no PreToolUse found in readable installs" but untested and could hide a mis-typed `installPath`. Does not block the incident detector's core path. |

No other defects.

## 6. Open for the planner

None blocking. D1 could become a follow-up row if malformed registry entries are a realistic failure mode on
Aaron's machine (where the registry does exist).

## 7. Model

Composer 2.5 per dispatch (`docs/loops/t046-detector-dispatch-qa.md`).

QA-197: REPORT COMPLETE
