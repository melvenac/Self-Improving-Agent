# T-245 Option A: one claim per doubled Cursor hook, and every doubled stage made idempotent

**By:** Atlas (planner), session 167, 2026-10-11. **Decision:** D-146 (Aaron, in the planner's window: "A").
**Seat:** cursor-builder (checkout `sia-builder`, QA PC). **Size:** MEDIUM. **Written to**
`~/Worktrees/cursor-brief-checklist.md`. **The base SHA in the dispatch turn overrides §2's.**

## Why (planner, first-hand at `a37eaf59`)

Cursor fires SessionStart and SessionEnd twice for one session: once from its own hook config and once from the
Claude-compatible one. #437 tried to stop the second run with a claim-and-reclaim cascade. After nine rounds it still
double-claims at 8 concurrent claimers, and Aaron closed it (D-146).

Option A goes the other way: make a doubled run harmless, then add the simplest possible claim on top.
cursor-builder's IDEMPOTENCY-CHECK (builder room `k575sfwr…`, turn 109) found that a doubled run is a no-op everywhere
except four places. This brief fixes those four and adds the claim:

| # | Where (at `a37eaf59`) | What a second run does today |
|---|---|---|
| W1 | `cli-bootstrap.ts` after line 82; `cli-session-end.ts` after line 61 | Runs the whole hook again |
| W2 | `recordMissingHandoff`, `shared/handoff-guard.ts` lines 193–201 | Appends a duplicate warning line |
| W3 | `cli-bootstrap.ts` line 189, `fetchOrigin(cwd)` | Runs a second `git fetch` |
| W4 | `pipelines/session-end/index-v2.ts` line 177 (`recordFeedbackEvent`), then `updateFeedbackV2` | Writes a second `feedback_log` row and bumps the knowledge counter again |
| W5 | `appendShadowLog`, `pipelines/shadow/index.ts` lines 46–49 | Appends a duplicate shadow line |

**Claude Code is unchanged.** The claim runs only for a payload carrying `cursor_version`, the same test
`detectIde` uses (`shared/active-session.ts` line 95). W2–W5 apply to every host, because they are correct for every
host.

```text
IMPACT-TARGETS: recordMissingHandoff appendShadowLog sessionEndV2 recordFeedbackEvent fetchOrigin
```

**Out of scope, do not touch:**
- `server.ts`, including its own `recordFeedbackEvent` call at line 1321 (an explicit `ob_feedback` rating may
  legitimately repeat).
- `setup.mjs` and any hook registration.
- `updateFeedbackV2`'s body, `fetchOrigin`'s body, `markFetch`, `takeMissingHandoffNotices`, `readShadowLog`.
- Anything under `open-brain/scripts/`.
- The closed #437 and #425 branches. Do not cherry-pick from them.

## 1. Shell and Node

PowerShell. Run these first and paste the output:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

If it prints `v24…`, STOP and reply `BLOCKED T-245 node v24`.

## 2. Start state

**Base:** `origin/master` at **`a37eaf5943aec7a350d178f555ce6cff09c96515`**, unless the dispatch turn names another SHA.

```powershell
git fetch origin
git switch -c fix/t245-option-a <BASE_SHA>
git rev-parse HEAD
git status --porcelain
```

`git rev-parse HEAD` must print the base SHA, and `git status --porcelain` must print nothing. Otherwise STOP:
`BLOCKED T-245 start state`.

## 3. Forbidden git

Do not use any of these:
- `git stash`
- `reset --hard`
- `--force`
- rebase
- amend
- `cd` into another seat's tree

Touch no PR except your own.

## The work (W1–W5)

### W1. The claim: new file `open-brain/src/shared/hook-claim.ts`

Export exactly these:

```ts
export const HOOK_CLAIM_TTL_MS = 120_000;
export type HookKind = "start" | "end";
export type ClaimResult = "claimed" | "skip";

/** The session id to claim on, or null when this run must not claim (not Cursor, or no id). */
export function shouldClaimHookRun(payload: Record<string, unknown>): string | null;

/** The default claim directory: join(homedir(), ".claude", "open-brain", "hook-claims"). */
export function defaultClaimDir(): string;

export function claimHookRun(opts: {
  kind: HookKind;
  sessionId: string;
  dir?: string;          // default defaultClaimDir()
  now?: number;          // default Date.now()
  ttlMs?: number;        // default HOOK_CLAIM_TTL_MS
}): ClaimResult;
```

**`shouldClaimHookRun`:**
- If `payload.cursor_version` is `undefined` or `null`, return `null`.
- Otherwise return `resolveSessionId(payload)?.uuid ?? null`. Import `resolveSessionId` from `./active-session.js`.

**`claimHookRun`:**
1. Build `file = join(dir, `${kind}-${sessionId.replace(/[^A-Za-z0-9._-]/g, "_")}.claim`)`.
2. Inside a `try`, `mkdirSync(dir, { recursive: true })`. Then try `openSync(file, "wx")`. On success, write
   `${process.pid} ${new Date(now).toISOString()}\n` with `writeSync`, `closeSync`, and return `"claimed"`.
3. If the error code is `EEXIST`, read `statSync(file).mtimeMs`.
   - If `now - mtimeMs < ttlMs`, return `"skip"`.
   - Otherwise it is stale: `unlinkSync(file)` (ignore `ENOENT`), then try `openSync(file, "wx")` exactly once more.
     Success means write, close and return `"claimed"`. `EEXIST` means return `"skip"`.
4. **Any other error, at any step, returns `"claimed"`.** Fail open: a broken claim directory must never stop a hook
   from running. There is no retry loop and no sleep.

**Wire it in, with these exact lines:**

- **`cli-bootstrap.ts`, immediately after the anti-loop block that ends at line 82:**
  ```ts
  {
    const claimId = shouldClaimHookRun(hookInput as Record<string, unknown>);
    if (claimId !== null && claimHookRun({ kind: "start", sessionId: claimId }) === "skip") {
      console.log(`SESSION_START_SKIPPED: a SessionStart for ${claimId} already ran within ${HOOK_CLAIM_TTL_MS / 1000}s (T-245).`);
      process.exit(0);
    }
  }
  ```
- **`cli-session-end.ts`, immediately after the payload `try`/`catch` that ends at line 61:**
  ```ts
  {
    const claimId = shouldClaimHookRun(hookPayload);
    if (claimId !== null && claimHookRun({ kind: "end", sessionId: claimId }) === "skip") {
      console.log(`[session-end] SESSION_END_SKIPPED: a SessionEnd for ${claimId} already ran within ${HOOK_CLAIM_TTL_MS / 1000}s (T-245).`);
      process.exit(0);
    }
  }
  ```

### W2. `recordMissingHandoff` appends at most once per session

In `shared/handoff-guard.ts`, inside the existing `try`, after `mkdirSync(...)` and before `appendFileSync(...)`:
- If `sessionId` is non-empty and `existsSync(path)`, then:
  - split `readFileSync(path, "utf8")` on `"\n"`;
  - for each non-empty line, `JSON.parse` it inside its own `try`;
  - if any parsed line has `session === sessionId`, `return` without appending.
- An empty `sessionId` keeps today's behaviour, which is to always append.

### W3. A fetch younger than the TTL is reused, not repeated

In `pipelines/session-start/tree-currency.ts`, add and export:

```ts
/** The last successful start fetch when it is younger than maxAgeMs, else null. Never throws. */
export function recentFetchOk(projectRoot: string, maxAgeMs: number, now: number = Date.now()): FetchResult | null;
```

- Use `commonDirOf(projectRoot)`, then `join(dir, OK_MARKER)`.
- Return `null` when the dir is `null`, the marker is absent, or `now - statSync(marker).mtimeMs >= maxAgeMs`.
- Otherwise return `{ ok: true, at: new Date(mtimeMs).toISOString(), cause: null }`.
- Wrap the whole body in `try`/`catch` that returns `null`.

In `cli-bootstrap.ts` line 189, replace `fetchOrigin(cwd)` with
`recentFetchOk(cwd, HOOK_CLAIM_TTL_MS) ?? fetchOrigin(cwd)`.

### W4. Session-end feedback is written once per session and entry

- **In `db-v2.ts`, add next to `recordFeedbackEvent` (line 899):**
  ```ts
  /** True when this session already has a session-end ('supplied') rating for this entry. */
  export function hasSuppliedFeedback(db: Database.Database, sessionUuid: string, knowledgeId: number): boolean {
    return db.prepare(
      `SELECT 1 FROM feedback_log WHERE session_uuid = ? AND knowledge_id = ? AND rating_method = 'supplied' LIMIT 1`,
    ).get(sessionUuid, knowledgeId) !== undefined;
  }
  ```
- **In `pipelines/session-end/index-v2.ts`,** directly before the `let wrote = true;` that precedes line 177, add:
  ```ts
  if (sessionId && hasSuppliedFeedback(db, sessionId, id)) continue;
  ```
  Import it from `../../db-v2.js`. The `continue` skips both the event row and `updateFeedbackV2`, so the counter
  moves once.

### W5. The shadow log holds one line per session

In `pipelines/shadow/index.ts`, change `appendShadowLog` so that it returns `boolean`:
- When `entry.session_uuid` is truthy and `readShadowLog(logPath).some((e) => e.session_uuid === entry.session_uuid)`,
  return `false` without writing.
- Otherwise append exactly as today and return `true`.
- The caller at line 178 ignores the return value. Leave the caller unchanged.

## 4. Commits (exactly two)

| # | Contents | Message |
|---|---|---|
| 1 | §6's two new test files only. They must be red at this commit (the imports are missing). | `T-245: tests (red)` |
| 2 | W1–W5 | `T-245 Option A: one claim per doubled Cursor hook; doubled stages idempotent (D-146)` |

After each commit, paste `git status --porcelain` (it must be empty) and `git log --oneline <BASE_SHA>..HEAD` (1 line,
then 2).

## 5. Mutants (local only, never pushed; ALL run, none `NOT RUN`)

For each mutant:
1. `git switch -c mut-N <final head>`.
2. Make the one edit, then `git commit -am "MUTANT N"`.
3. Run §6's command, and paste the test that turned red with its assertion line.
4. `git switch fix/t245-option-a`.

The tree must be clean after each one.

| N | Edit | Must turn red |
|---|---|---|
| 1 | In `claimHookRun`, the first `openSync(file, "wx")` becomes `openSync(file, "w")` | HC-2 |
| 2 | In `claimHookRun`, the stale branch returns `"skip"` instead of unlinking and retrying | HC-3 |
| 3 | `shouldClaimHookRun` drops its `cursor_version` check | HC-6 |
| 4 | Delete W2's early `return` | ID-1 |
| 5 | Delete W4's `if (sessionId && hasSuppliedFeedback(...)) continue;` | ID-3 |
| 6 | Delete W5's `some(...)` check (always append) | ID-4 |
| 7 | In `recentFetchOk`, delete the age comparison (an old marker counts as recent) | ID-2 |

## 6. Tests

### New file 1: `open-brain/tests/shared/hook-claim.test.ts`

- `dir = mkdtempSync(join(tmpdir(), "t245-claim-"))` in `beforeEach`, and `rmSync(dir, { recursive: true, force: true })` in `afterEach`.
- `T0 = Date.parse("2026-10-11T12:00:00Z")`.
- Pass every `now` explicitly. There are no fake timers and no sleeps.

| Row | Setup | Asserts |
|---|---|---|
| HC-1 | `claimHookRun({ kind: "start", sessionId: "s-1", dir, now: T0 })` | Returns `"claimed"`, and `existsSync(join(dir, "start-s-1.claim"))` |
| HC-2 | HC-1, then the same call with `now: T0 + 1000` | The second call returns `"skip"` |
| HC-3 | HC-1, then `utimesSync(file, (T0 - 200_000) / 1000, (T0 - 200_000) / 1000)`, then the same call with `now: T0` | Returns `"claimed"`, and `statSync(file).mtimeMs > T0 - 200_000 + 1000` |
| HC-4 | HC-1, then `claimHookRun({ kind: "end", sessionId: "s-1", dir, now: T0 })` | Returns `"claimed"` (start and end are separate keys) |
| HC-5 | `shouldClaimHookRun` on `{ cursor_version: "1.2.3", session_id: "abc" }` and on `{ cursor_version: "1.2.3", conversation_id: "c1" }` | Returns `"abc"`, then `"c1"` |
| HC-6 | `shouldClaimHookRun` on `{ session_id: "abc" }` and on `{ cursor_version: "1.2.3" }` | Returns `null` both times (Claude Code is never claimed; no id means no claim) |
| HC-7 | `const f = join(dir, "not-a-dir"); writeFileSync(f, "x")`, then `claimHookRun({ kind: "start", sessionId: "s-1", dir: join(f, "sub"), now: T0 })` | Returns `"claimed"`, and it does not throw |
| HC-8 | `claimHookRun({ kind: "start", sessionId: "a/b:c", dir, now: T0 })` | `existsSync(join(dir, "start-a_b_c.claim"))` |

### New file 2: `open-brain/tests/t245-idempotent-stages.test.ts`

**`beforeEach`:**
- `tmp = mkdtempSync(join(tmpdir(), "t245-"))`.
- Save `process.env.KNOWLEDGE_V2_DB`, then set it to `join(tmp, "knowledge-v2.db")`. **`endRecordProjectDir` derives
  its store from this, and without it the test writes under the real `~/.claude/open-brain` (G-044).**

**`afterEach`:**
- Restore the env var, deleting it if it was unset.
- `rmSync(tmp, { recursive: true, force: true })`.

**The handoff fixture:**

```ts
const C: HandoffCheck = { status: "missing", since: "2026-10-11T00:00:00Z", branches: ["loop/x"], commits: 1, handoffs: [], unattributed: 0 };
```

| Row | Setup | Asserts |
|---|---|---|
| ID-1 | `recordMissingHandoff(tmp, "u-1", C)` twice | The file `join(endRecordProjectDir(tmp), ".missing-handoff.jsonl")` has exactly 1 non-empty line |
| ID-1b | `recordMissingHandoff(tmp, "u-1", C)`, then `recordMissingHandoff(tmp, "u-2", C)` | 2 non-empty lines |
| ID-2 | `repo = join(tmp, "r")`, `mkdirSync(repo)`, `spawnSync("git", ["init", "-q", repo])`; `marker = join(repo, ".git", "sia-fetch-ok")`; `writeFileSync(marker, "x\n")`; `T0 = statSync(marker).mtimeMs` | `recentFetchOk(repo, 120_000, T0 + 1000)` is `{ ok: true, at: new Date(T0).toISOString(), cause: null }`. `recentFetchOk(repo, 120_000, T0 + 200_000)` is `null`. After `rmSync(marker)`, `recentFetchOk(repo, 120_000, T0)` is `null` |
| ID-3 | The `rating-method.test.ts` fixture (an in-memory DB through `initSchemaV2`, temp `vault` and `agents` dirs, its `seed` helper); `recordSession(db, "s1", null)`; `sessionEndV2({ db, vaultDir: vault, agentsDir: agents, sessionId: "s1", sessionSummary: "x", project: "General", recalledEntryIds: [id], entryRatings: { [id]: "harmful" }, dryRun: false })` called **twice** | `SELECT COUNT(*) AS n FROM feedback_log` gives `n === 1`, and `SELECT harmful FROM knowledge_index WHERE id = ?` gives `harmful === 1` |
| ID-4 | `log = join(tmp, "shadow.jsonl")`; `e = (u: string) => ({ date: "2026-10-11", session_uuid: u, queries: [], label_counts: {}, scores: {}, as_of: null, excluded_not_yet_created: 0 }) as unknown as ShadowLogEntry`; `appendShadowLog(log, e("s1"))` twice, then `appendShadowLog(log, e("s2"))` | The calls return `true`, `false`, `true`, and `readShadowLog(log).map((x) => x.session_uuid)` equals `["s1", "s2"]` |

### Command

PowerShell, from `open-brain/`. The run is a process whose PID you record. It gets a temp HOME, and the 10-minute cap
stops only that PID's tree (checklist 17):

```powershell
$iso = Join-Path $env:TEMP ("t245-home-" + [guid]::NewGuid().ToString("N")); New-Item -ItemType Directory $iso | Out-Null
$env:HOME = $iso; $env:USERPROFILE = $iso; $env:KNOWLEDGE_V2_DB = Join-Path $iso "knowledge-v2.db"
$files = "tests/shared/hook-claim.test.ts tests/t245-idempotent-stages.test.ts tests/shared/handoff-guard.test.ts tests/pipelines/session-start/tree-currency-fetch.test.ts tests/rating-method.test.ts tests/pipelines/session-end/index-v2.test.ts tests/shadow-stage.test.ts tests/cli-bootstrap.test.ts"
$p = Start-Process -FilePath "npx.cmd" -ArgumentList "vitest run $files --no-file-parallelism --testTimeout=20000" -NoNewWindow -PassThru -RedirectStandardOutput "$iso\vitest.out" -RedirectStandardError "$iso\vitest.err"
if (-not $p.WaitForExit(600000)) { taskkill /PID $p.Id /T /F; "BLOCKED: 10-minute cap, killed PID $($p.Id) tree only" } else { "EXIT=$($p.ExitCode)" }
Get-Content "$iso\vitest.out"
```

- Paste the vitest summary and the `EXIT=` line separately (G-042).
- Kill only with `taskkill /PID <the recorded PID> /T`. Never kill by name, image or command line. To see stray
  processes, LIST them and do not stop them.
- No test in this job spawns a waker or an agent. Afterwards, paste `Get-ChildItem $iso -Recurse -Name`.
- No watch mode, and never the whole suite.

## 7. Known red · 8. Typecheck · 9. Scope

**Known red.** If a file you did not change fails:
1. `git switch --detach <BASE_SHA>`.
2. Run that one file.
3. `git switch fix/t245-option-a`.
4. Paste both outputs.

If the failure is identical at the base, it was already there: name it and go on. You get at most **2** fix attempts
on your own failures. After that, STOP with `BLOCKED T-245 <test>`.

**Typecheck.** `npx tsc --noEmit` → `EXIT=0`.

**Scope.** `git diff --name-only <BASE_SHA>..HEAD` may show only:

```
open-brain/src/shared/hook-claim.ts   (new)
open-brain/src/cli-bootstrap.ts
open-brain/src/cli-session-end.ts
open-brain/src/shared/handoff-guard.ts
open-brain/src/pipelines/session-start/tree-currency.ts
open-brain/src/db-v2.ts
open-brain/src/pipelines/session-end/index-v2.ts
open-brain/src/pipelines/shadow/index.ts
open-brain/tests/shared/hook-claim.test.ts   (new)
open-brain/tests/t245-idempotent-stages.test.ts   (new)
```

Anything else means STOP.

## 10. Push and PR

```powershell
git push origin fix/t245-option-a
git ls-remote origin refs/heads/fix/t245-option-a
git rev-parse HEAD
```

The two SHAs must be equal. Never use `--force`. Then:

```powershell
gh pr create --base master --head fix/t245-option-a --title "T-245 Option A: one claim per doubled Cursor hook; doubled stages idempotent" --body "Brief: docs/loops/t245-option-a-brief.md. D-146. Replaces closed #437/#425. Reviewed by the planner before QA."
```

## 11. STOP rules

At most 2 attempts at any failing step. A STOP still posts a reply whose second line is `BLOCKED T-245 <reason>`.

## 12. Reply

```powershell
$env:HUB_URL = "http://100.124.212.87:4000"
$ht = "C:/Users/Aaron Melven/Projects/A2A-Hub/scripts/hub-talk.mjs"
if (-not (Test-Path $ht)) { "hub-talk not at $ht: use the exact hub-talk.mjs path your --inbox call used at the start of this run" }
node $ht --as cursor-builder --session k575sfwr9wcx3r8fw83g3bc00x8fmar3 --say-file "$iso\reply.txt"; "EXIT=$LASTEXITCODE"
```

- Exit codes follow `.cursor/rules/hub-room.mdc`: 0 means posted, end the turn. 1 means the call was wrong: fix it, and do
  not retry it unchanged. 3 means the hub is unavailable: back off 5 s, doubling to 60 s, and stop after 5 in a row.
- Keep each post under 9,000 characters. Split it into two posts if needed, `(1/2)` and `(2/2)`.
- **Line 1:** `TASK: T-245 READY, Option A claim + idempotent stages (fix/t245-option-a)`. On a stop, `BLOCKED` replaces `READY`.
- **Line 2:** `READY T-245 <sha40>` or `BLOCKED T-245 <reason>`.
- **Then, in order:**
  1. `node -v`
  2. The start state
  3. The commit log
  4. The test command, the vitest summary and the `EXIT=` line
  5. `git diff <BASE_SHA>..HEAD -- open-brain/src`
  6. The `tsc` `EXIT=`
  7. The scope diff
  8. Mutants 1–7
  9. The push readback
  10. The PR number
  11. **IMPACT:** each target clark's launcher rated HIGH, CRITICAL or UNKNOWN, with the rows or §6 files that cover
      its callers, or `IMPACT: no HIGH/CRITICAL/UNKNOWN`.
- Every number is pasted command output, with the command shown above it. Anything not run is `NOT RUN`. End your turn
  after posting.

## 13. RAM and time

One test process, and no hub listener running alongside it. No real sleeps: every row passes `now` explicitly or
sets an mtime with `utimesSync`.

## Acceptance

| # | Check |
|---|---|
| T245-A1 | HC-1…HC-8 and ID-1…ID-4 pass. The existing files in §6 stay green. `tsc` gives 0. Scope is as §9. |
| T245-A2 | Mutants 1–7 are each red on their named rows. |
| T245-A3 | A Grok review (D-145 lane) of the diff returns APPROVE, or CHANGES that the planner rules on. |
| T245-A4 | Live, after merge, a rebuild of the main tree and an explicit `/mcp reconnect` in one Cursor seat: one Cursor session start prints one full greeting and one `SESSION_START_SKIPPED` line. That session's end leaves 1 line in `.missing-handoff.jsonl` (when the handoff is missing), 0 duplicate `feedback_log` rows for its session, and 1 shadow line. |

## ROUND 2 (2026-10-11): drop W3

cursor-builder stopped correctly with `BLOCKED T-245 tree-currency-fetch.test.ts`. Its local head is
`8b210fe41153fb45ae89d91fc27f7839dda02fec`, not pushed. W3 turned two existing rows red:
`r2 row 3b/5 (startup)` and `(resume)`. The planner confirmed the cause:

- **T-208's contract is that every session start fetches, or says the fetch failed.** Those rows make a fetch succeed,
  break the remote, then expect `fetch FAILED:`. W3 reused the fresh ok marker, so it hid a fetch that had just broken.
- **W3 was also redundant.** W1's claim already stops Cursor's second start before it reaches the fetch, and Claude
  Code runs SessionStart once.
- **The defect is the brief's, not the build's.** The planner did not run `tree-currency-fetch.test.ts` against W3
  before dispatching.

### R2 work (one new commit on top of `8b210fe4`; no amend, no rebase)

1. In `open-brain/src/pipelines/session-start/tree-currency.ts`, delete `recentFetchOk` entirely. The file must equal
   base: `git diff b142886f..HEAD -- open-brain/src/pipelines/session-start/tree-currency.ts` prints nothing.
2. In `open-brain/src/cli-bootstrap.ts`, line 189 goes back to `fetchOrigin(cwd)`. Remove the `recentFetchOk` import,
   and keep W1's claim block and its imports.
3. In `open-brain/tests/t245-idempotent-stages.test.ts`, delete row ID-2 and any import it alone used.
4. Commit: `T-245 r2: drop W3 (fetch reuse); T-208's fetch-every-start contract stands`. Then paste
   `git log --oneline b142886f..HEAD` (3 lines) and an empty `git status --porcelain`.
5. Run §6's command unchanged. **All 8 files must be green, including `tree-currency-fetch.test.ts` at 12/12.**
6. Run mutants **1–6** (mutant 7 is withdrawn with W3). For each, paste the row that turned red.
7. Run `tsc`, the scope check (`tree-currency.ts` must no longer appear), then §10 push and PR.
8. Reply as §12, with line 1 `TASK: T-245 READY r2, Option A claim + idempotent stages (fix/t245-option-a)`.

**Allowed:** the `node_modules` `npm rebuild better-sqlite3` that cursor-builder ran for Node 22 is fine. It touches no
tracked file. **Acceptance changes:** A1 drops ID-2, and A2 is mutants 1–6.
