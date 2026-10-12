# T-259: the record-erasure scan spawns one git process per blob and per merge; batch it

Runtime: CC (claude -p, Sonnet 5.5)
SEAT: one-off (no hub key). Host: the QA PC or the desktop, clark's choice. Code only.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the host user's %TEMP% named t259-reply.md. Resolve and print that absolute path FIRST (§1).

**By:** Atlas (planner), 2026-10-12, session 168. **Task:** T-259 (P2). **Tag:** `T-259`. **Size:** SMALL.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`. **Base:** `d2208ae5f9603e11450741217b635c0d00d1846d`
(origin/master after #613). If clark re-pins the base at launch, the launch prompt says so and that SHA wins. §6's
expected hash is still measured against `d2208ae5`, because it is a property of that commit's history.

```text
IMPACT-TARGETS: scanErasures (callers: sync/index.ts checkRecordErasure, cli.ts `state erasures`); erasuresInMerge and erasuresInStep are NOT changed
```

## What the planner measured (desktop, d2208ae5)

- **The cause is the number of processes, not a stuck pipe.** HEAD has 2,533 commits and 785 state.json steps.
  The one `git cat-file --batch-check` call takes 0.27 s from a shell. Then `scanErasures` spawns
  `git cat-file -p <blob>` once per distinct blob it loads (361) and `git merge-base` once per merge step (424).
  That is about 785 spawns at about 75–86 ms each on Windows.
- `scanErasures` alone took **60 s** in the planner worktree. `open-brain state erasures` on the same tree took
  **115 s** under load. T-256's review saw 6+ minutes on the main tree on a busy desktop. The scan is linear in history,
  so it only gets slower.
- `erasuresInMerge` reads `base` **only** for a record that is in some parent but not in every parent, is absent
  after, and is not explained by retention. For every other merge, the `merge-base` spawn is wasted.

## Rulings (do not re-decide)

| # | Ruling |
|---|---|
| R1 | **One `git cat-file --batch` per phase, never `cat-file -p`.** Add a private `loadBlobs(projectRoot, ids: string[]): Map<string, Raw \| null>`. It spawns `git cat-file --batch` once, with stdin = the ids joined by `\n` plus a trailing `\n`, using the existing `git()` helper. Parse stdout as a **Buffer**: header line `<oid> <type> <size>\n`, then exactly `<size>` bytes, then one `\n`. A `<id> missing` header maps to `null`. Content that fails `JSON.parse` (utf8) maps to `null`, as `load` does today. Duplicate ids are sent once. An empty id list spawns nothing. |
| R2 | **`scanErasures`, in this order.** (a) shallow check, `rev-list --parents`, `--batch-check`: unchanged. (b) Walk `shas` in the existing order and collect the steps (the same skip rules as now). (c) One `loadBlobs` for every step's `after` blob and every non-null parent blob. (d) For each merge step, call `git merge-base` **only if** `mergeNeedsBase(parents, after)` (R3) is true; otherwise base is `null`. (e) One more `loadBlobs` for the merge-base blobs not already loaded, only if there are any. (f) Build `erasures` in the existing commit order, with the existing field values. **The returned `ScanResult` must be deep-equal to today's for every repository.** |
| R3 | **Export a pure `mergeNeedsBase(parents: Array<Raw \| null>, after: Raw \| null): boolean`.** It returns true iff some record `r` in some parent's `recordsOf` has `!presentIn(recordsOf(after), r)`, `!explainedByRetention(r, after)`, and is **not** present in every parent. That is exactly the condition under which `erasuresInMerge` reaches its `inBase` test, so passing `null` when it is false cannot change the result. Put a two-line comment on it saying so. |
| R4 | `erasuresInMerge`, `erasuresInStep`, `recordsOf`, `checkRecordErasure`, the `ScanResult` type and every export's signature stay unchanged. |

**Out of scope:** `sync/index.ts`, `cli.ts`, any other check, and `cursor-hook-compat` (§5 only measures it).

## The existing tests that pin this behaviour (planner-read)

| File | What it pins | Verdict |
|---|---|---|
| `tests/pipelines/sync/record-erasure.test.ts`, the fixture rows (lines ~42–260) | known positives and negatives, including the merge rows "keeps one branch's record" (G-027), "reported once, at that branch's commit" and "keeps both" | **Green, unedited.** The "reported once" row is the one that needs a real base. |
| same file, "against this repository's history" (line ~265) | rev 60→61 and 61→62 erasures on the real history, 180 s timeout | **Green, unedited**, and it should now run in seconds. Paste its duration. |
| same file, R179-1 block | retention by write order | Green, unedited. |

No existing test may be edited.

## 1. Shell, Node and the reply path

PowerShell. First, in this order:

```powershell
$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t259-reply.md"))
"REPLY_PATH=$reply"
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
node -v
```

If `node -v` is not `v22.*`: STOP, `BLOCKED T-259 node <version>`.

## 2. Start state

A fresh **full** clone under `$env:TEMP` (no `--depth`). Never use the main checkout.

```powershell
$wt = Join-Path $env:TEMP "t259-wt"
git clone -q https://github.com/melvenac/Self-Improving-Agent.git $wt
Set-Location $wt
git checkout -q -b fix/t259-erasure-scan d2208ae5f9603e11450741217b635c0d00d1846d
git rev-parse HEAD          # must print d2208ae5f9603e11450741217b635c0d00d1846d
git status --porcelain      # must print nothing
Set-Location open-brain; npm ci; npm run build; Set-Location ..
$base = Join-Path $env:TEMP "t259-base"
git worktree add -q $base d2208ae5f9603e11450741217b635c0d00d1846d
Set-Location (Join-Path $base "open-brain"); npm ci; npm run build; Set-Location $wt
```

`$base` is a build of the unchanged code and a checkout whose HEAD is exactly `d2208ae5`. §6 uses both. Any mismatch:
STOP, BLOCKED. **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, and `cd` into another checkout.

## 3. Commits (exactly two)

1. **Tests first, red.** Create `open-brain/tests/t259-erasure-scan.test.ts` (§4). Commit:
   `T-259: tests (red)`. Run it and paste the result. ES-1..ES-3 fail (no `mergeNeedsBase` export), and ES-4..ES-6 fail
   on the spawn counts.
2. **The fix.** Commit: `T-259: record-erasure loads blobs in one cat-file --batch and skips merge-base when no record needs it`.

End every commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. After each commit,
`git status --porcelain` is empty. At the end, `git log --oneline d2208ae5..HEAD` shows exactly 2 lines.

## 4. The new tests: `open-brain/tests/t259-erasure-scan.test.ts`

Build fixture states and repositories the way `record-erasure.test.ts` does. Copy its `git`/`commit` helpers and its
record shapes; do not import from the test file.

**Pure rows (`mergeNeedsBase`):**

| Row | parents / after | Expected |
|---|---|---|
| ES-1 | both parents hold A and B; after holds A and B | `false` |
| ES-2 | both parents hold A; after lacks A (dropped in the merge itself) | `false`, because A is in every parent |
| ES-3 | parent 1 holds A, parent 2 does not; after lacks A | `true` |

**Spawn rows.** Spy on `execFileSync` with
`vi.mock("node:child_process", async (orig) => { const m = await orig<typeof import("node:child_process")>(); return { ...m, execFileSync: vi.fn(m.execFileSync) }; })`.
Build the fixture repo first, then call `vi.mocked(execFileSync).mockClear()`, then `scanErasures(dir)`. Count the
calls by their `args` array.

| Row | Fixture | Assert |
|---|---|---|
| ES-4 | the "a merge that KEEPS both branches' records" shape | 0 calls with `["cat-file", "-p", …]`. Exactly 0 `merge-base` calls. At most 2 calls whose args include `--batch`. `r.ok` is true and `r.erasures` is `[]`. |
| ES-5 | the "a removal made on ONE branch is reported once" shape | Exactly 1 `merge-base` call. The erasures equal what that row in `record-erasure.test.ts` asserts: one, at x's commit, none at the merge. |
| ES-6 | a linear history of 5 record commits, no merges | 0 `cat-file -p` calls. 0 `merge-base` calls. Exactly 1 call with `--batch` (besides `--batch-check`). |

120 s timeout per test, no sleeps.

## 5. Mutants (edit `record-erasure.ts`, run both erasure test files, `git checkout -- <file>`, confirm a clean tree; never commit one)

| Id | Edit | Expected red |
|---|---|---|
| M1 | `mergeNeedsBase` always returns `false` | `record-erasure.test.ts` "reported once, at that branch's commit", ES-3, ES-5 |
| M2 | `mergeNeedsBase` always returns `true` | ES-1, ES-2, ES-4 |
| M3 | Restore a per-blob `cat-file -p` load in place of `loadBlobs` | ES-4, ES-6 |

Paste each result line.

## 6. Runs

```powershell
Set-Location (Join-Path $wt "open-brain")
npx tsc --noEmit; "tsc exit $LASTEXITCODE"
npx vitest run tests/t259-erasure-scan.test.ts tests/pipelines/sync/record-erasure.test.ts --no-file-parallelism --testTimeout=180000
npm run build; "build exit $LASTEXITCODE"
```

**Equivalence and timing on the real history.** Both CLIs read the **same** checkout, `$base` at `d2208ae5`. Use
`cmd /c` so the bytes are not re-encoded:

```powershell
$old = Join-Path $env:TEMP "t259-old.txt"; $new = Join-Path $env:TEMP "t259-new.txt"
$t = Get-Date; cmd /c "node `"$base\open-brain\build\cli.js`" state erasures `"$base`" > `"$old`""; "old exit $LASTEXITCODE secs $([int]((Get-Date)-$t).TotalSeconds)"
$t = Get-Date; cmd /c "node `"$wt\open-brain\build\cli.js`" state erasures `"$base`" > `"$new`""; "new exit $LASTEXITCODE secs $([int]((Get-Date)-$t).TotalSeconds)"
(Get-FileHash $old -Algorithm SHA256).Hash; (Get-FileHash $new -Algorithm SHA256).Hash
Get-Content $new -TotalCount 2
```

**Expected:** both hashes are `F8592BCC3E616A5F6D1417036B6D800D055F0A660CDA64F75B54FDF1460943BF`, the planner's
capture on the desktop. The first line is
`Walked 2533 commits on HEAD; 785 changes to .agents/state.json (552 at schema v3+).` The new time is under 15 s.
If the hashes differ from each other: STOP, BLOCKED. If they match each other but not the planner's hash, report
both and continue.

Then the T-259 note's second symptom, measured only:
`npx vitest run tests/cursor-hook-compat.test.ts --no-file-parallelism --testTimeout=180000`. Paste the summary and
the duration of the "wired into runSync" row. **Do not edit that file.**

**Known reds on the desktop (environmental):** cli-flags R185-8, the suite-run-meta same-owner lease, config-channel
CA-4c, and the server.test.ts 5 s timeout. None of these files is in the run lists above. For any red in a listed
existing file, run it in `$base` and paste both outputs.

## 7. Scope check, then push

`git diff --name-only d2208ae5..HEAD` must show exactly:

- `open-brain/src/pipelines/sync/record-erasure.ts`
- `open-brain/tests/t259-erasure-scan.test.ts`

Any other path: STOP, BLOCKED.

```powershell
git push origin fix/t259-erasure-scan
git ls-remote origin refs/heads/fix/t259-erasure-scan   # must equal git rev-parse HEAD
gh pr create --base master --head fix/t259-erasure-scan --title "T-259: record-erasure scan batches blob loads, skips unneeded merge-base" --body "Brief: docs/loops/t259-erasure-scan-brief.md."
```

Never force-push. Push rejected: STOP, BLOCKED. Afterwards `git worktree remove $base`.

## 8. STOP rules and reply

- At most 2 attempts at any one red, then BLOCKED. Never edit an existing test. Never touch a file outside §7.
  A STOP still writes the reply.
- The reply's first line is `READY T-259 <sha40> PR #<n>` or `BLOCKED T-259 <reason>`. Then, each with its command
  shown above it: `node -v`, the start state, the red run, each mutant's line, tsc, the vitest summary (with the
  "against this repository's history" duration), build, the two times and two hashes, the cursor-hook-compat
  measurement, the name-only diff, `ls-remote` = `rev-parse`, and the PR URL. Name any HIGH, CRITICAL or UNKNOWN
  IMPACT-TARGET and say which tests cover its callers. Mark anything not run `NOT RUN`.
