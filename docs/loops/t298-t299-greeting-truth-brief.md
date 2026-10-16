# T-298 + T-299 step 1: the greeting says how old its handoff is, never drops the brief line silently, and measures itself

Runtime: CC (claude -p, Sonnet)
SEAT: QA PC one-off, NOT the desktop. No hub key. Code. Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t298s1-reply.md. A reply path in the
launcher's line wins. Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-16, session 173. **Tasks:** T-298 (P1) items (1) and (2), T-299 (P1). **Tag:**
`T-298-S1`. **Size:** MEDIUM. **Base:** the dispatch SHA clark names (a master that contains this brief).
**Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: HandoffSchema renderBriefing renderBudgeted describeLatestBrief latestBriefSelection renderStartReport readGreetingFlags (schema gains one OPTIONAL field nothing writes yet; both briefing layouts gain a note that prints only when that field is present; the latest-brief selector gains an opt-in directory; renderStartReport gains a no-brief line and an opt-in metrics append)
```

## Why

Aaron reviews /start transcripts against a fixed scorecard (Atlas memory `feedback_transcript_reviews_find_sia_issues`).
Three seats failed "does the greeting match the current project state?" and "does it point to where the seat left off?"
on 10-16:

- **Maker S67:** the handoff was written at rev 506, and revs 507-508 landed after it. PICK UP HERE and WAITING ON AARON were
  stale, including a question that had already been answered. Nothing in the greeting could say so, because a handoff
  records no revision. Only a manual `git log` cross-check caught it.
- **Maker S67:** Makerspace keeps its briefs in `.agents/plans/`. `describeLatestBrief` looks only in `docs/loops/` and
  `docs/loop-*.md` and returns null, so the line vanished. "No brief" and "didn't look there" printed the same thing:
  nothing.
- **The dashboard** (Prism's lane, Aaron's request) wants the measurable half of the scorecard on every start, per seat.
  SIA has no record of what any greeting looked like.

## What this step does (and what it doesn't)

1. **Handoff revision, read side only.** `HandoffSchema` accepts an OPTIONAL `written_rev`. **Nothing writes it in this
   step.** An older build rejects a record carrying an unknown key (`strictObject`). On 10-16 Maker's MCP process ran a
   stale build for hours, so the writers wait until every serving build can read the field. That is step 2, a 3-line
   change to `set_handoff`, dispatched by the planner after clark confirms the rebuild everywhere. Here, both briefing
   layouts learn to print the lag when the field is present. With today's records it is never present, so every existing
   render is byte-identical.
2. **Latest brief.**
   - A repo may name its brief directory in `.agents/SYSTEM/greeting.json` as `"brief_dir": "<repo-relative dir>"`. There,
     every tracked `*.md` under that directory is a brief, and the newest by git commit date wins.
   - When no brief is found, `ob_start` prints a **none line that names where it looked**, instead of nothing.
     `describeLatestBrief` itself still returns null for "none", so its existing rows keep their meaning. The none line
     is added at the one call site.
   - **Planner ruling: the none line is DEFAULT ON.** Silence there is the defect. A2A is unaffected today: its
     `docs/loops` holds hundreds of briefs, so the line never reaches the none branch.
3. **Greeting metrics, opt-in** (greeting.json `"greeting_metrics": true`, default off). `renderStartReport` appends ONE
   JSON line per call to `greeting-metrics.jsonl` beside the knowledge store. SIA has no network code. A clark-ops
   transport posts the rows, and Prism builds the panel; neither is in this repo.

## Rulings (exact)

### R1. `open-brain/src/shared/state-schema.ts`

In `HandoffSchema`, after the `first_rev: nonNegInt.nullable(),` member, add:

```ts
  /**
   * T-298: the record revision the write that set THIS handoff produced. OPTIONAL and, until T-298 step 2, written by
   * nothing: an older build rejects an unknown key, so readers ship first. Absent means "not stamped"; the greeting then
   * prints no lag note, never a guessed one.
   */
  written_rev: nonNegInt.optional(),
```

### R2. `open-brain/src/pipelines/session-start/briefing.ts`

- Add and export:
  ```ts
  /**
   * T-298: how far the record has moved since the reader's own handoff was written. Null when there is no own handoff, the
   * handoff is not stamped (`written_rev` absent) or nothing was written after it: the note prints only when it says
   * something.
   */
  export function handoffLagNote(own: { written_rev?: number } | null, revision: number): string | null {
    if (own === null || own.written_rev === undefined) return null;
    const lag = revision - own.written_rev;
    return lag > 0 ? `handoff rev ${own.written_rev} (+${lag})` : null;
  }
  ```
- **Legacy layout** (`renderBriefing`): the session line's `· state rev ${s.revision}` becomes
  `· state rev ${s.revision}${lagSuffix}`, where `lagSuffix` is `` ` · ${note}` `` when
  `handoffLagNote(ownHandoff(s.handoffs, i.seat, i.ownCheckout), s.revision)` is non-null, else `""`. Compute `own` once
  before the session line and reuse it below; the existing `const own = ...` line moves up, it is not duplicated.
- **Budgeted layout** (`renderBudgeted`): the same suffix, at the same place in `sessionLine` (immediately after
  `state rev ${s.revision}`, before ` · ${drift}`). The same move of `const own` applies.

### R3. `open-brain/src/pipelines/session-start/greeting-flags.ts`

Add and export, below `readGreetingFlags`:

```ts
/**
 * T-298: one STRING key from the same file (`brief_dir`). An absent file or key, a malformed file and a non-string value are
 * all null. Validation of the value belongs to the caller, which says what was wrong.
 */
export function greetingString(projectRoot: string, key: string): string | null {
  const abs = join(projectRoot, GREETING_FLAGS_REL);
  if (!existsSync(abs)) return null;
  try {
    const data: unknown = JSON.parse(readFileSync(abs, "utf8"));
    if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
    const v = (data as Record<string, unknown>)[key];
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}
```

Update the `Keys:` comment line to list `brief_dir (string)` and `greeting_metrics`, still sorted.

### R4. `open-brain/src/pipelines/session-start/latest-brief.ts`

- A valid `brief_dir` is non-empty after trimming and trailing-`/` removal. It is not absolute (`isAbsolute`), does not
  start with `/`, contains no `\` and no `..` segment, and is not `.`. Export
  `briefDirSetting(projectRoot): { dir: string } | { invalid: string } | null` (null = key absent).
- In `latestBriefSelection`, when `briefDirSetting` returns `{ dir }`:
  - existence check `existsSync(join(projectRoot, dir))`, returning null if absent;
  - `present` = `git ls-tree -r --name-only HEAD -- <dir>/` filtered to paths ending `.md`;
  - the log = `git log --format=@%cI --name-only --no-renames HEAD -- <dir>/`.
  The selection loop and tie-break are unchanged, and `docs/loops` and `docs/` are NOT searched. Otherwise the existing
  path runs unchanged.
- When it returns `{ invalid }`, `describeLatestBrief` returns
  `` `Latest brief: not determined (greeting.json brief_dir is not a repo-relative directory: ${JSON.stringify(invalid)})` ``,
  and `latestBriefPath` returns null.
- Add and export:
  ```ts
  /** T-298: the line ob_start prints when describeLatestBrief found no brief: where it looked, so "none" and "didn't look" differ. */
  export function describeNoBrief(projectRoot: string): string {
    const s = briefDirSetting(projectRoot);
    return s !== null && "dir" in s
      ? `Latest brief: none (looked in ${s.dir}/, from greeting.json brief_dir)`
      : `Latest brief: none (looked in ${BRIEF_DIR}/ and ${ROOT_BRIEF_DIR}/loop-*-brief.md)`;
  }
  ```
- `describeLatestBrief` keeps returning null for "none". Its existing rows depend on that.

### R5. `open-brain/src/pipelines/session-start/greeting-metrics.ts` (NEW, core side)

It must not import any `MEMORY_SIDE` file (checks.ts:2059; `trigger/` and `db-v2.ts` included). Node builtins and
session-start/shared modules only.

```ts
export const GREETING_METRICS_FILE = "greeting-metrics.jsonl";
export const GREETING_METRICS_SCHEMA = 1;
/** Rotate (rename to `.1`, replacing any old `.1`) before an append that finds the file at or above this size. */
export const GREETING_METRICS_ROTATE_BYTES = 2 * 1024 * 1024;
export const ALARM_IDS = ["tree_diverged", "tree_stale", "record_behind", "stale_process", "build_behind", "old_start_command", "usage_not_checked", "drift_not_fixed", "handoff_missing", "latest_brief_undetermined"] as const;
export const MISSING_POINTER_IDS = ["handoff", "pick_up", "objective", "latest_brief"] as const;
export const UNCHECKED_IDS = ["latest_brief"] as const;
```

**Path:** `join(dirname(process.env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db")), GREETING_METRICS_FILE)`,
exported as `greetingMetricsPath(env = process.env)`.

**Alarms** are matched against the WHOLE report text (header and briefing), one regex per id, multiline:

| id | regex |
|---|---|
| tree_diverged | `/^THIS TREE HAS DIVERGED/m` |
| tree_stale | `/^THIS TREE IS STALE/m` |
| record_behind | `/^THE RECORD HERE IS BEHIND/m` |
| stale_process | `/· STALE PROCESS:/` |
| build_behind | `/^Build \S+ · STALE:/m` |
| old_start_command | `/^OLD \/start/m` |
| usage_not_checked | `/^Usage: not checked/m` |
| drift_not_fixed | `/\(not fixed\)/` |
| handoff_missing | `/Handoff MISSING:/` |
| latest_brief_undetermined | `/Latest brief: not determined/` |

**The row** (`buildGreetingMetricsRow(input, previous, now)`, pure): keys in exactly this order. `previous` is the newest
earlier row with the same `checkout` AND `caller`, or null.

| key | value |
|---|---|
| schema | `1` |
| id | `randomUUID()` (node:crypto) |
| ts | `now.toISOString()` |
| caller | `"mcp"` if callerLabel includes `MCP`, `"cli"` if it includes `CLI`, else `"other"` |
| record_name | the rendered record's `project.name`, clipped to 80 chars, or null |
| repo | basename of `dirname(git rev-parse --path-format=absolute --git-common-dir)` in projectRoot, or null on any git failure |
| checkout | `basename(projectRoot)` |
| agent | the resolved seat's `name`, clipped to 40, or null |
| role | the seat role start-report already narrowed with `isSeat` and passes in, else null (greeting-metrics.ts must NOT import start-report.ts: that is a cycle) |
| session | the session number when a log was created, else null |
| record_rev | the rendered record's `revision`, or null |
| handoff_rev | own handoff's `written_rev`, or null |
| handoff_lag_revs | `record_rev - handoff_rev` when both are numbers, else null |
| lag_reason | null when lag is a number; else, first match: `"no_record"` (no valid record), `"seat_unresolved"`, `"no_own_handoff"`, `"no_stamp"` |
| greeting_chars | `.length` of the Briefing block (`## Briefing` through `## End Briefing`, joined with `\n`), 0 if absent |
| greeting_bytes | `Buffer.byteLength` of the same block, utf8 |
| budget_chars | `BRIEFING_BUDGET.chars` when greeting.json `briefing_budget` is on, else null |
| report_bytes | `Buffer.byteLength` of the full report text (before the Total line), utf8 |
| start_ms | integer ms from `renderStartReport` entry to just before the Total line |
| serving_build | the 7-hex sha captured by `/^Build ([0-9a-f]{7,})/` on the serving line, or null |
| stale_process | `/· STALE PROCESS:/.test(serving)` |
| missing_pointers | ids from MISSING_POINTER_IDS, in that order: `handoff` (seat resolved, no own handoff); `pick_up` (own handoff with blank pick_up); `objective` (record objective null); `latest_brief` (the report printed the none line) |
| unchecked | `["latest_brief"]` if the report has NO `Latest brief:` line at all, else `[]` |
| alarm_streaks | for each ALARM_ID whose regex matches, in ALARM_IDS order: `(previous?.alarm_streaks?.[id] ?? 0) + 1`; absent alarms are not keys |

**Append** (`appendGreetingMetricsRow(path, row)`):
- Read the previous row: the last 64 KB of the file, scanned from the end for the newest parseable line with the same
  `checkout` and `caller`. Unparseable lines are skipped.
- Rotate per `GREETING_METRICS_ROTATE_BYTES`.
- `appendFileSync(path, JSON.stringify(row) + "\n")`.
- The caller builds the row after reading `previous`, so the order is: read previous → build → rotate → append. Export
  one function `recordGreetingMetrics(input): { ok: true } | { ok: false; why: string }` that does all of it and
  **never throws**.

### R6. `open-brain/src/pipelines/session-start/start-report.ts`

- First statement of `renderStartReport`: `const startedAt = Date.now();`.
- `const latestBrief = describeLatestBrief(projectRoot);` becomes
  `const latestBrief = describeLatestBrief(projectRoot) ?? describeNoBrief(projectRoot);`. The header line and the
  briefing both receive it, as today.
- Just before `const text = lines.join("\n");` at the end of the function, when
  `greetingFlag(projectRoot, "greeting_metrics")` is true:
  - call `recordGreetingMetrics` with what it needs (the record rendered, the seat, the serving line, the report text so
    far, the session number, the callerLabel, projectRoot and startedAt);
  - on `{ ok: false, why }`, push `` `\nGreeting metrics: not written (${why})` ``;
  - on success, push nothing.
- **The metrics never change `isError`, and never change any line of the report except that one failure line.**

## Test file

`open-brain/tests/pipelines/session-start/t298-greeting-truth.test.ts`. Every row is a plain `it()` (S4-9.2: no skip,
skipIf, runIf or todo). Temp dirs are made with `mkdtempSync` and removed in a `finally`. Set `process.env.KNOWLEDGE_V2_DB`
to a temp path for every metrics row, and restore it in the `finally`.

- **G1** (schema): parse a minimal valid state (reuse the fixture builder the state-schema tests use) whose one handoff
  carries `written_rev: 506`. It parses. With `written_rev: -1` it fails. Without the key it parses.
- **G2** (lag note, legacy): a state at `revision: 508` whose planner handoff for the reader has `written_rev: 506`.
  `renderBriefing(...)` with `seat: "planner"` contains a line with `state rev 508 · handoff rev 506 (+2)`.
- **G3** (lag note, budgeted): the same with `budget: true`. The session line contains `state rev 508 · handoff rev 506 (+2) · Drift`.
- **G4** (no note at lag 0 and when unstamped): `written_rev: 508` at `revision: 508`, and a second render without
  `written_rev`. Neither render contains `handoff rev`. Both legacy renders equal, line for line, the render of the same
  state with `written_rev` deleted.
- **G5** (brief_dir): a git repo with
  - `docs/loops/loop-9-brief.md` committed 2026-09-30;
  - `.agents/plans/t173-wp-redirects.md` committed 2026-10-10;
  - `.agents/plans/prod-release-1016b.md` committed 2026-10-16;
  - greeting.json `{"brief_dir":".agents/plans"}`.
  `describeLatestBrief` returns `Latest brief: .agents/plans/prod-release-1016b.md (2026-10-16)`.
- **G6** (none lines): a repo with no brief anywhere. `describeNoBrief` returns
  `Latest brief: none (looked in docs/loops/ and docs/loop-*-brief.md)`. With greeting.json
  `{"brief_dir":".agents/plans"}` and an empty-but-present `.agents/plans/` holding one committed `.txt`, it returns
  `Latest brief: none (looked in .agents/plans/, from greeting.json brief_dir)`.
- **G7** (invalid brief_dir): with `{"brief_dir":"../elsewhere"}`, `describeLatestBrief` matches
  `/^Latest brief: not determined \(greeting.json brief_dir is not a repo-relative directory: "\.\.\/elsewhere"\)$/`.
- **G8** (metrics row): `buildGreetingMetricsRow` for a fixture input with
  - a report text whose FIRST line is the serving line below (as renderStartReport's is), and which contains `THIS TREE HAS DIVERGED from origin/main: ...`, `Usage: not checked (x)` and
    `Latest brief: none (looked in docs/loops/ and docs/loop-*-brief.md)`;
  - serving `Build a346e5b · STALE PROCESS: disk has 0dcf8f4 (built x) → /mcp reconnect open-brain`;
  - record revision 508, own handoff unstamped;
  - previous null.
  Expect:
  - `Object.keys(row)` equals the R5 table order;
  - `schema` 1, `stale_process` true, `serving_build` `"a346e5b"`;
  - `handoff_lag_revs` null with `lag_reason` `"no_stamp"`;
  - `missing_pointers` contains `latest_brief`, `unchecked` `[]`;
  - `alarm_streaks` `{ tree_diverged: 1, stale_process: 1, usage_not_checked: 1 }`, deep equal;
  - `Buffer.byteLength(JSON.stringify(row)) < 2048`.
- **G9** (streaks chain only on the same checkout and caller): through `recordGreetingMetrics` into a temp file:
  - two appends for checkout `a`, caller `mcp`, both diverged. The second row's `alarm_streaks.tree_diverged` is 2.
  - A third append for checkout `b` gets 1.
  - A fourth for checkout `a`, caller `cli`, gets 1.
  - A fifth for `a`/`mcp` without the alarm has no `tree_diverged` key.
- **G10** (rotation): pre-fill the file with `GREETING_METRICS_ROTATE_BYTES` bytes of `x\n` lines, then append once. The
  `.1` file exists with the old size, and the live file holds exactly 1 line.
- **G11** (never throws): `KNOWLEDGE_V2_DB` points into a directory where `greeting-metrics.jsonl` is itself a DIRECTORY.
  `recordGreetingMetrics` returns `{ ok: false }` with a non-empty `why`.
- **G12** (start report, opt-in and default off): two fixture projects with a valid `.agents/state.json` (reuse an
  existing start-report fixture builder) and no brief.
  - Without greeting.json: `handleStart` text contains `Latest brief: none (looked in docs/loops/`, and no metrics file
    is created.
  - With greeting.json `{"greeting_metrics": true}`: the file exists with exactly 1 line, which parses with `schema` 1,
    and the report does NOT contain `Greeting metrics: not written`.
  - Timeout 120000 ms.

**Expected at commit 1 (the base):** every G row RED (most fail on missing exports, which is fine: paste the summary).

## Existing tests (verdicts)

The planner grepped `open-brain/tests` for `Latest brief`, `describeLatestBrief`, `latestBriefPath`, `HandoffSchema` and
`renderBriefing` at ce83bde2:

- `tests/pipelines/session-start/latest-brief.test.ts`:
  - **T210-7** (line 162) turns RED: its no-brief half asserts `not.toContain("Latest brief")` (line 181). In commit 2,
    replace that one assertion with
    `expect(without).toContain("Latest brief: none (looked in docs/loops/ and docs/loop-*-brief.md)");` and rename the
    row to `"... and prints where it looked when there is no brief"`.
- `tests/pipelines/session-start/briefing.test.ts`, two rows turn RED (42 lines against 41; QA PC SIM at 18cb8004,
  clark 10-16, 3 failed | 757 passed):
  - "the block in ob_start's output is exactly renderBriefing's output for the same record" (line 454);
  - "QA 263 F4: serving_build_dir is not in ob_start's MCP schema, ... and the MCP block is renderBriefing's" (line 550).
  Each builds its expected input with a literal `latestBrief: null` (lines 476 and 595), and the fixture has no brief.
  In commit 2, change both literals to
  `latestBrief: "Latest brief: none (looked in docs/loops/ and docs/loop-*-brief.md)"`.
- **These three are the ONLY existing rows that change.** The SIM measured that patch on the full set run in step 4 and
  found no others.
  - Every `toBeNull()` row (T210-2, 2b, 2c and the T-277 ones) stays green: `describeLatestBrief` still returns null.
- `briefing.test.ts:142` (renderBriefing with `latestBrief: null` omits the line) stays green, because renderBriefing is
  unchanged for null.
- `briefing-fix.test.ts:464/479`, `briefing-budget.test.ts`, `handoff-by-checkout.test.ts`, `missing-handoff.test.ts`,
  `t252-briefing-followups.test.ts`, `a2a-byte-identical.test.ts`, `state-schema.test.ts`, `handoff-guard.test.ts` and
  `handoff-caps.test.ts` stay green: no fixture carries `written_rev`.
- **Budget worst case:** `briefing-budget.test.ts` "WORST CASE with EVERY flag on" (line 263) stays green as written. In
  commit 2, ALSO add `written_rev` to its worst-case reader handoff so the lag note is present, at a revision 999 above
  it (`+999`). The row must stay ≤ `BRIEFING_BUDGET`. **If it goes over, STOP: `BLOCKED T-298-S1 budget <chars>/<lines>`.**
  Do not trim other content to fit; the planner rules on that.
- `tests/pipelines/sync/start-parity.test.ts` stays green (it reads command text, not output).

Any other red row: STOP, `BLOCKED T-298-S1 <test name>`.

## Steps

1. PowerShell:
   `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t298s1-reply.md")); "REPLY_PATH=$reply"`, then
   `$env:Path = 'C:\Program Files\nodejs;' + $env:Path`, then `node -v` (must print `v22.*`; otherwise STOP).
2. Fresh clone into `(Join-Path $env:TEMP "t298s1-wt")` unless the launcher named one.
   - `git checkout -q -b fix/t298-greeting-truth <base>`.
   - Check that `git rev-parse HEAD` equals the base, that `git status --porcelain` is empty, and that
     `git ls-tree --name-only HEAD docs/loops/t298-t299-greeting-truth-brief.md` prints the path.
   - `npm ci` in `open-brain`, then `node -e "require('better-sqlite3')"`. On "Could not locate the bindings file", run
     `npm rebuild better-sqlite3` and say so.
   - **Forbidden:**
     - `git stash`, `reset --hard`, `--force`, rebase and amend;
     - `cd` into another checkout;
     - `npm run test:heavy`;
     - killing any process by name;
     - any read or write of the real `~/.claude/open-brain/` (every metrics row uses a temp `KNOWLEDGE_V2_DB`);
     - any edit of any real `settings.json` or of this repo's `.agents/SYSTEM/greeting.json`.
   - **Edit files with the Edit tool or `sed -i` from Git Bash, never PowerShell `Get-Content | Set-Content`**: it
     mangles the `—`, `·` and `…` these files carry.
3. **Commit 1, `T-298-S1: rows for handoff lag, brief_dir, the no-brief line and greeting metrics`:** the test file only.
   - `$env:NO_COLOR='1'`; in `open-brain`, run
     `npx vitest run tests/pipelines/session-start/t298-greeting-truth.test.ts --no-file-parallelism --testTimeout=180000`.
   - Every G row must be red. Paste the summary and the `x` rows.
4. **Commit 2, `T-298-S1: handoff lag note (read side), brief_dir + no-brief line, opt-in greeting metrics`:** rulings
   R1 to R6, plus the existing-test edits named above (T210-7; briefing.test.ts lines 476 and 595; the worst case's
   `written_rev`).
   - Run `npx vitest run tests/pipelines/session-start tests/shared tests/pipelines/sync/greeting-size.test.ts tests/pipelines/sync/start-parity.test.ts tests/pipelines/fleet-ae-f4.test.ts --no-file-parallelism --testTimeout=180000`
     with a 25-minute wall-clock cap. All green. Paste the `Test Files` and `Tests` lines.
   - Run `npx vitest run tests/pipelines/sync/module-boundary.test.ts --no-file-parallelism --testTimeout=180000`. The
     module-boundary check must stay green with the new file. Paste the summary.
   - Then `npx tsc --noEmit` and `npx tsc -p tsconfig.tests.json --noEmit` (both exit 0), and `npm run build` (exit 0).
5. Both commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   `git log --oneline <base>..HEAD` shows 2 lines; `git status --porcelain` is empty.
6. **Mutants**, each made with `sed -i` or the Edit tool. For each one:
   - Run `npx vitest run tests/pipelines/session-start/t298-greeting-truth.test.ts --no-file-parallelism --testTimeout=180000`.
   - Paste the summary, the `x` rows and the mutant's `git diff` line.
   - Restore with `git checkout -- <file>` and check that `git status --porcelain` is empty. Never commit a mutant.

   The mutants:
   - **M1** briefing.ts, in `handoffLagNote`, `lag > 0 ?` becomes `lag >= 0 ?`. Expect **G4** red.
   - **M2** greeting-metrics.ts, in the streak, `?? 0) + 1` becomes `?? 0) + 0`. Expect **G8 and G9** red.
   - **M3** start-report.ts: the `greetingFlag(projectRoot, "greeting_metrics")` condition becomes `true`. Expect **G12**
     red (its default-off half finds a file).
   - **M4** start-report.ts: `?? describeNoBrief(projectRoot)` is deleted. Expect **G12** red. Also run
     `latest-brief.test.ts` and `briefing.test.ts` under M4 and paste: expect T210-7 and the two rows at lines 454
     and 550 red.
   - **M5** greeting-metrics.ts: the previous-row match drops the `caller` comparison. Expect **G9** red (its fourth
     append chains to 3).
7. `git diff --name-only <base>..HEAD` shows exactly these files:
   - `open-brain/src/pipelines/session-start/briefing.ts`
   - `open-brain/src/pipelines/session-start/greeting-flags.ts`
   - `open-brain/src/pipelines/session-start/greeting-metrics.ts`
   - `open-brain/src/pipelines/session-start/latest-brief.ts`
   - `open-brain/src/pipelines/session-start/start-report.ts`
   - `open-brain/src/shared/state-schema.ts`
   - `open-brain/tests/pipelines/session-start/briefing-budget.test.ts`
   - `open-brain/tests/pipelines/session-start/briefing.test.ts`
   - `open-brain/tests/pipelines/session-start/latest-brief.test.ts`
   - `open-brain/tests/pipelines/session-start/t298-greeting-truth.test.ts`
8. Push and open the PR:
   - `git push origin fix/t298-greeting-truth` (never force). `git ls-remote origin refs/heads/fix/t298-greeting-truth`
     must equal `git rev-parse HEAD`. If the push is rejected, STOP.
   - `gh pr create --base master --head fix/t298-greeting-truth --title "T-298-S1: handoff lag note (read side), brief_dir + no-brief line, opt-in greeting metrics" --body "Brief: docs/loops/t298-t299-greeting-truth-brief.md. written_rev is READ only; nothing writes it until step 2. Metrics are opt-in (greeting_metrics). The no-brief line is default on (planner ruling)."`.
   - `gh pr checks <n> --watch --interval 30` (cap 25 min). Paste the `test` conclusion.

## After the merge (planner, not this run)

- **Step 2:** `set_handoff` writes `written_rev: ctx.rev` (state-writer.ts, the `entry` object), with one row. It is
  dispatched only after clark confirms that every serving build (the desktop main tree and MCP processes, the QA PC and
  the laptop) is at or past this merge.
- **Opt-ins:** records changes per repo. SIA: `greeting_metrics`. Makerspace: `greeting_metrics` and
  `"brief_dir": ".agents/plans"`, by Maker in its own repo. Those are not this run.
- **Schema:** the pinned row is R5's table. Prism's panel refuses an unknown `schema`. Adding an alarm, pointer or
  unchecked id later bumps `schema`.

## Reply

- **First line:** `READY T-298-S1 <sha40> PR #<n>`, or `BLOCKED T-298-S1 <reason>`.
- **STOP rules:** at most 2 attempts at any one step, never "fix until green". A STOP still writes the reply.
- Then each command with its output. Every number is pasted output, with the command shown above it. Mark anything not
  run `NOT RUN`. Do not merge.
