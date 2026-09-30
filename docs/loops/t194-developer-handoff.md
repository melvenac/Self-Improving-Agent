# T-194 developer handoff: planner seat PreToolUse hook

**By:** Forge (developer), record **214**, 2026-09-28.
**Branch:** `loop/t194-planner-hook` (from `origin/master` `8467cb1`).
**Brief:** `docs/loops/t194-t195-dispatch.md` §Record 214 at `496ba4c`.
**D-061:** local tests only; no CI dispatched.

## What shipped

- `open-brain/src/cli-planner-hook.ts` — PreToolUse entry (stdin JSON, exit 2 + `permissionDecision: deny` on refusal).
- `open-brain/src/planner-hook/` — policy modules (`run.ts`, `paths.ts`, `summary.ts`, `bash.ts`, `git.ts`, `grant.ts`, `emit.ts`, `registration.ts`).
- `open-brain/tests/planner-hook/hook.test.ts` — PH-1..PH-8 rows.
- Grant path: `open-brain/.planner-outward-grant` (under PH-1; planner cannot create it via Edit/Write). Aaron places the file; one use consumes it.
- D-032 `gh pr merge`: r1 called `gh pr view` (a spawn) and r1 fix 7dbf130 made it grant-only; **r2 supersedes both** (see "r2" below).
- Registration: `node open-brain/build/cli-planner-hook.js --print-registration` prints the `settings.local.json` snippet. **Not registered** — Aaron's hand.

## Local proof

| Command | Result |
| --- | --- |
| `npx tsc --noEmit -p open-brain` | exit **0** |
| `npx vitest run open-brain/tests/planner-hook/hook.test.ts` | exit **0**, **39 passed** |

## Row map

| Row | Test(s) | Red | Green |
| --- | --- | --- | --- |
| **PH-1** | `PH-1 — artifact writes denied` (4) | `mut-ph1` `f22ce62` — **5 failed**, 34 passed | **39 passed** |
| **PH-2** | `PH-2 — rendered views…` (6) | `mut-ph2` `a2dacdb` — **4 failed**, 35 passed | **39 passed** |
| **PH-3** | `PH-3 — outward git acts need grant` (7) | `mut-ph3` `5de6430` — **7 failed**, 32 passed | **39 passed** |
| **PH-4** | `PH-4 — allowed planner acts` (7) | `mut-ph4` `61062d8` — **2 failed**, 37 passed | **39 passed** |
| **PH-5** | `PH-5 — fail closed…` (3) | `mut-ph5` `86dbe20` — **2 failed**, 37 passed | **39 passed** |
| **PH-6** | `PH-6 — Bash write detection` (5) | `mut-ph6` `c5ba934` — **6 failed**, 33 passed | **39 passed** |
| **PH-7** | `PH-7 — JSON parser…` (malformed JSON must deny) | `mut-ph7` `29a622e` — **1 failed**, 38 passed | **39 passed** |
| **PH-8** | `PH-8 — CLI deny contract…` (3) + registration | `mut-ph8` `f3266e0` — **1 failed**, 38 passed | **39 passed** |

**Red on master:** no hook and no test file — boundary is prose-only (`planner.md`).

## PH-8 live check (not run here)

After Aaron registers the snippet in the planner checkout: one denied `Edit` to `open-brain/src/` and one allowed `Write` under `docs/loops/`, with refusal text quoted in the ruling. PreToolUse deny-wins across hooks (context-mode plugin) is host behaviour; this hook emits exit **2** and `permissionDecision: deny` on stdout.

## Mutant branches (local only, not for merge)

| Branch | Defect | SHA |
| --- | --- | --- |
| `loop/t194-planner-hook-mut-ph1` | skips `isProtectedArtifactPath` | `f22ce62` |
| `loop/t194-planner-hook-mut-ph2` | skips rendered-view deny | `a2dacdb` |
| `loop/t194-planner-hook-mut-ph3` | `checkBash` always allows | `5de6430` |
| `loop/t194-planner-hook-mut-ph4` | denies `docs/loops/` writes | `61062d8` |
| `loop/t194-planner-hook-mut-ph5` | missing `AGENT.local.md` → passthrough | `86dbe20` |
| `loop/t194-planner-hook-mut-ph6` | `detectBashWriteTargets` always `[]` | `c5ba934` |
| `loop/t194-planner-hook-mut-ph7` | malformed JSON exits **0** | `29a622e` |
| `loop/t194-planner-hook-mut-ph8` | deny exits **0** | `f3266e0` |

**Product tip:** `loop/t194-planner-hook` `7d68bcf`.

---

## r2 (2026-09-30): docs-only `gh pr merge` needs no grant

**Authority:** Aaron, 2026-09-30, relayed verbatim by the planner: *"docs only merge have my go-ahead"*. D-032/D-055 stand with no grant file. r1 (`f15f2cf`) had made `gh pr merge` grant-only, which contradicted it.
**Branch:** `loop/t194-planner-hook`, built on `f15f2cf`. **Product:** `0d12a4f1`. **Local only, not pushed (D-061); no CI.**

### What r2 does

- `open-brain/src/planner-hook/prfiles.ts` (new): reads the PR's changed files with `fetch` against `api.github.com`, no child process. Repo comes from a PR URL, else from `origin` in the git config file (worktree `commondir` followed). It pages `/pulls/N/files?per_page=100` and checks the count against the PR's `changed_files`.
- `run.ts`: `runPlannerHookAsync` is the live entry (the CLI calls it). `runPlannerHook` stays synchronous, so every r1 row is untouched. Pass one runs the policy with a recorder standing in for the list; if it reaches the merge check and did not already allow (a matching grant), the list is fetched and pass two decides.
- A docs-only PR is allowed with no grant. **Anything else falls through to the grant, and the refusal names the cause:** `unlisted path X`, `no GitHub token`, `HTTP 404`, `API unreachable (<error>)`, `file list is incomplete (n of m)`, `could not read a PR number`, `origin is not a github.com remote`, `changed_files` unreadable or empty, a rename with no `previous_filename`.
- A rename counts BOTH paths: moving a file out of `src/` into `docs/` touches `src/`.

### The limit, stated plainly

**The token comes from `GH_TOKEN`, then `GITHUB_TOKEN`, then `oauth_token` in gh's `hosts.yml`.** A token gh keeps in the OS keyring cannot be read without a spawn. **On this desktop gh is keyring-stored** (`gh auth status` says `(keyring)`; `%APPDATA%\GitHub CLI\hosts.yml` has no `oauth_token`). So on a keyring-only machine **every docs merge is grant-required until `GH_TOKEN` is readable by the hook.** The repo is private, so an unauthenticated call is not an option.

**Setup (Aaron's hand, when he registers the hook, after r2 passes QA):** a fine-grained GitHub token scoped to `melvenac/Self-Improving-Agent` only, permission "Pull requests: Read" and nothing else, supplied as `GH_TOKEN` in the `env` block of `sia-planner/.claude/settings.local.json`, beside the hook registration. Do NOT use gh's full-scope keyring token. Not done here.

### Rows (tests/planner-hook/docs-merge.test.ts, 24 tests)

| Row | Test(s) | Mutant (local branch) | Red |
| --- | --- | --- | --- |
| 1 all-docs passes, no grant | allowlist paths / paging / PR-URL repo / bearer = `GH_TOKEN` value | `m4-unlisted-allows` `cb93ed7d` | 2 failed |
| 2 one unlisted path denied | unlisted named; rename-out named; rename with no previous_filename; grant still allows | `m2-drop-previous-filename` `f990886a` | 1 failed (rename-out) |
| 3 unreadable list denied, cause named | network error, hang (timeout), 404, no token (keyring shape), truncated list, empty, non-list, bad ref, non-github origin | `m1-list-unreadable-allows` `df67011d` | 10 failed |
| 3 (completeness) | truncated list | `m3-drop-completeness-guard` `8be340eb` | 1 failed (truncated) |
| no spawn (CA-4b/R16) | AST walk of `src/planner-hook/*` + CLI for any `child_process` import, validated against four planted forms and a comment-only negative | n/a | n/a |

Each mutant: branch `mutant/t194-r2-<name>`, one edit to the product, edit asserted as landed before the run, `tsc --noEmit` exit 0, then the test file exit 1 on the named row. **Never merge them.** Note: spawn-sites' own check (`tests/harness/spawn-sites.test.ts`) walks `src/harness/` only, so it never covered `src/planner-hook/`; the AST row above is what covers it.

### Local proof (tree `0d12a4f1`, `open-brain/`)

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run tests/planner-hook` | exit 0, 64 passed (40 r1 + 24 r2) |
| `npx vitest run` (full, unpiped, alone) | **exit 1**, 10 failed, 1807 passed, 78 skipped; 2 unhandled `onTaskUpdate` timeouts |

### The 10 failures, by name, and where each stands

None is in a file r2 touches (r2 changes `cli-planner-hook.ts`, `planner-hook/{run,prfiles}.ts` and one new test).

| Failing test | Alone on this branch | At base (`git archive origin/master` `abae5f92`, `C:\qa-tmp\base-origin-master-r2`, built there) |
| --- | --- | --- |
| `state-import-r6` QA 153 D1 x2 and D2 (3 rows; record 221 named two) | pass (4.6-4.9 s of a 5 s limit) | D1 "the lie is named…" **fails: timed out in 5000ms** |
| `t048-r3` T048-D1 x3 | 1 fails (timeout 5000ms; 2 pass) | 1 fails (timeout 5000ms) |
| `repo-root` V6 "this repo's shape" | fails (timeout 5000ms) | passes |
| `sync/index` "categorizes results correctly" | passes | passes |
| `state-schema` T-171 r3b | fails: the fix `9b3a4a2` is on `origin/master` but not on this branch | fails, **for a different reason**: the archive has no `.git`, so `git fetch origin master --depth 1` fails |
| `qa104-a9-probe2` R72-BEFORE-ABSENT-DANGLING | fails: `EPERM: operation not permitted, symlink` (Windows symlink privilege) | **file is not at origin/master**; nothing to run |
| `role-files` timing (record 221 named it) | passes; did not fail in this full run | passes |

**What that says, and what it does not:** the r6, t048 and repo-root rows are 5000 ms timeouts on tests that take about 4.6-5 s when the machine is idle, so any load tips them; the one r6 row that fails at base is the same shape. r2 does not touch them. **Not shown:** role-files failing at all (it did not reproduce here, alone or in the full run), and a full-suite run at base (only the seven failing files were run there). The base archive has no `.git`, so it cannot answer state-schema; the branch-side cause (`9b3a4a2` missing) is what does.
