# T-285: ob_store_chunk refuses a key or a file another entry holds, before writing anything

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC or laptop one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t285-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-285 (P3). **Tag:** `T-285`. **Size:** SMALL.
**Base:** the dispatch SHA clark names (it must contain #710's merge `4651ca9e`, which also edits server.ts: check with
`git merge-base --is-ancestor 4651ca9e <base>`, else BLOCKED). If clark names none, `origin/master` after the fetch.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: handleStoreChunk (open-brain/src/server.ts; the ob_store_chunk tool handler; covered by tests/t003-session-proof.test.ts, tests/audit-fix-a3.test.ts, tests/t249-worktree-identity.test.ts and the new t285 file)
```

## Why

T-285 (read its note). `handleStoreChunk` (server.ts, the `ob_store_chunk` handler) writes the vault markdown file
FIRST and then runs a plain `INSERT INTO knowledge_index` with no conflict handling. `knowledge_index.key` and
`vault_path` are both `UNIQUE` (db-v2.ts:121-122). So a chunk whose key another entry already holds (an `ob_store`
experience, another chunk, any scope) fails with SQLite's raw `UNIQUE constraint failed: knowledge_index.key`, thrown
through the MCP transport, AFTER its file is on disk: an orphan note nothing indexes. T-266 (merged tonight, #701) gave
`ob_store` a clear refusal for the same collision; this gives `ob_store_chunk` one, and moves it before the write.

## Ruling (exact; `open-brain/src/server.ts`, `handleStoreChunk` only)

Directly after `const vaultPath = join(v2VaultDir(), categoryDir, fileName);` and BEFORE `const tagList = ...` (so before
`mkdirSync`/`writeFileSync`), insert:

```ts
  // T-285: key and vault_path are UNIQUE in knowledge_index (db-v2.ts). A chunk whose key or whose file another entry
  // already holds would fail the INSERT below with SQLite's raw message, after its file was written. Refuse first,
  // naming the holder, and write nothing.
  const heldKey = v2db.prepare("SELECT id, vault_path, project_dir FROM knowledge_index WHERE key = ?").get(key) as
    | { id: number; vault_path: string; project_dir: string | null }
    | undefined;
  if (heldKey) {
    const scope = heldKey.project_dir ? `project: ${heldKey.project_dir}` : "global";
    return {
      content: [{
        type: "text" as const,
        text: `ob_store_chunk refused: key "${key}" already belongs to entry ${heldKey.id} (${scope}) at ${heldKey.vault_path}. A key is unique across every scope and kind. Nothing was written. Store under a different key, or use ob_forget (id: ${heldKey.id}) first if you meant to replace it.`,
      }],
      isError: true,
    };
  }
  const heldPath = v2db.prepare("SELECT id, key FROM knowledge_index WHERE vault_path = ?").get(vaultPath) as
    | { id: number; key: string }
    | undefined;
  if (heldPath || existsSync(vaultPath)) {
    const holder = heldPath ? `entry ${heldPath.id} (key "${heldPath.key}")` : "a file no entry indexes";
    return {
      content: [{
        type: "text" as const,
        text: `ob_store_chunk refused: ${vaultPath} is already ${heldPath ? "indexed as " : "on disk as "}${holder}. Nothing was written. Use a different key or a phase.`,
      }],
      isError: true,
    };
  }
```

Import `existsSync` from `node:fs` if server.ts lacks it. Nothing else changes: the INSERT, the provenance link and the
success text stay as they are. Do NOT touch any retirements-pinned line (`.agents/retirements.json` hashes server.ts
lines; the new text must contain no retired word, e.g. no `progenitor` spelled out: the INSERT's existing literal is
pinned, leave it).

## New rows (commit 1; new file `open-brain/tests/t285-chunk-key.test.ts`)

Harness: as `tests/audit-fix-a3.test.ts` does it. Set `process.env.OPEN_BRAIN_VAULT_DIR` to a fresh `mkdtempSync` dir per
row (restore it in `afterEach`); the DB is the per-worker temp DB `tests/setup-env.ts` sets. Use a random suffix in
every key (`const tag = Math.random().toString(36).slice(2, 8)`), so rows never collide with each other.
`const text = (r) => r.content[0]?.text ?? ""`.

- **K1: a chunk over an `ob_store` key is refused, and no file is written.**
  - `await handleStore({ content: "experience body t285", key: \`K285-\${tag}\` })` (import `handleStore` from
    `../src/server.js`); read its id with `/\(id: (\d+)\)/`.
  - `r = await handleStoreChunk({ content: "chunk body", key: \`K285-\${tag}\`, category: "note" })`.
  - `r.isError` is true; `text(r)` contains `ob_store_chunk refused: key "K285-${tag}" already belongs to entry ${id} (global)`
    and `Nothing was written.`
  - The `Chunks` folder under the vault holds no file whose name contains the slug of `K285-${tag}` (or does not exist).
- **K2: a second chunk with the same key is refused.** Store a chunk with key `C285-${tag}` (category `note`; success),
  then the same key again with different content: refused, text contains `already belongs to entry`, and the first
  chunk's file still holds the first content.
- **K3: an orphan file at the chunk's path is refused, and kept byte for byte.** Compute the path the handler would use:
  store nothing first; write `OPEN_BRAIN_VAULT_DIR/Chunks/<today>-general-<slug>.md` by hand with `orphan\n`, where
  `<today>` is `new Date().toISOString().slice(0, 10)` and `<slug>` is the handler's `slugify` of `O285-${tag}`
  (import `slugify` from wherever server.ts imports it). Then `handleStoreChunk({ content: "x", key: \`O285-\${tag}\`, category: "note" })`:
  refused, text contains `is already on disk as a file no entry indexes`, and the file still reads `orphan\n`.
- **K4: a fresh key still stores** (the success text starts `Chunk stored (id: `), so the guard does not refuse
  everything.

**Expected at commit 1 (the base src):** K1 and K2 RED (the handler throws a raw UNIQUE error: the row fails on the
throw or on `isError`; paste it). K3 RED (the base overwrites the orphan and stores). K4 GREEN. Any other outcome:
STOP, BLOCKED.

## Existing tests (verdicts)

- `tests/t003-session-proof.test.ts` (`t003-bad`, `t003-good` chunk rows), `tests/audit-fix-a3.test.ts`,
  `tests/t249-worktree-identity.test.ts`: **stay green** (each uses a key no other row holds).
- `tests/pipelines/sync/retirements-live.test.ts`, `tests/harness/s4-guards.test.ts`: **stay green**.
- Any other newly failing row: STOP, `BLOCKED T-285 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t285-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. **Start state.** Fresh clone into `(Join-Path $env:TEMP "t285-wt")` unless the launcher named one;
   `git checkout -q -b fix/t285-chunk-key-refusal <base>`; `rev-parse HEAD` = base; porcelain empty; the ancestor check.
   `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"` (else `npm rebuild better-sqlite3`).
   **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
   `npm run test:heavy`, killing any process by name.
3. **Commit 1, `T-285: rows for a chunk key or file another entry holds`:** the new test file. In `open-brain`:
   `npx vitest run tests/t285-chunk-key.test.ts --no-file-parallelism --testTimeout=180000`. Exactly K1, K2, K3 red. Paste.
4. **Commit 2, `T-285: ob_store_chunk refuses a held key or file before writing`:** the ruling. Run
   `npx vitest run tests/t285-chunk-key.test.ts tests/t003-session-proof.test.ts tests/audit-fix-a3.test.ts tests/t249-worktree-identity.test.ts tests/pipelines/sync/retirements-live.test.ts tests/harness/s4-guards.test.ts --no-file-parallelism --testTimeout=180000`
   (all green) and `npx tsc --noEmit` (exit 0). Paste both.
5. End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline <base>..HEAD`
   shows 2 lines; porcelain empty.
6. **Mutants** (server.ts; edit, run the t285 file only, paste failing rows, `git checkout -- <file>`, porcelain empty):
   - **M1:** delete the `if (heldKey) { ... }` block. Expect K1, K2 red.
   - **M2:** `if (heldPath || existsSync(vaultPath))` → `if (heldPath)`. Expect K3 red.
   - **M3:** move the whole inserted block to just after `writeFileSync(vaultPath, fileContent, "utf-8");`. Expect K1
     red (a file appears) and K3 red (the orphan is overwritten).
7. `git diff --name-only <base>..HEAD` shows exactly `open-brain/src/server.ts` and `open-brain/tests/t285-chunk-key.test.ts`.
8. `git push origin fix/t285-chunk-key-refusal` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr create --base master --head fix/t285-chunk-key-refusal --title "T-285: ob_store_chunk refuses a held key or file before writing" --body "Brief: docs/loops/t285-chunk-key-refusal-brief.md. Code PR (src): needs a QA ACCEPT and Aaron's word naming it."`;
   `gh pr checks <n> --watch --interval 30` (cap 20 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-285 <sha40> PR #<n>` or `BLOCKED T-285 <reason>`.
- Then each command with its output. If the code differs from a line this brief quotes, follow the ruling's intent and
  say what differed. Mark anything not run `NOT RUN`. Do not merge.
