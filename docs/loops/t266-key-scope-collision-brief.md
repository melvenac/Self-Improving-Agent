# T-266: a key another scope already holds is refused, not silently re-pointed

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code PR (src): QA and Aaron's word come after READY.
Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t266-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-266 (P2). **Tag:** `T-266`. **Size:** SMALL.
**Base:** `7bdf24839263887172b75df3dfdb489bb4c3cb9d` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: store storeFailure handleStore writeFailure StoreResult (open-brain/src/pipelines/store/index.ts, open-brain/src/server.ts, open-brain/src/vault-writer.ts)
```

## Planner ruling: (A) refuse, with sub-rulings (1) and (2) YES (Atlas, s170). (B) below is recorded as rejected.

- **(A) Refuse. Recommended, and this brief is written for it.** `store()` refuses a key that a row already holds
  under a different vault path, before any file is written. The reply names the entry, its scope and its path, and
  gives the fix (another key, or `ob_forget` that id). There is no schema change and no migration, and keys keep the
  meaning the table already gives them: `key TEXT NOT NULL UNIQUE`, global, at db-v2.ts:122.
- **(B) Scope the uniqueness** to key + scope. Not recommended. Its cost:
  - The table has to be rebuilt, because SQLite cannot drop the column-level UNIQUE at db-v2.ts:122.
  - The content-backed FTS and its ki_ai, ki_ad and ki_au triggers (db-v2.ts:208-229) have to be rebuilt with ids
    preserved, since feedback_log and recall_log join by id and have no FK (db-v2.ts:427-434).
  - SCHEMA_VERSION has to be bumped (db-v2.ts:287).
  - The conflict target moves to an expression index, because NULL project_dir values never collide under UNIQUE.
  - Every key-only lookup has to take a scope: server.ts:997; ob_forget by key at server.ts:1128 and :1140, which
    would otherwise delete one entry per scope at once; and ob_store_chunk's plain INSERT at server.ts:1452.
  - That is a live-data migration plus a semantic change to "key" across every seat.
- **Sub-rulings, both recommended YES:**
  - (1) `storeFailure` gets the same guard. It has no production caller (only `tests/pipelines/store/index.test.ts`
    uses it), but it writes rows through the same ON CONFLICT(key).
  - (2) ob_store's tool description gains one sentence stating the rule.
- **The orphaned-note check already exists, so no new check is ruled.** `checkVaultIndexParity` (/sync
  `vault-index-parity`, checks-memory.ts:44-107) reports this exact orphan shape as a "duplicate note" (same basename
  under two folders, :81-98), and the first-hand proof below shows it doing so. It is tested at
  `tests/pipelines/sync/checks.test.ts` ("reports a duplicate when the same note is filed under two folders").

## Why (first-hand proof, planner fork, s170)

The proof ran on the main build c1975286, whose `pipelines/store/index.ts`, `db-v2.ts` and `vault-writer.ts` are
byte-identical to the base (`git diff --stat c1975286 7bdf2483 -- <those three>` is empty). It used a temp DB and a
temp vault. `store()` was called with key `k266` as a global state, then with the same key as a project state:

```text
store 1 (General, global) -> {"vaultPath":"<vault>/Experiences/General/k266.md"}
rows after 1: [{"id":1,"vault_path":"<vault>/Experiences/General/k266.md","project_dir":null,"content":"global body"}]
store 2 (Proj-B, project) -> {"vaultPath":"<vault>/Experiences/Proj-B/k266.md"}
rows after 2: [{"id":1,"vault_path":"<vault>/Experiences/Proj-B/k266.md","project_dir":"c:/proj/b","content":"project body"}]
<vault>/Experiences/General/k266.md exists: true | has ## Log: false
<vault>/Experiences/Proj-B/k266.md exists: true | has ## Log: false
vault-index-parity: warn | 1 duplicate note(s) — same note filed under two folders, so the vault holds two copies of one experience: Experiences/General/k266.md
```

The second store reported success, re-pointed entry 1 to the new note, overwrote its content and left the global note
unindexed. Even a `state` gets no `## Log`. The path is `store()` → `writeExperience` (a new path, so it writes) →
`indexKnowledge` ON CONFLICT(key) DO UPDATE `vault_path = excluded.vault_path` (db-v2.ts:446-472). `store()` is the
only production caller (server.ts:954, `handleStore`).

**Legitimate re-points stay untouched:**
- `relocate.ts` moves notes and rows with its own `UPDATE ... SET vault_path` (relocate.ts:170-182), not through
  `store()`.
- `indexKnowledge`'s own upsert keeps re-pointing for a deliberate caller. `tests/index-upsert.test.ts` pins that
  contract (entry 416), and this brief does not change db-v2.ts.

## Ruling (exact)

**1. `open-brain/src/pipelines/store/index.ts`**
- Add `failurePath,` to the `../../vault-writer.js` import list.
- In `interface StoreResult`, after `unchanged?: true;`, add:
  ```ts
  /**
   * T-266: the key already belongs to a row indexing a DIFFERENT note (another
   * scope, another project, or a chunk). Nothing was written.
   */
  keyHeldBy?: { id: number; vaultPath: string; projectDir: string | null };
  ```
- After `interface KnownRow { ... }`, add (not exported):
  ```ts
  /**
   * T-266: the row holding `key` when it indexes a note other than `target`.
   * Paths compare slash- and case-insensitively, as the dedup lookup in `store`
   * does. Undefined when no row holds the key, or the row is this note's own.
   */
  function keyHeldElsewhere(
    db: Database.Database,
    key: string,
    target: string,
  ): { id: number; vaultPath: string; projectDir: string | null } | undefined {
    const row = db
      .prepare("SELECT id, vault_path, project_dir FROM knowledge_index WHERE key = ?")
      .get(key) as { id: number; vault_path: string; project_dir: string | null } | undefined;
    if (!row) return undefined;
    const norm = (p: string) => p.replace(/\\/g, "/").toLowerCase();
    if (norm(row.vault_path) === norm(target)) return undefined;
    return { id: row.id, vaultPath: row.vault_path, projectDir: row.project_dir };
  }
  ```
- In `store()`, directly after `const source = input.source ?? 'ob_store';` and before `const note`, add:
  ```ts
  // T-266: `key` is UNIQUE across every scope (db-v2.ts knowledge_index), so a
  // key that another scope, another project or a chunk already holds would
  // reach indexKnowledge's ON CONFLICT(key), which re-points that row to this
  // note, overwrites its content and leaves its own note unindexed. Refuse
  // before any file is written. A row holding this key at THIS note's path (a
  // T-022 state replace, a duplicate, an adoption) passes untouched.
  const held = keyHeldElsewhere(db, key, experiencePath(vaultDir, project, key));
  if (held) return { vaultPath: null, keyHeldBy: held };
  ```
  `experiencePath` runs before anything else, so a bad project segment still throws `VaultPathRefusal` first, as
  `writeExperience` did.
- In `storeFailure()`, directly after its destructuring line, add:
  ```ts
  // T-266: the same refusal as `store`, on the key this function indexes.
  const held = keyHeldElsewhere(db, `failure-${key}`, failurePath(vaultDir, project, key));
  if (held) return { vaultPath: null, keyHeldBy: held };
  ```

**2. `open-brain/src/vault-writer.ts`**
- Directly above the `// ─── writeFailure` divider, add:
  ```ts
  /**
   * Where a failure note for this key lives. Exported so `storeFailure` can check
   * the key against it before writing (T-266).
   */
  export function failurePath(vaultDir: string, project: string, key: string): string {
    const projectSeg = safeVaultPathSegment("project", project);
    const experiencesDir = join(vaultDir, "Experiences");
    return joinUnderVaultDir(experiencesDir, projectSeg, `failure-${slugify(key)}.md`);
  }
  ```
- In `writeFailure`, replace its first four lines (`const keySlug ...` through `const filePath = joinUnderVaultDir(...)`)
  with `const filePath = failurePath(vaultDir, input.project, input.key);`. Nothing else in the function used
  `keySlug`, `projectSeg` or `experiencesDir`.

**3. `open-brain/src/server.ts`**
- The ob_store description (server.ts:888) becomes exactly:
  `"Store a piece of knowledge. By default stored globally. Set scope to 'project' and pass project_dir to scope it. A key is unique across every scope: a key another scope (or a chunk) already holds is refused, not moved."`
- In `handleStore`, directly before `if (result.vaultPath === null) {`, add:
  ```ts
  if (result.keyHeldBy) {
    const held = result.keyHeldBy;
    const heldScope = held.projectDir ? `project: ${held.projectDir}` : "global";
    return {
      content: [{
        type: "text" as const,
        text:
          `Not stored — key "${effectiveKey}" already belongs to entry ${held.id} (${heldScope}) at ${held.vaultPath}. ` +
          `A key is unique across every scope, so storing it${scopeLabel} would move that entry and orphan its note. ` +
          `Nothing was written. Store under a different key, or use ob_forget (id: ${held.id}) first if you meant to move it.`,
      }],
    };
  }
  ```

**Do not touch** these retirements-pinned lines. They are in the same files and are content-hashed in
`.agents/retirements.json`:
- store/index.ts:89 and :110
- vault-writer.ts:41, :98 and :101
- server.ts:478, 618, 1049, 1061, 1077, 1101, 1124, 1206, 1250, 1293, 1294 and 1456 (at 7bdf2483; master moved server.ts by +15 lines after #678 and #685, so if your base differs, find them by their R-0xx hashes rather than these numbers)

New code, comments and test text must contain no retired pattern from that file (for example `progenitor`,
`success_rate`, `skill-scan`, `db.ts`, `mailbox`, `apoptosis`): `retirements-live.test.ts` fails on any unexpected
referrer.

**4. New test file `open-brain/tests/pipelines/store/t266-key-scope.test.ts`**

Use the harness of `tests/pipelines/store/t022-state-replace.test.ts`:
- Import the modules as `dbV2`, `storePipeline`, `vaultWriter` and `server`.
- Per test, create a temp dir with `fs.mkdtempSync(path.join(os.tmpdir(), "t266-"))` and a vault inside it, then
  `db = dbV2.openV2Database(path.join(tmp, "knowledge-v2.db"))`. Close and `rmSync` both in `afterEach`.
- Add the helpers:
  - `put(key, content, project, projectDir = null, factKind = null)` calls `storePipeline.store` with
    `tags: ["t266"]`.
  - `rowsFor(key)` returns `SELECT id, key, vault_path, project_dir, content FROM knowledge_index WHERE key = ?`.
  - `note(project, key)` is `vaultWriter.experiencePath(vaultDir, project, key)`.
- Do not import `failurePath` or anything else new: commit 1 must load at the base.

Rows:
- **K1: global, then another project, is refused.**
  - `put("k1-266", "global body", "General")`, then `second = put("k1-266", "project body", "Proj-B", "c:/proj/b")`.
  - `second.vaultPath` is null.
  - `second.keyHeldBy` equals `{ id: <the row's id>, vaultPath: note("General","k1-266"), projectDir: null }`.
  - `fs.existsSync(note("Proj-B","k1-266"))` is false.
  - There is exactly one row, still at `note("General","k1-266")` with content `global body` and project_dir null.
- **K2: a project, then global, is refused.**
  - `put("k2-266", "project body", "Proj-A", "c:/proj/a")`, then `second = put("k2-266", "global body", "General")`.
  - `second.keyHeldBy.projectDir` is `"c:/proj/a"` and its `vaultPath` is `note("Proj-A","k2-266")`.
  - The General note does not exist.
  - The row is unchanged: project_dir `c:/proj/a`, content `project body`.
- **K3: a state across two projects is refused, not replaced.**
  - `put("k3-266", "alpha", "Proj-A", "c:/proj/a", "state")`, then the same key with `"bravo"`, `"Proj-B"`,
    `"c:/proj/b"`, `"state"`.
  - `keyHeldBy` is defined and `replaced` is undefined.
  - `note("Proj-A","k3-266")` contains `alpha` and does not contain `## Log`.
  - The row content is `alpha`.
- **K4: a key held by a chunk-shaped row is refused.**
  - Call `dbV2.indexKnowledge(db, { vaultPath: path.join(vaultDir, "Checkpoints", "2026-10-13-general-k4-266.md"), key: "k4-266", content: "chunk body", tags: "checkpoint", source: "checkpoint" })`.
    No file is needed.
  - Then `r = put("k4-266", "experience body", "General")`.
  - `r.keyHeldBy.vaultPath` is that Checkpoints path.
  - `note("General","k4-266")` does not exist.
  - The row content is `chunk body`.
- **K5: the same note, with a path that differs only by case and slashes, is not refused.**
  - `target = note("General","k5-266")` and `variant = target.split(path.sep).join("/").toUpperCase()`.
  - Call `dbV2.indexKnowledge(db, { vaultPath: variant, key: "k5-266", content: "old", tags: "" })`, then
    `r = put("k5-266", "new body", "General")`.
  - `r.keyHeldBy` is undefined and `r.vaultPath` equals `target`.
  - There is one row, with vault_path `target` and content `new body`.
- **K6: a plain duplicate in the same scope stays the existing dedup.**
  - `put("k6-266", "one", "General")`, then `again = put("k6-266", "two", "General")`.
  - `again.vaultPath` is null and `again.keyHeldBy` is undefined.
- **K7: storeFailure across projects is refused.**
  - Call `storePipeline.storeFailure({ db, vaultDir, key: "f7-266", tags: ["t266"], attempted: "a", whyFailed: "w", whatWorked: "x", project: "General" })`,
    then the same call with `project: "Proj-B"`.
  - The second call's `vaultPath` is null and its `keyHeldBy.vaultPath` equals the first call's `vaultPath`.
  - `path.join(path.dirname(path.dirname(first.vaultPath!)), "Proj-B", "failure-f7-266.md")` does not exist.
- **H1 (separate describe, t022's handleStore harness): the reply.**
  - Set `OPEN_BRAIN_VAULT_DIR` to a temp vault and use a random `tag`, with `key = \`K266-${tag}\``.
  - `first = textOf(await server.handleStore({ content: "global body t266", key }))`. Read the id with
    `/\(id: (\d+)\)/`.
  - `projDir = fs.mkdtempSync(path.join(os.tmpdir(), "t266-proj-"))`, then
    `text = textOf(await server.handleStore({ content: "project body t266", key, scope: "project", project_dir: projDir }))`.
  - `text` contains `Not stored — key "${key}" already belongs to entry ${id} (global) at ` and
    `Nothing was written. Store under a different key, or use ob_forget (id: ${id}) first if you meant to move it.`
  - `fs.readdirSync(path.join(vaultDir, "Experiences"))` equals `["General"]`.
  - Remove `projDir` in a `finally`.

## Existing tests (planner-fork-read at 88b2c8d4; at 7bdf2483 only server.ts differs, outside these rows; verdicts)

- `tests/index-upsert.test.ts`, all rows (the entry-416 re-point contract on `indexKnowledge`): **stay green**.
  db-v2.ts is not edited.
- `tests/pipelines/store/index.test.ts` (write, dedup, storeFailure): **stay green**. The same path passes the guard,
  and a first storeFailure meets no row.
- `tests/pipelines/store/t022-state-replace.test.ts` R1-R7, R6 and the R4 replies: **stay green**. The same key at the
  same path passes the guard. R4's "another key on the same note path" has a new key, so the guard passes it, and the
  existing path refusal still answers.
- `tests/audit-fix-a3-r2.test.ts` ("store() path refusal surfaces as VaultPathRefusal"): **stays green**, because
  `experiencePath` throws first.
- `tests/relocate.test.ts` and `tests/t249-worktree-identity.test.ts` (WT-6/WT-7 relocate, and the ob_store MCP row
  into a fresh DB): **stay green**. Relocate does not go through `store()`.
- `tests/pipelines/sync/checks.test.ts` (the `checkVaultIndexParity` rows): **stays green**; it is untouched.
- `tests/pipelines/sync/retirements-live.test.ts`: **stays green** as long as no pinned line is edited and no retired
  pattern is added.
- Any other newly failing row: STOP, `BLOCKED T-266 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t266-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.** Work in the fresh clone the launcher named. If it named none, run
   `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t266-wt")` and
   `Set-Location` into it.
   - Run `git checkout -q -b fix/t266-key-scope 7bdf24839263887172b75df3dfdb489bb4c3cb9d`. `git rev-parse HEAD` must
     print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED.
   - In `open-brain`, run `npm ci`, then `node -e "require('better-sqlite3')"`. If that fails with "Could not locate
     the bindings file", run `npm rebuild better-sqlite3` and say so.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout,
     `npm run test:heavy`, and killing any process by name.
3. **Commit 1, `T-266: failing tests: a key another scope holds is refused, not re-pointed`:** the new test file only.
   - Run `npx vitest run tests/pipelines/store/t266-key-scope.test.ts --no-file-parallelism --testTimeout=180000` in
     `open-brain` and paste it.
   - Expected: `6 failed | 2 passed (8)`. K1, K2, K3, K4, K7 and H1 fail; K5 and K6 pass.
   - If the result differs, fix only the TEST, at most twice, then STOP: `BLOCKED T-266 commit-1 <row>`.
4. **Commit 2, `T-266: refuse a store whose key another scope already holds, before any note is written`:** the three
   src files, exactly as ruled. Then run, in `open-brain`:
   `npx vitest run tests/pipelines/store/t266-key-scope.test.ts tests/pipelines/store/index.test.ts tests/pipelines/store/t022-state-replace.test.ts tests/index-upsert.test.ts tests/audit-fix-a3-r2.test.ts tests/relocate.test.ts tests/pipelines/sync/checks.test.ts tests/pipelines/sync/retirements-live.test.ts tests/t249-worktree-identity.test.ts --no-file-parallelism --testTimeout=180000`
   Everything must be green; paste it. Kill only node children you started yourself, by recorded PID.
   - If a file other than t266 fails, prove whether it fails at the base too: `git switch --detach 7bdf2483`, run
     that one file, `git switch fix/t266-key-scope`, and paste both runs.
5. Both commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline 7bdf2483..HEAD` shows 2 lines, and `git status --porcelain` is empty. `npx tsc --noEmit` in
   `open-brain` exits 0; paste it.
6. **Mutants.** For each: edit, run the files named, paste the output (`grep -a` or no grep), then
   `git checkout -- <file>` and confirm a clean tree. Never commit a mutant.
   - **M1** `store/index.ts` `keyHeldElsewhere`: `if (!row) return undefined;` becomes `return undefined;`. K1 fails.
   - **M2** the same function: `if (norm(row.vault_path) === norm(target)) return undefined;` becomes
     `if (row.vault_path === target) return undefined;`. K5 fails.
   - **M3** `server.ts`: delete the whole `if (result.keyHeldBy) { ... }` block. H1 fails.
   - **M4** `store()`: move the two guard lines (`const held = ...` and `if (held) return ...`) to directly after
     `const vaultPath = writeExperience(vaultDir, note);`. K1 fails on the Proj-B note existing.
   - **M5** `storeFailure()`: delete its two guard lines. K7 fails.
   - **M6** `keyHeldElsewhere`: delete the line `if (norm(row.vault_path) === norm(target)) return undefined;`. Run
     the t266 AND t022 files: K6 fails, and T-022 R1 fails.
7. `git diff --name-only 7bdf2483..HEAD` must show exactly:
   - `open-brain/src/pipelines/store/index.ts`
   - `open-brain/src/server.ts`
   - `open-brain/src/vault-writer.ts`
   - `open-brain/tests/pipelines/store/t266-key-scope.test.ts`

   Anything else: STOP, BLOCKED.
8. `git push origin fix/t266-key-scope` (never force). `git ls-remote origin refs/heads/fix/t266-key-scope` must equal
   `git rev-parse HEAD`. Then run
   `gh pr create --base master --head fix/t266-key-scope --title "T-266: refuse a store whose key another scope already holds" --body "Brief: docs/loops/t266-key-scope-collision-brief.md. Code PR (src)."`
   Wait for CI (`gh pr checks <n> --watch --interval 30`, capped at 20 min) and paste the `test` conclusion.

## Not in scope (named so nobody widens it)

- ob_store_chunk's plain INSERT (server.ts:1452-1457) still raises a raw UNIQUE error on a key that already exists.
  That is a separate defect.
- Past re-points already in the live store show up in /sync `vault-index-parity` as duplicates. Triaging them is the
  planner's job, not this run's.
- `norm()` lowercases, as the existing dedup lookup does (store/index.ts:120). On a case-sensitive file system, two
  project folders that differ only by case therefore count as one note. The fleet's hosts are Windows.

## Reply

- The first line is `READY T-266 <sha40> PR #<n>` or `BLOCKED T-266 <reason>`.
- Then each command with its output: both vitest runs, tsc, the six mutants, the name-only diff,
  `ls-remote` = `rev-parse`, the PR URL and CI.
- Name any HIGH, CRITICAL or UNKNOWN target from the launcher's impact block, and say which rows cover its callers.
- **Paste test output with `grep -a`, or without grep.** Mark anything not run `NOT RUN`.
- If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
