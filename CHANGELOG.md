# Changelog

## [v0.14.1] - 2026-08-08

### Fixed
- **`ob_stats` reported the apoptosis review queue only when it was non-empty**, so an empty queue and a server running pre-v0.14.0 code printed byte-identical output. That is the exact shape v0.14.0 was written to fix — *"flagged for review" named a queue that could not be listed* — reintroduced by the fix itself, one release later. The count line is now unconditional; only the per-entry detail and the removal hint stay gated, since those genuinely have nothing to say at zero. Found while verifying that `/mcp reconnect` had picked up a rebuild: a missing section could not distinguish "none flagged" from "stale server", so the check that was supposed to confirm the reconnect could not confirm anything.
- Formatting extracted to **`formatApoptosisQueue`** in `lifecycle.ts` and covered directly — the block previously lived inline in the `ob_stats` handler, which is registered via `server.tool()` and therefore reachable only through the MCP transport. `apoptosisFlaggedExpr` gained its first tests at the same time, including one asserting every column is alias-qualified.

## [v0.14.0] - 2026-08-08

Closes the last three findings from the MCP tool audit. All 13 tools now match their documented behaviour.

### Added
- **`apoptosisFlaggedExpr`**, and `ob_stats` now lists **apoptosis candidates awaiting review**. `evaluateLifecycle` reported *"flagged for review"* in the single `ob_feedback` response that crossed the threshold and recorded nothing — no column changed — so "flagged for approval" named a review step whose queue could not be listed. It is now derived from the columns rather than stored: a stored flag would be a second source of truth able to fall out of step with the counts that define it. Built from `LIFECYCLE_CONFIG` so it cannot drift from `evaluateLifecycle`, and it counts `helpful + harmful` excluding neutral, matching `nonNeutral` there. Only `source = 'manual'` can appear — everything else is auto-pruned on the rating that crosses the line, so a survivor is manual by construction. The live DB currently has **0**, making this preventive rather than remedial.

### Fixed
- **`ob_recall`'s description contradicted its behaviour.** It claimed "by default, results are scoped to the project you specify"; with no `project` argument there is nothing to scope to and the search covers every project. The description now says so.
  - **The description was corrected rather than the behaviour, deliberately.** Making the default scope to the active session's project would silently *narrow* recall for every existing caller that omits `project` — and this system's documented failure mode is retrieval returning too little, not too much (see the Session 46 finding that multi-word recall returned zero for most of this corpus's life). Widening is recoverable; silent narrowing is the failure that hid for months. The behaviour was never wrong, only undocumented.
- **`CLAUDE.md` claimed 9 MCP tools.** There are 13, now listed by name rather than counted.

## [v0.13.0] - 2026-08-08

The index is now a projection of the vault rather than a parallel store that happens to agree. v0.12.0 detected the divergence; this closes the two seams that produced it — a way out and a way in.

### Added
- **`archiveVaultNote`** — moves a note into `Archive/`, preserving its relative path, and returns the new location. Wired into both deletion paths, `ob_forget` and apoptosis auto-prune, which previously dropped the row and left the markdown in `Experiences/` where `skill-scan` kept counting it.
  - **Moves rather than unlinks, deliberately.** Apoptosis fires automatically with no human in the loop, and irreversibly destroying a readable note under those conditions is the wrong default. `Archive/` also sits outside the scanned directories, so nothing downstream has to remember to skip it — the file simply stops being in the corpus.
  - Collision-safe: two notes of the same basename archived from different folders do not overwrite each other.
  - Refuses to relocate a path outside the vault. A row pointing elsewhere is not this function's to move.
- **`experiencePath`** — exported so a caller that gets `null` from `writeExperience` can tell *which* file blocked it.

### Changed
- **`ob_store` adopts an unindexed note instead of refusing it.** An existing file is a real conflict only when the index already knows about it; otherwise the right move is to index it in place. Previously there was no tool path at all from a vault note to an index row — the 10 notes indexed in v0.12.0 had to go in by hand-written SQL, which is not a workflow.
  - **The file's content is indexed, not the caller's**, and the response says so plainly. Vault-first means the markdown wins; silently indexing different text than the note holds would recreate the divergence in a subtler form.
  - A genuine duplicate — file present *and* indexed — is still refused exactly as before.

### Notes
- **`archived_into` was not used, and should not be.** It looked like the natural home for this (always NULL, obviously designed for something) but it is an INTEGER referencing another entry's id, and `WHERE archived_into IS NULL` already filters archived entries out of stats, listing and recall. Repurposing it to mean "file moved to Archive/" would have corrupted those filters. Deletion removes the row anyway, so nothing needs marking — only the file needs to move.
- **The unit tests passed while the wiring was broken.** `archiveVaultNote` was correct and covered, but the apoptosis branch read `vault_path` from a row that never selected it, so it archived nothing. Only the end-to-end pass over the real MCP server caught it. The column is now selected explicitly, with a comment saying why: after the `DELETE` there is nothing left to look the path up from.

## [v0.12.0] - 2026-08-08

An audit of all 13 MCP tools found every core contract holding. It also found that the vault and its index had silently diverged, and that the divergence is inflating skill proposals.

`checkVaultIndexParity` reports the divergence. It was built before fixing any instance, deliberately: the drift had **three unrelated producers**, and a detector catches all three plus whatever comes next. It paid for itself on the first run — reading the vault by hand had missed the main problem twice.

### Added
- **`checkVaultIndexParity`** — compares notes under `Experiences/` and `Checkpoints/` against `knowledge_index.vault_path`, classifying the result into **duplicates** (same note under two folders), **unindexed** (file with no row), and **dangling** (row with no file). `Summaries/` is excluded: session-end writes it and never indexes it, so scanning it is all noise.
  - Reported as a **warning**, not an issue. This is data state needing per-note triage, it cannot be auto-fixed, and an unrelated commit should not be blocked by it.
  - The classification is the point. An earlier version reported one undifferentiated count, which hid the duplicates entirely — the only class with active damage.

### Found
- **60 duplicate notes**, each filed under both `Experiences/General/` and `Experiences/<Project>/`, one copy indexed and one not. `skill-scan` reads the directory recursively and counts **both**, inflating the cluster sizes that gate skill proposals. Three of the five pending proposals are affected: `template` 7→4 unique, `esm` 5→4, `revenue` 5→3. `revenue` lands exactly on the 3-file threshold that decides whether a cluster is proposed at all.
- **10 unindexed notes** — in the vault, absent from the index, so invisible to `ob_recall` while still feeding `skill-scan`. Sources: 5 `migration-v1`, 2 `agent`, 1 `e2e-test` (a test suite that wrote into the real vault), 1 with no frontmatter.
- **Deletion orphans a note.** `ob_forget` and apoptosis auto-prune remove the row and leave the markdown. Reproduced in a sandbox; zero live instances. Real, but not the cause of the above.

### Audit result
All 13 tools do what they were designed to do, verified against DB rows and vault files rather than their own success messages, with the server pointed at a temp DB and vault so destructive tools could not reach real knowledge. Isolation was proven before testing rather than assumed.

Three behaviours diverge from documented design, none of them a broken contract:
- `ob_recall` with neither `project` nor `global` returns other projects' scoped entries, though the description says the default is scoped. Passing `project` filters correctly — it is the default that is permissive.
- An apoptosis flag on a manual entry leaves no durable trace: no column is set and no tool surfaces it, so "flagged for approval" cannot be enumerated. Derivable in SQL only.
- `CLAUDE.md` documents 9 tools; 13 are registered.

Full report: `.agents/SYSTEM/mcp-tool-audit-2026-08-08.md`.

### Notes
- Two findings in the first pass were wrong and were corrected by checking rather than reasoning. `ob_store` refusing a duplicate key was read as a silent discard — it returns an explicit refusal naming `ob_forget`. Apoptosis auto-prune was read as silent — it reports *"Entry N has been removed."* Both were regexes matching the wrong text, not tool defects.
- The orphan count itself was wrong twice: matching by basename gave 9, by full path 70. The gap was the 60 duplicates, which basename matching cannot see by construction.

## [v0.11.1] - 2026-08-07

The v0.11.0 check scanned command and doc trees but not `CLAUDE.md` — the file loaded into every session, and so the highest-leverage place for a stale path to sit. A stale reference in a doc is followed when someone reads that doc; a stale reference in `CLAUDE.md` is standing instruction in every session from then on.

### Changed
- **`checkVaultPathRefs` now scans `~/.claude/CLAUDE.md` and the project `CLAUDE.md`.** Named explicitly rather than walked, since neither sits in a directory worth traversing whole. On its first run it caught a v1 reference that manual review had already missed twice.

### Fixed
- **Global `CLAUDE.md` described accumulation as `session-end.mjs` → `skill-scan.mjs`.** Neither file exists; it is one registered hook, `open-brain/build/cli-session-end.js`, which captures the session, runs auto-feedback, and runs the skill scan.
- **The Guardrails section pointed at `~/Obsidian Vault/.vault-writer.log`** — a v1 path, for a log written by a hook that no longer exists. Replaced with the vault location and the reason the two names are dangerous to confuse.
- **`/start`'s monthly maintenance ran `node scripts/sync.mjs --score`** in three copies. That script was retired in Session 33; it is `node open-brain/build/cli.js sync --score`. (`/end` already documented the retirement correctly and was left alone.)

### Notes
- `CLAUDE.md` also pointed at `~/Obsidian Vault/Research/karpathy-skills-claude-md-repo.md` — a live reference note that existed only in the retired vault, and v2 has no `Research/`. The pointer could not simply be rewritten, so the note was **copied** (not moved) into `~/Obsidian Vault v2/Research/`. Copied because v1 is frozen: leaving the original in place keeps the change reversible and costs nothing.
- This is the third consecutive release to find v1 references after the previous one claimed to have cleared them — manual review found instances, the check found the class. Every instance since v0.11.0 has been found by the check rather than by reading.

## [v0.11.0] - 2026-08-07

`sync` now fails on references to the retired v1 vault, and the documentation layer that had been quietly describing v1 for months was rewritten against the running system.

v0.10.1 fixed the v1-vault references in the slash commands. That was treating instances of a class. The class itself had already recurred in `setup.mjs`, four command mirrors, the guide skill, and the canonical reference doc — because `obsidianVaultDir()` contains the path for *code*, and prose has no equivalent chokepoint. A stale path in a command file is read by an agent and acted on exactly as if it were current, and nothing fails. A grep nobody remembers to run is not a guard.

### Added
- **`checkVaultPathRefs`** — a sync check scanning markdown under `.claude/commands/`, `.agents/skills/`, `project-template/`, `scripts/`, and the live `~/.claude`, `~/.cursor`, `~/docs` trees for `Obsidian Vault` followed by a path separator and not ` v2`. Fails as an issue. Live directories are tolerated when absent, matching `checkMirrorParity`.
  - Exempt, all for one reason — *a record of what was true then is not a stale instruction*: `CHANGELOG.md` should say `Obsidian Vault/` when describing what v1 did, the dream tests use v1 paths as fixtures for the rule that detects them, and `docs/superpowers/plans/` holds dated plans belonging to another plugin. Rewriting any of those would falsify the record.
  - It immediately found three files beyond the known list, including plan documents nobody had connected to the v2 rebuild.

### Changed
- **`self-improving-agent-guide/SKILL.md` rewritten.** It was a v1 document end to end, not merely one with stale paths: it described `vault-writer.mjs` in `~/.claude/knowledge-mcp/scripts/` (a directory that does not exist), three chained SessionEnd hooks (there is one, `cli-session-end.js`), Smart Connections as the retrieval path (it is `ob_recall`), and `Sessions/`, `Topics/`, `Guidelines/` (none exist in v2). Now documents the three-store split, the maturity lifecycle, state-vs-event, the real hook wiring, and the actual v2 vault layout — every claim checked against disk or `settings.json` rather than carried forward.
- **`~/docs/self-improving-agent-reference.md` rewritten.** CLAUDE.md points at this as canonical, and it still described `kb_recall` and the three-hook chain. Now carries the current tool list, CLI surface, and key paths, plus the two findings most likely to be re-derived the hard way: `.recalled-entries.json` must be checked against the live session id, and disuse is not evidence of low value because multi-word recall was broken for most of this corpus's life.

### Fixed
- **`SKILL-INDEX.md` pointed at a `Templates/SKILL-TEMPLATE.md` that does not exist in v2** — introduced in v0.10.1 by carrying the v1 header forward unchecked. Replaced with where skills actually live, `~/.claude/skills/<name>/SKILL.md`.
- **`notebooklm.md`** archived to the v1 vault.

### Notes
- Writing the reference doc tripped the new check: describing the retired path required writing it. Reworded to name the directory without a separator rather than adding an exemption — the check is about paths that could be *acted on*, and an exemption would have blunted it for the one document most likely to be copied from.
- CLAUDE.md still describes accumulation as `session-end.mjs` → `skill-scan.mjs`. Neither file exists; it is one registered hook. Left unchanged — it is a user-level file outside this repo.

## [v0.10.1] - 2026-08-07

Skill graduation was dead in two independent ways, and the two hid each other.

`SKILL-INDEX.md` is the registry that tells `skill-scan` which experience clusters have already been distilled into a skill. Both of its readers matched `### tag (N experiences) … has skill` — the shape of `SKILL-CANDIDATES.md`, not the index, which is a markdown table. The pattern could never match, so **a fully populated index and a missing one produced byte-identical output**. That is what made it survive: there was no observable difference to notice.

Underneath that, the v2 vault had no index at all to read. `setup.mjs` still seeded `~/Obsidian Vault`, abandoned since the v2 rebuild — the same hardcoded-path class that `obsidianVaultDir()` exists to prevent, in the one file that never adopted it. So every distilled skill kept being re-proposed as an undistilled candidate, indefinitely.

### Fixed
- **`parseExistingSkills` never matched the file it read.** Now parses the `## Skills` table's **Domain** column, which is what the caller compares against `cluster.tag` — the human-facing Name was never the right field. A cell may list several tags (`docker, traefik`) and each graduates independently. `## Pending Proposals` has a Domain column too and is deliberately excluded: reading it would graduate candidates that were merely proposed.
- **The protocol health score counted `has skill` in the index**, a marker written only into `SKILL-CANDIDATES.md`. `skillsImplemented` was therefore always 0, silently understating the score. It now counts table rows.
- **`setup.mjs` seeded the v1 vault**, so no v2 install ever received a `SKILL-INDEX.md`. Now resolves `OPEN_BRAIN_VAULT_DIR` or `Obsidian Vault v2`, mirroring `obsidianVaultDir()`, and scaffolds the v2 directory set (`Archive`, `Checkpoints`, `Experiences`, `Skill-Candidates`, `Skills`, `Summaries`) instead of the v1 set. The seeded index now carries the real table header, so the format is self-documenting rather than a prose stub the parser reads as empty. The dead `Guidelines/ → Skill-Candidates/` migration is removed: it could only ever fire against a v1 vault this function no longer touches.
- **`/start` and `/skill-scan` read the abandoned v1 vault** — 29 references across three copies each (repo `.claude/commands/`, `project-template/.claude/commands/`, live `~/.claude/commands/`) plus `.cursor/`, and the stale `Guidelines/` path in `.agents/skills/INDEX.md`. `copySlashCommands` distributes from `project-template/`, so fixing only the live copy would have been undone by the next `setup.mjs` run.

### Added
- **`shared/skill-index.ts`** — `parseSkillDomains` and `countSkills`, one definition of the index format. The two readers drifted because each parsed the file independently; this is the same containment argument as `obsidianVaultDir()`.
- **Regression cover for graduation** (`skill-scan-runner.test.ts`) — there was none, which is the direct reason a parser that matched nothing shipped. Asserts a listed domain graduates, multi-domain cells split, and neither the header/separator rows nor `## Pending Proposals` graduate anything.

### Notes
- The first fix used `(?=^##\s|\z)` to bound the section. **JavaScript has no `\z`** — it degrades to a literal `z`, so a trailing `## Skills` section with no heading after it never terminated and the parser returned empty. The new tests caught it before it landed; the extractor now splits on headings rather than anchoring.
- `python-cli-pipeline` was carried in the v1 index but has no directory under `~/.claude/skills/`. It was dropped rather than migrated — registering a skill that does not exist would suppress its cluster forever.
- **Graduated clusters are still written to `.skill-proposals-pending.json`.** `hasSkill` sets the status label in `SKILL-CANDIDATES.md` but does not filter the pending marker, which gates only on `status === "new" && !oversized`. None of the 5 current proposals correspond to an existing skill, so nothing is being mis-flagged today — but the filter is arguably wrong and is left unchanged here.

## [v0.10.0] - 2026-08-07

`dream` is wired to the CLI, and the state-vs-event distinction it needed is now recorded on every entry. Concept from `coleam00/skills`; it turned out to *define* the `superseded` rule rather than sit beside it.

Every fact is one of two kinds. **State** is one current value that changes — a path, a version, a port — and wants replacing. **Event** is a timestamped thing that happened — a gotcha, a decision, a lesson — and wants appending. The update rules are opposites: replacing an event destroys history, and appending a state leaves two live answers to one question with nothing marking which is current. `knowledge_index` can only append, so every changed state fact has left its predecessor recallable.

**Nothing about the write path changed.** `ob_store` records the label; storing still appends either way. Replace-on-write waits until the classification is shown correct on real entries, per the design doc's "auto-apply nothing initially".

### Added
- **`open-brain dream`** — `--dry-run` is the default rather than a flag, so an overnight run that forgets one reports instead of mutating. `--apply` exits non-zero with an explanation: there is no write path yet, and exiting 0 would let a caller believe changes landed. `--since=<days>` defaults to 7, `--json` for machine output.
- **`knowledge_index.fact_kind`** — nullable, and **NULL means unclassified, not `event`**. All 341 existing rows are unclassified; backfilling a guess is the failure this feature exists to fix.
- **A column-migration mechanism** (`migrateAddedColumns`). There was none: `CREATE TABLE IF NOT EXISTS` reaches new installs only, so editing the DDL would have left every existing database without the column and killed the first query naming it. Additive only, by design — SQLite's `ALTER TABLE` cannot add a CHECK or alter a column, and anything needing more requires a table rebuild that should be written explicitly rather than hidden in a list.
- **`pipelines/dream/classify.ts`** — tiered state/event classifier. Returns `null` freely: an entry that reads as both, or as neither, produces no proposal, because a wrong label costs more than a missing one.
- **`findMisfiled`** — `[CHECKPOINT]`/`[SUMMARY]` rows sitting in `knowledge_index` against the ruling of entry #138. Returns the 4 the corpus audit predicted.
- **`findSuperseded`** — two paths. *Narration*: one entry names another as out of date and the other carries no pointer forward (returns the audited #232←#234). *State pair*: two `state` entries, same subject, different content — the general case, which fires whether or not anyone wrote "this replaces X".
- **`kind` parameter on `ob_store`** — `state` or `event`, recorded to `fact_kind`. `effectiveKind` prefers a recorded label over anything inferred, so the heuristic decays in importance as real labels accumulate.

### Fixed
- **`ob_store` crashed on re-storing an existing key.** It bypassed the `store()` pipeline and issued a bare `INSERT` where the pipeline uses `INSERT OR REPLACE`; since `vault_path` and `key` are both `UNIQUE`, a repeat store raised `UNIQUE constraint failed` — and re-storing an existing key is precisely what a state fact does. Now routed through the pipeline, which is also the single place replace-on-write will later change.
- **`ob_store` crashed when `key` was omitted**, despite `key` being optional in its own schema and `NOT NULL` in the table. A placeholder would have collided on the *second* keyless store; the key is now derived from the content, so two stores deriving the same key are similar enough that dedup is the right outcome.
- **`store()` silently dropped `project_dir` and `source`.** Any caller routed through it would have written a globally-scoped row, out of reach of every project-scoped query — the same defect that once left 62% of rows with a NULL `project_dir`.

### Notes on calibration
- **The experience template is a prior, not a finding, and was demoted mid-implementation.** `TRIGGER:`/`OUTCOME:` scored as a high-confidence structural signal until the live corpus showed it matching **287 of 341 entries** — it is simply how nearly everything here is written. At 0.9 confidence it produced "86% of this corpus is events", which only ever supported the far weaker claim "86% uses the template". It now ranks *below* word choice and breaks ties only, which moved the count from 8 state / 294 event to **41 state / 261 event / 39 unclassified**. A signal firing on 84% of a corpus separates nothing.
- **State-side precision is roughly 50–60%, measured by reading all 41.** About 15–20 are genuinely state (`port is`, `use notebook_url not`); the rest are lessons that *mention* a value, where `path is` or `threshold is` catches the mention inside an event narrative. Distinguishing "about the value" from "mentions the value" is semantic and belongs to the model leg. The fix is real labels via `ob_store kind`, not sharper regexes.
- **The state-pair path found zero on the live corpus, and that is a real zero.** Across all 820 state pairs the highest subject overlap is 0.29 against a 0.50 threshold — no two state entries currently describe the same subject. The path is proven by unit tests and unexercised in production; its value is prospective.
- **`obsolete-reference` returns 7, not the 0 the design doc claims.** Five are the low-confidence kind that narrate a retirement (correctly ranked at 0.35). Two are genuine live stale pointers present in both the database *and* the vault note: #184 instructs the reader to update `Projects/Self-Improving-Agent/knowledge-mcp/`, deleted in Session 47, and #303 cites `knowledge-mcp/scripts/skill-scan`. The doc has been corrected.

## [v0.9.0] - 2026-08-07

Foundations for `dream` — a scheduled pass that reconciles memory across sessions, catching the patterns that in-band writes structurally cannot see. Design: `.agents/SYSTEM/dream-design.md`. Not yet wired to the CLI; these are the deterministic parts, all pure functions with no clock and no model.

Both defaults were set by measurement against the live corpus rather than inherited from the reference implementation, and in each case the measurement contradicted the initial choice.

### Added
- **`pipelines/dream/transcripts.ts`** — reads `~/.claude/projects/<project>/<uuid>.jsonl`, keeping only `user` and `assistant` rows. A 500-line transcript is mostly `mode`, `permission-mode`, `attachment` and `file-history-*` noise. Tool calls are dropped from message content: quoting them as evidence of what the user said would be misleading. Malformed trailing lines are skipped rather than thrown on, since an open session's last line is routinely a partial write — failing there would make dream unable to run precisely when there is most to reconcile.
- **`pipelines/dream/rules.ts`** — `findDuplicates` and `findStale` over `knowledge_index`. Both propose only; apoptosis retains sole authority to delete, so `findStale` deliberately ignores success rate and looks purely at disuse, which apoptosis does not consider.
- **Every candidate carries checkable evidence by type**, not by convention — a transcript quote with session id and line, or an entry excerpt with its id. A proposal a human cannot check is one they can only accept on trust.

- **`obsolete-reference` rule** — entries citing infrastructure that no longer exists, preferred over `findStale`. Staleness-by-disuse is inferential over a contaminated signal: `ob_recall` returned nothing for multi-word queries until July 2026, so for most of this corpus's life a low recall count records that an entry was *unfindable*, not unwanted. A missing path is checkable. Proposes a rewrite, never a deletion.
- **`open-brain/scripts/dashboard.mjs`** — read-only web viewer for `knowledge-v2.db`, recovered from the retired v1 tree. Reads `~/.claude/open-brain/knowledge-v2.db`, overridable via `OPEN_BRAIN_DB`; port via `DASHBOARD_PORT` (default 3456). Surfaces the maturity lifecycle — progenitor/proven/mature counts — which the v1 schema had no column for and which therefore has never been visible.
- **v1→v2 compatibility shim in the dashboard** — the viewer was written against the v1 schema (`knowledge`, `summaries`, `tags`, `chunks_fts`), none of which exist in v2. The shim creates these as **TEMP views and a TEMP FTS table scoped to the connection**, so `knowledge-v2.db` is never written to. Temp rather than persistent views is deliberate: `src/db.ts` still issues `INSERT INTO knowledge`, and a persistent view under that name would convert a loud failure into a silent one.
- **`pipelines/dream/report.ts`** — ranks, caps per kind, and states what it dropped. An uncapped 86-item list reads as noise and gets ignored wholesale; a capped list that says nothing about the cap reads as "this is everything". Both mislead, so sections are capped *and* the omission is reported, with the highest omitted confidence so the reader knows what they are not seeing. Output is byte-stable across runs on unchanged input, so a no-op run looks like one.

### Fixed
- **The dashboard had been reading the retired v1 database.** `KB_PATH` pointed at `~/.claude/context-mode/knowledge.db`, whose `chunks` table stopped being written on 2026-04-16 when v1 was retired in Session 33. Every figure the dashboard displayed was a April snapshot, not live state. It now reads `knowledge-v2.db`. The v1 path resolving to a real, populated file is what let this go unnoticed — a dead reference that still returns data reads as a working one.

### Removed
- **`~/.claude/knowledge-mcp/` (573 MB) deleted** after auditing every file for a live equivalent. `session-end.mjs` → `pipelines/session-end/` (11 stages), `skill-scan.mjs` → `skill-scan.ts` + `skill-scan-runner.ts`, `dashboard.mjs` → `open-brain/scripts/`; the two `backfill-*.mjs` are one-time migrations already run, and all five are in git history.
- **Data files were verified by exact record-set comparison, not by count.** `skill-invocations.jsonl` (799) and `score-history.jsonl` (5) were confirmed strict subsets of their v2 counterparts. `shadow-recall.jsonl` was **not** — v2 held a single 2026-07-28 record while v1 held six unique April ones, so the sets were merged before deletion. Counts alone would have shown v2 ahead on two of three files and hidden the gap on the third.
- **2,437 legacy chunks purged from `context-mode/knowledge.db`** (6,436 KB → 1,160 KB). 69% were under 100 characters — bare filepaths, single-word git refs, tool names indexed as BM25 documents. The 40 `checkpoint` chunks were migrated into v2 with `legacy_chunk_id` provenance and exported to `Obsidian Vault/Checkpoints/` as markdown, since v2's `chunks` table has no FTS index and they would otherwise have been unsearchable.

### Notes on calibration
- **The window is 7 days, not the reference implementation's 24h — and not the 72h first proposed here.** Counting real sessions: 24h → 2, 72h → 2, 7d → 17. 72h and 24h currently return the identical set, and a window that collapses onto a single day is in-band memory with extra steps.
- **Duplicate detection keys off the entry key, not content.** Across all 54,946 pairs in the live corpus, content overlap tops out at 0.386 — and that pair (`traefik-docker-api-version` / `traefik-docker-29-api-version`, a genuine near-duplicate) is indistinguishable from one at 0.379 sharing only a topic. Notes about one stack reuse its vocabulary whether or not they say the same thing. Key overlap ranked that pair at 1.00 and left the neighbours well below. Yields 7 candidates where content alone yielded 0 at every threshold tried.
- **A corpus audit found no evidence of the pollution it went looking for.** All 332 vault paths resolve, no entry is a stub, none lack tags or a key, and the earliest cohort — March–April, the buggiest period — scores *better* than later entries on every engagement metric (19.1% vs 17.9% rated, 45.6% vs 41.0% recalled). What it did find is that no entry has ever been rated harmful and 81% has never been rated at all, so the corpus holds no quality signal in either direction. "Not measurably worse" and "never measured" are indistinguishable from the metadata; nothing should be inferred from disuse.
- **`obsolete-reference` matches paths, not mentions.** Matching the bare name flagged 12 entries, of which several were correct — notes naming the vault as one of three stores, one recounting a historical bug. Requiring an adjacent path separator cut it to 8. Of those, three still cite an old path *because they record its removal* ("Deleted `knowledge-mcp/`", "dead vault-utils.mjs"), which no pattern can separate from genuine reliance. Those are ranked down to 0.35 rather than filtered, keeping them reviewable while the five real stale pointers sit at 0.80. Nothing auto-applies, so a mis-ranked candidate costs a moment's reading rather than a lost entry.
- **Staleness defaults to 120 days rather than 90.** At 90 the rule flags 167 of 332 entries — half the knowledge base, which is not a report anyone reviews. 120 gives 86, still high: the corpus spans only ~140 days, so any disuse threshold below its own age flags a large fraction by construction. The report layer will need to cap and disclose what it dropped.

## [v0.8.3] - 2026-08-03

The v2 rebuild was a clean slate rather than a migration, so two vault directories have existed side by side since April with near-identical names. Six code sites re-joined the vault path as a string literal, and they did not agree on which vault they meant: session captures were written to v2 while the health checks looked for them in v1. Every SessionStart therefore reported `session-end may be failing` against a pipeline that was working correctly, and the recommended response to that warning — investigate session-end — led away from the actual fault every time.

Consolidating the path onto one accessor made three further faults visible, each of which had been masked by a check that could only ever pass.

### Fixed
- **The vault path existed as a literal in six places across two different vaults.** `cli-session-end.ts` and `server.ts` resolved v2; `health-checks.ts`, `skill-scan-runner.ts`, `sync/score.ts`, and `paths.ts` resolved v1. All six now call `obsidianVaultDir()`, the sole remaining occurrence of the string, with an `OPEN_BRAIN_VAULT_DIR` override in the style of the existing score-history and shadow-log redirects. Startup warnings went from two — both false — to zero.
- **The skill scan read 1 of 399 experiences.** `runSkillScanPipeline` used a flat `readdirSync`, which was correct for v1's flat `Experiences/` but not for v2, which files notes under a project subdirectory. Pointing the scan at v2 therefore reported "0 clusters", indistinguishable from a healthy scan finding nothing worth clustering. The walk is now recursive: 118 clusters where the flat read found none. Covered by `skill-scan-runner.test.ts` against both layouts.
- **The session-capture health check could not fail.** It matched context-mode session `.db` filenames against a `Sessions/` folder. v2 has no `Sessions/` folder and identifies sessions by transcript UUID, so the `existsSync` guard skipped the whole check — silently, which is how a permanent false positive became a permanent no-op once the path was corrected. It now reads the newest transcript UUID from `~/.claude/projects` and looks for it in `Summaries/` frontmatter, and warns rather than skipping when the expected directory is absent.
- **`/sync` required a `Sessions/` directory that v2 does not use**, warning on every run against a correctly-shaped vault.
- **The test suite wrote into the user's real Obsidian vault.** Vault paths were module-level constants frozen at import, so `OPEN_BRAIN_VAULT_DIR` could not take effect no matter where it was set. Every full test run deposited a session summary named for its temp project; 57 `ob-server-*` files had accumulated in `Summaries/` since April, and were pushed to the backup remote before being spotted. Paths are now resolved per call, and `tests/setup-env.ts` redirects the vault globally, so a test that forgets to override leaks into a temp directory rather than into the user's notes. The 57 files have been removed.

## [v0.8.2] - 2026-07-28

The CI workflow added in v0.8.1 failed on its first and only run. The four failures were real, but they were failures of the test harness rather than of the code under test: the suite could only pass on a machine that already had a populated `~/.claude`. Chasing that surfaced the same assumption in shipped code — the server could not open its own database on a machine where the directory did not exist yet, which is every fresh clone of this template.

### Fixed
- **First run on a machine without `~/.claude/open-brain/` crashed.** `openV2Database` called `new Database(dbPath)` directly; better-sqlite3 creates the database file but not its parent directory, and nothing in `scripts/`, `setup.mjs`, or the server created that directory. Anyone cloning the template hit `Cannot open database because the directory does not exist` on their first `ob_*` call, with no indication of what to create. `openV2Database` now does a recursive `mkdirSync` on the parent — a no-op once it exists, so no existing install changes behaviour. Verified against a bare `$USERPROFILE`: the directory is created and `computeScore` returns 57/100 where it previously threw.
- **Four `server.test.ts` tests depended on the developer's home directory.** `server.ts` resolves the v2 database at import time from `$KNOWLEDGE_V2_DB || ~/.claude/open-brain/knowledge-v2.db`, and `tests/setup-env.ts` redirected score history, the shadow log, and the active-session slot but not the database. On a GitHub runner that directory does not exist, so better-sqlite3 threw `Cannot open database because the directory does not exist` and `handleEnd`, `handleSync --score`, and both `computeScore` tests failed. The redirect now covers the database as well.
- **The same coupling read production data on developer machines.** With the DB resolving to the real `~/.claude/open-brain/knowledge-v2.db`, the score tests were scoring against live Knowledge Quality stats — the test file's own comment conceded the total "may exceed 100". Scoring now runs against an empty temp DB and the total is asserted within `[0, 100]`, which the old path could not guarantee.
- **Comments in `server.test.ts` documented the removed coupling as permanent** ("we can't easily redirect it"), and one test named for behaviour it never exercised — it asserted the no-entries fallback, not real DB stats. Both corrected.

### Added
- **Two `openV2Database` first-run tests** — that a missing parent directory is created and the schema initialises against the new file, and that reopening an existing database does not clobber it. The first would have failed before this release; nothing covered the open path itself, only in-memory databases.

Verified by running the full suite against a bare `$USERPROFILE`, which reproduces the runner: 455 tests across 35 files, all passing. Note that `HOME` alone does not work for this on Windows — `os.homedir()` reads `USERPROFILE`.

## [v0.8.1] - 2026-07-28

v0.8.0 claimed Cursor support that had never once been executed. Verifying it end to end — a Claude Code session and a Cursor session working the same repo simultaneously — found that Cursor sessions recorded no provenance at all, and surfaced two further bugs that degrade Claude Code as well.

### Fixed
- **Cursor sessions registered no session UUID, so shadow recall could never evaluate them.** `cli-bootstrap` read only Claude Code's `session_id` payload field *and* relied on the hook's stdout reaching agent context. Cursor satisfies neither: it does not inject SessionStart stdout at all. `ob_set_session` was therefore never called, `recall_log` and `feedback_log` stayed empty, and the harness had no ground truth. The UUID is now written to `~/.claude/open-brain/active-session.json` by the hook and read back by the server, so nothing has to survive a trip through an agent's context.
- **Two IDEs on one repo silently shared a session identity.** Slots were keyed by project directory alone. Observed live: a Claude Code *resume* rewrote the slot, after which the Cursor session read back the Claude session's UUID and filed six recalls under it — no error, no warning, both sessions looking healthy. Keys are now `<project>::<ide>`. This was never the rare race it was first documented as; two IDEs on one repo is a normal setup, and every session start including a resume rewrites the slot.
- **A Cursor session could still mislabel itself as Claude Code.** Cursor also executes the hooks in `~/.claude/settings.json`, and that registration carries no `--ide` flag — so registration alone was not a reliable host signal, and the mislabelled write would overwrite a genuine Claude Code slot. The host is now detected from the payload's `cursor_version`, which is authoritative regardless of which config invoked the hook. Confirmed in production: the slot that proved the fix was written by the Claude-registered hook (`hook_cwd` = `~/.claude`) and correctly labelled `cursor`.
- **Cursor keyed slots to the wrong project.** Cursor invokes hooks with cwd set to its *config* directory (`~/.cursor`), not the open workspace, so the slot landed under a path that `ob_set_session` never looks up. The workspace now comes from the payload's `workspace_roots`.
- **`setup.mjs` created duplicate SessionStart registrations.** Dedup compared command strings literally while `path.join` emits backslashes on Windows, so a re-run missed an existing forward-slash entry and appended a second — making the Claude Code hook fire twice per session. Comparison is now separator-normalised, and a re-run *replaces* prior `cli-bootstrap` registrations rather than adding to them. `checkHookRegistration` caught this on the first `/sync`, on a duplicate shape it had never seen.
- **`checkMirrorParity` reported permanent false drift.** A file copied on Windows picks up CRLF while the repo copy stays LF; byte-for-byte comparison called two identical files different. Comparison is now content-normalised.

### Added
- **`shared/active-session.ts`** — the IDE-agnostic session handoff: `resolveSessionId`, `detectIde`, `resolveWorkspaceDir`, and per-IDE slot keying. A UUID is generated when the host supplies none, because the system needs a stable per-session key, not the IDE's own identifier.
- **Cursor's real SessionStart payload as a test fixture**, captured from a live hook fire and annotated as observed rather than invented. An earlier *inference* about this shape (`conversation_id`, no `session_id`) was wrong and cost two verification cycles; Cursor in fact sends both, and `session_id` is preferred.
- **`is_background_agent` anti-loop**, alongside Claude Code's `agent_id`, so Cursor background agents do not register sessions.
- **`CURSOR_COMMAND_SET`** asserted by `checkMirrorParity` — the Cursor command subset is now machine-checked, since pairwise mirror comparison only sees files present on both sides and could never flag one silently dropped.

### Notes
- **Cursor hooks require PowerShell as the shell on Windows.** Cursor wraps hook commands in PowerShell syntax; with bash configured as the default shell the wrapper dies on `&` before reaching node, and SessionStart fails silently because nothing surfaces its stderr. This single mechanism explained every symptom — global and project-level hook configs both correct yet never firing, while the binary worked perfectly when invoked by hand.
- **Shadow recall has its first real evaluated session**, produced by a Cursor session end to end. The presentation bias documented in v0.8.0 is confirmed on live data: `live` carried 6 of 10 labeled results against 4–6 for the variants, and won on nDCG — which remains weak evidence, exactly as predicted, because the metric favours the incumbent by construction. Two variants beat `live` on MRR while losing on nDCG. Still correctly gated behind "sample too small".

## [v0.8.0] - 2026-07-28

### Added
- **Multi-IDE support — the framework installs into Cursor as well as Claude Code.** `scripts/setup.mjs` now registers the `open-brain` MCP server in `~/.cursor/mcp.json`, wires a `sessionStart` hook in `~/.cursor/hooks.json`, and copies the Cursor slash commands to `~/.cursor/commands/`. All three steps are idempotent — re-running skips anything already configured. `FRAMEWORK.md` and both READMEs document the two-layer model and the new setup flow.
- **`CURSOR_COMMAND_SET`** — Cursor deliberately receives the session-lifecycle subset (`start`, `end`, `sync`, `checkpoint`) and not `bootstrap`, `skill-scan`, `task` or `test`, which are Claude Code workflows with no Cursor equivalent. The set is asserted by `checkMirrorParity` rather than left implicit: pairwise mirror comparison only sees files present on both sides, so a command silently dropped from the template would never have been flagged, and a deliberate omission was indistinguishable from a forgotten one.
- **Shadow recall — an offline A/B harness for retrieval ranking.** Revived from the retired v1 `session-end.mjs` Stage 3, re-aimed and rebuilt. At session end it replays the session's own recall queries under six ranking strategies and scores each against the relevance labels that same session assigned, appending one JSONL line per session to `~/.claude/open-brain/shadow-recall.jsonl`. Nothing is shown mid-session and live ranking is unaffected.

  Every ranking constant (`recencyDecayPerDay`, `matureBoost`, `provenBoost`, `failureBoost`, `lowSuccessPenalty`) was an unvalidated guess — v0.7.2 changed ranking three times and verified each by eyeballing top-5 results on a handful of queries. This is the instrumentation that replaces that with evidence.
- **`recallRankExpr(alias, overrides)`** — ranking strategies are now config overrides of the *live* expression, not parallel implementations. The v1 harness carried its own RRF/vector ranking code, so it measured a path production never used and died with that path.
- **`recall_log` and `feedback_log` tables** — `knowledge_index` holds only aggregate counters with no timestamps and no record of which session assigned each rating, so retrieval quality could not be reconstructed retrospectively. These capture the query → ranked results → rating chain as it happens. Also makes historical replay unnecessary: evaluation runs forward from here.
- **`shared/fts.ts`** — `sanitizeFtsQuery`/`broadenFtsQuery` extracted from `server.ts` so the harness builds MATCH expressions identically to `ob_recall` without importing the MCP server.
- **36 tests** across strategy parameterisation, scoring metrics, ground-truth logging, and the session-end stage.

### Removed
- **`project-template/.cursor/hooks.json.template`** — its `{{OPEN_BRAIN_BOOTSTRAP}}` placeholder was never substituted by anything. `registerCursorHooks()` builds the identical structure programmatically, so the file was config that nothing consumed while reading as though it were live.

### Changed
- **Pipeline Health scores shadow recall again** (hook recency 4 / trend 3 / shadow 3). The component was removed in v0.7.2 because it could never score above 0. It returns on a *ramp* — one evaluated session already earns a point, 5 earns two, 10 earns three — so it cannot silently cap the category the way the all-or-nothing version did. Expect 8/10 until sessions accumulate; that is the harness honestly reporting it has no sample yet.
- **Auto-feedback in `sessionEndV2` now logs rating events.** It calls `updateFeedbackV2` directly rather than going through `ob_feedback`, so without this its labels would never reach the harness and most sessions would score as having no ground truth at all.

### Notes
- **The obvious quality metric is backwards and was deliberately not ported.** v1 scored a strategy by how many of its results already carried positive feedback. Ratings accrue to entries that have been recalled before, so that rewards resurfacing old, frequently-recalled knowledge — it would likely have scored the age-inverted ranking bug of v0.7.2 as *better* than the fix. Labels are scoped to the session being replayed instead.
- **Presentation bias is asymmetric and favours the incumbent.** Labels only exist for entries `live` actually displayed, so `live` starts with more of its results labeled than any variant (7/15 vs 4–6/15 measured on the live 315-entry database). A variant beating `live` is therefore strong evidence; a variant tying or losing is weak evidence and does not establish that `live` is optimal. The report names candidates only and never adopts one automatically.
- **No verdict below 10 evaluated sessions.** The v1 harness collected 7 and no conclusion was ever drawn from it.

## [v0.7.2] - 2026-07-28

### Fixed
- **`ob_recall` ranked older entries higher, not newer** — the weighted rank multiplied `bm25()` (negative, more-negative = better) by a factor that *grew* with age, so every day an entry aged it gained ~0.5% ranking advantage and at 200 days its score doubled. Documented as "recency-weighted BM25" since v0.3.0; it was anti-recency weighted. Now divides by the age term. Measured on the live 315-entry database, average age of top-5 results dropped from 123d to 44d.
- **Maturity boost was computed and discarded** — `server.ts` called `maturityBoost()` into a variable that was never read, and the SQL `ORDER BY` never referenced maturity. The 1.5x/1.2x boosts had never applied to a real recall. Maturity, the low-success-rate penalty, and the 1.3x failure boost are now part of the ranking expression, so they affect selection rather than just display order.
- **PRD and RULES checks could never pass** — `syncPrdVersion` and `checkRules` hardcoded `docs/` and the repo root while the framework convention (and `checkSummary`) use `.agents/SYSTEM/`. The PRD drifted three versions unnoticed because the drift detector was looking in the wrong place. New `resolveDocPath()` resolves `.agents/SYSTEM/` → `docs/` → root. The version pattern now tolerates `| **Version** | v0.7.1 |` as well as `| Version | 0.7.1 |`, preserving the author's style when auto-fixing.
- **Pipeline Health could not score above 3/10** — `lastHookRun` and `lastShadowRecall` were hardcoded `null` at both call sites, and nothing has written shadow-recall data since the v1→v2 port. Hook recency now reads the SessionEnd pipeline's own write marker; the dead shadow component was removed and its points redistributed.
- **`ob_sync --score` never recorded history** — only `ob_score` appended, so the trend stopped collecting in April despite `/sync` being the route in actual use.
- **CLI and MCP server reported different health scores** for the same repo — the CLI scored against the retired v1 `knowledge.db` (frozen since April) while the server used v2. `computeScore` now lives in `pipelines/sync/score.ts` and both call it.
- **Telemetry was written into a retired component's directory** — score history and the skill-invocation log lived under `~/.claude/knowledge-mcp/`, which is slated for deletion. Both moved to `~/.claude/open-brain/` (877 invocation entries and score history preserved).
- **Windows test teardown raced intermittently** — `ENOTEMPTY` on recursive `rmSync` failed a different test on roughly half of runs. 14 teardown sites now pass `maxRetries`/`retryDelay`.

- **Multi-word recall queries returned nothing** — FTS5 joins bare terms with AND, so `ob_recall(["knowledge maturity feedback loop"])` required all four terms in one entry and returned zero, while 86 entries matched some of them. `/start` instructs agents to use "methodology-focused" queries, which are exactly that shape, so the most common query form was the one that silently failed. `ob_recall` now retries with the terms OR-joined when the precise query returns fewer than `limit` results, keeping precise hits ranked first and labelling partial matches. Strictly additive — it can only fill empty slots, never displace an exact hit. Measured against the live database: `deterministic verification` 0 → 5, `test coverage strategy` 0 → 5.

### Added
- **CI workflow** (`.github/workflows/ci.yml`) — Node 22, `npm ci` → typecheck → test. The repo had no CI, which is why 7 tests stayed red for 3.5 months.
- **Root `npm test` / `build` / `typecheck` scripts** — the root `package.json` had no scripts, so `npm test` from the repo root was a no-op and tests only ran from `open-brain/`.
- **`checkMirrorParity`** — byte-for-byte parity across repo, template, and live `~/.claude` + `~/.cursor` command directories, with `MIRROR_EXCEPTIONS` documenting each intentional non-mirror. Distribution drift recurred across 12 sessions because parity was only ever checked by eye.
- **`checkHookRegistration`** — counts hook registrations per event and flags duplicates. A duplicate SessionStart entry made the bootstrap hook emit `SESSION_UUID` twice.
- **Session provenance** — `recordSession`, `recordChunk`, `getSessionByUuid`, `getChunksForSession`. The `sessions` and `chunks` tables shipped in the v2 schema but nothing ever wrote to them, so `ob_set_session` only held the UUID in memory and there was no record to verify after a session ended. This is why SESSION_UUID verification stayed manual across 10 sessions.
- **Contract tests for `cli-bootstrap.ts`** — the most repeatedly-fixed file in the repo had no tests. Five tests assert the SESSION_UUID emission contract against the real entry point.
- **Ranking regression tests** — recency, maturity, success-rate penalty, exact failure-tag matching, and TS/SQL agreement, generated from one `LIFECYCLE_CONFIG` so the SQL and `maturityBoost()` cannot drift.

### Removed
- **`src/pipelines/recall/`** — `recall()` and `mergeAndRank()` were never imported by anything. The module held the only implementation of the semantic/keyword hybrid and failure boost, appeared in the architecture map as a cohesion-1.0 cluster, and had passing tests — for code that never ran. The failure boost was ported into the live ranking expression.
- **5 orphaned tests** in `checks.test.ts` for `syncKmcpVersion` and `checkInstalledDrift`, deleted from `src/` in April but left behind in tests.
- **Dead `paths.ts` keys** (`prd`, `knowledgeMcpPackageJson`, `hooksDir`) and the unused `dbPath` parameter on `checkSpecProvenance`.

### Changed
- **PRD reconciled against the code** — version corrected to v0.7.1, retired `knowledge-mcp`/`sqlite-vec` references removed, the expired "v1/v2 parallel until May 13" claim corrected, and a "Not currently implemented" section added naming four documented-but-absent features (semantic/keyword hybrid, RRF, cosine diversity filter, vector search).
- **Working cadence guidance** added to `RUNBOOK.md`.

## [v0.7.1] - 2026-07-27

### Fixed
- **Skill-scan cluster consolidation measured containment, not similarity** — `consolidateClusters` normalized file overlap by `Math.min(sizeA, sizeB)`, so any small cluster fully inside a large one scored 1.0 and merged unconditionally. One seed cluster then snowballed through the vault: the 2026-07-25 scan produced a 23-file cluster labeled `clerk` (only 2 of 23 files were Clerk-related) and a 22-file `node` cluster that was really "everything I hit on Windows". Now uses Jaccard (`intersection / union`) — the same 3-in-20 case scores 0.15 and is left alone.
- **Merged clusters were named after `tags[0]`** — whichever tag happened to come first out of the cluster map, which is why a Convex/VPS cluster was labeled `clerk`. Merged clusters now take the tag covering the largest share of the merged file set; the rest are recorded in `consolidatedFrom`.
- **Tag quoting was never stripped** in `parseExperienceTags` — `"deployment"` and `deployment` clustered separately (40 and 15 files), and quoted noise tags bypassed `NOISE_TAGS` entirely (`"gotcha"` reached 45 files). Surrounding quotes are now stripped before noise-filtering and deduplication.
- **Session UUID was discovered by filesystem mtime scan** — `cli-bootstrap.ts` scanned `~/.claude/projects/*.jsonl` for the newest transcript, but at SessionStart the current session's transcript does not exist yet. The hook either emitted nothing (provenance silently disabled for the session) or returned the *previous* session's UUID, mis-attributing everything stored. Now reads `session_id` from the hook's stdin payload; emits nothing rather than a wrong UUID if absent.

### Added
- **Merged-cluster size cap (8)** — a merge whose result would exceed `MAX_CLUSTER_SIZE` is refused. A skill distilled from 20+ experiences is not reviewable, so it gets skipped every scan and re-proposed the next one.
- **`oversized` flag on `SkillCluster`** — a single broad tag can exceed the cap without any merging (`deployment` 40, `convex` 36, `windows` 33 in the current vault). These are now flagged "TOO LARGE — split into narrower tags" in `SKILL-CANDIDATES.md` and excluded from both `pendingProposals` and `.skill-proposals-pending.json`, instead of being proposed as skills.
- **`dedupeClusters`** — a cluster whose files are ≥75% covered by a larger one is dropped rather than proposed alongside it. Consolidation deliberately leaves these alone (their Jaccard overlap is low), but proposing both spends two review cycles on the same material.

### Changed
- **`sessionStart()` accepts an optional `sessionId`** — callers that already know the UUID (hook payload, prior `ob_set_session`) pass it directly; `ob_start` now passes the registered session ID. Transcript discovery remains only as a mid-session fallback.

## [v0.7.0] - 2026-04-17

### Fixed
- **`project_dir` path canonicalization** — the server previously did partial normalization (backslash → forward-slash only), which caused the same project to be stored under up to 5 different keys (drive-case, path-case, double-slash variants). `ob_recall` missed 15 of 33 entries when queried with the canonical form. New `canonicalizeProjectDir()` in `shared/paths.ts` produces a single canonical form: lowercase drive + forward slashes + collapsed `/+` + trimmed trailing slash (Windows paths fully lowercased; non-drive paths preserve case for POSIX filesystems). Applied at both write (`ob_store`, `ob_store_chunk`, vault-path derivation) and query (`ob_recall`, `ob_list`) boundaries.
- **One-shot migration** on database open canonicalizes all existing `project_dir` values. 74 non-NULL rows collapsed from ~25 variants down to 12 canonical values (one per real project). Idempotent — second run changes 0 rows.
- **Redundant inlined backslash replays removed** from `server.ts` (lines 435, 665) — they duplicated what `normalizePath()` already did, now fully handled by the single canonicalizer.

### Added
- **`.agents/AGENT.md` convention** — declarative agent persona file (YAML frontmatter: `name`, `role`, `partner`, `mailbox_channel`). Keeps persona data out of `CLAUDE.md` and gives every project a predictable slot. Blank template with placeholders shipped in `project-template/.agents/AGENT.md`.
- **SessionStart hook emits identity line** — `cli-bootstrap.ts` reads `.agents/AGENT.md` via a new `agent-identity.ts` helper (regex frontmatter, no YAML dep) and emits `Agent: {name} ({role}) — partner: {partner}, channel: {channel}` after `SESSION_UUID`. Graceful skip if AGENT.md absent.
- **SessionStart hook surfaces mailbox state** — when `mailbox_channel` is declared, emits `Mailbox: N message(s) in {inbox-file}, last decision {date}`. Reads `~/.agents/mailbox/channels/{channel}/{partner}-to-{name}.md` (message count = `## [` header count) and `decisions.md` (latest `## YYYY-MM-DD` header).
- **`/start` reads mailbox before greeting** — the `/start` startup subagent now reads the inbox + decisions log if a mailbox_channel is declared, and surfaces the newest message subject + latest decision date in its GREETING. Projects without `AGENT.md` or without a channel get the unchanged greeting.

### Changed
- **Slash commands now ship through `project-template/`** — previously all `/start`, `/end`, `/sync`, `/task`, `/test`, `/skill-scan`, `/checkpoint`, `/bootstrap` evolution lived only in Aaron's user-global `~/.claude/commands/` and never reached template consumers. Cloning SIA and using the template today would have given a mid-2026-02 version of `/start` with no subagent dispatch, no mailbox logic, no AGENT.md parsing. Mirror rule established: `~/.claude/commands/` is the upstream live-scratch source; SIA-specific commands mirror to `project-template/.claude/commands/` (distribution channel) and SIA repo-root `.claude/commands/` (SIA dogfooding). Personal/generic commands (`/notebooklm`, `/transcript`) stay user-global only. v0.7.1 will add deterministic drift-detection (`/sync` parity check or pre-commit hook) so this class of drift cannot recur silently.
- **`/start` decision-date extraction disambiguated** — prompt previously said "grab the most recent `## YYYY-MM-DD` header," which the subagent interpreted positionally (last-in-file) rather than by date. Now: "parse all `## YYYY-MM-DD` headers, sort descending by date string (ISO format sorts correctly lexically), take the first result." Hook logic (`cli-bootstrap.ts`) was already correct; only the slash-command prompt needed clarification.
- **Live `/sync` command cleaned** — removed stale reference to `knowledge-mcp/package.json` as a downstream file (the `knowledge-mcp/` directory was deleted in commit `7696953`).

## [v0.6.1] - 2026-04-17

### Fixed
- **cli-bootstrap now emits `SESSION_UUID`** so `/start` can scope recalls + writes to the right session. `discoverSessionUuid()` was already built in `pipelines/session-start/session-discovery.ts` but was never wired into the SessionStart hook entry — resulting in `/start` reading "none" and silently skipping `ob_set_session`. Fix wires it in and pushes `SESSION_UUID: <uuid>` into the hook's output lines when non-null.

## [v0.6.0] - 2026-04-06

### Added
- **Recall-time diversity filter:** Post-RRF cosine similarity check (threshold 0.85) skips near-duplicate results, ensuring agents get diverse knowledge. Over-fetches 3x then filters down.
- **`kb_recall_report` MCP tool:** Analyzes knowledge base quality — finds duplicate clusters by vector similarity, lists stale entries with zero recalls. Configurable threshold and staleness window.
- **`kb_consolidate` MCP tool:** Archives multiple overlapping knowledge entries into a single consolidated entry. Inherits feedback counts and maturity from sources. Originals soft-deleted via `archived_into` column.
- **`kb_forget_chunk` MCP tool:** Delete individual chunks by ID for fine-grained cleanup.
- **Storage-time dedup:** `kb_store` checks for similar existing entries (Jaccard >50%) and logs near-duplicates to `~/.claude/knowledge-mcp/dedup-review.json` with a warning. Non-blocking — entries still stored.
- **Skill proposal consolidation:** `skill-scan.mjs` merges tag-based clusters with >60% file overlap, reducing noise (e.g., 51 clusters → ~15 groups).
- **Spec provenance tracking:** `/sync` validates that design specs in `docs/superpowers/specs/` have corresponding knowledge chunks with `category: "spec"`.
- **Subagent /start loop fix:** Lock file mechanism (`.agents/.start-lock`) prevents recursive `/start` invocation when Explore subagents trigger SessionStart hooks.

### Changed
- **`archived_into` schema migration:** New nullable column on knowledge table. Archived entries excluded from `recall()` and `listKnowledge()`.
- **`recall()` over-fetches:** FTS and vector queries now fetch `limit * 3` candidates, then diversity-filter down to `limit`.

## [v0.5.5] - 2026-04-05

### Added
- **Session manifest:** Unified session UUID threading across all memory layers — chunks, knowledge, and summaries are now traceable back to the session that created them
- **`kb_set_session` MCP tool:** Register the active session ID at startup; all subsequent `kb_store` and `kb_store_chunk` calls auto-inherit session provenance
- **Knowledge provenance:** `created_by_session` and `updated_by_session` columns on knowledge table
- **`updateKnowledge()` function:** Update existing knowledge entries with session stamping
- **`/start` session discovery:** A7/B2.5 steps discover Claude's session UUID from `.db` files and register via `kb_set_session`

### Changed
- **`kb_store_chunk` fallback:** Replaced `checkpoint-YYYY-MM-DD` synthetic IDs with active session fallback, then `local-YYYY-MM-DD-HHMM` (local time) as last resort
- **Sessions table cleaned:** Removed 143 orphaned sessions and renamed legacy checkpoint sessions

### Fixed
- **Session ID collisions:** Multiple sessions on the same day no longer share a single `checkpoint-YYYY-MM-DD` ID
- **UTC off-by-one:** Checkpoint IDs no longer show next day after ~7pm CDT

## [v0.5.4] - 2026-04-02

### Added
- **Protocol health scoring:** `sync.mjs --score` computes a deterministic 0-100 health score across 5 categories (config & structure, knowledge quality, staleness, coverage, pipeline health). `--score --json` for machine-readable output. `--history` shows trend across sessions.
- **Shadow-recall:** `session-end.mjs` Stage 3 replays recall queries with alternative search strategies (FTS-only, vector-only, weighted RRF variants) and logs comparisons to `shadow-recall.jsonl` for future proposer analysis.
- **Score history:** Each `--score` run auto-appends to `~/.claude/knowledge-mcp/score-history.jsonl` for trend tracking.
- **`/start` updated:** Monthly maintenance now includes protocol health score reporting. `.recalled-entries.json` now includes `queries` array for shadow-recall replay.

### Fixed
- **Stale references:** Fixed 8 references to removed scripts (`sync-docs.mjs`, `vault-writer.mjs`, `harness-eval.mjs`) across 6 files including global commands, project template, CLAUDE.md, and session-bootstrap.mjs.

## [v0.5.3] - 2026-03-31

Unified sync pipeline, structural consistency checks, and code maintainability cleanup. Inspired by Meta-Harness (Lee et al., 2026).

### Added
- **Unified `sync.mjs`:** Consolidated `sync-docs.mjs` (version sync) + `harness-eval.mjs` (structural checks) into single script — 31 checks covering versions, file references, hook configs, vault structure, and template consistency
- **`/harness-audit` command:** Scope 2 deep semantic consistency audit — LLM agent cross-references all protocol documents for contradictions and drift. Run at minor/major releases
- **Release checklist in RULES.md:** Scope 1 (every commit), Scope 2 (Y/X bumps), Scope 3 (quarterly)

### Changed
- **`/sync` command:** Now runs unified `sync.mjs` instead of `sync-docs.mjs` — one command for all consistency checks
- **SessionEnd hook order fixed:** `session-end.mjs` now runs before `skill-scan.mjs` in settings.json (was wrong order)
- **`session-end.mjs` paths:** `Guidelines/` → `Skill-Candidates/`, log file renamed from `vault-writer.log` → `session-end.log`
- **`session-bootstrap.mjs`:** Updated health check warnings to reference `session-end.mjs` instead of removed `vault-writer.mjs`

### Removed
- **`sync-docs.mjs`:** Merged into `sync.mjs`
- **`harness-eval.mjs`:** Merged into `sync.mjs`
- **`/harness-eval` command:** Checks absorbed by `/sync`
- **`vault-utils.mjs`:** Dead code — 12 exported functions, zero consumers since v0.5.0 consolidation
- **`vault-writer.mjs` hook:** Removed dead reference from settings.json SessionEnd hooks
- **Duplicate `session-bootstrap.mjs` hook:** Removed wrong-path duplicate from settings.json SessionStart hooks

## [v0.5.2] - 2026-03-31

Skill-scan domain scoping, skill architecture cleanup, and enhanced skill rewrites.

### Added
- **Domain-scoped skill-scan:** `skill-scan.mjs` reads `.agents/SYSTEM/domains.json` to filter clusters to project-relevant domains (58 → 15 clusters for this project)
- **`domains.json` config:** Projects define relevant domain tags; skill-scan uses forward-only TAG_EXPANSION to include related tags without pulling in unrelated stacks
- **Enhanced convex skill:** `convex-development-patterns` v2.0 in `~/.claude/skills/` — 11 source experiences, severity tags, dual checklists, debugging decision tree
- **Enhanced docker skill:** `docker-vps-deployment` v2.0 in `~/.claude/skills/` — 11 source experiences, severity tags, dual checklists, debugging decision tree
- **Setup migration:** `setup.mjs` auto-renames `Guidelines/` → `Skill-Candidates/` on upgrade, registers `skill-scan.mjs` hook

### Changed
- **Skill architecture:** Global skills live in `~/.claude/skills/`, project skills in `.agents/skills/`, scan output in `~/Obsidian Vault/Skill-Candidates/` (was `Guidelines/`)
- **skill-scan.mjs promoted:** Moved from `docs/temp/` draft to canonical `knowledge-mcp/scripts/`, installed copy synced
- **All references updated:** `/start`, `/skill-scan`, `setup.mjs`, project-template commands, memory files, gap-analysis doc

### Removed
- **`docs/temp/` directory:** 9 deprecated draft scripts cleaned up
- **`Guidelines/` folder:** Renamed to `Skill-Candidates/` for clarity; skills migrated to proper locations

## [v0.5.1] - 2026-03-30

Pipeline simplification, knowledge quality improvements, and auto-feedback.

### Added
- **Auto-feedback:** `session-end.mjs` automatically rates recalled knowledge entries helpful/neutral based on session summary domain overlap, feeding the maturity lifecycle
- **Obsidian dual-writes:** `/end` B1 and B3 now write research to `Research/` and experiences to `Experiences/` for Smart Connections semantic search
- **CONCEPTS line:** New field in experience format for plain English domain description, improving semantic search matching
- **Domain concept tags:** `kb_store` guidance and `/end` templates now include broader domain tags (e.g., `payments` alongside `stripe`)
- **Recalled entry tracking:** `/start` B3 writes recalled entry IDs to `.recalled-entries.json` for auto-feedback consumption
- **`--force` flag:** `--backfill-vectors` can now re-embed existing entries (not just new ones)

### Changed
- **Removed chunk indexing:** Deleted `auto-index.mjs` hook and all 6,928 chunks — tool metadata had zero retrieval value
- **Removed Stage 5 safety net:** `/end` is consistently used; auto-fill of `.agents/SESSIONS/` was unused complexity
- **Removed `chunks_fts` table:** No longer created or searched in `kb_recall`
- **SessionEnd hooks:** 4 → 3 (removed `auto-index.mjs`)

### Fixed
- **sqlite-vec upsert bug:** `INSERT OR REPLACE` doesn't work on `vec0` virtual tables — changed to `DELETE` + `INSERT` in both `db.ts` and `session-end.mjs`
- **sqlite-vec not loaded in scripts:** `session-end.mjs` now loads the `sqlite-vec` extension for `--backfill-vectors`
- **Knowledge quality:** Pruned 65 low-value entries (169 → 104), backfilled CONCEPTS lines and domain tags on all 104, re-embedded all vectors
- **Stale Obsidian Experiences/:** Deleted 38 auto-extracted files from removed pipeline

## [v0.5.0] - 2026-03-30

Hybrid search, summary vault writing, and pipeline consolidation.

### Added
- **Hybrid `kb_recall`:** FTS5 keyword + sqlite-vec semantic search merged via Reciprocal Rank Fusion — one tool call, both search modes
- **Enriched session summaries:** Written to `~/Obsidian Vault/Summaries/` (semantic search via Smart Connections) and SQLite (keyword search via `kb_recall`). Structured format: What/Why/How/Lessons with project tags and relative file paths
- **Research capture:** `/end` B1 explicitly prompts for external research (GitHub repos, YouTube, docs, NotebookLM) with standardized source tags
- **kb_feedback wiring:** `/end` B5 collects helpful/harmful/neutral ratings for recalled knowledge
- **Local embeddings:** `@yarflam/potion-base-32m` for 32-dimensional vectors — no API key needed
- **Consolidated SessionEnd pipeline:** `session-end.mjs` replaces 5 separate scripts (auto-index, vault-writer, vault-utils, skill-scan, vault-sync-projects)

### Changed
- `kb_recall` no longer searches raw chunks — only knowledge entries + summaries
- `kb_store` and `kb_store_summary` embed content on write for vector search
- `/end` summary format: structured What/Why/How/Lessons with project tags and relative file paths

### Removed
- Auto-extracted experiences (vault-writer regex patterns) — zero retrieval value confirmed via audit
- Obsidian mirroring (`mirrorToObsidian()`) — replaced by summary vault writing
- Topic linking (dependent on auto-extraction)
- `SESSIONS_DIR` constant — nothing writes to `~/Obsidian Vault/Sessions/`
- 10 deprecated scripts moved to `docs/temp/`

## [v0.4.0] - 2026-03-29

Outcome tracking and skill lifecycle — knowledge entries now have quality feedback and maturity stages.

### Added
- **Outcome tracking:** `kb_feedback` tool records helpful/harmful/neutral ratings for knowledge entries
- **Skill lifecycle:** Maturity stages (progenitor → proven → mature) with automatic promotion based on helpful ratings
- **Apoptosis:** Auto-prunes non-manual knowledge entries below 0.3 success rate after 5 ratings; manual entries flagged for approval
- **Maturity boost:** `kb_recall` ranks mature entries 1.5x higher, proven 1.2x; low-success entries penalized 0.5x
- **Session recall tracking:** `kb_recalled` tool lists which entries were recalled this session (for `/end` feedback collection)
- **Stats enhancement:** `kb_stats` shows maturity distribution; `kb_list` shows maturity badge and success rate

## [v0.3.3] - 2026-03-28

One-command setup for new users and framework developers.

### Added
- `scripts/setup.mjs` — automated setup: installs Knowledge MCP server, registers hooks, copies slash commands, scaffolds Obsidian vault
- `--dev` flag for framework developers (symlinks `src/` and `scripts/` instead of copying for live editing)
- Idempotent design — safe to re-run, skips anything already configured
- README Quick Start section with `node scripts/setup.mjs` as the recommended path

## [v0.3.2] - 2026-03-28

Fix kb_recall returning zero results, Windows path normalization, repo/installed sync.

### Fixed
- kb_recall returning zero results — `build/db.js` had stale `KB_DIR` pointing to `knowledge-mcp/` instead of `context-mode/` (source was correct but build wasn't recompiled)
- Windows path normalization — `normalizePath()` helper ensures `project_dir` uses forward slashes on read (`recall`) and write (`insertSession`, `insertKnowledge`), so Git Bash and PowerShell users get consistent behavior
- Repo/installed copy drift — synced 11 scripts (`scripts/*.mjs`) from installed copy into repo, synced v0.3.0 source updates (`indexer.ts`, `server.ts`, `tags.ts`) to installed copy, reconciled `package.json` identity (`knowledge-mcp` v0.3.0)
- Cleaned up stale `summarizer.*` build artifacts from installed copy
- Added `recall_count`/`last_recalled` migration and `weighted_rank` to `RecallResult` type in `db.ts`

### Added
- `scripts/sync-docs.mjs` — reads authoritative sources (package.json, CHANGELOG, SUMMARY), updates downstream files (README, PRD, knowledge-mcp/package.json). Supports `--check` mode for pre-commit validation.
- `/sync` slash command — runs sync-docs.mjs on demand
- `CLAUDE.md` — project-level instructions loaded at every session start (run /sync before commits, architecture overview, key rules)
- README.md rewritten as single source of setup instructions (clone → install → verify)

### Changed
- `.claude/rules/` added to project-template with path-specific rule files (frontend, backend, database, testing, agents)
- `.clinerules/` removed from project-template FRAMEWORK.md (replaced by `.claude/rules/`)

### Removed
- `getting-started/` directory (5 files) — stale, hard to maintain during rapid iteration; README is now the setup guide
- `how-it-works/` directory (6 files) — stale; architecture is documented in README and `.agents/SYSTEM/`
- `reference/` directory (4 files) — stale legacy docs
- `SELF-IMPROVING-AGENT.md` — redundant with README

## [v0.3.1] - 2026-03-28

Widen extraction patterns, unified experience format, SQLite-first data flow.

### Added
- Hybrid conversation scanning — planning, architecture, workaround, root cause, and explicit marker patterns supplement existing decision/gotcha extraction
- `writeExperienceToDb()` — SQLite-first writer that writes to knowledge.db then generates Obsidian `.md` mirrors
- `mirrorToObsidian()` — generates YAML-frontmattered `.md` files from knowledge.db entries
- Filter logging — every SKIP logged with reason (LENGTH, DEDUP, MAX_CAP, INTRA_SESSION)
- `/end` skill updated with unified format including `SOURCE: agent` and expanded TYPE options (planning, workaround)

### Changed
- Data flow reversed: knowledge.db is source of truth, Obsidian files are read-only mirrors (was: Obsidian first, mirror to DB)
- Unified experience format: structured text for FTS5 (`[EXPERIENCE]`, `TRIGGER:`, `ACTION:`, `CONTEXT:`, `OUTCOME:`), YAML frontmatter for Obsidian
- MIN_DECISION_LENGTH and MIN_GOTCHA_LENGTH lowered from 40 to 25 chars
- Log file moved from vault root (`~/Obsidian Vault/.vault-writer.log`) to `~/Obsidian Vault/Logs/vault-writer.log`

### Removed
- `mirrorToOpenBrain()` — replaced by `writeExperienceToDb()` + `mirrorToObsidian()`
- `parseFrontmatter()` — only used by removed mirror function
- Session markdown writes to Obsidian Sessions/ (already in knowledge.db via auto-index)

### Fixed
- `recall_count`/`last_recalled` removed from SUMMARY.md claims — columns were never added to schema
- `backfillMirror()` updated to use `mirrorToObsidian` instead of deleted `mirrorToOpenBrain`

## [v0.3.0] - 2026-03-27

Knowledge retrieval redesign: recency weighting, structured experiences, quality gate.

### Added
- Recency-weighted ranking in kb_recall — recent results rank higher via time-decay on BM25 scores (chunks/summaries decay at 0.02, curated knowledge at 0.005)
- File-touch tagging — experiences include basenames of modified files as tags for file-aware retrieval
- Session quality gate — vault-writer skips sessions below substance thresholds (logs detailed skip reason)
- Structured experience format — situation/action/outcome tuples replace prose templates (YAML frontmatter with subtype, files, outcome fields)
- Recall count tracking on knowledge entries (recall_count, last_recalled columns)
- Aging session helpers — `getAgingSessions()` and `pruneChunksForSummarizedSessions()` for future summarization pipeline

### Changed
- kb_recall uses unified recency-weighted sort instead of type-based ordering
- Vault-writer no longer writes session files to Obsidian vault (FTS5 is primary store)
- `/start` uses single kb_recall retrieval path with auto-broadening (Smart Connections removed from agent retrieval)
- Experience mirror includes structured metadata (subtype, files, outcome) in FTS5 tags

### Removed
- Smart Connections from `/start` federated search (kept for personal Obsidian browsing)
- Session markdown files no longer written to Obsidian Sessions/ directory

## [v0.2.2] - 2026-03-26

Session backfill, noise filtering, and automated health checks.

### Added
- `--backfill-sessions` flag on vault-writer — processes all .db files, skips already-captured ones
- Vault-writer health check in `session-bootstrap.mjs` — warns at session start if recent sessions aren't being captured to Obsidian
- System noise filter for user prompts and gotcha detection — skips `<system-reminder>`, `<command-name>`, etc.
- Empty session detection — skips vault write when session has no meaningful content
- Windows path normalization for `isDirectRun` CLI guard

## [v0.2.1] - 2026-03-26

Bug fixes from first external tester (Alice) running v0.2.0 on a fresh machine.

### Fixed
- Removed phantom `vault-sync-projects.mjs` import that crashed vault-writer on every SessionEnd
- Fixed `SESSIONS_DB_DIR` path — was pointing to `~/.claude/knowledge-mcp/sessions/` but context-mode writes to `~/.claude/context-mode/sessions/`
- Fixed `KNOWLEDGE_DB_PATH` — was pointing to `~/.claude/knowledge-mcp/knowledge.db` but the DB lives at `~/.claude/context-mode/knowledge.db`
- Added Stage 4 safety net (`updateAgentsSessionLog`) to repo copy — was only in installed copy, missing from distributed source
- Removed dead Stage 4 (project sync) that depended on the non-existent module

### Known Issues
- `better-sqlite3` may need `npm rebuild` if compiled against a different Node version — Node v24 also causes issues with the Smart Connections Obsidian plugin, so Node v22 LTS is recommended

## [v0.2.0] - 2026-03-25

Session lifecycle improvements: unified commands, automatic bootstrap, and session handoff.

### Added
- `session-bootstrap.mjs` — SessionStart hook that auto-detects project context, reads next-session handoff, checks Obsidian backup freshness, checks pending skill proposals
- Next-session handoff — `/end` writes `.agents/SESSIONS/next-session.md` with pick-up-here notes, gotchas, and open questions; `/start` and bootstrap hook read it
- Context budget check — `/start` keeps startup injection under 5% of context window
- Stale experience pruning — monthly flagging of experiences with `retrieval-count: 0` and `last-used` > 90 days
- Per-project CLAUDE.md generation — `/start` offers to generate a project CLAUDE.md from `.agents/` state if missing
- Federated search in retrieval — Knowledge MCP (FTS5) + Smart Connections (semantic) + CC Memory in parallel

### Changed
- Merged `/recall` into `/start` (Part B) — two commands instead of three (`/start` + `/end`)
- `/start` now uses smart routing (matches `/end` pattern) — full project startup if `.agents/` exists, lightweight recall otherwise
- `/end` Part B now complements hooks instead of duplicating them — focuses on what automation misses
- Updated `SELF-IMPROVING-AGENT.md` with session lifecycle, federated search, and commands table
- Updated `how-it-works/retrieval.md` with federated search, handoff, context budget, stale pruning
- Updated `how-it-works/accumulation.md` with hooks-complementary /end, next-session handoff, Knowledge MCP mirroring
- Updated `getting-started/04-hooks-and-commands.md` with SessionStart hook setup, removed /recall references

### Removed
- `/recall` command — merged into `/start` Part B

## [v0.1.0] - 2026-03-23

First public pre-release. The system is functional and tested but the API surface may change.

### Added
- `knowledge-mcp/` — bundled Knowledge MCP server (persistent FTS5 search over sessions and stored knowledge)
- `a2a-wrapper/` — lightweight agent wrapper for multi-agent coordination via A2A Hub
- `how-it-works/multi-agent.md` — architecture docs for the A2A wrapper

### Changed
- Renamed all "Open Brain" references to "Knowledge MCP" across docs, scripts, and commands
- Templated all user-specific content — repo is now cloneable by anyone
- Getting-started guide 03 now points to bundled `knowledge-mcp/` instead of external npm package
- Replaced hardcoded project domain tags with generic examples
- Replaced personal SEED_TOPICS in `vault-utils.mjs` with minimal generic set
- Aligned all DB paths to `~/.claude/knowledge-mcp/`
- Updated package.json name to `self-improving-agent`, version reset to 0.1.0

### Fixed
- Duplicate "Obsidian vault orphan audit" entry in `.agents/TASKS/INBOX.md`
- Added INBOX reconciliation step to `/start` command to catch future drift
- Missing files in step 04 verification checklist

---

*Prior versions (v2.0–v4.0) were internal development iterations.*

## [v4.0.0] - 2026-03-22 (internal)

### Removed
- Extracted A2A Intelligent Hub (hub/, wrapper/, reference/) to standalone project at `~/Projects/A2A-Hub/`
- Hub, wrapper, Convex schema, Telegram mirror, repo fixer, and all A2A research docs now live independently

## [v3.2.0] - 2026-03-21

### Fixed
- Step 04: Added missing `vault-writer.mjs` and `vault-utils.mjs` copy commands — previously told users to find vault-writer elsewhere even though it ships in `scripts/`
- Step 04: Added missing `/start` command to the copy instructions (was shipping 4 commands but only documenting 3)
- Step 03: Fixed inconsistent Smart Connections package names (was referencing two different npm packages)
- Step 03: Removed unnecessary global npm install step for Smart Connections

### Added
- `.gitignore` — prevents `node_modules/`, `.env`, logs, and OS files from being committed
- Script purpose table in Step 04 explaining what each hook file does

## [v3.1.0] - 2026-03-21

### Added
- Task decomposition for retrieval — /start and /recall now generate 2-3 methodology-focused sub-queries instead of a single broad query (inspired by XSkill)
- Experience rewriting — retrieved experiences are rewritten to be directly actionable for the current task before presenting (inspired by XSkill)

### Changed
- Updated /start command with 4-step retrieval flow: identify context → decompose → retrieve → rewrite
- Updated /recall command with decomposition and rewriting steps

## [v3.0.0] - 2026-03-21

### Changed
- Restructured repo as Self-Improving-Agent (consolidated with AI-First Framework)
- Reorganized docs into getting-started/, how-it-works/, reference/
- Moved AI-First Framework into project-template/
- Updated SELF-IMPROVING-AGENT.md links to new doc locations

### Added
- Beginner-friendly getting started guides (5 docs)
- Architecture documentation in how-it-works/ (5 docs)
- vault-writer.mjs and vault-skill-scan.mjs SessionEnd hooks
- vault-utils.mjs shared utilities
- /start global slash command
- project-template/ with complete .agents/ scaffold
- reference/advanced-config.md

## [v2.2.0] - 2026-03-21

### Added
- `getting-started/01-prerequisites.md` — install guide for all required tools
- `getting-started/02-clone-and-configure.md` — repo cloning and Obsidian vault setup
- `getting-started/03-mcp-servers.md` — Knowledge MCP and Smart Connections MCP installation
- `getting-started/04-hooks-and-commands.md` — SessionEnd hooks and slash command setup
- `getting-started/05-verify-installation.md` — guided first-session walkthrough

### Removed
- `getting-started/.gitkeep` — replaced by actual guide files

## [v2.1.0] - 2026-03-20

### Added
- `skill-scan.mjs` — SessionEnd hook that auto-detects experience clusters and proposes skills
- `/skill-scan` slash command for manual cluster scanning
- `/recall` slash command for global knowledge retrieval (renamed from `/start` to avoid project-level conflicts)
- `setup.md` — step-by-step installation guide
- `README.md` — project overview with architecture diagram
- `scripts/` directory with hook scripts
- `commands/` directory with slash commands
- Compound feedback loop: experiences accumulate → skill-scan detects patterns → proposals surface at next session start

### Changed
- Updated `SELF-IMPROVING-AGENT.md` with feedback loop documentation
- Updated `gaps.md` — skill distillation gap now fully automated

## [v2.0.0] - 2026-03-18

### Added
- Initial commit: learning system documentation
- `SELF-IMPROVING-AGENT.md` — protocol quick reference
- `current-protocols.md` — detailed retrieval and accumulation protocols
- `gaps.md` — known gaps and improvement backlog
- Obsidian-based architecture (migrated from SQLite-only approach)
