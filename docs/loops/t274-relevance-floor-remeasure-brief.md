# T-274: re-measure the recall trigger's relevance floor (read-only replay, aggregates only)

Runtime: CC (claude -p, Opus 5.5)
SEAT: DESKTOP one-off (no hub key). It MUST run on the desktop: the knowledge DB and the Claude Code transcripts it
reads exist only there. DOCS ONLY: nothing under `open-brain/src`, `open-brain/tests`, hooks, `.claude`,
`project-template` or any package file changes. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t274-reply.md (a reply path in
the launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-274 (P2). **Tag:** `T-274`. **Size:** MEDIUM.
**Base:** `88b2c8d40645e9508a291bbb34c4e2c8d9badfc4` (origin/master). If clark re-pins it at launch, that SHA wins.
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`. **Read first:** `docs/loops/t264/measure.mjs` and
`docs/loops/t264/result.md` (the method this run reuses).

```text
IMPACT-TARGETS: none — nothing under open-brain/src, open-brain/tests, hooks, .claude, project-template or any package file changes (the run imports the built deriveQuery, queryStore and formatCommandFireLog read-only)
```

## Why

T-274 (read its note). `open-brain/src/trigger/policies/recall-trigger.json` ships `relevance_floor: 8.0`. Its
provenance says the value was measured on 2026-09-20 against 599 entries and "must be re-measured, not assumed", because
bm25 is corpus-relative. The store has grown since then. T-265 (merged 7b8c6e59) also changed which commands reach
`queryStore`.

**What the floor decides now (planner-read at the base):**
- `deriveQuery` (`open-brain/src/trigger/query.ts`) can produce only three FTS expressions.
  - **TRIM**: the trimmer element alone (the last pipeline stage is tail, head or grep).
  - **STATUS**: the status element alone (`isUnsafeStatusRead`: a `$?` read straight after a trimmer pipeline).
  - **TRIM+STATUS**: both elements.
  - **NONE**: no query at all (a not-asked fire).
- `runTrigger` (`trigger/run.ts`) calls `queryStore` with `limit: policy.max_injected`, which is 1. An injection
  happens exactly when a label's top-1 hit clears the floor.
- So on a given store, injection is a pure function of (label, floor). The floor's whole job is to decide, for each
  label, whether its top hit is injected.

**What has to be measured:**
- For the VIOLATING class (T-264's `classify299`), the precision and recall at each floor value.
- These are computed by replaying every hook-seen command on a snapshot of today's store.

**This run changes no src.** Ruled: a floor change is a later, separate code PR, for three reasons.
- `tests/trigger/floor.test.ts:108` pins `599` in the provenance, and `:110` pins the floor's value in the provenance.
  So any re-measured provenance edits a test.
- Keeping the change out also keeps this PR docs-only. It merges on green after the planner's privacy scan.
- A measurement that changes the thing it measures in the same PR cannot be reviewed apart from it.

The result prints a recommendation by a fixed rule (Ruling, part 9). The planner rules on it.

**"The T-264 replay data":**
- **What it is:** the `trigger_fires` table joined to the transcripts by T-264's anchoring. An injected fire is matched
  through its hook attachment. A silent or not-asked fire is matched by time and program basename.
  `trigger_fires.command` holds only the program basename (`trigger/command-log.ts`), so the command text exists only
  in the transcripts.
- **Where earlier copies live:** on the desktop, local only. T-264's are in `%TEMP%\t264-recall-effect` (snapshot of
  10-13 14:25Z). T-265's Arm A anchors are in `%TEMP%\t265-replay\out`.
- **Why they are not reused:** both predate T-265 going live. Neither replayed silent or not-asked fires through the
  current `deriveQuery`. This run rebuilds the anchoring on a fresh snapshot, with the code ported from T-264.

## Ruling (exact)

**One new script, `docs/loops/t274/floor.mjs` (Node 22 ESM), and its aggregate output, `docs/loops/t274/result.md`.
No other file changes.**

1. **Usage.**
   - `node docs/loops/t274/floor.mjs --check-only` runs the three self-checks (part 7) and exits 0 when all pass,
     2 otherwise. It opens no DB and reads no transcript.
   - `node docs/loops/t274/floor.mjs --out <OUT> --live-db <file> --projects <dir> --until <ISO-8601 UTC>`: all four
     are required, else print the usage line and exit 2.
   - Refuse, with exit 2: an `--out` inside the repository (T-264's check); a `--live-db` that does not exist; a
     `--projects` that is not a directory; an `--until` that `Date.parse` cannot read.
   - The script resolves NO path from HOME or USERPROFILE. The run sets both to a temp directory.
2. **Ported verbatim from `docs/loops/t264/measure.mjs` at the base. Copy the text; do not import the file**, because
   it calls `main()` when loaded.
   - Lines 28-200: `TRIMMERS` through `pct`. This covers `stripHeredocs`, `splitStatements`, `stageProgram`,
     `isTrimmerPipeline`, `classifyScript`, `classify299`, `SELF_CHECK`, `selfCheck` and `wilson`.
   - Lines 241-299: `indexTranscripts`, `SHELL_TOOLS` and `readTranscript`.
   - Change nothing in them.
3. **Snapshot.** Use exactly this sequence. It is T-264's method, which the planner proved on a scratch WAL database
   held open by a writer process: the snapshot carried the rows that existed only in the `-wal` file, and the source's
   main and `-wal` files kept their size and mtime.
   - Record the live file's size and mtime.
   - `const src = new Database(liveDb, { readonly: true, fileMustExist: true })`.
   - Print `live handle readonly: <src.readonly>`. Exit 3 unless it is `true`.
   - `await src.backup(<OUT>/kv2-snapshot.db)`.
   - Print `live handle total_changes: <n>` from `src.prepare("SELECT total_changes() AS n").get().n`. Exit 3 unless
     it is 0.
   - `src.close()`, then record the size and mtime again.
   - Then set `process.env.KNOWLEDGE_V2_DB` to the snapshot path and print it, BEFORE importing anything from the
     build.
   - Open the snapshot with `{ readonly: true, fileMustExist: true }`.
   - **There is no other `new Database(` in the file.**
   - Never copy the live file with Copy-Item, cp or fs.copyFileSync: a raw copy of a WAL database misses the `-wal`
     frames and can catch a torn page.
4. **Imports, from `<repo>/open-brain/build/trigger/`:**
   - `deriveQuery` and `queryStore` from `query.js`;
   - `formatCommandFireLog` from `command-log.js`.
   - Nothing else from the build: not `run.js`, not `db-v2.js`.
   - `better-sqlite3` comes through `createRequire(<repo>/open-brain/package.json)`, as T-264 does.
5. **Fires.**
   - Query: `SELECT id, session_uuid, created_at, state, command, injected_ids FROM trigger_fires ORDER BY id`.
   - Keep only `Date.parse(created_at) < Date.parse(until)`. The cutoff keeps out this run's own fires, which every
     Bash call adds through the live hook.
   - Group by session. Pick each session's transcript as T-264 does: the largest `<id>.jsonl` under `--projects`.
6. **Anchors: T-264's anchor block (measure.mjs lines 423-452), extended to all three states.**
   - **Injected:** the attachment match. It must lie within 5000 ms, contain every `[stored knowledge <id>`, be unused,
     and be the closest such attachment. The anchor is the tool_use whose id is the attachment's `toolUseID`, and
     the status is `ATTACHMENT`. If no attachment matches, fall through to the next rule.
   - **Silent, not-asked, and the injected fallback:** the LATEST shell tool_use in file order with `ts` in
     `[created − 120000, created + 2000]` and `formatCommandFireLog(command) === fire.command`. The status is
     `TIME_BASENAME`.
   - Otherwise `NO_ANCHOR`. A session with no transcript is `NO_TRANSCRIPT`.
   - Count `anchors reused`: the tool_use ids that more than one fire anchored to.
7. **Per anchored fire, and the three self-checks.**
   - **Per fire:** `cmd = String(anchor.input.command ?? "")`, then `q = deriveQuery(cmd)`.
     - The label is `LABELS[q] ?? "OTHER"`, with
       `const LABELS = { "": "NONE", '"tail"': "TRIM", '"exit" "code"': "STATUS", '"tail" "exit" "code"': "TRIM+STATUS" };`.
     - The class is `classify299(cmd).cls`.
     - For each distinct non-empty `q`, call once (cache by `q`)
       `queryStore({ db: snapDb, command: cmd, floor: -Infinity, limit: 5 })`. Keep only `{ id, relevance }` from
       each hit; drop `key` and `content` immediately.
     - `top1` is the first hit, or null.
   - **Classifier self-check:** the ported `selfCheck()`, which must print `13/13`.
   - **Label self-check:** `LABEL_CHECK`, these 7 cases. The planner ran them first-hand against the base's
     `query.ts`; all 7 pass. Each line prints `PASS`/`FAIL`, and the last line is `label self-check: 7/7`.
     - `npm test 2>&1 | tail -20; echo "exit: $?"` → `TRIM+STATUS`
     - `git log --oneline | tail -5` → `TRIM`
     - `git status` → `NONE`
     - `make 2>&1 | tail -3; echo $?; ls | wc -l` → `STATUS`
     - `npm test 2>&1 | tail -20; echo "exit: ${PIPESTATUS[0]}"` → `TRIM`
     - `set -o pipefail; make 2>&1 | tail -3; echo $?` → `TRIM`
     - `npm test 2>&1 | sed -n 1,5p; echo $?` → `NONE` (T-264 classifies this one VIOLATING: a derivation miss, not
       a floor miss)
   - **Aggregation self-check:** `export function atFloor(rows, floor)`.
     - It takes rows `{ session, label, cls, top1Id, top1Rel }` and returns
       `{ injected, sessions, V, C, N, byEntry }`.
     - A row counts as injected iff `label !== "NONE" && top1Rel !== null && top1Rel >= floor`.
     - `byEntry` is a string of `id:n` pairs, sorted by id ascending and joined with one space.
     - `AGG_CHECK` uses these five rows:
       - `{s1, TRIM+STATUS, VIOLATING, 299, 10}`
       - `{s1, STATUS, VIOLATING, 299, 7}`
       - `{s2, TRIM, NOT_APPLICABLE, 642, 5}`
       - `{s2, NONE, VIOLATING, null, null}`
       - `{s3, TRIM, COMPLIANT, 642, 5}`
     - It expects four results. The last line is `aggregation self-check: 4/4`.
       - At 4.5: `injected 4, sessions 3, V 2, C 1, N 1, byEntry "299:2 642:2"`.
       - At 7.0: `injected 2, sessions 1, V 2, C 0, N 0, byEntry "299:2"`.
       - At 10.0: `injected 1, V 1`.
       - At 10.5: `injected 0`.
   - The three self-checks run before the snapshot. Any failure exits 2 before the live DB is opened.
8. **Outputs** (only under OUT):
   - **`fires.csv`**: one row per fire in the window, with the columns `fire_id, session_uuid, created_at, state,
     anchor_status, anchor_reused, label, class_299, top1_id, top1_relevance`. It holds NO command text.
   - **`summary.md`**: aggregates only, exactly these parts, in this order.
     - **Title:** `# T-274 result: the recall trigger's relevance floor, re-measured`.
     - **Generator line:** `Generated by docs/loops/t274/floor.mjs. Aggregates only: counts, rates, Wilson 95%
       intervals, entry ids, relevance values. No command, query or entry text, keys, paths or session ids.`
     - **Header bullets:**
       - The snapshot time.
       - The live file's size and mtime before and after the backup, with the note `(other sessions' hooks write to
         it: not the read-only proof)`.
       - `live handle readonly: true`, and `total_changes after backup: 0`.
       - Store size: `knowledge_index rows: <total>, live (archived_into IS NULL): <live>`.
       - The shipped policy: `relevance_floor` and `max_injected`, read from the clone's
         `open-brain/src/trigger/policies/recall-trigger.json`.
       - The script's sha256, first 16 hex characters.
       - The fire window, `<first created_at> to <until> (exclusive)`.
       - The three self-check totals.
     - **`## 1. Census`**: a table `| state | fires | anchored | NO_ANCHOR | NO_TRANSCRIPT | VIOLATING | COMPLIANT |
       NOT_APPLICABLE |`, with rows `injected`, `silent`, `not-asked` and `total`, followed by `Anchors reused by
       more than one fire: <n>`.
     - **`## 2. Labels at the snapshot`**: a table `| label | anchored fires | VIOLATING | COMPLIANT | NOT_APPLICABLE |
       top-5 hits (id:relevance) |`.
       - Rows: `TRIM+STATUS`, `STATUS`, `TRIM`, then `NONE` with top-5 shown as `n/a`. Add an `OTHER` row only when
         its count is above 0.
       - Relevance is printed to 2 decimals.
       - Follow the table with `VIOLATING fires with label NONE (a floor cannot reach them): <n>`.
     - **`## 3. Per-floor table`**: anchored fires only.
       - The grid is 2.0 to 16.0 in steps of 0.5. Add each label's top-1 relevance, rounded to 2 decimals, as an
         extra row marked `(breakpoint)`. Mark the 8.0 row `(shipped)`. Sort ascending.
       - Columns: `| floor | injected | sessions | VIOLATING | COMPLIANT | NOT_APPLICABLE | precision [Wilson 95%] |
         recall, all VIOLATING [Wilson 95%] | recall, derivable VIOLATING [Wilson 95%] | injected by entry |`.
       - precision = V / injected.
       - recall, all VIOLATING = V / (anchored VIOLATING fires, any label).
       - recall, derivable VIOLATING = V / (anchored VIOLATING fires whose label is not NONE).
       - Use the ported `wilson` and `pct`.
     - **`## 4. The gap and the recommendation`**: the rule in part 9, its inputs, its output line, and the shipped
       floor's two margins.
     - **`## 5. Limits`**, these bullets:
       - The replay scores every fire against the store as snapshotted, not as it stood at fire time.
       - Cursor fires and sessions with no Claude Code transcript are `NO_TRANSCRIPT`. Subagent transcripts are not
         read.
       - Silent and not-asked fires are anchored by time and program basename. The reused-anchor count is above.
       - VIOLATING is T-264's classifier, whose trimmer set is wider than `deriveQuery`'s, so a VIOLATING fire with
         label NONE is a derivation miss.
       - If T-159 (#678) is live in the main tree, not-asked fires still in its pending file are not in
         `trigger_fires`. They can only be NONE-label fires, so the injected counts cannot move. Only the "all
         VIOLATING" recall denominator can.
9. **The recommendation rule** (printed in part 4 of the summary).
   - **Inputs.** `silentMax` is the TRIM label's top-1 relevance, or `-Infinity` when TRIM has no anchored fire or
     no hit. `injectMin` is the lowest top-1 relevance among the labels STATUS and TRIM+STATUS that have at least one
     anchored VIOLATING fire and a hit. When there is no such label, print `NO DATA` and stop.
   - **When `silentMax < injectMin`,** the separating interval is `(silentMax, injectMin]`.
     - If 8.0 lies in it, print `RECOMMENDATION: KEEP 8.0`.
     - Otherwise print `RECOMMENDATION: MOVE to <x>`. `x` is the multiple of 0.5 nearest the interval's midpoint
       that lies inside the interval, and a tie goes to the higher multiple. If no multiple of 0.5 lies inside, `x`
       is the midpoint to 2 decimals.
   - **When `silentMax >= injectMin`,** print `RECOMMENDATION: NO SEPARATING FLOOR (best F1 at <f>)`. `f` is the grid
     floor with the highest F1 = 2PR/(P+R) on precision and "all VIOLATING" recall (F1 is 0 when P+R = 0). Ties go to
     the higher floor.
   - **Always print** `margins of 8.0: injectMin − 8.0 = <d1>; 8.0 − silentMax = <d2>`, both to 2 decimals.

## Existing tests (planner-read at 88b2c8d4; verdicts)

- No file under `open-brain/src` or `open-brain/tests` changes, so no existing test can move.
  - `tests/trigger/floor.test.ts` (it pins `599` and the floor's value in the provenance): **stays green**, untouched.
  - The rest of `tests/trigger/` and `tests/pipelines/sync/retirements-live.test.ts`: **stay green**, untouched.
- CI: the PR is docs-only, so the `changed` job skips `test`, and a skipped `test` is the pass.
- This run's checks are the script's three self-checks and the mutants (step 5).

## Steps

1. **PowerShell. This is your FIRST shell command** (every Bash call fires the live hook).
   - `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t274-reply.md")); "REPLY_PATH=$reply"`
   - `$runStart = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ"); "RUN_START=$runStart"`
   - `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v`. It must print `v22.*`, otherwise BLOCKED.
   - Do not call any open-brain MCP tool (`ob_*`) in this run.
2. **Start state.**
   - Run `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t274-wt")` and
     `Set-Location` into it.
   - `git checkout -q -b docs/t274-floor-remeasure 88b2c8d40645e9508a291bbb34c4e2c8d9badfc4`. `git rev-parse HEAD`
     must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED.
   - In `open-brain`: run `npm ci`, then `node -e "require('better-sqlite3')"`. If that prints "Could not locate the
     bindings file", run `npm rebuild better-sqlite3` and say so.
   - Then `npm run build` (exit 0), and `Test-Path build\trigger\query.js` must print `True`.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, `cd` into any other checkout, any edit
     outside `docs/loops/t274/`, opening the live DB by any route other than part 3, and killing any process by name.
3. **Write `docs/loops/t274/floor.mjs`** to the Ruling. Run `node --check docs/loops/t274/floor.mjs`, then
   `node docs/loops/t274/floor.mjs --check-only`. Both must exit 0, and the second prints all three self-checks. Paste
   both. You have two attempts at a failing self-check; after that, BLOCKED with its output.
4. **Static proof.**
   - `Select-String -Path docs/loops/t274/floor.mjs -Pattern 'new Database\('` must print exactly 2 lines, both
     containing `readonly: true`.
   - `Select-String -Path docs/loops/t274/floor.mjs -Pattern 'writeFileSync|appendFileSync|createWriteStream|mkdirSync|copyFileSync|renameSync|rmSync|unlinkSync'`:
     every hit must write under OUT. Paste both outputs and say so.
5. **Mutants.** The file is not committed yet, so `git checkout --` cannot restore it.
   - First back it up: `Copy-Item docs/loops/t274/floor.mjs (Join-Path $env:TEMP "t274-floor.mjs.bak")`.
   - For each mutant: edit, run `node docs/loops/t274/floor.mjs --check-only`, and paste the output. Then restore with
     `Copy-Item (Join-Path $env:TEMP "t274-floor.mjs.bak") docs/loops/t274/floor.mjs -Force`. `(Get-FileHash
     docs/loops/t274/floor.mjs).Hash` must equal the backup's hash. Paste both.
   - Never commit a mutant. Each must exit 2 with the named FAIL.
   - **M1:** `SELF_CHECK` case 1's expected `"VIOLATING"` → `"COMPLIANT"` → classifier `FAIL case 1`.
   - **M2:** `LABELS`: `'"tail" "exit" "code"': "TRIM+STATUS"` → `'"tail" "exit" "code"': "TRIM"` → a label `FAIL`.
   - **M3:** in `atFloor`, `top1Rel >= floor` → `top1Rel > floor` → an aggregation `FAIL` (the 10.0 case).
6. **The run.** In the same PowerShell session:
   ```powershell
   $live = Join-Path $env:USERPROFILE ".claude\open-brain\knowledge-v2.db"; $proj = Join-Path $env:USERPROFILE ".claude\projects"
   $out = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t274-floor")); $tmpHome = Join-Path $env:TEMP "t274-home"
   New-Item -ItemType Directory -Force $tmpHome | Out-Null
   $savedHome = $env:HOME; $savedProfile = $env:USERPROFILE
   $env:HOME = $tmpHome; $env:USERPROFILE = $tmpHome
   try { node docs/loops/t274/floor.mjs --out $out --live-db $live --projects $proj --until $runStart; "EXIT=$LASTEXITCODE" }
   finally { $env:HOME = $savedHome; $env:USERPROFILE = $savedProfile }
   Get-ChildItem -Recurse -Force $tmpHome | Select-Object FullName
   ```
   - `EXIT=0` is required. The cap is 30 min of wall clock.
   - The `Get-ChildItem` listing shows what the run wrote into the fake home, which should be nothing. Paste it.
   - On a non-zero exit, paste stderr. You may fix once and re-run; after that, BLOCKED.
7. **Result.**
   - `Copy-Item "$out\summary.md" docs/loops/t274/result.md`.
   - **Privacy scan:**
     `Select-String -Path docs/loops/t274/result.md -Pattern 'C:\\|/Users/|\\Users\\|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|stored knowledge|"tail"|"exit"'`
     must print NOTHING. Paste the command and its empty output.
   - On a hit, fix the generator, not `result.md` by hand, and re-run step 6. You have one attempt; after that,
     BLOCKED.
8. **One commit:** `T-274: relevance-floor re-measure: script and aggregate result`, ending with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - `git log --oneline 88b2c8d4..HEAD` shows 1 line, and `git status --porcelain` is empty.
   - `git diff --name-only 88b2c8d4..HEAD` must show exactly `docs/loops/t274/floor.mjs` and
     `docs/loops/t274/result.md`. Anything else: STOP, BLOCKED.
9. **Push and PR.**
   - `git push origin docs/t274-floor-remeasure` (never force). `git ls-remote origin refs/heads/docs/t274-floor-remeasure`
     must equal `git rev-parse HEAD`.
   - Then run `gh pr create --base master --head docs/t274-floor-remeasure --title "T-274: relevance-floor re-measure (aggregates only)" --body "Brief: docs/loops/t274-relevance-floor-remeasure-brief.md. Script and aggregate result only; the per-fire data stays on the desktop. Docs-only: no src change; a floor change, if the planner rules one, is a separate PR."`
   - Wait for CI with `gh pr checks <n> --watch --interval 30`, capped at 20 min. A skipped `test` is the pass.

## Reply

The first line is `READY T-274 <sha40> PR #<n>` or `BLOCKED T-274 <reason>`. Then paste each of these with the command
above it:
- RUN_START and `node -v`;
- the build;
- the three self-checks;
- the static proof;
- the mutants;
- the run's stdout, including `live handle readonly`, `live handle total_changes` and the `KNOWLEDGE_V2_DB` line;
- the temp-home listing;
- parts 2, 3 and 4 of `summary.md`, which are aggregates;
- the privacy scan;
- the name-only diff;
- `ls-remote` = `rev-parse`;
- the PR URL and the CI result.

**How the run proves it never wrote to the real DB:**
- The live file is opened once, read-only. `readonly: true` and `total_changes: 0` are printed by the script.
- The static grep shows two read-only opens and writes only under OUT.
- HOME and USERPROFILE point at an empty temp home.
- The live file's mtime and size are NOT the proof: every Claude Code session's PostToolUse hook, this run's included,
  writes `trigger_fires` to it.

**Content rules:**
- No entry text, keys, query text or command text anywhere in the reply (D-090).
- Paste with `grep -a`, or without grep. Mark anything not run `NOT RUN`.
- If the code differs from a line this brief quotes, follow the ruling's intent and say what differed.
- Do not merge.
