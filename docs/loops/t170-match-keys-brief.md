# T-170: the recall trigger reads a lesson's `MATCH: command:` key (D-155, option A)

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t170-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-170 (P1), ruled by D-155. **Tag:** `T-170`. **Size:** MEDIUM.
**Base:** the dispatch SHA clark names (a master that contains this brief).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: runTrigger handleStore getV2Db (open-brain/src/trigger/run.ts, server.ts; the hook open-brain/src/cli-recall-trigger.ts main; cli-session-end.ts; cli.ts; covered by tests/trigger/*, tests/pipelines/store/*)
```

## Why

Aaron ruled T-170 option A (D-155): each lesson carries an OPTIONAL match key; `/end` asks for one; a lesson stored
without one is REPORTED as lookup-only, never refused; the trigger matches on the keys.

Two facts the planner measured on 2026-10-14 decide the shape:
- **The key already exists, as a line.** Since 10-02 `/end` step 2 writes `MATCH: command|path|error|none` into each
  lesson, and 87 of 712 live entries carry one (command 40, path 24, error 19, none 4). `end.md` says "Nothing reads
  `MATCH:` yet". So this loop adds no second representation. **The line in the content IS the key.** The loop
  parses it, and the trigger reads it. ob_store gets no new parameter.
- **A literal key over-fires.** Run over 5,181 distinct Bash/PowerShell commands from 60 recent transcripts, the 39
  usable command keys would hit 16% of all commands, and the bare `git show` key alone (entry 714) would hit 9.6%. T-264
  measured that firing on context rather than on the mistake trains a reader to skip the channel. So **a keyed entry
  injects at most ONCE PER SESSION**, the element path keeps priority, and `/end` tells writers to key the mistake's
  shape, not the tool.

Command keys only this loop: the trigger is a PostToolUse/Bash hook and sees commands. Path and error keys stay
stored and unread. That is said in the ob_store reply, and they are a later increment (T-170 part ii).

**Fast path (T-159) holds:** the hook must not load better-sqlite3 for a command that asks nothing. The keys reach it
through a small JSON sidecar beside the store, written by the server and the CLIs. The sidecar is only a PREFILTER;
the asked path re-reads each entry from the store and re-tests it, so a stale sidecar can cost a miss, never a wrong
injection.

## Ruling (exact)

### 1. New module `open-brain/src/trigger/match-keys.ts` (node builtins only; it imports nothing from the repo)

- `export const MATCH_KEY_MIN_CHARS = 6;`
- `export interface CommandKey { id: number; fragments: string[] }`
- `export function parseCommandKey(content: string): string[] | null`, exactly this rule:
  1. the key line is the FIRST line of `content.split(/\r?\n/)` that matches `/^MATCH:\s*command:/`; none → `null`;
  2. `text` = that line with `/^MATCH:\s*command:\s*/` removed;
  3. if `text` contains a backticked span (`/`([^`]+)`/`), `text` = the FIRST span's inside; otherwise `text` is cut
     at the first `" ("` when there is one (a parenthetical is commentary);
  4. `fragments` = `text.split(/<[^>]*>|…|\.\.\./)`, each with whitespace runs collapsed to one space and trimmed,
     empties dropped (a `<placeholder>`, `…` or `...` is a wildcard);
  5. return `null` when `fragments.join("")` has fewer than `MATCH_KEY_MIN_CHARS` non-whitespace characters,
     otherwise `fragments`.
- `export function commandMatchesKey(fragments: string[], command: string): boolean`: collapse whitespace runs in
  `command` to one space; true exactly when every fragment occurs in it IN ORDER, each searched from the end of the
  previous one (case-sensitive `indexOf`).
- `export function triggerKeysPath(dbPath: string): string` → `join(dirname(dbPath), "recall-trigger-keys.json")`.
- `export function readTriggerKeys(path: string): CommandKey[]`: the file is
  `{"generated_at": "<ISO>", "keys": [{"id": <n>, "fragments": [..]}]}`. Return its `keys`. Any failure (absent,
  unreadable, not JSON, wrong shape) returns `[]` and never throws.
- `export function matchingKeyIds(keys: CommandKey[], command: string): number[]`: the ids whose fragments match,
  sorted by `fragments.join("").length` descending, then id ascending.

### 2. New module `open-brain/src/trigger/keys-writer.ts`

`export function writeTriggerKeys(db: Database.Database, path: string): { written: number; unusable: number }`
(better-sqlite3 as a TYPE import only, plus `match-keys.ts`). It reads
`SELECT id, content FROM knowledge_index WHERE archived_into IS NULL AND content LIKE '%MATCH:%' ORDER BY id`. A row
whose content has a `/^MATCH:\s*command:/` line and parses to fragments is written; one whose command line parses to
`null` counts as `unusable`. It writes `{generated_at, keys}` to `${path}.tmp-${process.pid}`, then `renameSync`s it
onto `path`, so a reader never sees half a file.

### 3. The hook, `open-brain/src/cli-recall-trigger.ts`

- A static import of `matchingKeyIds, readTriggerKeys, triggerKeysPath` from `./trigger/match-keys.js`. This is the
  fifth fast-path module, and the header comment's list of fast-path imports names it.
- The T-159 branch becomes: compute
  `const keyIds = matchingKeyIds(readTriggerKeys(triggerKeysPath(DB_PATH)), command);` after the session check, and
  take the not-asked path only when `deriveQuery(command) === "" && keyIds.length === 0`.
- The asked path passes `keyIds` to `runTrigger`. Nothing else in the hook changes.

### 4. `open-brain/src/trigger/run.ts`

- `TriggerRunInput` gains `keyIds?: number[]` ("ids the sidecar prefilter matched; re-tested here against the store").
- `runTrigger`:
  1. `query = deriveQuery(command)`, `keyIds = input.keyIds ?? []`. If `!query && keyIds.length === 0`, the not-asked
     branch, unchanged.
  2. `hits = query ? queryStore(...) : []` (unchanged call).
  3. If `hits.length < policy.max_injected` and `keyIds.length > 0`: `already = injectedIds(input.db, sessionUuid)`
     (from `./fires.js`). Then for each id in `keyIds` order, until the slots are full:
     `SELECT id, key, content FROM knowledge_index WHERE id = ? AND archived_into IS NULL` on the read handle. Keep it
     only when the row exists, `parseCommandKey(row.content)` is non-null, `commandMatchesKey(thoseFragments, command)`
     is true, the id is not in `already`, and the id is not in `hits`. A kept row is appended to `hits` (no relevance
     floor applies to a keyed hit; it is not a bm25 match).
  4. The recorded `query` is `[query, keyIds.length ? \`match:${keyIds.join(",")}\` : ""].filter(Boolean).join(" ")`.
     It is non-empty whenever the store was asked, so `recordFire`'s not-asked guard holds.
  5. The state, ids and `additionalContext` are built from `hits` exactly as today: `injected` with ids when it is
     non-empty, `silent` otherwise.

### 5. Writing the sidecar

- `server.ts`: one helper `refreshTriggerKeys(db)` that calls
  `writeTriggerKeys(db, triggerKeysPath(V2_DB_PATH))` inside try/catch and returns `""` on success or
  ` (trigger keys not refreshed: <first line of the error>)` on failure. Call it:
  (a) in `getV2Db()` right after the first open (ignore its result);
  (b) in `handleStore` before each SUCCESS reply (stored, replaced, adopted), appending its result to the reply;
  (c) in `ob_forget` when `deleted > 0`, appending its result to the reply.
- `cli-session-end.ts`: inside the existing T-159 reconcile `try`, after the reconcile line, call
  `writeTriggerKeys(db, triggerKeysPath(V2_DB))` and print
  `[session-end] trigger keys: <written> command key(s), <unusable> unusable`.
- `cli.ts`: a new `} else if (command === "trigger-keys") {` branch. It opens the default store
  (`KNOWLEDGE_V2_DB` or `~/.claude/open-brain/knowledge-v2.db`) with `{ readonly: true, fileMustExist: true }`,
  calls `writeTriggerKeys`, and prints `trigger keys: <written> command key(s), <unusable> unusable -> <path>`; exit 0.
  An absent store prints `trigger keys: no store at <path>` and exits 1.

### 6. ob_store reports the key (D-155: reported, not refused)

In `handleStore`, on the plain SUCCESS reply only (`Stored knowledge (id: …)`), and only when `kind === "event"`,
append exactly one of:
- ` — match: command (the recall trigger reads it)` when `parseCommandKey(content)` is non-null;
- ` — match: command line present but under ${MATCH_KEY_MIN_CHARS} characters, so lookup-only` when the content has a
  `/^MATCH:\s*command:/` line that parses to `null`;
- ` — match: ${keyKind} (stored; the trigger does not read ${keyKind} keys yet)` for a `/^MATCH:\s*(path|error):/`
  line, where `keyKind` is the captured `path` or `error`;
- ` — lookup-only: no MATCH: line (D-155)` otherwise, including `MATCH: none`.
Nothing is refused because of a key.

### 7. `/end` step 2, three copies

In `.claude/commands/end.md`, `project-template/.claude/commands/end.md` and
`project-template/.cursor/commands/end.md`, replace the three lines
```
Give every lesson the key a machine could match against the act that repeats it. **Nothing reads
`MATCH:` yet:** the recall trigger matches on the command text, not on this line. The line is
written now so the entries exist, keyed, when something does read it.
```
with
```
Give every lesson the key a machine could match against the act that repeats it. **The recall
trigger reads `MATCH: command:`** (T-170): the first backticked span is the key, `<placeholder>` and `…`
are wildcards, and the parts must appear in that order in a Bash command. Key the MISTAKE's shape, not
the tool: a bare `git show` fires on every `git show`. A keyed lesson is injected at most once per
session. `path:` and `error:` keys are stored but not read yet; a key under 6 characters is lookup-only.
```
The three copies stay identical in that passage.

### 8. Nothing else in src changes.

## Rows (commit 1: new file `open-brain/tests/trigger/t170-match-keys.test.ts`)

Import the two new modules with `await import(...).catch(() => ({}))`, as `t159-fast-path.test.ts` does, so each row
fails on its own at commit 1. Seed stores the way `tests/trigger/hook.test.ts` does (`initSchemaV2`, then
`indexKnowledge`). The trigger policy for R-rows is `{ relevance_floor: 8, max_injected: 1, deadline_ms: 2000,
provenance: "t170" }`, unless a row says otherwise.

Pure rows (pre-run by the planner against a scratch copy of rule 1):
- **K1** `parseCommandKey("[EXPERIENCE] x\nMATCH: command: \`git show <ref>:<path>\` (on Windows)\nTRIGGER: y")` → `["git show", ":"]`.
- **K2** `parseCommandKey("MATCH: command: claude -p (headless job prompt)")` → `["claude -p"]`.
- **K3** `parseCommandKey("MATCH: command: \`while read x; do … ssh …; done <<'EOF'\`")` → `["while read x; do", "ssh", "; done <<'EOF'"]`.
- **K4** `parseCommandKey("MATCH: command: \`npm ci\` (run by a fork)")` → `null`.
- **K5** `null` for each of: `"MATCH: path: src/db/migrate.ts"`, `'MATCH: error: "boom"'`, `"MATCH: none — lookup only"`, `"no match line"`.
- **K6** `commandMatchesKey(["git show", ":"], "git show origin/master:src/x.ts")` → true, and
  `commandMatchesKey(["git show", ":"], "cat a:b && git show")` → false.
- **K7** `commandMatchesKey(["gh pr view", "--json headRefOid"], "gh  pr view 12\n  --json headRefOid,mergeStateStatus")` → true.
- **K8** `commandMatchesKey(["git show"], "Git Show HEAD")` → false.
- **K9** `readTriggerKeys` → `[]` for an absent path and for a file holding `not json`; for a file holding
  `{"generated_at":"x","keys":[{"id":1,"fragments":["git show"]}]}` → `[{ id: 1, fragments: ["git show"] }]`.
- **K10** `matchingKeyIds([{id:5,fragments:["git show"]},{id:9,fragments:["git show","origin/main:"]},{id:3,fragments:["git show"]},{id:7,fragments:["tar -x"]}], "git show origin/main:a.ts")` → `[9, 3, 5]`.

Store rows (temp DB):
- **W1** Seed: A = `"[EXPERIENCE] a\nMATCH: command: \`git show <ref>:<path>\`\nACTION: use a forward slash in the path"`;
  B = `"MATCH: path: src/x.ts"`; C = a command-keyed entry with `archived_into` set to A's id; D =
  `"MATCH: command: \`npm ci\`"`. `writeTriggerKeys(db, p)` returns `{ written: 1, unusable: 1 }`, and the file's
  `keys` is exactly `[{ id: A, fragments: ["git show", ":"] }]`. No `.tmp-` file is left in the directory.
- **R1** Store with A. `runTrigger({ db, sessionUuid: "s1", command: "git show origin/master:src/a.ts", policy, keyIds: [A] })`
  → `state "injected"`, `ids [A]`, `additionalContext` contains `[stored knowledge ${A}` and `use a forward slash in
  the path`. The `trigger_fires` row's `query` is `match:${A}`.
- **R2** Run R1's call twice in session `s1`: the second is `silent`, `ids []`, query `match:${A}`. The same call in
  session `s2` is `injected` again.
- **R3** Policy `relevance_floor: -1000`. Seed A and E, where E = `"[EXPERIENCE] e\nACTION: read PIPESTATUS, not the tail exit code"`.
  Command `git show a:b | tail -3; echo $?`, keyIds [A] → `injected`, `ids [E]` (the element hit fills the one slot;
  A is not injected).
- **R4** `silent`, with query `match:<id>`, for each of: keyIds [C] (archived); keyIds [B] (no command key in its
  content); keyIds [A] with command `git log --oneline` (its key does not match).
- **R5** keyIds `[]`, command `git status` → `not-asked`, query `""` (unchanged).

Hook rows (spawn the hook as `t159-fast-path.test.ts` does):
- **H1** DB seeded with A; sidecar written with `writeTriggerKeys` to `triggerKeysPath(dbPath)`; Bash
  `git show origin/master:src/a.ts`, session `h1` → exit 0, stdout parses and its `additionalContext` contains
  `[stored knowledge ${A}`.
- **H2** The same store, sidecar ABSENT → exit 0, stdout `""`, exactly one line in the pending file (the fast path).
- **H3** DB ABSENT, a sidecar file present in its directory holding `{"generated_at":"x","keys":[{"id":1,"fragments":["git show",":"]}]}`.
  `git status --porcelain` through the load spy (`load-spy.cjs`, as N1 does) → heavy all false, one pending line.

Server rows (harness of `tests/pipelines/store/t022-state-replace.test.ts`: `server.handleStore` with
`OPEN_BRAIN_VAULT_DIR` on a temp dir; the sidecar is `triggerKeysPath(process.env.KNOWLEDGE_V2_DB!)`):
- **S1** `handleStore({ content: "[EXPERIENCE] s1\nMATCH: command: \`git switch -c <b> origin/master\`\nACTION: x", key: <unique>, kind: "event" })`
  → the reply contains `— match: command (the recall trigger reads it)`, and the sidecar's `keys` holds the new id
  with `["git switch -c", "origin/master"]`.
- **S2** The same with no MATCH line → `— lookup-only: no MATCH: line (D-155)`; with `MATCH: error: "boom"` →
  `— match: error (stored; the trigger does not read error keys yet)`; with `MATCH: command: \`npm ci\`` →
  `— match: command line present but under 6 characters, so lookup-only`.
- **S3** A `kind: "state"` store's reply contains none of `— match:` / `— lookup-only`.

Docs row:
- **E1** Each of the three `end.md` copies contains `**The recall\ntrigger reads \`MATCH: command:\`** (T-170)` and none contains `Nothing reads`.

**Expected at commit 1 (the base):** every K, W, R, H and S row and E1 RED, except **R5, H2, H3 and S3**, which pass
at the base and guard what must not change: R5 is today's not-asked path, H2 and H3 are today's fast path (the base
hook reads no sidecar), and S3 is a state store's reply.

## Existing tests (verdicts)

- `tests/trigger/t159-fast-path.test.ts` **N1b**: its `allowed` regex names four fast-path modules. In **commit 2**,
  add `trigger\/match-keys` to that alternation, and change the row title's "one of the four fast-path modules" to
  "one of the five fast-path modules". This is the ONLY existing row that changes. N1 and the T-286 row stay
  byte-identical and green (the sidecar is absent in their temp dirs).
- Everything else in `tests/trigger/`, `tests/pipelines/store/`, `tests/t235-p2-5-cursor-recall.test.ts`,
  `tests/t243-audit-lows.test.ts`, `tests/setup-hooks.test.ts` and `tests/pipelines/sync/mirror-parity.test.ts`
  stays green unchanged. No existing test asserts the full `Stored knowledge` reply string, and none pins the
  replaced end.md lines (planner grep at 69fd20f1). Any other row that turns red: STOP, `BLOCKED T-170 <test name>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t170-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. Fresh clone into `(Join-Path $env:TEMP "t170-wt")` unless the launcher named one;
   `git checkout -q -b feat/t170-match-keys <base>`; `rev-parse HEAD` = base; porcelain empty.
   `git ls-tree --name-only HEAD docs/loops/t170-match-keys-brief.md` prints the path (else STOP,
   `BLOCKED T-170 base lacks the brief`). `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`.
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name, and any read or write of `~/.claude/open-brain/` (the tests
   use temp stores only).
3. **Commit 1, `T-170: rows for MATCH: command: keys in the recall trigger`:** the new test file only. `$env:NO_COLOR='1'`;
   in `open-brain`: `npx vitest run tests/trigger/t170-match-keys.test.ts --no-file-parallelism --testTimeout=180000`.
   Exactly the rows above are red (R5, H2, H3 and S3 green). Paste the summary and the `x` rows.
4. **Commit 2, `T-170: the recall trigger reads a lesson's MATCH: command: key, once per session (D-155)`:** rulings
   1-7 plus the N1b change. Run
   `npx vitest run tests/trigger tests/pipelines/store tests/t235-p2-5-cursor-recall.test.ts tests/t243-audit-lows.test.ts tests/setup-hooks.test.ts tests/pipelines/sync/mirror-parity.test.ts --no-file-parallelism --testTimeout=180000`
   (cap 30 min; all green), then `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), and
   `npm run build` (exit 0). Paste all of it.
5. Each commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline <base>..HEAD`
   shows 2 lines; porcelain empty.
6. **Mutants** (edit, run `npx vitest run tests/trigger/t170-match-keys.test.ts --no-file-parallelism --testTimeout=180000`,
   paste the summary and the `x` rows, `git checkout -- <file>`, porcelain empty; never commit one). Paste each
   mutant's `git diff` line before trusting its run. Git Bash collapses doubled backslashes in command text, so make
   the edits with the editor or PowerShell.
   - **M1** match-keys.ts `commandMatchesKey`: replace the ordered loop with `return fragments.every((f) => c.includes(f));`
     (`c` = the collapsed command). Expect **K6** red.
   - **M2** `MATCH_KEY_MIN_CHARS = 6` → `0`. Expect **K4** red, and W1 and the npm-ci part of S2.
   - **M3** match-keys.ts: in `parseCommandKey`, ignore the backticked span (always take the cut-at-`" ("` text).
     Expect **K1, K3, K4** red (planner pre-run: exactly these three among the K rows).
   - **M4** run.ts: drop the `already` (injectedIds) check. Expect **R2** red.
   - **M5** run.ts: keep a keyed row without the `parseCommandKey`/`commandMatchesKey` re-test (trust the sidecar).
     Expect **R4** red (its B and non-matching parts).
   - **M6** cli-recall-trigger.ts: take the not-asked path on `deriveQuery(command) === ""` alone (ignore `keyIds`).
     Expect **H1** red.
7. `git diff --name-only <base>..HEAD` shows exactly: `.claude/commands/end.md`, `open-brain/src/cli-recall-trigger.ts`,
   `open-brain/src/cli-session-end.ts`, `open-brain/src/cli.ts`, `open-brain/src/server.ts`,
   `open-brain/src/trigger/keys-writer.ts`, `open-brain/src/trigger/match-keys.ts`, `open-brain/src/trigger/run.ts`,
   `open-brain/tests/trigger/t159-fast-path.test.ts`, `open-brain/tests/trigger/t170-match-keys.test.ts`,
   `project-template/.claude/commands/end.md`, `project-template/.cursor/commands/end.md`.
8. `git push origin feat/t170-match-keys` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr create --base master --head feat/t170-match-keys --title "T-170: the recall trigger reads a lesson's MATCH: command: key, once per session (D-155)" --body "Brief: docs/loops/t170-match-keys-brief.md. Code PR (src): needs a QA ACCEPT and Aaron's word naming it."`;
   `gh pr checks <n> --watch --interval 30` (cap 25 min); paste the `test` conclusion.

## After the merge (planner, not this run)

Clark rebuilds main once; seats reconnect; the planner runs `open-brain trigger-keys` once against the live store and
a live check that FAILS on the pre-merge build: a scratch store holding A, then the main build's hook on
`git show origin/master:x` must inject A once and stay silent the second time. Then the planner hand-keys the
costliest known lessons (D-155) and watches `trigger_fires` for `match:` rows.

## Reply

- **First line:** `READY T-170 <sha40> PR #<n>` or `BLOCKED T-170 <reason>`.
- Then each command with its output. Mark anything not run `NOT RUN`. Do not merge.
