# T-264: does an injected lesson change the next act? The recall-trigger effect measurement (D-148)

Runtime: CC (claude -p, Opus 5.5)
SEAT: desktop one-off (no hub key). It MUST run on the desktop: the knowledge DB and the transcripts it reads exist only there.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the desktop user's %TEMP% named t264-reply.md. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 168. **Task:** T-264 (D-148). **Tag:** `T-264`. **Size:** MEDIUM.
**Base:** `d0e1f8cdec09795cc5c06a9c065a2aa378cd1125` (origin/master). **Design, read it first:**
`docs/loops/recall-effect-design-2026-10-11.md` (grok-audit's spec plus planner notes). Where this brief and the design
differ, this brief wins.

```text
IMPACT-TARGETS: none — nothing under open-brain/src, open-brain/tests, hooks, .claude, project-template or any package file changes
```

## Why

D-148 (Aaron, 2026-10-11): "run the recall-trigger loop, bounded: does an injected entry change the next act ... no new
code unless the data says so." Its precondition, T-245 Option A, closed in session 168. This run measures and reports.
It changes no product code; if the data says a change is needed, the report names it and the planner briefs it.

## What the planner measured first-hand (2026-10-13 ~14:00Z, read-only)

- `trigger_fires` in the live DB: **injected 1020, silent 14076, not-asked 17194**, over 325 sessions, from
  2026-09-21T04:08Z.
- **Every injected fire injected entry 299** (`pipe-to-tail-masks-exit-code`). Arm A therefore measures entry 299 only.
  Injected fires by stored command: cd 279, `?` 260, git 97, npx 60, node 41, export 39, ssh 38, gh 37.
- **A CC transcript records an injected fire exactly:** an `attachment` record with `type: "hook_success"`,
  `hookName: "PostToolUse:Bash"`, `toolUseID` = the triggering tool_use's id, `command` containing
  `cli-recall-trigger.js`, and `stdout` = the hook JSON whose `hookSpecificOutput.additionalContext` is the injected text
  verbatim (`[stored knowledge 299 — pipe-to-tail-masks-exit-code] ...`). A second record, `type:
  "hook_additional_context"`, follows it. **A silent or not-asked fire leaves no attachment at all** (its stdout is empty
  and is not logged), so Arm B is anchored by time and basename as the design says.
- **Precision, seen in the planner's own session today:** the trigger injected 299 after a command that ALREADY read
  `${PIPESTATUS[0]}`. Some injections land on commands that already follow the advice. That is a precision question,
  separate from the effect question, and section 3f measures it.
- The helpers to import, not reimplement (paths in `open-brain/src`, built to `open-brain/build`):
  `actionOf(content)` in `trigger/run.ts:55`; `formatCommandFireLog(command)` in `trigger/command-log.ts:35` (the stored
  basename); `queryStore({ db, command, floor, limit })` in `trigger/query.ts:145`. `queryStore` takes the FULL command
  text and derives the FTS query itself.

## Rules

- **Read-only on Aaron's data.** First snapshot the DB: open `%USERPROFILE%\.claude\open-brain\knowledge-v2.db` with
  better-sqlite3 `{ readonly: true, fileMustExist: true }`, `await db.backup(<OUT>\kv2-snapshot.db)`, close it. Analyse
  ONLY the snapshot, and set `KNOWLEDGE_V2_DB` to the snapshot for anything you import that opens a DB. Never open the
  live DB writable. This run's own Bash calls add fires to the live DB after the snapshot; they are not in the data.
- Transcripts: `%USERPROFILE%\.claude\projects\*\*.jsonl`, read-only, streamed line by line. Skip unparsable lines and
  count them.
- **OUT** = the absolute path `%TEMP%\t264-recall-effect\` (outside every repository). Everything that contains
  transcript text stays in OUT. The script refuses an OUT inside the clone.
- **Privacy: the repository is PUBLIC.** Committed files carry NO transcript text, NO command text, NO paths taken from
  transcripts and NO session uuids: only counts, rates, intervals, entry ids and keys, and program basenames.
- No network except `git push` and `gh`. No LLM or API calls: the design's judge step (2.3) is NOT RUN, so UNDETERMINED
  stays UNDETERMINED.
- No `git stash`, `reset --hard`, `--force`, rebase or amend. No `cd` into any other checkout.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t264-reply.md")); "REPLY_PATH=$reply"`,
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, `node -v` (must be `v22.*`, else BLOCKED).
2. `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t264-wt")`, `Set-Location`
   into it, `git checkout -q -b docs/t264-recall-effect d0e1f8cdec09795cc5c06a9c065a2aa378cd1125`. `git rev-parse HEAD`
   must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED. In `open-brain`: `npm ci`, then
   `npm run build`.
3. Write `docs/loops/t264/measure.mjs` (Node 22 ESM; imports the three helpers from `../../../open-brain/build/...`;
   arguments `--out <OUT>`). It implements the design's Parts 1-5 with these overrides:
   - a. **Census first:** fires by state x stored command; sessions with fires; per state, how many fires have a
     transcript (`NO_TRANSCRIPT` otherwise); unparsable transcript lines.
   - b. **Arm A anchor = the attachment.** Join each injected fire to its `hook_success` attachment by session uuid,
     the injected id in the additionalContext text, and the nearest timestamp within 5 s. A fire with no attachment is
     anchored by Part 1.4 and flagged `ANCHOR_INFERRED`.
   - c. **Arm B anchor** (silent fires) by Parts 1.4-1.5 exactly, matching the anchor's basename through
     `formatCommandFireLog`.
   - d. Next act, gap and next_text_before by Parts 1.6-1.7; outcome by Part 2.2 rules a-e and 2.4.
   - e. **Arm B's would-have-been entry** (Part 3.1): `queryStore({ db: <snapshot>, command: <the anchor's full command
     text from the transcript>, floor: -Infinity, limit: 1 })`. Read `query.ts` to confirm that `-Infinity` admits every
     hit under its floor comparison, and say so in the reply. Without an anchor, the fire has no would-have-been entry.
   - f. **Entry-299 section** (new; every injected fire is 299). Classify each Arm A anchor command:
     `COMPLIANT` (it reads `PIPESTATUS`, or captures the status before any pipe), `VIOLATING` (a pipe into a trimmer such
     as tail/head/grep/sed/awk, then a `$?` read of that pipeline in the same command), or `NOT_APPLICABLE` (no
     exit-status read). The three counts are the trigger's **precision** on 299. For `VIOLATING` anchors only, find the
     next Bash command in the same session (within 20 tool calls) that again pipes into a trimmer AND reads an exit
     status: `FOLLOW` if it uses `PIPESTATUS`, `REPEAT` if it reads `$?` after the pipe, `NONE` if there is no such
     command. For sessions with 2 or more injections, compare the first injection's anchor class with the later ones'.
     Write the classifier as one exported function with a fixed-string self-check (at least 6 commands, each with its
     expected class) that runs before the analysis and stops the script if any case fails.
   - g. **Gate and intervals** (Part 4.2): a Wilson 95% interval on every rate, and `INSUFFICIENT` with the counts when
     either arm has fewer than 30 determinate-scored fires in shared strata.
4. Run it: `node docs/loops/t264/measure.mjs --out <OUT>`. OUT gets `fires.csv` (one row per fire: Part 5's columns
   plus the 299 fields; local only) and `summary.md` (aggregates only).
5. Copy `summary.md` to `docs/loops/t264/result.md`. **Privacy scan** before committing: `result.md` must not contain
   `C:\`, `/Users/`, `\Users\`, a 36-character uuid, or a backtick-quoted command line. Print the scan's command and
   output.
6. One commit, `T-264: recall-trigger effect measurement (D-148): script and aggregate result`, with exactly
   `docs/loops/t264/measure.mjs` and `docs/loops/t264/result.md`, ending with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git diff --name-only d0e1f8cd..HEAD` must show exactly
   those two files.
7. `git push origin docs/t264-recall-effect` (never force). `git ls-remote origin refs/heads/docs/t264-recall-effect` must
   equal `git rev-parse HEAD`. Then `gh pr create --base master --head docs/t264-recall-effect --title "T-264:
   recall-trigger effect measurement (D-148), aggregate result" --body "Brief: docs/loops/t264-recall-effect-brief.md.
   Aggregates only; the per-fire data stays on the desktop."` Wait for CI (`gh pr checks <n> --watch --interval 30`, cap
   20 min). For a docs-only PR, `test` reports skipped, and that is the pass.

## result.md answers, in this order

1. The census table.
2. The gate: PASS or INSUFFICIENT, with the counts.
3. If PASS: the FOLLOW rate per arm x stratum with Wilson intervals, the effect A − B, and the design's 3.3 caveat
   (B's entries scored below the floor, so the effect is an upper bound confounded with relevance).
4. Entry 299: precision (COMPLIANT / VIOLATING / NOT_APPLICABLE), the VIOLATING follow-up (FOLLOW / REPEAT / NONE), and
   the within-session comparison.
5. **The answer to D-148's question in at most three sentences,** and whether the data says any code should change. Name
   the change; do not make it.
6. Limits: C3, C4, C7, the `ANCHOR_INFERRED` share and the `NO_TRANSCRIPT` share.

## Reply

The first line is `READY T-264 <sha40> PR #<n>` or `BLOCKED T-264 <reason>`. Then: the census, the gate, the 299 numbers,
the classifier self-check output, how `-Infinity` behaves in `queryStore`, the privacy scan, OUT's absolute path, the PR
URL and CI. Mark anything not run `NOT RUN`. Do not merge.
