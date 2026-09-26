#!/usr/bin/env node

import { resolve } from "node:path";
import { runSync } from "./pipelines/sync/index.js";
import {
  scoreConfigStructure,
  scoreKnowledgeQuality,
  scoreStaleness,
  scoreCoverage,
  scorePipelineHealth,
} from "./pipelines/sync/scorer.js";
import { appendScore, readHistory, calculateTrend } from "./pipelines/sync/history.js";
import { resolvePaths } from "./shared/paths.js";
import { resolveRepoRoot, describeNoRoot } from "./shared/repo-root.js";
import type { ScoreResult, CategoryScore, MemoryChecks } from "./pipelines/sync/types.js";
import { parseArgs, type CommandSpec, type ParsedArgs } from "./shared/cli-args.js";
import { COMMAND_SPECS } from "./cli-spec.js";

/**
 * Load the memory module's sync checks, or return undefined if it is not
 * installed.
 *
 * Loop 13 (the module boundary). This dynamic import is the composition root:
 * it is the ONE place that knows both halves exist. `checks-memory.js` pulls in
 * `better-sqlite3`, a native build, so a static import here would make the
 * protocol CLI — version strings, hook wiring, state views — unusable on any
 * machine that cannot compile it. Q1 of the original evaluation: installable by
 * a stranger with Node and git.
 *
 * A failure is swallowed deliberately, and `runSync` renders the absence as
 * three SKIPPED checks naming the reason. The caller never sees "passed".
 */
async function loadMemoryChecks(): Promise<MemoryChecks | undefined> {
  try {
    const mod = await import("./pipelines/sync/checks-memory.js");
    return {
      checkVaultIndexParity: mod.checkVaultIndexParity,
      checkSchemaVersion: mod.checkSchemaVersion,
      checkProjectDirsExist: mod.checkProjectDirsExist,
    };
  } catch {
    return undefined;
  }
}

/**
 * T-185: parse a subcommand's tokens against its declared flags, or refuse with
 * exit 2 before anything is read or written. Exit 2 is a usage refusal; the
 * commands' own refusals stay at 1.
 */
function parseOrRefuse(spec: CommandSpec, tokens: readonly string[]): ParsedArgs {
  const r = parseArgs(spec, tokens);
  if (!r.ok) {
    console.error(`${spec.name} refused: ${r.error}\nNothing was run.`);
    process.exit(2);
  }
  return r.args;
}

const args = process.argv.slice(2);
const command = args[0];

if (command === "sync") {
  const opts = parseOrRefuse(COMMAND_SPECS.sync, args.slice(1));
  const checkOnly = opts.has("--check");
  const score = opts.has("--score");
  const scoreJson = opts.has("--json");
  const history = opts.has("--history");
  // R4 (Loop 3): resolve the real root before anything reads it. Run from
  // open-brain/ this used to score the sub-package and print a wrong answer.
  // An EXISTING directory still walks up to its project root; one that does not
  // exist was refused above, rather than walking up from the cwd (T-185).
  const startDir = opts.directory ?? resolve(".");
  const projectRoot = resolveRepoRoot(startDir);
  if (!projectRoot) {
    console.error(`sync refused: ${describeNoRoot(startDir)}`);
    process.exit(1);
  }

  if (history) {
    const paths = resolvePaths(projectRoot);
    const entries = readHistory(paths.scoreHistory);
    if (entries.length === 0) {
      console.log("No score history found.");
    } else {
      const trend = calculateTrend(entries);
      console.log(`Score History (${entries.length} entries):`);
      for (const entry of entries.slice(-10)) {
        console.log(`  ${entry.date}: ${entry.total}/100`);
      }
      console.log(`Trend: ${trend}`);
    }
    process.exit(0);
  }

  const result = runSync({ projectRoot, checkOnly, score, scoreJson, history, memoryChecks: await loadMemoryChecks() });

  // Print results
  console.log(`\nSync — v${result.version}\n`);

  if (result.fixed.length > 0) {
    console.log("FIXED:");
    for (const c of result.fixed) console.log(`  ${c.name}: ${c.message}`);
    console.log();
  }

  if (result.issues.length > 0) {
    console.log("ISSUES:");
    for (const c of result.issues) console.log(`  ${c.name}: ${c.message}`);
    console.log();
  }

  if (result.warnings.length > 0) {
    console.log("WARNINGS:");
    for (const c of result.warnings) console.log(`  ${c.name}: ${c.message}`);
    console.log();
  }

  if (result.skipped.length > 0) {
    console.log("SKIPPED:");
    for (const c of result.skipped) console.log(`  ${c.name}: ${c.message}`);
    console.log();
  }

  const reported = result.checks.filter((c) => c.report);
  if (reported.length > 0) {
    console.log("REPORTED (printed whatever the severity):");
    for (const c of reported) console.log(`  ${c.name} [${c.severity}]: ${c.message}`);
    console.log();
  }

  console.log(
    `Summary: ${result.passed.length} passed, ${result.fixed.length} fixed, ${result.warnings.length} warnings, ${result.issues.length} issues, ${result.skipped.length} skipped`
  );

  if (score) {
    const paths = resolvePaths(projectRoot);
    const { existsSync } = await import("node:fs");

    // Score against the same v2 database the MCP server uses. This path used to
    // open the retired v1 knowledge.db, so `open-brain sync --score` and
    // `ob_score` reported different totals for the same repo.
    const { computeScore } = await import("./pipelines/sync/score.js");
    const { openV2Database } = await import("./db-v2.js");

    if (!existsSync(paths.knowledgeV2Db)) {
      console.error(`Knowledge database not found at ${paths.knowledgeV2Db} — cannot score.`);
      process.exit(1);
    }

    const v2db = openV2Database(paths.knowledgeV2Db);
    let computed: ScoreResult;
    try {
      computed = computeScore(projectRoot, result.checks, v2db);
    } finally {
      v2db.close();
    }

    const categories: CategoryScore[] = computed.categories;
    const total = computed.total;

    const scoreResult: ScoreResult = {
      total,
      categories,
      date: computed.date,
    };

    if (scoreJson) {
      console.log(JSON.stringify(scoreResult, null, 2));
    } else {
      console.log(`\nHealth Score: ${total}/100\n`);
      for (const cat of categories) {
        const bar = "█".repeat(Math.round((cat.score / cat.max) * 20)).padEnd(20, "░");
        console.log(`  ${bar} ${cat.name}: ${cat.score}/${cat.max}`);
      }
      appendScore(paths.scoreHistory, scoreResult);
      console.log(`\nAppended to score history.`);
    }
  }

  if (checkOnly && result.issues.length > 0) {
    process.exit(1);
  }
} else if (command === "start") {
  const projectRoot = parseOrRefuse(COMMAND_SPECS.start, args.slice(1)).directory ?? resolve(".");

  // Dynamic import to avoid loading session-start code when running sync
  const { sessionStart } = await import("./pipelines/session-start/index.js");
  const { homedir } = await import("node:os");
  const result = sessionStart({ projectRoot, homePath: homedir() });

  console.log(`\nSession Start — ${result.state.mode} mode`);
  console.log(`Project: v${result.state.version}`);

  if (result.drift.length > 0) {
    console.log(`\nDrift detected:`);
    for (const d of result.drift) {
      console.log(`  ${d.field}: expected ${d.expected}, got ${d.actual}`);
    }
  }

  if (result.session.logPath) {
    console.log(`\nSession log: ${result.session.logPath}`);
    console.log(`Session ID: ${result.session.sessionId ?? "discovery failed"}`);
  }

  console.log(`\nState: ${result.state.summary ? "SUMMARY loaded" : "no SUMMARY"}`);
  console.log(`Inbox: ${result.state.inbox ? "INBOX loaded" : "no INBOX"}`);
} else if (command === "relocate") {
  // Parsed before the database is opened: a refusal must not have touched it.
  const { openV2Database } = await import("./db-v2.js");
  const { planRelocate, applyRelocate, detectMissingProjects } = await import("./relocate.js");
  const { obsidianVaultDir } = await import("./shared/paths.js");

  const paths = resolvePaths(resolve("."));
  const db = openV2Database(paths.knowledgeV2Db);
  const opts = parseOrRefuse(COMMAND_SPECS.relocate, args.slice(1)); // QA 120 mutant: parsed AFTER the DB is opened
  const vaultDir = obsidianVaultDir();

  const from = opts.value("--from");
  const to = opts.value("--to");

  if (!from || !to) {
    // No arguments means "tell me what is wrong", not an error. The detector is
    // the reason this command exists; the rename is the remedy.
    const missing = detectMissingProjects(db);
    console.log(`\nProject directories that no longer exist on disk: ${missing.length}\n`);
    for (const m of missing) {
      console.log(`  ${m.projectDir}`);
      console.log(`    ${m.entries} knowledge entries, ${m.sessions} sessions — unreachable by project-scoped recall`);
    }
    if (missing.length > 0) {
      console.log(`\nTo fold one onto its new location:`);
      console.log(`  open-brain relocate --from "<old path>" --to "<new path>" [--apply]`);
    }
    console.log(`\nRead-only. Nothing was written.`);
    process.exit(0);
  }

  const plan = planRelocate(db, vaultDir, from, to);
  console.log(`\nRelocate  ${plan.fromCanonical}\n       →  ${plan.toCanonical}\n`);
  if (!plan.targetExistsOnDisk) {
    console.log(`  WARNING: the target directory does not exist on disk either.`);
  }
  console.log(`  knowledge entries : ${plan.knowledgeRows}`);
  console.log(`  sessions          : ${plan.sessionRows}`);
  console.log(`  vault notes to move: ${plan.noteMoves.length} → Experiences/${plan.toDisplay}/`);
  if (plan.collisions.length > 0) {
    console.log(`\n  ${plan.collisions.length} name collision(s) — these are NOT moved and NOT overwritten:`);
    for (const c of plan.collisions) console.log(`    ${c.from}`);
  }

  if (!opts.has("--apply")) {
    console.log(`\nDry run. Re-run with --apply to make these changes.`);
    process.exit(0);
  }

  const result = applyRelocate(db, plan);
  console.log(`\nApplied: ${result.knowledgeRows} entries, ${result.sessionRows} sessions, ${result.notesMoved} notes moved.`);
  for (const f of result.noteFailures) console.log(`  FAILED to move ${f.path}: ${f.reason}`);
  process.exit(result.noteFailures.length > 0 ? 1 : 0);
} else if (command === "topics") {
  const opts = parseOrRefuse(COMMAND_SPECS.topics, args.slice(1));
  const { openV2Database } = await import("./db-v2.js");
  const { planTopics, writeTopics } = await import("./pipelines/topics/index.js");
  const { obsidianVaultDir } = await import("./shared/paths.js");

  const paths = resolvePaths(resolve("."));
  const db = openV2Database(paths.knowledgeV2Db);
  const vaultDir = obsidianVaultDir();

  const minArg = opts.value("--min");
  const min = minArg !== undefined ? Number(minArg) : 5;
  if (!Number.isFinite(min) || min < 1) {
    console.error(`Invalid --min: expected a positive number, got "${minArg}".`);
    process.exit(1);
  }

  const plans = planTopics(db, vaultDir, { min });
  console.log(`\nTopics — ${plans.length} tags with >= ${min} entries\n`);
  for (const p of plans.slice(0, 20)) console.log(`  ${String(p.links.length).padStart(4)}  ${p.tag}`);
  if (plans.length > 20) console.log(`  ... +${plans.length - 20} more`);

  if (!opts.has("--apply")) {
    console.log(`\nDry run. Re-run with --apply to write Topics/ into the vault.`);
    process.exit(0);
  }

  const result = writeTopics(vaultDir, plans);
  console.log(`\nWrote ${result.written.length} topic note(s); removed ${result.removed.length} now below threshold.`);
  if (result.skippedForeign.length > 0) {
    console.log(`Left ${result.skippedForeign.length} hand-written note(s) in Topics/ untouched:`);
    for (const f of result.skippedForeign.slice(0, 10)) console.log(`  ${f}`);
  }
} else if (command === "detach") {
  // C3's concrete first piece: "return the tree to detached after a push." It had
  // been run by hand more than twenty times, which is exactly the shape C3
  // describes — a step that works because a seat remembers it.
  const opts = parseOrRefuse(COMMAND_SPECS.detach, args.slice(1));
  const { detachToUpstream } = await import("./pipelines/detach/index.js");
  const startDir = opts.directory ?? resolve(".");
  const repoRoot = resolveRepoRoot(startDir);
  if (!repoRoot) {
    console.error(`detach refused: ${describeNoRoot(startDir)}`);
    process.exit(1);
  }
  const r = detachToUpstream(repoRoot, {
    dryRun: opts.has("--dry-run"),
    noFetch: opts.has("--no-fetch"),
    force: opts.has("--force"),
  });
  console.log(`detach — ${repoRoot}`);
  for (const step of r.steps) console.log(`  ${step}`);
  if (!r.ok) {
    console.error(`
detach REFUSED: ${r.error}`);
    process.exit(1);
  }
  console.log(`
HEAD: ${r.headBefore?.slice(0, 7)}${r.branchBefore ? ` (${r.branchBefore})` : " (detached)"} -> ${r.headAfter?.slice(0, 7)} (detached)`);
  process.exit(0);
} else if (command === "state") {
  // Loop 4 C1: the one-shot migration door. `state import --draft` (default)
  // writes a reviewable draft + report; `--commit` applies the reviewed draft.
  const sub = args[1];
  if (sub !== "import" && sub !== "show" && sub !== "migrate") {
    console.error("Usage: open-brain state <show [--json] | import [--draft | --commit] [--force-snapshot] | migrate --seat <planner|developer|qa> [--last-session-seat <seat>] [--keep-revision] [--dry-run] <file...>> [dir]");
    process.exit(1);
  }

  // Loop 14 C2: schema v1 -> v2. `applyStateOps` cannot do this — it refuses a
  // file that does not validate against the CURRENT schema, so once the schema
  // moves the writer can no longer read the record it must migrate. The only
  // alternative is a hand-edit of the record, which is what the single-writer
  // rule exists to prevent. So the migration is a program, with a dry run, and
  // it runs identically on the live record, the shipped template and the fixture.
  if (sub === "migrate") {
    const opts = parseOrRefuse(COMMAND_SPECS.stateMigrate, args.slice(2));
    const { migrateStateFile } = await import("./pipelines/state-migrate/index.js");
    const seat = opts.value("--seat");
    if (!seat) {
      console.error("state migrate refused: --seat <planner|developer|qa> is REQUIRED.");
      console.error("A v1 handoff does not say whose it is, and guessing would attribute one seat's words to another.");
      process.exit(1);
    }
    const files = opts.positionals;
    if (files.length === 0) {
      console.error("state migrate refused: name at least one state.json to migrate.");
      process.exit(1);
    }
    const dryRun = opts.has("--dry-run");
    const migrate = (f: string, asDryRun: boolean) =>
      migrateStateFile(resolve(f), {
        seat: seat as "planner" | "developer" | "qa",
        lastSessionSeat: (opts.value("--last-session-seat") as "planner" | "developer" | "qa" | undefined) ?? null,
        dryRun: asDryRun,
        keepRevision: opts.has("--keep-revision"),
      });
    // R185-5: every named file is checked (a dry run: exists, parses, migrates
    // and validates) before ANY is written. Before this, a refusal said "nothing
    // was written for those" while an earlier file in the list had been migrated.
    const checks = files.map((f) => migrate(f, true));
    const failed = checks.filter((r) => !r.ok).length;
    if (failed > 0) {
      for (const r of checks) {
        console.log(`${dryRun ? "[dry run] " : ""}${r.path}`);
        console.log(r.ok ? "  not written: another named file was refused" : `  REFUSED: ${r.error}`);
      }
      console.error(`
${failed} file(s) refused — nothing was written for any named file.`);
      process.exit(1);
    }
    for (const [i, f] of files.entries()) {
      const r = dryRun ? checks[i]! : migrate(f, false);
      console.log(`${dryRun ? "[dry run] " : ""}${r.path}`);
      if (!r.ok) {
        // Only reachable if a file changed between the check and the write.
        console.log(`  REFUSED: ${r.error}`);
        console.error(`\n${r.path} refused after the check passed — files listed before it WERE written.`);
        process.exit(1);
      }
      for (const c of r.changes) console.log(`  ${c}`);
    }
    process.exit(0);
  }

  // G-006: the read door. ob_state was the only way to see the record, so with
  // the MCP server down the only remaining option was opening the JSON by hand.
  // Read-only by construction — no write path is added here, so the
  // single-writer rule (every mutation goes through applyStateOps) still holds.
  if (sub === "show") {
    const opts = parseOrRefuse(COMMAND_SPECS.stateShow, args.slice(2));
    const { readState } = await import("./shared/state-writer.js");
    const startDir = opts.directory ?? resolve(".");
    const projectRoot = resolveRepoRoot(startDir);
    if (!projectRoot) {
      console.error(`state show refused: ${describeNoRoot(startDir)}`);
      process.exit(1);
    }
    const r = readState(projectRoot);
    if (!r.ok) {
      console.error(`state show refused: ${r.error}`);
      process.exit(1);
    }
    if (opts.has("--json")) {
      console.log(JSON.stringify(r.data, null, 2));
      process.exit(0);
    }
    const st = r.data;
    const count = (pred: (t: (typeof st.tasks)[number]) => boolean) => st.tasks.filter(pred).length;
    console.log(`
state — ${st.project.name}
`);
    console.log(`Root: ${projectRoot}`);
    console.log(`File: ${r.path}`);
    console.log(`Revision: ${st.revision} · schema ${st.schema_version}`);
    console.log(`Last session: ${st.last_session.n} (${st.last_session.date})${st.last_session.uuid ? ` · ${st.last_session.uuid}` : ""}`);
    console.log(`Objective: ${st.objective ? `${st.objective.text} (since session ${st.objective.since_session})` : "none"}`);
    console.log(
      `Tasks: ${st.tasks.length} — open ${count((t) => t.status === "open")}, ` +
      `in_progress ${count((t) => t.status === "in_progress")}, blocked ${count((t) => t.status === "blocked")}, ` +
      `done ${count((t) => t.status === "done")} (retained)`
    );
    for (const p of ["P0", "P1", "P2", "P3"] as const) {
      const active = st.tasks.filter((t) => t.priority === p && t.status !== "done");
      if (active.length === 0) continue;
      console.log(`  ${p}: ${active.length}`);
      for (const t of active.slice(0, 5)) console.log(`    ${t.status === "in_progress" ? "~" : t.status === "blocked" ? "!" : " "} ${t.id} ${t.title}`);
      if (active.length > 5) console.log(`    ... +${active.length - 5} more`);
    }
    console.log(`Verified: ${st.verified.length} · gaps: ${st.gaps.length} · decisions: ${st.decisions.length}`);
    if (st.handoffs.length === 0) console.log(`Handoffs: none recorded`);
    for (const h of st.handoffs) {
      console.log(`Handoff [${h.seat}] (session ${h.session}): ${h.pick_up || "nothing recorded"}`);
      if (h.watch_out.length) console.log(`  watch out: ${h.watch_out.length} item(s)`);
      if (h.open_questions.length) console.log(`  open questions: ${h.open_questions.length}`);
      if (h.loop_state) {
        const l = h.loop_state;
        console.log(`  loop state: ${l.open_prs.length} open PR(s), frozen ${l.frozen_sha ?? "none"}, ${l.questions_for_aaron.length} question(s) for Aaron, ${l.rulings.length} ruling(s)`);
      }
    }
    console.log(`
Read-only. Change state through ob_state — never by editing the file.`);
    process.exit(0);
  }

  const { runDraft, runCommit, DRAFT_REL, REPORT_REL, STATE_REL } = await import("./pipelines/state-import/index.js");
  const { relative } = await import("node:path");
  const commit = args.includes("--commit");
  if (commit && args.includes("--draft")) {
    console.error("state import: pass --draft or --commit, not both");
    process.exit(1);
  }
  const startDir = resolve(args.slice(2).find((a) => !a.startsWith("--")) ?? ".");
  const projectRoot = resolveRepoRoot(startDir);
  if (!projectRoot) {
    console.error(`state import refused: ${describeNoRoot(startDir)}`);
    process.exit(1);
  }
  // Local calendar date, not UTC: an evening run must not stamp tomorrow.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  try {
    if (!commit) {
      const r = runDraft(projectRoot, today);
      const rep = r.draft.report;
      console.log(`\nstate import — draft (nothing else changed)\n`);
      console.log(`Root: ${projectRoot}`);
      console.log(`Draft:  ${DRAFT_REL}`);
      console.log(`Report: ${REPORT_REL}`);
      console.log(`Validates: ${r.validation.ok ? "yes" : `NO — ${r.validation.error}`}`);
      console.log(`Current session: ${rep.current_session} (${rep.last_session.file})`);
      const s = rep.inbox.by_status;
      console.log(`Tasks: ${rep.inbox.items} (open ${s.open}, in_progress ${s.in_progress}, blocked ${s.blocked}, done ${s.done}); superseded links ${rep.inbox.superseded_links.length}; unparsed lines ${rep.inbox.unparsed.length}`);
      console.log(`Decisions: ${rep.decisions.imported} (${rep.decisions.skipped.length} skipped) · verified ${rep.verified_seeded} · gaps ${rep.gaps_seeded} · objective ${rep.objective.found ? "found" : "NOT found"}`);
      console.log(`Handoff: pick_up ${rep.handoff.pick_up_lines} lines, watch_out ${rep.handoff.watch_out}, open_questions ${rep.handoff.open_questions}`);
      if (rep.summary_removal) console.log(`SUMMARY.md: --commit will remove ${rep.summary_removal.total_lines_removed} lines (${rep.summary_removal.blockquote_lines} blockquote + ${rep.summary_removal.current_state_lines} Current State)`);
      console.log(`\nReview the report, then run: open-brain state import --commit`);
      process.exit(r.validation.ok ? 0 : 1);
    }
    const r = runCommit(projectRoot, today, { forceSnapshot: args.includes("--force-snapshot") });
    console.log(`\nstate import — committed\n`);
    console.log(`Snapshot: ${relative(projectRoot, r.snapshot.dir)} (${r.snapshot.files} files)`);
    console.log(`Wrote:    ${STATE_REL} at revision 0`);
    if (r.summary) console.log(`SUMMARY.md: removed ${r.summary.total_lines_removed} lines (${r.summary.blockquote_lines} blockquote + ${r.summary.current_state_lines} Current State); kept ${r.summary.kept_headings.join(", ")}`);
    console.log(`Rendered: ${r.rendered.join(", ")}`);
    console.log(`Moved into snapshot: ${r.moved.join(", ")}`);
  } catch (err) {
    console.error(`state import refused: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
} else {
  console.log("Usage: open-brain <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  sync [--check] [--score [--json]] [--history]");
  console.log("  start                                     Start a session");
  console.log("  end [--dry-run]                            End a session");
  console.log("  relocate [--from <dir> --to <dir>] [--apply]  Fold a renamed project's history forward");
  console.log("  topics [--min=<n>] [--apply]               Generate Topic notes from subject tags");
  console.log("  state show [--json]                                 Read .agents/state.json (read-only; write via ob_state)");
  console.log("  state import [--draft|--commit] [--force-snapshot]  Migrate .agents/ prose into state.json (once)");
  console.log("  state migrate --seat <planner|developer|qa> [--last-session-seat <seat>] [--keep-revision] [--dry-run] <file...>");
  console.log("                                             Migrate state.json schema v1 -> v2");
  console.log("  detach [--dry-run] [--no-fetch] [--force] [dir]      Return a seat worktree to detached at origin/master");
  process.exit(1);
}
