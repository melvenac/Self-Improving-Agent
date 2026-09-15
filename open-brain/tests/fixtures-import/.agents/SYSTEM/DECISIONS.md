# Architectural Decision Records

## How to Use

Log significant technical decisions here using the ADR format. Each decision gets a numbered entry with context, alternatives considered, and consequences.

---

## Decisions

### ADR-001: Obsidian Vault as primary knowledge store

- **Date:** 2026-03
- **Status:** Accepted
- **Context:** Needed persistent, searchable, human-readable knowledge storage that works across projects.
- **Decision:** Use plain markdown files in an Obsidian Vault with YAML frontmatter for metadata.
- **Alternatives:** SQLite-only via Open Brain (fast but opaque), custom database (overkill), JSON files (poor readability).
- **Consequences:** Portable, version-controllable, browseable in Obsidian UI. Requires file I/O for programmatic access. Semantic search via Smart Connections MCP.

### ADR-002: Automatic accumulation via SessionEnd hook

- **Date:** 2026-03
- **Status:** Accepted
- **Context:** Manual `/end` was frequently forgotten, causing session knowledge to be lost.
- **Decision:** vault-writer.mjs fires automatically at SessionEnd to capture sessions and extract experiences.
- **Alternatives:** Keep manual-only (unreliable), cron job (wrong granularity), background daemon (overkill).
- **Consequences:** Zero-effort capture for every session. `/end` remains available for optional manual review pass.

### ADR-003: Human approval gate for skill creation

- **Date:** 2026-03
- **Status:** Accepted
- **Context:** Auto-creating skills from experience clusters could introduce noise and degrade retrieval quality.
- **Decision:** Never auto-create skills. skill-scan.mjs proposes candidates; Aaron must explicitly approve.
- **Alternatives:** Auto-create with confidence threshold (risky), auto-create and prune later (messy).
- **Consequences:** Higher quality skills, slower skill growth. Acceptable tradeoff for solo developer workflow.

### ADR-004: Extract A2A Hub to standalone project

- **Date:** 2026-03-22
- **Status:** Accepted
- **Context:** A2A Intelligent Hub grew beyond the scope of this repo into its own product.
- **Decision:** Moved hub/, wrapper/, and A2A-specific reference/ files to `~/Projects/A2A-Hub/`.
- **Alternatives:** Keep as subdirectory (clutters repo), git submodule (adds complexity).
- **Consequences:** Clean separation. Both repos audited — 38 files in A2A-Hub, 60 in Self-Improving-Agent, no duplicates or orphans.

### ADR-005: Database architecture redesign — keep 3 stores with write authority

- **Date:** 2026-03-23
- **Status:** Accepted (evaluation through 2026-03-30)
- **Context:** Three overlapping knowledge stores exist — Claude Code memory, Open Brain SQLite (FTS5), and Obsidian Vault (markdown). No clear authority defined for which store is canonical for what data.
- **Decision:** Keep all 3 stores. Define write authority per data type. Mirror A (Obsidian → Open Brain) for search coverage. Federated search across all 3 at /recall.
- **Alternatives:** Consolidate to one store (loses strengths of each), primary-with-cache (adds complexity).
- **Consequences:** Each data type has one canonical store. Mirrors exist for search coverage. CC Memory holds bootstrap data, Obsidian holds experiences/skills, Open Brain holds sessions/ephemeral data.

### ADR-006: Unified /end with .agents/ detection

- **Date:** 2026-03-23
- **Status:** Accepted
- **Context:** Global /end (knowledge capture to Open Brain) and project /end (update .agents/ files) were separate commands. Users had to remember which to use.
- **Decision:** Single /end at `~/.claude/commands/end.md` that checks for `.agents/` in cwd. If found, runs full project close-out + knowledge capture. Otherwise, runs lightweight capture only.
- **Alternatives:** Separate `/end` and `/endproject` commands (more to remember), SessionEnd hook only (loses reflective capture).
- **Consequences:** One command to remember. Project close-out is never skipped by accident. vault-writer Stage 5 provides additional safety net for mechanical updates.

### ADR-008: Bundle knowledge-mcp and a2a-wrapper in repo

- **Date:** 2026-03-23
- **Status:** Accepted
- **Context:** Repo depended on external npm packages (open-brain-knowledge) and a separate project (A2A-Hub wrapper). New users couldn't get a working system from a single clone.
- **Decision:** Copy knowledge-mcp TypeScript source and a2a-wrapper source into the repo. Users build locally.
- **Alternatives:** npm package references (requires publishing/maintaining), git submodules (adds complexity), monorepo tooling (overkill for 2 small packages).
- **Consequences:** Single clone gives everything needed. Users must run `npm install && npm run build` in each subdirectory. Source is duplicated from origin repos.

### ADR-009: Use .agents/docs/ for internal design artifacts

- **Date:** 2026-03-23
- **Status:** Accepted
- **Context:** Design specs and planning docs in docs/superpowers/ and reference/planning/ contained personal references (names, paths). Templating them would be tedious and they're not user-facing.
- **Decision:** Move internal artifacts to .agents/docs/ which is gitignored. They stay on Aaron's machine but don't ship in distribution.
- **Alternatives:** Template all personal refs (tedious, error-prone), delete them (loses development history), separate branch (complex).
- **Consequences:** Clean distribution. Internal docs preserved locally. New contributors won't see design rationale unless it's captured in ADRs or architecture docs.

### ADR-007: Vault-writer Stage 5 safety net (removed in v0.5.1)

- **Date:** 2026-03-23
- **Status:** Superseded (removed v0.5.1)
- **Context:** /end relies on manual discipline — if skipped, .agents/ session logs stay blank. Needed automation for mechanical updates.
- **Decision (original):** Add Stage 5 to vault-writer.mjs that auto-fills .agents/ session logs with mechanical data (what was done, files changed, decisions, gotchas).
- **Removal rationale (v0.5.1):** Stage 5 was removed because /end is now consistently used and the safety net added complexity without measurable value. The consolidated `session-end.mjs` pipeline makes the safety net redundant.
- **Consequences:** Simpler pipeline. /end remains the authoritative close-out mechanism.

### ADR-011: Retire knowledge-mcp, unify all kb_* tools into open-brain

- **Date:** 2026-04-16
- **Status:** Accepted
- **Context:** E2E testing revealed a structural bug: kb_recall reads from v1's `knowledge` table (knowledge.db) but auto-feedback writes to v2's `knowledge_index` table (knowledge-v2.db). Same IDs map to different entries across DBs — auto-feedback silently rates wrong entries, poisoning the maturity lifecycle.
- **Decision:** Retire knowledge-mcp entirely. Absorb 8 active kb_* tools (recall, store, feedback, forget, list, stats, set_session, recalled) into open-brain's MCP server. Drop 7 unused tools (store_chunk, store_summary, forget_chunk, index, reindex, consolidate, prune, summarize, recall_report). One server (`open-brain`), one database (`knowledge-v2.db`), one codebase (`open-brain/`).
- **Alternatives:** (A) Redirect knowledge-mcp queries to v2 DB (implemented first, then superseded — cements v1 as dependency). (B) Unified database in knowledge.db (would require migrating v2 schema into v1). (C) ID mapping layer (fragile, adds complexity).
- **Consequences:** No more ID collisions. Feedback loop can finally work. knowledge-mcp code is archived but no longer runs. knowledge.db retains sessions/chunks/summaries for historical queries. v2 schema expanded with content, project_dir, source, success_rate, archived_into columns. FTS rebuilt as content-backed for snippet() support.

### ADR-010: Pipeline simplification — remove chunks, remove auto-extraction, add auto-feedback

- **Date:** 2026-03-30
- **Status:** Accepted
- **Context:** Chunk indexing (auto-index.mjs) produced zero retrieval value — chunks were never recalled in practice. Auto-extraction of experiences added noise. Vault-mirroring to Knowledge MCP was redundant. Manual kb_feedback collection at /end was a friction point.
- **Decision:** Remove auto-index.mjs (chunks), remove auto-extraction, remove vault-mirroring. Rename vault-skill-scan.mjs → skill-scan.mjs. Add auto-feedback in session-end.mjs that rates recalled entries helpful/neutral via summary domain-concept overlap. Consolidated pipeline: vault-writer.mjs → session-end.mjs → skill-scan.mjs.
- **Alternatives:** Keep chunks but improve indexing quality (more work, unclear value), keep manual feedback (friction, often skipped).
- **Consequences:** Simpler 3-hook pipeline. Automatic feedback loop without user friction. Experiences and knowledge entries only written deliberately during /end. 104 knowledge entries, 36 summaries, 0 chunks.

### ADR-012: Keep open-brain as MCP, defer CLI port to v0.8+ for portability only

- **Date:** 2026-05-08
- **Status:** Accepted
- **Context:** Researched the "CLIs > MCPs for agents" thesis (Matthew VanHorn, YouTube `YHk45NEpspE`, kb id 232). Claim: MCP uses 35× more tokens than CLI on equivalent tasks; reliability drops 100% → 72% as tasks get harder. Measured actual token cost in this Claude Code setup via `/context`: open-brain's 13 tools total ~2.9k tokens of schemas, but Claude Code's `ToolSearch` deferred loading means only currently-invoked tool schemas land in context (~2.1k loaded vs 14.8k deferred this session). The video's "MCP wastes tokens every session" critique is largely mitigated by deferred loading in this harness.
- **Decision:** Keep all four custom MCPs (open-brain, gitnexus, context-mode, smart-connections) on MCP for v0.7.x. Do not pursue CLI conversion for token-savings reasons. If/when CLI conversion happens (v0.8+), the only justification is **portability** — making open-brain reachable from harnesses that don't have ToolSearch (Claude Desktop, Codex, Cursor, raw API agents).
- **Alternatives:** (A) Full MCP→CLI port now (rejected — token win is small in this harness; would lose stateful coordination of `ob_set_session` across calls; spawn cost ~150-300ms per invocation). (B) Hybrid: read tools as CLI, lifecycle tools as MCP (deferred to v0.8 if/when portability is the goal). (C) Adopt cli-printing-press generator (rejected — it's an OpenAPI-spec-driven generator for third-party SaaS APIs, not a tool for converting custom MCPs).
- **Consequences:** No churn cost in v0.7.x; protocol architecture stays as-is. context-mode specifically must stay MCP — it's the layer that keeps large outputs *out* of context, the opposite of what a raw CLI would do. If makerspace agents ever need third-party SaaS API reach (Stripe, Notion, Linear, etc.), revisit cli-printing-press for those — not for in-house tools.

### ADR-013: Ranking policy is generated from one config; delete unreachable implementations

- **Date:** 2026-07-28
- **Status:** Accepted
- **Context:** Session 41's audit found `ob_recall` ranking close to the inverse of its design intent. `weighted_rank` multiplied `bm25()` (negative; more-negative = better) by a factor that grew with age, so entries gained ~0.5% ranking advantage per day — "recency-weighted BM25" was anti-recency weighted since v0.3.0. Separately, `maturityBoost()` was called into a variable that was never read and the `ORDER BY` never referenced maturity, so the 1.5x/1.2x boosts had never applied to a real recall. A third implementation — `src/pipelines/recall/` with `mergeAndRank()`, the semantic/keyword hybrid and the failure boost — was never imported by anything, yet had passing tests and appeared in the architecture map as a cohesion-1.0 cluster.
- **Decision:** One ranking policy, expressed once. `LIFECYCLE_CONFIG` holds the constants (mature 1.5, proven 1.2, low-success penalty 0.5, failure 1.3, recency decay 0.005/day); `recallRankExpr()` generates the SQL from them and `maturityBoost()` reads the same constants, with a test asserting the two agree. Delete `src/pipelines/recall/` and its tests rather than wiring it in — it was unproven, carried three ranking flaws (flat 1.0 for semantic hits discarding their own ordering, worst-FTS always normalising to 0, pooled multi-query BM25), and would have meant maintaining two ranking systems. Port the failure boost into the live expression, using exact tag-token matching so `failures` and `no-failure` do not qualify.
- **Alternatives:** (A) Wire in `pipelines/recall/` for the semantic hybrid — rejected: fixing its flaws plus reconciling it with the SQL ranking is more work than the hybrid is currently worth, and the hybrid was never live anyway. (B) Leave it deprecated in place — rejected: dead code with green tests reads as working code.
- **Consequences:** Ranking is verifiable and drift-resistant. Measured on the live 315-entry DB: top-5 average age 123d → 44d; a mature entry that ranked 6th now ranks 1st. The documented semantic/keyword hybrid, RRF, and cosine diversity filter remain **absent** — now stated explicitly in PRD.md under "Not currently implemented" rather than implied to exist.

### ADR-014: Precision first, recall second — AND-then-OR query broadening

- **Date:** 2026-07-28
- **Status:** Accepted
- **Context:** After the ranking fix, `/start` reported 3 of 4 knowledge queries returning zero results. The ranking change was ruled out by comparing old and new rank expressions — identical row counts on every query, scoped and unscoped; ranking only reorders. The real cause was pre-existing: FTS5 joins bare terms with AND, so `"knowledge maturity feedback loop"` required all four terms in one entry and matched nothing, while the OR form matched 86 entries. `/start` explicitly instructs agents to use "methodology-focused" queries — precisely the multi-word shape that failed. Empty recalls plausibly explain the protocol's weakest metric: 52 of 315 entries rated, 15 ever promoted. Nothing recalled means nothing rated, means nothing matures.
- **Decision:** Keep the precise (AND) query as the primary. When it returns fewer than `limit` rows, retry with the same terms OR-joined and use those rows only to fill remaining slots, deduplicated by id, with precise hits keeping their positions and a note marking that some results matched only part of the query.
- **Alternatives:** (A) Always OR — rejected: discards precision when the exact query works, and floods short queries with weak matches. (B) Phrase/proximity search — more precise but still misses the paraphrase case the protocol encourages. (C) Leave as-is and reword the `/start` prompt to demand single-word queries — rejected as a prompt-level patch to a deterministic problem, contrary to the deterministic-first rule.
- **Consequences:** Strictly additive — the fallback can only fill empty slots, never displace or remove an exact match. Live DB: `deterministic verification` 0 → 5, `knowledge maturity feedback loop` 0 → 5, `test coverage strategy` 0 → 5, `session` unchanged at 5. Some tail noise is accepted as the cost of recall; it is bounded by firing only on underfill and by ranking precise hits first. The 16.5% rating rate should be re-measured before drawing conclusions about knowledge quality.

### ADR-015: Shadow recall measures ranking against session-local labels, never all-time feedback

- **Date:** 2026-07-28
- **Status:** Accepted
- **Context:** ADR-013 and ADR-014 changed recall ranking three times in one session, each verified by eyeballing top-5 results on a handful of queries — the weakest evidence used all session. Every ranking constant (recency decay 0.005/day, mature 1.5, proven 1.2, failure 1.3, low-success penalty 0.5) remains an unvalidated guess. The v1 pipeline had an offline A/B harness for exactly this ("shadow recall", Stage 3 of the retired `session-end.mjs`) which died in the v1→v2 port because it depended on sqlite-vec and the renamed `helpful_count` column. Its 3 score points stayed wired in `scorer.ts` and capped Pipeline Health at 7/10 for four months.
- **Decision:** Revive the harness, but re-aim it and audit its metric before its code. Three commitments: (1) strategies are config overrides of `recallRankExpr()`, never separate ranking implementations — the v1 harness carried its own RRF/vector code, which is why it measured a path production did not use and died with it; (2) relevance labels are scoped to the session being replayed, recorded in new `recall_log` / `feedback_log` tables; (3) no verdict below 10 evaluated sessions, and a winning variant is reported as a candidate for Aaron, never auto-adopted.
- **Alternatives:** (A) Port the v1 `helpful_count` metric as-is — **rejected, and this is the load-bearing decision.** It scores a strategy by how many of its results already carry positive feedback. Ratings accrue to entries that have been recalled before, so it structurally rewards resurfacing old, frequently-recalled knowledge, and would likely have scored the age-inverted ranking bug of ADR-013 as better than the fix. A bad metric is worse than no metric because it produces confident wrong answers. (B) Replay historical sessions instead of collecting forward — **not possible**: `knowledge_index` carries only aggregate counters with no timestamps and no record of which session assigned each rating, so there is nothing to reconstruct. This forced the decision to log ground truth going forward. (C) Retire shadow recall entirely and keep hand-verifying — rejected: that is the status quo that produced three unvalidated ranking changes.
- **Consequences:** Evaluation starts from zero data; at the current cadence a 10-session sample is months away, and the Pipeline Health shadow component is on a ramp (1 session → 1pt, 5 → 2, 10 → 3) so it reports partial progress instead of capping the category as the all-or-nothing v1 version did. Presentation bias is accepted and documented as **asymmetric in the incumbent's favour** — labels exist only for entries `live` displayed, so `live` starts with more of its results labeled (measured 7/15 vs 4–6/15 on the live DB). A variant beating `live` is strong evidence; a variant tying or losing is weak evidence and does not establish that `live` is optimal. The harness cannot discover relevance that was never presented, and is not claimed to.

### ADR-016: Session identity travels by file, is scoped per IDE, and is detected from the payload

- **Date:** 2026-07-28
- **Status:** Accepted
- **Context:** v0.8.0 shipped Cursor support that had never once been executed. Verifying it — a Claude Code session and a Cursor session on the same repo simultaneously — found Cursor sessions recorded no provenance at all, so `recall_log`/`feedback_log` stayed empty and shadow recall had nothing to evaluate. The design assumed two Claude Code behaviours: that the hook payload carries `session_id`, and that the hook's stdout reaches agent context (the UUID travelled hook → context → `/start` → `ob_set_session`). Cursor does not inject SessionStart stdout at all. `discoverSessionUuid` was Claude-only besides, scanning `~/.claude/projects/`.
- **Decision:** Three changes, each removing an assumption. (1) **File handoff** — the hook writes the UUID to `~/.claude/open-brain/active-session.json` and the server reads it, so nothing has to survive a trip through an agent's context; prompt-level relaying remains the fast path where the IDE supports it. (2) **Per-IDE slot keys** (`<project>::<ide>`) — keying by project alone let a Claude Code *resume* rewrite the shared slot, after which Cursor read back the Claude session's UUID and filed six recalls under it, silently. (3) **Host detected from the payload's `cursor_version`**, not from how the hook was registered, because Cursor also executes Claude Code's `~/.claude/settings.json` hooks and that copy carries no `--ide` flag — registration alone would let a Cursor session label itself `claude` and overwrite a real Claude Code slot. Workspace comes from the payload's `workspace_roots`, since Cursor invokes hooks with cwd set to its config dir.
- **Alternatives:** (A) Map the payload field name only (`conversation_id`) — rejected once observed: Cursor sends `session_id` too, and the field was never the real problem. That inference came from a *constructed* payload and cost two verification cycles; the fix is now grounded in a captured one, recorded as a test fixture. (B) Have the MCP server self-register a slot on first use — rejected: a server process outliving a chat would merge several conversations into one uuid and recreate the misattribution just removed. Deliberately left unbuilt rather than adopted blind. (C) Ship Claude-Code-only and document Cursor as unsupported — held as the fallback throughout; unnecessary once the shell cause was found.
- **Consequences:** Provenance works in both IDEs and any future one that supplies a session id, with a generated UUID when none is offered — the system needs a stable per-session key, not the IDE's own identifier. **Operational constraint: Cursor hooks require PowerShell as the shell on Windows.** Cursor wraps hook commands in PowerShell syntax; with bash configured the wrapper dies on `&` before reaching node and SessionStart fails silently, because nothing surfaces hook stderr. That single mechanism explained every symptom — global and project-level configs both correct yet never firing, while the binary worked when invoked by hand. **Remaining limitation:** two windows of the same IDE on the same project still share a slot; explicit `session_id` always wins over the file, so any agent that can see its own UUID is unaffected. Verified end to end by a second agent: first real shadow-recall evaluated session produced from Cursor.

### ADR-017: Every stored fact is state or event; record the kind before acting on it

- **Date:** 2026-08-07
- **Status:** Accepted
- **Context:** `knowledge_index` can only append. That is correct for a lesson learned and ruinous for a current value: when a path, version or port changes, the new entry lands beside the old one, both stay live, and `ob_recall` may return either with nothing marking which is current. The distinction came from `coleam00/skills` via a YouTube walkthrough — every fact is a **state** (one current value that changes; wants *replacing*) or an **event** (a timestamped thing that happened; wants *appending*), and the update rules are opposites. Two findings sharpened it. The framework already draws this line one layer up — `SUMMARY.md ## Current State` is state, `SESSIONS/` and `DECISIONS.md` are append-only logs — while the knowledge-entry layer never had the axis. And **all five `type` values documented in `ENTITIES.md` (gotcha, pattern, decision, fix, optimization) are events**, so the experience format has no way to express a state fact at all; state facts get written as experiences and are then never replaced.
- **Decision:** Add `knowledge_index.fact_kind` and a `kind` param on `ob_store`, and **record the label without acting on it**. Storing still appends either way. The distinction is used immediately for *detection* — it defines `findSuperseded`'s general case (two live `state` entries, same subject, different content), which the audit's narration matcher could not reach because that only fires when someone wrote "this replaces X". NULL means **unclassified**, not `event`.
- **Alternatives:** (A) Replace-on-write immediately — this is the structural fix and the tier-2 move the deterministic-first rule prefers, and it was still rejected for now: the classifier is ~50–60% precise on the state side, and replacing on a wrong label archives history that cannot be recovered. A missing state update is recoverable; a rewritten history is not. (B) Backfill all 341 rows with an inferred kind — rejected as the exact failure the feature exists to prevent: a confident number that would differ tomorrow. Unclassified is a real answer. (C) Overload the existing vault `type` field — rejected because state/event is orthogonal to gotcha/pattern/decision, and because `type` is already three-way inconsistent between `ENTITIES.md`, `vault-writer.ts` and the live vault; folding the fix in would have buried a real inconsistency inside a feature. (D) Install the source's `second-brain-audit` skill — rejected: it is a prompt-level version of `dream` and weaker, its script comparing only monetary values. The taxonomy transplanted; the audit did not.
- **Consequences:** Detection improves now, prevention waits. `effectiveKind` prefers a recorded label over an inferred one, so the heuristic decays in importance as real labels accumulate — which makes "start passing `kind`" the cheapest way to unblock replace-on-write. **The measurement that mattered was not the unit tests.** Scoring the experience template (`TRIGGER:`/`OUTCOME:`) as high-confidence structural evidence produced "86% of this corpus is events" until the live run showed it matching 287 of 341 entries; it only ever supported "86% uses the template". Demoting it below word choice moved the census from 8/294 to 41/261/39. **A tier earns its rank by how much it discriminates, not by how structural it looks** — a signal firing on 84% of a corpus separates nothing. Also accepted: the state-pair path found zero on the live corpus and that is a real zero (highest subject overlap across 820 state pairs is 0.29 against a 0.50 threshold), so it ships proven by unit tests and unexercised in production.

### ADR-018: The index is a projection of the vault, and a check enforces it

- **Date:** 2026-08-08
- **Status:** Accepted
- **Context:** `ob_store_chunk` is documented "vault-first: the file is the source of truth, the DB indexes it," and nothing enforced that in either direction. An audit of all 13 MCP tools found the two had diverged from **three unrelated producers**: the v1→v2 migration wrote notes without indexing them, a test suite wrote into the real vault, and deleting an entry removed the row while leaving the markdown. The damage was not a missing row. `skill-scan` reads `Experiences/` recursively, so **60 duplicate notes** — the same note filed under both `Experiences/General/` and `Experiences/<Project>/`, one copy indexed — were counted twice, inflating the cluster sizes that gate skill proposals. Three of five pending proposals rested on double-counted evidence; `revenue` sat above the 3-file threshold only because of it. None of this was visible: two rounds of reading the vault by hand produced a wrong count (9) with a wrong cause (deletion), because basename matching cannot see a duplicate by construction.
- **Decision:** Build the detector **before** repairing any instance, then close both seams so the index becomes a genuine projection. (1) `checkVaultIndexParity` classifies divergence into duplicates / unindexed / dangling and reports as a **warning**, not an issue — it is data state needing per-note triage, cannot be auto-fixed, and should not block an unrelated commit. (2) Deletion (`ob_forget`, apoptosis auto-prune) **moves** the note to `Archive/` rather than unlinking. (3) `ob_store` **adopts** an unindexed existing note rather than refusing it, indexing the file's content.
- **Alternatives:** (A) Repair the 60 duplicates and move on — rejected: three producers means a fourth is likely, and the same class had already recurred four times this session across commands, `setup.mjs`, and two documents. (B) Teach `skill-scan` to skip unindexed notes — **rejected, and the evidence killed it**: 7 of the 9 unindexed notes were real knowledge (rspamd gotchas, BM25 scoring, stem-agent research) that needed *indexing*. Skipping would have buried it permanently and silently, treating the symptom while destroying the signal. (C) Delete the note on `ob_forget`/apoptosis — rejected because apoptosis fires **automatically with no human in the loop**, and irreversibly destroying a readable note under those conditions is the wrong default. (D) Record the archive in `knowledge_index.archived_into` — rejected after checking: it is an INTEGER referencing another entry's id and `WHERE archived_into IS NULL` already filters archived rows out of stats, listing and recall. Repurposing it would have corrupted those filters, and deletion removes the row anyway, so nothing needs marking.
- **Consequences:** Divergence is now visible in every `sync` run instead of accumulating unseen, and both directions have a supported path — `Archive/` sits outside the scanned directories, so `skill-scan` cannot count an archived note *without any code having to remember to skip it*, which is structural rather than a rule to honour. Live state repaired: 60 duplicates removed (bodies byte-identical; only `project:` and `source:` differed), 9 notes indexed, 1 test artifact deleted, `sync` 15 passed / 0 warnings. **The methodological finding is the durable one: a mechanical check beat careful reading four times in one session**, including twice on this exact data. Where the work reasoned instead of checking — the basename match, `archived_into`, `ob_store`'s "silent" refusal, apoptosis's "silent" prune — it was wrong every time. Two corollaries worth carrying: a guard whose output is identical whether the thing it guards is correct or entirely absent will never be noticed (the skill-index parser matched nothing for months); and unit tests passing is not evidence a feature works — `archiveVaultNote` was covered 6/6 while the apoptosis branch archived nothing, because it read a column its query never selected. Only the end-to-end pass over the real MCP server caught it.

### ADR: `.agents/skills/` is a shared contract surface, not project state

- **Date:** 2026-08-12
- **Status:** Accepted (agreed with Prime; recorded in `~/.agents/mailbox/channels/sia/decisions.md`)
- **Context:** Prime Intellect's Continual Harness ("Prime") began running in this repo alongside open-brain and loads `<repo>/.agents/skills/*/SKILL.md` at boot as auto-triggerable skills. `.agents/` had been declared wholly-owned project state — session logs, INBOX, handoffs. `skills/` is categorically different: it is the only path in the tree where **our** files directly configure **another agent's prompt**, and neither system had declared who owned it. The cost of leaving it undeclared was already paid: `self-improving-agent-guide/SKILL.md` had **no YAML frontmatter at all**, and since `description` is the only field Prime's router matches on, a 192-line architecture document had never once loaded. Two more directories had a frontmatter `name` disagreeing with their directory. Worse, each skill turned out to have **three** identity sources — directory name, frontmatter `name`, and the `.agents/skills/INDEX.md` row — which disagreed: INDEX.md registered two skills while Prime's loader found three directories and loaded two *different* ones. Every reader was correct about its own file; nothing checked they described the same set.
- **Decision:** Declare `.agents/skills/` a **shared contract surface**. Forge (and Aaron) own writes; Prime owns reads; **the loader's requirements are the contract** — frontmatter present, `name` matching the directory, `description` non-empty. Enforcement goes in `/sync`, which asserts all three identity sources describe the same set and **fails the commit**. If open-brain ever auto-promotes a skill candidate into that directory it is writing to Prime's prompt, and that write must satisfy the contract or fail loudly.
- **Alternatives:** (A) A frontmatter validator, which is what Prime originally asked for — **rejected by both agents**: it would have caught two of the three defects and been structurally blind to the INDEX.md divergence, because frontmatter validity and set agreement are different properties. (B) Put the check in the SessionEnd hook — rejected per the deterministic-first rule: the hook runs unattended *after* the fact, while `/sync` is the mandatory pre-commit gate. Fail the commit, don't warn the transcript. (C) Fix the emitter instead — **rejected on evidence**: a grep of every non-markdown file found nothing in the repo writes that path, so the files are hand-written and there is no emitter to fix. (D) Keep `.agents/skills/` as Forge-owned project state and let Prime cope — rejected as the status quo that produced the defect; an undeclared boundary that both parties cross is not ownership.
- **Consequences:** Directory repaired and verified rather than assumed — `gotchas/` renamed to `self-improving-agent-gotchas/` (INDEX.md's *Skill* column was already on the long name, so only the *Directory* cell needed editing), frontmatter added to the guide, and both remaining skills confirmed agreeing across all three sources. `seo-optimizer-test/` moved out of the loader path to `.agents/archive/`. **The `/sync` validator itself is not yet built** — it is P1, and until it lands the contract is a convention, which is exactly the failure mode this ADR exists to remove. Durable finding: **local validity does not compose** — the defect lived in the *relationship* between three internally-consistent sources, and nothing owned the relationship. Knowledge entry **375**.

### ADR-019: A session slot that cannot prove it is current warns, but still answers

- **Date:** 2026-08-13
- **Status:** Accepted (agreed with Probe)
- **Context:** `ob_set_session` read the hook-written slot and returned its UUID with no freshness check. A Cursor seat in this repo was handed `7ad51ea2-…` from **2026-07-28** — sixteen days stale — formatted `[via hook file (session_id, ide cursor)]`, byte-identical to a healthy read. Every chunk, rating and recall from that seat was filed under Session 44's identity. `stale|TTL|maxAge|expire` returned zero hits across `active-session.ts`: no freshness concept existed. This is not Cursor-specific — once the guard was live it immediately flagged `a2a-hub::claude` at 6d18h. Cursor is merely where a dead SessionStart hook stopped refreshing the slot long enough to notice.
- **Decision:** `isStaleSession` (threshold `STALE_SESSION_MS` = 12h) gates the hook-file path. A stale read still **returns the id** and appends the age, the `started_at`, and the fact that SessionStart has not run for that ide. An **unparseable timestamp counts as stale** — a slot that cannot prove it is current is not trusted by default.
- **Alternatives:** (A) Hard-error on a stale slot — **rejected on Probe's argument**, which was better than the one it replaced: the seat that hits this is by construction one whose hook host is already broken, so erroring takes the seat down at its worst moment, and a loud id is more useful than no id. Correctness was the wrong axis; recoverability was the right one. (B) Silently regenerate a fresh UUID — rejected, it discards the only link to whatever the hook did record and makes the failure invisible again. (C) Treat an unreadable timestamp as fresh — rejected as the same class of defect the ADR exists to remove.
- **Consequences:** 12h is deliberately loose: longer than any working session, far shorter than the sixteen days that went unnoticed. The warning is on the **hook-file path only** — an explicitly-passed `session_id` is unaffected, so any agent that can see its own UUID never encounters it. Verified against the live tool on a real 6d18h slot, and against the real slot file where it flags exactly one of four with no false positives.

### ADR-020: Agent provenance joins through `sessions`; it is never copied onto records

- **Date:** 2026-08-13
- **Status:** Proposed (spec written, not implemented — `.agents/SYSTEM/specs/agent-provenance.md`, chunk #401)
- **Context:** A knowledge entry cannot say what wrote it. The maturity lifecycle rates entries, apoptosis prunes them, and shadow recall scores ranking strategies across a corpus produced by at least two harnesses and an unknown number of models — with no way to observe that variable, let alone control for it. Both harnesses send `model` in the SessionStart payload (Claude Code: 6 keys; Cursor: 10) and v0.16.0 began capturing it, but only into `active-session.json`. `sessions` has no provenance columns and `knowledge_index` has **no `session_id` at all**, while `chunks` already references `sessions(id)`.
- **Decision:** `sessions` gains `ide` / `model` / `cli_version`. `knowledge_index` gains an immutable `authored_in_session_id` FK — and **not** a copy of `model`. Provenance is reached by join.
- **Alternatives:** (A) Denormalize `model` onto every knowledge row — **rejected**: it creates one fact with two representations and nothing checking they agree, which is the defect class this repo has now hit at seven sites (ADR-018, #375, and four silent-no-ops found this same session). (B) Make `authored_in_session_id` mutable so it tracks the last writer — rejected: counters like `helpful` and `recall_count` move constantly and must not drag authorship with them; when replace-on-write lands, a replacement is a new authorship event to be decided then. (C) Backfill the 371 existing entries — rejected: the authoring session is genuinely unknown and a guess is worse than a NULL. **NULL means "written before this feature."**
- **Consequences:** `cli_version` is Cursor-only — Claude Code sends no version field — so it must be nullable and the Claude NULL is asserted as an expectation rather than left as an unnoticed gap. `user_email` arrives in the same payload and stays unread; the slot is a diagnostic record, not an identity store. **This ships a channel with no signal in it**: 14 session rows exist and every knowledge entry predates the column, so the first useful comparison is dozens of sessions out. Stated explicitly because this repo has twice mistaken an empty channel for a healthy one (v0.14.1, v0.15.0) — the success criterion is written in advance as "the model group-by query returns more than one row." **Prerequisite:** `payload_keys` stores names, not values, so no one has ever seen what `model` literally contains; log one real value per harness before writing the schema.

### ADR-021: A treatment column's default is 'unspecified', never a real treatment value

**Session 52 (v0.19.0, v0.20.0).** When a column records how something happened
(`recall_trigger`, `rating_origin`), a caller that says nothing gets `'unspecified'` —
a countable labeling gap — never a real value like `'explicit'`, which would fabricate a
treatment and contaminate the exact contrast the column exists to create. NULL stays
reserved for pre-column rows (a different unknowable). Unrecognized values coerce to
`'unspecified'`: not dropped (the row must stay interpretable), not passed through (free
text erodes the vocabulary). Every such census is surfaced in `ob_stats` unconditionally,
including at zero.

### ADR-022: Rejection must be representable — the ledger pattern

**Session 52 (v0.17.0).** A declined proposal that leaves no trace is re-proposed forever;
no parser correctness can fix an unrepresentable decision. `.skill-proposals-ledger.json`
records `{decision, date, atCount, reason}` per tag; the scan suppresses rejected clusters
deterministically until they outgrow `atCount` (new evidence earns a fresh review; omit
`atCount` for unconditional rejection). The reviewing agent writes one entry once;
enforcement is code. Derived from WikiSkill's skill-impact.md (arXiv 2608.27454, entry 456)
and the 08-11 "idea 3" thread — record what was considered and rejected, not only what was
kept.

### ADR-023: A structural fix ships with its own instrumentation, in the same release

**Session 52 (v0.21.0), generalizing v0.15.1's lesson.** Structural prevention makes a
failure impossible and simultaneously invisible; this repo paid twice for shipping the fix
without the counter. Reconnect self-registration shipped WITH an unconditional
self-registration count in `ob_stats`; the schema stamp (v0.22.0) shipped WITH skew
surfacing in three places. The rule: when a change makes a bad path unreachable, the same
release must make "how often the bad path was attempted" a number someone can read.

### ADR-024: Per-session MCP servers require per-writer schema stamps

**Session 52 (v0.22.0).** MCP stdio servers are per-session subprocesses over one shared
SQLite file, each picking up new code only at its own session's reconnect — so concurrent
writers on different builds are architecturally normal, and were undetectable (row-proven:
a v0.18.0 server's default contaminated a column a v0.19.x server had moved past).
`SCHEMA_VERSION` derives from the migration list (additive bumps are automatic;
meaning-changing rebuilds bump `SCHEMA_REBUILDS` explicitly), `openV2Database` stamps
`user_version` forward-only, and a stale writer warns-and-keeps-working (the ADR-019
trade) rather than refusing. Corollary, recorded for operators: reconnect every live
session after a rebuild, not just one.

### ADR-025: Project state is a record; the prose files are generated views; loops ship on branches behind a bare-runner gate

**Session 54 (v0.28.0 → v0.30.0, v0.29.1).** Measured on this repo, a `/start` read 24,886
words (~42.7K tokens) of prose state, 93% of it a SUMMARY status blockquote and an INBOX
that only ever grew — logs wearing the name of state. Decision (Aaron, Q4 = files/JSON):
`.agents/state.json` is the record — strict schema, `revision` for read-modify-write,
STATE fields replaced in place and EVENT-shaped fields appended (ADR-017) — and INBOX.md,
task.md, next-session.md are generated from it, with SUMMARY.md owning only a marked
region. `ob_start` renders the record (677 words on the fixture); `ob_state` is the one
writer and never creates the file (the migration does, behind a review gate). Done tasks
are retained three sessions; git is the history. Process decision alongside it: v0.29.0 was
the last direct push to master; each loop lives on a branch, is frozen by an annotated tag,
reported in a fixed contract, QA'd independently, and pushed as a draft PR whose CI on
ubuntu is the gate the Windows-only local runs cannot provide — which immediately found a
two-week-old red master (hotfix v0.29.1). Merging is a release decision, not a loop step.
