# T-048: silent row-drops in `open-brain/src`

**By:** Grok, developer seat, record 139. **Model:** Grok 4.7 (Cursor). **Date:** 2026-09-26.
**Base:** `origin/master` `7640b93` (`Merge pull request #165`). Branch `research/t048-audit`.
**Brief:** `docs/loops/t048-audit-brief.md` on `origin/docs/session-100-qa99-dispatch`.
**Scope:** read only. No product change. Tests, scripts, and `project-template/` were not audited.
**Label:** every row below is **READ** (the function was opened). Nothing in the tables is inferred from a name alone.

The invariant: a filter that drops rows must emit the dropped count, so "none existed" and "some were dropped" are not the same value.

## How this was searched

All 71 `.ts` files under `open-brain/src` on this base. Non-comment hits: `continue`, `.filter(`, `.flatMap(`, a `catch` that does not rethrow, and `??` to `[]` / `""` / `{}`. That is 383 sites. Each site whose subject is a record, file, log line, scan target, or result was read in its function. Blank-token filters (empty strings after `split`, path segments, argv flags) are **INTENDED** and are not given a row: an empty token is not a row, and counting it would not tell a caller anything.

`open-brain/src/harness/configwatch.ts` is not on this base. `ef2a8a7` (A11, in QA) changes that file and a test only. No finding below sits in an A11-changed file. The harness files that do exist on master were read.

`/sync` was run `check_only` against this tree before the write-up. It did not edit files. Its retirements issue (`.agents/SYSTEM/ENTITIES.md`) shows the readable path of `checkRetirements` does fire. The finding below is the unreadable path, which that run did not exercise.

## Counts

| Class | Count |
|---|---|
| SILENT | 26 |
| SAFE | 16 |
| INTENDED | the remaining pattern hits, by the categories under that heading |

SILENT is ranked by what reaches the user or the record when the drop happens. A false green on a commit gate ranks above a collapsed diagnostic.

## SILENT

| # | Site | What is dropped | What the caller sees |
|---|---|---|---|
| 1 | `pipelines/sync/checks.ts:1078` `checkRetirements` | A scannable file whose `readFileSync` throws. `catch { continue }`. | A pass: "0 unexpected across N live files". N includes the file that was not read. A retired name in that file ships. |
| 2 | `pipelines/sync/checks.ts:1240` `checkModuleBoundary` | A directory whose `readdirSync` throws. The walk `return`s. Those `.ts` files never enter the graph. | A pass on a partial tree. `unresolved` counts only imports that were seen. An unreadable subdirectory looks like it contains no core files. |
| 3 | `pipelines/sync/checks.ts:382` and `:392` `checkTemplatePersonalNames` | A directory `readdir` failure returns without a count. A file read failure is swallowed ("binary or unreadable"). | Zero hits is a pass. An unreadable prose file and a binary share that swallow, so a leak in an unreadable file is "no personal names". |
| 4 | `server.ts:856` `ob_recall` | `recordRecallEvent` throws. The `catch` is empty. | The hits are still printed. The "NOT LOGGED" line at `:861` runs only when there is no session id. A failed write with a live session looks logged. `recall_log` then has no row, so a later `/end` resolves fewer ids. |
| 5 | `pipelines/session-end/index-v2.ts:110` `sessionEndV2` | A recalled id whose `knowledge_index` row is missing. Bare `continue`. | `Feedback: N` is smaller than `Recalled ids: M`. The gap is also how `:126` skips an id with no supplied judgment, so a deleted row and an omitted judgment are one number. The missing id is not named. |
| 6 | `pipelines/session-end/invocation-logger.ts:69-81` `readLastInvocationTs` | A JSONL line with no `ts`, a bad `ts`, or invalid JSON. | The function returns the newest good `ts`, or `null`. `null` is also what a missing file returns (`:61`) and what an unreadable file returns (`:81`). The health score treats `null` as "the hook has not run". A corrupt log and a missing log are the same input. |
| 7 | `invocation-logger.ts:122` and `:181` `logInvocations`; printed at `server.ts:513` and `cli-session-end.ts:104` | A session db with no `session_events` table (`continue`, not counted). A db that throws on open (`catch`, not counted). An append that throws (`:179`, not counted). `skippedSessions` increments only when the session was already logged (`:130`). | Both reporters print `logged` and not `skippedSessions`. `logged: 0` is an empty directory, a directory of unreadable dbs, and a directory of already-logged sessions. |
| 8 | `shared/skill-index.ts:60` `parseSkillIndexRows` | The `## Skills` section is absent. Returns `{ rows: [], dropped: [] }`. | `checkSkillIndex` then passes: "parses cleanly (0 skill(s))". `countSkills` returns 0, and the health score stores that. A missing file is a different message ("absent"). A present file whose heading was lost looks like a real empty table. Malformed data rows are SAFE (they go to `dropped` and fail the check). This residual is the heading, not the row. |
| 9 | `server.ts:498-502` `handleEnd` | `resolved.reason`. `formatRecalledResolution` is imported and not called. The hook path (`cli-session-end.ts:88`) does call it. | MCP `ob_end` prints `Recalled ids: 0 from none` plus a rejected-file line when there is one. When there is no file to reject, "no session id" and "no recall_log rows" are the same sentence. Those two strings are what `reason` was added to separate. |
| 10 | `pipelines/sync/checks-memory.ts:68` `checkVaultIndexParity` | A vault directory whose `readdirSync` throws. The walk returns `[]` for that subtree. | Those notes are not in `files`, so they are not "unindexed". An unreadable `Experiences/` and an empty one both yield "agree (0 notes)" when the index side is also empty. |
| 11 | `trigger/query.ts:168` `queryStore` | Hits under `relevance_floor`. | `runTrigger` records `state: "silent"` and `injectedIds: []` for both "FTS returned nothing" and "FTS returned rows, the floor removed all of them". `not-asked` is a different state and is SAFE. The channel staying quiet is the ruling. The fire row does not carry the dropped count. |
| 12 | `pipelines/session-start/health-checks.ts:44` | `git log` throws. Empty `catch`. | No backup warning. A vault whose git failed and a vault backed up within 36h look the same. |
| 13 | `health-checks.ts:114` | Any throw in the transcript scan. `catch { /* don't block startup */ }`. | No pipeline warning. The check did not run, and the greeting does not say so. |
| 14 | `pipelines/session-end/session-summary.ts:61-62` `findSessionDb` | A session db that throws on open, while a target session id was requested. | Returns `null`, the same as "no db has that session id". The summary stage then skips. |
| 15 | `session-summary.ts:86`, `:95`, `:98`, `:109` `extractSessionSummary` | Open failure, missing `session_events`, missing `session_meta`, or zero events. | All four return `null`. The session-end line is "Summary: skipped" for a missing file, an unreadable file, and an empty event table. |
| 16 | `index-v2.ts:146` | `recordFeedbackEvent` throws. The counter update and the `ratings` push have already happened. | `Feedback: N` includes the id. `feedback_log` does not. Shadow scoring reads the event table, so the label the report counted is absent from the record it scores. |
| 17 | `pipelines/topics/index.ts:105` `readSummaries` | An unreadable `.md` under `Summaries/`. | The note is not in the topic plan and not in `findOrphans`, because orphans are computed from the same list. A note that could not be read looks like a note that is not there. Non-`.md` names are INTENDED. |
| 18 | `pipelines/shadow/evaluate.ts:142` `runStrategyQuery` | The precise FTS query throws. `return []`. | The strategy is scored as having returned nothing. Live `ob_recall` prints "FTS search error" for the same failure (`server.ts:881`, SAFE). The replay does not. |
| 19 | `pipelines/sync/score.ts:50` `computeScore` | `domains.json` is present and `JSON.parse` throws. | `domainTags` stays `[]`, which is also the value when the file is absent and when the keys are missing. Coverage is scored unscoped, and the score does not say the file was unreadable. |
| 20 | `pipelines/sync/checks.ts:1145` `listScannableFiles` | Tracked files whose extension is not `md`, `ts`, `mjs`, `cjs`, `js`, or `json`. | `checkRetirements` reports "0 unexpected across N live files" where N is this filtered list. A retired name in a tracked `.sh`, `.yml`, or `.toml` is not a finding and is not a dropped count. |
| 21 | `pipelines/session-start/agent-identity.ts:44` `parseDeclaration` | No `---` block. Also: a line that is not `key: value` (`:49`), and a value that is empty or starts with `<` (`:51`). | All of those return `null`, and so does a missing file (`:40`). The greeting says the seat is UNRESOLVED. It does not say the file was present and unreadable as frontmatter. This is the in-tree shape of Prime's frontmatter-less `SKILL.md`. Prime's loader itself is not in this tree. |
| 22 | `pipelines/session-start/session-log.ts:41` `findExistingSessionLog` | A `Session_N.md` that throws on read. | The file is skipped. If it was the log for this session id, the function returns null and `ob_start` mints another `Session_N.md`. The unreadable file is not named. |
| 23 | `health-checks.ts:69` | A project directory under `~/.claude/projects` that throws on `readdir`. | That project's transcripts are not candidates for "newest". The warning, if any, names a different session. The skipped directory is not counted. |
| 24 | `health-checks.ts:97` | An unreadable summary file. | The scan treats it as not containing the session id. The warning says the session has no Obsidian capture. Unreadable and absent are the same warning. |
| 25 | `pipelines/sync/checks.ts:165` `checkHookConfigs` | A hook entry that is not an object. | The entry is skipped. The pass says "All hook command files exist". A malformed entry is not a missing file and is not counted. Non-node commands (`:168`) are INTENDED: the check's subject is node and `tsx` script paths. |
| 26 | `pipelines/sync/checks.ts:1154` and `:1160` `walkTracked` | Fallback only, when `git ls-files` fails. An unreadable directory returns the partial list. An unstatable path is skipped. | The caller cannot tell a partial walk from a full one. The primary path is git, so this is the same class on the smaller path. |

## SAFE

The drop is counted, named, or refused. Included because each one is the class, and it already emits.

| Site | What is dropped | Where the count is |
|---|---|---|
| `shared/skill-index.ts:79` | A `## Skills` data row with no domain. Header and separator rows are structure. | `dropped[]`. `checkSkillIndex` (`checks.ts:341`) fails `/sync` with the length and the first line. |
| `pipelines/session-end/recalled-ids.ts:161` | Nothing resolved, or a file refused. | `formatRecalledResolution` prints the count, the origin, and the reason, including at zero. The hook calls it. The MCP path does not (SILENT 9). |
| `pipelines/session-end/index-v2.ts:15` area, type at `:15` | `harmful` had no slot on the auto path in v0.15.0. | `FeedbackRating` is `"helpful" \| "harmful" \| "neutral"`. The unrepresentable case is closed. The missing-row continue (SILENT 5) is a different hole. |
| `pipelines/session-start/role-files.ts:143` and `:167` | A role file that is not on disk. | The problem text says ABSENT, and the render line is "N of M". |
| `pipelines/session-start/state-render.ts:61` | Older verified claims past the clip. | `omitted` is printed with the total. |
| `harness/workspace.ts:164-179` `enforceAllowlist` | An unsafe path, and a duplicate path. | `examined` includes `unsafe.length`. A duplicate is kept once, not discarded. The verdict reports `examined` unconditionally. |
| `harness/refwatch.ts:208` and `:214` | An unchanged ref, and the deferred HEAD ref. | Unchanged refs are not events. The deferred delta is stored, not dropped. |
| `checks.ts:1296` | A relative import that does not resolve. | The check returns `issue` with the unresolved count and refuses a clean graph. |
| `checks-memory.ts:88-106` | Duplicate, unindexed, and dangling notes. | The warning names each count. The walk hole is SILENT 10. |
| `checks-memory.ts:189` | Project directories that are not on disk. | The warning names `missing.length` and each path. |
| `server.ts:284` | A state file that is not present. | The size block prints `absent`. |
| `server.ts:881` | An FTS failure during `ob_recall`. | The text says "FTS search error". |
| `trigger/run.ts:82` and `:100` | A command with no recognised element, versus a query that injected nothing. | Recorded as `not-asked` and `silent`. The floor's dropped count is SILENT 11. |
| `pipelines/state-import/index.ts` (`skipped`, `not_judged`) | A decision line or a staleness input that is not imported. | Both arrays are rendered (`Skipped:` and the staleness list). |
| `relocate.ts:132` | A note that fails to move. | `noteFailures` carries the path and the reason. A note outside the old folder is not a candidate (INTENDED). |
| `shared/state-writer.ts:252` and `server.ts:429` | Done tasks past retention. | `dropped_task_ids` is returned and `ob_state` prints the ids or "none". |

## INTENDED

The dropped set is not a row the caller could mistake for "none existed", or the exclusion is the operation.

- **Blank tokens and path segments.** `.filter(Boolean)` and `.filter(p => p !== "")` after `split` on tags, queries, paths, and argv. Examples: `shared/fts.ts:10`, `shared/paths.ts:40`, `shared/cli-args.ts:76-112`, `harness/workspace.ts:59`, `db-v2.ts:677`. An empty token was never a row.
- **Skill-index structure.** `skill-index.ts:65`, `:70`, `:74`. Header and separator rows. Data rows that fail go to `dropped` (SAFE).
- **Idempotent schema.** `db-v2.ts:314-315`. An existing column, or a missing table, is not a dropped data row.
- **Topic threshold.** `topics/index.ts:195`. A tag below `min` does not get a topic. The note still lands on its project or `unsorted`. The comment says a threshold that can strand a note is forbidden.
- **Non-subject files.** `topics/index.ts:99` (not `.md`). `checks.ts:168` (hook command is not node/`tsx`). `checks.ts:1271` (type-only import, documented as not a runtime edge).
- **Dedup that keeps the item.** `server.ts:831`, `shadow/evaluate.ts:152`, `checks.ts:954`. The second sight of an id or a name is skipped; the first is kept.
- **Relocate candidates.** `relocate.ts:80`. A note that is not in the old project folder is outside the rename. `knowledgeRows` and `noteMoves` are both returned.
- **No supplied judgment.** `index-v2.ts:126`. Recording a neutral for an id the caller did not judge would invent the rating R-010 removed. This is not a missing row. The missing row at `:110` is SILENT because it shares this gap and is not named.
- **Recall channel stays quiet under the floor.** The model is not told "nothing matched". That is the trigger ruling. The missing piece is the fire row's dropped count (SILENT 11), not the quiet channel.

## The four instances already on record

| Instance | On this base |
|---|---|
| `harmful` unrepresentable (v0.15.0) | Closed. The rating type can say `harmful`. |
| `skillRows` (v0.17.0) | Closed for a malformed data row. Residual: a missing `## Skills` heading is SILENT 8. |
| Prime's frontmatter-less `SKILL.md` | Not a filter in this tree. Prime's loader is outside `open-brain/src`. No `/sync` check walks `.agents/skills/*/SKILL.md` for frontmatter. The in-tree cousin is SILENT 21. |
| v0.15.1 resolver, unreachable and then uncountable | Closed on the hook, which prints `formatRecalledResolution`. Open on MCP `ob_end` (SILENT 9): the reason is computed and not printed. |

## Not done

The suite was not run. No symbol was edited. GitNexus `detect_changes` was not used: `/sync` reported the index 113 commits behind `7640b93`, and a stale index answers a blast radius for a commit that does not touch one.
