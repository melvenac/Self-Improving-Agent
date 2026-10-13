# T-022: a `state` fact stored again under the same key replaces its value; the old value moves to the note's `## Log`

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop or laptop one-off (any Windows host). No hub key. Code only. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t022-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-022 (P0). **Tag:** `T-022`. **Size:** MEDIUM.
**Base:** `50c112d71747648c81912ffb26509b902582178a` (origin/master; its code equals 399121cd). If clark re-pins it at
launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: store writeExperience indexKnowledge ob_store (server.ts closure → handleStore) (covered by tests/pipelines/store/index.test.ts, tests/vault-writer.test.ts, tests/index-upsert.test.ts, tests/server.test.ts)
```

## Why

T-022 (session 48, read its note): a `state` write should replace its predecessor and demote the old value to a
`## Log` section in the vault note; `event` keeps appending. It was gated on real labels. Planner triage (s168): the
label is `knowledge_index.fact_kind`, storer-supplied only; live, 251 event / 19 state / 384 unlabelled, and the
classifier was cut (e05ad9a7), so a replace can only ever fire on a RECORDED `state`. Researched at 399121cd: today a
`state` stored again under the same key changes NOTHING (`writeExperience` returns null on an existing note path,
`vault-writer.ts:130`; the reply says "Not stored — … use ob_forget first if you meant to replace it"), so agents invent a
new key and leave two live answers (live example: state 419 beside unlabelled 416). Measured: 0 of the 19 state rows
share a key with any other row, so **no existing row changes at deploy**; this only acts going forward.

## Ruling (exact names; paths under `open-brain/`)

1. **Predecessor rule.** A write replaces only when ALL hold: the incoming `kind` is `"state"`; the note path it maps to
   already exists AND is indexed by a row whose `key` equals the incoming key exactly; that row's `fact_kind` is
   `"state"` and its `archived_into` is null. Otherwise behaviour is unchanged (refused as today). Planner rulings: a
   state does NOT replace an unlabelled or event row; the row keeps its id (its ratings and recall history attach to the
   new value); its `created_at` is kept (known limit: a replaced value ranks as old under recency decay).
2. **`src/vault-writer.ts`:** extract `experienceFrontmatter(input)` from the current writer (output byte-identical);
   add `export function splitStateLog(body: string): { current: string; log: string }` (strips a BOM, accepts CRLF,
   splits at the first line that is exactly `## Log`); add `export function replaceStateNote(path, input, demotedAt: string)`
   that rewrites the note as: frontmatter (the new tags and source, the ORIGINAL `created`), the new value, then
   `## Log`, then `### Replaced <ISO demotedAt>` followed by the previous current value, ABOVE any older log entries
   (newest first). Write to a temp file in the same directory and rename it into place.
3. **`src/pipelines/store/index.ts`**, in the existing-note branch: when the rule holds, compare the incoming value
   with the note's current value (trimmed): equal → `unchanged`, nothing written; different → `replaceStateNote`, then
   `indexKnowledge` with the row's own `vault_path` and `content` = the NEW value only (the row keeps its id; the
   `ki_au` trigger drops the old text from FTS). If the index write fails after the note write, return an error, never
   "Replaced". The branch that adopts an existing UNINDEXED note indexes only `splitStateLog(body).current`.
   `StoreResult` gains `replaced?: { id: number; demotedAt: string }`, `existingKind?: string | null`, `unchanged?: true`.
4. **`src/server.ts`:** move the `ob_store` closure (`~:879-964`) into `export async function handleStore(…)` (the
   `handleStoreChunk` pattern) and register it unchanged otherwise. Replies:
   - replaced: `Replaced state "<key>" (id: <n>) [<scope>] — the previous value moved to "## Log" (<YYYY-MM-DD>) in the vault note and is no longer recalled.\n  Vault: <path>`
   - unchanged: `Unchanged — state "<key>" (id: <n>) already holds this value. Nothing was written.`
   - a state over a non-state row: today's "Not stored — …" text plus
     ` It is stored as ${existingKind ?? "unlabelled"}; kind "state" replaces only a state.`
   - the `kind` description (`~:873-877`): `'state' = one current value that changes (a path, a version, an owner): a later 'state' write to the SAME key replaces it, and the old value moves to the note's ## Log. 'event' = a timestamped thing that happened (a gotcha, a decision, a lesson): append it; a repeated key is refused.`
5. **Text that becomes false, fix in the same PR:** the comments at `db-v2.ts:359-361` and `:529-531` (the latter wrongly
   says `ob_forget` uses `archiveKnowledgeEntry`), `pipelines/store/index.ts:74-79`, `README.md:122`,
   `.agents/skills/self-improving-agent-guide/SKILL.md:119` (also drop its mention of the cut `effectiveKind`), and under
   the ADR at `.agents/SYSTEM/DECISIONS.md:160` append ONE dated line `Amended 2026-10-13 (T-022): …` (do not rewrite
   the ADR).
6. **Out of scope** (name them in the reply): the cross-scope silent re-point (`indexKnowledge`'s `ON CONFLICT(key)`
   moving a key's row to another scope's note, every kind: it becomes T-266), the 416/419 pair, `ob_forget`'s hard
   delete and orphaned log rows, and any migration of existing rows. Do not edit `indexKnowledge`.

## Existing tests (planner-researched; verdicts)

- Stay green: `tests/pipelines/store/index.test.ts:30` and `:55` (no-kind dedup: it becomes the "unlabelled is still
  refused" pin); `tests/vault-writer.test.ts:82` (frontmatter: byte-identical) and `:112`; `tests/audit-fix-a3-r2.test.ts:29,84`;
  `tests/vault-archive.test.ts:75`; `tests/index-upsert.test.ts:83,103,137,145,160,174`; `tests/topics.test.ts:223`,
  `tests/shadow-evaluate.test.ts:253`, `tests/ranking.test.ts:53`, `tests/recall-broadening.test.ts:60`;
  `tests/rating-method.test.ts:58` (no schema change).
- The `ob_store` reply text and the note body have no tests today. Any newly failing row: STOP, `BLOCKED T-022 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t022-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t022-wt")`, `Set-Location`
   into it, `git checkout -q -b fix/t022-state-replace 50c112d71747648c81912ffb26509b902582178a`. HEAD must print that SHA
   and the tree must be clean, else STOP, BLOCKED. `npm ci` in `open-brain`. **Forbidden:** `git stash`, `reset --hard`,
   `--force`, rebase, amend, `cd` into any other checkout, and touching the real DB or vault (every test uses a temp
   `KNOWLEDGE_V2_DB` and `OPEN_BRAIN_VAULT_DIR`).
3. **Base run** (in `open-brain`, 30-minute cap):
   `npx vitest run tests/pipelines/store tests/vault-writer.test.ts tests/audit-fix-a3-r2.test.ts tests/vault-archive.test.ts tests/index-upsert.test.ts tests/topics.test.ts tests/shadow-evaluate.test.ts tests/ranking.test.ts tests/recall-broadening.test.ts tests/rating-method.test.ts tests/server.test.ts --no-file-parallelism --testTimeout=180000`.
   Paste the summary and every failing row.
4. **Commit 1, `T-022: tests (red)`.** New file `open-brain/tests/pipelines/store/t022-state-replace.test.ts` (namespace
   imports). Pipeline rows use `openV2Database(<tmp file>)` and an mkdtemp vault. The server row uses the per-worker
   `KNOWLEDGE_V2_DB` from `tests/setup-env.ts`, sets `OPEN_BRAIN_VAULT_DIR` in `beforeEach` and RESTORES it in
   `afterEach` (never deletes it).
   - **R1:** store state K "alpha", then state K "bravo" → the same id, one row, content `bravo`, fact_kind `state`,
     archived_into null, created_at unchanged, and an FTS search for `alpha` returns nothing.
   - **R2:** a, then b, then c → the current value is c; exactly one `## Log`; b's `### Replaced <ISO>` block above a's;
     `created` is the first write's.
   - **R3:** event K2 x then y → refused (today's text); state K3 then the same key with no kind → refused, content
     unchanged.
   - **R4:** event K4, then state K4 → refused, still an event, reply names `It is stored as event`; `"Foo Bar"` then
     `"foo-bar"` (same note path, different key) → refused.
   - **R5:** the same value twice → `unchanged`, no `## Log` added, the file's bytes unchanged.
   - **R6 (server):** `handleStore` replies `Replaced state "K6" (id: <n>)`; a recall for the old value's unique token
     returns no hit; a repeated EVENT key still replies `Not stored —`.
   - **R7:** adopting hand-written LF and CRLF notes that already contain a `## Log` indexes only the current value.
   Run the file: R1, R2, R4's reply text, R5, R6, R7 red (R3 may already pass). Paste it.
5. **Commit 2, `T-022: a state stored again under the same key replaces its value; the old value moves to ## Log`:** the
   ruling.
6. End both messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git log --oneline 50c112d7..HEAD`
   shows 2 lines; `git status --porcelain` is empty.
7. Runs, in `open-brain`: `npx tsc --noEmit` (exit 0), the t022 file, then step 3's command again. Paste all three.
8. **Mutants** (edit, run the t022 file only, paste, `git checkout -- <file>`, clean tree; never commit):
   - M1: the replace branch removed → R1 red. M2: the whole body (Log included) indexed → R1 (`alpha` found) red.
   - M3: a new row inserted instead of the update → R1 red. M4: oldest-first log → R2 red.
   - M5: the gate is `kind !== "event"` → R3 red. M6: the predecessor-kind check dropped → R4 red.
   - M7: the identical-value check dropped → R5 red. M8: CRLF not split → R7 red.
9. `git diff --name-only 50c112d7..HEAD` must show only `open-brain/src/vault-writer.ts`,
   `open-brain/src/pipelines/store/index.ts`, `open-brain/src/server.ts`, `open-brain/src/db-v2.ts` (comments only),
   `open-brain/README.md` or the root `README.md` (whichever holds line 122's text),
   `.agents/skills/self-improving-agent-guide/SKILL.md`, `.agents/SYSTEM/DECISIONS.md`,
   `open-brain/tests/pipelines/store/t022-state-replace.test.ts`. Anything else: STOP, BLOCKED.
10. `git push origin fix/t022-state-replace` (never force); `ls-remote` must equal `rev-parse HEAD`. Then
    `gh pr create --base master --head fix/t022-state-replace --title "T-022: a state stored again under the same key replaces its value; the old value moves to ## Log" --body "Brief: docs/loops/t022-state-replace-brief.md. No existing row changes at deploy."`
    Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.

## Reply

The first line is `READY T-022 <sha40> PR #<n>` or `BLOCKED T-022 <reason>`. Then each command with its output: base
run, red run, tsc, the t022 run, the second run, the mutants, the name-only diff, `ls-remote` = `rev-parse`, the PR URL
and CI, and the out-of-scope list. At most 2 attempts at a red. Mark anything not run `NOT RUN`. If the code differs
from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
