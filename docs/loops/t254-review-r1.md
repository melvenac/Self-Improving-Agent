# T-254 review r1 (grok-sia-review), verbatim

Room k57c639j4wkyp3y3vhfxxytn1s8fsdx6, job turn 51 (atlas); reply REVIEW 1/1. Committed verbatim by Atlas (s166) per
D-127. Reviewed: PR #559, 8f584a7c..688628dc.

**Planner ruling: ACCEPT-level** (0 blocking, 0 major). #559 is clear for SG-1 at 688628dc. The planner's own checks
first-hand: mutants M1–M4 each red, and T254-A2 on a real process. F1–F5 are recorded on T-254 as a follow-up list and
worked only if one bites (D-143):

- **F2 and F3 are the only ones that can hide a stale process.**
  - F2 is a process started inside the rebuild window, so LOADED_COMMIT is null.
  - F3 is a dirty-tree rebuild at the same HEAD. A builtAt comparison would close it.
- **F1** is wording: a stale process can load lazy modules from the newer disk build, so it runs mixed code.
- **F4** is test hardening: turn A2 into a test that spawns a child process.
- **F5** is a nit.

```text
--- grok-sia-review ---
REVIEW 1/1 688628d
Blind review of 8f584a7..688628d (serving-build.ts, stale-process.test.ts) against the brief at 8f584a7. Node v22.23.3, token-free scratch clone, isolated HOME: stale-process (6), serving-build (17), briefing (48) -> 3 files, 71 tests passed, EXIT=0. No blocking or major findings. W1-W3 match the brief's text: readStampedCommit plus the 40-hex test, a top-level const LOADED_COMMIT, the dir/loaded first statements, and the branch after builtAt and before any git call.

F1 [minor] open-brain/src/server.ts:1225 at 688628d
claim: "Build <loaded7>" describes only modules loaded at startup. Lazy dynamic imports in a stale process load the disk (new) code, so after a rebuild the process runs mixed code. Both the STALE PROCESS line and the non-stale line call this one loaded build.
evidence: `const { store } = await import("./pipelines/store/index.js");` (and cli.ts:36, :82, :149-150 `await import(...)`)
scenario: the process starts at commit A, the tree is rebuilt at B, then the first ob_store call imports B's store pipeline. The line says "Build aaaaaaa · STALE PROCESS", but the store path is already B. The advice (reconnect) is still right, so this is minor. The wording should say "loaded at start" or similar, or the docs should note it.

F2 [minor] open-brain/package.json:12 at 688628d
claim: LOADED_COMMIT can be null in a process that starts during a rebuild. When that happens the check is disabled for that process's whole life. prebuild deletes build/, tsc writes the JS, and build-info.json is only written in postbuild.
evidence: `"prebuild": "node -e \"require('node:fs').rmSync('build',{recursive:true,force:true})\""`; serving-build.ts:56 `export const LOADED_COMMIT: string | null = readStampedCommit(runningBuildDir());`; serving-build.ts:86 `if (loaded !== null && loaded !== commit) {`
scenario: the MCP server (or the SessionStart hook) starts between tsc and postbuild. LOADED_COMMIT is null, so every later rebuild is reported as "Build <disk7> · current" by a process that is not running that code. The window is small. A reasonable fix is to make null mean "loaded unstamped": when LOADED_COMMIT is null and the disk is stamped, print a not-checked/STALE-unknown line instead of the disk build. Another option is to read the stamp from the same file set the process loaded.

F3 [minor] open-brain/scripts/write-build-info.mjs:46 at 688628d
claim: (Atlas's Q4) a dirty-tree rebuild at the same HEAD gets the same stamp, so STALE PROCESS cannot fire. The stamp records only the commit and builtAt, and the comparison looks only at commit.
evidence: `JSON.stringify({ commit, builtAt: new Date().toISOString(), reason }, null, 2)`; serving-build.ts:86 compares `loaded !== commit` only
scenario: a seat edits src without committing, runs npm run build, and its running server keeps the old code with no warning. This is acceptable for the D-143 scope, because the main serving tree should be clean. A cheap follow-up is to compare builtAt as well, which is captured with the commit: reading the whole stamp once and flagging a differing builtAt would catch same-commit rebuilds.

F4 [minor] open-brain/tests/pipelines/session-start/stale-process.test.ts:67 at 688628d
claim: the production path (describeServingBuild() with no args, which uses LOADED_COMMIT) has no behavioural test. SP-6 is a regex pin on the source text, so a semantically equivalent refactor fails it and a semantically wrong edit that keeps both regex lines passes it. For example, a later line could shadow `loaded`, or the module could be re-imported per call through a cache-busted dynamic import.
evidence: `expect(src).toMatch(/^export const LOADED_COMMIT: string \| null = readStampedCommit\(runningBuildDir\(\)\);$/m);`
scenario: suggested hardening is to run T254-A2 as a test. Spawn node on a copied build/ (or a tsx child) that imports the module, rewrite build-info.json, then call describeServingBuild() and assert STALE PROCESS. The planner's real-process check covers it once, not on every run. The other mutants I considered are killed: dropping `loaded !== null` makes null.slice throw (SP-3), and moving the branch after git means a fixture without git gives notChecked (SP-1). A survivor that should be noted: comparing `loaded.slice(0,7) !== short` instead of the full SHA passes all rows.

F5 [nit] open-brain/src/pipelines/session-start/serving-build.ts:80 at 688628d
claim: when the disk stamp is unstamped or unreadable (commit null), the function returns not-checked before the stale comparison, even if LOADED_COMMIT is known.
evidence: `return notChecked(\`the build was not stamped with a commit...` precedes line 86
scenario: process A runs, the rebuild's git rev-parse fails, and the stamp has commit null. The line says "not checked" rather than naming loaded A. This is not misleading, but it could include the loaded commit.

looked: W1-W3 conformance with the brief — found nothing
looked: LOADED_COMMIT evaluation (fresh SessionStart/cli process reads the disk at start, so it is always equal and correct for itself; ESM caches one evaluation per process; symlinked/junctioned build dir: fileURLToPath(import.meta.url) is the realpath by default and is consistent for both reads; build rewriting the stamp mid-build) — F2
looked: other ob_start lines reporting disk not loaded (server.ts:290 describeTreeCurrency and record version are about the tree/record and so are correct; the Sync/server version string is hardcoded "0.1.0" at server.ts:868, in memory and not from disk; lazy dynamic imports) — F1
looked: dirty-tree same-commit rebuild — F3
looked: test strength and mutant survivors — F4
looked: explicit serving_build_dir guard (briefing test confirms it is stripped from MCP calls, so production omits it) — found nothing
looked: security (no new input surface; the stamp is regex-validated before slice/interpolation) — found nothing
time spent: ~25 min


```
