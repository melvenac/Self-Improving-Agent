# T-285 amendment 2: the path guard normalises case and slashes (Opus F1), and a row pins its holder text (Opus F2)

Runtime: CC (claude -p, Opus 5.5)
SEAT: QA PC one-off, **in the r1 clone `C:\Users\Aaron Melven\Worktrees\oneoff-t285`** (branch
`fix/t285-chunk-key-refusal` at `2bba8db753223281d8f2b638c9be44266c88ad97`, pushed, PR #727). No hub key. Code. Ends at
READY with PR #727 updated, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t285-r3-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-14, session 171. **Task:** T-285. **Tag:** `T-285`. **Size:** SMALL.
**The brief and amendment 1 stand**, with the changes below.

```text
IMPACT-TARGETS: handleStoreChunk (open-brain/src/server.ts; the heldPath query only)
```

## Why

T-285's Opus second review (VERDICT: ACCEPT at 2bba8db7, `~/Worktrees/t285-review-reply.md`, outside the repo) found
two non-blocking gaps, which the planner closes before the merge ask:
- **F1.** The path half of the guard runs `WHERE vault_path = ?` (exact). T-266's `keyHeldElsewhere`
  (`pipelines/store/index.ts`) compares `replace(/\\/g, "/").toLowerCase()`, because `vault_path` is known to carry case
  and slash variants. A row indexing the same file under another case/slash form, with the note gone from disk, lets a
  chunk store again and index one file twice; with the note present, the refusal wrongly says "no entry indexes".
- **F2.** No row covers the "is already indexed as entry N" arm: dropping `heldPath` leaves K1-K4 green (the existsSync
  arm refuses with the wrong holder text).

## Ruling

1. **`open-brain/src/server.ts`, the `heldPath` query only:** replace
   `v2db.prepare("SELECT id, key FROM knowledge_index WHERE vault_path = ?").get(vaultPath)` with
   ```ts
   v2db.prepare("SELECT id, key FROM knowledge_index WHERE lower(replace(vault_path, char(92), '/')) = lower(replace(?, char(92), '/'))").get(vaultPath)
   ```
   and add, on the line above the `const heldPath` declaration:
   `  // T-285 r3: compared case- and slash-insensitively, as T-266's keyHeldElsewhere does: vault_path carries both forms.`
   Nothing else in src changes.
2. **Two rows** in `open-brain/tests/t285-chunk-key.test.ts`, inside its describe, after K4 (use the file's helpers and
   its per-row vault; `tag` as the file does):
   - **K5 (F2): two keys that slugify to one file: the second is refused naming the first entry.**
     `first = await handleStoreChunk({ content: "one", key: \`Foo Bar ${tag}\`, category: "note" })` (success; read its
     id with `/\(id: (\d+)\)/`), then
     `second = await handleStoreChunk({ content: "two", key: \`foo-bar-${tag}\`, category: "note" })`:
     `second.isError` true and its text contains `is already indexed as entry ${id} (key "Foo Bar ${tag}")`.
     If `slugify` does not map both keys to one slug at the base, STOP, BLOCKED with the two slugs.
   - **K6 (F1): a row holding the same file in another case and slash form, with no file on disk, is refused.**
     Open the handler's DB: `const db = dbV2.openV2Database(process.env.KNOWLEDGE_V2_DB!)` (import `* as dbV2` from
     `../src/db-v2.js`; close it at the end of the row). Compute the path the handler will use for key `K6-${tag}`, as
     K3 does (`OPEN_BRAIN_VAULT_DIR/Chunks/<today>-general-<slug>.md`), then
     `const variant = path.split("\\").join("/").toUpperCase()` (import `path` utilities as the file does) and
     `dbV2.indexKnowledge(db, { vaultPath: variant, key: \`K6-${tag}-holder\`, content: "holder", tags: "" })`, and read
     that row's id with `SELECT id FROM knowledge_index WHERE key = ?`. Then
     `r = await handleStoreChunk({ content: "x", key: \`K6-${tag}\`, category: "note" })`: `r.isError` true; text contains
     `is already indexed as entry ${holderId} (key "K6-${tag}-holder")`; and the computed (un-varied) path does not
     exist on disk.

**Expected at commit 3 (the rows, r1's src):** K5 GREEN (r1's exact match already finds the same-form path), K6 RED
(r1 stores it). Then commit 4 turns K6 green.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t285-r3-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`, else BLOCKED).
2. `Set-Location 'C:\Users\Aaron Melven\Worktrees\oneoff-t285'`. `git rev-parse HEAD` must print `2bba8db7…` and
   porcelain must be empty, else BLOCKED. **Forbidden:** stash, `reset --hard`, `--force`, rebase, amend, a `cd` into
   any other checkout, `npm run test:heavy`, killing any process by name.
3. **Commit 3, `T-285 r3: rows K5 (holder text for a shared file) and K6 (a case/slash variant of the path)`:** ruling 2.
   `$env:NO_COLOR='1'`; in `open-brain`: `npx vitest run tests/t285-chunk-key.test.ts --no-file-parallelism`: exactly K6
   red. Paste the summary and the `x` rows as plain text.
4. **Commit 4, `T-285 r3: the path guard compares case- and slash-insensitively`:** ruling 1. Run the brief's step-4
   wider list (all green) and `npx tsc --noEmit` (exit 0). Paste both.
5. **Mutants** (paste the summary and `x` rows for each; revert with `git checkout -- open-brain/src/server.ts`;
   porcelain empty):
   - **M4:** the `heldPath` query → `.get("\u0000")` (never matches). Expect K5 and K6 red.
   - **M5:** the query back to `WHERE vault_path = ?`. Expect K6 red.
6. End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline fc1fd551..HEAD`
   shows 4 lines; `git diff --name-only fc1fd551..HEAD` shows the same two files as r1.
7. `git push origin fix/t285-chunk-key-refusal` (never force); `ls-remote` = `rev-parse HEAD`;
   `gh pr checks 727 --watch --interval 30` (cap 20 min); paste the `test` conclusion.

## Reply

- **First line:** `READY T-285 <sha40> PR #727` or `BLOCKED T-285 <reason>`. Then each command with its output. Mark
  anything not run `NOT RUN`. Do not merge.
