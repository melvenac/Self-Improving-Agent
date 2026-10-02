# T-048: every filter that drops rows must emit the dropped count

**By:** Forge (builder, sia-builder), 2026-10-02. **Branch:** `loop/t048-dropped-counts` from `origin/master` `00552846`. **Code SHA to freeze: `b47eb897d4719271459ecc031f123995ca2212ba`.**
Not merged. LIGHT job: touched tests and `tsc --noEmit`. **`sync/checks.ts` and `sync/index.ts` were not edited** (sia-forge: T-008b, T-051); findings in them are listed below.
GitNexus has no index in this tree, so `impact` could not run; callers were checked by grep.

## Step 1: the audit

**393 sites** (every `continue;` and `.filter(` in `open-brain/src`, 66 files, read in four slices by four read-only audit passes at `00552846`).
**116 of them drop input rows** (the rest select from data the code itself just built, or split and trim its own strings). Of the 116:
- **36** already report the count or the dropped items (`ok`).
- **80** do not, or only partly. Of those: **8 rows fixed here** (7 distinct fixes; `merge-markers` has three sites), **4 partly fixed** (the session-end invocation logger), **18 are in the two files this seat may not edit**, and the rest stay findings.
- Caveat: the passes read the code around each site and did not run anything; the classification of a few is a judgement (the table says why). Line numbers are at `00552846` and will drift.

The full table (DROPS-INPUT rows only; the sites that are not drops are in the audit passes and not repeated here):

| file:line (at 00552846) | kind | what it drops | count reported | seat-read path | status |
|---|---|---|---|---|---|
| harness/brief-plan-gate.ts:289 | continue | judge `answers` entries that are not objects are omitted from feedback | NO (missing ids are listed above, but a malformed entry is not) | harness | finding |
| harness/brief-plan-gate.ts:473 | continue | D_t/brief missing on disk | YES (reasons.push) | harness | ok: already reported, no change |
| harness/brief-plan-gate.ts:478 | continue | path absent on master | YES (reasons.push) | harness | ok: already reported, no change |
| harness/brief-plan-gate.ts:522 | filter | plan-gate records that are non-live or unparseable are excluded before picking the latest live | PARTLY (error only if zero live remain; count of excluded not reported) | harness (dispatch gate) | finding |
| harness/closeout-tables.ts:83 `if (pr === null) continue;` | continue | Terms-table rows whose 2nd cell is not `#<n>` (header, separator, but also any malformed row) vanish; only `size===0` -> null is flagged | NO | harness | finding |
| harness/closeout-tables.ts:138 `.filter((x)... x.v !== null)` | filter | records whose spec value is null (e.g. no fail severity) are excluded from the row's per-diff values | PARTLY (row N = values.length, so N differs from table N, but excluded PRs are not named) | harness | finding |
| harness/closeout-tables.ts:162 `if (!/\.G_(done\|qa)\./...) continue;` | continue | every file in recordsDir that is not a G_done/G_qa record | NO | harness | finding |
| harness/closeout-tables.ts:168 | continue | unparseable JSON record | YES (`refused.push`, printed cli.ts:545, exit 1) | harness | ok: already reported, no change |
| harness/closeout-tables.ts:173 | continue | record failing validateGateRecord | YES (refused, cli.ts:545) | harness | ok: already reported, no change |
| harness/closeout-tables.ts:175 `v.kind === "runtime-done"` | continue | runtime-done records | NO | harness | finding |
| harness/closeout-tables.ts:177 `mode !== "live" \|\| outcome_class !== "answered" \|\| answer === null` | continue | dry-run, unanswered, incomplete records | PARTLY (only `Records read: N live answered` printed; no count of excluded ones) | harness | finding |
| harness/gate-records.ts:278 | filter | ledger rows of other subjects and `unavailable` attempts when numbering the next attempt | NO (intentional, documented) | harness | finding |
| harness/gate-records.ts:441 | continue | unparseable record JSON | YES (violations.push "not JSON") | harness | ok: already reported, no change |
| harness/gate-records.ts:443 `mode !== "live" \|\| attempted_at null` | continue | non-live / never-attempted records | PARTLY (files_scanned.records = all scanned, total = live; no explicit skipped count) | harness | finding |
| harness/gate-records.ts:461 | filter | non-live and `unavailable` attempts excluded from `live` / total | PARTLY (files_scanned shows rows scanned, no excluded count) | harness | finding |
| harness/gate-records.ts:466 | continue | attempts with no subject | YES (violations.push) | harness | ok: already reported, no change |
| harness/git.ts:182 `REDIRECTING_GIT_VARS.test(K)) continue` | continue | GIT_* env vars that redirect repo/config stripped from the child env | NO (by design, sanitization) | harness | finding |
| harness/shadow-merge.ts:121 | filter | acceptance rows whose id is in declared unrunnable/outOfScope, removed from the verdict | YES (declared lists returned in the result `declared`, ids not a count) | other (shadow-merge decide) | ok: already reported, no change |
| harness/shadow-merge.ts:228 | filter | `evidence.acceptance.filter(isRecord)`: non-object entries in the evidence array vanish from the written verdict artifact | NO | other (shadow-merge write) | finding |
| harness/shadow-merge.ts:438 | continue | a `<loop>/<sha>/` directory with no `shadow_merge.json` is skipped silently and absent from `artifacts.length`, so "N walked" cannot show it | NO | sync check (shadow-merge-ledger) | finding |
| harness/workspace.ts:168 | continue | git paths that fail normalisation | YES (`unsafe` list, counted in `examined`) | harness | ok: already reported, no change |
| pipelines/bootstrap/index.ts:87 | filter | git porcelain lines for untracked `.agents/archive/` files hidden from `dirty` | NO (deliberate and commented, :80-83) | other (bootstrap) | finding |
| pipelines/bootstrap/index.ts:130 | filter | `.agents/archive` dir excluded from residue listing | NO (deliberate, commented :127-129) | other (bootstrap) | finding |
| pipelines/bootstrap/index.ts:335 | continue | scaffold file already exists, not overwritten | YES (`skipped.push`, :335) | other (bootstrap) | ok: already reported, no change |
| pipelines/bootstrap/index.ts:356 | filter | template lines that are blank, comments, or already present are not merged | PARTLY (comment lines and already-present are only implied by "skipped: already carries every rule" at :357 when ALL are present; no count when some are) | other (bootstrap) | finding |
| pipelines/session-end/index-v2.ts:130 | continue | recalled ids with no knowledge_index row | YES (`vanished`, printed :250) | session-end | ok: already reported, no change |
| pipelines/session-end/index-v2.ts:149 | continue | recalled entries with no explicit rating | YES (`omitted`, printed :255) | session-end | ok: already reported, no change |
| pipelines/session-end/index-v2.ts:176 | continue | ratings whose feedback event write threw | YES (`notWritten` with reason, printed :258) | session-end | ok: already reported, no change |
| pipelines/session-end/invocation-logger.ts:78 | continue | invocation-log line with no `ts` | NO (result is only newest ts; "corrupt" only if ALL lines unusable) | sync score, server.ts | finding |
| pipelines/session-end/invocation-logger.ts:80 | continue | line whose `ts` is not a date | NO (same) | sync score, server.ts | finding |
| pipelines/session-end/invocation-logger.ts:131 | continue | whole session DB with no `session_events` table; closes and skips | NO | session-end (index-v2.ts:191) | PARTLY FIXED (DC-1/2): unreadable db, append failure and already-logged are now counted; no-events, no-meta and empty-data skips still are not |
| pipelines/session-end/invocation-logger.ts:140 | continue | session DB with no `session_meta` row (skipped, never counted) OR session already logged | PARTLY (already-logged is counted in `skippedSessions`, :138; the no-meta case is not; and index-v2.ts:265 prints only `logged`, never `skippedSessions`) | session-end | PARTLY FIXED (DC-1/2): unreadable db, append failure and already-logged are now counted; no-events, no-meta and empty-data skips still are not |
| pipelines/session-end/invocation-logger.ts:155 | continue | invocation events with empty `data` | NO | session-end | PARTLY FIXED (DC-1/2): unreadable db, append failure and already-logged are now counted; no-events, no-meta and empty-data skips still are not |
| pipelines/session-end/invocation-logger.ts:169 | continue | `user_prompt` starting `/` that fails the command regex | NO | session-end | PARTLY FIXED (DC-1/2): unreadable db, append failure and already-logged are now counted; no-events, no-meta and empty-data skips still are not |
| pipelines/session-end/recalled-ids.ts:110 | filter | recalled-file entries whose `id` is not a number are dropped before the ids reach rating | NO | session-end | FIXED (DC-3) |
| pipelines/session-start/agent-identity.ts:49 | continue | frontmatter lines in AGENT.local.md/AGENT.md that match no `key: value` shape | NO | ob_start (seat identity) | finding |
| pipelines/session-start/agent-identity.ts:51 | continue | empty or `<placeholder>` values for any key | PARTLY (a missing name/role makes identity unresolved; other dropped keys silent) | ob_start | finding |
| pipelines/session-start/agent-identity.ts:123 | continue | non-status frontmatter lines in standing-cron read | NO (irrelevant lines, by design) | ob_start (Standing cron) | finding |
| pipelines/session-start/agent-identity.ts:128 | continue | empty/`<placeholder>` status_* value | PARTLY (a missing key becomes "Standing cron: INVALID ... key is missing", dropped value not shown) | ob_start | finding |
| pipelines/session-start/agent-identity.ts:141 | continue | AGENT.local.md with no status keys, falls through to AGENT.md | PARTLY (final line "none in seat data" cannot say which file lacked keys, or that one was absent vs empty) | ob_start | finding |
| pipelines/session-start/derived-artifacts.ts:45 | continue | every check result of severity pass or skip is dropped; also a thrown check is swallowed (:33-35) | NO (by documented design, but "skip/not checked/threw" prints identically to "pass") | ob_start (cli-bootstrap.ts:267) | finding |
| pipelines/session-start/health-checks.ts:69 | continue | project directory under ~/.claude/projects that cannot be listed (inside `catch`) | NO | ob_start | FIXED (DC-5) |
| pipelines/session-start/session-discovery.ts:40 | filter | `.jsonl` files whose stem is not a UUID; also the blanket catch returns null | NO | ob_start (session uuid) | finding |
| pipelines/session-start/session-log.ts:31 | filter | files in `.agents/SESSIONS` not matching SESSION_FILE are ignored when numbering the next session | NO | ob_start | finding |
| pipelines/session-start/session-log.ts:56 | continue | same non-matching files ignored in the existing-log search | NO | ob_start | finding |
| pipelines/session-start/session-log.ts:59 | continue | `catch { continue; }` a Session_N.md that cannot be read is skipped, so the "one log per session" lookup can miss it and mint a duplicate | NO | ob_start | FIXED (DC-4) |
| pipelines/session-start/state-render.ts:56 | filter | older verified claims | YES (`omitted`, :62-63 "N older verified claim(s) not shown") | ob_start | ok: already reported, no change |
| pipelines/session-start/state-render.ts:67 | filter | closed gaps not rendered | PARTLY (header `Gaps (N)` shows open count only; no closed count, unlike tasks which print `done: N`) | ob_start | finding |
| pipelines/state-import/index.ts:254 | continue | `# ` title lines and blank lines of INBOX.md skipped, uncounted | NO (blank/title carry no content) | other (import) | finding |
| pipelines/state-import/index.ts:259 | continue | item under a section with no priority: `unparsed.push({... "no priority section"})` | YES (unparsed list, :257) | other (import) | ok: already reported, no change |
| pipelines/state-import/index.ts:407 | continue | `###` heading not matching ADR_RE. Reported to `report.skipped` only if ADR_UNNUMBERED_RE matches | PARTLY (other non-ADR `###` headings vanish uncounted; :406) | other (import) | finding |
| pipelines/state-import/index.ts:410 | continue | duplicate ADR id: `report.skipped.push(... "duplicate id")` | YES (:410) | other | ok: already reported, no change |
| pipelines/state-import/index.ts:488 | filter | non-bullet lines in "Watch out"/"Open questions" sections of next-session.md `bullets()` | NO (only kept count `report.watch_out` is printed, not dropped lines) | other (import) | finding |
| pipelines/state-import/index.ts:675 | continue | absent input file: `not_judged.push({reason:"absent..."})` | YES (:675) | other (import staleness) | ok: already reported, no change |
| pipelines/state-import/index.ts:679 | continue | un-judged input: `not_judged.push(...)` | YES (:677) | other | ok: already reported, no change |
| pipelines/state-import/index.ts:845 | filter | lines of the draft removed (title, blockquote, Current State) | YES (`total_lines_removed: remove.size`, `blockquote_lines`, `current_state_lines`, :849) | other (import draft) | ok: already reported, no change |
| pipelines/state-import/index.ts:964 | filter | directory names not matching snapshot incomplete-marker pattern | NO (selection by name, nothing lost) | other | finding |
| pipelines/sync/checks-state.ts:226 | continue | tracked file deleted in working tree, not scanned | PARTLY (`scanned` count printed, tracked-file total and skipped count are not; the message says "N tracked text files" without saying how many tracked files were not scanned) | sync check (merge-markers) | FIXED (DC-8) |
| pipelines/sync/checks-state.ts:228 | continue | `catch { continue; }` unreadable tracked file silently not scanned (an unreadable file could hold a marker) | NO (not counted, not named; the pass message says 0 markers in N files) | sync check (merge-markers) | FIXED (DC-8) |
| pipelines/sync/checks-state.ts:229 | continue | binary file (NUL in first 8 KB) not scanned | PARTLY (as :226: scanned count only) | sync check (merge-markers) | FIXED (DC-8) |
| pipelines/sync/checks.ts:166 | continue | non-object entries in settings.json hooks (`!hook \|\| typeof hook !== "object"`) | NO (pass msg "All hook command files exist", no checked count) | sync hook-configs | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:169 | continue | hook commands lacking `node ` / `npx tsx ` are never checked | NO | sync hook-configs | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:172 | continue | node/tsx command whose path regex fails to match | NO | sync hook-configs | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:297 | continue | non-.md files and CHANGELOG.md; also skipDirs (node_modules, build, .git, tests, superpowers) at :294 | NO (pass msg "No v1-vault references..." has no scanned/excluded count) | sync vault-path-refs | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:405 | continue | unreadable file | YES unreadable[] at :404, in message | sync template-personal-names | ok: already reported, no change |
| pipelines/sync/checks.ts:499 | continue | hook entry with no `command` (hook-registration duplicate scan) | NO | sync hook-registration | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:503 | continue | command with no recognisable script filename | NO | sync hook-registration | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:552 | filter | non-.md files in template .cursor/commands, invisible to the expected-set comparison | NO | sync mirror-parity | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:570 | continue | non-required mirror pair with a missing dir is skipped (required one is a problem at :569) | PARTLY (pass msg gives `compared` count, never names the skipped pair) | sync mirror-parity | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:573 | filter | non-.md files in mirror dirs not compared | NO | sync mirror-parity | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:579 | continue | MIRROR_EXCEPTIONS files not compared | NO (not counted in `compared` note) | sync mirror-parity | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:743 | filter | non-.md in command dir (listCommands); also catch returns [] on unreadable dir, swallowing it | NO | sync command-parity, command-tool-names, command-names | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:765 | continue | template-only commands in TEMPLATE_ONLY_ALLOWED not compared | NO (pass msg counts `shared` only) | sync command-parity | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:793 | continue | user-scope commands not in repo are ignored ("their own business") | NO | sync command-parity | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:863 | filter | command dirs that do not exist (`.filter(existsSync)`) drop silently; skip only if all absent | NO (which dirs were scanned is not named) | sync command-tool-names | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:951 | filter | same, command-names check | PARTLY (pass msg counts surface files and names, not absent dirs) | sync command-names | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:1086 | filter | files under `historical` prefixes removed from the retirements scan | YES pass msg "historical: N (by rule)" | sync retirements | ok: already reported, no change |
| pipelines/sync/checks.ts:1087 | filter | non-SCANNED_EXT files | YES counted per extension (:1088-1093, excludedNote) | sync retirements | ok: already reported, no change |
| pipelines/sync/checks.ts:1137 | continue | files that are allowed referrers skipped from the unexpected-name scan | PARTLY (`verified` count of allowed referrers reported; scan-skipped files not stated) | sync retirements | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:1268 | continue | SKIP dirs in fallback walk | YES `skipped.push` (:1268) | sync retirements / listing label | ok: already reported, no change |
| pipelines/sync/checks.ts:1273 | continue | unreadable path in fallback walk | YES `unreadable.push` | sync retirements | ok: already reported, no change |
| pipelines/sync/checks.ts:1397 | continue | file whose source could not be read | YES unreadable pushed at ~:1378 and named in message | sync core-memory boundary | ok: already reported, no change |
| pipelines/sync/checks.ts:1402 | continue | type-only imports (erased, not edges) | NO (by design, not counted in scale string) | sync core-memory boundary | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:1406 | continue | non-relative (package) imports, not graph edges | NO | sync core-memory boundary | finding (file owned by sia-forge: T-008b, T-051; not edited) |
| pipelines/sync/checks.ts:1450 | continue | memory-side files not examined as sources | YES scale string "N file(s), M core" (:1459) | sync core-memory boundary | ok: already reported, no change |
| pipelines/sync/cursor-hook-compat.ts:93 | continue | non-record plugin install entries | NO | sync cursor-hook-compat | finding |
| pipelines/sync/cursor-hook-compat.ts:112 | continue | plugin install with no hooks/hooks.json | NO | sync cursor-hook-compat | finding |
| pipelines/sync/hub-seats.ts:49 | filter | non-string entries of `seats` in worktree-seats.json | NO (they then surface only indirectly as "X is not a seat") | sync check (hub-seats) | FIXED (DC-6) |
| pipelines/sync/hub-seats.ts:67 | continue | reader with no partners list | YES (`problems.push`, :66) | sync | ok: already reported, no change |
| pipelines/sync/hub-seats.ts:82 | continue | hub seat not in worktree-seats.json | YES (`problems.push`, :81) | sync | ok: already reported, no change |
| pipelines/sync/probe-markers.ts:43 | continue | symlinks under the tests dir are neither followed nor scanned; a marker behind a link is invisible | NO | sync check (probe-markers) | finding |
| pipelines/sync/record-erasure.ts:164 `presentIn(a, r) \|\| explainedByRetention(r, after)) continue` | continue | records removed between states but "explained by retention" are not counted or listed (present-in-after is correctly not an erasure) | NO (retention drops are reported by the writer, not here) | sync check | finding |
| pipelines/sync/record-erasure.ts:179 `seen.has(r.key) \|\| presentIn \|\| explainedByRetention ... continue` | continue | same retention-explained removals in merge path (seen = dedupe) | NO | sync check | finding |
| pipelines/sync/record-erasure.ts:243 `bc === null` | continue | commits with no state.json blob | YES (message line "walked N commits" counts all commits) | sync check | ok: already reported, no change |
| pipelines/sync/record-erasure.ts:246 | continue | commits where state.json is unchanged vs parents | YES ("N state.json changes" vs "N commits", walked line) | sync check | ok: already reported, no change |
| pipelines/sync/scorer.ts:44 | filter | skipped checks removed from the score denominator | PARTLY (details = passed/warned/failed only, no skipped count; each skip prints its own line elsewhere) | sync score | finding |
| pipelines/sync/start-parity.ts:14 | filter | non-string or empty entries in cursor-start-differences.json waiver arrays | NO (malformed waiver silently ignored) | sync cursor-start-parity | finding |
| pipelines/sync/start-parity.ts:19 | filter | blank-after-trim waiver entries | NO | sync cursor-start-parity | finding |
| pipelines/topics/index.ts:99 `!file.toLowerCase().endsWith('.md')` | continue | non-markdown files in Summaries/ | NO (legit, but uncounted) | session-end | finding |
| pipelines/topics/index.ts:105 `catch { continue; }` | continue | a Summaries/*.md that cannot be read vanishes from the linkable set, so orphan/topic counts silently exclude it | NO | session-end | finding |
| pipelines/topics/index.ts:285 | continue | unreadable Topics file | YES (pushed to skippedForeign, returned) | session-end | ok: already reported, no change |
| pipelines/topics/index.ts:292 | continue | generated topic not written because a hand-written note holds the name | YES (skippedForeign) | session-end | ok: already reported, no change |
| relocate.ts:80 | continue | knowledge_index rows whose note is not directly in old folder (not moved) | NO (plan has moves and collisions, not the unmoved count) | other (relocate CLI) | finding |
| shared/active-session.ts:154 `if (!found) continue;` | continue | workspace_roots entries with no usable string/path | PARTLY (`root_count` = usable only; total candidates not reported, so a payload with 3 roots, 2 unusable, equals one with 1 root) | ob_start / session-end (cli-bootstrap.ts:230 writes workspace_root_count) | FIXED (DC-7) |
| shared/content-guard.ts:86 | filter | non-string and blank tags in a swallowed `tags` array when recovering | NO | other (repair; no src caller) | finding |
| shared/skill-index.ts:80 | continue | malformed data row (no domain) | YES `dropped[]`, surfaced by checkSkillIndex (checks.ts ~:330) | sync skill-index, health score | ok: already reported, no change |
| shared/state-schema.ts:387 | filter | superseded handoffs (older per seat+checkout) | YES (`hidden` count, state-render.ts:167,192) | ob_start | ok: already reported, no change |
| shared/state-writer.ts:730 | filter | superseded handoff records removed from state | YES (label per drop pushed to `out`, returned; writer.ts:347 prints) | ob_state | ok: already reported, no change |
| shared/state-writer.ts:737 | filter | superseded session records removed | YES (labels, as above) | ob_state | ok: already reported, no change |
| shared/state-writer.ts:808 | filter | done tasks past retention | YES (`dropped` ids + `kept` cited ids returned) | ob_state | ok: already reported, no change |
| shared/state-writer.ts:920 `if (cut <= 0) continue;` | continue | `git grep` output lines with no colon (parseCitedLines) | NO | ob_state (cited-id eviction guard) | finding |
| shared/state-writer.ts:923 `if (!file \|\| !id) continue;` | continue | git grep lines with empty file or id; an id lost here is not protected from retention eviction | NO | ob_state | finding |
| state-views/index.ts:108 | filter | done tasks aged out by `isDroppedByRetention` vanish from the INBOX Done section | NO (heading says "last N sessions", no count of aged-out tasks) | INBOX.md view, ob_start greeting renderState | finding |
| trigger/query.ts:168 `.filter((h) => h.relevance >= input.floor)` | filter | FTS rows below the relevance floor | NO (deliberate: "silent means silent", ruling 3) | trigger (PreToolUse hook), other | finding |
| vault-writer.ts:57 | continue | frontmatter line with no `:` (e.g. a YAML `- item` continuation of a multi-line list) | NO | other (exported; no src caller found, only tests) | finding |
| vault-writer.ts:62 | continue | frontmatter line with empty key | NO | other (same) | finding |

## Step 2: what is fixed (7 sites), each red on the base and green after

New file `open-brain/tests/t048-dropped-counts.test.ts`, 9 rows. **Red before:** 9 failed (9) on `00552846`. **Green after:** 9 passed (9).

| row | site | what a reader now sees |
|---|---|---|
| DC-1, DC-2 | `session-end/invocation-logger.ts` `logInvocations`, `index-v2.ts`, `ob_end` | `Invocations: N logged (A already logged, U unreadable, F append failed)`, zeros included. Before, `skippedSessions` was computed and never printed, and an unreadable session db or a failed append vanished into a bare `catch`. `logInvocations` now takes the directory and log path as optional arguments (defaults unchanged) so it can be tested. **Also fixed in passing:** a session db that opened but could not be read was never closed, which locks the file on Windows (the red run of this test hit `EBUSY` on cleanup). |
| DC-3, DC-3b | `session-end/recalled-ids.ts` | entries in a trusted `.recalled-entries.json` with no numeric id are counted: `Dropped D of N entries in the file: no numeric id, so they were not rated`. Only for origin `file`. |
| DC-4 | `session-start/session-log.ts`, `session-start/index.ts` | an unreadable `Session_N.md` is reported to a callback and becomes an `ob_start` warning naming it, so a duplicate log is not minted in silence. |
| DC-5 | `session-start/health-checks.ts` | `N transcript directories under ~/.claude/projects could not be read; the newest-transcript check covers only the rest.` |
| DC-6 | `sync/hub-seats.ts` | `worktree-seats.json has N seat name(s) that are not strings and were ignored`, instead of the seat looking unknown. |
| DC-7 | `shared/active-session.ts` `describeWorkspaceDir` | a new `unusable_roots` field beside `root_count` (0 when the key is absent or empty). |
| DC-8 | `sync/checks-state.ts` `merge-markers` | `... ; N tracked files not scanned (D deleted, U unreadable, B binary)`, at zero as well. **Two existing rows that pinned the old message were changed on purpose** (`checks-state.test.ts`). |

**Mutants** (each reverted; the suite is back to 9 passed): (M1) unreadable sessions not counted: `DC-1` red. (M2) binary files not counted: `DC-8` red. (M3) dropped entries reported as 0: `DC-3` red. (M4) the unreadable-log callback removed: `DC-4` red.
**Adjacent suites, all passed:** `pipelines/session-start` (14 files, 166 tests), `server.test.ts` 30, `checks-state` 22, `hub-seats` 5, `active-session` 43, `session-log` 9, `recalled-ids` 17, `session-end/index-v2` 9, `t048-r2` 5, `t048-r2b` 7, `t048-r3` 5, `pipeline-health` 12, `t003-r2` 9. `tsc --noEmit` exit 0.

## Findings (not fixed), seat-read paths first

Not fixed because they are harness-only, rest on a return-type change, sit in the conflict zone of an open PR, or belong to the forge seat. Each is a row in the table above.

**On a path a seat reads:**
1. `session-end/invocation-logger.ts:78/80` (`readLastInvocationTs`): malformed or timestamp-less log lines are dropped uncounted, so the sync score shows the newest `ts` as if the log were whole. It returns a bare string consumed in several places; a fix changes that type.
2. `session-start/state-render.ts:67`: closed gaps are not counted, unlike tasks (`done: N`), so "Gaps (0)" cannot be told from "all closed". It is in the same lines as PR #291 (T-183), so a fix waits for that to merge.
3. `session-start/derived-artifacts.ts:33/45`: a skipped or thrown `gitnexus-index` / `build-freshness` check prints nothing at `ob_start`, the same as a pass.
4. `session-start/agent-identity.ts:51/128/141`: empty or placeholder identity values are dropped without naming the file or key (T-224 fixed the status-cron instance only).
5. `shared/state-writer.ts:920/923` (`ob_state`): malformed `git grep` lines are skipped silently, so a cited task id lost there is not protected from retention eviction and the output looks clean.
6. `pipelines/topics/index.ts:105` (session-end): an unreadable Summaries note vanishes from the linkable set, so the orphan and topic counts look complete.
7. `pipelines/sync/record-erasure.ts:164/179`: removals explained by retention are not counted, so "0 erasures" does not say how many records retention removed.
8. Smaller: `pipelines/sync/probe-markers.ts:43` (symlinks under `tests/` never scanned, message silent); `harness/shadow-merge.ts:438` (a `<loop>/<sha>/` directory with no `shadow_merge.json` is absent from "N verdict artifact(s) walked"); `pipelines/sync/start-parity.ts:14/19` (a malformed waiver entry is dropped, so a typo'd waiver looks like no waiver); `pipelines/sync/scorer.ts:44` (skipped checks leave the score denominator with no skipped count); `pipelines/sync/cursor-hook-compat.ts:93/112`; `pipelines/shadow/index.ts:61` (torn ledger lines return `[]`).

**In the two files this seat may not edit (`pipelines/sync/checks.ts`, `pipelines/sync/index.ts`): 18 rows, report to sia-forge.** The ones that matter: `checks.ts:166/169/172` and `:499/:503` (`hook-configs`, `hook-registration`: skipped entries and no checked count, so zero checked reads as all checked); `:297` (`vault-path-refs` states no scanned or excluded count); `:570/:579/:765/:793` (mirror and command parity skip exception lists and optional pairs uncounted); `:863/:951` (absent command directories are filtered out unnamed, so the scan scope in a pass is unstated); `:1402/:1406` (type-only and package imports dropped from the boundary graph, uncounted).

**Harness and import paths (not read by a seat at `/start`, `/end` or `/sync`):** `harness/closeout-tables.ts:83/138/162/175/177` (rows excluded from a table's N without a count), `harness/gate-records.ts:443/461`, `harness/brief-plan-gate.ts:289/522`, `harness/shadow-merge.ts:228`, `pipelines/state-import/index.ts:407/488` (non-ADR headings and non-bullet lines under Watch out and Open questions dropped), `pipelines/bootstrap/index.ts:356`, `vault-writer.ts:57/62`, `shared/content-guard.ts:86` (no src caller found). `trigger/query.ts:168` is the relevance floor, silent on purpose (ruling 3), listed for completeness with no fix recommended.
